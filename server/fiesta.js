/**
 * FIESTA — les parties en ligne.
 *
 * Le serveur tient la partie (le moteur partagé `shared/fiesta/partie.js`)
 * et la rythme. Chacun joue le mini-jeu du tour sur son propre téléphone, en
 * même temps que les autres, et n'envoie que son score ; chacun arrête ses
 * dés chez lui, et n'envoie que les faces obtenues. Les scores des autres
 * restent cachés tant que le mini-jeu n'est pas fini.
 *
 * L'hôte peut compléter la table avec des joueurs de l'ordinateur. Un joueur
 * qui part en pleine partie est remplacé par l'ordinateur ; un joueur dont
 * la connexion tombe garde sa place cinq minutes (voir server/hub.js), et
 * l'ordinateur ne joue pour lui que le temps de son absence.
 */

import * as P from '../public/shared/fiesta/partie.js';
import { MINIJEU } from '../public/shared/fiesta/minijeux.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const TABLE_TTL = 30 * 60 * 1000;
const PARTIE_TTL = 30 * 60 * 1000;

/** Les délais de la table. */
export const DELAIS = {
  minijeu: 3 * 60 * 1000,  // pour finir le mini-jeu (le Mémo d'un champion peut durer)
  absentJeu: 15 * 1000,    // un absent : l'ordinateur joue le mini-jeu pour lui
  gardien: 60 * 1000,      // au moins ce temps-là au gardien, quand les tireurs ont fini
  resultats: 25 * 1000,    // les résultats, si tout le monde ne clique pas « aux dés »
  lancer: 30 * 1000,       // pour arrêter ses dés
  bot: 1200,               // l'ordinateur lance
  absent: 2500,            // on lance pour un joueur parti
  /** Les écrans animent chaque lancer (dés, pas, cases) : on les attend. 0 dans les tests. */
  animation: 1,
};

const NOMS_ORDI = P.NOMS_ORDI;
const AVATARS_ORDI = ['🤖', '👾', '🦾', '🛸', '🧠', '⚙️'];

const tables = new Map();
/** Connexions (places du hub), par identifiant. */
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

function nettoyerNom(brut, defaut = 'Joueur') {
  const s = String(brut ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12);
  return s || defaut;
}
const avatarValide = (a) => P.AVATARS.includes(a) ? a : null;

/** Combien de temps les écrans mettent à montrer un lancer. */
function dureeAnimation(r) {
  const pas = r.chemin.length + (r.effet ? r.effet.chemin.length : 0);
  const ms = (r.bloque ? 900 : 2000) + pas * 210 + (r.effet ? 1300 : 0) + 600;
  return ms * DELAIS.animation;
}

/* ------------------------------------------------------------------ */

export class Table {
  constructor(code, hoteId) {
    this.code = code;
    this.hoteId = hoteId;
    /** [{ id, name, av, bot, absent, remplace }] — l'ordre des places est celui de la partie. */
    this.places = [];
    this.options = { niveau: 'normal', longueur: 'normale', modes: 'tous' };
    this.p = null;
    this.timer = null;
    this.cle = null;
    this.echeance = 0;
    this.prets = new Set();
    /** Quand les écrans auront fini de montrer le dernier lancer. */
    this.libreA = 0;
    /** La fin du mini-jeu en cours. */
    this.finMinijeu = 0;
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }
  indexOf(id) { return this.places.findIndex((p) => p.id === id); }
  humains() { return this.places.filter((p) => !p.bot); }

  /** Un avatar libre : celui qu'on préfère, sinon le premier qui reste. */
  avatarLibre(voulu, sauf = null) {
    const pris = new Set(this.places.filter((p) => p.id !== sauf).map((p) => p.av));
    if (voulu && !pris.has(voulu)) return voulu;
    return P.AVATARS.find((a) => !pris.has(a)) || P.AVATARS[0];
  }

  ajouter(id, name, av) {
    if (this.p) return { ok: false, error: 'La partie a déjà commencé.' };
    if (this.indexOf(id) >= 0) return { ok: true };
    if (this.places.length >= P.JOUEURS_MAX) return { ok: false, error: `La table est pleine (${P.JOUEURS_MAX} places).` };
    this.places.push({ id, name, av: this.avatarLibre(av), bot: false });
    this.touch();
    return { ok: true };
  }

  ajouterBot() {
    if (this.p || this.places.length >= P.JOUEURS_MAX) return;
    const pris = new Set(this.places.map((p) => p.name));
    const k = Math.max(0, NOMS_ORDI.findIndex((x) => !pris.has(x)));
    const pav = new Set(this.places.map((p) => p.av));
    this.places.push({
      id: `bot-${Date.now().toString(36)}${rnd(1000)}`, name: NOMS_ORDI[k],
      av: AVATARS_ORDI.find((a) => !pav.has(a)) || this.avatarLibre(null), bot: true,
    });
    this.touch();
  }

  retirerBot() {
    if (this.p) return;
    for (let i = this.places.length - 1; i >= 0; i--) {
      if (this.places[i].bot) { this.places.splice(i, 1); this.touch(); return; }
    }
  }

  retirer(id) {
    const i = this.indexOf(id);
    if (i < 0) return;
    this.places.splice(i, 1);
    if (this.hoteId === id) this.hoteId = this.humains()[0]?.id || null;
    this.touch();
  }

  regler(o) {
    if (this.p || !o) return;
    if (P.NIVEAUX.includes(o.niveau)) this.options.niveau = o.niveau;
    if (P.LONGUEURS[o.longueur]) this.options.longueur = o.longueur;
    if (P.MODES.includes(o.modes)) this.options.modes = o.modes;
    this.touch();
  }

  envoyer(id, msg) {
    const c = clients.get(id);
    if (c && c.conn) { try { c.conn.send(msg); } catch { /* connexion morte */ } }
  }

  diffuser(msg) { for (const p of this.humains()) this.envoyer(p.id, msg); }

  salon() {
    return {
      t: 'fi:salon',
      code: this.code,
      hostId: this.hoteId,
      max: P.JOUEURS_MAX,
      enPartie: !!this.p,
      options: this.options,
      joueurs: this.places.map((p, i) => ({ id: p.id, name: p.name, av: p.av, bot: !!p.bot, absent: !!p.absent, couleur: P.COULEURS[i] })),
    };
  }

  /**
   * Ce qu'un joueur a le droit de voir : pendant le mini-jeu, seulement son
   * propre score — sauf le gardien des tirs au but, qui reçoit les tirs des
   * autres une fois qu'ils ont tous frappé, pour les affronter en direct.
   */
  vue(id) {
    const p = this.p;
    const moi = this.indexOf(id);
    const f = P.formatDe(p);
    const gardien = p.phase === 'minijeu' && f.type === 'seul' && MINIJEU[p.minijeu].soloEnDernier
      && f.equipes[0][0] === moi && !P.attendLesAutres(p, moi);
    const cache = p.phase === 'minijeu' && !gardien;
    return {
      p: { ...p, alea: 0, scores: cache ? p.scores.map((s, i) => (i === moi ? s : null)) : p.scores },
      faits: p.scores.map((s) => s !== null),
      moi,
      absents: this.places.map((x) => !!x.absent),
      bots: this.places.map((x) => !!x.bot),
      prets: this.places.map((x) => this.prets.has(x.id)),
      reste: Math.max(0, this.echeance - Date.now()),
      hote: this.hoteId,
    };
  }

  pousser() {
    if (!this.p) return;
    for (const x of this.humains()) this.envoyer(x.id, { t: 'fi:etat', vue: this.vue(x.id) });
  }

  stop() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.cle = null; }
  /** Programme la suite ; un même moment de la partie garde son échéance. */
  armer(fn, ms, cle = null) {
    if (cle && cle === this.cle && this.timer) return;
    this.stop();
    this.cle = cle;
    this.echeance = Date.now() + ms;
    this.timer = setTimeout(() => { this.timer = null; fn(); }, ms);
  }

  /* -------------------- déroulement -------------------- */

  commencer() {
    if (this.places.length < 2) return { ok: false, error: 'Il faut au moins deux joueurs (ajoutez un ordi ?).' };
    this.p = P.creerPartie({
      joueurs: this.places.map((x) => ({ nom: x.name, avatar: x.av, humain: !x.bot })),
      ...this.options,
      graine: `${this.code}${Date.now()}${Math.random()}`,
    });
    this.prets.clear();
    this.libreA = 0;
    this.finMinijeu = Date.now() + DELAIS.minijeu;
    this.touch();
    this.diffuser({ t: 'fi:debut' });
    this.avancer();
    return { ok: true };
  }

  /** Le moteur de la table : regarde où on en est et programme la suite. */
  avancer() {
    const p = this.p;
    if (!p) return;
    this.touch();
    switch (p.phase) {
      case 'minijeu': {
        // Les absents n'attendent pas : l'ordinateur joue pour eux.
        const reste = Math.max(0, this.finMinijeu - Date.now());
        const absents = this.places.some((x, i) => x.absent && p.scores[i] === null);
        const ms = absents ? Math.min(DELAIS.absentJeu, reste) : reste;
        this.armer(() => this.scoresManquants(!absents || ms === reste), ms, `mj:${p.tour}:${absents}`);
        break;
      }
      case 'resultats':
        this.armer(() => this.versLesDes(), DELAIS.resultats, `res:${p.tour}`);
        break;
      case 'des': {
        const i = P.quiLance(p);
        const x = this.places[i];
        // Coincé dans un trou : rien à lancer, on passe vite.
        const base = x.bot ? DELAIS.bot : x.absent || p.joueurs[i].bloque ? DELAIS.absent : DELAIS.lancer;
        const ms = Math.max(0, this.libreA - Date.now()) + base;
        this.armer(() => this.lancerPour(i), ms, `des:${p.tour}:${p.aJouer.length}:${base}`);
        break;
      }
      default:
        this.stop();
        this.echeance = 0;
        break;
    }
    this.pousser();
  }

  /** Le temps du mini-jeu est écoulé (ou un joueur est absent) : l'ordinateur joue pour eux. */
  scoresManquants(tous) {
    const p = this.p;
    if (!p || p.phase !== 'minijeu') return;
    this.places.forEach((x, i) => {
      if (p.phase === 'minijeu' && p.scores[i] === null && (tous || x.absent)) P.scoreAuto(p, i);
    });
    this.avancer();
  }

  score(id, v) {
    const p = this.p;
    const i = this.indexOf(id);
    if (!p || i < 0 || p.phase !== 'minijeu') return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    const r = P.score(p, i, Math.max(0, Math.min(99999, Math.round(n))));
    if (!r.ok) return;
    // Le gardien entre en jeu quand tous les tireurs ont frappé : il a le temps de jouer.
    const f = P.formatDe(p);
    if (p.phase === 'minijeu' && f.type === 'seul' && MINIJEU[p.minijeu].soloEnDernier
      && p.scores[f.equipes[0][0]] === null && !P.attendLesAutres(p, f.equipes[0][0])) {
      this.finMinijeu = Math.max(this.finMinijeu, Date.now() + DELAIS.gardien);
    }
    this.avancer();
  }

  pret(id) {
    const p = this.p;
    if (!p || p.phase !== 'resultats') return;
    this.prets.add(id);
    const presents = this.humains().filter((x) => !x.absent);
    if (presents.every((x) => this.prets.has(x.id))) { this.versLesDes(); return; }
    this.pousser();
  }

  versLesDes() {
    const p = this.p;
    if (!p || p.phase !== 'resultats') return;
    this.prets.clear();
    P.versLesDes(p);
    this.libreA = Date.now();
    this.avancer();
  }

  /** Un joueur lance (ses faces arrêtées), ou l'ordinateur pour lui. */
  lancerPour(i, tirage = null) {
    const p = this.p;
    if (!p || p.phase !== 'des' || P.quiLance(p) !== i) return { ok: false };
    const res = P.lancer(p, tirage);
    if (!res.ok) return res;
    this.diffuser({ t: 'fi:lance', r: res.resultat });
    this.libreA = Date.now() + dureeAnimation(res.resultat);
    // Un nouveau tour commence : le mini-jeu se joue une fois les pions arrivés.
    if (p.phase === 'minijeu') this.finMinijeu = this.libreA + DELAIS.minijeu;
    this.avancer();
    return res;
  }

  lancer(id, tirage) {
    const i = this.indexOf(id);
    if (i < 0 || !Array.isArray(tirage)) return;
    const r = this.lancerPour(i, tirage.slice(0, 2).map(Number));
    if (r.ok === false && r.raison) this.envoyer(id, { t: 'fi:erreur', msg: 'Ces dés ne sont pas valables.' });
  }

  /** Le gardien vient d'affronter un tir : les autres le voient en direct. */
  direct(id, e) {
    const p = this.p;
    const i = this.indexOf(id);
    if (!p || p.phase !== 'minijeu' || !e || typeof e !== 'object') return;
    const f = P.formatDe(p);
    if (f.type !== 'seul' || f.equipes[0][0] !== i) return;
    const evt = {
      tireur: f.equipes[1].includes(e.tireur) ? e.tireur : null,
      k: Math.max(0, Math.min(9, Number(e.k) || 0)),
      coin: [0, 1, 2].includes(e.coin) ? e.coin : null,
      resultat: ['arret', 'but', 'rate'].includes(e.resultat) ? e.resultat : null,
    };
    if (evt.tireur === null || !evt.resultat) return;
    for (const x of this.humains()) if (x.id !== id) this.envoyer(x.id, { t: 'fi:direct', i, e: evt });
  }

  /** Le joueur fait rouler ses dés : les autres le voient. */
  roule(id) {
    const p = this.p;
    const i = this.indexOf(id);
    if (!p || p.phase !== 'des' || P.quiLance(p) !== i) return;
    for (const x of this.humains()) if (x.id !== id) this.envoyer(x.id, { t: 'fi:roule', i });
  }

  /** Après la fin, retour au salon pour une revanche. */
  rouvrir() {
    this.stop();
    this.p = null;
    this.prets.clear();
    // Les places tenues par l'ordinateur à la place d'un joueur parti redeviennent libres.
    this.places = this.places.filter((x) => !x.remplace);
    this.diffuser(this.salon());
  }

  /** Un départ. Au salon, la chaise se libère ; en partie, l'ordinateur la reprend. */
  partir(id) {
    const i = this.indexOf(id);
    if (i < 0) return;
    if (!this.p || this.p.phase === 'fin') {
      this.retirer(id);
      if (this.humains().length) this.diffuser(this.salon());
      return;
    }
    const x = this.places[i];
    if (this.p.phase === 'minijeu' && this.p.scores[i] === null) P.scoreAuto(this.p, i);
    x.bot = true;
    x.remplace = true;
    x.absent = false;
    this.p.joueurs[i].humain = false;
    if (this.hoteId === id) this.hoteId = this.humains()[0]?.id || null;
    this.diffuser({ t: 'fi:notice', msg: `🤖 ${x.name} a quitté la partie : l’ordinateur prend sa place.` });
    this.avancer();
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'Joueur', av: null, code: null });
  conn.send({ t: 'fi:bienvenue', id: conn.id });
}

function quitter(c, id) {
  if (!c.code) return;
  const t = tables.get(c.code);
  c.code = null;
  if (!t) return;
  t.partir(id);
  if (!t.humains().length) { t.stop(); tables.delete(t.code); }
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  quitter(c, conn.id);
  clients.delete(conn.id);
}

const tableDe = (conn) => {
  const c = clients.get(conn.id);
  return (c && c.code && tables.get(c.code)) || null;
};

/* Coupures et retours (voir server/hub.js). */

export function enPartie(conn) {
  const t = tableDe(conn);
  return !!(t && t.p && t.p.phase !== 'fin');
}

export function handleAway(conn) {
  const t = tableDe(conn);
  const x = t && t.places[t.indexOf(conn.id)];
  if (!x) return;
  x.absent = true;
  t.diffuser({ t: 'fi:notice', msg: `📡 ${x.name} a perdu la connexion. Sa place l’attend 5 minutes.` });
  t.avancer();
}

export function handleResume(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  conn.send({ t: 'fi:bienvenue', id: conn.id });
  const t = tableDe(conn);
  if (!t) return;
  const x = t.places[t.indexOf(conn.id)];
  if (x && x.absent) {
    x.absent = false;
    t.diffuser({ t: 'fi:notice', msg: `✅ ${x.name} est de retour !` });
  }
  conn.send(t.salon());
  if (t.p) {
    conn.send({ t: 'fi:debut', reprise: true });
    t.avancer();
  }
}

export function handleMessage(conn, msg) {
  const c = clients.get(conn.id);
  if (!c || !msg || typeof msg.t !== 'string') return;
  const id = conn.id;
  const t = tableDe(conn);

  switch (msg.t) {
    case 'ping':
      return conn.send({ t: 'pong' });

    case 'hello':
      c.name = nettoyerNom(msg.name, c.name);
      c.av = avatarValide(msg.av) || c.av;
      return;

    case 'create': {
      if (c.code) quitter(c, id);
      c.name = nettoyerNom(msg.name, c.name);
      c.av = avatarValide(msg.av) || c.av;
      const nt = new Table(nouveauCode(), id);
      nt.ajouter(id, c.name, c.av);
      tables.set(nt.code, nt);
      c.code = nt.code;
      return nt.diffuser(nt.salon());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const nt = tables.get(code);
      if (!nt) return conn.send({ t: 'fi:erreur', msg: 'Aucune partie à ce code.' });
      if (c.code && c.code !== code) quitter(c, id);
      c.name = nettoyerNom(msg.name, c.name);
      c.av = avatarValide(msg.av) || c.av;
      const r = nt.ajouter(id, c.name, c.av);
      if (!r.ok) return conn.send({ t: 'fi:erreur', msg: r.error });
      c.code = code;
      return nt.diffuser(nt.salon());
    }

    case 'avatar': {
      if (!t || t.p) return;
      const x = t.places[t.indexOf(id)];
      if (!x) return;
      // L'avatar suivant qui n'est pas déjà pris.
      const k = P.AVATARS.indexOf(x.av);
      const pris = new Set(t.places.filter((y) => y !== x).map((y) => y.av));
      for (let d = 1; d <= P.AVATARS.length; d++) {
        const a = P.AVATARS[(k + d) % P.AVATARS.length];
        if (!pris.has(a)) { x.av = a; break; }
      }
      c.av = x.av;
      t.touch();
      return t.diffuser(t.salon());
    }

    case 'bot': {
      if (!t || t.p) return;
      if (t.hoteId !== id) return conn.send({ t: 'fi:erreur', msg: 'Seul l’hôte de la partie règle les ordis.' });
      if (msg.delta > 0) t.ajouterBot(); else t.retirerBot();
      return t.diffuser(t.salon());
    }

    case 'options': {
      if (!t || t.p) return;
      if (t.hoteId !== id) return conn.send({ t: 'fi:erreur', msg: 'Seul l’hôte de la partie choisit les réglages.' });
      t.regler(msg.options);
      return t.diffuser(t.salon());
    }

    case 'start': {
      if (!t || (t.p && t.p.phase !== 'fin')) return;
      if (t.hoteId !== id) return conn.send({ t: 'fi:erreur', msg: 'L’hôte de la partie la lance.' });
      if (t.p) t.rouvrir();
      const r = t.commencer();
      if (!r.ok) conn.send({ t: 'fi:erreur', msg: r.error });
      return;
    }

    case 'rejouer':
      if (!t || !t.p || t.p.phase !== 'fin') return;
      return t.rouvrir();

    case 'score':
      if (t) t.score(id, msg.v);
      return;

    case 'pret':
      if (t) t.pret(id);
      return;

    case 'roule':
      if (t) t.roule(id);
      return;

    case 'direct':
      if (t) t.direct(id, msg.e);
      return;

    case 'lancer':
      if (t) t.lancer(id, msg.tirage);
      return;

    case 'leave':
      quitter(c, id);
      return conn.send({ t: 'fi:parti' });

    default:
      return undefined;
  }
}

export function sweep() {
  const now = Date.now();
  for (const [code, t] of tables) {
    const ttl = t.p ? PARTIE_TTL : TABLE_TTL;
    if (now - t.touchedAt > ttl || !t.humains().length) {
      t.stop();
      t.diffuser({ t: 'fi:erreur', msg: 'Partie fermée pour inactivité.' });
      tables.delete(code);
    }
  }
}

export function stats() {
  return { tablesFiesta: tables.size, enPartieFiesta: [...tables.values()].filter((t) => t.p).length };
}
