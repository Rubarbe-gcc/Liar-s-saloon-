/**
 * ÉCHO — la banque de sons à imiter.
 *
 * Aucun fichier audio : chaque son est *décrit* comme une suite de segments,
 * et rendu par calcul. Trois raisons, dans cet ordre :
 *
 *   1. rien n'est emprunté à personne, ce qui règle la question des droits ;
 *   2. le jeu tient hors ligne sans un octet de téléchargement ;
 *   3. le même rendu tourne dans le navigateur et dans Node, donc le barème
 *      peut être testé sur les vrais sons de référence plutôt que sur des
 *      signaux fabriqués pour l'occasion.
 *
 * Module ISO : `rendre` ne produit qu'un tableau de nombres. C'est l'appelant
 * qui en fait un AudioBuffer, s'il est dans un navigateur.
 */

/** Familles, pour composer des manches variées. */
export const FAMILLES = {
  bestiaire: { key: 'bestiaire', label: 'Bestiaire', glyph: '🐾', color: '#4ade80' },
  machine: { key: 'machine', label: 'Machines', glyph: '⚙️', color: '#38bdf8' },
  musique: { key: 'musique', label: 'Musique', glyph: '🎵', color: '#a78bfa' },
  humain: { key: 'humain', label: 'Voix', glyph: '🗣️', color: '#ffd84d' },
};

export const FAMILLE_KEYS = Object.keys(FAMILLES);

/**
 * Un segment décrit un morceau de son :
 *   hz     nombre, ou [depart, arrivee] pour un glissando
 *   duree  en secondes
 *   forme  'sinus' | 'dent' | 'carre' | 'bruit'
 *   bruit  part de souffle mêlée, de 0 à 1
 *   vol    volume, ou [depart, arrivee]
 *   apres  silence qui suit, en secondes
 */
export const SONS = [
  /* ---- Bestiaire ---- */
  {
    id: 'chien', nom: 'Le chien fâché', glyph: '🐕', famille: 'bestiaire', difficulte: 1,
    attaques: 3, indice: 'Trois aboiements secs. Comptez-les.',
    segments: [
      { hz: [420, 260], duree: 0.14, forme: 'dent', bruit: 0.25, vol: [1, 0.2], apres: 0.16 },
      { hz: [430, 250], duree: 0.14, forme: 'dent', bruit: 0.25, vol: [1, 0.2], apres: 0.16 },
      { hz: [400, 230], duree: 0.18, forme: 'dent', bruit: 0.3, vol: [1, 0.1] },
    ],
  },
  {
    id: 'chat', nom: 'Le chat qui réclame', glyph: '🐈', famille: 'bestiaire', difficulte: 2,
    attaques: 1, indice: 'Une plainte qui monte puis retombe.',
    segments: [
      { hz: [520, 780], duree: 0.34, forme: 'sinus', bruit: 0.08, vol: [0.5, 1] },
      { hz: [780, 430], duree: 0.42, forme: 'sinus', bruit: 0.08, vol: [1, 0.15] },
    ],
  },
  {
    id: 'coq', nom: 'Le coq du matin', glyph: '🐓', famille: 'bestiaire', difficulte: 2,
    attaques: 4, indice: 'Quatre syllabes, la troisième tient.',
    segments: [
      { hz: 600, duree: 0.16, forme: 'dent', bruit: 0.15, vol: 0.9, apres: 0.04 },
      { hz: 740, duree: 0.14, forme: 'dent', bruit: 0.15, vol: 1, apres: 0.04 },
      { hz: [880, 820], duree: 0.42, forme: 'dent', bruit: 0.2, vol: [1, 0.7], apres: 0.05 },
      { hz: [520, 380], duree: 0.26, forme: 'dent', bruit: 0.25, vol: [0.8, 0.1] },
    ],
  },
  {
    id: 'hibou', nom: 'Le hibou', glyph: '🦉', famille: 'bestiaire', difficulte: 1,
    attaques: 2, indice: 'Deux notes graves, la seconde descend.',
    segments: [
      { hz: 300, duree: 0.3, forme: 'sinus', bruit: 0.05, vol: [0.3, 0.9], apres: 0.22 },
      { hz: [300, 250], duree: 0.42, forme: 'sinus', bruit: 0.05, vol: [0.9, 0.1] },
    ],
  },
  {
    id: 'grenouille', nom: 'La grenouille', glyph: '🐸', famille: 'bestiaire', difficulte: 3,
    attaques: 5, indice: 'Cinq coassements réguliers. Le compte est la moitié du travail.',
    segments: Array.from({ length: 5 }, () => (
      { hz: [190, 150], duree: 0.1, forme: 'carre', bruit: 0.35, vol: [1, 0.2], apres: 0.13 }
    )),
  },

  /* ---- Machines ---- */
  {
    id: 'sirene', nom: 'La sirène', glyph: '🚨', famille: 'machine', difficulte: 1,
    attaques: 1, indice: 'Ça monte, ça descend, ça remonte.',
    segments: [
      { hz: [440, 880], duree: 0.45, forme: 'sinus', bruit: 0, vol: 1 },
      { hz: [880, 440], duree: 0.45, forme: 'sinus', bruit: 0, vol: 1 },
      { hz: [440, 880], duree: 0.45, forme: 'sinus', bruit: 0, vol: [1, 0.6] },
    ],
  },
  {
    id: 'bouilloire', nom: 'La bouilloire', glyph: '🫖', famille: 'machine', difficulte: 2,
    attaques: 1, indice: 'Un sifflement qui monte lentement, longtemps.',
    segments: [
      { hz: [900, 1050], duree: 1.1, forme: 'sinus', bruit: 0.3, vol: [0.2, 1] },
      { hz: [1050, 700], duree: 0.3, forme: 'sinus', bruit: 0.4, vol: [1, 0] },
    ],
  },
  {
    id: 'moteur', nom: 'Le moteur qui cale', glyph: '🏍️', famille: 'machine', difficulte: 3,
    attaques: 3, indice: 'Trois relances, de plus en plus faibles.',
    segments: [
      { hz: [110, 300], duree: 0.3, forme: 'dent', bruit: 0.2, vol: 1, apres: 0.1 },
      { hz: [110, 250], duree: 0.28, forme: 'dent', bruit: 0.25, vol: 0.8, apres: 0.12 },
      { hz: [110, 160], duree: 0.34, forme: 'dent', bruit: 0.35, vol: [0.7, 0.05] },
    ],
  },
  {
    id: 'telephone', nom: 'Le vieux téléphone', glyph: '☎️', famille: 'machine', difficulte: 1,
    attaques: 2, indice: 'Deux sonneries identiques, bien détachées.',
    segments: [
      { hz: 660, duree: 0.34, forme: 'carre', bruit: 0, vol: 0.85, apres: 0.2 },
      { hz: 660, duree: 0.34, forme: 'carre', bruit: 0, vol: 0.85 },
    ],
  },
  {
    id: 'laser', nom: 'Le laser', glyph: '🔫', famille: 'machine', difficulte: 2,
    attaques: 2, indice: 'Deux descentes très rapides.',
    segments: [
      { hz: [1000, 220], duree: 0.18, forme: 'dent', bruit: 0, vol: [1, 0.2], apres: 0.14 },
      { hz: [1000, 220], duree: 0.18, forme: 'dent', bruit: 0, vol: [1, 0.2] },
    ],
  },

  /* ---- Musique ---- */
  {
    id: 'fanfare', nom: 'La petite fanfare', glyph: '🎺', famille: 'musique', difficulte: 2,
    attaques: 3, indice: 'Trois notes qui montent, la dernière tient.',
    segments: [
      { hz: 392, duree: 0.24, forme: 'dent', bruit: 0.04, vol: 0.9, apres: 0.05 },
      { hz: 494, duree: 0.24, forme: 'dent', bruit: 0.04, vol: 0.95, apres: 0.05 },
      { hz: 587, duree: 0.5, forme: 'dent', bruit: 0.04, vol: [1, 0.3] },
    ],
  },
  {
    id: 'berceuse', nom: 'La berceuse', glyph: '🌙', famille: 'musique', difficulte: 2,
    attaques: 4, indice: 'Quatre notes douces, ça redescend à la fin.',
    segments: [
      { hz: 523, duree: 0.3, forme: 'sinus', bruit: 0, vol: 0.8, apres: 0.06 },
      { hz: 523, duree: 0.3, forme: 'sinus', bruit: 0, vol: 0.8, apres: 0.06 },
      { hz: 587, duree: 0.3, forme: 'sinus', bruit: 0, vol: 0.85, apres: 0.06 },
      { hz: 523, duree: 0.45, forme: 'sinus', bruit: 0, vol: [0.85, 0.15] },
    ],
  },
  {
    id: 'defaite', nom: 'Le petit air triste', glyph: '📉', famille: 'musique', difficulte: 1,
    attaques: 4, indice: 'Quatre notes qui descendent.',
    segments: [
      { hz: 587, duree: 0.2, forme: 'sinus', bruit: 0, vol: 0.9, apres: 0.04 },
      { hz: 523, duree: 0.2, forme: 'sinus', bruit: 0, vol: 0.85, apres: 0.04 },
      { hz: 466, duree: 0.2, forme: 'sinus', bruit: 0, vol: 0.8, apres: 0.04 },
      { hz: [392, 370], duree: 0.5, forme: 'sinus', bruit: 0, vol: [0.8, 0.1] },
    ],
  },
  {
    id: 'valse', nom: 'Le tour de valse', glyph: '💃', famille: 'musique', difficulte: 3,
    attaques: 6, indice: 'Un temps fort, deux temps faibles. Deux fois.',
    segments: [
      { hz: 440, duree: 0.3, forme: 'sinus', bruit: 0, vol: 1, apres: 0.03 },
      { hz: 659, duree: 0.16, forme: 'sinus', bruit: 0, vol: 0.5, apres: 0.03 },
      { hz: 659, duree: 0.16, forme: 'sinus', bruit: 0, vol: 0.5, apres: 0.06 },
      { hz: 392, duree: 0.3, forme: 'sinus', bruit: 0, vol: 1, apres: 0.03 },
      { hz: 587, duree: 0.16, forme: 'sinus', bruit: 0, vol: 0.5, apres: 0.03 },
      { hz: 587, duree: 0.16, forme: 'sinus', bruit: 0, vol: [0.5, 0.1] },
    ],
  },

  /* ---- Voix ---- */
  {
    id: 'question', nom: 'La question surprise', glyph: '❓', famille: 'humain', difficulte: 1,
    attaques: 1, indice: 'Une seule montée, franche, du grave vers l\'aigu.',
    segments: [
      { hz: [220, 480], duree: 0.55, forme: 'dent', bruit: 0.12, vol: [0.6, 1] },
    ],
  },
  {
    id: 'soupir', nom: 'Le grand soupir', glyph: '😮‍💨', famille: 'humain', difficulte: 1,
    attaques: 1, indice: 'Une longue descente, sans à-coup.',
    segments: [
      { hz: [400, 180], duree: 0.9, forme: 'sinus', bruit: 0.25, vol: [0.9, 0.05] },
    ],
  },
  {
    id: 'rire', nom: 'Le rire moqueur', glyph: '😏', famille: 'humain', difficulte: 3,
    attaques: 4, indice: 'Quatre éclats qui descendent.',
    segments: [
      { hz: [520, 460], duree: 0.12, forme: 'dent', bruit: 0.15, vol: 1, apres: 0.08 },
      { hz: [470, 410], duree: 0.12, forme: 'dent', bruit: 0.15, vol: 0.9, apres: 0.08 },
      { hz: [420, 360], duree: 0.12, forme: 'dent', bruit: 0.15, vol: 0.8, apres: 0.08 },
      { hz: [370, 300], duree: 0.16, forme: 'dent', bruit: 0.2, vol: [0.7, 0.1] },
    ],
  },
  {
    id: 'bof', nom: 'Le « bof » résigné', glyph: '🤷', famille: 'humain', difficulte: 2,
    attaques: 2, indice: 'Deux syllabes, la seconde plus grave et plus longue.',
    segments: [
      { hz: [300, 320], duree: 0.18, forme: 'dent', bruit: 0.2, vol: 0.9, apres: 0.05 },
      { hz: [260, 200], duree: 0.55, forme: 'dent', bruit: 0.25, vol: [0.9, 0.1] },
    ],
  },
];

const PAR_ID = new Map(SONS.map((s) => [s.id, s]));
export const getSon = (id) => PAR_ID.get(id) || null;

/**
 * `attaques` est le nombre de débuts de son que le joueur doit produire. Ce
 * n'est pas une intention mais une mesure : un test vérifie que le détecteur
 * en compte exactement autant sur le rendu réel. Sans ce verrou, un indice
 * pourrait promettre « trois aboiements » alors que le barème en attend deux,
 * et sanctionner celui qui a raison.
 */

/** Durée totale d'un son, silences compris. */
export const dureeDe = (son) =>
  son.segments.reduce((a, s) => a + s.duree + (s.apres || 0), 0);

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

const lire = (v, t) => (Array.isArray(v) ? v[0] + (v[1] - v[0]) * t : v);

/** Générateur pseudo-aléatoire, pour que le souffle soit reproductible. */
function bruiteur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

function forme(nom, phase, souffle) {
  switch (nom) {
    case 'carre': return Math.sign(Math.sin(phase)) * 0.7;
    case 'dent': {
      // Dent de scie adoucie : riche en harmoniques sans être agressive.
      const x = (phase / (2 * Math.PI)) % 1;
      return (2 * x - 1) * 0.6 + Math.sin(phase) * 0.4;
    }
    case 'bruit': return souffle();
    default: return Math.sin(phase);
  }
}

/**
 * Rend un son en échantillons.
 *
 * @param {object} son   une entrée de SONS
 * @param {number} sampleRate
 * @param {number} [graine]  pour un souffle reproductible d'un appel à l'autre
 * @returns {Float32Array}
 */
export function rendre(son, sampleRate, graine = 1234) {
  const total = Math.ceil(dureeDe(son) * sampleRate);
  const x = new Float32Array(total);
  const souffle = bruiteur(graine);

  let curseur = 0;
  let phase = 0;
  for (const seg of son.segments) {
    const n = Math.round(seg.duree * sampleRate);
    const partBruit = seg.bruit || 0;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const hz = lire(seg.hz, t);
      phase += (2 * Math.PI * hz) / sampleRate;

      // Fondu d'entrée et de sortie courts : une attaque nette, sans clic.
      const monte = Math.min(1, i / Math.max(1, 0.008 * sampleRate));
      const descend = Math.min(1, (n - i) / Math.max(1, 0.012 * sampleRate));
      const vol = lire(seg.vol ?? 1, t) * monte * descend;

      const ton = forme(seg.forme || 'sinus', phase, souffle);
      const val = ton * (1 - partBruit) + souffle() * partBruit;
      if (curseur + i < total) x[curseur + i] = val * vol * 0.55;
    }
    curseur += n + Math.round((seg.apres || 0) * sampleRate);
  }
  return x;
}

/** Tire `n` sons distincts, en variant les familles. */
export function tirage(n, rng = Math.random) {
  const parFamille = {};
  for (const s of SONS) (parFamille[s.famille] = parFamille[s.famille] || []).push(s);
  const familles = Object.keys(parFamille);
  const out = [];
  const pris = new Set();

  // Une famille par manche tant que possible : un jeu qui enchaîne quatre
  // aboiements lasse au troisième.
  for (let i = 0; i < n; i++) {
    const fam = familles[i % familles.length];
    const dispo = (parFamille[fam] || []).filter((s) => !pris.has(s.id));
    const pool = dispo.length ? dispo : SONS.filter((s) => !pris.has(s.id));
    if (!pool.length) break;
    const choisi = pool[Math.floor(rng() * pool.length)];
    pris.add(choisi.id);
    out.push(choisi.id);
  }
  return out;
}
