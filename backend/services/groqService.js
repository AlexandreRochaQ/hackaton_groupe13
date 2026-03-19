import Groq from 'groq-sdk'
import pdfParse from 'pdf-parse'
import sharp from 'sharp'
import { createCanvas } from 'canvas'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

let _groq = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return _groq
}

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const TEXT_MODEL = 'llama-3.3-70b-versatile'

const EXTRACTION_PROMPT = (documentId) => `You are an expert at extracting structured information from French administrative documents (invoices, quotes, attestations, KBIS, RIB, URSSAF attestations).

Analyze the document and extract ALL relevant information. Return a JSON object with EXACTLY these fields:
- document_id: "${documentId}"
- document_type: one of exactly [facture, devis, kbis, urssaf, attestation_siret, rib, inconnu]
- company_name: company or organization name, or null
- siret: 14-digit SIRET number as a string, or null
- siren: 9-digit SIREN number as a string, or null
- vat: VAT/TVA number (e.g. FR12345678901), or null
- invoice_number: document or invoice reference number, or null
- issue_date: issue date in YYYY-MM-DD format, or null
- expiration_date: expiration or validity date in YYYY-MM-DD format, or null
- amount_ht: amount excluding tax as a number (no currency symbols), or null
- amount_ttc: amount including tax as a number (no currency symbols), or null
- iban: IBAN number, or null
- bic: BIC/SWIFT code, or null
- banque: bank name, or null
- confidence: float 0-1 based on how much was successfully extracted
- anomalies: array of strings for any anomalies found (expired dates, TTC < HT, missing SIRET on invoice, missing TVA on invoice, etc.)

Rules:
- SIRET is always 14 digits, SIREN is always 9 digits — verify digit count
- For dates: always convert to YYYY-MM-DD (e.g. 19/10/2020 → 2020-10-19)
- For amounts: numeric value only (e.g. 1450.00, not "1 450,00 €")
- If a field is not present, use null (not empty string)
- Return ONLY valid JSON, no markdown, no commentary`

/**
 * Pre-process an image buffer with sharp:
 * - Normalize contrast/brightness
 * - Resize to max 2048px (Groq Vision optimal size)
 * - Convert to JPEG for smaller payload
 */
async function preprocessImage(buffer) {
  try {
    return await sharp(buffer)
      .rotate()                              // auto-rotate based on EXIF
      .normalize()                           // stretch contrast for better OCR
      .sharpen({ sigma: 1 })                 // sharpen edges
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88 })
      .toBuffer()
  } catch {
    return buffer // fallback to original if sharp fails
  }
}

/**
 * Render all pages of a scanned PDF to JPEG images using pdfjs-dist + canvas.
 * Returns an array of image buffers (one per page).
 */
async function pdfToImages(buffer) {
  try {
    const uint8Array = new Uint8Array(buffer)
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array, useSystemFonts: true })
    const pdf = await loadingTask.promise
    const images = []

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
      const page = await pdf.getPage(pageNum)
      const scale = 2.0                       // 2x scale for better resolution
      const viewport = page.getViewport({ scale })

      const canvas = createCanvas(viewport.width, viewport.height)
      const ctx = canvas.getContext('2d')

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise

      const imgBuffer = canvas.toBuffer('image/jpeg', { quality: 0.88 })
      images.push(imgBuffer)
    }

    return images
  } catch (err) {
    console.error('[groqService] PDF→image render failed:', err.message)
    return []
  }
}

/**
 * Extract text from a PDF buffer using pdf-parse.
 * Works for digitally-created PDFs. Returns empty string for scanned PDFs.
 */
async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch {
    return ''
  }
}

/**
 * Extract structured data from an image buffer using Groq Vision.
 * Applies pre-processing before sending.
 * Returns { rawText, structured }.
 */
async function extractFromImage(buffer, mimeType, documentId) {
  const processed = await preprocessImage(buffer)
  const base64 = processed.toString('base64')

  const completion = await getGroq().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT(documentId),
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
  })

  const content = completion.choices[0]?.message?.content || '{}'
  const structured = parseJson(content, documentId)
  return { rawText: '[IMAGE_DOCUMENT — OCR via Groq Vision]', structured }
}

/**
 * Extract from multiple page images (used for scanned PDFs).
 * Sends up to 3 pages; merges results from first successful page.
 */
async function extractFromPageImages(images, documentId) {
  // Try all pages and use the most confident result
  const results = []

  for (const imgBuffer of images) {
    try {
      const result = await extractFromImage(imgBuffer, 'image/jpeg', documentId)
      results.push(result)
    } catch (err) {
      console.warn('[groqService] Page extraction failed:', err.message)
    }
  }

  if (results.length === 0) {
    return {
      rawText: '[SCANNED_PDF — all pages failed]',
      structured: parseJson('{}', documentId),
    }
  }

  // Return result with highest confidence
  return results.reduce((best, cur) =>
    (cur.structured?.confidence ?? 0) > (best.structured?.confidence ?? 0) ? cur : best
  )
}

/**
 * Extract structured data from raw OCR text using Groq chat.
 * Returns { rawText, structured }.
 */
async function extractFromText(rawText, documentId) {
  const completion = await getGroq().chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT(documentId)}\n\nDOCUMENT TEXT:\n${rawText}\n\nReturn ONLY the JSON object:`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0]?.message?.content || '{}'
  const structured = parseJson(content, documentId)
  return { rawText, structured }
}

/**
 * Main entry point: handles both PDFs and images.
 * Returns { rawText, structured } to populate clean zone and curated zone separately.
 */
export async function extractDocument(buffer, filename, mimeType, documentId) {
  const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')

  if (isPdf) {
    const pdfText = await extractPdfText(buffer)

    if (pdfText.trim().length > 80) {
      // Digital PDF — use fast text extraction path
      return extractFromText(pdfText, documentId)
    }

    // Scanned PDF — render pages to images and use Vision
    console.log(`[groqService] Scanned PDF detected for ${filename}, rendering pages…`)
    const images = await pdfToImages(buffer)

    if (images.length > 0) {
      return extractFromPageImages(images, documentId)
    }

    // Last resort fallback
    return {
      rawText: '[SCANNED_PDF — render failed, no text available]',
      structured: parseJson('{}', documentId),
    }
  }

  // Image file (JPG, PNG, WEBP, etc.) — pre-process then Vision
  return extractFromImage(buffer, mimeType, documentId)
}

/**
 * Used by nerService fallback: text-only extraction.
 */
export async function extractFromTextDirect(text, documentId) {
  const result = await extractFromText(text, documentId)
  return result.structured
}

function parseJson(content, documentId) {
  const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse Groq JSON response:', content)
    return {
      document_id: documentId,
      document_type: 'inconnu',
      company_name: null,
      siret: null,
      siren: null,
      vat: null,
      invoice_number: null,
      issue_date: null,
      expiration_date: null,
      amount_ht: null,
      amount_ttc: null,
      iban: null,
      bic: null,
      banque: null,
      confidence: 0,
      anomalies: ['Extraction failed — could not parse document'],
    }
  }
}
