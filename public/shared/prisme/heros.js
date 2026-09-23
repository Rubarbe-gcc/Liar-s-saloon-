/**
 * PRISME — la garnison.
 *
 * Quinze héros, trois par affinité, répartis en trois rôles : l'assaut frappe
 * fort, le colosse encaisse, le soutien répare ou prépare. Les six héros que
 * l'on emmène partagent une seule barre de vie : perdre, c'est vider la barre
 * commune, jamais un personnage isolé. C'est ce qui fait qu'un colosse sert à
 * quelque chose même quand il ne frappe pas — ses points de vie comptent pour
 * toute l'équipe.
 *
 * Trois leviers d'équipe se superposent :
 *   • le MENEUR, premier héros de la liste, dope toute la garnison ;
 *   • les RÉSONANCES, étiquettes communes à deux héros d'une même rotation ;
 *   • les PASSIFS, propres à chacun et toujours actifs.
 *
 * Module ISO : ni DOM ni Node.
 */

import { CYCLE } from './affinites.js';

/* ------------------------------------------------------------------ */
/* Rôles                                                               */
/* ------------------------------------------------------------------ */

export const ROLES = {
  assaut:  { nom: 'Assaut',  glyphe: '🗡', teinte: '#ff6b81', texte: 'Frappe fort, encaisse mal.' },
  colosse: { nom: 'Colosse', glyphe: '🛡', teinte: '#7dd3fc', texte: 'Gonfle la barre de vie et tient le choc.' },
  soutien: { nom: 'Soutien', glyphe: '✚', teinte: '#a3e635', texte: 'Répare, protège, prépare le tour suivant.' },
};

/* ------------------------------------------------------------------ */
/* Effets et passifs                                                   */
/* ------------------------------------------------------------------ */

/**
 * Effets déclenchés par une attaque spéciale. Le moteur les lit, l'écran les
 * raconte : tout ce qui est écrit ici doit avoir un sens dans `combat.js`.
 */
export const EFFETS = {
  soin:     { nom: 'Soin',      texte: (v) => `rend ${Math.round(v * 100)} % de la vie d'équipe` },
  garde:    { nom: 'Garde',     texte: (v) => `réduit les dégâts subis de ${Math.round(v * 100)} % ce tour` },
  elan:     { nom: 'Élan',      texte: (v) => `+${Math.round(v * 100)} % d'attaque à l'équipe au tour suivant` },
  entrave:  { nom: 'Entrave',   texte: (v) => `−${Math.round(v * 100)} % d'attaque à l'ennemi au tour suivant` },
  brasier:  { nom: 'Brasier',   texte: (v) => `brûle l'ennemi de ${Math.round(v * 100)} % des dégâts, deux tours` },
  perce:    { nom: 'Perce',     texte: (v) => `ignore ${Math.round(v * 100)} % de la défense` },
  vol:      { nom: 'Drain',     texte: (v) => `rend ${Math.round(v * 100)} % des dégâts en vie` },
  double:   { nom: 'Doublé',    texte: () => 'frappe deux fois' },
  ki:       { nom: 'Ressac',    texte: (v) => `+${v} ki aux alliés restants du tour` },
};

export const PASSIFS = {
  rage:         { nom: 'Rage',         texte: (v) => `+${Math.round(v * 100)} % d'attaque sous la moitié de vie` },
  rempart:      { nom: 'Rempart',      texte: (v) => `−${Math.round(v * 100)} % de dégâts subis` },
  flux:         { nom: 'Flux',         texte: (v) => `+${v} ki au départ de chaque tour` },
  meute:        { nom: 'Meute',        texte: (v) => `+${Math.round(v * 100)} % d'attaque par allié de même affinité en rotation` },
  opportuniste: { nom: 'Opportuniste', texte: (v) => `+${Math.round(v * 100)} % d'attaque quand l'affinité domine` },
  eclat:        { nom: 'Éclat',        texte: (v) => `+${Math.round(v * 100)} % d'attaque par orbe prismatique ramassée` },
  tenace:       { nom: 'Ténacité',     texte: (v) => `+${Math.round(v * 100)} % de défense quand la vie tombe sous la moitié` },
  echo:         { nom: 'Écho',         texte: (v) => `+${Math.round(v * 100)} % de dégâts sur une attaque ultime` },
};

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

const h = (o) => o;

export const HEROS = [
  /* ---------------------------- VERMEIL ---------------------------- */
  h({
    id: 'ignar', nom: 'Ignar', titre: 'le Poing Fauve', affinite: 'vermeil', role: 'assaut',
    pv: 9800, atk: 5400, def: 2500,
    special: { nom: 'Fracas écarlate', mult: 2.35, effet: null },
    ultime:  { nom: 'Météore Ignar', mult: 3.7, effet: { type: 'brasier', valeur: 0.18 } },
    passif:  { type: 'rage', valeur: 0.25 },
    liens: ['brasier', 'duelliste'],
    meneur: { cible: 'vermeil', atk: 0.4, def: 0.15, texte: 'Vermeil : +40 % ATK, +15 % DEF' },
  }),
  h({
    id: 'torval', nom: 'Torval', titre: "l'Enclume", affinite: 'vermeil', role: 'colosse',
    pv: 16200, atk: 3900, def: 4500,
    special: { nom: 'Contre-enclume', mult: 2.1, effet: { type: 'garde', valeur: 0.35 } },
    ultime:  { nom: 'Chute de forge', mult: 3.2, effet: { type: 'entrave', valeur: 0.25 } },
    passif:  { type: 'rempart', valeur: 0.12 },
    liens: ['brasier', 'muraille'],
    meneur: { cible: 'tous', pv: 0.2, def: 0.2, texte: 'Toute affinité : +20 % PV, +20 % DEF' },
  }),
  h({
    id: 'sarane', nom: 'Sarane', titre: 'la Flamme Douce', affinite: 'vermeil', role: 'soutien',
    pv: 11800, atk: 4250, def: 3300,
    special: { nom: 'Braise vive', mult: 1.95, effet: { type: 'soin', valeur: 0.11 } },
    ultime:  { nom: 'Aube incandescente', mult: 3.0, effet: { type: 'elan', valeur: 0.25 } },
    passif:  { type: 'flux', valeur: 2 },
    liens: ['brasier', 'guérisseur'],
    meneur: { cible: 'vermeil', atk: 0.25, pv: 0.25, texte: 'Vermeil : +25 % ATK, +25 % PV' },
  }),

  /* ------------------------------ JADE ----------------------------- */
  h({
    id: 'vireo', nom: 'Viréo', titre: 'la Lame Verte', affinite: 'jade', role: 'assaut',
    pv: 10100, atk: 5250, def: 2700,
    special: { nom: 'Fauchaison', mult: 2.3, effet: null },
    ultime:  { nom: 'Ronce mille-lames', mult: 3.55, effet: { type: 'double' } },
    passif:  { type: 'opportuniste', valeur: 0.3 },
    liens: ['sylve', 'duelliste'],
    meneur: { cible: 'jade', atk: 0.4, def: 0.15, texte: 'Jade : +40 % ATK, +15 % DEF' },
  }),
  h({
    id: 'ronce', nom: 'Ronce', titre: 'la Sentinelle', affinite: 'jade', role: 'colosse',
    pv: 16800, atk: 3750, def: 4600,
    special: { nom: 'Haie vive', mult: 2.05, effet: { type: 'garde', valeur: 0.38 } },
    ultime:  { nom: 'Enracinement', mult: 3.1, effet: { type: 'soin', valeur: 0.1 } },
    passif:  { type: 'tenace', valeur: 0.3 },
    liens: ['sylve', 'muraille'],
    meneur: { cible: 'tous', pv: 0.3, atk: 0.1, texte: 'Toute affinité : +30 % PV, +10 % ATK' },
  }),
  h({
    id: 'melisse', nom: 'Mélisse', titre: "l'Herboriste", affinite: 'jade', role: 'soutien',
    pv: 12200, atk: 4100, def: 3350,
    special: { nom: 'Cataplasme', mult: 1.85, effet: { type: 'soin', valeur: 0.14 } },
    ultime:  { nom: 'Floraison', mult: 2.9, effet: { type: 'soin', valeur: 0.2 } },
    passif:  { type: 'rempart', valeur: 0.08 },
    liens: ['sylve', 'guérisseur'],
    meneur: { cible: 'jade', atk: 0.25, pv: 0.25, texte: 'Jade : +25 % ATK, +25 % PV' },
  }),

  /* ---------------------------- POURPRE ---------------------------- */
  h({
    id: 'nyx', nom: 'Nyx', titre: "l'Œil Violet", affinite: 'pourpre', role: 'assaut',
    pv: 9600, atk: 5500, def: 2450,
    special: { nom: 'Regard fendu', mult: 2.4, effet: { type: 'perce', valeur: 0.3 } },
    ultime:  { nom: 'Éclipse', mult: 3.75, effet: { type: 'perce', valeur: 0.5 } },
    passif:  { type: 'echo', valeur: 0.15 },
    liens: ['arcane', 'duelliste'],
    meneur: { cible: 'pourpre', atk: 0.4, def: 0.15, texte: 'Pourpre : +40 % ATK, +15 % DEF' },
  }),
  h({
    id: 'obsidia', nom: 'Obsidia', titre: "la Muraille d'Ombre", affinite: 'pourpre', role: 'colosse',
    pv: 16400, atk: 3850, def: 4550,
    special: { nom: 'Voile obsidien', mult: 2.0, effet: { type: 'garde', valeur: 0.4 } },
    ultime:  { nom: 'Nuit sans fond', mult: 3.15, effet: { type: 'entrave', valeur: 0.3 } },
    passif:  { type: 'rempart', valeur: 0.13 },
    liens: ['arcane', 'muraille'],
    meneur: { cible: 'tous', def: 0.3, pv: 0.15, texte: 'Toute affinité : +30 % DEF, +15 % PV' },
  }),
  h({
    id: 'vesper', nom: 'Vesper', titre: 'le Liseur d’Astres', affinite: 'pourpre', role: 'soutien',
    pv: 11900, atk: 4200, def: 3300,
    special: { nom: 'Présage', mult: 1.9, effet: { type: 'ki', valeur: 4 } },
    ultime:  { nom: 'Conjonction', mult: 2.95, effet: { type: 'elan', valeur: 0.3 } },
    passif:  { type: 'flux', valeur: 2 },
    liens: ['arcane', 'guérisseur'],
    meneur: { cible: 'pourpre', atk: 0.25, pv: 0.25, texte: 'Pourpre : +25 % ATK, +25 % PV' },
  }),

  /* ----------------------------- AMBRE ----------------------------- */
  h({
    id: 'dune', nom: 'Dune', titre: 'le Colporteur', affinite: 'ambre', role: 'assaut',
    pv: 9900, atk: 5300, def: 2600,
    special: { nom: 'Lame de sable', mult: 2.3, effet: { type: 'vol', valeur: 0.2 } },
    ultime:  { nom: 'Tempête ocre', mult: 3.6, effet: { type: 'vol', valeur: 0.3 } },
    passif:  { type: 'eclat', valeur: 0.08 },
    liens: ['errant', 'duelliste'],
    meneur: { cible: 'ambre', atk: 0.4, def: 0.15, texte: 'Ambre : +40 % ATK, +15 % DEF' },
  }),
  h({
    id: 'ocre', nom: 'Ocre', titre: 'le Bouclier Doré', affinite: 'ambre', role: 'colosse',
    pv: 16600, atk: 3800, def: 4550,
    special: { nom: 'Rempart doré', mult: 2.05, effet: { type: 'garde', valeur: 0.37 } },
    ultime:  { nom: 'Serment d’or', mult: 3.1, effet: { type: 'soin', valeur: 0.09 } },
    passif:  { type: 'tenace', valeur: 0.28 },
    liens: ['errant', 'muraille'],
    meneur: { cible: 'tous', pv: 0.25, def: 0.25, texte: 'Toute affinité : +25 % PV, +25 % DEF' },
  }),
  h({
    id: 'solen', nom: 'Solen', titre: "l'Horloger", affinite: 'ambre', role: 'soutien',
    pv: 12000, atk: 4150, def: 3300,
    special: { nom: 'Rouage', mult: 1.9, effet: { type: 'ki', valeur: 4 } },
    ultime:  { nom: 'Mécanique céleste', mult: 2.95, effet: { type: 'entrave', valeur: 0.28 } },
    passif:  { type: 'flux', valeur: 2 },
    liens: ['errant', 'guérisseur'],
    meneur: { cible: 'ambre', atk: 0.25, pv: 0.25, texte: 'Ambre : +25 % ATK, +25 % PV' },
  }),

  /* ------------------------------ AZUR ----------------------------- */
  h({
    id: 'zephyr', nom: 'Zéphyr', titre: 'le Pas Léger', affinite: 'azur', role: 'assaut',
    pv: 9700, atk: 5350, def: 2550,
    special: { nom: 'Trait de vent', mult: 2.35, effet: { type: 'double' } },
    ultime:  { nom: 'Cyclone bleu', mult: 3.65, effet: { type: 'double' } },
    passif:  { type: 'meute', valeur: 0.15 },
    liens: ['tempête', 'duelliste'],
    meneur: { cible: 'azur', atk: 0.4, def: 0.15, texte: 'Azur : +40 % ATK, +15 % DEF' },
  }),
  h({
    id: 'nimbe', nom: 'Nimbe', titre: 'le Gardien des Brumes', affinite: 'azur', role: 'colosse',
    pv: 16500, atk: 3820, def: 4520,
    special: { nom: 'Brume épaisse', mult: 2.05, effet: { type: 'garde', valeur: 0.36 } },
    ultime:  { nom: 'Front froid', mult: 3.12, effet: { type: 'entrave', valeur: 0.27 } },
    passif:  { type: 'rempart', valeur: 0.12 },
    liens: ['tempête', 'muraille'],
    meneur: { cible: 'tous', pv: 0.2, def: 0.2, atk: 0.05, texte: 'Toute affinité : +20 % PV, +20 % DEF, +5 % ATK' },
  }),
  h({
    id: 'marel', nom: 'Marel', titre: 'la Vague', affinite: 'azur', role: 'soutien',
    pv: 12100, atk: 4150, def: 3320,
    special: { nom: 'Ressac', mult: 1.9, effet: { type: 'soin', valeur: 0.12 } },
    ultime:  { nom: 'Marée haute', mult: 2.92, effet: { type: 'elan', valeur: 0.28 } },
    passif:  { type: 'flux', valeur: 2 },
    liens: ['tempête', 'guérisseur'],
    meneur: { cible: 'azur', atk: 0.25, pv: 0.25, texte: 'Azur : +25 % ATK, +25 % PV' },
  }),
];

export const PAR_ID = Object.fromEntries(HEROS.map((x) => [x.id, x]));

export const parAffinite = (a) => HEROS.filter((x) => x.affinite === a);
export const parRole = (r) => HEROS.filter((x) => x.role === r);

/* ------------------------------------------------------------------ */
/* Équilibrage                                                         */
/* ------------------------------------------------------------------ */

/**
 * Prix d'un héros. Il n'existe que pour les tests : si deux héros du même rôle
 * s'écartent trop, c'est qu'un chiffre a glissé. Les coefficients pèsent ce
 * qu'une statistique rapporte réellement en combat — les PV comptent peu à
 * l'unité parce qu'ils se comptent par milliers.
 */
export const PRIX = { pv: 1 / 28, atk: 1 / 5.2, def: 1 / 9 };

export function budgetOf(x) {
  return Math.round(x.pv * PRIX.pv + x.atk * PRIX.atk + x.def * PRIX.def);
}

/** Puissance moyenne des deux spéciales : un assaut doit la payer quelque part. */
export function fougueOf(x) {
  return (x.special.mult + x.ultime.mult) / 2;
}

/** Équipe au hasard, pour le bouton « au hasard » et les simulations. */
export function equipeAuHasard(rng = Math.random, taille = 6) {
  const pot = [...HEROS];
  for (let i = pot.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pot[i], pot[j]] = [pot[j], pot[i]];
  }
  return pot.slice(0, taille);
}

/** Une équipe équilibrée pour démarrer : deux colosses, deux assauts, deux soutiens. */
export function equipeParDefaut() {
  return ['torval', 'ignar', 'melisse', 'vireo', 'nyx', 'marel'].map((id) => PAR_ID[id]);
}

export const AFFINITES_ORDRE = CYCLE;
