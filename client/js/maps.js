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
          // determine the side by subtracting positions and finding closest match
          var arr = [Math.floor(ty-p.y), Math.floor(tx-p.x), Math.floor(p.y-ty), Math.floor(p.x-tx)];
          // if there is another block on that side it is impossible for entity to have collided, set to -16
          if(m[my-1] && m[my-1][mx] == 1) arr[0] = -16;
          if(m[my][mx-1] == 1) arr[1] = -16;
          if(m[my+1] && m[my+1][mx] == 1) arr[2] = -16;
          if(m[my][mx+1] == 1) arr[3] = -15; // default to 'right' if multiple match -16
          var max = Math.max.apply(null, arr), // find the closest match in arr and return its index
              pos = arr.indexOf(max);
          callback(pos, tx, ty);
          return true;
        }
      }
    }
  }
  return false;
}

function drawMap(){
  // NOTE: map is drawn to tctx canvas and is drawn in the drawLighting function when tctx is copied to the main context.
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
        drawTctxImg('wall.png', Math.round((canvas.width/2) + diffx), Math.round((canvas.height/2) + diffy), 18, 0, parseInt(binfr, 2));
      }
    }
  }
}

// minimap
function drawMinimap(loc){

  var xpos = canvas.width - 145;
  var ypos = canvas.height - 145;

  // create minimap clipping boundaries
  ctx.save();
  ctx.beginPath();
  if(keys['minimap']){
    ctx.rect(60, 60, canvas.width - 120, canvas.height - 120);
    xpos = canvas.width/2;
    ypos = canvas.height/2;
  } else {
    ctx.rect(canvas.width - 270, canvas.height - 270, 250, 250);
  }
  ctx.clip();

  // darkened backdrop
  if(keys['minimap']){
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(60, 60, canvas.width - 120, canvas.height - 120);
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canvas.width - 270, canvas.height - 270, 250, 250);
  }

  // draw objectives on minimap
  if(self.map === 'trenchWars'){
    for(var i=0, j=loc.length; i<j; i++){
      var o = loc[i];
      // find difference in x and y from player or from center of map depending on expanded map
      var diffx = keys['minimap'] ? (o.x/8 - mapdata[0].length) : (o.x - self.x)/8;
      var diffy = keys['minimap'] ? (o.y/8 - mapdata.length) : (o.y - self.y)/8;
      // if within bounds, draw a circle at the objective
      if(keys['minimap'] || (!keys['minimap'] && Math.abs(diffx) < 135 && Math.abs(diffy) < 135)){
        // determine color
        var color = self.team === 0 ?
          'rgba('+(o.control+100)+', '+Math.abs(o.control-100)+', '+Math.abs(o.control-100)+', 0.3)' :
          'rgba('+Math.abs(o.control-100)+', '+(o.control+100)+', '+(o.control+100)+', 0.3)';
        if(o.controlled[self.team]){
          color = 'rgba(0, 255, 255, 0.3)';
        } else if(o.controlled[Math.abs(self.team-1)]){
          color = 'rgba(255, 0, 0, 0.3)';
        }
        drawCircle(xpos + diffx, ypos + diffy, 10, color);
      }
    }
  }

  // draw walls on minimap
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  if(keys['minimap']){
    for(var r = 0, j=mapdata.length; r<j; r++){
      for(var c = 0, k=mapdata[r].length; c<k; c++){
        if(mapdata[r] && mapdata[r][c] && mapdata[r][c] != 0) ctx.strokeRect(xpos + c*2 - (mapdata[0].length), ypos + r*2 - (mapdata.length), 1, 1);
      }
    }
  } else {
    for(var r = Math.round(self.y/16)-63, j=Math.round(self.y/16)+63; r<j; r++){
      for(var c = Math.round(self.x/16)-63, k=Math.round(self.x/16)+63; c<k; c++){
        if(mapdata[r] && mapdata[r][c] && mapdata[r][c] != 0) ctx.strokeRect(xpos + c*2 - self.x/8, ypos + r*2 - self.y/8, 1, 1);
      }
    }
  }

  // draw players on minimap
  for(var i in players){
    var p = players[i];
    if(p.id !== self.id && !p.death){
      if(keys['minimap'] || (!keys['minimap'] && Math.abs(p.x-self.x) < 1000 && Math.abs(p.y-self.y) < 1000)){
        ctx.strokeStyle = p.team === self.team ? '#56b4c9' : '#f3172d';
        var diffx = keys['minimap'] ? (p.x/8 - mapdata[0].length) : (p.x - self.x)/8;
        var diffy = keys['minimap'] ? (p.y/8 - mapdata.length) : (p.y - self.y)/8;
        ctx.strokeRect(xpos + diffx, ypos + diffy, 1, 1);
      }
    }
  }
  ctx.strokeStyle = 'rgb(100, 255, 100)';
  if(keys['minimap']){
    ctx.strokeRect(xpos + self.x/8 - (mapdata[0].length), ypos + self.y/8 - (mapdata.length), 1, 1);
  } else {
    ctx.strokeRect(xpos, ypos, 1, 1);
  }
  // end clipping
  ctx.restore();

  // minimap border
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  if(keys['minimap']){
    ctx.strokeRect(60, 60, canvas.width - 120, canvas.height - 120);
  } else {
    ctx.strokeRect(canvas.width - 270, canvas.height - 270, 250, 250);
  }
}

// draw objectives
function drawObjectives(loc){
  if(self.map === 'tutorial'){
    for(var i=0, j=loc.length; i<j; i++){
      var o = loc[i];
      var diffx = o.x - self.x;
      var diffy = o.y - self.y;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255, 255, 255, " + (o.opacity/60) + ")";
      var lines = o.text.length;
      if(o.shipAlt) lines += o[self.ship].text.length;
      for(var k=0, l=o.text.length; k<l; k++){
        var t = o.text[k];
        for(var m in keymap){
          t = t.replace(new RegExp('%'+m, 'g'), keyCodes[keymap[m]].toUpperCase());
        }
        ctx.fillText(t, canvas.width/2 + diffx, canvas.height/2 + diffy - (10*lines) + (20*k));
      }
      if(o.shipAlt){
        o = o[self.ship];
        ctx.fillStyle = "rgba(" + (o.color) + ", " + (loc[i].opacity/60) + ")";
        for(var k=0, l=o.text.length; k<l; k++){
          var t = o.text[k];
          for(var m in keymap){
            t = t.replace(new RegExp('%'+m, 'g'), keyCodes[keymap[m]].toUpperCase());
          }
          ctx.fillText(t, canvas.width/2 + diffx, canvas.height/2 + diffy - (10*lines) + ((k + (lines-l)) * 20));
        }
      }
    }
  }
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
