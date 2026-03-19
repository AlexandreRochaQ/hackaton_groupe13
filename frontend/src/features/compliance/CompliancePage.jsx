import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, ShieldCheck, ShieldX, Save, Cpu, FileDown, Check, X, Minus, Circle, FolderOpen } from 'lucide-react'
import { getComplianceData, saveComplianceDecision } from '../../api/compliance.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'
import { useToast } from '../../components/Toast.jsx'

const STATUS_META = {
  conforme:     { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200',  label: 'Conforme'     },
  non_conforme: { icon: XCircle,      color: 'text-red-600',   bg: 'bg-red-50',    border: 'border-red-200',    label: 'Non conforme' },
  non_fourni:   { icon: MinusCircle,  color: 'text-slate-400', bg: 'bg-slate-50',  border: 'border-slate-200',  label: 'Non fourni'   },
}

// Expected documents for a complete supplier dossier
const EXPECTED_DOCS = [
  { key: 'kbis',   label: 'Kbis ou extrait SIRENE' },
  { key: 'urssaf', label: 'Attestation URSSAF'      },
  { key: 'rib',    label: 'RIB bancaire'             },
  { key: 'facture',label: 'Facture ou devis'         },
]

function CheckRow({ label, status, detail, extra }) {
  const meta = STATUS_META[status] || STATUS_META.non_fourni
  const Icon = meta.icon

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${meta.bg} ${meta.border}`}>
      <Icon size={20} className={`${meta.color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">{detail}</p>
        {extra && (
          <div className="mt-2 flex gap-4 flex-wrap">
            {Object.entries(extra).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-slate-400">{k} : </span>
                <span className="font-medium text-slate-700">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChecksTimeline({ checks }) {
  const items = Object.values(checks).filter(Boolean)
  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-0 mb-4">
      {items.map((check, i) => (
        <div key={i} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            check.status === 'conforme'     ? 'bg-green-500' :
            check.status === 'non_conforme' ? 'bg-red-500'   : 'bg-slate-300'
          }`}>
            {check.status === 'conforme'     && <Check  size={12} className="text-white" />}
            {check.status === 'non_conforme' && <X      size={12} className="text-white" />}
            {check.status === 'non_fourni'   && <Minus  size={12} className="text-white" />}
          </div>
          {i < items.length - 1 && (
            <div className={`h-0.5 w-12 ${check.status === 'conforme' ? 'bg-green-300' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function CompliancePage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [comment, setComment] = useState('')
  const [decision, setDecision] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['compliance', batchId],
    queryFn: () => getComplianceData(batchId),
    enabled: !!batchId,
  })

  const mutation = useMutation({
    mutationFn: payload => saveComplianceDecision(batchId, payload),
    onSuccess: () => toast.success('Décision enregistrée'),
    onError: err => toast.error(err.message || 'Erreur lors de l\'enregistrement'),
  })

  if (!batchId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <p>Aucun lot sélectionné.</p>
        <button onClick={() => navigate('/upload')} className="text-sm text-brand-500 hover:underline">
          Commencer par uploader des documents
        </button>
      </div>
    )
  }

  const isCompliant = data?.globalStatus === 'conforme'

  // Determine which expected documents are present
  const presentTypes = data?.checks
    ? Object.keys(data.checks).filter(k => data.checks[k]?.status !== 'non_fourni')
    : []
  const expectedDocs = EXPECTED_DOCS.map(d => ({
    ...d,
    provided: presentTypes.some(t => t === d.key || t.startsWith(d.key)),
  }))
  const missingCount = expectedDocs.filter(d => !d.provided).length

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/review/${batchId}`)} className="text-slate-400 hover:text-slate-700 print-hidden">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Outil de conformité</h1>
          <p className="text-sm text-slate-400 mt-0.5">Vérification réglementaire pré-remplie par l'IA</p>
        </div>
        <button
          onClick={() => window.print()}
          className="print-hidden flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <FileDown size={15} />
          Exporter
        </button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Impossible de charger les données : {error.message}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Global status banner */}
          <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${isCompliant ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            {isCompliant
              ? <ShieldCheck size={28} className="text-green-600 flex-shrink-0" />
              : <ShieldX    size={28} className="text-red-600 flex-shrink-0" />
            }
            <div>
              <p className={`font-bold text-base ${isCompliant ? 'text-green-800' : 'text-red-800'}`}>
                {isCompliant ? 'Dossier conforme' : 'Dossier non conforme'}
              </p>
              <p className={`text-sm mt-0.5 ${isCompliant ? 'text-green-600' : 'text-red-600'}`}>
                {data.fournisseur} — SIRET {data.siret}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium bg-white/70 px-2 py-1 rounded-lg text-slate-600">
              <Cpu size={10} />
              Généré par IA
            </span>
          </div>

          {/* Checks timeline + rows */}
          <div className="space-y-3">
            <ChecksTimeline checks={data.checks} />

            {data.checks.urssaf && (
              <CheckRow
                label={data.checks.urssaf.label}
                status={data.checks.urssaf.status}
                detail={data.checks.urssaf.detail}
                extra={data.checks.urssaf.dateExpiration ? {
                  "Date d'expiration": data.checks.urssaf.dateExpiration,
                  "SIRET sur attestation": data.checks.urssaf.siretAttestation,
                } : null}
              />
            )}
            {data.checks.kbis && (
              <CheckRow
                label={data.checks.kbis.label}
                status={data.checks.kbis.status}
                detail={data.checks.kbis.detail}
                extra={data.checks.kbis.dateExtrait ? { "Date de l'extrait": data.checks.kbis.dateExtrait } : null}
              />
            )}
            {data.checks.siretCoherence && (
              <CheckRow
                label={data.checks.siretCoherence.label}
                status={data.checks.siretCoherence.status}
                detail={data.checks.siretCoherence.detail}
              />
            )}
          </div>

          {/* Expected documents section */}
          {missingCount > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
              <p className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                <FolderOpen size={15} className="text-slate-500" />
                Documents attendus pour ce dossier
              </p>
              {expectedDocs.map(doc => (
                <div key={doc.key} className="flex items-center gap-2 text-sm py-1.5">
                  {doc.provided
                    ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    : <Circle       size={14} className="text-slate-300 flex-shrink-0" />
                  }
                  <span className={doc.provided ? 'text-slate-700' : 'text-slate-400 italic'}>
                    {doc.label}
                  </span>
                  {!doc.provided && (
                    <span className="text-xs text-amber-500 ml-auto">manquant</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Decision panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 print-hidden">
            <h3 className="text-sm font-bold text-slate-700">Votre décision</h3>

            <div className="flex gap-3 items-center">
              <button
                onClick={() => setDecision('valider')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 ${
                  decision === 'valider'
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-green-500 text-green-600 hover:bg-green-50'
                }`}
              >
                Valider
              </button>
              <button
                onClick={() => setDecision('mettre_en_attente')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  decision === 'mettre_en_attente'
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'border-amber-400 text-amber-600 hover:bg-amber-50'
                }`}
              >
                En attente
              </button>
              <button
                onClick={() => setDecision('rejeter')}
                className={`flex-1 py-2 text-sm font-medium ${
                  decision === 'rejeter' ? 'text-red-600 underline' : 'text-red-500 hover:text-red-700'
                }`}
              >
                Rejeter
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Ajouter une note (optionnel)
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Motif de la décision…"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              onClick={() => mutation.mutate({ decision, comment, fournisseur: data.fournisseur, siret: data.siret })}
              disabled={!decision || mutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:text-slate-400 text-white font-semibold rounded-xl text-sm"
            >
              <Save size={16} />
              {mutation.isPending ? 'Enregistrement…' : 'Valider ma décision'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
