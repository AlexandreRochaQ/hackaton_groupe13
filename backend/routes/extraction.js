import { Router } from 'express'
import { getBatch } from '../services/batchStore.js'

const router = Router()

router.get('/:batchId', async (req, res, next) => {
  try {
    const batch = await getBatch(req.params.batchId)
    if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' })
    if (batch.pipelineStep !== 'ready') {
      return res.status(202).json({ success: false, error: 'Processing not complete', pipelineStep: batch.pipelineStep })
    }
    res.json({ success: true, data: batch.extraction })
  } catch (err) {
    next(err)
  }
})

export default router
