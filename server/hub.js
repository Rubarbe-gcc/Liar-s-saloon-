/**
 * Routeur des parties en ligne.
 *
 * Le site héberge plusieurs jeux derrière un unique point WebSocket. Chaque
 * message porte le champ `g` nommant son jeu.
 *
 * Subtilité importante : la connexion est rattachée au jeu par défaut dès son
 * ouverture, sans attendre le premier message. Le client de Liar's Saloon,
 * antérieur à ce routeur, n'envoie pas de champ `g` et attend son message de
 * bienvenue immédiatement — différer l'ouverture le laisserait attendre
 * indéfiniment. Si le premier message annonce un autre jeu, on referme
 * proprement le rattachement initial avant de basculer.
 */

import * as saloon from './saloon.js';
import * as zenith from './zenith.js';
import * as echo from './mimic.js';

const GAMES = { saloon, zenith, echo };
const DEFAULT_GAME = 'saloon';

/** Jeu auquel chaque connexion est rattachée. */
const bound = new Map();

function attach(conn, key) {
  bound.set(conn.id, key);
  GAMES[key].handleOpen(conn);
}

export function handleOpen(conn) {
  attach(conn, DEFAULT_GAME);
}

export function handleMessage(conn, msg) {
  let key = bound.get(conn.id);
  if (!key) { attach(conn, DEFAULT_GAME); key = DEFAULT_GAME; }

  // Bascule éventuelle vers un autre jeu, au vu du premier message qui
  // l'annonce. Le rattachement précédent est refermé pour ne pas laisser
  // de client fantôme dans son registre.
  const asked = msg && typeof msg.g === 'string' && GAMES[msg.g] ? msg.g : null;
  if (asked && asked !== key) {
    try { GAMES[key].handleClose(conn); }
    catch (err) { console.error('[hub] bascule', err); }
    attach(conn, asked);
    key = asked;
  }

  try { GAMES[key].handleMessage(conn, msg); }
  catch (err) { console.error('[hub] message', err); }
}

export function handleClose(conn) {
  const key = bound.get(conn.id);
  bound.delete(conn.id);
  if (!key) return;
  try { GAMES[key].handleClose(conn); }
  catch (err) { console.error('[hub] close', err); }
}

export function sweep() {
  for (const [key, game] of Object.entries(GAMES)) {
    try { game.sweep(); }
    catch (err) { console.error(`[hub] sweep ${key}`, err); }
  }
}

export function stats() {
  // Construit depuis la table des jeux : ajouter un jeu ne doit pas demander
  // de penser à modifier cette ligne-ci.
  const out = {};
  for (const [key, game] of Object.entries(GAMES)) {
    try { Object.assign(out, game.stats()); }
    catch (err) { console.error(`[hub] stats ${key}`, err); }
  }
  return out;
}
