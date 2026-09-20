/**
 * Salons en ligne : autorite de jeu, independante du transport.
 *
 * Ce module ne connait que des « connexions » exposant `send(obj)` et
 * `close()`. Il est donc utilisable aussi bien derriere le serveur Node
 * autonome que derriere une Function Vercel.
 *
 * Regle de base : le client n'envoie que des intentions, jamais d'etat. Le
 * serveur valide tout, et ne renvoie a chaque joueur que ce qu'il a le droit
 * de voir (sa main, et le nombre de cartes des autres).
 */

import {
  createGame, startRound, playCards, challenge, forceTimeout, eliminate,
  viewFor, currentPlayer, PHASE,
} from '../public/shared/engine.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1
const CODE_LEN = 4;
const MAX_SEATS = 4;
const MIN_SEATS = 2;
const TURN_MS = 30000;
const INTERMISSION_MS = 3200;
const ROOM_TTL_MS = 45 * 60 * 1000;   // salon abandonne
const LOBBY_TTL_MS = 30 * 60 * 1000;  // salon jamais lance

/** @type {Map<string, Room>} */
const rooms = new Map();
/** @type {Map<string, {conn:any, name:string, avatar:string, roomCode:string|null}>} */
const clients = new Map();

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const rnd = (n) => Math.floor(Math.random() * n);

function newCode() {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LEN; i++) code += CODE_ALPHABET[rnd(CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  // Repli improbable : on allonge le code plutot que d'echouer.
  return `${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Nettoie un nom fourni par le client. */
function cleanName(raw, fallback = 'Inconnu') {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
  return s || fallback;
}

/** N'accepte qu'un avatar issu d'une liste connue. */
const AVATARS = ['🤠', '🎩', '🌹', '🪕', '🪭', '⚰️', '💄', '🐎', '🥃', '🍀', '🌵', '🃏', '🎯', '👺', '🦂', '🕯️'];
function cleanAvatar(raw) {
  return AVATARS.includes(raw) ? raw : AVATARS[rnd(AVATARS.length)];
}

/* ------------------------------------------------------------------ */
/* Salon                                                               */
/* ------------------------------------------------------------------ */

class Room {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    /** @type {Array<{id:string,name:string,avatar:string}>} */
    this.seats = [];
    this.state = null;
    this.phase = 'lobby'; // lobby | playing
    this.timer = null;
    this.createdAt = Date.now();
    this.touchedAt = Date.now();
  }

  touch() { this.touchedAt = Date.now(); }

  has(id) { return this.seats.some((s) => s.id === id); }

  seatOf(id) { return this.seats.find((s) => s.id === id) || null; }

  add(id, name, avatar) {
    if (this.seats.length >= MAX_SEATS) return { ok: false, error: 'La table est complète.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'La partie a déjà commencé.' };
    if (this.has(id)) return { ok: true };
    this.seats.push({ id, name, avatar: this.freeAvatar(avatar) });
    this.touch();
    return { ok: true };
  }

  /** Garde l'avatar demande s'il est libre, sinon en attribue un autre. */
  freeAvatar(wanted) {
    const taken = new Set(this.seats.map((s) => s.avatar));
    if (!taken.has(wanted)) return wanted;
    return AVATARS.find((a) => !taken.has(a)) || wanted;
  }

  remove(id) {
    const i = this.seats.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.seats.splice(i, 1);
    if (this.hostId === id && this.seats.length) this.hostId = this.seats[0].id;
    this.touch();
  }

  /** Diffuse un message a toutes les connexions encore presentes. */
  broadcast(msg) {
    for (const seat of this.seats) {
      const c = clients.get(seat.id);
      if (c && c.conn) { try { c.conn.send(msg); } catch { /* connexion morte */ } }
    }
  }

  /** Envoie a chacun sa propre vue de l'etat. */
  pushState(events = []) {
    if (!this.state) return;
    for (const seat of this.seats) {
      const c = clients.get(seat.id);
      if (!c || !c.conn) continue;
      try {
        c.conn.send({ t: 'state', view: viewFor(this.state, seat.id), events });
      } catch { /* connexion morte */ }
    }
  }

  lobbyPayload() {
    return {
      t: 'room',
      code: this.code,
      hostId: this.hostId,
      max: MAX_SEATS,
      min: MIN_SEATS,
      players: this.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar })),
    };
  }

  clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  /* ---------------- deroulement ---------------- */

  begin() {
    if (this.seats.length < MIN_SEATS) return { ok: false, error: 'Il faut au moins deux joueurs.' };
    this.phase = 'playing';
    this.state = createGame(
      this.seats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar })),
      { turnMs: TURN_MS },
    );
    this.touch();
    this.broadcast({ t: 'begin' });
    this.pushState([{ type: 'newRound', round: 1, tableCard: this.state.tableCard, openerId: currentPlayer(this.state).id }]);
    this.schedule();
    return { ok: true };
  }

  /** Programme la prochaine echeance : fin de tour ou fin d'entracte. */
  schedule() {
    this.clearTimer();
    if (!this.state) return;

    if (this.state.phase === PHASE.INTERMISSION) {
      this.timer = setTimeout(() => this.nextRound(), INTERMISSION_MS);
      return;
    }
    if (this.state.phase === PHASE.PLAYING) {
      const delay = Math.max(500, this.state.turnDeadline - Date.now() + 250);
      this.timer = setTimeout(() => this.onTimeout(), delay);
    }
  }

  nextRound() {
    if (!this.state || this.state.phase !== PHASE.INTERMISSION) return;
    const events = startRound(this.state);
    this.touch();
    this.pushState(events);
    if (this.state.phase === PHASE.GAME_OVER) return this.finish();
    this.schedule();
  }

  onTimeout() {
    if (!this.state || this.state.phase !== PHASE.PLAYING) return;
    const res = forceTimeout(this.state);
    this.touch();
    this.pushState(res.events);
    if (this.state.phase === PHASE.GAME_OVER) return this.finish();
    this.schedule();
  }

  /** Applique une action de joueur apres validation. */
  act(playerId, msg) {
    if (!this.state || this.state.phase !== PHASE.PLAYING) return;
    const cur = currentPlayer(this.state);
    if (!cur || cur.id !== playerId) return;

    let res;
    if (msg.t === 'challenge') {
      res = challenge(this.state, playerId);
    } else {
      const indices = Array.isArray(msg.indices)
        ? msg.indices.filter((n) => Number.isInteger(n)).slice(0, 3)
        : [];
      res = playCards(this.state, playerId, indices);
    }

    if (!res.ok) {
      const c = clients.get(playerId);
      if (c && c.conn) c.conn.send({ t: 'reject', reason: res.error });
      return;
    }

    this.touch();
    this.pushState(res.events);
    if (this.state.phase === PHASE.GAME_OVER) return this.finish();
    this.schedule();
  }

  finish() {
    this.clearTimer();
    this.phase = 'lobby';
    // On garde l'etat final : les clients l'affichent, puis reviennent au salon.
    this.touch();
  }

  /** Retire un joueur, en cours de partie ou non. */
  drop(playerId) {
    if (this.state && this.state.phase !== PHASE.GAME_OVER && this.phase === 'playing') {
      const events = eliminate(this.state, playerId, 'quit');
      this.remove(playerId);
      if (this.seats.length === 0) return;
      this.pushState(events);
      if (this.state.phase === PHASE.GAME_OVER) this.finish();
      else this.schedule();
      return;
    }
    this.remove(playerId);
    if (this.seats.length) this.broadcast(this.lobbyPayload());
  }
}

/* ------------------------------------------------------------------ */
/* Point d'entree transport                                            */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, name: 'Inconnu', avatar: '🤠', roomCode: null });
  conn.send({ t: 'welcome', id: conn.id });
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  if (!c) return;
  if (c.roomCode) {
    const room = rooms.get(c.roomCode);
    if (room) {
      room.drop(conn.id);
      if (room.seats.length === 0) { room.clearTimer(); rooms.delete(room.code); }
    }
  }
  clients.delete(conn.id);
}

export function handleMessage(conn, msg) {
  const c = clients.get(conn.id);
  if (!c || !msg || typeof msg.t !== 'string') return;

  switch (msg.t) {
    case 'ping':
      return conn.send({ t: 'pong' });

    case 'hello':
      c.name = cleanName(msg.name);
      c.avatar = cleanAvatar(msg.avatar);
      return conn.send({ t: 'hello', name: c.name, avatar: c.avatar });

    case 'create': {
      if (c.roomCode) leaveRoom(c, conn.id);
      c.name = cleanName(msg.name, c.name);
      c.avatar = cleanAvatar(msg.avatar || c.avatar);
      const room = new Room(newCode(), conn.id);
      room.add(conn.id, c.name, c.avatar);
      rooms.set(room.code, room);
      c.roomCode = room.code;
      return room.broadcast(room.lobbyPayload());
    }

    case 'join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      const room = rooms.get(code);
      if (!room) return conn.send({ t: 'error', msg: 'Aucune table à ce code.' });
      if (c.roomCode && c.roomCode !== code) leaveRoom(c, conn.id);

      c.name = cleanName(msg.name, c.name);
      c.avatar = cleanAvatar(msg.avatar || c.avatar);
      const res = room.add(conn.id, c.name, c.avatar);
      if (!res.ok) return conn.send({ t: 'error', msg: res.error });
      c.roomCode = code;
      c.avatar = room.seatOf(conn.id).avatar;
      return room.broadcast(room.lobbyPayload());
    }

    case 'leave': {
      leaveRoom(c, conn.id);
      return conn.send({ t: 'left' });
    }

    case 'start': {
      const room = c.roomCode && rooms.get(c.roomCode);
      if (!room) return;
      if (room.hostId !== conn.id) return conn.send({ t: 'error', msg: 'Seul l\'hôte lance la partie.' });
      if (room.phase === 'playing') return;
      const res = room.begin();
      if (!res.ok) conn.send({ t: 'error', msg: res.error });
      return;
    }

    case 'play':
    case 'challenge': {
      const room = c.roomCode && rooms.get(c.roomCode);
      if (!room) return;
      return room.act(conn.id, msg);
    }

    case 'back-to-lobby': {
      const room = c.roomCode && rooms.get(c.roomCode);
      if (!room) return;
      room.state = null;
      return conn.send(room.lobbyPayload());
    }

    default:
      return undefined;
  }
}

function leaveRoom(c, id) {
  if (!c.roomCode) return;
  const room = rooms.get(c.roomCode);
  c.roomCode = null;
  if (!room) return;
  room.drop(id);
  if (room.seats.length === 0) { room.clearTimer(); rooms.delete(room.code); }
}

/* ------------------------------------------------------------------ */
/* Entretien                                                           */
/* ------------------------------------------------------------------ */

/** Ferme les salons oublies, pour que la memoire ne grimpe pas sans fin. */
export function sweep() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const idle = now - room.touchedAt;
    const ttl = room.phase === 'lobby' ? LOBBY_TTL_MS : ROOM_TTL_MS;
    if (idle > ttl || room.seats.length === 0) {
      room.clearTimer();
      room.broadcast({ t: 'error', msg: 'Table fermée pour inactivité.' });
      rooms.delete(code);
    }
  }
}

export function stats() {
  return {
    rooms: rooms.size,
    clients: clients.size,
    playing: [...rooms.values()].filter((r) => r.phase === 'playing').length,
  };
}
