const https = require('https')

/**
 * Géocode une adresse via api-adresse.data.gouv.fr
 * @returns {Promise<[number, number]|null>} [lng, lat] ou null
 */
function geocodeAddress (address, postalCode, city) {
  return new Promise(resolve => {
    const q   = encodeURIComponent(`${address} ${postalCode} ${city}`)
    const url = `https://api-adresse.data.gouv.fr/search/?q=${q}&limit=1`
    https.get(url, res => {
      let raw = ''
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => {
        try {
          const coords = JSON.parse(raw).features?.[0]?.geometry?.coordinates
          resolve(coords || null)
        } catch {
          resolve(null)
        }
      })
    }).on('error', () => resolve(null))
  })
}

function hasValidLocation (pro) {
  const coords = pro?.location?.coordinates
  return Array.isArray(coords) && coords.length === 2 && !(coords[0] === 0 && coords[1] === 0)
}

module.exports = { geocodeAddress, hasValidLocation }
