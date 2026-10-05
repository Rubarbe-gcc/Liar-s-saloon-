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
import { creerConnexion } from '../../../shared/connexion.js';

const JEU = 'saloon';

let myId = null;
let room = null;           // dernier etat de salon recu
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
export function isConnected() { return net.ouverte(); }

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */

/** La connexion : reconnexion, réveil, clé de session — voir shared/connexion.js. */
const net = creerConnexion({
  jeu: JEU,
  g: JEU,
  ouverte: () => send({ t: 'hello', name: identity.name, avatar: identity.avatar }),
  message: (m) => handle(m),
  enPartie: () => enJeu,
  code: () => room?.code,
  statut: (s) => {
    if ((s === 'perdu' || s === 'injoignable') && enJeu) ui.flashToast('Connexion perdue — on se reconnecte, votre place vous attend…', 3200);
    listeners.status({ connexion: 'connecting', connecte: 'online', perdu: 'offline', injoignable: 'unreachable' }[s]);
  },
});

export function connect(who) {
  if (who) identity = { ...identity, ...who };
  if (!net.voulue() && !room) attendReprise = reprise.adopter(JEU);
  net.ouvrir();
}

export function disconnect() {
  enJeu = false;
  reprise.oublier(JEU);
  net.fermer();
  room = null;
  queue.length = 0;
}

const send = (obj) => net.envoyer(obj);

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
