import { Router } from 'express'
import multer from 'multer'
import { createBatch, getBatch } from '../services/batchStore.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' })
    }
    const result = await createBatch(req.files)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

router.get('/:batchId/status', async (req, res, next) => {
  try {
    const batch = await getBatch(req.params.batchId)
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
  } catch (err) {
    next(err)
  }
})

export default router
