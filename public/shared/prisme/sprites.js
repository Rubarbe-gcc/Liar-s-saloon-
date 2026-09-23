/**
 * PRISME — pixel art paramétrique.
 *
 * Aucune image n'est chargée : les silhouettes sont des grilles de 16×16
 * décrites en données, colorées à la volée par l'affinité du personnage et
 * décalées en teinte pour que deux héros de la même affinité ne soient pas
 * jumeaux. Rien à télécharger, rien qui manque hors connexion.
 *
 * Deux poses seulement — au repos et en frappe. Tout le reste de l'animation
 * (l'élan, l'encaissement, la chute) est affaire de transformations CSS :
 * une pose dessinée de plus coûte seize lignes, une transformation en coûte
 * une, et le résultat bouge mieux.
 *
 * Module ISO : ni DOM ni Node.
 */

import { AFFINITES } from './affinites.js';

export const GRID = 16;
export const POSES = ['repos', 'frappe'];

/**
 * Indices employés par les grilles :
 *   . vide · 1 contour · 2 peau · 3 tenue sombre · 4 tenue claire
 *   5 accent d'affinité · 6 accent clair · 7 œil · 8 métal
 */
const BASE = ['', '#160d1f', '#f3cfa8', '#2f2440', '#4c3b66', '#ffffff', '#ffffff', '#0b0610', '#cfd8e6'];

/* ------------------------------------------------------------------ */
/* Héros                                                               */
/* ------------------------------------------------------------------ */

const HEROS_GRILLES = {
  /* Assaut : fine silhouette, lame tenue basse, prête à partir devant. */
  assaut: {
    repos: [
      '................',
      '.....555551.....',
      '....15555551....',
      '....15222251....',
      '....12272221....',
      '....12222221....',
      '.....1122111....',
      '....133333318...',
      '...13444443188..',
      '...13455543.88..',
      '...13444443..8..',
      '....13333331....',
      '....133..331....',
      '....131..131....',
      '...1331..1331...',
      '................',
    ],
    frappe: [
      '................',
      '....1555551.....',
      '...155555551....',
      '...152222251....',
      '...122722221....',
      '...122222218....',
      '....11221188....',
      '...1333331888...',
      '..134444438.....',
      '..13455543......',
      '..1344444318....',
      '...133333318....',
      '...1331.1331....',
      '..1331...1331...',
      '..131.....131...',
      '................',
    ],
  },

  /* Colosse : épaules larges, plastron, jambes plantées. */
  colosse: {
    repos: [
      '................',
      '....1555551.....',
      '...155555551....',
      '...152222251....',
      '...122722221....',
      '....12222221....',
      '....11222211....',
      '..1333333333 1..',
      '..134444444431..',
      '..134555555431..',
      '..134444444431..',
      '...1333333331...',
      '....13331331....',
      '....13331331....',
      '...133311333 1..',
      '................',
    ],
    frappe: [
      '................',
      '....1555551.....',
      '...155555551....',
      '...152222251....',
      '...122722221....',
      '...122222218....',
      '...112222118...',
      '.13333333388....',
      '.13444444488....',
      '.134555554318...',
      '.13444444431....',
      '..133333331.....',
      '..1333113331....',
      '..1331..13331...',
      '.13331...13331..',
      '................',
    ],
  },

  /* Soutien : robe longue, bâton, capuche marquée. */
  soutien: {
    repos: [
      '................',
      '....1555551.....',
      '...155555551....',
      '...155222551....',
      '...152272251....',
      '....12222218....',
      '.....112211.8...',
      '....13333318....',
      '...1344444318...',
      '...1345554318...',
      '...134444431.8..',
      '...1344444431...',
      '..13444444431...',
      '..1334444433 1..',
      '..13333333331...',
      '................',
    ],
    frappe: [
      '................',
      '....1555551.....',
      '...155555551....',
      '...155222551....',
      '...152272251....',
      '...812222218....',
      '..88.112211.....',
      '..8613333318....',
      '..88134444318...',
      '...8134555431...',
      '....13444443 1..',
      '....134444431...',
      '...1344444431...',
      '...133444443 1..',
      '...13333333331..',
      '................',
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Bestiaire                                                           */
/* ------------------------------------------------------------------ */

const ENNEMIS_GRILLES = {
  /* Rampant : bas sur pattes, mâchoire en avant. */
  rampant: {
    repos: [
      '................',
      '................',
      '................',
      '....11....11....',
      '...1551..1551...',
      '..135533335531..',
      '..13577777531...',
      '.1355555555531..',
      '.1344444444431..',
      '.1345544445431..',
      '.1344444444431..',
      '..1333333333 1..',
      '..131.1331.131..',
      '.1331.1331.1331.',
      '................',
      '................',
    ],
    frappe: [
      '................',
      '................',
      '...11......11...',
      '..1551....1551..',
      '.13553333335531.',
      '.135777777775 1.',
      '13555555555555 1',
      '1344444444444431',
      '1345544444455431',
      '.13444444444431.',
      '..133333333331..',
      '..131.1331.131..',
      '.1331.1331.1331.',
      '.131...11...131.',
      '................',
      '................',
    ],
  },

  /* Carapace : coque bombée, pattes courtes. */
  carapace: {
    repos: [
      '................',
      '................',
      '.....555551.....',
      '...1555555551...',
      '..135555555531..',
      '.13455555554431.',
      '.13445555544431.',
      '.13444444444431.',
      '.13444444444431.',
      '.11344444444311.',
      '.1.133333331..1.',
      '.1..1277721...1.',
      '....131..131....',
      '...1331..1331...',
      '................',
      '................',
    ],
    frappe: [
      '................',
      '.....55555......',
      '...155555551....',
      '..13555555531...',
      '.1345555555431..',
      '.1344555554431..',
      '13444444444431..',
      '13444444444431..',
      '.1344444444431..',
      '..13333333331...',
      '..1277772211....',
      '..131...1331....',
      '.1331....131....',
      '.131......131...',
      '................',
      '................',
    ],
  },

  /* Colosse : masse verticale, bras longs, tête enfoncée. */
  colosse: {
    repos: [
      '................',
      '.....11111......',
      '....1555551.....',
      '....15777 51....',
      '....155555 1....',
      '...1133333311...',
      '..13344444433 1.',
      '.133444444443 1.',
      '.134455554443 1.',
      '.134444444443 1.',
      '.1334444444331..',
      '..1333333331....',
      '..13331.13331...',
      '..1331...1331...',
      '.13331...13331..',
      '................',
    ],
    frappe: [
      '................',
      '....11111.......',
      '...1555551......',
      '...15777751.....',
      '...1555555 1....',
      '8.11333333118...',
      '8813344444438 1.',
      '.8134444444438..',
      '..13445555444 1.',
      '..1344444444431.',
      '...13344444331..',
      '....133333331...',
      '...13331.13331..',
      '...1331...1331..',
      '..13331...13331.',
      '................',
    ],
  },

  /* Spectre : flotte, pas de jambes, traîne effilochée. */
  spectre: {
    repos: [
      '................',
      '......1111......',
      '....15555551....',
      '...1555555551...',
      '...1557557551...',
      '...1555555551...',
      '...1355555531...',
      '..133444444331..',
      '..134455544431..',
      '..134444444431..',
      '..134444444431..',
      '...13444444 31..',
      '....133444331...',
      '.....1331331....',
      '......1..1......',
      '................',
    ],
    frappe: [
      '................',
      '.....1111.......',
      '...15555551.....',
      '..1555555551....',
      '..1557557551.8..',
      '..155555555188..',
      '..13555555531...',
      '.13344444443188.',
      '.13445554444318.',
      '.1344444444431..',
      '..134444444431..',
      '..1344444 4431..',
      '...13344443 1...',
      '....1331.1331...',
      '.....1....1.....',
      '................',
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Couleurs                                                            */
/* ------------------------------------------------------------------ */

/** Empreinte stable d'un identifiant, pour des variations reproductibles. */
function empreinte(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexVersHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

const hsl = ([h, s, l]) =>
  `hsl(${Math.round(((h % 1) + 1) % 1 * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/**
 * Palette d'un personnage : la tenue prend la teinte de l'affinité, la peau
 * reste de la peau, et l'identifiant décale le tout de quelques degrés.
 */
export function palettePour({ id = 'x', affinite = 'vermeil', ennemi = false } = {}) {
  const aff = AFFINITES[affinite] || AFFINITES.vermeil;
  const [ha, sa] = hexVersHsl(aff.teinte);
  const h = empreinte(id);
  const teinte = (((h % 31) - 15) / 360);
  const clarte = (((h >> 8) % 13) - 6) / 100;

  const pal = BASE.slice();
  const t = (ha + teinte + 1) % 1;
  // Les ennemis sont désaturés et assombris : on doit les distinguer d'un
  // héros de la même affinité sans lire l'étiquette.
  const sat = ennemi ? sa * 0.62 : sa;
  const baisse = ennemi ? 0.08 : 0;

  pal[3] = hsl([t, sat * 0.75, Math.max(0.1, 0.19 + clarte - baisse)]);
  pal[4] = hsl([t, sat * 0.68, Math.max(0.16, 0.33 + clarte - baisse)]);
  pal[5] = hsl([t, Math.min(1, sat * 1.05), Math.min(0.8, 0.58 + clarte - baisse)]);
  pal[6] = hsl([t, Math.min(1, sat), Math.min(0.92, 0.78 + clarte)]);
  pal[2] = ennemi ? hsl([t, 0.25, 0.62]) : hsl([0.08, 0.45, Math.min(0.9, 0.8 + clarte / 2)]);
  pal[7] = ennemi ? '#ffe066' : BASE[7];
  return pal;
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

function grilleDe(sujet, pose) {
  const jeu = sujet.silhouette ? ENNEMIS_GRILLES[sujet.silhouette] : HEROS_GRILLES[sujet.role];
  const secours = sujet.silhouette ? ENNEMIS_GRILLES.rampant : HEROS_GRILLES.assaut;
  const source = jeu || secours;
  return (source[pose] || source.repos).map((r) => r.padEnd(GRID, '.').slice(0, GRID));
}

/**
 * SVG d'une pose. Les pixels contigus d'une même couleur sont fondus en un
 * seul rectangle : seize fois moins de nœuds pour un rendu identique.
 */
export function spriteSvg(sujet, pose = 'repos', { classe = 'sprite' } = {}) {
  const grille = grilleDe(sujet, pose);
  const pal = palettePour({
    id: sujet.id || sujet.modeleId || sujet.nom || 'x',
    affinite: sujet.affinite,
    ennemi: !!sujet.silhouette,
  });

  let rects = '';
  grille.forEach((ligne, y) => {
    let x = 0;
    while (x < ligne.length) {
      const c = ligne[x];
      if (c === '.' || c === ' ') { x++; continue; }
      let w = 1;
      while (x + w < ligne.length && ligne[x + w] === c) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${pal[+c] || pal[1]}"/>`;
      x += w;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}"`
    + ` shape-rendering="crispEdges" class="${classe}" aria-hidden="true">${rects}</svg>`;
}

/** Les deux poses d'un personnage, prêtes à être permutées. */
export function poses(sujet) {
  return Object.fromEntries(POSES.map((p) => [p, spriteSvg(sujet, p)]));
}
