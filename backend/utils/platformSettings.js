const PlatformSettings = require('../models/PlatformSettings')
const {
  DEFAULT_DEPOSIT_PERCENT,
  DEFAULT_COMMISSION_PERCENT
} = require('../models/PlatformSettings')

const {
  computeCommissionSplit
} = require('./commissionHelpers')

async function getPlatformSettings () {
  let settings = await PlatformSettings.findOne({ key: 'global' })
  if (!settings) {
    settings = await PlatformSettings.create({
      key                     : 'global',
      depositPercent          : DEFAULT_DEPOSIT_PERCENT,
      commissionPercent       : DEFAULT_COMMISSION_PERCENT,
      referralCashbackEnabled : false
    })
    return settings
  }

  if (settings.commissionPercent == null) {
    settings.commissionPercent = DEFAULT_COMMISSION_PERCENT
    await settings.save()
  }

  if (settings.referralCashbackEnabled == null) {
    settings.referralCashbackEnabled = false
    await settings.save()
  }

  return settings
}

function computeDepositAmount (totalPriceEur, depositPercent) {
  return Math.round(totalPriceEur * depositPercent / 100 * 100) / 100
}

function computeRemainingAmount (totalPriceEur, depositAmountEur) {
  return Math.max(0, Math.round((totalPriceEur - depositAmountEur) * 100) / 100)
}

function computeCommission (amountEur, commissionPercent) {
  return computeCommissionSplit(amountEur, commissionPercent)
}

function validatePercent (value, label) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, message: `${label} doit être entre 0 et 100.` }
  }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

function validateDepositPercent (value) {
  return validatePercent(value, 'Le pourcentage d\'acompte')
}

function validateCommissionPercent (value) {
  return validatePercent(value, 'Le taux de commission')
}

module.exports = {
  getPlatformSettings,
  computeDepositAmount,
  computeRemainingAmount,
  computeCommission,
  validateDepositPercent,
  validateCommissionPercent,
  DEFAULT_DEPOSIT_PERCENT,
  DEFAULT_COMMISSION_PERCENT
}
