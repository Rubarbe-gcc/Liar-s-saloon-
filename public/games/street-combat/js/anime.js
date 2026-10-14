/**
 * STREET COMBAT — le kit d'effets « anime » (cel).
 *
 * Les effets ont le même style que les combattants : des formes nettes en
 * couches (un liseré sombre, la couleur, un ton clair, un cœur blanc), pas
 * de dégradé flou ; un peu de lueur seulement dessous, pour qu'elles
 * brillent dans l'arène. Flammes en langues, éclairs anguleux, cristaux à
 * facettes, fumée en boules cernées, étoiles d'impact, rayons à bandes.
 *
 * Tout est déterministe (une « graine » au lieu du hasard) : un ultime se
 * rejoue à l'identique en ligne et dans les replays.
 */

import { rgba, teinte } from './dessin.js';

const TAU = Math.PI * 2;
/** En qualité basse (menu « Graphismes »), on se passe des lueurs : c'est ce qui coûte le plus. */
const SOBRE = (() => { try { return JSON.parse(localStorage.getItem('street.graphismes')) === 'basse'; } catch { return false; } })();
export const hasard = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
export const lisse = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
export const entre = (u, a, b) => lisse((u - a) / (b - a));

/* ------------------------------------------------------------------ */
/* Les palettes                                                        */
/* ------------------------------------------------------------------ */

/** Une palette tirée d'une couleur : encre, foncé, base, clair, cœur. */
export function palette(c) {
  return { encre: teinte(c, -0.72), fonce: teinte(c, -0.3), base: c, clair: teinte(c, 0.5), coeur: '#ffffff' };
}
export const FEU = { encre: '#3a0600', fonce: '#c81e08', base: '#ff6410', clair: '#ffc030', coeur: '#fff8d8' };
export const GLACE = { encre: '#0a1e4a', fonce: '#2a70d0', base: '#62c0ff', clair: '#c4f0ff', coeur: '#ffffff' };
export const FOUDRE = { encre: '#24104a', fonce: '#c8920a', base: '#ffd23f', clair: '#fff4a0', coeur: '#ffffff' };
export const FUMEE = { encre: '#1e1820', fonce: '#4a4250', base: '#6c6474', clair: '#9a92a0', coeur: '#c8c0cc' };
export const ROCHE = { encre: '#1e1208', fonce: '#4a3220', base: '#7a5838', clair: '#a8845a', coeur: '#d8b888' };

/** Un peu de lueur sous un effet (le seul flou permis). */
export function lueur(g, x, y, r, c, a = 0.5) {
  if (SOBRE || r <= 0 || a <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(c, a)); gr.addColorStop(0.45, rgba(c, a * 0.35)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.restore();
}

/**
 * Une forme en couches : `forme(s, i)` trace le chemin à l'échelle s (1 = le
 * contour) ; on remplit le liseré, la couleur, le clair, le cœur.
 */
export function couches(g, forme, P, echelles = [1, 0.86, 0.6, 0.34], a = 1) {
  const cols = [P.encre, P.base, P.clair, P.coeur];
  g.save();
  g.globalAlpha *= a;
  for (let i = 0; i < 4; i++) {
    if (echelles[i] <= 0) continue;
    g.fillStyle = cols[i];
    g.beginPath(); forme(echelles[i], i); g.fill();
  }
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Les formes                                                          */
/* ------------------------------------------------------------------ */

/** Une langue de flamme, sa base en (x, y), qui monte de h (tourner le canevas pour l'orienter). */
export function flamme(g, x, y, h, w, t, P = FEU, graine = 0, a = 1) {
  const sway = Math.sin(t / 3 + graine * 1.7) * w * 0.32;
  const forme = (s) => {
    const hh = h * (0.3 + 0.7 * s), ww = w * s, by = y - (1 - s) * w * 0.28;
    const tx = x + sway * s, ty = by - hh;
    const ond = Math.sin(t / 2 + graine) * ww * 0.16;
    g.moveTo(x - ww / 2, by);
    g.bezierCurveTo(x - ww * 0.62, by - hh * 0.45, tx - ww * 0.18 + ond, ty + hh * 0.38, tx, ty);
    g.bezierCurveTo(tx + ww * 0.26 - ond, ty + hh * 0.42, x + ww * 0.62, by - hh * 0.42, x + ww / 2, by);
    g.quadraticCurveTo(x, by + ww * 0.42, x - ww / 2, by);
  };
  couches(g, forme, P, [1, 0.84, 0.58, 0.3], a);
}

/** Un bouquet de flammes (un feu, un pilier). */
export function brasier(g, x, y, largeur, hauteur, t, P = FEU, graine = 0, a = 1, n = 7) {
  lueur(g, x, y - hauteur * 0.35, Math.max(largeur, hauteur) * 0.8, P.base, 0.45 * a);
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0.5 : i / (n - 1);
    const h = hauteur * (0.45 + 0.55 * Math.sin(Math.PI * f)) * (0.8 + 0.25 * Math.sin(t / 4 + i * 2.1 + graine));
    flamme(g, x + (f - 0.5) * largeur, y, h, largeur / n * 1.9, t, P, graine + i * 3.1, a);
  }
}

/** Une boule d'énergie : un bord en pointes qui tourne, un cœur blanc, deux anneaux. */
export function orbe(g, x, y, r, t, P, a = 1) {
  lueur(g, x, y, r * 2.6, P.base, 0.5 * a);
  const pointes = (s, i) => {
    const n = 14, rr = r * s;
    if (i >= 2) { g.arc(x, y, rr * 0.92, 0, TAU); return; }
    for (let k = 0; k <= n * 2; k++) {
      const an = (k / (n * 2)) * TAU + t / (i ? 7 : -9);
      const rk = rr * (k % 2 ? 0.86 : 1.08 + 0.06 * Math.sin(t + k));
      if (k) g.lineTo(x + Math.cos(an) * rk, y + Math.sin(an) * rk); else g.moveTo(x + Math.cos(an) * rk, y + Math.sin(an) * rk);
    }
    g.closePath();
  };
  couches(g, pointes, P, [1.32, 1.12, 0.78, 0.48], a);
  g.save();
  g.globalAlpha *= a * 0.85;
  g.strokeStyle = P.coeur; g.lineWidth = Math.max(1.5, r * 0.08);
  for (let i = 0; i < 2; i++) { g.beginPath(); g.ellipse(x, y, r * 0.95, r * 0.34, t / 5 + i * 1.7, 0.3, 2.6); g.stroke(); }
  g.restore();
}

/** Un nuage bosselé (fumée, explosion) : chemin à l'échelle s. */
function bosses(g, x, y, r, graine, n = 9) {
  for (let k = 0; k <= n; k++) {
    const an = (k / n) * TAU;
    const rk = r * (0.82 + 0.3 * hasard(graine + (k % n)));
    const px = x + Math.cos(an) * rk, py = y + Math.sin(an) * rk;
    if (!k) { g.moveTo(px, py); continue; }
    const am = ((k - 0.5) / n) * TAU;
    const rm = r * (1.08 + 0.2 * hasard(graine + k * 7));
    g.quadraticCurveTo(x + Math.cos(am) * rm, y + Math.sin(am) * rm, px, py);
  }
  g.closePath();
}

/** Une explosion (p de 0 à 1) : des boules de feu qui gonflent, puis de la fumée cernée qui monte. */
export function explosion(g, x, y, R, p, P = FEU, graine = 0) {
  if (p <= 0 || p >= 1) return;
  // La fumée (après le feu).
  const pf = entre(p, 0.25, 1);
  if (pf > 0) {
    for (let i = 0; i < 7; i++) {
      const an = hasard(graine + i) * TAU;
      const d = R * (0.3 + 0.6 * hasard(graine + i * 3)) * (0.6 + pf * 0.6);
      const rr = R * (0.28 + 0.16 * hasard(graine + i * 5)) * (0.7 + pf * 0.7);
      couches(g, (s) => bosses(g, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.7 - pf * R * 0.6, rr * s, graine + i), FUMEE, [1, 0.88, 0.55, 0], 0.85 * (1 - pf));
    }
  }
  // Le feu.
  const pb = entre(p, 0, 0.18) * (1 - entre(p, 0.35, 0.75));
  if (pb > 0) {
    lueur(g, x, y, R * 1.8, P.clair, 0.7 * pb);
    for (let i = 0; i < 6; i++) {
      const an = hasard(graine + i + 40) * TAU;
      const d = R * 0.45 * hasard(graine + i * 9) * (0.5 + p);
      const rr = R * (0.42 + 0.22 * hasard(graine + i * 2)) * (0.4 + entre(p, 0, 0.3) * 0.8);
      const coeur = 1 - entre(p, 0.1, 0.5);
      couches(g, (s) => bosses(g, x + Math.cos(an) * d, y + Math.sin(an) * d * 0.8 - p * R * 0.3, rr * s, graine + i * 11), P, [1, 0.86, 0.6, 0.36 * coeur], pb);
    }
  }
}

/** Une onde de choc : un anneau épais, net, qui s'affine en grandissant (au sol si `plat`). */
export function onde(g, x, y, r, ep, P, a = 1, plat = 0) {
  if (a <= 0 || ep <= 0) return;
  g.save();
  g.globalAlpha *= a;
  const ry = plat ? r * plat : r;
  for (const [c, w] of [[P.encre, ep + 4], [P.base, ep], [P.coeur, ep * 0.4]]) {
    g.strokeStyle = c; g.lineWidth = w;
    g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, TAU); g.stroke();
  }
  g.restore();
}

/** Une étoile d'impact (les coups qui touchent) : des pointes longues et courtes, en couches. */
export function etoileImpact(g, x, y, r, rot, P, a = 1, n = 10) {
  const forme = (s) => {
    for (let k = 0; k <= n * 2; k++) {
      const an = rot + (k / (n * 2)) * TAU;
      const rk = k % 2 ? r * 0.34 * s : r * s * (k % 4 === 0 ? 1 : 0.62);
      if (k) g.lineTo(x + Math.cos(an) * rk, y + Math.sin(an) * rk); else g.moveTo(x + Math.cos(an) * rk, y + Math.sin(an) * rk);
    }
    g.closePath();
  };
  lueur(g, x, y, r * 1.4, P.base, 0.45 * a);
  couches(g, forme, P, [1.12, 1, 0.72, 0.44], a);
}

/** Un éclair anguleux et épais (liseré, couleur, cœur blanc), avec des fourches. */
export function foudre(g, x0, y0, x1, y1, ep, P, graine = 0, fourches = 2, a = 1) {
  const n = 9;
  const pts = [[x0, y0]];
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l, ny = dx / l;
  for (let i = 1; i < n; i++) {
    const f = i / n, dev = (hasard(graine + i) - 0.5) * l * 0.16;
    pts.push([x0 + dx * f + nx * dev, y0 + dy * f + ny * dev]);
  }
  pts.push([x1, y1]);
  const trait = (liste, w) => {
    for (const [c, ww] of [[P.encre, w + 5], [P.base, w + 1.5], [P.coeur, w * 0.45]]) {
      g.strokeStyle = c; g.lineWidth = ww; g.lineJoin = 'miter'; g.lineCap = 'round';
      g.beginPath(); liste.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    }
  };
  g.save();
  g.globalAlpha *= a;
  lueur(g, (x0 + x1) / 2, (y0 + y1) / 2, l * 0.5, P.base, 0.3 * a);
  trait(pts, ep);
  for (let b = 0; b < fourches; b++) {
    const i = 2 + Math.floor(hasard(graine + b * 17) * (n - 4));
    const [bx, by] = pts[i];
    const an = Math.atan2(dy, dx) + (hasard(graine + b * 5) - 0.5) * 1.6;
    const bl = l * (0.18 + 0.14 * hasard(graine + b * 3));
    trait([[bx, by], [bx + Math.cos(an) * bl * 0.5 + nx * 8, by + Math.sin(an) * bl * 0.5 + ny * 8], [bx + Math.cos(an) * bl, by + Math.sin(an) * bl]], ep * 0.5);
  }
  g.restore();
}

/** Un cristal de glace à facettes, sa base en (x, y), dressé selon l'angle `an` (0 : vers le haut). */
export function cristal(g, x, y, h, w, an, P = GLACE, a = 1) {
  if (h <= 0.5) return;
  g.save();
  g.globalAlpha *= a;
  g.translate(x, y); g.rotate(an);
  const pointe = [0, -h], gauche = [-w / 2, 0], droite = [w / 2, 0], arete = [w * 0.08, -h * 0.25];
  g.fillStyle = P.base;
  g.beginPath(); g.moveTo(...gauche); g.lineTo(...pointe); g.lineTo(...arete); g.lineTo(w * 0.05, 0); g.closePath(); g.fill();
  g.fillStyle = P.clair;
  g.beginPath(); g.moveTo(w * 0.05, 0); g.lineTo(...arete); g.lineTo(...pointe); g.lineTo(...droite); g.closePath(); g.fill();
  g.strokeStyle = P.coeur; g.lineWidth = Math.max(1, w * 0.06);
  g.beginPath(); g.moveTo(...arete); g.lineTo(...pointe); g.stroke();
  g.strokeStyle = P.encre; g.lineWidth = Math.max(1.5, w * 0.08); g.lineJoin = 'miter';
  g.beginPath(); g.moveTo(...gauche); g.lineTo(...pointe); g.lineTo(...droite); g.closePath(); g.stroke();
  g.restore();
}

/** Un rayon à bandes (le long de +x depuis l'origine) : liseré, couleur, clair, cœur, des anneaux qui filent. */
export function rayon(g, long, ep, t, P, a = 1) {
  if (long <= 0 || ep <= 0) return;
  g.save();
  g.globalAlpha *= a;
  lueur(g, long * 0.5, 0, Math.max(long * 0.55, ep * 2), P.base, 0.35);
  const bande = (s) => {
    const e = ep * s;
    g.moveTo(0, -e * 0.6);
    for (let x = 0; x <= long; x += 12) g.lineTo(x, -e * (1 + 0.07 * Math.sin(x / 18 - t / 1.5)) * Math.min(1, 0.6 + x / 60));
    g.arc(long, 0, e, -Math.PI / 2, Math.PI / 2);
    for (let x = long; x >= 0; x -= 12) g.lineTo(x, e * (1 + 0.07 * Math.sin(x / 18 - t / 1.5 + 2)) * Math.min(1, 0.6 + x / 60));
    g.lineTo(0, e * 0.6);
    g.closePath();
  };
  couches(g, bande, P, [1.25, 1, 0.66, 0.32]);
  g.strokeStyle = P.coeur; g.lineWidth = 2.5;
  for (let i = 0; i < Math.floor(long / 70); i++) {
    const x = (t * 9 + i * 70) % long;
    g.beginPath(); g.ellipse(x, 0, ep * 0.22, ep * 1.05, 0, 0, TAU); g.stroke();
  }
  g.restore();
}

/** Un croissant tranchant (une lame d'énergie, un coup de vent), orienté vers +x. */
export function croissant(g, x, y, R, P, a = 1, epais = 0.42) {
  const forme = (s) => {
    const r = R * s;
    g.arc(x, y, r, -1.25, 1.25);
    g.arc(x - r * epais, y, r * 0.92, 1.15, -1.15, true);
    g.closePath();
  };
  lueur(g, x, y, R * 1.5, P.base, 0.4 * a);
  couches(g, forme, P, [1.08, 1, 0.9, 0.82], a);
}

/** Une boule de fumée cernée (poussière, vapeur). */
export function fumee(g, x, y, r, P = FUMEE, a = 1, graine = 0) {
  couches(g, (s) => bosses(g, x, y, r * s, graine, 7), P, [1, 0.86, 0.52, 0], a);
}

/** Un éclat de roche ou de glace (un débris), tourné. */
export function eclat(g, x, y, r, rot, P, a = 1) {
  g.save();
  g.globalAlpha *= a;
  g.translate(x, y); g.rotate(rot);
  g.fillStyle = P.base;
  g.beginPath(); g.moveTo(-r, -r * 0.3); g.lineTo(-r * 0.1, -r); g.lineTo(r, -r * 0.1); g.lineTo(r * 0.3, r * 0.8); g.lineTo(-r * 0.7, r * 0.6); g.closePath(); g.fill();
  g.fillStyle = P.clair;
  g.beginPath(); g.moveTo(-r * 0.1, -r); g.lineTo(r, -r * 0.1); g.lineTo(0, 0); g.closePath(); g.fill();
  g.strokeStyle = P.encre; g.lineWidth = Math.max(1.2, r * 0.18);
  g.beginPath(); g.moveTo(-r, -r * 0.3); g.lineTo(-r * 0.1, -r); g.lineTo(r, -r * 0.1); g.lineTo(r * 0.3, r * 0.8); g.lineTo(-r * 0.7, r * 0.6); g.closePath(); g.stroke();
  g.restore();
}

/** Une étincelle en losange, étirée dans le sens de sa course. */
export function losange(g, x, y, vx, vy, r, P, a = 1) {
  const v = Math.hypot(vx, vy) || 1;
  const l = r * 2 + v * 2.2;
  g.save();
  g.globalAlpha *= a;
  g.translate(x, y); g.rotate(Math.atan2(vy, vx));
  g.fillStyle = P.base;
  g.beginPath(); g.moveTo(r * 1.2, 0); g.lineTo(0, -r * 0.9); g.lineTo(-l, 0); g.lineTo(0, r * 0.9); g.closePath(); g.fill();
  g.fillStyle = P.coeur;
  g.beginPath(); g.moveTo(r * 0.8, 0); g.lineTo(0, -r * 0.4); g.lineTo(-l * 0.5, 0); g.lineTo(0, r * 0.4); g.closePath(); g.fill();
  g.restore();
}

/** Un sillage en arc (« smear ») : le tracé d'un coup très rapide. */
export function smear(g, x, y, r, a0, a1, ep, P, a = 1) {
  g.save();
  g.globalAlpha *= a;
  const sens = a1 > a0;
  const forme = (s) => {
    g.arc(x, y, r + ep * s * 0.5, a0, a1, !sens);
    g.arc(x, y, r - ep * s * 0.5, a1, a0, sens);
    g.closePath();
  };
  couches(g, forme, P, [1.2, 1, 0.55, 0.22]);
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Des palettes d'éléments, et quelques formes de plus                  */
/* ------------------------------------------------------------------ */

export const NUAGE = { encre: '#0a0816', fonce: '#26243c', base: '#383654', clair: '#545274', coeur: '#706e92' };
export const POISON = { encre: '#082a0c', fonce: '#1e8a2a', base: '#3cdc4a', clair: '#a8ff7a', coeur: '#eaffd0' };
export const VIDE = { encre: '#08000e', fonce: '#3a0a5a', base: '#8a28d8', clair: '#d07aff', coeur: '#ffe8ff' };
export const OMBRE = { encre: '#000000', fonce: '#120a1e', base: '#2a1640', clair: '#5a3a8a', coeur: '#b48aff' };
export const LUNE = { encre: '#1a2240', fonce: '#7a8ab8', base: '#c8d4f0', clair: '#eef4ff', coeur: '#ffffff' };
export const OR = { encre: '#3a2400', fonce: '#b8820a', base: '#ffc832', clair: '#fff0a0', coeur: '#ffffff' };
export const EAU = { encre: '#021e3a', fonce: '#0a62a8', base: '#1ea8e8', clair: '#8ae4ff', coeur: '#ffffff' };
export const SABLE = { encre: '#3a2408', fonce: '#a8742a', base: '#e0b062', clair: '#f8dca0', coeur: '#fff8e0' };
export const ENFER = { encre: '#1a0000', fonce: '#6a0008', base: '#c8101a', clair: '#ff5a2a', coeur: '#ffd0a0' };
export const DRAGON = { encre: '#2a0400', fonce: '#7a1206', base: '#b8240c', clair: '#e8602a', coeur: '#ffc070' };
export const VENT = { encre: '#1a3a48', fonce: '#6aa8c0', base: '#bfe8f6', clair: '#e8faff', coeur: '#ffffff' };
export const MIROIR = { encre: '#1a2050', fonce: '#6a7ab8', base: '#b8c8f0', clair: '#e8f0ff', coeur: '#ffffff' };

/** Une lune (ou une planète) : un disque en couches et ses cratères. */
export function lune(g, x, y, r, P = LUNE, a = 1) {
  lueur(g, x, y, r * 2, P.clair, 0.45 * a);
  couches(g, (s) => g.arc(x, y, r * s, 0, TAU), P, [1.04, 1, 0.82, 0], a);
  g.save();
  g.globalAlpha *= a;
  g.fillStyle = P.fonce;
  for (const [cx, cy, cr] of [[-0.3, -0.25, 0.18], [0.25, 0.2, 0.14], [0.05, -0.45, 0.09], [-0.4, 0.3, 0.1]]) { g.beginPath(); g.arc(x + cx * r, y + cy * r, cr * r, 0, TAU); g.fill(); }
  g.restore();
}

/** Un soleil : un disque à rayons en pointes, qui tourne lentement. */
export function soleil(g, x, y, r, t, P = OR, a = 1, n = 16) {
  lueur(g, x, y, r * 3, P.base, 0.55 * a);
  const rayons = (s, i) => {
    if (i >= 2) { g.arc(x, y, r * s, 0, TAU); return; }
    for (let k = 0; k <= n * 2; k++) {
      const an = (k / (n * 2)) * TAU + t / 40;
      const rk = r * s * (k % 2 ? 1.0 : 1.45 + 0.1 * Math.sin(t / 3 + k));
      if (k) g.lineTo(x + Math.cos(an) * rk, y + Math.sin(an) * rk); else g.moveTo(x + Math.cos(an) * rk, y + Math.sin(an) * rk);
    }
    g.closePath();
  };
  couches(g, rayons, P, [1.08, 1, 0.92, 0.6], a);
}

/** Une lance (une flèche, un pieu) : la hampe, la pointe, un liseré. Orientée selon `an` (0 : vers +x). */
export function lance(g, x, y, an, l, P, a = 1, hampe = '#e8d8b0') {
  g.save();
  g.globalAlpha *= a;
  g.translate(x, y); g.rotate(an);
  g.strokeStyle = '#1a1208'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-l, 0); g.lineTo(0, 0); g.stroke();
  g.strokeStyle = hampe; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-l, 0); g.lineTo(0, 0); g.stroke();
  couches(g, (s) => { g.moveTo(18 * s, 0); g.lineTo(-6 * s, -7 * s); g.lineTo(-2 * s, 0); g.lineTo(-6 * s, 7 * s); g.closePath(); }, P, [1.25, 1, 0.6, 0.3]);
  g.restore();
}

/** Un serpent (ou un dragon) : des anneaux le long d'une suite de points, la tête au premier. */
export function corpsSerpent(g, pts, rTete, P, a = 1) {
  g.save();
  g.globalAlpha *= a;
  for (let i = pts.length - 1; i >= 0; i--) {
    const [x, y] = pts[i];
    const r = rTete * (0.45 + 0.55 * (1 - i / pts.length));
    g.fillStyle = P.encre; g.beginPath(); g.arc(x, y, r + 2.5, 0, TAU); g.fill();
    g.fillStyle = i % 3 ? P.base : P.fonce; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = P.clair; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.42, 0, TAU); g.fill();
  }
  g.restore();
}

/** Une tête de serpent (ou de dragon) tournée vers `an`, la gueule ouverte de `ouvre` (0 à 1). */
export function teteSerpent(g, x, y, r, an, ouvre, P, oeil = '#ffde3a', a = 1, cornes = false) {
  g.save();
  g.globalAlpha *= a;
  g.translate(x, y); g.rotate(an);
  const machoire = ouvre * 0.6;
  // La mâchoire du bas, puis le crâne.
  for (const [sens, ang] of [[1, machoire], [-1, -machoire * 0.4]]) {
    g.save(); g.rotate(ang);
    couches(g, (s) => { g.moveTo(-r * 0.6 * s, 0); g.quadraticCurveTo(-r * 0.2, sens * r * 0.8 * s, r * 1.6 * s, sens * r * 0.12); g.lineTo(r * 1.6 * s, 0); g.closePath(); }, P, [1.15, 1, 0.7, 0]);
    // Les crocs.
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) { const fx = r * (0.5 + i * 0.28); g.beginPath(); g.moveTo(fx, sens * r * 0.08); g.lineTo(fx + r * 0.08, sens * -r * 0.18); g.lineTo(fx + r * 0.16, sens * r * 0.08); g.fill(); }
    g.restore();
  }
  if (cornes) for (const c of [-1, 1]) cristal(g, -r * 0.2, -r * 0.5, r * 1.1, r * 0.3, -1.2 + c * 0.25, ROCHE);
  g.fillStyle = '#1a0a00'; g.beginPath(); g.ellipse(r * 0.55, -r * 0.42, r * 0.22, r * 0.14, 0.2, 0, TAU); g.fill();
  g.fillStyle = oeil; g.beginPath(); g.ellipse(r * 0.55, -r * 0.42, r * 0.17, r * 0.1, 0.2, 0, TAU); g.fill();
  g.fillStyle = '#000'; g.fillRect(r * 0.53, -r * 0.5, r * 0.04, r * 0.16);
  g.restore();
}

/** Une silhouette debout (un soldat, un spectateur), en ombre chinoise cernée. */
export function silhouette(g, x, y, h, c = '#120c08', a = 1) {
  g.save();
  g.globalAlpha *= a;
  g.fillStyle = c;
  g.beginPath(); g.arc(x, y - h * 0.86, h * 0.12, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x - h * 0.17, y - h * 0.72); g.lineTo(x + h * 0.17, y - h * 0.72); g.lineTo(x + h * 0.13, y - h * 0.3); g.lineTo(x + h * 0.1, y); g.lineTo(x - h * 0.1, y); g.lineTo(x - h * 0.13, y - h * 0.3); g.closePath(); g.fill();
  g.restore();
}

/** Une fente dans la réalité : une déchirure verticale aux bords lumineux, le vide étoilé dedans. */
export function faille(g, x, y, h, ouv, t, P = VIDE, graine = 0) {
  if (ouv <= 0) return;
  const bord = (s) => {
    const n = 10;
    for (let i = 0; i <= n; i++) { const f = i / n; const w = Math.sin(Math.PI * f) * ouv * s * (0.7 + 0.5 * hasard(graine + i)); g[i ? 'lineTo' : 'moveTo'](x - w + (hasard(graine + i * 3) - 0.5) * 10, y - h / 2 + h * f); }
    for (let i = n; i >= 0; i--) { const f = i / n; const w = Math.sin(Math.PI * f) * ouv * s * (0.7 + 0.5 * hasard(graine + i + 9)); g.lineTo(x + w + (hasard(graine + i * 5) - 0.5) * 10, y - h / 2 + h * f); }
    g.closePath();
  };
  lueur(g, x, y, h * 0.6, P.base, 0.5);
  couches(g, bord, { ...P, coeur: '#05000a' }, [1.3, 1.12, 1, 0.9]);
  g.save(); g.beginPath(); bord(0.9); g.clip();
  for (let i = 0; i < 14; i++) { g.fillStyle = i % 3 ? P.clair : '#ffffff'; g.fillRect(x + (hasard(graine + i) - 0.5) * ouv * 1.6, y - h / 2 + hasard(graine + i * 7) * h + (t % 40), 2, 2); }
  g.restore();
}
