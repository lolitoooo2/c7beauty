const Booking = require('../models/Booking')
const Payment = require('../models/Payment')
const { resolveRemainingAmount } = require('./bookingPaymentHelpers')
const { getPlatformSettings, computeCommission } = require('./platformSettings')
const { eurosToCents } = require('./stripeHelpers')
const {
  WORKFLOW_STATUS,
  canTriggerFinalPayment,
  syncPersistedWorkflow
} = require('./bookingValidation')

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

  const balanceAmount = booking.remainingAmount ?? resolveRemainingAmount(booking)
  if (!balanceAmount || balanceAmount <= 0) {
    return { ok: false, reason: 'no_balance' }
  }

  let depositPayment = await Payment.findOne({
    bookingId    : booking._id,
    paymentPhase : 'deposit',
    status       : 'succeeded'
  }).sort({ createdAt: 1 })

  if (!depositPayment) {
    depositPayment = await Payment.findOne({
      bookingId : booking._id,
      status    : 'succeeded'
    }).sort({ createdAt: 1 })
  }

  if (!depositPayment) return { ok: false, reason: 'no_deposit' }

  const settings = await getPlatformSettings()
  const commissionPercent = depositPayment.commissionPercent ?? settings.commissionPercent
  const { platformCommission, proShare } = computeCommission(balanceAmount, commissionPercent)

  await Payment.create({
    holdId                : depositPayment.holdId,
    bookingId             : booking._id,
    clientId              : booking.clientId,
    proId                 : booking.proId,
    serviceId             : booking.serviceId,
    stripeSessionId       : `balance_auto_${booking._id}_${Date.now()}`,
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
    halfPriceApplied      : depositPayment.halfPriceApplied ?? false,
    status                : 'succeeded',
    paymentPhase          : 'balance'
  })

  if (!booking.validation) booking.validation = { history: [] }
  if (!booking.validation.history) booking.validation.history = []

  booking.remainingAmount = 0
  booking.validation.workflowStatus = WORKFLOW_STATUS.FINAL_PAYMENT_DONE
  booking.validation.finalPaymentAt = new Date()
  booking.validation.history.push({
    action : 'balance_payment_auto',
    by     : 'system',
    at     : new Date(),
    note   : 'Prélèvement automatique du solde après contestation'
  })
  booking.status = 'completed'
  await booking.save()

  return { ok: true }
}

async function processContestationQueue () {
  const now = new Date()
  const results = { processed: 0, paid: 0, skipped: 0, errors: 0 }

  const expiredContestation = await Booking.find({
    status                        : 'confirmed',
    'validation.workflowStatus'   : WORKFLOW_STATUS.CONTESTATION,
    'validation.contestationEndsAt' : { $lte: now },
    'validation.disputeOpen'        : { $ne: true }
  }).limit(50)

  for (const booking of expiredContestation) {
    try {
      results.processed++
      const outcome = await attemptAutomaticBalancePayment(booking)
      if (outcome.ok) results.paid++
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
      else results.skipped++
    } catch (err) {
      results.errors++
      console.error('[balancePayment.processContestationQueue]', booking._id, err)
    }
  }

  if (results.paid > 0 || results.errors > 0) {
    console.log('[balancePayment.processContestationQueue]', results)
  }

  return results
}

module.exports = {
  attemptAutomaticBalancePayment,
  processContestationQueue
}
