import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

if (import.meta.env.DEV) {
  // Development-only handle for inspecting live values from the console.
  void Promise.all([
    import('./choreography/stage'),
    import('./audio/audioAnalysis'),
    import('./components/Experience/controller'),
    import('./choreography/anchors'),
  ]).then(([s, a, c, an]) => {
    ;(window as unknown as Record<string, unknown>).__tandav = { stage: s.stage, features: a.features, seek: c.seek, anchors: an.anchors }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
