const OCR_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5001'

export async function extractText(buffer, filename, mimetype) {
  const blob = new Blob([buffer], { type: mimetype })
  const form = new FormData()
  form.append('file', blob, filename)

  // Do NOT set Content-Type manually — fetch sets it with the correct boundary
  const res = await fetch(`${OCR_URL}/ocr`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) throw new Error(`OCR service responded ${res.status}`)
  return res.json()
}
