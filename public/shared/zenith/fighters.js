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
 * victoire. D'où un effectif identique pour chaque élément, exactement.
 *
 * Les combattants de soutien portent en plus un champ `support`. Leur budget
 * est volontairement plus bas que celui des combattants purs : le budget ne
 * mesure que la puissance brute, et ne voit pas la valeur d'un soin ou d'un
 * renfort. Sans cette décote, un soutien serait un combattant ordinaire à qui
 * l'on aurait offert une capacité — donc strictement meilleur. La décote
 * exacte a été réglée à la mesure, pas au jugé : voir `test/zenith.test.js`.
 *
 * Deux garde-fous encadrent ces capacités, parce qu'un soin qui suit le
 * rythme des dégâts transforme le combat en attente :
 *   - chaque camp n'en dispose que de trois pour tout le combat ;
 *   - les utiliser coûte un tour entier, pendant lequel on ne frappe pas.
 */
export const FIGHTERS = [
  /* ---- Braise : agressifs, gros dégâts, peu de garde ---- */
  {
    id: 'kaze', name: 'Kaze', title: 'Le Poing Ardent', element: 'braise', avatar: '🥊',
    hp: 640, strike: 74, blast: 48, armor: 30, speed: 68,
    special: { name: 'Météore Vermeil', blurb: 'Une descente en flammes.' },
    ultimate: { name: 'Supernova Écarlate', blurb: 'Le ciel prend feu.' },
  },
  {
    id: 'ignara', name: 'Ignara', title: 'Danseuse de Cendres', element: 'braise', avatar: '💃',
    hp: 580, strike: 62, blast: 70, armor: 24, speed: 86,
    special: { name: 'Valse Incandescente', blurb: 'Elle tourne, tout brûle.' },
    ultimate: { name: 'Requiem de Braises', blurb: 'La dernière danse.' },
  },
  {
    id: 'bral', name: 'Bral', title: 'Forge Vivante', element: 'braise', avatar: '🔨',
    hp: 690, strike: 80, blast: 30, armor: 44, speed: 42,
    special: { name: 'Enclume Solaire', blurb: 'Un marteau de plasma.' },
    ultimate: { name: 'Haut-Fourneau', blurb: 'Il devient la forge.' },
  },

  /* ---- Orage : rapides, pioche accélérée ---- */
  {
    id: 'volt', name: 'Volt', title: 'Éclair Sec', element: 'orage', avatar: '⚡',
    hp: 550, strike: 66, blast: 66, armor: 22, speed: 98,
    special: { name: 'Zéro Seconde', blurb: 'Personne ne l\'a vu bouger.' },
    ultimate: { name: 'Orage Perpétuel', blurb: 'Mille frappes en une.' },
  },
  {
    id: 'sylas', name: 'Sylas', title: 'Le Paratonnerre', element: 'orage', avatar: '🗿',
    hp: 650, strike: 52, blast: 62, armor: 46, speed: 56,
    special: { name: 'Appel du Ciel', blurb: 'Il attire la foudre sur lui.' },
    ultimate: { name: 'Jugement Statique', blurb: 'La charge se libère.' },
  },
  {
    id: 'tesla', name: 'Téslane', title: 'Arc Continu', element: 'orage', avatar: '🔱',
    hp: 610, strike: 44, blast: 84, armor: 28, speed: 80,
    special: { name: 'Arc Voltaïque', blurb: 'Un fil de foudre tendu.' },
    ultimate: { name: 'Décharge Totale', blurb: 'Plus rien ne conduit.' },
  },

  /* ---- Abysse : techniques, punissent les erreurs ---- */
  {
    id: 'nox', name: 'Nox', title: 'Ombre Portée', element: 'abysse', avatar: '🌘',
    hp: 570, strike: 70, blast: 58, armor: 26, speed: 90,
    special: { name: 'Morsure du Vide', blurb: 'La blessure ne se referme pas.' },
    ultimate: { name: 'Éclipse Totale', blurb: 'La lumière s\'excuse et part.' },
  },
  {
    id: 'vesper', name: 'Vesper', title: 'Chuchoteuse', element: 'abysse', avatar: '🧙‍♀️',
    hp: 610, strike: 40, blast: 92, armor: 24, speed: 84,
    special: { name: 'Litanie Basse', blurb: 'Des mots qui pèsent une tonne.' },
    ultimate: { name: 'Silence Absolu', blurb: 'Elle cesse de chuchoter.' },
  },
  {
    id: 'gorm', name: 'Gorm', title: 'Gouffre', element: 'abysse', avatar: '🐙',
    hp: 710, strike: 64, blast: 40, armor: 52, speed: 34,
    special: { name: 'Étreinte Abyssale', blurb: 'Il ne lâche jamais.' },
    ultimate: { name: 'Point de Non-Retour', blurb: 'Le fond du gouffre.' },
  },

  /* ---- Sylve : endurants, récupèrent du ki ---- */
  {
    id: 'liora', name: 'Liora', title: 'Sève Ancienne', element: 'sylve', avatar: '🌿',
    hp: 680, strike: 46, blast: 66, armor: 42, speed: 56,
    special: { name: 'Ronce Étreignante', blurb: 'Le sol se referme.' },
    ultimate: { name: 'Printemps Furieux', blurb: 'Tout pousse, trop vite.' },
  },
  {
    id: 'tarn', name: 'Tarn', title: 'Écorce', element: 'sylve', avatar: '🌳',
    hp: 740, strike: 58, blast: 34, armor: 56, speed: 32,
    special: { name: 'Charge de Chêne', blurb: 'Un tronc lancé au galop.' },
    ultimate: { name: 'Racine-Mère', blurb: 'La forêt entière répond.' },
  },
  {
    id: 'faon', name: 'Faon', title: 'Pas Léger', element: 'sylve', avatar: '🦌',
    hp: 600, strike: 68, blast: 56, armor: 22, speed: 94,
    special: { name: 'Bond de Clairière', blurb: 'Il était là il y a une seconde.' },
    ultimate: { name: 'Course des Bois', blurb: 'La harde arrive.' },
  },

  /* ---- Givre : contrôlent le rythme ---- */
  {
    id: 'kelvin', name: 'Kelvin', title: 'Zéro Absolu', element: 'givre', avatar: '🧊',
    hp: 640, strike: 50, blast: 74, armor: 38, speed: 58,
    special: { name: 'Cercueil de Glace', blurb: 'Le temps s\'y arrête.' },
    ultimate: { name: 'Hiver Définitif', blurb: 'Plus jamais de printemps.' },
  },
  {
    id: 'brume', name: 'Brume', title: 'Voile Blanc', element: 'givre', avatar: '👻',
    hp: 590, strike: 54, blast: 78, armor: 26, speed: 82,
    special: { name: 'Blanc Total', blurb: 'On ne voit plus ses coups venir.' },
    ultimate: { name: 'Avalanche Muette', blurb: 'Elle ne fait aucun bruit.' },
  },
  {
    id: 'orn', name: 'Orn', title: 'Brise-Banquise', element: 'givre', avatar: '🐻‍❄️',
    hp: 680, strike: 78, blast: 32, armor: 48, speed: 36,
    special: { name: 'Coup de Banquise', blurb: 'La glace se fend. Vous aussi.' },
    ultimate: { name: 'Dérive Polaire', blurb: 'Il emporte tout.' },
  },

  /* ---- Polyvalents ---- */
  {
    id: 'echo', name: 'Écho', title: 'Sans Visage', element: 'abysse', avatar: '🎭',
    hp: 610, strike: 62, blast: 62, armor: 34, speed: 72,
    special: { name: 'Reflet Inversé', blurb: 'Votre propre coup vous revient.' },
    ultimate: { name: 'Chœur de Masques', blurb: 'Ils sont tous là.' },
  },
  {
    id: 'sora', name: 'Sora', title: 'Cerf-volant', element: 'orage', avatar: '🪁',
    hp: 590, strike: 58, blast: 68, armor: 28, speed: 88,
    special: { name: 'Ficelle Tendue', blurb: 'Elle vous ramène toujours.' },
    ultimate: { name: 'Lâcher de Fil', blurb: 'Plus rien ne la retient.' },
  },
  {
    id: 'saule', name: 'Saule', title: 'Vieille Racine', element: 'sylve', avatar: '🧝',
    hp: 620, strike: 56, blast: 68, armor: 40, speed: 60,
    special: { name: 'Greffe Vive', blurb: 'Ce qu\'elle touche repousse ailleurs.' },
    ultimate: { name: 'Canopée', blurb: 'Le ciel disparaît sous les feuilles.' },
  },
  {
    id: 'frimas', name: 'Frimas', title: 'Souffle Court', element: 'givre', avatar: '🐧',
    hp: 600, strike: 66, blast: 58, armor: 30, speed: 82,
    special: { name: 'Éclat de Gel', blurb: 'Mille aiguilles d\'un coup.' },
    ultimate: { name: 'Nuit Blanche', blurb: 'Le froid ne repart plus.' },
  },
  {
    id: 'maru', name: 'Maru', title: 'Petit Tonnerre', element: 'braise', avatar: '🧨',
    hp: 560, strike: 88, blast: 44, armor: 20, speed: 92,
    special: { name: 'Mèche Courte', blurb: 'Tout petit. Très énervé.' },
    ultimate: { name: 'Grande Détonation', blurb: 'On l\'entend de loin.' },
  },

  /* ================================================================ */
  /* Soutiens — un soigneur et un renfort par élément                 */
  /*                                                                  */
  /* Portée `allie` : un seul allié, l'effet est fort.                */
  /* Portée `equipe` : tout le camp, l'effet est plus faible.         */
  /* ================================================================ */

  /* ---- Braise ---- */
  {
    id: 'braisille', name: 'Braisille', title: 'Veilleuse de Foyer', element: 'braise', avatar: '🕯️',
    hp: 710, strike: 46, blast: 56, armor: 32, speed: 74,
    special: { name: 'Tison Partagé', blurb: 'Elle donne sa chaleur.' },
    ultimate: { name: 'Grand Foyer', blurb: 'Le feu qu\'on garde allumé.' },
    support: {
      kind: 'soin', portee: 'equipe', name: 'Chaleur du Foyer', glyph: '🕯️',
      ki: 38, part: 0.19,
      blurb: 'Rend des points de vie à tout le camp.',
    },
  },
  {
    id: 'attise', name: 'Attise', title: 'Souffle de Forge', element: 'braise', avatar: '🔥',
    hp: 680, strike: 58, blast: 50, armor: 28, speed: 80,
    special: { name: 'Coup de Soufflet', blurb: 'La flamme monte d\'un cran.' },
    ultimate: { name: 'Blanc de Chauffe', blurb: 'Le métal ne tient plus.' },
    support: {
      kind: 'renfort', portee: 'allie', name: 'Chauffe à Blanc', glyph: '🔆',
      ki: 16, attaque: 1.30, armure: 1.14, tours: 5, kiRendu: 44,
      blurb: 'Attise la puissance du combattant en lice.',
    },
  },

  /* ---- Orage ---- */
  {
    id: 'vireli', name: 'Vireli', title: 'Fil de Vie', element: 'orage', avatar: '💫',
    hp: 670, strike: 44, blast: 58, armor: 26, speed: 100,
    special: { name: 'Suture Vive', blurb: 'Un arc qui recoud.' },
    ultimate: { name: 'Décharge Salvatrice', blurb: 'Le cœur repart.' },
    support: {
      kind: 'soin', portee: 'allie', name: 'Suture Vive', glyph: '💚',
      ki: 34, part: 0.34,
      blurb: 'Soigne franchement l\'allié le plus mal en point.',
    },
  },
  {
    id: 'dynam', name: 'Dynam', title: 'Bobine Mère', element: 'orage', avatar: '🔌',
    hp: 710, strike: 50, blast: 48, armor: 40, speed: 64,
    special: { name: 'Mise sous Tension', blurb: 'Tout le monde grésille.' },
    ultimate: { name: 'Surcharge Générale', blurb: 'Le réseau cède.' },
    support: {
      kind: 'renfort', portee: 'equipe', name: 'Mise sous Tension', glyph: '⚡',
      ki: 18, attaque: 1.18, armure: 1.12, tours: 5, kiRendu: 28,
      blurb: 'Électrise tout le camp, un peu.',
    },
  },

  /* ---- Abysse ---- */
  {
    id: 'nyssa', name: 'Nyssa', title: 'Main Muette', element: 'abysse', avatar: '🤲',
    hp: 710, strike: 40, blast: 64, armor: 30, speed: 78,
    special: { name: 'Toucher Muet', blurb: 'La douleur s\'en va sans bruit.' },
    ultimate: { name: 'Silence Bienveillant', blurb: 'Plus rien ne fait mal.' },
    support: {
      kind: 'soin', portee: 'allie', name: 'Toucher Muet', glyph: '💚',
      ki: 34, part: 0.34,
      blurb: 'Soigne franchement l\'allié le plus mal en point.',
    },
  },
  {
    id: 'augure', name: 'Augure', title: 'Lit les Signes', element: 'abysse', avatar: '🔮',
    hp: 730, strike: 44, blast: 52, armor: 42, speed: 56,
    special: { name: 'Présage Favorable', blurb: 'Il savait déjà.' },
    ultimate: { name: 'Destin Réécrit', blurb: 'Ce qui devait arriver n\'arrive pas.' },
    support: {
      kind: 'renfort', portee: 'equipe', name: 'Présage Favorable', glyph: '🔯',
      ki: 18, attaque: 1.18, armure: 1.12, tours: 5, kiRendu: 28,
      blurb: 'Le camp entier joue un peu mieux.',
    },
  },

  /* ---- Sylve ---- */
  {
    id: 'rosee', name: 'Rosée', title: 'Première Heure', element: 'sylve', avatar: '💧',
    hp: 740, strike: 42, blast: 54, armor: 38, speed: 64,
    special: { name: 'Goutte Claire', blurb: 'Le matin remet tout d\'aplomb.' },
    ultimate: { name: 'Grande Rosée', blurb: 'La forêt se relève.' },
    support: {
      kind: 'soin', portee: 'equipe', name: 'Goutte Claire', glyph: '💧',
      ki: 38, part: 0.19,
      blurb: 'Rend des points de vie à tout le camp.',
    },
  },
  {
    id: 'ramure', name: 'Ramure', title: 'Vieux Bois', element: 'sylve', avatar: '🌳',
    hp: 740, strike: 56, blast: 38, armor: 44, speed: 50,
    special: { name: 'Sève Montante', blurb: 'Les racines poussent fort.' },
    ultimate: { name: 'Cathédrale Verte', blurb: 'Le bois se referme.' },
    support: {
      kind: 'renfort', portee: 'allie', name: 'Sève Montante', glyph: '🌿',
      ki: 16, attaque: 1.30, armure: 1.14, tours: 5, kiRendu: 44,
      blurb: 'Gonfle la puissance du combattant en lice.',
    },
  },

  /* ---- Givre ---- */
  {
    id: 'neve', name: 'Névé', title: 'Neige Tassée', element: 'givre', avatar: '🏔️',
    hp: 680, strike: 42, blast: 60, armor: 34, speed: 84,
    special: { name: 'Compresse Blanche', blurb: 'Le froid endort la douleur.' },
    ultimate: { name: 'Manteau Neigeux', blurb: 'Tout est recouvert, tout guérit.' },
    support: {
      kind: 'soin', portee: 'allie', name: 'Compresse Blanche', glyph: '💚',
      ki: 34, part: 0.34,
      blurb: 'Soigne franchement l\'allié le plus mal en point.',
    },
  },
  {
    id: 'aurore', name: 'Aurore', title: 'Ciel Polaire', element: 'givre', avatar: '🌌',
    hp: 710, strike: 48, blast: 54, armor: 36, speed: 66,
    special: { name: 'Voile Boréal', blurb: 'Le ciel se met à danser.' },
    ultimate: { name: 'Nuit Australe', blurb: 'La lumière prend le dessus.' },
    support: {
      kind: 'renfort', portee: 'equipe', name: 'Voile Boréal', glyph: '🌠',
      ki: 18, attaque: 1.18, armure: 1.12, tours: 5, kiRendu: 28,
      blurb: 'Le camp entier joue un peu mieux.',
    },
  },
];

/** Index par identifiant, pour éviter de balayer le tableau à chaque appel. */
const BY_ID = new Map(FIGHTERS.map((f) => [f.id, f]));

export function getFighter(id) {
  return BY_ID.get(id) || null;
}

/**
 * Points de vie effectifs : ce que le combattant encaisse réellement, une
 * fois son armure prise en compte.
 *
 * L'armure divise les dégâts par `(100 + armure) / 100`. Points de vie et
 * armure se multiplient donc, là où l'ancien budget les additionnait — et
 * c'est ce qui faisait des colosses un choix structurellement supérieur :
 * à 316 points partout, la durabilité réelle allait de 781 à 2122, un
 * facteur 2,7, mesuré. Facturer la durabilité sur cette grandeur-ci rend le
 * coût proportionnel à ce qu'il achète.
 */
export function effectiveHp(f) {
  return f.hp * (100 + f.armor) / 100;
}

/**
 * Prix de chaque statistique, réglés à la mesure.
 *
 * La force vaut plus que le souffle parce que la Frappe — la seule commande
 * gratuite — en dépend : un combattant tout en force dispose d'une attaque
 * correcte à chaque tour sans jamais payer. La vitesse vaut moins qu'un
 * point plein : elle décide de l'ordre des coups et module le revenu de ki,
 * ce qui compte, mais moins qu'un point de dégâts ou d'encaissement.
 *
 * Ces trois nombres ont été choisis par balayage : à chaque configuration,
 * les points de vie de tout le roster sont recalculés pour retomber sur le
 * budget visé, puis 1800 combats mesurent la dispersion des taux de
 * victoire. Le triplet retenu la ramène de 9,8 à 4,7 points d'écart-type,
 * en gardant des combats de 24 tours en médiane — un roster parfaitement
 * plat mais interminable ne vaudrait rien.
 */
export const PRIX = { durabilite: 6, force: 1.2, souffle: 1, vitesse: 0.6 };

/** Budget total visé. Les soutiens paient une décote pour leur capacité. */
export const BUDGET_CIBLE = 316;
export const DECOTE_SOUTIEN = 4;

/** Budget de points d'un combattant, utilisé pour l'équilibrage. */
export function budgetOf(f) {
  return Math.round(
    effectiveHp(f) / PRIX.durabilite
    + f.strike * PRIX.force
    + f.blast * PRIX.souffle
    + f.speed * PRIX.vitesse,
  );
}

/** Budget attendu pour ce combattant, selon son rôle. */
export const budgetCibleOf = (f) =>
  BUDGET_CIBLE - (f.support ? DECOTE_SOUTIEN : 0);

/** Un combattant de soutien porte une capacité de soin ou de renfort. */
export const isSupport = (f) => !!(f && f.support);

/** Les soutiens d'un genre donné : 'soin' ou 'renfort'. */
export const supportsOf = (kind) =>
  FIGHTERS.filter((f) => f.support && f.support.kind === kind);

/** Tire une équipe aléatoire de `size` combattants distincts. */
export function randomTeam(size = 3, rng = Math.random) {
  const pool = [...FIGHTERS];
  const out = [];
  for (let i = 0; i < size && pool.length; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  }
  return out;
}
