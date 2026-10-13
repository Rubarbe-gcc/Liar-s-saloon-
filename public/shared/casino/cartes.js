/**
 * LE VELOURS NOIR — les cartes.
 *
 * Module ISO (navigateur et Node) : un jeu de 52 cartes, le sabot, les noms.
 * Une carte est { r, c } : r de 2 à 14 (11 valet, 12 dame, 13 roi, 14 as),
 * c parmi ♠ ♥ ♦ ♣.
 */

import { melanger } from '../hasard.js';

export const COULEURS = ['♠', '♥', '♦', '♣'];
export const RANGS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Un ou plusieurs jeux de 52 cartes, mélangés. */
export function sabot(rng, jeux = 1) {
  const s = [];
  for (let k = 0; k < jeux; k++) for (const c of COULEURS) for (const r of RANGS) s.push({ r, c });
  return melanger(s, rng);
}

export const rouge = (c) => c === '♥' || c === '♦';

/** Le petit nom affiché dans le coin de la carte. */
export const nomRang = (r) => ({ 11: 'V', 12: 'D', 13: 'R', 14: 'A' }[r] || String(r));

/** Le nom en toutes lettres, au singulier et au pluriel. */
const NOMS = { 2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };
export const nomCarte = (r) => NOMS[r];
export const pluriel = (r) => (r >= 11 && r <= 13 ? NOMS[r] + 's' : NOMS[r]);
