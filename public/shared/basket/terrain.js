/**
 * DOUBLE PAS — le terrain, le hasard du match et quelques outils communs au
 * moteur (match.js) et à l'ordinateur (ia.js).
 *
 * Les distances sont en mètres, le temps en images (60 par seconde).
 *   x : la longueur (de -14 à 14), un panier à chaque bout ;
 *   y : la largeur (de -7,5 à 7,5), +y vers le fond de l'écran ;
 *   z : la hauteur (celle du centre du ballon).
 * Un terrain entier de basket ; le ballon ne sort pas : il rebondit sur les lignes
 * (version arcade : pas de touche, pas de faute, pas de lancer franc).
 *
 * Déterministe, comme le foot : additions, multiplications, divisions et
 * racines carrées seulement (exactes partout), jamais de sinus ni de Math.random.
 */

export const FPS = 60;
export const DT = 1 / FPS;
export const G = 9.81;

export const DEMI_L = 14;
export const DEMI_W = 7.5;
/** Le centre de l'arceau : à 1,575 m de la ligne de fond, à 3,05 m de haut. */
export const PANIER_X = 12.425;
export const ANNEAU_Z = 3.05;
export const ANNEAU_R = 0.225;
/** La planche : à 1,2 m de la ligne de fond, 1,8 m de large, de 2,9 à 3,95 m. */
export const PLANCHE_X = 12.8;
export const PLANCHE_DL = 0.9;
export const PLANCHE_BAS = 2.9;
export const PLANCHE_HAUT = 3.95;
export const BALLE_R = 0.12;
/** La ligne à trois points : un arc de 6,75 m, droite dans les coins (à 6,6 m de l'axe). */
export const TROIS_R = 6.75;
export const TROIS_COIN = 6.6;
export const JOUEUR_R = 0.38;

/** Le tir : on saute en appuyant, le bon moment pour lâcher est en haut du saut. */
export const CHARGE_IDEALE = 24;
export const CHARGE_MAX = 46;
/** Assez près du panier pour un dunk (ou un double pas). */
export const PORTEE_DUNK = 2.5;

/** Les touches : les mêmes bits que le foot (commun/saisie.js), plus R : la passe à rebond. */
export const T = { g: 1, d: 2, h: 4, b: 8, S: 16, A: 32, B: 64, X: 128, G: 256, R: 512 };

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

/** La distance d'un point au segment [a, b], et où il tombe dessus (0 en a, 1 en b). */
export function distSegment(px, py, ax, ay, bx, by) {
  const ux = bx - ax, uy = by - ay;
  const l2 = ux * ux + uy * uy;
  let t = l2 > 1e-9 ? ((px - ax) * ux + (py - ay) * uy) / l2 : 0;
  t = clamp(t, 0, 1);
  return { d: dist(px, py, ax + ux * t, ay + uy * t), t };
}

/** Le panier qu'attaque l'équipe e (son x ; y vaut 0). */
export const panierX = (m, e) => m.equipes[e].sens * PANIER_X;

/** Un tir pris en (x, y) vers le panier en hx vaut-il trois points ? */
export function estTrois(x, y, hx) {
  if (Math.abs(y) >= TROIS_COIN) return true;
  return dist(x, y, hx, 0) > TROIS_R;
}

/** La vitesse de course d'un joueur (m/s), sans sprint. */
export const vitesseMax = (p) => 4.6 + (p.n.vitesse - 50) * 0.04;

/** La hauteur où il attrape le ballon (bras levés), selon son saut en cours. */
export const allonge = (p) => 2.45 + p.z;

/** La vitesse verticale d'un saut (pour contrer, prendre un rebond). */
export const elan = (p) => 3.3 + (p.n.saut - 50) * 0.03;

/**
 * L'imprécision d'un tir (l'écart type, en mètres, autour du centre de l'arceau) :
 * la distance, l'adresse du tireur, le moment où il lâche (q : 1 parfait, 0 raté),
 * sa fatigue et les défenseurs qui le gênent.
 */
export function ecartTir(m, p, x = p.x, y = p.y, q = 1, gene = true) {
  const d = dist(x, y, panierX(m, p.e), 0);
  let s = (0.018 + 0.0105 * d + (d < 4 ? (4 - d) * 0.008 : 0) + (d > 7 ? (d - 7) * (d - 7) * 0.006 : 0)) * (1.5 - p.n.tir * 0.0085);
  s *= 1 + 0.5 * (1 - q) + 1.8 * (1 - q) * (1 - q);
  s *= 1 + (1 - p.endu) * 0.4;
  if (gene) for (let k = 0; k < 3; k++) {
    const o = m.joueurs[(1 - p.e) * 3 + k];
    const dd = dist(o.x, o.y, x, y);
    if (dd < 2.2) { const c = (2.2 - dd) / 2.2; s *= 1 + c * 0.45 + (o.z > 0.2 ? c * 0.4 : 0); }
  }
  return s;
}
/** La chance (à peu près) qu'un tir de cet écart rentre : 1 − e^(−u), sans exponentielle (le même calcul partout). */
export function chanceDe(s, d = 6) {
  const u = (0.0135 * (1 + (d < 5 ? (5 - d) * 0.12 : 0))) / (2 * s * s);
  return 1 - 1 / (1 + u + u * u / 2 + u * u * u / 6);
}

/**
 * Où passe un ballon libre dans les secondes qui viennent (approché, sans les
 * rebonds sur l'arceau) : pour que l'ordinateur sache où aller le chercher.
 */
export function trajectoire(b, n = 12, pasT = 0.1) {
  let { x, y, z, vx, vy, vz } = b;
  const pts = [];
  for (let k = 1; k <= n; k++) {
    x += vx * pasT; y += vy * pasT; z += vz * pasT - 0.5 * G * pasT * pasT; vz -= G * pasT;
    if (z < BALLE_R) { z = BALLE_R; vz = -vz * 0.7; vx *= 0.85; vy *= 0.85; }
    if (Math.abs(y) > DEMI_W) { y = clamp(y, -DEMI_W, DEMI_W); vy = -vy * 0.6; }
    if (Math.abs(x) > DEMI_L) { x = clamp(x, -DEMI_L, DEMI_L); vx = -vx * 0.6; }
    pts.push({ t: k * pasT, x, y, z });
  }
  return pts;
}
