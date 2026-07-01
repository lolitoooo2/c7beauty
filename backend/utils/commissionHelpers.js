const Booking = require('../models/Booking')

const COMMISSION_CONTEXT = {
  DEPOSIT : 'deposit',
  BALANCE : 'balance',
  NO_SHOW : 'no_show'
}

const CONTEXT_LABELS = {
  [COMMISSION_CONTEXT.DEPOSIT] : 'Acompte',
  [COMMISSION_CONTEXT.BALANCE] : 'Solde',
  [COMMISSION_CONTEXT.NO_SHOW] : 'No-show'
}

function roundEur (value) {
  return Math.round(value * 100) / 100
}

function computeCommissionSplit (amountEur, commissionPercent) {
  const rate = commissionPercent / 100
  const platformCommission = roundEur(amountEur * rate)
  const proShare           = roundEur(amountEur - platformCommission)
  return { platformCommission, proShare }
}

function buildPaymentCommission ({
  amountEur,
  commissionPercent,
  context = COMMISSION_CONTEXT.DEPOSIT
}) {
  const amount = roundEur(Number(amountEur) || 0)
  if (amount <= 0) {
    return {
      context,
      amountEur           : 0,
      commissionPercent,
      platformCommission  : 0,
      proShare            : 0
    }
  }

  const { platformCommission, proShare } = computeCommissionSplit(amount, commissionPercent)
  return {
    context,
    amountEur : amount,
    commissionPercent,
    platformCommission,
    proShare
  }
}

function paymentContextFromPayment (payment) {
  if (payment.commissionContext === COMMISSION_CONTEXT.NO_SHOW) {
    return COMMISSION_CONTEXT.NO_SHOW
  }
  if (payment.paymentPhase === 'balance') return COMMISSION_CONTEXT.BALANCE
  return COMMISSION_CONTEXT.DEPOSIT
}

function ensureFinancial (booking) {
  if (!booking.financial) {
    booking.financial = {
      totalCollected         : 0,
      totalPlatformCommission: 0,
      totalProShare          : 0,
      history                : []
    }
  }
  if (!booking.financial.history) booking.financial.history = []
}

function hasCommissionEntry (booking, paymentId) {
  return booking.financial?.history?.some(
    h => h.paymentId && String(h.paymentId) === String(paymentId)
  )
}

async function recordCommissionOnBooking (booking, entry) {
  ensureFinancial(booking)

  if (entry.paymentId && hasCommissionEntry(booking, entry.paymentId)) {
    return booking
  }

  booking.financial.totalCollected          = roundEur(booking.financial.totalCollected + entry.amount)
  booking.financial.totalPlatformCommission = roundEur(
    booking.financial.totalPlatformCommission + entry.platformCommission
  )
  booking.financial.totalProShare = roundEur(
    booking.financial.totalProShare + entry.proShare
  )

  booking.financial.history.push({
    context            : entry.context,
    contextLabel       : CONTEXT_LABELS[entry.context] || entry.context,
    amount             : entry.amount,
    commissionPercent  : entry.commissionPercent,
    platformCommission : entry.platformCommission,
    proShare           : entry.proShare,
    paymentId          : entry.paymentId || null,
    at                 : entry.at || new Date()
  })

  await booking.save()
  return booking
}

async function recordCommissionForPayment ({ booking, payment }) {
  if (!booking || !payment || payment.status !== 'succeeded') return booking

  const context = paymentContextFromPayment(payment)
  return recordCommissionOnBooking(booking, {
    context,
    amount             : payment.amount,
    commissionPercent  : payment.commissionPercent,
    platformCommission : payment.platformCommission,
    proShare           : payment.proShare,
    paymentId          : payment._id
  })
}

function buildCommissionView (booking) {
  const financial = booking.financial
  if (!financial?.history?.length) return null

  return {
    totalCollected         : financial.totalCollected ?? 0,
    totalPlatformCommission: financial.totalPlatformCommission ?? 0,
    totalProShare          : financial.totalProShare ?? 0,
    history                : financial.history.map(h => ({
      context            : h.context,
      contextLabel       : h.contextLabel || CONTEXT_LABELS[h.context] || h.context,
      amount             : h.amount,
      commissionPercent  : h.commissionPercent,
      platformCommission : h.platformCommission,
      proShare           : h.proShare,
      at                 : h.at
    }))
  }
}

module.exports = {
  COMMISSION_CONTEXT,
  CONTEXT_LABELS,
  computeCommissionSplit,
  buildPaymentCommission,
  paymentContextFromPayment,
  recordCommissionOnBooking,
  recordCommissionForPayment,
  buildCommissionView
}
