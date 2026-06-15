const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole, optionalAuth } = require('../middleware/auth')
const booking = require('../controllers/bookingController')

router.post('/hold', optionalAuth, booking.createHold)
router.post('/confirm', auth, requireRole('client'), booking.confirmHold)

module.exports = router
