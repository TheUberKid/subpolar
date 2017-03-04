// Client-side projectile constructor
var projectiles = [];
var projectileTemplates = {
  'falconShot': {
    color: 'rgb(255, 255, 255)',
    size: 1,
    lifetime: 10,
    ripplesize: 1,
    ripplelife: 10,
    ripplecount: 3
  },
  'lancasterShot': {
    color: 'rgb(255, 255, 175)',
    size: 1,
    lifetime: 7
  },
  'lancasterBomb': {
    color: 'rgb(255, 150, 75)',
    size: 3,
    lifetime: 10,
    ripplesize: 2,
    ripplelife: 15,
    ripplecount: 1
  },
  'ghostShot': {
    color: 'rgb(175, 255, 175)',
    size: 1,
    lifetime: 7
  },
  'ghostAmbushShot': {
    color: 'rgb(255, 255, 255)',
    size: 1,
    lifetime: 7,
  },
  'auroraShot': {
    color: 'rgb(155, 200, 255)',
    size: 1,
    lifetime: 5
  },
  'auroraMine': {
    color: 'rgb(255, 200, 100)',
    size: 8,
    lifetime: 5
  }
};

function initProjectiles(){
  // projectile creation
  socket.on('projectile', function(p, rotate){
    var rippleCount = 0;
    var pt = projectileTemplates[p.type];
    if(pt.ripplecount && pt.ripplecount > 0){
      ripples.push(new Ripple(p.x, p.y, rotate, pt.ripplesize, pt.color, pt.ripplelife));
      rippleCount = pt.ripplecount*3 - 1;
    }
    projectiles.push(new Projectile(p.id, p.x, p.y, rotate, p.x_velocity, p.y_velocity, p.type, p.lifetime, p.bounce, p.origin, rippleCount));
  });

  socket.on('projectileHit', function(id, px, py){
    for(var i = projectiles.length-1; i>-1; i--){
      if(projectiles[i].id === id){
        var p = projectiles[i];
        var pt = projectileTemplates[projectiles[i].type];
        var arr = [];
        arr.push(Math.sqrt(Math.pow(p.x - px, 2) + Math.pow(p.y - py, 2)));
        for(var j = 1; j < unistep*2; j++){
          arr.push(Math.sqrt(Math.pow(p.x+j*p.x_velocity/(unistep*100)-px, 2) + Math.pow(p.y+j*p.y_velocity/(unistep*100)-py, 2)));
        }
        var min = Math.min.apply(null, arr), // find the lowest value in arr and return its index
            pos = arr.indexOf(min);
        p.lifetime = pos;
        break;
      }
    }
  });
  socket.on('projectileBounce', function(p){
    for(var i=0, j=projectiles.length; i<j; i++){
      var t = projectiles[i];
      if(t.id === p.id){
        t.x = p.x;
        t.y = p.y;
        t.x_velocity = p.x_velocity;
        t.y_velocity = p.y_velocity;
        if(t.bounce > 0) t.bounce--;
        t.trail = false;
      }
    }
  });
  // when a projectile bounces because of repel, do not decrease bounce
  socket.on('repelBounce', function(p){
    for(var i=0, j=projectiles.length; i<j; i++){
      var t = projectiles[i];
      if(t.id === p.id){
        t.x = p.x;
        t.y = p.y;
        t.x_velocity = p.x_velocity;
        t.y_velocity = p.y_velocity;
      }
    }
  });
}

var Projectile = function(id, x, y, rotate, x_velocity, y_velocity, type, lifetime, bounce, origin, rippleCount){
  this.id = id;
  this.x = x;
  this.y = y;
  this.rotate = rotate;
  this.x_velocity = x_velocity;
  this.y_velocity = y_velocity;
  this.type = type;
  this.lifetime = lifetime;
  this.bounce = bounce;
  this.origin = origin;
  this.rippleCount = rippleCount;
  this.trail = false;
}

// update projectiles
function drawProjectiles(){
  for(var i = projectiles.length-1; i>-1; i--){
    var p = projectiles[i];
    var pt = projectileTemplates[p.type];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    for(var j = 0; j < unistep; j++){
      if(p.trail){
        if(Math.abs(diffx) < canvas.width+8 && Math.abs(diffy) < canvas.height+8 && p.lifetime > 0){
          var trailstep = Math.round(Math.sqrt((p.x_velocity/100)*(p.x_velocity/100) + (p.y_velocity/100)*(p.y_velocity/100)) / (pt.size/2))+1;
          for(var k = 0, l = Math.ceil(trailstep/unistep); k<l; k++){
            var t = new Trail(p.x - k*(p.x_velocity/(l*100)), p.y - k*(p.y_velocity/(l*100)), pt.size, pt.color, pt.lifetime - (k / l));
            trails.push(t);
          }
        }
      } else {
        p.trail = true;
      }
      p.x = p.x + p.x_velocity / (unistep * 100);
      p.y = p.y + p.y_velocity / (unistep * 100);
      p.lifetime--;
      if(p.lifetime <= 0){
        projectiles.splice(i, 1);
        break;
      } else {
        // check collision with map
        collisionCheckMap(p, 1, function(px, py){
          if(p.bounce === 0){
            var arr = [];
            arr.push(Math.sqrt((p.x-px)*(p.x-px) + (p.y-py)*(p.y-py)));
            for(var j = 1; j < unistep*2; j++){
              arr.push(Math.sqrt(Math.pow(p.x+(j*p.x_velocity)/(unistep*100)-px, 2) + Math.pow(p.y+(j*p.y_velocity)/(unistep*100)-py, 2)));
            }
            var min = Math.min.apply(null, arr), // find the lowest value in arr and return its index
                pos = arr.indexOf(min);
            p.lifetime = pos;
          }
        });
      }
    }
    // create ripples
    if(p.trail && p.rippleCount > 0){
      if(p.rippleCount % 3 === 0) ripples.push(new Ripple(p.x, p.y, p.rotate, pt.ripplesize, pt.color, pt.ripplelife));
      p.rippleCount--;
    }
  }
}
