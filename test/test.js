const request = require('supertest');
const auth = require('../index.js')

const session = require('express-session')
const express = require('express')
const app = express()

const bodyParser = require('body-parser')

var sessionMiddleWare = session({
    secret: "test",
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

app.get('/login', (req, res) => {
    res.json({ success: true })
})

// a simple array to store user objects
var User = []
function findUserById(id) {
    return new Promise((resolve, reject) => {
        return resolve(User.find(u => { return u.uid === id }))
    })
}
function upsertUser(user) {
    return new Promise((resolve, reject) => {
        var existingUser = User.find(u => {
            return u.uid === user.uid
        })
        if (!existingUser) User.push(user)
        return resolve(user)
    })
}

let userOptions = {
    ldapOpts: {
        url: 'ldap://ldap.forumsys.com'
    },
    userDn: `uid={{username}},dc=example,dc=com`,
    userSearchBase: 'dc=example,dc=com',
    usernameAttribute: 'uid'
}

auth.init(userOptions, '', app,
    findUserById, upsertUser
)

describe('Test ldap authenticate', () => {
    test('It should response the GET method', () => {
        return request(app).get("/login").then(response => {
            expect(response.statusCode).toBe(200)
        })
    })
    test('It should response the POST method', () => {
        return request(app).post("/login").then(response => {
            expect(response.statusCode).toBe(401)
            expect(response.body.success).toBeFalsy()
            expect(response.body.message).toEqual("username and password must be both provided")
        })
    })
    test('invalid username/password result', () => {
        return request(app).post("/login")
            .type('json')
            .send({ username: 'gauss', password: 'bbb' })
            .then(response => {
                expect(response.statusCode).toBe(401)
                expect(response.body.success).toBeFalsy()
                expect(response.body.message).toEqual("Invalid Credentials")
                expect(response.body.user).toBeUndefined()
                user = User.find(u => { return u.username === "gauss" })
                expect(user).toBeUndefined()
            })
    })
    test('correct username/password result', () => {
        return request(app).post("/login")
            .type('json')
            .send({ username: 'gauss', password: 'password' })
            .then(response => {
                expect(response.statusCode).toBe(200)
                expect(response.body.success).toBeTruthy()
                expect(response.body.message).toBe('authentication succeeded')
                expect(response.body.user.uid).toBe('gauss')
                user = User.find(u => { return u.uid === "gauss" })
                expect(user).toBeDefined()
            })
    })

})