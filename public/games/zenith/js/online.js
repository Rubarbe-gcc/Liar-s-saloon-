/**
 * ZÉNITH — client des combats en ligne.
 *
 * Le serveur arbitre et diffuse l'état à chaque tick. Le client se contente
 * d'afficher ce qu'il reçoit et d'envoyer des intentions : il ne simule rien
 * localement, ce qui évite toute divergence entre les deux écrans.
 */

import * as ui from './ui.js';

const RECONNECT_MAX = 15000;
const GIVE_UP_AFTER = 4;

let ws = null, myId = null, room = null;
let want = false, delay = 800, timer = null, beat = null, fails = 0;
let name = 'Challenger';

const on = {
  status: () => {}, room: () => {}, begin: () => {},
  left: () => {}, error: () => {}, over: () => {},
};
export function listen(evt, fn) { on[evt] = fn; }
export const me = () => myId;
export const currentRoom = () => room;

function endpoint() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/ws`;
}

export function connect(who) {
  if (who && who.name) name = who.name;
  want = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  on.status('connecting');
  try { ws = new WebSocket(endpoint()); } catch { return retry(); }

  ws.addEventListener('open', () => {
    delay = 800; fails = 0;
    on.status('online');
    send({ t: 'hello', name });
    clearInterval(beat);
    beat = setInterval(() => send({ t: 'ping' }), 25000);
  });

  ws.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    handle(m);
  });

  ws.addEventListener('close', () => {
    clearInterval(beat);
    ws = null;
    if (!want) return;
    fails += 1;
    on.status(fails >= GIVE_UP_AFTER ? 'unreachable' : 'offline');
    retry();
  });

  ws.addEventListener('error', () => { /* le close suivant gère la suite */ });
}

export function disconnect() {
  want = false; fails = 0;
  clearTimeout(timer); clearInterval(beat);
  if (ws) { try { ws.close(); } catch { /* déjà fermée */ } }
  ws = null; room = null;
}

function retry() {
  clearTimeout(timer);
  if (!want) return;
  timer = setTimeout(() => { delay = Math.min(delay * 1.7, RECONNECT_MAX); connect(); }, delay);
}

/** Tout message porte `g` : le serveur route vers le bon jeu. */
function send(obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try { ws.send(JSON.stringify({ g: 'zenith', ...obj })); return true; }
  catch { return false; }
}

function handle(m) {
  switch (m.t) {
    case 'z:welcome': myId = m.id; return;
    case 'z:hello': name = m.name; return;
    case 'z:room': room = m; return on.room(m);
    case 'z:begin': ui.resetFight(); ui.bindCommands(envoyer); return on.begin();

    case 'z:tick': {
      // Le serveur envoie l'état après chaque choix, et les effets du tour
      // lorsqu'il vient de se résoudre.
      if (m.effects && m.effects.length) {
        ui.playEffects(m.effects, m.view).then(() => {
          if (m.view.phase === 'over') on.over(m.view);
        });
      } else {
        ui.render(m.view);
        if (m.view.phase === 'over') on.over(m.view);
      }
      return;
    }

    case 'z:forfeit':
      ui.toast('Votre adversaire a quitté l\'arène.', 2600);
      return on.over(m.view);

    case 'z:reject':
      if (m.reason === 'ki') ui.toast('Pas assez de ki.');
      else if (m.reason === 'recharge') ui.toast('Changement en recharge.');
      return;

    case 'z:left': room = null; return on.left();
    case 'z:error': return on.error(m.msg || 'Erreur inconnue.');
    default: return;
  }
}

/* Intentions */
export function createRoom(who) { if (who && who.name) name = who.name; send({ t: 'create', name }); }
export function joinRoom(code, who) { if (who && who.name) name = who.name; send({ t: 'join', code, name }); }
export function setTeam(team) { send({ t: 'team', team }); }
export function startMatch() { send({ t: 'start' }); }
export function backToLobby() { send({ t: 'lobby' }); }
export function leaveRoom() { send({ t: 'leave' }); room = null; }

function envoyer(cmd) { send({ t: 'act', action: cmd }); }
