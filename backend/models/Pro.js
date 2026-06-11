const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

/**
 * Collection : pros
 * Entité distincte du Client — aucune relation de schéma entre les deux.
 */
const proSchema = new mongoose.Schema(
  {
    // ── Identité ──────────────────────────────────
    firstName : { type: String, required: true, trim: true },
    lastName  : { type: String, required: true, trim: true },
    email     : { type: String, required: true, unique: true, lowercase: true, trim: true },
    password  : { type: String, required: true, minlength: 8, select: false },
    phone     : { type: String, required: true, trim: true },
    avatar    : { type: String, default: null },
    isActive  : { type: Boolean, default: false }, // inactif jusqu'à validation KYC

    // ── Établissement ─────────────────────────────
    salonName  : { type: String, required: true, trim: true },
    siret      : { type: String, required: true, trim: true, match: /^\d{14}$/ },
    address    : { type: String, required: true, trim: true },
    postalCode : { type: String, required: true, trim: true, match: /^\d{5}$/ },
    city       : { type: String, required: true, trim: true },
    categories : [{ type: String }],  // ['coiffure', 'ongles', ...]

    // Géolocalisation (futur déplacement type Uber)
    location: {
      type        : { type: String, enum: ['Point'], default: 'Point' },
      coordinates : { type: [Number], default: [0, 0] }   // [lng, lat]
    },

    // ── KYC ──────────────────────────────────────
    kyc: {
      kbisUrl   : { type: String, default: null },
      idCardUrl : { type: String, default: null },
      status    : {
        type    : String,
        enum    : ['pending', 'approved', 'rejected'],
        default : 'pending'
      },
      reviewedAt  : { type: Date, default: null },
      rejectReason: { type: String, default: null }
    },

    // ── Financier ─────────────────────────────────
    iban : { type: String, default: null, select: false },

    // Solde à reverser (versement J+10)
    pendingPayout : { type: Number, default: 0 },
    totalEarnings : { type: Number, default: 0 },

    // ── Abonnement ────────────────────────────────
    subscription: {
      plan      : { type: String, enum: ['free', 'premium'], default: 'free' },
      expiresAt : { type: Date, default: null }
    },

    // ── Stats ─────────────────────────────────────
    stats: {
      reservationCount : { type: Number, default: 0 },
      averageRating    : { type: Number, default: 0 },
      reviewCount      : { type: Number, default: 0 }
    },

    // ── Photos du salon (max 5) ───────────────────
    // Le premier élément est toujours la photo principale (devanture)
    shopPhotos : { type: [String], default: [], validate: [v => v.length <= 5, '5 photos maximum.'] },

    // ── Réseau social ────────────────────────────
    socialLinks: {
      instagram : { type: String, default: null },
      facebook  : { type: String, default: null },
      tiktok    : { type: String, default: null }
    }
  },
  {
    timestamps : true,
    collection : 'pros'
  }
)

// Index géospatial pour le matching Uber-style
proSchema.index({ location: '2dsphere' })

proSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

proSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

proSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.iban
  return obj
}

module.exports = mongoose.model('Pro', proSchema)
