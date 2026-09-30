/**
 * BRASIER — liaison avec la forge.
 *
 * Le serveur mène la partie de bout en bout. Ce module ne fait que tenir la
 * connexion, relayer ce qui arrive, et envoyer des intentions : le client ne
 * simule rien, il n'y a donc rien qui puisse diverger d'un écran à l'autre.
 */

const RECONNEXION_MAX = 15000;
const ABANDON_APRES = 4;

let ws = null;
let monId = null;
let nom = 'Forgeron';
let voulu = false;
let delai = 800;
let echecs = 0;
let minuteur = null;
let battement = null;

const on = {
  statut: () => {}, salon: () => {}, debut: () => {}, etat: () => {},
  refus: () => {}, erreur: () => {}, parti: () => {}, hello: () => {},
};

/**
 * Le jeton : l'identité de ce joueur pour le serveur, d'une connexion à la
 * suivante. L'hébergement coupe les connexions au bout de quelques minutes ;
 * sans jeton, chaque reconnexion faisait de vous un inconnu, et la table vous
 * remplaçait par un bot. Il vit le temps de l'onglet : deux onglets, deux
 * joueurs — et recharger la page rend sa place.
 */
function jeton() {
  const neuf = () => (crypto.randomUUID ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
  try {
    let j = sessionStorage.getItem('brasier.jeton');
    if (!j) { j = neuf(); sessionStorage.setItem('brasier.jeton', j); }
    return j;
  } catch {
    return (jeton.memoire = jeton.memoire || neuf());
  }
}
export function ecouter(evt, fn) { on[evt] = fn; }
export const moi = () => monId;

const adresse = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;

export function connecter(qui) {
  if (qui && qui.name) nom = qui.name;
  voulu = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  on.statut('connexion');
  try { ws = new WebSocket(adresse()); } catch { return relancer(); }

  ws.addEventListener('open', () => {
    delai = 800; echecs = 0;
    on.statut('connecte');
    envoyer({ t: 'hello', name: nom, jeton: jeton() });
    clearInterval(battement);
    battement = setInterval(() => envoyer({ t: 'ping' }), 25000);
  });
  ws.addEventListener('message', (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    traiter(m);
  });
  ws.addEventListener('close', () => {
    clearInterval(battement);
    ws = null;
    if (!voulu) return;
    echecs += 1;
    on.statut(echecs >= ABANDON_APRES ? 'injoignable' : 'perdu');
    relancer();
  });
  ws.addEventListener('error', () => { /* le close suivant s'en occupe */ });
}

export function deconnecter() {
  voulu = false; echecs = 0;
  clearTimeout(minuteur); clearInterval(battement);
  if (ws) { try { ws.close(); } catch { /* déjà fermée */ } }
  ws = null;
}

function relancer() {
  clearTimeout(minuteur);
  if (!voulu) return;
  minuteur = setTimeout(() => { delai = Math.min(delai * 1.7, RECONNEXION_MAX); connecter(); }, delai);
}

/** Tout message porte `g` : c'est ce qui le route vers ce jeu-ci. */
function envoyer(o) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try { ws.send(JSON.stringify({ g: 'brasier', ...o })); return true; } catch { return false; }
}

function traiter(m) {
  switch (m.t) {
    case 'b:bonjour': monId = m.id; return;
    case 'b:hello':
      nom = m.name;
      if (m.id) monId = m.id;
      return on.hello(!!m.repris);
    case 'b:salon': return on.salon(m);
    case 'b:debut': return on.debut(!!m.reprise);
    case 'b:etat': return on.etat(m.vue, m.reste);
    case 'b:refus': return on.refus(m.raison);
    case 'b:erreur': return on.erreur(m.msg || 'Erreur inconnue.');
    case 'b:parti': return on.parti();
    default: return undefined;
  }
}

/* Intentions */
export const creer = (name) => { nom = name || nom; envoyer({ t: 'create', name: nom }); };
export const rejoindre = (code, name) => { nom = name || nom; envoyer({ t: 'join', code, name: nom }); };
export const lancer = () => envoyer({ t: 'start' });
export const quitter = () => envoyer({ t: 'leave' });
export const heros = (id) => envoyer({ t: 'heros', id });
export const agir = (a) => envoyer({ t: 'action', a });
export const renommer = (name) => { nom = name || nom; envoyer({ t: 'hello', name: nom, jeton: jeton() }); };
