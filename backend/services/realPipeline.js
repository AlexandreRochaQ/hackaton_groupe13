import { extractText } from './ocrService.js'
import { extractEntities } from './nerService.js'
import { nerToExtraction } from './nerMapper.js'
import { validateExtractions } from './validationService.js'

export async function runRealPipeline(batch) {
  const step = (s) => {
    batch.pipelineStep = s
    batch.documents.forEach(d => { d.status = s })
  }

  try {
    step('ocr_processing')

    const texts = {}
    for (const doc of batch.documents) {
      const file = batch._files?.find(f => f.originalname === doc.name)
      if (!file) { texts[doc.id] = ''; continue }
      try {
        const result = await extractText(file.buffer, file.originalname, file.mimetype)
        texts[doc.id] = result.text || ''
      } catch (e) {
        console.error(`OCR failed for ${doc.name}:`, e.message)
        texts[doc.id] = ''
      }
    }

    step('extracting')

    const nerOutputs = []
    for (const doc of batch.documents) {
      const text = texts[doc.id] || ''
      try {
        const nerResult = await extractEntities(doc.id, text)
        nerOutputs.push({ doc, nerResult })
      } catch (e) {
        console.error(`NER failed for ${doc.name}:`, e.message)
        nerOutputs.push({ doc, nerResult: { document_id: doc.id, document_type: doc.type, anomalies: [] } })
      }
    }

    step('validating')

    const extractions = nerOutputs.map(({ doc, nerResult }) => nerToExtraction(doc, nerResult))
    const validation = validateExtractions(extractions)

    batch.extraction = extractions
    batch.validation = validation
    delete batch._files

    step('ready')
  } catch (e) {
    console.error('Pipeline error:', e)
    batch.pipelineStep = 'error'
    batch.error = e.message
  }
}
