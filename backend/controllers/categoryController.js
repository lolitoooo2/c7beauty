const Category = require('../models/Category')

// ── Public ────────────────────────────────────────────
// GET /api/categories   → toutes les catégories actives (inscription pro, home)
exports.getAll = async (req, res) => {
  try {
    const cats = await Category.find({ active: true }).sort('order')
    res.json({ data: cats })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Admin ─────────────────────────────────────────────
// GET /api/admin/categories
exports.adminGetAll = async (req, res) => {
  try {
    const cats = await Category.find().sort('order')
    res.json({ data: cats })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// POST /api/admin/categories
exports.adminCreate = async (req, res) => {
  try {
    const { name, slug, icon, description, subcategories, active, order } = req.body
    const cat = await Category.create({ name, slug, icon, description, subcategories, active, order })
    res.status(201).json({ message: 'Catégorie créée.', data: cat })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Ce slug existe déjà.' })
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// PUT /api/admin/categories/:id
exports.adminUpdate = async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
    if (!cat) return res.status(404).json({ message: 'Catégorie introuvable.' })
    res.json({ message: 'Catégorie mise à jour.', data: cat })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// DELETE /api/admin/categories/:id
exports.adminDelete = async (req, res) => {
  try {
    const cat = await Category.findByIdAndDelete(req.params.id)
    if (!cat) return res.status(404).json({ message: 'Catégorie introuvable.' })
    res.json({ message: 'Catégorie supprimée.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Sous-catégories ───────────────────────────────────
// POST /api/admin/categories/:id/subcategories
exports.adminAddSub = async (req, res) => {
  try {
    const { name, slug } = req.body
    const cat = await Category.findByIdAndUpdate(
      req.params.id,
      { $push: { subcategories: { name, slug, active: true } } },
      { new: true }
    )
    res.json({ message: 'Sous-catégorie ajoutée.', data: cat })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// DELETE /api/admin/categories/:id/subcategories/:subId
exports.adminDeleteSub = async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(
      req.params.id,
      { $pull: { subcategories: { _id: req.params.subId } } },
      { new: true }
    )
    res.json({ message: 'Sous-catégorie supprimée.', data: cat })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
