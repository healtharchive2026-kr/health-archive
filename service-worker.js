const CACHE_NAME = 'healtharchive-radarlock-20260710-1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=20260710-radarlock1',
  '/app.js?v=20260710-radarlock1',
  '/assets/logo-icon.png',
  '/assets/leaf-badge.png',
  '/data/ingredients.js?v=20260629-scheduler1225',
  '/data/minutes.js?v=20260629-scheduler1225',
  '/data/status.js?v=20260630-news0930'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    })
    .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')));
}

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    });
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
