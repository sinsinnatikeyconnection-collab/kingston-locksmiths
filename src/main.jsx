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

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)