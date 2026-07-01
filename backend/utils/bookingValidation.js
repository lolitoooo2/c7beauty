const CONTESTATION_HOURS = 24

const WORKFLOW_STATUS = {
  NOT_APPLICABLE     : 'not_applicable',
  PENDING_SERVICE    : 'pending_service',
  AWAITING_PRO       : 'awaiting_pro',
  AWAITING_CLIENT    : 'awaiting_client',
  CONTESTATION       : 'contestation',
  READY_FOR_PAYMENT  : 'ready_for_payment',
  FINAL_PAYMENT_DONE : 'final_payment_done'
}

const STATUS_LABELS = {
  [WORKFLOW_STATUS.NOT_APPLICABLE]     : 'Non applicable',
  [WORKFLOW_STATUS.PENDING_SERVICE]    : 'Prestation à venir',
  [WORKFLOW_STATUS.AWAITING_PRO]       : 'En attente de validation du professionnel',
  [WORKFLOW_STATUS.AWAITING_CLIENT]    : 'Validé par le professionnel',
  [WORKFLOW_STATUS.CONTESTATION]       : 'Période de contestation (24h)',
  [WORKFLOW_STATUS.READY_FOR_PAYMENT]  : 'Validations complètes · prêt pour paiement final',
  [WORKFLOW_STATUS.FINAL_PAYMENT_DONE] : 'Paiement final déclenché'
}

function needsValidationWorkflow (booking) {
  const remaining = booking.remainingAmount
  if (remaining != null && remaining > 0) return true
  if (booking.depositAmount != null && booking.price != null && booking.depositAmount < booking.price) {
    return true
  }
  return false
}

function createInitialValidation (remainingAmount) {
  if (remainingAmount > 0) {
    return {
      workflowStatus     : WORKFLOW_STATUS.PENDING_SERVICE,
      contestationEndsAt : null,
      finalPaymentAt     : null,
      disputeOpen        : false,
      history            : []
    }
  }
  return {
    workflowStatus : WORKFLOW_STATUS.NOT_APPLICABLE,
    history        : []
  }
}

function appendHistory (validation, entry) {
  if (!validation.history) validation.history = []
  validation.history.push({
    action   : entry.action,
    by       : entry.by,
    byUserId : entry.byUserId,
    at       : entry.at || new Date(),
    note     : entry.note || null
  })
}

function getStoredWorkflowStatus (booking) {
  const stored = booking.validation?.workflowStatus
  if (stored) return stored
  if (!needsValidationWorkflow(booking)) return WORKFLOW_STATUS.NOT_APPLICABLE
  return WORKFLOW_STATUS.PENDING_SERVICE
}

function getEffectiveWorkflowStatus (booking, now = new Date()) {
  if (booking.status === 'cancelled') return 'cancelled'
  if (booking.status === 'completed') return WORKFLOW_STATUS.FINAL_PAYMENT_DONE

  let status = getStoredWorkflowStatus(booking)
  const end  = new Date(booking.end)

  if (status === WORKFLOW_STATUS.PENDING_SERVICE && now >= end) {
    status = WORKFLOW_STATUS.AWAITING_PRO
  }

  if (status === WORKFLOW_STATUS.CONTESTATION) {
    const deadline = booking.validation?.contestationEndsAt
    if (deadline && now >= new Date(deadline) && !booking.validation?.disputeOpen) {
      status = WORKFLOW_STATUS.READY_FOR_PAYMENT
    }
  }

  return status
}

function getWorkflowStatusLabel (status, booking = null) {
  if (status === 'cancelled') return 'Annulé'
  if (status === WORKFLOW_STATUS.AWAITING_CLIENT) {
    return 'Validé par le professionnel · en attente du client'
  }
  if (status === WORKFLOW_STATUS.CONTESTATION && booking?.validation?.contestationEndsAt) {
    const d = new Date(booking.validation.contestationEndsAt).toLocaleString('fr-FR', {
      timeZone : 'Europe/Paris',
      day      : 'numeric',
      month    : 'long',
      hour     : '2-digit',
      minute   : '2-digit'
    })
    return `Période de contestation jusqu'au ${d}`
  }
  return STATUS_LABELS[status] || status
}

function persistWorkflowTransition (booking, { workflowStatus, contestationEndsAt, finalPaymentAt, historyEntry }) {
  if (!booking.validation) {
    booking.validation = createInitialValidation(booking.remainingAmount ?? 0)
  }
  if (workflowStatus) booking.validation.workflowStatus = workflowStatus
  if (contestationEndsAt !== undefined) booking.validation.contestationEndsAt = contestationEndsAt
  if (finalPaymentAt !== undefined) booking.validation.finalPaymentAt = finalPaymentAt
  if (historyEntry) appendHistory(booking.validation, historyEntry)
}

async function syncPersistedWorkflow (booking) {
  if (!needsValidationWorkflow(booking)) return booking

  const now      = new Date()
  const stored   = getStoredWorkflowStatus(booking)
  const effective = getEffectiveWorkflowStatus(booking, now)

  if (stored === WORKFLOW_STATUS.PENDING_SERVICE && effective === WORKFLOW_STATUS.AWAITING_PRO) {
    persistWorkflowTransition(booking, { workflowStatus: WORKFLOW_STATUS.AWAITING_PRO })
    await booking.save()
    return booking
  }

  if (
    stored === WORKFLOW_STATUS.CONTESTATION
    && effective === WORKFLOW_STATUS.READY_FOR_PAYMENT
  ) {
    persistWorkflowTransition(booking, {
      workflowStatus : WORKFLOW_STATUS.READY_FOR_PAYMENT,
      historyEntry   : {
        action : 'ready_for_payment',
        by     : 'system',
        at     : now,
        note   : 'Fin de la période de contestation'
      }
    })
    await booking.save()
  }

  return booking
}

function assertServiceEnded (booking) {
  if (new Date() < new Date(booking.end)) {
    const err = new Error('La prestation n\'est pas encore terminée.')
    err.status = 400
    throw err
  }
}

async function validateByPro ({ booking, proId }) {
  if (String(booking.proId) !== String(proId)) {
    const err = new Error('Réservation introuvable.')
    err.status = 404
    throw err
  }
  if (booking.status !== 'confirmed') {
    const err = new Error('Cette réservation ne peut pas être validée.')
    err.status = 400
    throw err
  }
  if (!needsValidationWorkflow(booking)) {
    const err = new Error('Aucun solde en attente sur cette réservation.')
    err.status = 400
    throw err
  }

  await syncPersistedWorkflow(booking)
  assertServiceEnded(booking)

  const status = getEffectiveWorkflowStatus(booking)
  if (status !== WORKFLOW_STATUS.AWAITING_PRO) {
    const err = new Error('Cette prestation n\'est pas en attente de validation professionnelle.')
    err.status = 409
    throw err
  }

  persistWorkflowTransition(booking, {
    workflowStatus : WORKFLOW_STATUS.AWAITING_CLIENT,
    historyEntry   : {
      action   : 'pro_validated',
      by       : 'pro',
      byUserId : proId
    }
  })
  await booking.save()
  return booking
}

async function validateByClient ({ booking, clientId }) {
  if (String(booking.clientId) !== String(clientId)) {
    const err = new Error('Réservation introuvable.')
    err.status = 404
    throw err
  }
  if (booking.status !== 'confirmed') {
    const err = new Error('Cette réservation ne peut pas être validée.')
    err.status = 400
    throw err
  }
  if (!needsValidationWorkflow(booking)) {
    const err = new Error('Aucun solde en attente sur cette réservation.')
    err.status = 400
    throw err
  }

  await syncPersistedWorkflow(booking)
  assertServiceEnded(booking)

  const status = getEffectiveWorkflowStatus(booking)
  if (status !== WORKFLOW_STATUS.AWAITING_CLIENT) {
    const err = new Error('En attente de la validation du professionnel.')
    err.status = 409
    throw err
  }

  const contestationEndsAt = new Date(Date.now() + CONTESTATION_HOURS * 60 * 60 * 1000)

  persistWorkflowTransition(booking, {
    workflowStatus     : WORKFLOW_STATUS.CONTESTATION,
    contestationEndsAt,
    historyEntry       : {
      action   : 'client_validated',
      by       : 'client',
      byUserId : clientId
    }
  })
  appendHistory(booking.validation, {
    action : 'contestation_started',
    by     : 'system',
    at     : new Date(),
    note   : `Période de ${CONTESTATION_HOURS}h`
  })

  await booking.save()
  return booking
}

function canTriggerFinalPayment (booking) {
  if (!needsValidationWorkflow(booking)) return false
  if (booking.validation?.disputeOpen) return false
  const status = getEffectiveWorkflowStatus(booking)
  return status === WORKFLOW_STATUS.READY_FOR_PAYMENT
}

function buildValidationView (booking) {
  if (booking.status === 'cancelled') {
    return {
      workflowStatus       : 'cancelled',
      statusLabel          : 'Annulé',
      canValidateAsPro     : false,
      canValidateAsClient  : false,
      contestationEndsAt   : null,
      canTriggerFinalPayment: false,
      history              : booking.validation?.history || []
    }
  }

  if (!needsValidationWorkflow(booking)) {
    return {
      workflowStatus        : WORKFLOW_STATUS.NOT_APPLICABLE,
      statusLabel           : STATUS_LABELS[WORKFLOW_STATUS.NOT_APPLICABLE],
      canValidateAsPro      : false,
      canValidateAsClient   : false,
      contestationEndsAt    : null,
      canTriggerFinalPayment: false,
      history               : booking.validation?.history || []
    }
  }

  const effective = getEffectiveWorkflowStatus(booking)
  const ended     = new Date() >= new Date(booking.end)

  return {
    workflowStatus         : effective,
    statusLabel            : getWorkflowStatusLabel(effective, booking),
    canValidateAsPro       : booking.status === 'confirmed'
      && ended
      && effective === WORKFLOW_STATUS.AWAITING_PRO,
    canValidateAsClient    : booking.status === 'confirmed'
      && ended
      && effective === WORKFLOW_STATUS.AWAITING_CLIENT,
    contestationEndsAt     : booking.validation?.contestationEndsAt || null,
    canTriggerFinalPayment : canTriggerFinalPayment(booking),
    history                : (booking.validation?.history || []).map(h => ({
      action : h.action,
      by     : h.by,
      at     : h.at,
      note   : h.note || null
    }))
  }
}

module.exports = {
  CONTESTATION_HOURS,
  WORKFLOW_STATUS,
  needsValidationWorkflow,
  createInitialValidation,
  getEffectiveWorkflowStatus,
  validateByPro,
  validateByClient,
  canTriggerFinalPayment,
  buildValidationView,
  syncPersistedWorkflow
}
