/**
 * PETIT PONT — les dix équipes (toutes inventées, villes comprises).
 *
 * Chaque équipe a ses couleurs (maillot, short, chaussettes, et une tenue de
 * rechange quand les deux se ressemblent trop), son écusson (dessiné par le
 * code : voir games/petit-pont/js/ecusson.js), cinq joueurs nommés, ses notes
 * sur 100 et un style de jeu que l'ordinateur respecte (shared/foot/ia.js).
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
    notes: { vitesse: 80, tir: 92, passe: 77, defense: 82, gardien: 82 },
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
    notes: { vitesse: 85, tir: 80, passe: 83, defense: 76, gardien: 76 },
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
    notes: { vitesse: 82, tir: 78, passe: 80, defense: 70, gardien: 73 },
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
