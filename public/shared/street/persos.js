/**
 * STREET COMBAT — les combattants.
 *
 * Module ISO. Chaque combattant a ses statistiques, son allure (pour le
 * dessin), deux compétences (Spécial B : un segment de jauge ; Spécial A :
 * deux segments), son ultime (la jauge pleine) avec sa cinématique, sa
 * saisie, et ses combos :
 *   • l'enchaînement 👊 👊 🦶, dont le dernier coup est sa signature ;
 *   • deux techniques à manipulation (↓ → 👊…), sans jauge.
 *
 * Certains combattants sont à débloquer : les trois boss du mode Histoire
 * (`boss`), et des personnages secrets (`secret`), cachés dans la
 * sélection tant qu'on ne les a pas gagnés : Kaïros à la fin de l'Histoire,
 * le Général Vorn, Sablia et Éclipse en cours d'histoire, Onyx au Tournoi
 * en difficile, Némésis au sommet de la Tour des défis.
 *
 * Les figurants (l'armée de l'Horloge) ne se jouent pas : on les affronte
 * seulement dans l'histoire.
 *
 * Les compétences sont composées de quelques briques, que le moteur
 * (combat.js) sait jouer : projectile, faisceau, ruée, zone, attraction,
 * téléportation, soin. Les nombres sont en images (60 par seconde) et en
 * pixels de l'arène (1000 × 600, sol à 470).
 */

/** Les effets qui durent : brûlure et poison grignotent, le gel et la lenteur ralentissent. */
export const STATUTS = {
  brulure: { nom: 'Brûlure', degats: 1, tous: 20, duree: 120, couleur: '#ff7a1a' },
  poison: { nom: 'Poison', degats: 1, tous: 15, duree: 150, couleur: '#5cff6a' },
  gel: { nom: 'Gel', lenteur: 0.45, duree: 80, couleur: '#8fe6ff' },
  lenteur: { nom: 'Lenteur', lenteur: 0.65, duree: 110, couleur: '#b48cff' },
};

/* ---------------------------------------------------------------- */
/* Les briques des compétences                                       */
/* ---------------------------------------------------------------- */

const proj = (o) => ({ type: 'projectile', vitesse: 11, rayon: 20, degats: 13, stun: 22, recul: 7, duree: 90, forme: 'boule', ...o });
const faisceau = (o) => ({ type: 'faisceau', portee: 620, epaisseur: 34, degats: 14, stun: 24, recul: 10, duree: 34, ...o });
const ruee = (o) => ({ type: 'ruee', vx: 12, vy: 0, duree: 26, degats: 15, stun: 26, recul: 11, coups: 1, portee: 95, ...o });
const zone = (o) => ({ type: 'zone', ou: 'cible', delai: 30, rayon: 70, hauteur: 220, degats: 16, stun: 30, recul: 6, duree: 24, forme: 'pilier', ...o });
/** Les briques, pour composer d'autres combattants (le héros qu'on crée, par exemple). */
export const BRIQUES = { proj, faisceau, ruee, zone };

/* ---------------------------------------------------------------- */
/* Le roster                                                          */
/* ---------------------------------------------------------------- */

const P = (o) => ({ boss: null, ...o });

export const PERSOS = [
  P({
    id: 'ryuken', nom: 'RYU-KEN', style: 'Arts Martiaux', desc: 'Maître du Poing de Tonnerre',
    c: { c1: '#3296ff', c2: '#0050c8', faisceau: '#3296ff', aura: '#50a0ff', peau: '#dcb996', cheveux: '#141414', tenue: '#f0f0f0', ceinture: '#c80000' },
    stats: { hp: 12, dmg: 12, def: 9 }, vitesse: 4.5, saut: 14, dmg: 1.2, hpMult: 1.2, defMult: 1,
    look: { corps: 'normal', tete: 'bandeau', extras: ['bandeau-long'] },
    specA: { nom: 'HADOKEN !', ...proj({ vitesse: 10, rayon: 24, degats: 15, forme: 'boule' }) },
    specB: { nom: 'SHORYUKEN !', ...ruee({ vx: 4, vy: -15, duree: 34, degats: 18, stun: 34, recul: 6, invincible: 10, lance: true }) },
    ulti: { nom: 'SHIN HADOKEN !!', portee: 260, visuel: 'hadoken' },
    saisie: { nom: 'SAISIE FOUDRE', seq: [['POING !', 8, 4], ['POING !', 8, 4], ['PIED !', 10, 5], ['UPPERCUT !', 14, 8], ['JET !', 20, 7]] },
    combos: [
      { nom: 'TATSUMAKI', entree: 'PPK', coup: ruee({ vx: 7, vy: -4, duree: 30, coups: 3, degats: 6, stun: 18, recul: 8, tourne: true }) },
      { nom: 'POING DE TONNERRE', entree: 'DFP', coup: ruee({ vx: 9, duree: 16, degats: 11, stun: 24, recul: 14, effet: null }) },
      { nom: 'BALAYAGE', entree: 'DBK', coup: ruee({ vx: 3, duree: 14, degats: 8, stun: 30, recul: 4, balaye: true }) },
    ],
  }),
  P({
    id: 'blazero', nom: 'BLAZERO', style: 'Maître du Feu', desc: 'Le Démon des Flammes',
    c: { c1: '#ff500a', c2: '#c81e00', faisceau: '#ff6400', aura: '#ff5000', peau: '#c8501e', cheveux: '#ff3c00', tenue: '#280000', ceinture: '#ff6400' },
    stats: { hp: 9, dmg: 13, def: 8 }, vitesse: 4.2, saut: 13, dmg: 1.28, hpMult: 0.9, defMult: 0.9,
    look: { corps: 'normal', tete: 'pics', extras: ['flammes'] },
    specA: { nom: 'FLAMME !', ...proj({ vitesse: 13, rayon: 22, degats: 12, effet: 'brulure', forme: 'flamme' }) },
    specB: { nom: 'INFERNO !', ...zone({ ou: 'devant', distance: 150, delai: 10, rayon: 80, hauteur: 260, degats: 16, effet: 'brulure', forme: 'feu', duree: 40, coups: 3 }) },
    ulti: { nom: 'METEOR OBLITERATION !!', portee: 220, visuel: 'meteores' },
    saisie: { nom: 'ÉTREINTE INFERNALE', seq: [['FLAMME !', 10, 5], ['BRÛLURE !', 10, 5], ['EXPLOSION !', 16, 9], ['INCINÉRATION !', 20, 12]] },
    combos: [
      { nom: 'POING ARDENT', entree: 'PPK', coup: ruee({ vx: 8, duree: 18, degats: 12, stun: 26, recul: 16, effet: 'brulure' }) },
      { nom: 'CRACHE-FEU', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 14, degats: 7, duree: 40, effet: 'brulure', forme: 'flamme' }) },
      { nom: 'BOND DU DÉMON', entree: 'BFK', coup: ruee({ vx: 9, vy: -10, duree: 30, degats: 12, stun: 26, plonge: true, effet: 'brulure' }) },
    ],
  }),
  P({
    id: 'frostbyte', nom: 'FROSTBYTE', style: 'Cryomancien', desc: 'Seigneur de la Glace',
    c: { c1: '#00c8ff', c2: '#0078c8', faisceau: '#00d2ff', aura: '#00b4ff', peau: '#b4dcf0', cheveux: '#c8f0ff', tenue: '#b4e6ff', ceinture: '#0064c8' },
    stats: { hp: 10, dmg: 12, def: 10 }, vitesse: 3.6, saut: 15, dmg: 1.15, hpMult: 1.04, defMult: 1.05,
    look: { corps: 'normal', tete: 'cristaux', extras: ['epaulettes-glace'] },
    specA: { nom: 'ICE BEAM !', ...faisceau({ degats: 13, effet: 'gel', couleur: '#8fe6ff' }) },
    specB: { nom: 'BLIZZARD !', ...zone({ ou: 'cible', delai: 18, rayon: 120, hauteur: 200, degats: 9, coups: 3, duree: 60, effet: 'gel', forme: 'blizzard' }) },
    ulti: { nom: 'ABSOLUTE ZERO GLACIER !!', portee: 260, visuel: 'zero' },
    saisie: { nom: 'FREEZE HOLD', seq: [['GELÉE !', 10, 5], ['CRISTAL !', 10, 5], ['BLIZZARD !', 14, 7], ['CONGÉLATION !', 22, 10]] },
    combos: [
      { nom: 'LAME DE GIVRE', entree: 'PPK', coup: ruee({ vx: 6, duree: 16, degats: 10, stun: 30, recul: 10, effet: 'gel' }) },
      { nom: 'PIC DE GLACE', entree: 'DFP', coup: zone({ ou: 'devant', distance: 120, delai: 8, rayon: 40, hauteur: 140, degats: 9, stun: 28, forme: 'pic', lance: true }) },
      { nom: 'MIROIR GELÉ', entree: 'BBP', coup: { type: 'garde', duree: 40, renvoi: true } },
    ],
  }),
  P({
    id: 'shadowkira', nom: 'SHADOW KIRA', style: "Assassin de l'Ombre", desc: 'Fantôme du Néant',
    c: { c1: '#b43cff', c2: '#6400b4', faisceau: '#b400ff', aura: '#9600c8', peau: '#b896c8', cheveux: '#3a0a5a', tenue: '#0f001e', ceinture: '#9600c8' },
    stats: { hp: 10, dmg: 12, def: 8 }, vitesse: 5.6, saut: 16, dmg: 1.19, hpMult: 1.03, defMult: 0.92,
    look: { corps: 'fin', tete: 'ninja', extras: ['echarpe'] },
    specA: { nom: 'DARK WAVE !', ...proj({ vitesse: 9, rayon: 26, degats: 13, forme: 'onde', rase: true }) },
    specB: { nom: 'SHADOW RUSH !', type: 'teleport', derriere: true, degats: 16, stun: 30, recul: 10, duree: 24 },
    ulti: { nom: 'VOID ENDMARK EXECUTOR !!', portee: 300, visuel: 'vide' },
    saisie: { nom: 'SAISIE OMBRE', seq: [['COUP OMBRE !', 8, 4], ['TÉLÉPORT !', 8, 5], ['SLAM !', 12, 7], ['DISPARITION !', 16, 8], ['FRAPPE FINALE !', 20, 9]] },
    combos: [
      { nom: 'DANSE DES OMBRES', entree: 'PPK', coup: ruee({ vx: 10, duree: 22, coups: 3, degats: 5, stun: 20, recul: 6, traverse: true }) },
      { nom: 'DAGUE NOIRE', entree: 'DFP', coup: proj({ vitesse: 16, rayon: 12, degats: 8, duree: 50, forme: 'lame' }) },
      { nom: 'PAS DE L’OMBRE', entree: 'BBK', coup: { type: 'teleport', derriere: false, recule: true, degats: 0, duree: 16 } },
    ],
  }),
  P({
    id: 'thunderox', nom: 'THUNDEROX', style: "Guerrier de l'Éclair", desc: 'Berserk du Tonnerre',
    c: { c1: '#ffc800', c2: '#c87800', faisceau: '#ffdc00', aura: '#ffc800', peau: '#a05a14', cheveux: '#ffb400', tenue: '#3c2800', ceinture: '#ffa000' },
    stats: { hp: 11, dmg: 13, def: 9 }, vitesse: 3.7, saut: 12, dmg: 1.28, hpMult: 1.13, defMult: 0.95,
    look: { corps: 'massif', tete: 'crete', extras: ['eclairs', 'brassards'] },
    specA: { nom: 'THUNDER !!', ...zone({ ou: 'cible', delai: 34, rayon: 50, hauteur: 600, degats: 18, stun: 34, forme: 'eclair' }) },
    specB: { nom: 'BOLT CRUSH !', ...ruee({ vx: 14, duree: 22, degats: 17, stun: 30, recul: 18, armure: true }) },
    ulti: { nom: 'LIGHTNING WRATH JUDGEMENT !!', portee: 240, visuel: 'foudre' },
    saisie: { nom: 'THUNDER GRIP', seq: [['ÉCLAIR !', 8, 5], ['TONNERRE !', 10, 7], ['FOUDRE !', 14, 8], ['COUP DE DIEU !', 22, 13]] },
    combos: [
      { nom: 'MARTEAU DE FOUDRE', entree: 'PPK', coup: zone({ ou: 'devant', distance: 80, delai: 6, rayon: 60, hauteur: 160, degats: 12, stun: 30, forme: 'eclair' }) },
      { nom: 'CHARGE DU TAUREAU', entree: 'FFP', coup: ruee({ vx: 13, duree: 18, degats: 11, stun: 24, recul: 16 }) },
      { nom: 'SÉISME ÉLECTRIQUE', entree: 'DDK', coup: zone({ ou: 'soi', delai: 10, rayon: 160, hauteur: 60, degats: 9, stun: 34, forme: 'seisme', solSeulement: true }) },
    ],
  }),
  P({
    id: 'ironclad', nom: 'IRONCLAD', style: 'Cyborg Soldat', desc: 'Machine de Guerre',
    c: { c1: '#b4b4c8', c2: '#646482', faisceau: '#c8c8ff', aura: '#b4b4dc', peau: '#8c91a0', cheveux: '#3c3c50', tenue: '#505064', ceinture: '#c8c8dc' },
    stats: { hp: 10, dmg: 9, def: 11 }, vitesse: 3.0, saut: 10, dmg: 0.85, hpMult: 1.04, defMult: 1.2,
    look: { corps: 'massif', tete: 'visiere', extras: ['armure', 'canon'] },
    specA: { nom: 'LASER BLAST !', ...faisceau({ portee: 760, epaisseur: 22, degats: 15, stun: 22, couleur: '#ff3a3a' }) },
    specB: { nom: 'MISSILE !', ...proj({ vitesse: 7, rayon: 16, degats: 16, duree: 140, forme: 'missile', tete: 0.35, vy: -6 }) },
    ulti: { nom: 'OMEGA MAXIMA DESTROYER !!', portee: 280, visuel: 'omega' },
    saisie: { nom: 'PRISE MÉCANIQUE', seq: [['PRISE !', 10, 5], ['ÉCRASEMENT !', 12, 7], ['LANCER !', 16, 9], ['MISSILE !', 22, 13]] },
    combos: [
      { nom: 'PISTON', entree: 'PPK', coup: ruee({ vx: 5, duree: 18, degats: 13, stun: 30, recul: 20 }) },
      { nom: 'MITRAILLE', entree: 'DFP', coup: proj({ vitesse: 15, rayon: 8, degats: 3, duree: 60, nb: 4, intervalle: 6, forme: 'balle' }) },
      { nom: 'BOUCLIER', entree: 'BBP', coup: { type: 'garde', duree: 60, armure: true } },
    ],
  }),
  P({
    id: 'serpenta', nom: 'SERPENTA', style: 'Venin & Agilité', desc: 'Danseuse Empoisonnée',
    c: { c1: '#3cdc64', c2: '#008c28', faisceau: '#50ff50', aura: '#28c850', peau: '#28a046', cheveux: '#00c850', tenue: '#003c14', ceinture: '#00c850' },
    stats: { hp: 10, dmg: 11, def: 8 }, vitesse: 5.2, saut: 14, dmg: 1.07, hpMult: 0.96, defMult: 0.88,
    look: { corps: 'fin', tete: 'longs', extras: ['queue', 'ecailles'] },
    specA: { nom: 'VENOM SHOT !', ...proj({ vitesse: 12, rayon: 16, degats: 9, effet: 'poison', forme: 'goutte', nb: 2, intervalle: 10 }) },
    specB: { nom: 'POISON WAVE !', ...zone({ ou: 'devant', distance: 170, delai: 8, rayon: 130, hauteur: 40, degats: 6, coups: 4, duree: 90, effet: 'poison', forme: 'flaque', solSeulement: true }) },
    ulti: { nom: 'DEATHLY ASPHYXIA SNAKE !!', portee: 260, visuel: 'serpent' },
    saisie: { nom: 'ENROULEMENT TOXIQUE', seq: [['MORSURE !', 8, 4], ['VENIN !', 10, 5], ['ENROULEMENT !', 12, 5], ['POISON TOTAL !', 20, 10], ['JET TOXIQUE !', 20, 9]] },
    combos: [
      { nom: 'MORSURE DU COBRA', entree: 'PPK', coup: ruee({ vx: 11, duree: 16, degats: 9, stun: 24, recul: 8, effet: 'poison' }) },
      { nom: 'QUEUE-FOUET', entree: 'DBK', coup: ruee({ vx: 2, duree: 18, degats: 10, stun: 30, recul: 12, portee: 140, balaye: true }) },
      { nom: 'ONDULATION', entree: 'BFP', coup: ruee({ vx: 9, vy: -7, duree: 26, coups: 2, degats: 6, stun: 20, traverse: true }) },
    ],
  }),
  P({
    id: 'gravox', nom: 'GRAVOX', style: 'Maître de la Gravité', desc: 'Seigneur des Forces Cosmiques',
    c: { c1: '#a050ff', c2: '#5000b4', faisceau: '#b464ff', aura: '#8c3cf0', peau: '#46286e', cheveux: '#c878ff', tenue: '#1e0a3c', ceinture: '#a050ff' },
    stats: { hp: 11, dmg: 12, def: 10 }, vitesse: 3.2, saut: 11, dmg: 1.2, hpMult: 1.11, defMult: 1.1,
    look: { corps: 'massif', tete: 'halo', extras: ['orbes'] },
    specA: { nom: 'GRAVITY PULL !', ...faisceau({ portee: 560, epaisseur: 60, degats: 8, stun: 30, attire: 0.75, couleur: '#b464ff' }) },
    specB: { nom: 'CRUSH FIELD !', ...zone({ ou: 'cible', delai: 16, rayon: 110, hauteur: 300, degats: 16, stun: 36, effet: 'lenteur', forme: 'champ', ecrase: true }) },
    ulti: { nom: 'SINGULARITY COLLAPSE !!', portee: 280, visuel: 'singularite' },
    saisie: { nom: 'PRISE GRAVITATIONNELLE', seq: [['ASPIRATION !', 10, 6], ['ÉCRASEMENT !', 12, 7], ['SINGULARITÉ !', 16, 9], ['TROU NOIR !', 24, 14]] },
    combos: [
      { nom: 'POIDS DES ASTRES', entree: 'PPK', coup: zone({ ou: 'devant', distance: 70, delai: 4, rayon: 70, hauteur: 200, degats: 13, stun: 34, forme: 'champ', ecrase: true }) },
      { nom: 'ORBE GRAVITIQUE', entree: 'DFP', coup: proj({ vitesse: 5, rayon: 26, degats: 10, duree: 120, forme: 'orbe', attire: 1.2 }) },
      { nom: 'APESANTEUR', entree: 'DUK', coup: zone({ ou: 'cible', delai: 12, rayon: 80, hauteur: 260, degats: 6, stun: 40, forme: 'champ', souleve: true }) },
    ],
  }),
  P({
    id: 'lunara', nom: 'LUNARA', style: 'Magie de la Lune', desc: 'Prêtresse de la Nuit Éternelle',
    c: { c1: '#b4dcff', c2: '#5082c8', faisceau: '#c8e6ff', aura: '#a0c8ff', peau: '#c8d2f0', cheveux: '#dcebff', tenue: '#141e46', ceinture: '#b4dcff' },
    stats: { hp: 9, dmg: 12, def: 8 }, vitesse: 5.0, saut: 18, dmg: 1.16, hpMult: 0.91, defMult: 0.94,
    look: { corps: 'fin', tete: 'longs', extras: ['diademe-lune', 'robe'] },
    specA: { nom: 'CRESCENT BEAM !', ...proj({ vitesse: 12, rayon: 30, degats: 14, forme: 'croissant', ondule: 40 }) },
    specB: { nom: 'MOONFALL !', ...zone({ ou: 'cible', delai: 40, rayon: 75, hauteur: 600, degats: 20, stun: 36, forme: 'lune' }) },
    ulti: { nom: 'FULL MOON ECLIPSE DOOM !!', portee: 280, visuel: 'eclipse' },
    saisie: { nom: 'ECLIPSE MORTELLE', seq: [['CROISSANT !', 8, 5], ['LUNE NOIRE !', 10, 6], ['ECLIPSE !', 14, 8], ['MOONCRASH !', 18, 10], ['NOVA LUNAIRE !', 22, 12]] },
    combos: [
      { nom: 'VALSE LUNAIRE', entree: 'PPK', coup: ruee({ vx: 6, vy: -9, duree: 28, coups: 2, degats: 7, stun: 22, tourne: true }) },
      { nom: 'ÉTOILE FILANTE', entree: 'DFP', coup: proj({ vitesse: 14, rayon: 12, degats: 8, duree: 60, forme: 'etoile', vy: -3, gravite: 0.12 }) },
      { nom: 'MARÉE D’ARGENT', entree: 'BBP', coup: { type: 'soin', soin: 8, duree: 40 } },
    ],
  }),
  P({
    id: 'pyroclaw', nom: 'PYROCLAW', style: 'Bête Dragon de Guerre', desc: 'La Bête Enchaînée',
    c: { c1: '#ff3c00', c2: '#b40000', faisceau: '#ff7800', aura: '#ff5000', peau: '#a03214', cheveux: '#ff1e00', tenue: '#500f00', ceinture: '#ff5000' },
    stats: { hp: 10, dmg: 13, def: 8 }, vitesse: 4.8, saut: 13, dmg: 1.32, hpMult: 1, defMult: 0.85,
    look: { corps: 'massif', tete: 'cornes', extras: ['griffes', 'queue-dragon', 'ailes-dragon'] },
    specA: { nom: 'DRAGON BREATH !', ...faisceau({ portee: 260, epaisseur: 90, degats: 5, coups: 4, stun: 20, recul: 3, effet: 'brulure', couleur: '#ff7800', cone: true, duree: 44 }) },
    specB: { nom: 'CLAW REND !', ...ruee({ vx: 10, vy: -8, duree: 28, coups: 3, degats: 7, stun: 22, recul: 8, plonge: true }) },
    ulti: { nom: 'DRAGON KING APOCALYPSE !!', portee: 240, visuel: 'dragon' },
    saisie: { nom: 'MORSURE DU DRAGON', seq: [['GRIFFE !', 10, 6], ['MORSURE !', 12, 7], ['SOUFFLE !', 14, 8], ['DÉCHAÎNEMENT !', 20, 12], ['RAGE DRAGON !', 24, 14]] },
    combos: [
      { nom: 'GRIFFES CROISÉES', entree: 'PPK', coup: ruee({ vx: 7, duree: 18, coups: 2, degats: 8, stun: 26, recul: 12 }) },
      { nom: 'BOULE DE LAVE', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 20, degats: 10, duree: 80, forme: 'rocher', vy: -8, gravite: 0.35, effet: 'brulure' }) },
      { nom: 'RUGISSEMENT', entree: 'DDP', coup: zone({ ou: 'soi', delai: 8, rayon: 170, hauteur: 200, degats: 4, stun: 44, recul: 14, forme: 'onde' }) },
    ],
  }),
  P({
    id: 'wraithblade', nom: 'WRAITHBLADE', style: 'Samouraï Spectral', desc: 'Lame Entre Deux Mondes',
    c: { c1: '#00dcb4', c2: '#007864', faisceau: '#00ffc8', aura: '#00c8a0', peau: '#1e2832', cheveux: '#00f0c8', tenue: '#0a141e', ceinture: '#00c8a0' },
    stats: { hp: 10, dmg: 13, def: 10 }, vitesse: 5.4, saut: 15, dmg: 1.28, hpMult: 0.96, defMult: 1.08,
    look: { corps: 'fin', tete: 'chignon', extras: ['katana', 'yeux-luisants', 'haori'] },
    specA: { nom: 'SOUL SLASH !', ...proj({ vitesse: 15, rayon: 34, degats: 14, forme: 'lame-geante', traverse: true, duree: 60 }) },
    specB: { nom: 'PHANTOM STEP !', ...ruee({ vx: 18, duree: 18, degats: 15, stun: 28, recul: 6, traverse: true, invincible: 18 }) },
    ulti: { nom: 'THOUSAND GHOST BLADE !!', portee: 300, visuel: 'mille-lames' },
    saisie: { nom: 'ÉTREINTE DU NÉANT', seq: [['ENTAILLE !', 8, 5], ['LAME FANTÔME !', 10, 6], ['TRAVERSÉE !', 14, 8], ['MILLE COUPES !', 18, 10], ['NÉANT !', 22, 13]] },
    combos: [
      { nom: 'IAI', entree: 'PPK', coup: ruee({ vx: 14, duree: 14, degats: 13, stun: 28, recul: 8, traverse: true }) },
      { nom: 'CROISSANT SPECTRAL', entree: 'DFK', coup: ruee({ vx: 4, vy: -12, duree: 28, degats: 12, stun: 30, lance: true }) },
      { nom: 'CONTRE-LAME', entree: 'BBP', coup: { type: 'garde', duree: 34, contre: true, degats: 16 } },
    ],
  }),
  P({
    id: 'celestia', nom: 'CELESTIA', style: 'Magie Céleste', desc: 'Guerrière des Étoiles',
    c: { c1: '#ff96ff', c2: '#c850dc', faisceau: '#ffb4ff', aura: '#f064f0', peau: '#dca0dc', cheveux: '#ffc8ff', tenue: '#f0c8ff', ceinture: '#ff64ff' },
    stats: { hp: 10, dmg: 12, def: 9 }, vitesse: 4.4, saut: 17, dmg: 1.18, hpMult: 1.01, defMult: 1,
    look: { corps: 'fin', tete: 'couettes', extras: ['etoiles', 'jupe'] },
    specA: { nom: 'STARDUST !', ...proj({ vitesse: 11, rayon: 14, degats: 6, nb: 3, eventail: true, forme: 'etoile' }) },
    specB: { nom: 'NOVA STRIKE !', ...zone({ ou: 'soi', delai: 12, rayon: 140, hauteur: 220, degats: 15, stun: 32, recul: 16, forme: 'nova' }) },
    ulti: { nom: 'GALAXY METEOR SUPERNOVA !!', portee: 260, visuel: 'supernova' },
    saisie: { nom: 'ÉTOILE MORTELLE', seq: [['ÉTOILE !', 8, 5], ['NOVA !', 10, 6], ['ORBITE !', 12, 7], ['GALAXY SLAM !', 22, 13]] },
    combos: [
      { nom: 'COMÈTE', entree: 'PPK', coup: ruee({ vx: 12, vy: -3, duree: 18, degats: 11, stun: 26, recul: 12 }) },
      { nom: 'PLUIE D’ÉTOILES', entree: 'DFP', coup: zone({ ou: 'cible', delai: 26, rayon: 90, hauteur: 600, degats: 4, coups: 3, stun: 18, forme: 'etoiles' }) },
      { nom: 'BOND STELLAIRE', entree: 'DUP', coup: ruee({ vx: 3, vy: -16, duree: 30, degats: 9, stun: 24, lance: true }) },
    ],
  }),
  P({
    id: 'stoneback', nom: 'STONEBACK', style: 'Golem de Guerre', desc: 'Forteresse Vivante',
    c: { c1: '#8c6e50', c2: '#503c28', faisceau: '#b48c50', aura: '#a0783c', peau: '#785f41', cheveux: '#5a4632', tenue: '#463723', ceinture: '#8c6e50' },
    stats: { hp: 12, dmg: 9, def: 13 }, vitesse: 2.5, saut: 8, dmg: 0.94, hpMult: 1.18, defMult: 1.35,
    look: { corps: 'geant', tete: 'rocher', extras: ['mousse', 'fissures'] },
    specA: { nom: 'ROCK SLAM !', ...proj({ vitesse: 8, rayon: 30, degats: 18, stun: 34, forme: 'rocher', vy: -11, gravite: 0.4, duree: 120 }) },
    specB: { nom: 'QUAKE FIST !', ...zone({ ou: 'devant', distance: 160, delai: 10, rayon: 190, hauteur: 70, degats: 15, stun: 46, forme: 'seisme', solSeulement: true }) },
    ulti: { nom: 'TECTONIC ANNIHILATION !!', portee: 220, visuel: 'tectonique' },
    saisie: { nom: 'BROYAGE MINÉRAL', seq: [['COUP DE POING !', 12, 7], ['TREMBLEMENT !', 14, 8], ['ÉCRASEMENT !', 18, 10], ['ROCHER !', 28, 17]] },
    combos: [
      { nom: 'AVALANCHE', entree: 'PPK', coup: ruee({ vx: 6, duree: 20, degats: 16, stun: 34, recul: 22, armure: true }) },
      { nom: 'MUR DE PIERRE', entree: 'BBP', coup: { type: 'garde', duree: 70, armure: true } },
      { nom: 'STALAGMITE', entree: 'DFK', coup: zone({ ou: 'devant', distance: 110, delai: 10, rayon: 45, hauteur: 150, degats: 12, stun: 30, forme: 'pic', lance: true }) },
    ],
  }),
  P({
    id: 'stormwing', nom: 'STORMWING', style: 'Maître des Tempêtes', desc: "L'Aigle de Tempête",
    c: { c1: '#64c8ff', c2: '#2878c8', faisceau: '#8cdcff', aura: '#50b4ff', peau: '#3c64a0', cheveux: '#a0e6ff', tenue: '#143c78', ceinture: '#64c8ff' },
    stats: { hp: 10, dmg: 14, def: 9 }, vitesse: 6.0, saut: 19, dmg: 1.36, hpMult: 1.04, defMult: 0.96,
    look: { corps: 'fin', tete: 'plumes', extras: ['ailes', 'echarpe'] },
    specA: { nom: 'WIND BLADE !', ...proj({ vitesse: 17, rayon: 20, degats: 11, forme: 'vent', duree: 60 }) },
    specB: { nom: 'TORNADO RUSH !', ...ruee({ vx: 9, vy: -3, duree: 36, coups: 4, degats: 5, stun: 20, recul: 4, emporte: true, tourne: true }) },
    ulti: { nom: 'HURRICANE OMEGA DEVASTATION !!', portee: 280, visuel: 'ouragan' },
    saisie: { nom: 'ÉTREINTE CYCLONE', seq: [['RAFALE !', 8, 5], ['TOURBILLON !', 10, 6], ['CYCLONE !', 14, 8], ['TEMPÊTE !', 18, 10], ['FOUDRE AILE !', 22, 13]] },
    combos: [
      { nom: 'SERRES', entree: 'PPK', coup: ruee({ vx: 10, vy: -6, duree: 22, coups: 2, degats: 7, stun: 22, recul: 10 }) },
      { nom: 'PIQUÉ DE L’AIGLE', entree: 'DFK', coup: ruee({ vx: 12, vy: -12, duree: 32, degats: 12, stun: 28, plonge: true }) },
      { nom: 'BOURRASQUE', entree: 'BFP', coup: faisceau({ portee: 420, epaisseur: 80, degats: 2, stun: 12, recul: 26, duree: 26, couleur: '#c8f0ff' }) },
    ],
  }),
  P({
    id: 'voidreaper', nom: 'VOIDREAPER', style: 'Faucheur Dimensionnel', desc: 'Messager de la Fin',
    c: { c1: '#9a1ee0', c2: '#28003c', faisceau: '#8c00c8', aura: '#6400a0', peau: '#1e0032', cheveux: '#7800b4', tenue: '#0f0019', ceinture: '#640096' },
    stats: { hp: 8, dmg: 11, def: 9 }, vitesse: 4.6, saut: 14, dmg: 1.06, hpMult: 0.79, defMult: 1.02,
    look: { corps: 'normal', tete: 'crane', extras: ['faux', 'cape'] },
    specA: { nom: 'SOUL DRAIN !', ...faisceau({ portee: 480, epaisseur: 26, degats: 12, stun: 24, drain: 0.6, couleur: '#c06bff' }) },
    specB: { nom: 'VOID SCYTHE !', ...ruee({ vx: 6, duree: 24, degats: 18, stun: 30, recul: 14, portee: 170 }) },
    ulti: { nom: 'DIMENSIONAL OBLIVION HARVEST !!', portee: 280, visuel: 'oubli' },
    saisie: { nom: 'FAUCILLE ÂME SPECTRE', seq: [['DRAIN !', 9, 5], ['FAUCHAGE !', 12, 7], ['VIDE !', 15, 9], ['RÉCOLTE !', 20, 12], ['OBLIVION !', 24, 14]] },
    combos: [
      { nom: 'MOISSON', entree: 'PPK', coup: ruee({ vx: 4, duree: 20, degats: 14, stun: 30, recul: 6, portee: 160, attire: true }) },
      { nom: 'ÂMES ERRANTES', entree: 'DFP', coup: proj({ vitesse: 6, rayon: 16, degats: 6, nb: 3, intervalle: 12, duree: 110, forme: 'ame', tete: 0.25 }) },
      { nom: 'PASSAGE DU VIDE', entree: 'DBP', coup: { type: 'teleport', derriere: true, degats: 0, duree: 18 } },
    ],
  }),
  P({
    id: 'aquathorn', nom: 'AQUATHORN', style: 'Chevalier des Profondeurs', desc: "L'Ombre des Profondeurs",
    c: { c1: '#00a0dc', c2: '#00508c', faisceau: '#00c8ff', aura: '#008cc8', peau: '#14466e', cheveux: '#00c8f0', tenue: '#0a2846', ceinture: '#00a0dc' },
    stats: { hp: 10, dmg: 11, def: 10 }, vitesse: 4.0, saut: 13, dmg: 1.07, hpMult: 0.96, defMult: 1.08,
    look: { corps: 'normal', tete: 'casque', extras: ['trident', 'nageoires'] },
    specA: { nom: 'WATER JET !', ...faisceau({ portee: 560, epaisseur: 40, degats: 12, stun: 26, recul: 24, couleur: '#4fd8ff' }) },
    specB: { nom: 'ABYSS SPIKE !', ...zone({ ou: 'cible', delai: 24, rayon: 50, hauteur: 200, degats: 17, stun: 34, forme: 'pic', lance: true }) },
    ulti: { nom: 'MAELSTROM APOCALYPSE DEEP !!', portee: 260, visuel: 'maelstrom' },
    saisie: { nom: 'ÉTREINTE DES ABYSSES', seq: [['FRAPPE EAU !', 10, 6], ['CROC ABYSSAL !', 12, 7], ['VAGUE !', 15, 9], ['MAELSTROM !', 22, 13]] },
    combos: [
      { nom: 'TRIDENT', entree: 'PPK', coup: ruee({ vx: 8, duree: 18, degats: 12, stun: 28, recul: 14, portee: 140 }) },
      { nom: 'BULLE PIÈGE', entree: 'DFP', coup: proj({ vitesse: 5, rayon: 24, degats: 6, stun: 50, duree: 120, forme: 'bulle' }) },
      { nom: 'RAZ-DE-MARÉE', entree: 'BFK', coup: zone({ ou: 'devant', distance: 60, delai: 6, rayon: 200, hauteur: 120, degats: 10, stun: 28, recul: 22, forme: 'vague', avance: 8 }) },
    ],
  }),

  /* ---- les boss, débloqués en les battant dans le mode Histoire ---- */
  P({
    id: 'solarius', nom: 'SOLARIUS', style: 'Gardien de la Lumière', desc: 'La lumière qui consume les ténèbres', boss: 'normal',
    c: { c1: '#ffdc3c', c2: '#ffa000', faisceau: '#ffffb4', aura: '#ffc800', peau: '#f0e6c8', cheveux: '#ffffb4', tenue: '#dcc88c', ceinture: '#ffc800' },
    stats: { hp: 10, dmg: 11, def: 11 }, vitesse: 4.4, saut: 16, dmg: 1.14, hpMult: 1.02, defMult: 1.15,
    look: { corps: 'normal', tete: 'halo', extras: ['ailes-lumiere', 'armure-or', 'epee'] },
    specA: { nom: 'LANCE DE LUMIÈRE !', ...proj({ vitesse: 16, rayon: 18, degats: 13, forme: 'lance', traverse: true, duree: 50 }) },
    specB: { nom: 'JUGEMENT SOLAIRE !', ...zone({ ou: 'cible', delai: 38, rayon: 70, hauteur: 600, degats: 16, stun: 30, forme: 'rayon-ciel' }) },
    ulti: { nom: 'DIVINE APOCALYPSE !!', portee: 260, visuel: 'divine' },
    saisie: { nom: 'JUGEMENT CÉLESTE', seq: [['FRAPPE SAINTE !', 10, 6], ['LUMIÈRE !', 12, 7], ['JUGEMENT !', 15, 9], ['SENTENCE DIVINE !', 20, 12], ['PURIFICATION !', 26, 15]] },
    combos: [
      { nom: 'ÉPÉE DE L’AUBE', entree: 'PPK', coup: ruee({ vx: 10, duree: 18, degats: 12, stun: 26, recul: 14, portee: 140 }) },
      { nom: 'PLUMES SACRÉES', entree: 'DFP', coup: proj({ vitesse: 13, rayon: 10, degats: 5, nb: 3, eventail: true, forme: 'plume' }) },
      { nom: 'BÉNÉDICTION', entree: 'BBP', coup: { type: 'soin', soin: 10, duree: 40 } },
    ],
  }),
  P({
    id: 'malvortex', nom: 'MALVORTEX', style: 'Seigneur des Abysses', desc: "Né des profondeurs de l'enfer", boss: 'difficile',
    c: { c1: '#d01428', c2: '#50000a', faisceau: '#ff2828', aura: '#a00000', peau: '#0a0005', cheveux: '#c80014', tenue: '#050003', ceinture: '#b40000' },
    stats: { hp: 10, dmg: 11, def: 11 }, vitesse: 4.9, saut: 15, dmg: 1.06, hpMult: 1, defMult: 1.15,
    look: { corps: 'massif', tete: 'cornes', extras: ['armure-noire', 'oeil-rouge', 'cape'] },
    specA: { nom: 'LANCE INFERNALE !', ...proj({ vitesse: 14, rayon: 22, degats: 16, forme: 'lance', effet: 'brulure', duree: 70 }) },
    specB: { nom: 'ŒIL DU DÉMON !', ...faisceau({ portee: 700, epaisseur: 30, degats: 17, stun: 30, couleur: '#ff1a1a', depuisOeil: true }) },
    ulti: { nom: 'ARMAGEDDON ABYSSAL !!', portee: 300, visuel: 'armageddon' },
    saisie: { nom: 'EMPRISE INFERNALE', seq: [['GRIFFE INFERNALE !', 12, 7], ['MORSURE DÉMONE !', 14, 8], ['IMPLOSION !', 17, 10], ['CONSUME !', 22, 13], ['DAMNATION TOTALE !', 30, 17]] },
    combos: [
      { nom: 'GRIFFE DES ENFERS', entree: 'PPK', coup: ruee({ vx: 9, duree: 18, coups: 2, degats: 9, stun: 26, recul: 14, effet: 'brulure' }) },
      { nom: 'PILIER DE FEU', entree: 'DFP', coup: zone({ ou: 'cible', delai: 22, rayon: 50, hauteur: 600, degats: 12, stun: 30, forme: 'feu', effet: 'brulure' }) },
      { nom: 'TÉLÉPORT DÉMONIAQUE', entree: 'DBP', coup: { type: 'teleport', derriere: true, degats: 10, stun: 24, recul: 10, duree: 20 } },
    ],
  }),
  P({
    id: 'lechaos', nom: 'LE CHAOS', style: 'Dieu de la Destruction', desc: "Là où il passe, l'existence s'efface", boss: 'impossible',
    c: { c1: '#c814ff', c2: '#50008c', faisceau: '#ff50ff', aura: '#a000dc', peau: '#05000f', cheveux: '#dcb4ff', tenue: '#000000', ceinture: '#ffc800' },
    stats: { hp: 11, dmg: 12, def: 11 }, vitesse: 4.8, saut: 17, dmg: 1.22, hpMult: 1.14, defMult: 1.2,
    look: { corps: 'geant', tete: 'couronne-etoiles', extras: ['fissures-energie', 'aura-noire'] },
    specA: { nom: 'SINGULARITÉ NOIRE !', ...proj({ vitesse: 6, rayon: 34, degats: 16, duree: 130, forme: 'trou-noir', attire: 1.6 }) },
    specB: { nom: "LAME D'ENTROPIE !", ...ruee({ vx: 12, duree: 22, degats: 19, stun: 32, recul: 16, portee: 190, traverse: true }) },
    ulti: { nom: 'OMEGA COLLAPSE — TOUT FINIT ICI !!', portee: 320, visuel: 'omega-collapse' },
    saisie: { nom: 'ÉTREINTE DE LA FIN', seq: [['FRACTURE DE RÉALITÉ !', 16, 9], ['IMPLOSION !', 18, 10], ['DÉCHIREMENT SPATIAL !', 22, 12], ['COLLAPSE !', 28, 15], ['NÉANTISATION TOTALE !', 38, 19]] },
    combos: [
      { nom: 'FRACTURE', entree: 'PPK', coup: zone({ ou: 'devant', distance: 90, delai: 4, rayon: 80, hauteur: 220, degats: 15, stun: 32, forme: 'fissure' }) },
      { nom: 'ÉTOILES MOURANTES', entree: 'DFP', coup: zone({ ou: 'cible', delai: 24, rayon: 100, hauteur: 600, degats: 5, coups: 3, stun: 20, forme: 'etoiles' }) },
      { nom: 'EFFACEMENT', entree: 'DBP', coup: { type: 'teleport', derriere: true, degats: 12, stun: 26, recul: 12, duree: 16 } },
    ],
  }),

  /* ---- les personnages secrets ---- */
  P({
    id: 'kairos', nom: 'KAÏROS', style: 'Seigneur du Temps', desc: 'Il a déjà vécu chaque seconde de ta vie', secret: 'histoire',
    c: { c1: '#4fe0d0', c2: '#0a5a64', faisceau: '#a8fff2', aura: '#40d8c8', peau: '#e0d0b8', cheveux: '#f4ecd8', tenue: '#14263a', ceinture: '#ffd23f' },
    stats: { hp: 11, dmg: 12, def: 11 }, vitesse: 4.7, saut: 16, dmg: 1.18, hpMult: 1.1, defMult: 1.2,
    look: { corps: 'normal', tete: 'longs', extras: ['horloge', 'barbe', 'robe', 'cape'] },
    specA: { nom: 'FLÈCHE DU TEMPS !', ...proj({ vitesse: 16, rayon: 16, degats: 14, forme: 'aiguille', effet: 'lenteur', duree: 60 }) },
    specB: { nom: 'ARRÊT DU TEMPS !', ...zone({ ou: 'cible', delai: 12, rayon: 120, hauteur: 300, degats: 7, stun: 66, effet: 'gel', forme: 'horloge', duree: 30 }) },
    ulti: { nom: 'CHRONO-APOCALYPSE !!', portee: 300, visuel: 'chrono' },
    saisie: { nom: 'BOUCLE TEMPORELLE', seq: [['TIC !', 10, 6], ['TAC !', 10, 6], ['RETOUR !', 14, 8], ['AVANCE RAPIDE !', 18, 10], ['FIN DU TEMPS !', 24, 14]] },
    combos: [
      { nom: 'AIGUILLES', entree: 'PPK', coup: ruee({ vx: 9, duree: 22, coups: 3, degats: 6, stun: 22, recul: 8 }) },
      { nom: 'SABLIER', entree: 'DFP', coup: proj({ vitesse: 8, rayon: 18, degats: 10, duree: 90, forme: 'sablier', vy: -9, gravite: 0.35, effet: 'lenteur' }) },
      { nom: 'RETOUR EN ARRIÈRE', entree: 'BBP', coup: { type: 'soin', soin: 12, duree: 40 } },
    ],
  }),
  P({
    id: 'onyx', nom: 'ONYX', style: 'Champion Invaincu', desc: 'Cent combats, cent K.O.', secret: 'tournoi',
    c: { c1: '#ffd23f', c2: '#8a6400', faisceau: '#ffe680', aura: '#ffc800', peau: '#5a3826', cheveux: '#141414', tenue: '#c8102e', ceinture: '#ffd23f' },
    stats: { hp: 12, dmg: 12, def: 12 }, vitesse: 4.6, saut: 12, dmg: 1.22, hpMult: 1.16, defMult: 1.3,
    look: { corps: 'massif', tete: 'rase', extras: ['gants-boxe', 'ceinture-champion', 'torse-nu'] },
    specA: { nom: 'POING SUPERSONIQUE !', ...proj({ vitesse: 18, rayon: 22, degats: 16, forme: 'poing', duree: 50 }) },
    specB: { nom: 'UPPERCUT DU CHAMPION !', ...ruee({ vx: 5, vy: -14, duree: 30, degats: 19, stun: 34, recul: 6, lance: true, armure: true }) },
    ulti: { nom: 'K.O. LÉGENDAIRE !!', portee: 220, visuel: 'ring' },
    saisie: { nom: 'CORPS-À-CORPS', seq: [['JAB !', 8, 5], ['JAB !', 8, 5], ['CROCHET !', 12, 8], ['UPPERCUT !', 16, 10], ['K.O. !', 22, 14]] },
    combos: [
      { nom: 'RAFALE DE JABS', entree: 'PPK', coup: ruee({ vx: 6, duree: 24, coups: 4, degats: 5, stun: 20, recul: 6 }) },
      { nom: 'CROCHET FOUDROYANT', entree: 'FFP', coup: ruee({ vx: 12, duree: 16, degats: 13, stun: 28, recul: 20 }) },
      { nom: 'SÉISME DU RING', entree: 'DDK', coup: zone({ ou: 'soi', delai: 8, rayon: 170, hauteur: 60, degats: 9, stun: 36, forme: 'seisme', solSeulement: true }) },
    ],
  }),
  P({
    id: 'nemesis', nom: 'NÉMÉSIS', style: 'Le Reflet', desc: 'Il est tout ce que tu as combattu', secret: 'tour',
    c: { c1: '#e6f2ff', c2: '#5a6aa8', faisceau: '#ffffff', aura: '#c0d8ff', peau: '#a8c4e8', cheveux: '#ffffff', tenue: '#24304e', ceinture: '#e6f2ff' },
    stats: { hp: 13, dmg: 13, def: 12 }, vitesse: 5.0, saut: 16, dmg: 1.34, hpMult: 1.26, defMult: 1.28,
    look: { corps: 'normal', tete: 'miroir', extras: ['eclats', 'armure'] },
    specA: { nom: 'PRISME !', ...faisceau({ portee: 700, epaisseur: 30, degats: 16, stun: 26, couleur: '#ffffff', prisme: true }) },
    specB: { nom: 'MIROIR BRISÉ !', ...proj({ vitesse: 13, rayon: 12, degats: 5, nb: 5, eventail: true, forme: 'eclat' }) },
    ulti: { nom: 'MILLE REFLETS !!', portee: 300, visuel: 'miroirs' },
    saisie: { nom: 'REFLET MORTEL', seq: [['REFLET !', 10, 6], ['DOUBLE !', 12, 7], ['TRIPLE !', 14, 8], ['BRISURE !', 18, 11], ['MIROIR FINAL !', 24, 15]] },
    combos: [
      { nom: 'REFLET FUGACE', entree: 'PPK', coup: ruee({ vx: 15, duree: 16, degats: 13, stun: 28, recul: 8, traverse: true, invincible: 12 }) },
      { nom: 'MIROIR', entree: 'BBP', coup: { type: 'garde', duree: 40, renvoi: true } },
      { nom: 'DOUBLE', entree: 'DBP', coup: { type: 'teleport', derriere: true, degats: 12, stun: 26, recul: 12, duree: 16 } },
    ],
  }),

  /* ---- les combattants qu'on gagne au fil de l'histoire ---- */
  P({
    id: 'vorn', nom: 'GÉNÉRAL VORN', style: 'Chef de l’Armée de l’Horloge', desc: 'Mille soldats, un seul ordre', secret: 'histoire',
    indice: 'Battez-le à la tête de son armée (mode Histoire, acte VI)',
    c: { c1: '#e8a030', c2: '#5a3a10', faisceau: '#ffd080', aura: '#e8a030', peau: '#c89a78', cheveux: '#9a9a9a', tenue: '#2a3440', ceinture: '#e8a030' },
    stats: { hp: 10, dmg: 11, def: 9 }, vitesse: 3.8, saut: 12, dmg: 1.05, hpMult: 1.01, defMult: 1.01,
    look: { corps: 'massif', tete: 'heaume', extras: ['general', 'cape', 'epee-general'] },
    specA: { nom: 'CHARGE DE LA LÉGION !', ...ruee({ vx: 14, duree: 30, degats: 17, stun: 30, recul: 18, armure: true, portee: 110 }) },
    specB: { nom: 'PLUIE DE LANCES !', ...zone({ ou: 'cible', delai: 26, rayon: 110, hauteur: 260, degats: 6, coups: 3, stun: 30, forme: 'pic' }) },
    ulti: { nom: 'ASSAUT DE LA LÉGION !!', portee: 280, visuel: 'legion' },
    saisie: { nom: 'ORDRE DU GÉNÉRAL', seq: [['GARDE-À-VOUS !', 10, 6], ['EN RANG !', 10, 6], ['CHARGEZ !', 14, 8], ['SANS PITIÉ !', 18, 10], ['VICTOIRE !', 24, 14]] },
    combos: [
      { nom: 'MARCHE FORCÉE', entree: 'PPK', coup: ruee({ vx: 8, duree: 22, coups: 2, degats: 8, stun: 24, recul: 10, armure: true }) },
      { nom: 'TAILLE DU GÉNÉRAL', entree: 'DFP', coup: proj({ vitesse: 15, rayon: 22, degats: 11, duree: 50, forme: 'croissant' }) },
      { nom: 'MUR DE BOUCLIERS', entree: 'BBP', coup: { type: 'garde', duree: 40, contre: true } },
    ],
  }),
  P({
    id: 'sablia', nom: 'SABLIA', style: 'Gardienne du Sablier', desc: 'Chaque grain est une seconde volée', secret: 'histoire',
    indice: 'Ouvrez-lui les yeux sur Kaïros (mode Histoire, acte IV)',
    c: { c1: '#f0c060', c2: '#8a5a20', faisceau: '#ffe0a0', aura: '#f0c060', peau: '#d8a878', cheveux: '#f8e8c0', tenue: '#4a2a50', ceinture: '#f0c060' },
    stats: { hp: 11, dmg: 13, def: 10 }, vitesse: 4.6, saut: 15, dmg: 1.25, hpMult: 1.1, defMult: 1.12,
    look: { corps: 'fin', tete: 'longs', extras: ['robe', 'orbes', 'echarpe'] },
    specA: { nom: 'TEMPÊTE DE SABLE !', ...faisceau({ portee: 520, epaisseur: 40, degats: 13, stun: 24, cone: true, effet: 'lenteur', couleur: '#f0c060' }) },
    specB: { nom: 'SABLES MOUVANTS !', ...zone({ ou: 'cible', delai: 20, rayon: 120, hauteur: 70, degats: 10, stun: 40, forme: 'flaque', solSeulement: true, effet: 'lenteur' }) },
    ulti: { nom: 'SABLIER INFINI !!', portee: 300, visuel: 'sablier-infini' },
    saisie: { nom: 'ENSEVELISSEMENT', seq: [['GRAIN !', 8, 5], ['DUNE !', 10, 6], ['TOURBILLON !', 12, 7], ['ENSEVELI !', 16, 9], ['POUSSIÈRE !', 22, 12]] },
    combos: [
      { nom: 'VENT DU DÉSERT', entree: 'PPK', coup: ruee({ vx: 10, duree: 20, coups: 3, degats: 5, stun: 20, recul: 6 }) },
      { nom: 'SABLIER', entree: 'DFP', coup: proj({ vitesse: 9, rayon: 18, degats: 10, duree: 90, forme: 'sablier', vy: -8, gravite: 0.3, effet: 'lenteur' }) },
      { nom: 'MIRAGE', entree: 'DBP', coup: { type: 'teleport', recule: true, duree: 16 } },
    ],
  }),
  P({
    id: 'eclipse', nom: 'ÉCLIPSE', style: 'Lame du Temps Perdu', desc: 'La sœur que l’ombre avait perdue', secret: 'histoire',
    indice: 'Rendez-la à sa sœur (mode Histoire, acte IX)',
    c: { c1: '#ff9a3c', c2: '#3a1060', faisceau: '#ffc070', aura: '#ff7a20', peau: '#c8a0b8', cheveux: '#1a0a2a', tenue: '#120820', ceinture: '#ff9a3c' },
    stats: { hp: 11, dmg: 13, def: 9 }, vitesse: 5.6, saut: 17, dmg: 1.29, hpMult: 1.05, defMult: 1.02,
    look: { corps: 'fin', tete: 'couettes', extras: ['katana', 'echarpe', 'aura-noire'] },
    specA: { nom: 'COURONNE NOIRE !', ...proj({ vitesse: 12, rayon: 24, degats: 14, forme: 'croissant', traverse: true }) },
    specB: { nom: 'OMBRE SOLAIRE !', type: 'teleport', derriere: true, degats: 15, stun: 28, recul: 10, duree: 22 },
    ulti: { nom: 'ÉCLIPSE TOTALE !!', portee: 300, visuel: 'eclipse-totale' },
    saisie: { nom: 'NUIT EN PLEIN JOUR', seq: [['OMBRE !', 8, 4], ['LUNE !', 8, 5], ['SOLEIL !', 12, 7], ['ÉCLIPSE !', 16, 9], ['TOTALITÉ !', 22, 11]] },
    combos: [
      { nom: 'DANSE DU CRÉPUSCULE', entree: 'PPK', coup: ruee({ vx: 12, duree: 20, coups: 3, degats: 5, stun: 20, recul: 6, traverse: true }) },
      { nom: 'LAME ORANGE', entree: 'FFP', coup: ruee({ vx: 16, duree: 14, degats: 12, stun: 26, recul: 14, invincible: 8 }) },
      { nom: 'DOUBLE OMBRE', entree: 'DFK', coup: proj({ vitesse: 16, rayon: 12, degats: 6, nb: 2, eventail: true, forme: 'lame' }) },
    ],
  }),
];

/* ---------------------------------------------------------------- */
/* Les figurants : l'armée de l'Horloge                               */
/* ---------------------------------------------------------------- */

/**
 * Les soldats de Kaïros. On les combat dans l'histoire, souvent plusieurs
 * d'affilée ; on ne les choisit jamais. Moins solides que les vrais
 * combattants (ce sont des secondes gelées, devenues soldats).
 */
const SOLDAT = { c1: '#7ad8d0', c2: '#2a4a50', faisceau: '#a8fff2', aura: '#40c8c0', peau: '#8aa4a8', cheveux: '#202a30', tenue: '#3a4a54', ceinture: '#ffd23f' };
export const FIGURANTS = [
  P({
    id: 'soldat', nom: 'SOLDAT DE L’HORLOGE', style: 'Fantassin', desc: 'Une seconde gelée, devenue soldat', figurant: true,
    c: SOLDAT,
    stats: { hp: 9, dmg: 10, def: 9 }, vitesse: 4.2, saut: 13, dmg: 1, hpMult: 0.85, defMult: 1,
    look: { corps: 'normal', tete: 'heaume', extras: ['armure', 'insigne'] },
    specA: { nom: 'TIR CADENCÉ !', ...proj({ vitesse: 14, rayon: 10, degats: 9, nb: 3, forme: 'balle', duree: 60 }) },
    specB: { nom: 'CHARGE !', ...ruee({ vx: 13, duree: 20, degats: 13, stun: 26, recul: 14 }) },
    ulti: { nom: 'SALVE DE L’HORLOGE !!', portee: 240, visuel: 'omega' },
    saisie: { nom: 'CLÉ DE BRAS', seq: [['TIC !', 8, 5], ['TAC !', 8, 5], ['TIC !', 10, 6], ['TAC !', 12, 7], ['SONNERIE !', 18, 10]] },
    combos: [
      { nom: 'ESCRIME', entree: 'PPK', coup: ruee({ vx: 8, duree: 18, coups: 2, degats: 6, stun: 20, recul: 8 }) },
      { nom: 'BAÏONNETTE', entree: 'FFP', coup: ruee({ vx: 14, duree: 14, degats: 10, stun: 22, recul: 12 }) },
      { nom: 'GRENADE', entree: 'DFP', coup: proj({ vitesse: 8, rayon: 16, degats: 10, duree: 80, forme: 'boule', vy: -9, gravite: 0.4 }) },
    ],
  }),
  P({
    id: 'sentinelle', nom: 'SENTINELLE', style: 'Garde lourd', desc: 'Un mur qui marche', figurant: true,
    c: { ...SOLDAT, c1: '#ff6a4a', c2: '#5a1a10', faisceau: '#ffb090', aura: '#ff6a4a', tenue: '#4a4448' },
    stats: { hp: 10, dmg: 10, def: 11 }, vitesse: 3.0, saut: 10, dmg: 0.98, hpMult: 1.01, defMult: 1.17,
    look: { corps: 'geant', tete: 'heaume', extras: ['armure', 'insigne', 'brassards'] },
    specA: { nom: 'CANON D’ÉPAULE !', ...faisceau({ portee: 600, epaisseur: 30, degats: 13, stun: 24, couleur: '#ff6a4a' }) },
    specB: { nom: 'ONDE DE CHOC !', ...zone({ ou: 'soi', delai: 10, rayon: 150, hauteur: 60, degats: 12, stun: 32, forme: 'seisme', solSeulement: true }) },
    ulti: { nom: 'BASTION !!', portee: 220, visuel: 'tectonique' },
    saisie: { nom: 'ÉCRASEMENT', seq: [['PRISE !', 10, 6], ['SERRE !', 12, 7], ['ÉCRASE !', 16, 9], ['PROJETTE !', 20, 12]] },
    combos: [
      { nom: 'MASSE', entree: 'PPK', coup: ruee({ vx: 6, duree: 24, degats: 14, stun: 30, recul: 16, armure: true }) },
      { nom: 'BOUCLIER', entree: 'BBP', coup: { type: 'garde', duree: 46 } },
      { nom: 'BÉLIER', entree: 'FFK', coup: ruee({ vx: 11, duree: 22, degats: 12, stun: 26, recul: 20, armure: true }) },
    ],
  }),
  P({
    id: 'chasseur', nom: 'CHASSEUR DU TEMPS', style: 'Éclaireur', desc: 'Il arrive toujours une seconde avant toi', figurant: true,
    c: { ...SOLDAT, c1: '#c87aff', c2: '#3a1a5a', faisceau: '#e0b0ff', aura: '#a050ff', tenue: '#24203a' },
    stats: { hp: 9, dmg: 11, def: 9 }, vitesse: 5.4, saut: 17, dmg: 1.13, hpMult: 0.88, defMult: 1.02,
    look: { corps: 'fin', tete: 'heaume', extras: ['insigne', 'echarpe'] },
    specA: { nom: 'DAGUES DU TEMPS !', ...proj({ vitesse: 16, rayon: 11, degats: 5, nb: 3, eventail: true, forme: 'aiguille', duree: 50 }) },
    specB: { nom: 'SAUT TEMPOREL !', type: 'teleport', derriere: true, degats: 12, stun: 24, recul: 10, duree: 20 },
    ulti: { nom: 'CHASSE À L’HOMME !!', portee: 260, visuel: 'mille-lames' },
    saisie: { nom: 'EMBUSCADE', seq: [['VU !', 8, 4], ['PRIS !', 8, 5], ['SAIGNE !', 12, 6], ['FINI !', 18, 9]] },
    combos: [
      { nom: 'RAFALE', entree: 'PPK', coup: ruee({ vx: 11, duree: 18, coups: 3, degats: 4, stun: 18, recul: 6, traverse: true }) },
      { nom: 'ESQUIVE', entree: 'DBP', coup: { type: 'teleport', recule: true, duree: 14 } },
      { nom: 'COUP DE GRÂCE', entree: 'FFP', coup: ruee({ vx: 15, duree: 14, degats: 11, stun: 24, recul: 12 }) },
    ],
  }),
];

/**
 * Les victoires : la pose de fin de round, la pose de fin de combat, et ce
 * qu'il dit quand il gagne.
 */
const VICTOIRES = {
  ryuken: ['v-salut', 'v-poing', 'Le maître serait fier. Bon… et ces ramen ?'],
  blazero: ['v-pointe', 'v-deux-poings', 'Trop chaud pour toi ?'],
  frostbyte: ['v-bras-croises', 'v-bras-ecartes', 'Reste au frais.'],
  shadowkira: ['v-meditation', 'v-bras-croises', 'Tu ne m’as même pas vue venir.'],
  thunderox: ['v-flex', 'v-deux-poings', 'LE TONNERRE A PARLÉ !'],
  ironclad: ['v-salut-mili', 'v-bras-croises', 'Victoire confirmée. Probabilité initiale : 100 %.'],
  serpenta: ['v-pointe', 'v-rire', 'Sssi facile…'],
  gravox: ['v-bras-croises', 'v-levitation', 'Tout finit par tomber.'],
  lunara: ['v-meditation', 'v-levitation', 'La lune m’avait prévenue.'],
  pyroclaw: ['v-poing-sol', 'v-deux-poings', 'GRRRAAAAAH !'],
  wraithblade: ['v-salut', 'v-genou', 'Une seule lame suffisait.'],
  celestia: ['v-deux-poings', 'v-levitation', 'Les étoiles étaient de mon côté.'],
  stoneback: ['v-poing-sol', 'v-flex', 'Je n’ai même pas bougé.'],
  stormwing: ['v-bras-ecartes', 'v-levitation', 'Le ciel m’appartient.'],
  voidreaper: ['v-bras-croises', 'v-bras-ecartes', 'Ton heure n’est pas venue… cette fois.'],
  aquathorn: ['v-pointe', 'v-poing', 'Retourne nager dans ta flaque.'],
  solarius: ['v-meditation', 'v-levitation', 'Que la lumière te guide.'],
  malvortex: ['v-rire', 'v-bras-ecartes', 'Rampe, insecte.'],
  lechaos: ['v-bras-ecartes', 'v-levitation', 'TOUT… S’EFFACE.'],
  kairos: ['v-pointe', 'v-levitation', 'J’avais déjà vu cette fin.'],
  onyx: ['v-sautille', 'v-poing', 'Cent un K.O.'],
  nemesis: ['v-bras-croises', 'v-levitation', 'Je suis toi… en mieux.'],
  vorn: ['v-salut-mili', 'v-garde-honneur', 'Repos, soldat. Tu t’es bien battu.'],
  sablia: ['v-meditation', 'v-bras-ecartes', 'Ton temps est écoulé.'],
  eclipse: ['v-bras-croises', 'v-pointe', 'Même le soleil s’éteint.'],
  soldat: ['v-salut-mili', 'v-salut-mili', 'Tic. Tac.'],
  sentinelle: ['v-flex', 'v-flex', 'Mur intact.'],
  chasseur: ['v-bras-croises', 'v-pointe', 'Proie abattue.'],
};
for (const p of [...PERSOS, ...FIGURANTS]) {
  const [round, combat, cri] = VICTOIRES[p.id] || ['v-poing', 'v-poing', 'Victoire !'];
  p.victoire = [round, combat];
  p.cri = cri;
}

/** Tous ceux qui peuvent monter sur le ring, figurants compris. */
export const PERSO = Object.fromEntries([...PERSOS, ...FIGURANTS].map((p) => [p.id, p]));
export const ROSTER = PERSOS.filter((p) => !p.boss && !p.secret);
export const BOSS = { normal: 'solarius', difficile: 'malvortex', impossible: 'lechaos' };
/** Les personnages secrets, et où les gagner (les autres secrets de l’histoire disent où dans `indice`). */
export const SECRETS = { histoire: 'kairos', tournoi: 'onyx', tour: 'nemesis' };
/** Un combattant à débloquer (boss ou secret). */
export const aDebloquer = (p) => !!(p.boss || p.secret);

/** Ce que coûte chaque coup en jauge (la jauge va de 0 à 100, en trois segments). */
export const JAUGE = { specB: 34, specA: 67, ulti: 100 };

/** Les dégâts de base de l'ultime (avant l'attaque et la défense des combattants). */
export const ULTI_DEGATS = 66;

/** Les entrées, lisibles : F avant, B arrière, D bas, U haut, P poing, K pied. */
export const SYMBOLES = { F: '➡️', B: '⬅️', D: '⬇️', U: '⬆️', P: '👊', K: '🦶' };
export const lireEntree = (e) => [...e].map((x) => SYMBOLES[x] || x).join(' ');
