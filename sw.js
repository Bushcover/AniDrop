const CACHE_NAME = 'anidrop-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install the service worker and open the cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Intercept network requests
self.addEventListener('fetch', event => {
  // Do not cache GraphQL API requests to ensure anime/manga data is always fresh
  if (event.request.url.includes('graphql.anilist.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});