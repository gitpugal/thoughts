//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser= require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");

const app = express();

app.use(express.static("public"));
app.set("view engine", 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

//mongoose connection
mongoose.connect("mongodb://127.0.0.1:27017/userDB", {useNewUrlParser: true});

const userSchema = mongoose.Schema({
  email: String,
  password: String
});

userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});


const User = mongoose.model("User", userSchema);



app.get("/", function(req, res){
  res.render("home");
});

app.get("/login", function(req, res){
  res.render("login", {errormessage: ""});
});

app.get("/register", function(req, res){
  res.render("register");
});


//register code
app.post("/register", function(req, res){

  const newUser = new User({
    email: req.body.username,
    password: req.body.password
  });

  newUser.save(function(err){
    if(err){
      console.log(err);
    }else{
      res.render("secrets");
    }
  });
});

//login code

app.post("/login", function(req, res){
  const userName = req.body.username;
  const password = req.body.password;


  User.findOne({email: userName}, function(err, foundUser){
    if(foundUser){
      if (password === foundUser.password){
        res.render("secrets");
      }else{
        res.render("login");
      }
    }else{
      console.log(err);
    };
  });
});

//logout code
app.get("/logout", function(req, res){
  res.render("login");
});


app.listen(3000, function(){
  console.log("Server is running at port 3000....");
});
