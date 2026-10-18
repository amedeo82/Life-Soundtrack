import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento root #root non trovato');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
