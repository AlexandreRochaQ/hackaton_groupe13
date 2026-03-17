import { FileText, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

const STATUS_META = {
  idle: { icon: Clock, color: 'text-slate-400', label: 'En attente' },
  uploading: { icon: Loader2, color: 'text-blue-500', label: 'Envoi...', spin: true },
  done: { icon: CheckCircle2, color: 'text-green-500', label: 'Envoyé' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Erreur' },
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

export default function FileItem({ file, status, onRemove }) {
  const meta = STATUS_META[status] || STATUS_META.idle
  const Icon = meta.icon

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <FileText size={16} className="text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
        <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
        <Icon
          size={16}
          className={`${meta.color} ${meta.spin ? 'animate-spin' : ''}`}
        />
      </div>

      {status === 'idle' && (
        <button
          onClick={() => onRemove(file)}
          className="ml-1 text-slate-300 hover:text-red-400 transition-colors"
        >
          <XCircle size={16} />
        </button>
      )}
    </div>
  )
}
