const mongoose = require('mongoose')

/** Réservation temporaire (~10 min) pour éviter les doubles clics. */
const slotHoldSchema = new mongoose.Schema(
  {
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true,
      index    : true
    },
    serviceId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Service',
      required : true
    },
    collaboratorId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Collaborator',
      required : true,
      index    : true
    },
    clientId : {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'Client',
      default : null
    },

    start : { type: Date, required: true },
    end   : { type: Date, required: true },

    expiresAt : { type: Date, required: true }
  },
  {
    timestamps : true,
    collection : 'slot_holds'
  }
)

slotHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('SlotHold', slotHoldSchema)
