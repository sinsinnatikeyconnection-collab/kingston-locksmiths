import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Enforce HTTPS so browser-privileged features (the AR camera scanner,
// WebRTC) work for all users. The published site is already served over HTTPS,
// but this guarantees anyone who lands on the http:// variant is redirected
// before the app mounts. Safe in the builder preview, which is already https.
if (typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(window.location.hostname)) {
  window.location.replace(window.location.href.replace(/^http:/, 'https:'));
}

// Recover from Vite stale-chunk errors after a redeploy: every deploy
// re-hashes the lazy-loaded JS chunks, so a tab holding an old index.html
// 404s when it tries to import the old chunk name. Auto-reload ONCE so the
// browser picks up the fresh hashes instead of crash-landing on the root
// error boundary. Guarded by sessionStorage so a genuinely broken build
// can't loop the reload forever.
if (typeof window !== 'undefined') {
  const CHUNK_ERR = /failed to fetch dynamically imported module|importing a module script failed|failed to fetch .*\.js/i;
  const RELOAD_KEY = 'skc_chunk_reload_attempt';
  const recoverChunk = (detail) => {
    const msg = String(
      (detail && (detail.message || (detail.reason && detail.reason.message) || (detail.error && detail.error.message))) || ''
    );
    if (!CHUNK_ERR.test(msg)) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, '1');
    } catch (_) { return; }
    window.location.reload();
  };
  window.addEventListener('error', recoverChunk);
  window.addEventListener('unhandledrejection', recoverChunk);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)