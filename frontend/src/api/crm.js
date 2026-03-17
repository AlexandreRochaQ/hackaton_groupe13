import api from './config.js'

export async function getCRMData(batchId) {
  const res = await api.get(`/crm/${batchId}`)
  return res.data.data
}

export async function saveCRMData(batchId, payload) {
  const res = await api.post(`/crm/${batchId}`, payload)
  return res.data.data
}
