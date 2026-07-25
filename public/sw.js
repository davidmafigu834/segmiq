const CACHE_VERSION = 'segmiq-cloud-v8';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

function offlineFallback() {
  try {
    const host = new URL(self.registration.scope).hostname;
    return host.startsWith('cloud.') || host === 'cloud.localhost' ? '/login' : '/cloud/login';
  } catch {
    return '/cloud/login';
  }
}

// Only precache static assets and public login pages.
const PRECACHE_URLS = [
  '/brand/segmiq-q.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon/favicon-32x32.png',
  '/cloud/login',
  '/login',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('leadstaq-cloud-') && key !== STATIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Never cache application code. Build artifacts under /_next/ (JS/CSS chunks,
  // RSC payloads) must always come from the network — a cache-first strategy
  // here serves stale bundles after a deploy/recompile and breaks hydration.
  if (url.pathname.startsWith('/_next/')) return;

  // Cache-first only for static media (icons/images), which are content-stable.
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() =>
          caches.match(request)
            .then((cached) => cached || caches.match(offlineFallback()))
        )
    );
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
