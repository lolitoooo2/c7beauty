const mongoose = require('mongoose')

const timeSlotSchema = new mongoose.Schema(
  {
    start : { type: String, required: true },
    end   : { type: String, required: true }
  },
  { _id: false }
)

const daySchema = new mongoose.Schema(
  {
    dayOfWeek : { type: Number, required: true, min: 0, max: 6 },
    isOpen    : { type: Boolean, default: true },
    slots     : { type: [timeSlotSchema], default: [] }
  },
  { _id: false }
)

/**
 * Période avec horaires différents (ex. été, mois spécifique).
 */
const schedulePeriodSchema = new mongoose.Schema(
  {
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true,
      index    : true
    },
    collaboratorId : {
      type    : mongoose.Schema.Types.ObjectId,
      ref     : 'Collaborator',
      default : null
    },
    label     : { type: String, required: true, trim: true },
    validFrom : { type: Date, required: true },
    validTo   : { type: Date, required: true },
    days      : { type: [daySchema], default: [] }
  },
  {
    timestamps : true,
    collection : 'schedule_periods'
  }
)

schedulePeriodSchema.index({ proId: 1, validFrom: 1, validTo: 1 })

module.exports = mongoose.model('SchedulePeriod', schedulePeriodSchema)
