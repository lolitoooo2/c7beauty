const express = require('express')
const router  = express.Router()
const c       = require('../controllers/serviceController')

// Route publique : catalogue d'un salon (future page pro publique)
router.get('/pro/:proId', c.getByPro)

module.exports = router
