import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHead, UnheadProvider } from '@unhead/react/client'
import "./tailwind.css";
import App from './App.tsx'

// Suppress Monaco editor's "Canceled" promise rejections during disposal/unmount
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { name?: string; message?: string } | undefined;
  if (reason?.name === 'Canceled' || reason?.message === 'Canceled') {
    event.preventDefault();
  }
});

const head = createHead()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UnheadProvider head={head}>
      <App />
    </UnheadProvider>
  </StrictMode>,
)
