var chat = {
  input: document.getElementById('chat-input'),
  wrapper: document.getElementById('chat-wrapper'),
  open: false,
  messages: [],
  announcement: {
    text: '',
    lifetime: 0,
    sent: 0,
    color: 'transparent'
  },
  notices: []
}

function initChat(){

  // when a message is received, add it to messages array and splice old entries
  socket.on('newMessage', function(n, m){
    chat.messages.push(['chat', n, m]);
    if(chat.messages.length > 30) chat.messages.splice(0, 1);
  });
  socket.on('newTeamMessage', function(n, m){
    chat.messages.push(['teamchat', n, m]);
    if(chat.messages.length > 30) chat.messages.splice(0, 1);
  });
  socket.on('newNotice', function(m){
    m.sent = new Date().getTime();
    for(var i=0, j=chat.notices.length; i<j; i++){
      var a = chat.notices[i];
      if(a == null){
        chat.notices[i] = m;
        break;
      } else if(i === chat.notices.length-1){
        chat.notices[chat.notices.length] = m;
      }
    }
    if(chat.notices.length === 0){
      chat.notices[0] = m;
    }
  });
  socket.on('newAnnouncement', function(m){
    chat.announcement.text = m.text;
    chat.announcement.lifetime = m.lifetime;
    chat.announcement.sent = new Date().getTime();
    chat.announcement.color = m.color;
  });
}

function drawHUD(time, population, rankings, loc){
  var s = ships[self.ship];

  // energy bar
  if(!self.death){
    ctx.save();
    ctx.shadowBlur = Math.max(Math.round((self.energy-(s.maxenergy-100))/20)-1, 0);
    ctx.shadowColor = 'rgb('+Math.round(250-self.energy)+', '+Math.round(self.energy)+', 0)';;
    ctx.fillStyle = 'rgb('+Math.round(250-self.energy)+', '+Math.round(self.energy)+', 0)';
    ctx.fillRect(canvas.width/2+16, canvas.height/2+30, self.energy/5, 3);
    ctx.restore();
  }

  // fps and stats
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
  ctx.fillText(population+' player(s) online', canvas.width-20, 40);

  if(!keys['minimap']){
    // announcements
    ctx.textAlign = 'center';
    ctx.font = '20px Share Tech Mono';
    var a = chat.announcement;
    if(a){
      var lifetime = (a.sent + a.lifetime) - new Date().getTime();
      if(lifetime > 0){
        ctx.fillStyle = a.color;
        ctx.globalAlpha = Math.min(0.5, lifetime/2000);
        ctx.fillText(a.text, canvas.width/2, canvas.height/2 - 120);
      }
    }

    // notices
    ctx.font = '16px Share Tech Mono';
    for(var i=0, j=chat.notices.length; i<j; i++){
      var a = chat.notices[i];
      if(a){
        var lifetime = (a.sent + a.lifetime) - new Date().getTime();
        if(lifetime <= 0){
          delete chat.notices[i];
          break;
        }
        ctx.fillStyle = a.color;
        ctx.globalAlpha = Math.min(0.5, lifetime/2000);
        ctx.fillText(a.text, canvas.width/2, canvas.height - 200 + (i*20));
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
      if(r != null && players[r] != null){
        ctx.textAlign = 'right';
        if(r == self.id){
          onLeaderboard = true;
          ctx.fillStyle = '#00ffff';
        } else {
          ctx.fillStyle = players[r].team === self.team ? '#56b4c9' : '#f3172d';
        }
        ctx.fillText(i+1, canvas.width-245, 105 + (20*i));
        ctx.textAlign = 'left';
        ctx.fillText(players[r].displayName, canvas.width-230, 105 + (20*i));
        ctx.textAlign = 'right';
        ctx.fillText(players[r].bounty, canvas.width-75, 105 + (20*i));
        ctx.fillText(players[r].kills, canvas.width-20, 105 + (20*i));
      }
    }
    if(!onLeaderboard){
      for(var i in rankings){
        var r = rankings[i];
        if(r != null && r == self.id){
          ctx.textAlign = 'right';
          ctx.fillStyle = '#00ffff';
          ctx.fillText(i+1, canvas.width-245, 105 + (20*5));
          ctx.textAlign = 'left';
          ctx.fillText(players[r].displayName, canvas.width-230, 105 + (20*5));
          ctx.textAlign = 'right';
          ctx.fillText(players[r].bounty, canvas.width-75, 105 + (20*5));
          ctx.fillText(players[r].kills, canvas.width-20, 105 + (20*5));
          break;
        }
      }
    }
    ctx.globalAlpha = 1;

    // ability cooldown and image
    if(s != null){
      // ability 1
      ctx.save();

      // image
      ctx.globalAlpha = 0.5;
      if(self.stealth) ctx.globalAlpha = 1;
      drawImg(s.abilityimage, canvas.width-308, canvas.height-28, 70);
      ctx.globalAlpha = 1;

      if(s.charges && self.abilitycd < 0){
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';

        // progress bar
        var ypos, height;
        if(self.abilitycd === (s.charges-1) * s.abilitycd){
          ypos = canvas.height-93;
          height = 72;
        } else {
          ypos = canvas.height-21 - ((((self.abilitycd % s.abilitycd) + s.abilitycd) % s.abilitycd) / s.abilitycd) * 72;
          height = ((((self.abilitycd % s.abilitycd) + s.abilitycd) % s.abilitycd) / s.abilitycd) * 72;
        }

        ctx.fillRect(canvas.width-373, ypos, 72, height);

        ctx.fillStyle = 'rgb(255, 255, 255)';
        if(self.abilitycd <= 0) ctx.fillText("x" + (Math.floor(-self.abilitycd / s.abilitycd)+1), canvas.width-308, canvas.height-73);

      }

      if(self.abilitycd <= 0 && self.ship !== 'ghost'){
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
      } else if(self.ship === 'ghost'){
        if(self.stealth){
          ctx.shadowBlur = 2;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
          self.abilitycd = 0;
        } else {
          self.abilitycd = 1;
        }
      }

      // text
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      ctx.font = '14px Share Tech Mono';
      ctx.fillStyle = 'rgb(255, 255, 255)';
      ctx.fillText(keyCodes[keymap['ability1']].toUpperCase(), canvas.width-308, canvas.height-28);

      // border
      ctx.strokeStyle = 'rgba(255, 255, 255, '+ (self.abilitycd <= 0 ? '1' : '0.5') + ')';
      ctx.strokeRect(canvas.width-374, canvas.height-94, 74, 74);

      ctx.shadowColor = 'transparent';
      if(!s.charges || self.abilitycd >= 0){
        // progress bar
        if(self.ship !== 'ghost'){
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          var ypos = self.stealth ? canvas.height-93 : canvas.height-21 - (self.abilitycd/s.abilitycd) * 72;
          var height = self.stealth ? 72 : (self.abilitycd/s.abilitycd) * 72;
          ctx.fillRect(canvas.width-373, ypos, 72, height);
        }
      }

      ctx.restore();
    }
  }
}
