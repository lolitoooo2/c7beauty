const Booking  = require('../models/Booking')
const SlotHold = require('../models/SlotHold')
const Payment  = require('../models/Payment')
const Service  = require('../models/Service')
const Client   = require('../models/Client')
const { isSlotAvailable } = require('./bookingHelpers')
const {
  computeBookingPrice,
  applyLoyaltyAfterBooking
} = require('./loyaltyHelpers')
const { ensureBookingConfirmationEmailSent } = require('./bookingEmailHelpers')

async function loadPopulatedBooking (bookingId) {
  return Booking.findById(bookingId)
    .populate('proId', 'salonName address city postalCode')
    .populate('collaboratorId', 'firstName lastName photo')
    .lean()
}

async function returnFulfilled ({ booking, payment, client = null }) {
  await ensureBookingConfirmationEmailSent(booking, client).catch(err => {
    console.error('[email] booking_confirmation:', err.message)
  })

  return {
    booking,
    loyalty : {
      halfPriceApplied : payment.halfPriceApplied,
      discountPercent  : payment.discountPercent,
      cashbackEarned   : payment.cashbackEarned
    },
    alreadyFulfilled : true
  }
}

/**
 * Transforme un hold en booking confirmé (idempotent si payment déjà fulfilled).
 */
async function fulfillHoldToBooking ({
  holdId,
  clientId,
  paymentId = null,
  stripeSessionId = null,
  stripePaymentIntentId = null,
  skipHoldExpiry = false
}) {
  if (paymentId) {
    const existingPayment = await Payment.findById(paymentId)
    if (existingPayment?.status === 'succeeded' && existingPayment.bookingId) {
      const booking = await loadPopulatedBooking(existingPayment.bookingId)
      return returnFulfilled({ booking, payment: existingPayment })
    }
  }

  if (stripeSessionId) {
    const existingPayment = await Payment.findOne({
      stripeSessionId,
      status : 'succeeded',
      bookingId : { $ne: null }
    })
    if (existingPayment) {
      const booking = await loadPopulatedBooking(existingPayment.bookingId)
      return returnFulfilled({ booking, payment: existingPayment })
    }
  }

  const hold = await SlotHold.findById(holdId)
  if (!hold) {
    const err = new Error('La réservation temporaire a expiré. Choisissez un autre créneau.')
    err.status = 410
    throw err
  }

  if (!skipHoldExpiry && hold.expiresAt < new Date()) {
    const err = new Error('La réservation temporaire a expiré. Choisissez un autre créneau.')
    err.status = 410
    throw err
  }

  if (hold.clientId && String(hold.clientId) !== String(clientId)) {
    const err = new Error('Ce créneau est réservé par un autre compte.')
    err.status = 403
    throw err
  }

  const service = await Service.findById(hold.serviceId)
  if (!service) {
    const err = new Error('Prestation introuvable.')
    err.status = 404
    throw err
  }

  const free = await isSlotAvailable({
    proId          : hold.proId,
    collaboratorId : hold.collaboratorId,
    start          : hold.start,
    end            : hold.end,
    excludeHoldId  : hold._id
  })
  if (!free) {
    await SlotHold.findByIdAndDelete(hold._id)
    const err = new Error('Ce créneau vient d\'être pris.')
    err.status = 409
    throw err
  }

  const client = await Client.findById(clientId)
  if (!client) {
    const err = new Error('Client introuvable.')
    err.status = 404
    throw err
  }

  const { originalPrice, finalPrice, halfPriceApplied, discountPercent } =
    computeBookingPrice(client, service.price)

  const booking = await Booking.create({
    proId          : hold.proId,
    clientId,
    collaboratorId : hold.collaboratorId,
    serviceId      : hold.serviceId,
    start          : hold.start,
    end            : hold.end,
    status         : 'confirmed',
    serviceName    : service.name,
    duration       : service.duration,
    price          : finalPrice,
    originalPrice,
    discountPercent,
    cashbackEarned : 0
  })

  const { cashbackEarned } = await applyLoyaltyAfterBooking(client, {
    originalPrice,
    halfPriceApplied
  })

  if (cashbackEarned > 0) {
    booking.cashbackEarned = cashbackEarned
    await booking.save()
  }

  await SlotHold.findByIdAndDelete(hold._id)

  if (paymentId) {
    await Payment.findByIdAndUpdate(paymentId, {
      status                : 'succeeded',
      bookingId             : booking._id,
      halfPriceApplied,
      discountPercent,
      cashbackEarned,
      stripePaymentIntentId : stripePaymentIntentId || undefined
    })
  } else if (stripeSessionId) {
    await Payment.findOneAndUpdate(
      { stripeSessionId },
      {
        status                : 'succeeded',
        bookingId             : booking._id,
        halfPriceApplied,
        discountPercent,
        cashbackEarned,
        stripePaymentIntentId : stripePaymentIntentId || undefined
      }
    )
  }

  const populated = await loadPopulatedBooking(booking._id)

  await ensureBookingConfirmationEmailSent(populated, client).catch(err => {
    console.error('[email] booking_confirmation:', err.message)
  })

  return {
    booking : populated,
    loyalty : {
      halfPriceApplied,
      discountPercent,
      cashbackEarned
    },
    alreadyFulfilled : false
  }
}

module.exports = { fulfillHoldToBooking, loadPopulatedBooking }
