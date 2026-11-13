/**
 * RAFFUT — le terrain, le hasard du match et quelques outils communs au
 * moteur (match.js) et à l'ordinateur (ia.js).
 *
 * Les distances sont en mètres, le temps en images (60 par seconde).
 *   x : la longueur ; les lignes d'essai en ±30, les lignes de ballon mort en ±35 ;
 *   y : la largeur (de -18 à 18), +y vers le fond de l'écran ;
 *   z : la hauteur (celle du centre du ballon).
 * Un terrain de rugby à 7 raccourci pour l’arcade (60 m sur 36, deux en-buts
 * de 5 m), des poteaux en H sur chaque ligne d'essai.
 *
 * Déterministe, comme le foot et le basket : additions, multiplications,
 * divisions et racines carrées seulement (exactes partout), jamais de sinus
 * ni de Math.random.
 */

export const FPS = 60;
export const DT = 1 / FPS;
export const G = 9.81;

/** La ligne d'essai (x = ±DEMI_L) et la ligne de ballon mort (x = ±MORT). */
export const DEMI_L = 30;
export const EN_BUT = 5;
export const MORT = DEMI_L + EN_BUT;
export const DEMI_W = 18;
/** La ligne des 22 (ici : à 11 m de la ligne d'essai) et celle des 10 m (du milieu). */
export const LIGNE_22 = 11;
/** Les poteaux : 5,6 m d'écart, la barre à 3 m, les montants jusqu'à 11 m. */
export const POTEAU_Y = 2.8;
export const BARRE_Z = 3;
export const POTEAU_H = 11;
export const BALLE_R = 0.14;
export const JOUEUR_R = 0.42;

/** Le nombre de joueurs par équipe, et leurs postes. */
export const N = 7;

/** Le coup de pied : on tient pour la force (le bon moment pour une transformation dépend de la distance). */
export const CHARGE_MAX = 54;
/** Assez près pour plaquer (le plongeon part de là). */
export const PORTEE_PLAQUAGE = 2.3;

/**
 * Les touches : les mêmes bits que le foot (commun/saisie.js), plus R : la passe sautée.
 *   A passe · B coup de pied (tenu : plus loin) / plaquage · X raffut / grattage · G changer · S sprint · R passe sautée.
 */
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

/** Le sens d'attaque de l'équipe e (+1 : vers x positif). */
export const sensDe = (m, e) => m.equipes[e].sens;
/** La ligne d'essai qu'attaque l'équipe e. */
export const ligneEssai = (m, e) => m.equipes[e].sens * DEMI_L;
/** Combien p a encore à courir jusqu'à l'essai (négatif : il est dans l'en-but). */
export const resteEssai = (m, p) => DEMI_L - m.equipes[p.e].sens * p.x;

/** La vitesse de course d'un joueur (m/s), sans sprint. */
export const vitesseMax = (p) => 5.2 + (p.n.vitesse - 50) * 0.045;

/** La hauteur où il attrape le ballon (bras levés). */
export const allonge = () => 2.35;

/**
 * Où passe un ballon libre dans les secondes qui viennent (approché) :
 * pour que l'ordinateur sache où aller le chercher.
 */
export function trajectoire(b, n = 24, pasT = 0.1) {
  let { x, y, z, vx, vy, vz } = b;
  const pts = [];
  for (let k = 1; k <= n; k++) {
    x += vx * pasT; y += vy * pasT; z += vz * pasT - 0.5 * G * pasT * pasT; vz -= G * pasT;
    if (z < BALLE_R) { z = BALLE_R; vz = -vz * 0.45; vx *= 0.7; vy *= 0.7; }
    pts.push({ t: k * pasT, x, y, z });
  }
  return pts;
}

/** Le point où un ballon en l'air redescend à hauteur d'homme (z ≈ 1,6 m), et quand. */
export function chute(b, h = 1.6) {
  const { x, y, z, vx, vy, vz } = b;
  // z(t) = z + vz t − g t²/2 = h  →  t = (vz + √(vz² + 2g(z − h))) / g
  const d = vz * vz + 2 * G * (z - h);
  if (d < 0) return { x, y, t: 0 };
  const t = Math.max(0, (vz + Math.sqrt(d)) / G);
  return { x: x + vx * t, y: y + vy * t, t };
}

/**
 * La vitesse à donner au ballon pour un coup de pied qui part de (x0, y0, z0)
 * et passe en (x1, y1) à la hauteur z1, avec une montée « pente » (vz / v horizontale).
 */
export function vitessePied(x0, y0, z0, x1, y1, z1, pente) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy) || 1;
  // d = vh t ; z1 = z0 + pente vh t − g t²/2  →  t² = 2 (z0 + pente d − z1) / g
  const t2 = (2 * (z0 + pente * d - z1)) / G;
  const t = Math.sqrt(Math.max(0.04, t2));
  const vh = d / t;
  return { vx: (dx / d) * vh, vy: (dy / d) * vh, vz: pente * vh, t };
}
