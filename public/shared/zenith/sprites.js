/**
 * ZÉNITH — personnages en pixel art.
 *
 * Les combattants sont dessinés par assemblage de pixels décrits en données
 * plutôt qu'en images : une grille de 16×16 par pose, colorée à partir de la
 * palette du combattant. Cela évite des dizaines de fichiers à charger, garde
 * le jeu jouable hors connexion, et surtout permet de décliner vingt
 * combattants sans dessiner vingt planches.
 *
 * Chaque silhouette existe en cinq poses, appelées selon ce qui se passe :
 * repos, garde, frappe, encaisse, vaincu.
 */

export const GRID = 16;

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

/**
 * Indices de couleur utilisés par les grilles :
 *   0 vide · 1 contour · 2 peau · 3 tenue sombre · 4 tenue claire
 *   5 accent (élément) · 6 accent clair · 7 œil
 */
export const ELEMENT_PALETTE = {
  braise: ['', '#2a0d08', '#f2c49b', '#7d2313', '#c8442a', '#ff5a3c', '#ffb37a', '#1a0603'],
  orage:  ['', '#2b230a', '#f6d9a8', '#7a6412', '#c4a01f', '#ffd23c', '#fff0a8', '#1c1503'],
  abysse: ['', '#180c2b', '#e6ccf5', '#3f2170', '#6f3fb0', '#a855f7', '#d8b4fe', '#0d0518'],
  sylve:  ['', '#0d2415', '#e2d7ba', '#1f5c33', '#38955a', '#4ade80', '#b9f6cf', '#06180c'],
  givre:  ['', '#0a2233', '#e8f3ff', '#14567e', '#2a8cc0', '#38bdf8', '#bae6fd', '#041420'],
};

/* ------------------------------------------------------------------ */
/* Silhouettes                                                         */
/* ------------------------------------------------------------------ */

/**
 * Trois carrures, choisies d'après les statistiques du combattant :
 * `leste` (rapide et fragile), `franc` (polyvalent), `massif` (endurant).
 *
 * Chaque pose est une grille de 16 lignes de 16 chiffres. Les points
 * représentent le vide ; c'est verbeux mais directement lisible à l'œil, ce
 * qui rend les retouches simples.
 */
const S = {
  franc: {
    repos: [
      '................',
      '.....111111.....',
      '....15555551....',
      '...1522222251...',
      '...1527227251...',
      '...1522222251...',
      '....15222251....',
      '...113333331 ...',
      '..1342222431....',
      '..1342222431....',
      '..134222243 ....',
      '...1333333 1....',
      '....13..331.....',
      '....13..331.....',
      '...113..3311....',
      '................',
    ],
    garde: [
      '................',
      '.....111111.....',
      '....15555551....',
      '...1522222251...',
      '...1527227251...',
      '...1522222251...',
      '....15222251....',
      '..11133333311...',
      '.13422222243 1..',
      '.13422222243 1..',
      '..1342222431....',
      '...1333333 1....',
      '....13..331.....',
      '....13..331.....',
      '...113..3311....',
      '................',
    ],
    frappe: [
      '................',
      '....111111......',
      '...15555551.....',
      '..1522222251....',
      '..1527227251....',
      '..1522222251....',
      '...15222251.....',
      '..11333333111122',
      '.1342222243 1662',
      '.134222224311662',
      '..13422224 1....',
      '...133333 1.....',
      '...13...331.....',
      '..113....331....',
      '..11......311...',
      '................',
    ],
    encaisse: [
      '................',
      '......111111....',
      '.....15555551...',
      '....152222251...',
      '....157227251...',
      '....152222251...',
      '.....15222251...',
      '....1133333311..',
      '...134222224 1..',
      '..1342222243....',
      '...134222243....',
      '....13333331....',
      '....131..331....',
      '...131...331....',
      '..1311....311...',
      '................',
    ],
    vaincu: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '...11.......11..',
      '..1331.....1331.',
      '.134422111224431',
      '.13422255522431.',
      '.1342272272431..',
      '..1333333333 1..',
      '...111111111....',
      '................',
    ],
  },
};

/* Carrures dérivées : on épaissit ou on affine la silhouette de base. */
S.massif = derive(S.franc, 'massif');
S.leste = derive(S.franc, 'leste');

/**
 * Décline une carrure à partir de la silhouette de référence.
 * `massif` élargit le torse d'un pixel de chaque côté ; `leste` le resserre.
 */
function derive(base, genre) {
  const out = {};
  for (const [pose, rows] of Object.entries(base)) {
    out[pose] = rows.map((row, y) => {
      if (y < 7 || y > 11) return row;            // on ne touche qu'au torse
      const cells = row.split('');
      if (genre === 'massif') {
        for (let x = 1; x < GRID - 1; x++) {
          if (cells[x] === '.' && (cells[x + 1] === '1' || cells[x - 1] === '1')) {
            cells[x] = '3';
          }
        }
      } else {
        for (let x = 2; x < GRID - 2; x++) {
          if (cells[x] === '3' && (cells[x - 1] === '1' || cells[x + 1] === '1')) {
            cells[x] = '.';
          }
        }
      }
      return cells.join('');
    });
  }
  return out;
}

export const POSES = Object.keys(S.franc);

/** Carrure d'un combattant, déduite de ses statistiques. */
export function buildOf(fighter) {
  if (fighter.speed >= 78) return 'leste';
  if (fighter.hp >= 1050 || fighter.armor >= 46) return 'massif';
  return 'franc';
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Variation individuelle                                              */
/* ------------------------------------------------------------------ */

/** Empreinte stable d'un identifiant, pour des variations reproductibles. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, sat, l];
}

const hslCss = ([h, s, l]) => `hsl(${(h * 360).toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;

/**
 * Palette propre à un combattant : la teinte de l'élément reste reconnaissable,
 * mais chacun reçoit son décalage. Sans cela, deux combattants du même élément
 * seraient rigoureusement identiques à l'écran.
 */
export function paletteFor(fighter) {
  const base = ELEMENT_PALETTE[fighter.element] || ELEMENT_PALETTE.braise;
  const h = hash(fighter.id);
  const teinte = ((h % 41) - 20) / 360;          // ±20° autour de l'élément
  const clarte = (((h >> 8) % 17) - 8) / 100;    // ±8 % de luminosité
  const peau = (((h >> 16) % 5) - 2) / 100;

  return base.map((col, i) => {
    if (!col || i === 0) return col;
    const [hh, ss, ll] = hexToHsl(col);
    // La peau ne suit pas la teinte élémentaire, seulement un léger écart.
    if (i === 2) return hslCss([hh, ss, Math.max(0.55, Math.min(0.95, ll + peau))]);
    if (i === 1 || i === 7) return col;          // contours et yeux restent noirs
    return hslCss([(hh + teinte + 1) % 1, ss, Math.max(0.12, Math.min(0.92, ll + clarte))]);
  });
}

/**
 * Produit le SVG d'une pose. Le rendu reste net à toute taille grâce à
 * `shape-rendering: crispEdges` et à des rectangles alignés sur la grille.
 *
 * @param {object} fighter combattant du roster
 * @param {string} pose    repos | garde | frappe | encaisse | vaincu
 */
export function spriteSvg(fighter, pose = 'repos') {
  const grid = (S[buildOf(fighter)] || S.franc)[pose] || S.franc.repos;
  const pal = paletteFor(fighter);

  // On regroupe les pixels contigus d'une même couleur en un seul rectangle :
  // seize fois moins de nœuds à l'écran, pour un rendu identique.
  let rects = '';
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === '.' || c === ' ') { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${pal[+c] || pal[1]}"/>`;
      x += w;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" `
    + `shape-rendering="crispEdges" class="sprite" aria-hidden="true">${rects}</svg>`;
}

/** Les cinq poses d'un combattant, prêtes à être permutées. */
export function allPoses(fighter) {
  return Object.fromEntries(POSES.map((p) => [p, spriteSvg(fighter, p)]));
}
