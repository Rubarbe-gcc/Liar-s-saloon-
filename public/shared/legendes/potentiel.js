/**
 * LÉGENDES — l'arbre de potentiel et les niveaux des personnages.
 *
 * L'ARBRE : des ROUTES de nœuds à débloquer dans l'ordre (un SR en a une, un SSR deux, un UR ou un LR
 * trois). Chaque nœud donne des PV, de l'ATQ, de la DÉF, ou une capacité (coup critique, esquive, attaque
 * additionnelle, récupération). On les paie en ORBES de potentiel : celles de l'élément du personnage pour
 * les statistiques, des orbes arc-en-ciel pour les capacités. Les orbes se gagnent en combattant.
 *
 * Les NIVEAUX : chaque personnage gagne de l'EXP en combattant, jusqu'au niveau maximum de sa rareté ; ses
 * statistiques montent avec (au niveau 1, à peu près la moitié de son maximum).
 */

import { PERSO, NIV_MAX } from './persos.js';

export { NIV_MAX };
/** L'EXP qu'il faut pour passer le niveau n. */
export const expNiveau = (n) => Math.round(20 * Math.pow(n, 1.25));

/** Gagne de l'EXP : rend le nombre de niveaux gagnés. entree : { niv, xp } dans la collection. */
export function gagnerExpPerso(entree, id, exp) {
  const max = NIV_MAX[PERSO[id].rarete];
  entree.niv ??= 1;
  entree.xp ??= 0;
  if (entree.niv >= max) return 0;
  entree.xp += exp;
  let n = 0;
  while (entree.niv < max && entree.xp >= expNiveau(entree.niv)) { entree.xp -= expNiveau(entree.niv); entree.niv += 1; n += 1; }
  if (entree.niv >= max) entree.xp = 0;
  return n;
}

const NB_ROUTES = { N: 0, R: 1, SR: 1, SSR: 2, UR: 3, LR: 3 };
const FORCE = { N: 0.4, R: 0.55, SR: 0.7, SSR: 1, UR: 1.2, LR: 1.4 };
/** Ce que fait chaque route en plus des statistiques. */
export const ROUTES = [
  { nom: 'Route de la puissance', capacite: 'critique', texte: 'coup critique' },
  { nom: 'Route du vent', capacite: 'esquive', texte: 'esquive' },
  { nom: 'Route de l’éveil', capacite: 'attAdd', texte: 'attaque additionnelle', fin: 'soin' },
];
const PAS = ['atq', 'def', 'pv', 'cap', 'atq', 'def', 'pv', 'cap', 'atq', 'fin'];
const PRIX = [8, 10, 12, 6, 16, 20, 24, 10, 30, 14];

/** L'arbre d'un personnage : [[{ id, type, val, cout: { orbe, n } }]] (une liste de nœuds par route). */
export function arbre(id) {
  const x = PERSO[id], f = FORCE[x.rarete];
  return Array.from({ length: NB_ROUTES[x.rarete] }, (_, r) => PAS.map((p, k) => {
    const R = ROUTES[r];
    const type = p === 'cap' ? R.capacite : p === 'fin' ? (R.fin || R.capacite) : p;
    const val = type === 'pv' ? Math.round(500 * f) : type === 'atq' ? Math.round(350 * f) : type === 'def' ? Math.round(180 * f)
      : type === 'soin' ? 0.03 : 0.03 + 0.01 * r;
    const capacite = !['pv', 'atq', 'def'].includes(type);
    return { id: `r${r}n${k}`, route: r, type, val, cout: { orbe: capacite ? 'arc' : x.element, n: Math.round(PRIX[k] * (0.6 + f * 0.4)) } };
  }));
}

/** Le texte d'un nœud. */
export const texteNoeud = (n) => ({ pv: `PV +${n.val}`, atq: `ATQ +${n.val}`, def: `DÉF +${n.val}`, critique: `Critique +${Math.round(n.val * 100)} %`, esquive: `Esquive +${Math.round(n.val * 100)} %`, attAdd: `Attaque add. +${Math.round(n.val * 100)} %`, soin: `Récupération +${Math.round(n.val * 100)} % des PV (au début du tour)` }[n.type]);

/** Ce que donnent les nœuds débloqués : { pv, atq, def, critique, esquive, attAdd, soin }. */
export function bonusPotentiel(id, debloques = []) {
  const b = { pv: 0, atq: 0, def: 0, critique: 0, esquive: 0, attAdd: 0, soin: 0 };
  const set = new Set(debloques);
  for (const route of arbre(id)) for (const n of route) if (set.has(n.id)) b[n.type] += n.val;
  return b;
}

/** Peut-on débloquer ce nœud (le précédent de sa route est pris, on a les orbes) ? */
export function peutDebloquer(etat, id, noeud) {
  const c = etat.collection[id];
  if (!c) return false;
  const pris = c.pot || [];
  const route = arbre(id).find((r) => r.some((n) => n.id === noeud));
  if (!route) return false;
  const k = route.findIndex((n) => n.id === noeud);
  if (pris.includes(noeud) || (k > 0 && !pris.includes(route[k - 1].id))) return false;
  const { orbe, n } = route[k].cout;
  return (etat.orbes?.[orbe] || 0) >= n;
}

/** Débloque un nœud (paie les orbes). Rend vrai si c'est fait. */
export function debloquer(etat, id, noeud) {
  if (!peutDebloquer(etat, id, noeud)) return false;
  const n = arbre(id).flat().find((x) => x.id === noeud);
  etat.orbes[n.cout.orbe] -= n.cout.n;
  (etat.collection[id].pot ||= []).push(noeud);
  return true;
}

/** Ajoute des orbes ({ element: n, arc: n }). */
export function ajouterOrbes(etat, o) {
  etat.orbes ||= {};
  for (const [k, n] of Object.entries(o || {})) etat.orbes[k] = (etat.orbes[k] || 0) + n;
}
