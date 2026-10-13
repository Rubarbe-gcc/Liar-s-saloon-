/**
 * LE VELOURS NOIR — « Croupier d'un soir » : ce qu'un croupier doit faire.
 *
 * Module ISO. Le joueur (le modérateur) tient la table ; les clients sont
 * des habitués. Ici : comment les clients jouent et misent, ce que le
 * croupier doit faire à chaque instant, ce qu'il doit payer, et la note
 * du service. L'écran (games/velours-noir/js/service.js) ne fait que
 * dessiner et comparer les gestes du croupier à ces attentes.
 */

import { valeur, valeurCarte, estBlackjack } from './blackjack.js';
import * as R from './roulette.js';

/* ------------------------------------------------------------------ */
/* Blackjack                                                           */
/* ------------------------------------------------------------------ */

/** Ce que décide un client (la stratégie de base, simplifiée). */
export function decisionClient(cartes, carteCroupier) {
  const { total, souple } = valeur(cartes);
  const haut = valeurCarte(carteCroupier.r);
  if (total >= 21) return 'reste';
  if (cartes.length === 2 && (total === 10 || total === 11) && haut <= 9) return 'double';
  if (souple) return total <= 17 || (total === 18 && haut >= 9) ? 'carte' : 'reste';
  if (total <= 11) return 'carte';
  if (total <= 16) return haut >= 7 ? 'carte' : 'reste';
  return 'reste';
}

/** Le croupier tire jusqu'à 16, reste à 17 (même souple). */
export const croupierTire = (cartes) => valeur(cartes).total < 17;

/**
 * Le règlement attendu d'une main de client.
 * @returns {{ geste: 'payer'|'egalite'|'ramasser', gain: number, res: string }}
 *   `gain` : ce que le croupier ajoute à la mise (3 pour 2 sur un blackjack).
 */
export function reglementBJ(main, mise, croupier) {
  const v = valeur(main).total;
  const vc = valeur(croupier).total;
  const bj = estBlackjack(main), bjC = estBlackjack(croupier);
  if (v > 21) return { geste: 'ramasser', gain: 0, res: 'brule' };
  if (bj && !bjC) return { geste: 'payer', gain: Math.floor(mise * 1.5), res: 'blackjack' };
  if (bjC && !bj) return { geste: 'ramasser', gain: 0, res: 'perdu' };
  if (vc > 21 || v > vc) return { geste: 'payer', gain: mise, res: 'gagne' };
  if (v === vc) return { geste: 'egalite', gain: 0, res: 'egalite' };
  return { geste: 'ramasser', gain: 0, res: 'perdu' };
}

/** La mise d'un client, selon son caractère. */
export function miseClient(rng, style = 'requin') {
  const base = { prudent: [10, 25, 50], requin: [25, 50, 100], flambeur: [50, 100, 250], bluffeur: [25, 50, 100, 200], touriste: [5, 10, 25] }[style] || [25, 50];
  return base[Math.floor(rng() * base.length)];
}

/* ------------------------------------------------------------------ */
/* Roulette                                                            */
/* ------------------------------------------------------------------ */

const SIMPLES = ['rouge', 'noir', 'pair', 'impair', 'manque', 'passe'];

/** Les mises d'un client : une à trois, de la plus sage à la plus folle. */
export function parisClient(rng, style = 'requin') {
  const n = 1 + Math.floor(rng() * 3);
  const unite = { prudent: 10, requin: 25, flambeur: 50, bluffeur: 25, touriste: 5 }[style] || 10;
  const paris = {};
  for (let k = 0; k < n; k++) {
    const x = rng();
    let id;
    if (x < 0.35) id = SIMPLES[Math.floor(rng() * SIMPLES.length)];
    else if (x < 0.55) id = `d${1 + Math.floor(rng() * 3)}`;
    else if (x < 0.65) id = `col${1 + Math.floor(rng() * 3)}`;
    else if (x < 0.8) id = `p${Math.floor(rng() * 37)}`;
    else {
      const zones = R.ZONES.filter((z) => z.type === 'cheval' || z.type === 'carre');
      id = zones[Math.floor(rng() * zones.length)].id;
    }
    paris[id] = (paris[id] || 0) + unite * (1 + Math.floor(rng() * 3));
  }
  return paris;
}

/** Le gain d'une mise (sans la mise elle-même), ou 0 si elle perd. */
export const gainRoulette = (id, mise, numero) => (R.PAR_ID[id].nums.includes(numero) ? mise * R.paiement(R.PAR_ID[id].nums) : 0);

/* ------------------------------------------------------------------ */
/* Le service                                                          */
/* ------------------------------------------------------------------ */

/** Décompose un montant en jetons du plateau du croupier. */
export const JETONS_CROUPIER = [1, 5, 25, 100, 500];

/**
 * La note du service, de 1 à 5 étoiles : les erreurs comptent beaucoup,
 * la lenteur un peu (secondes par geste attendu).
 */
export function etoiles({ gestes, erreurs, secondes }) {
  if (!gestes) return 1;
  const precision = 1 - erreurs / gestes;
  const rythme = secondes / gestes;
  let n = 1 + precision * 4 - (rythme > 6 ? 1 : rythme > 3.5 ? 0.5 : 0);
  if (erreurs === 0) n += 0.5;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Le pourboire d'un client content : une part de sa mise (ou de son gain). */
export function pourboire(rng, base, content) {
  if (!content || base <= 0) return 0;
  return Math.max(1, Math.round(base * (0.04 + rng() * 0.08)));
}
