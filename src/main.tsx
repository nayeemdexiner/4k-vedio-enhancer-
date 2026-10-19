// Ensure window.fetch is configurable and writable to prevent extension interception errors
if (typeof window !== 'undefined') {
  try {
    let currentFetch = window.fetch;
    const desc = {
      get: () => currentFetch,
      set: (fn: typeof fetch) => { currentFetch = fn; },
      configurable: true,
      enumerable: true
    };
    Object.defineProperty(window, 'fetch', desc);
    if (window.Window && window.Window.prototype) {
      try {
        Object.defineProperty(window.Window.prototype, 'fetch', desc);
      } catch (_) {}
    }
  } catch (_) {}

  const patchAudioProto = (ctor: any) => {
    try {
      if (ctor && ctor.prototype && typeof ctor.prototype.close === 'function') {
        const origClose = ctor.prototype.close;
        ctor.prototype.close = function(this: any) {
          if (!this || this.state === 'closed' || this.__closing) {
            return Promise.resolve();
          }
          this.__closing = true;
          try {
            const p = origClose.call(this);
            if (p && typeof p.then === 'function') {
              return p.catch(() => {});
            }
            return Promise.resolve();
          } catch (_) {
            return Promise.resolve();
          }
        };
      }
    } catch (_) {}
  };

  patchAudioProto(window.AudioContext);
  patchAudioProto((window as any).webkitAudioContext);
  patchAudioProto((window as any).BaseAudioContext);

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || '');
    if (msg.includes('Cannot close a closed AudioContext')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (msg.includes('Cannot close a closed AudioContext')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
