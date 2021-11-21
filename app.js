//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const { log } = require("console");
const { EDESTADDRREQ } = require("constants");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-raman:"+process.env.PASSWORD+"@cluster0.glsbi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority")
// mongoose.connect("mongodb://localhost:27017/userDB");


const userSchema = new mongoose.Schema ({
    email: String,
    admin: String,
    password: String,
    googleId: String,
    secret: String
}); 

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });
  

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate("google", {scope: ["profile"]})
);

app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    User.find({"secret": {$ne:null}}, function(err, foundUsers){
        if(err) console.log(err);
        else{
            if(foundUsers){
                console.log(foundUsers);
                // console.log(foundUsers.admin);
                res.render("secrets", {usersWithSecrets: foundUsers})
            }
        }
    });
});

app.get("/unautherized", function(req, res){
    res.render("unautherized");
});

app.get("/submit", function(req, res){
    
    console.log("inside get"+currentAdmin);
    if(req.isAuthenticated() && currentAdmin == "on"){
        res.render("submit");
    }
    else if(req.isAuthenticated() && currentAdmin == "off"){
        res.redirect("/unautherized");
    }
    else{
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
    User.findById(req.user.id, function(err, foundUser){
        if(err) console.log(err);
        else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets");
                });
            }
        }
    })
});

app.get("/logout", function(req, res){
    req.logOut();
    res.redirect("/");
});

app.post("/register", function(req, res){
    var admin1;
    if(req.body.admin == null){
        admin1 = "off";
    }
    else admin1 = req.body.admin;
    User.register({username: req.body.username, admin: admin1}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });

});

let currentAdmin;

app.post("/login", function(req, res){
    
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    // console.log("inside post -> "+currentAdmin);

    req.login(user, function(err){
        if(err) console.log(err);
        else{
            passport.authenticate("local")(req, res, function(){
                currentAdmin = req.user.admin;
                res.redirect("/secrets");
            });
        }
    });

});

let port = process.env.PORT;
if(port == null || port == ""){
  port = 3000;
}

app.listen(port, function() {
  console.log("Server has started successfully");
});

