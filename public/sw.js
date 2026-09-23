/**
 * Service worker d'Insert Coin.
 *
 * Objectif : rendre le site installable et, surtout, jouable sans réseau —
 * le mode hors-ligne du jeu tourne entièrement dans l'onglet, il n'y a donc
 * aucune raison qu'il exige une connexion.
 *
 * Stratégie : le réseau d'abord, le cache en secours. Le site évolue au fil
 * des ajouts de jeux, et une ressource périmée servie depuis le cache coûte
 * plus cher qu'une poignée de millisecondes de latence.
 */

const VERSION = 'v7';
const CACHE = `insert-coin-${VERSION}`;

/** Coquille de l'application : tout ce qu'il faut pour jouer hors connexion. */
const SHELL = [
  '/',
  '/css/hub.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/games/liars-saloon/',
  '/games/liars-saloon/manifest.webmanifest',
  '/games/liars-saloon/css/base.css',
  '/games/liars-saloon/css/menu.css',
  '/games/liars-saloon/css/table.css',
  '/games/liars-saloon/js/main.js',
  '/games/liars-saloon/js/ui.js',
  '/games/liars-saloon/js/offline.js',
  '/games/liars-saloon/js/online.js',
  '/games/liars-saloon/js/sfx.js',
  '/games/liars-saloon/icons/icon-192.png',
  '/shared/engine.js',
  '/shared/ai.js',
  '/games/zenith/',
  '/games/zenith/manifest.webmanifest',
  '/games/zenith/css/zenith.css',
  '/games/zenith/js/main.js',
  '/games/zenith/js/ui.js',
  '/games/zenith/js/offline.js',
  '/games/zenith/js/online.js',
  '/games/zenith/js/sfx.js',
  '/games/zenith/js/regles.js',
  '/games/zenith/icons/icon-192.png',
  '/shared/zenith/fighters.js',
  '/shared/zenith/battle.js',
  '/shared/zenith/ai.js',
  '/shared/zenith/sprites.js',
  '/shared/zenith/roue.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Chaque entrée est mise en cache séparément : une ressource manquante
    // ne doit pas faire échouer l'installation complète.
    await Promise.all(SHELL.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { console.warn('[sw] non mis en cache :', url, err); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => n.startsWith('insert-coin-') && n !== CACHE)
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Seules les lectures de même origine nous concernent. Les parties en ligne
  // passent par /api/ et ne doivent jamais être servies depuis un cache.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      // On ne conserve que les réponses complètes et exploitables.
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;

      // Une navigation inconnue retombe sur la page la plus proche déjà connue.
      if (request.mode === 'navigate') {
        const fallback = url.pathname.startsWith('/games/liars-saloon')
          ? '/games/liars-saloon/'
          : '/';
        const shell = await caches.match(fallback);
        if (shell) return shell;
      }
      return new Response('Hors connexion, et cette page n\'a pas encore été visitée.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

/** Permet à la page de demander l'activation immédiate d'une mise à jour. */
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
