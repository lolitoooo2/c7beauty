const { formatDateOnlyInParis } = require('./timezoneHelpers')

/** Cashback : +1 € si la prestation vaut ≥ 25 € (plafond cagnotte 30 €). */
const CASHBACK_MIN_EUR = 25
const CASHBACK_EARN_EUR = 1
const CASHBACK_MAX_EUR = 30

/** Fidélité : 9 RDV plein tarif, le 10e = -50 % (max 1× par mois calendaire). */
const LOYALTY_FULL_PRICE_COUNT = 9
const LOYALTY_HALF_PRICE_PERCENT = 50

function currentMonthParis (date = new Date()) {
  return formatDateOnlyInParis(date).slice(0, 7)
}

function getWallet (client) {
  return client?.wallet || {}
}

function canUseHalfPrice (client, date = new Date()) {
  const w = getWallet(client)
  if ((w.prestationCount || 0) < LOYALTY_FULL_PRICE_COUNT) return false
  return w.lastHalfPriceMonth !== currentMonthParis(date)
}

function computeBookingPrice (client, servicePrice, date = new Date()) {
  const originalPrice = Number(servicePrice) || 0
  const halfPriceApplied = client ? canUseHalfPrice(client, date) : false
  const finalPrice = halfPriceApplied
    ? Math.round(originalPrice * (100 - LOYALTY_HALF_PRICE_PERCENT) / 100 * 100) / 100
    : originalPrice

  return {
    originalPrice,
    finalPrice,
    halfPriceApplied,
    discountPercent: halfPriceApplied ? LOYALTY_HALF_PRICE_PERCENT : 0
  }
}

function cashbackToEarn (originalPrice, currentCashback = 0) {
  if (originalPrice < CASHBACK_MIN_EUR) return 0
  const room = CASHBACK_MAX_EUR - (currentCashback || 0)
  if (room <= 0) return 0
  return Math.min(CASHBACK_EARN_EUR, room)
}

function getLoyaltyPreview (client, servicePrice, date = new Date()) {
  const w = getWallet(client)
  const pricing = computeBookingPrice(client, servicePrice, date)
  const cashbackEarn = client
    ? cashbackToEarn(pricing.originalPrice, w.cashback)
    : 0

  return {
    prestationCount      : w.prestationCount || 0,
    fullPriceTarget      : LOYALTY_FULL_PRICE_COUNT,
    halfPriceEligible    : canUseHalfPrice(client, date),
    halfPriceUsedThisMonth: w.lastHalfPriceMonth === currentMonthParis(date),
    ...pricing,
    cashbackEarn,
    cashbackMinEur       : CASHBACK_MIN_EUR
  }
}

async function applyLoyaltyAfterBooking (client, { originalPrice, halfPriceApplied }, date = new Date()) {
  if (!client) return { cashbackEarned: 0 }

  const month = currentMonthParis(date)
  let cashbackEarned = 0

  if (halfPriceApplied) {
    client.wallet.prestationCount = 0
    client.wallet.lastHalfPriceMonth = month
  } else {
    const count = client.wallet.prestationCount || 0
    if (count < LOYALTY_FULL_PRICE_COUNT) {
      client.wallet.prestationCount = count + 1
    }
  }

  cashbackEarned = cashbackToEarn(originalPrice, client.wallet.cashback)
  if (cashbackEarned > 0) {
    client.wallet.cashback = Math.min(
      CASHBACK_MAX_EUR,
      (client.wallet.cashback || 0) + cashbackEarned
    )
  }

  await client.save()
  return { cashbackEarned }
}

module.exports = {
  CASHBACK_MIN_EUR,
  CASHBACK_EARN_EUR,
  CASHBACK_MAX_EUR,
  LOYALTY_FULL_PRICE_COUNT,
  LOYALTY_HALF_PRICE_PERCENT,
  canUseHalfPrice,
  computeBookingPrice,
  cashbackToEarn,
  getLoyaltyPreview,
  applyLoyaltyAfterBooking
}
