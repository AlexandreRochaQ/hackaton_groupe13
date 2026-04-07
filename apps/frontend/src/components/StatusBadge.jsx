const VARIANTS = {
  // Pipeline steps
  uploaded:       { bg: 'bg-slate-700/50',    text: 'text-slate-300',   dot: 'bg-slate-400',               label: 'Reçu'         },
  ocr_processing: { bg: 'bg-amber-500/15',    text: 'text-amber-300',   dot: 'bg-amber-400 animate-pulse', label: 'OCR en cours' },
  extracting:     { bg: 'bg-blue-500/15',     text: 'text-blue-300',    dot: 'bg-blue-400 animate-pulse',  label: 'Extraction'   },
  validating:     { bg: 'bg-purple-500/15',   text: 'text-purple-300',  dot: 'bg-purple-400 animate-pulse',label: 'Validation'   },
  ready:          { bg: 'bg-emerald-500/15',  text: 'text-emerald-400', dot: 'bg-emerald-500',             label: 'Prêt'         },
  error:          { bg: 'bg-red-500/15',      text: 'text-red-400',     dot: 'bg-red-500',                 label: 'Erreur'       },
  // Document types
  facture:           { bg: 'bg-blue-500/15',    text: 'text-blue-300',    dot: 'bg-blue-500',    label: 'Facture' },
  devis:             { bg: 'bg-purple-500/15',  text: 'text-purple-300',  dot: 'bg-purple-500',  label: 'Devis'   },
  kbis:              { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', label: 'Kbis'    },
  urssaf:            { bg: 'bg-orange-500/15',  text: 'text-orange-300',  dot: 'bg-orange-500',  label: 'URSSAF'  },
  attestation_siret: { bg: 'bg-teal-500/15',    text: 'text-teal-300',    dot: 'bg-teal-500',    label: 'SIRET'   },
  rib:               { bg: 'bg-cyan-500/15',    text: 'text-cyan-300',    dot: 'bg-cyan-500',    label: 'RIB'     },
  inconnu:           { bg: 'bg-slate-700/50',   text: 'text-slate-400',   dot: 'bg-slate-500',   label: 'Inconnu' },
  // Compliance
  conforme:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', label: 'Conforme'     },
  non_conforme: { bg: 'bg-red-500/15',     text: 'text-red-400',     dot: 'bg-red-500',     label: 'Non conforme' },
  non_fourni:   { bg: 'bg-slate-700/50',   text: 'text-slate-400',   dot: 'bg-slate-500',   label: 'Non fourni'   },
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
