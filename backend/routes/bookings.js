const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole, optionalAuth, requireVerifiedClient } = require('../middleware/auth')
const booking = require('../controllers/bookingController')
const payment = require('../controllers/paymentController')

router.post('/hold', optionalAuth, booking.createHold)
router.post('/confirm', auth, requireRole('client'), requireVerifiedClient, booking.confirmHold)
router.post('/checkout', auth, requireRole('client'), requireVerifiedClient, payment.createCheckout)
router.get('/checkout/status', auth, requireRole('client'), requireVerifiedClient, payment.getCheckoutStatus)

module.exports = router
