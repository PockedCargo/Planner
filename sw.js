// Service worker: (1) caches the app shell so it opens instantly and
// still shows the UI offline — this does NOT cache or intercept any
// Firebase/Supabase network calls, chat/questions/media always stay
// live — and (2) receives Firebase Cloud Messaging push notifications
// while the app is closed.
const CACHE = 'us-app-shell-v4';
const SHELL = ['./us_rewritten.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

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

// ---------------------------------------------------------------
// PUSH NOTIFICATIONS (background)
// Same Firebase config as the main app — this runs in the service
// worker's own isolated context, so it needs its own SDK import and
// its own initializeApp() call.
// ---------------------------------------------------------------
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAKuWlsR6KuDY8NIBu1u-PCcB6GDix-ckc",
  authDomain: "planner-e932f.firebaseapp.com",
  databaseURL: "https://planner-e932f-default-rtdb.firebaseio.com",
  projectId: "planner-e932f",
});

try {
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const title = (payload.notification && payload.notification.title) || 'Us';
    const body = (payload.notification && payload.notification.body) || 'New message';
    self.registration.showNotification(title, {
      body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'us-message', // collapses multiple pending notifications into one
    });
  });
} catch (e) {
  // Messaging isn't configured yet (no VAPID key set up) — the cache
  // half of this file still works fine either way.
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const existing = clientsArr.find(c => c.url.includes('us_rewritten.html'));
      if (existing) return existing.focus();
      return self.clients.openWindow('./us_rewritten.html');
    })
  );
});
