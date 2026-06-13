const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

/**
 * Collection : collaborators
 * Membre d'équipe d'un salon (Pro). Peut avoir un accès login (dashboard agenda).
 */
const collaboratorSchema = new mongoose.Schema(
  {
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true,
      index    : true
    },

    firstName : { type: String, required: true, trim: true },
    lastName  : { type: String, required: true, trim: true },
    email     : { type: String, required: true, lowercase: true, trim: true },
    password  : { type: String, minlength: 8, select: false, default: null },
    photo     : { type: String, default: null },

    isOwner   : { type: Boolean, default: false },
    canLogin  : { type: Boolean, default: true },

    serviceIds : [{
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'Service'
    }],

    active : { type: Boolean, default: true },
    order  : { type: Number, default: 0 },

    accountStatus : {
      type    : String,
      enum    : ['pending', 'active', 'disabled'],
      default : 'pending'
    },

    inviteToken      : { type: String, default: null, select: false },
    inviteExpiresAt  : { type: Date, default: null, select: false },
    inviteAcceptedAt : { type: Date, default: null }
  },
  {
    timestamps : true,
    collection : 'collaborators'
  }
)

collaboratorSchema.index({ email: 1 }, { unique: true })
collaboratorSchema.index({ proId: 1, isOwner: 1 })
collaboratorSchema.index({ inviteToken: 1 }, { sparse: true })

collaboratorSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

collaboratorSchema.methods.comparePassword = function (plain) {
  if (!this.password) return Promise.resolve(false)
  return bcrypt.compare(plain, this.password)
}

collaboratorSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.inviteToken
  delete obj.inviteExpiresAt
  return obj
}

module.exports = mongoose.model('Collaborator', collaboratorSchema)
