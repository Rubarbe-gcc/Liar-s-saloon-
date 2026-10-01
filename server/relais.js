/**
 * RAID — le relais entre deux appareils.
 *
 * RAID se joue seul et n'a pas de partie en ligne ; ce module ne sert qu'à
 * faire passer une sauvegarde d'un appareil à l'autre sans recopier un code
 * interminable. Le premier appareil dépose sa partie et reçoit un code de cinq
 * caractères ; le second donne ce code et reçoit la partie.
 *
 * Rien n'est gardé : un dépôt vit dix minutes, en mémoire, et disparaît dès
 * qu'il est retiré. Le serveur ne lit pas ce qu'il transporte.
 */

/** Sans I, O, 0 ni 1 : un code se dicte et se tape sans hésiter. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 5;
export const DUREE_MS = 10 * 60 * 1000;
export const CHARGE_MAX = 200 * 1024;
const DEPOTS_MAX = 500;
const ESSAIS_MAX = 12;

/** code → { charge, expire, depuis } */
const depots = new Map();
/** id de connexion → { conn, code, essais } */
const clients = new Map();

function nouveauCode() {
  for (let garde = 0; garde < 50; garde++) {
    let c = '';
    for (let i = 0; i < LONGUEUR_CODE; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!depots.has(c)) return c;
  }
  return null;
}

/** Majuscules, sans espaces ni tirets : on pardonne la façon de taper. */
export const normaliser = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LONGUEUR_CODE);

function retirer(code) {
  const d = depots.get(code);
  if (!d) return;
  depots.delete(code);
  const c = clients.get(d.depuis);
  if (c && c.code === code) c.code = null;
}

export function handleOpen(conn) {
  clients.set(conn.id, { conn, code: null, essais: 0 });
}

export function handleClose(conn) {
  // Le dépôt survit à la connexion : l'appareil peut se mettre en veille, le
  // code reste bon jusqu'à son échéance.
  clients.delete(conn.id);
}

export function handleMessage(conn, msg) {
  let c = clients.get(conn.id);
  if (!c) { handleOpen(conn); c = clients.get(conn.id); }
  if (!msg || typeof msg.t !== 'string') return;

  switch (msg.t) {
    case 'ping':
      conn.send({ t: 'pong' });
      break;

    case 'r:deposer': {
      const charge = msg.charge;
      if (typeof charge !== 'string' || !charge.length || charge.length > CHARGE_MAX) {
        conn.send({ t: 'r:erreur', msg: 'Partie illisible ou trop lourde.' });
        break;
      }
      sweep();
      if (c.code) retirer(c.code);
      if (depots.size >= DEPOTS_MAX) { conn.send({ t: 'r:erreur', msg: 'Trop de transferts en cours, réessayez dans un instant.' }); break; }
      const code = nouveauCode();
      if (!code) { conn.send({ t: 'r:erreur', msg: 'Impossible de créer un code, réessayez.' }); break; }
      depots.set(code, { charge, expire: Date.now() + DUREE_MS, depuis: conn.id });
      c.code = code;
      conn.send({ t: 'r:code', code, duree: DUREE_MS });
      break;
    }

    case 'r:retirer': {
      if (++c.essais > ESSAIS_MAX) { conn.send({ t: 'r:erreur', msg: 'Trop d’essais. Rechargez la page.' }); break; }
      sweep();
      const code = normaliser(msg.code);
      const d = depots.get(code);
      if (!d) { conn.send({ t: 'r:erreur', msg: 'Code inconnu ou expiré. Vérifiez-le, ou refaites-en un sur l’autre appareil.' }); break; }
      conn.send({ t: 'r:charge', charge: d.charge });
      const origine = clients.get(d.depuis);
      retirer(code);
      if (origine) { try { origine.conn.send({ t: 'r:pris' }); } catch { /* il est parti */ } }
      break;
    }

    case 'r:annuler':
      if (c.code) retirer(c.code);
      break;

    default: break;
  }
}

export function sweep() {
  const t = Date.now();
  for (const [code, d] of depots) if (d.expire <= t) retirer(code);
}

export function stats() {
  return { relais: depots.size };
}

/** Pour les tests : repart d'un relais vide. */
export function vider() {
  depots.clear();
  clients.clear();
}
