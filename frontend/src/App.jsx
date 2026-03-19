import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import LoginPage from './features/login/LoginPage.jsx'
import UploadPage from './features/upload/UploadPage.jsx'
import ReviewPage from './features/review/ReviewPage.jsx'
import CRMPage from './features/crm/CRMPage.jsx'
import CompliancePage from './features/compliance/CompliancePage.jsx'
import AdminPage from './features/admin/AdminPage.jsx'

function RoleGuard({ allowed, children }) {
  const role = localStorage.getItem('role')
  if (!role) return <Navigate to="/login" replace />
  if (!allowed.includes(role)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/upload'} replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
