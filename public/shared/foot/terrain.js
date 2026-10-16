/**
 * PETIT PONT — le terrain, le hasard du match et quelques outils communs au
 * moteur (match.js) et à l'ordinateur (ia.js).
 *
 * Les distances sont en mètres, le temps en images (60 par seconde).
 *   x : la longueur (de -20 à 20), les buts au bout ;
 *   y : la largeur (de -10 à 10), +y vers le fond de l'écran ;
 *   z : la hauteur.
 * Un terrain de futsal fermé par des bandes : le ballon ne sort jamais.
 *
 * Le moteur doit donner le même match sur tous les appareils (en ligne,
 * chacun le fait tourner) : ici, seulement des additions, multiplications,
 * divisions et racines carrées (exactes partout), jamais de sinus ni de
 * Math.random.
 */

export const FPS = 60;
export const DT = 1 / FPS;

export const DEMI_L = 20;
export const DEMI_W = 10;
/** La moitié de la largeur du but, sa hauteur, sa profondeur. */
export const DEMI_BUT = 1.5;
export const BUT_H = 2;
export const BUT_P = 1.2;
/** Le rayon de la surface du gardien (depuis le milieu de son but). */
export const SURFACE = 6;
export const BALLON_R = 0.11;
export const JOUEUR_R = 0.36;
/** La gravité (un peu forte : le jeu est vif). */
export const G = 13;
/** Une frappe chargée au maximum, en images. */
export const CHARGE_MAX = 48;

/** Les touches : un nombre de 8 bits (le même pour le clavier, la manette, le doigt et le réseau). */
export const T = { g: 1, d: 2, h: 4, b: 8, S: 16, A: 32, B: 64, X: 128 };

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

/** La vitesse de course d'un joueur (m/s), sans sprint. */
export const vitesseMax = (p) => 4.9 + (p.n.vitesse - 50) * 0.032;

/**
 * La trajectoire à venir d'un ballon libre (approchée : pour que l'ordinateur
 * sache où aller le chercher). `n` points, tous les `pasT` secondes.
 */
export function trajectoire(b, n = 16, pasT = 0.1) {
  let { x, y, z, vx, vy, vz } = b;
  const pts = [];
  const h = pasT / 3;
  for (let k = 1; k <= n; k++) {
    for (let s = 0; s < 3; s++) {
      if (z > 0 || vz > 0) { vz -= G * h; }
      else {
        const sp = Math.sqrt(vx * vx + vy * vy);
        if (sp > 0) { const f = Math.max(0, sp - (1.2 + 0.15 * sp) * h) / sp; vx *= f; vy *= f; }
      }
      x += vx * h; y += vy * h; z += vz * h;
      if (z < 0) { z = 0; vz = vz < -1.2 ? -vz * 0.5 : 0; }
      if (y > DEMI_W - BALLON_R) { y = 2 * (DEMI_W - BALLON_R) - y; vy = -vy * 0.7; }
      if (y < -DEMI_W + BALLON_R) { y = -2 * (DEMI_W - BALLON_R) - y; vy = -vy * 0.7; }
      if (Math.abs(x) > DEMI_L - BALLON_R && Math.abs(y) > DEMI_BUT) { const sx = x > 0 ? 1 : -1; x = sx * 2 * (DEMI_L - BALLON_R) - x; vx = -vx * 0.7; }
    }
    pts.push({ t: k * pasT, x, y, z });
  }
  return pts;
}
