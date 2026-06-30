const mongoose = require('mongoose')

const paymentSchema = new mongoose.Schema(
  {
    holdId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'SlotHold',
      required : true,
      index    : true
    },
    bookingId : {
      type  : mongoose.Schema.Types.ObjectId,
      ref   : 'Booking',
      default : null,
      index : true
    },
    clientId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Client',
      required : true,
      index    : true
    },
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true
    },
    serviceId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Service',
      required : true
    },

    stripeSessionId       : { type: String, required: true, unique: true },
    stripePaymentIntentId : { type: String, default: null },

    amount         : { type: Number, required: true },
    amountCents    : { type: Number, required: true },
    totalPrice     : { type: Number, required: true },
    depositPercent : { type: Number, required: true, min: 0, max: 100 },
    remainingAmount: { type: Number, required: true },
    originalPrice  : { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    currency       : { type: String, default: 'eur' },

    commissionPercent  : { type: Number, default: null, min: 0, max: 100 },
    platformCommission : { type: Number, required: true },
    proShare           : { type: Number, required: true },

    halfPriceApplied : { type: Boolean, default: false },
    cashbackEarned   : { type: Number, default: 0 },

    status : {
      type    : String,
      enum    : ['pending', 'succeeded', 'failed', 'expired'],
      default : 'pending',
      index   : true
    }
  },
  {
    timestamps : true,
    collection : 'payments'
  }
)

module.exports = mongoose.model('Payment', paymentSchema)
