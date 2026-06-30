const Booking      = require('../models/Booking')
const SlotHold     = require('../models/SlotHold')
const Service      = require('../models/Service')
const Collaborator = require('../models/Collaborator')
const Pro          = require('../models/Pro')
const Client       = require('../models/Client')
const mongoose     = require('mongoose')
const {
  resolveCollaboratorForSlot,
  holdExpiresAt,
  HOLD_MINUTES
} = require('../utils/bookingHelpers')
const { dateAtTime, computeAvailableSlots } = require('../utils/scheduleHelpers')
const { getPeriodBoundsParis } = require('../utils/timezoneHelpers')
const {
  getLoyaltyPreview
} = require('../utils/loyaltyHelpers')
const { isStripeEnabled } = require('../utils/stripeHelpers')
const { getPlatformSettings } = require('../utils/platformSettings')
const { fulfillHoldToBooking } = require('../utils/bookingFulfillment')

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
  const client = b.clientId && typeof b.clientId === 'object'
    ? { _id: b.clientId._id, firstName: b.clientId.firstName, lastName: b.clientId.lastName, phone: b.clientId.phone, email: b.clientId.email }
    : undefined

  return {
    _id            : b._id,
    proId          : b.proId,
    clientId       : typeof b.clientId === 'object' ? b.clientId?._id : b.clientId,
    collaboratorId : b.collaboratorId,
    serviceId      : b.serviceId,
    start          : b.start,
    end            : b.end,
    status         : b.status,
    serviceName    : b.serviceName,
    duration       : b.duration,
    price          : b.price,
    depositPercent : b.depositPercent ?? null,
    depositAmount  : b.depositAmount ?? null,
    cancelledAt    : b.cancelledAt,
    createdAt      : b.createdAt,
    client,
    pro            : b.proId && typeof b.proId === 'object'
      ? { _id: b.proId._id, salonName: b.proId.salonName, address: b.proId.address, city: b.proId.city, postalCode: b.proId.postalCode }
      : undefined,
    collaborator   : b.collaboratorId && typeof b.collaboratorId === 'object'
      ? { _id: b.collaboratorId._id, firstName: b.collaboratorId.firstName, lastName: b.collaboratorId.lastName, photo: b.collaboratorId.photo }
      : undefined
  }
}

async function cancelBookingById ({ booking, cancelledBy }) {
  if (booking.start <= new Date()) {
    const err = new Error('Impossible d\'annuler un rendez-vous passé ou en cours.')
    err.status = 400
    throw err
  }
  booking.status      = 'cancelled'
  booking.cancelledAt = new Date()
  booking.cancelledBy = cancelledBy
  await booking.save()
  return booking
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
    if (isStripeEnabled()) {
      return res.status(400).json({
        message : 'Utilisez le paiement en ligne pour confirmer votre rendez-vous.'
      })
    }

    if (req.userRole !== 'client') {
      return res.status(401).json({ message: 'Connectez-vous en tant que client pour confirmer.' })
    }

    const { holdId } = req.body
    if (!holdId) return res.status(400).json({ message: 'holdId requis.' })

    const { booking, loyalty } = await fulfillHoldToBooking({
      holdId,
      clientId : req.userId
    })

    res.status(201).json({
      message : 'Rendez-vous confirmé !',
      booking : formatBooking(booking),
      loyalty
    })
  } catch (err) {
    console.error('[booking.confirmHold]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── GET /api/client/loyalty/preview ───────────────────
exports.previewLoyalty = async (req, res) => {
  try {
    const price = Number(req.query.price)
    if (!price || price <= 0) {
      return res.status(400).json({ message: 'Paramètre price requis.' })
    }

    const client = await Client.findById(req.userId)
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })

    res.json(getLoyaltyPreview(client, price))
  } catch (err) {
    console.error('[booking.previewLoyalty]', err)
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

    await cancelBookingById({ booking, cancelledBy: 'client' })

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
      data: bookings.map(b => formatBooking(b))
    })
  } catch (err) {
    console.error('[booking.listForPro]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PATCH /api/pro/bookings/:id/cancel ──────────────
exports.cancelByPro = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id    : req.params.id,
      proId  : req.userId,
      status : 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    await cancelBookingById({ booking, cancelledBy: 'pro' })

    res.json({ message: 'Rendez-vous annulé.', booking: formatBooking(booking.toObject()) })
  } catch (err) {
    console.error('[booking.cancelByPro]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── GET /api/collaborator/bookings ────────────────────
exports.listForCollaborator = async (req, res) => {
  try {
    const filter = { collaboratorId: req.userId, status: 'confirmed' }
    const now    = new Date()

    if (req.query.from || req.query.to) {
      filter.start = {}
      if (req.query.from) filter.start.$gte = new Date(req.query.from)
      if (req.query.to) filter.start.$lte = new Date(req.query.to + 'T23:59:59')
    } else if (req.query.upcoming === '1') {
      filter.start = { $gte: now }
    }

    const bookings = await Booking.find(filter)
      .sort({ start: 1 })
      .limit(Number(req.query.limit) || 100)
      .populate('clientId', 'firstName lastName phone email')
      .lean()

    res.json({ data: bookings.map(formatBooking) })
  } catch (err) {
    console.error('[booking.listForCollaborator]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PATCH /api/collaborator/bookings/:id/cancel ───────
exports.cancelByCollaborator = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id            : req.params.id,
      collaboratorId : req.userId,
      status         : 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    await cancelBookingById({ booking, cancelledBy: 'collaborator' })

    res.json({ message: 'Rendez-vous annulé.', booking: formatBooking(booking.toObject()) })
  } catch (err) {
    console.error('[booking.cancelByCollaborator]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── GET /api/pro/stats ────────────────────────────────
function buildProStatsFilter (proId, collaboratorId) {
  const filter = {
    proId  : new mongoose.Types.ObjectId(String(proId)),
    status : 'confirmed'
  }
  if (collaboratorId) {
    filter.collaboratorId = new mongoose.Types.ObjectId(String(collaboratorId))
  }
  return filter
}

function inRangeFilter (bounds) {
  return { start: { $gte: bounds.start, $lt: bounds.end } }
}

async function sumBookingRevenue (filter, bounds) {
  const [result] = await Booking.aggregate([
    { $match: { ...filter, ...inRangeFilter(bounds) } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } }
  ])
  return result?.total ?? 0
}

function toProShare (grossEur, commissionPercent) {
  const net = grossEur * (1 - commissionPercent / 100)
  return Math.round(net * 100) / 100
}

exports.getProStats = async (req, res) => {
  try {
    const proId = req.userId
    const filter = buildProStatsFilter(proId, req.query.collaboratorId || null)
    const { commissionPercent } = await getPlatformSettings()

    const dayBounds   = getPeriodBoundsParis('day')
    const weekBounds  = getPeriodBoundsParis('week')
    const monthBounds = getPeriodBoundsParis('month')

    const [
      todayCount,
      weekCount,
      monthCount,
      totalConfirmed,
      totalCancelled,
      grossToday,
      grossWeek,
      grossMonth,
      nextBooking
    ] = await Promise.all([
      Booking.countDocuments({ ...filter, ...inRangeFilter(dayBounds) }),
      Booking.countDocuments({ ...filter, ...inRangeFilter(weekBounds) }),
      Booking.countDocuments({ ...filter, ...inRangeFilter(monthBounds) }),
      Booking.countDocuments({ ...filter }),
      Booking.countDocuments({
        proId  : filter.proId,
        status : 'cancelled',
        ...(filter.collaboratorId ? { collaboratorId: filter.collaboratorId } : {})
      }),
      sumBookingRevenue(filter, dayBounds),
      sumBookingRevenue(filter, weekBounds),
      sumBookingRevenue(filter, monthBounds),
      Booking.findOne({ ...filter, start: { $gte: new Date() } })
        .sort({ start: 1 })
        .populate('clientId', 'firstName lastName phone')
        .lean()
    ])

    res.json({
      todayCount,
      weekCount,
      monthCount,
      totalConfirmed,
      totalCancelled,
      revenueToday  : toProShare(grossToday, commissionPercent),
      revenueWeek   : toProShare(grossWeek, commissionPercent),
      revenueMonth  : toProShare(grossMonth, commissionPercent),
      revenueTodayGross : grossToday,
      revenueWeekGross  : grossWeek,
      revenueMonthGross : grossMonth,
      nextBooking   : nextBooking
        ? {
            _id         : nextBooking._id,
            start       : nextBooking.start,
            end         : nextBooking.end,
            serviceName : nextBooking.serviceName,
            duration    : nextBooking.duration,
            price       : nextBooking.price,
            client      : nextBooking.clientId
              ? {
                  firstName : nextBooking.clientId.firstName,
                  lastName  : nextBooking.clientId.lastName,
                  phone     : nextBooking.clientId.phone
                }
              : null
          }
        : null
    })
  } catch (err) {
    console.error('[booking.getProStats]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
