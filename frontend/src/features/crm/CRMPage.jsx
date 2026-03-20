import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Cpu, Save, ArrowLeft, FileDown, Undo2, Building2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { getCRMData, saveCRMData } from '../../api/crm.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'
import Tooltip from '../../components/Tooltip.jsx'
import { formatSIRET } from '../../utils/formatters.js'
import { useToast } from '../../components/Toast.jsx'

const FIELD_META = [
  { key: 'raisonSociale',  label: 'Raison sociale'        },
  { key: 'siret',          label: 'SIRET'                  },
  { key: 'tva',            label: 'N° TVA'                 },
  { key: 'formeJuridique', label: 'Forme juridique'        },
  { key: 'capital',        label: 'Capital social'         },
  { key: 'adresse',        label: 'Adresse du siège social' },
  { key: 'activite',       label: 'Activité principale'    },
  { key: 'iban',           label: 'IBAN'                   },
  { key: 'bic',            label: 'BIC / SWIFT'            },
  { key: 'banque',         label: 'Banque'                 },
]

function AutoFilledInput({ label, value, onChange, autoFilled, fromSirene, sources, animating }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
        {fromSirene ? (
          <Tooltip align="right" text="Enrichi depuis la base officielle SIRENE (data.gouv.fr)">
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium cursor-help">
              <Building2 size={9} />
              SIRENE officiel
            </span>
          </Tooltip>
        ) : autoFilled ? (
          <Tooltip
            align="right"
            text={sources?.length ? `Extrait depuis : ${sources.join(', ')}` : 'Extrait automatiquement par IA'}
          >
            <span className="inline-flex items-center gap-1 text-xs text-white bg-brand-500/30 px-1.5 py-0.5 rounded font-medium cursor-help">
              <Cpu size={9} />
              Auto-rempli
            </span>
          </Tooltip>
        ) : null}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors duration-500 ${
          animating
            ? 'border-brand-500/60 bg-brand-500/20 text-slate-100'
            : fromSirene
            ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-100 focus:bg-slate-800'
            : autoFilled
            ? 'border-brand-500/30 bg-brand-500/10 text-slate-100 focus:bg-slate-800'
            : 'border-slate-700 bg-slate-800 text-slate-200'
        }`}
      />
    </div>
  )
}

export default function CRMPage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [animatingFields, setAnimatingFields] = useState(new Set())
  const [fillProgress, setFillProgress] = useState({ animating: false, current: 0, total: 0 })
  const [changeHistory, setChangeHistory] = useState([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm', batchId],
    queryFn: () => getCRMData(batchId),
    enabled: !!batchId,
  })

  const mutation = useMutation({
    mutationFn: payload => saveCRMData(batchId, payload),
    onSuccess: () => toast.success('Enregistré dans le CRM'),
    onError: err => toast.error(err.message || "Erreur lors de l'enregistrement"),
  })

  useEffect(() => {
    if (!data) return
    setForm(data)

    const populatedFields = FIELD_META.filter(f => data[f.key])
    if (populatedFields.length === 0) return

    setFillProgress({ animating: true, current: 0, total: populatedFields.length })

    populatedFields.forEach((f, i) => {
      setTimeout(() => {
        setAnimatingFields(prev => new Set([...prev, f.key]))
        setFillProgress({ animating: true, current: i + 1, total: populatedFields.length })

        setTimeout(() => {
          setAnimatingFields(prev => {
            const next = new Set(prev)
            next.delete(f.key)
            return next
          })
          if (i === populatedFields.length - 1) {
            setFillProgress({ animating: false, current: 0, total: 0 })
          }
        }, 500)
      }, i * 120)
    })
  }, [data])

  function setField(key, value) {
    const label = FIELD_META.find(f => f.key === key)?.label || key
    const oldValue = form?.[key] || ''
    setForm(prev => ({ ...prev, [key]: value }))
    const entry = { key, label, oldValue, newValue: value, timestamp: Date.now() }
    setChangeHistory(prev => [entry, ...prev].slice(0, 10))
  }

  function undoChange(entry) {
    setForm(prev => ({ ...prev, [entry.key]: entry.oldValue }))
    setChangeHistory(prev => prev.filter(e => e !== entry))
    toast.info(`Champ "${entry.label}" restauré`)
  }

  function relativeTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000)
    if (diff < 60) return "à l'instant"
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    return `il y a ${Math.floor(diff / 3600)} h`
  }

  if (!batchId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
        <p className="text-base">Aucun lot sélectionné.</p>
        <button onClick={() => navigate('/upload')} className="text-sm text-brand-400 hover:underline">
          Commencer par uploader des documents
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-950 px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(`/review/${batchId}`)} className="text-slate-500 hover:text-slate-300 print-hidden transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">CRM Fournisseur</h1>
            <p className="text-sm text-slate-500 mt-0.5">Fiche pré-remplie par l'IA — modifiable avant enregistrement</p>
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
            <SkeletonCard lines={5} />
            <SkeletonCard lines={3} />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
            Impossible de charger les données : {error.message}
          </div>
        )}

        {/* Auto-fill progress banner */}
        {fillProgress.animating && (
          <div className="mb-4 px-4 py-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-brand-400 flex items-center gap-1.5">
                <Cpu size={11} className="animate-spin" />
                Auto-remplissage en cours… {fillProgress.current}/{fillProgress.total} champs
              </span>
            </div>
            <div className="w-full bg-brand-500/20 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${(fillProgress.current / fillProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {form && (
          <div className="space-y-6">
            {/* SIRENE status banner */}
            {data?._sireneData && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
                data._sireneData.found && data._sireneData.isActive
                  ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-300'
                  : data._sireneData.found && !data._sireneData.isActive
                  ? 'bg-red-500/8 border-red-500/25 text-red-300'
                  : 'bg-amber-500/8 border-amber-500/25 text-amber-300'
              }`}>
                {data._sireneData.found && data._sireneData.isActive
                  ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  : data._sireneData.found
                  ? <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                  : <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                }
                <div>
                  <p className="font-medium">
                    {data._sireneData.found && data._sireneData.isActive
                      ? `Entreprise active — ${data._sireneData.raisonSociale}`
                      : data._sireneData.found
                      ? `Entreprise fermée — ${data._sireneData.raisonSociale}`
                      : 'SIRET non trouvé dans SIRENE'
                    }
                  </p>
                  {data._sireneData.found && (
                    <p className="text-xs opacity-70 mt-0.5">
                      SIRET {data._sireneData.siret}
                      {data._sireneData.commune ? ` · ${data._sireneData.commune}` : ''}
                      {data._sireneData.categorieEntreprise ? ` · ${data._sireneData.categorieEntreprise}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Informations société */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-4 pb-2 border-b border-slate-800">Informations société</h3>
              <div className="space-y-4">
                <AutoFilledInput
                  label="Raison sociale" value={form.raisonSociale || ''} onChange={v => setField('raisonSociale', v)}
                  autoFilled={!!data?.raisonSociale} fromSirene={data?._sireneFields?.includes('raisonSociale')}
                  sources={data?._sourceDocuments} animating={animatingFields.has('raisonSociale')}
                />
                <div className="grid grid-cols-2 gap-4">
                  <AutoFilledInput
                    label="SIRET" value={formatSIRET(form.siret || '')} onChange={v => setField('siret', v)}
                    autoFilled={!!data?.siret} fromSirene={false}
                    sources={data?._sourceDocuments} animating={animatingFields.has('siret')}
                  />
                  <AutoFilledInput
                    label="N° TVA" value={form.tva || ''} onChange={v => setField('tva', v)}
                    autoFilled={!!data?.tva} fromSirene={false}
                    sources={data?._sourceDocuments} animating={animatingFields.has('tva')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AutoFilledInput
                    label="Forme juridique" value={form.formeJuridique || ''} onChange={v => setField('formeJuridique', v)}
                    autoFilled={!!data?.formeJuridique} fromSirene={data?._sireneFields?.includes('formeJuridique')}
                    sources={data?._sourceDocuments} animating={animatingFields.has('formeJuridique')}
                  />
                  <AutoFilledInput
                    label="Capital social" value={form.capital || ''} onChange={v => setField('capital', v)}
                    autoFilled={!!data?.capital} fromSirene={false}
                    sources={data?._sourceDocuments} animating={animatingFields.has('capital')}
                  />
                </div>
                <AutoFilledInput
                  label="Adresse du siège social" value={form.adresse || ''} onChange={v => setField('adresse', v)}
                  autoFilled={!!data?.adresse} fromSirene={data?._sireneFields?.includes('adresse')}
                  sources={data?._sourceDocuments} animating={animatingFields.has('adresse')}
                />
                <AutoFilledInput
                  label="Activité principale" value={form.activite || ''} onChange={v => setField('activite', v)}
                  autoFilled={!!data?.activite} fromSirene={data?._sireneFields?.includes('activite')}
                  sources={data?._sourceDocuments} animating={animatingFields.has('activite')}
                />
              </div>
            </div>

            {/* Coordonnées bancaires */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-4 pb-2 border-b border-slate-800">Coordonnées bancaires</h3>
              <div className="space-y-4">
                <AutoFilledInput
                  label="IBAN" value={form.iban || ''} onChange={v => setField('iban', v)}
                  autoFilled={!!data?.iban} fromSirene={false}
                  sources={data?._sourceDocuments} animating={animatingFields.has('iban')}
                />
                <div className="grid grid-cols-2 gap-4">
                  <AutoFilledInput
                    label="BIC / SWIFT" value={form.bic || ''} onChange={v => setField('bic', v)}
                    autoFilled={!!data?.bic} fromSirene={false}
                    sources={data?._sourceDocuments} animating={animatingFields.has('bic')}
                  />
                  <AutoFilledInput
                    label="Banque" value={form.banque || ''} onChange={v => setField('banque', v)}
                    autoFilled={!!data?.banque} fromSirene={false}
                    sources={data?._sourceDocuments} animating={animatingFields.has('banque')}
                  />
                </div>
              </div>
            </div>

            {data?._sourceDocuments?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400">Sources :</span>
                {data._sourceDocuments.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full border border-slate-700">{s}</span>
                ))}
              </div>
            )}

            <button
              onClick={() => mutation.mutate(form)}
              disabled={mutation.isPending}
              className="print-hidden w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/40 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              <Save size={16} />
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer dans le CRM'}
            </button>

            {/* Historique des modifications */}
            {changeHistory.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 print-hidden">
                <h3 className="text-sm font-bold text-slate-200 mb-3">Historique des modifications</h3>
                <div className="space-y-2">
                  {changeHistory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
                      <span className="text-xs text-slate-400">
                        Champ <span className="font-medium text-slate-300">{entry.label}</span> modifié
                        <span className="text-slate-400"> · {relativeTime(entry.timestamp)}</span>
                      </span>
                      <button
                        onClick={() => undoChange(entry)}
                        className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
                      >
                        <Undo2 size={11} />
                        Annuler
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
