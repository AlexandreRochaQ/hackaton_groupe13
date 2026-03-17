import { Router } from 'express'
import { getBatch } from '../mocks/mockStore.js'

const router = Router()

// GET /api/validation/:batchId
router.get('/:batchId', (req, res) => {
  const batch = getBatch(req.params.batchId)
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' })
  if (batch.pipelineStep !== 'ready') {
    return res.status(202).json({ success: false, error: 'Processing not complete', pipelineStep: batch.pipelineStep })
  }
  res.json({ success: true, data: batch.validation })
})

export default router
