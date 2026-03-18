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
