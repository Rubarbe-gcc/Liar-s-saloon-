/**
 * ÉCHO — salons en ligne.
 *
 * Le serveur arbitre : il tient l'état de la partie, décide des phases et
 * calcule le classement. Les clients n'envoient que des intentions — plus une
 * chose que les deux autres jeux n'avaient pas : leur prise audio.
 *
 * Cette prise transite compressée (16 kHz mono, 8 bits logarithmiques, puis
 * base64), soit environ 85 ko pour quatre secondes. Le serveur ne la relit
 * jamais : il la relaie telle quelle au moment de la restitution. La NOTE,
 * elle, est recalculée ici à partir des trois dimensions transmises — un
 * client ne peut donc pas s'attribuer cent points, mais il pourrait mentir
 * sur ses dimensions. C'est un compromis assumé : analyser le signal côté
 * serveur coûterait bien plus que ce que la triche rapporte dans un jeu qui
 * se joue entre amis, à voix haute, où chacun entend ce que l'autre a produit.
 */

import {
  creerPartie, sonDeLaManche, lancerEnregistrement, deposerPrise,
  lancerRestitution, restitutionSuivante, encaisserNotes, tournerRoue,
  passerRoue, viser, finirOuContinuer, viewFor, prisesCompletes, roueTerminee,
  PHASE, DUREE_PRISE, JOUEURS_MAX,
} from '../public/shared/mimic/partie.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const SALON_TTL = 30 * 60 * 1000;
const PARTIE_TTL = 20 * 60 * 1000;

/** Marge laissée aux clients pour déposer leur prise, avant qu'on avance. */
export const DEPOT_MS = (DUREE_PRISE + 6) * 1000;
/** Au-delà, on considère qu'un joueur ne tournera pas la roue. */
export const ROUE_MS = 30 * 1000;
/** Taille maximale d'une prise transmise, en caractères base64. */
const PRISE_MAX = 200 * 1024;

const salons = new Map();
const clients = new Map();

const rnd = (n) => Math.floor(Math.random() * n);

function nouveauCode() {
  for (let i = 0; i < 200; i++) {
    let c = '';
    for (let k = 0; k < CODE_LEN; k++) c += ALPHABET[rnd(ALPHABET.length)];
    if (!salons.has(c)) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}

function nettoyerNom(brut, defaut = 'Voix') {
  const s = String(brut ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14);
  return s || defaut;
}

/** Ne garde d'une note que ce qui est plausible. */
function nettoyerNote(brut) {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.max(0, Math.min(100, Math.round(x))) : 0;
  };
  return { total: n(brut?.total), melodie: n(brut?.melodie), rythme: n(brut?.rythme), attaques: n(brut?.attaques) };
}

/* ------------------------------------------------------------------ */

class Salon {
  constructor(code, hoteId) {
    this.code = code;
    this.hoteId = hoteId;
    this.places = [];      // [{id, name}]
    this.partie = null;
    this.audio = new Map(); // joueurId -> base64 de la manche en cours
    this.timer = null;
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }
  indexOf(id) { return this.places.findIndex((p) => p.id === id); }
  a(id) { return this.indexOf(id) >= 0; }

  ajouter(id, name) {
    if (this.partie) return { ok: false, error: 'La partie a déjà commencé.' };
    if (this.places.length >= JOUEURS_MAX) return { ok: false, error: 'Le salon est plein.' };
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
      t: 'e:salon',
      code: this.code,
      hostId: this.hoteId,
      max: JOUEURS_MAX,
      joueurs: this.places.map((p) => ({ id: p.id, name: p.name })),
    };
  }

  pousser(extra = {}) {
    if (!this.partie) return;
    for (const p of this.places) {
      this.envoyer(p.id, { t: 'e:etat', vue: viewFor(this.partie, p.id), ...extra });
    }
  }

  /* -------------------- déroulement -------------------- */

  commencer() {
    if (this.places.length < 2) return { ok: false, error: 'Il faut être au moins deux.' };
    this.partie = creerPartie(this.places.map((p) => ({ id: p.id, name: p.name })));
    this.touch();
    this.diffuser({ t: 'e:debut' });
    this.manche();
    return { ok: true };
  }

  /** Ouvre une manche : le son part, puis on laisse enregistrer. */
  manche() {
    if (!this.partie) return;
    this.audio.clear();
    this.partie.phase = PHASE.ECOUTE;
    this.pousser({ sonId: sonDeLaManche(this.partie).id });

    // On laisse le temps d'écouter le son avant de lancer le chrono.
    this.armer(() => {
      if (!this.partie) return;
      lancerEnregistrement(this.partie);
      this.pousser();
      this.armer(() => this.restituer(), DEPOT_MS);
    }, 3500);
  }

  deposer(id, note, audioB64) {
    if (!this.partie || this.partie.phase !== PHASE.ENREGISTREMENT) return;
    const r = deposerPrise(this.partie, id, nettoyerNote(note));
    if (!r.ok) return;
    if (typeof audioB64 === 'string' && audioB64.length <= PRISE_MAX) {
      this.audio.set(id, audioB64);
    }
    this.touch();
    this.pousser();
    if (prisesCompletes(this.partie)) { this.stop(); this.restituer(); }
  }

  /** Rejoue les prises une par une, chacune avec son sabotage éventuel. */
  restituer() {
    if (!this.partie || this.partie.phase !== PHASE.ENREGISTREMENT) return;
    this.stop();
    lancerRestitution(this.partie);

    const suite = () => {
      if (!this.partie) return;
      const i = this.partie.tour;
      const j = this.partie.joueurs[i];
      if (!j) return;
      this.pousser({
        restitution: { index: i, id: j.id, sabotage: j.sabotage, audio: this.audio.get(j.id) || null },
      });
      // Assez pour jouer la prise, sans laisser le salon s'endormir.
      this.armer(() => {
        if (!this.partie) return;
        if (restitutionSuivante(this.partie)) return suite();
        this.pousser();
        this.armer(() => this.noter(), 1200);
      }, (DUREE_PRISE + 1.5) * 1000);
    };
    suite();
  }

  noter() {
    if (!this.partie || this.partie.phase !== PHASE.NOTES) return;
    encaisserNotes(this.partie);
    this.pousser();
    if (this.partie.phase === PHASE.ROUE) {
      this.armer(() => this.finirRoue(), ROUE_MS);
    } else {
      this.armer(() => this.suivante(), 2500);
    }
  }

  roue(id, quoi, cible) {
    if (!this.partie || this.partie.phase !== PHASE.ROUE) return;
    if (quoi === 'passer') passerRoue(this.partie, id);
    else if (quoi === 'viser') viser(this.partie, id, cible);
    else {
      const r = tournerRoue(this.partie, id);
      if (r.ok) this.envoyer(id, { t: 'e:roue', case: r.case, viser: !!r.viser });
    }
    this.touch();
    this.pousser();
    if (roueTerminee(this.partie)) { this.stop(); this.armer(() => this.suivante(), 1200); }
  }

  /** Clôt la roue même si quelqu'un traîne. */
  finirRoue() {
    if (!this.partie || this.partie.phase !== PHASE.ROUE) return;
    for (const j of this.partie.joueurs) {
      if (!j.aTourne) passerRoue(this.partie, j.id);
      j.sabotageEnMain = null;
    }
    this.pousser();
    this.armer(() => this.suivante(), 800);
  }

  suivante() {
    if (!this.partie) return;
    const r = finirOuContinuer(this.partie);
    if (r.fini) {
      this.pousser();
      this.stop();
      // On laisse le classement à l'écran, puis on rouvre le vestiaire.
      this.armer(() => this.rouvrir(), 15000);
      return;
    }
    this.manche();
  }

  rouvrir() {
    this.stop();
    this.partie = null;
    this.audio.clear();
    this.diffuser(this.vestiaire());
  }

  armer(fn, ms) { this.stop(); this.timer = setTimeout(fn, ms); }
  stop() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  /** Un départ en cours de partie : le joueur disparaît du tableau. */
  partir(id) {
    const enPartie = !!this.partie;
    this.retirer(id);
    this.audio.delete(id);
    if (!enPartie) { if (this.places.length) this.diffuser(this.vestiaire()); return; }

    const i = this.partie.joueurs.findIndex((j) => j.id === id);
    if (i >= 0) this.partie.joueurs.splice(i, 1);
    if (this.partie.joueurs.length < 2) {
      this.stop();
      this.diffuser({ t: 'e:abandon' });
      this.partie = null;
      if (this.places.length) this.diffuser(this.vestiaire());
      return;
    }
    this.pousser();
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'Voix', code: null });
  conn.send({ t: 'e:bonjour', id: conn.id });
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  if (c.code) {
    const s = salons.get(c.code);
    if (s) {
      s.partir(conn.id);
      if (s.places.length === 0) { s.stop(); salons.delete(s.code); }
    }
  }
  clients.delete(conn.id);
}

function quitter(c, id) {
  if (!c.code) return;
  const s = salons.get(c.code);
  c.code = null;
  if (!s) return;
  s.partir(id);
  if (s.places.length === 0) { s.stop(); salons.delete(s.code); }
}

export function handleMessage(conn, msg) {
  const c = clients.get(conn.id);
  if (!c || !msg || typeof msg.t !== 'string') return;

  switch (msg.t) {
    case 'ping':
      return conn.send({ t: 'pong' });

    case 'hello':
      c.name = nettoyerNom(msg.name);
      return conn.send({ t: 'e:hello', name: c.name });

    case 'create': {
      if (c.code) quitter(c, conn.id);
      c.name = nettoyerNom(msg.name, c.name);
      const s = new Salon(nouveauCode(), conn.id);
      s.ajouter(conn.id, c.name);
      salons.set(s.code, s);
      c.code = s.code;
      return s.diffuser(s.vestiaire());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const s = salons.get(code);
      if (!s) return conn.send({ t: 'e:erreur', msg: 'Aucun salon à ce code.' });
      if (c.code && c.code !== code) quitter(c, conn.id);
      c.name = nettoyerNom(msg.name, c.name);
      const r = s.ajouter(conn.id, c.name);
      if (!r.ok) return conn.send({ t: 'e:erreur', msg: r.error });
      c.code = code;
      return s.diffuser(s.vestiaire());
    }

    case 'start': {
      const s = c.code && salons.get(c.code);
      if (!s) return;
      if (s.hoteId !== conn.id) return conn.send({ t: 'e:erreur', msg: 'L\'hôte lance la partie.' });
      const r = s.commencer();
      if (!r.ok) conn.send({ t: 'e:erreur', msg: r.error });
      return;
    }

    case 'prise': {
      const s = c.code && salons.get(c.code);
      if (!s) return;
      return s.deposer(conn.id, msg.note, msg.audio);
    }

    case 'roue': {
      const s = c.code && salons.get(c.code);
      if (!s) return;
      return s.roue(conn.id, msg.quoi, msg.cible);
    }

    case 'leave': {
      quitter(c, conn.id);
      return conn.send({ t: 'e:parti' });
    }

    default:
      return undefined;
  }
}

export function sweep() {
  const now = Date.now();
  for (const [code, s] of salons) {
    const ttl = s.partie ? PARTIE_TTL : SALON_TTL;
    if (now - s.touchedAt > ttl || s.places.length === 0) {
      s.stop();
      s.diffuser({ t: 'e:erreur', msg: 'Salon fermé pour inactivité.' });
      salons.delete(code);
    }
  }
}

export function stats() {
  return { salons: salons.size, enPartie: [...salons.values()].filter((s) => s.partie).length };
}
