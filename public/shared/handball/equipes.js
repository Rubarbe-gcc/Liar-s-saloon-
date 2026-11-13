/**
 * ROUCOULETTE — les seize clubs (tous inventés : villes, joueurs, couleurs).
 *
 * Chaque club : sept joueurs (un gardien, deux ailiers, deux arrières, un
 * demi-centre, un pivot) avec leurs notes (vitesse, tir, passe, défense,
 * saut ; le gardien a aussi sa note de gardien), un style de jeu lu par
 * l'ordinateur (ia.js), ses tenues et son écusson (commun/ecusson.js).
 * Les notes sont réglées pour que chaque club gagne entre 35 et 65 % de ses
 * matchs (test/handball.test.js).
 *
 * Module partagé, sans DOM.
 */

/**
 * Les styles de jeu, lus par l'ordinateur :
 *   loin       : l'envie de tirer de loin (au-delà des 9 m) ;
 *   penetre    : l'envie d'aller au duel vers la zone ;
 *   pivot      : la passe au pivot ; ailes : la passe aux ailiers ;
 *   passe      : la circulation (on attend le tir ouvert) ;
 *   transition : la contre-attaque ;
 *   systeme    : la défense ('6-0' tous sur la zone, '5-1' un avancé, '3-2-1' étagée et agressive) ;
 *   monte      : jusqu'où le défenseur sort sur le porteur ; vol : les tentatives de vol.
 */
export const STYLES = {
  contre: { nom: 'Contre-attaque éclair', loin: 0.9, penetre: 1.1, pivot: 0.9, ailes: 1.15, passe: 0.9, transition: 1.7, systeme: '6-0', monte: 0.5, vol: 0.9 },
  arrieres: { nom: 'Les canonniers (tirs de loin)', loin: 1.25, penetre: 0.85, pivot: 0.8, ailes: 0.85, passe: 1, transition: 1, systeme: '6-0', monte: 0.45, vol: 0.6 },
  pivot: { nom: 'Tout pour le pivot', loin: 0.85, penetre: 1, pivot: 1.7, ailes: 0.9, passe: 1.1, transition: 0.95, systeme: '5-1', monte: 0.55, vol: 0.7 },
  ailes: { nom: 'Le jeu sur les ailes', loin: 0.9, penetre: 0.9, pivot: 0.9, ailes: 1.7, passe: 1.15, transition: 1.15, systeme: '6-0', monte: 0.5, vol: 0.7 },
  defense: { nom: 'Le mur des 6 mètres', loin: 1, penetre: 1, pivot: 1, ailes: 1, passe: 1.25, transition: 0.9, systeme: '6-0', monte: 0.3, vol: 0.55 },
  offensive: { nom: 'Défense étagée 3-2-1', loin: 1, penetre: 1.1, pivot: 1, ailes: 1, passe: 0.95, transition: 1.25, systeme: '3-2-1', monte: 0.85, vol: 1.4 },
  vedette: { nom: 'Tout pour la vedette', loin: 1.1, penetre: 1.15, pivot: 0.85, ailes: 0.85, passe: 0.85, transition: 1, systeme: '5-1', monte: 0.55, vol: 0.8, vedette: true },
  equilibre: { nom: 'Équilibré', loin: 1, penetre: 1, pivot: 1, ailes: 1, passe: 1, transition: 1, systeme: '6-0', monte: 0.5, vol: 0.75 },
};

/** Les postes : G (gardien), AG (ailier gauche), ARG (arrière gauche), DC (demi-centre), ARD (arrière droit), AD (ailier droit), PV (pivot). */
export const POSTES = ['G', 'AG', 'ARG', 'DC', 'ARD', 'AD', 'PV'];
export const NOM_POSTE = { G: 'Gardien', AG: 'Ailier gauche', ARG: 'Arrière gauche', DC: 'Demi-centre', ARD: 'Arrière droit', AD: 'Ailier droit', PV: 'Pivot' };

/** Un joueur de champ : son nom, son numéro, ses notes [vitesse, tir, passe, défense, saut], la vedette du club ? */
const j = (nom, numero, [vitesse, tir, passe, defense, saut], vedette = false) => ({ nom, numero, notes: { vitesse, tir, passe, defense, saut }, vedette });
/** Le gardien : sa note de gardien, sa vitesse et sa relance. */
const g = (nom, numero, gardien, vitesse = 62, passe = 70, vedette = false) => ({ nom, numero, notes: { vitesse, tir: 40, passe, defense: 60, saut: 60, gardien }, vedette });
const kit = (fond, motif, motifC, short, num) => ({ fond, motif, motifC, short, bas: '#f4f4f4', num });

export const EQUIPES = [
  {
    id: 'vent-d-ouest', nom: 'Goélands de Vent-d’Ouest', court: 'Vent-d’Ouest', abr: 'VDO', ville: 'Vent-d’Ouest',
    devise: 'Le ballon récupéré, on s’envole.',
    maillot: kit('#2ab3e6', 'uni', '#ffffff', '#0d3a5a', '#ffffff'),
    exterieur: kit('#ffffff', 'bande', '#2ab3e6', '#ffffff', '#0d3a5a'),
    ecusson: { forme: 'bouclier', fond: '#2ab3e6', fond2: '#0d3a5a', motif: 'bande', symbole: 'mouette', symboleC: '#ffffff', bord: '#0d3a5a' },
    style: 'contre',
    joueurs: [g('Erwan Le Guellec', 1, 74), j('Titouan Marec', 4, [92, 79, 72, 69, 76]), j('Loïc Brévannes', 9, [80, 81, 72, 73, 74]), j('Yannick Corbalan', 21, [84, 77, 80, 71, 70]),
      j('Ewen Plouzané', 11, [82, 80, 72, 73, 74], true), j('Gwendal Ruaudel', 17, [93, 80, 70, 67, 76]), j('Paol Kerdavid', 3, [72, 75, 64, 79, 70])],
  },
  {
    id: 'roche-forte', nom: 'Canons de Roche-Forte', court: 'Roche-Forte', abr: 'RCF', ville: 'Roche-Forte',
    devise: 'De neuf mètres, et ça fait trembler les filets.',
    maillot: kit('#8a1c1c', 'uni', '#e8c07a', '#3a0c0c', '#e8c07a'),
    exterieur: kit('#e8c07a', 'uni', '#8a1c1c', '#e8c07a', '#8a1c1c'),
    ecusson: { forme: 'blason', fond: '#8a1c1c', fond2: '#3a0c0c', motif: 'chevron', symbole: 'tour', symboleC: '#e8c07a', bord: '#e8c07a' },
    style: 'arrieres',
    joueurs: [g('Sylvain Duranthon', 12, 75), j('Hugo Mazerolle', 5, [80, 74, 70, 66, 70]), j('Bruno Castelnau', 33, [70, 88, 72, 72, 82], true), j('Kevin Lartigue', 8, [76, 80, 80, 68, 72]),
      j('Florent Andrieux', 27, [72, 85, 70, 70, 80]), j('Maël Sabatier', 14, [82, 74, 68, 66, 70]), j('Rodolphe Baylet', 19, [68, 72, 62, 80, 70])],
  },
  {
    id: 'brasserac', nom: 'Ours de Brasserac', court: 'Brasserac', abr: 'BRS', ville: 'Brasserac',
    devise: 'Au milieu des défenseurs, il est chez lui.',
    maillot: kit('#5b3a1e', 'cerceaux', '#f0d9a8', '#2a1a0c', '#ffffff'),
    exterieur: kit('#f0d9a8', 'uni', '#5b3a1e', '#f0d9a8', '#5b3a1e'),
    ecusson: { forme: 'hexagone', fond: '#5b3a1e', fond2: '#2a1a0c', motif: 'demi', symbole: 'montagne', symboleC: '#f0d9a8', bord: '#f0d9a8' },
    style: 'pivot',
    joueurs: [g('Damien Pellerin', 16, 74), j('Axel Vautrin', 7, [82, 75, 70, 66, 70]), j('Mathéo Garrigues', 22, [74, 77, 76, 72, 74]), j('Jordan Escudier', 10, [76, 74, 84, 70, 70]),
      j('Dorian Ferrandis', 25, [74, 76, 74, 72, 72]), j('Sami Bellocq', 2, [84, 74, 70, 66, 70]), j('Benoît Talabot', 6, [68, 82, 66, 82, 74], true)],
  },
  {
    id: 'clairmarais', nom: 'Hirondelles de Clairmarais', court: 'Clairmarais', abr: 'CLM', ville: 'Clairmarais',
    devise: 'Le ballon file d’un bout à l’autre de la ligne.',
    maillot: kit('#1f8f5a', 'uni', '#ffffff', '#0c3a24', '#ffffff'),
    exterieur: kit('#ffffff', 'bande', '#1f8f5a', '#ffffff', '#1f8f5a'),
    ecusson: { forme: 'rond', fond: '#1f8f5a', fond2: '#0c3a24', motif: 'uni', symbole: 'aile', symboleC: '#ffffff', bord: '#0c3a24' },
    style: 'ailes',
    joueurs: [g('Arnaud Vesperini', 1, 74), j('Lenny Rabasse', 18, [92, 84, 72, 66, 78], true), j('Cyril Monfajon', 23, [76, 77, 76, 72, 72]), j('Victor Lambesc', 13, [78, 74, 82, 72, 70]),
      j('Noam Orsatti', 20, [76, 77, 74, 72, 72]), j('Tom Escarras', 15, [90, 82, 72, 66, 76]), j('Gaël Fontcouverte', 4, [70, 74, 64, 80, 70])],
  },
  {
    id: 'haute-borne', nom: 'Remparts de Haute-Borne', court: 'Haute-Borne', abr: 'HBO', ville: 'Haute-Borne',
    devise: 'Les six mètres ? Personne n’y entre.',
    maillot: kit('#3a4a5e', 'uni', '#c8d4e0', '#1d2530', '#ffffff'),
    exterieur: kit('#c8d4e0', 'uni', '#3a4a5e', '#c8d4e0', '#3a4a5e'),
    ecusson: { forme: 'bouclier', fond: '#3a4a5e', fond2: '#1d2530', motif: 'croix', symbole: 'tour', symboleC: '#c8d4e0', bord: '#c8d4e0' },
    style: 'defense',
    joueurs: [g('Cédric Vallaurie', 1, 80, 64, 72, true), j('Nathan Pougnet', 3, [80, 67, 70, 71, 70]), j('Romain Sarrazac', 26, [72, 70, 72, 79, 76]), j('Thibault Ancelin', 9, [74, 68, 78, 77, 72]),
      j('Quentin Morlaàs', 24, [72, 70, 70, 79, 76]), j('Jérémy Castagnède', 7, [80, 67, 70, 71, 70]), j('Fabien Roquelaure', 5, [68, 67, 62, 83, 74])],
  },
  {
    id: 'saint-loup', nom: 'Loups de Saint-Loup-les-Bois', court: 'Saint-Loup', abr: 'SLB', ville: 'Saint-Loup-les-Bois',
    devise: 'On chasse en meute, dès la relance.',
    maillot: kit('#2d2d2d', 'bande', '#ff7a1a', '#111111', '#ff7a1a'),
    exterieur: kit('#ff7a1a', 'uni', '#2d2d2d', '#ff7a1a', '#2d2d2d'),
    ecusson: { forme: 'losange', fond: '#2d2d2d', fond2: '#111111', motif: 'chevron', symbole: 'lune', symboleC: '#ff7a1a', bord: '#ff7a1a' },
    style: 'offensive',
    joueurs: [g('Jonathan Ribérac', 16, 73), j('Alexis Montagut', 6, [86, 74, 70, 72, 72]), j('Lucas Pradelles', 19, [78, 75, 72, 78, 72]), j('Pierre Laborie', 11, [82, 72, 78, 80, 70], true),
      j('Adrien Cazaubon', 28, [78, 75, 72, 76, 72]), j('Enzo Vidalot', 2, [86, 74, 70, 70, 72]), j('Mathias Couderc', 8, [72, 72, 64, 80, 70])],
  },
  {
    id: 'val-d-or', nom: 'Lions de Val-d’Or', court: 'Val-d’Or', abr: 'VOR', ville: 'Val-d’Or',
    devise: 'Le dernier ballon, c’est toujours pour lui.',
    maillot: kit('#d9a520', 'uni', '#2a1a00', '#2a1a00', '#2a1a00'),
    exterieur: kit('#2a1a00', 'uni', '#d9a520', '#2a1a00', '#d9a520'),
    ecusson: { forme: 'blason', fond: '#d9a520', fond2: '#2a1a00', motif: 'demi', symbole: 'couronne', symboleC: '#2a1a00', bord: '#2a1a00' },
    style: 'vedette',
    joueurs: [g('Olivier Pasturel', 12, 73), j('Bastien Arnauty', 14, [80, 66, 68, 60, 70]), j('Killian Desforges', 10, [80, 80, 80, 62, 78], true), j('Samuel Gaudric', 4, [72, 64, 76, 62, 66]),
      j('Hugo Cassagnes', 21, [70, 66, 66, 64, 70]), j('Raphaël Doumergue', 23, [80, 64, 66, 58, 68]), j('Malik Estrabaut', 5, [66, 62, 60, 70, 68])],
  },
  {
    id: 'pont-sur-rive', nom: 'Bateliers de Pont-sur-Rive', court: 'Pont-sur-Rive', abr: 'PSR', ville: 'Pont-sur-Rive',
    devise: 'Un peu de tout, et beaucoup de cœur.',
    maillot: kit('#2b4fa8', 'rayures', '#ffffff', '#152a5c', '#ffffff'),
    exterieur: kit('#ffffff', 'uni', '#2b4fa8', '#ffffff', '#2b4fa8'),
    ecusson: { forme: 'rond', fond: '#2b4fa8', fond2: '#152a5c', motif: 'rayures', symbole: 'ancre', symboleC: '#ffffff', bord: '#ffffff' },
    style: 'equilibre',
    joueurs: [g('Guillaume Sarthou', 1, 76), j('Paul Viguerie', 18, [84, 75, 70, 68, 72]), j('Antoine Lescure', 9, [76, 77, 74, 72, 74]), j('Simon Carrère', 13, [76, 74, 80, 72, 70], true),
      j('Louis Barthas', 22, [76, 77, 72, 72, 74]), j('Clément Saubusse', 7, [84, 74, 70, 68, 72]), j('Martin Gayraud', 3, [70, 74, 64, 78, 72])],
  },
  {
    id: 'givreval', nom: 'Harfangs de Givreval', court: 'Givreval', abr: 'GIV', ville: 'Givreval',
    devise: 'Froids comme la glace, rapides comme l’éclair.',
    maillot: kit('#e6f2ff', 'uni', '#3a6fb0', '#3a6fb0', '#3a6fb0'),
    exterieur: kit('#3a6fb0', 'uni', '#e6f2ff', '#3a6fb0', '#e6f2ff'),
    ecusson: { forme: 'hexagone', fond: '#e6f2ff', fond2: '#3a6fb0', motif: 'bande', symbole: 'eclair', symboleC: '#3a6fb0', bord: '#3a6fb0' },
    style: 'contre',
    joueurs: [g('Nils Haugrand', 16, 75), j('Oscar Lindqvé', 5, [94, 78, 70, 66, 76], true), j('Elias Brandvoll', 20, [80, 78, 72, 72, 74]), j('Tristan Fjellard', 7, [82, 74, 80, 72, 70]),
      j('Viktor Sandrange', 24, [80, 78, 72, 72, 74]), j('Anton Myrval', 3, [92, 77, 70, 66, 76]), j('Rune Tordalen', 8, [72, 74, 64, 80, 70])],
  },
  {
    id: 'mont-ferrat', nom: 'Béliers de Mont-Ferrat', court: 'Mont-Ferrat', abr: 'MTF', ville: 'Mont-Ferrat',
    devise: 'Un coup de bélier, et la porte cède.',
    maillot: kit('#6b6b2a', 'uni', '#f4e9b0', '#33331a', '#f4e9b0'),
    exterieur: kit('#f4e9b0', 'bande', '#6b6b2a', '#f4e9b0', '#6b6b2a'),
    ecusson: { forme: 'bouclier', fond: '#6b6b2a', fond2: '#33331a', motif: 'chevron', symbole: 'enclume', symboleC: '#f4e9b0', bord: '#f4e9b0' },
    style: 'arrieres',
    joueurs: [g('Laurent Chabassol', 1, 76), j('Steven Mouriès', 15, [80, 75, 70, 69, 70]), j('Grégory Valentoux', 32, [72, 89, 70, 75, 82], true), j('David Albarède', 6, [74, 81, 80, 73, 72]),
      j('Franck Ollioules', 19, [72, 87, 70, 75, 80]), j('Julien Peyrolles', 2, [80, 75, 68, 69, 70]), j('Serge Pradines', 9, [68, 75, 62, 83, 72])],
  },
  {
    id: 'corail', nom: 'Murènes de Port-Corail', court: 'Port-Corail', abr: 'PCO', ville: 'Port-Corail',
    devise: 'On glisse le ballon dans la moindre faille.',
    maillot: kit('#ff6f61', 'uni', '#123a4a', '#123a4a', '#ffffff'),
    exterieur: kit('#123a4a', 'uni', '#ff6f61', '#123a4a', '#ff6f61'),
    ecusson: { forme: 'losange', fond: '#ff6f61', fond2: '#123a4a', motif: 'cerceaux', symbole: 'vague', symboleC: '#123a4a', bord: '#123a4a' },
    style: 'pivot',
    joueurs: [g('Teva Rarahu', 12, 74), j('Manoa Tehei', 11, [84, 75, 70, 66, 72]), j('Kaïs Belmonte', 23, [74, 76, 76, 72, 74]), j('Iban Etcheto', 4, [76, 74, 84, 70, 70], true),
      j('Hoani Puaru', 27, [74, 76, 74, 72, 72]), j('Moana Tauraa', 17, [84, 74, 70, 66, 72]), j('Raimana Teriitahi', 6, [70, 80, 66, 82, 74])],
  },
  {
    id: 'lavandiere', nom: 'Abeilles de la Lavandière', court: 'Lavandière', abr: 'LAV', ville: 'La Lavandière',
    devise: 'Ça bourdonne sur les ailes.',
    maillot: kit('#7b5cc4', 'uni', '#ffd23f', '#3a2a66', '#ffd23f'),
    exterieur: kit('#ffd23f', 'uni', '#7b5cc4', '#ffd23f', '#7b5cc4'),
    ecusson: { forme: 'hexagone', fond: '#7b5cc4', fond2: '#3a2a66', motif: 'rayures', symbole: 'feuille', symboleC: '#ffd23f', bord: '#ffd23f' },
    style: 'ailes',
    joueurs: [g('Mathieu Sérignan', 16, 75), j('Lilian Aubignac', 2, [90, 87, 72, 71, 76]), j('Jules Ventabren', 19, [76, 82, 76, 77, 72]), j('Bastien Mollégès', 8, [78, 79, 82, 77, 70]),
      j('Robin Eyguières', 22, [76, 82, 74, 77, 72]), j('Hugo Fontvieille', 14, [92, 89, 72, 71, 78], true), j('Noah Barbentane', 5, [70, 79, 64, 85, 70])],
  },
  {
    id: 'pierre-noire', nom: 'Gargouilles de Pierre-Noire', court: 'Pierre-Noire', abr: 'PNO', ville: 'Pierre-Noire',
    devise: 'Le mur ne bouge pas : c’est l’autre qui se fatigue.',
    maillot: kit('#1a1a22', 'uni', '#9a9aa8', '#0a0a10', '#ffffff'),
    exterieur: kit('#9a9aa8', 'uni', '#1a1a22', '#9a9aa8', '#1a1a22'),
    ecusson: { forme: 'blason', fond: '#1a1a22', fond2: '#0a0a10', motif: 'croix', symbole: 'aile', symboleC: '#9a9aa8', bord: '#9a9aa8' },
    style: 'defense',
    joueurs: [g('Yohann Kervéguen', 1, 79), j('Florian Daoulas', 4, [80, 70, 70, 74, 70]), j('Anthony Pleyben', 21, [72, 73, 72, 82, 76]), j('Sébastien Landerneau', 10, [74, 71, 78, 82, 72], true),
      j('Mickaël Ploudiry', 25, [72, 73, 70, 82, 76]), j('Thomas Rosporden', 7, [80, 70, 70, 74, 70]), j('Ludovic Pencran', 3, [68, 70, 62, 86, 74])],
  },
  {
    id: 'braises', nom: 'Salamandres des Braises', court: 'Les Braises', abr: 'SAL', ville: 'Les Braises',
    devise: 'On vous étouffe, et le ballon est à nous.',
    maillot: kit('#e0362c', 'uni', '#ffd23f', '#5a0c08', '#ffd23f'),
    exterieur: kit('#5a0c08', 'bande', '#e0362c', '#5a0c08', '#ffffff'),
    ecusson: { forme: 'bouclier', fond: '#e0362c', fond2: '#5a0c08', motif: 'demi', symbole: 'flamme', symboleC: '#ffd23f', bord: '#5a0c08' },
    style: 'offensive',
    joueurs: [g('Christophe Ardèche', 12, 73), j('Dylan Vernoux', 9, [86, 74, 70, 72, 72]), j('Thomas Lalouvesc', 24, [78, 75, 72, 78, 72], true), j('Maxime Privas', 5, [82, 72, 78, 80, 70]),
      j('Yanis Tournon', 20, [78, 75, 72, 76, 72]), j('Arthur Vallon', 13, [86, 74, 70, 70, 72]), j('Bruno Joyeuse', 6, [72, 72, 64, 80, 70])],
  },
  {
    id: 'cap-etoile', nom: 'Étoiles du Cap', court: 'Cap-Étoile', abr: 'CAP', ville: 'Cap-Étoile',
    devise: 'Il suffit d’une étoile pour éclairer la nuit.',
    maillot: kit('#0b1d4a', 'uni', '#ffe08a', '#050d24', '#ffe08a'),
    exterieur: kit('#ffe08a', 'uni', '#0b1d4a', '#ffe08a', '#0b1d4a'),
    ecusson: { forme: 'rond', fond: '#0b1d4a', fond2: '#050d24', motif: 'uni', symbole: 'etoile', symboleC: '#ffe08a', bord: '#ffe08a' },
    style: 'vedette',
    joueurs: [g('Patrice Lomagne', 16, 73), j('Rémi Saint-Clar', 6, [80, 65, 68, 59, 70]), j('Ilan Moissac', 18, [72, 63, 72, 61, 68]), j('Nathanaël Castéra', 7, [84, 78, 82, 61, 78], true),
      j('Jonas Fleurance', 11, [72, 65, 66, 63, 70]), j('Benjamin Auvillar', 23, [80, 63, 66, 57, 68]), j('Cyprien Lectoure', 4, [66, 61, 60, 69, 68])],
  },
  {
    id: 'vieux-moulin', nom: 'Meuniers du Vieux-Moulin', court: 'Vieux-Moulin', abr: 'VXM', ville: 'Le Vieux-Moulin',
    devise: 'Ça tourne, ça tourne, et un jour ça rentre.',
    maillot: kit('#3c8d3c', 'uni', '#f4f4f4', '#1d4a1d', '#ffffff'),
    exterieur: kit('#f4f4f4', 'uni', '#3c8d3c', '#f4f4f4', '#3c8d3c'),
    ecusson: { forme: 'losange', fond: '#3c8d3c', fond2: '#f4f4f4', motif: 'croix', symbole: 'roue', symboleC: '#ffffff', bord: '#1d4a1d' },
    style: 'equilibre',
    joueurs: [g('Hervé Saint-Pons', 1, 76, 62, 72, true), j('Éric Lodève', 14, [84, 76, 70, 69, 72]), j('Vincent Clermontel', 22, [76, 78, 74, 73, 74]), j('Alexandre Gignac', 8, [76, 75, 80, 73, 70]),
      j('Nicolas Aniane', 27, [76, 78, 72, 73, 74]), j('Kylian Pézenas', 2, [84, 75, 70, 69, 72]), j('Grégoire Bédarieux', 5, [70, 75, 64, 79, 72])],
  },
];

export const EQUIPE = Object.fromEntries(EQUIPES.map((e) => [e.id, e]));

/** Les notes d'un joueur (bornées). Le gardien a sa note de gardien ; les autres, une faible. */
export function notesJoueur(eq, i) {
  const n = { gardien: 25, ...eq.joueurs[i].notes };
  for (const k of Object.keys(n)) n[k] = Math.max(20, Math.min(99, n[k]));
  return n;
}

const CHAMPS = ['vitesse', 'tir', 'passe', 'defense', 'saut'];

/** Les notes moyennes des joueurs de champ d'une équipe, et celle du gardien (pour l'affichage). */
export function notesEquipe(eq) {
  const n = { vitesse: 0, tir: 0, passe: 0, defense: 0, saut: 0 };
  const champ = eq.joueurs.slice(1);
  for (const p of champ) for (const k of CHAMPS) n[k] += p.notes[k] / champ.length;
  for (const k of CHAMPS) n[k] = Math.round(n[k]);
  n.gardien = eq.joueurs[0].notes.gardien;
  return n;
}

/** La note générale d'une équipe (le gardien compte pour une note sur six). */
export const noteGenerale = (eq) => { const n = notesEquipe(eq); return Math.round(((n.vitesse + n.tir + n.passe + n.defense + n.saut) / 5) * (5 / 6) + n.gardien / 6); };

/** La note d'un joueur (pour les cartes). */
export const noteJoueur = (eq, i) => {
  const n = eq.joueurs[i].notes;
  if (i === 0) return Math.round(n.gardien);
  return Math.round((n.vitesse + n.tir + n.passe + n.defense + n.saut) / 5);
};
