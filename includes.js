module.exports = function(){
  // universal step - must be synced with client
  // this determines how many 'micro-calculations' are done per frame for more accurate collision checking and movement
  this.unistep = 4;
  this.version = '0.1.0';

  this.winston = require('winston');

  this.auth = require('./auth.js');
  this.maps = require('./mapdata.js');
  this.ships = require('./shipdata.js');
  this.framerate = 30;
  this.radians = Math.PI/180;

  this.Sockets = {}; // array of all socket connections
  this.population = 0; // total number of online players
  this.rooms = [];

  // emit system
  this.emitGlobal = function(type, d1, d2, d3, d4, d5, d6){
    for(var i in Sockets){
      Sockets[i].emit(type, d1, d2, d3, d4, d5, d6);
    }
  }
  this.emitRoom = function(room, type, d1, d2, d3, d4, d5, d6){
    for(var i in room.players){
      if(Sockets[i]) Sockets[i].emit(type, d1, d2, d3, d4, d5, d6);
    }
  }
  this.emitTeam = function(room, team, type, d1, d2, d3, d4, d5, d6){
    for(var i in room.players){
      if(room.players[i].team === team && Sockets[i]) Sockets[i].emit(type, d1, d2, d3, d4, d5, d6);
    }
  }

  Number.prototype.pad = function(n){
    return ('0'.repeat(n)+this).slice(-n);
  }

  // room constructor
  this.Room = function(id, map){
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

  // projectile constructor
  // NOTE: this is a different projectile object than the client's projectile.
  // These are only used for keeping track of projectiles and updating them, and are not passed to the client.
  // Instead, an event is triggered when a bullet is fired and separate computations are performed on the client side.
  this.Projectile = function(id, x, y, x_velocity, y_velocity, type, lifetime, damage, size, bounce, explosive, penetrate, origin, map){
    this.id = id;
    this.x = x;
    this.y = y;
    this.x_velocity = x_velocity;
    this.y_velocity = y_velocity;
    this.type = type;
    this.lifetime = lifetime; // how long the projectile can last
    this.damage = damage;
    this.size = size;
    this.bounce = bounce; // how many times the projectile can bounce
    this.explosive = explosive; // explosion radius. 0 if does not explode
    this.penetrate = penetrate*unistep; // amount of frames in which the bullet can penetrate through players
    this.origin = origin; // id of who created the projectile
    this.map = map;
  }

  // player constructor
  // pid is the login id of the user assigned to that player
  this.Player = function(id){
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

  // collision checking
  this.collisionCheckMap = function(p, size, callback){
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

  this.collisionCheckPlayers = function(r, p, size, callback){
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
}
