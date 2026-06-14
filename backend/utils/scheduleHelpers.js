const WeeklySchedule    = require('../models/WeeklySchedule')
const SchedulePeriod    = require('../models/SchedulePeriod')
const ScheduleException = require('../models/ScheduleException')
const Service           = require('../models/Service')
const Collaborator      = require('../models/Collaborator')

const BUFFER_MINUTES     = 5
const MIN_ADVANCE_HOURS  = 2

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
  const base = parseDateOnly(dateOnly)
  const mins = parseTimeToMinutes(time)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    h, m, 0, 0
  ))
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

/**
 * Créneaux disponibles pour 1 collaborateur + 1 prestation + 1 date.
 */
async function computeAvailableSlots ({
  proId,
  collaboratorId,
  serviceId,
  dateStr,
  now = new Date()
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

  const duration = service.duration + BUFFER_MINUTES
  const minStart = new Date(now.getTime() + MIN_ADVANCE_HOURS * 60 * 60 * 1000)
  const slots    = []

  for (const range of daySchedule.slots) {
    const startMin = parseTimeToMinutes(range.start)
    const endMin     = parseTimeToMinutes(range.end)

    for (let t = startMin; t + duration <= endMin; t += duration) {
      const slotStart = dateAtTime(dateStr, minutesToTime(t))
      const slotEnd   = new Date(slotStart.getTime() + service.duration * 60 * 1000)

      if (slotStart < minStart) continue

      slots.push({
        start    : slotStart.toISOString(),
        end      : slotEnd.toISOString(),
        startTime: minutesToTime(t),
        endTime  : minutesToTime(t + service.duration)
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
          id    : `open-${dateStr}-${slot.start}`,
          title : schedule.label || 'Ouvert',
          start : `${dateStr}T${slot.start}:00`,
          end   : `${dateStr}T${slot.end}:00`,
          color : '#EADAF3',
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

  return events
}

module.exports = {
  BUFFER_MINUTES,
  MIN_ADVANCE_HOURS,
  DEFAULT_DAYS,
  cloneDays,
  normalizeDays,
  parseDateOnly,
  formatDateOnly,
  getOrCreateWeeklySchedule,
  getOrCreateSalonSchedule,
  getWeeklyForEditor,
  saveCollaboratorWeekly,
  resetCollaboratorWeekly,
  getEffectiveDaySchedule,
  computeAvailableSlots,
  buildCalendarEvents
}
