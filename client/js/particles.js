function initParticles(){
  // repels
  socket.on('repel', function(x, y){
    repels.push(new Repel(x, y));
  });

  // when a bomb explodes
  socket.on('explosion', function(ex, ey){
    lights.push(new Light(ex, ey, 20, 'rgb(255, 255, 200)'));
  });
}

// Stars
var stars = [];
var Star = function(x, y, size, brightness){
  this.x = x;
  this.y = y;
  this.size = size;
  this.brightness = brightness;
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
  this.lifetime = 13;
}

// thruster particle effect
var thrusters = [];
var Thruster = function(x, y, rotate){
  this.x = x;
  this.y = y;
  this.rotate = rotate;
  this.frame = 0;
}

// sourceless lighting effects
var lights = [];
var Light = function(x, y, intensity, color){
  this.x = x;
  this.y = y;
  this.intensity = intensity;
  this.color = color;
}

function drawParticles(){
  // NOTE: Trail lifetimes are counted as less than a normal lifetime measurement.
  // This is because they dont need to be step-checked per frame like other objects.
  // as such a trail lifetime is simply the number of frames it exists
  ctx.save();
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
  ctx.restore();

  // thruster particles
  for(var i = thrusters.length-1; i > -1; i--){ // iterate backwards to splice
    var p = thrusters[i];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    drawImg('smoke.png', (canvas.width/2)+diffx, (canvas.height/2)+diffy, 16, 0, p.frame);

    var mapx = Math.round(p.x/16);
    var mapy = Math.round(p.y/16);
    if(mapdata[mapy] && mapdata[mapy][mapx] != 1){
      if(p.frame < 5){
        p.x -= 5 * Math.cos(radians*(p.rotate-90));
        p.y -= 5 * Math.sin(radians*(p.rotate-90));
      } else {
        p.x -= 0.5 * Math.cos(radians*(p.rotate-90));
        p.y -= 0.5 * Math.sin(radians*(p.rotate-90));
      }
    }
    p.frame++;

    if(p.frame > 11) thrusters.splice(i, 1);
  }

  // repels
  for(var i = repels.length-1; i > -1; i--){
    var p = repels[i];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    if(Math.abs(diffx) < canvas.width+45 && Math.abs(diffy) < canvas.height+45){
      ctx.save();
      ctx.shadowBlur = 1;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      drawCircle((canvas.width/2)+diffx, (canvas.height/2)+diffy,
        Math.min(8*(13-p.lifetime), 45)+20, 'rgba(240, 220, 170, '+Math.max((p.lifetime-8)/5, 0)+')',
        'rgba(235, 220, 150, '+Math.min(0.6, p.lifetime/5)+')', Math.max((p.lifetime-3)*2, 1));
      ctx.restore();
    }
    if(p.lifetime === 10) lights.push(new Light(p.x, p.y, 20, 'rgb(240, 220, 170)'));
    p.lifetime--;
    if(p.lifetime < 0) repels.splice(i, 1);
  }

  // ripple particle (when certain weapons are fired)
  for(var i = ripples.length-1; i > -1; i--){
    var r = ripples[i];
    var diffx = r.x - self.x;
    var diffy = r.y - self.y;
    if(Math.abs(diffx) < canvas.width+10 && Math.abs(diffy) < canvas.height+10){
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

// lighting
function drawLighting(){
  tctx.save();
  tctx.globalCompositeOperation = 'source-atop';

  // spotlight
  var light = tctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.width/2, canvas.width/2, canvas.height/2, canvas.width/4);
  light.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
  light.addColorStop(1, 'transparent');
  tctx.fillStyle = light;
  tctx.fillRect(0, 0, canvas.width, canvas.height);

  // lighting from back of ship
  tctx.globalCompositeOperation = 'source-atop';
  var t = thrusters.length;
  light = tctx.createRadialGradient(canvas.width/2 - (t*10) * Math.cos(radians*(self.rotate-90)),
              canvas.height/2 - (t*10) * Math.sin(radians*(self.rotate-90)), (t*10),
              canvas.width/2 - (t*2) * Math.cos(radians*(self.rotate-90)),
              canvas.height/2 - (t*2) * Math.sin(radians*(self.rotate-90)), 0);
  light.addColorStop(0, 'transparent');
  light.addColorStop(1, 'rgba(255, 225, 175, 0.2)');
  tctx.fillStyle = light;
  tctx.fillRect(0, 0, canvas.width, canvas.height);

  // lighting from thrusters
  for(var i=0; i<t; i++){
    var p = thrusters[i];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    light = tctx.createRadialGradient(canvas.width/2 + diffx, canvas.height/2 + diffy, 120,
            canvas.width/2 + diffx, canvas.height/2 + diffy, 0);
    light.addColorStop(0, 'transparent');
    light.addColorStop(1, 'rgba(255, 225, 175, 0.05)');
    tctx.fillStyle = light;
    tctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  tctx.globalAlpha = 0.2;
  // lighting from bullets
  for(var i=0, j=projectiles.length; i<j; i++){
    var p = projectiles[i];
    var pt = projectileTemplates[p.type];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    light = tctx.createRadialGradient(canvas.width/2 + diffx, canvas.height/2 + diffy, pt.lifetime * 15,
            canvas.width/2 + diffx, canvas.height/2 + diffy, 0);
    light.addColorStop(0, 'transparent');
    light.addColorStop(1, pt.color);
    tctx.fillStyle = light;
    tctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for(var i=lights.length-1; i>-1; i--){
    var p = lights[i];
    tctx.globalAlpha = p.intensity/30;
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    light = tctx.createRadialGradient(canvas.width/2 + diffx, canvas.height/2 + diffy, p.intensity*15,
            canvas.width/2 + diffx, canvas.height/2 + diffy, 0);
    light.addColorStop(0, 'transparent');
    light.addColorStop(1, p.color);
    tctx.fillStyle = light;
    tctx.fillRect(0, 0, canvas.width, canvas.height);

    p.intensity--;
    if(p.intensity <= 0) lights.splice(i, 1);
  }

  tctx.globalAlpha = 1;
  tctx.restore();
  ctx.drawImage(tctx.canvas, 0, 0);
}

// the background
function drawBackground(){

  // stars
  for(var i=0, j=stars.length; i<j; i++){
    var s = stars[i];
    if(s.x > -10 && s.x < canvas.width+10 && s.y > -10 && s.y < canvas.height+10){
      drawCircle(s.x, s.y, s.size/2, 'rgba(255, 255, 255, '+(s.brightness/10)+')');
    } else {
      if(s.x < -10) s.x += canvas.width+20;
      if(s.y < -10) s.y += canvas.height+20;
      if(s.x > canvas.width+10) s.x -= canvas.width+20;
      if(s.y > canvas.height+10) s.y -= canvas.height+20;
    }
    if(self.changeX){
      s.x += (self.changeX/50)*(s.size*4);
      s.y += (self.changeY/50)*(s.size*4);
    }
  }

  // nebula
  var bgfill = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgfill.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
  bgfill.addColorStop(0.5, 'rgba(10, 10, 30, 0.7)');
  bgfill.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
  ctx.fillStyle = bgfill;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
