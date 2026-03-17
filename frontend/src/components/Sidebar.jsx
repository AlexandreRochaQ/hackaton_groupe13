import { NavLink, useParams } from 'react-router-dom'
import { Upload, FileSearch, Building2, ShieldCheck, Zap } from 'lucide-react'

const navItems = [
  { to: '/upload', icon: Upload, label: 'Upload documents' },
  { to: '/review', icon: FileSearch, label: 'Révision & extraction', paramKey: 'batchId' },
  { to: '/crm', icon: Building2, label: 'CRM fournisseur', paramKey: 'batchId' },
  { to: '/compliance', icon: ShieldCheck, label: 'Outil conformité', paramKey: 'batchId' },
]

export default function Sidebar() {
  const { batchId: paramBatchId } = useParams()
  const batchId = paramBatchId || localStorage.getItem('lastBatchId')

  function buildPath(item) {
    if (item.paramKey && batchId) return `/${item.to.replace('/', '')}/${batchId}`
    return item.to
  }

  return (
    <aside className="w-60 min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">DocFlow</p>
            <p className="text-slate-400 text-xs">Plateforme documentaire</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const path = buildPath(item)
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-slate-500 text-xs">Hackathon 2026 — Groupe 13</p>
      </div>
    </aside>
  )
}
