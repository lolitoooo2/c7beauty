const Booking  = require('../models/Booking')
const SlotHold = require('../models/SlotHold')

const HOLD_MINUTES = 10

function rangesOverlapMs (aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Plages occupées (RDV confirmés + holds actifs), durée exacte sans buffer.
 * Ex. RDV 15h00–15h30 → le créneau 15h30 reste réservable pour une prestation qui suit.
 */
async function getBusyRanges ({
  proId,
  collaboratorId,
  rangeStart,
  rangeEnd,
  excludeHoldId = null
}) {
  const now = new Date()
  const ranges = []

  const bookings = await Booking.find({
    proId,
    collaboratorId,
    status : 'confirmed',
    start  : { $lt: rangeEnd },
    end    : { $gt: rangeStart }
  }).lean()

  for (const b of bookings) {
    ranges.push({
      start : b.start.getTime(),
      end   : b.end.getTime(),
      type  : 'booking'
    })
  }

  const holdFilter = {
    proId,
    collaboratorId,
    expiresAt : { $gt: now },
    start     : { $lt: rangeEnd },
    end       : { $gt: rangeStart }
  }
  if (excludeHoldId) holdFilter._id = { $ne: excludeHoldId }

  const holds = await SlotHold.find(holdFilter).lean()
  for (const h of holds) {
    ranges.push({
      start : h.start.getTime(),
      end   : h.end.getTime(),
      type  : 'hold'
    })
  }

  return ranges
}

function isSlotBlockedByRanges (slotStart, slotEnd, busyRanges) {
  const s = slotStart.getTime()
  const e = slotEnd.getTime()
  return busyRanges.some(r => rangesOverlapMs(s, e, r.start, r.end))
}

async function isSlotAvailable ({
  proId,
  collaboratorId,
  start,
  end,
  excludeHoldId = null
}) {
  const ranges = await getBusyRanges({
    proId,
    collaboratorId,
    rangeStart : start,
    rangeEnd   : end,
    excludeHoldId
  })
  return !isSlotBlockedByRanges(start, end, ranges)
}

async function resolveCollaboratorForSlot ({
  proId,
  serviceId,
  collaboratorId,
  collaboratorIds,
  start,
  end,
  excludeHoldId = null
}) {
  const candidates = collaboratorId
    ? [collaboratorId]
    : (collaboratorIds || [])

  for (const cid of candidates) {
    const free = await isSlotAvailable({
      proId,
      collaboratorId : cid,
      start,
      end,
      excludeHoldId
    })
    if (free) return cid
  }
  return null
}

const { formatTimeInParis } = require('./timezoneHelpers')

function holdExpiresAt () {
  return new Date(Date.now() + HOLD_MINUTES * 60 * 1000)
}

function formatSlotStartTime (date) {
  return formatTimeInParis(date)
}

/**
 * Heures de début exactes des RDV / holds (sans buffer) — pour affichage « créneau pris ».
 */
async function getOccupiedSlotStarts ({
  proId,
  collaboratorId,
  rangeStart,
  rangeEnd
}) {
  const now = new Date()
  const starts = new Set()

  const bookings = await Booking.find({
    proId,
    collaboratorId,
    status : 'confirmed',
    start  : { $lt: rangeEnd },
    end    : { $gt: rangeStart }
  }).select('start').lean()

  for (const b of bookings) starts.add(formatSlotStartTime(b.start))

  const holds = await SlotHold.find({
    proId,
    collaboratorId,
    expiresAt : { $gt: now },
    start     : { $lt: rangeEnd },
    end       : { $gt: rangeStart }
  }).select('start').lean()

  for (const h of holds) starts.add(formatSlotStartTime(h.start))

  return starts
}

module.exports = {
  HOLD_MINUTES,
  getBusyRanges,
  getOccupiedSlotStarts,
  isSlotBlockedByRanges,
  isSlotAvailable,
  resolveCollaboratorForSlot,
  holdExpiresAt
}
