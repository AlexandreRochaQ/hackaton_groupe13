import FormData from 'form-data'

const OCR_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5001'

export async function extractText(buffer, filename, mimetype) {
  const form = new FormData()
  form.append('file', buffer, { filename, contentType: mimetype })

  const res = await fetch(`${OCR_URL}/ocr`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  })

  if (!res.ok) throw new Error(`OCR service responded ${res.status}`)
  return res.json()
}
