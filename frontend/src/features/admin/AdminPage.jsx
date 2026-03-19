import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Database, Layers, ShieldCheck, AlertTriangle, HardDrive, FileText, Sparkles, Star, Braces,
  Clock, Hash, CheckCircle2, Eye, RefreshCw, FileDown, Trash2, PauseCircle, PlayCircle,
} from 'lucide-react'
import { getDataLakeStats, getDataLakeOverview } from '../../api/datalake.js'
import { getBatchHistory, getLogs } from '../../api/documents.js'

const TABS = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'datalake', label: 'Data Lake'       },
  { key: 'history',  label: 'Historique'      },
  { key: 'logs',     label: 'Logs pipeline'   },
]

// Simple inline sparkline SVG
function Sparkline({ values, color = '#3b82f6' }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 80, h = 28
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ label, value, icon: Icon, color, delay = 0 }) {
  const colors = {
    blue:    'text-blue-400    bg-blue-500/10',
    amber:   'text-amber-400   bg-amber-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red:     'text-red-400     bg-red-500/10',
  }
  const strokeColors = { blue: '#60a5fa', amber: '#fbbf24', emerald: '#34d399', red: '#f87171' }
  const spark = Array.from({ length: 7 }, () => Math.floor(Math.random() * 30 + 5))
  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center gap-4"
      style={{ animation: `slideUp 250ms ease-out ${delay}ms both` }}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <p className="text-white font-bold text-xl leading-tight">{value}</p>
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
      <Sparkline values={spark} color={strokeColors[color]} />
    </div>
  )
}

// ── Tab: Overview ────────────────────────────────────
function OverviewTab({ stats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Documents traités"  value={stats?.raw ?? '—'}                                              icon={FileText}      color="blue"    delay={0}   />
        <KpiCard label="Lots analysés"       value={stats?.total_batches ?? '—'}                                   icon={Layers}        color="amber"   delay={100} />
        <KpiCard label="Confiance moyenne"   value={stats?.avg_confidence != null ? `${Math.round(stats.avg_confidence * 100)}%` : '—'} icon={ShieldCheck} color="emerald" delay={200} />
        <KpiCard label="Anomalies détectées" value={stats?.total_anomalies ?? '—'}                                 icon={AlertTriangle} color="red"     delay={300} />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-slate-300 text-sm font-semibold mb-4">Pipeline de traitement</h2>
        <div className="flex items-center gap-0 flex-wrap">
          {[
            { label: 'Ingestion',      sub: 'Upload fichier'       },
            { label: 'OCR',            sub: 'Groq Vision'          },
            { label: 'Extraction NER', sub: 'Groq LLaMA 3.3'      },
            { label: 'Validation',     sub: 'Cohérence inter-docs' },
            { label: 'Data Lake',      sub: 'Raw → Clean → Curated'},
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center text-center px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-600/40 flex items-center justify-center text-blue-400 text-xs font-bold mb-1">
                  {i + 1}
                </div>
                <p className="text-white text-xs font-medium">{step.label}</p>
                <p className="text-slate-500 text-xs">{step.sub}</p>
              </div>
              {i < arr.length - 1 && <div className="h-px w-6 bg-slate-700 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Data Lake ───────────────────────────────────
function DataLakeTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['datalake-overview'],
    queryFn: getDataLakeOverview,
    refetchInterval: 15000,
  })
  const raw = data?.raw || [], clean = data?.clean || [], curated = data?.curated || []
  if (isLoading) return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {[0,1,2].map(i => <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 h-64 animate-pulse" />)}
    </div>
  )
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-800 flex items-center gap-2">
          <HardDrive size={15} className="text-slate-300" />
          <span className="text-sm font-semibold text-white">Zone Raw</span>
          <span className="ml-auto text-xs text-slate-400">Fichiers originaux</span>
        </div>
        <div className="p-4 space-y-1 bg-slate-900">
          {raw.length === 0 && <p className="text-slate-600 text-xs text-center py-4">Aucun fichier</p>}
          {raw.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-slate-800 last:border-0">
              <FileText size={12} className="text-slate-400 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-300">{f.name}</span>
              <span className="text-slate-500">{f.size}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border border-brand-500/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-brand-600 flex items-center gap-2">
          <Sparkles size={15} className="text-brand-100" />
          <span className="text-sm font-semibold text-white">Zone Clean</span>
          <span className="ml-auto text-xs text-brand-200">Texte OCR extrait</span>
        </div>
        <div className="p-4 space-y-1 bg-slate-900">
          {clean.length === 0 && <p className="text-slate-600 text-xs text-center py-4">Aucun fichier</p>}
          {clean.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-brand-900/20 last:border-0">
              <FileText size={12} className="text-brand-400 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-300">{f.name}</span>
              <button className="text-slate-500 hover:text-brand-400"><Eye size={11} /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="border border-green-700/40 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-green-700 flex items-center gap-2">
          <Star size={15} className="text-green-100" />
          <span className="text-sm font-semibold text-white">Zone Curated</span>
          <span className="ml-auto text-xs text-green-200">JSON structuré validé</span>
        </div>
        <div className="p-4 space-y-1 bg-slate-900">
          {curated.length === 0 && <p className="text-slate-600 text-xs text-center py-4">Aucun fichier</p>}
          {curated.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-green-900/20 last:border-0">
              <Braces size={12} className="text-green-500 flex-shrink-0" />
              <span className="flex-1 truncate text-slate-300">{f.name}</span>
              {f.confidence != null && (
                <span className={`text-xs ${f.confidence >= 0.8 ? 'text-green-400' : 'text-amber-400'}`}>
                  {Math.round(f.confidence * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: History ─────────────────────────────────────
function HistoryTab() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const { data, isLoading } = useQuery({
    queryKey: ['batch-history', page],
    queryFn: () => getBatchHistory(page, 10),
  })
  const batches = data?.batches || []
  const pages   = data?.pages   || 1
  const filtered = statusFilter === 'all' ? batches : batches.filter(b => b.status === statusFilter)

  function exportCSV() {
    const csv = ['Date,Lot ID,Fichiers,Statut',
      ...filtered.map(b => [new Date(b.createdAt).toLocaleDateString('fr-FR'), b.batchId, b.documentCount, b.status].join(','))
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'historique-docflow.csv'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const statusColors = { 'traité': 'bg-green-500/20 text-green-400', 'en cours': 'bg-amber-500/20 text-amber-400', 'erreur': 'bg-red-500/20 text-red-400' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all','traité','en cours','erreur'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg ${statusFilter === s ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              {s === 'all' ? 'Tous' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs">
          <FileDown size={13} /> Exporter CSV
        </button>
      </div>
      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium"><span className="flex items-center gap-1"><Clock size={11} /> Date</span></th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium"><span className="flex items-center gap-1"><Hash size={11} /> Lot ID</span></th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">Fichiers</th>
              <th className="px-4 py-2.5 text-left text-slate-400 font-medium">Statut</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Chargement…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun lot trouvé</td></tr>}
            {filtered.map(b => (
              <tr key={b.batchId} onClick={() => navigate(`/review/${b.batchId}`)}
                className="bg-slate-900 hover:bg-slate-800 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-slate-400">{new Date(b.createdAt).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-3 text-slate-400 font-mono">{b.batchId.slice(0,8)}…</td>
                <td className="px-4 py-3 text-slate-300">{b.documentCount}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-slate-800 text-slate-400'}`}>{b.status}</span></td>
                <td className="px-4 py-3 text-slate-500"><CheckCircle2 size={13} className="ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs disabled:opacity-40">Précédent</button>
          <span className="text-xs text-slate-500">{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages} className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  )
}

// ── Tab: Logs ────────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState([])
  const [paused, setPaused] = useState(false)
  const [levelFilter, setLevelFilter] = useState({ INFO: true, WARN: true, ERROR: true })
  const bottomRef = useRef(null)

  useEffect(() => {
    async function fetch() {
      if (paused) return
      try { const l = await getLogs(100, 'all'); if (l) setLogs(l.slice(-200)) } catch {}
    }
    fetch()
    const t = setInterval(fetch, 3000)
    return () => clearInterval(t)
  }, [paused])

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, paused])

  const filtered = logs.filter(l => levelFilter[l.level])
  const levelStyles = { INFO: 'text-slate-400', WARN: 'text-amber-400', ERROR: 'text-red-400' }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Object.keys(levelFilter).map(level => (
            <label key={level} className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input type="checkbox" checked={levelFilter[level]} onChange={() => setLevelFilter(p => ({...p, [level]: !p[level]}))} className="w-3 h-3 accent-brand-500" />
              <span className={levelStyles[level]}>{level}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPaused(p => !p)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs">
            {paused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
            {paused ? 'Reprendre' : 'Pause'}
          </button>
          <button onClick={() => setLogs([])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs">
            <Trash2 size={13} /> Vider
          </button>
        </div>
      </div>
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs scrollbar-thin">
        {filtered.length === 0 && <p className="text-slate-600">En attente de logs…</p>}
        {filtered.map((log, i) => (
          <div key={i} className="flex gap-3 py-0.5 leading-relaxed">
            <span className="text-slate-600 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString('fr-FR')}</span>
            <span className={`flex-shrink-0 w-12 ${levelStyles[log.level] || 'text-slate-400'}`}>{log.level}</span>
            <span className="text-slate-500 flex-shrink-0 w-24 truncate">[{log.service}]</span>
            <span className="text-slate-300 break-all">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <p className="text-xs text-slate-600 text-right">{filtered.length} entrées · rafraîchissement toutes les 3s</p>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────
export default function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const { data: stats, refetch, isFetching } = useQuery({
    queryKey: ['datalake-stats'],
    queryFn: () => getDataLakeStats(),
    refetchInterval: 15000,
  })

  return (
    <div className="flex-1 overflow-auto bg-slate-950 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Database size={20} className="text-emerald-400" />
            Tableau de bord Admin
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Data Lake · Pipeline · Statistiques</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm disabled:opacity-50">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 mb-6">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => tab.key === 'overview' ? setSearchParams({}) : setSearchParams({ tab: tab.key })}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? 'border-brand-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'datalake' && <DataLakeTab />}
        {activeTab === 'history'  && <HistoryTab />}
        {activeTab === 'logs'     && <LogsTab />}
      </div>
    </div>
  )
}
