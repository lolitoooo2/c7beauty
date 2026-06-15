const Stripe = require('stripe')

const COMMISSION_RATE = 0.10

function getStripe () {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

function isStripeEnabled () {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

function getFrontendUrl () {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
}

function getPublishableKey () {
  return process.env.STRIPE_PUBLISHABLE_KEY || ''
}

function computeCommission (amountEur) {
  const platformCommission = Math.round(amountEur * COMMISSION_RATE * 100) / 100
  const proShare           = Math.round((amountEur - platformCommission) * 100) / 100
  return { platformCommission, proShare }
}

function eurosToCents (eur) {
  return Math.round(eur * 100)
}

module.exports = {
  COMMISSION_RATE,
  getStripe,
  isStripeEnabled,
  getFrontendUrl,
  getPublishableKey,
  computeCommission,
  eurosToCents
}
