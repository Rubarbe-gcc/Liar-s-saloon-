/**
 * DOUBLE PAS — le match de basket en ligne, à deux, chacun sur son appareil (le même
 * mécanisme que le foot : foot/js/enligne.js).
 *
 * Le moteur est déterministe : avec la même graine et les mêmes touches,
 * deux appareils jouent exactement le même match (l'ordinateur des
 * coéquipiers compris). Le match ne s'arrête jamais pour attendre
 * l'adversaire : on prédit ses touches et on corrige quand elles arrivent
 * (le « rollback » : shared/rollback.js, le même que STREET COMBAT). Ici, on
 * branche ce mécanisme sur le réseau : les messages, la mesure du ping (qui
 * règle le délai de nos touches), le recalage si les deux écrans divergent,
 * la salle choisie par l'hôte (le champ « stade » du protocole). Le serveur ne fait que
 * relayer (server/basket.js).
 */

import { creerConnexion } from '../../../../shared/connexion.js';
import { creerSession } from '../../../../shared/rollback.js';
import { pas, empreinte } from '../../../../shared/basket/match.js';

/* ---------------- Le ping, et le délai de nos touches ---------------- */

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
 * Le délai de nos touches selon le ping : assez pour que la plupart arrivent à temps (moins de
 * corrections, donc un match plus fluide), sans que le jeu paraisse mou. Le foot pardonne un
 * peu plus de délai qu'un jeu de combat, le basket aussi : de 2 à 5 images (33 à 83 ms).
 */
export const delaiSelonPing = (ping) => (!ping ? 2 : Math.max(2, Math.min(5, Math.round(ping / 40) + 1)));

/* ---------------- La session de match ---------------- */

let session = null;
let dernierRecalage = -999;

/**
 * Les réglages du rollback (les mêmes que le foot). Les touches passent par le serveur : elles mettent
 * à peu près un ping pour arriver chez l'autre (souvent 150 à 300 ms avec l'hébergement).
 *   fenetre    : on peut jouer jusqu'à une demi-seconde d'avance sans s'arrêter ;
 *   redondance : chaque message renvoie toutes les touches pas encore confirmées (jusqu'à 64),
 *                sinon, avec un gros ping, les plus récentes partaient en retard et le jeu se figeait ;
 *   rythmeDoux : quand on est en avance sur l'autre, on ralentit à peine l'horloge (voir `ecart`)
 *                au lieu de sauter une image (un à-coup).
 */
export const REGLAGES = { fenetre: 30, redondance: 64, rythmeDoux: true };

/** Un match commence : m est l'état du moteur (modifié sur place), n notre place. */
export function demarrerSession({ m, n }) {
  session = creerSession({ n, delai: delaiSelonPing(DIAG.ping), etat: m, pas: (c, e) => pas(c, e), empreinte, ...REGLAGES });
  dernierRecalage = -999;
}

/** Une image d'horloge en ligne : nos touches partent, celles de l'autre sont prédites. Rend { evs, attente }. */
export function pasEnLigne(local) {
  if (!session) return null;
  const r = session.avancer(local);
  envoyer({ t: 'entrees', ...r.envoi });
  if (r.empreinte) envoyer({ t: 'hash', ...r.empreinte });
  // Les deux écrans divergent : l'hôte envoie son état (pas plus d'une fois par seconde).
  if (session.desynchro && salle.n === 0 && session.f - dernierRecalage > 60) {
    const e = session.etatConfirme();
    if (e) { envoyer({ t: 'etat', ...e }); dernierRecalage = session.f; session.acquitter(); }
  }
  return r;
}

/** Toutes les images jouées sont confirmées (on peut annoncer la fin sans risque de correction). */
/** De combien d'images on est en avance sur l'adversaire : le jeu ralentit un peu son horloge au-delà de 1. */
export const ecart = () => session?.ecart ?? 0;
export const toutConfirme = () => !session || session.confirmees >= session.f;
export function diagnostic() {
  if (!session) return null;
  return { ping: Math.round(DIAG.ping), delai: session.delai, avance: session.avance(), ...session.stats };
}
export const finirSession = () => { session = null; };

/* ---------------- La connexion, la salle ---------------- */

let rappels = {};
let net = null;
export const salle = { code: null, n: -1, enMatch: false, stade: 'palais' };

function traiter(m) {
  if (!m || m.g !== 'basket') return;
  switch (m.t) {
    case 'salle': salle.code = m.code; salle.n = m.n; salle.stade = m.stade; rappels.salle?.(m); break;
    case 'salon': salle.n = m.n; salle.code = m.code || salle.code; salle.stade = m.stade; salle.salon = m; rappels.salon?.(m); break;
    case 'debut': salle.n = m.n; salle.enMatch = true; salle.stade = m.stade; rappels.debut?.(m); break;
    case 'stade': salle.stade = m.stade; rappels.stade?.(m.stade); break;
    case 'entrees': session?.recevoir(m); break;
    case 'hash': session?.recevoirEmpreinte(m); break;
    case 'etat': session?.recaler(m); break;
    case 'sonde': recevoirSonde(m.id); break;
    case 'revanche': rappels.revanche?.(m); break;
    case 'parti': salle.code = null; salle.enMatch = false; session = null; rappels.parti?.(); break;
    case 'erreur': rappels.erreur?.(m.msg); break;
    case 'absent': rappels.absent?.(m); break;
    case 'revenu': rappels.revenu?.(m); break;
    case 'session': rappels.session?.(m); break;
    default:
  }
}

/** Une demande faite avant que la connexion soit ouverte (le serveur se réveille) : partie dès l'ouverture. */
let enAttente = null;
export function envoyer(m) {
  if (net?.envoyer({ g: 'basket', ...m })) return;
  if (m.t === 'creer' || m.t === 'rejoindre') enAttente = m;
}

export function connecter(r) {
  rappels = r;
  if (!net) {
    net = creerConnexion({
      // La clé de session : si la connexion tombe en plein match, le serveur garde la place quelques minutes.
      jeu: 'basket', g: 'basket',
      message: traiter,
      statut: (s) => rappels.statut?.(s),
      ouverte: () => { if (enAttente) { const m = enAttente; enAttente = null; envoyer(m); } sonder(); },
    });
  }
  net.ouvrir();
  clearInterval(minuteurSonde);
  minuteurSonde = setInterval(() => { if (net?.ouverte()) sonder(); }, 2000);
}

export const creer = (nom, stade) => envoyer({ t: 'creer', nom, stade });
export const rejoindre = (code, nom) => envoyer({ t: 'rejoindre', code, nom });
/** Dans la salle : son équipe (pas celle de l'autre), puis « prêt ». */
export const choisirEquipe = (equipe) => envoyer({ t: 'equipe', equipe });
export const pret = (oui = true) => envoyer({ t: 'pret', pret: oui });
export const choisirStade = (stade) => envoyer({ t: 'stade', stade });
export const revanche = () => envoyer({ t: 'revanche' });
export function quitter() {
  enAttente = null;
  envoyer({ t: 'quitter' });
  salle.code = null;
  salle.enMatch = false;
  session = null;
  clearInterval(minuteurSonde);
}
