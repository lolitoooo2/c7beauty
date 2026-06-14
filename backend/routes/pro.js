const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const { requireRole } = require('../middleware/auth')
const { getMe, updateMe, addShopPhoto, deleteShopPhoto, reorderShopPhotos } = require('../controllers/proController')
const { shopsUpload } = require('../middleware/upload')
const svc = require('../controllers/serviceController')
const col = require('../controllers/collaboratorController')
const schedule = require('../controllers/scheduleController')
const { avatarCollaboratorUpload } = require('../middleware/upload')

router.use(auth)
router.use(requireRole('pro'))

router.get('/',                   getMe)
router.put('/',                   updateMe)

// Collaborateurs
router.get('/collaborators',                      col.list)
router.post('/collaborators',                     col.create)
router.put('/collaborators/:id',                  col.update)
router.patch('/collaborators/:id/status',         col.toggleActive)
router.post('/collaborators/:id/resend-invite',   col.resendInvite)
router.delete('/collaborators/:id',               col.remove)
router.post('/collaborators/:id/photo',           avatarCollaboratorUpload.single('photo'), async (req, res) => {
  try {
    const collaborator = await require('../models/Collaborator').findOne({ _id: req.params.id, proId: req.userId })
    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })
    if (!req.file) return res.status(400).json({ message: 'Photo requise.' })
    collaborator.photo = req.file.filename
    await collaborator.save()
    res.json({ message: 'Photo mise à jour.', data: collaborator })
  } catch {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
})

// Planning & horaires
router.get('/schedule/weekly',              schedule.getWeekly)
router.put('/schedule/weekly',              schedule.saveWeekly)
router.delete('/schedule/weekly/custom',    schedule.resetWeekly)
router.get('/schedule/periods',             schedule.listPeriods)
router.post('/schedule/periods',            schedule.createPeriod)
router.delete('/schedule/periods/:id',      schedule.removePeriod)
router.get('/schedule/exceptions',          schedule.listExceptions)
router.post('/schedule/exceptions',         schedule.createException)
router.delete('/schedule/exceptions/:id',   schedule.removeException)
router.get('/schedule/calendar',            schedule.getCalendar)

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
