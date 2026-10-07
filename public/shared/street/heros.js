/**
 * STREET COMBAT — le héros qu'on crée pour le mode Histoire.
 *
 * Module ISO. Le joueur choisit un nom, une carrure, une coiffure, une
 * peau, ses couleurs, ses accessoires et une école de combat (qui donne
 * ses compétences, son ultime, sa saisie et ses combos). `construireHeros`
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

/**
 * Les écoles de combat : un style, des statistiques, deux compétences, un
 * ultime, une saisie et trois combos (l'enchaînement d'abord).
 */
export const ECOLES = {
  ki: {
    nom: 'Poing de Ki', style: 'Arts martiaux', texte: 'Équilibré : une boule d’énergie, un coup montant qui traverse tout.',
    vitesse: 4.6, saut: 14, dmg: 1.17, hpMult: 1.04, defMult: 0.99,
    specA: { nom: 'VAGUE DE KI !', ...proj({ vitesse: 12, rayon: 22, degats: 14, forme: 'boule' }) },
    specB: { nom: 'POING ASCENDANT !', ...ruee({ vx: 4, vy: -15, duree: 28, degats: 16, stun: 30, recul: 6, lance: true, invincible: 10 }) },
    ulti: { nom: 'DÉFERLANTE DE KI !!', portee: 260, visuel: 'hadoken' },
    saisie: { nom: 'PRISE DU MAÎTRE', seq: [['UN !', 8, 5], ['DEUX !', 10, 6], ['TROIS !', 12, 7], ['KI !', 16, 9], ['ENVOL !', 22, 12]] },
    combos: [
      { nom: 'TOURBILLON', entree: 'PPK', coup: ruee({ vx: 9, duree: 22, coups: 3, degats: 6, stun: 22, recul: 8 }) },
      { nom: 'PAUME DE KI', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 16, degats: 9, duree: 50, forme: 'boule' }) },
      { nom: 'GARDE DU MAÎTRE', entree: 'BBP', coup: { type: 'garde', duree: 40, contre: true } },
    ],
  },
  flamme: {
    nom: 'Flamme', style: 'Maître du feu', texte: 'Agressif : des boules de feu qui brûlent, un mur de flammes.',
    vitesse: 4.4, saut: 13, dmg: 1.3, hpMult: 1.06, defMult: 1.01,
    specA: { nom: 'BOULE DE FEU !', ...proj({ vitesse: 11, rayon: 20, degats: 12, forme: 'flamme', effet: 'brulure' }) },
    specB: { nom: 'MUR DE FLAMMES !', ...zone({ ou: 'devant', delai: 10, rayon: 70, hauteur: 160, degats: 14, stun: 28, forme: 'feu', effet: 'brulure' }) },
    ulti: { nom: 'PLUIE DE BRAISES !!', portee: 280, visuel: 'meteores' },
    saisie: { nom: 'ÉTREINTE ARDENTE', seq: [['CHAUD !', 8, 5], ['BRÛLANT !', 10, 6], ['FOURNAISE !', 14, 8], ['EXPLOSION !', 20, 11]] },
    combos: [
      { nom: 'POINGS ARDENTS', entree: 'PPK', coup: ruee({ vx: 8, duree: 22, coups: 3, degats: 6, stun: 22, recul: 8, effet: 'brulure' }) },
      { nom: 'FLAMMÈCHE', entree: 'DFP', coup: proj({ vitesse: 14, rayon: 12, degats: 8, duree: 50, forme: 'flamme' }) },
      { nom: 'COMÈTE', entree: 'FFK', coup: ruee({ vx: 14, duree: 18, degats: 12, stun: 26, recul: 16 }) },
    ],
  },
  foudre: {
    nom: 'Foudre', style: 'Guerrier de l’éclair', texte: 'Longue portée : un rayon électrique, la foudre qui tombe du ciel.',
    vitesse: 4.5, saut: 14, dmg: 1.11, hpMult: 0.96, defMult: 0.94,
    specA: { nom: 'RAYON ÉCLAIR !', ...faisceau({ portee: 600, epaisseur: 28, degats: 14, stun: 24, couleur: '#ffe680' }) },
    specB: { nom: 'FOUDRE DU CIEL !', ...zone({ ou: 'cible', delai: 24, rayon: 60, hauteur: 470, degats: 15, stun: 32, forme: 'eclair' }) },
    ulti: { nom: 'ORAGE ABSOLU !!', portee: 300, visuel: 'foudre' },
    saisie: { nom: 'COURT-CIRCUIT', seq: [['BZZT !', 8, 5], ['ZAP !', 10, 6], ['SURTENSION !', 14, 8], ['FOUDROYÉ !', 20, 11]] },
    combos: [
      { nom: 'ÉTINCELLES', entree: 'PPK', coup: ruee({ vx: 10, duree: 20, coups: 3, degats: 5, stun: 20, recul: 6 }) },
      { nom: 'ÉCLAIR EN BOULE', entree: 'DFP', coup: proj({ vitesse: 10, rayon: 16, degats: 9, duree: 60, forme: 'orbe' }) },
      { nom: 'BOND ÉLECTRIQUE', entree: 'DBP', coup: { type: 'teleport', derriere: true, degats: 10, stun: 22, recul: 10, duree: 18 } },
    ],
  },
  givre: {
    nom: 'Givre', style: 'Cryomancien', texte: 'Contrôle : ralentit et gèle l’adversaire.',
    vitesse: 4.2, saut: 14, dmg: 1.3, hpMult: 1.22, defMult: 1.22,
    specA: { nom: 'LANCE DE GLACE !', ...proj({ vitesse: 13, rayon: 16, degats: 12, forme: 'lance', effet: 'gel' }) },
    specB: { nom: 'BLIZZARD !', ...zone({ ou: 'soi', delai: 8, rayon: 140, hauteur: 160, degats: 10, stun: 30, forme: 'blizzard', effet: 'gel' }) },
    ulti: { nom: 'HIVER ÉTERNEL !!', portee: 280, visuel: 'zero' },
    saisie: { nom: 'PRISE GELÉE', seq: [['FROID !', 8, 5], ['GIVRE !', 10, 6], ['GLACE !', 14, 8], ['BRISE !', 20, 11]] },
    combos: [
      { nom: 'ÉCLATS DE GIVRE', entree: 'PPK', coup: ruee({ vx: 8, duree: 22, coups: 3, degats: 5, stun: 22, recul: 8, effet: 'gel' }) },
      { nom: 'PIC DE GLACE', entree: 'DFK', coup: zone({ ou: 'devant', delai: 8, rayon: 50, hauteur: 120, degats: 10, stun: 26, forme: 'pic' }) },
      { nom: 'MIROIR DE GLACE', entree: 'BBP', coup: { type: 'garde', duree: 40, renvoi: true } },
    ],
  },
  ombre: {
    nom: 'Ombre', style: 'Assassin', texte: 'Rapide : une onde au ras du sol, une téléportation dans le dos.',
    vitesse: 5.5, saut: 16, dmg: 1.27, hpMult: 1.04, defMult: 1.01,
    specA: { nom: 'VAGUE NOIRE !', ...proj({ vitesse: 9, rayon: 24, degats: 13, forme: 'onde', rase: true }) },
    specB: { nom: 'PAS DE L’OMBRE !', type: 'teleport', derriere: true, degats: 15, stun: 28, recul: 10, duree: 22 },
    ulti: { nom: 'NUIT SANS FIN !!', portee: 300, visuel: 'vide' },
    saisie: { nom: 'ÉTRANGLEMENT', seq: [['OMBRE !', 8, 4], ['DISPARU !', 8, 5], ['DANS LE DOS !', 12, 7], ['FIN !', 18, 9]] },
    combos: [
      { nom: 'DANSE NOIRE', entree: 'PPK', coup: ruee({ vx: 11, duree: 20, coups: 3, degats: 5, stun: 20, recul: 6, traverse: true }) },
      { nom: 'KUNAÏ', entree: 'DFP', coup: proj({ vitesse: 16, rayon: 10, degats: 7, duree: 50, forme: 'lame' }) },
      { nom: 'ESQUIVE', entree: 'DBP', coup: { type: 'teleport', recule: true, duree: 14 } },
    ],
  },
  colosse: {
    nom: 'Colosse', style: 'Lutteur', texte: 'Solide : charge en super-armure, fait trembler le sol.',
    vitesse: 3.5, saut: 11, dmg: 1.14, hpMult: 1.14, defMult: 1.12,
    specA: { nom: 'CHARGE DU TAUREAU !', ...ruee({ vx: 13, duree: 28, degats: 17, stun: 30, recul: 18, armure: true, portee: 110 }) },
    specB: { nom: 'TREMBLEMENT !', ...zone({ ou: 'soi', delai: 10, rayon: 160, hauteur: 60, degats: 12, stun: 34, forme: 'seisme', solSeulement: true }) },
    ulti: { nom: 'FAILLE TITANESQUE !!', portee: 240, visuel: 'tectonique' },
    saisie: { nom: 'SUPLEX', seq: [['ATTRAPÉ !', 10, 6], ['SOULEVÉ !', 12, 7], ['RETOURNÉ !', 16, 9], ['SUPLEX !', 24, 14]] },
    combos: [
      { nom: 'MARTEAU', entree: 'PPK', coup: ruee({ vx: 6, duree: 24, degats: 14, stun: 30, recul: 16, armure: true }) },
      { nom: 'ROCHER', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 20, degats: 12, duree: 80, forme: 'rocher', vy: -8, gravite: 0.35 }) },
      { nom: 'BÉLIER', entree: 'FFK', coup: ruee({ vx: 11, duree: 22, degats: 12, stun: 26, recul: 20, armure: true }) },
    ],
  },
  lame: {
    nom: 'Lame', style: 'Épéiste', texte: 'Tranchant : un croissant qui traverse, une ruée invincible.',
    vitesse: 4.9, saut: 15, dmg: 1.26, hpMult: 1.05, defMult: 1.05,
    specA: { nom: 'CROISSANT D’ACIER !', ...proj({ vitesse: 12, rayon: 24, degats: 13, forme: 'croissant', traverse: true }) },
    specB: { nom: 'COUPE ÉCLAIR !', ...ruee({ vx: 17, duree: 16, degats: 15, stun: 28, recul: 14, invincible: 10, traverse: true }) },
    ulti: { nom: 'MILLE TRANCHANTS !!', portee: 300, visuel: 'mille-lames' },
    saisie: { nom: 'PASSE D’ARMES', seq: [['ESTOC !', 8, 5], ['TAILLE !', 10, 6], ['REVERS !', 12, 7], ['COUP FINAL !', 20, 11]] },
    combos: [
      { nom: 'TRIPLE ENTAILLE', entree: 'PPK', coup: ruee({ vx: 10, duree: 20, coups: 3, degats: 6, stun: 20, recul: 6 }) },
      { nom: 'LAME VOLANTE', entree: 'DFP', coup: proj({ vitesse: 15, rayon: 12, degats: 8, duree: 50, forme: 'lame' }) },
      { nom: 'PARADE', entree: 'BBP', coup: { type: 'garde', duree: 40, contre: true } },
    ],
  },
  etoile: {
    nom: 'Étoiles', style: 'Mage céleste', texte: 'Magique : des étoiles qui suivent l’adversaire, une pluie d’étoiles.',
    vitesse: 4.4, saut: 16, dmg: 1.11, hpMult: 0.98, defMult: 0.98,
    specA: { nom: 'ÉTOILE FILANTE !', ...proj({ vitesse: 9, rayon: 16, degats: 12, forme: 'etoile', tete: true, duree: 110 }) },
    specB: { nom: 'PLUIE D’ÉTOILES !', ...zone({ ou: 'cible', delai: 22, rayon: 90, hauteur: 300, degats: 5, coups: 3, stun: 28, forme: 'etoiles' }) },
    ulti: { nom: 'CONSTELLATION !!', portee: 300, visuel: 'supernova' },
    saisie: { nom: 'GRAVITÉ STELLAIRE', seq: [['ÉTOILE !', 8, 5], ['COMÈTE !', 10, 6], ['NÉBULEUSE !', 14, 8], ['NOVA !', 20, 11]] },
    combos: [
      { nom: 'POUSSIÈRE D’ÉTOILES', entree: 'PPK', coup: ruee({ vx: 9, duree: 22, coups: 3, degats: 5, stun: 22, recul: 8 }) },
      { nom: 'ÉTOILES JUMELLES', entree: 'DFP', coup: proj({ vitesse: 12, rayon: 12, degats: 6, nb: 2, eventail: true, forme: 'etoile' }) },
      { nom: 'VOILE CÉLESTE', entree: 'BBP', coup: { type: 'soin', soin: 10, duree: 40 } },
    ],
  },
};

/** Le héros par défaut (avant qu'on change quoi que ce soit). */
export const defautHeros = () => ({
  nom: 'HÉROS', corps: 'normal', tete: 'bandeau', peau: PEAUX[1], energie: 'rouge', tenue: TENUES[0], cheveux: CHEVEUX[0], accessoires: ['echarpe'], ecole: 'ki',
});

/** Un héros au hasard. */
export function herosAuHasard(alea = Math.random) {
  const un = (l) => l[Math.floor(alea() * l.length)];
  const acc = ACCESSOIRES.map(([id]) => id).filter(() => alea() < 0.25).slice(0, MAX_ACCESSOIRES);
  return {
    nom: un(['KAZE', 'NOVA', 'AKIRA', 'LUNA', 'REX', 'MIRA', 'ZED', 'SORA', 'KAI', 'NYX']),
    corps: un(CORPS)[0], tete: un(TETES)[0], peau: un(PEAUX), energie: un(Object.keys(ENERGIES)),
    tenue: un(TENUES), cheveux: un(CHEVEUX), accessoires: acc, ecole: un(Object.keys(ECOLES)),
  };
}

/** Un nom propre : des lettres, des chiffres, quelques signes, en majuscules. */
export const nomPropre = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9À-ÖØ-Ý' .-]/g, '').trim().slice(0, 14) || 'HÉROS';

/** La fiche de combattant du héros créé, prête pour le moteur. */
export function construireHeros(d, id = 'heros') {
  const def = { ...defautHeros(), ...d };
  const ecole = ECOLES[def.ecole] || ECOLES.ki;
  const energie = ENERGIES[def.energie] || ENERGIES.rouge;
  const corps = CORPS.some(([c]) => c === def.corps) ? def.corps : 'normal';
  const tete = TETES.some(([t]) => t === def.tete) ? def.tete : 'bandeau';
  const accessoires = (def.accessoires || []).filter((a) => ACCESSOIRES.some(([x]) => x === a)).slice(0, MAX_ACCESSOIRES);
  // La carrure pèse un peu sur la vie et la vitesse.
  const poids = { fin: [-0.05, 0.3], normal: [0, 0], massif: [0.06, -0.35] }[corps];
  const stats = { hpMult: Math.round((ecole.hpMult + poids[0]) * 100) / 100, vitesse: Math.round((ecole.vitesse + poids[1]) * 10) / 10 };
  const barre = (x) => Math.max(5, Math.min(15, Math.round(x)));
  return {
    id, nom: nomPropre(def.nom), style: ecole.style, desc: `Le héros de la Fracture — école ${ecole.nom}`, boss: null, heros: true,
    c: { ...energie, peau: def.peau, cheveux: def.cheveux, tenue: def.tenue },
    stats: { hp: barre(stats.hpMult * 10), dmg: barre(ecole.dmg * 10), def: barre(ecole.defMult * 10 - 1) },
    vitesse: stats.vitesse, saut: ecole.saut, dmg: ecole.dmg, hpMult: stats.hpMult, defMult: ecole.defMult,
    look: { corps, tete, extras: tete === 'bandeau' ? ['bandeau-long', ...accessoires] : accessoires },
    specA: ecole.specA, specB: ecole.specB, ulti: ecole.ulti, saisie: ecole.saisie, combos: ecole.combos,
  };
}
