const mongoose = require('mongoose')

const timeSlotSchema = new mongoose.Schema(
  {
    start : { type: String, required: true }, // "09:00"
    end   : { type: String, required: true }  // "19:00"
  },
  { _id: false }
)

const daySchema = new mongoose.Schema(
  {
    dayOfWeek : { type: Number, required: true, min: 0, max: 6 }, // 0=lundi … 6=dimanche
    isOpen    : { type: Boolean, default: true },
    slots     : { type: [timeSlotSchema], default: [] }
  },
  { _id: false }
)

/**
 * Semaine type d'ouverture (salon ou collaborateur).
 * collaboratorId null → horaires du salon par défaut.
 */
const weeklyScheduleSchema = new mongoose.Schema(
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
      default : null,
      index   : true
    },
    days : {
      type    : [daySchema],
      default : []
    }
  },
  {
    timestamps : true,
    collection : 'weekly_schedules'
  }
)

weeklyScheduleSchema.index(
  { proId: 1, collaboratorId: 1 },
  { unique: true, sparse: true }
)

module.exports = mongoose.model('WeeklySchedule', weeklyScheduleSchema)
