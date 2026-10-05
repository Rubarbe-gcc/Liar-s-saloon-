/**
 * BRASIER — liaison avec la forge.
 *
 * Le serveur mène la partie de bout en bout. Ce module ne fait que tenir la
 * connexion, relayer ce qui arrive, et envoyer des intentions : le client ne
 * simule rien, il n'y a donc rien qui puisse diverger d'un écran à l'autre.
 */

import * as reprise from '../../../shared/reprise.js';
import { creerConnexion } from '../../../shared/connexion.js';

const JEU = 'brasier';

let monId = null;
let nom = 'Forgeron';
/** En pleine partie : une coupure doit pouvoir se rattraper. */
let enJeu = false;
let code = null;

const on = {
  statut: () => {}, salon: () => {}, debut: () => {}, etat: () => {},
  refus: () => {}, erreur: () => {}, parti: () => {}, hello: () => {},
};

/**
 * Le jeton : l'identité de ce joueur pour le serveur, d'une connexion à la
 * suivante. L'hébergement coupe les connexions au bout de quelques minutes ;
 * sans jeton, chaque reconnexion faisait de vous un inconnu, et la table vous
 * remplaçait par un bot. Il vit le temps de l'onglet : deux onglets, deux
 * joueurs — et recharger la page rend sa place. Si l'application a été
 * fermée en pleine partie, on la rouvre et on reprend le même jeton, tant
 * que la place attend encore (cinq minutes) : voir shared/reprise.js.
 */
const jeton = () => reprise.session(JEU);
reprise.adopter(JEU);
reprise.surveiller(JEU);
export function ecouter(evt, fn) { on[evt] = fn; }
export const moi = () => monId;

/**
 * La connexion : reconnexion, réveil — voir shared/connexion.js. Le BRASIER
 * présente son jeton dans le « hello » plutôt qu'en clé de session : son
 * serveur gère lui-même les absences.
 */
const net = creerConnexion({
  jeu: JEU,
  g: 'brasier',
  session: false,
  ouverte: () => envoyer({ t: 'hello', name: nom, jeton: jeton() }),
  message: (m) => traiter(m),
  enPartie: () => enJeu,
  code: () => code,
  statut: (s) => on.statut(s),
});

export function connecter(qui) {
  if (qui && qui.name) nom = qui.name;
  net.ouvrir();
}

export const deconnecter = () => net.fermer();

/** Tout message porte `g` : c'est ce qui le route vers ce jeu-ci. */
const envoyer = (o) => net.envoyer(o);

function traiter(m) {
  switch (m.t) {
    case 'b:bonjour': monId = m.id; return;
    case 'b:hello':
      nom = m.name;
      if (m.id) monId = m.id;
      if (!m.repris && enJeu) { enJeu = false; reprise.oublier(JEU); }
      return on.hello(!!m.repris);
    case 'b:salon': code = m.code; return on.salon(m);
    case 'b:debut':
      enJeu = true;
      reprise.enPartie(JEU, { code });
      return on.debut(!!m.reprise);
    case 'b:etat':
      if (m.vue && m.vue.phase === 'fin') { enJeu = false; reprise.oublier(JEU); }
      return on.etat(m.vue, m.reste);
    case 'b:refus': return on.refus(m.raison);
    case 'b:erreur': return on.erreur(m.msg || 'Erreur inconnue.');
    case 'b:parti': enJeu = false; reprise.oublier(JEU); return on.parti();
    default: return undefined;
  }
}

/* Intentions */
export const creer = (name) => { nom = name || nom; envoyer({ t: 'create', name: nom }); };
export const rejoindre = (code, name) => { nom = name || nom; envoyer({ t: 'join', code, name: nom }); };
export const lancer = () => envoyer({ t: 'start' });
export const quitter = () => { enJeu = false; reprise.oublier(JEU); return envoyer({ t: 'leave' }); };
export const heros = (id) => envoyer({ t: 'heros', id });
export const agir = (a) => envoyer({ t: 'action', a });
export const renommer = (name) => { nom = name || nom; envoyer({ t: 'hello', name: nom, jeton: jeton() }); };
