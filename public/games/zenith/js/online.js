/**
 * ZÉNITH — client des combats en ligne.
 *
 * Le serveur arbitre et diffuse l'état à chaque tick. Le client se contente
 * d'afficher ce qu'il reçoit et d'envoyer des intentions : il ne simule rien
 * localement, ce qui évite toute divergence entre les deux écrans.
 */

import * as ui from './ui.js';
import * as reprise from '../../../shared/reprise.js';

const JEU = 'zenith';
/** En plein combat : une coupure doit pouvoir se rattraper. */
let enJeu = false;
/** On revient d'un combat interrompu : le serveur dira s'il l'a gardé. */
let attendReprise = false;

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
  if (!want && !room) attendReprise = reprise.adopter(JEU);
  want = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  on.status('connecting');
  try { ws = new WebSocket(endpoint()); } catch { return retry(); }

  ws.addEventListener('open', () => {
    delay = 800; fails = 0;
    on.status('online');
    // La clé de session d'abord : si une place nous attend, le serveur nous la rend.
    send({ t: 'session', sid: reprise.session(JEU) });
    send({ t: 'hello', name });
    clearInterval(beat);
    beat = setInterval(() => { send({ t: 'ping' }); if (enJeu) reprise.enPartie(JEU, { code: room?.code }); }, 20000);
  });

  ws.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    handle(m);
  });

  ws.addEventListener('close', () => {
    clearInterval(beat);
    ws = null;
    if (!want) return;
    if (enJeu) { reprise.interrompue(JEU); ui.toast('Connexion perdue — votre place vous attend, on se reconnecte…', 3200); }
    fails += 1;
    on.status(fails >= GIVE_UP_AFTER ? 'unreachable' : 'offline');
    retry();
  });

  ws.addEventListener('error', () => { /* le close suivant gère la suite */ });
}

export function disconnect() {
  want = false; fails = 0;
  enJeu = false;
  reprise.oublier(JEU);
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
    case 'session':
      if (m.repris) { attendReprise = false; ui.toast('✅ Vous revoilà dans l’arène.', 2400); return; }
      if (attendReprise) {
        attendReprise = false;
        reprise.oublier(JEU);
        ui.toast('Ce combat n’existe plus : il est fini, ou l’attente a dépassé 5 minutes.', 3600);
      }
      if (enJeu) {
        enJeu = false;
        reprise.oublier(JEU);
        room = null;
        on.left();
        ui.toast('Le combat s’est terminé sans vous.', 3200);
      } else if (room) {
        // Au vestiaire, une coupure libère la place : on la reprend.
        send({ t: 'join', code: room.code, name });
      }
      return;
    case 'z:notice': ui.toast(m.msg, 3200); return;
    case 'z:welcome': myId = m.id; return;
    case 'z:hello': name = m.name; return;
    case 'z:room': room = m; return on.room(m);
    case 'z:begin':
      enJeu = true;
      reprise.enPartie(JEU, { code: room?.code });
      ui.resetFight(); ui.bindCommands(envoyer); return on.begin();

    case 'z:tick': {
      if (m.view && m.view.phase === 'over') { enJeu = false; reprise.oublier(JEU); }
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
      enJeu = false;
      reprise.oublier(JEU);
      ui.toast('Votre adversaire a quitté l\'arène.', 2600);
      return on.over(m.view);

    case 'z:reject':
      if (m.reason === 'ki') ui.toast('Pas assez de ki.');
      else if (m.reason === 'recharge') ui.toast('Changement en recharge.');
      return;

    case 'z:left': room = null; enJeu = false; reprise.oublier(JEU); return on.left();
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
export function leaveRoom() { send({ t: 'leave' }); room = null; enJeu = false; reprise.oublier(JEU); }

function envoyer(cmd) { send({ t: 'act', action: cmd }); }

reprise.surveiller(JEU);
