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
    delete Sockets[id];
    socket.player.leave();
    population--;
    socket.disconnect();
  });
});

// draw loops for each map
var loops = {
  'standard': function(r){
    drawProjectiles(r);
    var ppos = drawPlayers(r);
    var rankings = getLeaderboard(r);
    computeObjective(r);
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
            r.players[id1] = new Bot(r, id1, "training dummy", "training-dummy", 90);
            r.players[id2] = new Bot(r, id2, "training dummy", "training-dummy", 90);
            emitRoom(r, 'playerJoin', id1, "training dummy", "training-dummy", -1, true);
            emitRoom(r, 'playerJoin', id2, "training dummy", "training-dummy", -1, true);
            r.players[id1].spawn(1000, 1892);
            r.players[id2].spawn(1000, 2156);
          }
          if(o.trigger === 'tutorial-ally'){
            // create a tutorial ally to attach to
            var id = Math.floor(Math.random()*100000);
            while(Sockets[id]) id = Math.floor(Math.random()*100000);
            r.players[id] = new Bot(r, id, "Terrier", "warbird", 0, r.trainee.team);
            emitRoom(r, 'playerJoin', id, "Terrier", "warbird", r.trainee.team, true);
            r.players[id].spawn(1532, 1144);
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
        for(var i in r.players) r.players[i].spawn();
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
          winston.log('debug', p.displayName + ' has won in room ' + r.id + ' (extreme games)');
          break;
        }
      }
    } else if(r.state === 'ended'){
      // when a team or player wins, remove all players after 10 seconds
      if(new Date().getTime() - r.endtime > 10*1000){
        for(var i in r.players){
          var p = r.players[i];
          winston.log('debug', p.displayName + ' left room '+r.id);
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
        for(var i in r.players) r.players[i].spawn();
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
        winston.log('debug', 'team 1 has won in room ' + r.id + ' (trench wars)');
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
        winston.log('debug', 'team 0 has won in room ' + r.id + ' (trench wars)');
      }
    } else if(r.state === 'ended'){
      // when a team or player wins, remove all players after 10 seconds
      if(new Date().getTime() - r.endtime > 10*1000){
        for(var i in r.players){
          var p = r.players[i];
          winston.log('debug', p.displayName + ' left room '+r.id);
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
            p.rotate -= s.turnspeed;
            if(p.rotate < 0) p.rotate = 360;
          }
          if(p.keys['right']){
            p.rotate += s.turnspeed;
            if(p.rotate > 360) p.rotate = 0;
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
            p.x_velocity -= accel*Math.cos(radians*(p.rotate-90))*0.8;
            p.y_velocity -= accel*Math.sin(radians*(p.rotate-90))*0.8;
          }
          if(p.keys['strafeleft']){
            p.x_velocity += s.accel*Math.cos(radians*(p.rotate-180))*0.8;
            p.y_velocity += s.accel*Math.sin(radians*(p.rotate-180))*0.8;
          } else if(p.keys['straferight']){
            p.x_velocity += s.accel*Math.cos(radians*(p.rotate))*0.8;
            p.y_velocity += s.accel*Math.sin(radians*(p.rotate))*0.8;
          }
        }

        p.collided = false;

        // player actions
        if(p.keys['attack'] && p.energy > s.bulletenergyuse && p.reload === 0) p.fireProjectile();

        if(p.reload > 0) p.reload--;
        if(p.abilitycd > 0 || (s.charges && p.abilitycd > -(s.charges-1) * s.abilitycd)) p.abilitycd--;
        if(p.energy < s.maxenergy && !(p.keys['boost'] && (p.keys['up'] || p.keys['down'])) && !p.stealth) p.energy += s.recharge;
        if(p.energy > s.maxenergy) p.energy = s.maxenergy;

      } else if(p.death){
        if(!p.bot){
          if(currentTime.getTime() - p.death > p.deathTime) p.spawn();
        } else {
          delete r.players[p.id];
        }
      }

      // if player chooses to leave
      if(p.keys['leave']){
        winston.log('debug', p.displayName + ' left room '+r.id);
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
        emitRoom(r, 'playerLeave', p.id);
      }
    }

    ppos[p.id] = {
      x: p.x,
      y: p.y,
      rotate: p.rotate,
      bounty: p.bounty
    };
  }
  // return player positions to emit
  return ppos;
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
          ccheck = collisionCheckPlayers(r, p, p.size, function(e){

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
                        e.kill(origin);
                      } else {
                        e.energy = 1;
                      }

                    }
                  }

                });
              } else {
                e.energy -= p.damage;
                if(e.energy <= 0){
                  e.kill(origin);
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
                        e.kill(origin);
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

function getLeaderboard(r){
  var p = [];
  for(var i in r.players){
    if(!r.players[i].bot) p.push([i, r.players[i]]);
  }
  p.sort(function(a, b){return b[1].bounty - a[1].bounty;});
  var arr = [];
  for(var i in p) if(p[i][1].joined) arr.push(p[i][0]);
  return arr;
}
