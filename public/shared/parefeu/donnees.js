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
 *  parfait   : chance de réussir son mini-défi sans faute ;
 *  ameliore  : chance d'acheter une amélioration quand il a de quoi.
 */
/* ------------------------------------------------------------------ */
/* Les améliorations                                                   */
/* ------------------------------------------------------------------ */

/**
 * Le Laboratoire : des technologies pour tout son réseau, 3 niveaux chacune,
 * achetées en cycles pendant la partie. `effets[n]` décrit le niveau n + 1.
 */
export const TECHS = {
  // Attaque
  ver:         { cote: 'att', nom: 'Ver mutant', glyphe: '◆', couts: [30, 55, 85], effets: ['+2 dégâts', '+4 dégâts', '+6 dégâts'] },
  cheval:      { cote: 'att', nom: 'Cheval blindé', glyphe: '♞', couts: [40, 70, 105], effets: ['+4 dégâts', '+8 dégâts', '+12 dégâts'] },
  saturation:  { cote: 'att', nom: 'Saturation longue', glyphe: '◎', couts: [40, 70, 105], effets: ['+1,5 s', '+3 s', '+4,5 s'] },
  rancon:      { cote: 'att', nom: 'Rançon gourmande', glyphe: '¤', couts: [35, 60, 95], effets: ['vol +10 %', 'vol +20 %', 'vol +30 %'] },
  sonde:       { cote: 'att', nom: 'Sonde profonde', glyphe: '◬', couts: [25, 45, 70], effets: ['+6 s', '+12 s', '+18 s'] },
  breche:      { cote: 'att', nom: 'Brèche béante', glyphe: '⚡', couts: [35, 60, 95], effets: ['+6 dégâts', '+12 dégâts', '+18 dégâts'] },
  vitesse:     { cote: 'att', nom: 'Fibre optique', glyphe: '»', couts: [40, 70, 110], effets: ['programmes +12 % de vitesse', '+24 %', '+36 %'] },
  recharge:    { cote: 'att', nom: 'Compilateur', glyphe: '↻', couts: [45, 80, 120], effets: ['recharges −12 %', '−24 %', '−36 %'] },
  // Défense
  parefeu:     { cote: 'def', nom: 'Pare-feu renforcé', glyphe: '▦', couts: [35, 60, 95], effets: ['+1 charge, max +2', '+2 charges, max +4', '+3 charges, max +6'] },
  antivirus:   { cote: 'def', nom: 'Antivirus heuristique', glyphe: '✚', couts: [40, 70, 105], effets: ['+3 s, tire plus vite', '+6 s, encore plus vite', '+9 s, mitrailleuse'] },
  leurre:      { cote: 'def', nom: 'Leurre vorace', glyphe: '◌', couts: [30, 55, 85], effets: ['avale +3, +3 s', 'avale +6, +6 s', 'avale +9, +9 s'] },
  chiffrement: { cote: 'def', nom: 'Chiffrement quantique', glyphe: '⌬', couts: [35, 60, 95], effets: ['ne prend que 42 %', '35 %', '28 %'] },
  correctif:   { cote: 'def', nom: 'Correctif express', glyphe: '✦', couts: [30, 55, 85], effets: ['soin +12 %', 'soin +24 %', 'soin +36 %'] },
  regen:       { cote: 'def', nom: 'Auto-réparation', glyphe: '♥', couts: [35, 65, 100], effets: ['réparation +40 %', '+80 %', '+120 %'] },
  // Économie
  overclock:   { cote: 'eco', nom: 'Overclock', glyphe: '⚙', couts: [40, 75, 120], effets: ['revenu +10 %', '+20 %', '+30 %'] },
};
export const LISTE_TECHS = Object.keys(TECHS);

/** Les améliorations d'un nœud (le sien), 3 niveaux, perdues s'il est pris. */
export const AMELIORATIONS = {
  blindage:   { nom: 'Blindage', glyphe: '⬢', couts: [25, 45, 75], aide: 'PV max +35 % par niveau' },
  rendement:  { nom: 'Rendement', glyphe: '$', couts: [30, 50, 80], aide: '+0,8 cycle par seconde par niveau' },
  tourelle:   { nom: 'Tourelle', glyphe: '⌖', couts: [35, 60, 95], aide: 'Détruit seule les programmes qui approchent (toutes les 2,2 / 1,6 / 1,1 s)' },
  bouclier:   { nom: 'Bouclier', glyphe: '⛨', couts: [30, 55, 85], aide: 'Regagne seul une charge de pare-feu (toutes les 14 / 10 / 7 s, jusqu’à 2 / 3 / 4)' },
  propulseur: { nom: 'Propulseur', glyphe: '➚', couts: [30, 55, 85], aide: 'Les programmes partis d’ici : +15 % de vitesse et +10 % de dégâts par niveau' },
};
export const LISTE_AMELIORATIONS = Object.keys(AMELIORATIONS);
export const NIV_MAX = 3;
export const TOURELLE = { portee: 130, cadence: [2.2, 1.6, 1.1] };
export const BOUCLIER = { periode: [14, 10, 7] };
export const CHIFFRE_TECH = [0.5, 0.42, 0.35, 0.28];

/* ------------------------------------------------------------------ */
/* Les événements                                                      */
/* ------------------------------------------------------------------ */

/** Le premier arrive après `PREMIER_EVENEMENT` s, les suivants tous les `ECART_EVENEMENTS` s (au hasard dans l'intervalle). */
export const PREMIER_EVENEMENT = [40, 60];
export const ECART_EVENEMENTS = [35, 60];
export const EVENEMENTS = {
  panne:      { nom: 'PANNE DE COURANT', glyphe: '⏻', duree: 6, aide: 'Toutes les défenses sont coupées !' },
  surtension: { nom: 'SURTENSION', glyphe: 'ϟ', duree: 20, aide: 'Les revenus doublent.' },
  tempete:    { nom: 'TEMPÊTE DE DONNÉES', glyphe: '≋', duree: 15, aide: 'Les programmes vont 40 % plus vite.' },
  soldes:     { nom: 'MARCHÉ NOIR', glyphe: '%', duree: 15, aide: 'Toutes les actions coûtent 40 % de moins.' },
  fuite:      { nom: 'FUITE DE DONNÉES', glyphe: '◉', duree: 12, aide: 'Toutes les défenses sont visibles.' },
  cache:      { nom: 'CACHE DE DONNÉES', glyphe: '◈', duree: 30, prime: 60, aide: 'Un nœud neutre cache 60 cycles : le premier qui le prend les gagne.' },
};
export const LISTE_EVENEMENTS = Object.keys(EVENEMENTS);

/**
 * Une personne qui tape ses commandes, un geste à la fois (`reflexion` =
 * secondes entre deux gestes, `hesite` = chance de ne rien faire) :
 * Facile n'a jamais touché un ordinateur (lent, hésitant), Normal sait taper
 * mais cherche ses touches, Difficile connaît son clavier par cœur (vif, sûr).
 */
export const NIVEAUX = {
  facile:    { nom: 'Facile', desc: 'N’a jamais touché un ordinateur', ameliore: 0.15, parfait: 0.12, reflexion: 2.6, hesite: 0.4, defense: 0.45, focus: 0.5, breche: [1, 2], revenu: 0.9, reserve: 10 },
  normal:    { nom: 'Normal', desc: 'Sait taper, mais cherche ses touches', ameliore: 0.5, parfait: 0.45, reflexion: 1.3, hesite: 0.12, defense: 0.78, focus: 0.72, breche: [2, 4], revenu: 1, reserve: 18 },
  difficile: { nom: 'Difficile', desc: 'Connaît son clavier par cœur', ameliore: 0.85, parfait: 0.8, reflexion: 0.72, hesite: 0, defense: 0.95, focus: 0.9, breche: [3, 5], revenu: 1.2, reserve: 24 },
};
