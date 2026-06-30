const PlatformSettings = require('../models/PlatformSettings')
const { DEFAULT_DEPOSIT_PERCENT } = require('../models/PlatformSettings')

async function getPlatformSettings () {
  let settings = await PlatformSettings.findOne({ key: 'global' })
  if (!settings) {
    settings = await PlatformSettings.create({ key: 'global', depositPercent: DEFAULT_DEPOSIT_PERCENT })
  }
  return settings
}

function computeDepositAmount (totalPriceEur, depositPercent) {
  return Math.round(totalPriceEur * depositPercent / 100 * 100) / 100
}

function validateDepositPercent (value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return { ok: false, message: 'Le pourcentage d\'acompte doit être entre 0 et 100.' }
  }
  return { ok: true, value: Math.round(n * 100) / 100 }
}

module.exports = {
  getPlatformSettings,
  computeDepositAmount,
  validateDepositPercent,
  DEFAULT_DEPOSIT_PERCENT
}
