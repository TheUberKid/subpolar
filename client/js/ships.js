var ships = {
  'warbird': {
    accel: 20,
    maxspeed: 800,
    turnspeed: 8,
    maxenergy: 250,
    abilitycd: 200,
    image: 'warbird.png',
    abilityimage: 'repel.png'
  },
  'lancaster': {
    accel: 15,
    maxspeed: 700,
    turnspeed: 6,
    maxenergy: 250,
    abilitycd: 320,
    image: 'lancaster.png',
    abilityimage: 'bomb.png'
  },
  'ghost': {
    accel: 20,
    maxspeed: 650,
    turnspeed: 6,
    maxenergy: 200,
    abilitycd: 0,
    image: 'ghost.png',
    abilityimage: 'cloak.png'
  },
  'aurora': {
    accel: 15,
    maxspeed: 750,
    turnspeed: 6,
    maxenergy: 250,
    abilitycd: 20,
    image: 'aurora.png'
  }
}

var players = {};
var Player = function(id, displayName, ship, team, bot){
  this.id = id;
  this.displayName = displayName;
  this.ship = ship;
  this.team = team;
  this.bot = bot;
  this.death = false;
  this.kills = 0;
  this.stealth = false;
}

function initShips(){
  // ship choices
  for(var i=0, j=shipChoices.length; i<j; i++){
    shipChoices[i].addEventListener('click', function(e){
      var self = e.currentTarget;
      shipChosen = self.dataset.name;
      document.getElementById('shipname').innerHTML = self.dataset.name;
      for(var k=0; k<j; k++){
        shipChoices[k].className = 'ship-choice';
      }
      self.className = 'ship-choice selected';
    });
  }

  // when a player joins or leaves
  socket.on('playerJoin', function(id, displayName, ship, team, bot){
    players[id] = new Player(id, displayName, ship, team, bot);
    if(id == self.id){
      self.joined = true;
      self.displayName = displayName;
      self.team = team;
      self.ship = ship;
    }
  });
  socket.on('playerLeave', function(id){
    delete players[id];
  });

  // get all players
  socket.on('playerList', function(ppos){
    for(var i in ppos){
      var p = ppos[i];
      players[i] = new Player(p.id, p.displayName, p.ship, p.team, p.bot);
    }
  });

  // other toggles
  socket.on('playerStealth', function(id){
    players[id].stealth = !players[id].stealth;
    if(id == self.id){
      self.stealth = !self.stealth;
    }
  });

  // when a player dies
  socket.on('playerDeath', function(px, py, killer, killed, deathTime){
    // temporary death animation
    var p0 = players[killer];
    var p1 = players[killed];
    if(p1.id == self.id){
      self.death = true;
      self.timeOfDeath = new Date().getTime();
      self.deathTime = deathTime;
    }
    lights.push(new Light(px, py, 20, 'rgb(255, 255, 200)'));
    chat.messages.push(['kill', p1.displayName, p0.displayName]);
    p0.kills++;
    p1.death = true;
  });
  socket.on('playerRespawn', function(id, x, y){
    players[id].death = false;
    if(id == self.id) self.death = false;
    lights.push(new Light(x, y, 20, 'rgb(255, 255, 255)'));
  });
}

function drawSelf(){
  var s = ships[self.ship];
  if(!self.death){
    // client side rotation
    if(keys['left']){
      if(self.rotate < 0) self.rotate = 360;
      self.rotate -= s.turnspeed;
    }
    if(keys['right']){
      if(self.rotate > 360) self.rotate = 0;
      self.rotate += s.turnspeed;
    }
    // thrusters
    if(keys['up'] && !self.death){
      if(thrusteralt === 0){
        var d = Math.round(Math.random()*5)+14;
        var t1 = new Thruster(self.x - d * Math.cos(radians*(self.rotate-90+7)), self.y - d * Math.sin(radians*(self.rotate-90+7)), self.rotate+7);
        var t2 = new Thruster(self.x - d * Math.cos(radians*(self.rotate-90-7)), self.y - d * Math.sin(radians*(self.rotate-90-7)), self.rotate-7);
        thrusters.splice(0, 0, t1, t2);
        thrusteralt = 1;
      } else {
        thrusteralt--;
      }
    } else if(keys['down'] && !self.death){
      if(thrusteralt === 0){
        var d = Math.round(Math.random()*5)+12;
        var t1 = new Thruster(self.x - d * Math.cos(radians*(self.rotate-90+7)), self.y - d * Math.sin(radians*(self.rotate-90+7)), (self.rotate+180-7) % 360);
        var t2 = new Thruster(self.x - d * Math.cos(radians*(self.rotate-90-7)), self.y - d * Math.sin(radians*(self.rotate-90-7)), (self.rotate+180+7) % 360);
        thrusters.splice(0, 0, t1, t2);
        thrusteralt = 1;
      } else {
        thrusteralt--;
      }
    }
  }
}

function update(ppos, spos){
  for(var i in ppos){
    var p = players[i];
    var p1 = ppos[i];
    p.x = p1.x;
    p.y = p1.y;
    p.rotate = p1.rotate;
    p.bounty = p1.bounty;
    if(i == self.id){
      self.changeX = self.x - p1.x;
      self.changeY = self.y - p1.y;
      self.x = p1.x;
      self.y = p1.y;
      self.bounty = p1.bounty;
      if(self.rotate == null) self.rotate = p1.rotate;
      if(Math.abs(p1.rotate - self.rotate) > 1 && Math.abs((p1.rotate-360) - self.rotate) > 1 && Math.abs(p1.rotate - (self.rotate-360)) > 1){
        var arr = [Math.abs(p1.rotate-self.rotate), Math.abs((p1.rotate-360)-self.rotate), Math.abs(p1.rotate-(self.rotate-360))];
        var parr = [p1.rotate-self.rotate, (p1.rotate-360)-self.rotate, p1.rotate-(self.rotate-360)];
        var min = Math.min.apply(null, arr), // find the closest match in arr and return its index
            pos = arr.indexOf(min);
        self.rotate += 0.2 * parr[pos];
      }
    }
  }

  self.energy = spos.energy;
  self.abilitycd = spos.abilitycd;
}

function drawPlayers(){
  ctx.textAlign = 'left';
  ctx.font = '16px Share Tech Mono';
  for(var i in players){
    var p = players[i];
    var s = ships[p.ship];
    if(!p.death && p.id != self.id){
      var diffx = p.x - self.x;
      var diffy = p.y - self.y;
      if(!p.stealth){
        drawImg(s.image,(canvas.width/2)+diffx,(canvas.height/2)+diffy, 32, p.rotate);
        ctx.fillStyle = self.team === p.team ? '#56b4c9' : '#f3172d';
        var nametag = p.bot ? p.displayName : p.displayName + ' [' + p.bounty + ']';
        ctx.fillText(nametag, (canvas.width/2)+diffx+16, (canvas.height/2)+diffy+24);
      }
    }
  }

  var s = ships[self.ship];
  // if stealthed show transparency
  if(self.stealth) ctx.globalAlpha = 0.5;
  // draw sprite
  drawImg(s.image, canvas.width/2, canvas.height/2, 32, self.rotate);
  ctx.fillStyle = '#ddd';
  ctx.fillText(self.displayName + ' [' + self.bounty + ']', canvas.width/2+16, canvas.height/2+24);
  ctx.globalAlpha = 1;

  // display death message
  if(self.death){
    var currentTime = new Date();
    var restime = (self.deathTime-(currentTime.getTime()-self.timeOfDeath))/1000;
    ctx.textAlign = 'center';
    ctx.font = '20px Share Tech Mono';
    ctx.fillStyle = '#f3172d';
    ctx.fillText('You\'ve been blown to bits!', canvas.width/2, canvas.height/2 - 10);
    ctx.fillText('Respawning in '+ restime.toFixed(1) + ' seconds', canvas.width/2, canvas.height/2 + 10);
  }
}
