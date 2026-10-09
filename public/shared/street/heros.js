/**
 * STREET COMBAT — le héros qu'on crée pour le mode Histoire.
 *
 * Module ISO. Le joueur choisit un nom, une carrure, une coiffure, une
 * peau, ses couleurs, ses accessoires, une école de combat (sa saisie, ses
 * combos) et, parmi celles de son école, ses techniques — deux spéciaux et
 * un ultime qui ne sont qu’à lui : aucun autre combattant ne les a. `construireHeros`
 * en fait une fiche de combattant complète, comme celles de persos.js,
 * que le moteur sait faire combattre (on l'inscrit dans PERSO sous l'id
 * 'heros' le temps de la partie).
 */

import { BRIQUES } from './persos.js';

const { proj, faisceau, ruee, zone } = BRIQUES;

export const CORPS = [['fin', 'Fin'], ['normal', 'Normal'], ['massif', 'Massif']];

export const TETES = [
  ['bandeau', 'Bandeau'], ['pics', 'Pics'], ['crete', 'Crête'], ['longs', 'Longs'], ['couettes', 'Couettes'],
  ['chignon', 'Chignon'], ['rase', 'Rasé'], ['capuche', 'Capuche'], ['cornes', 'Cornes'], ['plumes', 'Plumes'],
];

export const PEAUX = ['#f2d0b0', '#e0b090', '#c8946c', '#a06a48', '#704830', '#4a2e1e'];

/** La couleur principale : l'énergie, les gants, l'aura, la ceinture. */
export const ENERGIES = {
  rouge: { c1: '#ff3a4a', c2: '#8a0a1a', faisceau: '#ff8a8a', aura: '#ff2a3a', ceinture: '#ff3a4a' },
  orange: { c1: '#ff8a1a', c2: '#8a3a00', faisceau: '#ffc070', aura: '#ff7a00', ceinture: '#ff8a1a' },
  or: { c1: '#ffd23f', c2: '#8a6400', faisceau: '#ffe680', aura: '#ffc800', ceinture: '#ffd23f' },
  vert: { c1: '#36d46a', c2: '#0a5a24', faisceau: '#a0ffb8', aura: '#2ac85a', ceinture: '#36d46a' },
  cyan: { c1: '#3ae0e0', c2: '#0a5a64', faisceau: '#a8fff2', aura: '#20d0d0', ceinture: '#3ae0e0' },
  bleu: { c1: '#3a8aff', c2: '#0a2a8a', faisceau: '#9ac4ff', aura: '#2a70ff', ceinture: '#3a8aff' },
  violet: { c1: '#b45aff', c2: '#4a0a8a', faisceau: '#dcb0ff', aura: '#9a3aff', ceinture: '#b45aff' },
  rose: { c1: '#ff5ab4', c2: '#8a0a50', faisceau: '#ffb0dc', aura: '#ff3aa0', ceinture: '#ff5ab4' },
};

export const TENUES = ['#f2f2f2', '#1a1a22', '#c8102e', '#1a3a8a', '#1a6a3a', '#4a1a6a', '#5a5a64', '#6a4020'];
export const CHEVEUX = ['#141414', '#5a3418', '#c8a050', '#f4ecd8', '#c8301a', '#2a4ac8', '#36c86a', '#e05ab4'];

export const ACCESSOIRES = [
  ['cape', 'Cape'], ['echarpe', 'Écharpe'], ['katana', 'Katana'], ['brassards', 'Brassards'],
  ['armure', 'Armure'], ['haori', 'Haori'], ['barbe', 'Barbe'], ['ailes', 'Ailes'],
];
export const MAX_ACCESSOIRES = 3;

/* ---------------------------------------------------------------- */
/* La progression : le héros gagne de l'expérience dans l'histoire    */
/* ---------------------------------------------------------------- */

export const NIVEAU_MAX = 20;
/** L'expérience qu'il faut, au total, pour atteindre ce niveau. */
export const xpPour = (n) => 40 * n * (n - 1);
export function niveauDe(xp = 0) {
  let n = 1;
  while (n < NIVEAU_MAX && xp >= xpPour(n + 1)) n += 1;
  return n;
}
/** Ce que rapporte un combat de l'histoire : plus pour une belle note, et plus on avance. */
export function gainXp({ gagne = true, note = 'C', acte = 0 } = {}) {
  if (!gagne) return 20;
  return 100 + ({ S: 150, A: 90, B: 40, C: 0 }[note] || 0) + acte * 10;
}

/** Les deux énergies qu'on gagne en montant de niveau. */
export const ENERGIES_BONUS = {
  blanc: { c1: '#f4f8ff', c2: '#7a8aa8', faisceau: '#ffffff', aura: '#e8f0ff', ceinture: '#f4f8ff' },
  noir: { c1: '#3a2a4a', c2: '#0a0610', faisceau: '#b48aff', aura: '#5a3a8a', ceinture: '#1a1222' },
};
/** Ce que débloque chaque niveau. `champ` : l'option du créateur qu'il complète. */
export const RECOMPENSES = [
  { niveau: 2, champ: 'cheveux', val: '#ffffff', nom: 'Cheveux blancs' },
  { niveau: 3, champ: 'tete', val: 'ninja', nom: 'Coiffure de ninja' },
  { niveau: 4, champ: 'tenue', val: '#c8961e', nom: 'Tenue dorée' },
  { niveau: 5, champ: 'accessoires', val: 'gants-boxe', nom: 'Gants de boxe' },
  { niveau: 6, champ: 'energie', val: 'blanc', nom: 'Énergie blanche' },
  { niveau: 7, champ: 'tete', val: 'casque', nom: 'Casque' },
  { niveau: 8, champ: 'accessoires', val: 'ceinture-champion', nom: 'Ceinture de champion' },
  { niveau: 9, champ: 'cheveux', val: '#7a3af0', nom: 'Cheveux violets' },
  { niveau: 10, champ: 'tete', val: 'halo', nom: 'Auréole' },
  { niveau: 11, champ: 'energie', val: 'noir', nom: 'Énergie noire' },
  { niveau: 12, champ: 'accessoires', val: 'armure-noire', nom: 'Armure noire' },
  { niveau: 13, champ: 'tete', val: 'visiere', nom: 'Visière' },
  { niveau: 14, champ: 'accessoires', val: 'yeux-luisants', nom: 'Yeux luisants' },
  { niveau: 15, champ: 'accessoires', val: 'ailes-lumiere', nom: 'Ailes de lumière' },
  { niveau: 16, champ: 'tete', val: 'cristaux', nom: 'Couronne de cristaux' },
  { niveau: 17, champ: 'accessoires', val: 'armure-or', nom: 'Armure d’or' },
  { niveau: 18, champ: 'tenue', val: '#0e0e14', nom: 'Tenue de légende' },
  { niveau: 19, champ: 'tete', val: 'couronne-etoiles', nom: 'Couronne d’étoiles' },
  { niveau: 20, champ: 'accessoires', val: 'ailes-dragon', nom: 'Ailes de dragon' },
];
/** Les récompenses déjà gagnées à ce niveau ; celles qu'on gagne en passant d'un niveau à l'autre. */
export const recompensesDe = (niveau) => RECOMPENSES.filter((r) => r.niveau <= niveau);
export const nouvellesRecompenses = (avant, apres) => RECOMPENSES.filter((r) => r.niveau > avant && r.niveau <= apres);
const bonus = (champ) => RECOMPENSES.filter((r) => r.champ === champ).map((r) => r.val);

export const GENRES = [['h', 'Homme'], ['f', 'Femme']];
/** La voix : une hauteur (grave 0.5 → aigu 1.6) et un timbre (masculin 0 → féminin 1). */
export const VOIX_HAUTEUR = [0.5, 1.6];

/**
 * Les techniques du héros : à lui seul. Aucun autre combattant ne les a —
 * ni leurs noms, ni leurs formes (`heros-…`), ni leurs cinématiques.
 * Chaque école a les siennes, trois de chaque sorte, dans son élément
 * (`teinte` : la couleur de l'élément, sinon celle de l'énergie du héros) ;
 * on en choisit une de chaque dans le créateur :
 *   • a : le Spécial A (deux segments de jauge) ;
 *   • b : le Spécial B (un segment) ;
 *   • u : l'ultime (la jauge pleine), avec sa cinématique.
 */
const FEU = '#ff7a1a';
const GLACE = '#bdf3ff';
const ECLAIR = '#ffe066';
const OMBRE = '#9a3aff';
const TERRE = '#c8a050';
const ACIER = '#e8eef8';
const ASTRE = '#fff0a0';

export const TECHNIQUES = {
  a: {
    // Poing de Ki
    eclat: { nom: 'ÉCLAT DU HÉROS !', texte: 'Un cristal d’énergie, droit devant.', ...proj({ vitesse: 12, rayon: 20, degats: 14, forme: 'heros-eclat' }) },
    salve: { nom: 'SALVE DE KI !', texte: 'Trois petits éclats, l’un après l’autre.', ...proj({ vitesse: 13, rayon: 12, degats: 6, nb: 3, intervalle: 8, forme: 'heros-eclat' }) },
    tresse: { nom: 'RAYON TRESSÉ !', texte: 'Deux rayons enlacés, très longue portée.', ...faisceau({ portee: 600, epaisseur: 28, degats: 14, stun: 24, tresse: true }) },
    // Flamme
    phenix: { nom: 'PETIT PHÉNIX !', texte: 'Un oiseau de feu qui brûle.', ...proj({ vitesse: 11, rayon: 20, degats: 12, forme: 'heros-phenix', effet: 'brulure' }) },
    braise: { nom: 'MÉTÉORE DE BRAISE !', texte: 'Un roc en feu lancé en cloche.', ...proj({ vitesse: 9, rayon: 22, degats: 14, duree: 90, forme: 'heros-meteore', vy: -8, gravite: 0.35, effet: 'brulure', teinte: FEU }) },
    ardent: { nom: 'RAYON ARDENT !', texte: 'Un rayon de flammes, plus court, qui brûle.', ...faisceau({ portee: 420, epaisseur: 30, degats: 13, stun: 24, tresse: true, couleur: FEU, effet: 'brulure' }) },
    // Foudre
    arc: { nom: 'ARC ÉLECTRIQUE !', texte: 'Un rayon d’éclairs tressés, très longue portée.', ...faisceau({ portee: 620, epaisseur: 24, degats: 13, stun: 28, tresse: true, couleur: ECLAIR }) },
    chercheur: { nom: 'ÉCLAIR CHERCHEUR !', texte: 'Un éclat de foudre qui suit l’adversaire.', ...proj({ vitesse: 9, rayon: 16, degats: 11, duree: 110, tete: true, forme: 'heros-eclat', teinte: ECLAIR }) },
    gerbe: { nom: 'GERBE D’ÉTINCELLES !', texte: 'Trois étincelles en éventail.', ...proj({ vitesse: 12, rayon: 11, degats: 5, nb: 3, eventail: true, forme: 'heros-eclat', teinte: ECLAIR }) },
    // Givre
    flocon: { nom: 'FLOCON TRANCHANT !', texte: 'Un flocon géant qui gèle.', ...proj({ vitesse: 13, rayon: 18, degats: 12, forme: 'heros-flocon', effet: 'gel' }) },
    glace: { nom: 'ÉCLAT DE GLACE !', texte: 'Un cristal de glace, très rapide, qui gèle.', ...proj({ vitesse: 15, rayon: 16, degats: 11, forme: 'heros-eclat', effet: 'gel', teinte: GLACE }) },
    polaire: { nom: 'SOUFFLE POLAIRE !', texte: 'Un rayon glacé, court, qui gèle.', ...faisceau({ portee: 380, epaisseur: 30, degats: 10, stun: 26, tresse: true, couleur: GLACE, effet: 'gel' }) },
    // Ombre
    corbeau: { nom: 'VOL DE CORBEAUX !', texte: 'Des corbeaux d’ombre au ras du sol.', ...proj({ vitesse: 10, rayon: 22, degats: 13, forme: 'heros-corbeau', rase: true }) },
    nuee: { nom: 'NUÉE NOIRE !', texte: 'Deux vols de corbeaux en éventail.', ...proj({ vitesse: 11, rayon: 16, degats: 7, nb: 2, eventail: true, forme: 'heros-corbeau' }) },
    traqueur: { nom: 'CORBEAU TRAQUEUR !', texte: 'Un corbeau qui ne lâche pas sa proie.', ...proj({ vitesse: 8, rayon: 18, degats: 11, duree: 120, tete: true, forme: 'heros-corbeau' }) },
    // Colosse
    meteore: { nom: 'POING-MÉTÉORE !', texte: 'Un roc d’énergie lancé en cloche, très lourd.', ...proj({ vitesse: 9, rayon: 24, degats: 16, duree: 90, forme: 'heros-meteore', vy: -8, gravite: 0.35 }) },
    boulet: { nom: 'BOULET DE ROC !', texte: 'Un roc tout droit, lent, qui repousse loin.', ...proj({ vitesse: 7, rayon: 28, degats: 15, stun: 30, recul: 18, forme: 'heros-meteore', teinte: TERRE }) },
    eboulis: { nom: 'ÉBOULIS !', texte: 'Deux rocs lancés en cloche, l’un après l’autre.', ...proj({ vitesse: 9, rayon: 16, degats: 8, nb: 2, intervalle: 10, duree: 90, vy: -9, gravite: 0.4, forme: 'heros-meteore', teinte: TERRE }) },
    // Lame
    anneau: { nom: 'ANNEAU D’ACIER !', texte: 'Un anneau tranchant qui traverse tout.', ...proj({ vitesse: 12, rayon: 22, degats: 13, forme: 'heros-anneau', traverse: true }) },
    dagues: { nom: 'DAGUES JUMELLES !', texte: 'Deux anneaux plus petits, en éventail.', ...proj({ vitesse: 13, rayon: 14, degats: 7, nb: 2, eventail: true, traverse: true, forme: 'heros-anneau', teinte: ACIER }) },
    entaille: { nom: 'ENTAILLE VOLANTE !', texte: 'Une entaille d’acier, fine et longue.', ...faisceau({ portee: 520, epaisseur: 16, degats: 14, stun: 22, tresse: true, couleur: ACIER }) },
    // Étoiles
    oiseau: { nom: 'OISEAU D’ÉTOILES !', texte: 'Un oiseau de lumière qui suit l’adversaire.', ...proj({ vitesse: 9, rayon: 16, degats: 12, forme: 'heros-oiseau', tete: true, duree: 110 }) },
    volee: { nom: 'VOLÉE D’OISEAUX !', texte: 'Trois petits oiseaux en éventail.', ...proj({ vitesse: 10, rayon: 12, degats: 5, nb: 3, eventail: true, forme: 'heros-oiseau', teinte: ASTRE }) },
    stellaire: { nom: 'RAYON STELLAIRE !', texte: 'Un rayon d’étoiles, très longue portée.', ...faisceau({ portee: 600, epaisseur: 26, degats: 13, stun: 24, tresse: true, couleur: ASTRE }) },
  },
  b: {
    // Poing de Ki
    aube: { nom: 'POING DE L’AUBE !', texte: 'Un coup montant, invincible au départ.', ...ruee({ vx: 4, vy: -15, duree: 28, degats: 16, stun: 30, recul: 6, lance: true, invincible: 10 }) },
    ruee: { nom: 'RUÉE DE KI !', texte: 'Une ruée fulgurante, droit devant.', ...ruee({ vx: 14, duree: 20, degats: 14, stun: 26, recul: 14, invincible: 6 }) },
    sceauki: { nom: 'SCEAU DE KI !', texte: 'Un sceau devant soi, d’où jaillit la lumière.', ...zone({ ou: 'devant', delai: 12, rayon: 70, hauteur: 220, degats: 14, stun: 30, forme: 'heros-sceau' }) },
    // Flamme
    geyser: { nom: 'GEYSER ARDENT !', texte: 'Le sol crache des flammes devant soi.', ...zone({ ou: 'devant', delai: 10, rayon: 70, hauteur: 170, degats: 14, stun: 28, forme: 'heros-geyser', effet: 'brulure' }) },
    poingfeu: { nom: 'POING ARDENT !', texte: 'Un coup montant enflammé.', ...ruee({ vx: 4, vy: -14, duree: 28, degats: 14, stun: 30, recul: 6, lance: true, invincible: 8, effet: 'brulure' }) },
    colonnes: { nom: 'COLONNES DE FEU !', texte: 'Les flammes jaillissent sous l’adversaire.', ...zone({ ou: 'cible', delai: 24, rayon: 70, hauteur: 200, degats: 14, stun: 28, forme: 'heros-geyser', effet: 'brulure' }) },
    // Foudre
    lances: { nom: 'LANCES DU CIEL !', texte: 'Des lances de foudre tombent sur l’adversaire.', ...zone({ ou: 'cible', delai: 24, rayon: 60, hauteur: 470, degats: 15, stun: 32, forme: 'heros-lances', teinte: ECLAIR }) },
    sauteclair: { nom: 'SAUT ÉCLAIR !', texte: 'On disparaît dans un éclair, et on frappe dans le dos.', type: 'teleport', derriere: true, degats: 13, stun: 28, recul: 10, duree: 20, faille: true },
    decharge: { nom: 'DÉCHARGE !', texte: 'Une onde électrique tout autour, qui étourdit.', ...zone({ ou: 'soi', delai: 8, rayon: 130, hauteur: 160, degats: 10, stun: 40, forme: 'heros-onde', teinte: ECLAIR }) },
    // Givre
    cristaux: { nom: 'PRISON DE CRISTAL !', texte: 'Des cristaux jaillissent tout autour et gèlent.', ...zone({ ou: 'soi', delai: 8, rayon: 140, hauteur: 160, degats: 10, stun: 30, forme: 'heros-cristaux', effet: 'gel', teinte: GLACE }) },
    picsgeles: { nom: 'PICS GELÉS !', texte: 'Une ligne de pics de glace devant soi.', ...zone({ ou: 'devant', delai: 8, rayon: 70, hauteur: 150, degats: 12, stun: 28, forme: 'heros-cristaux', solSeulement: true, effet: 'gel', teinte: GLACE }) },
    glissade: { nom: 'GLISSADE GIVRÉE !', texte: 'Une glissade au sol qui fauche et gèle.', ...ruee({ vx: 14, duree: 18, degats: 12, stun: 30, recul: 6, balaye: true, effet: 'gel' }) },
    // Ombre
    faille: { nom: 'PAS DE LA FAILLE !', texte: 'On passe par une faille, et on frappe dans le dos.', type: 'teleport', derriere: true, degats: 15, stun: 28, recul: 10, duree: 22, faille: true },
    lameombre: { nom: 'LAME D’OMBRE !', texte: 'Une ruée invisible qui traverse l’adversaire.', ...ruee({ vx: 16, duree: 16, degats: 14, stun: 26, recul: 12, invincible: 10, traverse: true }) },
    piege: { nom: 'PIÈGE D’OMBRE !', texte: 'Un sceau noir sous l’adversaire, qui le ralentit.', ...zone({ ou: 'cible', delai: 22, rayon: 80, hauteur: 260, degats: 12, stun: 26, forme: 'heros-sceau', effet: 'lenteur', teinte: OMBRE }) },
    // Colosse
    onde: { nom: 'ONDE DU SERMENT !', texte: 'On frappe le sol : une onde de choc en anneau.', ...zone({ ou: 'soi', delai: 10, rayon: 160, hauteur: 60, degats: 12, stun: 34, forme: 'heros-onde', solSeulement: true }) },
    titan: { nom: 'CHARGE DU TITAN !', texte: 'Une charge en super-armure : rien ne l’arrête.', ...ruee({ vx: 13, duree: 26, degats: 16, stun: 30, recul: 18, armure: true, portee: 110 }) },
    ecrase: { nom: 'SAUT ÉCRASANT !', texte: 'Un bond, et on retombe de tout son poids.', ...ruee({ vx: 6, vy: -13, duree: 30, degats: 16, stun: 32, recul: 10, plonge: true, armure: true }) },
    // Lame
    trait: { nom: 'TRAIT D’ARGENT !', texte: 'Une ruée invincible qui traverse l’adversaire.', ...ruee({ vx: 17, duree: 16, degats: 15, stun: 28, recul: 14, invincible: 10, traverse: true }) },
    tourbillon: { nom: 'TOURBILLON D’ACIER !', texte: 'On tourne sur soi, la lame en avant : trois coups.', ...ruee({ vx: 6, duree: 30, coups: 3, degats: 6, stun: 22, recul: 8, tourne: true }) },
    lamessol: { nom: 'LAMES DU SOL !', texte: 'Des lames d’acier jaillissent devant soi.', ...zone({ ou: 'devant', delai: 10, rayon: 70, hauteur: 140, degats: 13, stun: 28, forme: 'heros-cristaux', solSeulement: true, teinte: ACIER }) },
    // Étoiles
    sceau: { nom: 'SCEAU ÉTOILÉ !', texte: 'Un sceau sous l’adversaire, qui frappe trois fois.', ...zone({ ou: 'cible', delai: 22, rayon: 90, hauteur: 300, degats: 5, coups: 3, stun: 28, forme: 'heros-sceau' }) },
    filante: { nom: 'PLUIE FILANTE !', texte: 'Des étoiles filantes tombent sur l’adversaire.', ...zone({ ou: 'cible', delai: 24, rayon: 70, hauteur: 470, degats: 14, stun: 30, forme: 'heros-lances', teinte: ASTRE }) },
    passtellaire: { nom: 'PAS STELLAIRE !', texte: 'On file entre les étoiles, et on frappe dans le dos.', type: 'teleport', derriere: true, degats: 12, stun: 26, recul: 10, duree: 20, faille: true },
  },
  u: {
    // Poing de Ki
    fracture: { nom: 'POING DE LA FRACTURE !!', texte: 'Un poing géant qui brise l’écran.', portee: 260, visuel: 'heros-fracture' },
    eveil: { nom: 'ÉVEIL DU HÉROS !!', texte: 'Un géant de lumière à votre image frappe avec vous.', portee: 240, visuel: 'heros-eveil' },
    comete: { nom: 'COMÈTE HUMAINE !!', texte: 'Des ruées de tous les côtés, plus vite que l’œil.', portee: 300, visuel: 'heros-comete' },
    // Flamme
    phenix: { nom: 'ENVOL DU PHÉNIX !!', texte: 'Un immense phénix de feu traverse l’arène.', portee: 280, visuel: 'heros-phenix' },
    fournaise: { nom: 'POING DE LA FOURNAISE !!', texte: 'Un poing de feu géant qui fend l’écran.', portee: 260, visuel: 'heros-fracture', teinte: FEU },
    brasier: { nom: 'TEMPÊTE DE BRAISES !!', texte: 'Un tourbillon de flammes autour de l’adversaire.', portee: 300, visuel: 'heros-tempete', teinte: FEU },
    // Foudre
    tempete: { nom: 'TEMPÊTE INTÉRIEURE !!', texte: 'Un tourbillon d’éclairs autour de l’adversaire.', portee: 300, visuel: 'heros-tempete', teinte: ECLAIR },
    foudroyante: { nom: 'COMÈTE FOUDROYANTE !!', texte: 'Des ruées d’éclair de tous les côtés.', portee: 300, visuel: 'heros-comete', teinte: ECLAIR },
    jugement: { nom: 'JUGEMENT DE FOUDRE !!', texte: 'Un sceau, puis une colonne de foudre.', portee: 280, visuel: 'heros-sceau', teinte: ECLAIR },
    // Givre
    givre: { nom: 'SCEAU DE L’HIVER !!', texte: 'Un sceau de givre, puis une colonne de glace.', portee: 280, visuel: 'heros-sceau', teinte: GLACE },
    phenixglace: { nom: 'PHÉNIX DE GLACE !!', texte: 'Un immense phénix de glace traverse l’arène.', portee: 280, visuel: 'heros-phenix', teinte: GLACE },
    blizzard: { nom: 'BLIZZARD INTÉRIEUR !!', texte: 'Un tourbillon de glace autour de l’adversaire.', portee: 300, visuel: 'heros-tempete', teinte: GLACE },
    // Ombre
    cometenoire: { nom: 'COMÈTE NOIRE !!', texte: 'Des ruées d’ombre de tous les côtés.', portee: 300, visuel: 'heros-comete', teinte: OMBRE },
    crepuscule: { nom: 'LAME DU CRÉPUSCULE !!', texte: 'Une entaille d’ombre qui coupe l’écran en deux.', portee: 300, visuel: 'heros-horizon', teinte: OMBRE },
    ombres: { nom: 'TEMPÊTE D’OMBRES !!', texte: 'Un tourbillon de ténèbres autour de l’adversaire.', portee: 300, visuel: 'heros-tempete', teinte: OMBRE },
    // Colosse
    titan: { nom: 'ÉVEIL DU TITAN !!', texte: 'Un géant de pierre et de lumière frappe avec vous.', portee: 240, visuel: 'heros-eveil', teinte: TERRE },
    poingtitan: { nom: 'POING DU TITAN !!', texte: 'Un poing de roc géant qui fend l’écran.', portee: 260, visuel: 'heros-fracture', teinte: TERRE },
    terre: { nom: 'SCEAU DE LA TERRE !!', texte: 'Un sceau sous l’adversaire, puis la terre se soulève.', portee: 280, visuel: 'heros-sceau', teinte: TERRE },
    // Lame
    horizon: { nom: 'LAME D’HORIZON !!', texte: 'Une seule entaille, qui coupe l’écran en deux.', portee: 300, visuel: 'heros-horizon' },
    entailles: { nom: 'MILLE ENTAILLES !!', texte: 'Des coups de lame de tous les côtés.', portee: 300, visuel: 'heros-comete', teinte: ACIER },
    sabre: { nom: 'ÉVEIL DU SABRE !!', texte: 'Un géant d’acier à votre image frappe avec vous.', portee: 240, visuel: 'heros-eveil', teinte: ACIER },
    // Étoiles
    promesses: { nom: 'MILLE PROMESSES !!', texte: 'Les étoiles de vos alliés tombent toutes ensemble.', portee: 300, visuel: 'heros-promesses' },
    gardien: { nom: 'SCEAU DU GARDIEN !!', texte: 'Un cercle d’étoiles, puis une colonne de lumière.', portee: 280, visuel: 'heros-sceau', teinte: ASTRE },
    phenixetoile: { nom: 'PHÉNIX ÉTOILÉ !!', texte: 'Un immense phénix d’étoiles traverse l’arène.', portee: 280, visuel: 'heros-phenix', teinte: ASTRE },
  },
};

/**
 * Les écoles de combat : un style, des statistiques, leurs techniques
 * (trois de chaque sorte ; la première est conseillée), une saisie et
 * trois combos (l'enchaînement d'abord).
 */
export const ECOLES = {
  ki: {
    victoire: ['v-salut', 'v-poing'], cri: 'Encore un peu d’entraînement, et tu y seras.',
    nom: 'Poing de Ki', style: 'Arts martiaux', texte: 'Équilibré : des éclats d’énergie, des coups qui traversent tout.',
    vitesse: 4.6, saut: 14, dmg: 1.17, hpMult: 1.04, defMult: 0.99,
    techniques: { a: ['eclat', 'salve', 'tresse'], b: ['aube', 'ruee', 'sceauki'], u: ['fracture', 'eveil', 'comete'] },
    saisie: { nom: 'PRISE DU MAÎTRE', seq: [['UN !', 8, 5], ['DEUX !', 10, 6], ['TROIS !', 12, 7], ['KI !', 16, 9], ['ENVOL !', 22, 12]] },
    combos: [
      { nom: 'TOURBILLON DU HÉROS', entree: 'PPK', coup: ruee({ vx: 9, duree: 22, coups: 3, degats: 6, stun: 22, recul: 8 }) },
      { nom: 'PAUME DE KI', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 14, degats: 9, duree: 50, forme: 'heros-eclat' }) },
      { nom: 'GARDE DU HÉROS', entree: 'BBP', coup: { type: 'garde', duree: 40, contre: true } },
    ],
  },
  flamme: {
    victoire: ['v-pointe', 'v-deux-poings'], cri: 'Ça, c’était brûlant !',
    nom: 'Flamme', style: 'Maître du feu', texte: 'Agressif : tout brûle — phénix, braises, geysers.',
    vitesse: 4.4, saut: 13, dmg: 1.3, hpMult: 1.06, defMult: 1.01,
    techniques: { a: ['phenix', 'braise', 'ardent'], b: ['geyser', 'poingfeu', 'colonnes'], u: ['phenix', 'fournaise', 'brasier'] },
    saisie: { nom: 'ÉTREINTE ARDENTE', seq: [['CHAUD !', 8, 5], ['BRÛLANT !', 10, 6], ['FOURNAISE !', 14, 8], ['EXPLOSION !', 20, 11]] },
    combos: [
      { nom: 'POINGS ARDENTS', entree: 'PPK', coup: ruee({ vx: 8, duree: 22, coups: 3, degats: 6, stun: 22, recul: 8, effet: 'brulure' }) },
      { nom: 'PLUME DE FEU', entree: 'DFP', coup: proj({ vitesse: 14, rayon: 12, degats: 8, duree: 50, forme: 'heros-phenix' }) },
      { nom: 'BOLIDE ARDENT', entree: 'FFK', coup: ruee({ vx: 14, duree: 18, degats: 12, stun: 26, recul: 16 }) },
    ],
  },
  foudre: {
    victoire: ['v-flex', 'v-deux-poings'], cri: 'Plus rapide que l’éclair.',
    nom: 'Foudre', style: 'Guerrier de l’éclair', texte: 'Longue portée : des éclairs qui étourdissent, la foudre qui tombe du ciel.',
    vitesse: 4.5, saut: 14, dmg: 1.11, hpMult: 0.96, defMult: 0.94,
    techniques: { a: ['arc', 'chercheur', 'gerbe'], b: ['lances', 'sauteclair', 'decharge'], u: ['tempete', 'foudroyante', 'jugement'] },
    saisie: { nom: 'COURT-CIRCUIT', seq: [['BZZT !', 8, 5], ['ZAP !', 10, 6], ['SURTENSION !', 14, 8], ['FOUDROYÉ !', 20, 11]] },
    combos: [
      { nom: 'ÉTINCELLES', entree: 'PPK', coup: ruee({ vx: 10, duree: 20, coups: 3, degats: 5, stun: 20, recul: 6 }) },
      { nom: 'ÉCLAT ÉLECTRIQUE', entree: 'DFP', coup: proj({ vitesse: 10, rayon: 14, degats: 9, duree: 60, forme: 'heros-eclat', teinte: ECLAIR }) },
      { nom: 'BOND ÉLECTRIQUE', entree: 'DBP', coup: { type: 'teleport', derriere: true, degats: 10, stun: 22, recul: 10, duree: 18, faille: true } },
    ],
  },
  givre: {
    victoire: ['v-bras-croises', 'v-bras-ecartes'], cri: 'Glacial.',
    nom: 'Givre', style: 'Cryomancien', texte: 'Contrôle : ralentit et gèle l’adversaire.',
    vitesse: 4.2, saut: 14, dmg: 1.3, hpMult: 1.22, defMult: 1.22,
    techniques: { a: ['flocon', 'glace', 'polaire'], b: ['cristaux', 'picsgeles', 'glissade'], u: ['givre', 'phenixglace', 'blizzard'] },
    saisie: { nom: 'PRISE GELÉE', seq: [['FROID !', 8, 5], ['GIVRE !', 10, 6], ['GLACE !', 14, 8], ['BRISE !', 20, 11]] },
    combos: [
      { nom: 'ÉCLATS DE GIVRE', entree: 'PPK', coup: ruee({ vx: 8, duree: 22, coups: 3, degats: 5, stun: 22, recul: 8, effet: 'gel' }) },
      { nom: 'CRISTAL JAILLISSANT', entree: 'DFK', coup: zone({ ou: 'devant', delai: 8, rayon: 50, hauteur: 120, degats: 10, stun: 26, forme: 'heros-cristaux', solSeulement: true, teinte: GLACE }) },
      { nom: 'MIROIR DE GLACE', entree: 'BBP', coup: { type: 'garde', duree: 40, renvoi: true } },
    ],
  },
  ombre: {
    victoire: ['v-meditation', 'v-bras-croises'], cri: 'Je n’étais même pas là.',
    nom: 'Ombre', style: 'Assassin', texte: 'Rapide : des corbeaux, des failles, des coups dans le dos.',
    vitesse: 5.5, saut: 16, dmg: 1.27, hpMult: 1.04, defMult: 1.01,
    techniques: { a: ['corbeau', 'nuee', 'traqueur'], b: ['faille', 'lameombre', 'piege'], u: ['cometenoire', 'crepuscule', 'ombres'] },
    saisie: { nom: 'ÉTRANGLEMENT', seq: [['OMBRE !', 8, 4], ['DISPARU !', 8, 5], ['DANS LE DOS !', 12, 7], ['FIN !', 18, 9]] },
    combos: [
      { nom: 'DANSE NOIRE', entree: 'PPK', coup: ruee({ vx: 11, duree: 20, coups: 3, degats: 5, stun: 20, recul: 6, traverse: true }) },
      { nom: 'PLUME NOIRE', entree: 'DFP', coup: proj({ vitesse: 16, rayon: 12, degats: 7, duree: 50, forme: 'heros-corbeau' }) },
      { nom: 'REPLI DANS L’OMBRE', entree: 'DBP', coup: { type: 'teleport', recule: true, duree: 14, faille: true } },
    ],
  },
  colosse: {
    victoire: ['v-poing-sol', 'v-flex'], cri: 'Rien ne me fait tomber.',
    nom: 'Colosse', style: 'Lutteur', texte: 'Solide : des rocs, des charges en super-armure, le sol qui tremble.',
    vitesse: 3.5, saut: 11, dmg: 1.14, hpMult: 1.14, defMult: 1.12,
    techniques: { a: ['meteore', 'boulet', 'eboulis'], b: ['onde', 'titan', 'ecrase'], u: ['titan', 'poingtitan', 'terre'] },
    saisie: { nom: 'SUPLEX', seq: [['ATTRAPÉ !', 10, 6], ['SOULEVÉ !', 12, 7], ['RETOURNÉ !', 16, 9], ['SUPLEX !', 24, 14]] },
    combos: [
      { nom: 'MARTEAU DU HÉROS', entree: 'PPK', coup: ruee({ vx: 6, duree: 24, degats: 14, stun: 30, recul: 16, armure: true }) },
      { nom: 'PETIT MÉTÉORE', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 18, degats: 12, duree: 80, forme: 'heros-meteore', vy: -8, gravite: 0.35, teinte: TERRE }) },
      { nom: 'CHARGE DU SERMENT', entree: 'FFK', coup: ruee({ vx: 11, duree: 22, degats: 12, stun: 26, recul: 20, armure: true }) },
    ],
  },
  lame: {
    victoire: ['v-salut', 'v-genou'], cri: 'Coupé net.',
    nom: 'Lame', style: 'Épéiste', texte: 'Tranchant : des anneaux et des entailles, des ruées invincibles.',
    vitesse: 4.9, saut: 15, dmg: 1.26, hpMult: 1.05, defMult: 1.05,
    techniques: { a: ['anneau', 'dagues', 'entaille'], b: ['trait', 'tourbillon', 'lamessol'], u: ['horizon', 'entailles', 'sabre'] },
    saisie: { nom: 'PASSE D’ARMES', seq: [['ESTOC !', 8, 5], ['TAILLE !', 10, 6], ['REVERS !', 12, 7], ['COUP FINAL !', 20, 11]] },
    combos: [
      { nom: 'TRIPLE ENTAILLE', entree: 'PPK', coup: ruee({ vx: 10, duree: 20, coups: 3, degats: 6, stun: 20, recul: 6 }) },
      { nom: 'PETIT ANNEAU', entree: 'DFP', coup: proj({ vitesse: 15, rayon: 14, degats: 8, duree: 50, forme: 'heros-anneau', teinte: ACIER }) },
      { nom: 'PARADE D’ARGENT', entree: 'BBP', coup: { type: 'garde', duree: 40, contre: true } },
    ],
  },
  etoile: {
    victoire: ['v-deux-poings', 'v-levitation'], cri: 'Fais un vœu.',
    nom: 'Étoiles', style: 'Mage céleste', texte: 'Magique : des oiseaux de lumière, des sceaux, des étoiles qui tombent.',
    vitesse: 4.4, saut: 16, dmg: 1.11, hpMult: 0.98, defMult: 0.98,
    techniques: { a: ['oiseau', 'volee', 'stellaire'], b: ['sceau', 'filante', 'passtellaire'], u: ['promesses', 'gardien', 'phenixetoile'] },
    saisie: { nom: 'GRAVITÉ STELLAIRE', seq: [['ÉTOILE !', 8, 5], ['COMÈTE !', 10, 6], ['NÉBULEUSE !', 14, 8], ['NOVA !', 20, 11]] },
    combos: [
      { nom: 'POUSSIÈRE D’ÉTOILES', entree: 'PPK', coup: ruee({ vx: 9, duree: 22, coups: 3, degats: 5, stun: 22, recul: 8 }) },
      { nom: 'OISEAUX JUMEAUX', entree: 'DFP', coup: proj({ vitesse: 12, rayon: 12, degats: 6, nb: 2, eventail: true, forme: 'heros-oiseau' }) },
      { nom: 'VOILE CÉLESTE', entree: 'BBP', coup: { type: 'soin', soin: 10, duree: 40 } },
    ],
  },
};

/** Les techniques du héros : celles qu'il a choisies, si son école les a ; sinon, celles qu'elle conseille. */
export function techniquesDe(d) {
  const ecole = ECOLES[d.ecole] || ECOLES.ki;
  const une = (k, choix) => (ecole.techniques[k].includes(choix) ? choix : ecole.techniques[k][0]);
  return { a: une('a', d.techA), b: une('b', d.techB), u: une('u', d.techU) };
}

/** Le héros par défaut (avant qu'on change quoi que ce soit). */
export const defautHeros = () => ({
  nom: 'HÉROS', corps: 'normal', tete: 'bandeau', peau: PEAUX[1], energie: 'rouge', tenue: TENUES[0], cheveux: CHEVEUX[0], accessoires: ['echarpe'], ecole: 'ki',
  genre: 'h', voixHauteur: 1,
});

/** Un héros au hasard. */
export function herosAuHasard(alea = Math.random) {
  const un = (l) => l[Math.floor(alea() * l.length)];
  const acc = ACCESSOIRES.map(([id]) => id).filter(() => alea() < 0.25).slice(0, MAX_ACCESSOIRES);
  return {
    nom: un(['KAZE', 'NOVA', 'AKIRA', 'LUNA', 'REX', 'MIRA', 'ZED', 'SORA', 'KAI', 'NYX']),
    corps: un(CORPS)[0], tete: un(TETES)[0], peau: un(PEAUX), energie: un(Object.keys(ENERGIES)),
    tenue: un(TENUES), cheveux: un(CHEVEUX), accessoires: acc,
    ...(() => { const ecole = un(Object.keys(ECOLES)); const t = ECOLES[ecole].techniques; return { ecole, techA: un(t.a), techB: un(t.b), techU: un(t.u) }; })(),
    ...(() => { const genre = alea() < 0.5 ? 'h' : 'f'; return { genre, voixHauteur: Math.round((0.75 + alea() * 0.5) * 100) / 100, voixTimbre: genre === 'f' ? 0.8 : 0.2 }; })(),
  };
}

/** Un nom propre : des lettres, des chiffres, quelques signes, en majuscules. */
export const nomPropre = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9À-ÖØ-Ý' .-]/g, '').trim().slice(0, 14) || 'HÉROS';

/** La fiche de combattant du héros créé, prête pour le moteur. */
export function construireHeros(d, id = 'heros') {
  const def = { ...defautHeros(), ...d };
  const ecole = ECOLES[def.ecole] || ECOLES.ki;
  const tech = techniquesDe(def);
  const sans = ({ texte, ...coup }) => { void texte; return coup; };
  const energie = ENERGIES[def.energie] || ENERGIES_BONUS[def.energie] || ENERGIES.rouge;
  const corps = CORPS.some(([c]) => c === def.corps) ? def.corps : 'normal';
  const tete = TETES.some(([t]) => t === def.tete) || bonus('tete').includes(def.tete) ? def.tete : 'bandeau';
  const accessoires = (def.accessoires || []).filter((a) => ACCESSOIRES.some(([x]) => x === a) || bonus('accessoires').includes(a)).slice(0, MAX_ACCESSOIRES);
  // La carrure pèse un peu sur la vie et la vitesse.
  const poids = { fin: [-0.05, 0.3], normal: [0, 0], massif: [0.06, -0.35] }[corps];
  const stats = { hpMult: Math.round((ecole.hpMult + poids[0]) * 100) / 100, vitesse: Math.round((ecole.vitesse + poids[1]) * 10) / 10 };
  const barre = (x) => Math.max(5, Math.min(15, Math.round(x)));
  // La voix : le timbre choisit une voix d'homme ou de femme et la colore, la hauteur la monte ou la descend.
  const timbre = Math.max(0, Math.min(1, Number(def.voixTimbre ?? (def.genre === 'f' ? 0.8 : 0.2))));
  const hauteur = Math.max(VOIX_HAUTEUR[0], Math.min(VOIX_HAUTEUR[1], Number(def.voixHauteur) || 1));
  const voix = { genre: timbre >= 0.5 ? 'f' : 'h', hauteur: Math.round(hauteur * (0.85 + timbre * 0.3) * 100) / 100, vitesse: ecole.vitesse > 5 ? 1.1 : ecole.vitesse < 4 ? 0.92 : 1 };
  return {
    id, nom: nomPropre(def.nom), genre: def.genre === 'f' ? 'f' : 'h', voix, style: ecole.style, desc: `Le héros de la Fracture — école ${ecole.nom}`, boss: null, heros: true,
    c: { ...energie, peau: def.peau, cheveux: def.cheveux, tenue: def.tenue },
    stats: { hp: barre(stats.hpMult * 10), dmg: barre(ecole.dmg * 10), def: barre(ecole.defMult * 10 - 1) },
    vitesse: stats.vitesse, saut: ecole.saut, dmg: ecole.dmg, hpMult: stats.hpMult, defMult: ecole.defMult,
    look: { corps, tete, extras: tete === 'bandeau' ? ['bandeau-long', ...accessoires] : accessoires },
    specA: sans(TECHNIQUES.a[tech.a]), specB: sans(TECHNIQUES.b[tech.b]), ulti: sans(TECHNIQUES.u[tech.u]), techniques: tech,
    saisie: ecole.saisie, combos: ecole.combos,
    victoire: ecole.victoire, cri: ecole.cri,
  };
}
