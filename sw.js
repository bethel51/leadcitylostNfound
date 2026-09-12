/* =====================================================
   LCU FindMe — Service Worker (PWA)
   Fast caching, offline support, and app shell resilience.
   ===================================================== */

const CACHE_NAME = 'lcu-findme-cache-v1.3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './admin.html',
  './slip.html',
  './style.css',
  './dashboard.css',
  './app.js',
  './dashboard.js',
  './admin.js',
  './qrGenerator.js',
  './manifest.json',
  './logo.png',
  './logo-shield.png',
  './icon-192.png',
  './icon-512.png',
  './senate-bg.jpg'
];

// Install: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some static assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for static assets, Network-First for API calls
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // If API call: Network First, no long-term caching to keep listings live
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({ 
            message: 'You are currently offline. Please check your network connection.',
            offline: true 
          }),
          { 
            headers: { 'Content-Type': 'application/json' },
            status: 503 
          }
        );
      })
    );
    return;
  }

  // If static asset: Cache First with background network refresh
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback to offline page/dashboard if navigation
        if (req.mode === 'navigate') {
          return caches.match('./dashboard.html') || caches.match('./index.html');
        }
      });
    })
  );
});
