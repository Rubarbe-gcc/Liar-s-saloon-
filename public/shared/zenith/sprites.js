/**
 * ZÉNITH — personnages en pixel art.
 *
 * Les combattants sont décrits en données — des grilles de 16×16 — plutôt
 * qu'en images : aucun fichier à charger, rien qui manque hors connexion, et
 * vingt combattants sans dessiner vingt planches.
 *
 * L'identité visuelle se compose de trois couches :
 *   1. la carrure, déduite des statistiques (leste, franc, massif) ;
 *   2. la coiffe, propre à l'élément, posée par-dessus la tête ;
 *   3. la palette, décalée pour chaque combattant autour de sa teinte.
 *
 * Chaque carrure existe en cinq poses, appelées selon ce qui se passe :
 * repos, garde, frappe, encaisse, vaincu.
 */

export const GRID = 16;

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

/**
 * Indices employés par les grilles :
 *   . vide · 1 contour · 2 peau · 3 tenue sombre · 4 tenue claire
 *   5 accent (élément) · 6 accent clair · 7 œil
 */
export const ELEMENT_PALETTE = {
  braise: ['', '#2a0d08', '#f2c49b', '#7d2313', '#c8442a', '#ff5a3c', '#ffb37a', '#1a0603'],
  orage:  ['', '#2b230a', '#f6d9a8', '#6d5810', '#c4a01f', '#ffd23c', '#fff0a8', '#1c1503'],
  abysse: ['', '#180c2b', '#e6ccf5', '#3f2170', '#6f3fb0', '#a855f7', '#d8b4fe', '#0d0518'],
  sylve:  ['', '#0d2415', '#e2d7ba', '#1f5c33', '#38955a', '#4ade80', '#b9f6cf', '#06180c'],
  givre:  ['', '#0a2233', '#e8f3ff', '#14567e', '#2a8cc0', '#38bdf8', '#bae6fd', '#041420'],
};

/* ------------------------------------------------------------------ */
/* Carrures                                                            */
/* ------------------------------------------------------------------ */

/**
 * LESTE — silhouette fine, écharpe flottante, jambes déliées.
 * MASSIF — épaules lourdes, plastron, jambes courtes et plantées.
 * FRANC  — gabarit intermédiaire, ceinture marquée.
 *
 * Les lignes 0 à 3 sont laissées libres : la coiffe élémentaire s'y installe.
 */
const BUILDS = {
  leste: {
    repos: [
      '................',
      '................',
      '................',
      '.....111111.....',
      '....15222251....',
      '....17222271....',
      '....15222251....',
      '.....112211.....',
      '..66113333110...',
      '.661134444311...',
      '....134554431...',
      '....1344443 1...',
      '.....13333 1....',
      '.....133.331....',
      '....1331.1331...',
      '................',
    ],
    garde: [
      '................',
      '................',
      '................',
      '.....111111.....',
      '....15222251....',
      '....17222271....',
      '....15222251....',
      '....11222211....',
      '..6611333333 1..',
      '.66113444444 1..',
      '....13455443 1..',
      '....13444431....',
      '.....133331.....',
      '.....133.331....',
      '....1331.1331...',
      '................',
    ],
    frappe: [
      '................',
      '................',
      '................',
      '...111111.......',
      '..15222251......',
      '..17222271......',
      '..15222251......',
      '...112211.......',
      '6611333331111266',
      '6113444444311662',
      '..134554431...66',
      '..13444431......',
      '...133331.......',
      '...133.331......',
      '..1331.1331.....',
      '................',
    ],
    encaisse: [
      '................',
      '................',
      '................',
      '......111111....',
      '.....15222251...',
      '.....17222271...',
      '.....15222251...',
      '......112211....',
      '...6611333311...',
      '..661134444311..',
      '.....1345544 1..',
      '.....134444 1...',
      '......13333 1...',
      '.....133.331....',
      '....1331.1331...',
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
      '................',
      '...11......11...',
      '..1331....1331..',
      '.13443111344311.',
      '.1342252522431..',
      '..133333333311..',
      '...1111111111...',
      '................',
    ],
  },

  massif: {
    repos: [
      '................',
      '................',
      '................',
      '....11111111....',
      '...152222251....',
      '...172222271....',
      '...152222251....',
      '....11222211....',
      '.1133333333311..',
      '.13444444444 1..',
      '.13455555554431.',
      '.13444444444431.',
      '..133333333331..',
      '...1331..13311..',
      '..13331..133311.',
      '................',
    ],
    garde: [
      '................',
      '................',
      '................',
      '....11111111....',
      '...152222251....',
      '...172222271....',
      '...152222251....',
      '....11222211....',
      '113333333333311.',
      '1344444444444431',
      '1345555555554431',
      '.13444444444431.',
      '..133333333331..',
      '...1331..13311..',
      '..13331..133311.',
      '................',
    ],
    frappe: [
      '................',
      '................',
      '................',
      '..11111111......',
      '.152222251......',
      '.172222271......',
      '.152222251......',
      '..11222211......',
      '11333333331111..',
      '13444444444 1662',
      '134555555554 662',
      '1344444444431...',
      '.1333333333 1...',
      '..1331..1331....',
      '.13331..133311..',
      '................',
    ],
    encaisse: [
      '................',
      '................',
      '................',
      '.....11111111...',
      '....152222251...',
      '....172222271...',
      '....152222251...',
      '.....11222211...',
      '..1133333333311.',
      '..134444444443 1',
      '.1345555555544 1',
      '.134444444444 1.',
      '..1333333333 1..',
      '..1331..1331 ...',
      '.13331..13331...',
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
      '..11........11..',
      '.1331......1331.',
      '134431111113443 ',
      '134455555554431.',
      '13442252522443..',
      '.13333333333311.',
      '..111111111111..',
      '................',
    ],
  },

  franc: {
    repos: [
      '................',
      '................',
      '................',
      '.....111111.....',
      '....15222251....',
      '....17222271....',
      '....15222251....',
      '.....112211.....',
      '...1133333311...',
      '...134444431....',
      '...134555431....',
      '...134444431....',
      '....13333311....',
      '....133..331....',
      '...1331..1331...',
      '................',
    ],
    garde: [
      '................',
      '................',
      '................',
      '.....111111.....',
      '....15222251....',
      '....17222271....',
      '....15222251....',
      '....11222211....',
      '..113333333311..',
      '..13444444431...',
      '..13455554431...',
      '...134444431....',
      '....13333311....',
      '....133..331....',
      '...1331..1331...',
      '................',
    ],
    frappe: [
      '................',
      '................',
      '................',
      '...111111.......',
      '..15222251......',
      '..17222271......',
      '..15222251......',
      '...112211.......',
      '.113333331111266',
      '.1344444431..662',
      '.1345555431...66',
      '.13444443 1.....',
      '..1333331.......',
      '..133..331......',
      '.1331...1331....',
      '................',
    ],
    encaisse: [
      '................',
      '................',
      '................',
      '......111111....',
      '.....15222251...',
      '.....17222271...',
      '.....15222251...',
      '......112211....',
      '....113333331 1.',
      '....1344444431..',
      '...13455554431..',
      '...1344444431...',
      '....133333 1....',
      '...133..1331....',
      '..1331...1331...',
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
      '.134431111344431',
      '.134455555544431',
      '.13442252522443.',
      '..1333333333331.',
      '...11111111111..',
      '................',
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Coiffes élémentaires                                                */
/* ------------------------------------------------------------------ */

/**
 * Posées sur les lignes 0 à 4, par-dessus le corps. Elles sont ce qui rend un
 * combattant reconnaissable d'un coup d'œil : la palette seule ne suffit pas,
 * surtout en petit, sur un portrait d'équipe.
 *
 * Un point laisse passer le corps ; tout autre caractère l'écrase.
 */
const CRESTS = {
  // Flamme dressée.
  braise: [
    '.......65.......',
    '......6556......',
    '.....155551.....',
    '....15555551....',
    '....1555555 1...',
  ],
  // Deux antennes dressées, comme un arc électrique.
  orage: [
    '....6......6....',
    '.....6....6.....',
    '.....15..51.....',
    '....155555 1....',
    '....1555555.....',
    ],
  // Capuche pointue, ombre portée sur le visage.
  abysse: [
    '.......1........',
    '......151.......',
    '.....15551......',
    '....1555555 1...',
    '...155555555 1..',
  ],
  // Bois de cerf.
  sylve: [
    '..6..........6..',
    '...6.1....1.6...',
    '....65....56....',
    '....1555555 1...',
    '....1555555.....',
  ],
  // Couronne de cristaux.
  givre: [
    '....6..66..6....',
    '....65.65.56....',
    '....155555 1....',
    '....1555555.....',
    '.....155551.....',
  ],
};

export const POSES = Object.keys(BUILDS.franc);
export const BUILD_KEYS = Object.keys(BUILDS);

/** Carrure d'un combattant, déduite de ses statistiques. */
export function buildOf(fighter) {
  if (fighter.speed >= 78) return 'leste';
  if (fighter.hp >= 1050 || fighter.armor >= 46) return 'massif';
  return 'franc';
}

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
  return h >>> 0;
}

function hexToHsl(hex) {
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
  `hsl(${(h * 360).toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;

/**
 * Palette propre à un combattant : la teinte de l'élément reste
 * reconnaissable, mais chacun reçoit son décalage. Sans cela, les quatre
 * combattants d'un même élément seraient identiques à l'écran.
 */
export function paletteFor(fighter) {
  const base = ELEMENT_PALETTE[fighter.element] || ELEMENT_PALETTE.braise;
  const h = hash(fighter.id);
  const teinte = ((h % 41) - 20) / 360;
  const clarte = (((h >> 8) % 17) - 8) / 100;
  const peau = (((h >> 16) % 5) - 2) / 100;

  return base.map((col, i) => {
    if (!col || i === 0) return col;
    const [hh, ss, ll] = hexToHsl(col);
    if (i === 1 || i === 7) return col;         // contours et yeux restent noirs
    if (i === 2) return hsl([hh, ss, Math.max(0.55, Math.min(0.95, ll + peau))]);
    return hsl([(hh + teinte + 1) % 1, ss, Math.max(0.12, Math.min(0.92, ll + clarte))]);
  });
}

/* ------------------------------------------------------------------ */
/* Assemblage et rendu                                                 */
/* ------------------------------------------------------------------ */

/** Superpose la coiffe élémentaire au corps. */
export function composeGrid(fighter, pose = 'repos') {
  const build = BUILDS[buildOf(fighter)] || BUILDS.franc;
  const body = (build[pose] || build.repos).map((r) => r.padEnd(GRID, '.').slice(0, GRID));
  const crest = CRESTS[fighter.element];
  if (!crest) return body;

  // La coiffe ne s'applique pas au combattant à terre : il n'a plus de tête
  // dressée, et la superposition tomberait dans le vide.
  if (pose === 'vaincu') return body;

  // On aligne la coiffe sur la tête, qui n'est pas à la même hauteur ni au
  // même endroit selon la pose : on suit le décalage horizontal du corps.
  const ancre = body.findIndex((r) => r.includes('1'));
  const decal = decalageTete(body, ancre);

  const out = body.slice();
  crest.forEach((row, k) => {
    // La coiffe s'arrête juste au-dessus des yeux : une ligne plus bas et
    // le visage disparaissait entièrement.
    const y = ancre + 2 - crest.length + k;
    if (y < 0 || y >= GRID) return;
    const cible = out[y].split('');
    row.padEnd(GRID, '.').split('').forEach((c, x) => {
      const dx = x + decal;
      if (c === '.' || dx < 0 || dx >= GRID) return;
      cible[dx] = c;
    });
    out[y] = cible.join('');
  });
  return out;
}

/** Décalage horizontal de la tête par rapport à la pose de repos. */
function decalageTete(body, ancre) {
  const ligne = body[ancre] || '';
  const debut = ligne.indexOf('1');
  const fin = ligne.lastIndexOf('1');
  if (debut < 0) return 0;
  return Math.round((debut + fin) / 2) - 8;
}

/**
 * Produit le SVG d'une pose. Les pixels contigus d'une même couleur sont
 * regroupés en un seul rectangle : seize fois moins de nœuds pour un rendu
 * identique.
 */
export function spriteSvg(fighter, pose = 'repos') {
  const grid = composeGrid(fighter, pose);
  const pal = paletteFor(fighter);

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
