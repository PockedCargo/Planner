// Minimal service worker: caches the app shell so it opens instantly and
// still shows the UI offline. It does NOT cache or intercept any Firebase/
// Supabase network calls — chat, questions and media always stay live.
const CACHE = 'us-app-shell-v1';
const SHELL = ['./us.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only serve the app shell from cache; let every other request
  // (Firebase, Supabase, fonts, etc.) go straight to the network.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!SHELL.some(p => url.pathname.endsWith(p.replace('./','')))) return;

  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
