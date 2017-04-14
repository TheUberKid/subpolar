'use strict';
Number.prototype.pad = function(n){
  return ('0'.repeat(n)+this).slice(-n);
}

var version = '0.1.0';

// universal step - must be synced with client
// this determines how many 'micro-calculations' are done per frame for more accurate collision checking and movement
var unistep = 4;

var express = require('express');
var app = express();
var serv = require('http').Server(app);

// database variables
var mongoose = require('mongoose');

function moduleAvailable(name) {
  try {
    require.resolve(name);
    return true;
  } catch(e){}
  return false;
}
// test if in local environment or on server
if(moduleAvailable('./config.js')){
  var config = require('./config.js');
  mongoose.connect(config.dbkey);
} else {
  mongoose.connect(process.env.dbkey);
  app.get('*',function(req,res,next){
    if(req.headers['x-forwarded-proto'] != 'https'){
      res.redirect('https://play.subpolar.net'+req.url);
    } else {
      next();
    }
  });
}

// serve index.html when a user accesses the url
app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client')); // allow read of filepaths starting with /client/
app.use('/.well-known', express.static(__dirname + '/.well-known'));

// delete requests if they timeout (30 seconds)
var timeout = require('connect-timeout');
app.use(timeout(30*1000));
app.use(haltOnTimedout);
function haltOnTimedout(req, res, next){
  if (!req.timedout) next();
}

serv.listen(process.env.PORT || 5000);
console.log('Server started');

// map and ship data
var maps = require('./maps.js');
var ships = require('./ships.js');

// database models
var db_User = require('./models/user');
var db_Session = require('./models/session');

var crypto = require('crypto');
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
          console.log('Registered new player: ' + u.username + ' (' + u.id + ')');

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
          console.log(u.username + ' ('+ u.id + ') logged in');
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
  console.log(socket.player.displayName + ' ('+ socket.player.pid +') logged out');
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
            console.log(u.username + ' ('+ u.id + ') logged in');
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

var Sockets = {}; // array of all socket connections
var population = 0; // total number of online players
var framerate = 30;
var radians = Math.PI/180;

// room constructor
var rooms = [];
var Room = function(id, map){
  this.id = id;
  this.players = {};
  this.population = 0;
  this.teams = maps[map].config.teams ? [0, 0] : [];
  this.map = map;
  this.zone = maps[map].config.zone;
  this.starttime = 0;
  this.endtime = 0;
  this.countdown = 0;
  this.objectives = JSON.parse(JSON.stringify(maps[map].objectives));
  this.projectiles = [];
  this.state = maps[map].config.lobby ? 'lobby' : 'active';
}

// player constructor
// pid is the login id of the user assigned to that player
var Player = function(id){
  this.id = id;
  this.x_velocity = 0;
  this.y_velocity = 0;
  this.rotate = 0;
  this.keys = [];
  this.collided = false;
  this.reload = 0; // minimum reload time
  this.death = false;
  this.deathTime = 0;
  this.joined = false;
  this.bounty = 10;
  this.kills = 0;
  this.stealth = false;
  this.abilitycd = 0;
}

// bot constructor
// a bot is a 'player' that is not assigned to a socket
var Bot = function(room, id, name, ship, x, y, rotate, team){
  this.bot = true;
  this.room = room;
  this.id = id;
  this.displayName = name;
  this.ship = ship;
  this.energy = ships.stats[ship].maxenergy;
  this.x = x;
  this.y = y;
  this.x_velocity = 0;
  this.y_velocity = 0;
  this.rotate = rotate;
  this.map = room.map;
  this.joined = true;
  this.keys = [];
  this.collided = false;
  this.reload = 0;
  this.death = false;
  this.deathTime = 0;
  this.bounty = 0;
  this.kills = 0;
  this.stealth = false;
  this.abilitycd = 0;
  this.team = team ? team : -1;
}

// projectile constructor
// NOTE: this is a different projectile object than the client's projectile.
// These are only used for keeping track of projectiles and updating them, and are not passed to the client.
// Instead, an event is triggered when a bullet is fired and separate computations are performed on the client side.
var Projectile = function(id, x, y, x_velocity, y_velocity, type, lifetime, damage, bounce, explosive, penetrate, origin, map){
  this.id = id;
  this.x = x;
  this.y = y;
  this.x_velocity = x_velocity;
  this.y_velocity = y_velocity;
  this.type = type;
  this.lifetime = lifetime; // how long the projectile can last
  this.damage = damage;
  this.bounce = bounce; // how many times the projectile can bounce
  this.explosive = explosive; // explosion radius. 0 if does not explode
  this.penetrate = penetrate*unistep; // amount of frames in which the bullet can penetrate through players
  this.origin = origin; // id of who created the projectile
  this.map = map;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
  var clientIp = socket.request.connection.remoteAddress;

  // pick a unique id for the player
  var id = Math.floor(Math.random()*100000);
  while(Sockets[id]) id = Math.floor(Math.random()*100000);
  socket.id = id;
  socket.player = new Player(id);
  socket.loggedIn = false;
  Sockets[id] = socket;
  population++;

  // give player their id and version number
  socket.emit('id', id, version);

  // authentication
  socket.on('register', function(name, password){
    auth_register(name, password, socket);
  });
  socket.on('guest', function(name){
    auth_guest(name, socket);
  });
  socket.on('login', function(name, password){
    auth_login(name, password, socket);
  });
  socket.on('session', function(token){
    auth_session(token, socket);
  });
  socket.on('logout', function(){
    auth_logout(socket);
  });

  // when player joins
  socket.on('join', function(ship, zone){
    // validate inputs
    if((socket.loggedIn || socket.player.pid === 'guest') && ships.stats[ship] && loops[zone]){
      var p = socket.player;

      // reset the player's keys
      for(var key in p.keys){
        p.keys[key] = false;
      }

      // assign the player a room that is not full
      var r;
      for(var i=0, j=rooms.length; i<j; i++){
        var m = maps[rooms[i].map];
        if(m.config.zone === zone && rooms[i].population < m.config.maxplayers && rooms[i].state !== 'ended'){
          r = rooms[i];
          p.room = r;
        }
      }
      // create new room if empty spot does not exist
      if(!r){
        var mapname = maps.index[zone][Math.floor(Math.random()*maps.index[zone].length)];
        rooms.push(new Room(rooms.length, mapname));
        r = rooms[rooms.length-1];
        p.room = r;
      }
      p.map = r.map;
      r.players[socket.id] = socket.player;
      r.population++;
      socket.emit('map', maps[p.map].mapdata, p.map);

      if(maps[p.map].config.teams){
        // assign player the team with the lowest players on that room
        var min = Math.min.apply(null, r.teams), // find team with lowest players
            team = r.teams.indexOf(min);
        r.teams[team]++;
        p.team = team;
      } else {
        // otherwise players do not have teams
        p.team = Math.round(Math.random()*10000);
      }

      // notify them if in lobby
      if(r.state === 'lobby'){
        socket.emit('newAnnouncement', {
          text: 'Waiting for more players...',
          lifetime: 60*60*1000,
          color: 'rgb(255, 255, 255)'
        });
      }

      // log their join
      p.joined = true;
      console.log(p.displayName + ' joined room ' + p.room.id + ' on team ' + p.team);

      // spawn them somewhere
      p.ship = ship;
      spawn(r, p);
    }
  });

  // log keypresses
  socket.on('keydown', function(e){
    var p = socket.player;
    p.keys[e] = true;
  });
  socket.on('keyup', function(e){
    var p = socket.player;
    p.keys[e] = false;
  });

  // when player submits a chat message
  socket.on('submitMessage', function(m){
    // validate message
    if(m.length > 0){
      var p = socket.player;

      // detect team chat
      var type = m.charAt(0) === '!' ? 'team' : 'room';
      if(m.charAt(0) === '!') m = m.slice(1);

      // log chat message
      var truncm = m.substring(0,150);
      console.log('ROOM' + socket.player.room.id + ' > ' + p.displayName + ' > ' + truncm + (type === 'team' ? ' [TEAM]' : ' [ROOM]'));

      // truncate message into groups of 50 chars to send at a time
      for(var i=0, j=Math.ceil(m.length/50); i<j; i++){
        var textblock = truncm.substring(i*50, (i+1)*50);
        if(textblock.charAt(0) === ' ') textblock = textblock.slice(1);

        // send the message appropriately
        type === 'team' ? emitTeam(p.room, p.team, 'newTeamMessage', p.displayName, textblock)
                        : emitRoom(p.room, 'newMessage', p.displayName, textblock);
      }

    }
  });

  // on disconnect, remove player from arrays and update everyone else's ids
  socket.on('disconnect', function(){
    delete Sockets[id];
    var p = socket.player;
    var r = p.room;

    if(p.joined){
      console.log(socket.player.displayName + ' disconnected from room '+r.id);
      r.teams[p.team]--;
      r.population--;
      // delete player from their room
      delete r.players[id];
      // decrement projectile origins
      for(var i in r.projectiles){
        var t = r.projectiles[i];
        if(t.origin === p.id){
          r.projectiles.splice(i, 1);
          emitRoom(r, 'projectileHit', t.id, t.x, t.y);
        }
      }
    }

    population--;
    // delete and disconnect socket
    socket.disconnect();
  });
});

// emit system
function emitGlobal(type, d1, d2, d3, d4, d5, d6){
  for(var i in Sockets){
    var socket = Sockets[i];
    socket.emit(type, d1, d2, d3, d4, d5, d6);
  }
}
function emitRoom(room, type, d1, d2, d3, d4, d5, d6){
  for(var i in room.players){
    var p = room.players[i];
    if(Sockets[p.id]) Sockets[p.id].emit(type, d1, d2, d3, d4, d5, d6);
  }
}
function emitTeam(room, team, type, d1, d2, d3, d4, d5, d6){
  for(var i in room.players){
    var p = room.players[i];
    if(p.team === team && Sockets[p.id]) Sockets[p.id].emit(type, d1, d2, d3, d4, d5, d6);
  }
}

// draw loops for each map
var loops = {
  'extreme games': function(r){
    drawProjectiles(r);
    var ppos = drawPlayers(r);
    var rankings = getLeaderboard(r);
    computeObjective(r);
    emitRoom(r, 'update', ppos, r.objectives, new Date().getTime(), population, rankings);
  },
  'trench wars': function(r){
    drawProjectiles(r);
    var ppos = drawPlayers(r);
    var rankings = getLeaderboard(r);
    computeObjective(r);
    emitRoom(r, 'update', ppos, r.objectives, new Date().getTime(), population, rankings);
  },
  'tutorial': function(r){
    drawProjectiles(r);
    var ppos = drawPlayers(r);
    var rankings = getLeaderboard(r);
    computeObjective(r);
    emitRoom(r, 'update', ppos, r.objectives, new Date().getTime(), population, rankings);
  }
};

var globalLoop = function(){
  for(var i = rooms.length - 1; i > -1; i--){
    var r = rooms[i];
    loops[maps[r.map].config.zone](r);
    if(r.population < 1) rooms.splice(i, 1);
  }
}
setInterval(globalLoop, 1000/framerate);

// objectives and round regulation
function computeObjective(r){
  if(r.zone === 'tutorial'){
    if(r.state === 'active'){
      var loc = r.objectives;
      for(var i=0, j=loc.length; i<j; i++){
        var o = loc[i];
        if(o.seen && o.opacity < 50) o.opacity++;
        if(o.opacity === 1){
          if(o.trigger === 'tutorial-enemy'){
            // create 2 tutorial enemies
            var id1 = Math.floor(Math.random()*100000);
            while(Sockets[id1]) id1 = Math.floor(Math.random()*100000);
            var id2 = Math.floor(Math.random()*100000);
            while(Sockets[id2]) id2 = Math.floor(Math.random()*100000);
            r.players[id1] = new Bot(r, id1, "training dummy", "warbird", 1000, 1892, 90);
            r.players[id2] = new Bot(r, id2, "training dummy", "warbird", 1000, 2156, 90);
          }
        }
      }
    }
  }
  if(r.zone === 'extreme games'){
    if(r.state === 'lobby'){
      if(r.population >= maps[r.map].config.minplayers){
        r.state = 'countdown';
        r.starttime = new Date().getTime() + (1000*5);
        r.countdown = 5;
      }
    } else if(r.state === 'countdown'){
      // countdown until the start of the round
      var t = r.starttime - new Date().getTime();
      if(t <= 0){
        r.state = 'active';
        emitRoom(r, 'newAnnouncement', {
          text: 'Fight!',
          lifetime: 3000,
          color: 'rgb(150, 255, 150)'
        });
        for(var i in r.players) spawn(r, r.players[i]);
      } else {
        // countdown timer
        if(t < r.countdown*1000){
          emitRoom(r, 'newAnnouncement', {
            text: r.countdown + ' second(s) until the round begins!',
            lifetime: 1500,
            color: 'rgb(255, 255, 255)'
          });
          r.countdown--;
        }
      }
    } else if(r.state === 'active'){
      // win condition
      for(var i in r.players){
        var p = r.players[i];
        if(p.kills >= 10 || r.population === 1){
          r.state = 'ended';
          r.endtime = new Date().getTime();
          emitRoom(r, 'newAnnouncement', {
            text: p.displayName + ' has won!',
            lifetime: 10000,
            color: 'rgb(255, 150, 150)'
          });
          Sockets[p.id].emit('newAnnouncement', {
            text: p.displayName + ' has won!',
            lifetime: 10000,
            color: 'rgb(200, 255, 200)'
          });
          console.log(p.displayName + ' has won in room ' + r.id);
          break;
        }
      }
    } else if(r.state === 'ended'){
      // when a team or player wins, remove all players after 10 seconds
      if(new Date().getTime() - r.endtime > 10*1000){
        for(var i in r.players){
          var p = r.players[i];
          console.log(p.displayName + ' left room '+r.id);
          r.teams[p.team]--;
          r.population--;
          // delete player from their room
          delete r.players[p.id];
          // decrement projectile origins
          for(var i in r.projectiles){
            var t = r.projectiles[i];
            if(t.origin === p.id){
              r.projectiles.splice(i, 1);
              emitRoom(r, 'projectileHit', t.id, t.x, t.y);
            }
          }
          p.joined = false;
          p.kills = 0;
          p.bounty = 0;

          Sockets[p.id].emit('leave');
          break;
        }
      }
    }
  }

  if(r.zone === 'trench wars'){
    if(r.state === 'lobby'){
      if(r.population >= maps[r.map].config.minplayers){
        r.state = 'countdown';
        r.starttime = new Date().getTime() + (1000*5);
        r.countdown = 5;
      }
    } else if(r.state === 'countdown'){
      // countdown until the start of the round
      var t = r.starttime - new Date().getTime();
      if(t <= 0){
        r.state = 'active';
        emitRoom(r, 'newAnnouncement', {
          text: 'Fight!',
          lifetime: 3000,
          color: 'rgb(150, 255, 150)'
        });
        for(var i in r.players) spawn(r, r.players[i]);
      } else {
        // countdown timer
        if(t < r.countdown*1000){
          emitRoom(r, 'newAnnouncement', {
            text: r.countdown + ' second(s) until the round begins!',
            lifetime: 1500,
            color: 'rgb(255, 255, 255)'
          });
          r.countdown--;
        }
      }
    } else if(r.state === 'active'){
      // control points
      var loc = r.objectives;
      for(var i=0, j=loc.length; i<j; i++){
        var o = loc[i];
        var name = '';
        if(i === 0) name = 'western';
        if(i === 1) name = 'central';
        if(i === 2) name = 'eastern';
        // change control based on contesting players
        if(o.contested[0] && !o.contested[1] && !o.controlled[0]){
          o.control--;
        } else if(o.contested[1] && !o.contested[0] && o.control < 100){
          o.control++;
        } else if(Math.abs(o.control) < 100 && !o.contested[0] && !o.contested[1]){
          // slowly reset control if nobody is contesting
          if(o.controlled[0] === o.controlled[1]){
            if(o.control > 0) o.control--;
            if(o.control < 0) o.control++;
          } else {
            if(o.controlled[0]) o.control--;
            if(o.controlled[1]) o.control++;
          }
        }
        // determine control
        if(o.control <= -100 && !o.controlled[0]){
          emitTeam(r, 0, 'newNotice', {
            text: 'Your team controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(150, 255, 150)'
          });
          emitTeam(r, 1, 'newNotice', {
            text: 'The enemy controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(255, 150, 150)'
          });
          o.controlled = [true, false];
        }
        if(o.control >= 100 && !o.controlled[1]){
          emitTeam(r, 1, 'newNotice', {
            text: 'Your team controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(150, 255, 150)'
          });
          emitTeam(r, 0, 'newNotice', {
            text: 'The enemy controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(255, 150, 150)'
          });
          o.controlled = [false, true];
        }
        if(o.control === 0){
          if(o.controlled[0]){
            emitTeam(r, 0, 'newNotice', {
              text: 'Lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
            emitTeam(r, 1, 'newNotice', {
              text: 'The enemy lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
          }
          if(o.controlled[1]){
            emitTeam(r, 1, 'newNotice', {
              text: 'Lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
            emitTeam(r, 0, 'newNotice', {
              text: 'The enemy lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
          }
          o.controlled = [false, false];
        }
        o.contested = [false, false];
      }

      // win condition
      loc[0].control >= 100 ? loc[0].timesince++ : loc[0].timesince = 0;
      loc[2].control <= -100 ? loc[2].timesince++ : loc[2].timesince = 0;
      if(loc[0].timesince % 30 === 1){
        emitTeam(r, 1, 'newAnnouncement', {
          text: 'Your team wins in '+Math.ceil((450-loc[0].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(150, 255, 150)'
        });
        emitTeam(r, 0, 'newAnnouncement', {
          text: 'The enemy team wins in '+Math.ceil((450-loc[0].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(255, 150, 150)'
        });
      }
      if(loc[2].timesince % 30 === 1){
        emitTeam(r, 0, 'newAnnouncement', {
          text: 'Your team wins in '+Math.ceil((450-loc[2].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(150, 255, 150)'
        });
        emitTeam(r, 1, 'newAnnouncement', {
          text: 'The enemy team wins in '+Math.ceil((450-loc[2].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(255, 150, 150)'
        });
      }
      if(loc[0].timesince === 450){
        r.state = 'ended';
        r.endtime = new Date().getTime();
        emitTeam(r, 1, 'newAnnouncement', {
          text: 'Your team has won!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
        emitTeam(r, 0, 'newAnnouncement', {
          text: 'Your team has lost!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
      }
      if(loc[2].timesince === 450){
        r.state = 'ended';
        r.endtime = new Date().getTime();
        emitTeam(r, 0, 'newAnnouncement', {
          text: 'Your team has won!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
        emitTeam(r, 1, 'newAnnouncement', {
          text: 'Your team has lost!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
      }
    } else if(r.state === 'ended'){
      // when a team or player wins, remove all players after 10 seconds
      if(new Date().getTime() - r.endtime > 10*1000){
        for(var i in r.players){
          var p = r.players[i];
          console.log(p.displayName + ' left room '+r.id);
          r.teams[p.team]--;
          r.population--;
          // delete player from their room
          delete r.players[p.id];
          // decrement projectile origins
          for(var i in r.projectiles){
            var t = r.projectiles[i];
            if(t.origin === p.id){
              r.projectiles.splice(i, 1);
              emitRoom(r, 'projectileHit', t.id, t.x, t.y);
            }
          }
          p.joined = false;
          p.kills = 0;
          p.bounty = 0;

          Sockets[p.id].emit('leave');
          break;
        }
      }
    }
  }

}

// player objective testing
function checkObjective(p, r){
  if(r.zone === 'tutorial'){
    if(r.state === 'active'){
      var loc = r.objectives;
      for(var i=0, j=loc.length; i<j; i++){
        var o = loc[i];
        // check distance
        if(Math.sqrt(Math.pow(o.x - p.x, 2) + Math.pow(o.y - p.y, 2)) < 150){
          o.seen = true;
        }
      }
    }
  }
  if(r.zone === 'trench wars'){
    if(r.state === 'active'){
      var loc = r.objectives;
      for(var i=0, j=loc.length; i<j; i++){
        var o = loc[i];
        // check distance
        if(Math.sqrt(Math.pow(o.x - p.x, 2) + Math.pow(o.y - p.y, 2)) < 120){
          o.contested[p.team] = true;
        }
      }
    }
  }
}

function drawPlayers(r){
  var currentTime = new Date();
  var ppos = {};

  // iterate through players
  for(var i in r.players){
    var p = r.players[i];
    var s = ships.stats[p.ship];

    if(p.joined){

      // if player chooses to leave
      if(p.keys['leave']){
        console.log(p.displayName + ' left room '+r.id);
        r.teams[p.team]--;
        r.population--;
        // delete player from their room
        delete r.players[p.id];
        // decrement projectile origins
        for(var i in r.projectiles){
          var t = r.projectiles[i];
          if(t.origin === p.id){
            r.projectiles.splice(i, 1);
            emitRoom(r, 'projectileHit', t.id, t.x, t.y);
          }
        }
        p.joined = false;
        p.kills = 0;
        p.bounty = 0;

        Sockets[p.id].emit('leave');
        break;
      }

      if(!p.death && p.energy > 0){
        // limit maxspeed using pythagorean theorem
        var velocity = Math.sqrt(p.x_velocity*p.x_velocity + p.y_velocity*p.y_velocity);
        // if shift key multiply maxspeed by 1.5
        var maxspeed = s.maxspeed;
        if(p.keys['boost'] && (p.keys['up'] || p.keys['down']) && p.energy > 15){
          maxspeed *= 1.75;
        }

        // limit velocity to maxspeed
        if(velocity > maxspeed){
          p.x_velocity = p.x_velocity * (maxspeed/velocity);
          p.y_velocity = p.y_velocity * (maxspeed/velocity);
        }
        // update position
        p.x += p.x_velocity/100;
        p.y += p.y_velocity/100;

        // check if player hit the map
        collisionCheckMap(p, 14, function(pos, tx, ty, mx, my){
          if(pos === 0 || pos === 2){ // top or bottom collision: reverse y
            p.y = 22*(pos-1) + ty;
            p.y_velocity = p.y_velocity * -0.5;
            p.x_velocity = p.x_velocity * 0.5;
          }
          if(pos === 1 || pos === 3){ // 'left' or 'right' collision: reverse x
            p.x = 22*(pos-2) + tx;
            p.x_velocity = p.x_velocity * -0.5;
            p.y_velocity = p.y_velocity * 0.5;
          }
        });

        // objectives
        checkObjective(p, r);

        // movement
        if(!p.collided){
          if(p.keys['left']){
            if(p.rotate < 0) p.rotate = 360;
            p.rotate-=s.turnspeed;
          }
          if(p.keys['right']){
            if(p.rotate > 360) p.rotate = 0;
            p.rotate+=s.turnspeed;
          }
          // shift for thrusters
          var accel = s.accel;
          if(p.keys['boost'] && (p.keys['up'] || p.keys['down']) && p.energy > 15){
            accel = accel * 1.75;
            p.energy -= 2;
          }
          if(p.keys['up']){ // circular directional movement
            p.x_velocity += accel*Math.cos(radians*(p.rotate-90));
            p.y_velocity += accel*Math.sin(radians*(p.rotate-90));
          } else if(p.keys['down']){
            p.x_velocity -= accel*Math.cos(radians*(p.rotate-90));
            p.y_velocity -= accel*Math.sin(radians*(p.rotate-90));
          }
        }

        p.collided = false;

        // player actions
        if(p.keys['attack'] && p.energy > s.bulletenergyuse && p.reload === 0) fireProjectile(r, p, 17);
        if(p.keys['ability1']) useAbility(r, p, 1);

        if(p.reload > 0) p.reload--;
        if(p.abilitycd > 0) p.abilitycd--;
        if(p.energy < s.maxenergy && !(p.keys['boost'] && (p.keys['up'] || p.keys['down'])) && !p.stealth) p.energy += s.recharge;

      } else if(p.death){
        if(!p.bot){
          if(currentTime.getTime() - p.death > p.deathTime){
            spawn(r, p);
            emitRoom(r, 'playerRespawn', p.x, p.y);
          }
        } else {
          delete r.players[p.id];
        }
      }
    }

    // add to player position array
    ppos[p.id] = {
      x: p.x,
      y: p.y,
      joined: p.joined,
      team: p.team,
      id: p.id,
      rotate: p.rotate,
      ship: p.ship,
      energy: p.energy,
      death: p.death,
      deathTime: p.deathTime,
      displayName: p.displayName,
      bounty: p.bounty,
      kills: p.kills,
      stealth: p.stealth,
      abilitycd: p.abilitycd,
      bot: p.bot ? true : false
    };
  }
  // return player positions to emit
  return ppos;
}

// called when a projectile is fired
function fireProjectile(r, p, e){
  if(p.joined && r.state === 'active'){
    var s = ships.stats[p.ship];
    // bullets
    if(e === 17){

      // warbird
      if(p.ship === 'warbird'){
        var id = Math.round(Math.random()*10000);
        var x = p.x + 20*Math.cos(radians*(p.rotate-90));
        var y = p.y + 20*Math.sin(radians*(p.rotate-90));
        var x_velocity = s.bulletspeed*Math.cos(radians*(p.rotate-90)) + (p.x_velocity / 100);
        var y_velocity = s.bulletspeed*Math.sin(radians*(p.rotate-90)) + (p.y_velocity / 100);
        var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity, 'warbirdShot',
          s.bulletlifetime * unistep, s.bulletdamage, 0, 0, 4, p.id, p.map);
        r.projectiles.push(newProjectile);
        p.reload = s.reload;
        p.energy -= s.bulletenergyuse;
        emitRoom(r, 'projectile', newProjectile, p.rotate);
      }

      // lancaster
      if(p.ship === 'lancaster'){
        for(var i=0; i<2; i++){
          var id = Math.round(Math.random()*10000);
          var rotdiff;
          // fire two shots with origin point from a rotated player
          rotdiff = i === 0 ? -40 : 40;
          var x = p.x + 20*Math.cos(radians*(p.rotate-90+rotdiff));
          var y = p.y + 20*Math.sin(radians*(p.rotate-90+rotdiff));
          var x_velocity = s.bulletspeed*Math.cos(radians*(p.rotate-90)) + (p.x_velocity / 100);
          var y_velocity = s.bulletspeed*Math.sin(radians*(p.rotate-90)) + (p.y_velocity / 100);
          var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity, 'lancasterShot',
            s.bulletlifetime * unistep, s.bulletdamage, 0, 0, 0, p.id, p.map);
          r.projectiles.push(newProjectile);
          emitRoom(r, 'projectile', newProjectile, p.rotate);
        }
        p.reload = s.reload;
        p.energy -= s.bulletenergyuse;
      }

      // ghost
      if(p.ship === 'ghost'){
        var id = Math.round(Math.random()*10000);
        var x = p.x + 20*Math.cos(radians*(p.rotate-90));
        var y = p.y + 20*Math.sin(radians*(p.rotate-90));
        var x_velocity = s.bulletspeed*Math.cos(radians*(p.rotate-90)) + (p.x_velocity / 100);
        var y_velocity = s.bulletspeed*Math.sin(radians*(p.rotate-90)) + (p.y_velocity / 100);
        var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity,
          p.stealth ? 'ghostAmbushShot' : 'ghostShot',
          s.bulletlifetime * unistep, p.stealth ? s.bulletdamage*2 : s.bulletdamage, 0, 0, 0, p.id, p.map);
        r.projectiles.push(newProjectile);
        p.reload = s.reload;
        p.energy -= s.bulletenergyuse;
        if(p.stealth) p.stealth = false;
        emitRoom(r, 'projectile', newProjectile, p.rotate);
      }

      // aurora
      if(p.ship === 'aurora'){
        for(var i=0; i<2; i++){
          var id = Math.round(Math.random()*10000);
          var rotdiff;
          // fire two shots with origin point from a rotated player
          rotdiff = i === 0 ? -20 : 20;
          var x = p.x + 20*Math.cos(radians*(p.rotate-90+rotdiff));
          var y = p.y + 20*Math.sin(radians*(p.rotate-90+rotdiff));
          var x_velocity = s.bulletspeed*Math.cos(radians*(p.rotate-90)) + (p.x_velocity / 100);
          var y_velocity = s.bulletspeed*Math.sin(radians*(p.rotate-90)) + (p.y_velocity / 100);
          var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity,
            'auroraShot', s.bulletlifetime * unistep, s.bulletdamage, 0, 0, 0, p.id, p.map);
          r.projectiles.push(newProjectile);
          emitRoom(r, 'projectile', newProjectile, p.rotate);
        }
        p.reload = s.reload;
        p.energy -= s.bulletenergyuse;
      }

    }
  }
}

// called when an ability is used
function useAbility(r, p, e){
  if(p.joined && p.abilitycd <= 0 && r.state === 'active'){
    var s = ships.stats[p.ship];

    if(e === 1){

      // repel
      if(p.ship === 'warbird'){
        emitRoom(r, 'repel', p.x, p.y);
        // push away enemy projectiles
        for(var i=0; i<r.projectiles.length; i++){
          var t = r.projectiles[i];
          if(r.players[t.origin].team !== p.team){
            var diffx = t.x - p.x;
            var diffy = t.y - p.y;
            var distance = Math.sqrt(diffx*diffx + diffy*diffy);
            if(distance < 120){
              t.x_velocity = diffx > 0 ? (120-diffx)*5 : (-120+diffx)*5;
              t.y_velocity = diffy > 0 ? (120-diffy)*5 : (-120+diffy)*5;
              t.origin = p.id;
              emitRoom(r, 'repelBounce', t);
            }
          }
        }
        // push away enemy ships
        for(var i in r.players){
          var t = r.players[i];
          if(t.team !== p.team){
            var diffx = t.x - p.x;
            var diffy = t.y - p.y;
            var distance = Math.sqrt(diffx*diffx + diffy*diffy);
            if(distance < 140){
              t.x_velocity = diffx > 0 ? Math.round(140-diffx)*3 : Math.round(-140+diffx)*3;
              t.y_velocity = diffy > 0 ? Math.round(140-diffy)*3 : Math.round(-140+diffy)*3;
            }
          }
        }
        p.abilitycd += s.abilitycd;
      }

      // bomb
      if(p.ship === 'lancaster' && p.energy > s.bombenergyuse){
        var id = Math.round(Math.random()*10000);
        var x = p.x + 18*Math.cos(radians*(p.rotate-90));
        var y = p.y + 18*Math.sin(radians*(p.rotate-90));
        var x_velocity = s.bombspeed*Math.cos(radians*(p.rotate-90)) + (p.x_velocity / 100);
        var y_velocity = s.bombspeed*Math.sin(radians*(p.rotate-90)) + (p.y_velocity / 100);
        var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity, 'lancasterBomb', s.bomblifetime * unistep, s.bombdamage, s.bombbounce, s.bombradius, 0, p.id, p.map);
        r.projectiles.push(newProjectile);
        p.energy -= s.bombenergyuse;
        p.abilitycd += s.abilitycd;
        emitRoom(r, 'projectile', newProjectile, p.rotate);
      }

      // stealth
      if(p.ship === 'ghost' && p.reload === 0){
        p.stealth = !p.stealth;
        p.reload = 10;
      }

      // mine
      if(p.ship === 'aurora' && p.energy > s.mineenergyuse){
        var id = Math.round(Math.random()*10000);
        var x = p.x + 4*Math.cos(radians*(p.rotate-90));
        var y = p.y + 4*Math.sin(radians*(p.rotate-90));
        var newProjectile = new Projectile(id, x, y, 0, 0, 'auroraMine', s.minelifetime * unistep, s.minedamage, 0, s.mineradius, 0, p.id, p.map);
        r.projectiles.push(newProjectile);
        p.energy -= s.mineenergyuse;
        p.abilitycd += s.abilitycd;
        emitRoom(r, 'projectile', newProjectile, p.rotate);
      }
    }
  }
}

// update projectiles
function drawProjectiles(r){

  // iterate backwards to prevent index errors when splicing
  for(var i = r.projectiles.length-1; i > -1; i--){
    var p = r.projectiles[i];

    if(Sockets[p.origin]){
      for(var j = 0; j < unistep; j++){

        // update projectile positions
        p.x = p.x + p.x_velocity / (unistep*100);
        p.y = p.y + p.y_velocity / (unistep*100);
        p.lifetime--;
        if(p.penetrate > 0) p.penetrate--;

        if(p.lifetime <= 0){

          // delete projectiles if past lifetime
          r.projectiles.splice(i, 1);
          break;

        } else {

          // check collision with players
          var ccheck;
          ccheck = collisionCheckPlayers(r, p, 1, function(e){

            var origin = Sockets[p.origin].player;
            if(origin !== null && origin.team !== e.team && p.origin !== e.id && e.energy > 0){

              // return the position of the collison
              if(p.penetrate === 0) emitRoom(r, 'projectileHit', p.id, e.x, e.y);

              // if projectile is explosive, create an explosion
              if(p.explosive > 0){
                emitRoom(r, 'explosion', p.x, p.y);
                collisionCheckPlayers(r, p, p.explosive, function(e, dist){

                  // check if explosion hits a player
                  if(e.energy > 0){
                    e.energy -= Math.max(Math.round(p.damage * ((p.explosive-dist)/p.explosive)),1);

                    // if player died, return player death
                    if(e.energy <= 0){

                      // the player survives at 1 energy if they are the origin
                      if(p.origin !== e.id){
                        kill(r, origin, e, p);
                      } else {
                        e.energy = 1;
                      }

                    }
                  }

                });
              } else {
                e.energy -= p.damage;
                if(e.energy <= 0){
                  kill(r, origin, e, p);
                }
              }
              if(p.penetrate === 0) r.projectiles.splice(i, 1);
            } else {
              ccheck = false;
            }
          });
          if(ccheck) break;

          // check collision with map
          ccheck = collisionCheckMap(p, 1, function(pos, tx, ty){
            var origin = Sockets[p.origin].player;

            // return the position of the collison
            if(p.bounce === 0){

              emitRoom(r, 'projectileHit', p.id, tx, ty);
              // if projectile is explosive, create an explosion
              if(p.explosive > 0 && origin !== null){

                emitRoom(r, 'explosion', tx, ty);
                collisionCheckPlayers(r, p, p.explosive, function(e, dist){

                  // check if explosion hits a player
                  if(e.energy > 0){
                    e.energy -= Math.max(Math.round(p.damage * ((p.explosive-dist)/p.explosive)),1);

                    // if player died, return player death
                    if(e.energy <= 0){

                      // the player survives at 1 energy if they are the origin
                      if(p.origin !== e.id){
                        kill(r, origin, e, p);
                      } else {
                        e.energy = 1;
                      }

                    }
                  }
                });

              }
              r.projectiles.splice(i, 1);

            } else {

              // if projectile bounces, perform bounce
              if(pos === 0 || pos === 2){ // top or bottom collision: reverse y
                p.y = 10*(pos-1) + ty;
                p.y_velocity = p.y_velocity * -1;
              }
              if(pos === 1 || pos === 3){ // left or right collision: reverse x
                p.x = 10*(pos-2) + tx;
                p.x_velocity = p.x_velocity * -1;
              }
              emitRoom(r, 'projectileBounce', p);
              p.bounce -= 1;

            }
          });

          if(ccheck) break;
        }
      }
    } else {
      r.projectiles.splice(i, 1);
    }
  }
}

// collision checking
function collisionCheckMap(p, size, callback){
  var mapx = Math.round(p.x/16);
  var mapy = Math.round(p.y/16);
  // find only closest 5x5 area of map blocks to compare position to reduce lag
  for(var j = -1; j < 2; j++){
    for(var k = -1; k < 2; k++){
      var m = maps[p.map].mapdata;
      var mx = mapx + j;
      var my = mapy + k;
      var tx = mx * 16;
      var ty = my * 16;
      // find the direction from which the object approached the wall
      if(m[my] && m[my][mx] == 1){
        if(p.x >= tx-size-8 && p.x <= tx+size+8 && p.y >= ty-size-8 && p.y <= ty+size+8){
          // determine the side by subtracting positions and finding closest match
          var arr = [Math.floor(ty-p.y), Math.floor(tx-p.x), Math.floor(p.y-ty), Math.floor(p.x-tx)];
          // if there is another block on that side it is impossible for entity to have collided, set to -16
          if(m[my-1] && m[my-1][mx] == 1) arr[0] = -16;
          if(m[my][mx-1] == 1) arr[1] = -16;
          if(m[my+1] && m[my+1][mx] == 1) arr[2] = -16;
          if(m[my][mx+1] == 1) arr[3] = -15; // default to 'right' if multiple match -16
          var max = Math.max.apply(null, arr), // find the closest match in arr and return its index
              pos = arr.indexOf(max);
          p.collided = true;
          callback(pos, tx, ty, mx, my);
          return true;
        }
      }
    }
  }
  return false;
}
function collisionCheckPlayers(r, p, size, callback){
  var collided = false;
  for(var i in r.players){
    var e = r.players[i];
    if(!p.death){
      var dist = Math.sqrt((p.x-e.x)*(p.x-e.x) + (p.y-e.y)*(p.y-e.y)); // pythagorean theorem to find distance
      if(dist < 16 + size){
        callback(e, dist);
        collided = true;
      }
    }
  }
  return collided ? true : false;
}

function spawn(r, p){
  var s = ships.stats[p.ship];
  var sp; // spawn point
  if(maps[r.map].config.respawn === 'trench'){
    var o = r.objectives;
    // spawn based on control of center
    if(o[1].controlled[0]){
      sp = maps[r.map].spawnpoints[p.team === 0 ? 2 : 5];
    } else if(o[1].controlled[1]){
      sp = maps[r.map].spawnpoints[p.team === 0 ? 0 : 3];
    } else {
      sp = maps[r.map].spawnpoints[p.team === 0 ? 1 : 4];
    }
    p.rotate = p.team === 0 ? 90 : 270;
    p.rotate += Math.round(Math.random()*50)-25;
  } else if(maps[r.map].config.respawn === 'random'){
    // pick a random spawnpoint
    sp = maps[r.map].spawnpoints[Math.floor(Math.random()*maps[r.map].spawnpoints.length)];
  }
  if(sp != null){
    p.x = Math.floor(Math.random()*100)+sp[0];
    p.y = Math.floor(Math.random()*100)+sp[1];
    p.x_velocity = 0;
    p.y_velocity = 0;
    p.bounty = 10;
    p.death = false;
    p.deathTime = 0;
    p.energy = s.maxenergy;
    p.abilitycd = 0;
    if(p.stealth) p.stealth = false;
  }
}

// when a player dies
function kill(r, origin, e, p){
  if(!e.bot){
    var osocket = Sockets[origin.id];
    var esocket = Sockets[e.id];
    var d = new Date();
    e.death = d.getTime();
    if(maps[e.map].config.zone === 'extreme games'){
      e.deathTime = 5000;
    }
    if(maps[e.map].config.zone === 'trench wars'){
      e.deathTime = (d.getTime() - r.starttime)/60 + 3000;
    }

    // if not team kill award bounty
    if(origin.team !== e.team){

      origin.bounty += e.bounty;
      origin.kills++;
      console.log(origin.displayName + ' killed ' + e.displayName);

      osocket.emit('newNotice', {
        text: 'Killed ' + e.displayName + ' (+' + e.bounty + ')',
        lifetime: 3000,
        color: 'rgb(100, 255, 100)'
      });
      Sockets[e.id].emit('newNotice', {
        text: 'Killed by '+origin.displayName,
        lifetime: 3000,
        color: 'rgb(255, 100, 100)'
      });

    } else {

      // remove a little bounty if team kill
      origin.bounty -= 10;
      if(origin.bounty < 0) origin.bounty = 0;
      console.log(origin.displayName + ' TK\'d ' + e.displayName);

      // announce team kill
      osocket.emit('newNotice', {
        text: 'TK\'d '+e.displayName  + ' (-10)',
        lifetime: 3000,
        color: 'rgb(255, 100, 100)'
      });
      esocket.emit('newNotice', {
        text: 'TK\'d by '+origin.displayName,
        lifetime: 3000,
        color: 'rgb(255, 100, 100)'
      });

    }

    // update statistics
    e.bounty = 0;
    emitRoom(r, 'playerDeath', p.x, p.y, origin.id, e.id, e.deathTime);

  } else {

    // bot death
    var socket = Sockets[origin.id];
    if(origin.team !== e.team){
      origin.bounty += e.bounty;
      console.log(origin.displayName + ' killed ' + e.displayName);
      socket.emit('newNotice', {
        text: 'Killed ' + e.displayName + ' (+' + e.bounty + ')',
        lifetime: 3000,
        color: 'rgb(100, 255, 100)'
      });
    } else {
      // remove a little bounty if team kill
      origin.bounty -= 10;
      if(origin.bounty < 0) origin.bounty = 0;
      console.log(origin.displayName + ' TK\'d ' + e.displayName);
      // announce team kill
      socket.emit('newNotice', {
        text: 'TK\'d '+e.displayName  + ' (-10)',
        lifetime: 3000,
        color: 'rgb(255, 100, 100)'
      });
    }
    e.death = true;
    emitRoom(r, 'playerDeath', p.x, p.y, origin.id, e.id, e.deathTime);
  }
}

function getLeaderboard(r){
  var p = [];
  for(var i in r.players){
    if(!p.bot) p.push([i, r.players[i]]);
  }
  p.sort(function(a, b){return b[1].bounty - a[1].bounty;});
  var arr = [];
  for(var i in p) if(p[i][1].joined) arr.push(p[i][0]);
  return arr;
}
