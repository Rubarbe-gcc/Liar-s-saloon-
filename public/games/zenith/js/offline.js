/**
 * ZÉNITH — combat hors-ligne.
 *
 * Le moteur tourne dans l'onglet, cadencé par une boucle à intervalle fixe.
 * L'horloge est calée sur le temps réel plutôt que sur le nombre d'appels :
 * si l'onglet passe en arrière-plan, on rattrape les ticks manquants au
 * retour au lieu de laisser le combat dériver.
 */

import {
  createBattle, step, queueAction, viewFor, TICK_MS, PHASE,
} from '../../../shared/zenith/battle.js';
import { createBrain, think, makeOpponent } from '../../../shared/zenith/ai.js';
import * as ui from './ui.js';

let state = null;
let brain = null;
let timer = null;
let lastAt = 0;
let exitTo = () => {};
let onFinish = () => {};

/** Plafond de rattrapage : au-delà, on repart du temps présent. */
const MAX_CATCHUP = 12;

export function start({ team, level, onExit, onDone }) {
  stop();
  exitTo = onExit;
  onFinish = onDone;

  const foe = makeOpponent(Math.random, team);
  state = createBattle([
    { id: 'me', name: 'Vous', team },
    { id: foe.id, name: foe.name, team: foe.team, isBot: true },
  ]);
  brain = createBrain(level);

  ui.resetFight();
  ui.bindActions(act);
  ui.render(viewFor(state, 'me'));
  ui.announce('COMBAT !', '#ffd84d');

  lastAt = performance.now();
  timer = setInterval(loop, TICK_MS);
}

export function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  state = null;
}

export function isRunning() { return !!state; }

function act(action) {
  if (!state || state.phase !== PHASE.FIGHT) return;
  const res = queueAction(state, 0, action);
  if (!res.ok && res.error === 'ki') ui.toast('Pas assez de ki.');
  else if (!res.ok && res.error === 'recharge') ui.toast('Changement en recharge.');
}

function loop() {
  if (!state) return;
  const now = performance.now();
  let due = Math.floor((now - lastAt) / TICK_MS);
  if (due <= 0) return;
  if (due > MAX_CATCHUP) due = 1;      // l'onglet revient d'arrière-plan
  lastAt += due * TICK_MS;

  for (let i = 0; i < due && state.phase === PHASE.FIGHT; i++) {
    think(state, 1, brain);
    const effects = step(state);
    const view = viewFor(state, 'me');
    if (effects.length) ui.playEffects(effects, view);
  }

  const view = viewFor(state, 'me');
  ui.render(view);

  if (state.phase === PHASE.OVER) {
    const final = view;
    stop();
    setTimeout(() => finish(final), 1200);
  }
}

function finish(view) {
  ui.showEnd(view, {
    onMenu: () => { ui.hideEnd(); exitTo(); },
    onAgain: () => { ui.hideEnd(); onFinish(); },
  });
}
