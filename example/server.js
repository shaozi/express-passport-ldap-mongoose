/* jshint node:true */
/* global require */

const CONFIG = require('./config.js')
const mongoose = require('mongoose')
mongoose.Promise = Promise
mongoose.connect(CONFIG.dburl, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false,
})
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)

const express = require('express')
const app = express()

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
  },
})

// The order of the following middleware is very important!!
app.use(express.json())
app.use(sessionMiddleWare)
// use the library express-passport-ldap-mongoose
// backward compatible mode
/*LdapAuth.init(CONFIG.ldap.dn, CONFIG.ldap.url, app, 
  (id) => User.findOne({ uid: id }).exec(), 
  (user) => User.findOneAndUpdate({ uid: user.uid }, user, { upsert: true, new: true }).exec()
)*/

// new mode, simple user
let usernameAttr = 'uid'
let searchBase = CONFIG.ldap.dn
let options = {
  ldapOpts: {
    url: CONFIG.ldap.url,
  },
  userDn: `uid={{username}},${CONFIG.ldap.dn}`,
  userSearchBase: searchBase,
  usernameAttribute: usernameAttr,
}
let admOptions = {
  ldapOpts: {
    url: CONFIG.ldap.url,
    //tlsOptions: { rejectUnauthorized: false }
  },
  adminDn: `cn=read-only-admin,dc=example,dc=com`,
  adminPassword: 'password',
  userSearchBase: searchBase,
  usernameAttribute: usernameAttr,
  //starttls: true
}
let userOptions = {
  ldapOpts: {
    url: CONFIG.ldap.url,
    //tlsOptions: { rejectUnauthorized: false }
  },
  userDn: `uid={{username}},dc=example,dc=com`,
  userSearchBase: searchBase,
  usernameAttribute: usernameAttr,
  //starttls: true
}
LdapAuth.initialize(
  userOptions,
  app,
  (id) => User.findOne({ username: id }).exec(),
  (user) => {
    console.log(`${user[usernameAttr]} has logged in`)
    return User.findOneAndUpdate({ username: user[usernameAttr] }, user, {
      upsert: true,
      new: true,
    }).exec()
  }
)

// serve static pages
app.use(express.static('public'))

// Start server
let port = 4000
console.log(`server listen on port ${port}`)
app.listen(port, '127.0.0.1')
