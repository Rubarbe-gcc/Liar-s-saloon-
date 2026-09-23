/**
 * Petit atelier d'aléa déterministe, partagé par les jeux.
 *
 * Tout ce qui tire au sort dans un moteur passe par un `rng` explicite : une
 * partie rejouée avec la même graine se déroule à l'identique, ce qui rend les
 * tests possibles et les bugs reproductibles.
 */

/** Générateur mulberry32 : rapide, déterministe, suffisant pour du jeu. */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entier dans [0, n[. */
export const entier = (rng, n) => Math.floor(rng() * n);

/** Mélange de Fisher-Yates, en place. */
export function melanger(liste, rng) {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = entier(rng, i + 1);
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/** Un élément au hasard. */
export const piocher = (liste, rng) => liste[entier(rng, liste.length)];
