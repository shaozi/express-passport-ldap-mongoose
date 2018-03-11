# express-passport-ldap-mongoose
A library to use passport-ldapauth and local MongoDB to authenticate and save users

### Requirement

* node Express
* Mongoose
* Passport
* Passport-ldapauth

## Usage

```
const mongoose = require('mongoose')
mongoose.Promise = Promise
mongoose.connect(CONFIG.dburl, {
  useMongoClient: true
  /* other options */
})
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)

const assert = require('assert')
const express = require("express")
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server, { path: `${apiPath}/socket.io` })
const bodyParser = require('body-parser')
const uuid = require('uuid/v1')
const fs = require('fs')
const spawn = require('child_process').spawn
const winston = require('winston')
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, { 'timestamp': true })
const User = require('../model/model').User


const LdapAuth = require('express-passport-ldap-mongoose')

var sessionMiddleWare = session({
  secret: CONFIG.sessionSecret,
  store: new MongoStore({ mongooseConnection: mongoose.connection }),
  resave: true,
  saveUninitialized: true,
  unset: 'destroy',
  cookie: {
    httpOnly: false,
    maxAge: 1000 * 3600 * 24,
    secure: false, // this need to be false if https is not used. Otherwise, cookie will not be sent.
  }
})


const router = express.Router()


// The order of the following middleware is very important!!
router.use(bodyParser.json())
router.use(sessionMiddleWare)
LdapAuth.init(CONFIG.ldap.dn, CONFIG.ldap.url, router, (id, done) => {
  User.findOne({ uid: id }).exec()
    .then(user => {
      if (!user) {
        done(new Error(`Deserialize user failed. ${id} is deleted from local DB`))
      } else {
        done(null, user)
      }
    })
}, (user, res) => {
  User.findOneAndUpdate({ uid: user.uid }, user, { upsert: true, new: true }).exec()
    .then(user => {
      return res.json({ success: true, message: 'authentication succeeded', user: user.toObject() });
    })
})

function ensureAuthenticated(req, res, next) {
  if (!req.user) {
    res.status(401).json({ success: false, message: "not logged in" })
  } else {
    next()
  }
}

// all api need authentication
router.all('/api/*', ensureAuthenticated)

```
