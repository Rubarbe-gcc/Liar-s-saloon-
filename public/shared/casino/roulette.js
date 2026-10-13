/**
 * LE VELOURS NOIR — la roulette européenne.
 *
 * Module ISO : la roue (37 cases, un seul zéro), le tapis et ses mises,
 * les paiements. Une mise couvre une liste de numéros ; elle rapporte
 * 36 / (nombre de numéros) − 1 fois la mise : 35 en plein, 17 à cheval,
 * 11 en transversale, 8 en carré, 5 en sixain, 2 sur une douzaine ou une
 * colonne, 1 sur les chances simples.
 *
 * Sur le tapis, chaque mise a une place en « cases » : i le long du tapis
 * (0 le zéro, 1 à 12 les colonnes de numéros, 13 les « 2 pour 1 »), j en
 * travers (0 à 2 les numéros, 3 les douzaines, 4 les chances simples).
 */

import { entier } from '../hasard.js';

/** Les cases de la roue, dans l'ordre, en partant du zéro. */
export const ROUE = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const ROUGES = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const couleurDe = (n) => (n === 0 ? 'vert' : ROUGES.has(n) ? 'rouge' : 'noir');
export const tirer = (rng) => entier(rng, 37);
export const paiement = (nums) => 36 / nums.length - 1;

const iDe = (n) => Math.ceil(n / 3);
const jDe = (n) => (n % 3 === 0 ? 0 : n % 3 === 2 ? 1 : 2);
const plage = (a, b, pas = 1) => { const o = []; for (let n = a; n <= b; n += pas) o.push(n); return o; };
const point = (x, y) => ({ i: x - 0.22, j: y - 0.22, w: 0.44, h: 0.44, point: true });

/** Toutes les mises possibles, avec leur place sur le tapis. */
export const ZONES = (() => {
  const z = [];
  const add = (id, type, nom, nums, pos) => z.push({ id, type, nom, nums, ...pos });
  add('p0', 'plein', '0', [0], { i: 0, j: 0, w: 1, h: 3 });
  for (let n = 1; n <= 36; n++) add(`p${n}`, 'plein', String(n), [n], { i: iDe(n), j: jDe(n), w: 1, h: 1 });
  for (let n = 1; n <= 33; n++) add(`c${n}-${n + 3}`, 'cheval', `${n}/${n + 3}`, [n, n + 3], point(iDe(n) + 1, jDe(n) + 0.5));
  for (let n = 1; n <= 35; n++) if (n % 3) add(`c${n}-${n + 1}`, 'cheval', `${n}/${n + 1}`, [n, n + 1], point(iDe(n) + 0.5, jDe(n)));
  for (let n = 1; n <= 32; n++) if (n % 3) add(`k${n}`, 'carre', `${n}/${n + 1}/${n + 3}/${n + 4}`, [n, n + 1, n + 3, n + 4], point(iDe(n) + 1, jDe(n)));
  for (let n = 1; n <= 34; n += 3) add(`t${n}`, 'transversale', `${n} à ${n + 2}`, [n, n + 1, n + 2], point(iDe(n) + 0.5, 3));
  for (let n = 1; n <= 31; n += 3) add(`s${n}`, 'sixain', `${n} à ${n + 5}`, plage(n, n + 5), point(iDe(n) + 1, 3));
  add('c0-1', 'cheval', '0/1', [0, 1], point(1, 2.5));
  add('c0-2', 'cheval', '0/2', [0, 2], point(1, 1.5));
  add('c0-3', 'cheval', '0/3', [0, 3], point(1, 0.5));
  add('t0-1', 'transversale', '0/1/2', [0, 1, 2], point(1, 2));
  add('t0-2', 'transversale', '0/2/3', [0, 2, 3], point(1, 1));
  add('k0', 'carre', '0/1/2/3', [0, 1, 2, 3], point(1, 3));
  for (let k = 0; k < 3; k++) add(`d${k + 1}`, 'douzaine', `${['1re', '2e', '3e'][k]} douzaine`, plage(12 * k + 1, 12 * k + 12), { i: 1 + 4 * k, j: 3, w: 4, h: 1 });
  [[3, 0], [2, 1], [1, 2]].forEach(([d, j]) => add(`col${d}`, 'colonne', `${d === 1 ? '1re' : `${d}e`} colonne`, plage(d, 36, 3), { i: 13, j, w: 1, h: 1 }));
  const simples = [
    ['manque', 'Manque', plage(1, 18)], ['pair', 'Pair', plage(2, 36, 2)], ['rouge', 'Rouge', [...ROUGES]],
    ['noir', 'Noir', plage(1, 36).filter((n) => !ROUGES.has(n))], ['impair', 'Impair', plage(1, 35, 2)], ['passe', 'Passe', plage(19, 36)],
  ];
  simples.forEach(([id, nom, nums], k) => add(id, 'simple', nom, nums, { i: 1 + 2 * k, j: 4, w: 2, h: 1 }));
  return z;
})();
export const PAR_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/**
 * Le règlement d'un tour.
 * @param {Record<string, number>} paris  { idDeZone: mise }
 * @returns {{ retour: number, gagnants: string[], perdants: string[] }}
 *   `retour` : ce que le croupier rend (mises gagnantes comprises).
 */
export function regler(paris, numero) {
  let retour = 0;
  const gagnants = [], perdants = [];
  for (const [id, mise] of Object.entries(paris)) {
    const z = PAR_ID[id];
    if (!z || !(mise > 0)) continue;
    if (z.nums.includes(numero)) { retour += mise * (paiement(z.nums) + 1); gagnants.push(id); }
    else perdants.push(id);
  }
  return { retour, gagnants, perdants };
}

/** L'annonce du croupier : « 17, noir, impair et manque ». */
export function annonce(n) {
  if (n === 0) return 'Zéro';
  return `${n}, ${couleurDe(n)}, ${n % 2 ? 'impair' : 'pair'} et ${n <= 18 ? 'manque' : 'passe'}`;
}
