const express = require('express')
const router  = express.Router()

router.get('/health', (req, res) => {
  res.json({ message: "API C7'Beauty opérationnelle ✅" })
})

router.use('/auth',       require('./auth'))
router.use('/client',     require('./client'))
router.use('/pro',        require('./pro'))
router.use('/admin',      require('./admin'))
router.use('/categories', require('./categories'))
router.use('/services',   require('./services'))
router.use('/search',     require('./search'))
router.use('/collaborator', require('./collaborator'))
router.use('/availability', require('./availability'))
router.use('/bookings', require('./bookings'))

module.exports = router
