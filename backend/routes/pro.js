const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const { getMe, updateMe, addShopPhoto, deleteShopPhoto, reorderShopPhotos } = require('../controllers/proController')
const { shopsUpload } = require('../middleware/upload')
const svc = require('../controllers/serviceController')

router.use(auth)
router.use(requireRole('pro'))

router.get('/',                   getMe)
router.put('/',                   updateMe)

// Photos du salon
router.post('/photos',             shopsUpload.single('photo'), addShopPhoto)
router.delete('/photos/:filename', deleteShopPhoto)
router.put('/photos/reorder',      reorderShopPhotos)

// Catalogue de prestations
router.get('/services',                    svc.getMine)
router.post('/services',                   svc.create)
router.put('/services/group/rename',       svc.renameGroup)
router.delete('/services/group/:label',    svc.removeGroup)
router.put('/services/:id',                svc.update)
router.delete('/services/:id',             svc.remove)

module.exports = router
