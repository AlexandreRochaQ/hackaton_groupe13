import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Trash2 } from 'lucide-react'
import DropZone from './DropZone.jsx'
import FileItem from './FileItem.jsx'
import { uploadDocuments } from '../../api/documents.js'

export default function UploadPage() {
  const [files, setFiles] = useState([])
  const [fileStatuses, setFileStatuses] = useState({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  function handleFilesAdded(newFiles) {
    const unique = newFiles.filter(f => !files.some(existing => existing.name === f.name))
    setFiles(prev => [...prev, ...unique])
    const statuses = {}
    unique.forEach(f => { statuses[f.name] = 'idle' })
    setFileStatuses(prev => ({ ...prev, ...statuses }))
  }

  function handleRemove(file) {
    setFiles(prev => prev.filter(f => f.name !== file.name))
    setFileStatuses(prev => {
      const next = { ...prev }
      delete next[file.name]
      return next
    })
  }

  function clearAll() {
    setFiles([])
    setFileStatuses({})
    setError(null)
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)
    setError(null)

    const pending = {}
    files.forEach(f => { pending[f.name] = 'uploading' })
    setFileStatuses(pending)

    try {
      const result = await uploadDocuments(files)

      const done = {}
      files.forEach(f => { done[f.name] = 'done' })
      setFileStatuses(done)

      await new Promise(r => setTimeout(r, 800))
      localStorage.setItem('lastBatchId', result.batchId)
      navigate(`/review/${result.batchId}`)
    } catch (err) {
      const failed = {}
      files.forEach(f => { failed[f.name] = 'error' })
      setFileStatuses(failed)
      setError(err.message)
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Upload de documents</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Déposez vos pièces comptables. L'IA les classifie, extrait les données et vérifie la cohérence automatiquement.
        </p>
      </div>

      <DropZone onFilesAdded={handleFilesAdded} disabled={uploading} />

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">
              {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
            </p>
            {!uploading && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
                Tout effacer
              </button>
            )}
          </div>

          {files.map(file => (
            <FileItem
              key={file.name}
              file={file}
              status={fileStatuses[file.name] || 'idle'}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
          >
            <Sparkles size={16} />
            {uploading ? 'Envoi en cours...' : `Analyser ${files.length} document${files.length > 1 ? 's' : ''}`}
          </button>
          <p className="text-center text-xs text-slate-400 mt-2">
            Classification automatique • OCR • Vérification inter-documents
          </p>
        </div>
      )}

      {files.length === 0 && (
        <div className="mt-8 grid grid-cols-3 gap-3">
          {['Factures fournisseurs', 'Attestations URSSAF', 'Extraits Kbis'].map(label => (
            <div key={label} className="text-center p-3 bg-white border border-slate-100 rounded-xl">
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
