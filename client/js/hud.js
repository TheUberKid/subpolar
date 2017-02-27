function drawHUD(ppos, time, players, rankings, loc){
  var s = ships[self.ship];

  // energy bar
  if(!self.death){
    ctx.fillStyle = 'rgb('+Math.round(250-self.energy)+', '+Math.round(self.energy)+', 0)';
    ctx.fillRect(canvas.width/2+16, canvas.height/2+30, self.energy/3, 3);
  }

  // fps
  var thisFrameTime = (thisLoop = new Date) - lastLoop;
  frameTime += (thisFrameTime - frameTime) / filterStrength;
  lastLoop = thisLoop;
  var fps = (1000/frameTime).toFixed(0);
  ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
  ctx.textAlign = 'left';
  ctx.font = '16px Share Tech Mono';
  ctx.fillText('FPS: '+fps, 20, 20);
  ctx.fillText(keyCodes[keymap['leave']].toUpperCase()+' to leave', 20, 40);
  ctx.textAlign = 'right';
  ctx.fillText('polarity '+version, canvas.width-20, 20);
  ctx.fillText(players+' player(s) online', canvas.width-20, 40);

  // announcements
  ctx.textAlign = 'center';
  ctx.font = '16px Share Tech Mono';
  for(var i=0, j=chat.announcements.length; i<j; i++){
    var a = chat.announcements[i];
    if(a){
      ctx.fillStyle = a.color;
      ctx.globalAlpha = Math.min(0.5, a.lifetime/100);
      ctx.fillText(a.text, canvas.width/2, canvas.height - 200 + (i*20));
      a.lifetime--;
      if(a.lifetime <= 0) delete chat.announcements[i];
    }
  }
  ctx.globalAlpha = 1;

  // chat
  ctx.font = '16px Share Tech Mono';
  ctx.textAlign = 'left';
  var numMessages; // number of messages to display
  if(chat.open){
    numMessages = 25;
    ctx.globalAlpha = 1;
  } else {
    numMessages = 5;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillText('Press '+keyCodes[keymap['chat']].toUpperCase()+' to chat', 20, canvas.height - 28);
  }
  // iterate through messages
  for(var i = 0; i < numMessages; i++){
    var c = chat.messages[chat.messages.length-i-1];
    if(c != null){
      var pos = canvas.height - 60 - (i*20)
      if(c[0] === 'chat'){
        ctx.fillStyle = 'rgb(255, 255, 255)';
        var prev = chat.messages[chat.messages.length-i-2];
        var name = prev && prev[1] === c[1] && i !== numMessages - 1 && prev[0] === 'chat' ? ' '.repeat(c[1].length+3) : c[1] + ' > ';
        ctx.fillText(name + c[2], 20, pos);
      }
      if(c[0] === 'teamchat'){
        ctx.fillStyle = 'rgb(0, 255, 255)';
        var prev = chat.messages[chat.messages.length-i-2];
        var name = prev && prev[1] === c[1] && i !== numMessages - 1 && prev[0] === 'teamchat' ? ' '.repeat(c[1].length+3) : c[1] + ' > ';
        ctx.fillText(name + c[2], 20, pos);
      }
      if(c[0] === 'kill'){
        ctx.fillStyle = 'rgb(255, 100, 100)';
        ctx.fillText(c[1] + ' was killed by ' + c[2], 20, pos);
      }
    }
  }

  // leaderboard
  // note that opacity effect is still applied from chat
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgb(200, 200, 200)';
  ctx.fillText('#', canvas.width-245, 80);
  ctx.textAlign = 'left';
  ctx.fillText('PLAYER', canvas.width-230, 80);
  ctx.textAlign = 'right';
  ctx.fillText('BOUNTY', canvas.width-75, 80);
  ctx.fillText('KILLS', canvas.width-20, 80);
  // show top five
  var onLeaderboard = false;
  for(var i = 0; i < 5; i++){
    var r = rankings[i];
    if(r != null && ppos[r] != null){
      ctx.textAlign = 'right';
      if(r == self.id){
        onLeaderboard = true;
        ctx.fillStyle = '#00ffff';
      } else {
        ctx.fillStyle = ppos[r].team === self.team ? '#56b4c9' : '#f3172d';
      }
      ctx.fillText(i+1, canvas.width-245, 105 + (20*i));
      ctx.textAlign = 'left';
      ctx.fillText(ppos[r].displayName, canvas.width-230, 105 + (20*i));
      ctx.textAlign = 'right';
      ctx.fillText(ppos[r].bounty, canvas.width-75, 105 + (20*i));
      ctx.fillText(ppos[r].kills, canvas.width-20, 105 + (20*i));
    }
  }
  if(!onLeaderboard){
    for(var i in rankings){
      var r = rankings[i];
      if(r != null && r === self.id){
        ctx.textAlign = 'right';
        ctx.fillStyle = '#00ffff';
        ctx.fillText(i+1, canvas.width-245, 105 + (20*5));
        ctx.textAlign = 'left';
        ctx.fillText(ppos[r].displayName, canvas.width-230, 105 + (20*5));
        ctx.textAlign = 'right';
        ctx.fillText(ppos[r].bounty, canvas.width-75, 105 + (20*5));
        ctx.fillText(ppos[r].kills, canvas.width-20, 105 + (20*5));
        break;
      }
    }
  }
  ctx.globalAlpha = 1;

  // ability cooldown
  if(s != null){
    ctx.strokeStyle = 'rgba(255, 255, 255, '+ (self.abilitycd === 0 && !self.stealth ? '1' : '0.5') + ')';
    ctx.fillStyle = 'rgba(255, 255, 255, '+ (self.abilitycd === 0 && !self.stealth ? '1' : '0.25') + ')';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.font = '14px Share Tech Mono';
    ctx.fillText(keyCodes[keymap['ability1']].toUpperCase(), canvas.width-310, canvas.height-30);
    ctx.strokeRect(canvas.width-375, canvas.height-95, 75, 75);
    var ypos = self.stealth ? canvas.height-95 : canvas.height-20-(self.abilitycd/s.abilitycd)*75;
    var height = self.stealth ? 75 : (self.abilitycd/s.abilitycd)*75;
    ctx.fillRect(canvas.width-375, ypos, 75, height);
  }
}