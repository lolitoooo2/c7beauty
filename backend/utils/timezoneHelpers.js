/** Fuseau horaire des salons (France métropolitaine). */
const SALON_TZ = 'Europe/Paris'

/**
 * Convertit une date + heure « mur » Paris en instant UTC (Date).
 * Ex. 2026-06-10 14:30 Paris → 2026-06-10T12:30:00.000Z (CEST).
 */
function dateAtTimeInParis (dateStr, timeStr) {
  const d = String(dateStr).slice(0, 10)
  const t = String(timeStr).slice(0, 5)
  const [year, month, day] = d.split('-').map(Number)
  const [hour, minute] = t.split(':').map(Number)

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const guess    = new Date(utcGuess)

  const localInParis = guess.toLocaleString('sv-SE', { timeZone: SALON_TZ })
  const targetLocal  = `${d} ${t}:00`
  const localMs      = Date.parse(`${localInParis.replace(' ', 'T')}Z`)
  const targetMs     = Date.parse(`${targetLocal.replace(' ', 'T')}Z`)
  const diff         = targetMs - localMs

  return new Date(utcGuess + diff)
}

function formatTimeInParis (date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone : SALON_TZ,
    hour     : '2-digit',
    minute   : '2-digit',
    hour12   : false
  }).formatToParts(date)

  const hh = parts.find(p => p.type === 'hour')?.value ?? '00'
  const mm = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${hh}:${mm}`
}

function formatDateOnlyInParis (date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SALON_TZ }).format(date)
}

function parseDateOnlyParis (dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  return { year: y, month: m, day: d }
}

function addDaysToDateStr (dateStr, days) {
  const { year, month, day } = parseDateOnlyParis(dateStr)
  const dt = new Date(Date.UTC(year, month - 1, day + days))
  return dt.toISOString().slice(0, 10)
}

function getWeekdayParis (date = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: SALON_TZ, weekday: 'short' }).format(date)
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[wd] ?? 0
}

/** Bornes [début, fin[ d'une journée, semaine (lun→dim) ou mois en Europe/Paris. */
function getPeriodBoundsParis (period, date = new Date()) {
  const todayStr = formatDateOnlyInParis(date)

  if (period === 'day') {
    const nextStr = addDaysToDateStr(todayStr, 1)
    return {
      start : dateAtTimeInParis(todayStr, '00:00'),
      end   : dateAtTimeInParis(nextStr, '00:00')
    }
  }

  if (period === 'week') {
    const weekday   = getWeekdayParis(date)
    const mondayStr = addDaysToDateStr(todayStr, -weekday)
    const nextMonday = addDaysToDateStr(mondayStr, 7)
    return {
      start : dateAtTimeInParis(mondayStr, '00:00'),
      end   : dateAtTimeInParis(nextMonday, '00:00')
    }
  }

  if (period === 'month') {
    const { year, month } = parseDateOnlyParis(todayStr)
    const nextMonth = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    return {
      start : dateAtTimeInParis(monthStart, '00:00'),
      end   : dateAtTimeInParis(nextMonth, '00:00')
    }
  }

  throw new Error(`Période inconnue: ${period}`)
}

module.exports = {
  SALON_TZ,
  dateAtTimeInParis,
  formatTimeInParis,
  formatDateOnlyInParis,
  getPeriodBoundsParis
}
