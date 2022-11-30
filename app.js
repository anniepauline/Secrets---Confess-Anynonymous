//jshint esversion:6
require('dotenv').config();// for environment variable
const express = require('express');
const bodyParser = require('body-Parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')
const app = express();


app.use(express.static('public'));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
  extended:true
}));

//initialize session
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
}));

//initialize passport and  manage the sessions
app.use(passport.initialize());
app.use(passport.session());

//connection
mongoose.connect('mongodb://0.0.0.0/userDB',{useNewUrlParser:true});


//user schema object created from mongoose schema class
const userSchema = new mongoose.Schema({
  email:String,
  password:String,
  googleId:String,
  secret:String
});

//userSchema to use passportlocalmongoose as a plugin
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// new user model
const User = new mongoose.model('User',userSchema);

passport.use(User.createStrategy());

//stuffs users identification into the cookie
passport.serializeUser(function(user,done){
  done(null,user.id);
});
passport.deserializeUser(function(id,done){
  User.findById(id,function(err,user){
      done(null,user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//render home page
app.get('/',function(req,res){
  res.render('home');
});

//sign up with google
app.get('/auth/google',
  passport.authenticate('google',{ scope: ["profile"] })
);

//if successful auth, redirect secret page
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
  });


app.get('/login',function(req,res){
  res.render('login');
});

app.get('/logout',function(req,res){
  req.logout(function(err){
    if(err){console.log(err);}
    else{  res.redirect('/');}
  });
});

app.get('/register',function(req,res){
  res.render('register');
});

app.get('/secrets',function(req,res){
//render al documents that contain a secret field
User.find({"secret":{$ne:null}},function(err,foundUsers){
  if(!err)
  {
    if(foundUsers)
    res.render('secrets',{usersWithSecrets:foundUsers});
  }
  else{
    console.log(err);
  }
});
});


app.post('/register',function(req,res){
  User.register({username:req.body.username}, req.body.password, function(err,user){
    if(err){
      console.log(err);
      res.redirect('/register');
    //authenticate user using passport
  }else{
      passport.authenticate('local')(req,res,function(){
      res.redirect('/secrets');
      });
    }
  });
});

//login authentication
app.post('/login',function(req,res){
  const user = new User({
    username:req.body.username,
    password:req.body.password
  });

  //using passport to login and authenticate user
  req.login(user,function(err){
    if(err) {console.log(err) ;}
    else{
      passport.authenticate('local')(req,res,function(){
        res.redirect('/secrets');
      });
    }
});
});

//suthenticating submit page
app.get('/submit',function(req,res){
if(req.isAuthenticated()){
      res.render('submit');
} else {
    res.redirect('/login');
}
});

//post user submit eesponse into database
app.post('/submit',function(req,res){
  const submittedSecret = req.body.secret;
    User.findById(req.user.id,function(err,foundUser){
      if(err){console.log(err);}
      else {
          if(foundUser)
            {
              foundUser.secret = submittedSecret;
              foundUser.save(function(){
                res.redirect('/secrets');
              });
            }
        }
    });
});



app.listen(3000,function(){
  console.log('Server started on port 3000');
});
