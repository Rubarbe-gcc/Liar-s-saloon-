/**
 * PETIT PONT — la Coupe : huit équipes, élimination directe (quarts, demies,
 * finale), tirs au but en cas d'égalité.
 *
 * Le joueur et sept adversaires tirés au sort. Les matchs qu'il ne joue pas
 * se jouent sans lui (le moteur, l'ordinateur des deux côtés). Tout l'état
 * tient dans un objet simple, gardé sur l'appareil entre deux matchs.
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

/** Une nouvelle Coupe. */
export function creerCoupe({ moi, graine = 1, niveau = 1, minutes = 3, stade = 'chaudron' }) {
  const autres = melanger(EQUIPES.map((e) => e.id).filter((id) => id !== moi), graine).slice(0, 7);
  const huit = melanger([moi, ...autres], graine * 31 + 7);
  const c = { moi, graine, niveau, minutes, stade, tour: 0, tours: [], fini: false, champion: null, elimine: false };
  c.tours.push(apparier(huit));
  return c;
}

const apparier = (ids) => {
  const r = [];
  for (let k = 0; k < ids.length; k += 2) r.push({ a: ids[k], b: ids[k + 1], score: null, tab: null, v: null });
  return r;
};

/** Le match du joueur dans le tour en cours (s'il est encore là). */
export function matchDuJoueur(c) {
  if (c.fini || c.elimine) return null;
  const i = c.tours[c.tour].findIndex((r) => r.a === c.moi || r.b === c.moi);
  return i < 0 ? null : { i, ...c.tours[c.tour][i] };
}

/** Le stade d'un tour : celui choisi pour les quarts, la finale au Chaudron. */
export function stadeDuTour(c) {
  if (c.tour === 2) return 'chaudron';
  if (c.tour === 0) return c.stade;
  const autres = ['toit', 'halle', 'plage', 'chaudron'].filter((s) => s !== c.stade);
  return autres[c.graine % autres.length];
}

/** Le résultat d'une rencontre du tour en cours. res : { score: [a, b], tab: [a, b] | null, vainqueur: 0 | 1 } */
export function enregistrer(c, i, res) {
  const r = c.tours[c.tour][i];
  r.score = [...res.score];
  r.tab = res.tab ? [...res.tab] : null;
  r.v = res.vainqueur === 0 ? r.a : r.b;
  if ((r.a === c.moi || r.b === c.moi) && r.v !== c.moi) c.elimine = true;
}

/** Une rencontre sans le joueur, jouée par le moteur. */
export function jouerSansMoi(c, i) {
  const r = c.tours[c.tour][i];
  const m = simuler({ equipes: [r.a, r.b], graine: (c.graine + c.tour * 101 + i * 13) >>> 0, minutes: Math.min(c.minutes, 2), tab: true });
  enregistrer(c, i, { score: m.score, tab: m.tab ? m.tab.buts.map((x) => x.filter(Boolean).length) : null, vainqueur: m.vainqueur });
}

/** Les rencontres du tour en cours qui restent à jouer (sans le joueur). */
export const aJouer = (c) => c.tours[c.tour].map((r, i) => (r.v || r.a === c.moi || r.b === c.moi ? -1 : i)).filter((i) => i >= 0);

/** Le tour est fini : on passe au suivant (ou la Coupe est finie). */
export function avancer(c) {
  const t = c.tours[c.tour];
  if (t.some((r) => !r.v)) return false;
  if (t.length === 1) { c.fini = true; c.champion = t[0].v; return true; }
  c.tours.push(apparier(t.map((r) => r.v)));
  c.tour += 1;
  return true;
}
