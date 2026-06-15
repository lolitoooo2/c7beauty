function layout ({ title, bodyHtml, ctaUrl, ctaLabel }) {
  const button = ctaUrl
    ? `<p style="margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#4F3942;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-family:Montserrat,Arial,sans-serif;">
          ${ctaLabel || 'Continuer'}
        </a>
      </p>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#F8F5F2;font-family:Poppins,Arial,sans-serif;color:#2C1810;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F5F2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #E4E0DC;overflow:hidden;">
        <tr><td style="background:#4F3942;padding:24px 28px;">
          <p style="margin:0;color:#EADAF3;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">C7'Beauty</p>
          <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-family:Georgia,serif;">${title}</h1>
        </td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">
          ${bodyHtml}
          ${button}
          <p style="margin-top:28px;font-size:12px;color:#999;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function verificationEmail ({ firstName, verifyUrl }) {
  const subject = 'Confirmez votre adresse email — C7\'Beauty'
  const html = layout({
    title    : 'Vérifiez votre email',
    bodyHtml : `
      <p>Bonjour ${firstName},</p>
      <p>Merci de vous être inscrit(e) sur <strong>C7'Beauty</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour activer votre compte client et réserver vos prestations beauté.</p>
      <p style="font-size:13px;color:#888;">Ce lien expire dans 24 heures.</p>
    `,
    ctaUrl   : verifyUrl,
    ctaLabel : 'Vérifier mon email'
  })
  const text = `Bonjour ${firstName},\n\nConfirmez votre email C7'Beauty : ${verifyUrl}\n\nCe lien expire dans 24 heures.`

  return { subject, html, text }
}

function formatDuration (minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h} h ${m} min`
  if (h) return `${h} h`
  return `${m} min`
}

function formatBookingDateTime (date) {
  return new Date(date).toLocaleString('fr-FR', {
    weekday : 'long',
    day     : 'numeric',
    month   : 'long',
    year    : 'numeric',
    hour    : '2-digit',
    minute  : '2-digit',
    timeZone: 'Europe/Paris'
  })
}

function formatEuro (amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

function bookingConfirmationEmail ({
  firstName,
  salonName,
  salonAddress,
  serviceName,
  duration,
  start,
  price,
  originalPrice,
  discountPercent,
  collaboratorName,
  dashboardUrl
}) {
  const subject = `Confirmation de rendez-vous — ${salonName}`
  const when = formatBookingDateTime(start)
  const dur  = formatDuration(duration)

  let priceLine = `<strong>${formatEuro(price)}</strong>`
  if (discountPercent > 0 && originalPrice != null) {
    priceLine = `<span style="text-decoration:line-through;color:#999;">${formatEuro(originalPrice)}</span> → <strong>${formatEuro(price)}</strong> (−${discountPercent} % fidélité)`
  }

  const addressBlock = salonAddress
    ? `<p style="margin:0;color:#666;">${salonAddress}</p>`
    : ''

  const collabBlock = collaboratorName
    ? `<p style="margin:0;"><strong>Prestataire :</strong> ${collaboratorName}</p>`
    : ''

  const html = layout({
    title    : 'Rendez-vous confirmé',
    bodyHtml : `
      <p>Bonjour ${firstName},</p>
      <p>Votre rendez-vous chez <strong>${salonName}</strong> est bien enregistré.</p>
      <table style="width:100%;margin:20px 0;background:#F8F5F2;border-radius:12px;border-collapse:collapse;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Prestation</p>
          <p style="margin:0 0 12px;font-size:17px;font-weight:700;">${serviceName}</p>
          <p style="margin:0 0 6px;"><strong>Date :</strong> ${when}</p>
          <p style="margin:0 0 6px;"><strong>Durée :</strong> ${dur}</p>
          ${collabBlock}
          <p style="margin:12px 0 0;"><strong>Montant payé :</strong> ${priceLine}</p>
        </td></tr>
      </table>
      ${addressBlock}
      <p style="margin-top:16px;">Vous pouvez consulter ou annuler votre rendez-vous depuis votre espace client.</p>
    `,
    ctaUrl   : dashboardUrl,
    ctaLabel : 'Voir mes rendez-vous'
  })

  const text = [
    `Bonjour ${firstName},`,
    '',
    `Votre rendez-vous chez ${salonName} est confirmé.`,
    '',
    `Prestation : ${serviceName}`,
    `Date : ${when}`,
    `Durée : ${dur}`,
    collaboratorName ? `Prestataire : ${collaboratorName}` : '',
    `Montant : ${formatEuro(price)}`,
    salonAddress ? `Adresse : ${salonAddress}` : '',
    '',
    `Espace client : ${dashboardUrl}`
  ].filter(Boolean).join('\n')

  return { subject, html, text }
}

module.exports = {
  verificationEmail,
  bookingConfirmationEmail
}
