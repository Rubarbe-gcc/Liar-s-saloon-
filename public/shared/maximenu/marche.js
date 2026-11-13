/**
 * MAXI MENU — les échanges entre joueurs et le marché.
 *
 * Chaque carte a une VALEUR de repère selon sa rareté. Un échange n'est permis
 * que s'il est à peu près équitable : le plus petit des deux lots vaut au moins
 * EQUITE (75 %) du plus gros, ou l'écart ne dépasse pas TOLERANCE frites d'or.
 * Au marché, le prix d'une carte reste entre PRIX_MIN et PRIX_MAX fois sa valeur.
 *
 * Partagé par la page (main.js), le serveur des échanges en direct
 * (server/maximenu.js) et le marché (server/marche.js).
 */

import { PAR_ID } from './cartes.js';

export const VALEUR = { commune: 10, rare: 30, epique: 120, legendaire: 400, mythique: 2000 };
export const EQUITE = 0.75;
export const TOLERANCE = 20;
export const LOT_MAX = 12;            // cartes au plus de chaque côté d'un échange
export const PRIX_MIN = 0.5;
export const PRIX_MAX = 4;
export const ANNONCES_MAX = 8;        // annonces en même temps par vendeur
export const DUREE_ANNONCE = 7 * 24 * 3600 * 1000;

export const valeurCarte = id => { const c = PAR_ID.get(id); return c ? VALEUR[c.rarete] || 0 : 0; };
export const prixMin = id => Math.max(1, Math.ceil(valeurCarte(id) * PRIX_MIN));
export const prixMax = id => Math.floor(valeurCarte(id) * PRIX_MAX);
export const prixValide = (id, prix) => PAR_ID.has(id) && Number.isInteger(prix) && prix >= prixMin(id) && prix <= prixMax(id);

/** Un lot { id: nombre } propre (ids connus, nombres entiers, LOT_MAX au plus), ou null. */
export function nettoyerLot(lot) {
  if (!lot || typeof lot !== 'object' || Array.isArray(lot)) return null;
  const propre = {}; let total = 0;
  for (const [id, n] of Object.entries(lot)) {
    if (!PAR_ID.has(id) || !Number.isInteger(n) || n < 1) return null;
    propre[id] = n; total += n;
  }
  return total <= LOT_MAX ? propre : null;
}

export const tailleLot = lot => Object.values(lot || {}).reduce((a, n) => a + n, 0);
export const valeurLot = lot => Object.entries(lot || {}).reduce((a, [id, n]) => a + valeurCarte(id) * n, 0);

/** L'équité d'un échange : chaque côté doit donner quelque chose, et des valeurs proches. */
export function equite(a, b) {
  const va = valeurLot(a), vb = valeurLot(b), haut = Math.max(va, vb), bas = Math.min(va, vb);
  const ok = va > 0 && vb > 0 && (bas >= haut * EQUITE || haut - bas <= TOLERANCE);
  // Ce qu'il faudrait ajouter au plus petit lot pour que ça passe.
  const manque = ok ? 0 : bas === 0 ? 0 : Math.max(0, Math.min(Math.ceil(haut * EQUITE) - bas, haut - TOLERANCE - bas));
  return { va, vb, ok, manque };
}

export const possede = (etat, lot) => Object.entries(lot || {}).every(([id, n]) => (etat.collection[id] || 0) >= n);

export function retirerCarte(etat, id, n = 1) {
  if ((etat.collection[id] || 0) < n) return false;
  etat.collection[id] -= n;
  if (!etat.collection[id]) delete etat.collection[id];
  return true;
}

/** Ajoute une carte ; vrai si elle est nouvelle dans la collection. */
export function ajouterCarte(etat, id, maintenant, n = 1) {
  const nouvelle = !etat.collection[id] && !etat.obtenue[id];
  etat.collection[id] = (etat.collection[id] || 0) + n;
  if (!etat.obtenue[id]) etat.obtenue[id] = maintenant;
  return nouvelle;
}

/** Applique un échange conclu : on donne un lot, on reçoit l'autre. */
export function echanger(etat, donne, recoit, maintenant) {
  if (!possede(etat, donne)) return { ok: false };
  for (const [id, n] of Object.entries(donne)) retirerCarte(etat, id, n);
  const nouvelles = [];
  for (const [id, n] of Object.entries(recoit)) if (ajouterCarte(etat, id, maintenant, n)) nouvelles.push(id);
  etat.stats.echanges = (etat.stats.echanges || 0) + 1;
  return { ok: true, nouvelles };
}
