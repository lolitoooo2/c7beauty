const Booking      = require('../models/Booking')
const Payment      = require('../models/Payment')
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
const { resolveRemainingAmount, enrichBooking } = require('../utils/bookingPaymentHelpers')
const { fulfillHoldToBooking } = require('../utils/bookingFulfillment')
const {
  validateByPro,
  validateByClient,
  openDispute
} = require('../utils/bookingValidation')
const {
  isLateCancellation,
  hasPaidDeposit,
  markNoShowByPro,
  applyLateCancellationForfeit
} = require('../utils/noShowHelpers')

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

  const base = {
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
    remainingAmount: resolveRemainingAmount(b),
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

  return enrichBooking(base, b)
}

async function cancelBookingById ({ booking, cancelledBy }) {
  const now = new Date()
  if (booking.start <= now) {
    const err = new Error('Impossible d\'annuler un rendez-vous passé ou en cours.')
    err.status = 400
    throw err
  }

  if (
    cancelledBy === 'client'
    && hasPaidDeposit(booking)
    && isLateCancellation(booking, now)
  ) {
    return applyLateCancellationForfeit({ booking, cancelledBy })
  }

  booking.status      = 'cancelled'
  booking.cancelledAt = now
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

// ── PATCH /api/client/bookings/:id/validate ───────────
exports.validateByClient = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id      : req.params.id,
      clientId : req.userId,
      status   : 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    await validateByClient({ booking, clientId: req.userId })

    res.json({
      message : 'Prestation confirmée. Période de contestation de 24h ouverte.',
      booking : formatBooking(booking.toObject())
    })
  } catch (err) {
    console.error('[booking.validateByClient]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── PATCH /api/client/bookings/:id/dispute ────────────
exports.openDisputeByClient = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id      : req.params.id,
      clientId : req.userId,
      status   : 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    await openDispute({
      booking,
      clientId : req.userId,
      reason   : req.body?.reason
    })

    res.json({
      message : 'Litige enregistré. Le paiement du solde est suspendu.',
      booking : formatBooking(booking.toObject())
    })
  } catch (err) {
    console.error('[booking.openDisputeByClient]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
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

    res.json({
      message : booking.noShow?.settledAt
        ? 'Annulation enregistrée. L\'acompte est conservé (moins de 24 h avant le rendez-vous).'
        : 'Rendez-vous annulé.',
      booking : formatBooking(booking.toObject())
    })
  } catch (err) {
    console.error('[booking.cancelByClient]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
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

// ── PATCH /api/pro/bookings/:id/validate ─────────────
exports.validateByPro = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id   : req.params.id,
      proId : req.userId,
      status: 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    await validateByPro({ booking, proId: req.userId })

    res.json({
      message : 'Prestation validée côté professionnel.',
      booking : formatBooking(booking.toObject())
    })
  } catch (err) {
    console.error('[booking.validateByPro]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── PATCH /api/pro/bookings/:id/no-show ───────────────
exports.markNoShowByPro = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id   : req.params.id,
      proId : req.userId,
      status: 'confirmed'
    })

    if (!booking) return res.status(404).json({ message: 'Réservation introuvable.' })

    await markNoShowByPro({ booking, proId: req.userId })

    res.json({
      message : 'No-show enregistré. L\'acompte est conservé et reversé au professionnel (net de commission).',
      booking : formatBooking(booking.toObject())
    })
  } catch (err) {
    console.error('[booking.markNoShowByPro]', err)
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
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
    status : { $in: ['confirmed', 'completed'] }
  }
  if (collaboratorId) {
    filter.collaboratorId = new mongoose.Types.ObjectId(String(collaboratorId))
  }
  return filter
}

function inRangeFilter (bounds) {
  return { start: { $gte: bounds.start, $lt: bounds.end } }
}

async function sumPaymentSharesForBookings (filter, bounds) {
  const bookingIds = await Booking.find({
    proId          : filter.proId,
    ...(filter.collaboratorId ? { collaboratorId: filter.collaboratorId } : {}),
    ...inRangeFilter(bounds),
    $or: [
      { status: { $in: ['confirmed', 'completed'] } },
      { status: 'cancelled', 'noShow.settledAt': { $ne: null } }
    ]
  }).distinct('_id')

  if (!bookingIds.length) {
    return { proShare: 0, platformCommission: 0, gross: 0 }
  }

  const [result] = await Payment.aggregate([
    {
      $match: {
        bookingId : { $in: bookingIds },
        status    : 'succeeded'
      }
    },
    {
      $group: {
        _id                : null,
        proShare           : { $sum: '$proShare' },
        platformCommission : { $sum: '$platformCommission' },
        gross              : { $sum: '$amount' }
      }
    }
  ])

  return {
    proShare           : result?.proShare ?? 0,
    platformCommission : result?.platformCommission ?? 0,
    gross              : result?.gross ?? 0
  }
}

exports.getProStats = async (req, res) => {
  try {
    const proId = req.userId
    const filter = buildProStatsFilter(proId, req.query.collaboratorId || null)

    const dayBounds   = getPeriodBoundsParis('day')
    const weekBounds  = getPeriodBoundsParis('week')
    const monthBounds = getPeriodBoundsParis('month')

    const [
      todayCount,
      weekCount,
      monthCount,
      totalConfirmed,
      totalCancelled,
      sharesToday,
      sharesWeek,
      sharesMonth,
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
      sumPaymentSharesForBookings(filter, dayBounds),
      sumPaymentSharesForBookings(filter, weekBounds),
      sumPaymentSharesForBookings(filter, monthBounds),
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
      revenueToday  : sharesToday.proShare,
      revenueWeek   : sharesWeek.proShare,
      revenueMonth  : sharesMonth.proShare,
      revenueTodayGross : sharesToday.gross,
      revenueWeekGross  : sharesWeek.gross,
      revenueMonthGross : sharesMonth.gross,
      commissionToday   : sharesToday.platformCommission,
      commissionWeek    : sharesWeek.platformCommission,
      commissionMonth   : sharesMonth.platformCommission,
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
