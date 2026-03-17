const VARIANTS = {
  // Pipeline steps
  uploaded: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: 'Reçu' },
  ocr_processing: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400 animate-pulse', label: 'OCR en cours' },
  extracting: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400 animate-pulse', label: 'Extraction' },
  validating: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400 animate-pulse', label: 'Validation' },
  ready: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Prêt' },
  error: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Erreur' },
  // Document types
  facture: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Facture' },
  devis: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Devis' },
  kbis: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Kbis' },
  urssaf: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'URSSAF' },
  attestation_siret: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', label: 'SIRET' },
  rib: { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500', label: 'RIB' },
  inconnu: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: 'Inconnu' },
  // Compliance
  conforme: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Conforme' },
  non_conforme: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Non conforme' },
  non_fourni: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: 'Non fourni' },
}

export default function StatusBadge({ status, customLabel, size = 'sm' }) {
  const v = VARIANTS[status] || VARIANTS.inconnu
  const label = customLabel || v.label
  const padding = size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${v.bg} ${v.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {label}
    </span>
  )
}
