const Payment = require('../models/Payment')
const { getPlatformSettings } = require('./platformSettings')
const {
  buildPaymentCommission,
  recordCommissionOnBooking,
  COMMISSION_CONTEXT,
  CONTEXT_LABELS
} = require('./commissionHelpers')

const CANCELLATION_FORFEIT_MS = 24 * 60 * 60 * 1000

const NO_SHOW_TRIGGER = {
  CLIENT_ABSENT       : 'client_absent',
  LATE_CANCELLATION   : 'late_cancellation'
}

const TRIGGER_LABELS = {
  [NO_SHOW_TRIGGER.CLIENT_ABSENT]     : 'Client absent',
  [NO_SHOW_TRIGGER.LATE_CANCELLATION] : 'Annulation à moins de 24 h'
}

function isLateCancellation (booking, now = new Date()) {
  if (!booking?.start) return false
  const start = new Date(booking.start)
  if (start <= now) return false
  return (start.getTime() - now.getTime()) < CANCELLATION_FORFEIT_MS
}

function hasPaidDeposit (booking) {
  if (booking.depositAmount != null && booking.depositAmount > 0) return true
  if (booking.depositPercent != null && booking.depositPercent > 0 && booking.depositPercent < 100) {
    return true
  }
  return false
}

function isNoShowSettled (booking) {
  return Boolean(booking.noShow?.settledAt)
}

function canMarkNoShow (booking, now = new Date()) {
  if (booking.status !== 'confirmed') return false
  if (isNoShowSettled(booking)) return false
  if (!hasPaidDeposit(booking)) return false
  return now >= new Date(booking.end)
}

async function findDepositPayment (bookingId) {
  let payment = await Payment.findOne({
    bookingId    : bookingId,
    paymentPhase : 'deposit',
    status       : 'succeeded'
  }).sort({ createdAt: 1 })

  if (!payment) {
    payment = await Payment.findOne({
      bookingId : bookingId,
      status    : 'succeeded'
    }).sort({ createdAt: 1 })
  }

  return payment
}

function appendNoShowHistory (booking, entry) {
  if (!booking.noShow) booking.noShow = { history: [] }
  if (!booking.noShow.history) booking.noShow.history = []
  booking.noShow.history.push({
    action   : entry.action,
    by       : entry.by,
    byUserId : entry.byUserId || null,
    at       : entry.at || new Date(),
    note     : entry.note || null
  })
}

function appendValidationNote (booking, entry) {
  if (!booking.validation) booking.validation = { history: [] }
  if (!booking.validation.history) booking.validation.history = []
  booking.validation.history.push({
    action   : entry.action,
    by       : entry.by,
    byUserId : entry.byUserId || null,
    at       : entry.at || new Date(),
    note     : entry.note || null
  })
}

async function settleNoShowDeposit ({
  booking,
  trigger,
  markedBy,
  byUserId = null,
  note = null
}) {
  if (isNoShowSettled(booking)) {
    const err = new Error('Le règlement no-show a déjà été effectué.')
    err.status = 409
    throw err
  }

  if (!hasPaidDeposit(booking)) {
    const err = new Error('Aucun acompte à conserver sur cette réservation.')
    err.status = 400
    throw err
  }

  const depositPayment = await findDepositPayment(booking._id)
  if (!depositPayment) {
    const err = new Error('Paiement d\'acompte introuvable.')
    err.status = 400
    throw err
  }

  const settings = await getPlatformSettings()
  const commissionPercent = depositPayment.commissionPercent ?? settings.commissionPercent
  const split = buildPaymentCommission({
    amountEur         : depositPayment.amount,
    commissionPercent,
    context           : COMMISSION_CONTEXT.NO_SHOW
  })

  await recordCommissionOnBooking(booking, {
    context            : COMMISSION_CONTEXT.DEPOSIT,
    amount             : depositPayment.amount,
    commissionPercent  : depositPayment.commissionPercent ?? commissionPercent,
    platformCommission : depositPayment.platformCommission ?? split.platformCommission,
    proShare           : depositPayment.proShare ?? split.proShare,
    paymentId          : depositPayment._id
  })

  if (!booking.financial) booking.financial = { history: [] }
  if (!booking.financial.history) booking.financial.history = []

  booking.financial.history.push({
    context            : 'no_show_settlement',
    contextLabel       : 'Règlement no-show',
    amount             : depositPayment.amount,
    commissionPercent  : depositPayment.commissionPercent ?? commissionPercent,
    platformCommission : depositPayment.platformCommission ?? split.platformCommission,
    proShare           : depositPayment.proShare ?? split.proShare,
    paymentId          : depositPayment._id,
    at                 : new Date()
  })

  booking.noShow = {
    status             : trigger,
    settledAt          : new Date(),
    markedBy,
    depositKept        : depositPayment.amount,
    commissionPercent  : depositPayment.commissionPercent ?? commissionPercent,
    platformCommission : depositPayment.platformCommission ?? split.platformCommission,
    proShare           : depositPayment.proShare ?? split.proShare,
    history            : booking.noShow?.history || []
  }

  appendNoShowHistory(booking, {
    action : 'settled',
    by     : markedBy,
    byUserId,
    note   : note || TRIGGER_LABELS[trigger] || trigger
  })

  appendValidationNote(booking, {
    action   : 'no_show_settled',
    by       : markedBy,
    byUserId,
    note     : note || `Acompte ${depositPayment.amount.toFixed(2)} € conservé · pro ${split.proShare.toFixed(2)} €`
  })

  booking.remainingAmount = 0
  if (booking.validation) {
    booking.validation.workflowStatus = 'not_applicable'
  }

  await booking.save()
  return booking
}

async function markNoShowByPro ({ booking, proId }) {
  if (String(booking.proId) !== String(proId)) {
    const err = new Error('Réservation introuvable.')
    err.status = 404
    throw err
  }

  if (!canMarkNoShow(booking)) {
    const err = new Error('Ce rendez-vous ne peut pas être signalé en no-show.')
    err.status = 409
    throw err
  }

  await settleNoShowDeposit({
    booking,
    trigger  : NO_SHOW_TRIGGER.CLIENT_ABSENT,
    markedBy : 'pro',
    byUserId : proId,
    note     : 'Client absent signalé par le professionnel'
  })

  booking.status = 'completed'
  await booking.save()
  return booking
}

async function applyLateCancellationForfeit ({ booking, cancelledBy }) {
  await settleNoShowDeposit({
    booking,
    trigger  : NO_SHOW_TRIGGER.LATE_CANCELLATION,
    markedBy : 'system',
    note     : `Annulation ${cancelledBy} à moins de 24 h avant le rendez-vous`
  })

  booking.status      = 'cancelled'
  booking.cancelledAt = new Date()
  booking.cancelledBy = cancelledBy
  await booking.save()
  return booking
}

module.exports = {
  CANCELLATION_FORFEIT_MS,
  NO_SHOW_TRIGGER,
  TRIGGER_LABELS,
  isLateCancellation,
  hasPaidDeposit,
  isNoShowSettled,
  canMarkNoShow,
  settleNoShowDeposit,
  markNoShowByPro,
  applyLateCancellationForfeit
}
