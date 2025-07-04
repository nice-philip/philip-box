// Basic Service Worker for Philip Box
const CACHE_NAME = 'philip-box-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/script.js',
  '/config.js',
  '/auth.js',
  '/fileManager.js',
  '/upload.js',
  '/preview.js',
  '/utils.js'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip non-HTTP requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  // Skip API requests - let them go to network
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Return offline page or basic response
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
}); 