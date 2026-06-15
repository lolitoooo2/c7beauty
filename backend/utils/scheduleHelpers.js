const WeeklySchedule    = require('../models/WeeklySchedule')
const SchedulePeriod    = require('../models/SchedulePeriod')
const ScheduleException = require('../models/ScheduleException')
const ServiceConstraint = require('../models/ServiceConstraint')
const Service           = require('../models/Service')
const Collaborator      = require('../models/Collaborator')
const Booking           = require('../models/Booking')
const { getBusyRanges, getOccupiedSlotStarts, isSlotBlockedByRanges } = require('./bookingHelpers')
const { dateAtTimeInParis } = require('./timezoneHelpers')

const BUFFER_MINUTES     = 0
const MIN_ADVANCE_HOURS  = 2
const SLOT_STEP_MINUTES  = 15 // pas minimum pour prestations courtes

/** Pas entre créneaux selon la durée (comme Planity : 1h → 9h, 10h, 11h…) */
function getSlotStepMinutes (serviceDuration) {
  if (serviceDuration >= 60) return 60
  if (serviceDuration >= 30) return serviceDuration
  return SLOT_STEP_MINUTES
}

const DEFAULT_DAYS = [
  { dayOfWeek: 0, isOpen: true,  slots: [{ start: '09:00', end: '19:00' }] },
  { dayOfWeek: 1, isOpen: true,  slots: [{ start: '09:00', end: '19:00' }] },
  { dayOfWeek: 2, isOpen: true,  slots: [{ start: '09:00', end: '19:00' }] },
  { dayOfWeek: 3, isOpen: true,  slots: [{ start: '09:00', end: '19:00' }] },
  { dayOfWeek: 4, isOpen: true,  slots: [{ start: '09:00', end: '19:00' }] },
  { dayOfWeek: 5, isOpen: true,  slots: [{ start: '09:00', end: '17:00' }] },
  { dayOfWeek: 6, isOpen: false, slots: [] }
]

function cloneDays (days) {
  return days.map(d => ({
    dayOfWeek : d.dayOfWeek,
    isOpen    : d.isOpen,
    slots     : d.slots.map(s => ({ start: s.start, end: s.end }))
  }))
}

function normalizeDays (days) {
  const map = new Map()
  for (let i = 0; i < 7; i++) {
    map.set(i, { dayOfWeek: i, isOpen: false, slots: [] })
  }
  for (const d of days || []) {
    const dow = Number(d.dayOfWeek)
    if (dow < 0 || dow > 6) continue
    map.set(dow, {
      dayOfWeek : dow,
      isOpen    : !!d.isOpen,
      slots     : (d.slots || []).map(s => ({ start: s.start, end: s.end }))
    })
  }
  return Array.from(map.values())
}

function parseDateOnly (value) {
  if (!value) return null
  const str = String(value).slice(0, 10)
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

function formatDateOnly (date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDayOfWeek (date) {
  const js = date.getUTCDay() // 0=dim … 6=sam
  return js === 0 ? 6 : js - 1 // 0=lun … 6=dim
}

function parseTimeToMinutes (time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function minutesToTime (mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function dateAtTime (dateOnly, time) {
  const dateStr = typeof dateOnly === 'string' ? dateOnly.slice(0, 10) : formatDateOnly(dateOnly)
  return dateAtTimeInParis(dateStr, time)
}

function rangesOverlap (aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

async function getOrCreateSalonSchedule (proId) {
  let schedule = await WeeklySchedule.findOne({ proId, collaboratorId: null })
  if (!schedule) {
    schedule = await WeeklySchedule.create({
      proId,
      collaboratorId : null,
      days             : cloneDays(DEFAULT_DAYS)
    })
  }
  return schedule
}

/** @deprecated alias salon */
async function getOrCreateWeeklySchedule (proId, collaboratorId = null) {
  if (collaboratorId) {
    return WeeklySchedule.findOne({ proId, collaboratorId })
  }
  return getOrCreateSalonSchedule(proId)
}

/**
 * Horaires affichés pour le pro : salon ou héritage salon pour un collaborateur.
 */
async function getWeeklyForEditor (proId, collaboratorId = null) {
  if (!collaboratorId) {
    const salon = await getOrCreateSalonSchedule(proId)
    return { days: normalizeDays(salon.days), inherited: false, hasCustom: false }
  }

  const custom = await WeeklySchedule.findOne({ proId, collaboratorId }).lean()
  if (custom?.days?.length) {
    return { days: normalizeDays(custom.days), inherited: false, hasCustom: true }
  }

  const salon = await getOrCreateSalonSchedule(proId)
  return { days: normalizeDays(salon.days), inherited: true, hasCustom: false }
}

async function saveCollaboratorWeekly (proId, collaboratorId, days) {
  let schedule = await WeeklySchedule.findOne({ proId, collaboratorId })
  if (!schedule) {
    schedule = new WeeklySchedule({ proId, collaboratorId, days: normalizeDays(days) })
  } else {
    schedule.days = normalizeDays(days)
  }
  await schedule.save()
  return schedule
}

async function resetCollaboratorWeekly (proId, collaboratorId) {
  return WeeklySchedule.findOneAndDelete({ proId, collaboratorId })
}

async function resolveWeeklyDays (proId, collaboratorId, date) {
  const dayStart = parseDateOnly(formatDateOnly(date))

  const periodFilter = {
    proId,
    validFrom : { $lte: dayStart },
    validTo   : { $gte: dayStart }
  }

  if (collaboratorId) {
    const collabPeriod = await SchedulePeriod.findOne({
      ...periodFilter,
      collaboratorId
    }).lean()
    if (collabPeriod?.days?.length) return normalizeDays(collabPeriod.days)

    const salonPeriod = await SchedulePeriod.findOne({
      ...periodFilter,
      collaboratorId: null
    }).lean()
    if (salonPeriod?.days?.length) return normalizeDays(salonPeriod.days)
  } else {
    const salonPeriod = await SchedulePeriod.findOne({
      ...periodFilter,
      collaboratorId: null
    }).lean()
    if (salonPeriod?.days?.length) return normalizeDays(salonPeriod.days)
  }

  if (collaboratorId) {
    const collabWeekly = await WeeklySchedule.findOne({ proId, collaboratorId }).lean()
    if (collabWeekly?.days?.length) return normalizeDays(collabWeekly.days)
  }

  const salonWeekly = await getOrCreateSalonSchedule(proId)
  return normalizeDays(salonWeekly.days)
}

async function getExceptionsForDate (proId, collaboratorId, date) {
  const dayStart = parseDateOnly(formatDateOnly(date))
  const dayEnd   = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  const baseFilter = {
    proId,
    startDate : { $lt: dayEnd },
    endDate   : { $gte: dayStart }
  }

  const exceptions = await ScheduleException.find({
    ...baseFilter,
    $or: [
      { collaboratorId: null },
      ...(collaboratorId ? [{ collaboratorId }] : [])
    ]
  }).lean()

  return exceptions
}

/**
 * Horaires effectifs pour une date (sans tenir compte des prestations).
 */
async function getEffectiveDaySchedule (proId, collaboratorId, dateStr) {
  const date = parseDateOnly(dateStr)
  if (!date) return { isOpen: false, slots: [], reason: 'invalid_date' }

  const exceptions = await getExceptionsForDate(proId, collaboratorId, date)

  const closed = exceptions.find(e => e.type === 'closed')
  if (closed) {
    return {
      isOpen : false,
      slots  : [],
      reason : 'closed',
      label  : closed.label || 'Fermé'
    }
  }

  const custom = exceptions.find(e => e.type === 'custom_hours')
  if (custom) {
    return {
      isOpen : true,
      slots  : custom.slots || [],
      reason : 'custom_hours',
      label  : custom.label || 'Horaires spéciaux'
    }
  }

  const weeklyDays = await resolveWeeklyDays(proId, collaboratorId, date)
  const dow        = getDayOfWeek(date)
  const day        = weeklyDays.find(d => d.dayOfWeek === dow)

  if (!day?.isOpen || !day.slots?.length) {
    return { isOpen: false, slots: [], reason: 'weekly_closed' }
  }

  return { isOpen: true, slots: day.slots, reason: 'weekly' }
}

function isServiceBlocked (exceptions, serviceId) {
  const sid = String(serviceId)
  return exceptions.some(e =>
    e.type === 'services_unavailable' &&
    (e.serviceIds || []).some(id => String(id) === sid)
  )
}

function isDateInRange (date, startDate, endDate) {
  const t = date.getTime()
  if (startDate) {
    const s = parseDateOnly(formatDateOnly(startDate))
    if (t < s.getTime()) return false
  }
  if (endDate) {
    const e = parseDateOnly(formatDateOnly(endDate))
    if (t > e.getTime()) return false
  }
  return true
}

function constraintAppliesOnDate (constraint, date) {
  const dow = getDayOfWeek(date)
  if (constraint.repeatType === 'once') {
    if (!constraint.startDate) return false
    const start = parseDateOnly(formatDateOnly(constraint.startDate))
    const end   = constraint.endDate
      ? parseDateOnly(formatDateOnly(constraint.endDate))
      : start
    const t = date.getTime()
    return t >= start.getTime() && t <= end.getTime()
  }
  if (constraint.repeatType === 'weekly') {
    if (constraint.dayOfWeek !== dow) return false
    return isDateInRange(date, constraint.startDate, constraint.endDate)
  }
  return false
}

function getConstraintsActiveAtTime (constraints, date, startMin, endMin) {
  return constraints.filter(c => {
    if (!constraintAppliesOnDate(c, date)) return false
    const cStart = parseTimeToMinutes(c.startTime)
    const cEnd   = parseTimeToMinutes(c.endTime)
    return rangesOverlap(startMin, endMin, cStart, cEnd)
  })
}

function isServiceAllowedByConstraints (activeConstraints, serviceId) {
  if (!activeConstraints.length) return true
  const sid = String(serviceId)
  return activeConstraints.some(c =>
    (c.serviceIds || []).some(id => String(id) === sid)
  )
}

async function getConstraintsForDate (proId, collaboratorId, dateStr) {
  const date = parseDateOnly(dateStr)
  if (!date) return []
  const all = await ServiceConstraint.find({ proId, collaboratorId }).lean()
  return all.filter(c => constraintAppliesOnDate(c, date))
}

async function getCollaboratorsForService (proId, serviceId) {
  return Collaborator.find({
    proId,
    active        : true,
    accountStatus : 'active',
    serviceIds    : serviceId
  })
    .sort({ order: 1, createdAt: 1 })
    .lean()
}

/**
 * Créneaux disponibles pour 1 collaborateur + 1 prestation + 1 date.
 */
async function computeAvailableSlots ({
  proId,
  collaboratorId,
  serviceId,
  dateStr,
  now = new Date(),
  includeUnavailable = false
}) {
  const service = await Service.findOne({ _id: serviceId, proId, active: true })
  if (!service) return { slots: [], message: 'Prestation introuvable ou inactive.' }

  const collaborator = await Collaborator.findOne({
    _id: collaboratorId,
    proId,
    active: true
  })
  if (!collaborator) return { slots: [], message: 'Collaborateur introuvable.' }

  if (!collaborator.serviceIds.some(id => String(id) === String(serviceId))) {
    return { slots: [], message: 'Prestation non assignée à ce collaborateur.' }
  }

  const date = parseDateOnly(dateStr)
  if (!date) return { slots: [], message: 'Date invalide.' }

  const exceptions = await getExceptionsForDate(proId, collaboratorId, date)
  if (isServiceBlocked(exceptions, serviceId)) {
    return { slots: [], message: 'Prestation indisponible ce jour.' }
  }

  const daySchedule = await getEffectiveDaySchedule(proId, collaboratorId, dateStr)
  if (!daySchedule.isOpen || !daySchedule.slots.length) {
    return { slots: [], message: 'Fermé ce jour.' }
  }

  const serviceDuration = service.duration
  const slotStep        = getSlotStepMinutes(serviceDuration)
  const minStart = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000)
  const dayConstraints = await getConstraintsForDate(proId, collaboratorId, dateStr)
  const dayStart       = dateAtTime(dateStr, '00:00')
  const dayEnd         = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const busyRanges     = await getBusyRanges({
    proId,
    collaboratorId,
    rangeStart : dayStart,
    rangeEnd   : dayEnd
  })
  const occupiedStarts = await getOccupiedSlotStarts({
    proId,
    collaboratorId,
    rangeStart : dayStart,
    rangeEnd   : dayEnd
  })
  const slots    = []

  for (const range of daySchedule.slots) {
    const startMin = parseTimeToMinutes(range.start)
    const endMin   = parseTimeToMinutes(range.end)

    // Dernier créneau = dernière heure où la prestation se termine à la fermeture.
    // Les chevauchements RDV/holds sont exclus via busyRanges (durée exacte, sans buffer).
    for (let t = startMin; t + serviceDuration <= endMin; t += slotStep) {
      const activeConstraints = getConstraintsActiveAtTime(dayConstraints, date, t, t + serviceDuration)
      if (!isServiceAllowedByConstraints(activeConstraints, serviceId)) continue

      const slotStart = dateAtTime(dateStr, minutesToTime(t))
      const slotEnd   = new Date(slotStart.getTime() + service.duration * 60 * 1000)
      const startTime = minutesToTime(t)

      let available = true
      if (slotStart < minStart) available = false
      else if (isSlotBlockedByRanges(slotStart, slotEnd, busyRanges)) available = false

      const occupied = occupiedStarts.has(startTime)

      if (!available && !includeUnavailable) continue

      slots.push({
        start    : slotStart.toISOString(),
        end      : slotEnd.toISOString(),
        startTime,
        endTime  : minutesToTime(t + serviceDuration),
        ...(includeUnavailable ? { available, occupied } : {})
      })
    }
  }

  return {
    slots,
    duration   : service.duration,
    buffer     : BUFFER_MINUTES,
    date       : dateStr,
    message    : slots.length ? null : 'Aucun créneau disponible.'
  }
}

const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function formatDayLabel (dateStr) {
  const d = parseDateOnly(dateStr)
  if (!d) return dateStr
  const js = d.getUTCDay()
  return `${FR_DAYS[js]} ${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]}`
}

/**
 * Grille semaine Planity : créneaux par jour, tous collabs ou un seul.
 */
async function computeBookingWeek ({
  proId,
  serviceId,
  fromStr,
  days = 7,
  collaboratorId = null,
  now = new Date()
}) {
  const service = await Service.findOne({ _id: serviceId, proId, active: true }).lean()
  if (!service) {
    return { error: 'Prestation introuvable ou inactive.', days: [], collaborators: [], service: null }
  }

  let collaborators = await getCollaboratorsForService(proId, serviceId)
  if (collaboratorId) {
    collaborators = collaborators.filter(c => String(c._id) === String(collaboratorId))
  }
  if (!collaborators.length) {
    return {
      error: 'Aucun collaborateur disponible pour cette prestation.',
      days: [],
      collaborators: [],
      service: {
        _id: service._id,
        name: service.name,
        duration: service.duration,
        price: service.price
      }
    }
  }

  const from = parseDateOnly(fromStr)
  if (!from) {
    return { error: 'Date de départ invalide.', days: [], collaborators: [], service: null }
  }

  const dayResults = []
  const perDayData = []
  const cursor = new Date(from)

  for (let i = 0; i < days; i++) {
    const dateStr  = formatDateOnly(cursor)
    const perCollab = {}

    for (const collab of collaborators) {
      const result = await computeAvailableSlots({
        proId,
        collaboratorId : collab._id,
        serviceId,
        dateStr,
        now,
        includeUnavailable: true
      })
      perCollab[String(collab._id)] = result.slots
    }

    perDayData.push({
      dateStr,
      label: formatDayLabel(dateStr),
      perCollab
    })

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const weekTimesSet = new Set()
  for (const day of perDayData) {
    for (const slots of Object.values(day.perCollab)) {
      for (const slot of slots) weekTimesSet.add(slot.startTime)
    }
  }
  const weekTimes = Array.from(weekTimesSet).sort(
    (a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)
  )

  const collaboratorIds = collaborators.map(c => String(c._id))

  for (const { dateStr, label, perCollab } of perDayData) {
    const byCollaborator = {}
    for (const cid of collaboratorIds) {
      byCollaborator[cid] = weekTimes.map(time => {
        const slot = perCollab[cid]?.find(s => s.startTime === time)
        return {
          time,
          available  : slot?.available ?? false,
          inSchedule : !!slot,
          occupied   : slot?.occupied ?? false
        }
      })
    }

    dayResults.push({
      date: dateStr,
      label,
      slots: weekTimes.map(time => {
        const availableCollabs = collaboratorIds.filter(cid => {
          const s = perCollab[cid]?.find(x => x.startTime === time)
          return s?.available
        })
        const inSchedule = collaboratorIds.some(cid =>
          perCollab[cid]?.some(s => s.startTime === time)
        )
        const occupied = availableCollabs.length === 0 && collaboratorIds.some(cid => {
          const s = perCollab[cid]?.find(x => x.startTime === time)
          return s?.occupied
        })
        return {
          time,
          available: availableCollabs.length > 0,
          inSchedule,
          occupied,
          collaboratorIds: availableCollabs
        }
      }),
      byCollaborator
    })
  }

  return {
    service: {
      _id      : service._id,
      name     : service.name,
      duration : service.duration,
      price    : service.price
    },
    collaborators: collaborators.map(c => ({
      _id       : c._id,
      firstName : c.firstName,
      lastName  : c.lastName,
      photo     : c.photo,
      isOwner   : c.isOwner
    })),
    from     : fromStr,
    daysCount: days,
    weekTimes,
    days     : dayResults,
    error    : null
  }
}

/**
 * Événements FullCalendar sur une plage (ouvertures + fermetures).
 */
async function buildCalendarEvents ({ proId, collaboratorId, fromStr, toStr }) {
  const from = parseDateOnly(fromStr)
  const to   = parseDateOnly(toStr)
  if (!from || !to || to < from) return []

  const events = []
  const cursor = new Date(from)

  while (cursor <= to) {
    const dateStr    = formatDateOnly(cursor)
    const schedule   = await getEffectiveDaySchedule(proId, collaboratorId, dateStr)
    const exceptions = await getExceptionsForDate(proId, collaboratorId, cursor)

    if (!schedule.isOpen) {
      const closedEx = exceptions.find(e => e.type === 'closed')
      events.push({
        id      : `closed-${dateStr}`,
        title   : closedEx?.label || 'Fermé',
        start   : dateStr,
        allDay  : true,
        display : 'background',
        color   : '#f5e6e8',
        extendedProps: { type: 'closed' }
      })
    } else {
      for (const slot of schedule.slots) {
        events.push({
          id      : `open-${dateStr}-${slot.start}`,
          title   : '',
          start   : `${dateStr}T${slot.start}:00`,
          end     : `${dateStr}T${slot.end}:00`,
          display : 'background',
          color   : '#EADAF3',
          extendedProps: { type: 'open' }
        })
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const rangeExceptions = await ScheduleException.find({
    proId,
    startDate : { $lte: to },
    endDate   : { $gte: from },
    $or: [
      { collaboratorId: null },
      ...(collaboratorId ? [{ collaboratorId }] : [])
    ]
  }).lean()

  for (const ex of rangeExceptions) {
    if (ex.type === 'closed') continue // déjà géré jour par jour
    events.push({
      id    : `ex-${ex._id}`,
      title : ex.label || (ex.type === 'services_unavailable' ? 'Prestations indispo' : 'Exception'),
      start : ex.startDate.toISOString(),
      end   : ex.endDate.toISOString(),
      allDay: true,
      color : ex.type === 'services_unavailable' ? '#fef0e3' : '#fdecea',
      extendedProps: { type: ex.type, exceptionId: ex._id }
    })
  }

  if (collaboratorId) {
    const constraints = await ServiceConstraint.find({ proId, collaboratorId }).lean()
    const cursor2 = new Date(from)

    while (cursor2 <= to) {
      const dateStr = formatDateOnly(cursor2)
      const date    = parseDateOnly(dateStr)

      for (const c of constraints) {
        if (!constraintAppliesOnDate(c, date)) continue
        events.push({
          id    : `constraint-${c._id}-${dateStr}`,
          title : c.label || 'Prestations limitées',
          start : `${dateStr}T${c.startTime}:00`,
          end   : `${dateStr}T${c.endTime}:00`,
          color : c.color || '#D1A1C7',
          extendedProps: {
            type         : 'service_constraint',
            constraintId : c._id,
            serviceIds   : c.serviceIds
          }
        })
      }

      cursor2.setUTCDate(cursor2.getUTCDate() + 1)
    }
  }

  const bookingFilter = {
    proId,
    status : 'confirmed',
    start  : { $lt: new Date(to.getTime() + 86400000) },
    end    : { $gt: from }
  }
  if (collaboratorId) bookingFilter.collaboratorId = collaboratorId

  const bookings = await Booking.find(bookingFilter)
    .populate('clientId', 'firstName lastName phone')
    .populate('serviceId', 'name')
    .lean()

  const { formatTimeInParis } = require('./timezoneHelpers')

  for (const b of bookings) {
    const clientName = b.clientId
      ? `${b.clientId.firstName} ${b.clientId.lastName}`.trim()
      : 'Client'
    const svcName = b.serviceName || b.serviceId?.name || 'RDV'
    const timeLabel = formatTimeInParis(b.start)
    const endLabel  = formatTimeInParis(b.end)
    events.push({
      id              : `booking-${b._id}`,
      title           : `${timeLabel} · ${svcName}`,
      start           : b.start.toISOString(),
      end             : b.end.toISOString(),
      color           : '#4F3942',
      displayEventTime: false,
      classNames      : ['fc-event--booking'],
      extendedProps   : {
        type        : 'booking',
        bookingId   : String(b._id),
        serviceName : svcName,
        clientName,
        clientPhone : b.clientId?.phone || '',
        duration    : b.duration,
        price       : b.price,
        timeLabel,
        endLabel,
        startIso    : b.start.toISOString()
      }
    })
  }

  return events
}

/**
 * Plage horaire affichée dans le calendrier pro (horaires salon ± 30 min).
 */
async function computeCalendarDisplayBounds (proId, collaboratorId = null) {
  let days

  if (collaboratorId) {
    const collabSchedule = await WeeklySchedule.findOne({ proId, collaboratorId }).lean()
    days = collabSchedule?.days?.length
      ? collabSchedule.days
      : (await getOrCreateSalonSchedule(proId)).days
  } else {
    days = (await getOrCreateSalonSchedule(proId)).days
  }

  let minMin = Infinity
  let maxMin = 0

  for (const day of days || []) {
    if (!day.isOpen) continue
    for (const slot of day.slots || []) {
      const s = parseTimeToMinutes(slot.start)
      const e = parseTimeToMinutes(slot.end)
      if (s < minMin) minMin = s
      if (e > maxMin) maxMin = e
    }
  }

  if (!isFinite(minMin) || maxMin === 0) {
    return { slotMinTime: '09:00:00', slotMaxTime: '19:00:00' }
  }

  minMin = Math.max(0, minMin - 30)
  maxMin = Math.min(24 * 60, maxMin + 30)

  return {
    slotMinTime: `${minutesToTime(minMin)}:00`,
    slotMaxTime: `${minutesToTime(maxMin)}:00`
  }
}

module.exports = {
  BUFFER_MINUTES,
  MIN_ADVANCE_HOURS,
  SLOT_STEP_MINUTES,
  getSlotStepMinutes,
  DEFAULT_DAYS,
  cloneDays,
  normalizeDays,
  parseDateOnly,
  formatDateOnly,
  formatDayLabel,
  dateAtTime,
  minutesToTime,
  getOrCreateWeeklySchedule,
  getOrCreateSalonSchedule,
  getWeeklyForEditor,
  saveCollaboratorWeekly,
  resetCollaboratorWeekly,
  getEffectiveDaySchedule,
  getConstraintsForDate,
  getCollaboratorsForService,
  computeAvailableSlots,
  computeBookingWeek,
  buildCalendarEvents,
  computeCalendarDisplayBounds
}
