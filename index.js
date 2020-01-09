/**
 * Passport LDAP authentication module
 */

const passport = require('passport')
const CustomStrategy = require('passport-custom').Strategy
const { authenticate } = require('ldap-authentication')

var _backwardCompatible =  false
var _dn
var _findFunc
var _insertFunc
var _loginUrl
var _logoutUrl
var _usernameAttributeName

/**
 * Set up ldap server information, callbacks, and express route.
 * 
 * @param {object|string} opt - if is an object, the options object to pass to ldapauth. if is a string, is ldap search base (backward compatible)
 *                              in opt object, literal `{{username}}` will be replaced with value in req.body.username
 * @param {string} ldapurl - ldap server url (if url is defined in opt, this will be ignored)
 * @param {object} router - express router
 * @param {function} findFunc - function(id) to find the user in local db by id
 * @param {function} insertFunc - function(user) to upsert user into local db
 * @param {string} [loginUrl] - path to login page. Default: /login
 * @param {string} [logoutUrl] - path to logout page. Default: /logout
 */
var init = function (opt, ldapurl, router, findFunc, insertFunc, loginUrl, logoutUrl) {
  if (typeof(opt) === 'string') {
    // backward compatible mode
    console.log('express-passport-ldap-mongoose: DeprecationWarning: calling init with DN string as first argument will be removed in a future version. Use an option object instead')
    _dn = opt
    _backwardCompatible = true
  }
  _router = router
  _findFunc = findFunc
  _insertFunc = insertFunc
  _loginUrl = loginUrl || '/login'
  _logoutUrl = logoutUrl || '/logout'
  _usernameAttributeName = ''
  
  passport.use('ldap', new CustomStrategy(async (req, done) => {
    try {
      if (!req.body.username || !req.body.password) {
        throw new Error('username and password must be both provided')
      }
      let username = req.body.username
      let password = req.body.password
      // construct the parameter to pass in authenticate() function
      let options
      if (_backwardCompatible) {
        _usernameAttributeName = 'uid'
        options = {
          ldapOpts: {
            url: ldapurl
          },
          userDn: `uid=${username},${_dn}`,
          userPassword: password,
          userSearchBase: _dn,
          usernameAttribute: 'uid',
          username: username
        }
      } else {
        _usernameAttributeName = opt.usernameAttribute
        options = {
          ldapOpts: opt.ldapOpts,
          userPassword: password,
          userSearchBase: opt.userSearchBase,
          usernameAttribute: _usernameAttributeName,
          username: username,
          starttls: opt.starttls
        }
        if (opt.userDn) {
          options.userDn = opt.userDn.replace('{{username}}', username)
        }
        if (opt.adminDn) {
          options.adminDn = opt.adminDn
        }
        if (opt.adminPassword) {
          options.adminPassword = opt.adminPassword
        }
      }
      // ldap authenticate the user
      let user = await authenticate(options)
      // success
      done(null, user)
    } catch (error) {
      // authentication failure
      done(error, null)
    }
  }))

  passport.serializeUser((user, done) => {
    if (user[_usernameAttributeName]) {
      done(null, user[_usernameAttributeName])
    } else {
      done('User from ldap server does not have field ' + _usernameAttributeName)
    }
  })
  
  passport.deserializeUser((id, done) => {
    _findFunc(id).then(user => {
      if (!user) {
        done(new Error(`Deserialize user failed. ${id} is deleted from local DB`))
      } else {
        done(null, user)
      }
    })
  })

  router.use(passport.initialize())
  router.use(passport.session())
  // error handling if deserialization failed (when user is deleted from db, but client still has user cookie, passport will fail all the time.)
  router.use((err, req, res, next) => {
    if (err) {
      req.logout();
      if (req.originalUrl == _loginUrl) {
        next(); // never redirect login page to itself
      } else {
        if (req.flash && typeof (req.flash) === "function") {
          req.flash("error", err.message);
        }
        res.redirect(_loginUrl);
      }
    } else {
      next();
    }
  })
  // login
  router.post(_loginUrl, login)
  router.get(_logoutUrl, function (req, res) {
    req.logout();
    res.redirect(_loginUrl);
  })
}


/**
 * Customized login authentication handler to send {success: true} 
 * on successful authenticate, or {success: false} on failed authenticate
 */
var login = function (req, res, next) {
  passport.authenticate('ldap', (err, user) => {
    if (err) {
      res.status(401).json({success: false, message: err.message})
      return
    }
    if (!user) {
      res.status(401).json({ success: false, message: 'User cannot be found' })
    } else {
      req.login(user, loginErr => {
        if (loginErr) {
          return next(loginErr);
        }
        _insertFunc(user).then(user => {
          var userObj = typeof(user.toObject) === "function" ? user.toObject(): user 
          return res.json({ success: true, message: 'authentication succeeded', user: userObj })
        })
      })
    }
  })(req, res, next)
}


module.exports.init = init
