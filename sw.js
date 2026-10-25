'use strict';
/* LifeOS offline cache. The whole app is stored on the phone on first visit; afterwards it never needs the network. */
const VERSION = '4f50b9701b';
const CACHE = 'lifeos-' + VERSION;
const FILES = ["./","css/app.css","css/mobile.css","engine.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","js/core.js","js/i18n-ar.js","js/main.js","js/mobile.js","js/p-finance-forms.js","js/p-finance.js","js/p-finance2.js","js/p-perf.js","js/p-perf2.js","js/p-portfolio.js","js/p-system.js","manifest.webmanifest","vendor/chart.umd.js","vendor/sql-wasm.js","vendor/sql-wasm.wasm"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lifeos-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : null) || fetch(req)));
});
