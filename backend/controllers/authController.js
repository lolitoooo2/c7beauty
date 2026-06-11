const jwt    = require('jsonwebtoken')
const Client = require('../models/Client')
const Pro    = require('../models/Pro')
const Admin  = require('../models/Admin')
const { geocodeAddress } = require('../utils/geocode')

const JWT_SECRET  = process.env.JWT_SECRET  || 'c7beauty_dev_secret'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'

/**
 * Génère un JWT contenant l'id ET le rôle.
 * Le middleware auth.js utilise le rôle pour savoir dans quelle collection chercher.
 */
function signToken (id, role) {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}

function generateReferralCode () {
  return 'C7-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * Vérifie qu'un email n'existe ni en clients ni en pros.
 * Un même email ne peut pas être utilisé sur les deux espaces.
 */
async function emailAlreadyExists (email) {
  const [c, p] = await Promise.all([
    Client.findOne({ email }),
    Pro.findOne({ email })
  ])
  return !!(c || p)
}

// ── POST /api/auth/register/client ─────────────────────────────
exports.registerClient = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, birthdate, referralCode, postalCode } = req.body

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ message: 'Champs obligatoires manquants.' })
    }

    if (await emailAlreadyExists(email.toLowerCase())) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet email.' })
    }

    const client = await Client.create({
      firstName,
      lastName,
      email,
      phone,
      postalCode     : postalCode || null,
      password,
      birthdate      : birthdate || null,
      referralUsed   : referralCode || null,
      myReferralCode : generateReferralCode()
    })

    // Bonus parrainage : +5€ cashback pour le parrain ET le nouveau client
    if (referralCode) {
      await Client.findOneAndUpdate(
        { myReferralCode: referralCode },
        { $inc: { 'wallet.cashback': 5 } }
      )
      await Client.findByIdAndUpdate(client._id, { 'wallet.cashback': 5 })
    }

    const token = signToken(client._id, 'client')

    res.status(201).json({ message: 'Compte client créé.', token, user: client })
  } catch (err) {
    console.error('[registerClient]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/register/pro ─────────────────────────────────
exports.registerPro = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, password,
      salonName, siret, address, postalCode, city,
      categories, iban
    } = req.body

    if (!firstName || !lastName || !email || !phone || !password ||
        !salonName || !siret || !address || !postalCode || !city) {
      return res.status(400).json({ message: 'Champs obligatoires manquants.' })
    }

    const cleanSiret = siret.replace(/\s/g, '')
    if (!/^\d{14}$/.test(cleanSiret)) {
      return res.status(400).json({ message: 'SIRET invalide (14 chiffres requis).' })
    }

    if (await emailAlreadyExists(email.toLowerCase())) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet email.' })
    }

    // Vérifier que le SIRET n'est pas déjà enregistré
    const existingSiret = await Pro.findOne({ siret: cleanSiret })
    if (existingSiret) {
      return res.status(409).json({ message: 'Ce SIRET est déjà associé à un compte pro.' })
    }

    console.log('[registerPro] files reçus :', req.files)
    const kbisFile  = req.files?.kbis?.[0]?.filename  || null
    const idFile    = req.files?.idCard?.[0]?.filename || null
    console.log('[registerPro] kbisFile:', kbisFile, '| idFile:', idFile)

    // Géocodage de l'adresse pour les requêtes géospatiales
    const coords = await geocodeAddress(address, postalCode, city)

    const pro = await Pro.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      salonName,
      siret       : cleanSiret,
      address,
      postalCode,
      city,
      categories  : categories ? JSON.parse(categories) : [],
      iban        : iban || null,
      isActive    : false,
      kyc         : {
        status    : 'pending',
        kbisUrl   : kbisFile,
        idCardUrl : idFile
      },
      location    : coords
        ? { type: 'Point', coordinates: coords }
        : { type: 'Point', coordinates: [0, 0] }
    })

    const token = signToken(pro._id, 'pro')

    res.status(201).json({
      message : 'Demande soumise. Validation sous 48h.',
      token,
      user    : pro
    })
  } catch (err) {
    console.error('[registerPro]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/login ─────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const lEmail = email.toLowerCase()

    // Chercher dans les deux collections
    let user = await Client.findOne({ email: lEmail }).select('+password')
    let role = 'client'

    if (!user) {
      user = await Pro.findOne({ email: lEmail }).select('+password')
      role = 'pro'
    }

    if (!user) {
      return res.status(401).json({ message: 'Identifiants incorrects.' })
    }

    const valid = await user.comparePassword(password)
    if (!valid) {
      return res.status(401).json({ message: 'Identifiants incorrects.' })
    }

    const token = signToken(user._id, role)
    res.json({ token, user, role })
  } catch (err) {
    console.error('[login]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/admin/setup ─── (crée le 1er admin, désactiver en prod)
exports.setupAdmin = async (req, res) => {
  try {
    const count = await Admin.countDocuments()
    if (count > 0) return res.status(403).json({ message: 'Un admin existe déjà.' })
    const { firstName, lastName, email, password } = req.body
    const admin = await Admin.create({ firstName, lastName, email, password, isSuperAdmin: true })
    const token = signToken(admin._id, 'admin')
    res.status(201).json({ message: 'Compte admin créé.', token, user: admin })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/login/admin ────────────────────────────────────
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Champs requis.' })
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password')
    if (!admin) return res.status(401).json({ message: 'Identifiants incorrects.' })
    const valid = await admin.comparePassword(password)
    if (!valid) return res.status(401).json({ message: 'Identifiants incorrects.' })
    const token = signToken(admin._id, 'admin')
    res.json({ token, user: admin, role: 'admin' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/auth/me ─────────────────────────────────────────────
exports.me = async (req, res) => {
  try {
    let user

    if (req.userRole === 'client')      user = await Client.findById(req.userId)
    else if (req.userRole === 'pro')    user = await Pro.findById(req.userId)
    else if (req.userRole === 'admin')  user = await Admin.findById(req.userId)

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })

    res.json({ user, role: req.userRole })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
