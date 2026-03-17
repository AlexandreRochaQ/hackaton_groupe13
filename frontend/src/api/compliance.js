import api from './config.js'

export async function getComplianceData(batchId) {
  const res = await api.get(`/compliance/${batchId}`)
  return res.data.data
}

export async function saveComplianceDecision(batchId, payload) {
  const res = await api.post(`/compliance/${batchId}`, payload)
  return res.data.data
}
