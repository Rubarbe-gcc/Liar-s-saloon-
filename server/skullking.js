/**
 * SKULL KING — les tables en ligne.
 *
 * Le serveur tient la partie (le moteur partagé `shared/skullking/moteur.js`)
 * et rythme la table : paris, tours, plis, bilans. Les clients n'envoient que
 * des intentions et ne reçoivent que leur vue — leur main, jamais celle des
 * autres, et les paris des autres seulement une fois que tout le monde a
 * parié.
 *
 * L'hôte peut compléter la table avec des pirates de l'ordinateur. Un joueur
 * qui part en pleine partie est remplacé par un bot ; un joueur dont la
 * connexion tombe garde sa place cinq minutes (voir server/hub.js), et le
 * bot ne joue pour lui que quand c'est son tour.
 */

import * as S from '../public/shared/skullking/moteur.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const TABLE_TTL = 30 * 60 * 1000;
const PARTIE_TTL = 30 * 60 * 1000;

/** Les délais de la table. */
export const DELAIS = {
  pari: 45 * 1000,       // pour annoncer son pari
  tour: 40 * 1000,       // pour poser sa carte
  bot: 1000,             // un pirate de l'ordinateur réfléchit (un peu)
  absent: 2500,          // on joue pour un joueur parti
  pli: 2400,             // le pli complet reste sous les yeux
  poisson: 20 * 1000,    // pour changer son pari après le Poisson dégueulasse
  bilan: 25 * 1000,      // le bilan de manche, si tout le monde ne clique pas « prêt »
};

const BOTS = [
  { nom: 'Barbe-Grise', av: '🦜' }, { nom: 'Rosa la Rouge', av: '🌹' }, { nom: 'Jack Tortue', av: '🐢' },
  { nom: 'Bahia', av: '🗡️' }, { nom: 'Harald', av: '⚓' }, { nom: 'La Mouette', av: '🕊️' },
];
const AVATARS = ['🧭', '🦈', '🗝️', '🦀', '🍾', '🪝', '🐚'];

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

function nettoyerNom(brut, defaut = 'Moussaillon') {
  const s = String(brut ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14);
  return s || defaut;
}

/* ------------------------------------------------------------------ */

export class Table {
  constructor(code, hoteId) {
    this.code = code;
    this.hoteId = hoteId;
    /** [{ id, name, av, bot, absent }] — l'ordre des places est celui de la partie. */
    this.places = [];
    this.G = null;
    this.timer = null;
    this.echeance = 0;
    this.prets = new Set();
    this.cle = null;
    this.finParis = 0;
    /** Les cartes du mode custom choisies par le capitaine. */
    this.extras = [];
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }
  indexOf(id) { return this.places.findIndex((p) => p.id === id); }
  humains() { return this.places.filter((p) => !p.bot); }

  ajouter(id, name) {
    if (this.G) return { ok: false, error: 'La partie a déjà commencé.' };
    if (this.places.length >= S.MAX_JOUEURS) return { ok: false, error: 'La table est pleine (7 places).' };
    if (this.indexOf(id) >= 0) return { ok: true };
    const pris = new Set(this.places.map((p) => p.av));
    this.places.push({ id, name, av: AVATARS.find((a) => !pris.has(a)) || '🧭', bot: false });
    this.touch();
    return { ok: true };
  }

  ajouterBot() {
    if (this.G || this.places.length >= S.MAX_JOUEURS) return;
    const pris = new Set(this.places.map((p) => p.name));
    const b = BOTS.find((x) => !pris.has(x.nom)) || BOTS[0];
    this.places.push({ id: `bot-${Date.now().toString(36)}${rnd(1000)}`, name: b.nom, av: b.av, bot: true });
    this.touch();
  }

  retirerBot() {
    if (this.G) return;
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

  envoyer(id, msg) {
    const c = clients.get(id);
    if (c && c.conn) { try { c.conn.send(msg); } catch { /* connexion morte */ } }
  }

  diffuser(msg) { for (const p of this.humains()) this.envoyer(p.id, msg); }

  vestiaire() {
    return {
      t: 'sk:salon',
      code: this.code,
      hostId: this.hoteId,
      max: S.MAX_JOUEURS,
      enPartie: !!this.G,
      extras: this.extras,
      joueurs: this.places.map((p) => ({ id: p.id, name: p.name, av: p.av, bot: !!p.bot, absent: !!p.absent })),
    };
  }

  /** Ce qu'un joueur a le droit de voir. */
  vue(id) {
    const G = this.G;
    const moi = this.indexOf(id);
    const secret = G.phase === 'pari';
    return {
      phase: G.phase, manche: G.manche, manches: G.manches, n: G.n, moi,
      noms: G.noms, avatars: this.places.map((p) => p.av),
      bots: this.places.map((p) => !!p.bot), absents: this.places.map((p) => !!p.absent),
      scores: G.scores,
      paris: G.paris.map((b, i) => (secret && i !== moi ? null : b)),
      aParie: G.paris.map((b) => b !== null),
      // Le donneur parie en dernier : il voit le total des autres, et le chiffre interdit.
      donneurAttend: secret && moi === G.donneur && !S.autresOntParie(G, moi),
      totalAutres: secret && moi === G.donneur && S.autresOntParie(G, moi) ? S.totalAutres(G, moi) : null,
      interdit: secret && moi === G.donneur && S.autresOntParie(G, moi) ? S.pariInterdit(G, moi) : null,
      plis: G.plis, bonus: G.bonus,
      cartes: G.mains.map((m) => m.length),
      main: moi >= 0 ? G.mains[moi] : [],
      pli: G.pli, tour: G.tour, donneur: G.donneur,
      resolution: G.phase === 'pli' ? S.resoudre(G.pli) : null,
      dernier: G.dernier,
      historique: G.historique,
      prets: this.places.map((p) => this.prets.has(p.id)),
      reste: Math.max(0, this.echeance - Date.now()),
      hote: this.hoteId,
      extras: G.extras || [],
      poisson: G.poisson,
      sensPoisson: G.phase === 'poisson' && G.poisson && G.poisson.p === moi ? S.sensPossibles(G, moi) : [],
    };
  }

  pousser() {
    if (!this.G) return;
    for (const p of this.humains()) this.envoyer(p.id, { t: 'sk:etat', vue: this.vue(p.id) });
  }

  stop() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } this.cle = null; }
  /**
   * Programme la suite. Un même moment de la partie (même phase, même tour,
   * même délai) garde son échéance : un joueur qui revient ou qui part ne
   * rallonge pas le temps des autres.
   */
  armer(fn, ms, cle = null) {
    if (cle && cle === this.cle && this.timer) return;
    this.stop();
    this.cle = cle;
    this.echeance = Date.now() + ms;
    this.timer = setTimeout(() => { this.timer = null; fn(); }, ms);
  }

  /* -------------------- déroulement -------------------- */

  commencer() {
    if (this.places.length < 2) return { ok: false, error: 'Il faut au moins deux joueurs (ajoutez un bot ?).' };
    this.G = S.creerPartie({ noms: this.places.map((p) => p.name), bots: this.places.map((p) => !!p.bot), extras: this.extras });
    this.touch();
    this.diffuser({ t: 'sk:debut' });
    this.manche();
    return { ok: true };
  }

  manche() {
    S.nouvelleManche(this.G, Math.random);
    this.prets.clear();
    if (this.G.phase === 'fin') return this.finir();
    this.finParis = Date.now() + DELAIS.pari;
    // Les pirates de l'ordinateur parient tout de suite — sauf le donneur, qui parie en dernier.
    S.parierBots(this.G);
    this.avancer();
  }

  /** Le moteur de la table : regarde où on en est et programme la suite. */
  avancer() {
    const G = this.G;
    if (!G) return;
    this.touch();
    switch (G.phase) {
      case 'pari': {
        // Les paris ont une échéance fixe ; les absents, eux, n'attendent pas.
        const reste = Math.max(0, this.finParis - Date.now());
        const absents = this.places.some((p, i) => G.paris[i] === null && p.absent);
        const ms = absents ? Math.min(DELAIS.absent, reste) : reste;
        this.armer(() => this.parisManquants(!absents || ms === reste), ms, `pari:${G.manche}:${absents}`);
        break;
      }
      case 'jeu': {
        const p = this.places[G.tour];
        const ms = p.bot ? DELAIS.bot : p.absent ? DELAIS.absent : DELAIS.tour;
        this.armer(() => this.jouerPour(G.tour), ms, `jeu:${G.manche}:${G.tour}:${G.pli.length}:${G.plis.join()}:${ms}`);
        break;
      }
      case 'pli':
        this.armer(() => { S.ramasser(this.G); this.avancer(); }, DELAIS.pli, `pli:${G.manche}:${G.plis.join()}`);
        break;
      case 'poisson': {
        // Le gagnant du pli change son pari ; un bot ou un absent le fait aussitôt.
        const p = this.places[G.poisson.p];
        const ms = p.bot ? DELAIS.bot : p.absent ? DELAIS.absent : DELAIS.poisson;
        this.armer(() => this.poissonPour(G.poisson.p), ms, `poisson:${G.manche}:${G.plis.join()}`);
        break;
      }
      case 'bilan':
        this.armer(() => this.manche(), DELAIS.bilan, `bilan:${G.manche}`);
        break;
      default:
        break;
    }
    this.pousser();
  }

  /** Le temps de parier est écoulé (ou un joueur est parti) : on parie pour eux. */
  parisManquants(tous) {
    const G = this.G;
    if (!G || G.phase !== 'pari') return;
    const d = S.dernierAParier(G);
    this.places.forEach((p, i) => {
      if (i !== d && G.paris[i] === null && (tous || p.absent)) S.parier(G, i, S.pariPour(G, i));
    });
    // Le donneur, en dernier : pour lui (s'il est parti ou trop lent), ou pour le bot qui tient sa place.
    if (G.paris[d] === null && S.autresOntParie(G, d) && (tous || this.places[d].absent || this.places[d].bot)) {
      S.parier(G, d, S.pariPour(G, d));
    }
    this.avancer();
  }

  /** Un bot, un absent ou un joueur trop lent : l'ordinateur pose la carte. */
  jouerPour(p) {
    const G = this.G;
    if (!G || G.phase !== 'jeu' || G.tour !== p) return;
    const c = S.coupBot(G, p);
    S.jouer(G, p, c.id, c.as);
    this.avancer();
  }

  /** Le temps est écoulé (ou c'est un bot) : l'ordinateur choisit le sens. */
  poissonPour(p) {
    const G = this.G;
    if (!G || G.phase !== 'poisson' || !G.poisson || G.poisson.p !== p) return;
    S.changerPari(G, p, S.sensBot(G, p));
    this.avancer();
  }

  poisson(id, sens) {
    const G = this.G;
    const i = this.indexOf(id);
    if (!G || i < 0) return;
    const r = S.changerPari(G, i, sens);
    if (!r.ok) return this.envoyer(id, { t: 'sk:erreur', msg: r.raison });
    this.avancer();
  }

  pari(id, v) {
    const G = this.G;
    const i = this.indexOf(id);
    if (!G || i < 0 || G.phase !== 'pari' || G.paris[i] !== null) return;
    const r = S.parier(G, i, v);
    if (!r.ok) return this.envoyer(id, { t: 'sk:erreur', msg: r.raison });
    // Un bot donneur attendait les autres : à lui.
    S.parierBots(G);
    if (G.phase === 'jeu') this.avancer();
    else { this.touch(); this.pousser(); }
  }

  jouer(id, carte, as) {
    const G = this.G;
    const i = this.indexOf(id);
    if (!G || i < 0) return;
    const r = S.jouer(G, i, String(carte || ''), as === 'pir' || as === 'esc' ? as : null);
    if (!r.ok) return this.envoyer(id, { t: 'sk:erreur', msg: r.raison });
    this.avancer();
  }

  pret(id) {
    if (!this.G || this.G.phase !== 'bilan') return;
    this.prets.add(id);
    const presents = this.humains().filter((p) => !p.absent);
    if (presents.every((p) => this.prets.has(p.id))) { this.stop(); this.manche(); return; }
    this.pousser();
  }

  finir() {
    this.stop();
    this.echeance = 0;
    this.pousser();
  }

  /** Après la fin, l'hôte ramène tout le monde à la table pour une revanche. */
  rouvrir() {
    this.stop();
    this.G = null;
    this.prets.clear();
    // Les places tenues par des bots de remplacement redeviennent libres.
    this.places = this.places.filter((p) => !p.remplace);
    this.diffuser(this.vestiaire());
  }

  /** Un départ. Au vestiaire, la chaise se libère ; en partie, un bot la reprend. */
  partir(id) {
    const i = this.indexOf(id);
    if (i < 0) return;
    if (!this.G || this.G.phase === 'fin') {
      this.retirer(id);
      if (this.humains().length) this.diffuser(this.vestiaire());
      return;
    }
    const p = this.places[i];
    p.bot = true;
    p.remplace = true;
    p.absent = false;
    this.G.bots[i] = true;
    if (this.hoteId === id) this.hoteId = this.humains()[0]?.id || null;
    this.diffuser({ t: 'sk:notice', msg: `🦜 ${p.name} a quitté la table : un pirate de l’ordinateur prend sa place.` });
    this.avancer();
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'Moussaillon', code: null });
  conn.send({ t: 'sk:bienvenue', id: conn.id });
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
  return !!(t && t.G && t.G.phase !== 'fin');
}

export function handleAway(conn) {
  const t = tableDe(conn);
  const p = t && t.places[t.indexOf(conn.id)];
  if (!p) return;
  p.absent = true;
  t.diffuser({ t: 'sk:notice', msg: `📡 ${p.name} a perdu la connexion. Sa place l’attend 5 minutes.` });
  t.avancer();
}

export function handleResume(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  conn.send({ t: 'sk:bienvenue', id: conn.id });
  const t = tableDe(conn);
  if (!t) return;
  const p = t.places[t.indexOf(conn.id)];
  if (p && p.absent) {
    p.absent = false;
    t.diffuser({ t: 'sk:notice', msg: `✅ ${p.name} est de retour à bord.` });
  }
  conn.send(t.vestiaire());
  if (t.G) {
    conn.send({ t: 'sk:debut', reprise: true });
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
      return;

    case 'create': {
      if (c.code) quitter(c, id);
      c.name = nettoyerNom(msg.name, c.name);
      const nt = new Table(nouveauCode(), id);
      nt.ajouter(id, c.name);
      tables.set(nt.code, nt);
      c.code = nt.code;
      return nt.diffuser(nt.vestiaire());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const nt = tables.get(code);
      if (!nt) return conn.send({ t: 'sk:erreur', msg: 'Aucune table à ce code.' });
      if (c.code && c.code !== code) quitter(c, id);
      c.name = nettoyerNom(msg.name, c.name);
      const r = nt.ajouter(id, c.name);
      if (!r.ok) return conn.send({ t: 'sk:erreur', msg: r.error });
      c.code = code;
      return nt.diffuser(nt.vestiaire());
    }

    case 'bot': {
      if (!t || t.G) return;
      if (t.hoteId !== id) return conn.send({ t: 'sk:erreur', msg: 'Seul le capitaine de la table règle les bots.' });
      if (msg.delta > 0) t.ajouterBot(); else t.retirerBot();
      return t.diffuser(t.vestiaire());
    }

    case 'options': {
      if (!t || t.G) return;
      if (t.hoteId !== id) return conn.send({ t: 'sk:erreur', msg: 'Seul le capitaine de la table choisit les cartes.' });
      t.extras = S.nettoyerExtras(msg.extras);
      t.touch();
      return t.diffuser(t.vestiaire());
    }

    case 'start': {
      if (!t || (t.G && t.G.phase !== 'fin')) return;
      if (t.hoteId !== id) return conn.send({ t: 'sk:erreur', msg: 'Le capitaine de la table lance la partie.' });
      if (t.G) t.rouvrir();
      const r = t.commencer();
      if (!r.ok) conn.send({ t: 'sk:erreur', msg: r.error });
      return;
    }

    case 'rejouer': {
      if (!t || !t.G || t.G.phase !== 'fin') return;
      return t.rouvrir();
    }

    case 'pari':
      if (t) t.pari(id, Number(msg.v));
      return;

    case 'jouer':
      if (t) t.jouer(id, msg.id, msg.as);
      return;

    case 'poisson':
      if (t) t.poisson(id, Number(msg.sens));
      return;

    case 'pret':
      if (t) t.pret(id);
      return;

    case 'leave':
      quitter(c, id);
      return conn.send({ t: 'sk:parti' });

    default:
      return undefined;
  }
}

export function sweep() {
  const now = Date.now();
  for (const [code, t] of tables) {
    const ttl = t.G ? PARTIE_TTL : TABLE_TTL;
    if (now - t.touchedAt > ttl || !t.humains().length) {
      t.stop();
      t.diffuser({ t: 'sk:erreur', msg: 'Table fermée pour inactivité.' });
      tables.delete(code);
    }
  }
}

export function stats() {
  return { tablesSkullKing: tables.size, enPartieSkullKing: [...tables.values()].filter((t) => t.G).length };
}
