import { Router } from 'express'
import { getDataLakeStats, getDataLakeZone } from '../services/batchStore.js'

const router = Router()

/**
 * GET /api/datalake/stats?batchId=...
 * Returns document counts across the 3 zones.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getDataLakeStats(req.query.batchId || null)
    res.json({ success: true, data: stats })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/datalake/overview
 * Returns recent documents from all 3 zones for the admin Data Lake tab.
 */
router.get('/overview', async (req, res, next) => {
  try {
    const [raw, clean, curated] = await Promise.all([
      getDataLakeZone('raw_zone', null),
      getDataLakeZone('clean_zone', null),
      getDataLakeZone('curated_zone', null),
    ])

    // Build AI-detected type lookup from curated zone (more accurate than filename heuristic)
    const aiTypeByDocId = {}
    curated.forEach(d => { if (d.documentId) aiTypeByDocId[d.documentId] = d.documentType })

    res.json({
      success: true,
      data: {
        raw: raw.slice(-20).reverse().map(d => ({
          name: d.filename,
          size: d.size ? `${Math.round(d.size / 1024)} Ko` : '—',
          detectedType: aiTypeByDocId[d.documentId] || d.detectedType || 'inconnu',
          batchId: d.batchId,
          uploadedAt: d.uploadedAt,
        })),
        clean: clean.slice(-20).reverse().map(d => ({
          name: d.filename,
          // Strip placeholder texts (image docs, scanned PDFs) — show null so UI renders an IA badge
          preview: (d.ocrText && !d.ocrText.startsWith('[')) ? d.ocrText.slice(0, 120).trim() : null,
          isVision: d.ocrText?.startsWith('[IMAGE_DOCUMENT'),
          batchId: d.batchId,
          processedAt: d.processedAt,
        })),
        curated: curated.slice(-20).reverse().map(d => ({
          name: d.filename,
          type: d.documentType || 'inconnu',
          confidence: d.confidence ?? null,
          anomalyCount: Array.isArray(d.anomalies) ? d.anomalies.length : 0,
          fieldCount: d.fields ? Object.values(d.fields).filter(v => v != null && v !== '').length : 0,
          batchId: d.batchId,
          curatedAt: d.curatedAt,
        })),
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/datalake/:zone?batchId=...
 * Returns documents from a specific zone: raw_zone | clean_zone | curated_zone
 */
router.get('/:zone', async (req, res, next) => {
  try {
    const docs = await getDataLakeZone(req.params.zone, req.query.batchId || null)
    res.json({ success: true, zone: req.params.zone, count: docs.length, data: docs })
  } catch (err) {
    next(err)
  }
})

export default router
