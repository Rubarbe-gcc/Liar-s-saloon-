/**
 * LE VELOURS NOIR — la caisse.
 *
 * Module ISO. Des jetons pour le plaisir, jamais d'argent réel : un solde
 * de départ, un bonus par jour, et si l'on n'a plus rien, la maison offre
 * de quoi rejouer. Le solde voyage avec le profil de l'arcade (espace
 * « velours » de /api/sauvegarde) : entre deux appareils, le plus récent
 * gagne, les records gardent le meilleur.
 *
 * Le compte en banque fictif (compte.js) voyage avec elle : `b.compte`.
 */

import * as C from './compte.js';

export const CLE = 'velours.banque';
export const DEPART = 1000;
export const BONUS = 500;
export const SECOURS = 200;
export const MISE_MIN = 5;

/** Le jour, en heure locale : « 2026-10-13 ». */
export const jour = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ent = (v, def = 0) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : def);

/** Une caisse bien formée, quoi qu'on lui donne. */
export function propre(d) {
  const x = d && typeof d === 'object' ? d : {};
  const r = x.records && typeof x.records === 'object' ? x.records : {};
  const s = x.stats && typeof x.stats === 'object' ? x.stats : {};
  return {
    solde: x.solde === undefined ? DEPART : ent(x.solde, DEPART),
    bonus: typeof x.bonus === 'string' ? x.bonus : '',
    records: { solde: ent(r.solde), gain: ent(r.gain) },
    stats: { blackjacks: ent(s.blackjacks), pleins: ent(s.pleins), pots: ent(s.pots), mains: ent(s.mains) },
    compte: C.propre(x.compte),
    maj: ent(x.maj),
  };
}

export function lire(st) {
  try { return propre(JSON.parse(st.getItem(CLE))); } catch { return propre(null); }
}
export function ecrire(st, b) {
  b.maj = Date.now();
  b.compte.maj = b.maj;
  b.records.solde = Math.max(b.records.solde, b.solde);
  try { st.setItem(CLE, JSON.stringify(b)); } catch { /* plein ou interdit */ }
}

export const bonusDispo = (b, t = Date.now()) => b.bonus !== jour(t);
/** Plus de quoi miser, et le bonus du jour déjà pris : la maison offre un secours. */
export const secoursDispo = (b, t = Date.now()) => b.solde < MISE_MIN && !bonusDispo(b, t);

export function prendreBonus(b, t = Date.now()) {
  if (!bonusDispo(b, t)) return 0;
  b.bonus = jour(t);
  b.solde += BONUS;
  return BONUS;
}
export function prendreSecours(b, t = Date.now()) {
  if (!secoursDispo(b, t)) return 0;
  b.solde += SECOURS;
  return SECOURS;
}

/** Deux appareils se mettent d'accord. */
export function fusionner(a, b) {
  a = propre(a); b = propre(b);
  const recent = a.maj >= b.maj ? a : b;
  const max = (k, o) => Math.max(a[o][k], b[o][k]);
  return {
    ...recent,
    bonus: a.bonus > b.bonus ? a.bonus : b.bonus,
    records: { solde: max('solde', 'records'), gain: max('gain', 'records') },
    stats: Object.fromEntries(Object.keys(recent.stats).map((k) => [k, max(k, 'stats')])),
    compte: C.fusionner(a.compte, b.compte),
  };
}

export const memes = (a, b) => JSON.stringify(propre(a)) === JSON.stringify(propre(b));
