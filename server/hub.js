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
 *
 * LES SESSIONS. Une connexion ne tient pas toute une partie : un téléphone
 * qui se met en veille, un tunnel, l'hébergement qui coupe au bout de
 * quelques minutes. Les jeux ne voient donc jamais la connexion réelle, mais
 * une « place » qui la porte, et dont l'identifiant ne change pas. Le client
 * se présente avec une clé de session (`{ t: 'session', sid }`) ; si sa
 * connexion tombe en pleine partie, la place l'attend `GRACE_MS`. Une
 * nouvelle connexion qui présente la même clé reprend la place, et le jeu lui
 * renvoie tout l'état (`handleResume`). Passé le délai, ou si la partie est
 * finie, la place est rendue comme avant (`handleClose`).
 *
 * Un jeu peut fournir, en plus de handleOpen / handleMessage / handleClose :
 *   enPartie(conn)      vrai si la place vaut la peine d'être gardée ;
 *   handleAway(conn)    la connexion vient de tomber (prévenir la table…) ;
 *   handleResume(conn)  le joueur est revenu : lui renvoyer tout l'état.
 * Sans `handleResume`, le jeu gère ses absences lui-même (BRASIER).
 */

import * as saloon from './saloon.js';
import * as zenith from './zenith.js';
import * as echo from './mimic.js';
import * as brasier from './brasier.js';
import * as skullking from './skullking.js';

const GAMES = { saloon, zenith, echo, brasier, skullking };
const DEFAULT_GAME = 'saloon';

/** Temps pendant lequel une place attend son joueur après une coupure. */
export const GRACE_MS = 5 * 60 * 1000;
let grace = GRACE_MS;
/** Pour les tests : raccourcit l'attente. */
export function reglerGrace(ms) { grace = ms; }

const sidValide = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(s);

/** Jeu auquel chaque place est rattachée (par identifiant de place). */
const bound = new Map();
/** La place portée par chaque connexion réelle. */
const parConnexion = new Map();
/** La place de chaque session. */
const parSession = new Map();

/** Une place : ce que les jeux appellent « conn ». */
function nouvellePlace(reelle) {
  const place = {
    id: reelle.id,
    reelle,
    sid: null,
    minuteur: null,
    send(obj) { return place.reelle ? place.reelle.send(obj) : false; },
    close() { if (place.reelle) place.reelle.close(); },
  };
  return place;
}

function attach(place, key) {
  bound.set(place.id, key);
  GAMES[key].handleOpen(place);
}

/** La place est rendue pour de bon. */
function liberer(place) {
  clearTimeout(place.minuteur);
  place.minuteur = null;
  const key = bound.get(place.id);
  bound.delete(place.id);
  if (place.sid && parSession.get(place.sid) === place) parSession.delete(place.sid);
  if (!key) return;
  try { GAMES[key].handleClose(place); }
  catch (err) { console.error('[hub] close', err); }
}

export function handleOpen(conn) {
  const place = nouvellePlace(conn);
  parConnexion.set(conn.id, place);
  attach(place, DEFAULT_GAME);
}

/**
 * La clé de session. Si elle désigne une place qui attend (ou que tient
 * encore une vieille connexion pas encore tombée), cette connexion la reprend.
 */
function session(place, msg) {
  const key = bound.get(place.id);
  const sid = sidValide(msg.sid) ? msg.sid : null;
  if (!sid || !key) return;
  const ancienne = parSession.get(sid);
  const jeu = GAMES[key];

  if (ancienne && ancienne !== place && bound.get(ancienne.id) === key && jeu.handleResume) {
    // La place éphémère ouverte par cette connexion n'a plus lieu d'être.
    bound.delete(place.id);
    try { jeu.handleClose(place); } catch (err) { console.error('[hub] reprise', err); }
    // L'ancienne connexion, si elle traîne encore, est congédiée sans bruit.
    const vieille = ancienne.reelle;
    if (vieille && vieille !== place.reelle) {
      parConnexion.delete(vieille.id);
      vieille.remplacee = true;
      try { vieille.close(); } catch { /* déjà fermée */ }
    }
    clearTimeout(ancienne.minuteur);
    ancienne.minuteur = null;
    ancienne.reelle = place.reelle;
    parConnexion.set(place.reelle.id, ancienne);
    ancienne.send({ t: 'session', g: key, repris: true });
    try { jeu.handleResume(ancienne); } catch (err) { console.error('[hub] reprise', err); }
    return;
  }

  place.sid = sid;
  parSession.set(sid, place);
  place.send({ t: 'session', g: key, repris: false });
}

export function handleMessage(conn, msg) {
  let place = parConnexion.get(conn.id);
  if (!place) { handleOpen(conn); place = parConnexion.get(conn.id); }
  let key = bound.get(place.id);
  if (!key) { attach(place, DEFAULT_GAME); key = DEFAULT_GAME; }

  // Bascule éventuelle vers un autre jeu, au vu du premier message qui
  // l'annonce. Le rattachement précédent est refermé pour ne pas laisser
  // de client fantôme dans son registre.
  const asked = msg && typeof msg.g === 'string' && GAMES[msg.g] ? msg.g : null;
  if (asked && asked !== key) {
    try { GAMES[key].handleClose(place); }
    catch (err) { console.error('[hub] bascule', err); }
    attach(place, asked);
    key = asked;
  }

  if (msg && msg.t === 'session') return session(place, msg);

  try { GAMES[key].handleMessage(place, msg); }
  catch (err) { console.error('[hub] message', err); }
}

export function handleClose(conn) {
  if (conn.remplacee) return;            // une connexion plus récente a pris le relais
  const place = parConnexion.get(conn.id);
  parConnexion.delete(conn.id);
  if (!place || place.reelle !== conn) return;
  place.reelle = null;
  const key = bound.get(place.id);
  const jeu = key && GAMES[key];
  let garder = false;
  try { garder = !!(place.sid && jeu && jeu.handleResume && jeu.enPartie && jeu.enPartie(place)); }
  catch (err) { console.error('[hub] enPartie', err); }
  if (!garder) return liberer(place);
  // Une coupure en pleine partie n'est pas un départ : la place attend.
  try { if (jeu.handleAway) jeu.handleAway(place); } catch (err) { console.error('[hub] away', err); }
  place.minuteur = setTimeout(() => liberer(place), grace);
  if (typeof place.minuteur.unref === 'function') place.minuteur.unref();
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
  out.enAttente = [...parSession.values()].filter((p) => !p.reelle).length;
  return out;
}
