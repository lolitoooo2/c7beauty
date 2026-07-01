const Client = require('../models/Client')
const { CASHBACK_MAX_EUR } = require('./loyaltyHelpers')
const { getPlatformSettings } = require('./platformSettings')

const REFERRAL_BONUS_EUR = 5

function generateReferralCode () {
  return 'C7-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

async function isReferralCashbackEnabled () {
  const settings = await getPlatformSettings()
  return Boolean(settings.referralCashbackEnabled)
}

/**
 * Cashback parrainage : +5 € parrain et filleul (plafond cagnotte 30 €).
 * Inactif tant que referralCashbackEnabled est false en paramètres plateforme.
 */
async function applyReferralBonus (client, referralCode) {
  if (!referralCode) return

  if (!(await isReferralCashbackEnabled())) return

  const sponsor = await Client.findOne({ myReferralCode: referralCode.trim().toUpperCase() })
  if (!sponsor) return

  const addBonus = (current = 0) => Math.min(CASHBACK_MAX_EUR, current + REFERRAL_BONUS_EUR)

  sponsor.wallet.cashback = addBonus(sponsor.wallet.cashback)
  await sponsor.save()

  client.referralUsed = referralCode.trim().toUpperCase()
  client.wallet.cashback = addBonus(client.wallet.cashback)
  await client.save()
}

module.exports = {
  REFERRAL_BONUS_EUR,
  generateReferralCode,
  isReferralCashbackEnabled,
  applyReferralBonus
}
