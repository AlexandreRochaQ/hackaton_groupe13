import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, ShieldCheck, ShieldX, Save, FileDown, Check, X, Minus, Circle, FolderOpen, BadgeCheck, BadgeAlert } from 'lucide-react'
import { getComplianceData, saveComplianceDecision } from '../../api/compliance.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'
import { useToast } from '../../components/Toast.jsx'

const STATUS_META = {
  conforme:     { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'Conforme'     },
  non_conforme: { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     label: 'Non conforme' },
  non_fourni:   { icon: MinusCircle,  color: 'text-slate-500',   bg: 'bg-slate-800/40',   border: 'border-slate-700',      label: 'Non fourni'   },
}

const EXPECTED_DOCS = [
  { key: 'kbis',    label: 'Kbis ou extrait SIRENE' },
  { key: 'urssaf',  label: 'Attestation URSSAF'      },
  { key: 'rib',     label: 'RIB bancaire'             },
  { key: 'facture', label: 'Facture ou devis'         },
]

function CheckRow({ label, status, detail, extra }) {
  const meta = STATUS_META[status] || STATUS_META.non_fourni
  const Icon = meta.icon

  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border ${meta.bg} ${meta.border}`}>
      <Icon size={20} className={`${meta.color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">{detail}</p>
        {extra && (
          <div className="mt-2 flex gap-4 flex-wrap">
            {Object.entries(extra).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-slate-400">{k} : </span>
                <span className="font-medium text-slate-300">{v}</span>
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
            check.status === 'conforme'     ? 'bg-emerald-500' :
            check.status === 'non_conforme' ? 'bg-red-500'     : 'bg-slate-700'
          }`}>
            {check.status === 'conforme'     && <Check  size={12} className="text-white" />}
            {check.status === 'non_conforme' && <X      size={12} className="text-white" />}
            {check.status === 'non_fourni'   && <Minus  size={12} className="text-slate-400" />}
          </div>
          {i < items.length - 1 && (
            <div className={`h-0.5 w-12 ${check.status === 'conforme' ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />
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
    onError: err => toast.error(err.message || "Erreur lors de l'enregistrement"),
  })

  if (!batchId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
        <p>Aucun lot sélectionné.</p>
        <button onClick={() => navigate('/upload')} className="text-sm text-brand-400 hover:underline">
          Commencer par uploader des documents
        </button>
      </div>
    )
  }

  const isCompliant = data?.globalStatus === 'conforme'

  const presentTypes = data?.checks
    ? Object.keys(data.checks).filter(k => data.checks[k]?.status !== 'non_fourni')
    : []
  const expectedDocs = EXPECTED_DOCS.map(d => ({
    ...d,
    provided: presentTypes.some(t => t === d.key || t.startsWith(d.key)),
  }))
  const missingCount = expectedDocs.filter(d => !d.provided).length

  return (
    <div className="min-h-full bg-slate-950 px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/review/${batchId}`)} className="text-slate-500 hover:text-slate-300 print-hidden transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Outil de conformité</h1>
            <p className="text-sm text-slate-500 mt-0.5">Vérification réglementaire pré-remplie par l'IA</p>
          </div>
          <button
            onClick={() => window.print()}
            className="print-hidden flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
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
          <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
            Impossible de charger les données : {error.message}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Global status banner */}
            <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
              isCompliant
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-red-500/10 border-red-500/40'
            }`}>
              {isCompliant
                ? <ShieldCheck size={28} className="text-emerald-400 flex-shrink-0" />
                : <ShieldX    size={28} className="text-red-400 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-base ${isCompliant ? 'text-emerald-300' : 'text-red-300'}`}>
                  {isCompliant ? 'Dossier conforme' : 'Dossier non conforme'}
                </p>
                <p className={`text-sm mt-0.5 ${isCompliant ? 'text-emerald-500' : 'text-red-500'}`}>
                  {data.fournisseur} — SIRET {data.siret}
                </p>
                {data.sireneData?.found && (
                  <span className={`inline-flex items-center gap-1 mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
                    data.sireneData.isActive
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-red-500/10 border-red-500/25 text-red-400'
                  }`}>
                    {data.sireneData.isActive ? <BadgeCheck size={11} /> : <BadgeAlert size={11} />}
                    SIRENE : {data.sireneData.isActive ? 'entreprise active' : 'entreprise fermée'}
                    {data.sireneData.commune ? ` · ${data.sireneData.commune}` : ''}
                  </span>
                )}
              </div>
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
              {data.checks.sirene && (
                <CheckRow
                  label={data.checks.sirene.label}
                  status={data.checks.sirene.status}
                  detail={data.checks.sirene.detail}
                  extra={data.checks.sirene.raisonSociale ? { 'Raison sociale officielle': data.checks.sirene.raisonSociale } : null}
                />
              )}
            </div>

            {/* Expected documents */}
            {missingCount > 0 && (
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 animate-fade-in">
                <p className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
                  <FolderOpen size={15} className="text-slate-500" />
                  Documents attendus pour ce dossier
                </p>
                {expectedDocs.map(doc => (
                  <div key={doc.key} className="flex items-center gap-2 text-sm py-1.5">
                    {doc.provided
                      ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      : <Circle       size={14} className="text-slate-700 flex-shrink-0" />
                    }
                    <span className={doc.provided ? 'text-slate-300' : 'text-slate-400 italic'}>
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 print-hidden">
              <h3 className="text-sm font-bold text-slate-200">Votre décision</h3>

              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setDecision('valider')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    decision === 'valider'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-transparent border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  Valider
                </button>
                <button
                  onClick={() => setDecision('mettre_en_attente')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    decision === 'mettre_en_attente'
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  En attente
                </button>
                <button
                  onClick={() => setDecision('rejeter')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    decision === 'rejeter' ? 'text-red-400 underline' : 'text-red-500/70 hover:text-red-400'
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
                  className="w-full px-3 py-2.5 border border-slate-700 bg-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                onClick={() => mutation.mutate({ decision, comment, fournisseur: data.fournisseur, siret: data.siret })}
                disabled={!decision || mutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:border disabled:border-slate-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                <Save size={16} />
                {mutation.isPending ? 'Enregistrement…' : 'Valider ma décision'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
