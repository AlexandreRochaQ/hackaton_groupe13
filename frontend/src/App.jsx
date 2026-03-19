import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { SmilePlus } from 'lucide-react'
import Layout from './components/Layout.jsx'
import LoginPage from './features/login/LoginPage.jsx'
import UploadPage from './features/upload/UploadPage.jsx'
import ReviewPage from './features/review/ReviewPage.jsx'
import CRMPage from './features/crm/CRMPage.jsx'
import CompliancePage from './features/compliance/CompliancePage.jsx'
import AdminPage from './features/admin/AdminPage.jsx'
import { ToastProvider } from './components/Toast.jsx'

function RoleGuard({ allowed, children }) {
  const role = localStorage.getItem('role')
  if (!role) return <Navigate to="/login" replace />
  if (!allowed.includes(role)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/upload'} replace />
  }
  return children
}

function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-400">
      <p className="text-6xl font-bold text-slate-200">404</p>
      <p className="text-lg font-medium text-slate-600">Page introuvable</p>
      <p className="text-sm flex items-center gap-1.5">
        …ou peut-être mal extraite par notre OCR
        <SmilePlus size={16} className="text-slate-400" />
      </p>
      <button
        onClick={() => navigate('/login')}
        className="mt-4 text-sm text-brand-500 hover:underline"
      >
        Retour à l'accueil
      </button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Operator routes */}
          <Route
            path="/"
            element={
              <RoleGuard allowed={['operator']}>
                <Layout />
              </RoleGuard>
            }
          >
            <Route index element={<Navigate to="/upload" replace />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="review/:batchId" element={<ReviewPage />} />
            <Route path="review" element={<Navigate to="/upload" replace />} />
            <Route path="crm/:batchId" element={<CRMPage />} />
            <Route path="crm" element={<CRMPage />} />
            <Route path="compliance/:batchId" element={<CompliancePage />} />
            <Route path="compliance" element={<CompliancePage />} />
          </Route>

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <RoleGuard allowed={['admin']}>
                <Layout />
              </RoleGuard>
            }
          >
            <Route index element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
