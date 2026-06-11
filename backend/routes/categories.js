const express = require('express')
const router  = express.Router()
const c       = require('../controllers/categoryController')

// Route publique (accessible sans auth)
router.get('/', c.getAll)

module.exports = router
