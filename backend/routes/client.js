const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const { getMe, updateMe, uploadAvatar, deleteAvatar } = require('../controllers/clientController')
const { avatarClientUpload } = require('../middleware/upload')

router.use(auth)
router.use(requireRole('client'))

router.get('/',          getMe)
router.put('/',          updateMe)
router.put('/avatar',    avatarClientUpload.single('avatar'), uploadAvatar)
router.delete('/avatar', deleteAvatar)

module.exports = router
