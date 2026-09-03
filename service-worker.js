const CACHE_NAME = 'healtharchive-runtime-20260901-perf1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=20260901-perf1',
  '/simon.css?v=20260730-adminlock1',
  '/app.js?v=20260901-perf1',
  '/simon.js?v=20260730-adminlock1',
  '/section-visuals.js?v=20260730-chapters1',
  '/pc-cinema.js?v=20260825-redesign1',
  '/device-routing.js?v=20260714-mobile1',
  '/assets/logo-icon.png',
  '/assets/logo-icon-transparent.png',
  '/assets/leaf-badge.png',
  '/assets/pc-landscape-bg.jpg',
  '/data/ingredients.js?v=20260722-runtimefix1',
  '/data/products_recent.js?v=20260901-perf1',
  '/data/news_recent.js?v=20260901-perf1',
  '/data/minutes.js?v=20260827-app4',
  '/data/status.js?v=20260722-runtimefix1'
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
