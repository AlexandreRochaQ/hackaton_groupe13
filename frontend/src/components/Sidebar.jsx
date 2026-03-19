import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { Upload, FileSearch, Building2, ShieldCheck, Zap, Database, LayoutDashboard, LogOut } from 'lucide-react'

const operatorNav = [
  { to: '/upload', icon: Upload, label: 'Upload documents' },
  { to: '/review', icon: FileSearch, label: 'Révision & extraction', paramKey: 'batchId' },
  { to: '/crm', icon: Building2, label: 'CRM fournisseur', paramKey: 'batchId' },
  { to: '/compliance', icon: ShieldCheck, label: 'Outil conformité', paramKey: 'batchId' },
]

const adminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/admin', icon: Database, label: 'Data Lake' },
]

export default function Sidebar() {
  const { batchId: paramBatchId } = useParams()
  const navigate = useNavigate()
  const batchId = paramBatchId || localStorage.getItem('lastBatchId')
  const role = localStorage.getItem('role') || 'operator'
  const isAdmin = role === 'admin'
  const navItems = isAdmin ? adminNav : operatorNav

  function buildPath(item) {
    if (item.paramKey && batchId) return `/${item.to.replace('/', '')}/${batchId}`
    return item.to
  }

  function switchRole() {
    localStorage.removeItem('role')
    navigate('/login', { replace: true })
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

      {/* Role badge */}
      <div className="px-4 pt-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          isAdmin
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
            : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-emerald-400' : 'bg-blue-400'}`} />
          {isAdmin ? 'Administrateur' : 'Opérateur'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item, i) => {
          const path = buildPath(item)
          const Icon = item.icon
          return (
            <NavLink
              key={`${item.to}-${i}`}
              to={path}
              end={item.to === '/admin'}
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
      <div className="px-4 py-4 border-t border-slate-800 space-y-2">
        <button
          onClick={switchRole}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs transition-colors"
        >
          <LogOut size={14} />
          Changer de profil
        </button>
        <p className="text-slate-600 text-xs px-3">Hackathon 2026 — Groupe 13</p>
      </div>
    </aside>
  )
}
