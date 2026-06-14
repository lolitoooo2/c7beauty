const mongoose = require('mongoose')

/**
 * Contrainte horaire Planity : sur une plage, seules certaines prestations
 * sont réservables pour un collaborateur.
 * Hors contrainte → toutes les prestations assignées au collab.
 */
const serviceConstraintSchema = new mongoose.Schema(
  {
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true,
      index    : true
    },
    collaboratorId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Collaborator',
      required : true,
      index    : true
    },
    label : { type: String, default: '', trim: true },
    color : { type: String, default: '#D1A1C7' },

    startTime : { type: String, required: true }, // "10:00"
    endTime   : { type: String, required: true }, // "19:00"

    repeatType : {
      type    : String,
      enum    : ['once', 'weekly'],
      default : 'weekly'
    },
    dayOfWeek : { type: Number, min: 0, max: 6, default: null }, // 0=lun … 6=dim

    startDate : { type: Date, default: null },
    endDate   : { type: Date, default: null },

    serviceIds : [{
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'Service'
    }]
  },
  {
    timestamps : true,
    collection : 'service_constraints'
  }
)

serviceConstraintSchema.index({ proId: 1, collaboratorId: 1 })

module.exports = mongoose.model('ServiceConstraint', serviceConstraintSchema)
