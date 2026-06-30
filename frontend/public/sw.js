const CACHE = 'rinran-v1';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip API/webhook calls — always network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook/') || url.pathname.startsWith('/uploads/')) {
    return;
  }

  // Network-first for navigation (SPA), cache-first for assets
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
  } else {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok && request.method === 'GET') {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return resp;
        });
      })
    );
  }
});
