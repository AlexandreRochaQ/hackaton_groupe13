import Groq from 'groq-sdk'
import pdfParse from 'pdf-parse'
import sharp from 'sharp'

// Support multiple API keys: GROQ_API_KEY=key1,key2,key3
let _keys = null
let _keyIndex = 0
const _clients = {}

function getKeys() {
  if (!_keys) _keys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean)
  return _keys
}

function getGroq() {
  if (!getKeys().length) throw new Error('No GROQ_API_KEY configured')
  const key = getKeys()[_keyIndex]
  if (!_clients[key]) _clients[key] = new Groq({ apiKey: key })
  return _clients[key]
}

function rotateKey() {
  if (_keys.length > 1) {
    _keyIndex = (_keyIndex + 1) % _keys.length
    console.warn(`[groqService] Rotated to API key #${_keyIndex + 1}`)
  }
}

async function groqCall(fn) {
  const attempts = getKeys().length || 1
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(getGroq())
    } catch (err) {
      const isQuota = err?.status === 429 || err?.status === 413 ||
        /rate.limit|quota|too many/i.test(err?.message || '')
      if (isQuota && i < getKeys().length - 1) {
        rotateKey()
        continue
      }
      throw err
    }
  }
}

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const TEXT_MODEL = 'llama-3.3-70b-versatile'

const SYSTEM_PROMPT = `You are an expert data extraction engine specialized in French B2B administrative and accounting documents used in supplier compliance verification (qualification fournisseur).
Your sole purpose is to extract structured fields from document content and return valid JSON — nothing else.
Never add commentary, markdown fences, preamble, or explanations. Output only the raw JSON object.`

const today = () => new Date().toISOString().split('T')[0]

const EXTRACTION_PROMPT = (documentId) => `Extract ALL fields from this French document and return a single JSON object.

DOCUMENT TYPE — choose exactly one:
• facture      — supplier invoice: HT/TTC amounts, invoice number, VAT
• devis        — quote/estimate: validity date, no final invoice number
• kbis         — Registre du Commerce extract: RCS, immatriculation date, siege address
• urssaf       — Attestation de Vigilance: social contribution period and expiry date
• attestation_siret — INSEE/SIRET certificate (different from Kbis)
• rib          — Bank account document: IBAN, BIC, account holder
• inconnu      — cannot determine type

OUTPUT SCHEMA (return ONLY this JSON, use null for any absent field — never "" or "N/A"):
{
  "document_id": "${documentId}",
  "document_type": "<type from list above>",
  "company_name": "<full legal company name as printed>",
  "siret": "<exactly 14 digits, no spaces — null if wrong digit count>",
  "siren": "<exactly 9 digits — derive from first 9 of SIRET if found>",
  "vat": "<FR + 11 chars e.g. FR12345678901>",
  "invoice_number": "<document/invoice reference as printed>",
  "issue_date": "<YYYY-MM-DD>",
  "expiration_date": "<YYYY-MM-DD — validity or expiry date>",
  "amount_ht": <float e.g. 1450.00>,
  "amount_ttc": <float e.g. 1741.00>,
  "iban": "<IBAN without any spaces>",
  "bic": "<8 or 11 char BIC/SWIFT>",
  "banque": "<bank name>",
  "address": "<full postal address of the main company/issuer>",
  "legal_form": "<SAS/SARL/SA/EURL/SASU/SNC/GIE/etc.>",
  "capital": "<share capital as string e.g. '10 000,00 €'>",
  "activity": "<NAF/APE code + label e.g. '6201Z — Programmation informatique'>",
  "confidence": <float 0.0–1.0>,
  "anomalies": ["<specific issue string>"]
}

EXTRACTION RULES:
1. SIRET: must be exactly 14 digits. Wrong count → set null, add anomaly.
2. SIREN: first 9 digits of SIRET. Auto-derive if SIRET is present.
3. Dates — ALWAYS convert to YYYY-MM-DD:
   "19/10/2020"→"2020-10-19" | "19 octobre 2020"→"2020-10-19" | "19-10-20"→"2020-10-19"
4. Amounts — ALWAYS convert to float:
   "1 450,00 €"→1450.00 | "2.500,50"→2500.50 | "1 450"→1450.0
5. IBAN: remove ALL spaces before storing.
6. TVA: French format "FR" + 2 alphanumeric chars + 9-digit SIREN.

ANOMALY DETECTION (add each that applies — today is ${today()}):
• "SIRET manquant sur facture" — type facture/devis but siret is null
• "TVA manquante sur facture" — type facture/devis but vat is null
• "Numéro de document manquant" — type facture/devis but invoice_number is null
• "Montant TTC inférieur au HT" — amount_ttc < amount_ht
• "TVA non appliquée" — type facture and amount_ttc == amount_ht
• "Document expiré" — expiration_date is before ${today()}
• "Kbis potentiellement périmé" — type kbis and issue_date > 90 days before ${today()}
• "SIRET invalide" — SIRET found but not exactly 14 digits
• "IBAN format invalide" — IBAN found but invalid format
• "Incohérence de dates" — issue_date is after expiration_date

CONFIDENCE: 0.9+ all key fields clean · 0.7–0.9 most fields · 0.5–0.7 several missing · <0.5 unreadable`

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
 * Uses dynamic imports so the module loads cleanly in serverless environments
 * (Vercel) where native canvas bindings are unavailable — returns [] on failure.
 */
async function pdfToImages(buffer) {
  try {
    const [pdfjsLib, { createCanvas }] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('canvas'),
    ])

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
    console.warn('[groqService] PDF→image render not available (canvas/pdfjs):', err.message)
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
async function extractFromImage(buffer, documentId) {
  const processed = await preprocessImage(buffer)
  const base64 = processed.toString('base64')

  const completion = await groqCall(groq => groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
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
    temperature: 0.05,
    max_tokens: 1500,
  }))

  const content = completion.choices[0]?.message?.content || '{}'
  const structured = parseJson(content, documentId)
  return { rawText: '[IMAGE_DOCUMENT — OCR via Groq Vision]', structured }
}

/**
 * Extract from multiple page images (used for scanned PDFs).
 * Merges fields across all pages: starts with the highest-confidence result
 * and fills null fields from other pages for maximum data completeness.
 */
async function extractFromPageImages(images, documentId) {
  const results = []

  for (const imgBuffer of images) {
    try {
      const result = await extractFromImage(imgBuffer, documentId)
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

  if (results.length === 1) return results[0]

  // Sort by confidence descending, start with best result
  const sorted = [...results].sort((a, b) =>
    (b.structured?.confidence ?? 0) - (a.structured?.confidence ?? 0)
  )
  const merged = { ...sorted[0].structured }
  const mergedAnomalies = new Set(merged.anomalies || [])

  // Fill null fields from lower-confidence pages
  for (const result of sorted.slice(1)) {
    const s = result.structured || {}
    for (const key of Object.keys(s)) {
      if (key === 'anomalies') {
        ;(s.anomalies || []).forEach(a => mergedAnomalies.add(a))
        continue
      }
      if (key === 'confidence' || key === 'document_id') continue
      if (merged[key] === null || merged[key] === undefined) {
        merged[key] = s[key]
      }
    }
  }
  merged.anomalies = [...mergedAnomalies]

  return { rawText: sorted[0].rawText, structured: merged }
}

/**
 * Extract structured data from raw OCR text using Groq chat.
 * Returns { rawText, structured }.
 */
async function extractFromText(rawText, documentId) {
  const completion = await groqCall(groq => groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT(documentId)}\n\nDOCUMENT TEXT:\n${rawText}`,
      },
    ],
    temperature: 0.05,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  }))

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
  return extractFromImage(buffer, documentId)
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
      address: null,
      legal_form: null,
      capital: null,
      activity: null,
      confidence: 0,
      anomalies: ['Extraction failed — could not parse document'],
    }
  }
}
