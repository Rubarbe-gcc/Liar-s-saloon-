/**
 * PETIT PONT — les statistiques individuelles d'un tournoi (Coupe et Ligue) :
 * meilleurs buteurs, meilleurs passeurs, meilleurs gardiens, et le score de
 * performance qui désigne l'homme du match et le meilleur joueur du tournoi.
 *
 * Tout part du match fini (celui du joueur comme ceux que le moteur simule) :
 * resumerMatch() le lit — buts, passes décisives, arrêts, matchs sans encaisser —
 * et cumuler() l'ajoute au total du tournoi. Un joueur est reconnu par son club
 * et son numéro de poste (0 : le gardien) : « ferrac:2 ».
 *
 * Les arrêts comptés sont ceux du jeu (pas ceux des tirs au but) ; un but
 * contre son camp ne compte pour personne. Le total tient dans un objet simple
 * (JSON), gardé avec la partie.
 *
 * Module partagé, sans DOM, déterministe.
 */

/** Ce que rapporte chaque action au score de performance. */
export const PERF = { but: 6, passe: 4, arret: 1, sansEncaisser: 3, hommeDuMatch: 5 };

export const cleJoueur = (club, i) => `${club}:${i}`;

/** Des statistiques vides. */
export const creerStats = () => ({ j: {} });

/**
 * Ce qu'a fait chaque joueur dans un match fini.
 * @param {object} m  le match du moteur (match.js), phase 'fin'
 * @returns {{ equipes: string[], score: number[], vainqueur: number, joueurs: object[], hdm: number }}
 *   joueurs : dix lignes { id, e, i, club, buts, passes, arrets, sansEncaisser, perf } (id de 0 à 9) ; hdm : l'id de l'homme du match
 */
export function resumerMatch(m) {
  const clubs = m.equipes.map((e) => e.id);
  const joueurs = m.joueurs.map((p) => ({ id: p.id, e: p.e, i: p.i, club: clubs[p.e], buts: 0, passes: 0, arrets: m.arrets ? m.arrets[p.id] || 0 : 0, sansEncaisser: 0, perf: 0 }));
  for (const b of m.buts) {
    if (b.csc) continue;
    joueurs[b.j].buts += 1;
    if (b.passeur >= 0 && b.passeur !== b.j) joueurs[b.passeur].passes += 1;
  }
  for (const p of joueurs) {
    if (p.i === 0 && m.score[1 - p.e] === 0) p.sansEncaisser = 1;
    p.perf = p.buts * PERF.but + p.passes * PERF.passe + p.arrets * PERF.arret + p.sansEncaisser * PERF.sansEncaisser;
  }
  const r = { equipes: clubs, score: [...m.score], vainqueur: m.vainqueur, joueurs, hdm: -1 };
  r.hdm = hommeDuMatch(r);
  return r;
}

/**
 * L'homme du match : le meilleur score de performance, dans l'équipe gagnante
 * (tirs au but compris) ; à égalité de score, celui qui a le plus marqué, puis le premier dans l'ordre.
 */
export function hommeDuMatch(resume) {
  const v = resume.vainqueur;
  const candidats = resume.joueurs.filter((p) => v < 0 || p.e === v);
  let best = null;
  for (const p of candidats) if (!best || p.perf > best.perf || (p.perf === best.perf && p.buts > best.buts)) best = p;
  return best ? best.id : -1;
}

/** Ajoute un match au total du tournoi. */
export function cumuler(stats, resume) {
  for (const p of resume.joueurs) {
    const k = cleJoueur(p.club, p.i);
    const s = (stats.j[k] ||= { club: p.club, i: p.i, matchs: 0, buts: 0, passes: 0, arrets: 0, sansEncaisser: 0, hdm: 0, perf: 0 });
    s.matchs += 1; s.buts += p.buts; s.passes += p.passes; s.arrets += p.arrets; s.sansEncaisser += p.sansEncaisser;
    s.perf += p.perf;
    if (p.id === resume.hdm) { s.hdm += 1; s.perf += PERF.hommeDuMatch; }
  }
}

/* ---- Les classements ---- */

function classer(stats, garde, comparer, n) {
  return Object.entries(stats.j)
    .filter(([, s]) => garde(s))
    .sort(([ka, a], [kb, b]) => comparer(a, b) || (ka < kb ? -1 : ka > kb ? 1 : 0))
    .slice(0, n)
    .map(([cle, s], r) => ({ cle, ...s, rang: r + 1 }));
}

/** Les meilleurs buteurs : les buts, puis les passes, puis le moins de matchs joués. */
export const meilleursButeurs = (stats, n = 5) => classer(stats, (s) => s.buts > 0, (a, b) => b.buts - a.buts || b.passes - a.passes || a.matchs - b.matchs, n);

/** Les meilleurs passeurs : les passes décisives, puis les buts, puis le moins de matchs joués. */
export const meilleursPasseurs = (stats, n = 5) => classer(stats, (s) => s.passes > 0, (a, b) => b.passes - a.passes || b.buts - a.buts || a.matchs - b.matchs, n);

/** Les meilleurs gardiens : les arrêts, puis les matchs sans encaisser de but, puis le moins de matchs joués. */
export const meilleursGardiens = (stats, n = 5) => classer(stats, (s) => s.i === 0 && s.matchs > 0, (a, b) => b.arrets - a.arrets || b.sansEncaisser - a.sansEncaisser || a.matchs - b.matchs, n);

/** Le meilleur joueur : le score de performance cumulé, puis les buts, puis les passes. */
export const meilleursJoueurs = (stats, n = 5) => classer(stats, (s) => s.matchs > 0, (a, b) => b.perf - a.perf || b.buts - a.buts || b.passes - a.passes || a.matchs - b.matchs, n);

/** Les statistiques d'un joueur (ou des zéros s'il n'a pas encore joué). */
export const statsDe = (stats, club, i) => stats.j[cleJoueur(club, i)] || { club, i, matchs: 0, buts: 0, passes: 0, arrets: 0, sansEncaisser: 0, hdm: 0, perf: 0 };
