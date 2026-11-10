import '@fontsource-variable/cormorant-garamond';
import '@fontsource-variable/outfit';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { ToastProvider } from './components/toast';
import { TranslateProvider } from './i18n';

const rootElement: HTMLElement | null = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <TranslateProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TranslateProvider>
  </StrictMode>,
);
