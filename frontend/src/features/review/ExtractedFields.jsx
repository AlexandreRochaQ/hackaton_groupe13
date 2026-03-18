import { Cpu } from 'lucide-react'

function ConfidenceDot({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {pct}%
    </span>
  )
}

export default function ExtractedFields({ extraction }) {
  if (!extraction) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Sélectionnez un document
      </div>
    )
  }

  const fields = Object.values(extraction.fields)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">{extraction.documentName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{extraction.typeLabel}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            <Cpu size={11} />
            Confiance globale : {Math.round(extraction.confidence * 100)}%
          </span>
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
          <p className="text-sm">Aucun champ extrait pour ce document.</p>
          <p className="text-xs text-slate-300">Le service OCR a retourné du texte insuffisant.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {fields.map(field => (
            <div key={field.label} className="flex items-center px-5 py-3.5 hover:bg-slate-50/60">
              <div className="w-48 flex-shrink-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{field.label}</p>
              </div>
              <div className="flex-1 flex items-center gap-3">
                <p className="text-sm font-semibold text-slate-900">{field.value}</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                  <Cpu size={9} />
                  IA
                </span>
              </div>
              <ConfidenceDot value={field.confidence} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
