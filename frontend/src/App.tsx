import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSystemTheme } from './hooks/useSystemTheme'
import WorkspacePage from './pages/WorkspacePage'
import PopoutPage from './pages/PopoutPage'
import PillPage from './pages/PillPage'

/** AppRoot 挂载路由并保持系统主题跨页同步。 */
function AppRoot() {
  useSystemTheme()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WorkspacePage />} />
        <Route path="/popout" element={<PopoutPage />} />
        <Route path="/pill" element={<PillPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return <AppRoot />
}
