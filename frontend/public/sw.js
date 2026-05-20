const CACHE_NAME = 'iuran-rt03-static-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/PWA_192x192.png',
  '/PWA_512x512.png'
];

// Install event: cache initial static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static shells');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: apply caching strategies
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strategy 1: Network First for API calls (backend)
  const isApiRequest = requestUrl.pathname.startsWith('/auth') || 
                       requestUrl.pathname.startsWith('/warga') || 
                       requestUrl.pathname.startsWith('/makam') || 
                       requestUrl.pathname.startsWith('/iuran') || 
                       requestUrl.pathname.startsWith('/laporan') || 
                       requestUrl.pathname.startsWith('/settings') || 
                       requestUrl.pathname.startsWith('/notifications') ||
                       event.request.url.includes('render.com') ||
                       event.request.url.includes('localhost:3000');

  if (isApiRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If response is valid, clone it and cache it for offline fallback
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open('iuran-rt03-api-cache').then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If nothing in cache, return a friendly JSON error
            return new Response(
              JSON.stringify({
                error: 'Offline',
                message: 'Anda sedang offline. Data keuangan real-time tidak tersedia.',
                offlineFallback: true
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
  } else {
    // Strategy 2: Stale-While-Revalidate for static assets and page routes
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200 || networkResponse.status === 0) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation / html
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});
