/**
 * RAID — le roster de la guilde.
 *
 * Quinze personnages, trois par école de magie, répartis sur les trois rôles
 * qui font tenir un groupe : le tank encaisse, le soigneur répare, le DPS
 * fait tomber la barre du boss. On en emmène six, et les six partagent la
 * même barre de vie — celle du raid. C'est ce qui donne son prix à un tank :
 * ses points de vie sont ceux de tout le monde, même les tours où il ne
 * frappe pas.
 *
 * Trois leviers se superposent :
 *   • le CHEF DE RAID, premier de la liste, applique son buff à tout le monde ;
 *   • les SYNERGIES, étiquettes communes à deux personnages d'un même groupe ;
 *   • les TALENTS, propres à chacun et toujours actifs.
 *
 * Module ISO : ni DOM ni Node.
 */

import { CYCLE } from './ecoles.js';

/* ------------------------------------------------------------------ */
/* Rôles et peuples                                                    */
/* ------------------------------------------------------------------ */

export const ROLES = {
  dps:      { nom: 'DPS',      glyphe: '🗡', teinte: '#ff6b81', texte: 'Fait tomber la barre du boss. Encaisse mal.' },
  tank:     { nom: 'Tank',     glyphe: '🛡', teinte: '#7dd3fc', texte: 'Gonfle la barre du raid et tient le choc.' },
  soigneur: { nom: 'Soigneur', glyphe: '✚', teinte: '#a3e635', texte: 'Répare, protège, prépare le tour suivant.' },
};

/** Les peuples ne changent rien aux règles : ils donnent le teint du sprite. */
export const PEUPLES = {
  humain:      { nom: 'Humain',      peau: '#f3cfa8' },
  nain:        { nom: 'Nain',        peau: '#e7b993' },
  elfe:        { nom: 'Elfe',        peau: '#ecdcc8' },
  orc:         { nom: 'Orc',         peau: '#7fae5a' },
  gobelin:     { nom: 'Gobelin',     peau: '#a8c94f' },
  gnome:       { nom: 'Gnome',       peau: '#f7d6b4' },
  troll:       { nom: 'Troll',       peau: '#79b5a4' },
  mortvivant:  { nom: 'Mort-vivant', peau: '#b6c6bd' },
};

/* ------------------------------------------------------------------ */
/* Sorts et talents                                                    */
/* ------------------------------------------------------------------ */

/**
 * Effets portés par les sorts. Le moteur les lit, l'écran les raconte : ce
 * qui est écrit ici doit avoir un sens dans `combat.js`.
 */
export const EFFETS = {
  soin:     { nom: 'Soin',        texte: (v) => `rend ${Math.round(v * 100)} % de la vie du raid` },
  garde:    { nom: 'Bouclier',    texte: (v) => `absorbe ${Math.round(v * 100)} % des dégâts subis ce tour` },
  elan:     { nom: 'Buff',        texte: (v) => `+${Math.round(v * 100)} % d'attaque au raid au tour suivant` },
  entrave:  { nom: 'Affaiblissement', texte: (v) => `−${Math.round(v * 100)} % d'attaque au boss au tour suivant` },
  brasier:  { nom: 'Brûlure',     texte: (v) => `pose un dot de ${Math.round(v * 100)} % des dégâts, deux tours` },
  perce:    { nom: 'Perce-armure', texte: (v) => `ignore ${Math.round(v * 100)} % de l'armure` },
  vol:      { nom: 'Drain',       texte: (v) => `rend ${Math.round(v * 100)} % des dégâts en vie` },
  double:   { nom: 'Doublé',      texte: () => 'frappe deux fois' },
  mana:     { nom: 'Infusion',    texte: (v) => `+${v} mana aux alliés qui n'ont pas encore joué` },
};

export const TALENTS = {
  rage:         { nom: 'Rage',            texte: (v) => `+${Math.round(v * 100)} % d'attaque sous la moitié de vie du raid` },
  plates:       { nom: 'Armure de plaques', texte: (v) => `−${Math.round(v * 100)} % de dégâts subis` },
  meditation:   { nom: 'Méditation',      texte: (v) => `+${v} mana au départ de chaque tour` },
  meute:        { nom: 'Esprit de meute', texte: (v) => `+${Math.round(v * 100)} % d'attaque par allié de même école en ligne` },
  traque:       { nom: 'Traque',          texte: (v) => `+${Math.round(v * 100)} % d'attaque sur une cible vulnérable` },
  canalisation: { nom: 'Canalisation',    texte: (v) => `+${Math.round(v * 100)} % d'attaque par globe d'essence ramassé` },
  endurance:    { nom: 'Endurance',       texte: (v) => `+${Math.round(v * 100)} % d'armure quand le raid tombe sous la moitié` },
  apotheose:    { nom: 'Apothéose',       texte: (v) => `+${Math.round(v * 100)} % de dégâts sur un sort ultime` },
};

/* ------------------------------------------------------------------ */
/* Roster                                                              */
/* ------------------------------------------------------------------ */

const h = (o) => o;

export const HEROS = [
  /* ------------------------------ SACRÉ ----------------------------- */
  h({
    id: 'brandel', nom: 'Brandel', titre: "Gardien de l'Aube",
    classe: 'Paladin', peuple: 'nain', ecole: 'sacre', role: 'tank',
    pv: 16500, atk: 3820, def: 4520,
    special: { nom: 'Bouclier béni', mana: 12, mult: 2.05, effet: { type: 'garde', valeur: 0.36 } },
    ultime:  { nom: 'Décret de la Lumière', mana: 18, mult: 3.12, effet: { type: 'entrave', valeur: 0.27 } },
    talent:  { type: 'plates', valeur: 0.12 },
    liens: ['lumière', 'gardien'],
    meneur: { nom: 'Cri de commandement', cible: 'tous', pv: 0.2, def: 0.2, atk: 0.05,
              texte: 'Tout le raid : +20 % PV, +20 % armure, +5 % ATK' },
  }),
  h({
    id: 'vaelor', nom: 'Vaelor', titre: 'Inquisiteur',
    classe: 'Croisé', peuple: 'humain', ecole: 'sacre', role: 'dps',
    pv: 9700, atk: 5350, def: 2550,
    special: { nom: 'Jugement', mana: 12, mult: 2.35, effet: { type: 'double' } },
    ultime:  { nom: "Marteau de l'Aube", mana: 18, mult: 3.65, effet: { type: 'double' } },
    talent:  { type: 'meute', valeur: 0.15 },
    liens: ['lumière', 'assaut'],
    meneur: { nom: 'Bannière de la Lumière', cible: 'sacre', atk: 0.4, def: 0.15,
              texte: 'Sacré : +40 % ATK, +15 % armure' },
  }),
  h({
    id: 'elissende', nom: 'Elissende', titre: 'Prêtresse',
    classe: 'Prêtre', peuple: 'humain', ecole: 'sacre', role: 'soigneur',
    pv: 12100, atk: 4150, def: 3320,
    special: { nom: 'Prière de soins', mana: 12, mult: 1.9, effet: { type: 'soin', valeur: 0.12 } },
    ultime:  { nom: 'Bénédiction du sanctuaire', mana: 18, mult: 2.92, effet: { type: 'elan', valeur: 0.28 } },
    talent:  { type: 'meditation', valeur: 2 },
    liens: ['lumière', 'soigneur'],
    meneur: { nom: 'Vœu du sanctuaire', cible: 'sacre', atk: 0.25, pv: 0.25,
              texte: 'Sacré : +25 % ATK, +25 % PV' },
  }),

  /* ------------------------------ OMBRE ----------------------------- */
  h({
    id: 'kraven', nom: 'Kraven', titre: 'Chevalier de Sang',
    classe: 'Chevalier de sang', peuple: 'mortvivant', ecole: 'ombre', role: 'tank',
    pv: 16400, atk: 3850, def: 4550,
    special: { nom: 'Voile funeste', mana: 12, mult: 2.0, effet: { type: 'garde', valeur: 0.4 } },
    ultime:  { nom: 'Étreinte du tombeau', mana: 18, mult: 3.15, effet: { type: 'entrave', valeur: 0.3 } },
    talent:  { type: 'plates', valeur: 0.13 },
    liens: ['profane', 'gardien'],
    meneur: { nom: 'Présence impie', cible: 'tous', def: 0.3, pv: 0.15,
              texte: 'Tout le raid : +30 % armure, +15 % PV' },
  }),
  h({
    id: 'mordrec', nom: 'Mordrec', titre: 'Démoniste',
    classe: 'Démoniste', peuple: 'mortvivant', ecole: 'ombre', role: 'dps',
    pv: 9600, atk: 5500, def: 2450,
    special: { nom: 'Trait du néant', mana: 12, mult: 2.4, effet: { type: 'perce', valeur: 0.3 } },
    ultime:  { nom: 'Effondrement', mana: 18, mult: 3.75, effet: { type: 'perce', valeur: 0.5 } },
    talent:  { type: 'apotheose', valeur: 0.15 },
    liens: ['profane', 'assaut'],
    meneur: { nom: 'Pacte obscur', cible: 'ombre', atk: 0.4, def: 0.15,
              texte: 'Ombre : +40 % ATK, +15 % armure' },
  }),
  h({
    id: 'nysha', nom: 'Nysha', titre: 'Sœur du Voile',
    classe: 'Prêtre de l’ombre', peuple: 'elfe', ecole: 'ombre', role: 'soigneur',
    pv: 11900, atk: 4200, def: 3300,
    special: { nom: 'Murmure', mana: 12, mult: 1.9, effet: { type: 'mana', valeur: 4 } },
    ultime:  { nom: 'Communion', mana: 18, mult: 2.95, effet: { type: 'elan', valeur: 0.3 } },
    talent:  { type: 'meditation', valeur: 2 },
    liens: ['profane', 'soigneur'],
    meneur: { nom: 'Litanie du Voile', cible: 'ombre', atk: 0.25, pv: 0.25,
              texte: 'Ombre : +25 % ATK, +25 % PV' },
  }),

  /* ----------------------------- NATURE ----------------------------- */
  h({
    id: 'grommur', nom: 'Grommur', titre: 'Chaman de la Terre',
    classe: 'Chaman', peuple: 'orc', ecole: 'nature', role: 'tank',
    pv: 16800, atk: 3750, def: 4600,
    special: { nom: 'Mur de pierre', mana: 12, mult: 2.05, effet: { type: 'garde', valeur: 0.38 } },
    ultime:  { nom: 'Racines telluriques', mana: 18, mult: 3.1, effet: { type: 'soin', valeur: 0.1 } },
    talent:  { type: 'endurance', valeur: 0.3 },
    liens: ['sauvage', 'gardien'],
    meneur: { nom: 'Totem d’ancrage', cible: 'tous', pv: 0.3, atk: 0.1,
              texte: 'Tout le raid : +30 % PV, +10 % ATK' },
  }),
  h({
    id: 'kaelis', nom: 'Kaelis', titre: 'Chasseresse',
    classe: 'Chasseur', peuple: 'elfe', ecole: 'nature', role: 'dps',
    pv: 10100, atk: 5250, def: 2700,
    special: { nom: 'Tir perçant', mana: 12, mult: 2.3, effet: null },
    ultime:  { nom: 'Salve de la meute', mana: 18, mult: 3.55, effet: { type: 'double' } },
    talent:  { type: 'traque', valeur: 0.3 },
    liens: ['sauvage', 'assaut'],
    meneur: { nom: 'Marque du traqueur', cible: 'nature', atk: 0.4, def: 0.15,
              texte: 'Nature : +40 % ATK, +15 % armure' },
  }),
  h({
    id: 'faeleth', nom: 'Faeleth', titre: 'Druidesse',
    classe: 'Druide', peuple: 'elfe', ecole: 'nature', role: 'soigneur',
    pv: 12200, atk: 4100, def: 3350,
    special: { nom: 'Éclosion', mana: 12, mult: 1.85, effet: { type: 'soin', valeur: 0.14 } },
    ultime:  { nom: 'Floraison sauvage', mana: 18, mult: 2.9, effet: { type: 'soin', valeur: 0.2 } },
    talent:  { type: 'plates', valeur: 0.08 },
    liens: ['sauvage', 'soigneur'],
    meneur: { nom: 'Don de la clairière', cible: 'nature', atk: 0.25, pv: 0.25,
              texte: 'Nature : +25 % ATK, +25 % PV' },
  }),

  /* ------------------------------ GIVRE ----------------------------- */
  h({
    id: 'borin', nom: 'Borin', titre: 'Rempart de Glace',
    classe: 'Guerrier', peuple: 'nain', ecole: 'givre', role: 'tank',
    pv: 16600, atk: 3800, def: 4550,
    special: { nom: 'Rempart de givre', mana: 12, mult: 2.05, effet: { type: 'garde', valeur: 0.37 } },
    ultime:  { nom: 'Serment du roc', mana: 18, mult: 3.1, effet: { type: 'soin', valeur: 0.09 } },
    talent:  { type: 'endurance', valeur: 0.28 },
    liens: ['arcane', 'gardien'],
    meneur: { nom: 'Ordre du bouclier', cible: 'tous', pv: 0.25, def: 0.25,
              texte: 'Tout le raid : +25 % PV, +25 % armure' },
  }),
  h({
    id: 'pix', nom: 'Pix', titre: 'Mage de Givre',
    classe: 'Mage', peuple: 'gnome', ecole: 'givre', role: 'dps',
    pv: 9900, atk: 5300, def: 2600,
    special: { nom: 'Morsure de gel', mana: 12, mult: 2.3, effet: { type: 'vol', valeur: 0.2 } },
    ultime:  { nom: 'Tempête blanche', mana: 18, mult: 3.6, effet: { type: 'vol', valeur: 0.3 } },
    talent:  { type: 'canalisation', valeur: 0.08 },
    liens: ['arcane', 'assaut'],
    meneur: { nom: 'Intellect partagé', cible: 'givre', atk: 0.4, def: 0.15,
              texte: 'Givre : +40 % ATK, +15 % armure' },
  }),
  h({
    id: 'thala', nom: 'Thala', titre: 'Chamane des Eaux',
    classe: 'Chaman', peuple: 'troll', ecole: 'givre', role: 'soigneur',
    pv: 12000, atk: 4150, def: 3300,
    special: { nom: 'Flot vivifiant', mana: 12, mult: 1.9, effet: { type: 'mana', valeur: 4 } },
    ultime:  { nom: 'Courant glacé', mana: 18, mult: 2.95, effet: { type: 'entrave', valeur: 0.28 } },
    talent:  { type: 'meditation', valeur: 2 },
    liens: ['arcane', 'soigneur'],
    meneur: { nom: 'Totem de source', cible: 'givre', atk: 0.25, pv: 0.25,
              texte: 'Givre : +25 % ATK, +25 % PV' },
  }),

  /* ------------------------------- FEU ------------------------------ */
  h({
    id: 'korgath', nom: 'Korgath', titre: 'Briseur de Lignes',
    classe: 'Guerrier', peuple: 'orc', ecole: 'feu', role: 'tank',
    pv: 16200, atk: 3900, def: 4500,
    special: { nom: 'Posture de fer', mana: 12, mult: 2.1, effet: { type: 'garde', valeur: 0.35 } },
    ultime:  { nom: 'Choc de guerre', mana: 18, mult: 3.2, effet: { type: 'entrave', valeur: 0.25 } },
    talent:  { type: 'rage', valeur: 0.25 },
    liens: ['fureur', 'gardien'],
    meneur: { nom: 'Cri de bataille', cible: 'tous', pv: 0.2, def: 0.2,
              texte: 'Tout le raid : +20 % PV, +20 % armure' },
  }),
  h({
    id: 'braz', nom: 'Braz', titre: 'Mage de Feu',
    classe: 'Mage', peuple: 'gobelin', ecole: 'feu', role: 'dps',
    pv: 9800, atk: 5400, def: 2500,
    special: { nom: 'Trait ardent', mana: 12, mult: 2.35, effet: null },
    ultime:  { nom: 'Pluie de braises', mana: 18, mult: 3.7, effet: { type: 'brasier', valeur: 0.18 } },
    talent:  { type: 'rage', valeur: 0.25 },
    liens: ['fureur', 'assaut'],
    meneur: { nom: 'Ferveur incendiaire', cible: 'feu', atk: 0.4, def: 0.15,
              texte: 'Feu : +40 % ATK, +15 % armure' },
  }),
  h({
    id: 'mei', nom: 'Mei', titre: 'Moine des Braises',
    classe: 'Moine', peuple: 'humain', ecole: 'feu', role: 'soigneur',
    pv: 11800, atk: 4250, def: 3300,
    special: { nom: 'Baume de braise', mana: 12, mult: 1.95, effet: { type: 'soin', valeur: 0.11 } },
    ultime:  { nom: 'Souffle du phénix', mana: 18, mult: 3.0, effet: { type: 'elan', valeur: 0.25 } },
    talent:  { type: 'meditation', valeur: 2 },
    liens: ['fureur', 'soigneur'],
    meneur: { nom: 'Chaleur du foyer', cible: 'feu', atk: 0.25, pv: 0.25,
              texte: 'Feu : +25 % ATK, +25 % PV' },
  }),
];

export const PAR_ID = Object.fromEntries(HEROS.map((x) => [x.id, x]));

export const parEcole = (e) => HEROS.filter((x) => x.ecole === e);
export const parRole = (r) => HEROS.filter((x) => x.role === r);

/* ------------------------------------------------------------------ */
/* Équilibrage                                                         */
/* ------------------------------------------------------------------ */

/**
 * Prix d'un personnage. Il n'existe que pour les tests : si deux personnages
 * du même rôle s'écartent trop, c'est qu'un chiffre a glissé. Les coefficients
 * pèsent ce qu'une statistique rapporte réellement en combat — les PV comptent
 * peu à l'unité parce qu'ils se comptent par milliers.
 */
export const PRIX = { pv: 1 / 28, atk: 1 / 5.2, def: 1 / 9 };

export function budgetOf(x) {
  return Math.round(x.pv * PRIX.pv + x.atk * PRIX.atk + x.def * PRIX.def);
}

/** Puissance moyenne des deux sorts : un DPS doit la payer quelque part. */
export function fougueOf(x) {
  return (x.special.mult + x.ultime.mult) / 2;
}

/** Groupe au hasard, pour le bouton « au hasard » et les simulations. */
export function groupeAuHasard(rng = Math.random, taille = 6) {
  const pot = [...HEROS];
  for (let i = pot.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pot[i], pot[j]] = [pot[j], pot[i]];
  }
  return pot.slice(0, taille);
}

/** Une composition qui tient debout : deux tanks, deux DPS, deux soigneurs. */
export function groupeParDefaut() {
  return ['korgath', 'braz', 'faeleth', 'kaelis', 'mordrec', 'elissende'].map((id) => PAR_ID[id]);
}

/* Anciens noms, conservés le temps que tout le code s'accorde. */
export const equipeAuHasard = groupeAuHasard;
export const equipeParDefaut = groupeParDefaut;

export const ECOLES_ORDRE = CYCLE;
