const CACHE = 'mind-trainer-v1';
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/app.js', './js/rng.js', './js/storage.js', './js/adaptive.js',
  './js/ai.js', './js/content.js', './js/ui.js',
  './js/games/nback.js', './js/games/spatial.js', './js/games/pairs.js',
  './js/games/shopping.js', './js/games/dualtask.js', './js/games/route.js',
  './js/games/story.js',
  './icons/icon-192.png', './icons/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // never cache API calls
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
