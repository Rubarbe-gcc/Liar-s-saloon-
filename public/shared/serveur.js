/**
 * Insert Coin — où se jouent les parties en ligne.
 *
 * Le site peut vivre sur Vercel, mais pas les parties en ligne : Vercel coupe
 * chaque connexion au bout de cinq minutes, et la reconnexion peut tomber
 * sur une autre copie du serveur, qui ne connaît pas la partie. Les parties
 * se jouent donc sur un serveur qui reste allumé, en un seul exemplaire
 * (`node server/index.js`, hébergé par exemple sur Render : voir
 * render.yaml).
 *
 * SERVEUR_JEUX : l'adresse de ce serveur (https://…). Vide : les parties se
 * jouent sur le même site que les pages (comme en local).
 */

export const SERVEUR_JEUX = 'https://insert-coin-jeux.onrender.com';

/** L'adresse WebSocket des parties en ligne. */
export function adresseWS() {
  if (SERVEUR_JEUX) return `${SERVEUR_JEUX.replace(/^http/, 'ws').replace(/\/+$/, '')}/api/ws`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;
}

let reveille = false;
/**
 * Un serveur gratuit s'endort quand personne ne joue, et met une minute à se
 * réveiller : on le réveille dès qu'on ouvre l'arcade ou un jeu en ligne.
 */
export function reveillerServeur() {
  if (!SERVEUR_JEUX || reveille || typeof fetch !== 'function') return;
  reveille = true;
  fetch(`${SERVEUR_JEUX.replace(/\/+$/, '')}/healthz`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}
