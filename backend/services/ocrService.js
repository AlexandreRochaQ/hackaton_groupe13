import { extractDocument } from './groqService.js'

/**
 * Extract data from a file buffer using Groq (Vision + structured extraction in one call).
 * Returns { text, rawText } where:
 *   - text    = JSON-stringified structured result (passed to nerService)
 *   - rawText = the intermediate OCR text (saved to MongoDB clean zone)
 */
export async function extractText(buffer, filename, mimeType, documentId) {
  const { rawText, structured } = await extractDocument(buffer, filename, mimeType, documentId)
  return { text: JSON.stringify(structured), rawText }
}
