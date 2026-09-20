/**
 * Adversaires du mode hors-ligne.
 *
 * Chaque bot raisonne sur ce qu'il peut honnetement savoir : sa main, le
 * nombre de cartes annoncees, la taille des mains adverses et l'etat des
 * barillets. Une personnalite module ensuite ce calcul, pour que la table
 * ne se comporte pas comme quatre copies du meme joueur.
 */

import {
  DECK_COMPOSITION, JOKER, MAX_PLAY, CHAMBERS,
  isValidCard, playerById,
} from './engine.js';

/** Profils de jeu. `bluff` pousse a mentir, `suspicion` a crier au menteur. */
export const PROFILES = {
  prudent: {
    key: 'prudent', label: 'Prudent',
    blurb: 'Joue serre, ne ment que le dos au mur.',
    bluff: 0.55, suspicion: 0.85, greed: 0.7, nerve: 0.75,
  },
  fanfaron: {
    key: 'fanfaron', label: 'Fanfaron',
    blurb: 'Balance trois cartes en riant, vraies ou fausses.',
    bluff: 1.5, suspicion: 1.15, greed: 1.6, nerve: 1.25,
  },
  calculateur: {
    key: 'calculateur', label: 'Calculateur',
    blurb: 'Compte les cartes et attend la faute.',
    bluff: 0.9, suspicion: 1.3, greed: 0.9, nerve: 1.0,
  },
  joueur: {
    key: 'joueur', label: 'Flambeur',
    blurb: 'Tente le diable dès que le barillet se vide.',
    bluff: 1.25, suspicion: 0.8, greed: 1.3, nerve: 1.5,
  },
};

export const PROFILE_KEYS = Object.keys(PROFILES);

/** Reglages de difficulte : precision du raisonnement et temps de reflexion. */
export const DIFFICULTIES = {
  facile: { key: 'facile', label: 'Novice', skill: 0.35, noise: 0.3, think: [700, 1400] },
  normal: { key: 'normal', label: 'Habitue', skill: 0.7, noise: 0.15, think: [800, 1800] },
  brutal: { key: 'brutal', label: 'Impitoyable', skill: 1.0, noise: 0.05, think: [600, 1500] },
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Probabilite que `count` cartes tirees des inconnues soient toutes valides.
 * On raisonne par tirage sans remise sur le paquet moins notre propre main.
 */
function probabilityAllValid(state, botId, count) {
  const bot = playerById(state, botId);
  const total = Object.values(DECK_COMPOSITION).reduce((a, b) => a + b, 0);
  const validTotal = DECK_COMPOSITION[state.tableCard] + DECK_COMPOSITION[JOKER];

  // Les cartes valides que nous tenons ne sont plus disponibles pour les autres.
  const mine = bot.hand.length;
  const myValid = bot.hand.filter((c) => isValidCard(c, state.tableCard)).length;

  let unknown = total - mine;
  let validLeft = validTotal - myValid;

  let p = 1;
  for (let i = 0; i < count; i++) {
    if (unknown <= 0) return 0;
    p *= Math.max(0, validLeft) / unknown;
    validLeft -= 1;
    unknown -= 1;
  }
  return p;
}

/**
 * Decide du coup a jouer.
 * @returns {{type:'play', indices:number[]}|{type:'challenge'}}
 */
export function decide(state, botId, difficultyKey = 'normal') {
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.normal;
  const bot = playerById(state, botId);
  const profile = PROFILES[bot.profile] || PROFILES.calculateur;

  const valid = [];
  const junk = [];
  bot.hand.forEach((card, i) => (isValidCard(card, state.tableCard) ? valid : junk).push(i));

  const canChallenge = !!state.lastPlay && state.lastPlay.playerId !== botId;

  if (canChallenge) {
    const accused = playerById(state, state.lastPlay.playerId);
    const count = state.lastPlay.count;

    // Vraisemblance brute de l'annonce.
    let lieOdds = 1 - probabilityAllValid(state, botId, count);

    // Un joueur qui se debarrasse de trois cartes d'un coup force souvent.
    if (count === 3) lieOdds += 0.12;
    if (count === 1) lieOdds -= 0.05;

    // Vider sa main est un objectif : la derniere pose est plus souvent un bluff.
    if (accused.hand.length === 0) lieOdds += 0.15;

    // Risque personnel : accuser a tort, c'est tirer soi-meme.
    const myRisk = 1 / Math.max(1, CHAMBERS - bot.shotsFired);
    const hisRisk = 1 / Math.max(1, CHAMBERS - accused.shotsFired);
    // Accuser devient interessant si sa balle est plus probable que la notre.
    const leverage = hisRisk - myRisk;

    let score = lieOdds * profile.suspicion + leverage * 0.9 * profile.nerve;

    // Un debutant lit mal la table : on brouille sa decision.
    score = score * diff.skill + (Math.random() - 0.5) * diff.noise * 2 + (1 - diff.skill) * 0.35;

    // Sans carte valide en main, se taire revient a mentir au tour suivant :
    // mieux vaut souvent tenter l'accusation.
    if (valid.length === 0) score += 0.18 * profile.nerve;

    if (Math.random() < clamp01(score - 0.42)) return { type: 'challenge' };
  }

  return { type: 'play', indices: choosePlay(state, bot, profile, diff, valid, junk) };
}

function choosePlay(state, bot, profile, diff, valid, junk) {
  const handSize = bot.hand.length;
  const maxPlay = Math.min(MAX_PLAY, handSize);

  // Finir la manche main vide est confortable : aucune accusation ne vise plus
  // le joueur, et la manche s'arrete souvent avant le coup de feu.
  const canEmpty = handSize <= MAX_PLAY;
  if (canEmpty && (valid.length === handSize || Math.random() < 0.55 * profile.greed)) {
    return bot.hand.map((_, i) => i);
  }

  if (valid.length > 0) {
    // On pose honnetement, en gardant une reserve si le profil est prudent.
    let count = Math.min(valid.length, maxPlay);
    const keepBack = profile.greed < 1 && valid.length > 1 && Math.random() < 0.45;
    if (keepBack) count = Math.max(1, count - 1);
    if (profile.greed > 1.3 && valid.length >= 2) count = Math.min(valid.length, maxPlay);
    return valid.slice(0, count);
  }

  // Aucune carte valide : le bluff est force. Reste a doser.
  const risk = 1 / Math.max(1, CHAMBERS - bot.shotsFired);
  // Plus le barillet est vide, plus on ment petit pour limiter la casse.
  let count = 1;
  const bigBluffChance = clamp01(0.3 * profile.bluff - risk * 0.8 * (2 - profile.nerve));
  if (junk.length >= 2 && Math.random() < bigBluffChance) count = 2;
  if (junk.length >= 3 && Math.random() < bigBluffChance * 0.4) count = 3;

  // Un bot faible ment de façon erratique.
  if (diff.skill < 0.5 && Math.random() < 0.3) count = 1 + Math.floor(Math.random() * Math.min(3, junk.length));

  return junk.slice(0, Math.max(1, Math.min(count, maxPlay)));
}

/** Delai de reflexion, pour que la table respire. */
export function thinkDelay(difficultyKey = 'normal') {
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.normal;
  const [min, max] = diff.think;
  return min + Math.random() * (max - min);
}

const BOT_NAMES = [
  ['Doc Ravenswood', '🎩'], ['Calamity Jane', '🌹'], ['Bill le Sourd', '🪕'],
  ['Consuela', '🪭'], ['Le Fossoyeur', '⚰️'], ['Pearl', '💄'],
  ['Abilene', '🐎'], ['Whiskey Sam', '🥃'], ['Mama Ruth', '🍀'],
  ['Cactus Joe', '🌵'], ['Lefty', '🃏'], ['Mademoiselle Colt', '🎯'],
];

/** Tire des adversaires distincts, chacun avec son profil. */
export function makeBots(count) {
  const pool = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
  const profiles = [...PROFILE_KEYS].sort(() => Math.random() - 0.5);
  return pool.map(([name, avatar], i) => ({
    id: `bot-${i}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    avatar,
    isBot: true,
    profile: profiles[i % profiles.length],
  }));
}
