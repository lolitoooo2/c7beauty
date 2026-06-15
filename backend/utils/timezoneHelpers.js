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

module.exports = {
  SALON_TZ,
  dateAtTimeInParis,
  formatTimeInParis,
  formatDateOnlyInParis
}
