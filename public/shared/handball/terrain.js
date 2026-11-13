/**
 * ROUCOULETTE — le terrain, le hasard du match et quelques outils communs au
 * moteur (match.js) et à l'ordinateur (ia.js).
 *
 * Les distances sont en mètres, le temps en images (60 par seconde).
 *   x : la longueur (de -20 à 20), un but à chaque bout ;
 *   y : la largeur (de -10 à 10), +y vers le fond de l'écran ;
 *   z : la hauteur (celle du centre du ballon).
 * Un terrain de handball : 40 × 20 m, des buts de 3 m sur 2, la zone des 6 m
 * (seul le gardien y pose le pied ; on peut y voler, en suspension) et la
 * ligne des 9 m. Version arcade : le ballon rebondit sur les lignes de côté,
 * pas de faute ni de jet de 7 m ; un ballon qui sort derrière le but revient
 * au gardien.
 *
 * Déterministe, comme le foot et le basket : additions, multiplications,
 * divisions et racines carrées seulement, jamais de sinus ni de Math.random.
 */

export const FPS = 60;
export const DT = 1 / FPS;
export const G = 9.81;

export const DEMI_L = 20;
export const DEMI_W = 10;
/** La moitié de la largeur du but, sa hauteur, la profondeur du filet. */
export const DEMI_BUT = 1.5;
export const BUT_H = 2;
export const BUT_P = 0.9;
/** La zone (6 m autour du but) et la ligne des 9 m. */
export const ZONE = 6;
export const NEUF = 9;
export const BALLE_R = 0.095;
export const JOUEUR_R = 0.36;

/** Le tir : on saute en appuyant, le bon moment pour lâcher est en haut du saut. */
export const CHARGE_IDEALE = 22;
export const CHARGE_MAX = 40;

/** Les touches : les mêmes bits que le basket (dix bits, R : la passe à terre). */
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

/** Le but qu'attaque l'équipe e (son x ; il va de y = -1,5 à 1,5). */
export const butX = (m, e) => m.equipes[e].sens * DEMI_L;

/** La distance de (x, y) au but en gx (au segment entre les poteaux) : la zone, c'est moins de 6 m. */
export function distBut(x, y, gx) {
  const ay = Math.abs(y) - DEMI_BUT;
  const dx = Math.abs(x - gx);
  return ay > 0 ? Math.sqrt(dx * dx + ay * ay) : dx;
}
/** Le point le plus proche sur le but en gx. */
export const pointBut = (y, gx) => ({ x: gx, y: clamp(y, -DEMI_BUT, DEMI_BUT) });

/** (x, y) est-il dans une zone ? Rend le x du but de cette zone, ou 0. */
export function zoneDe(x, y, marge = 0) {
  for (const gx of [-DEMI_L, DEMI_L]) if (distBut(x, y, gx) < ZONE + marge && Math.abs(x) <= DEMI_L) return gx;
  return 0;
}
/** Le point hors de la zone du but gx le plus proche de (x, y) (à `r` du but). */
export function sortirZone(x, y, gx, r = ZONE + 0.02) {
  const p = pointBut(y, gx);
  let dx = x - p.x, dy = y - p.y;
  let d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) { dx = -Math.sign(gx); dy = 0; d = 1; }
  return { x: p.x + (dx / d) * r, y: p.y + (dy / d) * r };
}

/** La vitesse de course d'un joueur (m/s), sans sprint. */
export const vitesseMax = (p) => 4.9 + (p.n.vitesse - 50) * 0.035;
/** La hauteur où il attrape le ballon (bras levés), selon son saut en cours. */
export const allonge = (p) => 2.3 + p.z;
/** La vitesse verticale d'un saut (tir en suspension, contre). */
export const elan = (p) => 3.2 + (p.n.saut - 50) * 0.025;

/**
 * La chance qu'un tir pris en (x, y) finisse au fond (à peu près : de quoi
 * décider pour l'ordinateur, et la base des arrêts du gardien dans le
 * moteur). q : la qualité du lâcher (1 parfait) ; gene : compter les
 * défenseurs devant.
 *   Les éléments : la distance (de près, le gardien n'a pas le temps ; de
 *   loin, il voit venir), l'angle (des ailes, le but se ferme), le tireur,
 *   le gardien, et les bras des défenseurs entre le tireur et le but.
 */
export function chanceBut(m, p, x = p.x, y = p.y, q = 1, gene = true) {
  const gx = butX(m, p.e);
  const d = distBut(x, y, gx);
  const g = m.joueurs[(1 - p.e) * 7];
  const gard = g && !g.absent ? g.n.gardien : 20;
  // Le but « vu » depuis le tireur : de face, 3 m ; de l'aile, beaucoup moins.
  const dx = Math.abs(x - gx);
  const ouv = dx / Math.sqrt(dx * dx + y * y + 0.01);
  let c = 0.86 - (d - 6) * 0.045 - (d > 10 ? (d - 10) * (d - 10) * 0.012 : 0);
  c -= (1 - ouv) * 0.38;
  c += (p.n.tir - 70) * 0.006;
  c -= (gard - 70) * 0.0075;
  c *= 0.55 + 0.45 * q;
  c *= 0.85 + 0.15 * p.endu;
  if (gene) c *= 1 - blocage(m, p, x, y);
  return clamp(c, 0.02, 0.95);
}

/** La part des tirs pris en (x, y) qu'arrêtent les défenseurs devant le tireur (leurs bras). */
export function blocage(m, p, x = p.x, y = p.y) {
  const gx = butX(m, p.e);
  let b = 0;
  for (let k = 1; k < 7; k++) {
    const o = m.joueurs[(1 - p.e) * 7 + k];
    if (o.absent) continue;
    const { d, t } = distSegment(o.x, o.y, x, y, gx, clamp(y * 0.2, -1, 1));
    if (t < 0.02 || t > 0.85) continue;
    const pres = dist(o.x, o.y, x, y);
    if (d < 1 && pres < 3.2) b += (1 - d) * (1 - pres / 3.2) * (0.5 + (o.n.defense - 60) / 120 + o.z * 0.6);
  }
  return clamp(b, 0, 0.8);
}

/**
 * Où passe un ballon libre dans les secondes qui viennent (approché) : pour
 * que l'ordinateur sache où aller le chercher.
 */
export function trajectoire(b, n = 12, pasT = 0.1) {
  let { x, y, z, vx, vy, vz } = b;
  const pts = [];
  for (let k = 1; k <= n; k++) {
    x += vx * pasT; y += vy * pasT; z += vz * pasT - 0.5 * G * pasT * pasT; vz -= G * pasT;
    if (z < BALLE_R) { z = BALLE_R; vz = -vz * 0.55; vx *= 0.8; vy *= 0.8; }
    if (Math.abs(y) > DEMI_W) { y = clamp(y, -DEMI_W, DEMI_W); vy = -vy * 0.6; }
    if (Math.abs(x) > DEMI_L) { x = clamp(x, -DEMI_L, DEMI_L); vx = -vx * 0.5; }
    pts.push({ t: k * pasT, x, y, z });
  }
  return pts;
}
