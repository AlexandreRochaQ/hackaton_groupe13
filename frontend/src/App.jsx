import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import UploadPage from './features/upload/UploadPage.jsx'
import ReviewPage from './features/review/ReviewPage.jsx'
import CRMPage from './features/crm/CRMPage.jsx'
import CompliancePage from './features/compliance/CompliancePage.jsx'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="review/:batchId" element={<ReviewPage />} />
          <Route path="review" element={<Navigate to="/upload" replace />} />
          <Route path="crm/:batchId" element={<CRMPage />} />
          <Route path="crm" element={<CRMPage />} />
          <Route path="compliance/:batchId" element={<CompliancePage />} />
          <Route path="compliance" element={<CompliancePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
