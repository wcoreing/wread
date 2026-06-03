import '@wailsio/runtime'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { bootstrapSystemTheme } from './hooks/useSystemTheme'
import './styles/systemThemes.css'
import './styles/systemThemesMono.css'
import './styles/toolbar.css'
import './styles/scrollbars.css'

bootstrapSystemTheme()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
