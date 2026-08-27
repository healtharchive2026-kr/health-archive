const CACHE_NAME = 'healtharchive-runtime-20260827-mobile-app4';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=20260730-chapters1',
  '/simon.css?v=20260730-adminlock1',
  '/app.js?v=20260806-visitor1',
  '/simon.js?v=20260730-adminlock1',
  '/section-visuals.js?v=20260730-chapters1',
  '/pc-cinema.js?v=20260714-cinema-restore1',
  '/device-routing.js?v=20260714-mobile1',
  '/mobile-lite.html',
  '/privacy.html',
  '/terms.html',
  '/mobile-lite.css?v=20260827-app4',
  '/mobile-verdict.css?v=20260827-app1',
  '/mobile-verdict.js?v=20260827-app1',
  '/mobile-lite.js?v=20260827-app4',
  '/assets/logo-icon.png',
  '/assets/logo-icon-transparent.png',
  '/assets/leaf-badge.png',
  '/assets/mobile-health-hero.jpg',
  '/assets/cinema-overview.jpg',
  '/assets/cinema-discovery.jpg',
  '/assets/cinema-intelligence.jpg',
  '/assets/cinema-workspace.jpg',
  '/assets/pc-landscape-bg.jpg',
  '/assets/pc-nature-hero.jpg',
  '/assets/pc-origin.jpg',
  '/assets/pc-lab.jpg',
  '/assets/pc-clinical.jpg',
  '/assets/pc-data.jpg',
  '/assets/pc-regulatory.jpg',
  '/data/ingredients.js?v=20260722-runtimefix1',
  '/data/temp_approval.js?v=20260722-runtimefix1',
  '/data/food_ingredients.js?v=20260722-runtimefix1',
  '/data/blocked_ingredients.js?v=20260722-runtimefix1',
  '/data/gmo_ingredients.js?v=20260722-runtimefix1',
  '/data/guidelines.js?v=20260629-glossary',
  '/data/biomarker_protocols.js?v=20260711-terms1',
  '/data/mobile_digest.js?v=20260827-app4',
  '/data/minutes.js?v=20260827-app4',
  '/data/status.js?v=20260722-runtimefix1',
  '/data/hff_db.json?v=20260720-production-sales1',
  '/market.js?v=20260721-access-market1'
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
