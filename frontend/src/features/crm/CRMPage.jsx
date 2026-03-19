import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Cpu, Save, ArrowLeft, FileDown, Undo2 } from 'lucide-react'
import { getCRMData, saveCRMData } from '../../api/crm.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'
import Tooltip from '../../components/Tooltip.jsx'
import { formatSIRET } from '../../utils/formatters.js'
import { useToast } from '../../components/Toast.jsx'

const FIELD_META = [
  { key: 'raisonSociale',  label: 'Raison sociale'       },
  { key: 'siret',          label: 'SIRET'                 },
  { key: 'tva',            label: 'N° TVA'                },
  { key: 'formeJuridique', label: 'Forme juridique'       },
  { key: 'capital',        label: 'Capital social'        },
  { key: 'adresse',        label: 'Adresse du siège social'},
  { key: 'activite',       label: 'Activité principale'   },
  { key: 'iban',           label: 'IBAN'                  },
  { key: 'bic',            label: 'BIC / SWIFT'           },
  { key: 'banque',         label: 'Banque'                },
]

function AutoFilledInput({ label, value, onChange, autoFilled, sources, animating }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
        {autoFilled && (
          <Tooltip
            align="right"
            text={sources?.length ? `Extrait depuis : ${sources.join(', ')}` : 'Extrait automatiquement par IA'}
          >
            <span className="inline-flex items-center gap-1 text-xs text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium cursor-help">
              <Cpu size={9} />
              Auto-rempli
            </span>
          </Tooltip>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors duration-500 ${
          animating
            ? 'border-brand-300 bg-brand-100'
            : autoFilled
            ? 'border-brand-200 bg-brand-50/40 focus:bg-white'
            : 'border-slate-200 bg-white'
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
  const [changeHistory, setChangeHistory] = useState([]) // max 10 entries

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm', batchId],
    queryFn: () => getCRMData(batchId),
    enabled: !!batchId,
  })

  // on sauvegarde même si rien n'a changé — pas grave pour un hackathon
  const mutation = useMutation({
    mutationFn: payload => saveCRMData(batchId, payload),
    onSuccess: () => toast.success('Enregistré dans le CRM'),
    onError: err => toast.error(err.message || 'Erreur lors de l\'enregistrement'),
  })

  // Sequential auto-fill animation when data loads
  useEffect(() => {
    if (!data) return
    setForm(data)

    const populatedFields = FIELD_META.filter(f => data[f.key])
    if (populatedFields.length === 0) return

    setFillProgress({ animating: true, current: 0, total: populatedFields.length })

    populatedFields.forEach((f, i) => {
      // Animate each field in sequence with 120ms delay
      setTimeout(() => {
        setAnimatingFields(prev => new Set([...prev, f.key]))
        setFillProgress({ animating: true, current: i + 1, total: populatedFields.length })

        // Remove the flash after 500ms
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

    // Log change in history (max 10 entries)
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
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <p className="text-base">Aucun lot sélectionné.</p>
        <button onClick={() => navigate('/upload')} className="text-sm text-brand-500 hover:underline">
          Commencer par uploader des documents
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/review/${batchId}`)} className="text-slate-400 hover:text-slate-700 print-hidden">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">CRM Fournisseur</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fiche pré-remplie par l'IA — modifiable avant enregistrement</p>
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
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Impossible de charger les données : {error.message}
        </div>
      )}

      {/* Auto-fill progress banner */}
      {fillProgress.animating && (
        <div className="mb-4 px-4 py-2.5 bg-brand-50 border border-brand-100 rounded-xl animate-fade-in">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-brand-700 flex items-center gap-1.5">
              <Cpu size={11} className="animate-spin" />
              Auto-remplissage en cours… {fillProgress.current}/{fillProgress.total} champs
            </span>
          </div>
          <div className="w-full bg-brand-100 rounded-full h-1 overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${(fillProgress.current / fillProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {form && (
        <div className="space-y-6">
          {/* Informations société */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">Informations société</h3>
            <div className="space-y-4">
              <AutoFilledInput
                label="Raison sociale" value={form.raisonSociale || ''} onChange={v => setField('raisonSociale', v)}
                autoFilled={!!data?.raisonSociale} sources={data?._sourceDocuments}
                animating={animatingFields.has('raisonSociale')}
              />
              <div className="grid grid-cols-2 gap-4">
                {/* TODO: vérifier que le SIRET est bien 14 chiffres avant d'envoyer */}
                <AutoFilledInput
                  label="SIRET" value={formatSIRET(form.siret || '')} onChange={v => setField('siret', v)}
                  autoFilled={!!data?.siret} sources={data?._sourceDocuments}
                  animating={animatingFields.has('siret')}
                />
                <AutoFilledInput
                  label="N° TVA" value={form.tva || ''} onChange={v => setField('tva', v)}
                  autoFilled={!!data?.tva} sources={data?._sourceDocuments}
                  animating={animatingFields.has('tva')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AutoFilledInput
                  label="Forme juridique" value={form.formeJuridique || ''} onChange={v => setField('formeJuridique', v)}
                  autoFilled={!!data?.formeJuridique} sources={data?._sourceDocuments}
                  animating={animatingFields.has('formeJuridique')}
                />
                <AutoFilledInput
                  label="Capital social" value={form.capital || ''} onChange={v => setField('capital', v)}
                  autoFilled={!!data?.capital} sources={data?._sourceDocuments}
                  animating={animatingFields.has('capital')}
                />
              </div>
              <AutoFilledInput
                label="Adresse du siège social" value={form.adresse || ''} onChange={v => setField('adresse', v)}
                autoFilled={!!data?.adresse} sources={data?._sourceDocuments}
                animating={animatingFields.has('adresse')}
              />
              <AutoFilledInput
                label="Activité principale" value={form.activite || ''} onChange={v => setField('activite', v)}
                autoFilled={!!data?.activite} sources={data?._sourceDocuments}
                animating={animatingFields.has('activite')}
              />
            </div>
          </div>

          {/* Coordonnées bancaires */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">Coordonnées bancaires</h3>
            <div className="space-y-4">
              <AutoFilledInput
                label="IBAN" value={form.iban || ''} onChange={v => setField('iban', v)}
                autoFilled={!!data?.iban} sources={data?._sourceDocuments}
                animating={animatingFields.has('iban')}
              />
              <div className="grid grid-cols-2 gap-4">
                <AutoFilledInput
                  label="BIC / SWIFT" value={form.bic || ''} onChange={v => setField('bic', v)}
                  autoFilled={!!data?.bic} sources={data?._sourceDocuments}
                  animating={animatingFields.has('bic')}
                />
                <AutoFilledInput
                  label="Banque" value={form.banque || ''} onChange={v => setField('banque', v)}
                  autoFilled={!!data?.banque} sources={data?._sourceDocuments}
                  animating={animatingFields.has('banque')}
                />
              </div>
            </div>
          </div>

          {data?._sourceDocuments?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400">Sources :</span>
              {data._sourceDocuments.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{s}</span>
              ))}
            </div>
          )}

          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            className="print-hidden w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/50 text-white font-semibold rounded-xl text-sm"
          >
            <Save size={16} />
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer dans le CRM'}
          </button>

          {/* Historique des modifications */}
          {changeHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 print-hidden">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Historique des modifications</h3>
              <div className="space-y-2">
                {changeHistory.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-xs text-slate-600">
                      Champ <span className="font-medium">{entry.label}</span> modifié
                      <span className="text-slate-400"> · {relativeTime(entry.timestamp)}</span>
                    </span>
                    <button
                      onClick={() => undoChange(entry)}
                      className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700"
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
  )
}
