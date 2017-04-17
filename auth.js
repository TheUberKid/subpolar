var crypto = require('crypto');
// database models
var db_User = require('./models/user');
var db_Session = require('./models/session');
// async logging
var winston = require('winston');

// validates user registration attempts
function auth_register(name, password, socket){
  var n = name.replace(/\s+/g, '');
  // check for problems
  if(n.length < name.length){
    socket.emit('nu-error', 'cannot have spaces in username');
    return 1;
  } else if(socket.loggedIn){
    socket.emit('nu-error', 'you are already logged in');
    return 1;
  } else if(name.substring(0, 5).toLowerCase() === 'guest'){
    socket.emit('nu-error', 'guest names are reserved');
    return 1;
  } else if(password.length < 7){
    socket.emit('nu-error', 'password must be at least 7 chars');
    return 1;
  } else if(name.length === 0 || password.length === 0){
    socket.emit('nu-error', 'fields cannot be blank');
    return 1;
  } else if(name.length > 14 || password.length > 16){
    socket.emit('nu-error', 'name or password too long');
    return 1;
  } else {
    var raw = name.toLowerCase();
    // check if user already exists
    db_User.count({rawname: raw}, function(err, count){
      if(err) throw err;

      // good to go
      if(count === 0){
        // generate a salt
        var s = crypto.randomBytes(Math.ceil(3/2))
                .toString('hex')
                .slice(0, 3);

        // salt and hash the password with sha512
        var hash = crypto.createHmac('sha512', s);
        hash.update(password);
        var hashedPassword = hash.digest('hex');

        // create a new player
        var u = db_User({
          username: name,
          rawname: raw,
          hash: hashedPassword,
          salt: s,
          admin: false
        });

        // save the player's information
        u.save(function(err){
          if(err) throw err;
          winston.log('debug', 'Registered new player: ' + u.username + ' (' + u.id + ')');

          // return success and log in the new player
          socket.emit('login-success', u.username, true, true);
          socket.loggedIn = true;
          socket.player.pid = u.id;
          socket.player.displayName = u.username;

          // return a session token to the client
          var token = generate_session(u.id);
          socket.emit('session', token);
          return 0;
        });

      } else {
        // the user already exists
        socket.emit('nu-error', 'that name is already taken');
        return 1;
      }
    });
  }
}

// called when a guest logs in
function auth_guest(name, socket){
  var n = name.replace(/\s+/g, '');
  if(n.length < name.length){
    socket.emit('nu-error', 'cannot have spaces in username');
  } else if(name.length > 0){
    if(name.length <= 7){
      // create a guest player
      socket.player.displayName = 'Guest '+name;
      socket.emit('login-success', socket.player.displayName, false, true);
      socket.player.pid = 'guest';
      return 0;
    } else {
      socket.emit('nu-error', 'name or password too long');
      return 1;
    }
  } else {
    // generate a guest username
    socket.player.displayName = 'Guest #' + Math.ceil(Math.random() * 999).pad(3);
    socket.emit('login-success', socket.player.displayName, false, true);
    socket.player.pid = 'guest';
    return 0;
  }
}

// validate login information
function auth_login(name, password, socket){
  // check for problems
  if(socket.loggedIn){
    socket.emit('login-error', 'you are already logged in');
    return 1;
  } else if(name.length === 0 || password.length === 0){
    socket.emit('login-error', 'fields cannot be blank');
    return 1;
  } else {
    var raw = name.toLowerCase();
    db_User.find({rawname: raw}, function(err, user){
      if (err) throw err;
      // check if user actually exists
      if(user.length === 0){
        socket.emit('login-error', 'invalid login info');
        return 1;
      } else {

        var u = user[0];

        // hash password input with stored salt
        var hash = crypto.createHmac('sha512', u.salt);
        hash.update(password);
        var hashedPassword = hash.digest('hex');

        // compare hashes
        if(hashedPassword === u.hash){
          // if the hashes match, it is a valid login
          winston.log('debug', u.username + ' ('+ u.id + ') logged in');
          socket.emit('login-success', u.username, true, false);
          socket.loggedIn = true;
          socket.player.pid = u.id;
          socket.player.displayName = u.username;

          // return a session token to the client
          var token = generate_session(u.id);
          socket.emit('session', token);
          return 0;

        } else {
          // otherwise the information is incorrect
          socket.emit('login-error', 'invalid login info');
          return 1;
        }

      }
    });
  }
}

// when a user wants to log out
function auth_logout(socket){
  winston.log('debug', socket.player.displayName + ' ('+ socket.player.pid +') logged out');
  if(socket.loggedIn){
    socket.loggedIn = false;
    // destroy their sessions
    db_Session.remove({pid: socket.player.pid}, function(err){
      if (err) return handleError(err);
    });
    delete socket.player.pid;
  }
  delete socket.player.displayName;
  socket.emit('logout-success');
}

// function to create session tokens
function generate_session(id){
  // generates and returns a session
  var h = crypto.randomBytes(Math.ceil(3/2))
          .toString('hex')
          .slice(0, 3);

  // create session token with sha512
  var token = crypto.createHmac('sha512', h).digest('hex');

  var s = db_Session({
    hash: token,
    pid: id,
    expires: new Date().getTime() + (1000*60*60*24*30)
  });
  s.save(function(err) {
    if(err) throw err;
  });

  return token;
}

// log in users with a session token
function auth_session(token, socket){

  db_Session.find({hash: token}, function(err, session){
    if (err) throw err;

    // check if session is valid
    if(session.length > 0){
      var s = session[0];
      if(s.expires > new Date().getTime()){

        // find the relevant user
        db_User.find({_id: s.pid}, function(err, user){
          if (err) throw err;

          if(user.length > 0){
            var u = user[0];
            winston.log('debug', u.username + ' ('+ u.id + ') logged in');
            socket.emit('login-success', u.username, true, false);
            socket.loggedIn = true;
            socket.player.pid = u.id;
            socket.player.displayName = u.username;
            return 0;
          } else {
            socket.emit('session-error');
            return 1;
          }
        });
      } else {
        db_Session.remove({hash: token}, function(err){
          if(err) return handleError(err);
        });
        socket.emit('session-error');
        return 1;
      }
    } else {
      socket.emit('session-error');
      return 1;
    }
  });
}

module.exports = {
  register: auth_register,
  login: auth_login,
  guest: auth_guest,
  logout: auth_logout,
  session: auth_session
}
