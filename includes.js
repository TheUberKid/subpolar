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

  // bot constructor
  // a bot is a 'player' that is not assigned to a socket
  this.Bot = function(room, id, name, ship, rotate, team){
    this.bot = true;
    this.room = room;
    this.id = id;
    this.displayName = name;
    this.ship = ship;
    this.energy = ships.stats[ship].maxenergy;
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

  // inherit player prototype
  this.Bot.prototype = Object.create(this.Player.prototype);
  this.Bot.prototype.constructor = this.Bot;
}
