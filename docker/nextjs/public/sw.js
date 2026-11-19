/*
 * Service worker for the installable web app.
 *
 * It caches only files that are the same for every user: the content-hashed build
 * assets (/_next/static/), the app icons, and the offline page. It never stores an
 * API response, a page, or anything else that depends on who is signed in, so
 * signing out on a shared device leaves nothing behind in Cache Storage.
 *
 *  - /_next/static/* and /icons/*: cache first (the file names change with the content)
 *  - page navigations: network only; when the network fails, /offline.html
 *  - everything else (API, auth, uploads, other origins): not handled, the browser fetches as usual
 *
 * Changing this policy to cache pages or API responses would put one user's data in a
 * cache that the next user of the same browser can read. Do not do that without
 * keying the cache per user and clearing it on sign-out.
 */
const CACHE_NAME = 'rag-static-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];
// The build assets change on every deploy and old ones are never requested again.
const MAX_ENTRIES = 150;

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        // Only a complete, same-origin 200 is stored (no redirects, no partial content, no errors).
        if (response.ok && response.status === 200 && response.type === 'basic') {
          await cache.put(request, response.clone());
          await trim(cache);
        }
        return response;
      }),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    );
  }
});
