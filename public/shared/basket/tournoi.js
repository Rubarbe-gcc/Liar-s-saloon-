/**
 * DOUBLE PAS — le Tournoi : huit clubs, élimination directe (quarts, demies,
 * finale) ; pas de nul, le panier en or départage.
 *
 * Le joueur et sept adversaires tirés au sort. Les matchs qu'il ne joue pas
 * se jouent sans lui (le moteur, l'ordinateur des deux côtés). Les points,
 * rebonds, passes décisives, vols et contres de chaque joueur s'additionnent
 * d'un match à l'autre (les classements du tournoi). Tout l'état tient dans
 * un objet simple, gardé sur l'appareil entre deux matchs.
 *
 * Module partagé, sans DOM.
 */

import { EQUIPES } from './equipes.js';
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
  for (let k = 0; k < ids.length; k += 2) r.push({ a: ids[k], b: ids[k + 1], score: null, enOr: false, v: null });
  return r;
};

/** Un nouveau tournoi. */
export function creerTournoi({ moi, graine = 1, niveau = 1, minutes = 3, salle = 'palais' }) {
  const autres = melanger(EQUIPES.map((e) => e.id).filter((id) => id !== moi), graine).slice(0, 7);
  const huit = melanger([moi, ...autres], graine * 31 + 7);
  return { moi, graine, niveau, minutes, salle, tour: 0, tours: [apparier(huit)], fini: false, champion: null, elimine: false, stats: { j: {} } };
}

/** Le match du joueur dans le tour en cours (s'il est encore là). */
export function matchDuJoueur(c) {
  if (c.fini || c.elimine) return null;
  const i = c.tours[c.tour].findIndex((r) => r.a === c.moi || r.b === c.moi);
  return i < 0 ? null : { i, ...c.tours[c.tour][i] };
}

/** La salle d'un tour : celle choisie pour les quarts, une autre en demie, la finale au Palais. */
export function salleDuTour(c) {
  if (c.tour === 2) return 'palais';
  if (c.tour === 0) return c.salle;
  const autres = ['gymnase', 'port', 'palais'].filter((s) => s !== c.salle);
  return autres[c.graine % autres.length];
}

/** Le résultat d'une rencontre du tour en cours. res : { score: [a, b], enOr, vainqueur: 0 | 1 } */
export function enregistrer(c, i, res) {
  const r = c.tours[c.tour][i];
  r.score = [...res.score];
  r.enOr = !!res.enOr;
  r.v = res.vainqueur === 0 ? r.a : r.b;
  if ((r.a === c.moi || r.b === c.moi) && r.v !== c.moi) c.elimine = true;
}

/** Ce que chaque joueur a fait dans un match : [{ club, i, pts, rebonds, passes, vols, contres }]. */
export function resumer(m) {
  return m.perso.map((s, id) => ({ club: m.equipes[m.joueurs[id].e].id, i: m.joueurs[id].i, ...s }));
}

/** Ajoute un match aux statistiques du tournoi. */
export function noterStats(c, resume) {
  if (!c.stats) c.stats = { j: {} };
  for (const s of resume || []) {
    const cle = `${s.club}:${s.i}`;
    const t = c.stats.j[cle] || (c.stats.j[cle] = { club: s.club, i: s.i, matchs: 0, pts: 0, rebonds: 0, passes: 0, vols: 0, contres: 0 });
    t.matchs += 1;
    for (const k of ['pts', 'rebonds', 'passes', 'vols', 'contres']) t[k] += s[k] || 0;
  }
}

/** Une rencontre sans le joueur, jouée par le moteur. Rend le match simulé. */
export function jouerSansMoi(c, i) {
  const r = c.tours[c.tour][i];
  const m = simuler({ equipes: [r.a, r.b], graine: (c.graine + c.tour * 101 + i * 13) >>> 0, minutes: Math.min(c.minutes, 2) });
  enregistrer(c, i, { score: m.score, enOr: m.enOr, vainqueur: m.vainqueur });
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

/**
 * Un classement du tournoi : les n meilleurs pour `cle` ('pts', 'rebonds', 'passes', 'vols', 'contres'),
 * ou 'eval' (tout compté). Rend [{ rang, club, i, matchs, pts, … }].
 */
export function classement(stats, cle, n = 5) {
  const val = (s) => (cle === 'eval' ? s.pts + s.rebonds * 1.2 + s.passes * 1.5 + s.vols * 2 + s.contres * 2 : s[cle]);
  return Object.values(stats?.j || {}).filter((s) => val(s) > 0)
    .sort((a, b) => val(b) - val(a) || b.pts - a.pts || a.matchs - b.matchs || a.club.localeCompare(b.club) || a.i - b.i)
    .slice(0, n).map((s, k) => ({ rang: k + 1, ...s }));
}
