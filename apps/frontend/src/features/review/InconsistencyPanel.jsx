import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText, ArrowRight, ExternalLink } from 'lucide-react'
import { useState } from 'react'

const SEVERITY_META = {
  critique: {
    icon: XCircle,
    bg: 'bg-red-500/10', border: 'border-red-500/25', text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400', iconColor: 'text-red-400', label: 'Critique',
  },
  avertissement: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10', border: 'border-amber-500/25', text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400', iconColor: 'text-amber-400', label: 'Avertissement',
  },
  ok: {
    icon: CheckCircle2,
    bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-400', iconColor: 'text-emerald-400', label: 'Validé',
  },
}

function InconsistencyItem({ item, onSelectDoc }) {
  const [open, setOpen] = useState(item.severity === 'critique')
  const meta = SEVERITY_META[item.severity] || SEVERITY_META.avertissement
  const Icon = meta.icon

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon size={16} className={`flex-shrink-0 ${meta.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
              {meta.label}
            </span>
            <p className={`text-sm font-medium ${meta.text} truncate`}>{item.title}</p>
          </div>
        </div>
        {open ? <ChevronUp size={14} className={meta.text} /> : <ChevronDown size={14} className={meta.text} />}
      </button>

      {open && (
        <div className={`px-4 pb-4 border-t ${meta.border}`}>
          <p className={`text-sm ${meta.text} mt-3 leading-relaxed`}>{item.description}</p>

          {item.values && (
            <div className="mt-3 space-y-1.5">
              {Object.entries(item.values).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-44 flex-shrink-0">{k}</span>
                  <code className={`font-mono font-semibold ${meta.text}`}>{v}</code>
                </div>
              ))}
            </div>
          )}

          {item.affectedDocuments?.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                {item.affectedDocuments.map((doc, i) => (
                  <span key={doc} className="flex items-center gap-1">
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-400">
                      <FileText size={11} />
                      {doc}
                    </span>
                    {i < item.affectedDocuments.length - 1 && (
                      <ArrowRight size={12} className="text-slate-500" />
                    )}
                  </span>
                ))}
              </div>

              {onSelectDoc && item.affectedDocuments[0] && (
                <button
                  onClick={() => onSelectDoc(item.affectedDocuments[0])}
                  className="mt-2 text-xs text-brand-400 hover:underline flex items-center gap-1"
                >
                  <ExternalLink size={11} />
                  Voir dans la liste
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InconsistencyPanel({ validation, onSelectDoc }) {
  const critiques = validation?.summary?.critiques || 0
  const [expanded, setExpanded] = useState(null)

  if (!validation) return null

  const { summary, inconsistencies } = validation
  const isExpanded = expanded === null ? critiques > 0 : expanded

  return (
    <div className="border-t border-slate-800 bg-slate-900 flex-shrink-0">
      {/* Header */}
      <button
        onClick={() => setExpanded(!isExpanded)}
        className="w-full px-5 py-3.5 flex items-center gap-4 border-b border-slate-800/60 hover:bg-slate-800/40 text-left print-hidden"
      >
        <h3 className="font-semibold text-slate-200 text-sm">Analyse inter-documents</h3>
        <div className="flex items-center gap-2 flex-1">
          {summary.critiques > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-semibold">
              {summary.critiques} critique{summary.critiques > 1 ? 's' : ''}
            </span>
          )}
          {summary.avertissements > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">
              {summary.avertissements} avertissement{summary.avertissements > 1 ? 's' : ''}
            </span>
          )}
          {summary.validations > 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
              {summary.validations} validé{summary.validations > 1 ? 's' : ''}
            </span>
          )}
          {inconsistencies.length === 0 && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
              Aucune anomalie
            </span>
          )}
        </div>
        {isExpanded
          ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
          : <ChevronUp  size={14} className="text-slate-400 flex-shrink-0" />
        }
      </button>

      {isExpanded && (
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto animate-slide-up">
          {inconsistencies.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 size={16} />
              Tous les documents sont cohérents.
            </div>
          ) : (
            inconsistencies.map(item => (
              <InconsistencyItem key={item.id} item={item} onSelectDoc={onSelectDoc} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
