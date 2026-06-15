const jwt    = require('jsonwebtoken')
const Client = require('../models/Client')
const Pro    = require('../models/Pro')
const Admin  = require('../models/Admin')
const Collaborator = require('../models/Collaborator')
const { geocodeAddress } = require('../utils/geocode')
const { CASHBACK_MAX_EUR } = require('../utils/loyaltyHelpers')
const {
  assignVerificationToken,
  sendClientVerificationEmail,
  verifyClientByToken
} = require('../utils/verificationHelpers')

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
  const lEmail = email.toLowerCase()
  const [c, p, col] = await Promise.all([
    Client.findOne({ email: lEmail }),
    Pro.findOne({ email: lEmail }),
    Collaborator.findOne({ email: lEmail, isOwner: false })
  ])
  return !!(c || p || col)
}

async function applyReferralBonus (client, referralCode) {
  if (!referralCode) return

  const sponsor = await Client.findOne({ myReferralCode: referralCode.trim().toUpperCase() })
  if (!sponsor) return

  const addBonus = (current = 0) => Math.min(CASHBACK_MAX_EUR, current + 5)

  sponsor.wallet.cashback = addBonus(sponsor.wallet.cashback)
  await sponsor.save()

  client.referralUsed = referralCode.trim().toUpperCase()
  client.wallet.cashback = addBonus(client.wallet.cashback)
  await client.save()
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
      referralUsed   : null,
      myReferralCode : generateReferralCode(),
      emailVerified  : false
    })

    await applyReferralBonus(client, referralCode)
    await assignVerificationToken(client)
    await sendClientVerificationEmail(client)

    res.status(201).json({
      message                   : 'Compte créé. Vérifiez votre boîte mail pour activer votre compte.',
      requiresEmailVerification : true,
      email                     : client.email
    })
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

    if (role === 'client' && user.emailVerified === false) {
      return res.status(403).json({
        code    : 'EMAIL_NOT_VERIFIED',
        message : 'Vérifiez votre adresse email avant de vous connecter.',
        email   : user.email
      })
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

// ── GET /api/auth/verify-email ───────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query
    const result = await verifyClientByToken(token)

    if (!result.ok) {
      return res.status(400).json({
        message : result.reason === 'missing'
          ? 'Lien de vérification invalide.'
          : 'Lien expiré ou déjà utilisé.'
      })
    }

    const jwtToken = signToken(result.client._id, 'client')

    res.json({
      message : 'Email vérifié ! Vous pouvez accéder à votre espace client.',
      token   : jwtToken,
      user    : result.client
    })
  } catch (err) {
    console.error('[verifyEmail]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/resend-verification ───────────────────────
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email requis.' })

    const client = await Client.findOne({ email: email.toLowerCase() })
      .select('+emailVerificationToken +emailVerificationExpires')

    if (!client) {
      return res.json({ message: 'Si un compte existe, un email a été envoyé.' })
    }

    if (client.emailVerified) {
      return res.status(400).json({ message: 'Cet email est déjà vérifié.' })
    }

    await assignVerificationToken(client)
    await sendClientVerificationEmail(client)

    res.json({ message: 'Email de vérification renvoyé.' })
  } catch (err) {
    console.error('[resendVerification]', err)
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
    else if (req.userRole === 'collaborator') {
      user = await Collaborator.findById(req.userId)
      if (user) {
        const pro = await Pro.findById(user.proId).select('salonName city postalCode')
        return res.json({ user, role: req.userRole, pro })
      }
    }

    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })

    res.json({ user, role: req.userRole })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
