/**
 * ZÉNITH — roster.
 *
 * Personnages originaux. Les mécaniques s'inspirent des jeux de combat à
 * cartes, mais rien ici n'est repris d'une œuvre existante.
 *
 * Équilibrage : chaque combattant dispose d'un budget de points réparti
 * entre ses statistiques, si bien qu'un colosse lent et un assassin fragile
 * pèsent autant l'un que l'autre. Le test `fighters.test.js` vérifie que ce
 * budget est respecté.
 */

/* ------------------------------------------------------------------ */
/* Éléments                                                            */
/* ------------------------------------------------------------------ */

/**
 * Cycle d'avantage : chaque élément domine le suivant.
 * Braise → Orage → Abysse → Sylve → Givre → Braise
 */
export const ELEMENTS = {
  braise: { key: 'braise', label: 'Braise', glyph: '🔥', color: '#ff5a3c', beats: 'orage' },
  orage:  { key: 'orage',  label: 'Orage',  glyph: '⚡', color: '#ffd23c', beats: 'abysse' },
  abysse: { key: 'abysse', label: 'Abysse', glyph: '🔮', color: '#a855f7', beats: 'sylve' },
  sylve:  { key: 'sylve',  label: 'Sylve',  glyph: '🍃', color: '#4ade80', beats: 'givre' },
  givre:  { key: 'givre',  label: 'Givre',  glyph: '❄️', color: '#38bdf8', beats: 'braise' },
};

export const ELEMENT_KEYS = Object.keys(ELEMENTS);

/** Bonus de dégâts quand l'attaquant domine l'élément de sa cible. */
export const ADVANTAGE_BONUS = 1.3;
export const DISADVANTAGE_MALUS = 0.8;

/**
 * Multiplicateur élémentaire de `attacker` contre `defender`.
 * @returns {number} 1.3 en avantage, 0.8 en désavantage, 1 sinon.
 */
export function elementMultiplier(attacker, defender) {
  if (attacker === defender) return 1;
  if (ELEMENTS[attacker] && ELEMENTS[attacker].beats === defender) return ADVANTAGE_BONUS;
  if (ELEMENTS[defender] && ELEMENTS[defender].beats === attacker) return DISADVANTAGE_MALUS;
  return 1;
}

/* ------------------------------------------------------------------ */
/* Cartes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Familles de cartes. `power` est un multiplicateur appliqué à la
 * statistique correspondante ; `ki` son coût ; `recovery` le nombre de
 * ticks pendant lesquels on reste immobilisé après l'avoir jouée.
 */
export const CARD_KINDS = {
  frappe: {
    key: 'frappe', label: 'Frappe', glyph: '👊', stat: 'strike',
    power: 1.0, ki: 10, recovery: 4, hitstun: 5, kiGain: 14,
    blurb: 'Enchaînement rapide au corps à corps.',
  },
  souffle: {
    key: 'souffle', label: 'Souffle', glyph: '💠', stat: 'blast',
    power: 1.15, ki: 20, recovery: 6, hitstun: 6, kiGain: 6,
    blurb: 'Décharge d\'énergie à distance.',
  },
  speciale: {
    // « mixte » : la technique signature puise dans la force et le souffle.
    // Sans cela, trois cartes sur quatre utiliseraient `blast` et les
    // combattants physiques seraient structurellement désavantagés.
    key: 'speciale', label: 'Spéciale', glyph: '✦', stat: 'mixte',
    power: 1.9, ki: 45, recovery: 9, hitstun: 10, kiGain: 0,
    blurb: 'Technique signature du combattant.',
  },
  ultime: {
    key: 'ultime', label: 'Ultime', glyph: '☄️', stat: 'mixte',
    power: 3.4, ki: 80, recovery: 13, hitstun: 14, kiGain: 0,
    blurb: 'Coup décisif. Une fois par combat et par combattant.',
  },
};

export const CARD_KEYS = Object.keys(CARD_KINDS);

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

/**
 * Statistiques : `hp` points de vie, `strike` frappe, `blast` souffle,
 * `armor` réduction des dégâts subis, `speed` vitesse de recharge du ki et
 * de pioche.
 *
 * Budget : hp/10 + strike + blast + armor + speed, autour de 316.
 *
 * La répartition par élément compte autant que les statistiques. Avec quatre
 * combattants de Braise et seulement trois de Givre, un combattant de Braise
 * rencontrait plus d'adversaires qu'il domine que d'adversaires qui le
 * dominent — un avantage systématique mesuré à dix points de taux de
 * victoire. D'où quatre combattants par élément, exactement.
 */
export const FIGHTERS = [
  /* ---- Braise : agressifs, gros dégâts, peu de garde ---- */
  {
    id: 'kaze', name: 'Kaze', title: 'Le Poing Ardent', element: 'braise', avatar: '🥊',
    hp: 960, strike: 74, blast: 48, armor: 30, speed: 68,
    special: { name: 'Météore Vermeil', blurb: 'Une descente en flammes.' },
    ultimate: { name: 'Supernova Écarlate', blurb: 'Le ciel prend feu.' },
  },
  {
    id: 'ignara', name: 'Ignara', title: 'Danseuse de Cendres', element: 'braise', avatar: '💃',
    hp: 740, strike: 62, blast: 70, armor: 24, speed: 86,
    special: { name: 'Valse Incandescente', blurb: 'Elle tourne, tout brûle.' },
    ultimate: { name: 'Requiem de Braises', blurb: 'La dernière danse.' },
  },
  {
    id: 'bral', name: 'Bral', title: 'Forge Vivante', element: 'braise', avatar: '🔨',
    hp: 1200, strike: 80, blast: 30, armor: 44, speed: 42,
    special: { name: 'Enclume Solaire', blurb: 'Un marteau de plasma.' },
    ultimate: { name: 'Haut-Fourneau', blurb: 'Il devient la forge.' },
  },

  /* ---- Orage : rapides, pioche accélérée ---- */
  {
    id: 'volt', name: 'Volt', title: 'Éclair Sec', element: 'orage', avatar: '⚡',
    hp: 640, strike: 66, blast: 66, armor: 22, speed: 98,
    special: { name: 'Zéro Seconde', blurb: 'Personne ne l\'a vu bouger.' },
    ultimate: { name: 'Orage Perpétuel', blurb: 'Mille frappes en une.' },
  },
  {
    id: 'sylas', name: 'Sylas', title: 'Le Paratonnerre', element: 'orage', avatar: '🗿',
    hp: 1000, strike: 52, blast: 62, armor: 46, speed: 56,
    special: { name: 'Appel du Ciel', blurb: 'Il attire la foudre sur lui.' },
    ultimate: { name: 'Jugement Statique', blurb: 'La charge se libère.' },
  },
  {
    id: 'tesla', name: 'Téslane', title: 'Arc Continu', element: 'orage', avatar: '🔱',
    hp: 800, strike: 44, blast: 84, armor: 28, speed: 80,
    special: { name: 'Arc Voltaïque', blurb: 'Un fil de foudre tendu.' },
    ultimate: { name: 'Décharge Totale', blurb: 'Plus rien ne conduit.' },
  },

  /* ---- Abysse : techniques, punissent les erreurs ---- */
  {
    id: 'nox', name: 'Nox', title: 'Ombre Portée', element: 'abysse', avatar: '🌘',
    hp: 720, strike: 70, blast: 58, armor: 26, speed: 90,
    special: { name: 'Morsure du Vide', blurb: 'La blessure ne se referme pas.' },
    ultimate: { name: 'Éclipse Totale', blurb: 'La lumière s\'excuse et part.' },
  },
  {
    id: 'vesper', name: 'Vesper', title: 'Chuchoteuse', element: 'abysse', avatar: '🧙‍♀️',
    hp: 760, strike: 40, blast: 92, armor: 24, speed: 84,
    special: { name: 'Litanie Basse', blurb: 'Des mots qui pèsent une tonne.' },
    ultimate: { name: 'Silence Absolu', blurb: 'Elle cesse de chuchoter.' },
  },
  {
    id: 'gorm', name: 'Gorm', title: 'Gouffre', element: 'abysse', avatar: '🐙',
    hp: 1260, strike: 64, blast: 40, armor: 52, speed: 34,
    special: { name: 'Étreinte Abyssale', blurb: 'Il ne lâche jamais.' },
    ultimate: { name: 'Point de Non-Retour', blurb: 'Le fond du gouffre.' },
  },

  /* ---- Sylve : endurants, récupèrent du ki ---- */
  {
    id: 'liora', name: 'Liora', title: 'Sève Ancienne', element: 'sylve', avatar: '🌿',
    hp: 1060, strike: 46, blast: 66, armor: 42, speed: 56,
    special: { name: 'Ronce Étreignante', blurb: 'Le sol se referme.' },
    ultimate: { name: 'Printemps Furieux', blurb: 'Tout pousse, trop vite.' },
  },
  {
    id: 'tarn', name: 'Tarn', title: 'Écorce', element: 'sylve', avatar: '🌳',
    hp: 1360, strike: 58, blast: 34, armor: 56, speed: 32,
    special: { name: 'Charge de Chêne', blurb: 'Un tronc lancé au galop.' },
    ultimate: { name: 'Racine-Mère', blurb: 'La forêt entière répond.' },
  },
  {
    id: 'faon', name: 'Faon', title: 'Pas Léger', element: 'sylve', avatar: '🦌',
    hp: 760, strike: 68, blast: 56, armor: 22, speed: 94,
    special: { name: 'Bond de Clairière', blurb: 'Il était là il y a une seconde.' },
    ultimate: { name: 'Course des Bois', blurb: 'La harde arrive.' },
  },

  /* ---- Givre : contrôlent le rythme ---- */
  {
    id: 'kelvin', name: 'Kelvin', title: 'Zéro Absolu', element: 'givre', avatar: '🧊',
    hp: 960, strike: 50, blast: 74, armor: 38, speed: 58,
    special: { name: 'Cercueil de Glace', blurb: 'Le temps s\'y arrête.' },
    ultimate: { name: 'Hiver Définitif', blurb: 'Plus jamais de printemps.' },
  },
  {
    id: 'brume', name: 'Brume', title: 'Voile Blanc', element: 'givre', avatar: '👻',
    hp: 760, strike: 54, blast: 78, armor: 26, speed: 82,
    special: { name: 'Blanc Total', blurb: 'On ne voit plus ses coups venir.' },
    ultimate: { name: 'Avalanche Muette', blurb: 'Elle ne fait aucun bruit.' },
  },
  {
    id: 'orn', name: 'Orn', title: 'Brise-Banquise', element: 'givre', avatar: '🐻‍❄️',
    hp: 1220, strike: 78, blast: 32, armor: 48, speed: 36,
    special: { name: 'Coup de Banquise', blurb: 'La glace se fend. Vous aussi.' },
    ultimate: { name: 'Dérive Polaire', blurb: 'Il emporte tout.' },
  },

  /* ---- Polyvalents ---- */
  {
    id: 'echo', name: 'Écho', title: 'Sans Visage', element: 'abysse', avatar: '🎭',
    hp: 860, strike: 62, blast: 62, armor: 34, speed: 72,
    special: { name: 'Reflet Inversé', blurb: 'Votre propre coup vous revient.' },
    ultimate: { name: 'Chœur de Masques', blurb: 'Ils sont tous là.' },
  },
  {
    id: 'sora', name: 'Sora', title: 'Cerf-volant', element: 'orage', avatar: '🪁',
    hp: 740, strike: 58, blast: 68, armor: 28, speed: 88,
    special: { name: 'Ficelle Tendue', blurb: 'Elle vous ramène toujours.' },
    ultimate: { name: 'Lâcher de Fil', blurb: 'Plus rien ne la retient.' },
  },
  {
    id: 'saule', name: 'Saule', title: 'Vieille Racine', element: 'sylve', avatar: '🧝',
    hp: 940, strike: 56, blast: 68, armor: 40, speed: 60,
    special: { name: 'Greffe Vive', blurb: 'Ce qu\'elle touche repousse ailleurs.' },
    ultimate: { name: 'Canopée', blurb: 'Le ciel disparaît sous les feuilles.' },
  },
  {
    id: 'frimas', name: 'Frimas', title: 'Souffle Court', element: 'givre', avatar: '🐧',
    hp: 820, strike: 66, blast: 58, armor: 30, speed: 82,
    special: { name: 'Éclat de Gel', blurb: 'Mille aiguilles d\'un coup.' },
    ultimate: { name: 'Nuit Blanche', blurb: 'Le froid ne repart plus.' },
  },
  {
    id: 'maru', name: 'Maru', title: 'Petit Tonnerre', element: 'braise', avatar: '🧨',
    hp: 720, strike: 88, blast: 44, armor: 20, speed: 92,
    special: { name: 'Mèche Courte', blurb: 'Tout petit. Très énervé.' },
    ultimate: { name: 'Grande Détonation', blurb: 'On l\'entend de loin.' },
  },
];

/** Index par identifiant, pour éviter de balayer le tableau à chaque appel. */
const BY_ID = new Map(FIGHTERS.map((f) => [f.id, f]));

export function getFighter(id) {
  return BY_ID.get(id) || null;
}

/** Budget de points d'un combattant, utilisé pour l'équilibrage. */
export function budgetOf(f) {
  return Math.round(f.hp / 10 + f.strike + f.blast + f.armor + f.speed);
}

/** Tire une équipe aléatoire de `size` combattants distincts. */
export function randomTeam(size = 3, rng = Math.random) {
  const pool = [...FIGHTERS];
  const out = [];
  for (let i = 0; i < size && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  }
  return out;
}
