var mapdata = [];

function initMaps(){
  socket.on('map', function(d, m){
    mapdata = d;
    self.map = m;
  });
}

// client-side collision checking
function collisionCheckMap(p, size, callback){
  var mapx = Math.round(p.x/16);
  var mapy = Math.round(p.y/16);
  // find only closest 5x5 area of map blocks to compare position to reduce lag
  for(var j = -1; j < 2; j++){
    for(var k = -1; k < 2; k++){
      var m = mapdata;
      var mx = mapx + j;
      var my = mapy + k;
      var tx = mx * 16;
      var ty = my * 16;
      if(m[my] && m[my][mx] == 1){
        if(p.x >= tx-size-8 && p.x <= tx+size+8 && p.y >= ty-size-8 && p.y <= ty+size+8){
          callback(tx, ty);
          return true;
        }
      }
    }
  }
  return false;
}

function drawMap(){
  var binfr = '0000';
  for(var r = Math.round((self.y-canvas.height/2)/16)-2, j=Math.round((self.y+canvas.height/2)/16)+2; r<j; r++){
    for(var c = Math.round((self.x-canvas.width/2)/16)-2, k=Math.round((self.x+canvas.width/2)/16)+2; c<k; c++){
      if(mapdata[r] && mapdata[r][c] && mapdata[r][c] != 0){
        var diffx = (c * 16) - self.x;
        var diffy = (r * 16) - self.y;
        binfr = '0000';
        if(mapdata[r-1] && mapdata[r-1][c] == 1) binfr = binfr.replaceAt(0, '1');
        if(mapdata[r][c-1] == 1) binfr = binfr.replaceAt(1, '1');
        if(mapdata[r+1] && mapdata[r+1][c] == 1) binfr = binfr.replaceAt(2, '1');
        if(mapdata[r][c+1] == 1) binfr = binfr.replaceAt(3, '1');
        drawImg('wall.png', (canvas.width/2) + diffx, (canvas.height/2) + diffy, 18, 0, parseInt(binfr, 2));
      }
    }
  }
}


// minimap
function drawMinimap(ppos, loc){
  // minimap clipping
  ctx.save();
  ctx.beginPath();
  ctx.rect(canvas.width - 270, canvas.height - 270, 250, 250);
  ctx.clip();
  // objectives
  if(self.map === 'trenchWars'){
    for(var i=0, j=loc.length; i<j; i++){
      var o = loc[i];
      var diffx = (o.x - self.x)/8;
      var diffy = (o.y - self.y)/8;
      if(Math.abs(diffx) < 135 && Math.abs(diffy) < 135){
        var color = self.team === 0 ?
          'rgba('+(o.control+100)+', '+Math.abs(o.control-100)+', '+Math.abs(o.control-100)+', 0.7)' :
          'rgba('+Math.abs(o.control-100)+', '+(o.control+100)+', '+(o.control+100)+', 0.7)';
        if(o.controlled[self.team]){
          color = 'rgba(0, 255, 255, 0.7)';
        } else if(o.controlled[Math.abs(self.team-1)]){
          color = 'rgba(255, 0, 0, 0.7)';
        }
        drawCircle(canvas.width - 145 + diffx, canvas.height - 145 + diffy, 10, color);
      }
    }
  }
  // map
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(canvas.width - 270, canvas.height - 270, 250, 250);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  for(var r = Math.round(self.y/16)-63, j=Math.round(self.y/16)+63; r<j; r++){
    for(var c = Math.round(self.x/16)-63, k=Math.round(self.x/16)+63; c<k; c++){
      if(mapdata[r] && mapdata[r][c] && mapdata[r][c] != 0) ctx.strokeRect(canvas.width - 145 + c*2 - self.x/8, canvas.height - 145 + r*2 - self.y/8, 1, 1);
    }
  }
  // players
  for(var i in ppos){
    var p = ppos[i];
    if(p.id !== self.id && Math.abs(p.x-self.x) < 1000 && Math.abs(p.y-self.y) < 1000 && !p.death){
      ctx.strokeStyle = p.team === self.team ? '#56b4c9' : '#f3172d';
      var diffx = (p.x - self.x)/8;
      var diffy = (p.y - self.y)/8;
      ctx.strokeRect(canvas.width - 145 + diffx, canvas.height - 145 + diffy, 1, 1);
    }
  }
  ctx.strokeStyle = 'rgb(100, 255, 100)';
  ctx.strokeRect(canvas.width - 145, canvas.height - 145, 1, 1);
  // end clipping
  ctx.restore();

  // canvas border
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.strokeRect(canvas.width - 270, canvas.height - 270, 250, 250);
}

// draw objectives
function drawObjectives(loc){
  if(self.map === 'trenchWars'){
    for(var i=0, j=loc.length; i<j; i++){
      var o = loc[i];
      var diffx = o.x - self.x;
      var diffy = o.y - self.y;
      var color = self.team === 0 ?
        'rgba('+(o.control+100)+', '+Math.abs(o.control-100)+', '+Math.abs(o.control-100)+', 0.4)' :
        'rgba('+Math.abs(o.control-100)+', '+(o.control+100)+', '+(o.control+100)+', 0.4)';
      var stroke = 'transparent';
      if(o.controlled[self.team]){
        stroke = 'rgba(0, 255, 255, 0.5)';
      } else if(o.controlled[Math.abs(self.team-1)]){
        stroke = 'rgba(255, 0, 0, 0.5)';
      }
      drawCircle(canvas.width/2 + diffx, canvas.height/2 + diffy, 100, color, stroke, 2);
    }
  }
}
