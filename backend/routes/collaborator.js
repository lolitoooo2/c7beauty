const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const c = require('../controllers/collaboratorController')
const schedule = require('../controllers/scheduleController')

router.use(auth)
router.use(requireRole('collaborator'))

router.get('/me',              c.getMe)
router.get('/agenda',          c.getAgenda)
router.get('/schedule/calendar', schedule.getCollaboratorCalendar)

const booking = require('../controllers/bookingController')
router.get('/bookings',              booking.listForCollaborator)
router.patch('/bookings/:id/cancel', booking.cancelByCollaborator)

module.exports = router
