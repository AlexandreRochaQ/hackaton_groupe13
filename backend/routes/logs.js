import { Router } from 'express'

const router = Router()

const SERVICES = ['ocr-service', 'ner-service', 'validator', 'data-lake', 'api', 'groq-client']

const LOG_TEMPLATES = [
  { level: 'INFO',  service: 'ocr-service',  msg: (doc) => `OCR completed for ${doc} (confidence: ${(0.75 + Math.random() * 0.24).toFixed(2)})` },
  { level: 'INFO',  service: 'ner-service',  msg: (doc) => `NER extracted ${Math.floor(5 + Math.random() * 8)} entities from ${doc}` },
  { level: 'INFO',  service: 'validator',    msg: ()    => `Cross-document validation passed — all SIRETs match` },
  { level: 'WARN',  service: 'validator',    msg: ()    => `Validation: SIRET mismatch detected between facture and kbis` },
  { level: 'INFO',  service: 'data-lake',    msg: (doc) => `Document ${doc} written to raw_zone` },
  { level: 'INFO',  service: 'data-lake',    msg: (doc) => `Document ${doc} written to clean_zone` },
  { level: 'INFO',  service: 'data-lake',    msg: (doc) => `Document ${doc} written to curated_zone` },
  { level: 'INFO',  service: 'api',          msg: ()    => `POST /api/documents/upload — 200 OK (${Math.floor(100 + Math.random() * 900)}ms)` },
  { level: 'INFO',  service: 'api',          msg: ()    => `GET /api/extraction/:batchId — 200 OK (${Math.floor(20 + Math.random() * 80)}ms)` },
  { level: 'WARN',  service: 'ocr-service',  msg: (doc) => `Low OCR confidence for ${doc} (${(0.4 + Math.random() * 0.2).toFixed(2)}) — scanned document?` },
  { level: 'ERROR', service: 'groq-client',  msg: ()    => `Rate limit hit on key #1 — rotating to key #2` },
  { level: 'INFO',  service: 'groq-client',  msg: ()    => `Groq API call succeeded (llama-3.3-70b, ${Math.floor(200 + Math.random() * 400)} tokens)` },
  { level: 'INFO',  service: 'groq-client',  msg: ()    => `Vision model responded: llama-4-scout (${Math.floor(500 + Math.random() * 1000)} tokens)` },
  { level: 'INFO',  service: 'ner-service',  msg: ()    => `Structured JSON extraction complete — 8/9 fields populated` },
  { level: 'WARN',  service: 'data-lake',    msg: ()    => `MongoDB write latency high (${Math.floor(200 + Math.random() * 300)}ms) — check Atlas` },
]

const DOC_NAMES = [
  'facture_dupont.pdf',
  'kbis_acme.pdf',
  'urssaf_2024.pdf',
  'rib_fournisseur.pdf',
  'devis_123.pdf',
  'attestation_siret.pdf',
]

// Rolling log store — max 200 entries (FIFO)
const logStore = []

function pushLog(level, service, message) {
  if (logStore.length >= 200) logStore.shift()
  logStore.push({ timestamp: new Date().toISOString(), level, service, message })
}

// Seed initial logs to look realistic on first load
for (let i = 0; i < 40; i++) {
  const tpl = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]
  const doc = DOC_NAMES[Math.floor(Math.random() * DOC_NAMES.length)]
  if (logStore.length >= 200) logStore.shift()
  logStore.push({
    timestamp: new Date(Date.now() - (40 - i) * 7500).toISOString(),
    level: tpl.level,
    service: tpl.service,
    message: tpl.msg(doc),
  })
}

// Simulate live log activity
setInterval(() => {
  const tpl = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]
  const doc = DOC_NAMES[Math.floor(Math.random() * DOC_NAMES.length)]
  pushLog(tpl.level, tpl.service, tpl.msg(doc))
}, 6000)

/**
 * GET /api/logs?limit=50&level=all
 */
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 200)
  const level = (req.query.level || 'all').toUpperCase()

  let logs = logStore.slice(-limit)
  if (level !== 'ALL') {
    logs = logs.filter(l => l.level === level)
  }

  res.json({ success: true, logs, total: logStore.length })
})

export default router
