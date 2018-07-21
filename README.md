# express-passport-ldap-mongoose

[![Build Status](https://travis-ci.org/shaozi/express-passport-ldap-mongoose.svg?branch=master)](https://travis-ci.org/shaozi/express-passport-ldap-mongoose)
[![Known Vulnerabilities](https://snyk.io/test/github/shaozi/express-passport-ldap-mongoose/badge.svg?targetFile=package.json)](https://snyk.io/test/github/shaozi/express-passport-ldap-mongoose?targetFile=package.json)

A library to use passport-ldapauth and local MongoDB to authenticate and save users

When an application needs to authenticate a user against an LDAP server, it normally also needs to
save the user into local MongoDB for further references. `express-passport-ldap-mongoose` is designed
to handle this requirement with a simple wrapper layer on top of expressjs, passportjs, passport-ldapauth,
and MongoDB.

## Requirement

* node Express
* Mongoose
* Passport
* Passport-ldapauth

## Installation

Using npm: `npm install --save express-passport-ldap-mongoose`

or using yarn: `yarn add express-passport-ldap-mongoose`

## Usage
`express-passport-ldap-mongoose` configures passportjs and adds the login and logout route to
your express app or router. All you need to do is call the `init` function of the library
and everything else is taken care of.

```javascript
const LdapAuth = require('express-passport-ldap-mongoose')
app.use(bodyParser.json())
app.use(sessionMiddleWare)
LdapAuth.init(dn, ldapurl, app, findUserFunc, upsertUserFunc, loginPath, logoutPath)
```
## MongoDB model
The `User` model in local MongoDB must have the `uid` key that maps to LDAP `uid` property. This
`uid` field is used to uniquely identify a user and is normally the user's login name.

## Parameters

* `dn`: The bind DN of LDAP server. Example: `dc=example.com,dc=com`
* `ldapurl`: URL of LDAP server. Example: `ldaps://ldap.example.com`, `ldap://ldap.example.com`
* `app`: Express app or router
* `findUserFunc`: `function(id)`. A function takes a string id and return a promise that resolves to a user or null. 
  This function is called everytime passport do deserialization. It is normally a `FindOne` or `FindById` call against
  local mongo database. Example: `(id) => {return User.findOne({ uid: id }).exec()}`
* `upsertUserFunc`: `function(user)`. A function take a user object (obtained from ldap server and saved in express `req`)
  and upsert into local database; returns a promise that resolves to a local db user object.
  Example: `(user) => {return User.findOneAndUpdate({ uid: user.uid }, user, { upsert: true, new: true }).exec()}`
* `loginPath`: (optional, default `/login`) The login path for express to parse the login posted json data. The posted data
  must be in json format, and with `username` and `password` as the key names. An `app.post(loginPath, loginHandler)` 
  will be automatically added and handled by the library.
* `logoutPath`: (optional, default `/logout`) The logout path for express to parse the logout request. An `app.get(logoutPath, logoutHandler)` 
  will be automatically added and handled by the library.

## Example
Complete example is at https://github.com/shaozi/express-passport-ldap-mongoose-example

```javascript
const mongoose = require('mongoose')
mongoose.Promise = Promise
mongoose.connect('mongodb://localhost/ldaptest')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)

const express = require('express')
const app = express()

const bodyParser = require('body-parser')
const User = require('./model').User

const LdapAuth = require('express-passport-ldap-mongoose')

var sessionMiddleWare = session({
  secret: 'top session secret',
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
LdapAuth.init(CONFIG.ldap.dn, CONFIG.ldap.url, app, (id) => {
  return User.findOne({ uid: id }).exec()
}, (user) => {
  return User.findOneAndUpdate({ uid: user.uid }, user, { upsert: true, new: true }).exec()
})

// serve static pages (where login.html resides)
app.use(express.static('public'))

// Start server
app.listen(4000, '127.0.0.1')

```
