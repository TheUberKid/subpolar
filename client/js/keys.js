function initKeys(){

  for(var l=0, m=keyGuides.length; l<m; l++){
    keyGuides[l].innerHTML = keyCodes[keymap[keyGuides[l].dataset.action]];
    keyGuides[l].addEventListener('click', function(e){
      blur();
      var self = e.currentTarget;
      if(self.className === 'keyguide'){
        for(var n=0; n<m; n++){
          keyGuides[n].innerHTML = keyCodes[keymap[keyGuides[n].dataset.action]];
          keyGuides[n].className = 'keyguide';
        }
        self.className = 'keyguide selectedkey';
        self.innerHTML = 'press a key';
      } else {
        self.className = 'keyguide';
        self.innerHTML = keyCodes[keymap[self.dataset.action]];
      }
    });
  }
  document.addEventListener('keydown', keychange);
  resetKeys.addEventListener('click', function(){
    keymap = JSON.parse(JSON.stringify(defaultkeys));
    blur();
    for(var i=0, j=keyGuides.length; i<j; i++){
      keyGuides[i].innerHTML = keyCodes[keymap[keyGuides[i].dataset.action]];
    }
    for(var key in keymap){
      if(keymap.hasOwnProperty(key)){
        delete_cookie(key);
      }
    }
  });

}

// key mappings
var defaultkeys = {
  'left' : 37,
  'up' : 38,
  'right' : 39,
  'down' : 40,
  'attack' : 68,
  'boost' : 16,
  'ability1' : 32,
  'chat' : 13,
  'minimap' : 9,
  'leave' : 27,
  'strafeleft': 81,
  'straferight': 69
};
var keymap = {
  'left' : parseInt(read_cookie('left')) || defaultkeys['left'],
  'up' : parseInt(read_cookie('up')) || defaultkeys['up'],
  'right' : parseInt(read_cookie('right')) || defaultkeys['right'],
  'down' : parseInt(read_cookie('down')) || defaultkeys['down'],
  'attack' : parseInt(read_cookie('attack')) || defaultkeys['attack'],
  'boost' : parseInt(read_cookie('boost')) || defaultkeys['boost'],
  'ability1' : parseInt(read_cookie('ability1')) || defaultkeys['ability1'],
  'chat' : parseInt(read_cookie('chat')) || defaultkeys['chat'],
  'minimap' : parseInt(read_cookie('minimap')) || defaultkeys['minimap'],
  'leave' : parseInt(read_cookie('leave')) || defaultkeys['leave'],
  'strafeleft' : parseInt(read_cookie('strafeleft')) || defaultkeys['strafeleft'],
  'straferight' : parseInt(read_cookie('straferight')) || defaultkeys['straferight']
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

// key events
function keydown(e){
  if(e.ctrlKey || e.which == 9){
    e.preventDefault();
    e.stopPropagation();
  }
  keys[getKeyByValue(keymap, e.which)] = true;
  socket.emit('keydown', getKeyByValue(keymap, e.which));
}
function keyup(e){
  keys[getKeyByValue(keymap, e.which)] = false;
  socket.emit('keyup', getKeyByValue(keymap, e.which));
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
