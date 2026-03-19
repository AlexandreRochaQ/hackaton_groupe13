import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Trash2, FileText, UploadCloud, Square } from 'lucide-react'
import DropZone from './DropZone.jsx'
import FileItem from './FileItem.jsx'
import { uploadDocuments } from '../../api/documents.js'
import { useToast } from '../../components/Toast.jsx'

export default function UploadPage() {
  const [files, setFiles] = useState([])
  const [fileStatuses, setFileStatuses] = useState({})
  const [fileRejections, setFileRejections] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pageDragging, setPageDragging] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const dragCounter = useRef(0)

  // Full-page drag overlay via window events
  useEffect(() => {
    function onEnter() {
      dragCounter.current++
      setPageDragging(true)
    }
    function onLeave() {
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setPageDragging(false)
      }
    }
    function onDrop() {
      dragCounter.current = 0
      setPageDragging(false)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  function onDrop(newFiles) {
    const unique = newFiles.filter(f => !files.some(existing => existing.name === f.name))
    setFiles(prev => [...prev, ...unique])
    const statuses = {}
    unique.forEach(f => { statuses[f.name] = 'idle' })
    setFileStatuses(prev => ({ ...prev, ...statuses }))
    setPageDragging(false)
  }

  function handleFilesRejected(rejected) {
    const newFiles = rejected.map(r => r.file).filter(f => !files.some(existing => existing.name === f.name))
    setFiles(prev => [...prev, ...newFiles])
    const statuses = {}
    const rejections = {}
    rejected.forEach(r => {
      statuses[r.file.name] = 'invalid'
      rejections[r.file.name] = r.reason
    })
    setFileStatuses(prev => ({ ...prev, ...statuses }))
    setFileRejections(prev => ({ ...prev, ...rejections }))
  }

  function handleRemove(file) {
    setFiles(prev => prev.filter(f => f.name !== file.name))
    setFileStatuses(prev => { const n = { ...prev }; delete n[file.name]; return n })
    setFileRejections(prev => { const n = { ...prev }; delete n[file.name]; return n })
  }

  function resetFiles() {
    setFiles([])
    setFileStatuses({})
    setFileRejections({})
    setUploadProgress(0)
  }

  function deselectInvalid() {
    setFiles(prev => prev.filter(f => fileStatuses[f.name] !== 'invalid'))
    setFileStatuses(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(k => { if (n[k] === 'invalid') delete n[k] })
      return n
    })
    setFileRejections({})
  }

  const validFiles = files.filter(f => fileStatuses[f.name] !== 'invalid')
  const invalidCount = files.length - validFiles.length

  // on attend 800ms pour que l'user voie les checkmarks — sinon c'est trop brutal
  async function handleUpload() {
    // TODO: valider aussi la taille cumulée des fichiers
    if (validFiles.length === 0) return
    setUploading(true)
    setUploadProgress(0)

    const pending = {}
    validFiles.forEach(f => { pending[f.name] = 'uploading' })
    setFileStatuses(prev => ({ ...prev, ...pending }))

    try {
      const result = await uploadDocuments(validFiles, pct => setUploadProgress(pct))

      const done = {}
      validFiles.forEach(f => { done[f.name] = 'done' })
      setFileStatuses(done)
      setUploadProgress(100)

      await new Promise(r => setTimeout(r, 800))
      localStorage.setItem('lastBatchId', result.batchId)
      navigate(`/review/${result.batchId}`)
    } catch (err) {
      const failed = {}
      files.forEach(f => { failed[f.name] = 'error' })
      setFileStatuses(failed)
      toast.error(err.message || "Erreur lors de l'envoi")
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const sentCount = uploadProgress > 0
    ? Math.min(validFiles.length, Math.ceil((uploadProgress / 100) * validFiles.length))
    : 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 relative">

      {/* Full-page drag overlay */}
      {pageDragging && !uploading && (
        <div className="fixed inset-0 bg-brand-500/10 border-2 border-dashed border-brand-500 z-50 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <UploadCloud size={48} className="text-brand-500 animate-bounce" />
          <p className="text-brand-700 font-semibold text-lg">Relâchez pour ajouter vos documents</p>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Déposer des documents</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Glissez vos pièces comptables — on se charge de l'OCR, l'extraction et la vérification.
        </p>
      </div>

      <DropZone onFilesAdded={onDrop} onFilesRejected={handleFilesRejected} disabled={uploading} />

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">
              {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              {invalidCount > 0 && !uploading && (
                <button
                  onClick={deselectInvalid}
                  className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700"
                >
                  <Square size={13} />
                  Supprimer les invalides
                </button>
              )}
              {!uploading && (
                <button
                  onClick={resetFiles}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400"
                >
                  <Trash2 size={12} />
                  Tout effacer
                </button>
              )}
            </div>
          </div>

          {files.map(file => (
            <FileItem
              key={file.name}
              file={file}
              status={fileStatuses[file.name] || 'idle'}
              rejectionReason={fileRejections[file.name]}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-6">
          {invalidCount > 0 && (
            <p className="text-xs text-amber-600 mb-2 text-center">
              {invalidCount} fichier{invalidCount > 1 ? 's' : ''} ignoré{invalidCount > 1 ? 's' : ''} (format ou taille invalide)
            </p>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading || validFiles.length === 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white font-semibold rounded-xl text-sm shadow-sm"
          >
            <Sparkles size={16} />
            {uploading ? 'Envoi en cours…' : "Lancer l'analyse →"}
          </button>

          {/* Upload progress bar */}
          {uploading && (
            <div className="mt-3 animate-fade-in">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 text-center mt-1.5">
                Envoi en cours… {sentCount}/{validFiles.length} fichier{validFiles.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-2">
            Classification automatique • OCR • Vérification inter-documents
          </p>
        </div>
      )}

      {files.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 text-slate-400">
          <FileText size={36} className="text-slate-300" />
          <p className="text-sm text-center text-slate-400">
            Aucun document pour l'instant —<br />commence par glisser une facture ou un Kbis
          </p>
        </div>
      )}
    </div>
  )
}
