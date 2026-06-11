const Pro    = require('../models/Pro')
const path   = require('path')
const fs     = require('fs')
const { FOLDERS } = require('../middleware/upload')
const { geocodeAddress } = require('../utils/geocode')

// ── GET /api/pro/me ──────────────────────────
exports.getMe = async (req, res) => {
  try {
    const pro = await Pro.findById(req.userId)
    if (!pro) return res.status(404).json({ message: 'Compte introuvable.' })
    res.json({ user: pro })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/pro/me ──────────────────────────
exports.updateMe = async (req, res) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'salonName', 'address', 'postalCode', 'city', 'categories', 'socialLinks']
    const updates = {}

    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    // Re-géocoder si l'adresse a changé
    const addressChanged = updates.address || updates.postalCode || updates.city
    if (addressChanged) {
      const current = await Pro.findById(req.userId)
      if (current) {
        const addr   = updates.address    || current.address
        const postal = updates.postalCode || current.postalCode
        const city   = updates.city       || current.city
        const coords = await geocodeAddress(addr, postal, city)
        if (coords) updates.location = { type: 'Point', coordinates: coords }
      }
    }

    const pro = await Pro.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    )

    if (!pro) return res.status(404).json({ message: 'Compte introuvable.' })

    res.json({ message: 'Profil mis à jour.', user: pro })
  } catch (err) {
    console.error('[updateMe pro]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/pro/photos ─────────────────────────────
// Ajoute une photo au salon (max 5). La 1ère = devanture principale.
exports.addShopPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' })

    const pro = await Pro.findById(req.userId)
    if (!pro) return res.status(404).json({ message: 'Compte introuvable.' })

    if (pro.shopPhotos.length >= 5) {
      // Supprimer le fichier uploadé car quota atteint
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: '5 photos maximum autorisées.' })
    }

    pro.shopPhotos.push(req.file.filename)
    await pro.save()

    res.status(201).json({ message: 'Photo ajoutée.', user: pro })
  } catch (err) {
    console.error('[addShopPhoto]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── DELETE /api/pro/photos/:filename ─────────────────
exports.deleteShopPhoto = async (req, res) => {
  try {
    const { filename } = req.params
    const safe = path.basename(filename)

    const pro = await Pro.findById(req.userId)
    if (!pro) return res.status(404).json({ message: 'Compte introuvable.' })

    const idx = pro.shopPhotos.indexOf(safe)
    if (idx === -1) return res.status(404).json({ message: 'Photo introuvable.' })

    // Supprimer du disque
    const filePath = path.join(FOLDERS.shops, safe)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    pro.shopPhotos.splice(idx, 1)
    await pro.save()

    res.json({ message: 'Photo supprimée.', user: pro })
  } catch (err) {
    console.error('[deleteShopPhoto]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/pro/photos/reorder ───────────────────────
// Body : { photos: ['file1.jpg', 'file2.jpg', ...] }
// Permet de choisir la photo principale en mettant la voulue en 1ère position.
exports.reorderShopPhotos = async (req, res) => {
  try {
    const { photos } = req.body
    if (!Array.isArray(photos)) return res.status(400).json({ message: 'Format invalide.' })

    const pro = await Pro.findById(req.userId)
    if (!pro) return res.status(404).json({ message: 'Compte introuvable.' })

    // Vérifier que tous les noms correspondent aux photos existantes
    const valid = photos.every(f => pro.shopPhotos.includes(f))
    if (!valid || photos.length !== pro.shopPhotos.length) {
      return res.status(400).json({ message: 'Liste de photos invalide.' })
    }

    pro.shopPhotos = photos
    await pro.save()

    res.json({ message: 'Ordre mis à jour.', user: pro })
  } catch (err) {
    console.error('[reorderShopPhotos]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
