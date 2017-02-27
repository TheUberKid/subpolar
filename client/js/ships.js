var ships = {
  'falcon': {
    accel: 20,
    maxspeed: 800,
    turnspeed: 8,
    maxenergy: 250,
    abilitycd: 200,
    image: 'falcon.png'
  },
  'lancaster': {
    accel: 15,
    maxspeed: 700,
    turnspeed: 6,
    maxenergy: 250,
    abilitycd: 300,
    image: 'lancaster.png'
  },
  'ghost': {
    accel: 20,
    maxspeed: 650,
    turnspeed: 6,
    maxenergy: 200,
    abilitycd: 0,
    image: 'ghost.png'
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

function drawPlayers(ppos){
  ctx.textAlign = 'left';
  ctx.font = '16px Share Tech Mono';
  for(var i in ppos){
    var p = ppos[i];
    if(p.joined){
      var s = ships[p.ship];
      if(!p.death){
        if(p.id === self.id){ // if self

          // if stealthed show transparency
          if(p.stealth) ctx.globalAlpha = 0.5;
          // draw sprite
          drawImg(s.image, canvas.width/2, canvas.height/2, 32, self.rotate);
          ctx.fillStyle = '#ddd';
          ctx.fillText(p.displayName + ' [' + p.bounty + ']', canvas.width/2+16, canvas.height/2+24);
          if(p.stealth) ctx.globalAlpha = 1;

        } else { // otherwise if other player
          var diffx = p.x - self.x;
          var diffy = p.y - self.y;
          if(!p.stealth){
            drawImg(s.image,(canvas.width/2)+diffx,(canvas.height/2)+diffy, 32, p.rotate);
            ctx.fillStyle = self.team === p.team ? '#56b4c9' : '#f3172d';
            ctx.fillText(p.displayName + ' [' + p.bounty + ']', (canvas.width/2)+diffx+16, (canvas.height/2)+diffy+24);
          }
        }
      }
    }
  }

  // display death message
  if(self.death){
    var currentTime = new Date();
    var restime = 5-(currentTime.getTime()-deathtimer)/1000;
    ctx.textAlign = 'center';
    ctx.font = '20px Share Tech Mono';
    ctx.fillStyle = '#f3172d';
    ctx.fillText('You\'ve been blown to bits!', canvas.width/2, canvas.height/2 - 10);
    ctx.fillText('Respawning in '+ restime.toFixed(1) + ' seconds', canvas.width/2, canvas.height/2 + 10);
  }
}
