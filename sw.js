/* Image cache for chandramathi.github.io
   Strategy: stale-while-revalidate for images.
   - Repeat visits show images instantly from the cache (works offline too).
   - In the background it re-checks GitHub, so a replaced image shows up on the next visit.
   Bump CACHE_VERSION to wipe the cache completely. */

const CACHE_VERSION = 'v1';
const CACHE = `portfolio-images-${CACHE_VERSION}`;
const MAX_ITEMS = 120;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('portfolio-images-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isImage(request) {
  if (request.method !== 'GET') return false;
  if (request.destination === 'image') return true;
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i.test(new URL(request.url).pathname);
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ITEMS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (!isImage(request)) return; // pages, fonts, scripts: normal browser handling

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);

    const network = fetch(request).then(async response => {
      // Cache successful responses (opaque = cross-origin CDN images loaded without CORS)
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone());
        trim(cache);
      }
      return response;
    }).catch(() => cached);

    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    return network;
  })());
});
