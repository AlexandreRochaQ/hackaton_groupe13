import api from './config.js'

export async function getValidation(batchId) {
  const res = await api.get(`/validation/${batchId}`)
  return res.data.data // { summary, inconsistencies }
}
