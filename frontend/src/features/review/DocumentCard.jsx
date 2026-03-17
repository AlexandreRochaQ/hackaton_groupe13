import { FileText } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'

export default function DocumentCard({ doc, extraction, isSelected, onClick }) {
  const ext = extraction?.find(e => e.documentId === doc.id)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${
        isSelected
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <FileText size={16} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <StatusBadge status={doc.status} size="xs" />
          {ext && <StatusBadge status={ext.type} size="xs" />}
        </div>
        {ext && (
          <p className="text-xs text-slate-400 mt-1">
            Confiance : {Math.round(ext.confidence * 100)}%
          </p>
        )}
      </div>
    </button>
  )
}
