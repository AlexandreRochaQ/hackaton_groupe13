import api from './config.js'

export async function getDataLakeStats(batchId) {
  const params = batchId ? { batchId } : {}
  const res = await api.get('/datalake/stats', { params })
  return res.data.data
}

export async function getDataLakeZone(zone, batchId) {
  const params = batchId ? { batchId } : {}
  const res = await api.get(`/datalake/${zone}`, { params })
  return res.data
}

export async function getDataLakeOverview() {
  const res = await api.get('/datalake/overview')
  return res.data.data
}
