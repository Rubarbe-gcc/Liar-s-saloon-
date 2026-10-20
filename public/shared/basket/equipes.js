/**
 * DOUBLE PAS — les seize clubs (tous inventés : villes, joueurs, couleurs).
 *
 * Chaque club : trois joueurs (un meneur, un ailier, un pivot) avec leurs
 * notes (vitesse, tir, passe, défense, saut), un style de jeu lu par
 * l'ordinateur (ia.js), ses tenues et son écusson (commun/ecusson.js).
 * Les notes sont réglées pour que chaque club gagne entre 35 et 65 % de ses
 * matchs (test/basket.test.js).
 *
 * Module partagé, sans DOM.
 */

/**
 * Les styles de jeu, lus par l'ordinateur :
 *   trois      : on écarte le jeu et on tire de loin
 *   interieur  : on va au cercle, on dunke
 *   etouffante : on colle son joueur, on tente les interceptions
 *   contre     : le rebond pris, on file vers l'autre panier
 *   passes     : la balle tourne vite jusqu'au tir ouvert
 *   vedette    : tous les ballons pour le meilleur joueur
 *   rebond     : on va au rebond à deux, on recommence
 *   equilibre  : un peu de tout
 */
export const STYLES = {
  trois: { nom: 'Tirs à 3 points', trois: 1.2, penetre: 0.75, passe: 1, transition: 1, serre: 0.45, vol: 0.5, rebond: 0.8, ecart: 1.15 },
  interieur: { nom: 'Jeu intérieur et dunks', trois: 0.7, penetre: 1.5, passe: 0.95, transition: 1, serre: 0.5, vol: 0.5, rebond: 1.2, ecart: 0.85 },
  etouffante: { nom: 'Défense étouffante', trois: 0.95, penetre: 1, passe: 1, transition: 1, serre: 0.8, vol: 0.85, rebond: 1, ecart: 1 },
  contre: { nom: 'Contre-attaque', trois: 1, penetre: 1.15, passe: 0.9, transition: 1.6, serre: 0.55, vol: 0.8, rebond: 0.6, ecart: 1 },
  passes: { nom: 'Passes rapides', trois: 1.05, penetre: 0.9, passe: 1.7, transition: 1.1, serre: 0.5, vol: 0.6, rebond: 0.9, ecart: 1.05 },
  vedette: { nom: 'Tout pour la vedette', trois: 1, penetre: 1.1, passe: 0.8, transition: 1, serre: 0.55, vol: 0.6, rebond: 1, ecart: 1, vedette: true },
  rebond: { nom: 'Rebonds et muscles', trois: 0.85, penetre: 1.15, passe: 0.95, transition: 0.9, serre: 0.65, vol: 0.6, rebond: 1.7, ecart: 0.9 },
  equilibre: { nom: 'Équilibré', trois: 1, penetre: 1, passe: 1, transition: 1, serre: 0.6, vol: 0.7, rebond: 1, ecart: 1 },
};

/** Les postes : M (meneur), A (ailier), P (pivot). */
export const POSTES = ['M', 'A', 'P'];
export const NOM_POSTE = { M: 'Meneur', A: 'Ailier', P: 'Pivot' };

/** Un joueur : son nom, son numéro, ses notes [vitesse, tir, passe, défense, saut], la vedette du club ? */
const j = (nom, numero, [vitesse, tir, passe, defense, saut], vedette = false) => ({ nom, numero, notes: { vitesse, tir, passe, defense, saut }, vedette });
const kit = (fond, motif, motifC, short, num) => ({ fond, motif, motifC, short, bas: '#f4f4f4', num });

export const EQUIPES = [
  {
    id: 'valrose', nom: 'Comètes de Valrose', court: 'Valrose', abr: 'VAL', ville: 'Valrose',
    devise: 'De loin, encore plus loin.',
    maillot: kit('#ff5fa2', 'uni', '#ffffff', '#ff5fa2', '#ffffff'),
    exterieur: kit('#ffffff', 'bande', '#ff5fa2', '#ffffff', '#ff5fa2'),
    ecusson: { forme: 'rond', fond: '#ff5fa2', fond2: '#ffffff', motif: 'uni', symbole: 'etoile', symboleC: '#ffffff', bord: '#7a1d48' },
    style: 'trois',
    joueurs: [j('Lilou Varenne', 3, [80, 91, 80, 67, 62]), j('Max Darbois', 11, [74, 95, 71, 65, 64], true), j('Noé Castagne', 33, [62, 79, 65, 73, 74])],
  },
  {
    id: 'fort-granit', nom: 'Titans de Fort-Granit', court: 'Fort-Granit', abr: 'FGR', ville: 'Fort-Granit',
    devise: 'Au cercle, et plus haut que lui.',
    maillot: kit('#5a5f6b', 'bande', '#ffb000', '#3a3d44', '#ffb000'),
    exterieur: kit('#ffb000', 'uni', '#3a3d44', '#ffb000', '#3a3d44'),
    ecusson: { forme: 'hexagone', fond: '#5a5f6b', fond2: '#3a3d44', motif: 'chevron', symbole: 'montagne', symboleC: '#ffb000', bord: '#ffb000' },
    style: 'interieur',
    joueurs: [j('Rayan Morvel', 7, [78, 73, 75, 69, 70]), j('Bastien Crozat', 21, [72, 69, 64, 73, 84]), j('Ousmane Terrail', 50, [63, 65, 60, 80, 90], true)],
  },
  {
    id: 'port-celeste', nom: 'Mistral de Port-Céleste', court: 'Port-Céleste', abr: 'PCE', ville: 'Port-Céleste',
    devise: 'Le rebond pris, le vent se lève.',
    maillot: kit('#38b6ff', 'uni', '#ffffff', '#38b6ff', '#0b2a4a'),
    exterieur: kit('#0b2a4a', 'bande', '#38b6ff', '#0b2a4a', '#ffffff'),
    ecusson: { forme: 'bouclier', fond: '#38b6ff', fond2: '#0b2a4a', motif: 'bande', symbole: 'vague', symboleC: '#ffffff', bord: '#0b2a4a' },
    style: 'contre',
    joueurs: [j('Kenzo Albaret', 1, [92, 76, 74, 69, 70]), j('Jules Ferrière', 8, [88, 77, 68, 68, 74], true), j('Timéo Rasselin', 24, [78, 66, 62, 72, 78])],
  },
  {
    id: 'montbrume', nom: 'Hiboux de Montbrume', court: 'Montbrume', abr: 'MBR', ville: 'Montbrume',
    devise: 'Ici, on ne passe pas.',
    maillot: kit('#4b2e83', 'uni', '#c9b8ff', '#4b2e83', '#ffffff'),
    exterieur: kit('#c9b8ff', 'uni', '#4b2e83', '#c9b8ff', '#4b2e83'),
    ecusson: { forme: 'blason', fond: '#4b2e83', fond2: '#2a1a4a', motif: 'demi', symbole: 'lune', symboleC: '#c9b8ff', bord: '#c9b8ff' },
    style: 'etouffante',
    joueurs: [j('Adam Pellegrin', 4, [78, 70, 72, 79, 66]), j('Sacha Lermont', 12, [74, 68, 64, 81, 72], true), j('Gaspard Ollivaud', 41, [62, 62, 60, 80, 80])],
  },
  {
    id: 'mielville', nom: 'Abeilles de Mielville', court: 'Mielville', abr: 'MIE', ville: 'Mielville',
    devise: 'La balle va plus vite que toi.',
    maillot: kit('#ffd23f', 'cerceaux', '#1d1d1d', '#1d1d1d', '#1d1d1d'),
    exterieur: kit('#1d1d1d', 'uni', '#ffd23f', '#1d1d1d', '#ffd23f'),
    ecusson: { forme: 'hexagone', fond: '#ffd23f', fond2: '#1d1d1d', motif: 'rayures', symbole: 'aile', symboleC: '#1d1d1d', bord: '#1d1d1d' },
    style: 'passes',
    joueurs: [j('Nino Briançon', 2, [80, 78, 92, 68, 62], true), j('Hugo Davesnes', 9, [74, 82, 82, 66, 64]), j('Marius Tessandier', 32, [64, 71, 76, 73, 74])],
  },
  {
    id: 'saint-aurel', nom: 'Rois de Saint-Aurel', court: 'Saint-Aurel', abr: 'SAU', ville: 'Saint-Aurel',
    devise: 'Donnez-lui le ballon.',
    maillot: kit('#7a1f2b', 'uni', '#f2c14e', '#7a1f2b', '#f2c14e'),
    exterieur: kit('#f2c14e', 'uni', '#7a1f2b', '#f2c14e', '#7a1f2b'),
    ecusson: { forme: 'bouclier', fond: '#7a1f2b', fond2: '#4a1018', motif: 'uni', symbole: 'couronne', symboleC: '#f2c14e', bord: '#f2c14e' },
    style: 'vedette',
    joueurs: [j('Élias Montclar', 23, [88, 92, 80, 74, 84], true), j('Luc Fabreguette', 5, [68, 66, 70, 66, 60]), j('Amaury Vidalenc', 15, [58, 58, 56, 70, 72])],
  },
  {
    id: 'grand-recif', nom: 'Requins de Grand-Récif', court: 'Grand-Récif', abr: 'GRE', ville: 'Grand-Récif',
    devise: 'Chaque ballon qui tombe est à nous.',
    maillot: kit('#0f6e6e', 'bande', '#9ff0e0', '#0f6e6e', '#ffffff'),
    exterieur: kit('#e8fffb', 'uni', '#0f6e6e', '#e8fffb', '#0f6e6e'),
    ecusson: { forme: 'losange', fond: '#0f6e6e', fond2: '#083a3a', motif: 'chevron', symbole: 'ancre', symboleC: '#9ff0e0', bord: '#9ff0e0' },
    style: 'rebond',
    joueurs: [j('Malo Kerbiriou', 6, [74, 70, 70, 73, 74]), j('Yanis Prudhomme', 14, [68, 66, 62, 75, 85]), j('Victor Mabillon', 44, [58, 60, 58, 79, 91], true)],
  },
  {
    id: 'braise', nom: 'Volcans de Braise-sur-Mont', court: 'Braise', abr: 'BRA', ville: 'Braise-sur-Mont',
    devise: 'Ça finit toujours par exploser.',
    maillot: kit('#e0362c', 'uni', '#ff9a1a', '#1f1f1f', '#ffffff'),
    exterieur: kit('#1f1f1f', 'bande', '#e0362c', '#1f1f1f', '#ff9a1a'),
    ecusson: { forme: 'blason', fond: '#1f1f1f', fond2: '#e0362c', motif: 'demi', symbole: 'flamme', symboleC: '#ff9a1a', bord: '#e0362c' },
    style: 'interieur',
    joueurs: [j('Samy Quéméner', 10, [84, 72, 72, 66, 72]), j('Arthur Lenglet', 25, [76, 68, 62, 70, 86], true), j('Cédric Ambrun', 52, [64, 60, 58, 76, 86])],
  },
  {
    id: 'neigeval', nom: 'Lynx de Neigeval', court: 'Neigeval', abr: 'NEI', ville: 'Neigeval',
    devise: 'Froids devant, glacés derrière.',
    maillot: kit('#e8f4ff', 'uni', '#2a5d8f', '#e8f4ff', '#2a5d8f'),
    exterieur: kit('#2a5d8f', 'uni', '#e8f4ff', '#2a5d8f', '#e8f4ff'),
    ecusson: { forme: 'rond', fond: '#2a5d8f', fond2: '#e8f4ff', motif: 'croix', symbole: 'montagne', symboleC: '#e8f4ff', bord: '#e8f4ff' },
    style: 'etouffante',
    joueurs: [j('Léon Sarrazin', 0, [84, 72, 74, 78, 64], true), j('Paul Vernadet', 13, [76, 71, 66, 78, 70]), j('Romain Castellane', 35, [64, 64, 60, 77, 78])],
  },
  {
    id: 'lumen', nom: 'Étincelles de Lumen', court: 'Lumen', abr: 'LUM', ville: 'Lumen',
    devise: 'Une étincelle, et le filet s’allume.',
    maillot: kit('#2a2a5a', 'bande', '#ffe066', '#2a2a5a', '#ffe066'),
    exterieur: kit('#ffe066', 'uni', '#2a2a5a', '#ffe066', '#2a2a5a'),
    ecusson: { forme: 'losange', fond: '#2a2a5a', fond2: '#14143a', motif: 'uni', symbole: 'eclair', symboleC: '#ffe066', bord: '#ffe066' },
    style: 'trois',
    joueurs: [j('Isaac Delorme', 30, [84, 95, 77, 66, 61], true), j('Tom Rivasseau', 17, [78, 90, 75, 68, 65]), j('Clovis Andrieu', 42, [64, 78, 64, 76, 78])],
  },
  {
    id: 'anse-noire', nom: 'Corsaires de l’Anse-Noire', court: 'Anse-Noire', abr: 'ANS', ville: 'L’Anse-Noire',
    devise: 'Un ballon volé, deux points de plus.',
    maillot: kit('#151515', 'uni', '#e6e6e6', '#151515', '#e6e6e6'),
    exterieur: kit('#e6e6e6', 'bande', '#151515', '#e6e6e6', '#151515'),
    ecusson: { forme: 'bouclier', fond: '#151515', fond2: '#3a3a3a', motif: 'croix', symbole: 'ancre', symboleC: '#e6e6e6', bord: '#c23b3b' },
    style: 'contre',
    joueurs: [j('Nathan Corbières', 1, [90, 74, 72, 70, 66]), j('Enzo Belcastel', 22, [86, 74, 66, 72, 76], true), j('Loris Mazargues', 31, [74, 62, 60, 72, 80])],
  },
  {
    id: 'bellerive', nom: 'Ondes de Bellerive', court: 'Bellerive', abr: 'BEL', ville: 'Bellerive',
    devise: 'Une passe de plus, toujours.',
    maillot: kit('#2fd7a8', 'uni', '#0b3b40', '#2fd7a8', '#0b3b40'),
    exterieur: kit('#0b3b40', 'uni', '#2fd7a8', '#0b3b40', '#2fd7a8'),
    ecusson: { forme: 'rond', fond: '#2fd7a8', fond2: '#0b3b40', motif: 'cerceaux', symbole: 'mouette', symboleC: '#ffffff', bord: '#0b3b40' },
    style: 'passes',
    joueurs: [j('Félix Arnaudet', 5, [79, 80, 88, 73, 63]), j('Robin Chastaing', 19, [75, 82, 86, 71, 67], true), j('Axel Penvern', 40, [63, 71, 78, 77, 77])],
  },
  {
    id: 'haute-plaine', nom: 'Faucons de Haute-Plaine', court: 'Haute-Plaine', abr: 'HPL', ville: 'Haute-Plaine',
    devise: 'Voir plus loin, frapper plus juste.',
    maillot: kit('#8a5a2b', 'uni', '#f0e0c0', '#8a5a2b', '#f0e0c0'),
    exterieur: kit('#f0e0c0', 'uni', '#8a5a2b', '#f0e0c0', '#8a5a2b'),
    ecusson: { forme: 'blason', fond: '#8a5a2b', fond2: '#f0e0c0', motif: 'chevron', symbole: 'aile', symboleC: '#f0e0c0', bord: '#4a2e12' },
    style: 'equilibre',
    joueurs: [j('Gabin Lachaud', 8, [80, 80, 78, 72, 66]), j('Ilyes Mornac', 20, [76, 80, 70, 72, 72], true), j('Thibault Renoir', 34, [64, 70, 64, 76, 80])],
  },
  {
    id: 'terre-rouge', nom: 'Bisons de Terre-Rouge', court: 'Terre-Rouge', abr: 'TRO', ville: 'Terre-Rouge',
    devise: 'On pousse, on prend, on remet.',
    maillot: kit('#b5492a', 'bande', '#f3d6a0', '#5a2412', '#f3d6a0'),
    exterieur: kit('#f3d6a0', 'uni', '#b5492a', '#f3d6a0', '#5a2412'),
    ecusson: { forme: 'hexagone', fond: '#b5492a', fond2: '#5a2412', motif: 'bande', symbole: 'enclume', symboleC: '#f3d6a0', bord: '#5a2412' },
    style: 'rebond',
    joueurs: [j('Kylian Dufresnay', 3, [78, 70, 70, 71, 72]), j('Martin Escoffier', 16, [72, 67, 62, 77, 83], true), j('Bruno Talmont', 45, [60, 58, 56, 81, 89])],
  },
  {
    id: 'cendrecourt', nom: 'Phénix de Cendrecourt', court: 'Cendrecourt', abr: 'CEN', ville: 'Cendrecourt',
    devise: 'Il renaît à chaque match.',
    maillot: kit('#ff7a1a', 'uni', '#7a1f00', '#ff7a1a', '#ffffff'),
    exterieur: kit('#3a1200', 'uni', '#ff7a1a', '#3a1200', '#ff7a1a'),
    ecusson: { forme: 'rond', fond: '#3a1200', fond2: '#ff7a1a', motif: 'demi', symbole: 'flamme', symboleC: '#ffd166', bord: '#ff7a1a' },
    style: 'vedette',
    joueurs: [j('Dylan Courtenay', 9, [62, 66, 62, 72, 70]), j('Oscar Vaillandet', 27, [85, 80, 76, 73, 88], true), j('Rémi Pontaillac', 38, [58, 56, 54, 74, 76])],
  },
  {
    id: 'ventenac', nom: 'Moulins de Ventenac', court: 'Ventenac', abr: 'VEN', ville: 'Ventenac',
    devise: 'Le vent tourne, nous aussi.',
    maillot: kit('#3c8d3c', 'uni', '#ffffff', '#3c8d3c', '#ffffff'),
    exterieur: kit('#ffffff', 'uni', '#3c8d3c', '#ffffff', '#3c8d3c'),
    ecusson: { forme: 'losange', fond: '#3c8d3c', fond2: '#ffffff', motif: 'croix', symbole: 'roue', symboleC: '#ffffff', bord: '#1d4a1d' },
    style: 'equilibre',
    joueurs: [j('Aurélien Bessac', 6, [78, 76, 76, 74, 66]), j('Jonas Carvalet', 18, [74, 76, 70, 74, 72]), j('Mathis Ordonneau', 43, [62, 66, 62, 78, 82], true)],
  },
];

export const EQUIPE = Object.fromEntries(EQUIPES.map((e) => [e.id, e]));

/** Les notes d'un joueur (bornées). */
export function notesJoueur(eq, i) {
  const n = { ...eq.joueurs[i].notes };
  for (const k of Object.keys(n)) n[k] = Math.max(30, Math.min(99, n[k]));
  return n;
}

/** Les notes moyennes d'une équipe (pour l'affichage). */
export function notesEquipe(eq) {
  const n = { vitesse: 0, tir: 0, passe: 0, defense: 0, saut: 0 };
  for (const p of eq.joueurs) for (const k of Object.keys(n)) n[k] += p.notes[k] / eq.joueurs.length;
  for (const k of Object.keys(n)) n[k] = Math.round(n[k]);
  return n;
}

/** La note générale d'une équipe. */
export const noteGenerale = (eq) => { const n = notesEquipe(eq); return Math.round((n.vitesse + n.tir + n.passe + n.defense + n.saut) / 5); };

/** La note d'un joueur (pour les cartes). */
export const noteJoueur = (eq, i) => { const n = eq.joueurs[i].notes; return Math.round((n.vitesse + n.tir + n.passe + n.defense + n.saut) / 5); };
