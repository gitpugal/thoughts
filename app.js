//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser= require("body-parser");
const ejs = require("ejs");
const encrypt = require("mongoose-encryption");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const nodemailer = require("nodemailer");

const app = express();

app.use(express.static("public"));
app.set("view engine", 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

//passport
app.use(session({
  secret: "thisissecrettext",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
//mongoose connection

// mongoose.set("useCreateIndex", true);

const userSchema = mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: [
    {secretText: String,
      like: Number,
      likedUsers: [String],
  }
],
   verified: Boolean,
   otp: String

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
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));



app.get("/", function(req, res){
  res.render("home");
});

app.get("/submit", function(req, res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });


app.get("/login", function(req, res){
  res.render("login",{errormessage: ""});
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/verify", function(req, res){


res.render("verify", {errormessage: ''});


});

app.get("/secrets", function(req, res){
  if (req.isAuthenticated()){
    if(User.find({secret: {$ne : null}}, function(err, foundUsers){
      // var list = {"you": 100, "me": 75, "foo": 116, "bar": 15};
// keysSorted = Object.keys(foundUsers).sort(function(a,b){return list[a]-list[b]})
// console.log(keysSorted);
      res.render("secrets", {userWithSecrets: foundUsers});
    }));

  }else{
    res.redirect("/login");
  }
});



//verify code

app.post("/verify", function(req, res){

  const email = req.body.username;
  const otp = req.body.otp;
  console.log(email, otp);

  User.findOne({username: email}, function(err, foundUser){
    if(foundUser.otp === otp){

      User.findOneAndUpdate({username: email},{verified: true}, function(err,doc){
        if(!err){
          res.render("login", {errormessage: "Your email has been verified now!, kindly log in."});
        }
      })
    }else{
      res.render("verify", { errormessage: 'wrong otp try again...'})
    }
  });
});


//register code
app.post("/register", function(req, res){



  User.register({username: req.body.username}, req.body.password1, function(err, user){
    if(err){
      console.log(err);
      res.redirect("/register");
    }else{


      passport.authenticate("local")(req, res, function(){
          const otp =Math.floor(1000+ Math.random() * 9000);
        user.secret.like= 0;
        user.verified=false;
        user.otp=otp;
        user.save(function(err){
          if(err){
            console.log(err);
          }
        });

        //sendingmail
        console.log("sending mail1");




          const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
          auth: {
            user: "pugalarasan2014@gmail.com",
            pass: process.env.SMTPPASS,
          },
        });
          let message = {
            from: "pugalarasan2014@gmail.com", // sender address
            to: req.body.username, // list of receivers
            subject: "otp from secrets", // Subject line
            text: "otp"+otp , // plain text body
            html: "This is your one-time password(otp)" + otp, // html body
          };
          transporter.sendMail(message, (err, info) => {
            console.log("sending mail...");
                 if (err) {
                     console.log('Error occurred. ' + err.message);
                 }

                 console.log('Message sent: %s', info);
                 // Preview only available when sending through an Ethereal account
                 console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
             });
        res.redirect("/verify");
      });
    }
  });


});

//login code

app.post("/login", function(req, res){


    const   username= req.body.username;
    const  password= req.body.password;


User.findOne({username: req.body.username}, function(err, foundUser){
  console.log(foundUser);
  if(!foundUser){
    res.render("login" ,{errormessage: "no user found"})
  }else{
    if(!foundUser.verified){
      res.redirect("/verify")
    }else{


    const user = new User({
      username: req.body.username,
      password: req.body.password
    });

    req.login(user, function(err){
      if (err) {
        res.render("login", {errormessage: "Wrong credentials!"});
      } else {
        passport.authenticate("local", { failureRedirect: '/login', failureMessage: true })(req, res, function(err){
          if(err){
            res.render("login", {errormessage: "Wrong credentials!"});
          }else{

          }
          res.redirect("/secrets");
        });
      }
    });



      }
  }

  }
);


  // req.login(user, function(err){
  //   if(err){
  //       console.log("err error");
  //     console.log(err);
  //   }else{
  //     passport.authenticate("local",{ successRedirect:'/secrets',failureRedirect: '/login' })(req, res, function(err, foundUser){
  //       // if(foundUser){
  //       //   console.log("foundUser error");
  //       //   console.log("login sucess");
  //       //   res.redirect("/secrets");
  //       // };
  //       // if(!foundUser){
  //       //   console.log("not foundUser error");
  //       //   res.render("login");
  //       // }
  //
  //     });
  //   }
  // })
});

////////submitting secret code/////////////

app.post("/submit", function(req, res){
  const secret = req.body.secret;
  const newSecret = {
    secretText: secret,
    like: 0,
    likedUsers:[]
  };
  User.findById(req.user._id, function(err, foundUser){
    if(err){
      console.log(err);
    }else{
      foundUser.secret.push(newSecret);
      foundUser.save(function(err){
        if(err){
          console.log(err);
        }else{
          res.redirect("/secrets")
        }
      })
    }
  })
})

///////////like updating code/////////////////////
// app.post("/like", function(req, res){
//   const likes = req.body.like;
//   User.findById(req.user._id, function(err, foundUser){
//     if(err){
//       console.log(err);
//     }else{
//       foundUser.like = likes;
//       foundUser.save(function(err){
//         if(err){
//           console.log(err);
//         }else{
//           if(User.find({secrets: {$ne : null}}, function(err, foundUsers){
//             res.render("secrets", {userWithSecrets: foundUsers});
//           }));
//         }
//       });
//     }
//   });
// });

app.post("/like", function(req, res){
  const userid = req.body.userid;
  const likes = req.body.like;
  const secretindex = req.body.secretindex;
  const likedUser = req.user.id;
  User.findById(userid, function(err, foundUser){
    const allusers = foundUser.secret[secretindex].likedUsers;


let flag = false;
    allusers.forEach(function(user){
      if(user === likedUser ){

        flag = true;
      }
    });

if(flag === true){
res.redirect("/secrets")
}else{
  foundUser.secret[secretindex].like = likes;
  foundUser.secret[secretindex].likedUsers.push(likedUser);
  foundUser.save(function(err){
    if(err){
      console.log(err);
    }else{
      if(User.find({secrets: {$ne : null}}, function(err, foundUsers){
        res.render("secrets", {userWithSecrets: foundUsers});
      }));
    }
  });

}

  });

});

//logout code
app.get("/logout", function(req, res){
  req.logout(function(err){
    if(err){
      console.log(err);
    }
  });
  res.redirect("/");
});

mongoose.connect("mongodb+srv://pugalarasan:"+process.env.PASSWORD+"@cluster1.gtxc1qt.mongodb.net/userDB", {useNewUrlParser: true});

app.listen(3000, function(){
  console.log("Server is running at port 3000....");
});
