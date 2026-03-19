import { ChevronDown, Receipt, FileEdit, Building2, ShieldCheck, BadgeCheck, CreditCard, FileQuestion, AlertCircle } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import Tooltip from '../../components/Tooltip.jsx'

const DOC_TYPES = [
  { value: 'facture',           label: 'Facture'           },
  { value: 'devis',             label: 'Devis'             },
  { value: 'kbis',              label: 'Kbis'              },
  { value: 'urssaf',            label: 'URSSAF'            },
  { value: 'attestation_siret', label: 'Attestation SIRET' },
  { value: 'rib',               label: 'RIB'               },
  { value: 'inconnu',           label: 'Inconnu'           },
]

const TYPE_ICONS = {
  facture:           Receipt,
  devis:             FileEdit,
  kbis:              Building2,
  urssaf:            ShieldCheck,
  attestation_siret: BadgeCheck,
  rib:               CreditCard,
  inconnu:           FileQuestion,
}

function confidenceColor(c) {
  if (c >= 0.9) return '#22c55e'
  if (c >= 0.75) return '#f59e0b'
  return '#ef4444'
}

export default function DocumentCard({ doc, extraction, isSelected, onClick, onTypeChange, onSelectToggle, index = 0 }) {
  const ext = extraction?.find(e => e.documentId === doc.id)
  const TypeIcon = TYPE_ICONS[ext?.type] || FileQuestion
  const isLowConfidence = ext && ext.confidence < 0.5

  function handleTypeChange(e) {
    e.stopPropagation()
    onTypeChange?.(doc.id, e.target.value)
  }

  function handleToggle(e) {
    e.stopPropagation()
    onSelectToggle?.(doc.id)
  }

  return (
    <div
      className="relative group"
      style={{ animation: `slideUp 250ms ease-out ${index * 50}ms both` }}
    >
      {/* Checkbox — hidden at rest, visible on hover or when checked */}
      <div
        className={`absolute top-3 left-3 z-10 transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={handleToggle}
      >
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={handleToggle}
          className="w-4 h-4 rounded cursor-pointer accent-brand-500"
          onClick={e => e.stopPropagation()}
        />
      </div>

      <div
        onClick={onClick}
        className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
          isSelected
            ? 'border-brand-300 bg-brand-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'bg-brand-100' : 'bg-blue-50'}`}>
          <TypeIcon size={15} className={isSelected ? 'text-brand-600' : 'text-blue-600'} />
        </div>

        <div className="flex-1 min-w-0 pl-4">
          <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>

          {/* Confidence bar */}
          {ext && (
            <Tooltip text="Détecté automatiquement par IA — confiance de classification">
              <div className="mt-1.5 flex items-center gap-2 cursor-help">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(ext.confidence * 100)}%`,
                      backgroundColor: confidenceColor(ext.confidence),
                    }}
                  />
                </div>
                <span className="text-xs text-slate-400">{Math.round(ext.confidence * 100)}%</span>
              </div>
            </Tooltip>
          )}

          {/* Low-confidence warning */}
          {isLowConfidence && (
            <div className="mt-1.5 flex items-center gap-1">
              <AlertCircle size={11} className="text-amber-500 animate-pulse" />
              <span className="text-xs text-amber-600 font-medium">À classifier manuellement</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={doc.status} size="xs" />
          </div>

          {ext && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <div className="relative inline-flex items-center">
                <select
                  value={ext.type}
                  onChange={handleTypeChange}
                  className="text-xs pl-2 pr-6 py-1 rounded border border-slate-200 bg-white text-slate-600 appearance-none focus:outline-none focus:ring-1 focus:ring-brand-400 hover:border-slate-300 cursor-pointer"
                >
                  {DOC_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
