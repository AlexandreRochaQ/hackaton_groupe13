import { extractText } from './ocrService.js'
import { extractEntities } from './nerService.js'
import { nerToExtraction } from './nerMapper.js'
import { validateExtractions } from './validationService.js'
import { lookupSiret, findBatchSiret } from './sireneService.js'
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

    const extractions = nerOutputs.map(({ doc, nerResult }) => nerToExtraction(doc, nerResult))

    // ── SIRENE enrichment: official company data from data.gouv.fr ──
    step('validating')

    const batchSiret = findBatchSiret(extractions)
    let sireneData = null

    if (batchSiret) {
      const extractedName = extractions
        .map(e => e.fields?.raisonSociale?.value || e.fields?.fournisseur?.value)
        .filter(Boolean)[0] || null

      logger.info('sirene_lookup', { batchId, siret: batchSiret })
      const t = Date.now()
      sireneData = await lookupSiret(batchSiret, extractedName)

      if (sireneData) {
        logger.info('sirene_result', {
          batchId,
          siret: batchSiret,
          found: sireneData.found,
          isActive: sireneData.isActive,
          nameMatchScore: sireneData.nameMatchScore,
          ms: Date.now() - t,
        })

        // Propagate SIRENE anomalies back to the extraction that carries the SIRET
        if (sireneData.anomalies?.length) {
          for (const ext of extractions) {
            if (ext.fields?.siret?.value === batchSiret) {
              ext.anomalies = [...(ext.anomalies || []), ...sireneData.anomalies]
            }
          }
        }
      } else {
        logger.warn('sirene_unavailable', { batchId, siret: batchSiret })
      }
    } else {
      logger.info('sirene_skip', { batchId, reason: 'no_siret_found' })
    }

    // ── Validation (inter-document + SIRENE) ──
    const validation = validateExtractions(extractions, sireneData)

    batch.extraction = extractions
    batch.validation = validation
    batch.sireneData = sireneData
    delete batch._files

    step('ready')

    logger.info('pipeline_complete', {
      batchId,
      ms: Date.now() - t0,
      critiques: validation.summary.critiques,
      isCompliant: validation.summary.isCompliant,
      sireneFound: sireneData?.found ?? null,
      sireneActive: sireneData?.isActive ?? null,
    })
  } catch (e) {
    logger.error('pipeline_error', { batchId, error: e.message, ms: Date.now() - t0 })
    batch.pipelineStep = 'error'
    batch.error = e.message
  }
}
