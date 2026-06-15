const mongoose = require('mongoose')

const emailLogSchema = new mongoose.Schema(
  {
    to      : { type: String, required: true, index: true },
    subject : { type: String, required: true },
    type    : {
      type    : String,
      required: true,
      index   : true,
      enum    : [
        'email_verification',
        'booking_confirmation',
        'booking_reminder',
        'review_invite',
        'other'
      ]
    },
    status : {
      type    : String,
      enum    : ['pending', 'sent', 'failed', 'skipped'],
      default : 'pending',
      index   : true
    },
    error   : { type: String, default: null },
    sentAt  : { type: Date, default: null },
    meta    : { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps : true,
    collection : 'email_logs'
  }
)

module.exports = mongoose.model('EmailLog', emailLogSchema)
