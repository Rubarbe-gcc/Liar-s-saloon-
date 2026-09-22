/**
 * ZÉNITH — arènes en ligne.
 *
 * Même principe que les salons de Liar's Saloon : le serveur est l'autorité,
 * le client n'envoie que des intentions. La différence est que le combat est
 * temps réel — le serveur fait donc tourner l'horloge et diffuse l'état à
 * chaque tick, plutôt que d'attendre une action.
 */

import {
  createBattle, step, queueAction, viewFor, TICK_MS, PHASE, TEAM_SIZE,
} from '../public/shared/zenith/battle.js';
import { getFighter, randomTeam } from '../public/shared/zenith/fighters.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const SEATS = 2;
const ARENA_TTL = 30 * 60 * 1000;
const MATCH_TTL = 15 * 60 * 1000;

/** @type {Map<string, Arena>} */
const arenas = new Map();
/** @type {Map<string, {conn:any,name:string,team:string[]|null,code:string|null}>} */
const clients = new Map();

const rnd = (n) => Math.floor(Math.random() * n);

function newCode() {
  for (let i = 0; i < 200; i++) {
    let c = '';
    for (let k = 0; k < CODE_LEN; k++) c += ALPHABET[rnd(ALPHABET.length)];
    if (!arenas.has(c)) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}

function cleanName(raw, fallback = 'Challenger') {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14);
  return s || fallback;
}

/** N'accepte qu'une équipe de combattants réels, sans doublon. */
function cleanTeam(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (typeof id !== 'string' || seen.has(id) || !getFighter(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === TEAM_SIZE) break;
  }
  // Une équipe incomplète est complétée plutôt que rejetée : un client
  // bavard ne doit pas pouvoir bloquer l'arène.
  while (out.length < TEAM_SIZE) {
    const fill = randomTeam(TEAM_SIZE).find((id) => !seen.has(id));
    if (!fill) break;
    seen.add(fill);
    out.push(fill);
  }
  return out.length === TEAM_SIZE ? out : null;
}

/* ------------------------------------------------------------------ */

class Arena {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.seats = [];        // [{id, name, team}]
    this.battle = null;
    this.timer = null;
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }
  has(id) { return this.seats.some((s) => s.id === id); }
  seatOf(id) { return this.seats.find((s) => s.id === id) || null; }
  indexOf(id) { return this.seats.findIndex((s) => s.id === id); }

  add(id, name) {
    if (this.battle) return { ok: false, error: 'Le combat a déjà commencé.' };
    if (this.seats.length >= SEATS) return { ok: false, error: 'L\'arène est pleine.' };
    if (this.has(id)) return { ok: true };
    this.seats.push({ id, name, team: null });
    this.touch();
    return { ok: true };
  }

  remove(id) {
    const i = this.indexOf(id);
    if (i < 0) return;
    this.seats.splice(i, 1);
    if (this.hostId === id && this.seats.length) this.hostId = this.seats[0].id;
    this.touch();
  }

  send(id, msg) {
    const c = clients.get(id);
    if (c && c.conn) { try { c.conn.send(msg); } catch { /* connexion morte */ } }
  }

  broadcast(msg) { for (const s of this.seats) this.send(s.id, msg); }

  lobby() {
    return {
      t: 'z:room',
      code: this.code,
      hostId: this.hostId,
      max: SEATS,
      players: this.seats.map((s) => ({ id: s.id, name: s.name, ready: !!s.team })),
    };
  }

  setTeam(id, team) {
    const seat = this.seatOf(id);
    if (!seat || this.battle) return false;
    seat.team = team;
    this.touch();
    this.broadcast(this.lobby());
    return true;
  }

  begin() {
    if (this.seats.length < SEATS) return { ok: false, error: 'Il faut deux combattants.' };
    if (this.seats.some((s) => !s.team)) return { ok: false, error: 'Les deux équipes ne sont pas prêtes.' };

    this.battle = createBattle(this.seats.map((s) => ({ id: s.id, name: s.name, team: s.team })));
    this.touch();
    this.broadcast({ t: 'z:begin' });
    this.pushState([]);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    return { ok: true };
  }

  tick() {
    if (!this.battle) return this.stopClock();
    const effects = step(this.battle);
    this.pushState(effects);

    if (this.battle.phase === PHASE.OVER) {
      this.stopClock();
      this.touch();
      // On garde l'état final : les clients l'affichent, puis reviennent au
      // vestiaire de leur propre initiative.
      setTimeout(() => { this.resetToLobby(); }, 8000);
    }
  }

  pushState(effects) {
    if (!this.battle) return;
    for (const seat of this.seats) {
      this.send(seat.id, { t: 'z:tick', view: viewFor(this.battle, seat.id), effects });
    }
  }

  act(id, action) {
    if (!this.battle || this.battle.phase !== PHASE.FIGHT) return;
    const i = this.indexOf(id);
    if (i < 0) return;
    const res = queueAction(this.battle, i, action);
    if (!res.ok) this.send(id, { t: 'z:reject', reason: res.error });
    this.touch();
  }

  resetToLobby() {
    this.battle = null;
    for (const s of this.seats) s.team = null;
    this.broadcast(this.lobby());
  }

  stopClock() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  /** Un départ en plein combat donne la victoire à celui qui reste. */
  drop(id) {
    const wasFighting = !!this.battle && this.battle.phase === PHASE.FIGHT;
    const i = this.indexOf(id);
    this.remove(id);

    if (wasFighting && i >= 0) {
      this.stopClock();
      const b = this.battle;
      b.phase = PHASE.OVER;
      b.winner = 1 - i;
      this.battle = null;
      for (const seat of this.seats) {
        this.send(seat.id, { t: 'z:forfeit', view: viewFor(b, seat.id) });
      }
      return;
    }
    if (this.seats.length) this.broadcast(this.lobby());
  }
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'Challenger', team: null, code: null });
  conn.send({ t: 'z:welcome', id: conn.id });
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  if (c.code) {
    const a = arenas.get(c.code);
    if (a) {
      a.drop(conn.id);
      if (a.seats.length === 0) { a.stopClock(); arenas.delete(a.code); }
    }
  }
  clients.delete(conn.id);
}

function leave(c, id) {
  if (!c.code) return;
  const a = arenas.get(c.code);
  c.code = null;
  if (!a) return;
  a.drop(id);
  if (a.seats.length === 0) { a.stopClock(); arenas.delete(a.code); }
}

export function handleMessage(conn, msg) {
  const c = clients.get(conn.id);
  if (!c || !msg || typeof msg.t !== 'string') return;

  switch (msg.t) {
    case 'ping':
      return conn.send({ t: 'pong' });

    case 'hello':
      c.name = cleanName(msg.name);
      return conn.send({ t: 'z:hello', name: c.name });

    case 'create': {
      if (c.code) leave(c, conn.id);
      c.name = cleanName(msg.name, c.name);
      const a = new Arena(newCode(), conn.id);
      a.add(conn.id, c.name);
      arenas.set(a.code, a);
      c.code = a.code;
      return a.broadcast(a.lobby());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const a = arenas.get(code);
      if (!a) return conn.send({ t: 'z:error', msg: 'Aucune arène à ce code.' });
      if (c.code && c.code !== code) leave(c, conn.id);
      c.name = cleanName(msg.name, c.name);
      const res = a.add(conn.id, c.name);
      if (!res.ok) return conn.send({ t: 'z:error', msg: res.error });
      c.code = code;
      return a.broadcast(a.lobby());
    }

    case 'team': {
      const a = c.code && arenas.get(c.code);
      if (!a) return;
      const team = cleanTeam(msg.team);
      if (!team) return conn.send({ t: 'z:error', msg: 'Équipe invalide.' });
      a.setTeam(conn.id, team);
      return;
    }

    case 'start': {
      const a = c.code && arenas.get(c.code);
      if (!a) return;
      if (a.hostId !== conn.id) return conn.send({ t: 'z:error', msg: 'L\'hôte lance le combat.' });
      const res = a.begin();
      if (!res.ok) conn.send({ t: 'z:error', msg: res.error });
      return;
    }

    case 'act': {
      const a = c.code && arenas.get(c.code);
      if (!a) return;
      return a.act(conn.id, msg.action || {});
    }

    case 'lobby': {
      const a = c.code && arenas.get(c.code);
      if (!a) return;
      a.resetToLobby();
      return;
    }

    case 'leave': {
      leave(c, conn.id);
      return conn.send({ t: 'z:left' });
    }

    default:
      return undefined;
  }
}

export function sweep() {
  const now = Date.now();
  for (const [code, a] of arenas) {
    const ttl = a.battle ? MATCH_TTL : ARENA_TTL;
    if (now - a.touchedAt > ttl || a.seats.length === 0) {
      a.stopClock();
      a.broadcast({ t: 'z:error', msg: 'Arène fermée pour inactivité.' });
      arenas.delete(code);
    }
  }
}

export function stats() {
  return {
    arenas: arenas.size,
    fighting: [...arenas.values()].filter((a) => a.battle).length,
  };
}
