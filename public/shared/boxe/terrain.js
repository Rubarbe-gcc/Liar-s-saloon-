/**
 * CROCHET — le ring, les coups, le hasard du combat et quelques outils communs
 * au moteur (combat.js) et à l'ordinateur (ia.js).
 *
 * Les distances sont en mètres, le temps en images (60 par seconde).
 *   x : la largeur du ring (de -RING à RING), y : la profondeur.
 * Les boxeurs se font toujours face (sauf au tapis).
 *
 * Déterministe, comme le foot et le basket : additions, multiplications,
 * divisions et racines carrées seulement, jamais de sinus ni de Math.random.
 */

export const FPS = 60;
export const DT = 1 / FPS;
/** Le ring : un carré de 6,4 m entre les cordes. */
export const RING = 3.2;
export const CORPS_R = 0.34;
export const SANTE_MAX = 100;
export const ENDU_MAX = 100;

/**
 * Les coups : la préparation (armer), l'impact (frapper), le retour.
 * portee : jusqu'où il touche (d'un centre à l'autre) ; degats : sur un boxeur
 * moyen ; endu : ce qu'il coûte ; sonne : les images où l'adversaire touché ne peut rien faire.
 */
export const COUPS = {
  jab: { nom: 'Jab', armer: 6, frapper: 3, retour: 8, portee: 1.38, degats: 2, endu: 2.2, sonne: 9, points: 1 },
  crochet: { nom: 'Crochet', armer: 12, frapper: 3, retour: 15, portee: 1.16, degats: 5, endu: 5.5, sonne: 16, points: 2 },
  upper: { nom: 'Uppercut', armer: 12, frapper: 3, retour: 17, portee: 1.12, degats: 7.5, endu: 6.5, sonne: 20, points: 2 },
};
export const TYPES = ['jab', 'crochet', 'upper'];

/** L'esquive : un pas de côté ou en arrière, intouchable un instant. */
export const ESQUIVE = { duree: 16, debut: 2, fin: 12, cout: 7, repos: 22, pas: 0.42 };
/** Le coup critique : les dégâts (×) et ce qu'il sonne en plus (images). */
export const CRITIQUE = { degats: 1.7, sonne: 10 };
/** Le compte, au tapis : une seconde par chiffre. */
export const COMPTE_PAS = 60;

/** Les touches : les mêmes bits que le foot et le basket (commun/saisie.js). */
export const T = { g: 1, d: 2, h: 4, b: 8, S: 16, A: 32, B: 64, X: 128, G: 256, R: 512 };

/** Le hasard du combat : un nombre dans [0, 1), tiré de l'état (le même partout). */
export function hasard(m) {
  let t = (m.alea = (m.alea + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** À peu près une loi normale (moyenne 0, écart 1). */
export const gauss = (m) => (hasard(m) + hasard(m) + hasard(m) - 1.5) * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

/** La vitesse de déplacement d'un boxeur (m/s). */
export const vitesseMax = (p) => 2 + p.n.vitesse * 0.014;
