/**
 * RAID — l'équipement.
 *
 * Trois emplacements par personnage : une arme, une armure, un bijou. Les
 * pièces se trouvent dans les coffres, sur les boss, chez les marchands ; leur
 * force suit l'acte où on les trouve, et leur rareté.
 *
 * Module ISO : ni DOM ni Node.
 */

import { entier, piocher } from '../hasard.js';

export const EMPLACEMENTS = {
  arme: { nom: 'Arme', glyphe: '🗡' },
  armure: { nom: 'Armure', glyphe: '🛡' },
  bijou: { nom: 'Bijou', glyphe: '💍' },
};

export const RARETES = {
  commun: { nom: 'commun', teinte: '#c9d1b0', facteur: 1, prix: 1 },
  rare: { nom: 'rare', teinte: '#5ea9ff', facteur: 1.5, prix: 1.8 },
  epique: { nom: 'épique', teinte: '#c77dff', facteur: 2.2, prix: 3 },
  legendaire: { nom: 'légendaire', teinte: '#ff9a3d', facteur: 3, prix: 4.5 },
  mythique: { nom: 'mythique', teinte: '#ff4d6d', facteur: 4, prix: 7 },
  // Les trophées : une pièce unique par boss ou par élite, à son nom, qu'on
  // ne trouve que sur lui. Jamais en boutique, jamais dans un coffre.
  boss: { nom: 'BOSS', teinte: '#ffd23f', facteur: 3.4, prix: 6 },
};

/** Du plus commun au plus rare, pour comparer deux raretés. */
export const ORDRE_RARETES = ['commun', 'rare', 'epique', 'legendaire', 'mythique'];

/**
 * Modèles de pièces : bonus au premier acte, en rareté commune. `crit` est
 * une chance de coup critique en points de pour-cent.
 */
export const MODELES = [
  { base: 'Épée', emplacement: 'arme', glyphe: '⚔', atk: 3 },
  { base: 'Hache', emplacement: 'arme', glyphe: '🪓', atk: 4, vit: -1 },
  { base: 'Dague', emplacement: 'arme', glyphe: '🗡', atk: 2, vit: 1, crit: 3 },
  { base: 'Bâton', emplacement: 'arme', glyphe: '🪄', atk: 2, pm: 4 },
  { base: 'Arc', emplacement: 'arme', glyphe: '🏹', atk: 3, vit: 1 },
  { base: 'Masse', emplacement: 'arme', glyphe: '🔨', atk: 3, def: 1 },
  { base: 'Cotte de mailles', emplacement: 'armure', glyphe: '🛡', def: 3, pv: 6 },
  { base: 'Plastron', emplacement: 'armure', glyphe: '🛡', def: 4, vit: -1 },
  { base: 'Robe', emplacement: 'armure', glyphe: '🥻', def: 1, pm: 5, pv: 4 },
  { base: 'Cuir clouté', emplacement: 'armure', glyphe: '🦺', def: 2, vit: 1 },
  { base: 'Anneau', emplacement: 'bijou', glyphe: '💍', pm: 4, crit: 2 },
  { base: 'Amulette', emplacement: 'bijou', glyphe: '📿', pv: 10 },
  { base: 'Talisman', emplacement: 'bijou', glyphe: '🧿', crit: 5 },
  { base: 'Broche', emplacement: 'bijou', glyphe: '🎖', atk: 1, def: 1, vit: 1 },
  { base: 'Lance', emplacement: 'arme', glyphe: '🔱', atk: 3, crit: 2 },
  { base: 'Faux', emplacement: 'arme', glyphe: '🌙', atk: 4, crit: 3, vit: -1 },
  { base: 'Armure d’écailles', emplacement: 'armure', glyphe: '🐉', def: 3, pv: 8 },
  { base: 'Cape', emplacement: 'armure', glyphe: '🧥', def: 1, vit: 1, crit: 2 },
  { base: 'Couronne', emplacement: 'bijou', glyphe: '👑', atk: 1, pv: 6, pm: 2 },
  { base: 'Sablier', emplacement: 'bijou', glyphe: '⏳', vit: 1, pm: 4 },
];

/** Des qualificatifs qui ne s'accordent pas : ils vont à « une épée » comme à « un arc ». */
const QUALIFICATIFS = {
  commun: ['de fer', 'de recrue', 'de voyage', 'de garde'],
  rare: ['runique', 'd’acier fin', 'du veilleur', 'de maître'],
  epique: ['du Dragon', 'de l’Aube', 'des Anciens', 'de braise'],
  legendaire: ['des Titans', 'du Phénix', 'de l’Éclipse', 'du Roi déchu'],
  mythique: ['du Premier Jour', 'de l’Abîme', 'des Étoiles mortes', 'sans Nom'],
};

/**
 * Les trophées. Chaque boss et chaque élite garde une pièce à son nom, et
 * ses caractéristiques lui ressemblent : la Reine Noyée donne de la vie, le
 * Boucher frappe, l'Œil voit les failles. Valeurs au premier chapitre, avant
 * la rareté BOSS.
 */
export const TROPHEES = {
  // --- boss de chapitre ---
  morvase: { nom: 'Couronne d’os de Morvase', emplacement: 'bijou', glyphe: '👑', pv: 12, pm: 3 },
  vorgath: { nom: 'Hachoir de Vorgath', emplacement: 'arme', glyphe: '🔪', atk: 4, crit: 3 },
  kharn: { nom: 'Cœur de lave de Kharn', emplacement: 'bijou', glyphe: '🌋', atk: 2, pv: 8 },
  ysolde: { nom: 'Diadème gelé d’Ysolde', emplacement: 'bijou', glyphe: '❄', pm: 6, def: 2 },
  sarkhavel: { nom: 'Écaille cendrée de Sarkhavel', emplacement: 'armure', glyphe: '🐉', def: 4, pv: 8 },
  yggmar: { nom: 'Écorce d’Yggmar', emplacement: 'armure', glyphe: '🌳', def: 3, pv: 12 },
  nelizar: { nom: 'Plume du Scribe Nélizar', emplacement: 'arme', glyphe: '🪶', atk: 3, pm: 6 },
  seraphiel: { nom: 'Épée de Séraphiel', emplacement: 'arme', glyphe: '🗡', atk: 4, vit: 1, crit: 2 },
  ozrath: { nom: 'Paupière d’Ozrath', emplacement: 'bijou', glyphe: '👁', crit: 6, atk: 1 },
  // --- élites ---
  hurlefer: { nom: 'Mâchoire de Hurlefer', emplacement: 'arme', glyphe: '🦷', atk: 4, crit: 2 },
  banshie: { nom: 'Voile de la Banshie', emplacement: 'armure', glyphe: '👻', def: 2, pm: 6, vit: 1 },
  sentinelle: { nom: 'Plastron de la Sentinelle', emplacement: 'armure', glyphe: '🛡', def: 5, pv: 4, vit: -1 },
  minotaure: { nom: 'Hache du Minotaure', emplacement: 'arme', glyphe: '🪓', atk: 5, vit: -1 },
  tisseuse: { nom: 'Soie de la Tisseuse', emplacement: 'armure', glyphe: '🕸', def: 2, vit: 1, crit: 3 },
};

/**
 * Un trophée ne tombe pas à tous les coups. Quand il tombe, il prend la place
 * d'une des pièces à choisir : il faut encore le préférer aux autres.
 *   • sur le boss du chapitre : son propre trophée, quatre fois sur dix ;
 *   • sur une élite (salle ou embuscade) : une fois sur cinq, le sien ou
 *     celui d'un boss déjà vaincu.
 */
export const CHANCE_TROPHEE_BOSS = 0.4;
export const CHANCE_TROPHEE_ELITE = 0.2;

/** Le trophée d'un boss ou d'une élite, forgé pour le chapitre où il est tombé. */
export function forgerTrophee(modeleId, acte = 1, rng = Math.random) {
  const t = TROPHEES[modeleId];
  if (!t) return null;
  const r = RARETES.boss;
  const k = r.facteur * (1 + 0.4 * (acte - 1));
  const it = {
    uid: `t${Math.floor(rng() * 1e9).toString(36)}`,
    nom: t.nom, emplacement: t.emplacement, glyphe: t.glyphe,
    rarete: 'boss', acte, trophee: modeleId,
  };
  for (const st of STATS) {
    if (!t[st]) continue;
    it[st] = st === 'vit' ? t[st] : Math.max(1, Math.round(t[st] * k)) * Math.sign(t[st]);
  }
  it.prix = Math.round((18 + 14 * acte) * r.prix);
  return it;
}

const STATS = ['atk', 'def', 'pv', 'pm', 'vit', 'crit'];

/**
 * Une pièce d'équipement, forgée pour un acte et une rareté. La vitesse ne
 * grandit pas avec l'acte : un point de vitesse vaut toujours un rang
 * d'initiative, et ne doit pas finir par tout écraser.
 */
export function forger(modele, acte = 1, rarete = 'commun', rng = Math.random, uid = null) {
  const r = RARETES[rarete];
  const k = r.facteur * (1 + 0.4 * (acte - 1));
  const it = {
    uid: uid || `i${Math.floor(rng() * 1e9).toString(36)}`,
    nom: `${modele.base} ${piocher(QUALIFICATIFS[rarete], rng)}`,
    emplacement: modele.emplacement,
    glyphe: modele.glyphe,
    rarete,
    acte,
  };
  for (const s of STATS) {
    if (!modele[s]) continue;
    it[s] = s === 'vit' ? modele[s] : Math.max(1, Math.round(modele[s] * k)) * Math.sign(modele[s]);
  }
  it.prix = Math.round((18 + 14 * acte) * r.prix);
  return it;
}

/**
 * Rareté tirée au sort ; la chance du groupe fait pencher vers le haut, et
 * la `faveur` aussi — celle qu'on gagne à battre une élite (1) ou un boss (3).
 * La rareté BOSS ne se tire jamais : elle ne vient que des trophées.
 */
export function tirerRarete(rng, chance = 0, plancher = 'commun', faveur = 0) {
  const x = rng() * 100;
  let r = x < 0.5 + chance / 25 + faveur * 0.6 ? 'mythique'
    : x < 2 + chance / 8 + faveur * 2 ? 'legendaire'
      : x < 6 + chance / 2 + faveur * 3 ? 'epique'
        : x < 32 + chance ? 'rare' : 'commun';
  if (ORDRE_RARETES.indexOf(r) < ORDRE_RARETES.indexOf(plancher)) r = plancher;
  return r;
}

export function pieceAuHasard(rng, acte, { chance = 0, plancher = 'commun', emplacement = null, faveur = 0 } = {}) {
  const pool = emplacement ? MODELES.filter((m) => m.emplacement === emplacement) : MODELES;
  const m = pool[entier(rng, pool.length)];
  return forger(m, acte, tirerRarete(rng, chance, plancher, faveur), rng);
}

/** Les bonus d'une pièce, en clair. */
export function texteBonus(it) {
  const noms = { atk: 'ATQ', def: 'DEF', pv: 'PV', pm: 'PM', vit: 'VIT', crit: '% crit' };
  return STATS.filter((s) => it[s])
    .map((s) => `${it[s] > 0 ? '+' : ''}${it[s]}${s === 'crit' ? '' : ' '}${noms[s]}`).join(' · ');
}

/** Valeur approximative d'une pièce, pour comparer et conseiller. */
export const valeurPiece = (it) => !it ? 0
  : (it.atk || 0) * 3 + (it.def || 0) * 2.5 + (it.pv || 0) * 0.5 + (it.pm || 0) * 0.6
    + (it.vit || 0) * 3 + (it.crit || 0) * 0.8;
