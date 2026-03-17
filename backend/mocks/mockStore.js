import { v4 as uuidv4 } from 'uuid'
import { getMockExtraction, getMockValidation } from './mockData.js'

const store = new Map()

const PIPELINE = ['uploaded', 'ocr_processing', 'extracting', 'validating', 'ready']
const STEP_DELAY_MS = 3000

function detectType(filename) {
  const f = filename.toLowerCase()
  if (f.includes('facture') || f.includes('invoice')) return 'facture'
  if (f.includes('devis') || f.includes('quote')) return 'devis'
  if (f.includes('kbis')) return 'kbis'
  if (f.includes('urssaf') || f.includes('vigilance')) return 'urssaf'
  if (f.includes('siret') || f.includes('attestation')) return 'attestation_siret'
  if (f.includes('rib')) return 'rib'
  return 'inconnu'
}

function advancePipeline(batchId) {
  const batch = store.get(batchId)
  if (!batch) return

  const idx = PIPELINE.indexOf(batch.pipelineStep)
  if (idx === -1 || idx >= PIPELINE.length - 1) return

  const nextStep = PIPELINE[idx + 1]
  batch.pipelineStep = nextStep
  batch.documents.forEach(doc => { doc.status = nextStep })

  if (nextStep === 'ready') {
    batch.extraction = getMockExtraction(batch.documents)
    batch.validation = getMockValidation(batch.documents)
  } else {
    setTimeout(() => advancePipeline(batchId), STEP_DELAY_MS)
  }
}

export function createBatch(files) {
  const batchId = uuidv4()
  const documents = files.map(file => ({
    id: uuidv4(),
    name: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    type: detectType(file.originalname),
    status: 'uploaded',
  }))

  store.set(batchId, {
    batchId,
    pipelineStep: 'uploaded',
    documents,
    createdAt: new Date().toISOString(),
    extraction: null,
    validation: null,
  })

  setTimeout(() => advancePipeline(batchId), STEP_DELAY_MS)
  return { batchId, documents }
}

export function getBatch(batchId) {
  return store.get(batchId) || null
}
