import { useQuery } from '@tanstack/react-query'
import { getDataLakeStats, getDataLakeZone } from '../../api/datalake.js'
import { HardDrive, FileText, Sparkles, CheckCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react'

const ZONES = [
  {
    key: 'raw_zone',
    label: 'Raw Zone',
    description: 'Documents bruts uploadés',
    color: 'amber',
    icon: HardDrive,
  },
  {
    key: 'clean_zone',
    label: 'Clean Zone',
    description: 'Texte OCR extrait',
    color: 'blue',
    icon: FileText,
  },
  {
    key: 'curated_zone',
    label: 'Curated Zone',
    description: 'Données structurées JSON',
    color: 'emerald',
    icon: Sparkles,
  },
]

const colorMap = {
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
    dot: 'bg-amber-400',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300',
    dot: 'bg-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
    dot: 'bg-emerald-400',
  },
}

function ZoneCard({ zone, stats }) {
  const c = colorMap[zone.color]
  const Icon = zone.icon
  const count = stats?.[zone.key] ?? '—'

  const { data: zoneData, isLoading } = useQuery({
    queryKey: ['zone', zone.key],
    queryFn: () => getDataLakeZone(zone.key),
    refetchInterval: 10000,
  })

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center`}>
            <Icon size={18} className={c.icon} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{zone.label}</p>
            <p className="text-slate-400 text-xs">{zone.description}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${c.badge}`}>
          {count} docs
        </span>
      </div>

      {/* Last 5 entries */}
      <div className="space-y-2">
        {isLoading && (
          <p className="text-slate-500 text-xs text-center py-2">Chargement…</p>
        )}
        {!isLoading && (!zoneData?.data || zoneData.data.length === 0) && (
          <p className="text-slate-600 text-xs text-center py-2">Aucun document</p>
        )}
        {!isLoading && zoneData?.data?.slice(0, 5).map((doc, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
            <p className="text-slate-300 text-xs truncate flex-1">{doc.filename || doc.documentName || 'Document'}</p>
            {doc.type && (
              <span className="text-slate-500 text-xs capitalize flex-shrink-0">{doc.type}</span>
            )}
            {doc.uploadedAt || doc.processedAt ? (
              <span className="text-slate-600 text-xs flex-shrink-0">
                {new Date(doc.uploadedAt || doc.processedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['datalake-stats'],
    queryFn: () => getDataLakeStats(),
    refetchInterval: 15000,
  })

  const totalDocs = stats ? (stats.raw_zone ?? 0) : 0
  const avgConfidence = stats?.avg_confidence != null
    ? `${Math.round(stats.avg_confidence * 100)}%`
    : '—'
  const anomalyCount = stats?.total_anomalies ?? '—'
  const batchCount = stats?.total_batches ?? '—'

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-bold flex items-center gap-2">
            <Database size={22} className="text-emerald-400" />
            Tableau de bord Admin
          </h1>
          <p className="text-slate-400 text-sm mt-1">Data Lake · Pipeline · Statistiques</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Documents traités" value={totalDocs} icon={FileText} color="blue" />
        <KpiCard label="Lots analysés" value={batchCount} icon={HardDrive} color="amber" />
        <KpiCard label="Confiance moyenne" value={avgConfidence} icon={CheckCircle} color="emerald" />
        <KpiCard label="Anomalies détectées" value={anomalyCount} icon={AlertTriangle} color="red" />
      </div>

      {/* Data Lake zones */}
      <h2 className="text-slate-300 text-sm font-semibold uppercase tracking-wider mb-4">
        Data Lake — 3 zones
      </h2>
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {ZONES.map(z => (
            <div key={z.key} className="rounded-xl border border-slate-800 bg-slate-900 p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {ZONES.map(z => (
            <ZoneCard key={z.key} zone={z} stats={stats} />
          ))}
        </div>
      )}

      {/* Pipeline explanation */}
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-slate-300 text-sm font-semibold mb-4">Pipeline de traitement</h2>
        <div className="flex items-center gap-0">
          {[
            { label: 'Ingestion', sub: 'Upload fichier' },
            { label: 'OCR', sub: 'Groq Vision / pdf-parse' },
            { label: 'Extraction NER', sub: 'Groq LLaMA 3.3' },
            { label: 'Validation', sub: 'Cohérence inter-docs' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center text-center px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center text-blue-400 text-xs font-bold mb-1">
                  {i + 1}
                </div>
                <p className="text-white text-xs font-medium">{step.label}</p>
                <p className="text-slate-500 text-xs">{step.sub}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="h-px w-8 bg-slate-700 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-white font-bold text-xl leading-tight">{value}</p>
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
    </div>
  )
}
