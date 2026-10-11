import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { installStaffNativeApiBridge } from './lib/staffApi.ts'
import './index.css'
import './family.css'
import './smart-inbox.css'
import AppV2 from './AppV2.tsx'

installStaffNativeApiBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppV2 />
    </ErrorBoundary>
  </StrictMode>,
)


if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[Staff PWA] service worker not registered:', error)
    })
  })
}
