const cron = require('node-cron')

/**
 * Planificateur d'emails (rappels RDV, avis 24h post-prestation…).
 * Sprint 5+ : brancher les jobs ici.
 */
function startScheduledJobs () {
  if (process.env.DISABLE_CRON === '1') {
    console.log('[cron] Désactivé (DISABLE_CRON=1)')
    return
  }

  // Placeholder horaire — jobs ajoutés aux sprints suivants
  console.log('[cron] Planificateur prêt (emails RDV + avis à venir)')
}

module.exports = { startScheduledJobs }
