const Stripe = require('stripe')

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

function eurosToCents (eur) {
  return Math.round(eur * 100)
}

module.exports = {
  getStripe,
  isStripeEnabled,
  getFrontendUrl,
  getPublishableKey,
  eurosToCents
}
