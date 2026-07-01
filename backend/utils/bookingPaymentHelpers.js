const { computeRemainingAmount } = require('./platformSettings')
const {
  buildValidationView,
  WORKFLOW_STATUS
} = require('./bookingValidation')

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

  const validation = buildValidationView(booking)

  if (validation.canTriggerFinalPayment) {
    return {
      status          : 'ready_for_final',
      statusLabel     : 'Solde prêt à être prélevé',
      totalPrice,
      depositAmount,
      remainingAmount,
      depositPercent  : booking.depositPercent ?? null
    }
  }

  if (validation.workflowStatus === WORKFLOW_STATUS.FINAL_PAYMENT_DONE) {
    return {
      status          : 'paid_in_full',
      statusLabel     : 'Soldé',
      totalPrice,
      depositAmount,
      remainingAmount : 0,
      depositPercent  : booking.depositPercent ?? null
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
  return buildValidationView(booking)
}

function buildDisputeInfo (booking) {
  const validation = buildValidationView(booking)

  if (validation.workflowStatus === WORKFLOW_STATUS.CONTESTATION) {
    return {
      available   : true,
      status      : 'contestation',
      statusLabel : validation.statusLabel,
      deadline    : validation.contestationEndsAt,
      canReport   : false
    }
  }

  if (validation.workflowStatus === WORKFLOW_STATUS.READY_FOR_PAYMENT) {
    return {
      available   : false,
      status      : 'closed',
      statusLabel : 'Contestation terminée',
      deadline    : null,
      canReport   : false
    }
  }

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
