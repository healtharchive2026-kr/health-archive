const CACHE_NAME = 'healtharchive-runtime-20261119-perf-a11y';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=20261119-a11y2',
  '/editorial-theme.css?v=20261119-a11y1',
  '/simon.css?v=20260730-adminlock1',
  '/app-loader.js?v=20261119-perf1',
  '/app.js?v=20261119-perf1',
  '/simon.js?v=20260730-adminlock1',
  '/section-visuals.js?v=20261119-perf1',
  '/pc-cinema.js?v=20261119-perf1',
  '/device-routing.js?v=20261119-deeplink1',
  '/feedback.js?v=20261119-local1',
  '/mobile-lite.html',
  '/mobile-lite.css?v=20261119-a11y2',
  '/mobile-data-loader.js?v=20261119-perf1',
  '/mobile-lite.js?v=20261119-perf2',
  '/assets/logo-icon.png',
  '/assets/logo-icon-transparent.png',
  '/assets/leaf-badge.png',
  '/assets/editorial-ingredient-still-life.jpg',
  '/data/mobile_digest.js?v=20261119-perf1'
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

  if (
    request.mode === 'navigate'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css')
    || url.pathname.startsWith('/data/')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
