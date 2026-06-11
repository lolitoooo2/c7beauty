const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const c  = require('../controllers/adminController')
const cc = require('../controllers/categoryController')

router.use(auth)
router.use(requireRole('admin'))

// Stats
router.get('/stats',              c.getStats)

// Pros CRUD
router.get('/pros',               c.getPros)
router.get('/pros/:id',           c.getPro)
router.post('/pros',              c.createPro)
router.put('/pros/:id',           c.updatePro)
router.delete('/pros/:id',        c.deletePro)
router.patch('/pros/:id/kyc',     c.updateKyc)

// Clients CRUD
router.get('/clients',            c.getClients)
router.get('/clients/:id',        c.getClient)
router.post('/clients',           c.createClient)
router.put('/clients/:id',        c.updateClient)
router.delete('/clients/:id',     c.deleteClient)

// Documents KYC (accès sécurisé admin uniquement)
router.get('/docs/:filename',     c.getDoc)

// Catégories & sous-catégories
router.get('/categories',                              cc.adminGetAll)
router.post('/categories',                             cc.adminCreate)
router.put('/categories/:id',                          cc.adminUpdate)
router.delete('/categories/:id',                       cc.adminDelete)
router.post('/categories/:id/subcategories',           cc.adminAddSub)
router.delete('/categories/:id/subcategories/:subId',  cc.adminDeleteSub)

module.exports = router
