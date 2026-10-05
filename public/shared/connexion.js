/**
 * Insert Coin — une connexion en ligne qui tient, commune à tous les jeux.
 *
 * Un téléphone qui se met en veille, un tunnel, l'hébergement qui coupe au
 * bout de quelques minutes : une connexion WebSocket meurt souvent, et
 * parfois sans rien dire — le navigateur la croit ouverte alors qu'elle ne
 * mène plus nulle part. Ce module s'en occupe pour tous les jeux :
 *
 *   • il se reconnecte tout seul, sans jamais abandonner tant qu'on le veut ;
 *   • au retour au premier plan (ou quand le réseau revient), il vérifie la
 *     connexion tout de suite, et en ouvre une neuve si elle ne répond plus ;
 *   • un battement régulier repère une connexion muette ;
 *   • dès qu'une connexion s'ouvre, il présente la clé de session : si une
 *     place attend ce joueur dans une partie, le serveur la lui rend.
 *
 * Le jeu ne fournit que ce qui lui est propre : quoi dire en arrivant, quoi
 * faire de chaque message, comment afficher l'état de la connexion.
 *
 * Module de navigateur.
 */

import * as reprise from './reprise.js';

const adresse = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`;

/** Un ping toutes les… */
const BATTEMENT = 15 * 1000;
/** Sans aucune nouvelle du serveur depuis…, la connexion est tenue pour morte. */
const SILENCE_MAX = 40 * 1000;
/** Au réveil, le serveur doit répondre au ping dans ce délai. */
const VERIF_REVEIL = 3000;
const DELAI_MIN = 500;
const DELAI_MAX = 8000;
/** Au-delà de tant d'échecs d'affilée, on dit que le serveur est injoignable (sans arrêter d'essayer). */
const ECHECS_AVANT_ALERTE = 4;

/**
 * @param {{
 *   jeu: string,                 clé du jeu, pour la reprise (reprise.js)
 *   g?: string,                  champ \`g\` ajouté à chaque message (routage du serveur)
 *   session?: boolean,           envoyer la clé de session à l'ouverture (vrai par défaut)
 *   ouverte?: () => void,        la connexion vient de s'ouvrir (après la clé de session)
 *   message: (m: object) => void,
 *   statut?: (s: 'connexion'|'connecte'|'perdu'|'injoignable') => void,
 *   enPartie?: () => boolean,    une partie est en cours : à noter pour la reprise
 *   code?: () => string|null,    le code de la table, pour le bandeau de reprise
 * }} o
 */
export function creerConnexion(o) {
  let ws = null;
  let voulu = false;
  let delai = DELAI_MIN;
  let echecs = 0;
  let dernier = 0;
  let minuteur = 0;
  let battement = 0;
  let verif = 0;

  const ouverte = () => !!ws && ws.readyState === WebSocket.OPEN;

  function envoyer(msg) {
    if (!ouverte()) return false;
    try { ws.send(JSON.stringify(o.g ? { g: o.g, ...msg } : msg)); return true; } catch { return false; }
  }

  function ouvrir() {
    voulu = true;
    clearTimeout(minuteur);
    if (ws && ws.readyState <= WebSocket.OPEN) return;
    o.statut?.('connexion');
    let s;
    try { s = new WebSocket(adresse()); } catch { plusTard(); return; }
    ws = s;
    // Chaque écouteur vérifie qu'il parle bien pour la connexion du moment :
    // une vieille connexion abandonnée ne doit plus rien décider.
    s.addEventListener('open', () => {
      if (s !== ws) return;
      delai = DELAI_MIN;
      echecs = 0;
      dernier = Date.now();
      // La clé de session d'abord : si une place nous attend, le serveur nous la rend.
      if (o.session !== false) envoyer({ t: 'session', sid: reprise.session(o.jeu) });
      o.statut?.('connecte');
      o.ouverte?.();
      clearInterval(battement);
      battement = setInterval(battre, BATTEMENT);
    });
    s.addEventListener('message', (e) => {
      if (s !== ws) return;
      dernier = Date.now();
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m && m.t === 'pong') return;
      o.message(m);
    });
    s.addEventListener('close', () => { if (s === ws) perdue(); });
    s.addEventListener('error', () => { /* le close qui suit s'en occupe */ });
  }

  function perdue() {
    clearInterval(battement);
    clearTimeout(verif);
    ws = null;
    if (!voulu) return;
    if (o.enPartie?.()) reprise.interrompue(o.jeu);
    echecs += 1;
    o.statut?.(echecs >= ECHECS_AVANT_ALERTE ? 'injoignable' : 'perdu');
    plusTard();
  }

  function plusTard() {
    clearTimeout(minuteur);
    if (!voulu) return;
    minuteur = setTimeout(ouvrir, delai);
    delai = Math.min(delai * 1.6, DELAI_MAX);
  }

  /**
   * Abandonne une connexion muette et en ouvre une neuve, sans attendre que
   * le navigateur s'aperçoive qu'elle est morte. La neuve présente la même
   * clé : le serveur lui rend la place, et congédie l'ancienne.
   */
  function renouveler() {
    const vieille = ws;
    ws = null;
    clearInterval(battement);
    clearTimeout(verif);
    if (vieille) setTimeout(() => { try { vieille.close(); } catch { /* déjà fermée */ } }, 10000);
    if (!voulu) return;
    delai = DELAI_MIN;
    ouvrir();
  }

  function battre() {
    if (Date.now() - dernier > SILENCE_MAX) { renouveler(); return; }
    envoyer({ t: 'ping' });
    if (o.enPartie?.()) reprise.enPartie(o.jeu, { code: o.code?.() ?? null });
  }

  /** Retour au premier plan, réseau retrouvé : on vérifie tout de suite. */
  function reveil() {
    if (!voulu) return;
    if (!ws || ws.readyState > WebSocket.OPEN) { delai = DELAI_MIN; ouvrir(); return; }
    if (ws.readyState !== WebSocket.OPEN) return;      // une connexion s'ouvre déjà
    const avant = dernier;
    envoyer({ t: 'ping' });
    clearTimeout(verif);
    verif = setTimeout(() => { if (dernier === avant) renouveler(); }, VERIF_REVEIL);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reveil(); });
  addEventListener('online', reveil);
  addEventListener('pageshow', (e) => { if (e.persisted) reveil(); });
  addEventListener('focus', reveil);

  function fermer() {
    voulu = false;
    echecs = 0;
    clearTimeout(minuteur);
    clearInterval(battement);
    clearTimeout(verif);
    const s = ws;
    ws = null;
    if (s) { try { s.close(); } catch { /* déjà fermée */ } }
  }

  return { ouvrir, fermer, envoyer, ouverte, voulue: () => voulu };
}
