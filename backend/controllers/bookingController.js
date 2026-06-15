const Booking      = require('../models/Booking')
const SlotHold     = require('../models/SlotHold')
const Service      = require('../models/Service')
const Collaborator = require('../models/Collaborator')
const Pro          = require('../models/Pro')
const {
  isSlotAvailable,
  resolveCollaboratorForSlot,
  holdExpiresAt,
  HOLD_MINUTES
} = require('../utils/bookingHelpers')
const { dateAtTime, computeAvailableSlots } = require('../utils/scheduleHelpers')

function parseSlotTimes (dateStr, startTime, duration) {
  const start = dateAtTime(dateStr, startTime)
  const end   = new Date(start.getTime() + duration * 60 * 1000)
  return { start, end }
}

async function validateSlotStillInGrid ({
  proId,
  collaboratorId,
  serviceId,
  dateStr,
  startTime
}) {
  const result = await computeAvailableSlots({
    proId,
    collaboratorId,
    serviceId,
    dateStr
  })
  return result.slots.some(s => s.startTime === startTime)
}

function formatBooking (b) {
  return {
    _id            : b._id,
    proId          : b.proId,
    clientId       : b.clientId,
    collaboratorId : b.collaboratorId,
    serviceId      : b.serviceId,
    start          : b.start,
    end            : b.end,
    status         : b.status,
    serviceName    : b.serviceName,
    duration       : b.duration,
    price          : b.price,
    cancelledAt    : b.cancelledAt,
    createdAt      : b.createdAt,
    pro            : b.proId && typeof b.proId === 'object'
      ? { _id: b.proId._id, salonName: b.proId.salonName, address: b.proId.address, city: b.proId.city, postalCode: b.proId.postalCode }
      : undefined,
    collaborator   : b.collaboratorId && typeof b.collaboratorId === 'object'
      ? { _id: b.collaboratorId._id, firstName: b.collaboratorId.firstName, lastName: b.collaboratorId.lastName, photo: b.collaboratorId.photo }
      : undefined
  }
}

// ── POST /api/bookings/hold ───────────────────────────
exports.createHold = async (req, res) => {
  try {
    const {
      proId,
      serviceId,
      date,
      startTime,
      collaboratorId,
      collaboratorIds = []
    } = req.body

    if (!proId || !serviceId || !date || !startTime) {
      return res.status(400).json({ message: 'proId, serviceId, date et startTime requis.' })
    }

    const service = await Service.findOne({ _id: serviceId, proId, active: true })
    if (!service) return res.status(404).json({ message: 'Prestation introuvable.' })

    const pro = await Pro.findOne({ _id: proId, isActive: true, 'kyc.status': 'approved' })
    if (!pro) return res.status(404).json({ message: 'Salon introuvable.' })

    const { start, end } = parseSlotTimes(date, startTime, service.duration)

    const resolvedCollabId = await resolveCollaboratorForSlot({
      proId,
      serviceId,
      collaboratorId : collaboratorId || null,
      collaboratorIds,
      start,
      end
    })

    if (!resolvedCollabId) {
      return res.status(409).json({ message: 'Ce créneau n\'est plus disponible.' })
    }

    const stillValid = await validateSlotStillInGrid({
      proId,
      collaboratorId : resolvedCollabId,
      serviceId,
      dateStr        : date,
      startTime
    })
    if (!stillValid) {
      return res.status(409).json({ message: 'Ce créneau n\'est plus disponible.' })
    }

    const hold = await SlotHold.create({
      proId,
      serviceId,
      collaboratorId : resolvedCollabId,
      clientId       : req.userRole === 'client' ? req.userId : null,
      start,
      end,
      expiresAt      : holdExpiresAt()
    })

    res.status(201).json({
      message   : `Créneau réservé ${HOLD_MINUTES} minutes.`,
      holdId    : hold._id,
      expiresAt : hold.expiresAt,
      collaboratorId : resolvedCollabId,
      start,
      end
    })
  } catch (err) {
    console.error('[booking.createHold]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/bookings/confirm ────────────────────────
exports.confirmHold = async (req, res) => {
  try {
    if (req.userRole !== 'client') {
      return res.status(401).json({ message: 'Connectez-vous en tant que client pour confirmer.' })
    }

    const { holdId } = req.body
    if (!holdId) return res.status(400).json({ message: 'holdId requis.' })

    const hold = await SlotHold.findById(holdId)
    if (!hold || hold.expiresAt < new Date()) {
      return res.status(410).json({ message: 'La réservation temporaire a expiré. Choisissez un autre créneau.' })
    }

    const service = await Service.findById(hold.serviceId)
    if (!service) return res.status(404).json({ message: 'Prestation introuvable.' })

    const free = await isSlotAvailable({
      proId          : hold.proId,
      collaboratorId : hold.collaboratorId,
      start          : hold.start,
      end            : hold.end,
      excludeHoldId  : hold._id
    })
    if (!free) {
      await SlotHold.findByIdAndDelete(hold._id)
      return res.status(409).json({ message: 'Ce créneau vient d\'être pris.' })
    }

    const booking = await Booking.create({
      proId          : hold.proId,
      clientId       : req.userId,
      collaboratorId : hold.collaboratorId,
      serviceId      : hold.serviceId,
      start          : hold.start,
      end            : hold.end,
      status         : 'confirmed',
      serviceName    : service.name,
      duration       : service.duration,
      price          : service.price
    })

    await SlotHold.findByIdAndDelete(hold._id)

    const populated = await Booking.findById(booking._id)
      .populate('proId', 'salonName address city postalCode')
      .populate('collaboratorId', 'firstName lastName photo')
      .lean()

    res.status(201).json({
      message : 'Rendez-vous confirmé !',
      booking : formatBooking(populated)
    })
  } catch (err) {
    console.error('[booking.confirmHold]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/client/bookings ──────────────────────────
exports.listForClient = async (req, res) => {
  try {
    const now    = new Date()
    const filter = { clientId: req.userId }

    if (req.query.upcoming === '1') {
      filter.status = 'confirmed'
      filter.start  = { $gte: now }
    } else if (req.query.past === '1') {
      filter.$or = [
        { status: 'cancelled' },
        { status: 'completed' },
        { status: 'confirmed', start: { $lt: now } }
      ]
    }

    const bookings = await Booking.find(filter)
      .sort({ start: req.query.past === '1' ? -1 : 1 })
      .limit(Number(req.query.limit) || 50)
      .populate('proId', 'salonName address city postalCode')
      .populate('collaboratorId', 'firstName lastName photo')
      .lean()

    res.json({ data: bookings.map(formatBooking) })
  } catch (err) {
    console.error('[booking.listForClient]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PATCH /api/client/bookings/:id/cancel ─────────────
exports.cancelByClient = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id      : req.params.id,
      clientId : req.userId,
      status   : 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    if (booking.start <= new Date()) {
      return res.status(400).json({ message: 'Impossible d\'annuler un rendez-vous passé ou en cours.' })
    }

    booking.status      = 'cancelled'
    booking.cancelledAt = new Date()
    booking.cancelledBy = 'client'
    await booking.save()

    res.json({ message: 'Rendez-vous annulé.', booking: formatBooking(booking.toObject()) })
  } catch (err) {
    console.error('[booking.cancelByClient]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/pro/bookings ─────────────────────────────
exports.listForPro = async (req, res) => {
  try {
    const filter = { proId: req.userId, status: 'confirmed' }
    const now    = new Date()

    if (req.query.from || req.query.to) {
      filter.start = {}
      if (req.query.from) filter.start.$gte = new Date(req.query.from)
      if (req.query.to) filter.start.$lte = new Date(req.query.to)
    } else if (req.query.upcoming === '1') {
      filter.start = { $gte: now }
    }

    if (req.query.collaboratorId) filter.collaboratorId = req.query.collaboratorId

    const bookings = await Booking.find(filter)
      .sort({ start: 1 })
      .limit(Number(req.query.limit) || 100)
      .populate('clientId', 'firstName lastName phone email')
      .populate('collaboratorId', 'firstName lastName photo')
      .lean()

    res.json({
      data: bookings.map(b => ({
        ...formatBooking(b),
        client: b.clientId && typeof b.clientId === 'object'
          ? { firstName: b.clientId.firstName, lastName: b.clientId.lastName, phone: b.clientId.phone, email: b.clientId.email }
          : null
      }))
    })
  } catch (err) {
    console.error('[booking.listForPro]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
