import { API_BASE } from './config.js'

export async function getDataLakeStats(batchId) {
  const url = batchId
    ? `${API_BASE}/datalake/stats?batchId=${batchId}`
    : `${API_BASE}/datalake/stats`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data
}

export async function getDataLakeZone(zone, batchId) {
  const url = batchId
    ? `${API_BASE}/datalake/${zone}?batchId=${batchId}`
    : `${API_BASE}/datalake/${zone}`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json
}
