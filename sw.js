// Chat Local — service worker : garde l'app et ses librairies en cache pour l'ouvrir hors ligne.
// Les modèles d'IA ne passent pas ici (WebLLM et wllama ont leur propre cache).
const CACHE = 'chatlocal-shell-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'esm.run'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('chatlocal-shell-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !CDN_HOSTS.includes(url.hostname)) return;
  if (url.pathname.endsWith('.gguf')) return;

  // La page : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (same && (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Librairies : cache d'abord
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }))
  );
});
