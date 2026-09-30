/**
 * BRASIER — les tables en ligne.
 *
 * Le jeu ne se joue qu'en ligne, à huit chaises. L'hôte lance quand il veut :
 * chaque chaise vide reçoit un bot, et un joueur qui s'en va en pleine partie
 * est remplacé par un bot plutôt que retiré — ses adversaires ne perdent ni
 * un combat ni un appariement.
 *
 * Le serveur est l'autorité : il tient la partie, rythme les phases, joue les
 * bots et simule les combats. Les clients n'envoient que des intentions, et
 * ne reçoivent que leur propre vue — jamais la taverne ni le plateau d'autrui
 * avant le combat.
 */

import {
  creerPartie, choisirHeros, herosTousChoisis, commencer, agir, humainsPrets,
  terminerRecrutement, finirCombats, viewFor, joueurDe, vivants,
  PHASE, JOUEURS, dureeRecrutement, DUREE_CHOIX_HEROS,
} from '../public/shared/brasier/partie.js';
import { choisirHerosBot, jouerBot, NOMS_BOTS } from '../public/shared/brasier/bots.js';
import { dureeCombat } from '../public/shared/brasier/combat.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const TABLE_TTL = 30 * 60 * 1000;
const PARTIE_TTL = 20 * 60 * 1000;
/** Temps d'affichage du classement final, avant de rouvrir la table. */
const FIN_MS = 30 * 1000;
/** Marge après la rediffusion du plus long combat, pour lire le résultat. */
const MARGE_COMBAT_MS = 2500;

const tables = new Map();
const clients = new Map();

const rnd = (n) => Math.floor(Math.random() * n);

function nouveauCode() {
  for (let i = 0; i < 200; i++) {
    let c = '';
    for (let k = 0; k < CODE_LEN; k++) c += ALPHABET[rnd(ALPHABET.length)];
    if (!tables.has(c)) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}

function nettoyerNom(brut, defaut = 'Forgeron') {
  const s = String(brut ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14);
  return s || defaut;
}

/** Ne laisse passer qu'une action connue, aux champs numériques bornés. */
function nettoyerAction(brut) {
  const TYPES = ['acheter', 'vendre', 'deplacer', 'rafraichir', 'geler', 'ameliorer', 'pouvoir', 'decouvrir', 'pret'];
  if (!brut || !TYPES.includes(brut.type)) return null;
  const n = (v) => (Number.isInteger(v) && v >= 0 && v < 16 ? v : undefined);
  return {
    type: brut.type,
    i: n(brut.i),
    de: n(brut.de),
    vers: n(brut.vers),
    valeur: typeof brut.valeur === 'boolean' ? brut.valeur : undefined,
  };
}

/* ------------------------------------------------------------------ */

class Table {
  constructor(code, hoteId) {
    this.code = code;
    this.hoteId = hoteId;
    this.places = [];       // humains : [{id, name}]
    this.partie = null;
    this.timer = null;
    this.echeance = 0;
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }
  indexOf(id) { return this.places.findIndex((p) => p.id === id); }
  a(id) { return this.indexOf(id) >= 0; }

  ajouter(id, name) {
    if (this.partie) return { ok: false, error: 'La partie a déjà commencé.' };
    if (this.places.length >= JOUEURS) return { ok: false, error: 'La table est pleine.' };
    if (this.a(id)) return { ok: true };
    this.places.push({ id, name });
    this.touch();
    return { ok: true };
  }

  retirer(id) {
    const i = this.indexOf(id);
    if (i < 0) return;
    this.places.splice(i, 1);
    if (this.hoteId === id && this.places.length) this.hoteId = this.places[0].id;
    this.touch();
  }

  envoyer(id, msg) {
    const c = clients.get(id);
    if (c && c.conn) { try { c.conn.send(msg); } catch { /* connexion morte */ } }
  }

  diffuser(msg) { for (const p of this.places) this.envoyer(p.id, msg); }

  vestiaire() {
    return {
      t: 'b:salon',
      code: this.code,
      hostId: this.hoteId,
      max: JOUEURS,
      joueurs: this.places.map((p) => ({ id: p.id, name: p.name })),
    };
  }

  pousser() {
    if (!this.partie) return;
    const reste = Math.max(0, this.echeance - Date.now());
    for (const p of this.places) {
      this.envoyer(p.id, { t: 'b:etat', vue: viewFor(this.partie, p.id), reste });
    }
  }

  armer(fn, ms) {
    this.stop();
    this.echeance = Date.now() + ms;
    this.timer = setTimeout(fn, ms);
  }

  stop() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  /** Plus aucun humain en vie : on accélère, personne n'a rien à décider. */
  sansHumain() { return !vivants(this.partie).some((j) => !j.isBot); }

  /* -------------------- déroulement -------------------- */

  commencer() {
    if (!this.places.length) return { ok: false, error: 'Personne à table.' };
    const pris = new Set(this.places.map((p) => p.name));
    const noms = NOMS_BOTS.filter((n) => !pris.has(n));
    const bots = [];
    for (let k = 0; this.places.length + bots.length < JOUEURS; k++) {
      bots.push({ id: `bot-${k + 1}`, name: noms[k % noms.length], isBot: true });
    }
    this.partie = creerPartie([...this.places.map((p) => ({ id: p.id, name: p.name })), ...bots]);
    for (const b of bots) choisirHerosBot(this.partie, b.id);
    this.touch();
    this.diffuser({ t: 'b:debut' });
    this.armer(() => this.recrutement(), DUREE_CHOIX_HEROS * 1000);
    this.pousser();
    return { ok: true };
  }

  heros(id, herosId) {
    if (!this.partie || this.partie.phase !== PHASE.HEROS) return;
    if (!choisirHeros(this.partie, id, herosId).ok) return;
    this.touch();
    if (herosTousChoisis(this.partie)) return this.recrutement();
    this.pousser();
  }

  recrutement() {
    if (!this.partie) return;
    if (this.partie.phase === PHASE.HEROS) commencer(this.partie);
    if (this.partie.phase !== PHASE.RECRUTEMENT) return;
    const ms = this.sansHumain() ? 800 : dureeRecrutement(this.partie.tour) * 1000;
    this.armer(() => this.combat(), ms);
    this.pousser();
  }

  action(id, a) {
    if (!this.partie || this.partie.phase !== PHASE.RECRUTEMENT) return;
    const r = agir(this.partie, id, a);
    if (!r.ok) this.envoyer(id, { t: 'b:refus', raison: r.error });
    this.touch();
    if (a.type === 'pret' && humainsPrets(this.partie)) return this.combat();
    this.pousser();
  }

  combat() {
    const p = this.partie;
    if (!p || p.phase !== PHASE.RECRUTEMENT) return;
    this.stop();
    for (const j of vivants(p)) if (j.isBot) jouerBot(p, j.id);
    terminerRecrutement(p);

    // On attend la fin du plus long combat qu'un humain regarde.
    const humains = new Set(this.places.map((x) => x.id));
    const regardes = p.combats.filter((c) => humains.has(c.a) || humains.has(c.b));
    const ms = regardes.length
      ? Math.max(...regardes.map((c) => dureeCombat(c.events))) + MARGE_COMBAT_MS
      : 600;
    this.touch();
    this.armer(() => this.suite(), ms);
    this.pousser();
  }

  suite() {
    const p = this.partie;
    if (!p || p.phase !== PHASE.COMBAT) return;
    const r = finirCombats(p);
    if (r.fini) {
      this.armer(() => this.rouvrir(), FIN_MS);
      this.pousser();
      return;
    }
    this.recrutement();
  }

  rouvrir() {
    this.stop();
    this.partie = null;
    this.diffuser(this.vestiaire());
  }

  /**
   * Un départ. Au vestiaire, la chaise se libère ; en pleine partie, un bot
   * reprend la main, avec le plateau et l'or tels qu'ils étaient.
   */
  partir(id) {
    this.retirer(id);
    if (!this.partie) { if (this.places.length) this.diffuser(this.vestiaire()); return; }

    const j = joueurDe(this.partie, id);
    if (j && !j.isBot) {
      j.isBot = true;
      if (this.partie.phase === PHASE.HEROS) {
        choisirHerosBot(this.partie, id);
        if (herosTousChoisis(this.partie)) { this.recrutement(); return; }
      }
      if (this.partie.phase === PHASE.RECRUTEMENT && humainsPrets(this.partie)) { this.combat(); return; }
    }
    this.pousser();
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'Forgeron', code: null });
  conn.send({ t: 'b:bonjour', id: conn.id });
}

function quitter(c, id) {
  if (!c.code) return;
  const t = tables.get(c.code);
  c.code = null;
  if (!t) return;
  t.partir(id);
  if (t.places.length === 0) { t.stop(); tables.delete(t.code); }
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  quitter(c, conn.id);
  clients.delete(conn.id);
}

export function handleMessage(conn, msg) {
  const c = clients.get(conn.id);
  if (!c || !msg || typeof msg.t !== 'string') return;
  const table = () => (c.code && tables.get(c.code)) || null;

  switch (msg.t) {
    case 'ping':
      return conn.send({ t: 'pong' });

    case 'hello':
      c.name = nettoyerNom(msg.name);
      return conn.send({ t: 'b:hello', name: c.name });

    case 'create': {
      if (c.code) quitter(c, conn.id);
      c.name = nettoyerNom(msg.name, c.name);
      const t = new Table(nouveauCode(), conn.id);
      t.ajouter(conn.id, c.name);
      tables.set(t.code, t);
      c.code = t.code;
      return t.diffuser(t.vestiaire());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const t = tables.get(code);
      if (!t) return conn.send({ t: 'b:erreur', msg: 'Aucune table à ce code.' });
      if (c.code && c.code !== code) quitter(c, conn.id);
      c.name = nettoyerNom(msg.name, c.name);
      const r = t.ajouter(conn.id, c.name);
      if (!r.ok) return conn.send({ t: 'b:erreur', msg: r.error });
      c.code = code;
      return t.diffuser(t.vestiaire());
    }

    case 'start': {
      const t = table();
      if (!t || t.partie) return;
      if (t.hoteId !== conn.id) return conn.send({ t: 'b:erreur', msg: 'L\'hôte lance la partie.' });
      const r = t.commencer();
      if (!r.ok) conn.send({ t: 'b:erreur', msg: r.error });
      return;
    }

    case 'heros': {
      const t = table();
      if (t) t.heros(conn.id, String(msg.id || ''));
      return;
    }

    case 'action': {
      const t = table();
      const a = nettoyerAction(msg.a);
      if (t && a) t.action(conn.id, a);
      return;
    }

    case 'leave':
      quitter(c, conn.id);
      return conn.send({ t: 'b:parti' });

    default:
      return undefined;
  }
}

export function sweep() {
  const now = Date.now();
  for (const [code, t] of tables) {
    const ttl = t.partie ? PARTIE_TTL : TABLE_TTL;
    if (now - t.touchedAt > ttl || t.places.length === 0) {
      t.stop();
      t.diffuser({ t: 'b:erreur', msg: 'Table fermée pour inactivité.' });
      tables.delete(code);
    }
  }
}

export function stats() {
  return { tables: tables.size, enPartie: [...tables.values()].filter((t) => t.partie).length };
}
