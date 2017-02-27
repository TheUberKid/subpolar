function initParticles(){
  // repels
  socket.on('repel', function(x, y){
    repels.push(new Repel(x, y));
  });
}

// Trails
var trails = [];
var Trail = function(x, y, size, color, lifetime){
  this.x = x;
  this.y = y;
  this.size = size;
  this.color = color;
  this.lifetime = lifetime;
  this.scale = 100/lifetime;
}

// Ripples from shots
var ripples = [];
var Ripple = function(x, y, rotate, size, color, lifetime){
  this.x = x;
  this.y = y;
  this.rotate = rotate;
  this.size = size;
  this.color = color;
  this.lifetime = lifetime;
  this.maxlife = lifetime;
}

// Repels
var repels = [];
var Repel = function(x, y){
  this.x = x;
  this.y = y;
  this.lifetime = 15;
}

// thruster particle effect
var thrusters = [];
var Thruster = function(x, y, rotate){
  this.x = x;
  this.y = y;
  this.rotate = rotate;
  this.frame = 0;
}

function drawParticles(){
  // NOTE: Trail lifetimes are counted as less than a normal lifetime measurement.
  // This is because they dont need to be step-checked per frame like other objects.
  // as such a trail lifetime is simply the number of frames it exists
  for(var i = trails.length-1; i > -1; i--){
    var t = trails[i];
    var diffx = t.x - self.x;
    var diffy = t.y - self.y;
    if(Math.abs(diffx) < canvas.width/2+8 && Math.abs(diffy) < canvas.height/2+8){
      var alpha = ((t.lifetime - 1) * t.scale) / 100;
      if(alpha < 0) alpha = 0;
      ctx.globalAlpha = alpha;
      drawCircle(canvas.width/2 + diffx, canvas.height/2 + diffy, t.size/2, t.color);
    }
    t.lifetime--;
    if(t.lifetime <= 0) trails.splice(i, 1);
  }
  ctx.globalAlpha = 1;

  // thruster particles
  for(var i = thrusters.length-1; i > -1; i--){ // iterate backwards to splice
    var p = thrusters[i];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    drawImg('smoke.png', (canvas.width/2)+diffx, (canvas.height/2)+diffy, 16, 0, p.frame);
    if(p.frame < 5){
      p.x -= 5 * Math.cos(radians*(p.rotate-90));
      p.y -= 5 * Math.sin(radians*(p.rotate-90));
    } else {
      p.x -= 0.5 * Math.cos(radians*(p.rotate-90));
      p.y -= 0.5 * Math.sin(radians*(p.rotate-90));
    }
    p.frame++;
    if(p.frame > 11) thrusters.splice(i, 1);
  }

  // repels
  for(var i = repels.length-1; i > -1; i--){
    var p = repels[i];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    drawCircle((canvas.width/2)+diffx, (canvas.height/2)+diffy, 80-(p.lifetime * 4), 'rgba(195, 180, 135, '+(p.lifetime/80)+')');
    drawCircle((canvas.width/2)+diffx, (canvas.height/2)+diffy, 80-(p.lifetime * 4), 'transparent', 'rgba(215, 200, 130, '+(p.lifetime/60)+')', 5);
    drawCircle((canvas.width/2)+diffx, (canvas.height/2)+diffy, 90-(p.lifetime * 4.5), 'transparent', 'rgba(225, 210, 125, '+(p.lifetime/40)+')', 5);
    drawCircle((canvas.width/2)+diffx, (canvas.height/2)+diffy, 100-(p.lifetime * 5), 'transparent', 'rgba(240, 220, 120, '+(p.lifetime/20)+')', 6);
    p.lifetime--;
    if(p.lifetime < 0) repels.splice(i, 1);
  }

  // the particle that appears when a weapon is fired
  for(var i = ripples.length-1; i > -1; i--){
    var r = ripples[i];
    var diffx = r.x - self.x;
    var diffy = r.y - self.y;
    if(Math.abs(diffx) < canvas.width && Math.abs(diffy) < canvas.height){
      ctx.save();
      ctx.translate((canvas.width/2) + diffx, (canvas.height/2) + diffy);
      ctx.rotate(radians*r.rotate);
      ctx.scale(1, 0.3);
      ctx.globalAlpha = r.lifetime/r.maxlife;
      drawCircle(0, 0, Math.min(30-((r.lifetime/r.maxlife)*30), 10)*r.size, 'transparent', r.color, 4);
      ctx.restore();
    }
    r.lifetime--;
    if(r.lifetime < 0) ripples.splice(i, 1);
  }
}
