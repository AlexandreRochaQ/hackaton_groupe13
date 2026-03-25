import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Eye, EyeOff, Mail, Lock, User } from 'lucide-react'
import { login, register } from '../../api/auth.js'
import { useToast } from '../../components/Toast.jsx'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const showToast = useToast().success
  const showError = useToast().error

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const data = isLogin
        ? await login(email, password)
        : await register(email, password, name)

      localStorage.setItem('token', data.data.token)
      localStorage.setItem('role', data.data.user.role)
      localStorage.setItem('user', JSON.stringify(data.data.user))

      console.log('Login success, token set, navigating to', data.data.user.role === 'admin' ? '/admin' : '/upload')
      showToast('Connexion réussie')
      navigate(data.data.user.role === 'admin' ? '/admin' : '/upload', { replace: true })
    } catch (err) {
      showError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
          <Layers size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white text-xl font-bold leading-tight">DocFlow</p>
          <p className="text-slate-400 text-sm">Plateforme documentaire IA</p>
        </div>
      </div>

      {/* Form */}
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 p-8">
        <div className="flex mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 text-center font-medium rounded-lg transition ${
              isLogin ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 text-center font-medium rounded-lg transition ${
              !isLogin ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nom</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
                  placeholder="Votre nom"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
                placeholder="votre@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-600 text-white font-medium rounded-lg transition"
          >
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'S\'inscrire'}
          </button>
        </form>
      </div>

      <p className="text-slate-400 text-xs mt-8">
        DocFlow · Hackathon 2026
      </p>
    </div>
  )
}
