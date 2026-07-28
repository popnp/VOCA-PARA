/* Service worker for popnp.github.io — Voca/Para/Memo and Time.

   What this does and, more importantly, what it does not do:

   It keeps a copy of the two HTML files so the apps open with no signal. That
   is all. It never touches your records — those live in the browser's own
   storage and go to Supabase exactly as they always have. Requests to any other
   host pass straight through untouched, so syncing is unaffected.

   The strategy is network-first: every load asks the server first and only
   falls back to the stored copy when the network fails. That way a new Build
   pushed to GitHub shows up the next time an app is opened, rather than being
   held back by a stale cache — which is the usual complaint about installed web
   apps and worth the extra request.
*/

/* Bump this on every release. Changing it is what retires the old cache. */
const VERSION = '2026-07-29b';
const CACHE = 'popnp-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './time.html',
  './voca.webmanifest',
  './time.webmanifest',
  './icon-voca-192.png',
  './icon-voca-512.png',
  './icon-time-192.png',
  './icon-time-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // Individually, so one missing file can't fail the whole install.
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only ordinary page loads on this site. Anything else — Supabase, Google
  // Fonts, a POST — is left completely alone.
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Keep the fresh copy for the next time there is no signal.
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit || caches.match('./index.html')
        )
      )
  );
});
