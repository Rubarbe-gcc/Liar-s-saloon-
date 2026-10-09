/**
 * STREET COMBAT — les tenues alternatives.
 *
 * Module ISO. Chaque combattant a trois tenues : l'originale, une
 * « alternative » (ses couleurs tournées sur le cercle des couleurs) et la
 * tenue « prestige » (noir et or ; noir et platine pour qui est déjà doré). On les gagne avec les défis de combos
 * de ce combattant. Une tenue est une fiche à part dans PERSO, sous l'id
 * « ryuken~1 », « ryuken~2 » : la même que l'originale, sauf les couleurs —
 * ainsi le moteur et tout le dessin la prennent sans rien changer. Son
 * `id` reste celui du combattant (« ryuken »).
 */

import { PERSO, PERSOS } from './persos.js';

/** Les tenues, et les étoiles (défis de combos réussis) qu'il faut pour les porter. */
export const TENUES = [
  { nom: 'Originale', etoiles: 0 },
  { nom: 'Alternative', etoiles: 2 },
  { nom: 'Prestige', etoiles: 5 },
];

export const idTenue = (id, k) => (k ? `${id}~${k}` : id);
export const baseDe = (id) => String(id || '').split('~')[0];
export const tenueDe = (id) => Number(String(id || '').split('~')[1] || 0);
/** Les tenues qu'on peut porter, avec ce nombre d'étoiles. */
export const tenuesOuvertes = (etoiles) => TENUES.map((t, k) => k).filter((k) => etoiles >= TENUES[k].etoiles);

/* ---- Les couleurs ---- */

function versHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function versHex([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Une couleur tournée sur le cercle des couleurs. */
export function tourner(hex, degres) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [h, s, l] = versHsl(hex);
  return versHex([(h + degres + 360) % 360, s, l]);
}

/** La tenue « prestige » : noir et or, quelle que soit la couleur d'origine. */
const PRESTIGE = { c1: '#ffd23f', c2: '#8a6400', faisceau: '#ffe680', aura: '#ffc800', ceinture: '#ffd23f', tenue: '#16120c' };
/** …et pour ceux qui sont déjà dorés : noir et platine. */
const PLATINE = { c1: '#e8eef8', c2: '#5a6478', faisceau: '#ffffff', aura: '#c0d8ff', ceinture: '#e8eef8', tenue: '#16120c' };
const dore = (hex) => { const [h, s] = versHsl(hex); return h >= 35 && h <= 62 && s > 0.5; };

/** Les couleurs d'une tenue (la peau ne change jamais). */
export function palette(c, k) {
  if (!k) return c;
  if (k === 2) return { ...c, ...(dore(c.c1) ? PLATINE : PRESTIGE), cheveux: c.cheveux };
  const t = {};
  for (const [cle, v] of Object.entries(c)) t[cle] = cle === 'peau' || cle === 'cheveux' ? v : tourner(v, 150);
  return t;
}

/** Inscrit les tenues de tous les combattants dans PERSO (une fois suffit). */
export function enregistrerTenues() {
  for (const p of PERSOS) {
    for (let k = 1; k < TENUES.length; k++) {
      const id = idTenue(p.id, k);
      if (!PERSO[id]) PERSO[id] = { ...p, c: palette(p.c, k), variante: k };
    }
  }
}
