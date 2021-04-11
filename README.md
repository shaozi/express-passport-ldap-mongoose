# express-passport-ldap-mongoose

[![Build Status](https://travis-ci.org/shaozi/express-passport-ldap-mongoose.svg?branch=master)](https://travis-ci.org/shaozi/express-passport-ldap-mongoose)
[![Known Vulnerabilities](https://snyk.io/test/github/shaozi/express-passport-ldap-mongoose/badge.svg?targetFile=package.json)](https://snyk.io/test/github/shaozi/express-passport-ldap-mongoose?targetFile=package.json)

A turn key library that uses [ldap-authentication](https://github.com/shaozi/ldap-authentication)
with Passport and local database (MongoDB) to authenticate and save users

When an application needs to authenticate a user against an LDAP server, it normally also needs to
save the user into local MongoDB for further references. `express-passport-ldap-mongoose` is designed
to handle this requirement with a simple wrapper layer on top of expressjs, passportjs,
[ldap-authentication](https://github.com/shaozi/ldap-authentication),
and MongoDB.

## Requirements

* node Express
* Mongoose (optional)
* Passport
* [ldap-authentication](https://github.com/shaozi/ldap-authentication)
* The login submit field names should be `username` for username, and `password` for password

## Installation

Using npm: `npm install --save express-passport-ldap-mongoose`

or using yarn: `yarn add express-passport-ldap-mongoose`

## Usage

`express-passport-ldap-mongoose` configures passportjs and adds the login and logout route to
your express app or router. All you need to do is call the `initialize` function of the library
and everything else is taken care of.


```javascript
const LdapAuth = require('express-passport-ldap-mongoose')
app.use(express.json())
app.use(sessionMiddleWare)
LdapAuth.initialize(options, app, findUserFunc, upsertUserFunc, loginPath, logoutPath)
```


> Since version 3.1.0, you can still use `init()` but it is deprecated. 
Use `initialize()` instead which is simpler.

## MongoDB model

When search for a user by its username in LDAP, a `usernameAttribute` is needed.
The `User` model in local MongoDB must have the same key as the value of `usernameAttribute`
that maps to the LDAP attribute. In some cases, and in the example we are using `uid`.
it is used to uniquely identify a user and equals to the user's login username.

## Parameters

* `options`: If the first parameter is an object,
             it is the options object to pass to `ldap-authentication`'s `authenticate()` function.
             If is a string (deprecated), is the ldap search base (for backward compatible)
             If options is an object, literal `{{username}}` in the `userDn` will be replaced with the value in
             `req.body.username` which will be the user input username.
             See [ldap-authentication](https://github.com/shaozi/ldap-authentication) for detail explanation on each options.

   String Example (deprecated): `dc=example.com,dc=com`

   Options object Example:

   ```javascript
   let options = {
        ldapOpts: {
          url: 'ldap://localhost'
        },
        // note in this example it only use the user to directly
        // bind to the LDAP server. You can also use an admin
        // here. See the document of ldap-authentication.
        userDn: `uid=${req.body.username},${ldapBaseDn}`,
        userPassword: req.body.password,
        userSearchBase: ldapBaseDn,
        usernameAttribute: 'uid',
        username: req.body.username
      }
   ```

* `app`: Express app or router
* `findUserFunc`: `function(id)`. A function takes a string id and return a promise that resolves to a user or null.
  This function is called everytime passport do deserialization. It is normally a `FindOne` or `FindById` call against
  local mongo database. Example: `(id) => {return User.findOne({ uid: id }).exec()}`. However, it does not have to be
  any database related. It is just a functin that can return a user from a user id.
* `upsertUserFunc`: `function(user)`. A function take a user object (obtained from ldap server and saved in express `req`)
  and upsert into local database; returns a promise that resolves to a local db user object. Again, it does not have to
  be any database related. It is essentially a function that update some internal record of a user.
  Example: `(user) => {return User.findOneAndUpdate({ uid: user.uid }, user, { upsert: true, new: true }).exec()}`
* `loginPath`: (optional, default `/login`) The login path for express to parse the login posted json data. The posted data
  must be in json format, and with `username` and `password` as the key names. An `app.post(loginPath, loginHandler)`
  will be automatically added and handled by the library.
* `logoutPath`: (optional, default `/logout`) The logout path for express to parse the logout request. An `app.get(logoutPath, logoutHandler)`
  will be automatically added and handled by the library.

## Example

Complete example is in the example folder.

Another example on how to use Passport and [ldap-authentication](https://github.com/shaozi/ldap-authentication) can be found in [passport-ldap-example](https://github.com/shaozi/passport-ldap-example).

```javascript
const mongoose = require('mongoose')
mongoose.Promise = Promise
mongoose.connect('mongodb://localhost/ldaptest')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)

const express = require('express')
const app = express()

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
app.use(express.json())
app.use(sessionMiddleWare)
// use the library express-passport-ldap-mongoose
let usernameAttributeName = 'uid'
LdapAuth.initialize({
    ldapOpts: {
      url: 'ldap://localhost'
    },
    // note in this example it only use the user to directly
    // bind to the LDAP server. You can also use an admin
    // here. See the document of ldap-authentication.
    userDn: `uid={{username}},${ldapBaseDn}`,
    userSearchBase: ldapBaseDn,
    usernameAttribute: usernameAttributeName
  }, 
  app, 
  (id) => {
    return User.findOne({ usernameAttributeName: id }).exec()
  }, (user) => {
    return User.findOneAndUpdate({ username: user[usernameAttributeName] }, user, { upsert: true, new: true }).exec()
  })

// serve static pages (where login.html resides)
app.use(express.static('public'))

// Start server
app.listen(4000, '127.0.0.1')

```
