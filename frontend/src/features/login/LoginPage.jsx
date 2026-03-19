import { useNavigate } from 'react-router-dom'
import { Layers, UserCog, HardDrive, Hand } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()

  function choose(role) {
    localStorage.setItem('role', role)
    navigate(role === 'admin' ? '/admin' : '/upload', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-10 px-4">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <Layers size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white text-xl font-bold leading-tight">DocFlow</p>
          <p className="text-slate-400 text-sm">Plateforme documentaire IA</p>
        </div>
      </div>

      <p className="text-slate-300 text-base flex items-center gap-2">
        <Hand size={18} className="text-slate-400" />
        Bonjour — vous êtes opérateur ou admin ?
      </p>

      {/* Role cards */}
      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => choose('operator')}
          className="group flex flex-col items-center gap-4 w-60 p-8 rounded-2xl border border-slate-700 bg-slate-900 hover:border-brand-500 hover:bg-slate-800 hover:-translate-y-1 shadow-card hover:shadow-card-hover"
        >
          <div className="w-14 h-14 rounded-xl bg-brand-500/20 group-hover:bg-brand-500/40 flex items-center justify-center">
            <UserCog size={28} className="text-brand-100" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Opérateur</p>
            <p className="text-slate-400 text-sm mt-1">Je traite des dossiers fournisseurs</p>
          </div>
        </button>

        <button
          onClick={() => choose('admin')}
          className="group flex flex-col items-center gap-4 w-60 p-8 rounded-2xl border border-slate-700 bg-slate-900 hover:border-emerald-500 hover:bg-slate-800 hover:-translate-y-1 shadow-card hover:shadow-card-hover"
        >
          <div className="w-14 h-14 rounded-xl bg-emerald-600/20 group-hover:bg-emerald-600/40 flex items-center justify-center">
            <HardDrive size={28} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Administrateur</p>
            <p className="text-slate-400 text-sm mt-1">Je supervise les pipelines et données</p>
          </div>
        </button>
      </div>

      <p className="text-slate-600 text-xs">
        DocFlow · Hackathon 2026
      </p>
    </div>
  )
}
