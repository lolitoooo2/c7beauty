const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const schedule = require('../controllers/scheduleController')

// Créneaux publics (fiche salon)
router.get('/slots', schedule.getSlots)
router.get('/booking', schedule.getBookingWeek)

module.exports = router
