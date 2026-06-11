const Category = require('../models/Category')

const CATEGORIES = [
  {
    name : 'Beauté des ongles',
    slug : 'ongles',
    icon : 'Sparkles',
    order: 1,
    subcategories: [
      { name: 'Pose de gel',                  slug: 'pose-gel' },
      { name: 'Pose de résine',               slug: 'pose-resine' },
      { name: 'Ongles américains',            slug: 'ongles-americains' },
      { name: 'Nail art',                     slug: 'nail-art' },
      { name: 'Dépose / remplissage',         slug: 'depose-remplissage' },
      { name: 'Manucure classique',            slug: 'manucure-classique' },
      { name: 'Manucure Russe',               slug: 'manucure-russe' },
      { name: 'Pédicure esthétique',          slug: 'pedicure' },
      { name: 'French manucure',              slug: 'french-manucure' },
    ]
  },
  {
    name : 'Coiffure',
    slug : 'coiffure',
    icon : 'Scissors',
    order: 2,
    subcategories: [
      { name: 'Coupe femme',                slug: 'coupe-femme' },
      { name: 'Coupe homme',                slug: 'coupe-homme' },
      { name: 'Coupe enfant',                slug: 'coupe-enfant' },
      { name: 'Brushing',                    slug: 'brushing' },
      { name: 'Tresses',                     slug: 'tresses' },
      { name: 'Vanilles',                    slug: 'vanilles' },
      { name: 'Nattes',                      slug: 'nattes' },
      { name: 'Coloration',                  slug: 'coloration' },
      { name: 'Mèches',                      slug: 'meches' },
      { name: 'Tie and dye',                 slug: 'tie-and-dye' },
      { name: 'Défrisage',                   slug: 'defrisage' },
      { name: 'Botox capillaire',            slug: 'botox-capillaire' },
      { name: 'Kératine',                    slug: 'keratine' },
      { name: 'Coiffure événementielle',     slug: 'coiffure-evenementielle' },
    ]
  },
  {
    name : 'Esthétique & soins visage',
    slug : 'esthetique',
    icon : 'Heart',
    order: 3,
    subcategories: [
      { name: 'Soins visage (hydratant, purifiant, anti-âge, acné)', slug: 'soins-visage' },
      { name: 'Gommage visage',              slug: 'gommage-visage' },
      { name: 'Masque éclat ou détox',       slug: 'masque-eclat' },
      { name: 'Épilation à la cire',          slug: 'epilation-cire' },
      { name: 'Épilation au fil',            slug: 'epilation-fil' },
      { name: 'Épilation à la pince',        slug: 'epilation-pince' },
      { name: 'Détatouage sourcils',         slug: 'detatouage-sourcils' },
    ]
  },
  {
    name : 'Cils & sourcils',
    slug : 'cils-sourcils',
    icon : 'Eye',
    order: 4,
    subcategories: [
      { name: 'Extensions de cils (cil à cil, volume russe, mixte)', slug: 'extensions-cils' },
      { name: 'Rehaussement de cils',          slug: 'rehaussement-cils' },
      { name: 'Teinture de cils',              slug: 'teinture-cils' },
      { name: 'Microblading',                  slug: 'microblading' },
      { name: 'Microshading',                  slug: 'microshading' },
      { name: 'Brow lift',                     slug: 'brow-lift' },
      { name: 'Restructuration sourcils',      slug: 'restructuration-sourcils' },
    ]
  },
  {
    name : 'Massages & bien-être',
    slug : 'massages',
    icon : 'HeartPulse',
    order: 5,
    subcategories: [
      { name: 'Massage relaxant',               slug: 'massage-relaxant' },
      { name: 'Massage californien',            slug: 'massage-californien' },
      { name: 'Massage suédois',                slug: 'massage-suedo' },
      { name: 'Massage prénatal',               slug: 'massage-prenatal' },
      { name: 'Massage amincissant',            slug: 'massage-amincissant' },
      { name: 'Massage lymphatique',            slug: 'massage-lymphatique' },
      { name: 'Soin du dos',                    slug: 'soin-dos' },
      { name: 'Massage du cuir chevelu',        slug: 'massage-cuir-chevelu' },
    ]
  },
  {
    name : 'Soins corps',
    slug : 'soins-corps',
    icon : 'Droplets',
    order: 6,
    subcategories: [
      { name: 'Gommage corps',                    slug: 'gommage-corps' },
      { name: 'Enveloppement (argile, boue, etc.)', slug: 'enveloppement' },
      { name: 'Soin minceur',                     slug: 'soin-minceur' },
      { name: 'Hydratation profonde',              slug: 'hydratation-profonde' },
      { name: 'Traitement anti-vergetures / fermeté', slug: 'anti-vergetures' },
    ]
  },
  {
    name : 'Maquillage',
    slug : 'maquillage',
    icon : 'Palette',
    order: 7,
    subcategories: [
      { name: 'Maquillage soft glam',              slug: 'soft-glam' },
      { name: 'Maquillage événement (soirée, mariage, shooting)', slug: 'maquillage-evenement' },
      { name: 'Maquillage artistique / pro',       slug: 'maquillage-artistique' },
      { name: "Cours d'auto-maquillage (1h à 2h)", slug: 'cours-maquillage' },
    ]
  },
  {
    name : 'Accompagnement & coaching',
    slug : 'coaching',
    icon : 'GraduationCap',
    order: 8,
    subcategories: [
      { name: 'Coaching beauté',                    slug: 'coaching-beaute' },
      { name: 'Conseil skincare',                  slug: 'conseil-skincare' },
      { name: 'Accompagnement capillaire personnalisé', slug: 'accompagnement-capillaire' },
      { name: 'Formation express : auto-coiffure, tresses, make-up', slug: 'formation-express' },
      { name: 'Conseil en image / relooking express', slug: 'relooking' },
      { name: 'Shooting photo beauté',               slug: 'shooting-photo' },
    ]
  }
]

/**
 * Insère les catégories en base si la collection est vide.
 * Appelé au démarrage du serveur.
 */
async function seedCategories () {
  const count = await Category.countDocuments()
  if (count > 0) return   // déjà seedé

  await Category.insertMany(CATEGORIES)
  console.log(`[seed] ${CATEGORIES.length} catégories insérées.`)
}

module.exports = { seedCategories, CATEGORIES }
