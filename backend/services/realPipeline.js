import { extractText } from './ocrService.js'
import { extractEntities } from './nerService.js'
import { nerToExtraction } from './nerMapper.js'
import { validateExtractions } from './validationService.js'
import { logger } from './logger.js'

export async function runRealPipeline(batch) {
  const { batchId } = batch

  const step = (s) => {
    batch.pipelineStep = s
    batch.documents.forEach(d => { d.status = s })
    logger.info('pipeline_step', { batchId, step: s, docCount: batch.documents.length })
  }

  const t0 = Date.now()
  logger.info('pipeline_start', { batchId, docCount: batch.documents.length })

  try {
    // ── Zone RAW: already saved by batchStore before this runs ──

    // ── Zone CLEAN: OCR text extraction ──
    step('ocr_processing')

    const texts = {}
    const cleanZoneData = {}

    for (const doc of batch.documents) {
      const file = batch._files?.find(f => f.originalname === doc.name)
      if (!file) {
        logger.warn('ocr_skip', { batchId, documentId: doc.id, reason: 'file_not_found' })
        texts[doc.id] = ''
        cleanZoneData[doc.id] = ''
        continue
      }
      const t = Date.now()
      try {
        const result = await extractText(file.buffer, file.originalname, file.mimetype, doc.id)
        texts[doc.id] = result.text || ''
        cleanZoneData[doc.id] = result.rawText || ''
        logger.info('ocr_success', { batchId, documentId: doc.id, filename: doc.name, ms: Date.now() - t })
      } catch (e) {
        logger.error('ocr_error', { batchId, documentId: doc.id, filename: doc.name, error: e.message })
        texts[doc.id] = ''
        cleanZoneData[doc.id] = ''
      }
    }

    batch.cleanZoneData = cleanZoneData

    // ── Zone CURATED: NER / structured extraction ──
    step('extracting')

    const nerOutputs = []
    for (const doc of batch.documents) {
      const text = texts[doc.id] || ''
      const t = Date.now()
      try {
        const nerResult = await extractEntities(doc.id, text)
        nerOutputs.push({ doc, nerResult })
        logger.info('ner_success', {
          batchId, documentId: doc.id, filename: doc.name,
          documentType: nerResult.document_type, confidence: nerResult.confidence,
          anomalies: nerResult.anomalies?.length ?? 0, ms: Date.now() - t,
        })
      } catch (e) {
        logger.error('ner_error', { batchId, documentId: doc.id, filename: doc.name, error: e.message })
        nerOutputs.push({ doc, nerResult: { document_id: doc.id, document_type: doc.type, anomalies: [] } })
      }
    }

    // ── Validation ──
    step('validating')

    const extractions = nerOutputs.map(({ doc, nerResult }) => nerToExtraction(doc, nerResult))
    const validation = validateExtractions(extractions)

    batch.extraction = extractions
    batch.validation = validation
    delete batch._files

    step('ready')

    logger.info('pipeline_complete', {
      batchId,
      ms: Date.now() - t0,
      critiques: validation.summary.critiques,
      isCompliant: validation.summary.isCompliant,
    })
  } catch (e) {
    logger.error('pipeline_error', { batchId, error: e.message, ms: Date.now() - t0 })
    batch.pipelineStep = 'error'
    batch.error = e.message
  }
}
