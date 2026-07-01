const { computeRemainingAmount } = require('./platformSettings')

function resolveRemainingAmount (booking) {
  if (booking.remainingAmount != null) return booking.remainingAmount
  if (booking.depositAmount != null && booking.price != null) {
    return computeRemainingAmount(booking.price, booking.depositAmount)
  }
  return null
}

function buildPaymentSummary (booking) {
  const remainingAmount = resolveRemainingAmount(booking)
  const depositAmount   = booking.depositAmount ?? null
  const totalPrice      = booking.price

  if (booking.status === 'cancelled') {
    return {
      status          : 'cancelled',
      statusLabel     : 'Paiement annulé',
      totalPrice,
      depositAmount,
      remainingAmount,
      depositPercent  : booking.depositPercent ?? null
    }
  }

  if (depositAmount == null && remainingAmount == null) {
    return {
      status          : 'legacy_paid',
      statusLabel     : 'Payé intégralement',
      totalPrice,
      depositAmount   : totalPrice,
      remainingAmount : 0,
      depositPercent  : 100
    }
  }

  if (remainingAmount > 0) {
    return {
      status          : 'deposit_paid',
      statusLabel     : 'Acompte payé · solde en attente',
      totalPrice,
      depositAmount,
      remainingAmount,
      depositPercent  : booking.depositPercent ?? null
    }
  }

  return {
    status          : 'paid_in_full',
    statusLabel     : 'Soldé',
    totalPrice,
    depositAmount,
    remainingAmount : 0,
    depositPercent  : booking.depositPercent ?? null
  }
}

function buildServiceValidation (booking) {
  if (booking.status === 'cancelled') {
    return { status: 'cancelled', statusLabel: 'Annulé', canValidate: false }
  }
  if (booking.status === 'completed') {
    return { status: 'validated', statusLabel: 'Prestation validée', canValidate: false }
  }
  if (new Date(booking.start) > new Date()) {
    return { status: 'upcoming', statusLabel: 'Prestation à venir', canValidate: false }
  }
  return {
    status        : 'awaiting_validation',
    statusLabel   : 'En attente de validation',
    canValidate   : false
  }
}

function buildDisputeInfo () {
  return {
    available   : false,
    status      : 'not_started',
    statusLabel : 'Contestation indisponible',
    deadline    : null,
    canReport   : false
  }
}

function buildNoShowInfo (booking) {
  if (booking.status === 'cancelled') {
    return { status: 'cancelled', statusLabel: '—', canMark: false }
  }
  if (new Date(booking.start) > new Date()) {
    return { status: 'upcoming', statusLabel: '—', canMark: false }
  }
  return {
    status      : 'none',
    statusLabel : 'Non signalé',
    canMark     : false
  }
}

function enrichBooking (base, raw) {
  return {
    ...base,
    payment           : buildPaymentSummary(raw),
    serviceValidation : buildServiceValidation(raw),
    dispute           : buildDisputeInfo(raw),
    noShow            : buildNoShowInfo(raw)
  }
}

module.exports = {
  resolveRemainingAmount,
  buildPaymentSummary,
  buildServiceValidation,
  buildDisputeInfo,
  buildNoShowInfo,
  enrichBooking
}
