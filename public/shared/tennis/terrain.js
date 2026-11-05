/**
 * REVERS — le court, la balle et quelques outils communs au moteur (match.js)
 * et à l'ordinateur (ia.js).
 *
 * Les distances sont en mètres, le temps en images (60 par seconde).
 *   x : la largeur du court (de -DEMI_SIMPLE à DEMI_SIMPLE dans les couloirs du simple),
 *   y : la longueur (le filet en 0 ; le joueur 0 en bas, y < 0 ; le joueur 1 en haut, y > 0),
 *   z : la hauteur.
 *
 * Déterministe, comme le foot, le basket et la boxe : additions, multiplications,
 * divisions et racines carrées seulement, jamais de sinus ni de Math.random.
 */

export const FPS = 60;
export const DT = 1 / FPS;
/** La moitié de la longueur du court, la demi-largeur du simple, la ligne de service (depuis le filet). */
export const LONG = 11.885;
export const DEMI_SIMPLE = 4.115;
export const SERVICE = 6.4;
/** La hauteur du filet (au centre, un peu plus vers les poteaux : on prend la moyenne). */
export const FILET = 0.95;
export const RAYON = 0.034;
export const G = 9.81;

/**
 * Les coups. vitesse : la vitesse au sol (m/s) d'un coup faible à un coup parfait ; grav : l'effet
 * (un lift plonge, un slice flotte) ; rebondK / rebondH : ce que la balle garde de vitesse et de hauteur au
 * rebond ; prof : la profondeur visée (part de la moitié du court, depuis le filet) ; err : la marge d'erreur.
 */
export const COUPS = {
  lift: { nom: 'Lift', vitesse: [19, 31], grav: 1.45, rebondK: 0.78, rebondH: 0.72, prof: [0.62, 0.9], err: 1.5, marge: 0.32 },
  slice: { nom: 'Slice', vitesse: [16, 24], grav: 0.72, rebondK: 0.66, rebondH: 0.62, prof: [0.58, 0.86], err: 1.1, marge: 0.2 },
  lob: { nom: 'Lob', vitesse: [10.5, 13.5], grav: 1.05, rebondK: 0.7, rebondH: 0.72, prof: [0.72, 0.9], err: 0.9, marge: 2.4 },
  amortie: { nom: 'Amortie', vitesse: [6.5, 9], grav: 0.9, rebondK: 0.32, rebondH: 0.38, prof: [0.14, 0.3], err: 1.15, marge: 0.25 },
  smash: { nom: 'Smash', vitesse: [27, 36], grav: 1.2, rebondK: 0.8, rebondH: 0.75, prof: [0.45, 0.8], err: 0.9, marge: 0 },
  volee: { nom: 'Volée', vitesse: [15, 22], grav: 0.9, rebondK: 0.62, rebondH: 0.5, prof: [0.5, 0.82], err: 1.05, marge: 0.15 },
  service: { nom: 'Service', vitesse: [34, 56], grav: 1.15, rebondK: 0.74, rebondH: 0.68, prof: [0.86, 0.86], err: 1, marge: 0.05 },
};
/** Les coups qu'on choisit (les boutons) ; volée et smash viennent tout seuls selon la balle. */
export const TYPES = ['lift', 'slice', 'lob', 'amortie'];

/** Les touches : les mêmes bits que les autres sports (commun/saisie.js). A lift, B slice, X lob, G amortie. */
export const T = { g: 1, d: 2, h: 4, b: 8, S: 16, A: 32, B: 64, X: 128, G: 256, R: 512 };
export const BOUTONS = { lift: T.A, slice: T.B, lob: T.X, amortie: T.G };

/** Le hasard du match : un nombre dans [0, 1), tiré de l'état (le même partout). */
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
/** Le sens d'un joueur : 1 pour celui du bas (il regarde vers y > 0), -1 pour celui du haut. */
export const sens = (e) => (e === 0 ? 1 : -1);
/** Sa vitesse de course (m/s). */
export const vitesseMax = (p) => 4.4 + p.n.vitesse * 0.032;

/**
 * Une image de la balle (sans rien décider) : l'effet, le frottement de l'air, le rebond, le filet.
 * Rend 'rebond' quand elle touche le sol, 'filet' quand elle s'y prend, sinon null.
 */
export function avancerBalle(b) {
  const vy0 = b.vy, y0 = b.y, z0 = b.z;
  b.vz -= G * b.grav * DT;
  b.vx *= 0.9985; b.vy *= 0.9985;
  b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT;
  // Le filet : la balle passe de l'autre côté trop bas (sa hauteur à l'endroit exact du filet, entre deux images).
  const passe = (y0 < 0 && b.y >= 0) || (y0 > 0 && b.y <= 0);
  const zf = passe ? z0 + (b.z - z0) * (y0 / (y0 - b.y || 1)) : 0;
  if (!b.filet && passe && zf < FILET + RAYON && Math.abs(b.x) < DEMI_SIMPLE + 1) {
    b.filet = true;
    b.y = y0 < 0 ? -RAYON * 2 : RAYON * 2;
    b.vy = -vy0 * 0.12; b.vx *= 0.3; b.vz = Math.min(b.vz, 0) * 0.3;
    return 'filet';
  }
  if (b.z <= RAYON && b.vz < 0) {
    b.z = RAYON;
    b.vz = -b.vz * b.rebondH;
    b.vx *= b.rebondK; b.vy *= b.rebondK;
    // Après le premier rebond, l'effet s'use : la balle retombe normalement.
    b.grav = 1 + (b.grav - 1) * 0.35;
    b.rebondK = 0.72; b.rebondH = 0.62;
    if (b.vz < 0.6) { b.vz = 0; b.vx *= 0.9; b.vy *= 0.9; }
    return 'rebond';
  }
  return null;
}

/**
 * La trajectoire vers une cible : la vitesse à donner à la balle (depuis bx, by, bz) pour qu'elle tombe en
 * (tx, ty), à la vitesse au sol vh, avec l'effet grav ; si elle accroche le filet, on la fait monter un peu
 * (on ralentit) jusqu'à ce qu'elle passe avec la marge voulue.
 */
export function viser(bx, by, bz, tx, ty, vh, grav, marge) {
  const dx = tx - bx, dy = ty - by;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const g = G * grav;
  let v = vh, vz = 0, Tvol = 1;
  for (let k = 0; k < 14; k++) {
    Tvol = d / v;
    vz = (RAYON - bz + 0.5 * g * Tvol * Tvol) / Tvol;
    // La hauteur au passage du filet (si la balle le passe).
    if ((by < 0) === (ty < 0)) break;
    const tf = (-by / dy) * Tvol;
    const zf = bz + vz * tf - 0.5 * g * tf * tf;
    if (zf >= FILET + RAYON + marge) break;
    v *= 0.93;
  }
  return { vx: (dx / d) * v, vy: (dy / d) * v, vz, T: Tvol };
}
