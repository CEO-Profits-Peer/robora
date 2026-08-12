import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// autoUpdate reloads silently once a new Service Worker takes over — aber der
// Browser prüft von sich aus nur selten auf neue Versionen. Hier aktiv alle
// 5 Minuten und beim Zurückkehren in den Tab nachfragen, damit Updates (z.B.
// ein Gemini-Modell-Fix) zeitnah ankommen statt erst beim nächsten App-Neustart.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 5 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})
