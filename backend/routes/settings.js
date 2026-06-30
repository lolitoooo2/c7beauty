const express = require('express')
const router  = express.Router()
const c       = require('../controllers/settingsController')

router.get('/', c.getPublicSettings)

module.exports = router
