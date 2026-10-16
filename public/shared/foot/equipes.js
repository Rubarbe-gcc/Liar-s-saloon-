/**
 * PETIT PONT — les seize équipes (toutes inventées, villes comprises).
 *
 * Chaque équipe a ses couleurs (maillot, short, chaussettes, et une tenue de
 * rechange quand les deux se ressemblent trop), son écusson (dessiné par le
 * code : voir games/petit-pont/js/ecusson.js), cinq joueurs nommés, ses notes
 * sur 100 et un style de jeu que l'ordinateur respecte (shared/foot/ia.js).
 *
 * Seize équipes en tout (six ajoutées quand le foot est entré dans PLEIN STADE).
 *
 * Les notes : vitesse, tir, passe (et conduite de balle), défense, gardien.
 * Un joueur part des notes de son équipe, ajustées selon son poste ; la
 * vedette de l'équipe a un point fort en plus. L'équilibre se mesure par des
 * matchs simulés (test/foot.test.js) : aucune équipe ne doit gagner plus de
 * 65 % de ses matchs contre les autres.
 *
 * Module partagé, sans DOM.
 */

/**
 * Les styles de jeu, lus par l'IA :
 *   court    : passes courtes, patience (la passe prime sur la course)
 *   contre   : récupérer bas et partir vite vers l'avant
 *   physique : pressing, tacles, duels
 *   tirloin  : on tente sa chance de loin
 *   equilibre: un peu de tout
 *   ailes    : le jeu par les côtés, des ballons piqués devant le but
 *   dribble  : on garde le ballon au pied et on élimine
 *   bloc     : on défend bas et serré, on repart en contre
 *   pressing : on presse haut, tout le temps
 *   long     : de longs ballons, par-dessus les lignes
 *   direct   : vers l'avant tout de suite, le moins de passes possible
 *   contrepress : le ballon perdu, on le reprend aussitôt, à deux, très haut
 */
export const STYLES = {
  court: { nom: 'Jeu court', passe: 0.25, progres: 0.7, tir: 1.12, dribble: 0.85, lob: 0.4, pressing: 0.5, ligne: 0, largeur: 0.9, tacle: 0.5 },
  contre: { nom: 'Contre-attaque', passe: 0, progres: 1.5, tir: 1, dribble: 1.05, lob: 1.1, pressing: 0.35, ligne: -2.5, largeur: 1, tacle: 0.6 },
  physique: { nom: 'Pressing et duels', passe: 0, progres: 1, tir: 1, dribble: 1, lob: 0.8, pressing: 0.85, ligne: 1.5, largeur: 0.95, tacle: 1 },
  tirloin: { nom: 'Frappes de loin', passe: 0, progres: 1, tir: 0.95, dribble: 0.95, lob: 0.8, pressing: 0.55, ligne: 0, largeur: 1, tacle: 0.6 },
  equilibre: { nom: 'Équilibré', passe: 0.08, progres: 1, tir: 1, dribble: 1, lob: 0.8, pressing: 0.55, ligne: 0, largeur: 1, tacle: 0.65 },
  ailes: { nom: 'Jeu sur les ailes', passe: 0.05, progres: 1, tir: 1, dribble: 1, lob: 1.3, pressing: 0.5, ligne: 0, largeur: 1.3, tacle: 0.6 },
  dribble: { nom: 'Dribbles', passe: -0.05, progres: 1, tir: 1, dribble: 1.25, lob: 0.6, pressing: 0.5, ligne: 0.5, largeur: 1, tacle: 0.55 },
  bloc: { nom: 'Bloc bas', passe: 0.05, progres: 1.2, tir: 1, dribble: 0.95, lob: 1, pressing: 0.3, ligne: -2.5, largeur: 0.85, tacle: 0.6 },
  pressing: { nom: 'Pressing haut', passe: 0, progres: 1.1, tir: 1, dribble: 1, lob: 0.8, pressing: 1, ligne: 3, largeur: 1, tacle: 0.85 },
  long: { nom: 'Jeu long', passe: 0, progres: 1.35, tir: 1, dribble: 0.9, lob: 1.8, pressing: 0.45, ligne: -1, largeur: 1.1, tacle: 0.6 },
  direct: { nom: 'Jeu direct', passe: -0.02, progres: 1.45, tir: 0.95, dribble: 0.95, lob: 1.1, pressing: 0.5, ligne: 0.5, largeur: 1, tacle: 0.6 },
  contrepress: { nom: 'Contre-pressing', passe: 0.05, progres: 1.1, tir: 1, dribble: 1, lob: 0.7, pressing: 0.6, ligne: 1.5, largeur: 0.95, tacle: 0.8, contre: true },
};

/** Les postes : G (gardien), D (défenseur), M (milieu, deux), A (attaquant). */
export const POSTES = ['G', 'D', 'M', 'M', 'A'];
const MOD_POSTE = {
  G: { vitesse: -6, tir: -20, passe: -6, defense: 0 },
  D: { vitesse: -2, tir: -6, passe: 0, defense: 7 },
  M: { vitesse: 0, tir: 0, passe: 4, defense: -2 },
  A: { vitesse: 3, tir: 7, passe: -2, defense: -9 },
};

const j = (nom, numero, vedette = null) => ({ nom, numero, vedette });

export const EQUIPES = [
  {
    id: 'brisevent', nom: 'Rapide de Brisevent', court: 'Brisevent', abr: 'BRI', ville: 'Brisevent',
    devise: 'Le ballon va plus vite que nous.',
    maillot: { fond: '#7cc6ff', motif: 'rayures', motifC: '#ffffff', short: '#ffffff', bas: '#7cc6ff', num: '#13304f' },
    exterieur: { fond: '#13304f', motif: 'uni', motifC: '#7cc6ff', short: '#13304f', bas: '#13304f', num: '#ffffff' },
    gardien: '#f2d43a',
    ecusson: { forme: 'bouclier', fond: '#7cc6ff', fond2: '#ffffff', motif: 'rayures', symbole: 'eclair', symboleC: '#13304f', bord: '#13304f' },
    style: 'court',
    notes: { vitesse: 82, tir: 77, passe: 90, defense: 77, gardien: 78 },
    joueurs: [j('Basile Moranne', 1), j('Lucas Ferrandi', 4), j('Nino Arbelle', 8, 'passe'), j('Sami Courtil', 10), j('Enzo Pradel', 9)],
  },
  {
    id: 'port-sablon', nom: 'Olympique de Port-Sablon', court: 'Port-Sablon', abr: 'OPS', ville: 'Port-Sablon',
    devise: 'Un ballon perdu, trois secondes, un but.',
    maillot: { fond: '#ff7a1a', motif: 'uni', motifC: '#14213d', short: '#14213d', bas: '#ff7a1a', num: '#14213d' },
    exterieur: { fond: '#f4efe6', motif: 'bande', motifC: '#ff7a1a', short: '#f4efe6', bas: '#f4efe6', num: '#14213d' },
    gardien: '#2bd17e',
    ecusson: { forme: 'rond', fond: '#14213d', fond2: '#ff7a1a', motif: 'demi', symbole: 'soleil', symboleC: '#ffd166', bord: '#ff7a1a' },
    style: 'contre',
    notes: { vitesse: 84, tir: 75, passe: 73, defense: 71, gardien: 74 },
    joueurs: [j('Hugo Salinas', 16), j('Malo Berthier', 5), j('Yanis Kerval', 7), j('Tiago Ferral', 11), j('Kenzo Ribaud', 9, 'vitesse')],
  },
  {
    id: 'ferrac', nom: 'AS Ferrac', court: 'Ferrac', abr: 'ASF', ville: 'Ferrac-les-Forges',
    devise: 'On ne passe pas. On ne lâche rien.',
    maillot: { fond: '#3a3d44', motif: 'bande', motifC: '#e0362c', short: '#1f2126', bas: '#e0362c', num: '#ffffff' },
    exterieur: { fond: '#e0362c', motif: 'uni', motifC: '#3a3d44', short: '#e0362c', bas: '#3a3d44', num: '#ffffff' },
    gardien: '#7ad3ff',
    ecusson: { forme: 'hexagone', fond: '#3a3d44', fond2: '#5a5e68', motif: 'uni', symbole: 'enclume', symboleC: '#e0362c', bord: '#e0362c' },
    style: 'physique',
    notes: { vitesse: 78, tir: 78, passe: 75, defense: 92, gardien: 81 },
    joueurs: [j('Gaspard Roche', 1), j('Bastien Malfer', 3, 'defense'), j('Joris Calvat', 6), j('Rémi Tolosa', 8), j('Anton Brevik', 9)],
  },
  {
    id: 'valombre', nom: 'Étoile de Valombre', court: 'Valombre', abr: 'ETV', ville: 'Valombre',
    devise: 'Vingt mètres, c’est déjà trop près.',
    maillot: { fond: '#151515', motif: 'cerceaux', motifC: '#e8b923', short: '#151515', bas: '#e8b923', num: '#e8b923' },
    exterieur: { fond: '#e8b923', motif: 'uni', motifC: '#151515', short: '#151515', bas: '#e8b923', num: '#151515' },
    gardien: '#ff5ab4',
    ecusson: { forme: 'blason', fond: '#151515', fond2: '#2a2a2a', motif: 'chevron', symbole: 'etoile', symboleC: '#e8b923', bord: '#e8b923' },
    style: 'tirloin',
    notes: { vitesse: 82, tir: 92, passe: 77, defense: 82, gardien: 82 },
    joueurs: [j('Victor Daumal', 12), j('Paolo Verin', 2), j('Léandre Aubry', 14, 'tir'), j('Ismaël Cortès', 10), j('Jonas Valère', 9)],
  },
  {
    id: 'cimes', nom: 'Racing des Cimes', court: 'Les Cimes', abr: 'RDC', ville: 'Haut-Cimier',
    devise: 'Monter, toujours, ensemble.',
    maillot: { fond: '#f6f7f2', motif: 'cerceaux', motifC: '#1f8a4c', short: '#1f8a4c', bas: '#f6f7f2', num: '#1f8a4c' },
    exterieur: { fond: '#1f8a4c', motif: 'uni', motifC: '#f6f7f2', short: '#f6f7f2', bas: '#1f8a4c', num: '#ffffff' },
    gardien: '#ff8a1e',
    ecusson: { forme: 'losange', fond: '#f6f7f2', fond2: '#1f8a4c', motif: 'demi', symbole: 'montagne', symboleC: '#1f8a4c', bord: '#14532d' },
    style: 'equilibre',
    notes: { vitesse: 86, tir: 84, passe: 84, defense: 82, gardien: 83 },
    joueurs: [j('Antonin Brissac', 1), j('Elio Marchetti', 5), j('Félix Ostrand', 8), j('Noam Delisle', 10, 'passe'), j('Mathis Cordero', 9)],
  },
  {
    id: 'corail', nom: 'Union de Corail-sur-Mer', court: 'Corail', abr: 'UCM', ville: 'Corail-sur-Mer',
    devise: 'Par les côtés, comme la marée.',
    maillot: { fond: '#14b8a6', motif: 'bande', motifC: '#ff6f61', short: '#0f766e', bas: '#14b8a6', num: '#ffffff' },
    exterieur: { fond: '#ff6f61', motif: 'uni', motifC: '#14b8a6', short: '#ff6f61', bas: '#ff6f61', num: '#ffffff' },
    gardien: '#2a2a2a',
    ecusson: { forme: 'rond', fond: '#14b8a6', fond2: '#0f766e', motif: 'uni', symbole: 'vague', symboleC: '#ff6f61', bord: '#f5f5f5' },
    style: 'ailes',
    notes: { vitesse: 85, tir: 80, passe: 83, defense: 78, gardien: 76 },
    joueurs: [j('Raphaël Lenoble', 1), j('Diego Altamar', 4), j('Lilian Morvan', 7, 'vitesse'), j('Iker Solano', 11), j('Adam Kessler', 9)],
  },
  {
    id: 'lune-rousse', nom: 'Sporting Lune-Rousse', court: 'Lune-Rousse', abr: 'SLR', ville: 'Lune-Rousse',
    devise: 'Un petit pont, et la lune se lève.',
    maillot: { fond: '#6b2fb3', motif: 'demi', motifC: '#c9ccd6', short: '#2b1150', bas: '#6b2fb3', num: '#ffffff' },
    exterieur: { fond: '#c9ccd6', motif: 'uni', motifC: '#6b2fb3', short: '#c9ccd6', bas: '#6b2fb3', num: '#2b1150' },
    gardien: '#c6ff3a',
    ecusson: { forme: 'bouclier', fond: '#2b1150', fond2: '#6b2fb3', motif: 'demi', symbole: 'lune', symboleC: '#ff9b54', bord: '#c9ccd6' },
    style: 'dribble',
    notes: { vitesse: 83, tir: 80, passe: 80, defense: 70, gardien: 73 },
    joueurs: [j('Corentin Labbé', 1), j('Wassim Ferhat', 2), j('Oscar Lindqvist', 6), j('Zayan Morel', 10, 'passe'), j('Luca Benvenuti', 7)],
  },
  {
    id: 'kerbrume', nom: 'Les Mouettes de Kerbrume', court: 'Kerbrume', abr: 'KER', ville: 'Kerbrume',
    devise: 'La brume se lève. Les buts, jamais.',
    maillot: { fond: '#f2f4f8', motif: 'cerceaux', motifC: '#1c2c5b', short: '#1c2c5b', bas: '#1c2c5b', num: '#c8102e' },
    exterieur: { fond: '#1c2c5b', motif: 'uni', motifC: '#f2f4f8', short: '#1c2c5b', bas: '#f2f4f8', num: '#ffffff' },
    gardien: '#ffd400',
    ecusson: { forme: 'blason', fond: '#1c2c5b', fond2: '#f2f4f8', motif: 'rayures', symbole: 'mouette', symboleC: '#f2f4f8', bord: '#c8102e' },
    style: 'bloc',
    notes: { vitesse: 75, tir: 74, passe: 77, defense: 80, gardien: 81 },
    joueurs: [j('Yann Le Goff', 1, 'gardien'), j('Erwan Kerhoas', 5), j('Titouan Bihan', 8), j('Gaël Morvezen', 10), j('Lenny Caradec', 9)],
  },
  {
    id: 'vertefeuille', nom: 'Dynamo Vertefeuille', court: 'Vertefeuille', abr: 'DVF', ville: 'Vertefeuille',
    devise: 'Pas une seconde de répit.',
    maillot: { fond: '#9be22d', motif: 'rayures', motifC: '#141414', short: '#141414', bas: '#9be22d', num: '#141414' },
    exterieur: { fond: '#141414', motif: 'uni', motifC: '#9be22d', short: '#141414', bas: '#141414', num: '#9be22d' },
    gardien: '#ff4d6d',
    ecusson: { forme: 'hexagone', fond: '#141414', fond2: '#9be22d', motif: 'chevron', symbole: 'feuille', symboleC: '#9be22d', bord: '#9be22d' },
    style: 'pressing',
    notes: { vitesse: 85, tir: 79, passe: 79, defense: 84, gardien: 75 },
    joueurs: [j('Milan Rossel', 1), j('Arthur Neveu', 3), j('Kylian Boisvert', 6, 'defense'), j('Ethan Verdier', 8), j('Rayan Mestre', 9)],
  },
  {
    id: 'sol-dambre', nom: 'Sol-d’Ambre FC', court: 'Sol-d’Ambre', abr: 'SDA', ville: 'Sol-d’Ambre',
    devise: 'Le ciel est à nous.',
    maillot: { fond: '#ffd23f', motif: 'uni', motifC: '#7a1f2b', short: '#7a1f2b', bas: '#ffd23f', num: '#7a1f2b' },
    exterieur: { fond: '#7a1f2b', motif: 'bande', motifC: '#ffd23f', short: '#7a1f2b', bas: '#7a1f2b', num: '#ffd23f' },
    gardien: '#3ab0ff',
    ecusson: { forme: 'losange', fond: '#7a1f2b', fond2: '#ffd23f', motif: 'croix', symbole: 'couronne', symboleC: '#ffd23f', bord: '#ffd23f' },
    style: 'long',
    notes: { vitesse: 83, tir: 81, passe: 81, defense: 78, gardien: 77 },
    joueurs: [j('Clément Aurier', 1), j('Hector Balmain', 4), j('Silvio Marchal', 8), j('Ibrahim Sorel', 10), j('Nils Ambrose', 9, 'tir')],
  },
  {
    id: 'fournaise', nom: 'Les Braises de Fournaise', court: 'Fournaise', abr: 'BRF', ville: 'Fournaise',
    devise: 'Perdre le ballon ? Juste le temps de le reprendre.',
    maillot: { fond: '#d7263d', motif: 'uni', motifC: '#141414', short: '#141414', bas: '#d7263d', num: '#ffffff' },
    exterieur: { fond: '#141414', motif: 'bande', motifC: '#d7263d', short: '#141414', bas: '#141414', num: '#ff8a3d' },
    gardien: '#30d5c8',
    ecusson: { forme: 'bouclier', fond: '#141414', fond2: '#d7263d', motif: 'chevron', symbole: 'flamme', symboleC: '#ff8a3d', bord: '#d7263d' },
    style: 'contrepress',
    notes: { vitesse: 84, tir: 78, passe: 77, defense: 82, gardien: 76 },
    joueurs: [j('Tristan Brasier', 1), j('Kofi Mensah-Ardent', 5), j('Valentin Escarbille', 6, 'defense'), j('Ludovic Tison', 8), j('Rafael Fumerol', 9)],
  },
  {
    id: 'port-ancre', nom: 'Racing Port-Ancre', court: 'Port-Ancre', abr: 'RPA', ville: 'Port-Ancre',
    devise: 'Jetez l’ancre, on s’occupe du reste.',
    maillot: { fond: '#0b5563', motif: 'rayures', motifC: '#f28c28', short: '#0b5563', bas: '#f28c28', num: '#ffffff' },
    exterieur: { fond: '#f28c28', motif: 'uni', motifC: '#0b5563', short: '#f28c28', bas: '#0b5563', num: '#0b5563' },
    gardien: '#e9ff70',
    ecusson: { forme: 'rond', fond: '#0b5563', fond2: '#0e6f80', motif: 'uni', symbole: 'ancre', symboleC: '#f28c28', bord: '#f28c28' },
    style: 'long',
    notes: { vitesse: 83, tir: 81, passe: 80, defense: 81, gardien: 79 },
    joueurs: [j('Matthias Quillec', 1), j('Abel Carène', 4), j('Sohan Bastingue', 7), j('Pierrick Amarre', 10, 'passe'), j('Dario Spinnaker', 9)],
  },
  {
    id: 'rouages', nom: 'Union des Rouages', court: 'Les Rouages', abr: 'UDR', ville: 'Engrenay',
    devise: 'Chaque dent compte.',
    maillot: { fond: '#2d2f33', motif: 'bande', motifC: '#ffcc00', short: '#2d2f33', bas: '#ffcc00', num: '#ffcc00' },
    exterieur: { fond: '#ffcc00', motif: 'uni', motifC: '#2d2f33', short: '#2d2f33', bas: '#ffcc00', num: '#2d2f33' },
    gardien: '#ff6fd8',
    ecusson: { forme: 'hexagone', fond: '#2d2f33', fond2: '#45484f', motif: 'croix', symbole: 'roue', symboleC: '#ffcc00', bord: '#ffcc00' },
    style: 'direct',
    notes: { vitesse: 83, tir: 82, passe: 76, defense: 79, gardien: 77 },
    joueurs: [j('Gustave Pignon', 1), j('Marius Boulon', 3), j('Ilan Crémaillère', 6), j('Achille Piston', 8), j('Yoann Bielle', 9, 'vitesse')],
  },
  {
    id: 'tour-blanche', nom: 'Tour-Blanche FC', court: 'Tour-Blanche', abr: 'TBF', ville: 'Tour-Blanche',
    devise: 'Nos murs ne tombent pas.',
    maillot: { fond: '#f4f1ea', motif: 'demi', motifC: '#a4161a', short: '#a4161a', bas: '#f4f1ea', num: '#a4161a' },
    exterieur: { fond: '#a4161a', motif: 'uni', motifC: '#f4f1ea', short: '#a4161a', bas: '#a4161a', num: '#f4f1ea' },
    gardien: '#2bd17e',
    ecusson: { forme: 'blason', fond: '#f4f1ea', fond2: '#a4161a', motif: 'demi', symbole: 'tour', symboleC: '#1f1f1f', bord: '#a4161a' },
    style: 'bloc',
    notes: { vitesse: 76, tir: 77, passe: 79, defense: 84, gardien: 83 },
    joueurs: [j('Baudouin Créneau', 1, 'gardien'), j('Edgar Mâchicoulis', 2), j('Firmin Herse', 5), j('Lazare Donjon', 8), j('Côme Bastion', 9)],
  },
  {
    id: 'plume-haute', nom: 'Envol de Plume-Haute', court: 'Plume-Haute', abr: 'EPH', ville: 'Plume-Haute',
    devise: 'On vole le ballon, puis on s’envole.',
    maillot: { fond: '#ff5d8f', motif: 'cerceaux', motifC: '#1d2d50', short: '#1d2d50', bas: '#ff5d8f', num: '#ffffff' },
    exterieur: { fond: '#1d2d50', motif: 'uni', motifC: '#ff5d8f', short: '#1d2d50', bas: '#1d2d50', num: '#ff5d8f' },
    gardien: '#ffd400',
    ecusson: { forme: 'losange', fond: '#1d2d50', fond2: '#ff5d8f', motif: 'chevron', symbole: 'aile', symboleC: '#ffffff', bord: '#ff5d8f' },
    style: 'contrepress',
    notes: { vitesse: 84, tir: 78, passe: 80, defense: 78, gardien: 75 },
    joueurs: [j('Séraphin Duvet', 1), j('Noé Rémige', 4), j('Jules Ailette', 7, 'vitesse'), j('Eliott Pennon', 10), j('Aymeric Rapace', 11)],
  },
  {
    id: 'vif-argent', nom: 'Flèche de Vif-Argent', court: 'Vif-Argent', abr: 'FVA', ville: 'Vif-Argent',
    devise: 'Le plus court chemin vers le but : tout droit.',
    maillot: { fond: '#b8c0cc', motif: 'bande', motifC: '#2b59ff', short: '#2b59ff', bas: '#b8c0cc', num: '#14204a' },
    exterieur: { fond: '#14204a', motif: 'uni', motifC: '#2b59ff', short: '#14204a', bas: '#14204a', num: '#b8c0cc' },
    gardien: '#ff7a1a',
    ecusson: { forme: 'bouclier', fond: '#14204a', fond2: '#2b59ff', motif: 'bande', symbole: 'fleche', symboleC: '#e6ebf2', bord: '#b8c0cc' },
    style: 'direct',
    notes: { vitesse: 85, tir: 80, passe: 77, defense: 77, gardien: 76 },
    joueurs: [j('Axel Mercurin', 1), j('Timéo Argentan', 3), j('Ruben Fulgor', 8), j('Lisandro Vélocé', 10), j('Sacha Comète', 9, 'tir')],
  },
];

export const EQUIPE = Object.fromEntries(EQUIPES.map((e) => [e.id, e]));

/** Les notes d'un joueur : celles de l'équipe, ajustées au poste, plus le point fort de la vedette. */
export function notesJoueur(eq, i) {
  const poste = POSTES[i];
  const mod = MOD_POSTE[poste];
  const n = { ...eq.notes };
  for (const k of Object.keys(mod)) n[k] += mod[k];
  const v = eq.joueurs[i].vedette;
  if (v) n[v] += 7;
  for (const k of Object.keys(n)) n[k] = Math.max(30, Math.min(99, n[k]));
  return n;
}

/** La note générale d'une équipe (pour l'affichage). */
export const noteGenerale = (eq) => Math.round((eq.notes.vitesse + eq.notes.tir + eq.notes.passe + eq.notes.defense + eq.notes.gardien) / 5);

/** Les stades (le décor seulement : le terrain est le même partout). */
export const STADES = [
  { id: 'chaudron', nom: 'Le Chaudron', desc: 'Le grand stade, la nuit, sous les projecteurs.' },
  { id: 'toit', nom: 'Le Toit', desc: 'Une cage sur un toit, au-dessus de la ville.' },
  { id: 'halle', nom: 'La Halle', desc: 'Le gymnase du quartier, parquet et néons.' },
  { id: 'plage', nom: 'La Plage', desc: 'Au bord de l’eau, au coucher du soleil.' },
];
export const STADE = Object.fromEntries(STADES.map((s) => [s.id, s]));
