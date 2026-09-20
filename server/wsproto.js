/**
 * Implementation minimale de RFC 6455, cote serveur.
 *
 * Elle couvre exactement ce dont le jeu a besoin — poignee de main, trames
 * texte, fragmentation, ping/pong, fermeture propre — ce qui evite d'ajouter
 * une dependance pour quelques centaines d'octets de protocole.
 */

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OP = { CONT: 0x0, TEXT: 0x1, BIN: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa };

/** Taille maximale d'un message applicatif (garde-fou memoire). */
const MAX_PAYLOAD = 64 * 1024;

export function isWebSocketUpgrade(req) {
  return (
    req.headers.upgrade &&
    req.headers.upgrade.toLowerCase() === 'websocket' &&
    typeof req.headers['sec-websocket-key'] === 'string'
  );
}

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

/**
 * Termine la poignee de main et renvoie une connexion exploitable.
 * @returns {WsConnection}
 */
export function upgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  return new WsConnection(socket);
}

/* ------------------------------------------------------------------ */
/* Encodage                                                            */
/* ------------------------------------------------------------------ */

/** Construit une trame non masquee (le serveur ne masque jamais). */
function encodeFrame(opcode, payload) {
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN + opcode
  return Buffer.concat([header, payload]);
}

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */

let seq = 0;

export class WsConnection {
  constructor(socket) {
    this.id = `c${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    this.socket = socket;
    this.open = true;
    this.buffer = Buffer.alloc(0);
    // Accumulateur pour les messages fragmentes.
    this.fragOp = null;
    this.fragParts = [];
    this.fragLen = 0;
    this.handlers = { message: [], close: [] };
    this.alive = true;

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('error', () => this.destroy());
    socket.on('close', () => this._fireClose());
    socket.on('end', () => this.destroy());
  }

  on(evt, fn) { (this.handlers[evt] ||= []).push(fn); return this; }

  _emit(evt, arg) {
    for (const fn of this.handlers[evt] || []) {
      try { fn(arg); } catch (err) { console.error(`[ws] handler ${evt}`, err); }
    }
  }

  _onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;

    // On consomme autant de trames completes que le tampon en contient.
    for (;;) {
      const frame = this._readFrame();
      if (!frame) break;
      this._handleFrame(frame);
      if (!this.open) break;
    }
  }

  /** Extrait une trame du tampon, ou null s'il en manque des octets. */
  _readFrame() {
    const buf = this.buffer;
    if (buf.length < 2) return null;

    const b0 = buf[0];
    const b1 = buf[1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < 4) return null;
      len = buf.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) return null;
      const big = buf.readBigUInt64BE(2);
      if (big > BigInt(MAX_PAYLOAD)) { this.close(1009, 'message trop volumineux'); return null; }
      len = Number(big);
      offset = 10;
    }

    if (len > MAX_PAYLOAD) { this.close(1009, 'message trop volumineux'); return null; }

    // Le client DOIT masquer ses trames (RFC 6455 §5.1).
    if (!masked) { this.close(1002, 'trame client non masquee'); return null; }

    if (buf.length < offset + 4 + len) return null;
    const mask = buf.subarray(offset, offset + 4);
    offset += 4;

    const payload = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) payload[i] = buf[offset + i] ^ mask[i & 3];

    this.buffer = buf.subarray(offset + len);
    return { fin, opcode, payload };
  }

  _handleFrame({ fin, opcode, payload }) {
    switch (opcode) {
      case OP.PING:
        this._send(OP.PONG, payload);
        return;
      case OP.PONG:
        this.alive = true;
        return;
      case OP.CLOSE:
        this.close(1000);
        return;
      case OP.TEXT:
      case OP.BIN:
        if (fin) return this._deliver(opcode, payload);
        this.fragOp = opcode;
        this.fragParts = [payload];
        this.fragLen = payload.length;
        return;
      case OP.CONT: {
        if (this.fragOp === null) return;
        this.fragLen += payload.length;
        if (this.fragLen > MAX_PAYLOAD) { this.close(1009, 'message trop volumineux'); return; }
        this.fragParts.push(payload);
        if (!fin) return;
        const whole = Buffer.concat(this.fragParts, this.fragLen);
        const op = this.fragOp;
        this.fragOp = null; this.fragParts = []; this.fragLen = 0;
        return this._deliver(op, whole);
      }
      default:
        this.close(1003, 'opcode non supporte');
    }
  }

  _deliver(opcode, payload) {
    if (opcode !== OP.TEXT) return; // le jeu n'echange que du JSON
    let msg;
    try { msg = JSON.parse(payload.toString('utf8')); }
    catch { return; } // un message illisible est simplement ignore
    this._emit('message', msg);
  }

  _send(opcode, payload) {
    if (!this.open || this.socket.destroyed) return false;
    try { this.socket.write(encodeFrame(opcode, payload)); return true; }
    catch { this.destroy(); return false; }
  }

  /** Envoie un objet JSON. */
  send(obj) {
    return this._send(OP.TEXT, Buffer.from(JSON.stringify(obj), 'utf8'));
  }

  ping() {
    this.alive = false;
    this._send(OP.PING, Buffer.alloc(0));
  }

  close(code = 1000, reason = '') {
    if (!this.open) return;
    const body = Buffer.allocUnsafe(2 + Buffer.byteLength(reason));
    body.writeUInt16BE(code, 0);
    body.write(reason, 2);
    this._send(OP.CLOSE, body);
    this.open = false;
    // Laisse le temps a la trame de partir avant de couper le socket.
    setTimeout(() => this.destroy(), 40);
  }

  destroy() {
    const was = this.open;
    this.open = false;
    try { this.socket.destroy(); } catch { /* deja ferme */ }
    if (was) this._fireClose();
  }

  _fireClose() {
    if (this._closed) return;
    this._closed = true;
    this.open = false;
    this._emit('close');
  }
}
