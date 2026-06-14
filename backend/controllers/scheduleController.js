const WeeklySchedule    = require('../models/WeeklySchedule')
const SchedulePeriod    = require('../models/SchedulePeriod')
const ScheduleException = require('../models/ScheduleException')
const Collaborator      = require('../models/Collaborator')
const {
  normalizeDays,
  parseDateOnly,
  getOrCreateSalonSchedule,
  getWeeklyForEditor,
  saveCollaboratorWeekly,
  resetCollaboratorWeekly,
  computeAvailableSlots,
  buildCalendarEvents
} = require('../utils/scheduleHelpers')

async function assertCollaborator (proId, collaboratorId) {
  if (!collaboratorId) return null
  const c = await Collaborator.findOne({ _id: collaboratorId, proId })
  if (!c) throw Object.assign(new Error('Collaborateur introuvable.'), { status: 404 })
  return c
}

// ── GET /api/pro/schedule/weekly ──────────────────────
exports.getWeekly = async (req, res) => {
  try {
    const collaboratorId = req.query.collaboratorId || null
    await assertCollaborator(req.userId, collaboratorId)

    const result = await getWeeklyForEditor(req.userId, collaboratorId)
    res.json({ data: { days: result.days }, inherited: result.inherited, hasCustom: result.hasCustom })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── PUT /api/pro/schedule/weekly ──────────────────────
exports.saveWeekly = async (req, res) => {
  try {
    const collaboratorId = req.body.collaboratorId || null
    await assertCollaborator(req.userId, collaboratorId)

    const days = normalizeDays(req.body.days)

    if (collaboratorId) {
      const schedule = await saveCollaboratorWeekly(req.userId, collaboratorId, days)
      return res.json({
        message: 'Horaires du collaborateur enregistrés.',
        data: schedule,
        inherited: false,
        hasCustom: true
      })
    }

    const schedule = await getOrCreateSalonSchedule(req.userId)
    schedule.days = days
    await schedule.save()
    res.json({ message: 'Horaires du salon enregistrés.', data: schedule, inherited: false, hasCustom: false })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── DELETE /api/pro/schedule/weekly/custom ────────────
exports.resetWeekly = async (req, res) => {
  try {
    const collaboratorId = req.query.collaboratorId
    if (!collaboratorId) {
      return res.status(400).json({ message: 'collaboratorId requis.' })
    }
    await assertCollaborator(req.userId, collaboratorId)
    await resetCollaboratorWeekly(req.userId, collaboratorId)

    const result = await getWeeklyForEditor(req.userId, collaboratorId)
    res.json({
      message: 'Le collaborateur utilise à nouveau les horaires du salon.',
      data: { days: result.days },
      inherited: true,
      hasCustom: false
    })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── GET /api/pro/schedule/periods ─────────────────────
exports.listPeriods = async (req, res) => {
  try {
    const filter = { proId: req.userId }
    if (req.query.collaboratorId) {
      await assertCollaborator(req.userId, req.query.collaboratorId)
      filter.collaboratorId = req.query.collaboratorId
    }
    const periods = await SchedulePeriod.find(filter).sort({ validFrom: 1 }).lean()
    res.json({ data: periods })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── POST /api/pro/schedule/periods ──────────────────
exports.createPeriod = async (req, res) => {
  try {
    const { label, validFrom, validTo, days, collaboratorId = null } = req.body
    if (!label?.trim() || !validFrom || !validTo) {
      return res.status(400).json({ message: 'Label et dates requis.' })
    }

    await assertCollaborator(req.userId, collaboratorId)

    const from = parseDateOnly(validFrom)
    const to   = parseDateOnly(validTo)
    if (!from || !to || to < from) {
      return res.status(400).json({ message: 'Plage de dates invalide.' })
    }

    const period = await SchedulePeriod.create({
      proId          : req.userId,
      collaboratorId : collaboratorId || null,
      label          : label.trim(),
      validFrom      : from,
      validTo        : to,
      days           : normalizeDays(days)
    })

    res.status(201).json({ message: 'Période créée.', data: period })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── DELETE /api/pro/schedule/periods/:id ────────────
exports.removePeriod = async (req, res) => {
  try {
    const period = await SchedulePeriod.findOneAndDelete({ _id: req.params.id, proId: req.userId })
    if (!period) return res.status(404).json({ message: 'Période introuvable.' })
    res.json({ message: 'Période supprimée.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/pro/schedule/exceptions ──────────────────
exports.listExceptions = async (req, res) => {
  try {
    const from = parseDateOnly(req.query.from)
    const to   = parseDateOnly(req.query.to)
    if (!from || !to) {
      return res.status(400).json({ message: 'Paramètres from et to requis (YYYY-MM-DD).' })
    }

    const filter = {
      proId     : req.userId,
      startDate : { $lte: to },
      endDate   : { $gte: from }
    }

    if (req.query.collaboratorId) {
      await assertCollaborator(req.userId, req.query.collaboratorId)
      filter.$or = [
        { collaboratorId: null },
        { collaboratorId: req.query.collaboratorId }
      ]
    }

    const exceptions = await ScheduleException.find(filter).sort({ startDate: 1 }).lean()
    res.json({ data: exceptions })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── POST /api/pro/schedule/exceptions ─────────────────
exports.createException = async (req, res) => {
  try {
    const {
      startDate, endDate, type = 'closed',
      slots = [], serviceIds = [], label = '',
      collaboratorId = null
    } = req.body

    const start = parseDateOnly(startDate)
    const end   = parseDateOnly(endDate || startDate)
    if (!start || !end || end < start) {
      return res.status(400).json({ message: 'Dates invalides.' })
    }

    await assertCollaborator(req.userId, collaboratorId)

    const exception = await ScheduleException.create({
      proId          : req.userId,
      collaboratorId : collaboratorId || null,
      startDate      : start,
      endDate        : end,
      type,
      slots,
      serviceIds,
      label          : label.trim()
    })

    res.status(201).json({ message: 'Exception enregistrée.', data: exception })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── DELETE /api/pro/schedule/exceptions/:id ───────────
exports.removeException = async (req, res) => {
  try {
    const ex = await ScheduleException.findOneAndDelete({ _id: req.params.id, proId: req.userId })
    if (!ex) return res.status(404).json({ message: 'Exception introuvable.' })
    res.json({ message: 'Exception supprimée.' })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── GET /api/pro/schedule/calendar ────────────────────
exports.getCalendar = async (req, res) => {
  try {
    const { from, to, collaboratorId = null } = req.query
    if (!from || !to) {
      return res.status(400).json({ message: 'Paramètres from et to requis.' })
    }

    await assertCollaborator(req.userId, collaboratorId)

    const events = await buildCalendarEvents({
      proId          : req.userId,
      collaboratorId : collaboratorId || null,
      fromStr        : from,
      toStr          : to
    })

    res.json({ data: events })
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Erreur serveur.' })
  }
}

// ── GET /api/availability/slots ───────────────────────
exports.getSlots = async (req, res) => {
  try {
    const { collaboratorId, serviceId, date, proId } = req.query

    if (!collaboratorId || !serviceId || !date) {
      return res.status(400).json({ message: 'collaboratorId, serviceId et date requis.' })
    }

    let resolvedProId = proId
    if (req.userRole === 'pro') {
      resolvedProId = req.userId
    } else if (req.userRole === 'collaborator') {
      resolvedProId = req.proId
      if (String(req.userId) !== String(collaboratorId)) {
        return res.status(403).json({ message: 'Accès refusé.' })
      }
    } else if (!resolvedProId) {
      return res.status(400).json({ message: 'proId requis.' })
    }

    const result = await computeAvailableSlots({
      proId          : resolvedProId,
      collaboratorId,
      serviceId,
      dateStr        : date
    })

    res.json(result)
  } catch (err) {
    console.error('[schedule.getSlots]', err)
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}

// ── Collaborateur : calendrier ────────────────────────
exports.getCollaboratorCalendar = async (req, res) => {
  try {
    const collaborator = await Collaborator.findById(req.userId)
    if (!collaborator) return res.status(404).json({ message: 'Collaborateur introuvable.' })

    const { from, to } = req.query
    if (!from || !to) {
      return res.status(400).json({ message: 'Paramètres from et to requis.' })
    }

    const events = await buildCalendarEvents({
      proId          : collaborator.proId,
      collaboratorId : collaborator._id,
      fromStr        : from,
      toStr          : to
    })

    res.json({ data: events })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur.' })
  }
}
