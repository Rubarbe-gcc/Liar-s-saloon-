/**
 * MAXI MENU — les échanges de cartes en direct, entre deux joueurs.
 *
 * L'un crée une salle (code de quatre lettres), l'autre la rejoint. Chacun
 * compose son lot ; le serveur montre les deux lots aux deux joueurs. Quand
 * les deux ont validé ET que l'échange est équitable (shared/maximenu/marche.js),
 * le serveur l'annonce conclu : chaque page retire ce qu'elle donne et ajoute
 * ce qu'elle reçoit. Changer son lot annule les validations.
 *
 * Les collections restent chez les joueurs (comme les caisses du VELOURS NOIR).
 *
 * Messages (le champ `g` vaut 'maximenu') :
 *   → creer { nom }            ← salle { code, moi }
 *   → rejoindre { code, nom }  ← salle { code, moi }
 *   → offre { lot }            ← etat { noms, offres, ok, equite }
 *   → valider                  ← conclu { donne, recoit }
 *   → quitter                  ← parti (à l'autre)
 *   ← erreur { msg }
 */

import { nettoyerLot, equite } from '../public/shared/maximenu/marche.js';

const salles = new Map();   // code → { joueurs: [place, place?], noms, offres, ok, cree }
const clients = new Map();  // id de place → { conn, code, moi }
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const SALLE_MAX_MS = 60 * 60 * 1000;

const nomPropre = n => String(n || '').replace(/[<>&"]/g, '').trim().slice(0, 20) || 'Joueur';

function nouveauCode() {
  for (let k = 0; k < 50; k++) {
    let c = ''; for (let i = 0; i < 4; i++) c += LETTRES[Math.floor(Math.random() * LETTRES.length)];
    if (!salles.has(c)) return c;
  }
  return null;
}

function diffuser(s) {
  const eq = equite(s.offres[0], s.offres[1]);
  s.joueurs.forEach((p, i) => p && p.send({ g: 'maximenu', t: 'etat', moi: i, noms: s.noms, offres: s.offres, ok: s.ok, equite: eq }));
}

function partir(conn, prevenir = true) {
  const c = clients.get(conn.id); if (!c || !c.code) return;
  const s = salles.get(c.code); c.code = null;
  if (!s) return;
  salles.delete(s.code);
  if (prevenir) for (const p of s.joueurs) if (p && p !== conn) { p.send({ g: 'maximenu', t: 'parti' }); const o = clients.get(p.id); if (o) o.code = null; }
}

export function handleOpen(conn) { clients.set(conn.id, { conn, code: null, moi: 0 }); }

export function handleMessage(conn, msg) {
  if (!msg || typeof msg !== 'object') return;
  let c = clients.get(conn.id); if (!c) { handleOpen(conn); c = clients.get(conn.id); }
  const erreur = m => conn.send({ g: 'maximenu', t: 'erreur', msg: m });
  const s = c.code ? salles.get(c.code) : null;
  switch (msg.t) {
    case 'creer': {
      partir(conn);
      const code = nouveauCode(); if (!code) return erreur('Trop de salles ouvertes, réessayez.');
      salles.set(code, { code, joueurs: [conn, null], noms: [nomPropre(msg.nom), ''], offres: [{}, {}], ok: [false, false], cree: Date.now() });
      c.code = code; c.moi = 0;
      conn.send({ g: 'maximenu', t: 'salle', code, moi: 0 });
      return diffuser(salles.get(code));
    }
    case 'rejoindre': {
      const code = String(msg.code || '').toUpperCase().trim(), cible = salles.get(code);
      if (!cible) return erreur('Aucun échange avec ce code.');
      if (cible.joueurs[1]) return erreur('Cet échange est déjà complet.');
      if (cible.joueurs[0] === conn) return erreur('C’est votre propre salle.');
      partir(conn);
      cible.joueurs[1] = conn; cible.noms[1] = nomPropre(msg.nom); c.code = code; c.moi = 1;
      conn.send({ g: 'maximenu', t: 'salle', code, moi: 1 });
      return diffuser(cible);
    }
    case 'offre': {
      if (!s) return erreur('Pas d’échange en cours.');
      const lot = nettoyerLot(msg.lot); if (!lot) return erreur('Lot invalide (12 cartes au plus).');
      s.offres[c.moi] = lot; s.ok = [false, false];
      return diffuser(s);
    }
    case 'valider': {
      if (!s) return erreur('Pas d’échange en cours.');
      if (!s.joueurs[1]) return erreur('Attendez votre partenaire.');
      if (!equite(s.offres[0], s.offres[1]).ok) return erreur('L’échange n’est pas équitable.');
      s.ok[c.moi] = true;
      if (s.ok[0] && s.ok[1]) {
        const [a, b] = s.offres;
        s.joueurs[0].send({ g: 'maximenu', t: 'conclu', donne: a, recoit: b, avec: s.noms[1] });
        s.joueurs[1].send({ g: 'maximenu', t: 'conclu', donne: b, recoit: a, avec: s.noms[0] });
        salles.delete(s.code);
        for (const p of s.joueurs) { const o = clients.get(p.id); if (o) o.code = null; }
        return;
      }
      return diffuser(s);
    }
    case 'quitter': return partir(conn);
    default: return undefined;
  }
}

export function handleClose(conn) { partir(conn); clients.delete(conn.id); }

export function sweep() {
  const t = Date.now();
  for (const s of [...salles.values()]) if (t - s.cree > SALLE_MAX_MS) { for (const p of s.joueurs) if (p) { p.send({ g: 'maximenu', t: 'parti' }); const o = clients.get(p.id); if (o) o.code = null; } salles.delete(s.code); }
}

export function stats() { return { maximenuEchanges: salles.size }; }

/** Pour les tests. */
export function vider() { salles.clear(); clients.clear(); }
