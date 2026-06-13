const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'c7beauty_dev_secret'

/**
 * Vérifie le token JWT et injecte req.userId + req.userRole.
 * Le rôle (client | pro | admin) détermine quelle collection utiliser en aval.
 */
module.exports = function authMiddleware (req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant.' })
  }

  const token = header.split(' ')[1]

  try {
    const decoded        = jwt.verify(token, JWT_SECRET)
    req.userId           = decoded.id
    req.userRole         = decoded.role
    req.proId            = decoded.proId || null
    req.collaboratorId   = decoded.collaboratorId || null
    next()
  } catch {
    res.status(401).json({ message: 'Token invalide ou expiré.' })
  }
}

/**
 * Middleware de restriction par rôle.
 * Usage : router.get('/dashboard', auth, requireRole('pro'), handler)
 */
module.exports.requireRole = function (...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Accès refusé.' })
    }
    next()
  }
}
