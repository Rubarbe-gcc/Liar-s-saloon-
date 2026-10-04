/**
 * Client des parties en ligne.
 *
 * Le serveur est l'autorite : on ne lui envoie que des intentions, et on
 * affiche ce qu'il renvoie. Les mises a jour sont mises en file d'attente,
 * car une animation en cours ne doit jamais etre coupee par la suivante.
 */

import * as ui from './ui.js';
import { sfx } from './sfx.js';
import * as reprise from '../../../shared/reprise.js';

const JEU = 'saloon';

const RECONNECT_MAX = 15000;
/** Au-dela, on cesse de rassurer l'utilisateur et on lui dit quoi faire. */
const ATTEMPTS_BEFORE_GIVING_UP = 4;

let ws = null;
let myId = null;
let room = null;           // dernier etat de salon recu
let wantConnection = false;
let reconnectDelay = 800;
let reconnectTimer = null;
let failedAttempts = 0;
let heartbeat = null;
let identity = { name: '', avatar: '🤠' };
/** En pleine partie : une coupure doit pouvoir se rattraper. */
let enJeu = false;
/** On revient d'une partie interrompue : le serveur dira s'il l'a gardée. */
let attendReprise = false;

// File des mises a jour, drainee une par une.
const queue = [];
let pumping = false;

const listeners = {
  status: () => {},   // (state, detail)
  room: () => {},     // (roomPayload)
  begin: () => {},
  left: () => {},
  error: () => {},
};

export function on(evt, fn) { listeners[evt] = fn; }
export function me() { return myId; }
export function currentRoom() { return room; }
export function isConnected() { return !!ws && ws.readyState === WebSocket.OPEN; }

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */

function endpoint() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/ws`;
}

export function connect(who) {
  if (who) identity = { ...identity, ...who };
  if (!wantConnection && !room) attendReprise = reprise.adopter(JEU);
  wantConnection = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  listeners.status('connecting');
  try { ws = new WebSocket(endpoint()); }
  catch { return scheduleReconnect(); }

  ws.addEventListener('open', () => {
    reconnectDelay = 800;
    failedAttempts = 0;
    listeners.status('online');
    // La clé de session d'abord : si une place nous attend, le serveur nous la rend.
    send({ t: 'session', g: JEU, sid: reprise.session(JEU) });
    send({ t: 'hello', name: identity.name, avatar: identity.avatar });
    clearInterval(heartbeat);
    // Garde la connexion vivante a travers les proxys qui coupent les
    // sockets inactifs.
    heartbeat = setInterval(() => { send({ t: 'ping' }); if (enJeu) reprise.enPartie(JEU, { code: room?.code }); }, 20000);
  });

  ws.addEventListener('message', (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handle(msg);
  });

  ws.addEventListener('close', () => {
    clearInterval(heartbeat);
    ws = null;
    if (!wantConnection) return;
    if (enJeu) { reprise.interrompue(JEU); ui.flashToast('Connexion perdue — votre place vous attend, on se reconnecte…', 3200); }
    failedAttempts += 1;
    listeners.status(failedAttempts >= ATTEMPTS_BEFORE_GIVING_UP ? 'unreachable' : 'offline');
    scheduleReconnect();
  });

  ws.addEventListener('error', () => { /* le close qui suit gere la suite */ });
}

export function disconnect() {
  wantConnection = false;
  enJeu = false;
  reprise.oublier(JEU);
  failedAttempts = 0;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeat);
  if (ws) { try { ws.close(); } catch { /* deja ferme */ } }
  ws = null;
  room = null;
  queue.length = 0;
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  if (!wantConnection) return;
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.7, RECONNECT_MAX);
    connect();
  }, reconnectDelay);
}

function send(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try { ws.send(JSON.stringify(obj)); return true; }
  catch { return false; }
}

/* ------------------------------------------------------------------ */
/* Messages serveur                                                    */
/* ------------------------------------------------------------------ */

function handle(msg) {
  switch (msg.t) {
    case 'session':
      if (msg.repris) {
        attendReprise = false;
        ui.flashToast('✅ Vous revoilà à la table.', 2400);
        return;
      }
      if (attendReprise) {
        attendReprise = false;
        reprise.oublier(JEU);
        ui.flashToast('Cette partie n’existe plus : elle est finie, ou l’attente a dépassé 5 minutes.', 3600);
      }
      if (enJeu) {
        // La place n'a pas été gardée : retour au salon.
        enJeu = false;
        reprise.oublier(JEU);
        room = null;
        queue.length = 0;
        listeners.left();
        ui.flashToast('La partie a continué sans vous.', 3200);
      } else if (room) {
        // Au salon, une coupure libère la chaise : on la reprend.
        send({ t: 'join', code: room.code, name: identity.name, avatar: identity.avatar });
      }
      return;

    case 'notice':
      ui.flashToast(msg.msg, 3200);
      return;

    case 'welcome':
      myId = msg.id;
      return;

    case 'hello':
      identity = { name: msg.name, avatar: msg.avatar };
      return;

    case 'room': {
      const had = room ? room.players.length : 0;
      room = msg;
      if (had && msg.players.length > had) sfx.join();
      if (had && msg.players.length < had) sfx.leave();
      return listeners.room(msg);
    }

    case 'begin':
      enJeu = true;
      reprise.enPartie(JEU, { code: room?.code });
      ui.resetTable();
      ui.bindActions(sendAction);
      return listeners.begin();

    case 'state':
      if (msg.view && msg.view.phase === 'gameOver') { enJeu = false; reprise.oublier(JEU); }
      queue.push(msg);
      return pump();

    case 'reject':
      ui.flashToast(msg.reason === 'not-your-turn'
        ? 'Ce n\'est pas votre tour.'
        : 'Coup refusé par la table.');
      return;

    case 'left':
      room = null;
      enJeu = false;
      reprise.oublier(JEU);
      return listeners.left();

    case 'error':
      return listeners.error(msg.msg || 'Erreur inconnue.');

    case 'pong':
    default:
      return;
  }
}

/** Joue les mises a jour l'une apres l'autre, sans chevauchement. */
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length) {
      const { view, events } = queue.shift();
      await ui.playEvents(events || [], view);
      if (view.phase === 'gameOver') {
        // Laisse respirer avant la carte de fin.
        await ui.sleep(500);
        listeners.status('ended', view);
        break;
      }
    }
  } finally {
    pumping = false;
  }
}

/* ------------------------------------------------------------------ */
/* Intentions                                                          */
/* ------------------------------------------------------------------ */

export function setIdentity(who) {
  identity = { ...identity, ...who };
  send({ t: 'hello', name: identity.name, avatar: identity.avatar });
}

export function createRoom(who) {
  if (who) identity = { ...identity, ...who };
  send({ t: 'create', name: identity.name, avatar: identity.avatar });
}

export function joinRoom(code, who) {
  if (who) identity = { ...identity, ...who };
  send({ t: 'join', code, name: identity.name, avatar: identity.avatar });
}

export function leaveRoom() { send({ t: 'leave' }); room = null; queue.length = 0; enJeu = false; reprise.oublier(JEU); }
export function startMatch() { send({ t: 'start' }); }
export function setOptions(o) { send({ t: 'options', ...o }); }
export function backToLobby() { queue.length = 0; send({ t: 'back-to-lobby' }); }

function sendAction(action) {
  if (action.type === 'challenge') send({ t: 'challenge' });
  else send({ t: 'play', indices: action.indices });
}

reprise.surveiller(JEU);
