import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Database, Layers, ShieldCheck, AlertTriangle, HardDrive, FileText, Sparkles, Star, Braces,
  Clock, Hash, CheckCircle2, RefreshCw, FileDown, Trash2, PauseCircle, PlayCircle,
  ArrowRight, Receipt, FileEdit, Building2, BadgeCheck, CreditCard, FileQuestion,
  TriangleAlert, ChevronDown, ChevronUp, Search, X, Terminal, TrendingUp, Activity,
} from 'lucide-react'
import { getDataLakeStats, getDataLakeOverview } from '../../api/datalake.js'
import { getBatchHistory, getLogs } from '../../api/documents.js'

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: "Vue d'ensemble", icon: Activity   },
  { key: 'datalake', label: 'Data Lake',       icon: Database   },
  { key: 'history',  label: 'Historique',      icon: Clock      },
  { key: 'logs',     label: 'Logs pipeline',   icon: Terminal   },
]

// Medallion architecture: Bronze → Silver → Gold
const ZONES = [
  {
    key: 'raw',   label: 'Raw zone', sub: 'Documents bruts',
    icon: HardDrive, iconColor: 'text-blue-400',
    border: 'border-l-blue-500', badge: 'bg-blue-500/15 text-blue-300',
    bar: 'bg-blue-500', pctColor: 'text-blue-400',
  },
  {
    key: 'clean', label: 'Clean zone', sub: 'Texte OCR',
    icon: Sparkles, iconColor: 'text-violet-400',
    border: 'border-l-violet-500', badge: 'bg-violet-500/15 text-violet-300',
    bar: 'bg-violet-500', pctColor: 'text-violet-400',
  },
  {
    key: 'curated', label: 'Curated zone', sub: 'Données structurées',
    icon: Star, iconColor: 'text-emerald-400',
    border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300',
    bar: 'bg-emerald-500', pctColor: 'text-emerald-400',
  },
]

const DOC_TYPE_META = {
  facture:           { label: 'Facture',     icon: Receipt,      color: 'text-blue-400    bg-blue-500/15',    chart: '#60a5fa' },
  devis:             { label: 'Devis',       icon: FileEdit,     color: 'text-violet-400  bg-violet-500/15',  chart: '#a78bfa' },
  kbis:              { label: 'Kbis',        icon: Building2,    color: 'text-amber-400   bg-amber-500/15',   chart: '#fbbf24' },
  urssaf:            { label: 'URSSAF',      icon: ShieldCheck,  color: 'text-emerald-400 bg-emerald-500/15', chart: '#34d399' },
  attestation_siret: { label: 'Attestation', icon: BadgeCheck,   color: 'text-teal-400    bg-teal-500/15',    chart: '#2dd4bf' },
  rib:               { label: 'RIB',         icon: CreditCard,   color: 'text-pink-400    bg-pink-500/15',    chart: '#f472b6' },
  inconnu:           { label: 'Inconnu',     icon: FileQuestion, color: 'text-slate-500   bg-slate-500/10',   chart: '#475569' },
}

// ─────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────

function relTime(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return "à l'instant"
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString('fr-FR')
}

function DocTypeBadge({ type }) {
  const meta = DOC_TYPE_META[type] || DOC_TYPE_META.inconnu
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${meta.color}`}>
      <Icon size={9} />{meta.label}
    </span>
  )
}

function ConfBar({ value }) {
  if (value == null) return <span className="text-slate-600 text-xs">—</span>
  const pct = Math.round(value * 100)
  const bar = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500'
  const txt = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${txt}`}>{pct}%</span>
    </div>
  )
}

// CSS conic-gradient donut — no SVG complexity
function DonutChart({ segments, size = 88 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (!total) return (
    <div style={{ width: size, height: size }}
      className="rounded-full border-[10px] border-slate-800 flex items-center justify-center">
      <span className="text-slate-600 text-xs">—</span>
    </div>
  )
  let acc = 0
  const stops = segments.flatMap(seg => {
    const start = (acc / total) * 360
    acc += seg.value
    const end = (acc / total) * 360
    return [`${seg.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`]
  })
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full"
        style={{ background: `conic-gradient(${stops.join(', ')})` }} />
      <div className="absolute rounded-full bg-slate-950"
        style={{ inset: Math.round(size * 0.27) + 'px' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, colorClass, iconBg, delay = 0 }) {
  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex items-start gap-4"
      style={{ animation: `slideUp 250ms ease-out ${delay}ms both` }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={20} className={colorClass} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-2xl leading-tight tabular-nums ${colorClass}`}>{value}</p>
        <p className="text-slate-500 text-xs mt-0.5 leading-snug">{label}</p>
      </div>
    </div>
  )
}

function ConfidenceGauge({ value }) {
  const pct = value != null ? Math.round(value * 100) : null
  const color = pct == null ? '#475569' : pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const size = 80
  const r = 30, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  // Half-circle gauge (180 degrees)
  const angle = pct != null ? (pct / 100) * 180 : 0
  const strokePct = (angle / 360) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        {/* Track */}
        <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
        {/* Fill */}
        <path d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * (Math.PI * r)} ${Math.PI * r}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <p className="text-xl font-bold tabular-nums" style={{ color }}>{pct != null ? `${pct}%` : '—'}</p>
      <p className="text-slate-500 text-xs">Confiance moy.</p>
    </div>
  )
}

function OverviewTab({ stats }) {
  const typeDist  = stats?.type_distribution || {}
  const typeTotal = Object.values(typeDist).reduce((s, v) => s + v, 0)
  const typeEntries = Object.entries(typeDist).sort(([, a], [, b]) => b - a)
  const donutSegments = typeEntries.map(([type, value]) => ({
    value,
    color: DOC_TYPE_META[type]?.chart || '#475569',
  }))

  const rawCount     = stats?.raw     ?? 0
  const cleanCount   = stats?.clean   ?? 0
  const curatedCount = stats?.curated ?? 0

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Documents traités"  value={stats?.raw            ?? '—'} icon={FileText}      colorClass="text-blue-400"    iconBg="bg-blue-500/10"    delay={0}   />
        <KpiCard label="Lots analysés"      value={stats?.total_batches  ?? '—'} icon={Layers}        colorClass="text-amber-400"   iconBg="bg-amber-500/10"   delay={80}  />
        <KpiCard label="Confiance moyenne"  value={stats?.avg_confidence != null ? `${Math.round(stats.avg_confidence * 100)}%` : '—'} icon={ShieldCheck} colorClass="text-emerald-400" iconBg="bg-emerald-500/10" delay={160} />
        <KpiCard label="Anomalies totales"  value={stats?.total_anomalies ?? '—'} icon={AlertTriangle} colorClass="text-red-400"     iconBg="bg-red-500/10"     delay={240} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Doc type distribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 col-span-1">
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-brand-400" />
            Types de documents
          </h3>
          {typeTotal === 0
            ? <p className="text-slate-600 text-xs text-center py-6">Aucun document traité</p>
            : <div className="flex items-center gap-4">
                <DonutChart segments={donutSegments} size={84} />
                <div className="flex-1 space-y-2 min-w-0">
                  {typeEntries.map(([type, count]) => {
                    const meta = DOC_TYPE_META[type] || DOC_TYPE_META.inconnu
                    const pct  = Math.round((count / typeTotal) * 100)
                    return (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.chart }} />
                        <span className="text-slate-400 truncate flex-1">{meta.label}</span>
                        <span className="text-slate-200 font-semibold tabular-nums">{count}</span>
                        <span className="text-slate-600 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
          }
        </div>

        {/* Medallion funnel */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 col-span-1">
          <h3 className="text-white text-sm font-semibold mb-4 flex items-center gap-2">
            <Database size={14} className="text-amber-500" />
            Entonnoir Medallion
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Raw zone',     count: rawCount,     color: 'bg-blue-500',    pct: 100,                                                          textColor: 'text-blue-400'    },
              { label: 'Clean zone',   count: cleanCount,   color: 'bg-violet-500',  pct: rawCount ? Math.round((cleanCount   / rawCount) * 100) : 0,   textColor: 'text-violet-400'  },
              { label: 'Curated zone', count: curatedCount, color: 'bg-emerald-500', pct: rawCount ? Math.round((curatedCount / rawCount) * 100) : 0,   textColor: 'text-emerald-400' },
            ].map((z, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${z.textColor}`}>{z.label}</span>
                  <span className="text-slate-200 tabular-nums font-medium">{z.count} docs · <span className={z.textColor}>{z.pct}%</span></span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${z.color}`}
                    style={{ width: `${z.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence gauge + anomaly summary */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 col-span-1 flex flex-col items-center justify-between gap-4">
          <h3 className="text-white text-sm font-semibold self-start flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            Qualité globale
          </h3>
          <ConfidenceGauge value={stats?.avg_confidence} />
          <div className="w-full grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <p className="text-red-400 font-bold text-lg tabular-nums">{stats?.total_anomalies ?? '—'}</p>
              <p className="text-slate-500">Anomalies</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3 text-center">
              <p className="text-blue-400 font-bold text-lg tabular-nums">{stats?.total_batches ?? '—'}</p>
              <p className="text-slate-500">Lots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-white text-sm font-semibold mb-5 flex items-center gap-2">
          <Activity size={14} className="text-brand-400" />
          Pipeline de traitement
        </h3>
        <div className="flex items-start gap-0 overflow-x-auto pb-1">
          {[
            { label: 'Ingestion',      sub: 'Upload fichier',        color: 'bg-slate-700   border-slate-600   text-slate-300'  },
            { label: 'OCR',            sub: 'Groq Vision',           color: 'bg-brand-600/20 border-brand-600/40 text-brand-300' },
            { label: 'Extraction NER', sub: 'Groq LLaMA 3.3',       color: 'bg-violet-600/20 border-violet-600/40 text-violet-300' },
            { label: 'Validation',     sub: 'Cohérence inter-docs',  color: 'bg-amber-600/20  border-amber-600/40  text-amber-300' },
            { label: 'Medallion',      sub: 'Bronze → Silver → Gold',color: 'bg-yellow-600/20 border-yellow-600/40 text-yellow-300' },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center text-center w-28 px-2">
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold mb-2 ${step.color}`}>
                  {i + 1}
                </div>
                <p className="text-white text-xs font-semibold leading-tight">{step.label}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-tight">{step.sub}</p>
              </div>
              {i < arr.length - 1 && (
                <ArrowRight size={14} className="text-slate-700 flex-shrink-0 mb-4" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Tab: Data Lake
// ─────────────────────────────────────────────────────

function ZoneCard({ zone, count, lastLabel, lastTime, empty, children }) {
  const Icon = zone.icon
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden flex flex-col bg-slate-900">
      <div className={`px-4 py-3.5 bg-slate-800/70 flex items-center gap-3 border-l-4 ${zone.border} flex-shrink-0`}>
        <Icon size={15} className={zone.iconColor} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white">{zone.label}</span>
          <span className="text-slate-500 text-xs ml-2">{zone.sub}</span>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${zone.badge}`}>{count}</span>
      </div>
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '22rem' }}>
        {count === 0
          ? <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-700">
              <Icon size={24} />
              <p className="text-xs">{empty}</p>
            </div>
          : children
        }
      </div>
      <div className="px-4 py-2.5 bg-slate-800/40 border-t border-slate-800/80 flex-shrink-0">
        <p className="text-slate-600 text-xs">{lastLabel} · {lastTime}</p>
      </div>
    </div>
  )
}

function CleanRow({ f }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-800/80 last:border-0">
      <div className="flex items-center gap-2 text-xs px-4 py-3 hover:bg-slate-800/40">
        <FileText size={11} className="text-slate-400 flex-shrink-0" />
        <span className="flex-1 truncate text-slate-200 min-w-0">{f.name}</span>
        {f.isVision
          ? <span className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Vision IA</span>
          : f.preview
            ? <button onClick={() => setOpen(o => !o)} className="text-slate-600 hover:text-slate-300 flex-shrink-0 p-0.5">
                {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            : null
        }
        <span className="text-slate-600 flex-shrink-0 ml-1 tabular-nums">{relTime(f.processedAt)}</span>
      </div>
      {open && f.preview && (
        <p className="text-slate-500 text-xs px-4 pb-3 italic leading-relaxed border-l-2 border-brand-500/30 ml-4">
          "{f.preview}{f.preview.length >= 120 ? '…' : ''}"
        </p>
      )}
    </div>
  )
}

function DataLakeTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['datalake-overview'],
    queryFn: getDataLakeOverview,
    refetchInterval: 15000,
  })
  const raw = data?.raw || [], clean = data?.clean || [], curated = data?.curated || []

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-24 rounded-xl border border-slate-800 bg-slate-900 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0,1,2].map(i => <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 h-96 animate-pulse" />)}
      </div>
    </div>
  )

  const counts = [raw.length, clean.length, curated.length]
  const pcts   = counts.map(c => counts[0] ? Math.round((c / counts[0]) * 100) : 0)

  return (
    <div className="space-y-4">
      {/* Funnel strip */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-5 flex items-center gap-2">
        {ZONES.map((z, i) => (
          <>
            <div key={`z${i}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                <z.icon size={18} className={z.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-white font-bold text-2xl tabular-nums leading-none">{counts[i]}</span>
                  <span className={`text-xs font-semibold ${z.pctColor}`}>{pcts[i]}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${z.iconColor}`}>{z.label}</span>
                  <span className="text-slate-600 text-xs hidden sm:inline">· {z.sub}</span>
                </div>
                <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${z.bar}`} style={{ width: `${pcts[i]}%` }} />
                </div>
              </div>
            </div>
            {i < ZONES.length - 1 && (
              <ArrowRight key={`a${i}`} size={16} className="text-slate-700 flex-shrink-0 mx-1" />
            )}
          </>
        ))}
      </div>

      {/* Zone columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ZoneCard zone={ZONES[0]} count={raw.length}
          lastLabel="Dernière ingestion" lastTime={relTime(raw[0]?.uploadedAt)}
          empty="Aucun fichier ingéré">
          {raw.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs px-4 py-3 border-b border-slate-800/80 last:border-0 hover:bg-slate-800/40">
              <FileText size={11} className="text-slate-500 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-200 min-w-0">{f.name}</span>
              <DocTypeBadge type={f.detectedType} />
              <span className="text-slate-600 ml-1 flex-shrink-0 tabular-nums">{f.size}</span>
            </div>
          ))}
        </ZoneCard>

        <ZoneCard zone={ZONES[1]} count={clean.length}
          lastLabel="Dernier traitement OCR" lastTime={relTime(clean[0]?.processedAt)}
          empty="Aucun texte extrait">
          {clean.map((f, i) => <CleanRow key={i} f={f} />)}
        </ZoneCard>

        <ZoneCard zone={ZONES[2]} count={curated.length}
          lastLabel="Dernière extraction NER" lastTime={relTime(curated[0]?.curatedAt)}
          empty="Aucun document structuré">
          {curated.map((f, i) => (
            <div key={i} className="text-xs px-4 py-3 border-b border-slate-800/80 last:border-0 hover:bg-slate-800/40 space-y-2">
              <div className="flex items-center gap-2">
                <Braces size={10} className="text-yellow-500 flex-shrink-0" />
                <span className="flex-1 truncate text-slate-200 min-w-0">{f.name}</span>
                {f.anomalyCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
                    <TriangleAlert size={9} />{f.anomalyCount}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pl-4">
                <DocTypeBadge type={f.type} />
                <ConfBar value={f.confidence} />
              </div>
              {f.fieldCount > 0 && (
                <p className="text-slate-600 pl-4">{f.fieldCount} champ{f.fieldCount > 1 ? 's' : ''} extrait{f.fieldCount > 1 ? 's' : ''}</p>
              )}
            </div>
          ))}
        </ZoneCard>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Tab: History
// ─────────────────────────────────────────────────────

function HistoryTab() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const { data, isLoading } = useQuery({
    queryKey: ['batch-history', page],
    queryFn: () => getBatchHistory(page, 10),
  })
  const batches  = data?.batches || []
  const pages    = data?.pages   || 1
  const filtered = statusFilter === 'all' ? batches : batches.filter(b => b.status === statusFilter)

  function exportCSV() {
    const csv = ['Date,Lot ID,Fichiers,Statut',
      ...filtered.map(b => [
        new Date(b.createdAt).toLocaleDateString('fr-FR'),
        b.batchId, b.documentCount, b.status,
      ].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'historique-docflow.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const STATUS_STYLES = {
    'traité':   'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    'en cours': 'bg-amber-500/15  text-amber-400  border border-amber-500/25',
    'erreur':   'bg-red-500/15    text-red-400    border border-red-500/25',
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {['all', 'traité', 'en cours', 'erreur'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-brand-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}>
              {s === 'all' ? 'Tous' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs border border-slate-700 transition-colors">
          <FileDown size={13} /> Exporter CSV
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="px-5 py-3 text-left text-slate-400 font-medium text-xs">
                <span className="flex items-center gap-1.5"><Clock size={12} />Date</span>
              </th>
              <th className="px-5 py-3 text-left text-slate-400 font-medium text-xs">
                <span className="flex items-center gap-1.5"><Hash size={12} />Lot ID</span>
              </th>
              <th className="px-5 py-3 text-left text-slate-400 font-medium text-xs">Fichiers</th>
              <th className="px-5 py-3 text-left text-slate-400 font-medium text-xs">Statut</th>
              <th className="px-5 py-3 text-right text-slate-400 font-medium text-xs">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-600 text-xs">Chargement…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-600 text-xs">Aucun lot trouvé</td></tr>
            )}
            {filtered.map((b, i) => (
              <tr key={b.batchId}
                onClick={() => navigate(`/review/${b.batchId}`)}
                className={`cursor-pointer transition-colors hover:bg-slate-800/60 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/60'} border-b border-slate-800/60 last:border-0`}>
                <td className="px-5 py-3.5 text-slate-300 text-xs">{new Date(b.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{b.batchId.slice(0, 8)}…</td>
                <td className="px-5 py-3.5 text-slate-200 font-semibold text-xs tabular-nums">{b.documentCount} doc{b.documentCount > 1 ? 's' : ''}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[b.status] || 'bg-slate-700 text-slate-400'}`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-xs text-slate-600 hover:text-brand-400 transition-colors">Voir →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 rounded-lg text-xs disabled:opacity-30 transition-colors">
            ← Précédent
          </button>
          <span className="text-xs text-slate-500 tabular-nums px-2">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-4 py-2 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 rounded-lg text-xs disabled:opacity-30 transition-colors">
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Tab: Logs
// ─────────────────────────────────────────────────────

const LEVEL_STYLES = {
  INFO:  { on: 'bg-slate-600/30  text-slate-200  border-slate-500',  off: 'bg-transparent text-slate-600 border-slate-800', text: 'text-slate-400'  },
  WARN:  { on: 'bg-amber-500/20  text-amber-300  border-amber-500',  off: 'bg-transparent text-slate-600 border-slate-800', text: 'text-amber-400'  },
  ERROR: { on: 'bg-red-500/20    text-red-300    border-red-500',    off: 'bg-transparent text-slate-600 border-slate-800', text: 'text-red-400'    },
}

const TIME_RANGES = [
  { key: '5min',  label: '5 min',  ms: 5  * 60 * 1000 },
  { key: '15min', label: '15 min', ms: 15 * 60 * 1000 },
  { key: '1h',    label: '1 h',    ms: 60 * 60 * 1000 },
  { key: 'all',   label: 'Tout',   ms: Infinity        },
]

function LogsTab() {
  const [logs, setLogs]           = useState([])
  const [paused, setPaused]       = useState(false)
  const [levels, setLevels]       = useState({ INFO: true, WARN: true, ERROR: true })
  const [search, setSearch]       = useState('')
  const [service, setService]     = useState('all')
  const [timeRange, setTimeRange] = useState('all')
  const bottomRef = useRef(null)

  useEffect(() => {
    async function poll() {
      if (paused) return
      try { const l = await getLogs(200, 'all'); if (l) setLogs(l) } catch {}
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [paused])

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, paused])

  const services = useMemo(() => ['all', ...new Set(logs.map(l => l.service).filter(Boolean))], [logs])

  const levelCounts = useMemo(() => {
    const c = { INFO: 0, WARN: 0, ERROR: 0 }
    logs.forEach(l => { if (c[l.level] !== undefined) c[l.level]++ })
    return c
  }, [logs])

  const cutoff = useMemo(() => {
    const range = TIME_RANGES.find(r => r.key === timeRange)
    return range?.ms === Infinity ? 0 : Date.now() - (range?.ms ?? 0)
  }, [timeRange])

  const filtered = useMemo(() => logs.filter(l =>
    levels[l.level] &&
    (service === 'all' || l.service === service) &&
    (!search || l.message?.toLowerCase().includes(search.toLowerCase())) &&
    (!cutoff   || new Date(l.timestamp).getTime() >= cutoff)
  ), [logs, levels, service, search, cutoff])

  return (
    <div className="space-y-3">
      {/* Filter panel */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        {/* Row 1: search + service */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher dans les messages…"
              className="w-full pl-8 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <X size={12} />
              </button>
            )}
          </div>
          <select value={service} onChange={e => setService(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500 transition-colors min-w-36">
            {services.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'Tous les services' : s}</option>
            ))}
          </select>
        </div>

        {/* Row 2: levels + time range + controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Level toggles */}
          <div className="flex items-center gap-1.5">
            {Object.keys(LEVEL_STYLES).map(level => {
              const s = LEVEL_STYLES[level]
              return (
                <button key={level} onClick={() => setLevels(p => ({ ...p, [level]: !p[level] }))}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${levels[level] ? s.on : s.off}`}>
                  {level}
                  <span className="ml-1.5 tabular-nums font-normal opacity-75">{levelCounts[level]}</span>
                </button>
              )
            })}
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Time range */}
          <div className="flex items-center gap-1">
            {TIME_RANGES.map(r => (
              <button key={r.key} onClick={() => setTimeRange(r.key)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  timeRange === r.key
                    ? 'bg-brand-500/20 text-brand-300 font-medium'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <button onClick={() => setPaused(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg text-xs transition-colors">
              {paused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
              {paused ? 'Reprendre' : 'Pause'}
            </button>
            <button onClick={() => setLogs([])}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg text-xs transition-colors">
              <Trash2 size={13} /> Vider
            </button>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 font-mono text-xs">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border-b border-slate-800">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
          </div>
          <Terminal size={12} className="text-slate-600 ml-1" />
          <span className="text-slate-600">pipeline.log</span>
          <span className="ml-auto text-slate-700 tabular-nums">
            {filtered.length} / {logs.length} entrées
            {paused && <span className="ml-2 text-amber-500">● PAUSE</span>}
          </span>
        </div>
        <div className="p-4 overflow-y-auto" style={{ height: '30rem' }}>
          {filtered.length === 0 && (
            <p className="text-slate-700">
              <span className="text-slate-800 select-none">$ </span>
              {logs.length === 0 ? 'En attente de logs…' : 'Aucun log correspond aux filtres'}
            </p>
          )}
          {filtered.map((log, i) => (
            <div key={i} className="flex gap-3 py-0.5 leading-relaxed hover:bg-slate-900/50 rounded px-1 -mx-1 group">
              <span className="text-slate-700 flex-shrink-0 tabular-nums w-20">{new Date(log.timestamp).toLocaleTimeString('fr-FR')}</span>
              <span className={`flex-shrink-0 w-12 font-bold ${LEVEL_STYLES[log.level]?.text || 'text-slate-500'}`}>{log.level}</span>
              <span className="text-brand-500/60 flex-shrink-0 w-28 truncate">[{log.service}]</span>
              <span className={`break-all ${
                log.level === 'ERROR' ? 'text-red-300' : log.level === 'WARN' ? 'text-amber-200' : 'text-slate-300'
              } ${search && log.message?.toLowerCase().includes(search.toLowerCase()) ? 'bg-brand-500/10 rounded px-0.5' : ''}`}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const { data: stats, refetch, isFetching } = useQuery({
    queryKey: ['datalake-stats'],
    queryFn: () => getDataLakeStats(),
    refetchInterval: 15000,
  })

  function setTab(key) {
    key === 'overview' ? setSearchParams({}) : setSearchParams({ tab: key })
  }

  return (
    <div className="min-h-full bg-slate-950 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Database size={16} className="text-emerald-400" />
            </div>
            Tableau de bord Admin
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 ml-10">Data Lake Medallion · Pipeline · Statistiques</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-50 transition-colors">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 mb-6 gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-brand-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}>
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'datalake' && <DataLakeTab />}
        {activeTab === 'history'  && <HistoryTab />}
        {activeTab === 'logs'     && <LogsTab />}
      </div>
    </div>
  )
}
