require('dotenv').config()

const express  = require('express')
const cors     = require('cors')
const mongoose = require('mongoose')
const path     = require('path')

const verifyToken = require('./middleware/auth')
const routes = require('./routes')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

// ── Accès direct au dossier uploads bloqué ──────────────
app.use('/uploads', (req, res) => res.status(403).json({ message: 'Accès refusé.' }))

// ── Endpoints media (auth requise) ──────────────────────
//
// Avatars  → GET /api/media/avatars/clients/:filename
//            GET /api/media/avatars/pros/:filename
// Boutiques → GET /api/media/shops/:filename

app.get('/api/media/avatars/:type/:filename', verifyToken, (req, res) => {
  const { type, filename } = req.params
  if (!['clients', 'pros'].includes(type)) return res.status(400).json({ message: 'Type invalide.' })
  const safe = path.basename(filename)
  const file = path.join(__dirname, 'uploads', 'avatars', type, safe)
  res.sendFile(file, err => { if (err) res.status(404).json({ message: 'Image introuvable.' }) })
})

// Photos salon → publiques (découverte, pas de données sensibles)
app.get('/api/media/shops/:filename', (req, res) => {
  const safe = path.basename(req.params.filename)
  const file = path.join(__dirname, 'uploads', 'shops', safe)
  res.sendFile(file, err => { if (err) res.status(404).json({ message: 'Image introuvable.' }) })
})

app.use('/api', routes)

const { seedCategories } = require('./seed/categories')

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/c7beauty')
  .then(async () => {
    console.log('MongoDB connecté')
    await seedCategories()
  })
  .catch((err) => console.warn('MongoDB non connecté :', err.message))

app.listen(PORT, () => {
  console.log(`Serveur C7'Beauty démarré sur http://localhost:${PORT}`)
})
