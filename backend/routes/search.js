const express = require('express')
const router  = express.Router()
const { searchPros, getSalon, searchSalonSuggestions } = require('../controllers/searchController')

// Routes publiques
router.get('/pros',       searchPros)
router.get('/salons',     searchSalonSuggestions)
router.get('/salon/:id',  getSalon)

module.exports = router
