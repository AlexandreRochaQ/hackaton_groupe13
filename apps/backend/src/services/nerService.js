import { extractFromTextDirect } from './groqService.js'

/**
 * Extract named entities from document text using Groq.
 * Replaces the old FastAPI NER microservice call.
 *
 * If text is already a JSON-stringified Groq result (produced by ocrService.js),
 * it is parsed and returned directly — avoiding a redundant second API call.
 */
export async function extractEntities(documentId, text) {
  // Check if ocrService already extracted everything in one Groq call
  if (text && text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      if (parsed.document_id === documentId) {
        return parsed
      }
    } catch {
      // Not a JSON result — fall through to a fresh Groq call
    }
  }

  // Fallback: call Groq with raw text
  return extractFromTextDirect(text || '', documentId)
}
