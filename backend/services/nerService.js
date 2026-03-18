const NER_URL = process.env.NER_SERVICE_URL || 'http://localhost:5002'

export async function extractEntities(documentId, text) {
  const res = await fetch(`${NER_URL}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, text }),
  })

  if (!res.ok) throw new Error(`NER service responded ${res.status}`)
  return res.json()
}
