import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { db } from './authDb.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-strong-secret'
const JWT_EXPIRES = '12h'

export async function createUser({ email, password, role = 'operator', name }) {
  const existing = await db('users').where({ email }).first()
  if (existing) {
    const err = new Error('Email already registered')
    err.status = 409
    throw err
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [id] = await db('users').insert({ email, passwordHash, role, name })
  return { id, email, role, name }
}

export async function authenticate(email, password) {
  const user = await db('users').where({ email }).first()
  if (!user) {
    console.log('User not found for email:', email)
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const match = await bcrypt.compare(password, user.passwordHash)
  console.log('Password match for user:', user.email, match)
  if (!match) {
    const err = new Error('Invalid credentials')
    err.status = 401
    throw err
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )

  return { token, user: { id: user.id, email: user.email, role: user.role, name: user.name } }
}

export async function getUserById(id) {
  return db('users').where({ id }).first().select('id', 'email', 'role', 'name', 'createdAt')
}

export async function listUsers() {
  return db('users').select('id', 'email', 'role', 'name', 'createdAt')
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (err) {
    const error = new Error('Invalid token')
    error.status = 401
    throw error
  }
}
