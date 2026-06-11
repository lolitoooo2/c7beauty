const Client = require('../models/Client')
const path   = require('path')
const fs     = require('fs')
const { FOLDERS } = require('../middleware/upload')

// ── GET /api/client/me ───────────────────────
exports.getMe = async (req, res) => {
  try {
    const client = await Client.findById(req.userId)
    if (!client) return res.status(404).json({ message: 'Compte introuvable.' })
    res.json({ user: client })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/client/me ───────────────────────
exports.updateMe = async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'postalCode', 'birthdate', 'socialLinks']
    const updates = {}

    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    const client = await Client.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    )

    if (!client) return res.status(404).json({ message: 'Compte introuvable.' })

    res.json({ message: 'Profil mis à jour.', user: client })
  } catch (err) {
    console.error('[updateMe client]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/client/avatar ───────────────────────────
// Multer a déjà traité le fichier (req.file disponible)
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' })

    const client = await Client.findById(req.userId)
    if (!client) return res.status(404).json({ message: 'Compte introuvable.' })

    // Supprimer l'ancien avatar du disque si il existe
    if (client.avatar) {
      const oldPath = path.join(FOLDERS.avatarsClients, client.avatar)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    client.avatar = req.file.filename
    await client.save()

    res.json({ message: 'Photo de profil mise à jour.', avatar: req.file.filename, user: client })
  } catch (err) {
    console.error('[uploadAvatar client]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── DELETE /api/client/avatar ────────────────────────
exports.deleteAvatar = async (req, res) => {
  try {
    const client = await Client.findById(req.userId)
    if (!client) return res.status(404).json({ message: 'Compte introuvable.' })

    if (client.avatar) {
      const filePath = path.join(FOLDERS.avatarsClients, client.avatar)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      client.avatar = null
      await client.save()
    }

    res.json({ message: 'Photo de profil supprimée.', user: client })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
