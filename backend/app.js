import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import documentsRouter from './routes/documents.js'
import extractionRouter from './routes/extraction.js'
import validationRouter from './routes/validation.js'
import crmRouter from './routes/crm.js'
import complianceRouter from './routes/compliance.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/documents', documentsRouter)
app.use('/api/extraction', extractionRouter)
app.use('/api/validation', validationRouter)
app.use('/api/crm', crmRouter)
app.use('/api/compliance', complianceRouter)

app.get('/.well-known/*', (_req, res) => res.status(204).end())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mock: process.env.USE_MOCK_SERVICES === 'true', ts: new Date().toISOString() })
})

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`BFF running → http://localhost:${PORT}`)
  console.log(`Mock mode: ${process.env.USE_MOCK_SERVICES === 'true' ? 'ON ✓' : 'OFF'}`)
})
