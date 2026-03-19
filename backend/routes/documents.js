import { Router } from 'express'
import multer from 'multer'
import { createBatch, getBatch, listBatches } from '../services/batchStore.js'
import { storeFile, getFiles } from '../services/fileBufferStore.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' })
    }

    const result = await createBatch(req.files)

    // Store file buffers by document ID for later download
    result.documents.forEach((doc, i) => {
      const file = req.files[i]
      if (file) {
        storeFile(doc.id, {
          name: doc.name,
          mimetype: file.mimetype,
          buffer: file.buffer,
        })
      }
    })

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

/**
 * GET /api/documents/history?page=1&limit=10
 * Returns a paginated list of all processed batches.
 */
router.get('/history', async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(50, parseInt(req.query.limit) || 10)
    const result = await listBatches(page, limit)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/documents/batch-download?ids=id1,id2,id3
 * Returns a ZIP archive of the requested documents.
 */
router.get('/batch-download', async (req, res, next) => {
  try {
    const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No IDs provided' })
    }

    const files = getFiles(ids)
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Files not found. Buffer clears on server restart — re-upload to download.',
      })
    }

    const { default: archiver } = await import('archiver')
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="docflow-export.zip"')

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', err => next(err))
    archive.pipe(res)

    files.forEach(f => {
      archive.append(f.buffer, { name: f.name || `${f.id}.bin` })
    })

    await archive.finalize()
  } catch (err) {
    next(err)
  }
})

export default router
