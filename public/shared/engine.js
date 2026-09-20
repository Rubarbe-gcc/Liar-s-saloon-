/**
 * Liar's Saloon — moteur de regles.
 *
 * Module ISO (aucune API navigateur ni Node) : il est charge tel quel
 *  - par le client, pour faire tourner une partie hors-ligne contre des bots ;
 *  - par le serveur, comme autorite d'une partie en ligne.
 *
 * Le moteur est pur au sens ou toute source d'alea passe par `state.rng`,
 * ce qui rend une partie rejouable a partir de sa graine.
 */

export const TABLE_CARDS = ['K', 'Q', 'A'];
export const JOKER = 'J';

export const CARD_LABEL = { K: 'ROI', Q: 'DAME', A: 'AS', J: 'JOKER' };
export const CARD_LABEL_ONE = { K: 'Roi', Q: 'Dame', A: 'As', J: 'Joker' };
export const CARD_GLYPH = { K: 'K', Q: 'Q', A: 'A', J: '★' };

/** Composition du paquet : 6 rois, 6 dames, 6 as, 2 jokers. */
export const DECK_COMPOSITION = { K: 6, Q: 6, A: 6, J: 2 };
export const DECK_SIZE = 20;

export const HAND_SIZE = 5;
export const MAX_PLAY = 3;
export const CHAMBERS = 6;

export const PHASE = {
  PLAYING: 'playing',
  INTERMISSION: 'intermission',
  GAME_OVER: 'gameOver',
};

/* ------------------------------------------------------------------ */
/* Alea                                                                */
/* ------------------------------------------------------------------ */

/** Generateur mulberry32 : rapide, deterministe, suffisant pour du jeu. */
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

const randInt = (rng, n) => Math.floor(rng() * n);

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function buildDeck() {
  const deck = [];
  for (const [card, count] of Object.entries(DECK_COMPOSITION)) {
    for (let i = 0; i < count; i++) deck.push(card);
  }
  return deck;
}

/* ------------------------------------------------------------------ */
/* Creation de partie                                                  */
/* ------------------------------------------------------------------ */

/**
 * @param {Array<{id:string,name:string,avatar:string,isBot?:boolean,profile?:string}>} seats
 * @param {{seed?:number, turnMs?:number}} [options]
 */
export function createGame(seats, options = {}) {
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);

  const state = {
    seed,
    rng,
    turnMs: options.turnMs ?? 30000,
    phase: PHASE.PLAYING,
    round: 0,
    tableCard: 'K',
    players: seats.map((seat, index) => ({
      id: seat.id,
      name: seat.name,
      avatar: seat.avatar || '🤠',
      isBot: !!seat.isBot,
      profile: seat.profile || null,
      seat: index,
      hand: [],
      alive: true,
      connected: true,
      // Barillet : une balle logee dans une chambre tiree au hasard.
      bulletChamber: randInt(rng, CHAMBERS),
      shotsFired: 0,
      // Statistiques de fin de partie.
      stats: { bluffs: 0, plays: 0, callsMade: 0, callsWon: 0, callsTaken: 0, triggers: 0 },
    })),
    turn: 0,
    openerSeat: 0,
    // Derniere pose, seule cible possible d'une accusation.
    lastPlay: null,
    pile: 0,
    turnDeadline: 0,
    // Photo de la derniere confrontation, consommee par l'interface.
    resolution: null,
    winnerId: null,
    log: [],
  };

  startRound(state, { first: true });
  return state;
}

/* ------------------------------------------------------------------ */
/* Helpers d'etat                                                      */
/* ------------------------------------------------------------------ */

export const playerById = (state, id) => state.players.find((p) => p.id === id) || null;
export const alivePlayers = (state) => state.players.filter((p) => p.alive);
export const activePlayers = (state) => state.players.filter((p) => p.alive && p.hand.length > 0);

/** Une carte est valide si elle correspond a la carte de table, ou si c'est un joker. */
export const isValidCard = (card, tableCard) => card === tableCard || card === JOKER;

/** Chance de survie au prochain coup de percuteur, en pourcentage. */
export function survivalOdds(player) {
  const left = CHAMBERS - player.shotsFired;
  if (left <= 0) return 0;
  return Math.round(((left - 1) / left) * 100);
}

function nextSeatWithCards(state, fromSeat, { exclude = null } = {}) {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const p = state.players[(fromSeat + step) % n];
    if (!p.alive || p.hand.length === 0) continue;
    if (exclude && p.id === exclude) continue;
    return p;
  }
  return null;
}

function logLine(state, text) {
  state.log.push({ round: state.round, text });
  if (state.log.length > 120) state.log.shift();
}

/* ------------------------------------------------------------------ */
/* Manches                                                             */
/* ------------------------------------------------------------------ */

/** Choisit qui ouvre la manche, en faisant tourner le rang au fil du temps. */
function pickOpener(state, alive, first) {
  if (first) return alive[0];

  const survivor = state.resolution && state.resolution.loserId
    ? playerById(state, state.resolution.loserId)
    : null;
  if (survivor && survivor.alive) return survivor;

  const from = survivor ? survivor.seat : state.openerSeat;
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const p = state.players[(from + step) % n];
    if (p.alive) return p;
  }
  return alive[0];
}

/** Redistribue le paquet, tire une nouvelle carte de table et relance le tour. */
export function startRound(state, { first = false } = {}) {
  const events = [];
  const alive = alivePlayers(state);

  if (alive.length <= 1) {
    state.phase = PHASE.GAME_OVER;
    state.winnerId = alive.length === 1 ? alive[0].id : null;
    events.push({ type: 'gameOver', winnerId: state.winnerId });
    return events;
  }

  state.round += 1;
  state.tableCard = TABLE_CARDS[randInt(state.rng, TABLE_CARDS.length)];
  state.lastPlay = null;
  state.pile = 0;
  state.resolution = null;
  state.phase = PHASE.PLAYING;

  const deck = shuffle(buildDeck(), state.rng);
  for (const p of state.players) {
    p.hand = p.alive ? deck.splice(0, HAND_SIZE) : [];
  }

  // Celui qui vient d'appuyer sur la detente ouvre la manche suivante ; a
  // defaut (manche blanche, ou tireur elimine) le rang d'ouverture tourne.
  const opener = pickOpener(state, alive, first);
  state.openerSeat = opener.seat;
  state.turn = opener.seat;
  state.turnDeadline = Date.now() + state.turnMs;

  logLine(state, `Manche ${state.round} — la table demande : ${CARD_LABEL[state.tableCard]}`);
  events.push({
    type: 'newRound',
    round: state.round,
    tableCard: state.tableCard,
    openerId: opener.id,
  });
  events.push({ type: 'turn', playerId: opener.id });
  return events;
}

/** Fin de manche sans confrontation : plus personne n'a de quoi surencherir. */
function endRoundPeacefully(state) {
  state.phase = PHASE.INTERMISSION;
  state.resolution = { kind: 'peace' };
  logLine(state, 'Plus de cartes en jeu — la manche se termine sans un coup de feu.');
  return [{ type: 'roundEnd', reason: 'peace' }];
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function currentPlayer(state) {
  return state.players[state.turn] || null;
}

/** Actions legales pour un joueur donne, telles que l'interface les presente. */
export function legalActions(state, playerId) {
  if (state.phase !== PHASE.PLAYING) return { play: false, challenge: false };
  const player = playerById(state, playerId);
  const current = currentPlayer(state);
  if (!player || !current || current.id !== playerId) return { play: false, challenge: false };
  return {
    play: player.hand.length > 0,
    challenge: !!state.lastPlay && state.lastPlay.playerId !== playerId,
    maxCards: Math.min(MAX_PLAY, player.hand.length),
  };
}

/**
 * Pose de 1 a 3 cartes face cachee, annoncees comme etant la carte de table.
 * @param {number[]} indices index des cartes dans la main du joueur
 */
export function playCards(state, playerId, indices) {
  if (state.phase !== PHASE.PLAYING) return { ok: false, error: 'phase' };
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, error: 'not-your-turn' };

  const unique = [...new Set(indices)].sort((a, b) => a - b);
  if (unique.length < 1 || unique.length > MAX_PLAY) return { ok: false, error: 'count' };
  if (unique.some((i) => !Number.isInteger(i) || i < 0 || i >= player.hand.length)) {
    return { ok: false, error: 'range' };
  }

  const cards = unique.map((i) => player.hand[i]);
  for (let k = unique.length - 1; k >= 0; k--) player.hand.splice(unique[k], 1);

  const honest = cards.every((c) => isValidCard(c, state.tableCard));
  player.stats.plays += 1;
  if (!honest) player.stats.bluffs += 1;

  state.lastPlay = { playerId, cards, count: cards.length, honest };
  state.pile += cards.length;

  logLine(state, `${player.name} pose ${cards.length} × ${CARD_LABEL[state.tableCard]}.`);
  const events = [{
    type: 'play',
    playerId,
    count: cards.length,
    handLeft: player.hand.length,
    tableCard: state.tableCard,
  }];

  // S'il ne reste au plus qu'un joueur muni de cartes, personne ne peut plus
  // surencherir ni accuser : la manche s'arrete sans victime.
  const next = nextSeatWithCards(state, player.seat, { exclude: playerId });
  if (!next) {
    events.push(...endRoundPeacefully(state));
    return { ok: true, events };
  }

  state.turn = next.seat;
  state.turnDeadline = Date.now() + state.turnMs;
  events.push({ type: 'turn', playerId: next.id });
  return { ok: true, events };
}

/** « Menteur ! » — on retourne la derniere pose, et quelqu'un passe a la roulette. */
export function challenge(state, playerId) {
  if (state.phase !== PHASE.PLAYING) return { ok: false, error: 'phase' };
  const accuser = currentPlayer(state);
  if (!accuser || accuser.id !== playerId) return { ok: false, error: 'not-your-turn' };
  if (!state.lastPlay || state.lastPlay.playerId === playerId) {
    return { ok: false, error: 'nothing-to-challenge' };
  }

  const accused = playerById(state, state.lastPlay.playerId);
  const { cards, honest } = state.lastPlay;
  // Celui qui a tort prend la balle : le menteur demasque, ou l'accusateur trop nerveux.
  const loser = honest ? accuser : accused;

  accuser.stats.callsMade += 1;
  accused.stats.callsTaken += 1;
  if (!honest) accuser.stats.callsWon += 1;

  const events = [{
    type: 'challenge',
    accuserId: accuser.id,
    accusedId: accused.id,
    cards,
    tableCard: state.tableCard,
    honest,
    loserId: loser.id,
  }];

  logLine(
    state,
    honest
      ? `${accuser.name} accuse ${accused.name}… mais la pose etait honnete.`
      : `${accuser.name} demasque ${accused.name} !`,
  );

  events.push(...pullTrigger(state, loser));

  state.phase = PHASE.INTERMISSION;
  state.resolution = { kind: 'challenge', loserId: loser.id, honest };
  return { ok: true, events };
}

/** Pression sur la detente : 1 chance sur (chambres restantes) d'y passer. */
function pullTrigger(state, player) {
  const events = [];
  player.stats.triggers += 1;
  const died = player.shotsFired === player.bulletChamber;
  const chambersLeft = CHAMBERS - player.shotsFired;

  if (died) {
    player.alive = false;
    player.hand = [];
    logLine(state, `💥 Le barillet de ${player.name} etait charge. La partie s'arrete la pour lui.`);
    events.push({ type: 'shot', playerId: player.id, died: true, chambersLeft, chamber: player.shotsFired });
  } else {
    player.shotsFired += 1;
    logLine(state, `Clic. ${player.name} respire encore (${CHAMBERS - player.shotsFired} chambres).`);
    events.push({
      type: 'shot',
      playerId: player.id,
      died: false,
      chambersLeft: CHAMBERS - player.shotsFired,
      chamber: player.shotsFired - 1,
    });
  }

  const alive = alivePlayers(state);
  if (alive.length <= 1) {
    state.phase = PHASE.GAME_OVER;
    state.winnerId = alive.length === 1 ? alive[0].id : null;
    events.push({ type: 'gameOver', winnerId: state.winnerId });
  }
  return events;
}

/** Temps ecoule : on joue a la place du joueur plutot que de bloquer la table. */
export function forceTimeout(state) {
  if (state.phase !== PHASE.PLAYING) return { ok: false, events: [] };
  const player = currentPlayer(state);
  if (!player) return { ok: false, events: [] };

  const events = [{ type: 'timeout', playerId: player.id }];
  // On pose la carte la moins compromettante plutot que d'accuser au hasard.
  const best = player.hand.findIndex((c) => isValidCard(c, state.tableCard));
  const index = best >= 0 ? best : 0;
  const res = playCards(state, player.id, [index]);
  return { ok: true, events: events.concat(res.events || []) };
}

/** Deconnexion en ligne : le siege est retire de la table. */
export function eliminate(state, playerId, reason = 'quit') {
  const player = playerById(state, playerId);
  if (!player || !player.alive) return [];
  player.alive = false;
  player.connected = false;
  player.hand = [];
  logLine(state, `${player.name} quitte le saloon.`);
  const events = [{ type: 'left', playerId, reason }];

  const alive = alivePlayers(state);
  if (alive.length <= 1) {
    state.phase = PHASE.GAME_OVER;
    state.winnerId = alive.length === 1 ? alive[0].id : null;
    events.push({ type: 'gameOver', winnerId: state.winnerId });
    return events;
  }

  if (state.phase === PHASE.PLAYING) {
    if (state.lastPlay && state.lastPlay.playerId === playerId) state.lastPlay = null;
    if (currentPlayer(state) && currentPlayer(state).id === playerId) {
      const next = nextSeatWithCards(state, player.seat);
      if (next) {
        state.turn = next.seat;
        state.turnDeadline = Date.now() + state.turnMs;
        events.push({ type: 'turn', playerId: next.id });
      } else {
        state.phase = PHASE.INTERMISSION;
        state.resolution = { kind: 'peace' };
        events.push({ type: 'roundEnd', reason: 'peace' });
      }
    }
  }
  return events;
}

/* ------------------------------------------------------------------ */
/* Vue client                                                          */
/* ------------------------------------------------------------------ */

/**
 * Projette l'etat pour un joueur : sa main lui est visible, celle des autres
 * se resume a un nombre de cartes. Le serveur n'envoie jamais autre chose.
 */
export function viewFor(state, viewerId) {
  return {
    phase: state.phase,
    round: state.round,
    tableCard: state.tableCard,
    turnId: currentPlayer(state) ? currentPlayer(state).id : null,
    turnDeadline: state.turnDeadline,
    turnMs: state.turnMs,
    pile: state.pile,
    winnerId: state.winnerId,
    viewerId,
    lastPlay: state.lastPlay
      ? { playerId: state.lastPlay.playerId, count: state.lastPlay.count }
      : null,
    resolution: state.resolution,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      seat: p.seat,
      isBot: p.isBot,
      profile: p.profile,
      alive: p.alive,
      connected: p.connected,
      handCount: p.hand.length,
      shotsFired: p.shotsFired,
      chambersLeft: CHAMBERS - p.shotsFired,
      odds: survivalOdds(p),
      stats: p.stats,
      hand: p.id === viewerId ? [...p.hand] : null,
    })),
    log: state.log.slice(-8),
  };
}
