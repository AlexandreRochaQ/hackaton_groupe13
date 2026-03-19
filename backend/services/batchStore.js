import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { runRealPipeline } from './realPipeline.js'

// Cached connection for serverless warm reuse
let cachedClient = null
let cachedDb = null

async function getDb() {
  if (cachedDb) return cachedDb
  cachedClient = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    tlsAllowInvalidCertificates: true,
  })
  await cachedClient.connect()
  cachedDb = cachedClient.db(process.env.MONGO_DB || 'docuflow')
  return cachedDb
}

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

/**
 * Create a batch, run the full pipeline, and persist results across the 3 MongoDB zones.
 *
 * Data Lake architecture:
 *   raw_zone     — original file metadata (brut upload)
 *   clean_zone   — OCR text output per document
 *   curated_zone — structured extracted JSON per document
 *   batches      — batch orchestration state
 */
export async function createBatch(files) {
  const batchId = uuidv4()
  const now = new Date().toISOString()

  const documents = files.map(f => ({
    id: uuidv4(),
    name: f.originalname,
    size: f.size,
    mimetype: f.mimetype,
    type: detectType(f.originalname),
    status: 'uploaded',
  }))

  const db = await getDb()

  // ── RAW ZONE: store file metadata immediately on upload ──
  await db.collection('raw_zone').insertMany(
    documents.map(doc => ({
      batchId,
      documentId: doc.id,
      filename: doc.name,
      mimetype: doc.mimetype,
      size: doc.size,
      detectedType: doc.type,
      uploadedAt: now,
    }))
  )

  const batchDoc = {
    batchId,
    pipelineStep: 'uploaded',
    documents,
    createdAt: now,
    extraction: null,
    validation: null,
  }
  await db.collection('batches').insertOne(batchDoc)

  // Attach files in memory only (not saved to MongoDB)
  const batchWithFiles = { ...batchDoc, _files: files }

  // Run pipeline synchronously — populates cleanZoneData, extraction, validation
  await runRealPipeline(batchWithFiles)

  // ── CLEAN ZONE: OCR text per document ──
  const cleanZoneData = batchWithFiles.cleanZoneData || {}
  if (Object.keys(cleanZoneData).length > 0) {
    await db.collection('clean_zone').insertMany(
      documents.map(doc => ({
        batchId,
        documentId: doc.id,
        filename: doc.name,
        ocrText: cleanZoneData[doc.id] || '',
        processedAt: new Date().toISOString(),
      }))
    )
  }

  // ── CURATED ZONE: structured extracted data per document ──
  if (batchWithFiles.extraction?.length > 0) {
    await db.collection('curated_zone').insertMany(
      batchWithFiles.extraction.map(e => ({
        batchId,
        documentId: e.documentId,
        filename: e.documentName,
        documentType: e.type,
        typeLabel: e.typeLabel,
        confidence: e.confidence,
        fields: e.fields,
        anomalies: e.anomalies,
        curatedAt: new Date().toISOString(),
      }))
    )
  }

  // ── Update batch state in orchestration collection ──
  await db.collection('batches').updateOne(
    { batchId },
    {
      $set: {
        pipelineStep: batchWithFiles.pipelineStep,
        documents: batchWithFiles.documents,
        extraction: batchWithFiles.extraction,
        validation: batchWithFiles.validation,
        ...(batchWithFiles.error ? { error: batchWithFiles.error } : {}),
      },
    }
  )

  return { batchId, documents: batchWithFiles.documents }
}

export async function getBatch(batchId) {
  const db = await getDb()
  return db.collection('batches').findOne({ batchId }, { projection: { _id: 0 } })
}

export async function getDataLakeStats(batchId) {
  const db = await getDb()
  const filter = batchId ? { batchId } : {}
  const [rawCount, cleanCount, curatedCount] = await Promise.all([
    db.collection('raw_zone').countDocuments(filter),
    db.collection('clean_zone').countDocuments(filter),
    db.collection('curated_zone').countDocuments(filter),
  ])
  return { raw: rawCount, clean: cleanCount, curated: curatedCount }
}

export async function getDataLakeZone(zone, batchId) {
  const db = await getDb()
  const validZones = ['raw_zone', 'clean_zone', 'curated_zone']
  if (!validZones.includes(zone)) throw new Error('Invalid zone')
  const filter = batchId ? { batchId } : {}
  return db.collection(zone).find(filter, { projection: { _id: 0 } }).toArray()
}
