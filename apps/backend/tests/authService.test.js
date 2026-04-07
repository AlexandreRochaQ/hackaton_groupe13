import { jest } from '@jest/globals'

// Mock des dépendances
jest.mock('bcrypt')
jest.mock('jsonwebtoken')
jest.mock('../src/services/authDb.js', () => ({
  db: jest.fn(() => ({
    where: jest.fn(() => ({ first: jest.fn() })),
    insert: jest.fn(),
    select: jest.fn(),
  })),
}))

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { createUser, authenticate, getUserById, listUsers, verifyToken } from '../src/services/authService.js'
import { db } from '../src/services/authDb.js'

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const mockQuery = {
      where: jest.fn(() => ({ first: jest.fn() })),
      insert: jest.fn(),
      select: jest.fn(),
    }
    db.mockReturnValue(mockQuery)
  })

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const mockUser = { email: 'test@example.com', password: 'password123', role: 'user', name: 'Test User' }
      const mockQuery = db()
      mockQuery.where().first.mockResolvedValue(null)
      mockQuery.insert.mockResolvedValue([1])
      bcrypt.hash.mockResolvedValue('hashedPassword')

      const result = await createUser(mockUser)

      expect(mockQuery.where).toHaveBeenCalledWith({ email: mockUser.email })
      expect(bcrypt.hash).toHaveBeenCalledWith(mockUser.password, 10)
      expect(mockQuery.insert).toHaveBeenCalledWith({
        email: mockUser.email,
        passwordHash: 'hashedPassword',
        role: mockUser.role,
        name: mockUser.name
      })
      expect(result).toEqual({ id: 1, email: mockUser.email, role: mockUser.role, name: mockUser.name })
    })

    it('should throw error if email already exists', async () => {
      const mockUser = { email: 'existing@example.com', password: 'password123' }
      db.where = jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue({ id: 1, email: mockUser.email })
      })

      await expect(createUser(mockUser)).rejects.toThrow('Email already registered')
    })
  })

  describe('authenticate', () => {
    it('should authenticate user successfully', async () => {
      const email = 'test@example.com'
      const password = 'password123'
      const mockUser = { id: 1, email, passwordHash: 'hashedPassword', role: 'user', name: 'Test User' }
      const mockToken = 'jwtToken'

      db.where().first.mockResolvedValue(mockUser)
      bcrypt.compare.mockResolvedValue(true)
      jwt.sign.mockReturnValue(mockToken)

      const result = await authenticate(email, password)

      expect(db.where).toHaveBeenCalledWith({ email })
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash)
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        process.env.JWT_SECRET || 'change-me-to-a-strong-secret',
        { expiresIn: '12h' }
      )
      expect(result).toEqual({
        token: mockToken,
        user: { id: mockUser.id, email: mockUser.email, role: mockUser.role, name: mockUser.name }
      })
    })

    it('should throw error if user not found', async () => {
      db.where = jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue(null)
      })

      await expect(authenticate('nonexistent@example.com', 'password')).rejects.toThrow('Invalid credentials')
    })

    it('should throw error if password does not match', async () => {
      const mockUser = { id: 1, email: 'test@example.com', passwordHash: 'hashedPassword' }
      db.where = jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue(mockUser)
      })
      bcrypt.compare = jest.fn().mockResolvedValue(false)

      await expect(authenticate('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const mockUser = { id: 1, email: 'test@example.com', role: 'user', name: 'Test User', createdAt: '2023-01-01' }
      db.where().first.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      })

      const result = await getUserById(1)

      expect(db.where).toHaveBeenCalledWith({ id: 1 })
      expect(result).toBe(mockUser)
    })
  })

  describe('listUsers', () => {
    it('should return list of users', async () => {
      const mockUsers = [
        { id: 1, email: 'user1@example.com', role: 'user', name: 'User 1', createdAt: '2023-01-01' },
        { id: 2, email: 'user2@example.com', role: 'admin', name: 'User 2', createdAt: '2023-01-02' }
      ]
      db.select.mockResolvedValue(mockUsers)

      const result = await listUsers()

      expect(db.select).toHaveBeenCalledWith('id', 'email', 'role', 'name', 'createdAt')
      expect(result).toBe(mockUsers)
    })
  })

  describe('verifyToken', () => {
    it('should verify token successfully', () => {
      const mockPayload = { sub: 1, email: 'test@example.com', role: 'user' }
      jwt.verify = jest.fn().mockReturnValue(mockPayload)

      const result = verifyToken('validToken')

      expect(jwt.verify).toHaveBeenCalledWith('validToken', process.env.JWT_SECRET || 'change-me-to-a-strong-secret')
      expect(result).toBe(mockPayload)
    })

    it('should throw error for invalid token', () => {
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token')
      })

      expect(() => verifyToken('invalidToken')).toThrow('Invalid token')
    })
  })
})