const nodemailer = require('nodemailer')
const EmailLog   = require('../models/EmailLog')

let transporter = null

function getFrontendUrl () {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')
}

function getSmtpPass () {
  const pass = process.env.SMTP_PASS || ''
  // Docker Compose env_file : $$ → $ ; dotenv local charge $$ tel quel
  return pass.replace(/\$\$/g, '$')
}

function getMailFrom () {
  return (process.env.MAIL_FROM || process.env.SMTP_USER || '').replace(/^"|"$/g, '')
}

function isEmailConfigured () {
  return Boolean(process.env.SMTP_USER && getSmtpPass())
}

function getTransporter () {
  if (!isEmailConfigured()) return null
  if (transporter) return transporter

  const port   = Number(process.env.SMTP_PORT) || 465
  const secure = port === 465

  transporter = nodemailer.createTransport({
    host   : process.env.SMTP_HOST || 'ssl0.ovh.net',
    port,
    secure,
    auth   : {
      user : process.env.SMTP_USER,
      pass : getSmtpPass()
    }
  })

  return transporter
}

async function sendEmail ({ to, subject, html, text, type, meta = {} }) {
  const log = await EmailLog.create({
    to,
    subject,
    type,
    status : 'pending',
    meta
  })

  const transport = getTransporter()
  if (!transport) {
    console.warn(`[email] SMTP non configuré — ${type} → ${to}`)
    if (text) console.warn('[email]', text)
    await EmailLog.findByIdAndUpdate(log._id, {
      status : 'skipped',
      error  : 'SMTP non configuré'
    })
    return { ok: false, skipped: true, logId: log._id }
  }

  try {
    await transport.sendMail({
      from    : getMailFrom(),
      to,
      subject,
      html,
      text
    })
    await EmailLog.findByIdAndUpdate(log._id, {
      status : 'sent',
      sentAt : new Date()
    })
    return { ok: true, logId: log._id }
  } catch (err) {
    console.error(`[email] ${type} → ${to}:`, err.message)
    await EmailLog.findByIdAndUpdate(log._id, {
      status : 'failed',
      error  : err.message
    })
    return { ok: false, error: err.message, logId: log._id }
  }
}

module.exports = {
  getFrontendUrl,
  getSmtpPass,
  getMailFrom,
  isEmailConfigured,
  sendEmail
}
