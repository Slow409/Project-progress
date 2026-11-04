import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// The server code is loaded only for an explicitly requested preview.
// Missing Supabase configuration must never break the existing public demo.
const ServerWorkspace = lazy(() => import('./ServerWorkspace.jsx'))
const serverPreview = new URLSearchParams(window.location.search).get('mode') === 'server'
const serverConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {serverPreview
      ? (serverConfigured
        ? <Suspense fallback={<p>Serveransicht wird geladen …</p>}><ServerWorkspace /></Suspense>
        : <main role="alert" style={{padding:24,maxWidth:720,margin:'0 auto'}}>
            <h1>Serveransicht derzeit nicht verfügbar</h1>
            <p>Die Supabase-Verbindung wurde für diese Bereitstellung noch nicht eingerichtet.
            Es werden keine Daten lokal als Ersatz gespeichert. Bitte den Administrator kontaktieren.</p>
          </main>)
      : <App />}
  </StrictMode>,
)
