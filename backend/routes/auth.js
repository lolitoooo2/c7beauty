const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { kycUpload } = require('../middleware/upload')
const {
  registerClient, registerPro,
  login, loginAdmin, setupAdmin, me
} = require('../controllers/authController')
const colAuth = require('../controllers/collaboratorController')

router.post('/register/client',  registerClient)
router.post('/register/pro',     kycUpload.fields([{ name: 'kbis', maxCount: 1 }, { name: 'idCard', maxCount: 1 }]), registerPro)
router.post('/login',            login)
router.post('/login/admin',      loginAdmin)
router.post('/login/collaborator', colAuth.login)
router.get('/invite/collaborator/:token',  colAuth.getInvite)
router.post('/invite/collaborator/:token', colAuth.acceptInvite)
router.post('/admin/setup',      setupAdmin)   // à désactiver en production
router.get('/me',                auth, me)

module.exports = router
