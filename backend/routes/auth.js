const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { kycUpload } = require('../middleware/upload')
const {
  registerClient, registerPro,
  login, loginAdmin, setupAdmin, me
} = require('../controllers/authController')

router.post('/register/client',  registerClient)
router.post('/register/pro',     kycUpload.fields([{ name: 'kbis', maxCount: 1 }, { name: 'idCard', maxCount: 1 }]), registerPro)
router.post('/login',            login)
router.post('/login/admin',      loginAdmin)
router.post('/admin/setup',      setupAdmin)   // à désactiver en production
router.get('/me',                auth, me)

module.exports = router
