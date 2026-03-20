import { MongoClient, Binary } from 'mongodb'
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
  const f = filename.toLowerCase().replace(/[_\-\s]/g, '')
  if (/facture|invoice|fac\d|fact\d|inv\d/.test(f)) return 'facture'
  if (/devis|quotation|quote|dev\d/.test(f))         return 'devis'
  if (/kbis|kibis|extrait/.test(f))                  return 'kbis'
  if (/urssaf|vigilance|cotisation/.test(f))          return 'urssaf'
  if (/siret|siren|attestation/.test(f))              return 'attestation_siret'
  if (/\brib\b|iban|bancaire|releve/.test(f))         return 'rib'
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

  // ── RAW ZONE: store file metadata + binary content for persistent download ──
  await db.collection('raw_zone').insertMany(
    documents.map((doc, i) => ({
      batchId,
      documentId: doc.id,
      filename: doc.name,
      mimetype: doc.mimetype,
      size: doc.size,
      detectedType: doc.type,
      uploadedAt: now,
      fileData: files[i]?.buffer ? new Binary(files[i].buffer) : null,
    }))
  )

  const batchDoc = {
    batchId,
    pipelineStep: 'uploaded',
    documents,
    createdAt: now,
    extraction: null,
    validation: null,
    sireneData: null,
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
        sireneEnrichment: batchWithFiles.sireneData || null,
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
        sireneData: batchWithFiles.sireneData || null,
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
  const [rawCount, cleanCount, curatedCount, batchCount, curatedDocs] = await Promise.all([
    db.collection('raw_zone').countDocuments(filter),
    db.collection('clean_zone').countDocuments(filter),
    db.collection('curated_zone').countDocuments(filter),
    db.collection('batches').countDocuments({}),
    db.collection('curated_zone')
      .find(filter, { projection: { _id: 0, confidence: 1, anomalies: 1 } })
      .toArray(),
  ])
  const avgConfidence = curatedDocs.length
    ? curatedDocs.reduce((s, d) => s + (d.confidence || 0), 0) / curatedDocs.length
    : null
  const totalAnomalies = curatedDocs.reduce(
    (s, d) => s + (Array.isArray(d.anomalies) ? d.anomalies.length : 0), 0
  )
  const typeDistribution = {}
  curatedDocs.forEach(d => {
    const t = d.documentType || 'inconnu'
    typeDistribution[t] = (typeDistribution[t] || 0) + 1
  })
  return { raw: rawCount, clean: cleanCount, curated: curatedCount, total_batches: batchCount, avg_confidence: avgConfidence, total_anomalies: totalAnomalies, type_distribution: typeDistribution }
}

export async function getDataLakeZone(zone, batchId) {
  const db = await getDb()
  const validZones = ['raw_zone', 'clean_zone', 'curated_zone']
  if (!validZones.includes(zone)) throw new Error('Invalid zone')
  const filter = batchId ? { batchId } : {}
  return db.collection(zone).find(filter, { projection: { _id: 0 } }).toArray()
}

export async function getFilesFromDb(docIds) {
  const db = await getDb()
  const docs = await db.collection('raw_zone')
    .find(
      { documentId: { $in: docIds } },
      { projection: { _id: 0, documentId: 1, filename: 1, mimetype: 1, fileData: 1 } }
    )
    .toArray()
  return docs
    .filter(d => d.fileData)
    .map(d => ({ id: d.documentId, name: d.filename, mimetype: d.mimetype, buffer: Buffer.from(d.fileData.buffer) }))
}

export async function listBatches(page = 1, limit = 10) {
  const db = await getDb()
  const skip = (page - 1) * limit
  const [batches, total] = await Promise.all([
    db.collection('batches')
      .find({}, { projection: { _id: 0, batchId: 1, pipelineStep: 1, createdAt: 1, documents: 1 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection('batches').countDocuments(),
  ])
  return {
    batches: batches.map(b => ({
      batchId: b.batchId,
      createdAt: b.createdAt,
      documentCount: b.documents?.length || 0,
      status: b.pipelineStep === 'ready' ? 'traité' : b.pipelineStep === 'error' ? 'erreur' : 'en cours',
      operator: 'Opérateur',
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}
