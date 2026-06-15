const Collaborator = require('../models/Collaborator')
const Service      = require('../models/Service')
const Pro          = require('../models/Pro')
const {
  emailUsedGlobally,
  generateInviteToken,
  buildInviteExpiry,
  ensureOwnerCollaborator
} = require('../utils/collaboratorHelpers')

function sanitizeCollaborator (doc) {
  const obj = doc.toJSON ? doc.toJSON() : doc
  return obj
}

// ── GET /api/pro/collaborators ────────────────────────
exports.list = async (req, res) => {
  try {
    const pro = await Pro.findById(req.userId)
    if (pro?.isActive && pro.kyc?.status === 'approved') {
      await ensureOwnerCollaborator(pro)
    }

    await Collaborator.updateMany(
      { proId: req.userId, inviteAcceptedAt: { $ne: null }, accountStatus: 'pending' },
      { accountStatus: 'active' }
    )

    const collaborators = await Collaborator.find({ proId: req.userId })
      .sort({ order: 1, createdAt: 1 })
      .lean()

    res.json({ data: collaborators })
  } catch (err) {
    console.error('[collaborators.list]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/pro/collaborators ───────────────────────
exports.create = async (req, res) => {
  try {
    const { firstName, lastName, email, serviceIds = [] } = req.body

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'Prénom, nom et email sont obligatoires.' })
    }

    const lEmail = email.toLowerCase().trim()
    if (await emailUsedGlobally(lEmail)) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé sur la plateforme.' })
    }

    const validServices = await Service.find({
      _id    : { $in: serviceIds },
      proId  : req.userId,
      active : true
    }).select('_id')

    if (!validServices.length) {
      return res.status(400).json({ message: 'Sélectionnez au moins une prestation active.' })
    }

    const count = await Collaborator.countDocuments({ proId: req.userId })
    const inviteToken = generateInviteToken()

    const collaborator = await Collaborator.create({
      proId         : req.userId,
      firstName     : firstName.trim(),
      lastName      : lastName.trim(),
      email         : lEmail,
      serviceIds    : validServices.map(s => s._id),
      order         : count,
      accountStatus : 'pending',
      active        : true,
      canLogin      : true,
      inviteToken,
      inviteExpiresAt: buildInviteExpiry()
    })

    res.status(201).json({
      message      : 'Collaborateur créé. Envoyez-lui le lien d\'invitation.',
      data         : sanitizeCollaborator(collaborator),
      inviteToken,
      invitePath   : `/invitation/collaborateur/${inviteToken}`
    })
  } catch (err) {
    console.error('[collaborators.create]', err)
    if (err.code === 11000) return res.status(409).json({ message: 'Cet email est déjà utilisé.' })
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/pro/collaborators/:id ────────────────────
exports.update = async (req, res) => {
  try {
    const collaborator = await Collaborator.findOne({ _id: req.params.id, proId: req.userId })
    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })
    if (collaborator.isOwner) {
      return res.status(403).json({ message: 'Le profil owner se synchronise avec votre compte pro.' })
    }

    const { firstName, lastName, email, serviceIds, order } = req.body

    if (firstName) collaborator.firstName = firstName.trim()
    if (lastName)  collaborator.lastName  = lastName.trim()

    if (email && email.toLowerCase().trim() !== collaborator.email) {
      const lEmail = email.toLowerCase().trim()
      if (await emailUsedGlobally(lEmail, { excludeCollaboratorId: collaborator._id })) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé.' })
      }
      collaborator.email = lEmail
    }

    if (Array.isArray(serviceIds)) {
      const validServices = await Service.find({
        _id    : { $in: serviceIds },
        proId  : req.userId,
        active : true
      }).select('_id')
      if (!validServices.length) {
        return res.status(400).json({ message: 'Au moins une prestation active requise.' })
      }
      collaborator.serviceIds = validServices.map(s => s._id)
    }

    if (order !== undefined) collaborator.order = Number(order)

    await collaborator.save()
    res.json({ message: 'Collaborateur mis à jour.', data: sanitizeCollaborator(collaborator) })
  } catch (err) {
    console.error('[collaborators.update]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PATCH /api/pro/collaborators/:id/status ───────────
exports.toggleActive = async (req, res) => {
  try {
    const collaborator = await Collaborator.findOne({ _id: req.params.id, proId: req.userId })
    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })
    if (collaborator.isOwner) {
      return res.status(403).json({ message: 'Impossible de désactiver le profil owner.' })
    }

    collaborator.active = req.body.active !== false
    if (!collaborator.active) {
      collaborator.accountStatus = 'disabled'
    } else if (collaborator.inviteAcceptedAt) {
      collaborator.accountStatus = 'active'
    } else {
      collaborator.accountStatus = 'pending'
    }

    await collaborator.save()
    res.json({
      message : collaborator.active ? 'Collaborateur réactivé.' : 'Collaborateur désactivé.',
      data    : sanitizeCollaborator(collaborator)
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/pro/collaborators/:id/resend-invite ─────
exports.resendInvite = async (req, res) => {
  try {
    const collaborator = await Collaborator.findOne({ _id: req.params.id, proId: req.userId })
      .select('+inviteToken +inviteExpiresAt')

    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })
    if (collaborator.isOwner) return res.status(403).json({ message: 'Le owner n\'a pas d\'invitation.' })
    if (collaborator.inviteAcceptedAt || collaborator.accountStatus === 'active') {
      return res.status(400).json({ message: 'Ce collaborateur a déjà activé son compte.' })
    }

    collaborator.inviteToken       = generateInviteToken()
    collaborator.inviteExpiresAt     = buildInviteExpiry()
    collaborator.accountStatus       = 'pending'
    await collaborator.save()

    res.json({
      message    : 'Nouveau lien d\'invitation généré.',
      inviteToken: collaborator.inviteToken,
      invitePath : `/invitation/collaborateur/${collaborator.inviteToken}`
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── DELETE /api/pro/collaborators/:id ─────────────────
exports.remove = async (req, res) => {
  try {
    const collaborator = await Collaborator.findOne({ _id: req.params.id, proId: req.userId })
    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })
    if (collaborator.isOwner) {
      return res.status(403).json({ message: 'Impossible de supprimer le profil owner.' })
    }

    if (collaborator.photo) {
      const fs   = require('fs')
      const path = require('path')
      const { FOLDERS } = require('../middleware/upload')
      const filepath = path.join(FOLDERS.avatarsCollaborators, collaborator.photo)
      fs.unlink(filepath, () => {})
    }

    await collaborator.deleteOne()
    res.json({ message: 'Collaborateur supprimé.' })
  } catch (err) {
    console.error('[collaborators.remove]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/collaborator/me ──────────────────────────
exports.getMe = async (req, res) => {
  try {
    const collaborator = await Collaborator.findById(req.userId)
    if (!collaborator || !collaborator.active) {
      return res.status(404).json({ message: 'Collaborateur introuvable.' })
    }

    const pro = await Pro.findById(collaborator.proId)
      .select('salonName city postalCode isActive kyc.status')

    if (!pro?.isActive || pro.kyc?.status !== 'approved') {
      return res.status(403).json({ message: 'Salon non disponible.' })
    }

    res.json({
      user : sanitizeCollaborator(collaborator),
      pro  : { salonName: pro.salonName, city: pro.city, postalCode: pro.postalCode },
      role : 'collaborator'
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/collaborator/agenda ──────────────────────
exports.getAgenda = async (req, res) => {
  try {
    const collaborator = await Collaborator.findById(req.userId)
    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })

    const { from, to } = req.query
    if (!from || !to) {
      return res.status(400).json({ message: 'Paramètres from et to requis.' })
    }

    const { buildCalendarEvents } = require('../utils/scheduleHelpers')
    const Booking = require('../models/Booking')

    const [events, bookings] = await Promise.all([
      buildCalendarEvents({
        proId          : collaborator.proId,
        collaboratorId : collaborator._id,
        fromStr        : from,
        toStr          : to
      }),
      Booking.find({
        collaboratorId : collaborator._id,
        status         : 'confirmed',
        start          : { $gte: new Date(from), $lte: new Date(to + 'T23:59:59') }
      })
        .sort({ start: 1 })
        .populate('clientId', 'firstName lastName phone')
        .lean()
    ])

    res.json({
      data     : events,
      bookings : bookings.map(b => ({
        _id         : b._id,
        start       : b.start,
        end         : b.end,
        serviceName : b.serviceName,
        duration    : b.duration,
        price       : b.price,
        client      : b.clientId
          ? { firstName: b.clientId.firstName, lastName: b.clientId.lastName, phone: b.clientId.phone }
          : null
      }))
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/auth/invite/collaborator/:token ──────────
exports.getInvite = async (req, res) => {
  try {
    const collaborator = await Collaborator.findOne({ inviteToken: req.params.token })
      .select('+inviteToken +inviteExpiresAt')

    if (!collaborator || !collaborator.inviteExpiresAt || collaborator.inviteExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invitation invalide ou expirée.' })
    }

    if (collaborator.inviteAcceptedAt) {
      return res.status(400).json({ message: 'Cette invitation a déjà été utilisée.' })
    }

    if (collaborator.accountStatus === 'active') {
      return res.status(400).json({ message: 'Cette invitation a déjà été utilisée.' })
    }

    const pro = await Pro.findById(collaborator.proId).select('salonName')

    res.json({
      firstName : collaborator.firstName,
      lastName  : collaborator.lastName,
      email     : collaborator.email,
      salonName : pro?.salonName || 'Salon'
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/invite/collaborator/:token ─────────
exports.acceptInvite = async (req, res) => {
  try {
    const { password } = req.body
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Mot de passe de 8 caractères minimum requis.' })
    }

    const collaborator = await Collaborator.findOne({ inviteToken: req.params.token })
      .select('+inviteToken +inviteExpiresAt +password')

    if (!collaborator || !collaborator.inviteExpiresAt || collaborator.inviteExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invitation invalide ou expirée.' })
    }

    if (!collaborator.canLogin) {
      return res.status(403).json({ message: 'Ce profil ne peut pas se connecter.' })
    }

    collaborator.password          = password
    collaborator.inviteToken       = null
    collaborator.inviteExpiresAt   = null
    collaborator.inviteAcceptedAt    = new Date()
    collaborator.accountStatus     = 'active'
    collaborator.active            = true
    await collaborator.save()

    const jwt = require('jsonwebtoken')
    const JWT_SECRET  = process.env.JWT_SECRET || 'c7beauty_dev_secret'
    const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'
    const token = jwt.sign({
      id             : collaborator._id,
      role           : 'collaborator',
      proId          : collaborator.proId,
      collaboratorId : collaborator._id
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    res.status(201).json({
      message : 'Compte activé.',
      token,
      user    : sanitizeCollaborator(collaborator),
      role    : 'collaborator'
    })
  } catch (err) {
    console.error('[collaborators.acceptInvite]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/auth/login/collaborator ─────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const collaborator = await Collaborator.findOne({ email: email.toLowerCase() })
      .select('+password')

    if (!collaborator || !collaborator.canLogin) {
      return res.status(401).json({ message: 'Identifiants incorrects.' })
    }

    if (!collaborator.active || collaborator.accountStatus === 'disabled') {
      return res.status(403).json({ message: 'Compte désactivé. Contactez votre salon.' })
    }

    if (collaborator.accountStatus === 'pending' && collaborator.inviteAcceptedAt) {
      collaborator.accountStatus = 'active'
    }

    if (collaborator.accountStatus === 'pending' || !collaborator.password) {
      return res.status(403).json({ message: 'Activez votre compte via le lien d\'invitation reçu par email.' })
    }

    const valid = await collaborator.comparePassword(password)
    if (!valid) return res.status(401).json({ message: 'Identifiants incorrects.' })

    const pro = await Pro.findById(collaborator.proId).select('isActive kyc.status salonName')
    if (!pro?.isActive || pro.kyc?.status !== 'approved') {
      return res.status(403).json({ message: 'Salon non actif. Connexion impossible.' })
    }

    const jwt = require('jsonwebtoken')
    const JWT_SECRET  = process.env.JWT_SECRET || 'c7beauty_dev_secret'
    const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'
    const token = jwt.sign({
      id             : collaborator._id,
      role           : 'collaborator',
      proId          : collaborator.proId,
      collaboratorId : collaborator._id
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    res.json({
      token,
      user : sanitizeCollaborator(collaborator),
      role : 'collaborator',
      pro  : { salonName: pro.salonName }
    })
  } catch (err) {
    console.error('[collaborators.login]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
