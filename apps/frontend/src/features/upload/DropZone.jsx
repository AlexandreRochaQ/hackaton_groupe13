import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/tiff': ['.tif', '.tiff'],
}

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

function getRejectionReason(errors) {
  for (const err of errors) {
    if (err.code === 'file-too-large') return 'Fichier trop volumineux (max 20 Mo)'
    if (err.code === 'file-invalid-type') return 'Format non supporté (PDF, JPG, PNG, TIFF uniquement)'
    if (err.code === 'too-many-files') return 'Trop de fichiers déposés à la fois'
  }
  return 'Fichier rejeté'
}

export default function DropZone({ onFilesAdded, onFilesRejected, disabled }) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    disabled,
    onDrop: (accepted, rejected) => {
      if (accepted.length > 0) onFilesAdded(accepted)
      if (rejected.length > 0 && onFilesRejected) {
        onFilesRejected(
          rejected.map(r => ({ file: r.file, reason: getRejectionReason(r.errors) }))
        )
      }
    },
  })

  const borderColor = isDragReject
    ? 'border-red-500 bg-red-500/10'
    : isDragActive
    ? 'border-brand-500 bg-brand-500/10'
    : 'border-slate-700 bg-slate-900 hover:border-brand-500/70 hover:bg-brand-500/5'

  return (
    <div
      {...getRootProps()}
      className={`group border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${borderColor} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragActive ? 'bg-brand-500/20' : 'bg-slate-800'}`}>
          <UploadCloud
            size={28}
            className={`transition-transform duration-200 ${isDragActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-brand-400 group-hover:scale-110'}`}
          />
        </div>

        {isDragActive && !isDragReject && (
          <p className="text-brand-400 font-semibold text-lg">Déposez vos fichiers ici</p>
        )}
        {isDragReject && (
          <p className="text-red-400 font-semibold text-lg">Format non supporté</p>
        )}
        {!isDragActive && (
          <>
            <div>
              <p className="text-slate-200 font-semibold text-base">
                Déposez vos factures, Kbis ou attestations ici
              </p>
              <p className="text-slate-500 text-sm mt-1">ou cliquez pour sélectionner</p>
            </div>
            <p className="text-slate-400 text-xs">PDF, JPG, PNG, TIFF — max 20 Mo par fichier</p>
          </>
        )}
      </div>
    </div>
  )
}
