import api, { API_BASE } from './config.js'

export async function uploadDocuments(files, onProgress) {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  const res = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min — pipeline now runs synchronously during upload
    onUploadProgress: onProgress
      ? e => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0
          onProgress(pct)
        }
      : undefined,
  })
  return res.data.data // { batchId, documents }
}

export async function getBatchStatus(batchId) {
  const res = await api.get(`/documents/${batchId}/status`)
  return res.data.data // { batchId, pipelineStep, isReady, documents }
}

export async function getBatchHistory(page = 1, limit = 10) {
  const res = await api.get('/documents/history', { params: { page, limit } })
  return res.data.data // { batches, total, page, pages }
}

export async function getLogs(limit = 100, level = 'all') {
  const res = await api.get('/logs', { params: { limit, level } })
  return res.data.logs
}

/**
 * Download multiple documents as a ZIP.
 * Opens a browser download via a temporary anchor element.
 */
export function downloadBatch(docIds) {
  const ids = docIds.join(',')
  const url = `${API_BASE}/api/documents/batch-download?ids=${encodeURIComponent(ids)}`
  const a = document.createElement('a')
  a.href = url
  a.download = 'docflow-export.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
