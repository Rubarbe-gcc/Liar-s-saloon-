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

/* ---------------------------------------------------------------- */
/* Le roster                                                          */
/* ---------------------------------------------------------------- */

const P = (o) => ({ boss: null, ...o });

export const PERSOS = [
  P({
    id: 'ryuken', nom: 'RYU-KEN', style: 'Arts Martiaux', desc: 'Maître du Poing de Tonnerre',
    c: { c1: '#3296ff', c2: '#0050c8', faisceau: '#3296ff', aura: '#50a0ff', peau: '#dcb996', cheveux: '#141414', tenue: '#f0f0f0', ceinture: '#c80000' },
    stats: { hp: 10, dmg: 10, def: 8 }, vitesse: 4.5, saut: 14, dmg: 1.0, hpMult: 1.0, defMult: 1.0,
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
    stats: { hp: 8, dmg: 13, def: 5 }, vitesse: 4.2, saut: 13, dmg: 1.25, hpMult: 0.88, defMult: 0.9,
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
    stats: { hp: 9, dmg: 10, def: 10 }, vitesse: 3.6, saut: 15, dmg: 1.05, hpMult: 0.95, defMult: 1.05,
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
    stats: { hp: 7, dmg: 10, def: 7 }, vitesse: 5.6, saut: 16, dmg: 0.95, hpMult: 0.82, defMult: 0.92,
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
    stats: { hp: 12, dmg: 13, def: 7 }, vitesse: 3.7, saut: 12, dmg: 1.3, hpMult: 1.15, defMult: 0.95,
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
    stats: { hp: 15, dmg: 10, def: 14 }, vitesse: 3.0, saut: 10, dmg: 1.1, hpMult: 1.35, defMult: 1.2,
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
    stats: { hp: 8, dmg: 9, def: 6 }, vitesse: 5.2, saut: 14, dmg: 0.95, hpMult: 0.85, defMult: 0.88,
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
    stats: { hp: 13, dmg: 14, def: 11 }, vitesse: 3.2, saut: 11, dmg: 1.35, hpMult: 1.25, defMult: 1.1,
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
    stats: { hp: 8, dmg: 11, def: 7 }, vitesse: 5.0, saut: 18, dmg: 1.12, hpMult: 0.88, defMult: 0.94,
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
    stats: { hp: 14, dmg: 15, def: 6 }, vitesse: 4.8, saut: 13, dmg: 1.45, hpMult: 1.1, defMult: 0.85,
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
    stats: { hp: 9, dmg: 12, def: 9 }, vitesse: 5.4, saut: 15, dmg: 1.2, hpMult: 0.9, defMult: 1.08,
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
    stats: { hp: 9, dmg: 10, def: 8 }, vitesse: 4.4, saut: 17, dmg: 1.08, hpMult: 0.92, defMult: 1.0,
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
    stats: { hp: 15, dmg: 12, def: 15 }, vitesse: 2.5, saut: 8, dmg: 1.2, hpMult: 1.5, defMult: 1.35,
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
    stats: { hp: 9, dmg: 11, def: 8 }, vitesse: 6.0, saut: 19, dmg: 1.15, hpMult: 0.88, defMult: 0.96,
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
    stats: { hp: 10, dmg: 13, def: 9 }, vitesse: 4.6, saut: 14, dmg: 1.28, hpMult: 0.95, defMult: 1.02,
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
    stats: { hp: 11, dmg: 11, def: 11 }, vitesse: 4.0, saut: 13, dmg: 1.18, hpMult: 1.05, defMult: 1.08,
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

  /* ---- les boss de campagne, débloqués en les battant ---- */
  P({
    id: 'solarius', nom: 'SOLARIUS', style: 'Gardien de la Lumière', desc: 'La lumière qui consume les ténèbres', boss: 'normal',
    c: { c1: '#ffdc3c', c2: '#ffa000', faisceau: '#ffffb4', aura: '#ffc800', peau: '#f0e6c8', cheveux: '#ffffb4', tenue: '#dcc88c', ceinture: '#ffc800' },
    stats: { hp: 14, dmg: 14, def: 14 }, vitesse: 4.6, saut: 16, dmg: 1.55, hpMult: 1.45, defMult: 1.25,
    look: { corps: 'normal', tete: 'halo', extras: ['ailes-lumiere', 'armure-or', 'epee'] },
    specA: { nom: 'LANCE DE LUMIÈRE !', ...proj({ vitesse: 20, rayon: 18, degats: 15, forme: 'lance', traverse: true, duree: 50 }) },
    specB: { nom: 'JUGEMENT SOLAIRE !', ...zone({ ou: 'cible', delai: 30, rayon: 70, hauteur: 600, degats: 19, stun: 34, forme: 'rayon-ciel' }) },
    ulti: { nom: 'DIVINE APOCALYPSE !!', portee: 300, visuel: 'divine' },
    saisie: { nom: 'JUGEMENT CÉLESTE', seq: [['FRAPPE SAINTE !', 10, 6], ['LUMIÈRE !', 12, 7], ['JUGEMENT !', 15, 9], ['SENTENCE DIVINE !', 20, 12], ['PURIFICATION !', 26, 15]] },
    combos: [
      { nom: 'ÉPÉE DE L’AUBE', entree: 'PPK', coup: ruee({ vx: 10, duree: 18, degats: 14, stun: 28, recul: 14, portee: 150 }) },
      { nom: 'PLUMES SACRÉES', entree: 'DFP', coup: proj({ vitesse: 13, rayon: 10, degats: 5, nb: 3, eventail: true, forme: 'plume' }) },
      { nom: 'BÉNÉDICTION', entree: 'BBP', coup: { type: 'soin', soin: 10, duree: 40 } },
    ],
  }),
  P({
    id: 'malvortex', nom: 'MALVORTEX', style: 'Seigneur des Abysses', desc: "Né des profondeurs de l'enfer", boss: 'difficile',
    c: { c1: '#d01428', c2: '#50000a', faisceau: '#ff2828', aura: '#a00000', peau: '#0a0005', cheveux: '#c80014', tenue: '#050003', ceinture: '#b40000' },
    stats: { hp: 15, dmg: 15, def: 14 }, vitesse: 4.9, saut: 15, dmg: 1.7, hpMult: 1.5, defMult: 1.28,
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
    stats: { hp: 15, dmg: 15, def: 15 }, vitesse: 4.8, saut: 17, dmg: 1.65, hpMult: 1.55, defMult: 1.3,
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
];

export const PERSO = Object.fromEntries(PERSOS.map((p) => [p.id, p]));
export const ROSTER = PERSOS.filter((p) => !p.boss);
export const BOSS = { normal: 'solarius', difficile: 'malvortex', impossible: 'lechaos' };

/** Ce que coûte chaque coup en jauge (la jauge va de 0 à 100, en trois segments). */
export const JAUGE = { specB: 34, specA: 67, ulti: 100 };

/** Les dégâts de base de l'ultime (avant l'attaque et la défense des combattants). */
export const ULTI_DEGATS = 66;

/** Les entrées, lisibles : F avant, B arrière, D bas, U haut, P poing, K pied. */
export const SYMBOLES = { F: '➡️', B: '⬅️', D: '⬇️', U: '⬆️', P: '👊', K: '🦶' };
export const lireEntree = (e) => [...e].map((x) => SYMBOLES[x] || x).join(' ');
