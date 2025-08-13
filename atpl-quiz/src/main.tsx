import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function bootstrap() {
  const url = new URL(window.location.href)
  if (url.searchParams.get('preview') === 'design') {
    const { default: DesignPreview } = await import('./design/DesignPreview')
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <DesignPreview />
      </StrictMode>,
    )
    return
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()
