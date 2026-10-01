/**
 * RAID — la synchronisation entre appareils.
 *
 * Un « code de synchro » relie les appareils d'un même joueur. Chaque appareil
 * dépose sa partie en ligne quand elle change, et la reprend quand il
 * s'ouvre : la plus récente gagne. Voir `server/sauvegarde.js`.
 *
 * Ce module ne connaît que le transport et les deux repères rangés sur
 * l'appareil : le code, et la date de la dernière modification locale.
 */

const CLE_CODE = 'raid.synchro.cle';
const CLE_DATE = 'raid.synchro.date';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR = 10;

const lire = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const ecrire = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Le code de synchro de cet appareil, ou rien s'il n'est pas relié. */
export const code = () => lire(CLE_CODE);
export const relie = () => !!code();
export const definirCode = (c) => ecrire(CLE_CODE, c);
export const oublier = () => { ecrire(CLE_CODE, null); };

/** Date (en millisecondes) de la dernière modification de la partie sur cet appareil. */
export const dateLocale = () => Number(lire(CLE_DATE)) || 0;
export const marquer = (date = Date.now()) => ecrire(CLE_DATE, String(date));

export const normaliser = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LONGUEUR);
export const joli = (c) => (c ? `${c.slice(0, 5)}-${c.slice(5)}` : '');

export function nouveauCode() {
  const o = new Uint32Array(LONGUEUR);
  crypto.getRandomValues(o);
  return [...o].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

async function appeler(url, options) {
  let r;
  try { r = await fetch(url, { cache: 'no-store', ...options }); }
  catch { return { ok: false, hors: true, msg: 'Pas de connexion.' }; }
  let json = null;
  try { json = await r.json(); } catch { /* réponse vide */ }
  return { ok: r.ok, statut: r.status, json, msg: json && json.msg };
}

/** La sauvegarde en ligne sous ce code : `{ ok, charge, date }`, ou `{ ok: false, vide }`. */
export async function tirer(c = code()) {
  const r = await appeler(`/api/sauvegarde?cle=${encodeURIComponent(c)}`);
  if (r.ok) return { ok: true, charge: r.json.charge, date: r.json.date };
  return { ok: false, vide: r.statut === 404, indisponible: r.statut === 503, hors: !!r.hors, msg: r.msg || 'Synchronisation impossible.' };
}

/**
 * Dépose la partie de cet appareil. Si une sauvegarde plus récente attend en
 * ligne, le serveur la renvoie à la place (`plusRecente`).
 */
export async function pousser(charge, date, { survie = false } = {}) {
  const r = await appeler('/api/sauvegarde', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cle: code(), charge, date }),
    keepalive: survie,
  });
  if (r.ok) return { ok: true };
  if (r.statut === 409) return { ok: false, plusRecente: { charge: r.json.charge, date: r.json.date } };
  return { ok: false, indisponible: r.statut === 503, hors: !!r.hors, msg: r.msg || 'Synchronisation impossible.' };
}
