const Pro      = require('../models/Pro')
const Service  = require('../models/Service')
const Category = require('../models/Category')

function escapeRegex (str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Rayon km → radians pour $centerSphere */
function kmToRadians (km) {
  return km / 6378.1
}

/**
 * GET /api/search/pros
 *
 * Deux modes de recherche géographique (mutuellement exclusifs) :
 *  A) Point + rayon  → ?lat=48.86&lng=2.35&radius=10
 *  B) Bounding box   → ?swLat=..&swLng=..&neLat=..&neLng=..  (après déplacement carte)
 *
 * Filtres optionnels :
 *  q        → texte libre (recherche dans les noms de prestations)
 *  category → slug catégorie globale
 *  page     → pagination (défaut 1)
 *  limit    → résultats par page (défaut 30)
 *
 * Architecture scalable : toute la logique est ici, découplée des routes.
 * Pour passer à Elasticsearch : remplacer les appels Mongoose par des appels ES
 * sans modifier les routes ni les contrôleurs appelants.
 */
exports.searchPros = async (req, res) => {
  try {
    const {
      q, category,
      lat, lng, radius = 10,
      swLat, swLng, neLat, neLng,
      page = 1, limit = 30
    } = req.query

    const skip = (Number(page) - 1) * Number(limit)

    // ── 1. Filtre de base : pros validés, actifs et géolocalisés ──
    const baseFilter = {
      isActive               : true,
      'kyc.status'           : 'approved',
      'location.coordinates' : { $ne: [0, 0] }
    }

    if (category) baseFilter.categories = category

    // ── 2. Filtre géographique ──────────────────────────────
    let geoFilter = {}

    if (swLat && swLng && neLat && neLng) {
      // Mode bounding box (utilisateur a déplacé/zoomé la carte)
      geoFilter = {
        location: {
          $geoWithin: {
            $box: [
              [parseFloat(swLng), parseFloat(swLat)],
              [parseFloat(neLng), parseFloat(neLat)]
            ]
          }
        }
      }
    } else if (lat && lng) {
      // $geoWithin + $centerSphere : compatible find ET countDocuments
      const radiusKm = parseFloat(radius) || 10
      geoFilter = {
        location: {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              kmToRadians(radiusKm)
            ]
          }
        }
      }
    }

    const proFilter = { ...baseFilter, ...geoFilter }

    // ── 3. Filtre par texte (prestations des pros) ───────────
    // Si une catégorie est déjà sélectionnée, le filtre category suffit
    // (évite q=Coiffure + category=coiffure → 0 résultats car aucun service nommé "Coiffure")
    let proIdsFromServices = null
    if (q && q.trim() && !category) {
      const regex = new RegExp(escapeRegex(q.trim()), 'i')
      const matchingServices = await Service.find({
        $or: [
          { name       : regex },
          { description: regex },
          { groupLabel : regex }
        ],
        active: true
      }).distinct('proId')

      proIdsFromServices = matchingServices.map(id => id.toString())
    } else if (q && q.trim() && category) {
      // q + category : filtrer les services dans la catégorie si le texte
      // ne correspond pas juste au nom de la catégorie
      const catDoc = await Category.findOne({ slug: category, active: true }).lean()
      const qNorm  = q.trim().toLowerCase()
      const isCategoryLabel = catDoc && (
        catDoc.name.toLowerCase() === qNorm ||
        catDoc.slug.toLowerCase() === qNorm
      )

      if (!isCategoryLabel) {
        const regex = new RegExp(escapeRegex(q.trim()), 'i')
        const matchingServices = await Service.find({
          $or: [
            { name       : regex },
            { description: regex },
            { groupLabel : regex }
          ],
          active: true
        }).distinct('proId')
        proIdsFromServices = matchingServices.map(id => id.toString())
      }
    }

    if (proIdsFromServices !== null) {
      if (proIdsFromServices.length === 0) {
        return res.json({
          data  : [],
          total : 0,
          page  : Number(page),
          pages : 0
        })
      }
      proFilter._id = { $in: proIdsFromServices }
    }

    // ── 4. Requête principale ────────────────────────────────
    const [pros, total] = await Promise.all([
      Pro.find(proFilter)
        .select('salonName address city postalCode location categories shopPhotos stats kyc.status')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Pro.countDocuments(proFilter)
    ])

    // ── 5. Enrichir chaque pro avec ses prestations (preview) ─
    // On ne charge que les groupes + quelques prestations pour la card
    const proIds = pros.map(p => p._id)
    const services = await Service.find({
      proId : { $in: proIds },
      active: true
    })
    .select('proId groupLabel name price duration')
    .lean()

    // Regrouper les services par proId
    const servicesByPro = {}
    for (const s of services) {
      const key = s.proId.toString()
      if (!servicesByPro[key]) servicesByPro[key] = []
      servicesByPro[key].push(s)
    }

    const results = pros.map(p => ({
      ...p,
      servicesPreview: (servicesByPro[p._id.toString()] || []).slice(0, 4),
      serviceCount   : (servicesByPro[p._id.toString()] || []).length
    }))

    res.json({
      data   : results,
      total,
      page   : Number(page),
      pages  : Math.ceil(total / Number(limit))
    })
  } catch (err) {
    console.error('[search]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

/**
 * GET /api/search/salon/:id
 * Page publique d'un salon (utilisée par SalonView.vue)
 */
exports.getSalon = async (req, res) => {
  try {
    const pro = await Pro.findOne({
      _id          : req.params.id,
      isActive     : true,
      'kyc.status' : 'approved',
      'location.coordinates': { $ne: [0, 0] }
    })
      .select('-password -iban -kyc.kbisUrl -kyc.idCardUrl')
      .lean()

    if (!pro) return res.status(404).json({ message: 'Salon introuvable.' })

    res.json({ pro })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

/**
 * GET /api/search/salons?q=
 * Suggestions de salons par nom (autocomplétion prestation)
 */
exports.searchSalonSuggestions = async (req, res) => {
  try {
    const { q, limit = 5 } = req.query
    const trimmed = (q || '').trim()
    if (trimmed.length < 2) return res.json({ data: [] })

    const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const pros = await Pro.find({
      isActive               : true,
      'kyc.status'           : 'approved',
      'location.coordinates' : { $ne: [0, 0] },
      salonName              : regex
    })
      .select('salonName city postalCode shopPhotos categories')
      .sort({ salonName: 1 })
      .limit(Number(limit))
      .lean()

    res.json({ data: pros })
  } catch (err) {
    console.error('[searchSalonSuggestions]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
