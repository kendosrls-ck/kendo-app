/* Kendo PWA — Service Worker minimale per installabilità.
   NON cache aggressiva: usiamo "network-first" così l'app è sempre aggiornata.
   Il cachebusting di Vercel sui bundle JS hashed fa già il lavoro.
*/

const VERSION = "kendo-v1";

self.addEventListener("install", (event) => {
  // Attiva subito il nuovo SW senza aspettare il vecchio
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Prendi controllo di tutte le tab subito
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Solo richieste GET su stesso dominio
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API: sempre live
  if (url.pathname.startsWith("/api/")) return;

  // Strategia: network-first, con fallback cache solo se offline
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
