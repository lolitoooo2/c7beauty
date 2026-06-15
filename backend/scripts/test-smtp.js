require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const nodemailer = require('nodemailer')

const { getSmtpPass, getMailFrom } = require('../utils/emailService')

const TO = process.argv[2] || 'loanpena77@gmail.com'

async function main () {
  const port   = Number(process.env.SMTP_PORT) || 465
  const secure = port === 465
  const smtpPass = getSmtpPass()

  console.log('=== Test SMTP C7\'Beauty ===')
  console.log('Host:', process.env.SMTP_HOST)
  console.log('Port:', port, '| secure:', secure)
  console.log('User:', process.env.SMTP_USER)
  console.log('Pass:', smtpPass ? `(${smtpPass.length} chars)` : 'MISSING')
  console.log('From:', getMailFrom())
  console.log('To:', TO)

  if (!process.env.SMTP_USER || !smtpPass) {
    console.error('ERREUR: SMTP_USER ou SMTP_PASS manquant')
    process.exit(1)
  }

  const transport = nodemailer.createTransport({
    host   : process.env.SMTP_HOST || 'ssl0.ovh.net',
    port,
    secure,
    auth   : {
      user : process.env.SMTP_USER,
      pass : smtpPass
    },
    connectionTimeout : 15000,
    greetingTimeout   : 15000,
    socketTimeout     : 15000
  })

  try {
    console.log('\n1) verify()...')
    await transport.verify()
    console.log('   OK — connexion SMTP réussie')

    console.log('\n2) sendMail()...')
    const info = await transport.sendMail({
      from: getMailFrom(),
      to   : TO,
      subject : 'Test SMTP C7\'Beauty',
      text    : `Email de test envoyé le ${new Date().toISOString()}\nSi vous recevez ceci, SMTP fonctionne.`,
      html    : `<p>Email de test C7'Beauty — ${new Date().toLocaleString('fr-FR')}</p>`
    })

    console.log('   OK — messageId:', info.messageId)
    console.log('   response:', info.response)
    console.log('\n=== SUCCÈS — vérifiez la boîte mail (et les spams) ===')
  } catch (err) {
    console.error('\n=== ÉCHEC ===')
    console.error('Code:', err.code)
    console.error('Message:', err.message)
    if (err.response) console.error('Response:', err.response)
    process.exit(1)
  }
}

main()
