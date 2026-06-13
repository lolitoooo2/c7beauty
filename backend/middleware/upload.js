const multer = require('multer')
const path   = require('path')
const crypto = require('crypto')
const fs     = require('fs')

// ── Racine de tous les uploads ──────────────────────────
const UPLOAD_ROOT = path.join(__dirname, '../uploads')

// ── Arborescence prévue (créée automatiquement au démarrage) ──
const FOLDERS = {
  kyc           : path.join(UPLOAD_ROOT, 'kyc'),
  avatarsClients: path.join(UPLOAD_ROOT, 'avatars', 'clients'),
  avatarsPros   : path.join(UPLOAD_ROOT, 'avatars', 'pros'),
  avatarsCollaborators: path.join(UPLOAD_ROOT, 'avatars', 'collaborators'),
  shops         : path.join(UPLOAD_ROOT, 'shops'),           // photos salon pro (futur)
  services      : path.join(UPLOAD_ROOT, 'services'),        // photos prestation (futur)
  reviews       : path.join(UPLOAD_ROOT, 'reviews'),         // photos avis (futur)
}

// Créer tous les dossiers si absents (idempotent)
Object.values(FOLDERS).forEach(dir => fs.mkdirSync(dir, { recursive: true }))

// ── Factory : crée un uploader multer pour un dossier donné ──
function createUploader (folder, opts = {}) {
  const {
    allowedExts = ['.jpg', '.jpeg', '.png', '.webp'],
    maxSizeMb   = 5
  } = opts

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, folder),
    filename    : (req, file, cb) => {
      const ext    = path.extname(file.originalname).toLowerCase()
      const unique = crypto.randomBytes(16).toString('hex')
      cb(null, `${Date.now()}-${unique}${ext}`)
    }
  })

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExts.includes(ext)) cb(null, true)
    else cb(new Error(`Format non autorisé. Formats acceptés : ${allowedExts.join(', ')}`), false)
  }

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMb * 1024 * 1024 }
  })
}

// ── Uploaders exposés ────────────────────────────────────
module.exports = {
  FOLDERS,

  // Documents KYC (KBIS + CNI) — PDF/image, 5 Mo max
  kycUpload: createUploader(FOLDERS.kyc, {
    allowedExts: ['.pdf', '.jpg', '.jpeg', '.png'],
    maxSizeMb  : 5
  }),

  // Photo de profil client — image uniquement, 2 Mo max
  avatarClientUpload: createUploader(FOLDERS.avatarsClients, {
    maxSizeMb: 2
  }),

  // Photo de profil pro — image uniquement, 2 Mo max (futur)
  avatarProUpload: createUploader(FOLDERS.avatarsPros, {
    maxSizeMb: 2
  }),

  avatarCollaboratorUpload: createUploader(FOLDERS.avatarsCollaborators, {
    maxSizeMb: 2
  }),

  // Photos du salon pro
  shopsUpload: createUploader(FOLDERS.shops, {
    maxSizeMb: 5
  }),

  // À étendre : servicesUpload, reviewsUpload
}
