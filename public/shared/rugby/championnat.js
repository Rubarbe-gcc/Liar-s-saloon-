/**
 * RAFFUT — le Grand Championnat : les seize clubs, chacun contre tous les
 * autres (aller simple : 15 journées ; aller-retour : 30), avec le barème du
 * rugby : 4 points la victoire, 0 la défaite, et deux bonus d'un point :
 *   le bonus offensif : marquer au moins 3 essais de plus que l'adversaire ;
 *   le bonus défensif : perdre de 5 points ou moins.
 * Le premier du classement à la dernière journée est champion ; à égalité de
 * points, la différence de points départage, puis les essais marqués.
 *
 * Le joueur joue son match de chaque journée ; les sept autres se jouent sans
 * lui (le moteur, l'ordinateur des deux côtés). Les statistiques de chaque
 * joueur s'additionnent (les mêmes classements que le Tournoi : tournoi.js).
 * Tout l'état tient dans un objet simple, gardé sur l'appareil.
 *
 * Module partagé, sans DOM.
 */

import { EQUIPES } from './equipes.js';
import { simuler } from './match.js';
import { resumer, noterStats } from './tournoi.js';

export const POINTS = { victoire: 4, defaite: 0, bonusOffensif: 1, bonusDefensif: 1 };
/** Les seuils des bonus : 3 essais d'écart, une défaite de 5 points ou moins. */
export const BONUS = { essais: 3, ecart: 5 };
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
  return journees.map((j) => j.map((r) => ({ ...r, score: null, essais: null, enOr: false, v: null })));
}

/** Un nouveau championnat. */
export function creerChampionnat({ moi, graine = 1, niveau = 1, minutes = 3, stade = 'grand', format = 'simple' }) {
  const ids = melanger(EQUIPES.map((e) => e.id), graine);
  return { moi, graine, niveau, minutes, stade, format: FORMATS[format] ? format : 'simple', journees: calendrier(ids, format), journee: 0, fini: false, champion: null, stats: { j: {} } };
}

/** Le match du joueur dans la journée en cours. */
export function matchDuJoueur(c) {
  if (c.fini) return null;
  const i = c.journees[c.journee].findIndex((r) => r.a === c.moi || r.b === c.moi);
  return i < 0 ? null : { i, ...c.journees[c.journee][i] };
}

/**
 * Le résultat d'un match de la journée en cours. res : { score: [a, b], essais: [a, b], enOr, vainqueur: 0 | 1 }
 * (le vainqueur compte pour un match gagné au terrain, à égalité de points).
 */
export function enregistrer(c, i, res) {
  const r = c.journees[c.journee][i];
  r.score = [...res.score];
  r.essais = res.essais ? [...res.essais] : [0, 0];
  r.enOr = !!res.enOr;
  r.v = res.vainqueur === 0 || res.vainqueur === 1 ? res.vainqueur : res.score[0] >= res.score[1] ? 0 : 1;
}

/** Un match sans le joueur, joué par le moteur. */
export function jouerSansMoi(c, i) {
  const r = c.journees[c.journee][i];
  const m = simuler({ equipes: [r.a, r.b], graine: (c.graine + c.journee * 101 + i * 13) >>> 0, minutes: Math.min(c.minutes, 2) });
  enregistrer(c, i, { score: m.score, essais: m.stats.essais, enOr: m.enOr, vainqueur: m.vainqueur });
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

/** Les points d'un club dans un match : [points, bonus offensif ?, bonus défensif ?]. */
export function pointsDuMatch(gagne, pour, contre, essaisPour, essaisContre) {
  const bo = essaisPour - essaisContre >= BONUS.essais;
  const bd = !gagne && contre - pour <= BONUS.ecart;
  return [(gagne ? POINTS.victoire : POINTS.defaite) + (bo ? POINTS.bonusOffensif : 0) + (bd ? POINTS.bonusDefensif : 0), bo, bd];
}

/** Le classement : [{ rang, id, j, v, d, pour, contre, diff, essais, bo, bd, pts }], du premier au dernier. */
export function classement(c) {
  const t = Object.fromEntries(c.journees[0].flatMap((r) => [r.a, r.b]).map((id) => [id, { id, j: 0, v: 0, d: 0, pour: 0, contre: 0, diff: 0, essais: 0, bo: 0, bd: 0, pts: 0 }]));
  for (const j of c.journees) for (const r of j) {
    if (!r.score) continue;
    const [sa, sb] = r.score, [ea, eb] = r.essais || [0, 0], A = t[r.a], B = t[r.b];
    const ga = (r.v ?? (sa >= sb ? 0 : 1)) === 0;
    for (const [X, gagne, pour, contre, ep, ec] of [[A, ga, sa, sb, ea, eb], [B, !ga, sb, sa, eb, ea]]) {
      const [pts, bo, bd] = pointsDuMatch(gagne, pour, contre, ep, ec);
      X.j += 1; X.pour += pour; X.contre += contre; X.essais += ep;
      if (gagne) X.v += 1; else X.d += 1;
      if (bo) X.bo += 1;
      if (bd) X.bd += 1;
      X.pts += pts;
    }
  }
  for (const x of Object.values(t)) x.diff = x.pour - x.contre;
  return Object.values(t).sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.essais - a.essais || a.id.localeCompare(b.id)).map((x, k) => ({ rang: k + 1, ...x }));
}

/** Joue d'un coup tout ce qui reste (le joueur a abandonné ses matchs : ils comptent pour des défaites 0-28). */
export function simulerLeReste(c) {
  while (!c.fini) {
    const m = matchDuJoueur(c);
    if (m) enregistrer(c, m.i, { score: m.a === c.moi ? [0, 28] : [28, 0], essais: m.a === c.moi ? [0, 4] : [4, 0], vainqueur: m.a === c.moi ? 1 : 0 });
    for (const i of aJouer(c)) jouerSansMoi(c, i);
    avancer(c);
  }
}
