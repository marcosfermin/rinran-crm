const CACHE = 'rinran-v3';
const STATIC = ['/', '/index.html', '/manifest.json'];

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
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook/') || url.pathname.startsWith('/uploads/')) return;
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
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

// Web Push notifications
self.addEventListener('push', e => {
  let data = { title: 'Rinran CRM', body: 'Nueva notificación', data: {} };
  try { data = JSON.parse(e.data.text()); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: data.data || {},
      vibrate: [200, 100, 200],
      tag: data.data?.type || 'general',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = data.contact_id ? `/contacts/${data.contact_id}` : '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(self.location.origin + url); }
      else clients.openWindow(self.location.origin + url);
    })
  );
});
