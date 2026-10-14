/**
 * STREET COMBAT — les combats en ligne.
 *
 * Le serveur ne fait pas combattre : il réunit deux joueurs dans une salle
 * (un code de quatre lettres), leur donne la même graine, puis relaie leurs
 * entrées. Chaque appareil fait tourner le même moteur (déterministe :
 * shared/street/combat.js) avec les entrées des deux joueurs, image par
 * image : les deux écrans montrent exactement le même combat. Chacun prédit
 * les entrées de l'autre et corrige quand elles arrivent (le « rollback » :
 * shared/street/rollback.js) ; le serveur, lui, ne fait que relayer.
 *
 * Messages (le champ `g` vaut 'street') :
 *   → creer { perso, nom, arene }      ← salle { code, n: 0, arene }
 *   → rejoindre { code, perso, nom }   ← debut { n, graine, persos, noms, arene, manche } (aux deux)
 *   → arene { arene }                  ← arene { arene } (aux deux) : l'hôte choisit l'arène (avant un combat, ou pour la revanche)
 *   → entrees { f, e[], fc, vu, av }   ← entrees (à l'autre) : ses touches, et où il en est
 *   → hash { f, h }                    ← hash { f, h } (à l'autre : repérer une désynchronisation)
 *   → etat { f, etat }                 ← etat (à l'autre) : l'hôte envoie son état pour que l'autre s'y recale
 *   → sonde { id }                     ← sonde { id } : pour mesurer le ping
 *   → revanche                         ← revanche { n } puis debut quand les deux sont d'accord
 *   → quitter                          ← parti (à l'autre)
 */

import { PERSO, PERSOS } from '../public/shared/street/persos.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
/** Une salle sans adversaire est oubliée au bout de… */
const ATTENTE_TTL = 20 * 60 * 1000;
/** Une salle sans nouvelles depuis… */
const SALLE_TTL = 60 * 60 * 1000;

const salles = new Map();
const clients = new Map();
const rnd = (n) => Math.floor(Math.random() * n);

function nouveauCode() {
  for (let i = 0; i < 200; i++) {
    let c = '';
    for (let k = 0; k < CODE_LEN; k++) c += ALPHABET[rnd(ALPHABET.length)];
    if (!salles.has(c)) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}
const nettoyerNom = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12) || 'Joueur';
/** Un vrai combattant (pas un figurant de l'histoire), sinon Ryu-Ken. */
const persoValide = (id) => (PERSO[id] && PERSOS.includes(PERSO[id]) ? id : 'ryuken');
const envoyer = (c, m) => { if (c?.conn) c.conn.send({ g: 'street', ...m }); };
/** Une arène : son identifiant, ou « hasard » (alors tirée par la graine, la même pour les deux). */
const areneValide = (a) => (typeof a === 'string' && /^[a-z0-9-]{1,24}$/.test(a) ? a : 'hasard');
const entier = (v, min, max, defaut = min) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : defaut; };
/** L'état envoyé par l'hôte pour un recalage : au plus… */
const ETAT_MAX = 60000;

export function handleOpen(conn) {
  clients.set(conn.id, { conn, code: null, n: -1 });
}

function demarrer(s) {
  s.graine = rnd(2 ** 31);
  s.revanche = [false, false];
  s.manche += 1;
  s.vu = Date.now();
  s.joueurs.forEach((j, n) => envoyer(j, { t: 'debut', n, graine: s.graine, persos: s.persos, noms: s.noms, arene: s.arene, manche: s.manche }));
}

function quitter(c) {
  const s = c && c.code && salles.get(c.code);
  if (c) { c.code = null; c.n = -1; }
  if (!s) return;
  salles.delete(s.code);
  for (const j of s.joueurs) {
    if (!j || j === c) continue;
    envoyer(j, { t: 'parti' });
    j.code = null;
    j.n = -1;
  }
}

export function handleMessage(conn, m) {
  if (!m || typeof m !== 'object') return;
  let c = clients.get(conn.id);
  if (!c) { handleOpen(conn); c = clients.get(conn.id); }
  c.conn = conn;
  const s = c.code ? salles.get(c.code) : null;
  if (s) s.vu = Date.now();
  switch (m.t) {
    case 'ping':
      return conn.send({ t: 'pong' });
    case 'sonde':
      return envoyer(c, { t: 'sonde', id: entier(m.id, 0, 1e9) });
    case 'arene': {
      // Seul l'hôte choisit ; l'arène vaut pour le prochain combat (ou la revanche).
      if (!s || c.n !== 0) return;
      s.arene = areneValide(m.arene);
      for (const j of s.joueurs) envoyer(j, { t: 'arene', arene: s.arene });
      return;
    }
    case 'creer': {
      quitter(c);
      const code = nouveauCode();
      const salle = { code, joueurs: [c, null], persos: [persoValide(m.perso), null], noms: [nettoyerNom(m.nom), null], arene: areneValide(m.arene), manche: 0, graine: 0, revanche: [false, false], cree: Date.now(), vu: Date.now() };
      salles.set(code, salle);
      c.code = code;
      c.n = 0;
      return envoyer(c, { t: 'salle', code, n: 0, arene: salle.arene });
    }
    case 'rejoindre': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const salle = salles.get(code);
      if (!salle) return envoyer(c, { t: 'erreur', msg: 'Aucune salle avec ce code.' });
      if (salle.joueurs[1] || salle.joueurs[0] === c) return envoyer(c, { t: 'erreur', msg: 'Cette salle est déjà pleine.' });
      quitter(c);
      salle.joueurs[1] = c;
      salle.persos[1] = persoValide(m.perso);
      salle.noms[1] = nettoyerNom(m.nom);
      c.code = code;
      c.n = 1;
      return demarrer(salle);
    }
    case 'entrees': case 'hash': case 'etat': {
      if (!s || !s.joueurs[1]) return;
      const f = Number(m.f);
      if (!Number.isInteger(f) || f < 0) return;
      const autre = s.joueurs[1 - c.n];
      if (m.t === 'entrees') {
        // Ses touches des dernières images (un nombre chacune), et où il en est.
        const e = (Array.isArray(m.e) ? m.e.slice(-24) : [m.e]).map((x) => Number(x) & 0x3ff);
        return envoyer(autre, { t: 'entrees', f, e, fc: entier(m.fc, 0, 1e7), vu: entier(m.vu, -1, 1e7), av: entier(m.av, -600, 600, 0) });
      }
      if (m.t === 'etat') {
        if (c.n !== 0 || !m.etat || typeof m.etat !== 'object' || JSON.stringify(m.etat).length > ETAT_MAX) return;
        return envoyer(autre, { t: 'etat', f, etat: m.etat });
      }
      return envoyer(autre, { t: 'hash', f, h: String(m.h).slice(0, 40) });
    }
    case 'revanche': {
      if (!s || !s.joueurs[1]) return;
      s.revanche[c.n] = true;
      envoyer(s.joueurs[1 - c.n], { t: 'revanche', n: c.n });
      if (s.revanche[0] && s.revanche[1]) demarrer(s);
      return;
    }
    case 'quitter':
      return quitter(c);
    default:
  }
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  clients.delete(conn.id);
  if (c) quitter(c);
}

export function sweep() {
  const maintenant = Date.now();
  for (const s of salles.values()) {
    const vieille = !s.joueurs[1] ? maintenant - s.cree > ATTENTE_TTL : maintenant - s.vu > SALLE_TTL;
    if (vieille) quitter(s.joueurs[0]);
  }
}

export function stats() {
  return { streetSalles: salles.size };
}
