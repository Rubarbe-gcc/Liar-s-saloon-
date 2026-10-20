/**
 * DOUBLE PAS — le Grand Championnat : les seize clubs, chacun contre tous les
 * autres (aller simple : 15 journées ; aller-retour : 30). Une victoire vaut
 * 2 points, une défaite 1 (le barème du basket). Le premier du classement à
 * la dernière journée est champion ; à égalité de points, la différence entre
 * points marqués et encaissés départage, puis les points marqués.
 *
 * Le joueur joue son match de chaque journée ; les sept autres se jouent sans
 * lui (le moteur, l'ordinateur des deux côtés). Les points, rebonds, passes…
 * de chacun s'additionnent (les mêmes classements que le Tournoi :
 * tournoi.js). Tout l'état tient dans un objet simple, gardé sur l'appareil.
 *
 * Module partagé, sans DOM.
 */

import { EQUIPES } from './equipes.js';
import { simuler } from './match.js';
import { resumer, noterStats } from './tournoi.js';

export const POINTS = { victoire: 2, defaite: 1 };
export const FORMATS = { simple: 'Aller simple', retour: 'Aller-retour' };

function melanger(liste, graine) {
  let s = graine >>> 0 || 1;
  const R = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

/**
 * Le calendrier (la méthode du cercle) : chaque journée, chacun joue une fois ;
 * chacun rencontre tous les autres. À domicile une fois sur deux, à peu près ;
 * en aller-retour, la phase retour inverse les terrains.
 */
export function calendrier(ids, format = 'simple') {
  const n = ids.length;
  const tour = [...ids];
  const aller = [];
  for (let r = 0; r < n - 1; r++) {
    const j = [];
    for (let k = 0; k < n / 2; k++) {
      const a = tour[k], b = tour[n - 1 - k];
      j.push((r + k) % 2 === 0 ? { a, b } : { a: b, b: a });
    }
    aller.push(j);
    tour.splice(1, 0, tour.pop());
  }
  const journees = format === 'retour' ? [...aller, ...aller.map((j) => j.map(({ a, b }) => ({ a: b, b: a })))] : aller;
  return journees.map((j) => j.map((r) => ({ ...r, score: null, enOr: false })));
}

/** Un nouveau championnat. */
export function creerChampionnat({ moi, graine = 1, niveau = 1, minutes = 3, salle = 'palais', format = 'simple' }) {
  const ids = melanger(EQUIPES.map((e) => e.id), graine);
  return { moi, graine, niveau, minutes, salle, format: FORMATS[format] ? format : 'simple', journees: calendrier(ids, format), journee: 0, fini: false, champion: null, stats: { j: {} } };
}

/** Le match du joueur dans la journée en cours. */
export function matchDuJoueur(c) {
  if (c.fini) return null;
  const i = c.journees[c.journee].findIndex((r) => r.a === c.moi || r.b === c.moi);
  return i < 0 ? null : { i, ...c.journees[c.journee][i] };
}

/** Le résultat d'un match de la journée en cours. res : { score: [a, b], enOr } */
export function enregistrer(c, i, res) {
  const r = c.journees[c.journee][i];
  r.score = [...res.score];
  r.enOr = !!res.enOr;
}

/** Un match sans le joueur, joué par le moteur. */
export function jouerSansMoi(c, i) {
  const r = c.journees[c.journee][i];
  const m = simuler({ equipes: [r.a, r.b], graine: (c.graine + c.journee * 101 + i * 13) >>> 0, minutes: Math.min(c.minutes, 2) });
  enregistrer(c, i, { score: m.score, enOr: m.enOr });
  noterStats(c, resumer(m));
  return m;
}

/** Les matchs de la journée en cours qui restent à jouer (sans le joueur). */
export const aJouer = (c) => c.journees[c.journee].map((r, i) => (r.score || r.a === c.moi || r.b === c.moi ? -1 : i)).filter((i) => i >= 0);

/** La journée est finie : on passe à la suivante (ou le championnat est fini). */
export function avancer(c) {
  if (c.journees[c.journee].some((r) => !r.score)) return false;
  if (c.journee + 1 >= c.journees.length) {
    c.fini = true;
    c.champion = classement(c)[0].id;
    return true;
  }
  c.journee += 1;
  return true;
}

/** Le classement : [{ rang, id, j, v, d, pour, contre, diff, pts }], du premier au dernier. */
export function classement(c) {
  const t = Object.fromEntries(c.journees[0].flatMap((r) => [r.a, r.b]).map((id) => [id, { id, j: 0, v: 0, d: 0, pour: 0, contre: 0, diff: 0, pts: 0 }]));
  for (const j of c.journees) for (const r of j) {
    if (!r.score) continue;
    const [sa, sb] = r.score, A = t[r.a], B = t[r.b];
    A.j += 1; B.j += 1;
    A.pour += sa; A.contre += sb; B.pour += sb; B.contre += sa;
    const ga = sa > sb;
    (ga ? A : B).v += 1; (ga ? B : A).d += 1;
    (ga ? A : B).pts += POINTS.victoire; (ga ? B : A).pts += POINTS.defaite;
  }
  for (const x of Object.values(t)) x.diff = x.pour - x.contre;
  return Object.values(t).sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pour - a.pour || a.id.localeCompare(b.id)).map((x, k) => ({ rang: k + 1, ...x }));
}

/** Joue d'un coup tout ce qui reste (le joueur a abandonné ses matchs : ils comptent pour des défaites 0-20). */
export function simulerLeReste(c) {
  while (!c.fini) {
    const m = matchDuJoueur(c);
    if (m) enregistrer(c, m.i, { score: m.a === c.moi ? [0, 20] : [20, 0] });
    for (const i of aJouer(c)) jouerSansMoi(c, i);
    avancer(c);
  }
}
