const Payment = require('../models/Payment')
const { getStripe } = require('../utils/stripeHelpers')
const { fulfillHoldToBooking } = require('../utils/bookingFulfillment')

exports.handleStripeWebhook = async (req, res) => {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !webhookSecret) {
    return res.status(503).send('Stripe non configuré.')
  }

  const signature = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
  } catch (err) {
    console.error('[stripe.webhook] Signature invalide:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.payment_status !== 'paid') break

        const payment = await Payment.findOne({ stripeSessionId: session.id })
        if (!payment) {
          console.warn('[stripe.webhook] Payment introuvable pour session', session.id)
          break
        }

        await fulfillHoldToBooking({
          holdId                : payment.holdId,
          clientId              : payment.clientId,
          paymentId             : payment._id,
          stripeSessionId       : session.id,
          stripePaymentIntentId : typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
          skipHoldExpiry        : true
        })
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object
        await Payment.findOneAndUpdate(
          { stripeSessionId: session.id, status: 'pending' },
          { status: 'expired' }
        )
        break
      }

      default:
        break
    }

    res.json({ received: true })
  } catch (err) {
    console.error('[stripe.webhook]', err)
    res.status(500).json({ message: 'Erreur webhook.' })
  }
}
