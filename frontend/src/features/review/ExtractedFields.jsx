import { useState } from 'react'
import { Cpu, PenLine, X, Check, AlertTriangle, AlertCircle } from 'lucide-react'
import Tooltip from '../../components/Tooltip.jsx'
import { formatSIRET } from '../../utils/formatters.js'

const MANUAL_FIELDS = [
  { key: 'siret',          label: 'SIRET'               },
  { key: 'tva',            label: 'N° TVA'              },
  { key: 'invoice_number', label: 'N° Facture / Devis'  },
  { key: 'issue_date',     label: "Date d'émission"     },
  { key: 'amount_ht',      label: 'Montant HT (€)'      },
  { key: 'amount_ttc',     label: 'Montant TTC (€)'     },
  { key: 'company_name',   label: 'Fournisseur'         },
]

function ConfidenceDot({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400'
  const explanation =
    pct >= 90 ? 'Confiance élevée — donnée bien lisible'
    : pct >= 75 ? 'Confiance moyenne — à vérifier'
    : 'Confiance faible — vérification recommandée'
  return (
    <Tooltip text={`${pct}% — ${explanation}`}>
      <span className="flex items-center gap-1 text-xs text-slate-500 cursor-help">
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        {pct}%
      </span>
    </Tooltip>
  )
}

function ManualForm({ documentName, onSave }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(MANUAL_FIELDS.map(f => [f.key, '']))
  )

  function handleSave() {
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim() !== '')
    )
    onSave(filled)
  }

  return (
    <div className="px-5 py-6">
      <div className="flex items-center gap-2 mb-4">
        <PenLine size={16} className="text-brand-400" />
        <p className="text-sm font-semibold text-slate-200">Saisie manuelle des champs</p>
        <span className="text-xs text-slate-500">— OCR insuffisant sur ce document</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MANUAL_FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
              {f.label}
            </label>
            <input
              type="text"
              value={values[f.key]}
              onChange={e => setValues(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-600"
              placeholder="—"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg"
      >
        <Check size={14} />
        Enregistrer la saisie
      </button>
    </div>
  )
}

function InlineEditField({ field, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(field.value)

  if (!editing) {
    return (
      <div className="flex-1 flex items-center gap-3 group/field">
        <p className="text-sm font-semibold text-slate-100">
          {field.label === 'SIRET' ? formatSIRET(field.value) : field.value}
        </p>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-500/30 text-white rounded text-xs font-medium">
          <Cpu size={9} />
          IA
        </span>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover/field:opacity-100 transition-opacity text-slate-500 hover:text-brand-400 ml-auto"
        >
          <PenLine size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false) }
          if (e.key === 'Escape') { setDraft(field.value); setEditing(false) }
        }}
        className="flex-1 border-0 border-b border-brand-500 bg-transparent focus:outline-none text-sm font-semibold text-slate-100"
      />
      <button onClick={() => { onSave(draft); setEditing(false) }} className="text-emerald-400 hover:text-emerald-300">
        <Check size={12} />
      </button>
      <button onClick={() => { setDraft(field.value); setEditing(false) }} className="text-slate-400 hover:text-slate-300">
        <X size={12} />
      </button>
    </div>
  )
}

export default function ExtractedFields({ extraction }) {
  const [manualMode, setManualMode] = useState(false)
  const [manualFields, setManualFields] = useState(null)
  const [editedValues, setEditedValues] = useState({})

  if (!extraction) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Sélectionnez un document
      </div>
    )
  }

  const isLowQuality = extraction.confidence < 0.6

  const fields = manualFields
    ? Object.entries(manualFields).map(([key, value]) => {
        const meta = MANUAL_FIELDS.find(f => f.key === key)
        return { label: meta?.label || key, value, confidence: 1 }
      })
    : Object.values(extraction.fields)

  const totalFields = fields.length
  const extractedFields = fields.filter(f => f.value && f.value !== '—' && f.value !== '').length

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-100">{extraction.documentName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{extraction.typeLabel}</p>
          </div>
          <Tooltip
            align="right"
            text="Proportion de champs extraits avec succès par rapport au total attendu pour ce type de document"
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-500/30 text-white rounded-full text-xs font-medium cursor-help">
              <Cpu size={11} />
              Confiance globale : {Math.round(extraction.confidence * 100)}%
            </span>
          </Tooltip>
        </div>
      </div>

      {/* Low-quality OCR banner */}
      {isLowQuality && (
        <div className="flex items-start gap-3 px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 animate-fade-in">
          <AlertTriangle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Qualité OCR faible</p>
            <p className="text-xs text-amber-500/80 mt-0.5">
              Ce document était peut-être flou, scanné de travers ou en basse résolution.
              Vérifie les champs surlignés avant de continuer.
            </p>
          </div>
        </div>
      )}

      {fields.length === 0 && !manualMode ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 flex-1">
          <p className="text-sm">Aucun champ extrait pour ce document.</p>
          <p className="text-xs text-slate-500">Le service OCR a retourné du texte insuffisant.</p>
          <button
            onClick={() => setManualMode(true)}
            className="mt-2 flex items-center gap-2 px-4 py-2 border border-brand-500/50 text-brand-400 hover:bg-brand-500/10 rounded-lg text-sm font-medium"
          >
            <PenLine size={14} />
            Saisir manuellement
          </button>
        </div>
      ) : manualMode && !manualFields ? (
        <div>
          <ManualForm
            documentName={extraction.documentName}
            onSave={filled => { setManualFields(filled); setManualMode(false) }}
          />
          <div className="px-5">
            <button onClick={() => setManualMode(false)} className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1">
              <X size={11} /> Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 flex-1">
          {manualFields && (
            <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                <PenLine size={11} /> Données saisies manuellement
              </span>
              <button onClick={() => { setManualFields(null); setManualMode(false) }} className="text-xs text-amber-500 hover:underline">
                Réinitialiser
              </button>
            </div>
          )}
          {fields.map(field => {
            const isWeak = !manualFields && field.confidence < 0.7
            const displayValue = editedValues[field.label] ?? field.value
            return (
              <div
                key={field.label}
                className={`flex items-center px-5 py-3.5 hover:bg-slate-800/40 ${
                  isWeak ? 'bg-amber-500/5 border-l-2 border-amber-500/30' : ''
                }`}
              >
                <div className="w-48 flex-shrink-0 flex items-center gap-1.5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{field.label}</p>
                  {isWeak && (
                    <Tooltip text="Confiance faible — vérification recommandée">
                      <AlertCircle size={12} className="text-amber-500 cursor-help" />
                    </Tooltip>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-3">
                  {manualFields ? (
                    <>
                      <p className="text-sm font-semibold text-slate-100">{displayValue}</p>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-500/30 text-white rounded text-xs font-medium">
                        <Cpu size={9} />
                        Manuel
                      </span>
                    </>
                  ) : (
                    <InlineEditField
                      field={{ ...field, value: displayValue }}
                      onSave={val => setEditedValues(prev => ({ ...prev, [field.label]: val }))}
                    />
                  )}
                </div>
                {!manualFields && <ConfidenceDot value={field.confidence} />}
              </div>
            )
          })}
        </div>
      )}

      {/* Quality footer */}
      {fields.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Cpu size={11} /> Qualité d'extraction globale
          </span>
          <span className="text-xs font-semibold text-slate-300">
            {extractedFields}/{totalFields} champs extraits
          </span>
        </div>
      )}
    </div>
  )
}
