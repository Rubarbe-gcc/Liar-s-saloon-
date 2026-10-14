/**
 * STREET COMBAT — le combat en ligne, à deux, chacun sur son appareil.
 *
 * Le moteur est déterministe : avec la même graine et les mêmes entrées,
 * deux appareils jouent exactement le même combat. Le combat ne s'arrête
 * jamais pour attendre l'adversaire : on prédit ses touches et on corrige
 * quand elles arrivent (le « rollback » : shared/street/rollback.js). Ici,
 * on branche ce mécanisme sur le réseau : les messages, la mesure du ping
 * (qui règle le délai de nos touches), le recalage si les deux écrans
 * divergent, l'arène choisie par l'hôte. Le serveur ne fait que relayer
 * (server/street.js).
 */

import { creerConnexion } from '../../../shared/connexion.js';
import { creerSession } from '../../../shared/street/rollback.js';

const TOUCHES = ['g', 'd', 'h', 'b', 'P', 'K', 'G', 'A', 'B', 'U'];
/** Dix touches → un nombre, et retour. */
export const coder = (e) => TOUCHES.reduce((m, k, i) => (e[k] ? m | (1 << i) : m), 0);
export const decoder = (m) => Object.fromEntries(TOUCHES.map((k, i) => [k, !!(m & (1 << i))]));

/** L'empreinte d'un combat : de quoi voir si deux appareils jouent toujours la même chose. */
export function empreinte(c) {
  let h = c.f | 0;
  for (const j of c.joueurs) for (const v of [j.hp, Math.round(j.x), Math.round(j.y), j.sp, j.victoires]) h = (Math.imul(h, 31) + (v | 0)) | 0;
  h = (Math.imul(h, 31) + (c.alea | 0)) | 0;
  return String(h >>> 0);
}

/* ------------------------------------------------------------------ */
/* Le ping, et le délai de nos touches                                 */
/* ------------------------------------------------------------------ */

/** Ce qu'on mesure (affiché dans le diagnostic, touche F3). */
export const DIAG = { ping: 0, mesures: 0 };
let sondes = new Map();
let minuteurSonde = 0;

function sonder() {
  const id = Math.floor(Math.random() * 1e9);
  sondes.set(id, performance.now());
  if (sondes.size > 20) sondes = new Map([...sondes].slice(-10));
  envoyer({ t: 'sonde', id });
}
function recevoirSonde(id) {
  const t0 = sondes.get(id);
  if (t0 === undefined) return;
  sondes.delete(id);
  const rtt = performance.now() - t0;
  DIAG.ping = DIAG.mesures ? DIAG.ping * 0.7 + rtt * 0.3 : rtt;
  DIAG.mesures += 1;
}
/**
 * Le délai de nos touches, selon le ping : un aller-retour jusqu'au serveur vaut
 * à peu près un aller jusqu'à l'adversaire. Assez pour que la plupart des
 * touches arrivent à temps, pas plus (le jeu doit rester vif).
 */
export const delaiSelonPing = (ping) => (!ping ? 2 : Math.max(1, Math.min(3, Math.round(ping / 16.7 / 2))));

/* ------------------------------------------------------------------ */
/* La session de combat                                                */
/* ------------------------------------------------------------------ */

let session = null;
let dernierRecalage = -999;
/** Pour le diagnostic : les images figées d'affilée. */
export const ETAT = { attente: 0 };

/**
 * Un combat commence : `pasEv(c, entrees)` joue une image et rend ses événements ;
 * `confirme(f, entrees)` reçoit chaque image confirmée (pour le replay).
 */
export function demarrerSession({ combat, n, pasEv, confirme }) {
  session = creerSession({
    n, delai: delaiSelonPing(DIAG.ping), etat: combat,
    pas: (c, [a, b]) => pasEv(c, [decoder(a), decoder(b)]),
    empreinte,
    confirme: confirme && ((f, [a, b]) => confirme(f, [decoder(a), decoder(b)])),
  });
  ETAT.attente = 0;
  dernierRecalage = -999;
}

/**
 * Une image d'horloge en ligne. Rend { evs, attente } : les événements à
 * montrer, et si l'image a été retenue (l'adversaire est trop loin derrière).
 */
export function pasEnLigne(lireLocal) {
  if (!session) return null;
  const r = session.avancer(coder(lireLocal()));
  envoyer({ t: 'entrees', ...r.envoi });
  if (r.empreinte) envoyer({ t: 'hash', ...r.empreinte });
  // Les deux écrans divergent : l'hôte envoie son état (pas plus d'une fois par seconde).
  if (session.desynchro && salle.n === 0 && session.f - dernierRecalage > 60) {
    const e = session.etatConfirme();
    if (e) { envoyer({ t: 'etat', ...e }); dernierRecalage = session.f; session.acquitter(); }
  }
  ETAT.attente = r.attente && !r.retenue ? ETAT.attente + 1 : 0;
  return r;
}

/** Toutes les images jouées sont confirmées (pour annoncer la fin d'un combat sans risque de correction). */
export const toutConfirme = () => !session || session.confirmees >= session.f;
/** Ce que montre le diagnostic. */
export function diagnostic() {
  if (!session) return null;
  return { ping: Math.round(DIAG.ping), delai: session.delai, avance: session.avance(), ...session.stats };
}

/* ------------------------------------------------------------------ */
/* La connexion, la salle                                              */
/* ------------------------------------------------------------------ */

let rappels = {};
let net = null;
export const salle = { code: null, n: -1, enCombat: false, arene: 'hasard' };

function traiter(m) {
  if (!m || m.g !== 'street') return;
  switch (m.t) {
    case 'salle': salle.code = m.code; salle.n = m.n; salle.arene = m.arene || 'hasard'; rappels.salle?.(m); break;
    case 'debut': salle.n = m.n; salle.enCombat = true; salle.arene = m.arene || 'hasard'; rappels.debut?.(m); break;
    case 'arene': salle.arene = m.arene; rappels.arene?.(m.arene); break;
    case 'entrees': session?.recevoir(m); break;
    case 'hash': session?.recevoirEmpreinte(m); break;
    case 'etat': session?.recaler(m); break;
    case 'sonde': recevoirSonde(m.id); break;
    case 'revanche': rappels.revanche?.(m); break;
    case 'parti': salle.code = null; salle.enCombat = false; session = null; rappels.parti?.(); break;
    case 'erreur': rappels.erreur?.(m.msg); break;
    default:
  }
}

/** Une demande faite avant que la connexion soit ouverte (le serveur se réveille) : partie dès l'ouverture. */
let enAttente = null;
export function envoyer(m) {
  if (net?.envoyer({ g: 'street', ...m })) return;
  if (m.t === 'creer' || m.t === 'rejoindre') enAttente = m;
}

/** Se connecter, avec ce qu'il faut faire de chaque nouvelle. */
export function connecter(r) {
  rappels = r;
  if (!net) {
    net = creerConnexion({
      jeu: 'street', g: 'street', session: false,
      message: traiter,
      statut: (s) => rappels.statut?.(s),
      ouverte: () => { if (enAttente) { const m = enAttente; enAttente = null; envoyer(m); } sonder(); },
    });
  }
  net.ouvrir();
  // Le ping, mesuré régulièrement (il règle le délai du prochain combat, et s'affiche dans le diagnostic).
  clearInterval(minuteurSonde);
  minuteurSonde = setInterval(() => { if (net?.ouverte()) sonder(); }, 2000);
}

export const creer = (perso, nom, arene = 'hasard') => envoyer({ t: 'creer', perso, nom, arene });
export const rejoindre = (code, perso, nom) => envoyer({ t: 'rejoindre', code, perso, nom });
/** L'hôte choisit l'arène (pour le combat qui vient, ou la revanche). */
export const choisirArene = (arene) => envoyer({ t: 'arene', arene });
export const revanche = () => envoyer({ t: 'revanche' });
export function quitter() {
  enAttente = null;
  envoyer({ t: 'quitter' });
  salle.code = null;
  salle.enCombat = false;
  session = null;
  clearInterval(minuteurSonde);
}
