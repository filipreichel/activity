// sw.js — service worker pro „Aktivity pro Ypsilon"
// Účel: aplikace se dá nainstalovat na plochu a po prvním načtení se rozjede
// i bez signálu. API se nikdy nekešuje (slovník musí být vždy čerstvý).

const CACHE = 'yp-shell-v1';
const SHELL = [
  './',
  'index.html',
  'pridat.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API a cizí domény (Font Awesome) necháváme na síti
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Navigace: nejdřív síť (ať jde hra hned po nasazení nové verze), offline z keše
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Statické soubory: keš první, na pozadí aktualizovat
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
