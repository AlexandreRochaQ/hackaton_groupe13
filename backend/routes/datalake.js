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
    res.json({
      success: true,
      data: {
        raw: raw.slice(-20).map(d => ({
          name: d.filename,
          size: d.size ? `${Math.round(d.size / 1024)} Ko` : '—',
          batchId: d.batchId,
          uploadedAt: d.uploadedAt,
        })),
        clean: clean.slice(-20).map(d => ({
          name: d.filename,
          batchId: d.batchId,
          processedAt: d.processedAt,
        })),
        curated: curated.slice(-20).map(d => ({
          name: d.filename,
          type: d.documentType,
          confidence: d.confidence,
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
