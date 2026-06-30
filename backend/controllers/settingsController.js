const {
  getPlatformSettings,
  validateDepositPercent
} = require('../utils/platformSettings')

function formatSettings (settings) {
  return { depositPercent: settings.depositPercent }
}

// ── GET /api/settings ─────────────────────────────────
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await getPlatformSettings()
    res.json(formatSettings(settings))
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
    const { depositPercent } = req.body
    if (depositPercent === undefined) {
      return res.status(400).json({ message: 'depositPercent requis.' })
    }

    const validation = validateDepositPercent(depositPercent)
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message })
    }

    const settings = await getPlatformSettings()
    settings.depositPercent = validation.value
    await settings.save()

    res.json({ message: 'Paramètres mis à jour.', data: formatSettings(settings) })
  } catch (err) {
    console.error('[settings.updateAdminSettings]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
