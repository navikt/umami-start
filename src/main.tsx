import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHead, UnheadProvider } from '@unhead/react/client'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import "@navikt/ds-css";
import App from './App.tsx'

const head = createHead()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UnheadProvider head={head}>
      <App />
    </UnheadProvider>
  </StrictMode>,
)
