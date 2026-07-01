const cron = require('node-cron')
const { processContestationQueue } = require('../utils/balancePayment')

function startScheduledJobs () {
  if (process.env.DISABLE_CRON === '1') {
    console.log('[cron] Désactivé (DISABLE_CRON=1)')
    return
  }

  cron.schedule('*/5 * * * *', () => {
    processContestationQueue().catch(err => {
      console.error('[cron.contestationPayment]', err)
    })
  })

  console.log('[cron] Contestation 24h + paiement solde auto (toutes les 5 min)')
}

module.exports = { startScheduledJobs }
