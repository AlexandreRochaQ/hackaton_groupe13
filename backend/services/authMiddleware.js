import { verifyToken } from './authService.js'

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  try {
    req.user = verifyToken(token)
    next()
  } catch (err) {
    res.status(err.status || 401).json({ success: false, error: err.message })
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' })
    }
    next()
  })
}
