import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from '@/app/App'
import '@/styles/globals.css'

/**
 * Point d'entrée du frontend.
 *
 * `HashRouter` : compatible avec le protocole `tauri://` et le système de
 * fichiers local, sans configuration serveur. Les URL restent lisibles
 * (`#/explorer`) et les boutons précédent/suivant fonctionnent.
 */
const container = document.getElementById('root')

if (!container) {
  throw new Error('Élément racine #root introuvable dans index.html')
}

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
