import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'

const ToastContext = createContext(null)
let _nextId = 0

const TOAST_META = {
  success: { Icon: CheckCircle2, iconClass: 'text-green-400', borderClass: 'border-green-500/30' },
  error:   { Icon: XCircle,       iconClass: 'text-red-400',   borderClass: 'border-red-500/30'   },
  info:    { Icon: Info,          iconClass: 'text-blue-400',  borderClass: 'border-blue-500/30'  },
  warning: { Icon: AlertTriangle, iconClass: 'text-amber-400', borderClass: 'border-amber-500/30' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((type, message, options = {}) => {
    const id = ++_nextId
    setToasts(prev => [...prev.slice(-2), { id, type, message, ...options }])
    const duration = options.duration ?? 4000
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const ctx = {
    success: (msg, opts) => add('success', msg, opts),
    error:   (msg, opts) => add('error',   msg, opts),
    info:    (msg, opts) => add('info',    msg, opts),
    warning: (msg, opts) => add('warning', msg, opts),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => {
          const { Icon, iconClass, borderClass } = TOAST_META[t.type] || TOAST_META.info
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-2.5 bg-slate-900 border ${borderClass} text-sm rounded-xl shadow-lg animate-slide-up min-w-[240px] max-w-[360px] pointer-events-auto`}
            >
              <Icon size={14} className={iconClass} />
              <span className="flex-1 text-slate-200">{t.message}</span>
              {t.action && (
                <button
                  onClick={t.action.onClick}
                  className="text-xs text-brand-400 hover:text-brand-300 font-medium flex-shrink-0"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-500 hover:text-slate-300 flex-shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
