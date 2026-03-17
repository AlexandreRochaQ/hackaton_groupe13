import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Cpu, Save, CheckCircle2, ArrowLeft } from 'lucide-react'
import { getCRMData, saveCRMData } from '../../api/crm.js'
import SkeletonCard from '../../components/SkeletonCard.jsx'

function AutoFilledInput({ label, value, onChange, autoFilled }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
        {autoFilled && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
            <Cpu size={9} />
            Auto-rempli
          </span>
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
          autoFilled ? 'border-blue-200 bg-blue-50/40 focus:bg-white' : 'border-slate-200 bg-white'
        }`}
      />
    </div>
  )
}

function SectionTitle({ children }) {
  return <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100">{children}</h3>
}

export default function CRMPage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm', batchId],
    queryFn: () => getCRMData(batchId),
    enabled: !!batchId,
  })

  const mutation = useMutation({
    mutationFn: payload => saveCRMData(batchId, payload),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  if (!batchId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <p className="text-base">Aucun lot sélectionné.</p>
        <button onClick={() => navigate('/upload')} className="text-sm text-blue-600 hover:underline">
          Commencer par uploader des documents
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/review/${batchId}`)} className="text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">CRM Fournisseur</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fiche pré-remplie par l'IA — modifiable avant enregistrement</p>
        </div>
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

      {form && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <SectionTitle>Informations société</SectionTitle>
            <div className="space-y-4">
              <AutoFilledInput
                label="Raison sociale"
                value={form.raisonSociale}
                onChange={v => setField('raisonSociale', v)}
                autoFilled={!!data?.raisonSociale}
              />
              <div className="grid grid-cols-2 gap-4">
                <AutoFilledInput label="SIRET" value={form.siret} onChange={v => setField('siret', v)} autoFilled={!!data?.siret} />
                <AutoFilledInput label="N° TVA" value={form.tva} onChange={v => setField('tva', v)} autoFilled={!!data?.tva} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <AutoFilledInput label="Forme juridique" value={form.formeJuridique} onChange={v => setField('formeJuridique', v)} autoFilled={!!data?.formeJuridique} />
                <AutoFilledInput label="Capital social" value={form.capital} onChange={v => setField('capital', v)} autoFilled={!!data?.capital} />
              </div>
              <AutoFilledInput label="Adresse du siège social" value={form.adresse} onChange={v => setField('adresse', v)} autoFilled={!!data?.adresse} />
              <AutoFilledInput label="Activité principale" value={form.activite} onChange={v => setField('activite', v)} autoFilled={!!data?.activite} />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <SectionTitle>Coordonnées bancaires</SectionTitle>
            <div className="space-y-4">
              <AutoFilledInput label="IBAN" value={form.iban} onChange={v => setField('iban', v)} autoFilled={!!data?.iban} />
              <div className="grid grid-cols-2 gap-4">
                <AutoFilledInput label="BIC / SWIFT" value={form.bic} onChange={v => setField('bic', v)} autoFilled={!!data?.bic} />
                <AutoFilledInput label="Banque" value={form.banque} onChange={v => setField('banque', v)} autoFilled={!!data?.banque} />
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
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {saved ? <><CheckCircle2 size={16} />Enregistré dans le CRM</> : <><Save size={16} />{mutation.isPending ? 'Enregistrement…' : 'Enregistrer dans le CRM'}</>}
          </button>
        </div>
      )}
    </div>
  )
}
