const CACHE_NAME = 'crypto-trader-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/binance-api.js',
    '/cache.js',
    '/indicators.js',
    '/risk-calculator.js',
    '/scanner.js',
    '/app.js',
    '/icon-192.png',
    '/icon-512.png',
    '/manifest.json'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://unpkg.com/lightweight-charts@4.1.0/dist/lightweight-charts.standalone.production.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // API requests - network only (don't cache live data)
    if (url.hostname === 'api.binance.com') {
        event.respondWith(fetch(request));
        return;
    }

    // Static assets - cache first, then network
    if (STATIC_ASSETS.includes(url.pathname) || url.pathname.endsWith('.png')) {
        event.respondWith(
            caches.match(request).then(cached => {
                return cached || fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // External assets - cache with network fallback
    if (EXTERNAL_ASSETS.some(asset => request.url.includes(asset))) {
        event.respondWith(
            caches.match(request).then(cached => {
                const fetchPromise = fetch(request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                }).catch(() => cached);
                return cached || fetchPromise;
            })
        );
        return;
    }

    // Default - network first, cache fallback
    event.respondWith(
        fetch(request)
            .then(response => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200) {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// Handle push notifications (for future use)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png'
        });
    }
});
