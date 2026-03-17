import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

const SEVERITY_META = {
  critique: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    iconColor: 'text-red-500',
    label: 'Critique',
  },
  avertissement: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    iconColor: 'text-amber-500',
    label: 'Avertissement',
  },
  ok: {
    icon: CheckCircle2,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    iconColor: 'text-green-500',
    label: 'Validé',
  },
}

function InconsistencyItem({ item }) {
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
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400">Documents concernés :</span>
              {item.affectedDocuments.map(d => (
                <span key={d} className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-600">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InconsistencyPanel({ validation }) {
  if (!validation) return null

  const { summary, inconsistencies } = validation

  return (
    <div className="border-t border-slate-200 bg-white">
      {/* Panel header */}
      <div className="px-5 py-3.5 flex items-center gap-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 text-sm">Analyse inter-documents</h3>
        <div className="flex items-center gap-2">
          {summary.critiques > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
              {summary.critiques} critique{summary.critiques > 1 ? 's' : ''}
            </span>
          )}
          {summary.avertissements > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
              {summary.avertissements} avertissement{summary.avertissements > 1 ? 's' : ''}
            </span>
          )}
          {summary.validations > 0 && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              {summary.validations} validé{summary.validations > 1 ? 's' : ''}
            </span>
          )}
          {inconsistencies.length === 0 && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
              Aucune anomalie
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
        {inconsistencies.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 size={16} />
            Tous les documents sont cohérents.
          </div>
        ) : (
          inconsistencies.map(item => <InconsistencyItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
