const mongoose = require('mongoose')

/**
 * Collection : services
 * Catalogue personnalisé de chaque pro.
 * Entité indépendante, liée au pro via proId.
 *
 * Structure :
 *   groupLabel  → nom libre de la rubrique ("Mes coupes", "Colorations"…)
 *   name        → nom de la prestation ("Coupe femme", "Balayage"…)
 *   duration    → durée en minutes
 *   price       → tarif en €
 *   categoryHint→ slug global optionnel (pour la recherche future)
 */
const serviceSchema = new mongoose.Schema(
  {
    proId : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Pro',
      required : true,
      index    : true
    },

    groupLabel  : { type: String, required: true, trim: true },   // groupe libre du pro
    name        : { type: String, required: true, trim: true },   // nom de la prestation
    description : { type: String, default: '', trim: true },      // détail optionnel
    duration    : { type: Number, required: true, min: 5 },       // en minutes
    price       : { type: Number, required: true, min: 0 },       // en €
    categoryHint: { type: String, default: null },                // slug catégorie globale (optionnel)

    active : { type: Boolean, default: true },
    order  : { type: Number, default: 0 }                         // tri manuel dans le groupe
  },
  {
    timestamps : true,
    collection : 'services'
  }
)

// Index pour les requêtes fréquentes
serviceSchema.index({ proId: 1, active: 1 })
serviceSchema.index({ proId: 1, groupLabel: 1 })

module.exports = mongoose.model('Service', serviceSchema)
