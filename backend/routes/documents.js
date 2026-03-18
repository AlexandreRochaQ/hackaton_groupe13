import { Router } from 'express'
import multer from 'multer'
import { createBatch, getBatch } from '../services/batchStore.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded' })
  }
  const result = createBatch(req.files)
  res.json({ success: true, data: result })
})

router.get('/:batchId/status', (req, res) => {
  const batch = getBatch(req.params.batchId)
  if (!batch) return res.status(404).json({ success: false, error: 'Batch not found' })

  res.json({
    success: true,
    data: {
      batchId: batch.batchId,
      pipelineStep: batch.pipelineStep,
      isReady: batch.pipelineStep === 'ready',
      documents: batch.documents,
      createdAt: batch.createdAt,
    },
  })
})

export default router
