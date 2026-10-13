/**
 * LE VELOURS NOIR — le blackjack.
 *
 * Module ISO. Règles de la maison : sabot de six jeux, le croupier tire
 * jusqu'à 16 et reste à 17 (même souple), il regarde sa carte cachée quand
 * il montre un As ou un dix, le blackjack paie 3 pour 2, l'assurance 2 pour 1,
 * on peut doubler sur deux cartes (même après une séparation) et séparer
 * jusqu'à quatre mains ; des As séparés ne reçoivent qu'une carte chacun.
 *
 * Comme la table de poker, tout ce qui se passe est rangé dans `b.evts`
 * pour que l'écran le rejoue.
 */

import { sabot } from './cartes.js';

const JEUX = 6;
const MAX_MAINS = 4;

export const valeurCarte = (r) => (r === 14 ? 11 : r >= 10 ? 10 : r);

/** Le total d'une main, et s'il est « souple » (un As compté 11). */
export function valeur(cartes) {
  let total = 0, as = 0;
  for (const c of cartes) { total += valeurCarte(c.r); if (c.r === 14) as++; }
  while (total > 21 && as) { total -= 10; as--; }
  return { total, souple: as > 0 };
}

export const estBlackjack = (cartes, issueSplit = false) => !issueSplit && cartes.length === 2 && valeur(cartes).total === 21;

export function creerBlackjack({ rng, solde }) {
  return { rng, solde, sabot: sabot(rng, JEUX), mains: [], active: 0, croupier: [], phase: 'mise', assurance: 0, evts: [] };
}

export function prendre(b) { const e = b.evts; b.evts = []; return e; }

function tirer(b) {
  if (!b.sabot.length) b.sabot = sabot(b.rng, JEUX);
  return b.sabot.pop();
}

/** Une nouvelle donne. */
export function distribuer(b, mise) {
  mise = Math.floor(mise);
  if (!(mise > 0) || mise > b.solde || (b.phase !== 'mise' && b.phase !== 'fin')) return false;
  if (b.sabot.length < 52 * JEUX * 0.25) {
    b.sabot = sabot(b.rng, JEUX);
    b.evts.push({ type: 'melange' });
  }
  b.solde -= mise;
  b.mise = mise;
  b.assurance = 0;
  b.mains = [{ cartes: [], mise, double: false, finie: false, issueSplit: false, resultat: null }];
  b.croupier = [];
  b.active = 0;
  b.cachee = null;
  b.evts.push({ type: 'donne', mise });
  const auJoueur = () => { const c = tirer(b); b.mains[0].cartes.push(c); b.evts.push({ type: 'carte', qui: 0, carte: c }); };
  const auCroupier = (cachee) => { const c = tirer(b); b.croupier.push(c); b.evts.push({ type: 'carte', qui: 'croupier', carte: cachee ? null : c, cachee }); if (cachee) b.cachee = c; };
  auJoueur(); auCroupier(false); auJoueur(); auCroupier(true);
  if (b.croupier[0].r === 14 && b.solde >= Math.floor(mise / 2) && !estBlackjack(b.mains[0].cartes)) {
    b.phase = 'assurance';
    b.evts.push({ type: 'assurance' });
    return true;
  }
  debut(b);
  return true;
}

/** Le joueur prend (ou non) l'assurance. */
export function assurer(b, oui) {
  if (b.phase !== 'assurance') return;
  if (oui) {
    b.assurance = Math.floor(b.mise / 2);
    b.solde -= b.assurance;
  }
  debut(b);
}

/** Le croupier regarde sa carte cachée ; un blackjack naturel se règle tout de suite. */
function debut(b) {
  const haut = valeurCarte(b.croupier[0].r);
  const bjC = estBlackjack(b.croupier);
  const bjJ = estBlackjack(b.mains[0].cartes);
  if (haut >= 10) b.evts.push({ type: 'verifie', blackjack: bjC });
  if (bjC || bjJ) {
    reveler(b);
    if (b.assurance) {
      const retour = bjC ? b.assurance * 3 : 0;
      b.solde += retour;
      b.evts.push({ type: 'assurance-reglee', retour });
    }
    b.mains[0].finie = true;
    return regler(b);
  }
  if (b.assurance) b.evts.push({ type: 'assurance-reglee', retour: 0 });
  b.phase = 'jeu';
  b.evts.push({ type: 'a-qui', main: 0 });
}

function reveler(b) {
  if (!b.cachee) return;
  b.evts.push({ type: 'revele', carte: b.cachee });
  b.cachee = null;
}

/** Ce que le joueur peut faire sur la main en cours. */
export function actions(b) {
  if (b.phase !== 'jeu') return { tirer: false, rester: false, doubler: false, separer: false };
  const m = b.mains[b.active];
  const deux = m.cartes.length === 2;
  return {
    tirer: true,
    rester: true,
    doubler: deux && b.solde >= m.mise,
    separer: deux && valeurCarte(m.cartes[0].r) === valeurCarte(m.cartes[1].r) && b.mains.length < MAX_MAINS && b.solde >= m.mise,
  };
}

function donnerA(b, k) {
  const c = tirer(b);
  b.mains[k].cartes.push(c);
  b.evts.push({ type: 'carte', qui: k, carte: c });
  return c;
}

export function carte(b) {
  if (!actions(b).tirer) return;
  const m = b.mains[b.active];
  donnerA(b, b.active);
  const v = valeur(m.cartes).total;
  if (v > 21) { m.finie = true; m.resultat = 'brule'; b.evts.push({ type: 'brule', main: b.active }); }
  else if (v === 21) m.finie = true;
  suite(b);
}

export function rester(b) {
  if (!actions(b).rester) return;
  b.mains[b.active].finie = true;
  suite(b);
}

export function doubler(b) {
  if (!actions(b).doubler) return;
  const m = b.mains[b.active];
  b.solde -= m.mise;
  m.mise *= 2;
  m.double = true;
  b.evts.push({ type: 'double', main: b.active, mise: m.mise });
  donnerA(b, b.active);
  if (valeur(m.cartes).total > 21) { m.resultat = 'brule'; b.evts.push({ type: 'brule', main: b.active }); }
  m.finie = true;
  suite(b);
}

export function separer(b) {
  if (!actions(b).separer) return;
  const k = b.active;
  const m = b.mains[k];
  b.solde -= m.mise;
  const deux = { cartes: [m.cartes.pop()], mise: m.mise, double: false, finie: false, issueSplit: true, resultat: null };
  m.issueSplit = true;
  b.mains.splice(k + 1, 0, deux);
  b.evts.push({ type: 'separe', main: k });
  const as = m.cartes[0].r === 14;
  donnerA(b, k);
  donnerA(b, k + 1);
  for (const x of [m, deux]) if (as || valeur(x.cartes).total === 21) x.finie = true;
  suite(b);
}

/** La main suivante, ou le tour du croupier. */
function suite(b) {
  while (b.active < b.mains.length && b.mains[b.active].finie) b.active++;
  if (b.active < b.mains.length) { b.evts.push({ type: 'a-qui', main: b.active }); return; }
  b.phase = 'croupier';
  reveler(b);
  if (b.mains.some((m) => m.resultat !== 'brule')) {
    while (valeur(b.croupier).total < 17) {
      const c = tirer(b);
      b.croupier.push(c);
      b.evts.push({ type: 'carte', qui: 'croupier', carte: c });
    }
  }
  regler(b);
}

function regler(b) {
  const vc = valeur(b.croupier).total;
  const bjC = estBlackjack(b.croupier);
  let net = b.assurance ? -b.assurance : 0;
  b.mains.forEach((m, k) => {
    const v = valeur(m.cartes).total;
    const bj = estBlackjack(m.cartes, m.issueSplit);
    let res;
    if (m.resultat === 'brule' || v > 21) res = 'brule';
    else if (bj && !bjC) res = 'blackjack';
    else if (bjC && !bj) res = 'perdu';
    else if (vc > 21 || v > vc) res = 'gagne';
    else if (v === vc) res = 'egalite';
    else res = 'perdu';
    const retour = res === 'blackjack' ? Math.floor(m.mise * 2.5) : res === 'gagne' ? m.mise * 2 : res === 'egalite' ? m.mise : 0;
    m.resultat = res;
    b.solde += retour;
    net += retour - m.mise;
    b.evts.push({ type: 'resultat', main: k, res, retour, mise: m.mise });
  });
  if (b.assurance && bjC) net += b.assurance * 3;
  b.phase = 'fin';
  b.net = net;
  b.evts.push({ type: 'fin', net, croupier: vc, bjCroupier: bjC });
}
