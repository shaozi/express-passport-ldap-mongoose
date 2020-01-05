/* jshint node:true */
/* global require */

const CONFIG = require('./config.js')
const mongoose = require('mongoose')
mongoose.Promise = Promise
mongoose.connect(CONFIG.dburl, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false
})
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)

const express = require('express')
const app = express()

const bodyParser = require('body-parser')
const User = require('./model').User

const LdapAuth = require('../index')

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

// The order of the following middleware is very important!!
app.use(bodyParser.json())
app.use(sessionMiddleWare)
// use the library express-passport-ldap-mongoose
LdapAuth.init(CONFIG.ldap.dn, CONFIG.ldap.url, app, 
  (id) => User.findOne({ uid: id }).exec(), 
  (user) => User.findOneAndUpdate({ uid: user.uid }, user, { upsert: true, new: true }).exec()
)

// serve static pages
app.use(express.static('public'))


// Start server
app.listen(4000, '127.0.0.1')