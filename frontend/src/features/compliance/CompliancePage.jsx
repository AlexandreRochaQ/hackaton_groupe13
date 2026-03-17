import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, MinusCircle, ShieldCheck, ShieldX, Save, Cpu } from 'lucide-react'
import { getComplianceData, saveComplianceDecision } from '../../api/compliance.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'

const STATUS_META = {
  conforme: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Conforme' },
  non_conforme: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Non conforme' },
  non_fourni: { icon: MinusCircle, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Non fourni' },
}

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

export default function CompliancePage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const [comment, setComment] = useState('')
  const [decision, setDecision] = useState(null)
  const [saved, setSaved] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['compliance', batchId],
    queryFn: () => getComplianceData(batchId),
    enabled: !!batchId,
  })

  const mutation = useMutation({
    mutationFn: payload => saveComplianceDecision(batchId, payload),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (!batchId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <p>Aucun lot sélectionné.</p>
        <button onClick={() => navigate('/upload')} className="text-sm text-blue-600 hover:underline">
          Commencer par uploader des documents
        </button>
      </div>
    )
  }

  const isCompliant = data?.globalStatus === 'conforme'

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/review/${batchId}`)} className="text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Outil de conformité</h1>
          <p className="text-sm text-slate-400 mt-0.5">Vérification réglementaire pré-remplie par l'IA</p>
        </div>
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
          <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${isCompliant ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
            {isCompliant
              ? <ShieldCheck size={28} className="text-green-600 flex-shrink-0" />
              : <ShieldX size={28} className="text-red-600 flex-shrink-0" />
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

          <div className="space-y-3">
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

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-700">Décision du responsable conformité</h3>

            <div className="flex gap-3">
              {['valider', 'rejeter', 'mettre_en_attente'].map(d => (
                <button
                  key={d}
                  onClick={() => setDecision(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    decision === d
                      ? d === 'valider' ? 'bg-green-600 border-green-600 text-white'
                        : d === 'rejeter' ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {d === 'valider' ? 'Valider' : d === 'rejeter' ? 'Rejeter' : 'En attente'}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Commentaire (optionnel)
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Motif de la décision…"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <button
              onClick={() => mutation.mutate({ decision, comment, fournisseur: data.fournisseur, siret: data.siret })}
              disabled={!decision || mutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-400 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {saved
                ? <><CheckCircle2 size={16} />Décision enregistrée</>
                : <><Save size={16} />{mutation.isPending ? 'Enregistrement…' : 'Enregistrer la décision'}</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
