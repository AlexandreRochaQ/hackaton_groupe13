import { useNavigate } from 'react-router-dom'
import { Zap, UserCog, HardDrive } from 'lucide-react'

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
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white text-xl font-bold leading-tight">DocFlow</p>
          <p className="text-slate-400 text-sm">Plateforme documentaire IA</p>
        </div>
      </div>

      <p className="text-slate-300 text-base">Choisissez votre profil pour continuer</p>

      {/* Role cards */}
      <div className="flex flex-col sm:flex-row gap-6">
        <button
          onClick={() => choose('operator')}
          className="group flex flex-col items-center gap-4 w-60 p-8 rounded-2xl border border-slate-700 bg-slate-900 hover:border-blue-500 hover:bg-slate-800 transition-all"
        >
          <div className="w-14 h-14 rounded-xl bg-blue-600/20 group-hover:bg-blue-600/40 flex items-center justify-center transition-colors">
            <UserCog size={28} className="text-blue-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Opérateur</p>
            <p className="text-slate-400 text-sm mt-1">
              Upload, révision OCR,<br />CRM &amp; conformité
            </p>
          </div>
        </button>

        <button
          onClick={() => choose('admin')}
          className="group flex flex-col items-center gap-4 w-60 p-8 rounded-2xl border border-slate-700 bg-slate-900 hover:border-emerald-500 hover:bg-slate-800 transition-all"
        >
          <div className="w-14 h-14 rounded-xl bg-emerald-600/20 group-hover:bg-emerald-600/40 flex items-center justify-center transition-colors">
            <HardDrive size={28} className="text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Administrateur</p>
            <p className="text-slate-400 text-sm mt-1">
              Data Lake, pipeline,<br />logs &amp; statistiques
            </p>
          </div>
        </button>
      </div>

      <p className="text-slate-600 text-xs">Hackathon 2026 — Groupe 13</p>
    </div>
  )
}
