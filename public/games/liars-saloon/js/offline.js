/**
 * Partie hors-ligne : le moteur tourne dans l'onglet, face a des bots.
 *
 * Le controleur se contente d'enchainer « qui doit jouer ? », de laisser le
 * moteur trancher et de confier les evenements produits a l'interface.
 */

import {
  createGame, startRound, playCards, challenge, forceTimeout,
  viewFor, currentPlayer, PHASE,
} from '../../../shared/engine.js';
import { decide, thinkDelay, makeBots, DIFFICULTIES } from '../../../shared/ai.js';
import * as ui from './ui.js';

let state = null;
let meId = null;
let difficulty = 'normal';
let running = false;
let watchdog = null;
let exitTo = () => {};

/**
 * @param {{name:string, avatar:string}} me
 * @param {number} bots
 * @param {string} level  clef de DIFFICULTIES
 * @param {Function} onExit  retour au menu
 */
export async function start({ me, bots, level, onExit }) {
  stop();
  exitTo = onExit;
  difficulty = DIFFICULTIES[level] ? level : 'normal';
  meId = 'me';

  const seats = [
    { id: meId, name: me.name || 'L\'Étranger', avatar: me.avatar || '🤠' },
    ...makeBots(bots),
  ];
  // On melange les sieges pour que le joueur n'ouvre pas systematiquement.
  shuffle(seats);

  state = createGame(seats, { turnMs: 30000 });
  running = true;

  ui.resetTable();
  ui.bindActions(onPlayerAction);
  ui.render(view());

  await ui.banner('Liar\'s Saloon', 'Table privée', `${seats.length} joueurs à la table`, 1300);
  await advance();
}

export function stop() {
  running = false;
  state = null;
  clearWatchdog();
}

const view = () => viewFor(state, meId);

/* ------------------------------------------------------------------ */
/* Boucle de jeu                                                       */
/* ------------------------------------------------------------------ */

/** Fait avancer la partie jusqu'a ce qu'une decision humaine soit requise. */
async function advance() {
  if (!running || !state) return;

  if (state.phase === PHASE.GAME_OVER) {
    clearWatchdog();
    ui.render(view());
    await ui.sleep(500);
    return finish();
  }

  if (state.phase === PHASE.INTERMISSION) {
    await ui.sleep(700);
    if (!running) return;
    const events = startRound(state);
    await ui.playEvents(events, view());
    return advance();
  }

  const cur = currentPlayer(state);
  if (!cur) return;

  if (cur.isBot) {
    clearWatchdog();
    ui.render(view());
    await ui.sleep(thinkDelay(difficulty));
    if (!running || currentPlayer(state) !== cur) return;

    const move = decide(state, cur.id, difficulty);
    const res = move.type === 'challenge'
      ? challenge(state, cur.id)
      : playCards(state, cur.id, move.indices);

    // Un coup invalide ne doit jamais bloquer la table : on repose une carte.
    const events = res.ok ? res.events : (playCards(state, cur.id, [0]).events || []);
    await ui.playEvents(events, view());
    return advance();
  }

  // C'est a nous : on rend la main et on arme le chronometre.
  state.turnDeadline = Date.now() + state.turnMs;
  ui.render(view());
  armWatchdog();
}

/** Coup joue par l'utilisateur. */
async function onPlayerAction(action) {
  if (!running || !state || state.phase !== PHASE.PLAYING) return;
  const cur = currentPlayer(state);
  if (!cur || cur.id !== meId) return;

  clearWatchdog();
  const res = action.type === 'challenge'
    ? challenge(state, meId)
    : playCards(state, meId, action.indices);

  if (!res.ok) {
    ui.flashToast(res.error === 'nothing-to-challenge'
      ? 'Rien à contester pour l\'instant.'
      : 'Coup impossible.');
    ui.render(view());
    return;
  }

  await ui.playEvents(res.events, view());
  await advance();
}

/** Temps ecoule cote joueur : le moteur pose a sa place. */
function armWatchdog() {
  clearWatchdog();
  const fire = async () => {
    if (!running || !state || state.phase !== PHASE.PLAYING) return;
    const cur = currentPlayer(state);
    if (!cur || cur.id !== meId) return;
    const res = forceTimeout(state);
    ui.clearSelection();
    await ui.playEvents(res.events, view());
    await advance();
  };
  watchdog = setTimeout(fire, Math.max(0, state.turnDeadline - Date.now()) + 120);
}

function clearWatchdog() {
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
}

function finish() {
  const v = view();
  ui.showEnd(v, {
    onMenu: () => { ui.hideEnd(); stop(); exitTo(); },
    onAgain: () => { ui.hideEnd(); document.dispatchEvent(new CustomEvent('saloon:replay-offline')); },
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // Les sieges doivent rester numerotes dans l'ordre du tableau.
  arr.forEach((s, i) => { s.seat = i; });
  return arr;
}
