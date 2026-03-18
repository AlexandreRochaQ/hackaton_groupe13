import api from './config.js'

export async function uploadDocuments(files) {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  const res = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min — pipeline now runs synchronously during upload
  })
  return res.data.data // { batchId, documents }
}

export async function getBatchStatus(batchId) {
  const res = await api.get(`/documents/${batchId}/status`)
  return res.data.data // { batchId, pipelineStep, isReady, documents }
}
