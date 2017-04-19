'use strict';
console.log('Stop snooping you sneaky little monkey!');

// fps settings
var filterStrength = 20;
var frameTime = 0, lastLoop = new Date, thisLoop;

var unistep = 4;

// container settings
var canvas = document.getElementById('display');
var ctx = canvas.getContext('2d');
// canvas for preparing effects
var tctx = canvas.cloneNode().getContext('2d');

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

var images = [
  'warbird.png',
  'lancaster.png',
  'ghost.png',
  'aurora.png',
  'training-dummy.png',
  'smoke.png',
  'wall.png',
  'repel.png',
  'cloak.png',
  'bomb.png',
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
// alternate canvas images
function drawTctxImg(url, x, y, size, rotate, fn){
  var img = loadedImages['/client/img/' + url];
  if(rotate && rotate !== 0) img = rotateImg(img, rotate);
  if(fn || fn === 0){
    tctx.drawImage(img, img.height*fn, 0, img.height, img.height, x-(img.height)/2, y-(img.height)/2, size, size);
  } else {
    tctx.drawImage(img, x-(img.width)/2, y-(img.height)/2, size, size);
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
  joined: false,
  changeX: 0,
  changeY: 0,
  rotate: null
};

// this is called once all resources are loaded
function init(){
  socket = io();

  initMenus();
  initMaps();
  initShips();
  initProjectiles();
  initKeys();
  initChat();
  initParticles();

  socket.on('id', function(id, v){
    self.id = id;
    if(v) version = v;
    if(v) document.getElementById('version').innerHTML = v;
  });

  socket.on('update', function(ppos, spos, objectives, time, population, rankings){
    if(self.joined){
      ctx.clearRect(0, 0, canvas.width, canvas.height); // clear canvas
      tctx.clearRect(0, 0, canvas.width, canvas.height);
      update(ppos, spos);
      drawBackground();
      drawObjectives(objectives);
      drawSelf();
      drawProjectiles();
      drawParticles();
      if(mapdata) drawMap();
      drawLighting();
      drawPlayers();
      drawHUD(time, population, rankings, objectives);
      drawMinimap(objectives)
    }
  });
}
