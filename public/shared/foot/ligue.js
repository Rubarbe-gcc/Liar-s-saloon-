/**
 * PETIT PONT — la Ligue des Étoiles : une ligue des champions de clubs
 * (nom inventé), avec un tirage au sort, des poules, puis l'élimination
 * directe.
 *
 *  - Tous les clubs du jeu sont tirés au sort dans des poules de quatre. S'il
 *    en manque pour compléter, on en invente (clubs.js).
 *  - Les poules : « aller simple » (3 matchs) ou « aller-retour » (6 matchs).
 *    Victoire 3 points, nul 1, défaite 0. Départage : différence de buts, puis
 *    buts marqués, puis confrontation directe (puis, à défaut, un tirage
 *    déterministe).
 *  - Les deux premiers de chaque poule passent en phase finale : élimination
 *    directe (quarts, demies, finale…), tirs au but en cas d'égalité. Le
 *    tableau croisé : le 1er d'une poule contre le 2e de la poule voisine ; deux
 *    clubs de la même poule ne se retrouvent qu'en finale.
 *  - Les matchs sans le joueur sont simulés par le moteur, comme dans la Coupe.
 *
 * Tout l'état tient dans un objet simple (JSON), gardé sur l'appareil entre
 * deux matchs. Le tirage et les départages ne dépendent que de la graine :
 * même graine, même tirage.
 *
 * Module partagé, sans DOM.
 */

import { EQUIPES } from './equipes.js';
import { simuler } from './match.js';
import { completerClubs, enregistrerClubs } from './clubs.js';
import { creerStats, cumuler, resumerMatch } from './stats.js';
import { matchDuJoueur as coupeMatchDuJoueur, enregistrer as coupeEnregistrer, jouerSansMoi as coupeJouerSansMoi, aJouer as coupeAJouer, avancer as coupeAvancer } from './coupe.js';

export const POINTS = { victoire: 3, nul: 1, defaite: 0 };
export const FORMATS = { simple: 'Aller simple', retour: 'Aller-retour' };
export const TAILLE_POULE = 4;

/** Un petit hasard reproductible (même graine, même suite). */
function rng(graine) {
  let s = (graine >>> 0) || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}
function melanger(liste, graine) {
  const R = rng(graine);
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}
/** Un nombre entre 0 et 1 qui ne dépend que de la graine et d'un identifiant (pour départager en dernier recours). */
function aleaId(graine, id) {
  let h = (graine >>> 0) ^ 0x9e3779b9;
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/* ------------------------------------------------------------------ */
/* Le tirage au sort                                                   */
/* ------------------------------------------------------------------ */

/** Le nom d'une poule : A, B, C… */
export const nomPoule = (p) => String.fromCharCode(65 + p);

/**
 * Le tirage : les clubs sont tirés un par un, et chacun va dans la poule suivante
 * (A, B, C, D, A, B…). Rend l'ordre du tirage (pour l'animation) et les poules.
 * @returns {{ ordre: { club: string, poule: number, rang: number }[], poules: string[][] }}
 */
export function tirage(clubs, graine) {
  const nb = clubs.length / TAILLE_POULE;
  if (!Number.isInteger(nb) || nb < 1) throw new Error('Le nombre de clubs doit être un multiple de 4.');
  const tires = melanger(clubs, graine);
  const poules = Array.from({ length: nb }, () => []);
  const ordre = tires.map((club, k) => {
    const poule = k % nb;
    poules[poule].push(club);
    return { club, poule, rang: poules[poule].length - 1 };
  });
  return { ordre, poules };
}

/* ------------------------------------------------------------------ */
/* Le calendrier d'une poule                                           */
/* ------------------------------------------------------------------ */

/** Les trois journées d'une poule de quatre (indices 0 à 3). */
const JOURNEES_ALLER = [[[0, 3], [1, 2]], [[0, 2], [3, 1]], [[0, 1], [2, 3]]];

/** Les matchs d'une poule, journée par journée (l'aller-retour inverse les domiciles pour les trois dernières). */
export function calendrierPoule(ids, format = 'simple') {
  const matchs = [];
  JOURNEES_ALLER.forEach((paires, j) => paires.forEach(([x, y]) => matchs.push({ j, a: ids[x], b: ids[y], score: null })));
  if (format === 'retour') JOURNEES_ALLER.forEach((paires, j) => paires.forEach(([x, y]) => matchs.push({ j: j + 3, a: ids[y], b: ids[x], score: null })));
  return matchs;
}

/* ------------------------------------------------------------------ */
/* Le classement d'une poule                                           */
/* ------------------------------------------------------------------ */

const ligneVide = (id) => ({ id, j: 0, v: 0, n: 0, d: 0, bp: 0, bc: 0, diff: 0, pts: 0 });

/** Le tableau brut (sans l'ordre) d'une liste de matchs, pour les clubs `ids`. */
function tableau(ids, matchs) {
  const t = Object.fromEntries(ids.map((id) => [id, ligneVide(id)]));
  for (const m of matchs) {
    if (!m.score || !t[m.a] || !t[m.b]) continue;
    const [x, y] = m.score;
    for (const [id, pour, contre] of [[m.a, x, y], [m.b, y, x]]) {
      const l = t[id];
      l.j += 1; l.bp += pour; l.bc += contre; l.diff = l.bp - l.bc;
      if (pour > contre) { l.v += 1; l.pts += POINTS.victoire; } else if (pour === contre) { l.n += 1; l.pts += POINTS.nul; } else { l.d += 1; l.pts += POINTS.defaite; }
    }
  }
  return t;
}

/**
 * Le classement d'une poule. Ordre : points, différence de buts, buts marqués,
 * confrontation directe (entre les seuls clubs encore à égalité : points, puis différence),
 * puis un tirage déterministe (graine) qui ne sert que si tout est identique.
 * @param {{ ids: string[], matchs: object[] }} poule
 * @returns {object[]} les lignes { id, j, v, n, d, bp, bc, diff, pts, rang }
 */
export function classementPoule(poule, graine = 1) {
  const t = tableau(poule.ids, poule.matchs);
  const lignes = Object.values(t).sort((p, q) => q.pts - p.pts || q.diff - p.diff || q.bp - p.bp);
  const res = [];
  for (let i = 0; i < lignes.length;) {
    let k = i + 1;
    while (k < lignes.length && lignes[k].pts === lignes[i].pts && lignes[k].diff === lignes[i].diff && lignes[k].bp === lignes[i].bp) k++;
    const egaux = lignes.slice(i, k);
    if (egaux.length > 1) {
      const ids = egaux.map((l) => l.id);
      const mini = tableau(ids, poule.matchs.filter((m) => ids.includes(m.a) && ids.includes(m.b)));
      egaux.sort((p, q) => mini[q.id].pts - mini[p.id].pts || mini[q.id].diff - mini[p.id].diff || mini[q.id].bp - mini[p.id].bp || aleaId(graine, p.id) - aleaId(graine, q.id));
    }
    res.push(...egaux);
    i = k;
  }
  return res.map((l, r) => ({ ...l, rang: r + 1 }));
}

/* ------------------------------------------------------------------ */
/* La Ligue                                                            */
/* ------------------------------------------------------------------ */

/**
 * Une nouvelle Ligue : le tirage est fait, les poules sont prêtes, aucun match joué.
 * `clubs` : les clubs du jeu (tous, par défaut) ; s'il en manque pour remplir les poules, on en invente.
 */
export function creerLigue({ moi, graine = 1, niveau = 1, minutes = 3, stade = 'chaudron', format = 'simple', clubs = EQUIPES }) {
  const clubsExtra = completerClubs(clubs, graine);
  enregistrerClubs(clubsExtra);
  const tous = [...clubs.map((e) => e.id), ...clubsExtra.map((c) => c.id)];
  const { ordre, poules } = tirage(tous, graine);
  const l = {
    type: 'ligue', moi, graine, niveau, minutes, stade, format,
    clubsExtra, ordreTirage: ordre,
    poules: poules.map((ids, p) => ({ nom: nomPoule(p), ids, matchs: calendrierPoule(ids, format) })),
    phase: 'poules', journee: 0, nbJournees: format === 'retour' ? 6 : 3,
    finale: null, fini: false, champion: null, elimine: false, stats: creerStats(),
  };
  return l;
}

/** Une Ligue relue depuis la sauvegarde : on rend aux moteurs les clubs inventés. */
export function restaurerLigue(l) {
  if (!l || l.type !== 'ligue' || !l.poules) return null;
  enregistrerClubs(l.clubsExtra || []);
  if (!l.stats) l.stats = creerStats();
  return l;
}

/** Les classements de toutes les poules. */
export const classements = (l) => l.poules.map((p) => classementPoule(p, l.graine));

/** Le stade d'un match de poule : celui choisi, un autre pour varier selon la journée. */
export function stadeDeLaJournee(l) {
  if (l.journee === 0) return l.stade;
  const autres = ['toit', 'halle', 'plage', 'chaudron'].filter((s) => s !== l.stade);
  return autres[(l.graine + l.journee) % autres.length];
}

/** Le match du joueur à la journée en cours (phase de poules). */
export function matchDuJoueurPoule(l) {
  if (l.phase !== 'poules') return null;
  for (let p = 0; p < l.poules.length; p++) {
    const i = l.poules[p].matchs.findIndex((m) => m.j === l.journee && (m.a === l.moi || m.b === l.moi));
    if (i >= 0) return { p, i, ...l.poules[p].matchs[i] };
  }
  return null;
}

/** Enregistre le résultat d'un match de poule. res : { score: [a, b] } */
export function enregistrerPoule(l, p, i, res) {
  l.poules[p].matchs[i].score = [...res.score];
}

/** Un match de poule sans le joueur, joué par le moteur (rend le match simulé). */
export function jouerPouleSansMoi(l, p, i) {
  const m = l.poules[p].matchs[i];
  const sim = simuler({ equipes: [m.a, m.b], graine: (l.graine + p * 977 + i * 131 + m.j * 31) >>> 0, minutes: Math.min(l.minutes, 2), tab: false });
  enregistrerPoule(l, p, i, { score: sim.score });
  cumuler(l.stats, resumerMatch(sim));
  return sim;
}

/** Les matchs de la journée en cours qui restent à jouer sans le joueur : [{ p, i }]. */
export function aJouerPoule(l) {
  const r = [];
  l.poules.forEach((poule, p) => poule.matchs.forEach((m, i) => { if (m.j === l.journee && !m.score && m.a !== l.moi && m.b !== l.moi) r.push({ p, i }); }));
  return r;
}

/** Le joueur a-t-il fini son match de la journée ? (Toujours vrai si son club ne joue pas.) */
export const matchDuJoueurFait = (l) => { const m = matchDuJoueurPoule(l); return !m || !!m.score; };

/**
 * La journée est jouée : on passe à la suivante, ou à la phase finale quand les poules sont finies.
 * Rend faux tant qu'un match de la journée n'est pas joué.
 */
export function avancerPoules(l) {
  if (l.phase !== 'poules') return false;
  const restants = l.poules.some((poule) => poule.matchs.some((m) => m.j === l.journee && !m.score));
  if (restants) return false;
  if (l.journee + 1 < l.nbJournees) { l.journee += 1; return true; }
  lancerPhaseFinale(l);
  return true;
}

/** Les qualifiés : les deux premiers de chaque poule. */
export function qualifies(l) {
  return classements(l).map((c) => [c[0].id, c[1].id]);
}

/** Le tableau croisé : [1er d'une poule contre 2e de la poule voisine], puis l'inverse. */
export function tableauFinal(q) {
  const premiers = [], seconds = [];
  for (let p = 0; p + 1 < q.length; p += 2) {
    premiers.push([q[p][0], q[p + 1][1]]);
    seconds.push([q[p + 1][0], q[p][1]]);
  }
  return [...premiers, ...seconds];
}

/** Le nom d'un tour d'après le nombre de rencontres. */
export const nomTour = (nbRencontres) => ({ 1: 'Finale', 2: 'Demi-finales', 4: 'Quarts de finale', 8: 'Huitièmes de finale', 16: 'Seizièmes de finale' }[nbRencontres] || `Tour de ${nbRencontres * 2}`);

function lancerPhaseFinale(l) {
  const q = qualifies(l);
  const rencontres = tableauFinal(q).map(([a, b]) => ({ a, b, score: null, tab: null, v: null }));
  const k = { moi: l.moi, graine: (l.graine * 17 + 5) >>> 0, niveau: l.niveau, minutes: l.minutes, stade: l.stade, tour: 0, tours: [rencontres], fini: false, champion: null, elimine: false };
  l.finale = k;
  l.phase = 'finale';
  l.elimine = !q.flat().includes(l.moi);
}

/* ---- La phase finale : même mécanique que la Coupe, sur l'état `l.finale` ---- */

export const nomDuTour = (l) => nomTour(l.finale.tours[l.finale.tour].length);
export const estLaFinale = (l) => l.finale.tours[l.finale.tour].length === 1;
export const matchDuJoueurFinale = (l) => (l.finale ? coupeMatchDuJoueur(l.finale) : null);
export const aJouerFinale = (l) => coupeAJouer(l.finale);
export const stadeDuTourFinale = (l) => {
  if (estLaFinale(l)) return 'chaudron';
  const autres = ['toit', 'halle', 'plage', 'chaudron'].filter((s) => s !== l.stade);
  return autres[(l.graine + l.finale.tour) % autres.length];
};

function synchroniser(l) {
  const k = l.finale;
  l.fini = k.fini; l.champion = k.champion;
  if (k.elimine) l.elimine = true;
}

/** Le résultat d'une rencontre de la phase finale. res : { score, tab, vainqueur } */
export function enregistrerFinale(l, i, res) {
  coupeEnregistrer(l.finale, i, res);
  synchroniser(l);
}

/** Une rencontre de la phase finale sans le joueur (rend le match simulé). */
export function jouerFinaleSansMoi(l, i) {
  const sim = coupeJouerSansMoi(l.finale, i);
  cumuler(l.stats, resumerMatch(sim));
  synchroniser(l);
  return sim;
}

/** Le tour est fini : on passe au suivant, ou la Ligue est finie. */
export function avancerFinale(l) {
  const ok = coupeAvancer(l.finale);
  synchroniser(l);
  return ok;
}

/** Le match du joueur est fini : ses buts, passes et arrêts entrent dans les statistiques. resume : resumerMatch(m). */
export function noterStats(l, resume) {
  if (resume) cumuler(l.stats, resume);
}

/** Rien de plus à jouer avant la fin : simule tout ce qui reste, sans le joueur (s'il est éliminé). */
export function simulerLeReste(l) {
  let garde = 0;
  while (!l.fini && garde++ < 500) {
    if (l.phase === 'poules') {
      for (const { p, i } of aJouerPoule(l)) jouerPouleSansMoi(l, p, i);
      // Le match du joueur, s'il reste : joué par le moteur aussi.
      const m = matchDuJoueurPoule(l);
      if (m && !m.score) jouerPouleSansMoi(l, m.p, m.i);
      avancerPoules(l);
    } else {
      for (const i of aJouerFinale(l)) jouerFinaleSansMoi(l, i);
      const m = matchDuJoueurFinale(l);
      if (m && !m.v) jouerFinaleSansMoi(l, m.i);
      avancerFinale(l);
    }
  }
}
