/**
 * PARE-FEU — les salles en ligne.
 *
 * Le serveur fait tourner le moteur (20 images par seconde) et envoie à
 * chaque joueur, toutes les 3 images, l'état tel qu'il le voit (`vuePour` :
 * les défenses adverses non sondées restent cachées) avec les événements
 * survenus depuis l'envoi précédent. Le client n'envoie que des ordres
 * (`cmd`), que le moteur vérifie comme ceux de l'ordinateur.
 *
 * Une coupure en pleine partie n'est pas un départ (voir hub.js) : la place
 * est tenue par un pilote automatique (l'ordinateur, niveau normal) jusqu'au
 * retour du joueur. Un départ pour de bon laisse la place à l'ordinateur.
 */

import { creerPartie, pas, commande, vuePour } from '../public/shared/parefeu/partie.js';
import { NIVEAUX, NOMS_IA, DT } from '../public/shared/parefeu/donnees.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
export const MAX_JOUEURS = 4;
/** Un état part toutes les ENVOI images. */
export const ENVOI = 3;
const SALLE_TTL = 30 * 60 * 1000;
const PARTIE_TTL = 20 * 60 * 1000;

/** @type {Map<string, Salle>} */
const salles = new Map();
/** @type {Map<string, {conn:any, name:string, code:string|null}>} */
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

function nettoyerNom(brut, defaut = 'ROOT') {
  const s = String(brut ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14);
  return s || defaut;
}

/** Pour les tests : avancer une salle à la main plutôt qu'au minuteur. */
let manuel = false;
export function reglerManuel(v) { manuel = !!v; }

export class Salle {
  constructor(code, hoteId) {
    this.code = code;
    this.hoteId = hoteId;
    /** [{ id, name, bot, niveau, absent, remplace }] — l'ordre est celui des joueurs de la partie. */
    this.places = [];
    this.mode = 'ffa';
    this.E = null;
    this.timer = null;
    this.evts = [];
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }
  indexOf(id) { return this.places.findIndex((p) => p.id === id); }
  humains() { return this.places.filter((p) => !p.bot); }

  ajouter(id, name) {
    if (this.indexOf(id) >= 0) return { ok: true };
    if (this.E) return { ok: false, error: 'La partie a déjà commencé.' };
    if (this.places.length >= MAX_JOUEURS) return { ok: false, error: 'La salle est pleine (4 places).' };
    this.places.push({ id, name, bot: false });
    this.touch();
    return { ok: true };
  }

  ajouterBot(niveau) {
    if (this.E || this.places.length >= MAX_JOUEURS) return;
    const pris = new Set(this.places.map((p) => p.name));
    const name = NOMS_IA.find((x) => !pris.has(x)) || 'BOT';
    this.places.push({ id: `bot-${Date.now().toString(36)}${rnd(1000)}`, name, bot: true, niveau: NIVEAUX[niveau] ? niveau : 'normal' });
    this.touch();
  }

  retirerBot() {
    if (this.E) return;
    for (let i = this.places.length - 1; i >= 0; i--) {
      if (this.places[i].bot) { this.places.splice(i, 1); this.touch(); return; }
    }
  }

  envoyer(id, msg) {
    const c = clients.get(id);
    if (c && c.conn) { try { c.conn.send(msg); } catch { /* connexion morte */ } }
  }

  diffuser(msg) { for (const p of this.humains()) this.envoyer(p.id, msg); }

  vestiaire() {
    return {
      t: 'pf:salon',
      code: this.code,
      hostId: this.hoteId,
      mode: this.mode,
      max: MAX_JOUEURS,
      enPartie: !!this.E && !this.E.fini,
      joueurs: this.places.map((p) => ({ id: p.id, name: p.name, bot: !!p.bot, niveau: p.niveau || null, absent: !!p.absent })),
    };
  }

  commencer() {
    if (this.E && !this.E.fini) return { ok: false, error: 'La partie est en cours.' };
    if (this.mode === '2v2') while (this.places.length < 4) this.ajouterBot('normal');
    if (this.places.length < 2) return { ok: false, error: 'Il faut au moins deux joueurs (ajoute un bot).' };
    this.E = creerPartie({
      mode: this.mode,
      graine: (Date.now() ^ rnd(1e9)) >>> 0,
      joueurs: this.places.map((p) => ({ nom: p.name, ia: p.bot ? p.niveau || 'normal' : (p.absent ? 'normal' : null) })),
    });
    this.evts = [];
    this.touch();
    this.diffuser(this.vestiaire());
    this.places.forEach((p, k) => { if (!p.bot) this.envoyer(p.id, { t: 'pf:debut', moi: k, mode: this.mode }); });
    this.pousser();
    this.stop();
    if (!manuel) {
      this.timer = setInterval(() => this.avancer(), DT * 1000);
      if (typeof this.timer.unref === 'function') this.timer.unref();
    }
    return { ok: true };
  }

  /** Une image du moteur. */
  avancer() {
    const E = this.E;
    if (!E || E.fini) { this.stop(); return; }
    pas(E);
    if (E.evts.length) this.evts.push(...E.evts);
    if (E.tick % ENVOI === 0 || E.fini) this.pousser();
    if (E.fini) { this.stop(); this.touch(); }
  }

  /** Chaque humain reçoit l'état tel qu'il le voit. */
  pousser(id = null) {
    if (!this.E) return;
    const ev = this.evts;
    this.evts = [];
    this.places.forEach((p, k) => {
      if (p.bot || (id && p.id !== id)) return;
      this.envoyer(p.id, { t: 'pf:etat', e: vuePour(this.E, k), ev: id ? [] : ev });
    });
  }

  ordre(id, c) {
    const k = this.indexOf(id);
    if (k < 0 || !this.E || this.E.fini || !c || typeof c.t !== 'string') return;
    if (this.places[k].bot) return;
    commande(this.E, k, { t: c.t, cible: Number(c.cible), score: Number(c.score), parfait: c.parfait === true });
    this.touch();
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  /** Après la fin, on revient au vestiaire (les places reprises par l'ordinateur redeviennent libres). */
  rouvrir() {
    this.stop();
    this.E = null;
    this.places = this.places.filter((p) => !p.remplace);
    this.places.forEach((p) => { p.absent = false; });
    this.touch();
    this.diffuser(this.vestiaire());
  }

  /** Un départ. Au vestiaire, la place se libère ; en partie, l'ordinateur la reprend. */
  partir(id) {
    const i = this.indexOf(id);
    if (i < 0) return;
    if (!this.E || this.E.fini) {
      this.places.splice(i, 1);
      if (this.hoteId === id) this.hoteId = this.humains()[0]?.id || null;
      if (this.E) this.E = null;
      if (this.humains().length) this.diffuser(this.vestiaire());
      return;
    }
    const p = this.places[i];
    p.bot = true;
    p.remplace = true;
    p.absent = false;
    p.niveau = 'normal';
    this.E.joueurs[i].ia = 'normal';
    if (this.hoteId === id) this.hoteId = this.humains()[0]?.id || null;
    this.diffuser({ t: 'pf:notice', msg: `${p.name} a quitté la partie : l’ordinateur prend sa place.` });
  }

  absent(id, oui) {
    const i = this.indexOf(id);
    const p = this.places[i];
    if (!p || p.bot) return;
    p.absent = oui;
    if (this.E && !this.E.fini) this.E.joueurs[i].ia = oui ? 'normal' : null;
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'ROOT', code: null });
  conn.send({ t: 'pf:bienvenue', id: conn.id });
}

function quitter(c, id) {
  if (!c.code) return;
  const s = salles.get(c.code);
  c.code = null;
  if (!s) return;
  s.partir(id);
  if (!s.humains().length) { s.stop(); salles.delete(s.code); }
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  quitter(c, conn.id);
  clients.delete(conn.id);
}

const salleDe = (conn) => {
  const c = clients.get(conn.id);
  return (c && c.code && salles.get(c.code)) || null;
};

/* Coupures et retours (voir server/hub.js). */

export function enPartie(conn) {
  const s = salleDe(conn);
  return !!(s && s.E && !s.E.fini);
}

export function handleAway(conn) {
  const s = salleDe(conn);
  const p = s && s.places[s.indexOf(conn.id)];
  if (!p) return;
  s.absent(conn.id, true);
  s.diffuser({ t: 'pf:notice', msg: `📡 ${p.name} a perdu la connexion : le pilote automatique tient sa base.` });
}

export function handleResume(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  conn.send({ t: 'pf:bienvenue', id: conn.id });
  const s = salleDe(conn);
  if (!s) return;
  const k = s.indexOf(conn.id);
  const p = s.places[k];
  if (p && p.absent) {
    s.absent(conn.id, false);
    s.diffuser({ t: 'pf:notice', msg: `✅ ${p.name} est de retour.` });
  }
  conn.send(s.vestiaire());
  if (s.E) {
    conn.send({ t: 'pf:debut', moi: k, mode: s.mode, reprise: true });
    s.pousser(conn.id);
  }
}

export function handleMessage(conn, msg) {
  const c = clients.get(conn.id);
  if (!c || !msg || typeof msg.t !== 'string') return;
  const id = conn.id;
  const s = salleDe(conn);

  switch (msg.t) {
    case 'ping':
      return conn.send({ t: 'pong' });

    case 'hello':
      c.name = nettoyerNom(msg.name, c.name);
      return;

    case 'create': {
      if (c.code) quitter(c, id);
      c.name = nettoyerNom(msg.name, c.name);
      const ns = new Salle(nouveauCode(), id);
      ns.ajouter(id, c.name);
      salles.set(ns.code, ns);
      c.code = ns.code;
      return ns.diffuser(ns.vestiaire());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const ns = salles.get(code);
      if (!ns) return conn.send({ t: 'pf:erreur', msg: 'Aucune salle à ce code.' });
      if (c.code && c.code !== code) quitter(c, id);
      c.name = nettoyerNom(msg.name, c.name);
      const r = ns.ajouter(id, c.name);
      if (!r.ok) return conn.send({ t: 'pf:erreur', msg: r.error });
      c.code = code;
      return ns.diffuser(ns.vestiaire());
    }

    case 'bot': {
      if (!s || (s.E && !s.E.fini)) return;
      if (s.hoteId !== id) return conn.send({ t: 'pf:erreur', msg: 'Seul l’hôte de la salle règle les bots.' });
      if (s.E) s.rouvrir();
      if (msg.delta > 0) s.ajouterBot(msg.niveau); else s.retirerBot();
      return s.diffuser(s.vestiaire());
    }

    case 'mode': {
      if (!s || (s.E && !s.E.fini)) return;
      if (s.hoteId !== id) return conn.send({ t: 'pf:erreur', msg: 'Seul l’hôte de la salle choisit le mode.' });
      s.mode = msg.mode === '2v2' ? '2v2' : 'ffa';
      s.touch();
      return s.diffuser(s.vestiaire());
    }

    case 'start':
    case 'rejouer': {
      if (!s || (s.E && !s.E.fini)) return;
      if (s.hoteId !== id) return conn.send({ t: 'pf:erreur', msg: 'L’hôte de la salle lance la partie.' });
      if (s.E) s.rouvrir();
      const r = s.commencer();
      if (!r.ok) conn.send({ t: 'pf:erreur', msg: r.error });
      return;
    }

    case 'salon': {
      // Après la fin, un joueur revient au vestiaire.
      if (s && s.E && s.E.fini) s.rouvrir();
      else if (s) conn.send(s.vestiaire());
      return;
    }

    case 'cmd':
      if (s) s.ordre(id, msg.c);
      return;

    case 'leave':
      quitter(c, id);
      return conn.send({ t: 'pf:parti' });

    default:
      return undefined;
  }
}

export function sweep() {
  const now = Date.now();
  for (const [code, s] of salles) {
    const ttl = s.E && !s.E.fini ? PARTIE_TTL : SALLE_TTL;
    if (now - s.touchedAt > ttl || !s.humains().length) {
      s.stop();
      s.diffuser({ t: 'pf:erreur', msg: 'Salle fermée pour inactivité.' });
      salles.delete(code);
    }
  }
}

export function stats() {
  return { sallesPareFeu: salles.size, enPartiePareFeu: [...salles.values()].filter((s) => s.E && !s.E.fini).length };
}

/** Pour les tests. */
export const _salles = salles;
