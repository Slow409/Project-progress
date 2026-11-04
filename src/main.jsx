import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ServerWorkspace from './ServerWorkspace.jsx'

// Explicit opt-in preview. Default remains the original demo until migration is validated.
const serverPreview = new URLSearchParams(window.location.search).get('mode') === 'server'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {serverPreview ? <ServerWorkspace /> : <App />}
  </StrictMode>,
)
