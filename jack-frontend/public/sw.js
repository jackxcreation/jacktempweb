// jack-frontend/public/sw.js (Service Worker)
const CACHE_NAME = 'jack-essentials-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.ico'
];

// 1. Install Event: Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Cache First with Network Fallback & API Bypass
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 🔥 UPGRADE: Bypass service worker cache for API calls, WebSockets, or non-GET requests
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    return; // Let network handle dynamic API requests and mutations directly
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((response) => {
        // 🔥 SAFETY FIX: Only cache valid 200 responses to avoid caching errors/opaque responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Fallback for offline assets if needed
      });
    })
  );
});

// 4. Push Notification Event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Jack Essentials', body: 'Check out the latest price drops & offers!' };
  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});