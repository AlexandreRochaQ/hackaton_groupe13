import { v4 as uuidv4 } from 'uuid'
import { runRealPipeline } from './realPipeline.js'

const store = new Map()

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

export function createBatch(files) {
  const batchId = uuidv4()
  const documents = files.map(f => ({
    id: uuidv4(),
    name: f.originalname,
    size: f.size,
    mimetype: f.mimetype,
    type: detectType(f.originalname),
    status: 'uploaded',
  }))

  const batch = {
    batchId,
    pipelineStep: 'uploaded',
    documents,
    createdAt: new Date().toISOString(),
    extraction: null,
    validation: null,
    _files: files,
  }

  store.set(batchId, batch)
  runRealPipeline(batch)
  return { batchId, documents }
}

export function getBatch(batchId) {
  return store.get(batchId) || null
}
