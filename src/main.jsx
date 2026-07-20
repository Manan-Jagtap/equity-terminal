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
// Phase 4 (perf): import the provider MODULES, not the ui barrel — the barrel
// would drag every ui component (and Radix dialog/tabs) into the entry chunk.
import { TooltipProvider } from './components/ui/Tooltip.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
// Phase 4 (perf): LazyMotion + the domAnimation feature set — the app shell
// uses <m.*> (deferred features) instead of <motion.*> (all features bundled),
// keeping the full framer feature graph out of the entry chunk.
import { LazyMotion, domAnimation } from 'motion/react'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <TooltipProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </TooltipProvider>
    </LazyMotion>
  </StrictMode>,
)
