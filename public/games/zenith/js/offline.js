/**
 * ZÉNITH — combat hors-ligne, au tour par tour.
 *
 * Le moteur tourne dans l'onglet. Le joueur choisit sa commande, l'ordinateur
 * choisit la sienne sans la voir, puis le tour se résout.
 */

import {
  createBattle, choose, resolveTurn, viewFor, PHASE, pretARésoudre,
} from '../../../shared/zenith/battle.js';
import { createBrain, think, makeOpponent } from '../../../shared/zenith/ai.js';
import * as ui from './ui.js';

let state = null;
let brain = null;
let exitTo = () => {};
let onFinish = () => {};
let occupe = false;

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
  ui.bindCommands(commande);
  ui.render(viewFor(state, 'me'));
  ui.annonce('COMBAT !', '#ffd84d');
}

export function stop() { state = null; occupe = false; }
export function isRunning() { return !!state; }

/** Commande envoyée par le joueur. */
async function commande(cmd) {
  if (!state || occupe || state.phase !== PHASE.CHOOSE) return;

  const res = choose(state, 0, cmd);
  if (!res.ok) {
    ui.toast(res.error === 'ki' ? 'Pas assez de ki.'
      : res.error === 'déjà utilisée' ? 'Ultime déjà employée.'
      : 'Commande impossible.');
    return;
  }

  occupe = true;
  ui.render(viewFor(state, 'me'));

  // L'ordinateur choisit sans avoir vu notre commande : le moteur ne la lui
  // expose pas, et nous lui laissons un court temps de réflexion.
  await ui.sleep(340);
  think(state, 1, brain);

  if (!pretARésoudre(state)) { occupe = false; return; }

  const { effects } = resolveTurn(state);
  await ui.playEffects(effects, viewFor(state, 'me'));
  occupe = false;

  if (state.phase === PHASE.OVER) {
    const finale = viewFor(state, 'me');
    await ui.sleep(700);
    stop();
    ui.showEnd(finale, {
      onMenu: () => { ui.hideEnd(); exitTo(); },
      onAgain: () => { ui.hideEnd(); onFinish(); },
    });
  }
}
