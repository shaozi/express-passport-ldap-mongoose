/**
 * Passport LDAP authentication module
 */

const passport = require('passport')
const LdapStrategy = require('passport-ldapauth')

var _dn
var _ldapurl
var _findFunc
var _insertFunc
var _loginUrl
var _logoutUrl
var _router

/**
 * Set up ldap server information, callbacks, and express route.
 * 
 * @param {string} dn - ldap dn
 * @param {string} ldapurl - ldap server url
 * @param {object} router - express router
 * @param {function} findFunc - function(id) to find the user in local db by id
 * @param {function} insertFunc - function(user) to upsert user into local db
 * @param {string} [loginUrl] - path to login page. Default: /login
 * @param {string} [logoutUrl] - path to logout page. Default: /logout
 */
var init = function (dn, ldapurl, router, findFunc, insertFunc, loginUrl, logoutUrl) {
  _dn = dn
  _ldapurl = ldapurl
  _router = router
  _findFunc = findFunc
  _insertFunc = insertFunc
  _loginUrl = loginUrl || '/login'
  _logoutUrl = logoutUrl || '/logout'

  passport.use(new LdapStrategy((req, callback) => {
    // Fetching things from database or whatever
    // use x-www-form-urlencoded to fill in username and password
    // req should be already urlencodedParser ed. body
    // should be filled with username and password.
    process.nextTick(() => {
      var opts = {
        server: {
          url: _ldapurl,
          bindDn: `uid=${req.body.username},${_dn}`,
          bindCredentials: `${req.body.password}`,
          searchBase: _dn,
          searchFilter: `uid=${req.body.username}`,
          reconnect: true
        }
      }
      callback(null, opts)
    })
  },
    (user, done) => {
      return done(null, user)
    }))

  passport.serializeUser((user, done) => {
    done(null, user.uid)
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
  passport.authenticate('ldapauth', (err, user, info) => {
    if (err) {
      return next(err)
    }
    if (!user) {
      res.status(401).json({ success: false, message: info.message })
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
