import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import './styles.css';

const redirectPath = new URLSearchParams(window.location.search).get('_redirect');
if (redirectPath) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let decoded = redirectPath;
  try {
    decoded = decodeURIComponent(redirectPath);
  } catch {
    // ignore malformed encoding
  }

  const target = decoded.startsWith('/') ? decoded : `/${decoded}`;

  const match = target.match(/^([^?#]*)(.*)$/);
  const pathPart = match?.[1] ?? target;
  const segments = pathPart.split('/').filter(Boolean);
  const hasTraversal = segments.some((segment) => segment === '.' || segment === '..');

  const hasScheme = pathPart.includes('://');
  const isProtocolRelative = pathPart.startsWith('//');
  const isSafePath = /^\/[0-9A-Za-z_\-./]*$/.test(pathPart);

  if (!isProtocolRelative && !hasScheme && !hasTraversal && isSafePath) {
    window.history.replaceState(null, '', `${base}${target}`);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
