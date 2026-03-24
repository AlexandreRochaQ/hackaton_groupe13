import { Router } from 'express'
import { createUser, authenticate, getUserById, listUsers } from '../services/authService.js'
import { requireAuth, requireAdmin } from '../services/authMiddleware.js'

const router = Router()

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, role = 'user', name } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const user = await createUser({ email, password, role, name })
    res.status(201).json({ success: true, data: { user } })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' })
    }

    const result = await authenticate(email, password)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await getUserById(req.user.sub)
  res.json({ success: true, data: user })
})

router.get('/users', requireAdmin, async (req, res) => {
  const users = await listUsers()
  res.json({ success: true, data: users })
})

export default router
