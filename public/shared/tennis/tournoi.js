/**
 * REVERS — le Tournoi : huit joueurs, élimination directe (quarts, demies, finale), le trophée au bout
 * (sur le modèle de la boxe : shared/boxe/tournoi.js).
 *
 * Le joueur et sept adversaires tirés au sort. Les matchs qu'il ne joue pas se jouent sans lui (le moteur,
 * l'ordinateur des deux côtés). Les aces, coups gagnants et jeux gagnés s'additionnent d'un match à l'autre
 * (les classements du tournoi). Tout l'état tient dans un objet simple, gardé sur l'appareil.
 *
 * Module partagé, sans DOM.
 */

import { JOUEURS } from './joueurs.js';
import { simuler } from './match.js';

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
  for (let k = 0; k < ids.length; k += 2) r.push({ a: ids[k], b: ids[k + 1], sets: null, v: null });
  return r;
};

/** Un nouveau tournoi. */
export function creerTournoi({ moi, graine = 1, niveau = 1, format = 'court', surface = 'dur' }) {
  const autres = melanger(JOUEURS.map((e) => e.id).filter((id) => id !== moi), graine).slice(0, 7);
  const huit = melanger([moi, ...autres], graine * 31 + 7);
  return { moi, graine, niveau, format, surface, tour: 0, tours: [apparier(huit)], fini: false, champion: null, elimine: false, stats: { j: {} } };
}

/** Le match du joueur dans le tour en cours (s'il est encore là). */
export function matchDuJoueur(c) {
  if (c.fini || c.elimine) return null;
  const i = c.tours[c.tour].findIndex((r) => r.a === c.moi || r.b === c.moi);
  return i < 0 ? null : { i, ...c.tours[c.tour][i] };
}

/** Le résultat d'un match du tour en cours. res : { sets: [[6, 4], …] (vus du joueur a), vainqueur: 0 | 1 } */
export function enregistrer(c, i, res) {
  const r = c.tours[c.tour][i];
  r.sets = res.sets;
  r.v = res.vainqueur === 0 ? r.a : r.b;
  if ((r.a === c.moi || r.b === c.moi) && r.v !== c.moi) c.elimine = true;
}

/** Ce que chaque joueur a fait dans un match : [{ id, aces, gagnants, jeux, victoire }]. */
export function resumer(m) {
  return m.joueurs.map((p, e) => ({
    id: p.id, aces: m.stats.aces[e], gagnants: m.stats.gagnants[e],
    jeux: m.score.sets.reduce((t, s) => t + s[e], 0) + m.score.jeux[e], victoire: m.vainqueur === e,
  }));
}

/** Ajoute un match aux statistiques du tournoi. */
export function noterStats(c, resume) {
  if (!c.stats) c.stats = { j: {} };
  for (const s of resume || []) {
    const t = c.stats.j[s.id] || (c.stats.j[s.id] = { id: s.id, matchs: 0, aces: 0, gagnants: 0, jeux: 0, victoires: 0 });
    t.matchs += 1;
    t.aces += s.aces; t.gagnants += s.gagnants; t.jeux += s.jeux;
    if (s.victoire) t.victoires += 1;
  }
}

/** Une rencontre sans le joueur, jouée par le moteur (toujours au format court : c'est rapide). Rend le match. */
export function jouerSansMoi(c, i) {
  const r = c.tours[c.tour][i];
  const m = simuler({ joueurs: [r.a, r.b], graine: (c.graine + c.tour * 101 + i * 13) >>> 0, format: 'court', surface: c.surface, niveaux: [2, 2] });
  enregistrer(c, i, { sets: m.score.sets, vainqueur: m.vainqueur });
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

/** Un classement du tournoi : les n meilleurs pour cle ('aces', 'gagnants', 'jeux'). */
export function classement(stats, cle, n = 5) {
  return Object.values(stats?.j || {}).filter((s) => s[cle] > 0)
    .sort((a, b) => b[cle] - a[cle] || b.victoires - a.victoires || a.id.localeCompare(b.id))
    .slice(0, n).map((s, k) => ({ rang: k + 1, ...s }));
}
