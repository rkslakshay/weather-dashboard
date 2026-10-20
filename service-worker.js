const CACHE_NAME = 'skypulse-v3';
const APP_SHELL = ['./', './index.html', './style.css', './script.js', './manifest.json', './assets/icon.svg'];
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'flagcdn.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request).then((hit) => hit || Promise.reject(new Error('offline'))));
}

function cacheFirst(request) {
  return caches.match(request).then((hit) => hit || fetch(request).then((response) => {
    if (response.ok || response.type === 'opaque') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Map tiles change constantly and are numerous: never cache them here
  if (url.searchParams.get('endpoint') === 'tile' || url.hostname === 'tile.openstreetmap.org') return;

  // Weather data and the app itself: always try the network so deploys and data are fresh
  if (url.pathname.startsWith('/api/weather') || url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Version-pinned libraries, fonts, icons and flags never change: serve from cache
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
