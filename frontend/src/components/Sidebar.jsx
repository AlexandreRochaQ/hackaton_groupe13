import { useLocation, useNavigate, NavLink, useParams } from 'react-router-dom'
import { Upload, FileSearch, Building2, ShieldCheck, Layers, LayoutDashboard, Database, History, Terminal, LogOut, X } from 'lucide-react'

const operatorNav = [
  { to: '/upload', icon: Upload, label: 'Déposer des documents' },
  { to: '/review', icon: FileSearch, label: 'Révision & extraction', paramKey: 'batchId' },
  { to: '/crm', icon: Building2, label: 'CRM fournisseur', paramKey: 'batchId' },
  { to: '/compliance', icon: ShieldCheck, label: 'Outil conformité', paramKey: 'batchId' },
]

const adminNav = [
  { to: '/admin', tab: null,       icon: LayoutDashboard, label: "Vue d'ensemble" },
  { to: '/admin', tab: 'datalake', icon: Database,        label: 'Data Lake'      },
  { to: '/admin', tab: 'history',  icon: History,         label: 'Historique'     },
  { to: '/admin', tab: 'logs',     icon: Terminal,        label: 'Logs pipeline'  },
]

export default function Sidebar({ onClose }) {
  const { batchId: paramBatchId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const batchId = paramBatchId || localStorage.getItem('lastBatchId')
  const role = localStorage.getItem('role') || 'operator'
  const isAdmin = role === 'admin'
  const navItems = isAdmin ? adminNav : operatorNav

  const currentTab = new URLSearchParams(location.search).get('tab')

  function buildPath(item) {
    if (item.tab !== undefined) {
      return item.tab ? `${item.to}?tab=${item.tab}` : item.to
    }
    if (item.paramKey && batchId) return `/${item.to.replace('/', '')}/${batchId}`
    return item.to
  }

  function isActiveItem(item) {
    if (item.tab !== undefined) {
      if (location.pathname !== '/admin') return false
      return item.tab === null ? !currentTab : currentTab === item.tab
    }
    return location.pathname.startsWith(item.to)
  }

  function switchRole() {
    localStorage.removeItem('role')
    navigate('/login', { replace: true })
  }

  return (
    <aside className="w-60 min-h-full bg-slate-900 flex flex-col flex-shrink-0 print-hidden">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
            <Layers size={16} className="text-white" />
          </div>
          <p className="text-white font-bold text-sm leading-tight">
            DocFlow{' '}
            <span className="text-slate-600 text-xs font-mono">v1.0</span>
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Role badge */}
      <div className="px-4 pt-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          isAdmin
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
            : 'bg-brand-500/15 text-brand-100 border border-brand-500/25'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-emerald-400' : 'bg-brand-500'}`} />
          {isAdmin ? 'Administrateur' : 'Opérateur'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item, i) => {
          const path = buildPath(item)
          const active = isActiveItem(item)
          const Icon = item.icon
          return (
            <NavLink
              key={`${path}-${i}`}
              to={path}
              onClick={onClose}
              className={() =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  active
                    ? 'border-l-2 border-brand-500 bg-brand-500/10 text-brand-100 pl-[10px]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-transparent'
                }`
              }
            >
              <Icon size={16} className={active ? 'scale-105' : ''} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 border-t border-slate-800">
        <div className="px-3 py-2 flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-slate-500">Services actifs</span>
        </div>
        <button
          onClick={switchRole}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs mb-3"
        >
          <LogOut size={14} />
          Changer de profil
        </button>
      </div>
    </aside>
  )
}
