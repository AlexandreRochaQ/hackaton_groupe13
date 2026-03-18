import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import documentsRouter from './routes/documents.js'
import extractionRouter from './routes/extraction.js'
import validationRouter from './routes/validation.js'
import crmRouter from './routes/crm.js'
import complianceRouter from './routes/compliance.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

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
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`BFF running → http://localhost:${PORT}`)
})
