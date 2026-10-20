/**
 * CROCHET — le Tournoi : huit boxeurs, élimination directe (quarts, demies,
 * finale), la ceinture au bout (sur le modèle du basket : shared/basket/tournoi.js).
 *
 * Le joueur et sept adversaires tirés au sort. Les combats qu'il ne joue pas
 * se jouent sans lui (le moteur, l'ordinateur des deux côtés). Les coups
 * portés, knock-downs et victoires avant la limite de chacun s'additionnent
 * d'un combat à l'autre (les classements du tournoi). Tout l'état tient dans
 * un objet simple, gardé sur l'appareil entre deux matchs.
 *
 * Module partagé, sans DOM.
 */

import { BOXEURS } from './boxeurs.js';
import { simuler } from './combat.js';

export const TOURS = ['Quarts de finale', 'Demi-finales', 'Finale'];

function melanger(liste, graine) {
  let s = graine >>> 0 || 1;
  const R = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

const apparier = (ids) => {
  const r = [];
  for (let k = 0; k < ids.length; k += 2) r.push({ a: ids[k], b: ids[k + 1], issue: null, round: 0, v: null });
  return r;
};

/** Un nouveau tournoi. */
export function creerTournoi({ moi, graine = 1, niveau = 1, minutes = 2 }) {
  const autres = melanger(BOXEURS.map((e) => e.id).filter((id) => id !== moi), graine).slice(0, 7);
  const huit = melanger([moi, ...autres], graine * 31 + 7);
  return { moi, graine, niveau, minutes, tour: 0, tours: [apparier(huit)], fini: false, champion: null, elimine: false, stats: { j: {} } };
}

/** Le match du joueur dans le tour en cours (s'il est encore là). */
export function matchDuJoueur(c) {
  if (c.fini || c.elimine) return null;
  const i = c.tours[c.tour].findIndex((r) => r.a === c.moi || r.b === c.moi);
  return i < 0 ? null : { i, ...c.tours[c.tour][i] };
}

/** Le résultat d'un combat du tour en cours. res : { issue: 'ko' | 'arret' | 'points', round, vainqueur: 0 | 1 } */
export function enregistrer(c, i, res) {
  const r = c.tours[c.tour][i];
  r.issue = res.issue;
  r.round = res.round;
  r.v = res.vainqueur === 0 ? r.a : r.b;
  if ((r.a === c.moi || r.b === c.moi) && r.v !== c.moi) c.elimine = true;
}

/** Ce que chaque boxeur a fait dans un combat : [{ id, touches, kd, victoire, avantLimite }]. */
export function resumer(m) {
  return m.coins.map((coin, e) => ({ id: coin.id, touches: m.stats.touches[e], kd: m.stats.kd[e], victoire: m.vainqueur === e, avantLimite: m.vainqueur === e && m.issue !== 'points' }));
}

/** Ajoute un combat aux statistiques du tournoi. */
export function noterStats(c, resume) {
  if (!c.stats) c.stats = { j: {} };
  for (const s of resume || []) {
    const t = c.stats.j[s.id] || (c.stats.j[s.id] = { id: s.id, combats: 0, touches: 0, kd: 0, victoires: 0, avantLimite: 0 });
    t.combats += 1;
    t.touches += s.touches; t.kd += s.kd;
    if (s.victoire) t.victoires += 1;
    if (s.avantLimite) t.avantLimite += 1;
  }
}

/** Une rencontre sans le joueur, jouée par le moteur. Rend le match simulé. */
export function jouerSansMoi(c, i) {
  const r = c.tours[c.tour][i];
  const m = simuler({ boxeurs: [r.a, r.b], graine: (c.graine + c.tour * 101 + i * 13) >>> 0, minutes: Math.min(c.minutes, 2) });
  enregistrer(c, i, { issue: m.issue, round: m.round, vainqueur: m.vainqueur });
  noterStats(c, resumer(m));
  return m;
}

/** Les rencontres du tour en cours qui restent à jouer (sans le joueur). */
export const aJouer = (c) => c.tours[c.tour].map((r, i) => (r.v || r.a === c.moi || r.b === c.moi ? -1 : i)).filter((i) => i >= 0);

/** Le tour est fini : on passe au suivant (ou le tournoi est fini). */
export function avancer(c) {
  const t = c.tours[c.tour];
  if (t.some((r) => !r.v)) return false;
  if (t.length === 1) { c.fini = true; c.champion = t[0].v; return true; }
  c.tours.push(apparier(t.map((r) => r.v)));
  c.tour += 1;
  return true;
}

/** Un classement du tournoi : les n meilleurs pour cle ('touches', 'kd', 'avantLimite'). Rend [{ rang, id, combats, … }]. */
export function classement(stats, cle, n = 5) {
  return Object.values(stats?.j || {}).filter((s) => s[cle] > 0)
    .sort((a, b) => b[cle] - a[cle] || b.victoires - a.victoires || a.id.localeCompare(b.id))
    .slice(0, n).map((s, k) => ({ rang: k + 1, ...s }));
}
