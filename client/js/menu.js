var loggedIn = false;
var username;

// HTML object references
var nav = document.getElementsByClassName('nav');
var menus = document.getElementsByClassName('display-menu');
var menuModules = document.getElementsByClassName('menu-tab-module');
var regNameInput = document.getElementById('register-name-input');
var regPassword = document.getElementById('register-password-input');
var regForm = document.getElementById('register-form');
var regNav = document.getElementById('register-form-nav');
var guestNameInput = document.getElementById('guest-name-input');
var guestForm = document.getElementById('guest-form');
var guestNav = document.getElementById('guest-form-nav');
var nuSubmit = document.getElementById('newuser-submit-button');
var nuError = document.getElementById('newuser-error');
var loginForm = document.getElementById('login-form');
var loginNameInput = document.getElementById('login-name-input');
var loginPassword = document.getElementById('login-password-input');
var loginSubmit = document.getElementById('login-submit-button');
var loginError = document.getElementById('login-error');
var joinButton = document.getElementById('join-button');
var logoutButton = document.getElementById('logout-button');
var tabs = document.getElementsByClassName('menu-tab');
var keyGuides = document.getElementsByClassName('keyguide');
var resetKeys = document.getElementById('reset-controls');
var shipChoices = document.getElementsByClassName('ship-choice');
var shipChosen = 'warbird';
var zoneChosen = 'extreme games';

// navigation status for new user menu
// 0 = register-form
// 1 = guest-form
var nuNavStatus = 0;

function initMenus(){
  // add listeners to navigation buttons
  for(var i=0, j=nav.length; i<j; i++){
    nav[i].addEventListener('click', navigate);
  }
  // add listeners to menu tabs
  for(var i=0, j=tabs.length; i<j; i++){
    tabs[i].addEventListener('click', function(e){
      var zone = e.currentTarget.dataset.zone;
      for(var i=0, j=tabs.length; i<j; i++){
        tabs[i].className = 'menu-tab';
      }
      e.currentTarget.className = 'menu-tab selected';
      document.getElementById('zone-name').innerHTML = zone;
      zoneChosen = zone;

      // convert menu modules to css format
      var relevantMenuModules = document.getElementsByClassName(zone.replace(/\s+/g, '-'));
      // show relevant menu modules for the currently selected menu
      for(var i=0, j=menuModules.length; i<j; i++) menuModules[i].style.display = 'none';
      for(var i=0, j=relevantMenuModules.length; i<j; i++) relevantMenuModules[i].style.display = 'block';

    });
  }

  // make sure events trigger for the default selected tab
  document.getElementById('default-menu-tab').click();

  // new user form navigation - when a 'tab' is pressed, the option should switch to that menu
  // either registration or guest login
  regNav.addEventListener('click', function(){
    regNav.className = 'button selected';
    guestNav.className = 'button';
    regForm.style.display = 'inline-block';
    guestForm.style.display = 'none';
    nuError.innerHTML = '';
    nuNavStatus = 0;
  });
  guestNav.addEventListener('click', function(){
    regNav.className = 'button';
    guestNav.className = 'button selected';
    regForm.style.display = 'none';
    guestForm.style.display = 'inline-block';
    nuError.innerHTML = '';
    nuNavStatus = 1;
  });

  // send the server registration info
  nuSubmit.addEventListener('click', function(){
    if(nuNavStatus === 0){
      socket.emit('register', regNameInput.value, regPassword.value);
    }
    if(nuNavStatus === 1){
      socket.emit('guest', guestNameInput.value);
    }
    nuSubmit.innerHTML = 'Checking...';
    nuError.innerHTML = '';
  });
  // send the server login info
  loginSubmit.addEventListener('click', function(){
    socket.emit('login', loginNameInput.value, loginPassword.value);
    loginSubmit.innerHTML = 'Checking...';
    loginError.innerHTML = '';
  });

  // store received session token as cookie
  socket.on('session', function(token){
    bake_cookie('session', token);
  });
  // if session cookie exists, send it to the server
  var token = read_cookie('session');
  if(token.length > 0){
    navigate('sessionloading');
    socket.emit('session', token);
  }
  // if server returns that the cookie is invalid, delete the cookie
  socket.on('session-error', function(){
    delete_cookie('session');
    prlog('session error');
  });

  // if the server returns login success (either through session, login, or registration)
  socket.on('login-success', function(name, loginBool, newuserBool){
    setTimeout(function(){
      loginSuccess(name, loginBool, newuserBool);
      loginSubmit.innerHTML = 'Verify';
      nuSubmit.innerHTML = 'Continue';
    }, 250);
  });
  // report an error to the login page if the login failed
  socket.on('login-error', function(err){
    setTimeout(function(){
      loginError.innerHTML = 'Error: ' + err;
      loginSubmit.innerHTML = 'Verify';
    }, 250);
  });
  // report an error to the new user page if registration / guest login failed
  socket.on('nu-error', function(err){
    setTimeout(function(){
      nuError.innerHTML = 'Error: ' + err;
      nuSubmit.innerHTML = 'Continue';
    }, 250);
  });
  // reset menus and destroy cookies on logout
  socket.on('logout-success', function(){
    logoutButton.innerHTML = '...';
    setTimeout(function(){
      loggedIn = false;
      username = '';
      navigate('landing');
      prlog('Successfully logged out');
    }, 250);
    setTimeout(function(){
      logoutButton.innerHTML = 'logout';
      document.getElementById('username').innerHTML = 'Guest';
    }, 500);
    delete_cookie('session');
    nuNavStatus = 0;
  });

  // event listeners to join a zone or logout
  joinButton.addEventListener('click', function(){
    join();
  });
  logoutButton.addEventListener('click', function(){
    socket.emit('logout');
  });

  // when a player leaves a game (can be forced by server or default key esc)
  socket.on('leave', function(){
    document.addEventListener('keydown', keychange);
    self.joined = false;
    document.body.style.backgroundColor = 'none';

    // return to the main menu
    navigate('mainmenu');
    document.getElementById('background').style.display = 'block';

    // get rid of in-game key events
    canvas.removeEventListener('keydown', keydown);
    document.removeEventListener('keydown', docKeydown);
    canvas.removeEventListener('keyup', keyup);
    document.getElementById('display').style.display = 'none';

    // reset variables to default values
    for(var key in keys){
      keys[key] = false;
    }
    self.rotate = null;
    mapdata = [];
    projectiles = [];
    trails = [];
    repels = [];
    ripples = [];
    thrusters = [];
    stars = [];
    chat.messages = [];
    chat.notices = [];
    chat.announcement = {
      text: '',
      lifetime: 0,
      sent: 0,
      color: 'transparent'
    };

    // clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

// navigation system
function navigate(e){
  // this is triggered when a navigation button is pressed.
  // e can either be a reference to the button that was pressed by the event listener or a specifically declared value
  var target = e.currentTarget == null ? e : e.currentTarget.dataset.target;
  var targetelm = document.getElementById(target);
  var curmenu = document.getElementsByClassName('current-menu')[0];
  if(curmenu) curmenu.className = 'display-menu current-menu navigating-away';
  targetelm.className = 'display-menu navigating-to';
  // the second half is done at a delay for a fade-in-out animation (regulated by css classes)
  setTimeout(function(){
    var curmenu = document.getElementsByClassName('navigating-away')[0];
    var targetelm = document.getElementsByClassName('navigating-to')[0];
    targetelm.className = 'display-menu current-menu';
    if(curmenu) curmenu.className = 'display-menu';
    // make sure all values are emptied
    nuError.innerHTML = '';
    regNameInput.value = '';
    regPassword.value = '';
    guestNameInput.value = '';
    loginError.innerHTML = '';
    loginNameInput.value = '';
    loginPassword.value = '';
    regNav.className = 'button selected';
    guestNav.className = 'button';
    regForm.style.display = 'inline-block';
    guestForm.style.display = 'none';
  }, 200);
}

// if a user successfully logs in, redirect them to the main menu and record information
function loginSuccess(name, loginBool, newuserBool){
  loginBool ? loggedIn = true : logoutButton.innerHTML = 'leave';
  username = name;
  navigate('mainmenu');
  prlog('Successfully logged in as '+name);
  document.getElementById('username').innerHTML = name;
  if(newuserBool) tabs[0].click();
}

// called when a player joins a zone
function join(){
  document.removeEventListener('keydown', keychange);
  self.joined = true;
  socket.emit('join', shipChosen, zoneChosen);
  self.ship = shipChosen;
  document.body.style.backgroundColor = '#222';
  document.getElementById('background').style.display = 'none';

  // hide everything else
  var n = document.getElementsByClassName('display-menu')
  for(var i=0, j=n.length; i<j; i++){
    n[i].className = 'display-menu';
  }
  document.getElementById('background').style.display = 'none';

  // add in-game key events
  canvas.addEventListener('keydown', keydown);
  document.addEventListener('keydown', docKeydown);
  canvas.addEventListener('keyup', keyup);
  canvas.style.display = 'block';
  canvas.focus();

  // generate the star background
  stars = [];
  var amount = canvas.width * canvas.height / 10000;
  for(var i=0; i<amount; i++){
    var newStar = new Star(
      Math.round(Math.random()*(canvas.width+20))-10,
      Math.round(Math.random()*(canvas.height+20))-10,
      Math.round(Math.random()*5),
      Math.round(Math.random()*3)+4
    );
    stars.push(newStar);
  }
}
