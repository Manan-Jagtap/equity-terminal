import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Redesign Phase 0: self-hosted variable fonts (CSP-safe — bundled, no CDN)
// + the design-token custom properties. Loaded before App so first paint
// already has the system.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './design/tokens.css'
import App from './App.jsx'
// Redesign Phase 2b: overlay providers at the root — every screen (legacy or
// rebuilt) can use ui/ Tooltip + useToast without local wrapping.
import { TooltipProvider, ToastProvider } from './components/ui/index.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TooltipProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TooltipProvider>
  </StrictMode>,
)
