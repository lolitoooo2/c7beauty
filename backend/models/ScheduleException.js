const mongoose = require('mongoose')

const timeSlotSchema = new mongoose.Schema(
  {
    start : { type: String, required: true },
    end   : { type: String, required: true }
  },
  { _id: false }
)

/**
 * Exception ponctuelle ou sur plage : fermeture, horaires spéciaux, prestations indispo.
 */
const scheduleExceptionSchema = new mongoose.Schema(
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
    startDate : { type: Date, required: true },
    endDate   : { type: Date, required: true },
    type      : {
      type    : String,
      enum    : ['closed', 'custom_hours', 'services_unavailable'],
      default : 'closed'
    },
    slots      : { type: [timeSlotSchema], default: [] },
    serviceIds : [{
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'Service'
    }],
    label : { type: String, default: '', trim: true }
  },
  {
    timestamps : true,
    collection : 'schedule_exceptions'
  }
)

scheduleExceptionSchema.index({ proId: 1, startDate: 1, endDate: 1 })

module.exports = mongoose.model('ScheduleException', scheduleExceptionSchema)
