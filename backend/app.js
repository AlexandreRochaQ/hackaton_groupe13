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
import datalakeRouter from './routes/datalake.js'
import logsRouter from './routes/logs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '../.env') })

// Node.js v24 + OpenSSL 3 has stricter TLS — bypass for outbound API calls in dev
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/documents', documentsRouter)
app.use('/api/extraction', extractionRouter)
app.use('/api/validation', validationRouter)
app.use('/api/crm', crmRouter)
app.use('/api/compliance', complianceRouter)
app.use('/api/datalake', datalakeRouter)
app.use('/api/logs', logsRouter)

app.get('/.well-known/*', (_req, res) => res.status(204).end())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ success: false, error: err.message || 'Internal server error' })
})

// Local dev: listen only when not imported by Vercel
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => console.log(`BFF running → http://localhost:${PORT}`))
}

export default app
