const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

/**
 * Collection : clients
 * Entité distincte du Pro — aucune relation de schéma entre les deux.
 */
const clientSchema = new mongoose.Schema(
  {
    firstName : { type: String, required: true, trim: true },
    lastName  : { type: String, required: true, trim: true },
    email     : { type: String, required: true, unique: true, lowercase: true, trim: true },
    password  : { type: String, required: true, minlength: 8, select: false },
    phone      : { type: String, required: true, trim: true },
    postalCode : { type: String, default: null, trim: true, match: [/^(\d{5})?$/, 'Code postal invalide'] },
    avatar     : { type: String, default: null },
    birthdate  : { type: Date,   default: null },
    isActive  : { type: Boolean, default: true },

    // Parrainage
    referralUsed   : { type: String, default: null },  // code utilisé à l'inscription
    myReferralCode : { type: String, unique: true, sparse: true },

    // Fidélité — 9 RDV plein tarif, 10e = -50 % (1×/mois) ; cashback +1 € dès 25 €
    wallet: {
      cashback           : { type: Number, default: 0, min: 0, max: 30 },
      points             : { type: Number, default: 0 },
      prestationCount    : { type: Number, default: 0, min: 0, max: 9 },
      lastHalfPriceMonth : { type: String, default: null }
    },

    // Réseaux sociaux connectés (OAuth futur)
    socialLinks: {
      instagram : { type: String, default: null },
      facebook  : { type: String, default: null },
      google    : { type: String, default: null }
    }
  },
  {
    timestamps  : true,
    collection  : 'clients'
  }
)

clientSchema.pre('save', async function (next) {
  // Génération automatique du code parrainage si absent
  if (!this.myReferralCode) {
    this.myReferralCode = 'C7-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  }
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

clientSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

clientSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

module.exports = mongoose.model('Client', clientSchema)
