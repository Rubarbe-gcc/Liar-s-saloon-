/**
 * LÉGENDES — les éveils par médailles (comme dans les grands gachas : un personnage devient sa version
 * supérieure). Les chaînes se font toutes seules : les versions d'un même personnage, de la plus faible à la
 * plus forte (Kael R → SR → SSR → UR → LR). Chaque étape coûte des médailles de son élément (gagnées en
 * combattant des ennemis de cet élément), et des médailles légendaires pour les plus hautes (les boss).
 *
 * Et le joueur : son RANG (l'EXP des combats), son ENDURANCE (ce que coûte une étape, qui remonte avec le
 * temps, et d'un coup à chaque rang gagné).
 */

import { PERSOS, PERSO, ORDRE } from './persos.js';

/** La clé des médailles d'un personnage (toutes ses versions partagent les mêmes). */
export const cleMedaille = (nom) => `m_${nom.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase()}`;
/** Les médailles : une par personnage (gagnée dans son événement d'éveil), et les légendaires (les boss du jeu de fin). */
export const MEDAILLES = { legende: { nom: 'Médaille légendaire', glyphe: '🏅', couleur: '#ffd23f' } };
for (const x of PERSOS) if (!x.fete) MEDAILLES[cleMedaille(x.nom)] ||= { nom: `Médaille de ${x.nom}`, glyphe: '🎖️', couleur: x.couleurs.aura, perso: x.nom };
/** Le prix d'un éveil, selon la rareté visée : [ses médailles, médailles légendaires]. */
const PRIX = { R: [5, 0], SR: [10, 0], SSR: [20, 0], UR: [35, 2], LR: [50, 5] };

/** Les chaînes d'éveil : [{ de, vers, cout: { element: n, legende: n } }]. */
export const EVEILS = (() => {
  const groupes = {};
  for (const x of PERSOS) if (!x.fete) (groupes[x.nom] ||= []).push(x);
  const out = [];
  for (const g of Object.values(groupes)) {
    g.sort((a, b) => ORDRE.indexOf(a.rarete) - ORDRE.indexOf(b.rarete));
    for (let k = 0; k + 1 < g.length; k++) {
      const de = g[k], vers = g[k + 1];
      if (de.rarete === vers.rarete) continue;
      const [m, l] = PRIX[vers.rarete];
      out.push({ de: de.id, vers: vers.id, cout: { [cleMedaille(de.nom)]: m, ...(l ? { legende: l } : {}) } });
    }
  }
  return out;
})();
export const eveilDe = (id) => EVEILS.find((e) => e.de === id) || null;
/** Les chaînes entières (pour la liste des éveils) : [[id, id, …]]. */
export const CHAINES = (() => {
  const debuts = EVEILS.filter((e) => !EVEILS.some((x) => x.vers === e.de)).map((e) => e.de);
  return debuts.map((d) => { const c = [d]; let e; while ((e = eveilDe(c[c.length - 1]))) c.push(e.vers); return c; });
})();

/** Peut-on éveiller ce personnage (on l'a, on a les médailles) ? */
export function peutEveiller(etat, id) {
  const e = eveilDe(id);
  if (!e || !etat.collection[id]) return false;
  const m = etat.medailles || {};
  return Object.entries(e.cout).every(([k, n]) => (m[k] || 0) >= n);
}

/** Éveille : paie les médailles, le personnage devient sa version supérieure (s'il l'a déjà, elle gagne un éveil). Rend l'id obtenu, ou null. */
export function eveiller(etat, id) {
  if (!peutEveiller(etat, id)) return null;
  const e = eveilDe(id);
  for (const [k, n] of Object.entries(e.cout)) etat.medailles[k] -= n;
  const c = etat.collection[id];
  if (c.n > 1) c.n -= 1; else delete etat.collection[id];
  const v = etat.collection[e.vers];
  if (v) v.eveil = Math.min(v.eveil + 1, 5);
  else etat.collection[e.vers] = { eveil: Math.min(c.eveil, 2), n: 1 };
  return e.vers;
}

/** Ajoute des médailles ({ element: n, legende: n }). */
export function ajouterMedailles(etat, m) {
  etat.medailles ||= {};
  for (const [k, n] of Object.entries(m || {})) etat.medailles[k] = (etat.medailles[k] || 0) + n;
}

/* ---------------- Le rang, l'EXP, l'endurance ---------------- */

/** L'EXP qu'il faut pour passer le rang r. */
export const expPour = (r) => Math.round(60 * Math.pow(r, 1.35));
/** L'endurance au plus haut à ce rang ; elle remonte d'un point toutes les RECHARGE millisecondes. */
export const actMax = (r) => 20 + r * 2;
export const RECHARGE = 3 * 60 * 1000;

export function nouveauJoueur(maintenant = 0) {
  return { rang: 1, exp: 0, act: actMax(1), actT: maintenant };
}

/** L'endurance à cet instant (en comptant la recharge depuis la dernière fois) ; met l'état à jour. */
export function endurance(j, maintenant) {
  const max = actMax(j.rang);
  if (j.act >= max) { j.actT = maintenant; return j.act; }
  const gagnes = Math.floor((maintenant - j.actT) / RECHARGE);
  if (gagnes > 0) { j.act = Math.min(max, j.act + gagnes); j.actT += gagnes * RECHARGE; }
  if (j.act >= max) j.actT = maintenant;
  return j.act;
}
/** Le temps (ms) avant le prochain point d'endurance (0 si pleine). */
export const prochainPoint = (j, maintenant) => (j.act >= actMax(j.rang) ? 0 : Math.max(0, RECHARGE - (maintenant - j.actT)));

/** Dépense de l'endurance (rend faux s'il n'y en a pas assez). */
export function depenser(j, n, maintenant) {
  endurance(j, maintenant);
  if (j.act < n) return false;
  if (j.act >= actMax(j.rang)) j.actT = maintenant;
  j.act -= n;
  return true;
}

/** Gagne de l'EXP : rend le nombre de rangs gagnés (chaque rang : l'endurance remplie, et au-delà). */
export function gagnerExp(j, exp) {
  j.exp += exp;
  let n = 0;
  while (j.exp >= expPour(j.rang)) { j.exp -= expPour(j.rang); j.rang += 1; n += 1; }
  if (n) j.act = Math.max(j.act, actMax(j.rang));
  return n;
}

export { PERSO };
