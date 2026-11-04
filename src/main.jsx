import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// The server code is loaded only for an explicitly requested preview.
// Missing Supabase configuration must never break the existing public demo.
const ServerWorkspace = lazy(() => import('./ServerWorkspace.jsx'))
const serverPreview = new URLSearchParams(window.location.search).get('mode') === 'server'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {serverPreview
      ? <Suspense fallback={<p>Serveransicht wird geladen …</p>}><ServerWorkspace /></Suspense>
      : <App />}
  </StrictMode>,
)
