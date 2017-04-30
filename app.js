'use strict';
require('./includes.js')();

var express = require('express');
var app = express();
var serv = require('http').Server(app);

// gzip compression and minify
var compression = require('compression');
var minify = require('express-minify');
app.use(compression());

// async
var args = process.argv.slice(2);
if(args[0] === 'debug'){
  console.log('Starting debug mode...');
  winston.level = 'debug';
} else {
  app.use(minify());
}
var async = require('async');

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

var Player = require('./players.js');
var Room = require('./rooms.js');

var io = require('socket.io')(serv,{});

// socket response mapping
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
    auth.register(name, password, socket);
  });
  socket.on('guest', function(name){
    auth.guest(name, socket);
  });
  socket.on('login', function(name, password){
    auth.login(name, password, socket);
  });
  socket.on('session', function(token){
    auth.session(token, socket);
  });
  socket.on('logout', function(){
    auth.logout(socket);
  });
  // when player joins
  socket.on('join', function(ship, zone){
    // validate inputs
    if((socket.loggedIn || socket.player.pid === 'guest') && ships.stats[ship] && !ships.stats[ship].unplayable && maps.index[zone]){
      socket.player.join(socket, ship, zone);
    }
  });
  // log keypresses
  socket.on('keydown', function(e){
    var p = socket.player;
    if(!p.keys['ability1'] && e == 'ability1') p.useAbility();
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
      winston.log('debug', 'room ' + socket.player.room.id + ' > ' + p.displayName + ' > ' + truncm + (type === 'team' ? ' [to TEAM]' : ' [to ROOM]'));

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
    socket.player.leave();
    delete Sockets[id];
    population--;
    delete socket.player;
    socket.disconnect();
  });
});

// draw loops for each map
var loops = {
  'standard': function(r){
    r.drawProjectiles();
    var ppos = r.drawPlayers();
    var rankings = r.getLeaderboard();
    r.computeObjective();
    for(var i in r.players){
      if(!r.players[i].bot){
        var p = r.players[i];
        var spos = {
          energy: p.energy,
          abilitycd: p.abilitycd,
        }
        Sockets[i].emit('update', ppos, spos, r.objectives, new Date().getTime(), population, rankings);
      }
    }
  }
};

var globalLoop = function(){
  async.map(rooms, function(r){
    loops[maps[r.map].config.loop](r);
  });
  async.filter(rooms, function(r, callback){
    if(r.population < 1){
      winston.log('debug', 'room ' + r.id + ' (' + r.zone + ') deleted');
      return callback(null, false);
    }
    return callback(null, true);
  }, function(err, res){
    if(err) throw err;
    rooms = res;
  });
}
setInterval(globalLoop, 1000/framerate);
