const request = require('supertest')
const auth = require('../index.js')

const session = require('express-session')
const express = require('express')
const app = express()

var sessionMiddleWare = session({
  secret: 'test',
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

app.get('/login', (req, res) => {
  res.json({ success: true })
})

// a simple array to store user objects
var User = []
async function findUserById(id) {
  return User.find((u) => u.uid === id)
}
async function upsertUser(user) {
  let existingUser = User.find((u) => u.uid === user.uid)
  if (!existingUser) User.push(user)
  return user
}

let userOptions = {
  ldapOpts: {
    url: 'ldap://ldap.forumsys.com',
  },
  userDn: `uid={{username}},dc=example,dc=com`,
  userSearchBase: 'dc=example,dc=com',
  usernameAttribute: 'uid',
}

auth.initialize(userOptions, app, findUserById, upsertUser)

describe('Test ldap authenticate', () => {
  it('It should response the GET method', async () => {
    let response = await request(app).get('/login')
    expect(response.statusCode).toBe(200)
  })
  it('It should response the POST method', async () => {
    let response = await request(app).post('/login')
    expect(response.statusCode).toBe(401)
    expect(response.body.success).toBeFalsy()
    expect(response.body.message).toEqual(
      'username and password must be both provided'
    )
  })
  it('invalid username/password result', async () => {
    let response = await request(app)
      .post('/login')
      .type('json')
      .send({ username: 'gauss', password: 'bbb' })
    expect(response.statusCode).toBe(401)
    expect(response.body.success).toBeFalsy()
    expect(response.body.message).toEqual('Invalid Credentials')
    expect(response.body.user).toBeUndefined()
    let user = User.find((u) => {
      return u.username === 'gauss'
    })
    expect(user).toBeUndefined()
  })
  it('correct username/password result', async () => {
    let response = await request(app)
      .post('/login')
      .type('json')
      .send({ username: 'gauss', password: 'password' })

    expect(response.statusCode).toBe(200)
    expect(response.body.success).toBeTruthy()
    expect(response.body.message).toBe('authentication succeeded')
    expect(response.body.user.uid).toBe('gauss')
    let user = User.find((u) => {
      return u.uid === 'gauss'
    })
    expect(user).toBeDefined()
  })
})
