/**
 * PARE-FEU — les questions qu'on pose à une partie (sans la modifier).
 * Partagé par le moteur, l'ordinateur et l'affichage.
 */

import { PROGRAMMES, DEFENSES, BRECHE, TECHS, AMELIORATIONS, NIV_MAX } from './donnees.js';

/** Deux joueurs sont alliés (ou le même). -1 = neutre, allié de personne. */
export function allies(E, a, b) {
  if (a < 0 || b < 0) return false;
  if (a === b) return true;
  return E.mode === '2v2' && E.joueurs[a].equipe === E.joueurs[b].equipe;
}

/** Ce nœud est à moi ou à un coéquipier. */
export const ami = (E, j, n) => allies(E, j, E.noeuds[n].proprio);

export const sature = (E, n) => E.noeuds[n].sature > E.temps;

/**
 * Le nœud d'où partirait un programme de j vers la cible : un voisin à lui
 * ou à son coéquipier, pas saturé, le plus proche. -1 si la cible n'est pas
 * à sa portée.
 */
export function source(E, j, cible) {
  const c = E.noeuds[cible];
  if (!c || ami(E, j, cible)) return -1;
  let best = -1, dmin = Infinity;
  for (const v of c.liens) {
    if (!ami(E, j, v) || sature(E, v)) continue;
    const nd = E.noeuds[v];
    const d = Math.hypot(nd.x - c.x, nd.y - c.y);
    // Partir de chez soi plutôt que de chez son coéquipier, à distance égale.
    const cout = d + (E.noeuds[v].proprio === j ? 0 : 1);
    if (cout < dmin) { dmin = cout; best = v; }
  }
  return best;
}

/** Les nœuds que j peut attaquer. */
export function frontiere(E, j) {
  const out = [];
  for (const nd of E.noeuds) if (source(E, j, nd.id) >= 0) out.push(nd.id);
  return out;
}

/** Ce que coûte une action et quand elle est prête (null : action inconnue). */
export function action(type) {
  if (type === 'breche') return BRECHE;
  return PROGRAMMES[type] || DEFENSES[type] || null;
}

/** Dans combien de secondes l'action est prête pour j (0 : prête). */
export function recharge(E, j, type) {
  const t = E.joueurs[j].cd[type] || 0;
  return Math.max(0, t - E.temps);
}

/** j voit-il les défenses de ce nœud ? (les siennes, celles d'un allié, ou révélées par une sonde) */
export function voit(E, j, n) {
  const p = E.noeuds[n].proprio;
  if (p < 0 || allies(E, j, p) || evenement(E, 'fuite')) return true;
  return (E.joueurs[j].revele[p] || 0) > E.temps;
}

/** Les équipes encore en vie. */
export function equipesVivantes(E) {
  const s = new Set();
  for (const J of E.joueurs) if (J.vivant) s.add(J.equipe);
  return [...s];
}

/** Le nombre de nœuds que tient j. */
export function nbNoeuds(E, j) {
  let n = 0;
  for (const nd of E.noeuds) if (nd.proprio === j) n++;
  return n;
}

/** Le hasard de la partie (mulberry32), rangé dans l'état pour rester rejouable. */
export function alea(E) {
  E.alea = (E.alea + 0x6d2b79f5) >>> 0;
  let t = E.alea;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** L'événement en cours est-il celui-ci ? */
export const evenement = (E, k) => !!E.ev && E.ev.k === k && E.ev.fin > E.temps;

/** Le niveau d'une technologie du joueur j (0 à 3). */
export const tech = (E, j, k) => (j >= 0 && E.joueurs[j].tech?.[k]) || 0;

/** Le niveau d'une amélioration d'un nœud (0 à 3). */
export const up = (nd, k) => nd.up?.[k] || 0;

/** Ce que coûte une action (programme, défense, brèche) pour j maintenant. */
export function coutDe(E, j, t) {
  const A = action(t);
  if (!A) return Infinity;
  return Math.ceil(A.cout * (evenement(E, 'soldes') ? 0.6 : 1));
}

/** Sa recharge, raccourcie par le Compilateur. */
export const rechargeDe = (E, j, t) => (action(t)?.recharge || 0) * (1 - 0.12 * tech(E, j, 'recharge'));

/** Le prix du prochain niveau d'une technologie (Infinity : au maximum). */
export function prixTech(E, j, k) {
  const T = TECHS[k];
  const n = tech(E, j, k);
  return T && n < NIV_MAX ? T.couts[n] : Infinity;
}

/** Le prix du prochain niveau d'une amélioration de nœud. */
export function prixUp(nd, k) {
  const A = AMELIORATIONS[k];
  const n = up(nd, k);
  return A && n < NIV_MAX ? A.couts[n] : Infinity;
}
