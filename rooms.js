require('./includes.js')();
var Player = require('./players.js');

// perform map-specific objectives
Room.prototype.computeObjective = function(){

  if(this.zone === 'tutorial'){
    // control tutorial messages and bots
    if(this.state === 'active'){
      var loc = this.objectives;
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
            this.players[id1] = new Player(id1);
            this.players[id2] = new Player(id2);
            this.players[id1].configureBot(this, "training dummy", "training-dummy", 90);
            this.players[id2].configureBot(this, "training dummy", "training-dummy", 90);
            emitRoom(this, 'playerJoin', id1, "training dummy", "training-dummy", -1, true);
            emitRoom(this, 'playerJoin', id2, "training dummy", "training-dummy", -1, true);
            this.players[id1].spawn(1000, 1892);
            this.players[id2].spawn(1000, 2156);
          }
          if(o.trigger === 'tutorial-ally'){
            // create a tutorial ally to attach to
            var id = Math.floor(Math.random()*100000);
            while(Sockets[id]) id = Math.floor(Math.random()*100000);
            this.players[id] = new Player(id);
            this.players[id].configureBot(this, "Terrier", "warbird", 0, this.trainee.team);
            emitRoom(this, 'playerJoin', id, "Terrier", "warbird", this.trainee.team, true);
            this.players[id].spawn(1532, 1144);
          }
        }
      }
    }
  }

  // extreme games lobby and win conditions
  if(this.zone === 'extreme games'){
    if(this.state === 'lobby'){
      if(this.population >= maps[this.map].config.minplayers){
        this.state = 'countdown';
        this.starttime = new Date().getTime() + (1000*5);
        this.countdown = 5;
      }
    } else if(this.state === 'countdown'){
      // countdown until the start of the round
      var t = this.starttime - new Date().getTime();
      if(t <= 0){
        this.state = 'active';
        emitRoom(this, 'newAnnouncement', {
          text: 'Fight!',
          lifetime: 3000,
          color: 'rgb(150, 255, 150)'
        });
        for(var i in this.players) this.players[i].spawn();
      } else {
        // countdown timer
        if(t < this.countdown*1000){
          emitRoom(this, 'newAnnouncement', {
            text: this.countdown + ' second(s) until the round begins!',
            lifetime: 1500,
            color: 'rgb(255, 255, 255)'
          });
          this.countdown--;
        }
      }
    } else if(this.state === 'active'){
      // win condition
      for(var i in this.players){
        var p = this.players[i];
        if(p.kills >= 10 || this.population === 1){
          this.state = 'ended';
          this.endtime = new Date().getTime();
          emitRoom(this, 'newAnnouncement', {
            text: p.displayName + ' has won!',
            lifetime: 10000,
            color: 'rgb(255, 150, 150)'
          });
          Sockets[p.id].emit('newAnnouncement', {
            text: p.displayName + ' has won!',
            lifetime: 10000,
            color: 'rgb(200, 255, 200)'
          });
          winston.log('debug', p.displayName + ' has won in room ' + this.id + ' (extreme games)');
          break;
        }
      }
    } else if(this.state === 'ended'){
      // when a team or player wins, remove all players after 10 seconds
      if(new Date().getTime() - this.endtime > 10*1000){
        for(var i in this.players){
          var p = this.players[i];
          winston.log('debug', p.displayName + ' left room '+this.id);
          this.teams[p.team]--;
          this.population--;
          // delete player from their room
          delete this.players[p.id];
          // decrement projectile origins
          for(var i in this.projectiles){
            var t = this.projectiles[i];
            if(t.origin === p.id){
              this.projectiles.splice(i, 1);
              emitRoom(this, 'projectileHit', t.id, t.x, t.y);
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

  // trench wars lobby and win conditions
  if(this.zone === 'trench wars'){
    if(this.state === 'lobby'){
      if(this.population >= maps[this.map].config.minplayers){
        this.state = 'countdown';
        this.starttime = new Date().getTime() + (1000*5);
        this.countdown = 5;
      }
    } else if(this.state === 'countdown'){
      // countdown until the start of the round
      var t = this.starttime - new Date().getTime();
      if(t <= 0){
        this.state = 'active';
        emitRoom(this, 'newAnnouncement', {
          text: 'Fight!',
          lifetime: 3000,
          color: 'rgb(150, 255, 150)'
        });
        for(var i in this.players) this.players[i].spawn();
      } else {
        // countdown timer
        if(t < this.countdown*1000){
          emitRoom(this, 'newAnnouncement', {
            text: this.countdown + ' second(s) until the round begins!',
            lifetime: 1500,
            color: 'rgb(255, 255, 255)'
          });
          this.countdown--;
        }
      }
    } else if(this.state === 'active'){
      // control points
      var loc = this.objectives;
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
          emitTeam(this, 0, 'newNotice', {
            text: 'Your team controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(150, 255, 150)'
          });
          emitTeam(this, 1, 'newNotice', {
            text: 'The enemy controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(255, 150, 150)'
          });
          o.controlled = [true, false];
        }
        if(o.control >= 100 && !o.controlled[1]){
          emitTeam(this, 1, 'newNotice', {
            text: 'Your team controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(150, 255, 150)'
          });
          emitTeam(this, 0, 'newNotice', {
            text: 'The enemy controls the '+name+' trench.',
            lifetime: 5000,
            color: 'rgb(255, 150, 150)'
          });
          o.controlled = [false, true];
        }
        if(o.control === 0){
          if(o.controlled[0]){
            emitTeam(this, 0, 'newNotice', {
              text: 'Lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
            emitTeam(this, 1, 'newNotice', {
              text: 'The enemy lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
          }
          if(o.controlled[1]){
            emitTeam(this, 1, 'newNotice', {
              text: 'Lost control of the '+name+' trench.',
              lifetime: 5000,
              color: 'rgb(150, 100, 255)'
            });
            emitTeam(this, 0, 'newNotice', {
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
        emitTeam(this, 1, 'newAnnouncement', {
          text: 'Your team wins in '+Math.ceil((450-loc[0].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(150, 255, 150)'
        });
        emitTeam(this, 0, 'newAnnouncement', {
          text: 'The enemy team wins in '+Math.ceil((450-loc[0].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(255, 150, 150)'
        });
      }
      if(loc[2].timesince % 30 === 1){
        emitTeam(this, 0, 'newAnnouncement', {
          text: 'Your team wins in '+Math.ceil((450-loc[2].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(150, 255, 150)'
        });
        emitTeam(this, 1, 'newAnnouncement', {
          text: 'The enemy team wins in '+Math.ceil((450-loc[2].timesince)/30)+' seconds!',
          lifetime: 1500,
          color: 'rgb(255, 150, 150)'
        });
      }
      if(loc[0].timesince === 450){
        this.state = 'ended';
        this.endtime = new Date().getTime();
        emitTeam(this, 1, 'newAnnouncement', {
          text: 'Your team has won!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
        emitTeam(this, 0, 'newAnnouncement', {
          text: 'Your team has lost!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
        winston.log('debug', 'team 1 has won in room ' + this.id + ' (trench wars)');
      }
      if(loc[2].timesince === 450){
        this.state = 'ended';
        this.endtime = new Date().getTime();
        emitTeam(this, 0, 'newAnnouncement', {
          text: 'Your team has won!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
        emitTeam(this, 1, 'newAnnouncement', {
          text: 'Your team has lost!',
          lifetime: 10000,
          color: 'rgb(255, 255, 255)'
        });
        winston.log('debug', 'team 0 has won in room ' + this.id + ' (trench wars)');
      }
    } else if(this.state === 'ended'){
      // when a team or player wins, remove all players after 10 seconds
      if(new Date().getTime() - this.endtime > 10*1000){
        for(var i in this.players){
          this.players[i].leave();
        }
      }
    }
  }
}


Room.prototype.drawPlayers = function(){
  var ppos = {};

  // iterate through players
  for(var i in this.players){
    var p = this.players[i];

    if(p.joined){
      p.update();
      // if player chooses to leave
      if(p.keys['leave']) p.leave();
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


Room.prototype.drawProjectiles = function(){
  // iterate backwards to prevent index errors when splicing
  for(var i = this.projectiles.length-1; i > -1; i--){
    var p = this.projectiles[i];

    if(Sockets[p.origin]){
      for(var j = 0; j < unistep; j++){

        // update projectile positions
        p.x = p.x + p.x_velocity / (unistep*100);
        p.y = p.y + p.y_velocity / (unistep*100);
        p.lifetime--;
        if(p.penetrate > 0) p.penetrate--;

        if(p.lifetime <= 0){

          // delete projectiles if past lifetime
          this.projectiles.splice(i, 1);
          break;

        } else {

          // check collision with players
          var ccheck;
          var self = this;
          ccheck = collisionCheckPlayers(self, p, p.size, function(e){

            var origin = self.players[p.origin];
            if(origin !== null && origin.team !== e.team && p.origin !== e.id && e.energy > 0){

              // return the position of the collison
              if(p.penetrate === 0) emitRoom(self, 'projectileHit', p.id, e.x, e.y);

              // if projectile is explosive, create an explosion
              if(p.explosive > 0){
                emitRoom(self, 'explosion', p.x, p.y);
                collisionCheckPlayers(self, p, p.explosive, function(e, dist){

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
              if(p.penetrate === 0) self.projectiles.splice(i, 1);
            } else {
              ccheck = false;
            }
          });
          if(ccheck) break;

          // check collision with map
          var self = this;
          ccheck = collisionCheckMap(p, 1, function(pos, tx, ty){
            var origin = self.players[p.origin];

            // return the position of the collison
            if(p.bounce === 0){

              emitRoom(self, 'projectileHit', p.id, tx, ty);
              // if projectile is explosive, create an explosion
              if(p.explosive > 0 && origin !== null){

                emitRoom(self, 'explosion', tx, ty);
                collisionCheckPlayers(self, p, p.explosive, function(e, dist){

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
              self.projectiles.splice(i, 1);

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
              p.bounce -= 1;

            }
          });

          if(ccheck) break;
        }
      }
    } else {
      this.projectiles.splice(i, 1);
    }
  }
}

// return leaderboard
Room.prototype.getLeaderboard = function(){
  var p = [];
  for(var i in this.players){
    if(!this.players[i].bot) p.push([i, this.players[i]]);
  }
  p.sort(function(a, b){return b[1].bounty - a[1].bounty;});
  var arr = [];
  for(var i in p) if(p[i][1].joined) arr.push(p[i][0]);
  return arr;
}

module.exports = Room;
