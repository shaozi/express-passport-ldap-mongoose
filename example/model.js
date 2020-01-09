let mongoose = require('mongoose')

///////////////////
let userSchema = mongoose.Schema(
  {
    // these fields are from ldap
    username: { type: String, lowercase: true },
    cn: { type: String},
    sn: { type: String},
    dn: {type: String},
    mail: { type: String, lowercase: true}
  },
  {
    timestamps: true
  }
)
let User = mongoose.model('User', userSchema)

module.exports.User = User