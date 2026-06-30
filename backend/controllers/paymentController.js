const Payment      = require('../models/Payment')
const SlotHold     = require('../models/SlotHold')
const Service      = require('../models/Service')
const Pro          = require('../models/Pro')
const Client       = require('../models/Client')
const { computeBookingPrice } = require('../utils/loyaltyHelpers')
const { fulfillHoldToBooking } = require('../utils/bookingFulfillment')
const {
  getStripe,
  isStripeEnabled,
  getFrontendUrl,
  getPublishableKey,
  eurosToCents
} = require('../utils/stripeHelpers')
const {
  getPlatformSettings,
  computeDepositAmount,
  computeCommission
} = require('../utils/platformSettings')

function checkoutPayload (session) {
  return {
    clientSecret  : session.client_secret,
    sessionId     : session.id,
    publishableKey: getPublishableKey()
  }
}

function formatBookingFromPayment (booking) {
  if (!booking) return null
  return {
    _id            : booking._id,
    proId          : typeof booking.proId === 'object' ? booking.proId?._id : booking.proId,
    clientId       : typeof booking.clientId === 'object' ? booking.clientId?._id : booking.clientId,
    collaboratorId : booking.collaboratorId,
    serviceId      : booking.serviceId,
    start          : booking.start,
    end            : booking.end,
    status         : booking.status,
    serviceName    : booking.serviceName,
    duration       : booking.duration,
    price          : booking.price,
    depositPercent : booking.depositPercent ?? null,
    depositAmount  : booking.depositAmount ?? null,
    originalPrice  : booking.originalPrice,
    discountPercent: booking.discountPercent,
    cashbackEarned : booking.cashbackEarned,
    pro            : booking.proId && typeof booking.proId === 'object'
      ? {
          _id        : booking.proId._id,
          salonName  : booking.proId.salonName,
          address    : booking.proId.address,
          city       : booking.proId.city,
          postalCode : booking.proId.postalCode
        }
      : undefined,
    collaborator: booking.collaboratorId && typeof booking.collaboratorId === 'object'
      ? {
          _id       : booking.collaboratorId._id,
          firstName : booking.collaboratorId.firstName,
          lastName  : booking.collaboratorId.lastName,
          photo     : booking.collaboratorId.photo
        }
      : undefined
  }
}

async function tryFulfillFromStripeSession (session, payment) {
  if (!session || session.payment_status !== 'paid') return null

  const result = await fulfillHoldToBooking({
    holdId                : payment.holdId,
    clientId              : payment.clientId,
    paymentId             : payment._id,
    stripeSessionId       : session.id,
    stripePaymentIntentId : typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id,
    skipHoldExpiry        : true
  })

  return result
}

// ── POST /api/bookings/checkout ───────────────────────
exports.createCheckout = async (req, res) => {
  try {
    if (!isStripeEnabled()) {
      return res.status(503).json({ message: 'Paiement en ligne indisponible.' })
    }

    if (req.userRole !== 'client') {
      return res.status(401).json({ message: 'Connectez-vous en tant que client pour payer.' })
    }

    const { holdId } = req.body
    if (!holdId) return res.status(400).json({ message: 'holdId requis.' })

    const hold = await SlotHold.findById(holdId)
    if (!hold || hold.expiresAt < new Date()) {
      return res.status(410).json({ message: 'La réservation temporaire a expiré. Choisissez un autre créneau.' })
    }

    if (hold.clientId && String(hold.clientId) !== String(req.userId)) {
      return res.status(403).json({ message: 'Ce créneau est réservé par un autre compte.' })
    }

    const [service, pro, client] = await Promise.all([
      Service.findById(hold.serviceId),
      Pro.findById(hold.proId),
      Client.findById(req.userId)
    ])

    if (!service) return res.status(404).json({ message: 'Prestation introuvable.' })
    if (!pro) return res.status(404).json({ message: 'Salon introuvable.' })
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })

    const { originalPrice, finalPrice, halfPriceApplied, discountPercent } =
      computeBookingPrice(client, service.price)

    const settings = await getPlatformSettings()
    const depositPercent    = settings.depositPercent
    const commissionPercent = settings.commissionPercent
    const depositAmount     = computeDepositAmount(finalPrice, depositPercent)

    if (depositAmount < 0.50) {
      return res.status(400).json({ message: 'Montant minimum de paiement : 0,50 €.' })
    }

    const stripe = getStripe()
    if (!stripe) return res.status(503).json({ message: 'Paiement en ligne indisponible.' })

    const existing = await Payment.findOne({
      holdId,
      clientId : req.userId,
      status   : 'pending'
    }).sort({ createdAt: -1 })

    if (existing?.stripeSessionId) {
      const session = await stripe.checkout.sessions.retrieve(existing.stripeSessionId)
      if (session.status === 'open' && session.client_secret) {
        return res.json(checkoutPayload(session))
      }
      if (session.payment_status === 'paid') {
        const fulfilled = await tryFulfillFromStripeSession(session, existing)
        if (fulfilled?.booking) {
          return res.status(409).json({
            message : 'Paiement déjà effectué.',
            booking : formatBookingFromPayment(fulfilled.booking)
          })
        }
      }
    }

    const { platformCommission, proShare } = computeCommission(depositAmount, commissionPercent)
    const amountCents = eurosToCents(depositAmount)
    const frontendUrl = getFrontendUrl()

    const payment = await Payment.create({
      holdId,
      clientId       : req.userId,
      proId          : hold.proId,
      serviceId      : hold.serviceId,
      stripeSessionId: `pending_${holdId}_${Date.now()}`,
      amount         : depositAmount,
      amountCents,
      totalPrice     : finalPrice,
      depositPercent,
      commissionPercent,
      originalPrice,
      discountPercent,
      platformCommission,
      proShare,
      halfPriceApplied,
      status         : 'pending'
    })

    const session = await stripe.checkout.sessions.create({
      ui_mode     : 'embedded',
      mode        : 'payment',
      currency    : 'eur',
      line_items  : [{
        quantity   : 1,
        price_data : {
          currency     : 'eur',
          unit_amount  : amountCents,
          product_data : {
            name        : service.name,
            description : `${pro.salonName} — acompte ${depositPercent} % (${depositAmount.toFixed(2)} €)`
          }
        }
      }],
      metadata : {
        holdId    : String(holdId),
        paymentId : String(payment._id),
        clientId  : String(req.userId),
        proId     : String(hold.proId)
      },
      redirect_on_completion : 'if_required',
      return_url : `${frontendUrl}/salon/${hold.proId}/reserver/${hold.serviceId}/succes?session_id={CHECKOUT_SESSION_ID}`,
      expires_at : Math.floor(Date.now() / 1000) + 30 * 60
    })

    payment.stripeSessionId = session.id
    await payment.save()

    hold.clientId  = req.userId
    hold.expiresAt = new Date(Date.now() + 35 * 60 * 1000)
    await hold.save()

    res.json(checkoutPayload(session))
  } catch (err) {
    console.error('[payment.createCheckout]', err)
    if (req.body?.holdId) {
      await Payment.deleteMany({
        holdId   : req.body.holdId,
        clientId : req.userId,
        status   : 'pending',
        stripeSessionId : { $regex: /^pending_/ }
      }).catch(() => {})
    }
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/bookings/checkout/status ─────────────────
exports.getCheckoutStatus = async (req, res) => {
  try {
    if (req.userRole !== 'client') {
      return res.status(401).json({ message: 'Connectez-vous en tant que client.' })
    }

    const sessionId = req.query.session_id
    if (!sessionId) return res.status(400).json({ message: 'session_id requis.' })

    const payment = await Payment.findOne({
      stripeSessionId : sessionId,
      clientId        : req.userId
    })

    if (!payment) return res.status(404).json({ message: 'Paiement introuvable.' })

    if (payment.status === 'succeeded' && payment.bookingId) {
      const { loadPopulatedBooking } = require('../utils/bookingFulfillment')
      const { ensureBookingConfirmationEmailSent } = require('../utils/bookingEmailHelpers')
      const booking = await loadPopulatedBooking(payment.bookingId)
      await ensureBookingConfirmationEmailSent(booking).catch(err => {
        console.error('[payment.getCheckoutStatus] email:', err.message)
      })
      return res.json({
        status  : 'succeeded',
        booking : formatBookingFromPayment(booking),
        loyalty : {
          halfPriceApplied : payment.halfPriceApplied,
          discountPercent  : payment.discountPercent,
          cashbackEarned   : payment.cashbackEarned
        }
      })
    }

    if (!isStripeEnabled()) {
      return res.json({ status: payment.status })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status === 'paid') {
      const fulfilled = await tryFulfillFromStripeSession(session, payment)
      if (fulfilled?.booking) {
        return res.json({
          status  : 'succeeded',
          booking : formatBookingFromPayment(fulfilled.booking),
          loyalty : fulfilled.loyalty
        })
      }
    }

    if (session.status === 'expired') {
      payment.status = 'expired'
      await payment.save()
    }

    res.json({
      status : session.status === 'expired'
        ? 'expired'
        : session.payment_status === 'paid'
          ? 'processing'
          : 'pending'
    })
  } catch (err) {
    console.error('[payment.getCheckoutStatus]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
