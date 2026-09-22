/**
 * ZÉNITH — moteur de combat.
 *
 * Module ISO (aucune API navigateur ni Node) : il fait tourner aussi bien
 * une partie locale contre l'ordinateur qu'un affrontement en ligne arbitré
 * par le serveur.
 *
 * Le combat avance par ticks de durée fixe. Les joueurs n'agissent pas
 * « chacun leur tour » : ils envoient des intentions à tout moment, que le
 * moteur applique au tick suivant. C'est ce qui donne la nervosité d'un jeu
 * d'action tout en restant parfaitement synchronisable sur le réseau, les
 * actions étant discrètes.
 */

import {
  getFighter, elementMultiplier, CARD_KINDS, CARD_KEYS,
} from './fighters.js';

/* ------------------------------------------------------------------ */
/* Constantes de rythme                                                */
/* ------------------------------------------------------------------ */

export const TICK_MS = 100;
export const HAND_MAX = 4;
export const TEAM_SIZE = 3;

/** Multiplicateur global des dégâts, calibré pour des combats de ~90 s. */
export const DAMAGE_SCALE = 2.2;

export const KI_MAX = 100;
export const VANISH_COST = 30;
export const VANISH_TICKS = 8;      // fenêtre d'invulnérabilité
export const VANISH_RECOVERY = 2;
export const SWAP_RECOVERY = 6;
export const SWAP_COOLDOWN = 60;    // 6 s entre deux changements
export const COMBO_WINDOW = 14;     // ticks pour enchaîner
export const COMBO_STEP = 0.04;     // +4 % par coup enchaîné
export const COMBO_CAP = 8;
export const KO_SWAP_DELAY = 10;    // temps mort quand un combattant tombe

export const PHASE = { FIGHT: 'fight', OVER: 'over' };

/* ------------------------------------------------------------------ */
/* Aléa                                                                */
/* ------------------------------------------------------------------ */

export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

function makeUnit(fighterId) {
  const f = getFighter(fighterId);
  if (!f) throw new Error(`combattant inconnu : ${fighterId}`);
  return {
    fighterId,
    hp: f.hp,
    maxHp: f.hp,
    stun: 0,
    vanishUntil: -1,
    ultUsed: false,
    ko: false,
  };
}

/**
 * @param {Array<{id:string,name:string,team:string[],isBot?:boolean}>} sides
 * @param {{seed?:number}} [options]
 */
export function createBattle(sides, options = {}) {
  if (sides.length !== 2) throw new Error('un combat oppose exactement deux camps');
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);

  const state = {
    seed,
    rng,
    tick: 0,
    phase: PHASE.FIGHT,
    winner: null,
    effects: [],
    log: [],
    sides: sides.map((s, i) => ({
      index: i,
      id: s.id,
      name: s.name,
      isBot: !!s.isBot,
      team: s.team.slice(0, TEAM_SIZE).map(makeUnit),
      active: 0,
      ki: 50,
      hand: [],
      drawTimer: 0,
      swapCd: 0,
      combo: 0,
      comboUntil: -1,
      koPause: 0,
      pending: null,   // intention reçue, appliquée au prochain tick
      stats: { hits: 0, dealt: 0, taken: 0, vanishes: 0, specials: 0, ultimates: 0, kos: 0 },
    })),
  };

  // Main de départ, pour que le combat démarre immédiatement.
  for (const side of state.sides) {
    for (let i = 0; i < HAND_MAX - 1; i++) drawCard(state, side);
  }
  return state;
}

/* ------------------------------------------------------------------ */
/* Accès                                                               */
/* ------------------------------------------------------------------ */

export const activeUnit = (side) => side.team[side.active];
export const fighterOf = (unit) => getFighter(unit.fighterId);
export const aliveCount = (side) => side.team.filter((u) => !u.ko).length;

/** Vitesse de régénération du ki, par tick. */
function kiRegen(side) {
  const f = fighterOf(activeUnit(side));
  return 0.55 + f.speed * 0.011;
}

/**
 * Facteur d'immobilisation : un combattant rapide récupère plus vite, ce qui
 * lui rend en fréquence d'action ce qu'il n'a pas en endurance.
 */
export function recoveryScale(fighter) {
  return 1.3 - fighter.speed * 0.006;
}

/** Nombre de ticks entre deux pioches. */
function drawInterval(side) {
  const f = fighterOf(activeUnit(side));
  return Math.max(6, Math.round(22 - f.speed * 0.11));
}

function log(state, text) {
  state.log.push({ tick: state.tick, text });
  if (state.log.length > 60) state.log.shift();
}

function effect(state, e) {
  state.effects.push({ tick: state.tick, ...e });
}

/* ------------------------------------------------------------------ */
/* Pioche                                                              */
/* ------------------------------------------------------------------ */

/**
 * Tire une carte. Les ultimes sont rares et ne tombent qu'une fois le ki
 * bien rempli, pour qu'elles restent un aboutissement et non une loterie.
 */
function drawCard(state, side) {
  if (side.hand.length >= HAND_MAX) return null;
  const unit = activeUnit(side);
  const r = state.rng();

  let kind;
  if (!unit.ultUsed && side.ki >= 70 && r < 0.07) kind = 'ultime';
  else if (r < 0.28) kind = 'speciale';
  else if (r < 0.62) kind = 'souffle';
  else kind = 'frappe';

  side.hand.push(kind);
  return kind;
}

/* ------------------------------------------------------------------ */
/* Intentions                                                          */
/* ------------------------------------------------------------------ */

/**
 * Enregistre l'intention d'un camp. Elle sera appliquée au tick suivant,
 * ce qui garantit que les deux camps sont traités de la même façon quel
 * que soit l'ordre d'arrivée des messages réseau.
 *
 * @param {'play'|'vanish'|'swap'} type
 */
export function queueAction(state, sideIndex, action) {
  if (state.phase !== PHASE.FIGHT) return { ok: false, error: 'phase' };
  const side = state.sides[sideIndex];
  if (!side) return { ok: false, error: 'camp inconnu' };

  const unit = activeUnit(side);
  if (unit.ko || unit.stun > 0 || side.koPause > 0) return { ok: false, error: 'occupé' };

  if (action.type === 'play') {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i >= side.hand.length) return { ok: false, error: 'carte' };
    const card = CARD_KINDS[side.hand[i]];
    if (side.ki < card.ki) return { ok: false, error: 'ki' };
    side.pending = { type: 'play', index: i };
    return { ok: true };
  }

  if (action.type === 'vanish') {
    if (side.ki < VANISH_COST) return { ok: false, error: 'ki' };
    side.pending = { type: 'vanish' };
    return { ok: true };
  }

  if (action.type === 'swap') {
    const s = action.slot;
    if (!Number.isInteger(s) || s < 0 || s >= side.team.length) return { ok: false, error: 'slot' };
    if (s === side.active) return { ok: false, error: 'déjà actif' };
    if (side.team[s].ko) return { ok: false, error: 'ko' };
    if (side.swapCd > 0) return { ok: false, error: 'recharge' };
    side.pending = { type: 'swap', slot: s };
    return { ok: true };
  }

  return { ok: false, error: 'action inconnue' };
}

/* ------------------------------------------------------------------ */
/* Résolution                                                          */
/* ------------------------------------------------------------------ */

/**
 * Résout la statistique d'une carte.
 *
 * « mixte » prend la moyenne de la force et du souffle : les techniques
 * signature puisent dans les deux. Ce choix n'est pas cosmétique. Si elles
 * retenaient seulement le meilleur score, un combattant tout en force
 * frapperait plus fort au corps à corps *et* lancerait d'aussi bonnes
 * spéciales qu'un polyvalent ayant investi autant de points — il n'y aurait
 * plus de compromis. Avec la moyenne, à investissement offensif égal les
 * dégâts attendus s'équivalent, et chaque profil garde son terrain : la
 * brute au corps à corps, le polyvalent au souffle.
 */
export function statOf(fighter, stat) {
  if (stat !== 'mixte') return fighter[stat];
  return (fighter.strike + fighter.blast) / 2;
}

/** Dégâts d'une carte, tous modificateurs appliqués. */
export function computeDamage(state, side, foe, cardKey) {
  const card = CARD_KINDS[cardKey];
  const att = activeUnit(side);
  const def = activeUnit(foe);
  const af = fighterOf(att);
  const df = fighterOf(def);

  const raw = statOf(af, card.stat) * card.power * DAMAGE_SCALE;
  const elem = elementMultiplier(af.element, df.element);
  const combo = 1 + Math.min(side.combo, COMBO_CAP) * COMBO_STEP;
  const mitigation = 100 / (100 + df.armor);
  const jitter = 0.95 + state.rng() * 0.1;

  return {
    amount: Math.max(1, Math.round(raw * elem * combo * mitigation * jitter)),
    elem,
    combo,
  };
}

function resolvePlay(state, side, foe, index) {
  const unit = activeUnit(side);
  const cardKey = side.hand[index];
  if (!cardKey) return;
  const card = CARD_KINDS[cardKey];
  const af0 = fighterOf(unit);

  if (side.ki < card.ki) return;
  if (cardKey === 'ultime' && unit.ultUsed) return;

  side.hand.splice(index, 1);
  side.ki -= card.ki;
  unit.stun = card.recovery * recoveryScale(af0);
  if (cardKey === 'ultime') unit.ultUsed = true;
  if (cardKey === 'speciale') side.stats.specials += 1;
  if (cardKey === 'ultime') side.stats.ultimates += 1;

  const target = activeUnit(foe);

  // Esquive : le coup passe à travers, et l'esquiveur reprend la main.
  if (state.tick < target.vanishUntil) {
    target.vanishUntil = -1;
    side.combo = 0;
    effect(state, { type: 'vanish', side: foe.index });
    log(state, `${fighterOf(target).name} esquive !`);
    return;
  }

  const { amount, elem } = computeDamage(state, side, foe, cardKey);
  target.hp = Math.max(0, target.hp - amount);
  target.stun = Math.max(target.stun, card.hitstun * recoveryScale(fighterOf(target)));

  side.ki = Math.min(KI_MAX, side.ki + card.kiGain);
  side.combo = state.tick <= side.comboUntil ? side.combo + 1 : 1;
  side.comboUntil = state.tick + COMBO_WINDOW;
  side.stats.hits += 1;
  side.stats.dealt += amount;
  foe.stats.taken += amount;

  effect(state, {
    type: 'hit', side: side.index, card: cardKey, amount, elem,
    combo: side.combo, name: cardName(unit, cardKey),
  });

  if (target.hp === 0) knockOut(state, foe, side);
}

/** Nom affiché d'une carte : les spéciales et ultimes portent celui du combattant. */
export function cardName(unit, cardKey) {
  const f = fighterOf(unit);
  if (cardKey === 'speciale') return f.special.name;
  if (cardKey === 'ultime') return f.ultimate.name;
  return CARD_KINDS[cardKey].label;
}

function knockOut(state, side, killer) {
  const unit = activeUnit(side);
  unit.ko = true;
  unit.stun = 0;
  killer.stats.kos += 1;
  effect(state, { type: 'ko', side: side.index, fighter: unit.fighterId });
  log(state, `${fighterOf(unit).name} est hors de combat.`);

  if (aliveCount(side) === 0) {
    state.phase = PHASE.OVER;
    state.winner = killer.index;
    effect(state, { type: 'victory', side: killer.index });
    log(state, `${killer.name} remporte le combat.`);
    return;
  }
  // Le camp reste sonné le temps que le suivant entre en lice.
  side.koPause = KO_SWAP_DELAY;
}

function resolveVanish(state, side) {
  const unit = activeUnit(side);
  if (side.ki < VANISH_COST) return;
  side.ki -= VANISH_COST;
  unit.vanishUntil = state.tick + VANISH_TICKS;
  unit.stun = VANISH_RECOVERY;
  side.stats.vanishes += 1;
  effect(state, { type: 'vanish-start', side: side.index });
}

function resolveSwap(state, side, slot) {
  if (side.swapCd > 0 || side.team[slot].ko) return;
  const from = activeUnit(side);
  side.active = slot;
  side.swapCd = SWAP_COOLDOWN;
  side.combo = 0;
  activeUnit(side).stun = SWAP_RECOVERY;
  // La main appartient au combattant : elle est renouvelée au changement.
  side.hand = [];
  side.drawTimer = 0;
  effect(state, {
    type: 'swap', side: side.index,
    from: from.fighterId, to: activeUnit(side).fighterId,
  });
  log(state, `${side.name} envoie ${fighterOf(activeUnit(side)).name}.`);
}

/** Fait entrer le combattant suivant après un KO. */
function bringNext(state, side) {
  const next = side.team.findIndex((u) => !u.ko);
  if (next < 0) return;
  side.active = next;
  side.hand = [];
  side.drawTimer = 0;
  side.combo = 0;
  activeUnit(side).stun = 0;
  effect(state, { type: 'enter', side: side.index, fighter: activeUnit(side).fighterId });
  log(state, `${fighterOf(activeUnit(side)).name} entre en lice.`);
}

/* ------------------------------------------------------------------ */
/* Boucle                                                              */
/* ------------------------------------------------------------------ */

/**
 * Avance le combat d'un tick. Les deux camps sont traités symétriquement :
 * on applique d'abord les intentions, puis on fait s'écouler le temps.
 */
export function step(state) {
  if (state.phase !== PHASE.FIGHT) return state.effects;
  state.effects = [];
  state.tick += 1;

  const [a, b] = state.sides;

  // 1. Intentions, dans un ordre fixe mais compensé par la simultanéité :
  //    aucune ne dépend du résultat de l'autre au même tick.
  const pendings = [
    [a, b, a.pending],
    [b, a, b.pending],
  ];
  a.pending = null;
  b.pending = null;

  for (const [side, foe, action] of pendings) {
    if (!action) continue;
    const unit = activeUnit(side);
    if (unit.ko || unit.stun > 0 || side.koPause > 0) continue;

    if (action.type === 'play') resolvePlay(state, side, foe, action.index);
    else if (action.type === 'vanish') resolveVanish(state, side);
    else if (action.type === 'swap') resolveSwap(state, side, action.slot);

    if (state.phase !== PHASE.FIGHT) return state.effects;
  }

  // 2. Écoulement du temps.
  for (const side of state.sides) {
    if (side.koPause > 0) {
      side.koPause -= 1;
      if (side.koPause === 0) bringNext(state, side);
      continue;
    }

    const unit = activeUnit(side);
    if (unit.stun > 0) unit.stun -= 1;
    if (side.swapCd > 0) side.swapCd -= 1;
    if (state.tick > side.comboUntil) side.combo = 0;

    side.ki = Math.min(KI_MAX, side.ki + kiRegen(side));

    side.drawTimer += 1;
    if (side.drawTimer >= drawInterval(side)) {
      side.drawTimer = 0;
      drawCard(state, side);
    }
  }

  return state.effects;
}

/** Avance de plusieurs ticks d'un coup, en accumulant les effets. */
export function advance(state, ticks) {
  const all = [];
  for (let i = 0; i < ticks && state.phase === PHASE.FIGHT; i++) {
    all.push(...step(state));
  }
  return all;
}

/* ------------------------------------------------------------------ */
/* Vue client                                                          */
/* ------------------------------------------------------------------ */

/**
 * Projette l'état pour un camp. Contrairement à un jeu de bluff, tout est
 * public dans un combat : on masque seulement la main adverse, qui donnerait
 * une information de timing indue.
 */
export function viewFor(state, viewerId) {
  const me = state.sides.findIndex((s) => s.id === viewerId);
  const mine = me < 0 ? 0 : me;

  return {
    tick: state.tick,
    phase: state.phase,
    winner: state.winner,
    viewerSide: mine,
    tickMs: TICK_MS,
    sides: state.sides.map((s, i) => ({
      index: i,
      id: s.id,
      name: s.name,
      isBot: s.isBot,
      active: s.active,
      ki: Math.round(s.ki),
      combo: s.combo,
      swapCd: s.swapCd,
      koPause: s.koPause,
      handCount: s.hand.length,
      hand: i === mine ? [...s.hand] : null,
      stats: s.stats,
      team: s.team.map((u) => ({
        fighterId: u.fighterId,
        hp: u.hp,
        maxHp: u.maxHp,
        stun: u.stun,
        vanishing: state.tick < u.vanishUntil,
        ultUsed: u.ultUsed,
        ko: u.ko,
      })),
    })),
    log: state.log.slice(-5),
  };
}
