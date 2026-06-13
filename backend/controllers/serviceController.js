const Service = require('../models/Service')
const { syncOwnerServices } = require('../utils/collaboratorHelpers')

// ── Pro : lecture de son catalogue ──────────────────────
// GET /api/pro/services
// Retourne les services du pro connecté, groupés par groupLabel
exports.getMine = async (req, res) => {
  try {
    const services = await Service
      .find({ proId: req.userId })
      .sort({ groupLabel: 1, order: 1, createdAt: 1 })

    // Regrouper côté serveur pour faciliter l'UI
    const grouped = []
    const map = {}
    for (const s of services) {
      if (!map[s.groupLabel]) {
        map[s.groupLabel] = { groupLabel: s.groupLabel, services: [] }
        grouped.push(map[s.groupLabel])
      }
      map[s.groupLabel].services.push(s)
    }

    res.json({ data: services, grouped })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Pro : créer une prestation ───────────────────────────
// POST /api/pro/services
exports.create = async (req, res) => {
  try {
    const { groupLabel, name, description, duration, price, categoryHint, order } = req.body

    if (!groupLabel || !name || !duration || price === undefined) {
      return res.status(400).json({ message: 'groupLabel, name, duration et price sont requis.' })
    }

    const service = await Service.create({
      proId: req.userId,
      groupLabel, name, description, duration, price,
      categoryHint: categoryHint || null,
      order: order ?? 0
    })

    await syncOwnerServices(req.userId)
    res.status(201).json({ message: 'Prestation créée.', data: service })
  } catch (err) {
    console.error('[service create]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Pro : modifier une prestation ────────────────────────
// PUT /api/pro/services/:id
exports.update = async (req, res) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, proId: req.userId })
    if (!service) return res.status(404).json({ message: 'Prestation introuvable.' })

    const allowed = ['groupLabel', 'name', 'description', 'duration', 'price', 'categoryHint', 'active', 'order']
    allowed.forEach(f => { if (req.body[f] !== undefined) service[f] = req.body[f] })

    await service.save()
    await syncOwnerServices(req.userId)
    res.json({ message: 'Prestation mise à jour.', data: service })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Pro : supprimer une prestation ───────────────────────
// DELETE /api/pro/services/:id
exports.remove = async (req, res) => {
  try {
    const service = await Service.findOneAndDelete({ _id: req.params.id, proId: req.userId })
    if (!service) return res.status(404).json({ message: 'Prestation introuvable.' })
    await syncOwnerServices(req.userId)
    res.json({ message: 'Prestation supprimée.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Pro : renommer un groupe entier ─────────────────────
// PUT /api/pro/services/group/rename
// Body : { oldLabel, newLabel }
exports.renameGroup = async (req, res) => {
  try {
    const { oldLabel, newLabel } = req.body
    if (!oldLabel || !newLabel) return res.status(400).json({ message: 'oldLabel et newLabel requis.' })

    await Service.updateMany(
      { proId: req.userId, groupLabel: oldLabel },
      { $set: { groupLabel: newLabel } }
    )
    res.json({ message: 'Groupe renommé.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Pro : supprimer un groupe entier ────────────────────
// DELETE /api/pro/services/group/:label
exports.removeGroup = async (req, res) => {
  try {
    const label = decodeURIComponent(req.params.label)
    await Service.deleteMany({ proId: req.userId, groupLabel: label })
    res.json({ message: 'Groupe supprimé.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Public : catalogue d'un pro (page salon) ────────────
// GET /api/services/pro/:proId
exports.getByPro = async (req, res) => {
  try {
    const services = await Service
      .find({ proId: req.params.proId, active: true })
      .sort({ groupLabel: 1, order: 1 })
      .select('-proId')

    const grouped = []
    const map = {}
    for (const s of services) {
      if (!map[s.groupLabel]) {
        map[s.groupLabel] = { groupLabel: s.groupLabel, services: [] }
        grouped.push(map[s.groupLabel])
      }
      map[s.groupLabel].services.push(s)
    }

    res.json({ grouped })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
