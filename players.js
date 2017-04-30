require('./includes.js')();

// called when a player joins
Player.prototype.join = function(socket, ship, zone){
  // reset the player's keys
  for(var key in this.keys){
    this.keys[key] = false;
  }

  // assign the player a room that is not full
  var r;
  for(var i=0, j=rooms.length; i<j; i++){
    var m = maps[rooms[i].map];
    if(m.config.zone === zone && rooms[i].population < m.config.maxplayers && rooms[i].state !== 'ended'){
      r = rooms[i];
      this.room = r;
      r.population++;
    }
  }
  // create new room if empty spot does not exist
  if(!r){
    var mapname = maps.index[zone][Math.floor(Math.random()*maps.index[zone].length)];
    rooms.push(new Room(rooms.length, mapname));
    r = rooms[rooms.length-1];
    this.room = r;
    r.population = 1;
    winston.log('debug', 'created new room ' + (rooms.length-1) + ' (' + r.zone + ')');
  }
  this.map = r.map;
  r.players[socket.id] = socket.player;
  if(zone === 'tutorial') r.trainee = this;
  socket.emit('join-success');
  socket.emit('map', maps[this.map].mapdata, this.map);

  if(maps[this.map].config.teams){
    // assign player the team with the lowest players on that room
    var min = Math.min.apply(null, r.teams), // find team with lowest players
        team = r.teams.indexOf(min);
    r.teams[team]++;
    this.team = team;
  } else {
    // otherwise players do not have teams
    this.team = Math.round(Math.random()*10000);
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
  this.joined = true;
  this.ship = ship;

  // give them all previous players
  var ppos = {};
  for(var i in r.players){
    var p1 = r.players[i];
    ppos[i] = {
      id: p1.id,
      displayName: p1.displayName,
      ship: p1.ship,
      team: p1.team,
      bot: false
    }
  }
  emitRoom(r, 'playerList', ppos);

  emitRoom(r, 'playerJoin', this.id, this.displayName, this.ship, this.team, false);
  winston.log('debug', this.displayName + ' joined room ' + this.room.id + ' on team ' + this.team + ' (' + r.zone + ')');

  // spawn them somewhere
  this.spawn();
}


// called when a player leaves
Player.prototype.leave = function(){
  var r = this.room;
  if(this.joined){
    winston.log('debug', this.displayName + ' disconnected from room '+r.id);
    r.teams[this.team]--;
    r.population--;
    // delete player from their room
    delete r.players[this.id];
    // decrement projectile origins
    for(var i=r.projectiles.length-1; i>-1; i--){
      var t = r.projectiles[i];
      if(t.origin === this.id){
        r.projectiles.splice(i, 1);
        emitRoom(r, 'projectileHit', t.id, t.x, t.y);
      }
    }
    this.joined = false;
    this.kills = 0;
    this.bounty = 0;

    Sockets[this.id].emit('leave');
    emitRoom(r, 'playerLeave', this.id);
  }
}


// update players
Player.prototype.update = function(){
  var s = ships.stats[this.ship];
  if(!this.death && this.energy > 0){
    // limit maxspeed using pythagorean theorem
    var velocity = Math.sqrt(this.x_velocity*this.x_velocity + this.y_velocity*this.y_velocity);
    // if shift key multiply maxspeed by 1.5
    var maxspeed = s.maxspeed;
    if(this.keys['boost'] && (this.keys['up'] || this.keys['down']) && this.energy > 15){
      maxspeed *= 1.75;
    }

    // limit velocity to maxspeed
    if(velocity > maxspeed){
      this.x_velocity = this.x_velocity * (maxspeed/velocity);
      this.y_velocity = this.y_velocity * (maxspeed/velocity);
    }
    // update position
    this.x += this.x_velocity/100;
    this.y += this.y_velocity/100;

    var self = this;
    // check if player hit the map
    collisionCheckMap(this, 14, function(pos, tx, ty, mx, my){
      if(pos === 0 || pos === 2){ // top or bottom collision: reverse y
        self.y = 22*(pos-1) + ty;
        self.y_velocity = self.y_velocity * -0.5;
        self.x_velocity = self.x_velocity * 0.5;
      }
      if(pos === 1 || pos === 3){ // 'left' or 'right' collision: reverse x
        self.x = 22*(pos-2) + tx;
        self.x_velocity = self.x_velocity * -0.5;
        self.y_velocity = self.y_velocity * 0.5;
      }
    });

    // check objectives
    this.checkObjective();

    // movement
    if(!this.collided){
      if(this.keys['left']){
        this.rotate -= s.turnspeed;
        if(this.rotate < 0) this.rotate = 360;
      }
      if(this.keys['right']){
        this.rotate += s.turnspeed;
        if(this.rotate > 360) this.rotate = 0;
      }
      // shift for thrusters
      var accel = s.accel;
      if(this.keys['boost'] && (this.keys['up'] || this.keys['down']) && this.energy > 15){
        accel = accel * 1.75;
        this.energy -= 2;
      }
      if(this.keys['up']){ // circular directional movement
        this.x_velocity += accel*Math.cos(radians*(this.rotate-90));
        this.y_velocity += accel*Math.sin(radians*(this.rotate-90));
      } else if(this.keys['down']){
        this.x_velocity -= accel*Math.cos(radians*(this.rotate-90))*0.8;
        this.y_velocity -= accel*Math.sin(radians*(this.rotate-90))*0.8;
      }
      if(this.keys['strafeleft']){
        this.x_velocity += s.accel*Math.cos(radians*(this.rotate-180))*0.8;
        this.y_velocity += s.accel*Math.sin(radians*(this.rotate-180))*0.8;
      } else if(this.keys['straferight']){
        this.x_velocity += s.accel*Math.cos(radians*(this.rotate))*0.8;
        this.y_velocity += s.accel*Math.sin(radians*(this.rotate))*0.8;
      }
    }

    this.collided = false;

    // player actions
    if(this.keys['attack'] && this.energy > s.bulletenergyuse && this.reload === 0) this.fireProjectile();

    if(this.reload > 0) this.reload--;
    if(this.abilitycd > 0 || (s.charges && this.abilitycd > -(s.charges-1) * s.abilitycd)) this.abilitycd--;
    if(this.energy < s.maxenergy && !(this.keys['boost'] && (this.keys['up'] || this.keys['down'])) && !this.stealth) this.energy += s.recharge;
    if(this.energy > s.maxenergy) this.energy = s.maxenergy;

  } else if(this.death){
    if(!this.bot){
      if(new Date().getTime() - this.death > this.deathTime) this.spawn();
    } else {
      delete this.room.players[this.id];
    }
  }
}


// called when a projectile is fired
Player.prototype.fireProjectile = function(){
  var r = this.room;
  var s = ships.stats[this.ship];
  // warbird
  if(this.ship === 'warbird'){
    var id = Math.round(Math.random()*10000);
    var x = this.x + 20*Math.cos(radians*(this.rotate-90));
    var y = this.y + 20*Math.sin(radians*(this.rotate-90));
    var x_velocity = s.bulletspeed*Math.cos(radians*(this.rotate-90)) + (this.x_velocity / 100);
    var y_velocity = s.bulletspeed*Math.sin(radians*(this.rotate-90)) + (this.y_velocity / 100);
    var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity, 'warbirdShot',
      s.bulletlifetime * unistep, s.bulletdamage, 1, 0, 0, 4, this.id, this.map);
    r.projectiles.push(newProjectile);
    this.reload = s.reload;
    this.energy -= s.bulletenergyuse;
    emitRoom(r, 'projectile', newProjectile, this.rotate);
  }

  // lancaster
  if(this.ship === 'lancaster'){
    for(var i=0; i<2; i++){
      var id = Math.round(Math.random()*10000);
      var rotdiff;
      // fire two shots with origin point from a rotated player
      rotdiff = i === 0 ? -40 : 40;
      var x = this.x + 20*Math.cos(radians*(this.rotate-90+rotdiff));
      var y = this.y + 20*Math.sin(radians*(this.rotate-90+rotdiff));
      var x_velocity = s.bulletspeed*Math.cos(radians*(this.rotate-90)) + (this.x_velocity / 100);
      var y_velocity = s.bulletspeed*Math.sin(radians*(this.rotate-90)) + (this.y_velocity / 100);
      var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity, 'lancasterShot',
        s.bulletlifetime * unistep, s.bulletdamage, 1, 0, 0, 0, this.id, this.map);
      r.projectiles.push(newProjectile);
      emitRoom(r, 'projectile', newProjectile, this.rotate);
    }
    this.reload = s.reload;
    this.energy -= s.bulletenergyuse;
  }

  // ghost
  if(this.ship === 'ghost'){
    var id = Math.round(Math.random()*10000);
    var x = this.x + 20*Math.cos(radians*(this.rotate-90));
    var y = this.y + 20*Math.sin(radians*(this.rotate-90));
    var x_velocity = s.bulletspeed*Math.cos(radians*(this.rotate-90)) + (this.x_velocity / 100);
    var y_velocity = s.bulletspeed*Math.sin(radians*(this.rotate-90)) + (this.y_velocity / 100);
    var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity,
      this.stealth ? 'ghostAmbushShot' : 'ghostShot',
      s.bulletlifetime * unistep, this.stealth ? s.bulletdamage*2 : s.bulletdamage, 1, 0, 0, 0, this.id, this.map);
    r.projectiles.push(newProjectile);
    this.reload = s.reload;
    this.energy -= s.bulletenergyuse;
    if(this.stealth){
      this.stealth = false;
      emitRoom(r, 'playerStealth', this.id);
    }
    emitRoom(r, 'projectile', newProjectile, this.rotate);
  }

  // aurora
  if(this.ship === 'aurora'){
    for(var i=0; i<3; i++){
      var id = Math.round(Math.random()*10000);
      var rotdiff;
      // fire two shots with origin point from a rotated player
      rotdiff = (i-1) * 15;
      var x = this.x + 20*Math.cos(radians*(this.rotate-90+rotdiff));
      var y = this.y + 20*Math.sin(radians*(this.rotate-90+rotdiff));
      var x_velocity = s.bulletspeed*Math.cos(radians*(this.rotate-90 + rotdiff/2)) + (this.x_velocity / 100);
      var y_velocity = s.bulletspeed*Math.sin(radians*(this.rotate-90 + rotdiff/2)) + (this.y_velocity / 100);
      var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity,
        'auroraShot', s.bulletlifetime * unistep, s.bulletdamage, 1, 0, 0, 0, this.id, this.map);
      r.projectiles.push(newProjectile);
      emitRoom(r, 'projectile', newProjectile, this.rotate);
    }
    this.reload = s.reload;
    this.energy -= s.bulletenergyuse;
  }

}


// called when an ability is used
Player.prototype.useAbility = function(){
  if(this.abilitycd <= 0){
    var r = this.room;
    var s = ships.stats[this.ship];
    // repel
    if(this.ship === 'warbird'){
      emitRoom(r, 'repel', this.x, this.y);
      // push away enemy projectiles
      for(var i=0; i<r.projectiles.length; i++){
        var t = r.projectiles[i];
        if(r.players[t.origin].team !== this.team){
          var diffx = t.x - this.x;
          var diffy = t.y - this.y;
          var distance = Math.sqrt(diffx*diffx + diffy*diffy);
          if(distance < 130){
            t.x_velocity = diffx/distance * (170 - distance) * 8;
            t.y_velocity = diffy/distance * (170 - distance) * 8;
            t.origin = this.id;
            emitRoom(r, 'repelBounce', t);
          }
        }
      }
      // push away enemy ships
      for(var i in r.players){
        var t = r.players[i];
        if(t.team !== this.team){
          var diffx = t.x - this.x;
          var diffy = t.y - this.y;
          var distance = Math.sqrt(diffx*diffx + diffy*diffy);
          if(distance < 130){
            t.x_velocity = diffx/distance * (170 - distance) * 5;
            t.y_velocity = diffy/distance * (170 - distance) * 5;
          }
        }
      }
      this.abilitycd += s.abilitycd;
    }

    // bomb
    if(this.ship === 'lancaster'){
      var id = Math.round(Math.random()*10000);
      var x = this.x + 18*Math.cos(radians*(this.rotate-90));
      var y = this.y + 18*Math.sin(radians*(this.rotate-90));
      var x_velocity = s.bombspeed*Math.cos(radians*(this.rotate-90)) + (this.x_velocity / 100);
      var y_velocity = s.bombspeed*Math.sin(radians*(this.rotate-90)) + (this.y_velocity / 100);
      var newProjectile = new Projectile(id, x, y, x_velocity, y_velocity, 'lancasterBomb', s.bomblifetime * unistep, s.bombdamage, 3, s.bombbounce, s.bombradius, 0, this.id, this.map);
      r.projectiles.push(newProjectile);
      this.abilitycd += s.abilitycd;
      emitRoom(r, 'projectile', newProjectile, this.rotate);
    }

    // stealth
    if(this.ship === 'ghost' && this.reload === 0){
      this.stealth = !this.stealth;
      this.reload = 10;
      emitRoom(r, 'playerStealth', this.id);
    }

    // mine
    if(this.ship === 'aurora'){
      var id = Math.round(Math.random()*10000);
      var x = this.x + 4*Math.cos(radians*(this.rotate-90));
      var y = this.y + 4*Math.sin(radians*(this.rotate-90));
      var newProjectile = new Projectile(id, x, y, 0, 0, 'auroraMine', s.minelifetime * unistep, s.minedamage, 5, 0, s.mineradius, 0, this.id, this.map);
      r.projectiles.push(newProjectile);
      this.abilitycd += s.abilitycd;
      emitRoom(r, 'projectile', newProjectile, this.rotate);
    }
  }
}


Player.prototype.spawn = function(x, y){
  var s = ships.stats[this.ship];
  var r = this.room;
  var sp; // spawn point
  if(maps[r.map].config.respawn === 'trench'){
    var o = r.objectives;
    // spawn based on control of center
    if(o[1].controlled[0]){
      sp = maps[r.map].spawnpoints[this.team === 0 ? 2 : 5];
    } else if(o[1].controlled[1]){
      sp = maps[r.map].spawnpoints[this.team === 0 ? 0 : 3];
    } else {
      sp = maps[r.map].spawnpoints[this.team === 0 ? 1 : 4];
    }
    this.rotate = this.team === 0 ? 90 : 270;
    this.rotate += Math.round(Math.random()*50)-25;
  } else if(maps[r.map].config.respawn === 'random'){
    // pick a random spawnpoint
    sp = maps[r.map].spawnpoints[Math.floor(Math.random()*maps[r.map].spawnpoints.length)];
  }
  if(sp != null){
    this.x = x ? x : Math.floor(Math.random()*100)+sp[0];
    this.y = y ? y : Math.floor(Math.random()*100)+sp[1];
    this.x_velocity = 0;
    this.y_velocity = 0;
    this.bounty = 10;
    this.death = false;
    this.deathTime = 0;
    this.energy = s.maxenergy;
    this.abilitycd = 0;
    if(this.stealth) this.stealth = false;
  }
  emitRoom(r, 'playerSpawn', this.id, this.x, this.y);
}


// when a player dies
Player.prototype.kill = function(origin){
  var r = this.room;
  if(!this.bot){
    var osocket = Sockets[origin.id];
    var esocket = Sockets[this.id];
    var d = new Date();
    this.death = d.getTime();
    if(maps[this.map].config.zone === 'extreme games'){
      this.deathTime = 5000;
    }
    if(maps[this.map].config.zone === 'trench wars'){
      this.deathTime = (d.getTime() - r.starttime)/60 + 3000;
    }

    // if not team kill award bounty
    if(origin.team !== this.team){

      origin.bounty += this.bounty;
      origin.kills++;
      winston.log('debug', origin.displayName + ' killed ' + this.displayName);

      osocket.emit('newNotice', {
        text: 'Killed ' + this.displayName + ' (+' + this.bounty + ')',
        lifetime: 3000,
        color: 'rgb(100, 255, 100)'
      });
      esocket.emit('newNotice', {
        text: 'Killed by '+origin.displayName,
        lifetime: 3000,
        color: 'rgb(255, 100, 100)'
      });

    } else {

      // remove a little bounty if team kill
      origin.bounty -= 10;
      if(origin.bounty < 0) origin.bounty = 0;
      winston.log('debug', origin.displayName + ' TK\'d ' + this.displayName);

      // announce team kill
      osocket.emit('newNotice', {
        text: 'TK\'d '+this.displayName  + ' (-10)',
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
    this.bounty = 0;
    emitRoom(r, 'playerDeath', this.x, this.y, origin.id, this.id, this.deathTime);

  } else {

    // bot death
    var socket = Sockets[origin.id];
    if(origin.team !== this.team){
      origin.bounty += this.bounty;
      winston.log('debug', origin.displayName + ' killed ' + this.displayName);
      socket.emit('newNotice', {
        text: 'Killed ' + this.displayName + ' (+' + this.bounty + ')',
        lifetime: 3000,
        color: 'rgb(100, 255, 100)'
      });
    } else {
      // remove a little bounty if team kill
      origin.bounty -= 10;
      if(origin.bounty < 0) origin.bounty = 0;
      winston.log('debug', origin.displayName + ' TK\'d ' + this.displayName);
      // announce team kill
      socket.emit('newNotice', {
        text: 'TK\'d '+this.displayName  + ' (-10)',
        lifetime: 3000,
        color: 'rgb(255, 100, 100)'
      });
    }
    this.death = true;
    emitRoom(r, 'playerDeath', this.x, this.y, origin.id, this.id, this.deathTime);
  }
}


// match player with map objectives
Player.prototype.checkObjective = function(){
  var r = this.room;
  if(r.zone === 'tutorial'){
    if(r.state === 'active'){
      var loc = r.objectives;
      for(var i=0, j=loc.length; i<j; i++){
        var o = loc[i];
        // check distance
        if(Math.sqrt(Math.pow(o.x - this.x, 2) + Math.pow(o.y - this.y, 2)) < 150){
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
        if(Math.sqrt(Math.pow(o.x - this.x, 2) + Math.pow(o.y - this.y, 2)) < 120){
          o.contested[this.team] = true;
        }
      }
    }
  }
}

module.exports = Player;
