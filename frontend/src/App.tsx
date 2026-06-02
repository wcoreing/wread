import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import WorkspacePage from './pages/WorkspacePage'
import PopoutPage from './pages/PopoutPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkspacePage />} />
        <Route path="/popout" element={<PopoutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
