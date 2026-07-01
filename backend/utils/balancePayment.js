const Booking = require('../models/Booking')
const Payment = require('../models/Payment')
const Client = require('../models/Client')
const { resolveRemainingAmount } = require('./bookingPaymentHelpers')
const { getPlatformSettings } = require('./platformSettings')
const { getStripe, isStripeEnabled, eurosToCents } = require('./stripeHelpers')
const {
  buildPaymentCommission,
  recordCommissionForPayment,
  COMMISSION_CONTEXT
} = require('./commissionHelpers')
const { resolveOffSessionPaymentMethod } = require('./stripeCustomer')
const {
  WORKFLOW_STATUS,
  canTriggerFinalPayment,
  syncPersistedWorkflow
} = require('./bookingValidation')

const MIN_RETRY_MS         = 15 * 60 * 1000
const PENDING_STALE_MS     = 2 * 60 * 1000

function ensureValidation (booking) {
  if (!booking.validation) booking.validation = { history: [] }
  if (!booking.validation.history) booking.validation.history = []
}

function recordBalanceAttempt (booking, { success, note }) {
  ensureValidation(booking)
  booking.validation.balanceChargeAttempts = (booking.validation.balanceChargeAttempts || 0) + 1
  booking.validation.balanceChargeLastAttemptAt = new Date()
  booking.validation.balanceChargeLastError = success ? null : (note || 'Erreur inconnue')
  booking.validation.history.push({
    action : success ? 'balance_payment_succeeded' : 'balance_payment_failed',
    by     : 'system',
    at     : new Date(),
    note   : note || null
  })
}

function finalizeBookingAfterBalance (booking) {
  ensureValidation(booking)
  booking.remainingAmount = 0
  booking.validation.workflowStatus = WORKFLOW_STATUS.FINAL_PAYMENT_DONE
  booking.validation.finalPaymentAt = new Date()
  booking.validation.balanceChargeLastError = null
  booking.status = 'completed'
}

async function findDepositPayment (bookingId) {
  let depositPayment = await Payment.findOne({
    bookingId    : bookingId,
    paymentPhase : 'deposit',
    status       : 'succeeded'
  }).sort({ createdAt: 1 })

  if (!depositPayment) {
    depositPayment = await Payment.findOne({
      bookingId : bookingId,
      status    : 'succeeded'
    }).sort({ createdAt: 1 })
  }

  return depositPayment
}

async function resolveStalePendingBalance (bookingId) {
  const pending = await Payment.findOne({
    bookingId    : bookingId,
    paymentPhase : 'balance',
    status       : 'pending'
  }).sort({ createdAt: -1 })

  if (!pending) return null

  const age = Date.now() - new Date(pending.createdAt).getTime()
  if (age < PENDING_STALE_MS) {
    return { blocked: true, reason: 'charge_in_progress' }
  }

  pending.status        = 'failed'
  pending.failureReason = 'Tentative expirée sans confirmation'
  await pending.save()
  return null
}

async function nextChargeAttemptNumber (bookingId) {
  const last = await Payment.findOne({
    bookingId    : bookingId,
    paymentPhase : 'balance'
  }).sort({ createdAt: -1 })
  return last?.chargeAttempt ? last.chargeAttempt + 1 : 1
}

async function createBalancePaymentDraft ({
  booking,
  depositPayment,
  balanceAmount,
  commissionPercent,
  platformCommission,
  proShare,
  chargeAttempt
}) {
  return Payment.create({
    holdId                : depositPayment.holdId,
    bookingId             : booking._id,
    clientId              : booking.clientId,
    proId                 : booking.proId,
    serviceId             : booking.serviceId,
    stripeSessionId       : `balance_${booking._id}_${Date.now()}_${chargeAttempt}`,
    amount                : balanceAmount,
    amountCents           : eurosToCents(balanceAmount),
    totalPrice            : booking.price,
    depositPercent        : 0,
    remainingAmount       : 0,
    originalPrice         : depositPayment.originalPrice ?? booking.price,
    discountPercent       : depositPayment.discountPercent ?? 0,
    commissionPercent,
    platformCommission,
    proShare,
    commissionContext     : COMMISSION_CONTEXT.BALANCE,
    halfPriceApplied      : depositPayment.halfPriceApplied ?? false,
    status                : 'pending',
    paymentPhase          : 'balance',
    chargeAttempt
  })
}

async function chargeBalanceWithStripe ({
  booking,
  depositPayment,
  balanceAmount,
  commissionPercent,
  platformCommission,
  proShare,
  chargeAttempt
}) {
  const stripe = getStripe()
  if (!stripe) return { ok: false, reason: 'stripe_unavailable' }

  const client = await Client.findById(booking.clientId)
  if (!client) return { ok: false, reason: 'client_not_found' }

  const { customerId, paymentMethodId } = await resolveOffSessionPaymentMethod({
    stripe,
    client,
    depositPaymentIntentId : depositPayment.stripePaymentIntentId
  })

  if (!customerId) {
    recordBalanceAttempt(booking, {
      success : false,
      note    : 'Client Stripe introuvable — réessayez après un nouvel acompte'
    })
    await booking.save()
    return { ok: false, reason: 'no_stripe_customer' }
  }

  if (!paymentMethodId) {
    recordBalanceAttempt(booking, {
      success : false,
      note    : 'Moyen de paiement introuvable pour le prélèvement du solde'
    })
    await booking.save()
    return { ok: false, reason: 'no_payment_method' }
  }

  const balancePayment = await createBalancePaymentDraft({
    booking,
    depositPayment,
    balanceAmount,
    commissionPercent,
    platformCommission,
    proShare,
    chargeAttempt
  })

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount         : eurosToCents(balanceAmount),
      currency       : 'eur',
      customer       : customerId,
      payment_method : paymentMethodId,
      off_session    : true,
      confirm        : true,
      metadata       : {
        bookingId    : String(booking._id),
        paymentId    : String(balancePayment._id),
        paymentPhase : 'balance',
        chargeAttempt: String(chargeAttempt)
      }
    })

    if (paymentIntent.status !== 'succeeded') {
      const note = `Statut Stripe inattendu : ${paymentIntent.status}`
      balancePayment.status        = 'failed'
      balancePayment.failureReason = note
      await balancePayment.save()
      recordBalanceAttempt(booking, { success: false, note })
      await booking.save()
      return { ok: false, reason: 'stripe_status', error: note }
    }

    balancePayment.status                = 'succeeded'
    balancePayment.stripePaymentIntentId = paymentIntent.id
    await balancePayment.save()

    finalizeBookingAfterBalance(booking)
    recordBalanceAttempt(booking, {
      success : true,
      note    : `Solde de ${balanceAmount.toFixed(2)} € prélevé (tentative ${chargeAttempt})`
    })
    await recordCommissionForPayment({ booking, payment: balancePayment })

    return { ok: true, paymentId: balancePayment._id }
  } catch (err) {
    const note = err.raw?.message || err.message || 'Échec du prélèvement Stripe'
    balancePayment.status        = 'failed'
    balancePayment.failureReason = String(note).slice(0, 500)
    await balancePayment.save()
    recordBalanceAttempt(booking, { success: false, note })
    await booking.save()
    return { ok: false, reason: 'stripe_error', error: note }
  }
}

async function chargeBalanceWithoutStripe ({
  booking,
  depositPayment,
  balanceAmount,
  commissionPercent,
  platformCommission,
  proShare,
  chargeAttempt
}) {
  const balancePayment = await createBalancePaymentDraft({
    booking,
    depositPayment,
    balanceAmount,
    commissionPercent,
    platformCommission,
    proShare,
    chargeAttempt
  })

  balancePayment.status = 'succeeded'
  await balancePayment.save()

  finalizeBookingAfterBalance(booking)
  recordBalanceAttempt(booking, {
    success : true,
    note    : `Solde de ${balanceAmount.toFixed(2)} € enregistré (mode sans Stripe)`
  })
  await recordCommissionForPayment({ booking, payment: balancePayment })

  return { ok: true, paymentId: balancePayment._id }
}

async function attemptAutomaticBalancePayment (booking) {
  await syncPersistedWorkflow(booking)

  if (!canTriggerFinalPayment(booking)) {
    return { ok: false, reason: 'not_ready' }
  }

  const existingBalance = await Payment.findOne({
    bookingId    : booking._id,
    paymentPhase : 'balance',
    status       : 'succeeded'
  })
  if (existingBalance) return { ok: false, reason: 'already_paid' }

  const stale = await resolveStalePendingBalance(booking._id)
  if (stale?.blocked) return { ok: false, reason: stale.reason }

  if (booking.validation?.balanceChargeLastError && booking.validation?.balanceChargeLastAttemptAt) {
    const elapsed = Date.now() - new Date(booking.validation.balanceChargeLastAttemptAt).getTime()
    if (elapsed < MIN_RETRY_MS) {
      return { ok: false, reason: 'retry_cooldown' }
    }
  }

  const balanceAmount = booking.remainingAmount ?? resolveRemainingAmount(booking)
  if (!balanceAmount || balanceAmount <= 0) {
    return { ok: false, reason: 'no_balance' }
  }

  const depositPayment = await findDepositPayment(booking._id)
  if (!depositPayment) return { ok: false, reason: 'no_deposit' }

  const settings = await getPlatformSettings()
  const commissionPercent = depositPayment.commissionPercent ?? settings.commissionPercent
  const { platformCommission, proShare } = buildPaymentCommission({
    amountEur         : balanceAmount,
    commissionPercent,
    context           : COMMISSION_CONTEXT.BALANCE
  })
  const chargeAttempt = await nextChargeAttemptNumber(booking._id)

  if (isStripeEnabled()) {
    return chargeBalanceWithStripe({
      booking,
      depositPayment,
      balanceAmount,
      commissionPercent,
      platformCommission,
      proShare,
      chargeAttempt
    })
  }

  return chargeBalanceWithoutStripe({
    booking,
    depositPayment,
    balanceAmount,
    commissionPercent,
    platformCommission,
    proShare,
    chargeAttempt
  })
}

async function processContestationQueue () {
  const now = new Date()
  const results = { processed: 0, paid: 0, skipped: 0, failed: 0, errors: 0 }

  const expiredContestation = await Booking.find({
    status                          : 'confirmed',
    'validation.workflowStatus'     : WORKFLOW_STATUS.CONTESTATION,
    'validation.contestationEndsAt' : { $lte: now },
    'validation.disputeOpen'        : { $ne: true }
  }).limit(50)

  for (const booking of expiredContestation) {
    try {
      results.processed++
      const outcome = await attemptAutomaticBalancePayment(booking)
      if (outcome.ok) results.paid++
      else if (outcome.reason === 'stripe_error' || outcome.reason === 'stripe_status') results.failed++
      else results.skipped++
    } catch (err) {
      results.errors++
      console.error('[balancePayment.processContestationQueue]', booking._id, err)
    }
  }

  const readyForPayment = await Booking.find({
    status                      : 'confirmed',
    'validation.workflowStatus' : WORKFLOW_STATUS.READY_FOR_PAYMENT,
    remainingAmount             : { $gt: 0 }
  }).limit(50)

  for (const booking of readyForPayment) {
    try {
      results.processed++
      const outcome = await attemptAutomaticBalancePayment(booking)
      if (outcome.ok) results.paid++
      else if (outcome.reason === 'stripe_error' || outcome.reason === 'stripe_status') results.failed++
      else results.skipped++
    } catch (err) {
      results.errors++
      console.error('[balancePayment.processContestationQueue]', booking._id, err)
    }
  }

  if (results.paid > 0 || results.failed > 0 || results.errors > 0) {
    console.log('[balancePayment.processContestationQueue]', results)
  }

  return results
}

module.exports = {
  attemptAutomaticBalancePayment,
  processContestationQueue
}
