const path   = require('path')
const fs     = require('fs')
const Client = require('../models/Client')
const Pro    = require('../models/Pro')
const Admin  = require('../models/Admin')
const Payment = require('../models/Payment')
const { geocodeAddress, hasValidLocation } = require('../utils/geocode')
const { ensureOwnerCollaborator } = require('../utils/collaboratorHelpers')

// ── Helpers ──────────────────────────────────────────
function paginate (query, page, limit) {
  return query.skip((page - 1) * limit).limit(limit)
}

// ── GET /api/admin/stats ──────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [clients, pros, pending, approved] = await Promise.all([
      Client.countDocuments(),
      Pro.countDocuments(),
      Pro.countDocuments({ 'kyc.status': 'pending' }),
      Pro.countDocuments({ 'kyc.status': 'approved' })
    ])
    res.json({ clients, pros, pending, approved })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ════════════════════════════════════════════════════
//  PROS
// ════════════════════════════════════════════════════

// ── GET /api/admin/pros ───────────────────────────────
exports.getPros = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '', sort = '-createdAt' } = req.query
    const filter = {}
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { salonName: { $regex: search, $options: 'i' } },
        { siret:     { $regex: search, $options: 'i' } }
      ]
    }
    if (status) filter['kyc.status'] = status

    const total = await Pro.countDocuments(filter)
    const pros  = await paginate(Pro.find(filter).sort(sort), Number(page), Number(limit))
    res.json({ data: pros, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/admin/pros/:id ────────────────────────────
exports.getPro = async (req, res) => {
  try {
    const pro = await Pro.findById(req.params.id)
    if (!pro) return res.status(404).json({ message: 'Pro introuvable.' })
    res.json({ data: pro })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/admin/pros ───────────────────────────────
exports.createPro = async (req, res) => {
  try {
    const payload = { ...req.body, 'kyc.status': 'approved', isActive: true }
    if (payload.address && payload.postalCode && payload.city) {
      const coords = await geocodeAddress(payload.address, payload.postalCode, payload.city)
      if (coords) payload.location = { type: 'Point', coordinates: coords }
    }
    const pro = await Pro.create(payload)
    await ensureOwnerCollaborator(pro)
    res.status(201).json({ message: 'Pro créé.', data: pro })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email ou SIRET déjà utilisé.' })
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/admin/pros/:id ────────────────────────────
exports.updatePro = async (req, res) => {
  try {
    const forbidden = ['password', 'email']
    forbidden.forEach(f => delete req.body[f])

    const current = await Pro.findById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Pro introuvable.' })

    const updates = { ...req.body }
    const addressChanged = updates.address || updates.postalCode || updates.city
    if (addressChanged) {
      const addr   = updates.address    || current.address
      const postal = updates.postalCode || current.postalCode
      const city   = updates.city       || current.city
      const coords = await geocodeAddress(addr, postal, city)
      if (coords) updates.location = { type: 'Point', coordinates: coords }
    }

    const pro = await Pro.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
    res.json({ message: 'Pro mis à jour.', data: pro })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── DELETE /api/admin/pros/:id ─────────────────────────
exports.deletePro = async (req, res) => {
  try {
    const pro = await Pro.findByIdAndDelete(req.params.id)
    if (!pro) return res.status(404).json({ message: 'Pro introuvable.' })
    res.json({ message: 'Pro supprimé.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PATCH /api/admin/pros/:id/kyc ─────────────────────
exports.updateKyc = async (req, res) => {
  try {
    const { status, rejectReason } = req.body
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' })
    }

    const pro = await Pro.findById(req.params.id)
    if (!pro) return res.status(404).json({ message: 'Pro introuvable.' })

    const update = {
      'kyc.status': status,
      'kyc.reviewedAt': new Date(),
      isActive: status === 'approved'
    }
    if (status === 'rejected' && rejectReason) update['kyc.rejectReason'] = rejectReason

    // Géocoder à l'approbation si le pro n'a pas encore de coordonnées valides
    if (status === 'approved' && !hasValidLocation(pro)) {
      const coords = await geocodeAddress(pro.address, pro.postalCode, pro.city)
      if (coords) update.location = { type: 'Point', coordinates: coords }
    }

    const updated = await Pro.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })

    if (status === 'approved') {
      await ensureOwnerCollaborator(updated)
    }

    res.json({ message: `Dossier ${status}.`, data: updated })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ════════════════════════════════════════════════════
//  CLIENTS
// ════════════════════════════════════════════════════

// ── GET /api/admin/clients ────────────────────────────
exports.getClients = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sort = '-createdAt' } = req.query
    const filter = {}
    if (search) {
      filter.$or = [
        { firstName:  { $regex: search, $options: 'i' } },
        { lastName:   { $regex: search, $options: 'i' } },
        { email:      { $regex: search, $options: 'i' } },
        { phone:      { $regex: search, $options: 'i' } },
        { postalCode: { $regex: search, $options: 'i' } }
      ]
    }
    const total   = await Client.countDocuments(filter)
    const clients = await paginate(Client.find(filter).sort(sort), Number(page), Number(limit))
    res.json({ data: clients, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/admin/clients/:id ────────────────────────
exports.getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })
    res.json({ data: client })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/admin/clients ───────────────────────────
exports.createClient = async (req, res) => {
  try {
    const client = await Client.create({
      ...req.body,
      myReferralCode : 'C7-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      emailVerified  : true
    })
    res.status(201).json({ message: 'Client créé.', data: client })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email déjà utilisé.' })
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PUT /api/admin/clients/:id ────────────────────────
exports.updateClient = async (req, res) => {
  try {
    const forbidden = ['password', 'email', 'wallet', 'myReferralCode']
    forbidden.forEach(f => delete req.body[f])
    const client = await Client.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })
    res.json({ message: 'Client mis à jour.', data: client })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── DELETE /api/admin/clients/:id ─────────────────────
exports.deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id)
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })
    res.json({ message: 'Client supprimé.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ════════════════════════════════════════════════════
//  DOCUMENTS KYC (accès sécurisé)
// ════════════════════════════════════════════════════

// ── GET /api/admin/docs/:filename ─────────────────────
exports.getDoc = (req, res) => {
  const filename = path.basename(req.params.filename) // sécurité : pas de path traversal
  const filePath = path.join(__dirname, '../uploads/kyc', filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Document introuvable.' })
  res.sendFile(filePath)
}

// ── GET /api/admin/emails ─────────────────────────────
exports.getEmailLogs = async (req, res) => {
  try {
    const EmailLog = require('../models/EmailLog')
    const page  = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 30
    const filter = {}
    if (req.query.type) filter.type = req.query.type
    if (req.query.status) filter.status = req.query.status

    const total = await EmailLog.countDocuments(filter)
    const data  = await EmailLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({ data, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[admin.getEmailLogs]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── PATCH /api/admin/clients/:id/verify-email ─────────
exports.verifyClientEmail = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })

    client.emailVerified              = true
    client.emailVerificationToken   = null
    client.emailVerificationExpires = null
    await client.save()

    res.json({ message: 'Email marqué comme vérifié.', data: client })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── POST /api/admin/clients/:id/resend-verification ───
exports.resendClientVerification = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .select('+emailVerificationToken +emailVerificationExpires')
    if (!client) return res.status(404).json({ message: 'Client introuvable.' })
    if (client.emailVerified) {
      return res.status(400).json({ message: 'Email déjà vérifié.' })
    }

    const { assignVerificationToken, sendClientVerificationEmail } = require('../utils/verificationHelpers')
    await assignVerificationToken(client)
    await sendClientVerificationEmail(client)

    res.json({ message: 'Email de vérification renvoyé.' })
  } catch (err) {
    console.error('[admin.resendClientVerification]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

const PAYMENT_STATUS_LABELS = {
  pending   : 'En attente',
  succeeded : 'Réussi',
  failed    : 'Échoué',
  expired   : 'Expiré'
}

function formatAdminPayment (p) {
  const client = p.clientId && typeof p.clientId === 'object' ? p.clientId : null
  const pro    = p.proId && typeof p.proId === 'object' ? p.proId : null
  const booking = p.bookingId && typeof p.bookingId === 'object' ? p.bookingId : null

  return {
    _id                : p._id,
    status             : p.status,
    statusLabel        : PAYMENT_STATUS_LABELS[p.status] || p.status,
    amount             : p.amount,
    totalPrice         : p.totalPrice,
    remainingAmount    : p.remainingAmount,
    depositPercent     : p.depositPercent,
    commissionPercent  : p.commissionPercent,
    platformCommission : p.platformCommission,
    proShare           : p.proShare,
    commissionContext  : p.commissionContext || p.paymentPhase || 'deposit',
    clientName         : client ? `${client.firstName} ${client.lastName}`.trim() : '—',
    clientEmail        : client?.email || '—',
    salonName          : pro?.salonName || '—',
    serviceName        : booking?.serviceName || '—',
    bookingStart       : booking?.start || null,
    bookingStatus      : booking?.status || null,
    validationStatus   : booking?.validation?.workflowStatus || null,
    paymentPhase       : p.paymentPhase || 'deposit',
    chargeAttempt      : p.chargeAttempt ?? 1,
    failureReason      : p.failureReason || null,
    createdAt          : p.createdAt
  }
}

// ── GET /api/admin/payments ───────────────────────────
exports.getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 30, status = '' } = req.query
    const filter = {}
    if (status) filter.status = status

    const total = await Payment.countDocuments(filter)
    const payments = await paginate(
      Payment.find(filter)
        .sort('-createdAt')
        .populate('clientId', 'firstName lastName email')
        .populate('proId', 'salonName')
        .populate('bookingId', 'serviceName start status validation'),
      Number(page),
      Number(limit)
    )

    res.json({
      data  : payments.map(formatAdminPayment),
      total,
      page  : Number(page),
      pages : Math.ceil(total / Number(limit))
    })
  } catch (err) {
    console.error('[admin.getPayments]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
