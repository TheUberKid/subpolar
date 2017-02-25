'use strict';
console.log('Stop snooping you sneaky little monkey!');

// fps settings
var filterStrength = 20;
var frameTime = 0, lastLoop = new Date, thisLoop;

var unistep = 4;
function prlog(t){
  console.log('Polarity > ' + t);
}

String.prototype.replaceAt = function(index, character){
  return this.substr(0, index) + character + this.substr(index+character.length);
}
Object.prototype.getKeyByValue = function(value){
  for(var prop in this){
    if( this.hasOwnProperty(prop)){
      if(this[prop] === value) return prop;
    }
  }
}
function bake_cookie(name, value) {
  document.cookie = name + '=' + value;
}
function read_cookie(name) {
  var name = name + '=';
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
}
function delete_cookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// container settings
var canvas = document.getElementById('display');
var chat = {
  input: document.getElementById('chat-input'),
  wrapper: document.getElementById('chat-wrapper'),
  open: false,
  messages: [],
  announcements: [],
}
var ctx = canvas.getContext('2d');

// get maximum possible size for canvas while maintining aspect ratio
function resizeEventHandler(){
  var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  if(w/canvas.width > h/canvas.height){
    canvas.style.width = 'calc('+canvas.width+' / '+canvas.height+' * 100vh)';
    canvas.style.height = '100vh';
    chat.wrapper.style.width = 'calc('+canvas.width+' / '+canvas.height+' * 100vh - 40px)';
    chat.wrapper.style.height = 'calc(100vh - 40px)';
  } else {
    canvas.style.width = '100vw';
    canvas.style.height = 'calc('+canvas.height+' / '+canvas.width+' * 100vw)';
    chat.wrapper.style.width = 'calc(100vw - 40px)';
    chat.wrapper.style.height = 'calc('+canvas.height+' / '+canvas.width+' * 100vw - 40px)';
  }
}
resizeEventHandler();
window.addEventListener('resize', resizeEventHandler);

var radians = Math.PI/180, thrusteralt = 1;
// key mappings
var defaultkeys = {
  'left' : 37,
  'up' : 38,
  'right' : 39,
  'down' : 40,
  'attack' : 68,
  'boost' : 16,
  'ability1' : 32,
  'ability2' : 83,
  'chat' : 13,
  'leave' : 27
};
var keymap = {
  'left' : parseInt(read_cookie('left')) || defaultkeys['left'],
  'up' : parseInt(read_cookie('up')) || defaultkeys['up'],
  'right' : parseInt(read_cookie('right')) || defaultkeys['right'],
  'down' : parseInt(read_cookie('down')) || defaultkeys['down'],
  'attack' : parseInt(read_cookie('attack')) || defaultkeys['attack'],
  'boost' : parseInt(read_cookie('boost')) || defaultkeys['boost'],
  'ability1' : parseInt(read_cookie('ability1')) || defaultkeys['ability1'],
  'ability2' : parseInt(read_cookie('ability2')) || defaultkeys['ability2'],
  'chat' : parseInt(read_cookie('chat')) || defaultkeys['chat'],
  'leave' : parseInt(read_cookie('leave')) || defaultkeys['leave'],
};
var keyCodes = {
  3 : 'break',
  8 : 'backspace',
  9 : 'tab',
  12 : 'clear',
  13 : 'enter',
  16 : 'shift',
  17 : 'ctrl',
  18 : 'alt',
  19 : 'break',
  20 : 'capslock',
  27 : 'esc',
  32 : 'space',
  33 : 'pgup',
  34 : 'pgdown',
  35 : 'end',
  36 : 'home',
  37 : 'left',
  38 : 'up',
  39 : 'right',
  40 : 'down',
  41 : 'select',
  42 : 'print',
  43 : 'exe',
  44 : 'printscreen',
  45 : 'insert',
  46 : 'delete',
  48 : '0',
  49 : '1',
  50 : '2',
  51 : '3',
  52 : '4',
  53 : '5',
  54 : '6',
  55 : '7',
  56 : '8',
  57 : '9',
  58 : ':',
  60 : '<',
  65 : 'a',
  66 : 'b',
  67 : 'c',
  68 : 'd',
  69 : 'e',
  70 : 'f',
  71 : 'g',
  72 : 'h',
  73 : 'i',
  74 : 'j',
  75 : 'k',
  76 : 'l',
  77 : 'm',
  78 : 'n',
  79 : 'o',
  80 : 'p',
  81 : 'q',
  82 : 'r',
  83 : 's',
  84 : 't',
  85 : 'u',
  86 : 'v',
  87 : 'w',
  88 : 'x',
  89 : 'y',
  90 : 'z',
  91 : 'left⌘',
  92 : 'right⌘',
  93 : 'right⌘',
  96 : 'n0',
  97 : 'n1',
  98 : 'n2',
  99 : 'n3',
  100 : 'n4',
  101 : 'n5',
  102 : 'n6',
  103 : 'n7',
  104 : 'n8',
  105 : 'n9',
  106 : 'multiply',
  107 : 'add',
  109 : 'subtract',
  110 : 'decimal',
  111 : 'divide',
  112 : 'f1',
  113 : 'f2',
  114 : 'f3',
  115 : 'f4',
  116 : 'f5',
  117 : 'f6',
  118 : 'f7',
  119 : 'f8',
  120 : 'f9',
  121 : 'f10',
  122 : 'f11',
  123 : 'f12',
  124 : 'f13',
  125 : 'f14',
  126 : 'f15',
  127 : 'f16',
  128 : 'f17',
  129 : 'f18',
  130 : 'f19',
  131 : 'f20',
  132 : 'f21',
  133 : 'f22',
  134 : 'f23',
  135 : 'f24',
  144 : 'numlock',
  145 : 'scrolllock',
  160 : '^',
  161: '!',
  163 : '#',
  164: '$',
  170: '*',
  186 : 'semicolon',
  187 : 'equal',
  188 : 'comma',
  189 : 'dash',
  190 : 'period',
  191 : '/',
  219 : '[',
  220 : '\\',
  221 : ']',
  222 : 'quote',
  223 : '`',
};
var keys = []; // key logging

var images = [
  'falcon.png',
  'lancaster.png',
  'ghost.png',
  'aurora.png',
  'smoke.png',
  'wall.png'
];
var loadedImages = {};
var promiseArray = images.map(function(imgurl){
   var prom = new Promise(function(resolve,reject){
       var img = new Image();
       imgurl = '/client/img/' + imgurl;
       prlog('Retreiving Graphics: '+imgurl);
       img.onload = function(){
           loadedImages[imgurl] = img;
           resolve();
       };
       img.src = imgurl;
   });
   return prom;
});
promiseArray.push(
  new Promise(function(resolve, reject){
		if (document.readyState === 'complete') {
			resolve(document);
		} else {
			document.addEventListener('DOMContentLoaded', function(){
			  resolve(document);
		  });
    }
  }
));
Promise.all(promiseArray).then(init);
var rotateImg = function(img, rotate) {
  var offscreenCanvas = document.createElement('canvas');
  var offscreenCtx = offscreenCanvas.getContext('2d');
  var size = Math.max(img.width, img.height);
  offscreenCanvas.width = size;
  offscreenCanvas.height = size;
  offscreenCtx.translate(size/2, size/2);
  offscreenCtx.rotate(rotate * radians);
  offscreenCtx.drawImage(img, -(img.width/2), -(img.height/2));
  return offscreenCanvas;
}
function drawImg(url, x, y, size, rotate, fn){
  var img = loadedImages['/client/img/' + url];
  if(rotate && rotate !== 0) img = rotateImg(img, rotate);
  if(fn || fn === 0){
    ctx.drawImage(img, img.height*fn, 0, img.height, img.height, x-(img.height)/2, y-(img.height)/2, size, size);
  } else {
    ctx.drawImage(img, x-(img.width)/2, y-(img.height)/2, size, size);
  }
}
function drawCircle(x, y, radius, fillcolor, strokecolor, strokewidth){
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = fillcolor;
  ctx.fill();
  if(strokecolor != null){
    ctx.strokeStyle = strokecolor;
    ctx.lineWidth = strokewidth;
    ctx.stroke();
  }
}

var socket;
var version;

var self = {
  joined: false
};
var mapdata = [];
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
    abilitycd: 200,
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

// thruster particle effect
var thrusters = [];
var Thruster = function(x, y, rotate){
  this.x = x;
  this.y = y;
  this.rotate = rotate;
  this.frame = 0;
}

// Client-side projectile constructor
var projectiles = [];
var projectileTemplates = {
  'falconShot': {
    color: 'rgb(255, 255, 255)',
    size: 1,
    lifetime: 10
  },
  'lancasterShot': {
    color: 'rgb(255, 255, 150)',
    size: 1,
    lifetime: 7
  },
  'lancasterBomb': {
    color: 'rgb(255, 100, 50)',
    size: 4,
    lifetime: 10
  },
  'ghostShot': {
    color: 'rgb(175, 255, 175)',
    size: 1,
    lifetime: 7
  },
  'ghostAmbushShot': {
    color: 'rgb(255, 255, 255)',
    size: 1,
    lifetime: 7
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
var Projectile = function(id, x, y, x_velocity, y_velocity, type, lifetime, bounce, origin){
  this.id = id;
  this.x = x;
  this.y = y;
  this.x_velocity = x_velocity;
  this.y_velocity = y_velocity;
  this.type = type;
  this.lifetime = lifetime;
  this.bounce = bounce;
  this.origin = origin;
}

// Trails!
var trails = [];
var Trail = function(x, y, size, color, lifetime){
  this.x = x;
  this.y = y;
  this.size = size;
  this.color = color;
  this.lifetime = lifetime;
  this.scale = 100/lifetime;
}
// Repels!
var repels = [];
var Repel = function(x, y){
  this.x = x;
  this.y = y;
  this.lifetime = 15;
}

// key events
function keydown(e){
  if(e.ctrlKey){
    e.preventDefault();
    e.stopPropagation();
  }
  keys[keymap.getKeyByValue(e.which)] = true;
  socket.emit('keydown', keymap.getKeyByValue(e.which));
}
function keyup(e){
  keys[keymap.getKeyByValue(e.which)] = false;
  socket.emit('keyup', keymap.getKeyByValue(e.which));
}
// chat key events
function docKeydown(e){
  if(e.which === keymap['chat']){
    if(!chat.open){
      chat.open = true;
      chat.input.style.display = 'flex';
      chat.input.focus();
      chat.input.value = '';
    } else {
      chat.open = false;
      chat.input.style.display = 'none';
      socket.emit('submitMessage', chat.input.value);
      chat.input.value = '';
      canvas.focus();
    }
  }
}
// used to change a keymap
function keychange(e){
  var selectedkey = document.getElementsByClassName('selectedkey')[0];
  if(selectedkey){
    blur();
    selectedkey.innerHTML = keyCodes[e.which];
    keymap[selectedkey.dataset.action] = e.which;
    selectedkey.className = 'keyguide';
    bake_cookie(selectedkey.dataset.action, e.which);
  }
}

// used when joining the game
function join(){
  document.removeEventListener('keydown', keychange);
  self.joined = true;
  socket.emit('join', shipChosen, zoneChosen);
  self.ship = shipChosen;
  document.body.style.backgroundColor = '#222';
  document.getElementById('background').style.display = 'none';

  var n = document.getElementsByClassName('display-menu')
  for(var i=0, j=n.length; i<j; i++){
    n[i].className = 'display-menu';
  }
  document.getElementById('background').style.display = 'none';

  // key events
  canvas.addEventListener('keydown', keydown);
  document.addEventListener('keydown', docKeydown);
  canvas.addEventListener('keyup', keyup);
  canvas.style.display = 'block';
  canvas.focus();
}

var shipChoices = document.getElementsByClassName('ship-choice');
var keyGuides = document.getElementsByClassName('keyguide');
var resetKeys = document.getElementById('reset-controls');
var shipChosen = 'falcon';
var zoneChosen = 'extreme games';
var ppos, deathtimer;
// this is called once all resources are loaded
function init(){
  socket = io();

  initMenus();

  socket.on('leave', function(){
    document.addEventListener('keydown', keychange);
    self.joined = false;
    document.body.style.backgroundColor = 'none';

    navigate('mainmenu');
    document.getElementById('background').style.display = 'block';

    // key events
    canvas.removeEventListener('keydown', keydown);
    document.removeEventListener('keydown', docKeydown);
    canvas.removeEventListener('keyup', keyup);
    document.getElementById('display').style.display = 'none';

    // reset to defaults
    for(var key in keys){
      keys[key] = false;
    }
    self.rotate = null;
    mapdata = [];
    projectiles = [];
    chat.messages = [];

  });

  socket.on('id', function(id, v){
    self.id = id;
    if(v) version = v;
    if(v) document.getElementById('version').innerHTML = v;
  });
  socket.on('map', function(d, m){
    mapdata = d;
    self.map = m;
  });

  socket.on('update', function(pp, objectives, time, players, rankings){
    ppos = pp;
    if(self.joined){
      ctx.clearRect(0, 0, canvas.width, canvas.height); // clear canvas
      for(var i in ppos){
        var p = ppos[i];
        if(p.id === self.id){
          self.x = p.x;
          self.y = p.y;
          self.team = p.team;
          if(self.rotate == null) self.rotate = p.rotate;
          if(Math.abs(p.rotate - self.rotate) > 1 && Math.abs((p.rotate-360) - self.rotate) > 1 && Math.abs(p.rotate - (self.rotate-360)) > 1){
            var arr = [Math.abs(p.rotate-self.rotate), Math.abs((p.rotate-360)-self.rotate), Math.abs(p.rotate-(self.rotate-360))];
            var parr = [p.rotate-self.rotate, (p.rotate-360)-self.rotate, p.rotate-(self.rotate-360)];
            var min = Math.min.apply(null, arr), // find the closest match in arr and return its index
                pos = arr.indexOf(min);
            self.rotate += 0.2 * parr[pos];
          }
          self.death = p.death;
          self.energy = p.energy;
          self.abilitycd = p.abilitycd;
          self.ship = p.ship;
          self.stealth = p.stealth;
        }
      }
      drawObjectives(objectives);
      drawSelf();
      drawThrusters();
      drawProjectiles();
      drawRepels();
      if(mapdata) drawMap();
      drawTrails();
      drawPlayers(ppos);
      drawHUD(ppos, time, players, rankings);
    }
  });

  socket.on('projectile', function(p){
    projectiles.push(new Projectile(p.id, p.x, p.y, p.x_velocity, p.y_velocity, p.type, p.lifetime, p.bounce, p.origin));
  });
  socket.on('projectileHit', function(id, px, py){
    for(var i in projectiles){
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
      }
    }
  });
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

  // repels
  socket.on('repel', function(x, y){
    repels.push(new Repel(x, y));
  });
  // when a player dies
  socket.on('playerDeath', function(px, py, killer, killed){
    // temporary death animation
    var p0 = ppos[killer];
    var p1 = ppos[killed];
    if(p1.id == self.id){
      deathtimer = new Date().getTime();
    }
    for(var i=0; i<15; i++){
      thrusters.push(new Thruster(px+(Math.round(Math.random()*10)-5), py+(Math.round(Math.random()*10)-5), Math.round(Math.random()*360)));
    }
    for(var i=0; i<10; i++){
      thrusters.push(new Thruster(px+(Math.round(Math.random()*10)-5), py+(Math.round(Math.random()*10)-5), Math.round(Math.random()*360)));
    }
    chat.messages.push(['kill', p1.displayName, p0.displayName])
  });

  // when a bomb explodes
  socket.on('explosion', function(ex, ey){
    for(var i=0; i<25; i++){
      thrusters.push(new Thruster(ex+(Math.round(Math.random()*10)-5), ey+(Math.round(Math.random()*10)-5), Math.round(Math.random()*360)));
    }
  });

  // when a message is received, add it to messages array and splice old entries
  socket.on('newMessage', function(n, m){
    chat.messages.push(['chat', n, m]);
    if(chat.messages.length > 30) chat.messages.splice(0, 1);
  });
  socket.on('newTeamMessage', function(n, m){
    chat.messages.push(['teamchat', n, m]);
    if(chat.messages.length > 30) chat.messages.splice(0, 1);
  });
  socket.on('newAnnouncement', function(m){
    for(var i=0, j=chat.announcements.length; i<j; i++){
      var a = chat.announcements[i];
      if(a == null){
        chat.announcements[i] = m;
        break;
      } else if(i === chat.announcements.length-1){
        chat.announcements[chat.announcements.length] = m;
      }
    }
    if(chat.announcements.length === 0){
      chat.announcements[0] = m;
    }
    console.log(chat.announcements);
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

function drawThrusters(){
  for(var i = thrusters.length-1; i > -1; i--){ // iterate backwards to splice thruster particles
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
}
function drawRepels(){
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

function drawHUD(ppos, time, players, rankings){
  var s = ships[self.ship];
  // minimap
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(canvas.width - 270, canvas.height - 270, 250, 250);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  for(var r = Math.round(self.y/16)-62, j=Math.round(self.y/16)+62; r<j; r++){
    for(var c = Math.round(self.x/16)-62, k=Math.round(self.x/16)+62; c<k; c++){
      if(mapdata[r] && mapdata[r][c] && mapdata[r][c] != 0) ctx.strokeRect(canvas.width - 145 + c*2 - self.x/8, canvas.height - 145 + r*2 - self.y/8, 1, 1);
    }
  }
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

  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.strokeRect(canvas.width - 270, canvas.height - 270, 250, 250);

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
  for(var i in chat.announcements){
    var a = chat.announcements[i];
    ctx.fillStyle = a.color;
    ctx.globalAlpha = Math.min(0.5, a.lifetime/100);
    ctx.fillText(a.text, canvas.width/2, canvas.height - 200 + (i*20));
    a.lifetime--;
    if(a.lifetime <= 0) delete chat.announcements[i];
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

// update projectiles
function drawProjectiles(){
  for(var i in projectiles){
    var p = projectiles[i];
    var pt = projectileTemplates[p.type];
    var diffx = p.x - self.x;
    var diffy = p.y - self.y;
    for(var j = 0; j < unistep; j++){
      if(Math.abs(diffx) < canvas.width+8 && Math.abs(diffy) < canvas.height+8 && p.lifetime > 0){
        var trailstep = Math.round(Math.sqrt((p.x_velocity/100)*(p.x_velocity/100) + (p.y_velocity/100)*(p.y_velocity/100)) / (pt.size/2))+1;
        for(var k = 0, l = Math.ceil(trailstep*1.5/unistep); k<l; k++){
          var t = new Trail(p.x - k*(p.x_velocity/(l*100)), p.y - k*(p.y_velocity/(l*100)), pt.size, pt.color, pt.lifetime - (1 / l * k));
          trails.push(t);
        }
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
  }
}

// NOTE: Trail lifetimes are counted as less than a normal lifetime measurement.
// This is because they dont need to be step-checked per frame like other objects.
// as such a trail lifetime is simply the number of frames it exists
function drawTrails(){
  for(var i in trails){
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
