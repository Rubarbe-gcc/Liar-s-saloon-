/**
 * LE VELOURS NOIR — le Texas Hold'em.
 *
 * Module ISO : l'évaluation des mains, la table (blindes, tours d'enchères,
 * tapis, pots annexes, abattage) et les adversaires de l'ordinateur.
 *
 * La table ne dessine rien : chaque fonction range ce qui s'est passé dans
 * `etat.evts` (donne, mise, carte du tableau, gain…), et l'écran le rejoue
 * à son rythme avec `prendre(etat)`.
 */

import { sabot, nomCarte, pluriel, COULEURS } from './cartes.js';

/* ------------------------------------------------------------------ */
/* Les mains                                                           */
/* ------------------------------------------------------------------ */

export const CATEGORIES = ['Hauteur', 'Paire', 'Deux paires', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];

const de = (r) => (r === 14 || r === 8 ? 'd’' : 'de ');
const au = (r) => (r === 14 ? 'à l’' : 'au ');

/** Le nom d'une main, comme l'annonce le croupier. */
export function nomMain({ cat, val }) {
  const [a, b] = val;
  switch (cat) {
    case 8: return a === 14 ? 'Quinte flush royale' : `Quinte flush ${au(a)}${nomCarte(a)}`;
    case 7: return `Carré ${de(a)}${pluriel(a)}`;
    case 6: return `Full aux ${pluriel(a)} par les ${pluriel(b)}`;
    case 5: return `Couleur ${au(a)}${nomCarte(a)}`;
    case 4: return `Quinte ${au(a)}${nomCarte(a)}`;
    case 3: return `Brelan ${de(a)}${pluriel(a)}`;
    case 2: return `Deux paires, ${pluriel(a)} et ${pluriel(b)}`;
    case 1: return `Paire ${de(a)}${pluriel(a)}`;
    default: return `Hauteur ${nomCarte(a)}`;
  }
}

/** Un nombre qui range les mains : plus grand = meilleur. */
const coder = (cat, val) => {
  let s = cat;
  for (let k = 0; k < 5; k++) s = s * 15 + (val[k] || 0);
  return s;
};

/** La plus haute carte d'une suite dans un masque de rangs, ou 0. */
function hautSuite(masque) {
  if (masque & (1 << 14)) masque |= 1 << 1;
  for (let h = 14; h >= 5; h--) if (((masque >> (h - 4)) & 31) === 31) return h;
  return 0;
}

/** Évalue exactement cinq cartes. */
export function evaluer5(cs) {
  const rs = cs.map((c) => c.r).sort((a, b) => b - a);
  const couleur = cs.every((c) => c.c === cs[0].c);
  let masque = 0;
  for (const r of rs) masque |= 1 << r;
  const suite = new Set(rs).size === 5 ? hautSuite(masque) : 0;
  const n = {};
  for (const r of rs) n[r] = (n[r] || 0) + 1;
  const g = Object.entries(n).map(([r, k]) => [Number(r), k]).sort((x, y) => y[1] - x[1] || y[0] - x[0]);
  let cat, val;
  if (suite && couleur) { cat = 8; val = [suite]; }
  else if (g[0][1] === 4) { cat = 7; val = [g[0][0], g[1][0]]; }
  else if (g[0][1] === 3 && g[1][1] === 2) { cat = 6; val = [g[0][0], g[1][0]]; }
  else if (couleur) { cat = 5; val = rs; }
  else if (suite) { cat = 4; val = [suite]; }
  else if (g[0][1] === 3) { cat = 3; val = g.map((x) => x[0]); }
  else if (g[0][1] === 2 && g[1][1] === 2) { cat = 2; val = g.map((x) => x[0]); }
  else if (g[0][1] === 2) { cat = 1; val = g.map((x) => x[0]); }
  else { cat = 0; val = rs; }
  return { cat, val, score: coder(cat, val), cartes: cs };
}

/** La meilleure main de cinq cartes parmi cinq à sept, avec son nom et ses cartes. */
export function meilleure(cartes) {
  let best = null;
  const n = cartes.length;
  const choisir = (debut, pris) => {
    if (pris.length === 5) {
      const e = evaluer5(pris);
      if (!best || e.score > best.score) best = e;
      return;
    }
    for (let k = debut; k <= n - (5 - pris.length); k++) choisir(k + 1, [...pris, cartes[k]]);
  };
  choisir(0, []);
  return { ...best, nom: nomMain(best) };
}

/** Le score de sept cartes, sans détail : rapide, pour les calculs de l'ordinateur. */
export function score7(cs) {
  const nb = new Array(15).fill(0);
  const parCouleur = [0, 0, 0, 0];
  const masqueCouleur = [0, 0, 0, 0];
  let masque = 0;
  for (const c of cs) {
    const k = COULEURS.indexOf(c.c);
    nb[c.r]++; parCouleur[k]++; masqueCouleur[k] |= 1 << c.r; masque |= 1 << c.r;
  }
  const fc = parCouleur.findIndex((x) => x >= 5);
  if (fc >= 0) {
    const sf = hautSuite(masqueCouleur[fc]);
    if (sf) return coder(8, [sf]);
  }
  const carres = [], brelans = [], paires = [], seules = [];
  for (let r = 14; r >= 2; r--) {
    if (nb[r] === 4) carres.push(r); else if (nb[r] === 3) brelans.push(r); else if (nb[r] === 2) paires.push(r); else if (nb[r] === 1) seules.push(r);
  }
  const plusHaute = (exclus) => { for (let r = 14; r >= 2; r--) if (nb[r] && !exclus.includes(r)) return r; return 0; };
  if (carres.length) return coder(7, [carres[0], plusHaute([carres[0]])]);
  if (brelans.length && (brelans.length > 1 || paires.length)) return coder(6, [brelans[0], Math.max(brelans[1] || 0, paires[0] || 0)]);
  if (fc >= 0) {
    const rs = [];
    for (let r = 14; r >= 2 && rs.length < 5; r--) if (masqueCouleur[fc] & (1 << r)) rs.push(r);
    return coder(5, rs);
  }
  const s = hautSuite(masque);
  if (s) return coder(4, [s]);
  const kick = (exclus, n) => {
    const out = [];
    for (let r = 14; r >= 2 && out.length < n; r--) if (nb[r] && !exclus.includes(r)) out.push(r);
    return out;
  };
  if (brelans.length) return coder(3, [brelans[0], ...kick([brelans[0]], 2)]);
  if (paires.length >= 2) return coder(2, [paires[0], paires[1], ...kick([paires[0], paires[1]], 1)]);
  if (paires.length) return coder(1, [paires[0], ...kick([paires[0]], 3)]);
  return coder(0, kick([], 5));
}

/* ------------------------------------------------------------------ */
/* La table                                                            */
/* ------------------------------------------------------------------ */

/** Les caractères des adversaires. */
export const STYLES = {
  prudent: { nom: 'Prudent', serre: 0.65, agressif: 0.3, bluff: 0.03 },
  requin: { nom: 'Requin', serre: 0.5, agressif: 0.6, bluff: 0.1 },
  flambeur: { nom: 'Flambeur', serre: 0.25, agressif: 0.8, bluff: 0.2 },
  bluffeur: { nom: 'Bluffeur', serre: 0.35, agressif: 0.55, bluff: 0.32 },
  touriste: { nom: 'Touriste', serre: 0.2, agressif: 0.15, bluff: 0.04 },
};

/**
 * Une table.
 * @param {object} o
 * @param {() => number} o.rng
 * @param {number} o.petite  la petite blinde (la grosse vaut le double)
 * @param {object[]} o.sieges  { nom, jetons, style (absent pour le joueur), avatar }
 */
export function creerTable({ rng, petite = 5, sieges }) {
  return {
    rng, petite, grosse: petite * 2,
    joueurs: sieges.map((s, i) => nouveauJoueur(s, i)),
    bouton: -1, board: [], pot: 0, phase: 'attente', aQui: -1,
    miseCourante: 0, relanceMin: petite * 2, mainNo: 0, evts: [], sabot: [],
  };
}

function nouveauJoueur(s, i) {
  return { ...s, i, cartes: [], mise: 0, engage: 0, couche: false, tapis: false, aAgi: false, absent: !(s.jetons > 0) };
}

/** Un nouveau venu prend un siège vide (entre deux mains). */
export function asseoir(t, i, siege) { t.joueurs[i] = nouveauJoueur(siege, i); }

/** Ce qui s'est passé depuis la dernière fois. */
export function prendre(t) { const e = t.evts; t.evts = []; return e; }

const enJeu = (t) => t.joueurs.filter((j) => !j.absent && !j.couche);
const peutAgir = (j) => !j.absent && !j.couche && !j.tapis;
export const totalMises = (t) => t.joueurs.reduce((s, j) => s + j.mise, 0);

/** Le prochain siège après i qui vérifie `f`. */
function suivant(t, i, f = (j) => !j.absent) {
  const n = t.joueurs.length;
  for (let k = 1; k <= n; k++) {
    const j = t.joueurs[(i + k + n) % n];
    if (f(j)) return j.i;
  }
  return -1;
}

function poser(t, j, m) {
  m = Math.max(0, Math.min(m, j.jetons));
  j.jetons -= m; j.mise += m; j.engage += m;
  if (j.jetons === 0) j.tapis = true;
  return m;
}

/** Une nouvelle main : bouton, blindes, deux cartes chacun. */
export function nouvelleMain(t) {
  for (const j of t.joueurs) Object.assign(j, { cartes: [], mise: 0, engage: 0, couche: false, tapis: false, aAgi: false, absent: !(j.jetons > 0) });
  if (t.joueurs.filter((j) => !j.absent).length < 2) { t.phase = 'fin-partie'; return; }
  t.mainNo++;
  t.bouton = suivant(t, t.bouton);
  t.sabot = sabot(t.rng);
  t.board = []; t.pot = 0; t.gagnants = [];
  const duo = t.joueurs.filter((j) => !j.absent).length === 2;
  const sb = duo ? t.bouton : suivant(t, t.bouton);
  const bb = suivant(t, sb);
  t.evts.push({ type: 'nouvelle-main', bouton: t.bouton, no: t.mainNo });
  t.evts.push({ type: 'blinde', i: sb, montant: poser(t, t.joueurs[sb], t.petite) });
  t.evts.push({ type: 'blinde', i: bb, montant: poser(t, t.joueurs[bb], t.grosse) });
  t.miseCourante = t.grosse;
  t.relanceMin = t.grosse;
  for (let tour = 0; tour < 2; tour++) {
    let i = sb;
    do {
      const c = t.sabot.pop();
      t.joueurs[i].cartes.push(c);
      t.evts.push({ type: 'donne', i, carte: c });
      i = suivant(t, i);
    } while (i !== sb);
  }
  t.phase = 'preflop';
  t.aQui = suivant(t, bb, peutAgir);
  if (t.aQui < 0 || !besoinDeParler(t)) return finDeTour(t);
  t.evts.push({ type: 'a-qui', i: t.aQui });
}

/** Reste-t-il quelqu'un qui doit encore décider ? */
function besoinDeParler(t) {
  const p = enJeu(t).filter((j) => !j.tapis);
  if (p.length === 0) return false;
  if (p.length === 1) return p[0].mise < t.miseCourante;
  return p.some((j) => !j.aAgi || j.mise !== t.miseCourante);
}

/** Ce que le joueur dont c'est le tour peut faire. */
export function options(t, i = t.aQui) {
  const j = t.joueurs[i];
  const aSuivre = Math.min(t.miseCourante - j.mise, j.jetons);
  const maxTotal = j.mise + j.jetons;
  const autres = enJeu(t).some((x) => x.i !== i && !x.tapis);
  const peutRelancer = maxTotal > t.miseCourante && autres;
  return {
    aSuivre, parole: t.miseCourante === j.mise,
    minTotal: Math.min(t.miseCourante + t.relanceMin, maxTotal), maxTotal, peutRelancer,
    pot: t.pot + totalMises(t),
  };
}

/**
 * Le joueur dont c'est le tour agit.
 * @param {{type: 'coucher'|'parole'|'suivre'|'relancer'|'tapis', total?: number}} a
 *   `total` : pour une relance, la mise totale visée sur ce tour d'enchères.
 */
export function agir(t, a) {
  const j = t.joueurs[t.aQui];
  const o = options(t);
  let type = a.type;
  if (type === 'parole' && !o.parole) type = 'suivre';
  if (type === 'suivre' && o.parole) type = 'parole';
  if (type === 'tapis') type = o.peutRelancer ? 'relancer' : 'suivre';
  const total = type === 'relancer' ? Math.round(Math.max(o.minTotal, Math.min(o.maxTotal, a.type === 'tapis' ? o.maxTotal : a.total || 0))) : 0;
  if (type === 'relancer' && !o.peutRelancer) type = o.parole ? 'parole' : 'suivre';
  const avant = t.miseCourante;
  let ajout = 0;
  if (type === 'coucher') j.couche = true;
  else if (type === 'suivre') ajout = poser(t, j, t.miseCourante - j.mise);
  else if (type === 'relancer') {
    const hausse = total - t.miseCourante;
    ajout = poser(t, j, total - j.mise);
    if (j.mise > t.miseCourante) {
      if (hausse >= t.relanceMin) {
        t.relanceMin = hausse;
        for (const x of t.joueurs) if (x !== j) x.aAgi = false;
      }
      t.miseCourante = j.mise;
    }
  }
  j.aAgi = true;
  const quoi = type === 'relancer' ? (j.tapis ? 'tapis' : avant === 0 ? 'miser' : 'relancer') : type === 'suivre' && j.tapis ? 'tapis' : type;
  t.evts.push({ type: 'action', i: j.i, quoi, ajout, mise: j.mise });
  apres(t);
}

function apres(t) {
  const restants = enJeu(t);
  if (restants.length === 1) {
    ramasser(t);
    const g = restants[0];
    g.jetons += t.pot;
    t.evts.push({ type: 'gain', gagnants: [g.i], montant: t.pot, parts: { [g.i]: t.pot }, sansAbattage: true });
    t.gagnants = [g.i];
    t.pot = 0;
    return finMain(t);
  }
  if (besoinDeParler(t)) {
    t.aQui = suivant(t, t.aQui, (j) => peutAgir(j) && (!j.aAgi || j.mise !== t.miseCourante));
    t.evts.push({ type: 'a-qui', i: t.aQui });
    return;
  }
  finDeTour(t);
}

function ramasser(t) {
  const m = totalMises(t);
  if (m > 0) {
    t.pot += m;
    t.evts.push({ type: 'ramasser', pot: t.pot });
  }
  for (const j of t.joueurs) { j.mise = 0; j.aAgi = false; }
  t.miseCourante = 0;
  t.relanceMin = t.grosse;
}

/** Fin d'un tour d'enchères : les cartes suivantes, ou l'abattage. */
function finDeTour(t) {
  for (;;) {
    ramasser(t);
    const suite = { preflop: ['flop', 3], flop: ['turn', 1], turn: ['river', 1] }[t.phase];
    if (!suite) return abattage(t);
    t.sabot.pop(); // la carte brûlée
    const cartes = [];
    for (let k = 0; k < suite[1]; k++) cartes.push(t.sabot.pop());
    t.board.push(...cartes);
    t.phase = suite[0];
    t.evts.push({ type: 'board', phase: t.phase, cartes });
    if (besoinDeParlerDebut(t)) {
      t.aQui = suivant(t, t.bouton, peutAgir);
      t.evts.push({ type: 'a-qui', i: t.aQui });
      return;
    }
  }
}

function besoinDeParlerDebut(t) { return enJeu(t).filter((j) => !j.tapis).length >= 2; }

/** Les pots (principal et annexes) d'après ce que chacun a engagé. */
export function calculerPots(joueurs) {
  const vivants = joueurs.filter((j) => !j.absent && !j.couche);
  const niveaux = [...new Set(vivants.map((j) => j.engage))].sort((a, b) => a - b);
  const pots = [];
  let prec = 0;
  for (const L of niveaux) {
    let montant = 0;
    for (const j of joueurs) montant += Math.min(j.engage, L) - Math.min(j.engage, prec);
    const eligibles = vivants.filter((j) => j.engage >= L).map((j) => j.i);
    if (montant > 0) pots.push({ montant, eligibles });
    prec = L;
  }
  // ce qu'un joueur couché aurait mis au-delà de tous les autres va au dernier pot
  let reste = 0;
  for (const j of joueurs) reste += Math.max(0, j.engage - prec);
  if (reste && pots.length) pots[pots.length - 1].montant += reste;
  return pots;
}

function abattage(t) {
  t.phase = 'abattage';
  const restants = enJeu(t);
  const mains = {};
  for (const j of restants) mains[j.i] = meilleure([...j.cartes, ...t.board]);
  t.evts.push({ type: 'abattage', mains: restants.map((j) => ({ i: j.i, cartes: j.cartes, nom: mains[j.i].nom, cinq: mains[j.i].cartes })) });
  const pots = calculerPots(t.joueurs);
  const tous = new Set();
  pots.forEach((p, k) => {
    const meilleurScore = Math.max(...p.eligibles.map((i) => mains[i].score));
    const g = p.eligibles.filter((i) => mains[i].score === meilleurScore);
    // le jeton qui ne se partage pas va au premier gagnant après le bouton
    g.sort((a, b) => ((a - t.bouton + 99) % t.joueurs.length) - ((b - t.bouton + 99) % t.joueurs.length));
    const part = Math.floor(p.montant / g.length);
    const parts = {};
    g.forEach((i, n) => { parts[i] = part + (n === 0 ? p.montant - part * g.length : 0); t.joueurs[i].jetons += parts[i]; tous.add(i); });
    t.evts.push({ type: 'gain', pot: k, annexe: k > 0, gagnants: g, montant: p.montant, parts, nom: mains[g[0]].nom, cinq: mains[g[0]].cartes });
  });
  t.gagnants = [...tous];
  t.pot = 0;
  finMain(t);
}

function finMain(t) {
  t.phase = 'fin';
  t.aQui = -1;
  t.evts.push({ type: 'fin-main' });
}

/* ------------------------------------------------------------------ */
/* L'ordinateur                                                        */
/* ------------------------------------------------------------------ */

const PAQUET = COULEURS.flatMap((c) => [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((r) => ({ r, c })));

/** La part de pots gagnée contre `adv` mains au hasard (Monte-Carlo). */
export function equite(mes, board, adv, rng, essais = 160) {
  adv = Math.max(1, Math.min(adv, 4));
  const pris = new Set([...mes, ...board].map((c) => c.r + c.c));
  const reste = PAQUET.filter((c) => !pris.has(c.r + c.c));
  const manque = 5 - board.length;
  const besoin = manque + adv * 2;
  let total = 0;
  for (let e = 0; e < essais; e++) {
    for (let k = 0; k < besoin; k++) {
      const q = k + Math.floor(rng() * (reste.length - k));
      [reste[k], reste[q]] = [reste[q], reste[k]];
    }
    const b = board.concat(reste.slice(0, manque));
    const moi = score7(mes.concat(b));
    let mieux = 0, egal = 0;
    for (let a = 0; a < adv; a++) {
      const s = score7([reste[manque + a * 2], reste[manque + a * 2 + 1], ...b]);
      if (s > moi) { mieux = 1; break; }
      if (s === moi) egal++;
    }
    if (!mieux) total += 1 / (egal + 1);
  }
  return total / essais;
}

/** La décision d'un adversaire de l'ordinateur. */
export function decider(t, i = t.aQui) {
  const j = t.joueurs[i];
  const st = STYLES[j.style] || STYLES.requin;
  const o = options(t, i);
  const rng = t.rng;
  const adv = enJeu(t).length - 1;
  const eq = equite(j.cartes, t.board, adv, rng, t.board.length ? 160 : 110);
  const part = 1 / (adv + 1);
  const r = eq / part;
  const bruit = (rng() - 0.5) * 0.12;
  const taille = () => {
    const base = o.pot * (0.45 + rng() * 0.5 + st.agressif * 0.3);
    let total = t.miseCourante + Math.max(t.relanceMin, base);
    total = Math.round(total / t.petite) * t.petite;
    if (total >= o.maxTotal * 0.75) return { type: 'tapis' };
    return { type: 'relancer', total };
  };
  const preflop = t.board.length === 0;

  if (o.parole) {
    if (o.peutRelancer && r + bruit > 1.45 - st.agressif * 0.35 && rng() < 0.45 + st.agressif * 0.5) return taille();
    if (o.peutRelancer && rng() < st.bluff * (preflop ? 0.25 : 0.7)) return taille();
    return { type: 'parole' };
  }
  const cote = o.aSuivre / (o.pot + o.aSuivre);
  const gros = o.aSuivre > j.jetons * 0.45;
  if (o.peutRelancer && r + bruit > (gros ? 2 : 1.7) - st.agressif * 0.4 && rng() < 0.3 + st.agressif * 0.6) return taille();
  const exigence = cote * (1 + st.serre * 0.7) + (gros ? 0.08 + st.serre * 0.12 : 0) + (preflop ? st.serre * 0.08 : 0);
  if (eq + bruit >= exigence) return { type: 'suivre' };
  if (o.peutRelancer && !gros && rng() < st.bluff * 0.35) return taille();
  return { type: 'coucher' };
}
