const {
  getPlatformSettings,
  validateDepositPercent,
  validateCommissionPercent
} = require('../utils/platformSettings')

function formatSettings (settings) {
  return {
    depositPercent            : settings.depositPercent,
    commissionPercent         : settings.commissionPercent,
    referralCashbackEnabled   : Boolean(settings.referralCashbackEnabled)
  }
}

// ── GET /api/settings ─────────────────────────────────
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await getPlatformSettings()
    res.json({
      depositPercent          : settings.depositPercent,
      referralCashbackEnabled : Boolean(settings.referralCashbackEnabled)
    })
  } catch (err) {
    console.error('[settings.getPublicSettings]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/admin/settings ───────────────────────────
exports.getAdminSettings = async (req, res) => {
  try {
    const settings = await getPlatformSettings()
    res.json({ data: formatSettings(settings) })
  } catch (err) {
    console.error('[settings.getAdminSettings]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/admin/settings ───────────────────────────
exports.updateAdminSettings = async (req, res) => {
  try {
    const { depositPercent, commissionPercent, referralCashbackEnabled } = req.body

    if (
      depositPercent === undefined
      && commissionPercent === undefined
      && referralCashbackEnabled === undefined
    ) {
      return res.status(400).json({ message: 'Au moins un paramètre requis.' })
    }

    const settings = await getPlatformSettings()

    if (depositPercent !== undefined) {
      const validation = validateDepositPercent(depositPercent)
      if (!validation.ok) return res.status(400).json({ message: validation.message })
      settings.depositPercent = validation.value
    }

    if (commissionPercent !== undefined) {
      const validation = validateCommissionPercent(commissionPercent)
      if (!validation.ok) return res.status(400).json({ message: validation.message })
      settings.commissionPercent = validation.value
    }

    if (referralCashbackEnabled !== undefined) {
      settings.referralCashbackEnabled = Boolean(referralCashbackEnabled)
    }

    await settings.save()

    res.json({ message: 'Paramètres mis à jour.', data: formatSettings(settings) })
  } catch (err) {
    console.error('[settings.updateAdminSettings]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
