const Booking  = require('../models/Booking')
const Client   = require('../models/Client')
const EmailLog = require('../models/EmailLog')
const { sendEmail, getFrontendUrl } = require('./emailService')
const { bookingConfirmationEmail } = require('./emailTemplates')

function buildSalonAddress (pro) {
  if (!pro) return ''
  const parts = [pro.address, pro.postalCode, pro.city].filter(Boolean)
  return parts.join(', ')
}

function buildCollaboratorName (collaborator) {
  if (!collaborator) return ''
  return [collaborator.firstName, collaborator.lastName].filter(Boolean).join(' ')
}

async function loadBookingForEmail (bookingId) {
  return Booking.findById(bookingId)
    .populate('proId', 'salonName address city postalCode')
    .populate('collaboratorId', 'firstName lastName photo')
    .lean()
}

async function wasBookingConfirmationSent (bookingId) {
  const existing = await EmailLog.findOne({
    type   : 'booking_confirmation',
    status : 'sent',
    'meta.bookingId' : String(bookingId)
  }).select('_id')
  return Boolean(existing)
}

async function sendBookingConfirmationEmail ({ booking, client }) {
  if (!client?.email) {
    console.warn('[email] booking_confirmation — client sans email')
    return { ok: false, skipped: true }
  }

  const pro = booking.proId && typeof booking.proId === 'object' ? booking.proId : null
  const collaborator = booking.collaboratorId && typeof booking.collaboratorId === 'object'
    ? booking.collaboratorId
    : null

  const { subject, html, text } = bookingConfirmationEmail({
    firstName        : client.firstName,
    salonName        : pro?.salonName || 'votre salon',
    salonAddress     : buildSalonAddress(pro),
    serviceName      : booking.serviceName,
    duration         : booking.duration,
    start            : booking.start,
    price            : booking.price,
    originalPrice    : booking.originalPrice,
    discountPercent  : booking.discountPercent || 0,
    collaboratorName : buildCollaboratorName(collaborator),
    dashboardUrl     : `${getFrontendUrl()}/espace-client`
  })

  return sendEmail({
    to      : client.email,
    subject,
    html,
    text,
    type    : 'booking_confirmation',
    meta    : {
      bookingId : String(booking._id),
      clientId  : String(client._id || booking.clientId)
    }
  })
}

/**
 * Envoie l'email de confirmation si pas déjà envoyé (idempotent).
 * Appelé automatiquement à chaque confirmation de RDV.
 */
async function ensureBookingConfirmationEmailSent (bookingOrId, client = null) {
  const bookingId = bookingOrId?._id || bookingOrId
  if (!bookingId) return { ok: false, skipped: true }

  if (await wasBookingConfirmationSent(bookingId)) {
    return { ok: true, alreadySent: true }
  }

  const booking = bookingOrId?.serviceName
    ? bookingOrId
    : await loadBookingForEmail(bookingId)

  if (!booking || booking.status !== 'confirmed') {
    return { ok: false, skipped: true }
  }

  const recipient = client || await Client.findById(booking.clientId)
  const result = await sendBookingConfirmationEmail({ booking, client: recipient })

  if (result.ok) {
    console.log(`[email] booking_confirmation envoyé → ${recipient?.email} (RDV ${bookingId})`)
  }

  return result
}

module.exports = {
  sendBookingConfirmationEmail,
  ensureBookingConfirmationEmailSent,
  wasBookingConfirmationSent
}
