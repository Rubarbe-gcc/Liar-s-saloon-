/**
 * ZÉNITH — client des combats en ligne.
 *
 * Le serveur arbitre et diffuse l'état à chaque tick. Le client se contente
 * d'afficher ce qu'il reçoit et d'envoyer des intentions : il ne simule rien
 * localement, ce qui évite toute divergence entre les deux écrans.
 */

import * as ui from './ui.js';
import * as reprise from '../../../shared/reprise.js';
import { creerConnexion } from '../../../shared/connexion.js';

const JEU = 'zenith';
/** En plein combat : une coupure doit pouvoir se rattraper. */
let enJeu = false;
/** On revient d'un combat interrompu : le serveur dira s'il l'a gardé. */
let attendReprise = false;


let myId = null, room = null;
let name = 'Challenger';

const on = {
  status: () => {}, room: () => {}, begin: () => {},
  left: () => {}, error: () => {}, over: () => {},
};
export function listen(evt, fn) { on[evt] = fn; }
export const me = () => myId;
export const currentRoom = () => room;

/** La connexion : reconnexion, réveil, clé de session — voir shared/connexion.js. */
const net = creerConnexion({
  jeu: JEU,
  g: 'zenith',
  ouverte: () => send({ t: 'hello', name }),
  message: (m) => handle(m),
  enPartie: () => enJeu,
  code: () => room?.code,
  statut: (s) => {
    if ((s === 'perdu' || s === 'injoignable') && enJeu) ui.toast('Connexion perdue — on se reconnecte, votre place vous attend…', 3200);
    on.status({ connexion: 'connecting', connecte: 'online', perdu: 'offline', injoignable: 'unreachable' }[s]);
  },
});

export function connect(who) {
  if (who && who.name) name = who.name;
  if (!net.voulue() && !room) attendReprise = reprise.adopter(JEU);
  net.ouvrir();
}

export function disconnect() {
  enJeu = false;
  reprise.oublier(JEU);
  net.fermer();
  room = null;
}

/** Tout message porte `g` : le serveur route vers le bon jeu. */
const send = (obj) => net.envoyer(obj);

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
