const mongoose = require('mongoose')

const bookingSchema = new mongoose.Schema(
  {
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true,
      index    : true
    },
    clientId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Client',
      required : true,
      index    : true
    },
    collaboratorId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Collaborator',
      required : true,
      index    : true
    },
    serviceId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Service',
      required : true
    },

    start : { type: Date, required: true, index: true },
    end   : { type: Date, required: true },

    status : {
      type    : String,
      enum    : ['confirmed', 'cancelled', 'completed'],
      default : 'confirmed',
      index   : true
    },

    serviceName : { type: String, required: true },
    duration    : { type: Number, required: true },
    price       : { type: Number, required: true },
    depositPercent : { type: Number, default: null, min: 0, max: 100 },
    depositAmount  : { type: Number, default: null },
    remainingAmount: { type: Number, default: null },
    originalPrice   : { type: Number, default: null },
    discountPercent : { type: Number, default: 0 },
    cashbackEarned  : { type: Number, default: 0 },

    cancelledAt : { type: Date, default: null },
    cancelledBy : {
      type : String,
      enum : ['client', 'pro', 'collaborator', null],
      default : null
    },

    financial : {
      totalCollected          : { type: Number, default: 0 },
      totalPlatformCommission : { type: Number, default: 0 },
      totalProShare           : { type: Number, default: 0 },
      history : [{
        context            : { type: String, required: true },
        contextLabel       : { type: String, default: null },
        amount             : { type: Number, required: true },
        commissionPercent  : { type: Number, required: true },
        platformCommission : { type: Number, required: true },
        proShare           : { type: Number, required: true },
        paymentId          : { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
        at                 : { type: Date, default: Date.now }
      }]
    },

    validation : {
      workflowStatus : {
        type    : String,
        enum    : [
          'not_applicable',
          'pending_service',
          'awaiting_pro',
          'awaiting_client',
          'contestation',
          'ready_for_payment',
          'final_payment_done'
        ],
        default : null
      },
      contestationEndsAt : { type: Date, default: null },
      finalPaymentAt     : { type: Date, default: null },
      disputeOpen        : { type: Boolean, default: false },
      disputeReason      : { type: String, default: null },
      disputeOpenedAt    : { type: Date, default: null },
      balanceChargeAttempts    : { type: Number, default: 0 },
      balanceChargeLastError   : { type: String, default: null },
      balanceChargeLastAttemptAt : { type: Date, default: null },
      history : [{
        action   : { type: String, required: true },
        by       : { type: String, required: true },
        byUserId : { type: mongoose.Schema.Types.ObjectId, default: null },
        at       : { type: Date, default: Date.now },
        note     : { type: String, default: null }
      }]
    }
  },
  {
    timestamps : true,
    collection : 'bookings'
  }
)

bookingSchema.index({ proId: 1, start: 1 })
bookingSchema.index({ collaboratorId: 1, start: 1, end: 1 })
bookingSchema.index({ clientId: 1, start: -1 })

module.exports = mongoose.model('Booking', bookingSchema)
