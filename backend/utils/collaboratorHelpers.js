const crypto       = require('crypto')
const Client       = require('../models/Client')
const Pro          = require('../models/Pro')
const Admin        = require('../models/Admin')
const Collaborator = require('../models/Collaborator')
const Service      = require('../models/Service')

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

async function emailUsedGlobally (email, { excludeCollaboratorId } = {}) {
  const lEmail = email.toLowerCase().trim()
  const filter = excludeCollaboratorId
    ? { email: lEmail, _id: { $ne: excludeCollaboratorId } }
    : { email: lEmail }

  const [client, pro, admin, collaborator] = await Promise.all([
    Client.findOne({ email: lEmail }),
    Pro.findOne({ email: lEmail }),
    Admin.findOne({ email: lEmail }),
    Collaborator.findOne(filter)
  ])

  return !!(client || pro || admin || collaborator)
}

function generateInviteToken () {
  return crypto.randomBytes(32).toString('hex')
}

async function getActiveServiceIds (proId) {
  const services = await Service.find({ proId, active: true }).select('_id').lean()
  return services.map(s => s._id)
}

/**
 * Crée le collaborateur « owner » (le pro lui-même) à la validation KYC.
 * Pas de login collaborateur — le pro utilise /login/pro.
 */
async function ensureOwnerCollaborator (pro) {
  let owner = await Collaborator.findOne({ proId: pro._id, isOwner: true })
  const serviceIds = await getActiveServiceIds(pro._id)

  if (owner) {
    owner.firstName = pro.firstName
    owner.lastName  = pro.lastName
    owner.email     = pro.email.toLowerCase()
    owner.serviceIds = serviceIds
    owner.active = true
    owner.accountStatus = 'active'
    await owner.save()
    return owner
  }

  owner = await Collaborator.create({
    proId         : pro._id,
    firstName     : pro.firstName,
    lastName      : pro.lastName,
    email         : pro.email.toLowerCase(),
    isOwner       : true,
    canLogin      : false,
    accountStatus : 'active',
    active        : true,
    serviceIds,
    order         : 0
  })

  return owner
}

/** Resynchronise les prestations du owner avec tout le catalogue actif */
async function syncOwnerServices (proId) {
  const owner = await Collaborator.findOne({ proId, isOwner: true })
  if (!owner) return
  owner.serviceIds = await getActiveServiceIds(proId)
  await owner.save()
}

function buildInviteExpiry () {
  return new Date(Date.now() + INVITE_TTL_MS)
}

module.exports = {
  INVITE_TTL_MS,
  emailUsedGlobally,
  generateInviteToken,
  getActiveServiceIds,
  ensureOwnerCollaborator,
  syncOwnerServices,
  buildInviteExpiry
}
