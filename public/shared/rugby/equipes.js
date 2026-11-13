/**
 * RAFFUT — les seize clubs de rugby à 7 (tous inventés : villes, joueurs, couleurs).
 *
 * Chaque club : sept joueurs (deux piliers, un talonneur, un demi de mêlée,
 * un demi d'ouverture, un centre, un ailier) avec leurs notes (vitesse,
 * force, passe, pied, défense), un style de jeu lu par l'ordinateur (ia.js),
 * ses tenues et son écusson (commun/ecusson.js). Les notes sont réglées pour
 * que chaque club gagne entre 35 et 65 % de ses matchs (test/rugby.test.js).
 *
 * Module partagé, sans DOM.
 */

/**
 * Les styles de jeu, lus par l'ordinateur :
 *   avants    : on percute, on garde le ballon près des rucks
 *   large     : le ballon file vers les ailes
 *   pied      : on occupe le terrain au pied, on tente les drops
 *   defense   : on monte vite en défense, on gratte les ballons
 *   vitesse   : on relance de partout, on court
 *   vedette   : tous les ballons pour le meilleur joueur
 *   equilibre : un peu de tout
 * percussion : l'envie de foncer dans le contact plutôt que de passer ;
 * large : l'envie d'écarter ; pied : de taper ; monte : la vitesse de la ligne
 * de défense ; gratte : la force au ruck ; relance : l'envie de courir.
 */
export const STYLES = {
  avants: { nom: 'Jeu d’avants', percussion: 1.5, large: 0.7, pied: 0.7, monte: 1, gratte: 1.3, relance: 0.9 },
  large: { nom: 'Jeu au large', percussion: 0.7, large: 1.6, pied: 0.7, monte: 0.95, gratte: 0.9, relance: 1.1 },
  pied: { nom: 'Jeu au pied', percussion: 0.95, large: 1, pied: 1.6, monte: 1, gratte: 1, relance: 0.9 },
  defense: { nom: 'Défense de fer', percussion: 1, large: 0.9, pied: 1, monte: 1.35, gratte: 1.5, relance: 0.9 },
  vitesse: { nom: 'Contre-attaque', percussion: 0.8, large: 1.2, pied: 0.6, monte: 1, gratte: 0.9, relance: 1.5 },
  vedette: { nom: 'Tout pour la vedette', percussion: 1, large: 1, pied: 0.9, monte: 1, gratte: 1, relance: 1.1, vedette: true },
  equilibre: { nom: 'Équilibré', percussion: 1, large: 1, pied: 1, monte: 1, gratte: 1, relance: 1 },
};

/** Les postes : P (pilier), T (talonneur), DM (demi de mêlée), DO (demi d'ouverture), C (centre), A (ailier). */
export const POSTES = ['P', 'T', 'P', 'DM', 'DO', 'C', 'A'];
export const NOM_POSTE = { P: 'Pilier', T: 'Talonneur', DM: 'Demi de mêlée', DO: 'Demi d’ouverture', C: 'Centre', A: 'Ailier' };
/** Les avants (la mêlée, la touche) : les trois premiers. */
export const AVANTS = [0, 1, 2];

/** Un joueur : son nom, son numéro, ses notes [vitesse, force, passe, pied, défense], la vedette du club ? */
const j = (nom, numero, [vitesse, force, passe, pied, defense], vedette = false) => ({ nom, numero, notes: { vitesse, force, passe, pied, defense }, vedette });
const kit = (fond, motif, motifC, short, num) => ({ fond, motif, motifC, short, bas: fond, num });

export const EQUIPES = [
  {
    id: 'roc-fendu', nom: 'Béliers de Roc-Fendu', court: 'Roc-Fendu', abr: 'ROC', ville: 'Roc-Fendu',
    devise: 'Tête baissée, et on avance.',
    maillot: kit('#7a4a26', 'cerceaux', '#f0dcae', '#2a1a0c', '#f0dcae'),
    exterieur: kit('#f0dcae', 'uni', '#7a4a26', '#7a4a26', '#7a4a26'),
    ecusson: { forme: 'bouclier', fond: '#7a4a26', fond2: '#2a1a0c', motif: 'chevron', symbole: 'enclume', symboleC: '#f0dcae', bord: '#f0dcae' },
    style: 'avants',
    joueurs: [j('Gaétan Rouffiac', 1, [58, 90, 58, 38, 80]), j('Lucas Pelvoux', 2, [64, 86, 66, 42, 80], true), j('Brice Carmaux', 3, [56, 88, 56, 36, 79]),
      j('Hugo Saintonge', 9, [78, 60, 84, 72, 68]), j('Matthieu Larrigue', 10, [75, 62, 80, 82, 68]), j('Florent Bazas', 12, [79, 80, 72, 60, 80]), j('Kévin Ostabat', 11, [88, 66, 66, 56, 66])],
  },
  {
    id: 'sablemer', nom: 'Mouettes de Sablemer', court: 'Sablemer', abr: 'SAB', ville: 'Sablemer',
    devise: 'Le ballon vole, nous aussi.',
    maillot: kit('#e9f6ff', 'bande', '#3aa0e8', '#1b3f66', '#1b3f66'),
    exterieur: kit('#1b3f66', 'uni', '#e9f6ff', '#1b3f66', '#e9f6ff'),
    ecusson: { forme: 'rond', fond: '#3aa0e8', fond2: '#e9f6ff', motif: 'bande', symbole: 'mouette', symboleC: '#ffffff', bord: '#1b3f66' },
    style: 'large',
    joueurs: [j('Noam Arcangues', 1, [62, 84, 64, 38, 78]), j('Théo Lescure', 2, [68, 81, 72, 44, 77]), j('Yann Picaud', 3, [60, 84, 62, 36, 77]),
      j('Simon Escarra', 9, [83, 56, 90, 72, 67]), j('Rémy Castagnède', 10, [78, 58, 88, 80, 66]), j('Antoine Lagrave', 12, [82, 74, 80, 62, 77]), j('Ilan Morlanne', 14, [96, 62, 70, 56, 64], true)],
  },
  {
    id: 'givrelac', nom: 'Loups de Givrelac', court: 'Givrelac', abr: 'GIV', ville: 'Givrelac',
    devise: 'Personne ne franchit la ligne.',
    maillot: kit('#5d6b7a', 'uni', '#bfe4ff', '#2c3540', '#bfe4ff'),
    exterieur: kit('#bfe4ff', 'cerceaux', '#5d6b7a', '#5d6b7a', '#2c3540'),
    ecusson: { forme: 'blason', fond: '#5d6b7a', fond2: '#2c3540', motif: 'demi', symbole: 'lune', symboleC: '#bfe4ff', bord: '#bfe4ff' },
    style: 'defense',
    joueurs: [j('Arnaud Vercors', 1, [58, 86, 58, 38, 86]), j('Bastien Morzine', 2, [64, 84, 66, 42, 86]), j('Cyril Abondance', 3, [56, 86, 56, 36, 85]),
      j('Damien Sallanche', 9, [78, 58, 84, 72, 74]), j('Étienne Valloire', 10, [74, 60, 80, 82, 74]), j('Fabien Chamrousse', 12, [78, 78, 72, 60, 88], true), j('Gilles Tignasse', 11, [88, 62, 66, 56, 72])],
  },
  {
    id: 'brulemiel', nom: 'Frelons de Brûlemiel', court: 'Brûlemiel', abr: 'BRU', ville: 'Brûlemiel',
    devise: 'Une piqûre, et ils sont déjà loin.',
    maillot: kit('#ffcf1f', 'cerceaux', '#1a1a1a', '#1a1a1a', '#1a1a1a'),
    exterieur: kit('#1a1a1a', 'uni', '#ffcf1f', '#1a1a1a', '#ffcf1f'),
    ecusson: { forme: 'hexagone', fond: '#ffcf1f', fond2: '#1a1a1a', motif: 'rayures', symbole: 'eclair', symboleC: '#1a1a1a', bord: '#1a1a1a' },
    style: 'vitesse',
    joueurs: [j('Jordan Auriac', 1, [64, 80, 60, 38, 76]), j('Kilian Duras', 2, [70, 78, 68, 44, 76]), j('Loïc Meyssac', 3, [62, 80, 58, 36, 75]),
      j('Maxime Tulle', 9, [86, 54, 84, 70, 66]), j('Nicolas Brive', 10, [82, 56, 82, 78, 66]), j('Olivier Figeac', 12, [84, 71, 74, 58, 76], true), j('Pierre Souillac', 11, [95, 60, 66, 54, 64])],
  },
  {
    id: 'noirval', nom: 'Corbeaux de Noirval', court: 'Noirval', abr: 'NOI', ville: 'Noirval',
    devise: 'Le ballon tombe toujours chez nous.',
    maillot: kit('#151515', 'bande', '#c4202f', '#151515', '#ffffff'),
    exterieur: kit('#ffffff', 'uni', '#151515', '#151515', '#151515'),
    ecusson: { forme: 'bouclier', fond: '#151515', fond2: '#3a3a3a', motif: 'croix', symbole: 'aile', symboleC: '#c4202f', bord: '#c4202f' },
    style: 'pied',
    joueurs: [j('Quentin Lormont', 1, [58, 88, 58, 42, 80]), j('Raphaël Cénac', 2, [64, 85, 66, 48, 81]), j('Sébastien Arsac', 3, [56, 88, 56, 40, 79]),
      j('Thibaut Margaux', 9, [80, 58, 84, 82, 68]), j('Ugo Pessac', 10, [74, 60, 82, 95, 68], true), j('Valentin Blaye', 12, [80, 78, 72, 72, 80]), j('William Bourg', 11, [92, 62, 66, 66, 66])],
  },
  {
    id: 'pic-gris', nom: 'Grizzlis de Pic-Gris', court: 'Pic-Gris', abr: 'PIC', ville: 'Pic-Gris',
    devise: 'Plus lourds, plus forts, plus loin.',
    maillot: kit('#2f5233', 'uni', '#c9c9c9', '#1a2a1c', '#e8e8e8'),
    exterieur: kit('#c9c9c9', 'bande', '#2f5233', '#2f5233', '#2f5233'),
    ecusson: { forme: 'hexagone', fond: '#2f5233', fond2: '#1a2a1c', motif: 'chevron', symbole: 'montagne', symboleC: '#e8e8e8', bord: '#c9c9c9' },
    style: 'avants',
    joueurs: [j('Xavier Ossau', 1, [56, 93, 56, 36, 82], true), j('Yves Gavarnie', 2, [62, 90, 64, 42, 80]), j('Zacharie Aspin', 3, [55, 90, 55, 36, 80]),
      j('Adrien Barèges', 9, [76, 60, 82, 70, 68]), j('Baptiste Luz', 10, [73, 62, 78, 80, 68]), j('Clément Arrens', 12, [76, 84, 70, 58, 80]), j('Dorian Estaing', 11, [87, 68, 64, 54, 66])],
  },
  {
    id: 'azurine', nom: 'Dauphins d’Azurine', court: 'Azurine', abr: 'AZU', ville: 'Azurine',
    devise: 'Toujours une passe d’avance.',
    maillot: kit('#14a3a3', 'uni', '#ffffff', '#0b4a4a', '#ffffff'),
    exterieur: kit('#ffffff', 'cerceaux', '#14a3a3', '#14a3a3', '#0b4a4a'),
    ecusson: { forme: 'losange', fond: '#14a3a3', fond2: '#0b4a4a', motif: 'uni', symbole: 'vague', symboleC: '#ffffff', bord: '#0b4a4a' },
    style: 'large',
    joueurs: [j('Émile Calanque', 1, [62, 86, 64, 38, 79]), j('Félix Porquerolle', 2, [68, 80, 74, 44, 76]), j('Gabriel Sanary', 3, [60, 85, 62, 36, 78]),
      j('Henri Bandol', 9, [82, 56, 92, 72, 66], true), j('Igor Cassis', 10, [78, 58, 86, 80, 66]), j('Julien Carqueiranne', 12, [82, 72, 80, 62, 76]), j('Karim Giens', 14, [96, 64, 70, 56, 66])],
  },
  {
    id: 'ferrac', nom: 'Rhinocéros de Ferrac', court: 'Ferrac', abr: 'FER', ville: 'Ferrac',
    devise: 'On ne contourne pas : on traverse.',
    maillot: kit('#7a1f33', 'uni', '#d9d0c2', '#3a0e18', '#d9d0c2'),
    exterieur: kit('#d9d0c2', 'bande', '#7a1f33', '#7a1f33', '#7a1f33'),
    ecusson: { forme: 'blason', fond: '#7a1f33', fond2: '#3a0e18', motif: 'demi', symbole: 'tour', symboleC: '#d9d0c2', bord: '#d9d0c2' },
    style: 'avants',
    joueurs: [j('Léo Ventabren', 1, [58, 88, 58, 38, 80]), j('Marc Rognac', 2, [64, 86, 66, 42, 80]), j('Nathan Lambesc', 3, [56, 88, 56, 36, 79]),
      j('Oscar Trets', 9, [78, 60, 84, 72, 68]), j('Paul Gardanne', 10, [74, 62, 80, 82, 68]), j('Robin Peynier', 12, [78, 84, 72, 60, 82], true), j('Samuel Fuveau', 11, [88, 66, 66, 56, 66])],
  },
  {
    id: 'bois-noir', nom: 'Sangliers de Bois-Noir', court: 'Bois-Noir', abr: 'BNO', ville: 'Bois-Noir',
    devise: 'Chaque ballon au sol est à nous.',
    maillot: kit('#4a3020', 'cerceaux', '#ff8a1f', '#2a1a10', '#ff8a1f'),
    exterieur: kit('#ff8a1f', 'uni', '#4a3020', '#4a3020', '#2a1a10'),
    ecusson: { forme: 'rond', fond: '#4a3020', fond2: '#ff8a1f', motif: 'cerceaux', symbole: 'feuille', symboleC: '#ff8a1f', bord: '#ff8a1f' },
    style: 'defense',
    joueurs: [j('Tristan Vézère', 1, [58, 88, 58, 38, 86]), j('Ulysse Sarlat', 2, [65, 86, 66, 42, 90], true), j('Victor Domme', 3, [56, 88, 56, 36, 85]),
      j('Wilfried Belvès', 9, [78, 58, 84, 72, 72]), j('Yanis Montignac', 10, [74, 60, 80, 82, 72]), j('Arthur Eyzies', 12, [78, 78, 72, 60, 84]), j('Benoît Carlux', 11, [88, 62, 66, 56, 70])],
  },
  {
    id: 'volterre', nom: 'Éclairs de Volterre', court: 'Volterre', abr: 'VOL', ville: 'Volterre',
    devise: 'Vous nous avez vus ? Trop tard.',
    maillot: kit('#5b2a86', 'bande', '#ffd84d', '#2e1446', '#ffd84d'),
    exterieur: kit('#ffd84d', 'uni', '#5b2a86', '#5b2a86', '#5b2a86'),
    ecusson: { forme: 'losange', fond: '#5b2a86', fond2: '#2e1446', motif: 'bande', symbole: 'eclair', symboleC: '#ffd84d', bord: '#ffd84d' },
    style: 'vitesse',
    joueurs: [j('Cédric Aubrac', 1, [64, 80, 60, 38, 76]), j('David Laguiole', 2, [70, 78, 68, 44, 76]), j('Elliot Salers', 3, [62, 80, 58, 36, 75]),
      j('Fabrice Murat', 9, [86, 54, 84, 70, 66]), j('Grégoire Thiézac', 10, [82, 56, 82, 78, 66]), j('Hector Vic', 12, [85, 72, 74, 58, 76]), j('Isaac Mandailles', 11, [99, 60, 66, 54, 64], true)],
  },
  {
    id: 'pre-sale', nom: 'Taureaux de Pré-Salé', court: 'Pré-Salé', abr: 'PRE', ville: 'Pré-Salé',
    devise: 'Ni trop vite, ni trop lent : juste devant.',
    maillot: kit('#d1232a', 'uni', '#ffffff', '#ffffff', '#ffffff'),
    exterieur: kit('#ffffff', 'bande', '#d1232a', '#d1232a', '#d1232a'),
    ecusson: { forme: 'bouclier', fond: '#d1232a', fond2: '#7a1014', motif: 'croix', symbole: 'couronne', symboleC: '#ffffff', bord: '#ffffff' },
    style: 'equilibre',
    joueurs: [j('Jérôme Camargue', 1, [60, 87, 60, 38, 81]), j('Laurent Aigues', 2, [66, 84, 68, 44, 80], true), j('Mathis Saintes', 3, [58, 86, 58, 36, 79]),
      j('Nolan Arles', 9, [80, 58, 86, 72, 68]), j('Patrice Beaucaire', 10, [76, 60, 84, 84, 68]), j('Romain Tarascon', 12, [80, 78, 74, 62, 80]), j('Sacha Vauvert', 11, [90, 64, 68, 56, 66])],
  },
  {
    id: 'port-galet', nom: 'Cormorans de Port-Galet', court: 'Port-Galet', abr: 'PGA', ville: 'Port-Galet',
    devise: 'Haut, loin, et on retombe dessus.',
    maillot: kit('#14284a', 'cerceaux', '#ffffff', '#14284a', '#ffffff'),
    exterieur: kit('#ffffff', 'uni', '#14284a', '#14284a', '#14284a'),
    ecusson: { forme: 'rond', fond: '#14284a', fond2: '#ffffff', motif: 'cerceaux', symbole: 'ancre', symboleC: '#ffffff', bord: '#9ac0ff' },
    style: 'pied',
    joueurs: [j('Thomas Kerlouan', 1, [58, 88, 58, 42, 82]), j('Valère Plouguerneau', 2, [64, 86, 66, 48, 82]), j('Aymeric Landéda', 3, [56, 88, 56, 40, 81]),
      j('Bruno Portsall', 9, [80, 58, 84, 84, 68]), j('Corentin Aber', 10, [76, 60, 82, 92, 68]), j('Denis Brignogan', 12, [80, 78, 72, 74, 80]), j('Erwan Guissény', 15, [94, 62, 68, 82, 70], true)],
  },
  {
    id: 'haut-pierre', nom: 'Ours de Haut-Pierre', court: 'Haut-Pierre', abr: 'HPI', ville: 'Haut-Pierre',
    devise: 'Donnez-lui le ballon, il fera le reste.',
    maillot: kit('#1f4fa8', 'uni', '#f2c14e', '#10285a', '#f2c14e'),
    exterieur: kit('#f2c14e', 'uni', '#1f4fa8', '#1f4fa8', '#10285a'),
    ecusson: { forme: 'blason', fond: '#1f4fa8', fond2: '#10285a', motif: 'chevron', symbole: 'etoile', symboleC: '#f2c14e', bord: '#f2c14e' },
    style: 'vedette',
    joueurs: [j('François Morvan', 1, [56, 84, 56, 36, 78]), j('Guillaume Avallon', 2, [62, 82, 64, 42, 78]), j('Hervé Saulieu', 3, [55, 84, 55, 34, 77]),
      j('Ivan Vézelay', 9, [76, 56, 82, 70, 66]), j('Jean Semur', 10, [90, 74, 88, 86, 74], true), j('Kylian Arnay', 12, [76, 76, 70, 58, 78]), j('Ludovic Précy', 11, [86, 62, 64, 54, 64])],
  },
  {
    id: 'crete-rouge', nom: 'Vautours de Crête-Rouge', court: 'Crête-Rouge', abr: 'CRR', ville: 'Crête-Rouge',
    devise: 'Il plane, il fond, il marque.',
    maillot: kit('#e8641e', 'demi', '#1a1a1a', '#1a1a1a', '#ffffff'),
    exterieur: kit('#1a1a1a', 'uni', '#e8641e', '#1a1a1a', '#e8641e'),
    ecusson: { forme: 'hexagone', fond: '#1a1a1a', fond2: '#e8641e', motif: 'demi', symbole: 'flamme', symboleC: '#ffb066', bord: '#e8641e' },
    style: 'vedette',
    joueurs: [j('Marius Cévennes', 1, [56, 84, 56, 36, 78]), j('Nils Florac', 2, [62, 82, 64, 42, 78]), j('Octave Anduze', 3, [55, 84, 55, 34, 77]),
      j('Philippe Alès', 9, [76, 56, 82, 70, 66]), j('Raoul Sauve', 10, [73, 58, 78, 80, 66]), j('Stéphane Ganges', 12, [76, 76, 70, 58, 78]), j('Tom Lasalle', 11, [99, 74, 74, 62, 70], true)],
  },
  {
    id: 'grand-gel', nom: 'Mammouths de Grand-Gel', court: 'Grand-Gel', abr: 'GGE', ville: 'Grand-Gel',
    devise: 'Lents à se fâcher, durs à arrêter.',
    maillot: kit('#f4f6fa', 'bande', '#1a2a5a', '#1a2a5a', '#1a2a5a'),
    exterieur: kit('#1a2a5a', 'uni', '#f4f6fa', '#1a2a5a', '#f4f6fa'),
    ecusson: { forme: 'rond', fond: '#1a2a5a', fond2: '#f4f6fa', motif: 'croix', symbole: 'montagne', symboleC: '#f4f6fa', bord: '#f4f6fa' },
    style: 'equilibre',
    joueurs: [j('Urbain Lautaret', 1, [60, 86, 60, 38, 80]), j('Vincent Izoard', 2, [66, 84, 68, 44, 80]), j('Alexis Vars', 3, [58, 86, 58, 36, 79]),
      j('Benjamin Queyras', 9, [80, 58, 86, 72, 68]), j('Charles Embrun', 10, [76, 60, 84, 84, 68]), j('Dylan Briançonnet', 12, [81, 82, 76, 62, 82], true), j('Enzo Guillestre', 11, [90, 64, 68, 56, 66])],
  },
  {
    id: 'clairbois', nom: 'Chevreuils de Clairbois', court: 'Clairbois', abr: 'CLA', ville: 'Clairbois',
    devise: 'Là où il y a de l’herbe, on passe.',
    maillot: kit('#5cbf4a', 'cerceaux', '#ffffff', '#24561c', '#ffffff'),
    exterieur: kit('#24561c', 'uni', '#5cbf4a', '#24561c', '#5cbf4a'),
    ecusson: { forme: 'losange', fond: '#5cbf4a', fond2: '#24561c', motif: 'rayures', symbole: 'fleche', symboleC: '#ffffff', bord: '#24561c' },
    style: 'large',
    joueurs: [j('Fernand Ardenne', 1, [62, 84, 64, 38, 78]), j('Gaspard Sedan', 2, [68, 80, 72, 44, 76]), j('Honoré Rocroi', 3, [60, 84, 62, 36, 77]),
      j('Jules Givet', 9, [82, 56, 88, 72, 66]), j('Lino Revin', 10, [80, 60, 92, 82, 68], true), j('Mattéo Fumay', 12, [82, 72, 80, 62, 76]), j('Noé Charleville', 14, [94, 62, 70, 56, 64])],
  },
];

export const EQUIPE = Object.fromEntries(EQUIPES.map((e) => [e.id, e]));

const CLES = ['vitesse', 'force', 'passe', 'pied', 'defense'];

/** Les notes d'un joueur (bornées). */
export function notesJoueur(eq, i) {
  const n = { ...eq.joueurs[i].notes };
  for (const k of CLES) n[k] = Math.max(30, Math.min(99, n[k]));
  return n;
}

/** Les notes moyennes d'une équipe (pour l'affichage). */
export function notesEquipe(eq) {
  const n = Object.fromEntries(CLES.map((k) => [k, 0]));
  for (const p of eq.joueurs) for (const k of CLES) n[k] += p.notes[k] / eq.joueurs.length;
  for (const k of CLES) n[k] = Math.round(n[k]);
  return n;
}

/** La note générale d'une équipe. */
export const noteGenerale = (eq) => { const n = notesEquipe(eq); return Math.round(CLES.reduce((s, k) => s + n[k], 0) / CLES.length); };

/** La note d'un joueur (pour les cartes). */
export const noteJoueur = (eq, i) => { const n = eq.joueurs[i].notes; return Math.round(CLES.reduce((s, k) => s + n[k], 0) / CLES.length); };
