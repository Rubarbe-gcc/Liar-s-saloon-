/**
 * PARE-FEU — les chiffres du jeu.
 *
 * Tout reste abstrait : des « programmes » qui voyagent le long des liens d'un
 * réseau imaginaire, des « défenses » posées sur ses propres nœuds. Aucune
 * vraie technique informatique.
 *
 * Unités : la carte fait 1000 × 1000, le temps est en secondes, la ressource
 * s'appelle les cycles.
 */

/** Une image du moteur : 20 par seconde. */
export const DT = 0.05;

/** La ressource. */
export const CYCLES = {
  depart: 35,
  max: 160,
  base: 3,        // par seconde, toujours
};

/** Les nœuds. `revenu` : cycles par seconde pour qui le tient. */
export const NOEUDS = {
  noyau:   { nom: 'Noyau', pv: 150, revenu: 0, regen: 2.2 },
  serveur: { nom: 'Serveur', pv: 64, revenu: 1.1, regen: 1.5 },
  relais:  { nom: 'Relais', pv: 52, revenu: 1.6, regen: 1.5 },
  nexus:   { nom: 'Nexus', pv: 90, revenu: 3, regen: 1.5 },
  eteint:  { nom: 'Noyau éteint', pv: 90, revenu: 2, regen: 1.5 },
};
/** Un nœud regagne ses PV au bout de tant de secondes sans être touché. */
export const CALME = 3;
/** Les nœuds neutres reviennent à fond, plus lentement à se calmer. */
export const CALME_NEUTRE = 5;
export const REGEN_NEUTRE = 2.5;
/** Un nœud pris repart avec cette part de ses PV. */
export const PRISE_PV = 0.35;
/** Les nœuds d'un joueur éliminé redeviennent neutres, avec cette part de PV. */
export const ABANDON_PV = 0.3;
/** Prendre un Noyau rapporte. */
export const PRIME_NOYAU = 50;

/** Les programmes d'attaque. */
export const PROGRAMMES = {
  ver: {
    nom: 'Ver', court: 'Ver', defi: 2, glyphe: '◆', touche: '1',
    cout: 8, recharge: 0.45, vitesse: 175, degats: 5,
    aide: 'Rapide et pas cher, mais faible. Arrêté par le pare-feu.',
  },
  cheval: {
    nom: 'Cheval de Troie', court: 'Cheval', defi: 4, glyphe: '♞', touche: '2',
    cout: 22, recharge: 3, vitesse: 105, degats: 13,
    aide: 'Passe un pare-feu sans y laisser de charge. L’antivirus le voit.',
  },
  saturation: {
    nom: 'Saturation', court: 'Saturer', defi: 5, glyphe: '◎', touche: '3',
    cout: 26, recharge: 9, vitesse: 135, degats: 2, duree: 4.5,
    aide: 'Bloque le nœud 4,5 s : ses défenses s’éteignent, il ne se répare plus et prend 25 % de plus.',
  },
  rancon: {
    nom: 'Rançongiciel', court: 'Rançon', defi: 5, glyphe: '¤', touche: '4',
    cout: 28, recharge: 10, vitesse: 95, degats: 4, vol: 0.3, volMax: 45,
    aide: 'Vole 30 % des cycles du propriétaire (45 au plus).',
  },
  sonde: {
    nom: 'Sonde', court: 'Sonde', defi: 2, glyphe: '◬', touche: '5',
    cout: 6, recharge: 4, vitesse: 250, degats: 0, duree: 18,
    aide: 'Révèle 18 s toutes les défenses de ce joueur. Ignore pare-feu et leurres.',
  },
};
export const LISTE_PROGRAMMES = Object.keys(PROGRAMMES);

/** Les défenses, posées sur ses nœuds ou ceux d'un coéquipier. */
export const DEFENSES = {
  parefeu: {
    nom: 'Pare-feu', court: 'Pare-feu', defi: 3, glyphe: '▦', touche: '1',
    cout: 18, recharge: 5, charges: 3, max: 8,
    aide: '+3 charges : chaque programme qui arrive en consomme une et s’arrête.',
  },
  antivirus: {
    nom: 'Antivirus', court: 'Antivirus', defi: 5, glyphe: '✚', touche: '2',
    cout: 28, recharge: 12, duree: 9, cadence: 0.5, portee: 160,
    aide: 'Pendant 9 s, détruit les programmes qui approchent (un toutes les 0,5 s).',
  },
  leurre: {
    nom: 'Leurre', court: 'Leurre', defi: 4, glyphe: '◌', touche: '3',
    cout: 22, recharge: 14, duree: 10, absorbe: 7,
    aide: 'Pendant 10 s, attire les programmes visant ce nœud et ses voisins, et les avale (7 au plus).',
  },
  chiffrement: {
    nom: 'Chiffrement', court: 'Chiffrer', defi: 4, glyphe: '⌬', touche: '4',
    cout: 20, recharge: 10, duree: 14, facteur: 0.5,
    aide: 'Pendant 14 s, le nœud ne prend que la moitié des dégâts.',
  },
  correctif: {
    nom: 'Correctif', court: 'Correctif', defi: 3, glyphe: '✦', touche: '5',
    cout: 16, recharge: 6, soin: 0.35,
    aide: 'Répare 35 % du nœud et le libère d’une saturation.',
  },
};
export const LISTE_DEFENSES = Object.keys(DEFENSES);

/**
 * Chaque action passe par un mini-défi : une combinaison de flèches, lettres
 * et chiffres de `defi` + 1 symboles (plus longue pour une action forte).
 * Réussi sans faute, il est « parfait » : l'action vaut PARFAIT de plus
 * (dégâts, durées, soin ; +1 charge de pare-feu, +2 programmes avalés par le leurre).
 */
export const PARFAIT = 1.25;

/** Le forçage : un mini-défi (une suite de flèches) qui frappe d'un coup. */
export const BRECHE = {
  nom: 'Brèche', court: 'Brèche', glyphe: '⚡', touche: 'B',
  cout: 15, recharge: 18, longueur: 5, temps: 4, degats: 24, sature: 2,
  aide: 'Une suite de 5 flèches à taper en 4 s : chaque bonne flèche frappe le nœud. Parfait : il sature 2 s.',
};

/** La surchauffe : au fil de la partie, tout frappe plus fort, pour qu'elle finisse. */
export const SURCHAUFFE = [
  { apres: 180, mult: 1.5 },
  { apres: 300, mult: 2 },
  { apres: 420, mult: 3 },
];
/** Au bout de tant de secondes, on compte les nœuds. */
export const DUREE_MAX = 600;

/** Les couleurs des quatre joueurs (néon). */
export const COULEURS = ['#2ef2ff', '#ff3df0', '#b6ff3d', '#ffb02e'];
export const COULEUR_NEUTRE = '#6b7a99';
export const NOMS_IA = ['NULL_PTR', 'GLITCH', 'K3RN3L', 'BYTE_ROUGE', 'ZÉRO_DAY', 'SPECTRE', 'MAINFRAME', 'PIXEL'];

/**
 * Les niveaux de l'ordinateur.
 *  reflexion : secondes entre deux décisions ;
 *  defense   : chance de réagir à une menace ;
 *  focus     : chance de garder sa cible ;
 *  breche    : score du mini-défi [min, max] ;
 *  revenu    : multiplicateur de revenu ;
 *  parfait   : chance de réussir son mini-défi sans faute.
 */
export const NIVEAUX = {
  facile:    { nom: 'Facile', parfait: 0.25, reflexion: 1.3, defense: 0.4, focus: 0.45, breche: [1, 3], revenu: 0.85, reserve: 10 },
  normal:    { nom: 'Normal', parfait: 0.5, reflexion: 0.75, defense: 0.75, focus: 0.7, breche: [2, 4], revenu: 1, reserve: 18 },
  difficile: { nom: 'Difficile', parfait: 0.75, reflexion: 0.35, defense: 0.95, focus: 0.9, breche: [3, 5], revenu: 1.32, reserve: 24 },
};
