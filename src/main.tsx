import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { initMonaco } from './project/monacoSetup'
import './styles/globals.css'

// Kick off Monaco's module load + folding-provider lockdown before any editor
// renders, so the TS language service's own folding provider can't register.
initMonaco()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
