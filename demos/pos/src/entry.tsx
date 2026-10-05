import { createRoot } from 'react-dom/client'
import { DemoBanner } from './demo/DemoBanner'

// window.api must exist before the app (which calls it on first render) is loaded.
await import('./demo/boot')
await import('./renderer/src/main')

const banner = document.createElement('div')
document.body.appendChild(banner)
createRoot(banner).render(<DemoBanner />)
