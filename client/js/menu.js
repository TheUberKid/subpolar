var loggedIn = false;
var username;

var nav = document.getElementsByClassName("nav");
var menus = document.getElementsByClassName("display-menu");
var regNameInput = document.getElementById("register-name-input");
var regPassword = document.getElementById("register-password-input");
var regForm = document.getElementById("register-form");
var regNav = document.getElementById("register-form-nav");
var guestNameInput = document.getElementById("guest-name-input");
var guestForm = document.getElementById("guest-form");
var guestNav = document.getElementById("guest-form-nav");
var nuSubmit = document.getElementById("newuser-submit-button");
var nuError = document.getElementById("newuser-error");
var loginForm = document.getElementById("login-form");
var loginNameInput = document.getElementById("login-name-input");
var loginPassword = document.getElementById("login-password-input");
var loginSubmit = document.getElementById("login-submit-button");
var loginError = document.getElementById("login-error");
var joinButton = document.getElementById("join-button");

// navigation system
function navigate(e){
  var target = e.currentTarget == null ? e : e.currentTarget.dataset.target;
  var targetelm = document.getElementById(target);
  var curmenu = document.getElementsByClassName("current-menu")[0];
  if(curmenu) curmenu.className = "display-menu current-menu navigating-away";
  targetelm.className = "display-menu navigating-to";
  setTimeout(function(){
    var curmenu = document.getElementsByClassName("navigating-away")[0];
    var targetelm = document.getElementsByClassName("navigating-to")[0];
    targetelm.className = "display-menu current-menu";
    if(curmenu) curmenu.className = "display-menu";
    nuError.innerHTML = "";
    regNameInput.value = "";
    regPassword.value = "";
    guestNameInput.value = "";
    loginError.innerHTML = "";
    loginNameInput.value = "";
    loginPassword.value = "";
    regNav.className = "button selected";
    guestNav.className = "button";
    regForm.style.display = "inline-block";
    guestForm.style.display = "none";
  }, 200);
}

function loginSuccess(name, l){
  if(l) loggedIn = true;
  username = name;
  navigate("mainmenu");
  prlog("Successfully logged in as "+name);
  document.getElementById("username").innerHTML = name;
}

// 0 = register-form
// 1 = guest-form
var nuNavStatus = 0;

function initMenus(){
  for(var i=0, j=nav.length; i<j; i++){
    nav[i].addEventListener("click", navigate);
  }

  // new user form navigation
  regNav.addEventListener("click", function(){
    regNav.className = "button selected";
    guestNav.className = "button";
    regForm.style.display = "inline-block";
    guestForm.style.display = "none";
    nuError.innerHTML = "";
    nuNavStatus = 0;
  });
  guestNav.addEventListener("click", function(){
    regNav.className = "button";
    guestNav.className = "button selected";
    regForm.style.display = "none";
    guestForm.style.display = "inline-block";
    nuError.innerHTML = "";
    nuNavStatus = 1;
  });

  // registration
  nuSubmit.addEventListener("click", function(){
    if(nuNavStatus === 0){
      socket.emit("register", regNameInput.value, regPassword.value);
    }
    if(nuNavStatus === 1){
      socket.emit("guest", guestNameInput.value);
    }
    nuSubmit.innerHTML = "Checking...";
    nuError.innerHTML = "";
  });
  // login
  loginSubmit.addEventListener("click", function(){
    socket.emit("login", loginNameInput.value, loginPassword.value);
    loginSubmit.innerHTML = "Checking...";
    loginError.innerHTML = "";
  });

  socket.on('login-success', function(name, l){
    setTimeout(function(){
      loginSuccess(name, l);
      loginSubmit.innerHTML = "Verify";
      nuSubmit.innerHTML = "Continue";
    }, 250);
  });
  socket.on('login-error', function(err){
    setTimeout(function(){
      loginError.innerHTML = "Error: " + err;
      loginSubmit.innerHTML = "Verify";
    }, 250);
  });
  socket.on('nu-error', function(err){
    setTimeout(function(){
      nuError.innerHTML = "Error: " + err;
      nuSubmit.innerHTML = "Continue";
    }, 250);
  });

  // ship choices
  for(var i=0, j=shipChoices.length; i<j; i++){
    shipChoices[i].addEventListener("click", function(e){
      var self = e.currentTarget;
      shipChosen = self.dataset.name;
      document.getElementById("shipname").innerHTML = self.dataset.name;
      for(var k=0; k<j; k++){
        shipChoices[k].className = "ship-choice";
      }
      self.className = "ship-choice selected";
    });
  }

  for(var l=0, m=keyGuides.length; l<m; l++){
    keyGuides[l].innerHTML = keyCodes[keymap[keyGuides[l].dataset.action]];
    keyGuides[l].addEventListener("click", function(e){
      blur();
      var self = e.currentTarget;
      if(self.className === "keyguide"){
        for(var n=0; n<m; n++){
          keyGuides[n].innerHTML = keyCodes[keymap[keyGuides[n].dataset.action]];
          keyGuides[n].className = "keyguide";
        }
        self.className = "keyguide selectedkey";
        self.innerHTML = "press a key";
      } else {
        self.className = "keyguide";
        self.innerHTML = keyCodes[keymap[self.dataset.action]];
      }
    });
  }
  document.addEventListener("keydown", keychange);
  resetKeys.addEventListener("click", function(){
    keymap = defaultkeys;
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
  joinButton.addEventListener("click", function(){
    join();
  });
}
