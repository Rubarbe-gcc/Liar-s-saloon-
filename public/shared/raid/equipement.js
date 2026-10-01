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
};

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
];

/** Des qualificatifs qui ne s'accordent pas : ils vont à « une épée » comme à « un arc ». */
const QUALIFICATIFS = {
  commun: ['de fer', 'de recrue', 'de voyage', 'de garde'],
  rare: ['runique', 'd’acier fin', 'du veilleur', 'de maître'],
  epique: ['du Dragon', 'de l’Aube', 'des Anciens', 'de braise'],
};

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

/** Rareté tirée au sort ; la chance du groupe fait pencher vers le haut. */
export function tirerRarete(rng, chance = 0, plancher = 'commun') {
  const x = rng() * 100;
  let r = x < 6 + chance / 2 ? 'epique' : x < 32 + chance ? 'rare' : 'commun';
  const ordre = ['commun', 'rare', 'epique'];
  if (ordre.indexOf(r) < ordre.indexOf(plancher)) r = plancher;
  return r;
}

export function pieceAuHasard(rng, acte, { chance = 0, plancher = 'commun', emplacement = null } = {}) {
  const pool = emplacement ? MODELES.filter((m) => m.emplacement === emplacement) : MODELES;
  const m = pool[entier(rng, pool.length)];
  return forger(m, acte, tirerRarete(rng, chance, plancher), rng);
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
