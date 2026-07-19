import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Redesign Phase 0: self-hosted variable fonts (CSP-safe — bundled, no CDN)
// + the design-token custom properties. Loaded before App so first paint
// already has the system.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './design/tokens.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
