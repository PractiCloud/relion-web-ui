import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// CSRF defense: the backend rejects state-changing requests without this header.
// Browsers do not send custom headers on cross-origin form posts without a
// preflight, so this blocks form-based CSRF at essentially zero cost.
const _origFetch = window.fetch.bind(window);
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const headers = new Headers(init?.headers || {});
    if (!headers.has('X-Requested-With')) {
      headers.set('X-Requested-With', 'XMLHttpRequest');
    }
    init = { ...init, headers };
  }
  return _origFetch(input, init);
}) as typeof fetch;

// UploadDialog.tsx uses XMLHttpRequest directly for progress reporting; patch
// its open() to add the header as well so uploads pass the same check.
const _origXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, method: string, ...rest: any[]) {
  _origXhrOpen.apply(this, [method, ...rest] as any);
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    this.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  }
} as typeof XMLHttpRequest.prototype.open;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
