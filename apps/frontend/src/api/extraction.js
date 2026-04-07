import api from './config.js'

export async function getExtraction(batchId) {
  const res = await api.get(`/extraction/${batchId}`)
  return res.data.data // array of { documentId, documentName, type, typeLabel, confidence, fields }
}
