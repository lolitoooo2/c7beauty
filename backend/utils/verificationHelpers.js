const crypto = require('crypto')
const { sendEmail, getFrontendUrl } = require('./emailService')
const { verificationEmail } = require('./emailTemplates')

const TOKEN_BYTES = 32
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

function generateVerificationToken () {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex')
}

function verificationExpiresAt () {
  return new Date(Date.now() + TOKEN_TTL_MS)
}

async function assignVerificationToken (client) {
  client.emailVerificationToken   = generateVerificationToken()
  client.emailVerificationExpires = verificationExpiresAt()
  client.emailVerified            = false
  await client.save()
  return client.emailVerificationToken
}

async function sendClientVerificationEmail (client) {
  const token = client.emailVerificationToken || await assignVerificationToken(client)
  const verifyUrl = `${getFrontendUrl()}/verify-email?token=${token}`
  const { subject, html, text } = verificationEmail({
    firstName : client.firstName,
    verifyUrl
  })

  return sendEmail({
    to      : client.email,
    subject,
    html,
    text,
    type    : 'email_verification',
    meta    : { clientId: String(client._id) }
  })
}

async function verifyClientByToken (token) {
  if (!token) return { ok: false, reason: 'missing' }

  const Client = require('../models/Client')
  const client = await Client.findOne({
    emailVerificationToken   : token,
    emailVerificationExpires : { $gt: new Date() }
  }).select('+emailVerificationToken +emailVerificationExpires')

  if (!client) return { ok: false, reason: 'invalid' }

  client.emailVerified              = true
  client.emailVerificationToken   = null
  client.emailVerificationExpires = null
  await client.save()

  return { ok: true, client }
}

module.exports = {
  generateVerificationToken,
  verificationExpiresAt,
  assignVerificationToken,
  sendClientVerificationEmail,
  verifyClientByToken
}
