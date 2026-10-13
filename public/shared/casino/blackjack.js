/**
 * LE VELOURS NOIR — le blackjack, de une à cinq places.
 *
 * Module ISO. Règles de la maison : sabot de six jeux, le croupier tire
 * jusqu'à 16 et reste à 17 (même souple), il regarde sa carte cachée quand
 * il montre un As ou un dix, le blackjack paie 3 pour 2, l'assurance 2 pour 1,
 * on peut doubler sur deux cartes (même après une séparation) et séparer
 * jusqu'à quatre mains ; des As séparés ne reçoivent qu'une carte chacun.
 *
 * Le moteur ne tient aucune caisse : il dit ce qui se mise et ce qui se
 * rend (événements `donne`, `double`, `separe`, `assurance-prise`,
 * `assurance-reglee`, `resultat`), et chaque joueur règle sa propre caisse.
 * Le joueur seul est une table à une place ; en ligne, le serveur fait
 * tourner la même table pour tout le monde. Tout ce qui se passe est rangé
 * dans `b.evts` (avec `s`, la place concernée) pour que les écrans le rejouent.
 */

import { sabot } from './cartes.js';

const JEUX = 6;
const MAX_MAINS = 4;
export const PLACES = 5;

export const valeurCarte = (r) => (r === 14 ? 11 : r >= 10 ? 10 : r);

/** Le total d'une main, et s'il est « souple » (un As compté 11). */
export function valeur(cartes) {
  let total = 0, as = 0;
  for (const c of cartes) { total += valeurCarte(c.r); if (c.r === 14) as++; }
  while (total > 21 && as) { total -= 10; as--; }
  return { total, souple: as > 0 };
}

export const estBlackjack = (cartes, issueSplit = false) => !issueSplit && cartes.length === 2 && valeur(cartes).total === 21;

export function creerBlackjack({ rng, places = 1 }) {
  return { rng, sabot: sabot(rng, JEUX), sieges: new Array(places).fill(null), croupier: [], cachee: null, phase: 'mise', tour: null, evts: [] };
}

export function prendre(b) { const e = b.evts; b.evts = []; return e; }

/** Un joueur prend la place `s`. */
export function asseoir(b, s, infos = {}) {
  b.sieges[s] = { ...infos, mise: 0, mains: [], assurance: 0, decide: true, enJeu: false };
}

/** Un joueur quitte sa place ; s'il jouait une donne, ses mains restent telles quelles. */
export function lever(b, s) {
  const x = b.sieges[s];
  if (!x) return;
  if (x.enJeu && b.phase !== 'mise' && b.phase !== 'fin') {
    x.parti = true;
    for (const m of x.mains) m.finie = true;
    if (b.phase === 'assurance') { x.decide = true; if (b.sieges.every((y) => !y?.enJeu || y.decide)) debut(b); }
    else if (b.tour?.s === s) suite(b);
    return;
  }
  b.sieges[s] = null;
}

/** Les places qui jouent la donne en cours. */
const joueurs = (b) => b.sieges.filter((x) => x?.enJeu);

/** Une mise pour la prochaine donne (0 : on regarde). */
export function miser(b, s, mise) {
  const x = b.sieges[s];
  if (!x || (b.phase !== 'mise' && b.phase !== 'fin')) return false;
  x.mise = Math.max(0, Math.floor(Number(mise) || 0));
  return true;
}

function tirer(b) {
  if (!b.sabot.length) b.sabot = sabot(b.rng, JEUX);
  return b.sabot.pop();
}

/** Une nouvelle donne, pour toutes les places qui ont misé. */
export function distribuer(b) {
  if (b.phase !== 'mise' && b.phase !== 'fin') return false;
  b.sieges.forEach((x, s) => { if (x?.parti) b.sieges[s] = null; });
  const part = b.sieges.map((x, s) => (x && x.mise > 0 ? s : -1)).filter((s) => s >= 0);
  if (!part.length) return false;
  if (b.sabot.length < 52 * JEUX * 0.25) {
    b.sabot = sabot(b.rng, JEUX);
    b.evts.push({ type: 'melange' });
  }
  b.croupier = [];
  b.cachee = null;
  b.tour = null;
  const mises = {};
  for (const [s, x] of b.sieges.entries()) {
    if (!x) continue;
    x.enJeu = x.mise > 0;
    x.assurance = 0;
    x.decide = true;
    x.mains = x.enJeu ? [{ cartes: [], mise: x.mise, double: false, finie: false, issueSplit: false, resultat: null }] : [];
    if (x.enJeu) mises[s] = x.mise;
  }
  b.evts.push({ type: 'donne', mises });
  const auJoueur = (s) => { const c = tirer(b); b.sieges[s].mains[0].cartes.push(c); b.evts.push({ type: 'carte', s, main: 0, carte: c }); };
  const auCroupier = (cachee) => {
    const c = tirer(b);
    b.croupier.push(c);
    b.evts.push({ type: 'carte', s: 'croupier', carte: cachee ? null : c, cachee });
    if (cachee) b.cachee = c;
  };
  part.forEach(auJoueur); auCroupier(false);
  part.forEach(auJoueur); auCroupier(true);
  if (b.croupier[0].r === 14) {
    const offerts = part.filter((s) => !estBlackjack(b.sieges[s].mains[0].cartes));
    if (offerts.length) {
      for (const s of offerts) b.sieges[s].decide = false;
      b.phase = 'assurance';
      b.evts.push({ type: 'assurance', sieges: offerts });
      return true;
    }
  }
  debut(b);
  return true;
}

/** Une place prend (ou non) l'assurance : la moitié de sa mise. */
export function assurer(b, s, oui) {
  const x = b.sieges[s];
  if (b.phase !== 'assurance' || !x?.enJeu || x.decide) return;
  x.decide = true;
  if (oui) {
    x.assurance = Math.floor(x.mise / 2);
    b.evts.push({ type: 'assurance-prise', s, montant: x.assurance });
  }
  if (joueurs(b).every((y) => y.decide)) debut(b);
}

/** Le croupier regarde sa carte cachée ; un blackjack se règle tout de suite. */
function debut(b) {
  const haut = valeurCarte(b.croupier[0].r);
  const bjC = estBlackjack(b.croupier);
  if (haut >= 10) b.evts.push({ type: 'verifie', blackjack: bjC });
  for (const [s, x] of b.sieges.entries()) {
    if (!x?.enJeu || !x.assurance) continue;
    b.evts.push({ type: 'assurance-reglee', s, retour: bjC ? x.assurance * 3 : 0 });
  }
  if (bjC) {
    reveler(b);
    for (const x of joueurs(b)) for (const m of x.mains) m.finie = true;
    return regler(b);
  }
  for (const x of joueurs(b)) if (estBlackjack(x.mains[0].cartes)) x.mains[0].finie = true;
  b.phase = 'jeu';
  b.tour = { s: 0, m: 0 };
  suite(b);
}

function reveler(b) {
  if (!b.cachee) return;
  b.evts.push({ type: 'revele', carte: b.cachee });
  b.cachee = null;
}

/** Ce que la place dont c'est le tour peut faire (sans regarder sa caisse). */
export function actions(b, s = b.tour?.s) {
  const non = { tirer: false, rester: false, doubler: false, separer: false };
  if (b.phase !== 'jeu' || !b.tour || b.tour.s !== s) return non;
  const x = b.sieges[s];
  const m = x.mains[b.tour.m];
  const deux = m.cartes.length === 2;
  return {
    tirer: true,
    rester: true,
    doubler: deux,
    separer: deux && valeurCarte(m.cartes[0].r) === valeurCarte(m.cartes[1].r) && x.mains.length < MAX_MAINS,
    mise: m.mise,
  };
}

const enCours = (b) => b.sieges[b.tour.s].mains[b.tour.m];

function donnerA(b, s, k) {
  const c = tirer(b);
  b.sieges[s].mains[k].cartes.push(c);
  b.evts.push({ type: 'carte', s, main: k, carte: c });
  return c;
}

export function carte(b, s = b.tour?.s) {
  if (!actions(b, s).tirer) return false;
  const m = enCours(b);
  donnerA(b, s, b.tour.m);
  const v = valeur(m.cartes).total;
  if (v > 21) { m.finie = true; m.resultat = 'brule'; b.evts.push({ type: 'brule', s, main: b.tour.m, mise: m.mise }); }
  else if (v === 21) m.finie = true;
  suite(b);
  return true;
}

export function rester(b, s = b.tour?.s) {
  if (!actions(b, s).rester) return false;
  enCours(b).finie = true;
  suite(b);
  return true;
}

export function doubler(b, s = b.tour?.s) {
  if (!actions(b, s).doubler) return false;
  const m = enCours(b);
  const ajout = m.mise;
  m.mise *= 2;
  m.double = true;
  b.evts.push({ type: 'double', s, main: b.tour.m, ajout, mise: m.mise });
  donnerA(b, s, b.tour.m);
  if (valeur(m.cartes).total > 21) { m.resultat = 'brule'; b.evts.push({ type: 'brule', s, main: b.tour.m, mise: m.mise }); }
  m.finie = true;
  suite(b);
  return true;
}

export function separer(b, s = b.tour?.s) {
  if (!actions(b, s).separer) return false;
  const k = b.tour.m;
  const x = b.sieges[s];
  const m = x.mains[k];
  const deux = { cartes: [m.cartes.pop()], mise: m.mise, double: false, finie: false, issueSplit: true, resultat: null };
  m.issueSplit = true;
  x.mains.splice(k + 1, 0, deux);
  b.evts.push({ type: 'separe', s, main: k, ajout: m.mise });
  const as = m.cartes[0].r === 14;
  donnerA(b, s, k);
  donnerA(b, s, k + 1);
  for (const y of [m, deux]) if (as || valeur(y.cartes).total === 21) y.finie = true;
  suite(b);
  return true;
}

/** La main suivante (de la même place, puis des suivantes), ou le tour du croupier. */
function suite(b) {
  for (let s = b.tour.s; s < b.sieges.length; s++) {
    const x = b.sieges[s];
    if (!x?.enJeu) continue;
    const m = x.mains.findIndex((y) => !y.finie);
    if (m >= 0) {
      b.tour = { s, m };
      b.evts.push({ type: 'a-qui', s, main: m });
      return;
    }
  }
  b.tour = null;
  b.phase = 'croupier';
  reveler(b);
  if (joueurs(b).some((x) => !x.parti && x.mains.some((m) => m.resultat !== 'brule'))) {
    while (valeur(b.croupier).total < 17) {
      const c = tirer(b);
      b.croupier.push(c);
      b.evts.push({ type: 'carte', s: 'croupier', carte: c });
    }
  }
  regler(b);
}

function regler(b) {
  const vc = valeur(b.croupier).total;
  const bjC = estBlackjack(b.croupier);
  const nets = {};
  for (const [s, x] of b.sieges.entries()) {
    if (!x?.enJeu) continue;
    let net = x.assurance ? (bjC ? x.assurance * 2 : -x.assurance) : 0;
    x.mains.forEach((m, k) => {
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
      net += retour - m.mise;
      b.evts.push({ type: 'resultat', s, main: k, res, retour, mise: m.mise });
    });
    nets[s] = net;
  }
  b.phase = 'fin';
  for (const x of b.sieges) if (x) { x.enJeu = false; x.mise = 0; }
  b.evts.push({ type: 'fin', nets, croupier: vc, bjCroupier: bjC });
}

/** Ce qu'un écran qui arrive en cours de route doit savoir pour dessiner la table. */
export function photo(b) {
  return {
    phase: b.phase,
    tour: b.tour,
    croupier: b.croupier.map((c, k) => (k === 1 && b.cachee ? null : c)),
    sieges: b.sieges.map((x) => x && { nom: x.nom, avatar: x.avatar, mise: x.mise, enJeu: x.enJeu, mains: x.mains.map((m) => ({ cartes: m.cartes, mise: m.mise, finie: m.finie, resultat: m.resultat })) }),
  };
}
