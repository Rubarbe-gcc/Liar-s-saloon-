/**
 * CROCHET — le moteur d'un combat de boxe, un contre un, en trois rounds.
 *
 * Les touches de chaque boxeur, à chaque image : un nombre (terrain.js, T).
 *   déplacements : g, d, h, b ;
 *   A jab, B crochet, X uppercut (en tenant b : au corps) ;
 *   G garde (haute ; en tenant b : basse) ; S esquive (du côté où l'on pousse, sinon en arrière).
 * Au tapis : A, B ou X à toute vitesse pour se relever avant 10.
 *
 * Un coup se prépare (armer), frappe, puis revient. Il touche si l'adversaire
 * est à portée, ne l'esquive pas et ne garde pas la bonne zone (la tête : garde
 * haute ; le corps : garde basse). Certains coups sont critiques (plus de dégâts : surtout en
 * contre, sur un boxeur sonné, ou un uppercut à la tête). Frapper un boxeur qui frappe, ou qui vient de
 * frapper dans le vide, fait plus mal (le contre). Chaque coup fatigue ; fatigué,
 * on frappe moins fort et on bouge moins vite. La santé à zéro : le tapis, et le
 * compte. Trois fois au tapis dans un round, ou pas relevé à 10 : c'est fini.
 * Sinon, trois juges notent chaque round (10-9 au meilleur, un point de moins par
 * passage au tapis) et la décision tombe à la fin du dernier.
 *
 * L'entraînement (o.entrainement) : pas de chrono, pas de fin ; face à un sac de
 * frappe, un sparring (il se défend mais ne frappe jamais) ou un vrai adversaire ;
 * au tapis, on se relève tout seul à 3, la santé intacte.
 *
 * Déterministe : même graine, mêmes touches → même combat, image par image.
 * Module partagé, sans DOM.
 */

import {
  FPS, DT, RING, CORPS_R, SANTE_MAX, ENDU_MAX, COUPS, ESQUIVE, COMPTE_PAS, CRITIQUE, T,
  hasard, gauss, clamp, dist, vitesseMax,
} from './terrain.js';
import { BOXEUR } from './boxeurs.js';
import { decider, niveauDe } from './ia.js';

export { FPS, T, COUPS, RING, SANTE_MAX, ENDU_MAX, COMPTE_PAS };

const PRESENTATION = 60;
const REPOS = 240;
const RIEN = { mx: 0, my: 0, coup: null, corps: false, garde: null, esquive: false };

/**
 * Un combat.
 * @param {object} o
 * @param {[string, string]} o.boxeurs     les deux boxeurs (identifiants de boxeurs.js)
 * @param {number} [o.graine]
 * @param {number} [o.minutes]             la durée d'un round
 * @param {number} [o.rounds]
 * @param {[string, string]} [o.controles] 'humain', 'ia' ou 'aucun' (un sac de frappe), pour chacun
 * @param {[number, number]} [o.niveaux]   0 facile, 1 normal, 2 difficile (pour l'ordinateur)
 * @param {{ adversaire: 'sac' | 'sparring' | 'combat' }} [o.entrainement]
 */
export function creerCombat({ boxeurs, graine = 1, minutes = 2, rounds = 3, controles = ['humain', 'ia'], niveaux = [1, 1], entrainement = null }) {
  const m = {
    f: 0, alea: (graine >>> 0) || 1,
    phase: 'presentation', t: PRESENTATION, round: 1, rounds, chrono: 0, duree: Math.round(minutes * 60 * FPS),
    coins: [0, 1].map((e) => ({ id: boxeurs[e], style: BOXEUR[boxeurs[e]].style, ctrl: controles[e], niveau: niveaux[e] ?? 1 })),
    boxeurs: [0, 1].map((e) => ({
      e, n: { ...BOXEUR[boxeurs[e]].notes }, x: 0, y: 0, vx: 0, vy: 0, dx: 1, dy: 0,
      sante: SANTE_MAX, santeMax: SANTE_MAX, endu: ENDU_MAX,
      coup: null, garde: null, esquive: 0, esqX: 0, esqY: 0, esqRepos: 0, sonne: 0, ouvert: 0, etourdi: 0,
      sol: false, kdRound: 0, kdTotal: 0, relever: 0, seRelevera: -1, dec: 0, lu: -1, reponse: null, ouvertN: 0, puni: 0, dernierCoup: 0, gardeT: 0, gardeZ: 'haute', tour: 1,
    })),
    prec: [0, 0],
    compte: 0, auTapis: -1,
    rd: { pts: [0, 0], kd: [0, 0] },
    cartes: [[], [], []],
    stats: { lances: [0, 0], touches: [0, 0], tete: [0, 0], corps: [0, 0], bloques: [0, 0], esquives: [0, 0], kd: [0, 0], contres: [0, 0], critiques: [0, 0] },
    vainqueur: -1, issue: null, decision: null, numeroCoup: 0,
  };
  if (entrainement) reglerEntrainement(m, entrainement);
  else placer(m);
  return m;
}

/**
 * Change l'entraînement en pleine séance (le menu pause) : o : { adversaire, niveau }.
 * Chacun revient dans son coin, la santé et le souffle intacts.
 */
export function reglerEntrainement(m, o) {
  const adversaire = ['sac', 'sparring', 'combat'].includes(o.adversaire) ? o.adversaire : 'sac';
  m.entrainement = { adversaire };
  const coin = m.coins[1];
  coin.ctrl = adversaire === 'sac' ? 'aucun' : 'ia';
  coin.sparring = adversaire === 'sparring';
  if (o.niveau >= 0 && o.niveau <= 2) coin.niveau = o.niveau;
  for (const p of m.boxeurs) Object.assign(p, { sante: SANTE_MAX, santeMax: SANTE_MAX, endu: ENDU_MAX, kdRound: 0 });
  placer(m);
  m.phase = 'presentation';
  m.t = 30;
}

/** Chacun dans son coin du ring, face à l'autre. */
function placer(m) {
  m.boxeurs.forEach((p, e) => Object.assign(p, {
    x: e === 0 ? -1.6 : 1.6, y: 0, vx: 0, vy: 0, dx: e === 0 ? 1 : -1, dy: 0,
    coup: null, garde: null, esquive: 0, esqRepos: 0, sonne: 0, ouvert: 0, etourdi: 0, sol: false, relever: 0, seRelevera: -1, dec: 20,
  }));
}

/* ------------------------------------------------------------------ */
/* Une image                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fait avancer le combat d'une image.
 * @param {object} m
 * @param {[number, number]} entrees  les touches de chaque boxeur (ignorées pour l'ordinateur)
 * @returns {object[]} les événements de l'image
 */
export function pas(m, entrees = [0, 0]) {
  const evs = [];
  const k = [entrees[0] | 0, entrees[1] | 0];
  const ap = [k[0] & ~m.prec[0], k[1] & ~m.prec[1]];
  m.prec = k;
  m.f += 1;
  switch (m.phase) {
    case 'presentation':
      if (--m.t <= 0) { m.phase = 'combat'; evs.push({ type: 'cloche', round: m.round, debut: true }); }
      break;
    case 'combat':
      combattre(m, k, ap, evs);
      break;
    case 'compte':
      compter(m, ap, evs);
      break;
    case 'repos':
      for (const p of m.boxeurs) { p.endu = Math.min(ENDU_MAX, p.endu + 0.5); }
      if (--m.t <= 0) {
        m.round += 1;
        m.chrono = 0;
        m.rd = { pts: [0, 0], kd: [0, 0] };
        for (const p of m.boxeurs) { p.kdRound = 0; p.endu = ENDU_MAX; p.sante = Math.min(p.santeMax, p.sante + 25); }
        placer(m);
        m.phase = 'combat';
        evs.push({ type: 'cloche', round: m.round, debut: true });
      }
      break;
    default:
  }
  return evs;
}

function combattre(m, k, ap, evs) {
  for (const p of m.boxeurs) {
    if (p.sonne > 0) p.sonne -= 1;
    if (p.ouvert > 0) p.ouvert -= 1;
    if (p.etourdi > 0) p.etourdi -= 1;
    if (p.esquive > 0) p.esquive -= 1;
    if (p.esqRepos > 0) p.esqRepos -= 1;
  }
  const cons = [null, null];
  for (let e = 0; e < 2; e++) if (m.coins[e].ctrl === 'humain') cons[e] = humain(m, e, k[e], ap[e]);
  for (let e = 0; e < 2; e++) if (!cons[e]) cons[e] = m.coins[e].ctrl === 'ia' ? decider(m, e) : RIEN;
  for (let e = 0; e < 2; e++) agir(m, m.boxeurs[e], cons[e], evs);
  for (let e = 0; e < 2; e++) deplacer(m, m.boxeurs[e], cons[e]);
  separer(m);
  // Les coups en cours : l'impact arrive au début de la phase « frapper ».
  for (let e = 0; e < 2; e++) {
    const p = m.boxeurs[e], c = p.coup;
    if (!c) continue;
    c.t += 1;
    const C = COUPS[c.type];
    if (c.t === C.armer + 1) resoudre(m, p, m.boxeurs[1 - e], evs);
    if (m.phase !== 'combat') return;
    if (c.t >= C.armer + C.frapper + C.retour + c.retard) p.coup = null;
  }
  for (const p of m.boxeurs) {
    // Le souffle revient (moins vite sous la garde), un peu de santé aussi.
    if (!p.coup && p.esquive <= 0) p.endu = Math.min(ENDU_MAX, p.endu + (p.garde ? 0.07 : 0.11) * (0.6 + p.n.endurance / 250));
    p.sante = Math.min(p.santeMax, p.sante + 0.0038);
  }
  if (m.entrainement) return;
  m.chrono += 1;
  if (m.chrono >= m.duree) finRound(m, evs);
}

/* ------------------------------------------------------------------ */
/* L'humain                                                            */
/* ------------------------------------------------------------------ */

function humain(m, e, k, ap) {
  let mx = (k & T.d ? 1 : 0) - (k & T.g ? 1 : 0);
  let my = (k & T.h ? 1 : 0) - (k & T.b ? 1 : 0);
  if (mx && my) { mx *= 0.7071; my *= 0.7071; }
  const corps = !!(k & T.b);
  const c = { mx, my, coup: null, corps, garde: k & T.G ? (corps ? 'basse' : 'haute') : null, esquive: !!(ap & T.S) };
  if (ap & T.A) c.coup = 'jab';
  else if (ap & T.B) c.coup = 'crochet';
  else if (ap & T.X) c.coup = 'upper';
  return c;
}

/* ------------------------------------------------------------------ */
/* Les actions                                                         */
/* ------------------------------------------------------------------ */

function agir(m, p, c, evs) {
  p.garde = p.sonne > 0 || p.coup || p.esquive > 0 ? null : c.garde;
  if (p.sonne > 0 || p.coup) return;
  if (c.esquive && p.esquive <= 0 && p.esqRepos <= 0 && p.endu >= 3) {
    // Du côté où l'on pousse ; sans direction, on recule (on s'éloigne de l'autre).
    let ex = c.mx, ey = c.my;
    if (!ex && !ey) { ex = -p.dx; ey = -p.dy; }
    const l = Math.sqrt(ex * ex + ey * ey) || 1;
    p.esqX = ex / l; p.esqY = ey / l;
    p.esquive = ESQUIVE.duree;
    p.esqRepos = ESQUIVE.duree + ESQUIVE.repos;
    p.endu = Math.max(0, p.endu - ESQUIVE.cout);
    p.garde = null;
    evs.push({ type: 'esquive', boxeur: p.e });
    return;
  }
  if (c.coup && p.esquive <= 0) {
    const C = COUPS[c.coup];
    p.coup = { type: c.coup, corps: !!c.corps, t: 0, retard: 0, num: ++m.numeroCoup };
    p.dernierCoup = m.f;
    p.garde = null;
    p.endu = Math.max(0, p.endu - C.endu);
    m.stats.lances[p.e] += 1;
    evs.push({ type: 'coup', boxeur: p.e, coup: c.coup, corps: !!c.corps });
  }
}

/** L'impact : touché, bloqué, esquivé ou dans le vide. */
function resoudre(m, a, d, evs) {
  const c = a.coup, C = COUPS[c.type];
  const ecart = dist(a.x, a.y, d.x, d.y);
  if (ecart > C.portee || d.sol) {
    // Dans le vide : on se découvre, et ça fatigue.
    c.retard = 8;
    a.endu = Math.max(0, a.endu - C.endu * 0.5);
    a.ouvert = 26; a.ouvertN = ++m.numeroCoup;
    evs.push({ type: 'vide', boxeur: a.e, coup: c.type });
    return;
  }
  const esq = ESQUIVE.duree - d.esquive;
  if (d.esquive > 0 && esq >= ESQUIVE.debut && esq <= ESQUIVE.fin) {
    c.retard = 10;
    a.ouvert = 32; a.ouvertN = ++m.numeroCoup;
    m.stats.esquives[d.e] += 1;
    evs.push({ type: 'esquive-reussie', boxeur: d.e, attaquant: a.e, coup: c.type });
    return;
  }
  // Sans garde, un bon défenseur évite encore une partie des coups (la tête qui bouge, le bras qui pare).
  if (!d.garde && !d.coup && d.sonne <= 0 && d.etourdi <= 0 && m.coins[d.e].ctrl !== 'aucun' && hasard(m) < d.n.defense / 100 * (c.type === 'jab' ? 0.36 : 0.48)) {
    c.retard = 4;
    a.ouvert = 10; a.ouvertN = ++m.numeroCoup;
    evs.push({ type: 'vide', boxeur: a.e, coup: c.type, pare: true });
    return;
  }
  const zone = c.corps ? 'basse' : 'haute';
  const nivA = m.coins[a.e].ctrl === 'ia' ? niveauDe(m.coins[a.e]) : null;
  if (d.garde === zone) {
    d.sante = Math.max(1, d.sante - C.degats * 0.1);
    d.endu = Math.max(0, d.endu - (1.5 + C.degats * 0.3) * (1.2 - d.n.defense / 200));
    d.sonne = 5;
    m.stats.bloques[d.e] += 1;
    m.rd.pts[a.e] += 0.15;
    const ux = (d.x - a.x) / (ecart || 1), uy = (d.y - a.y) / (ecart || 1);
    d.vx += ux * 1.2; d.vy += uy * 1.2;
    evs.push({ type: 'bloque', boxeur: d.e, attaquant: a.e, coup: c.type });
    return;
  }
  const contre = !!d.coup || d.ouvert > 0;
  let deg = C.degats * (0.66 + a.n.puissance * 0.005) * (a.endu < 35 ? 0.55 + a.endu / 78 : 1);
  deg *= c.corps ? 0.6 : 1.16 - d.n.menton * 0.0042;
  if (contre) deg *= d.ouvert > 0 ? 1.4 : 1.2;
  if (nivA) deg *= nivA.puissance;
  deg *= 0.9 + hasard(m) * 0.2;
  // Le coup critique : rare au hasard, bien plus fréquent en contre, sur un boxeur sonné, ou sur un uppercut à la tête.
  const chanceCrit = 0.05 + (contre ? 0.1 : 0) + (d.etourdi > 0 ? 0.08 : 0) + (c.type === 'upper' && !c.corps ? 0.05 : 0) + (a.n.puissance - 70) / 1000;
  const critique = hasard(m) < chanceCrit;
  if (critique) deg *= CRITIQUE.degats;
  d.sante -= deg;
  if (c.corps) d.endu = Math.max(0, d.endu - C.degats * 1.1);
  d.sonne = C.sonne + (contre ? 4 : 0) + (critique ? CRITIQUE.sonne : 0);
  if (critique && !c.corps) d.etourdi = Math.max(d.etourdi, 40);
  d.coup = null;
  d.garde = null;
  if (c.type === 'upper' && !c.corps && d.sante < 38) d.etourdi = 55;
  if (c.type === 'crochet' && !c.corps && d.sante < 25) d.etourdi = Math.max(d.etourdi, 35);
  const ux = (d.x - a.x) / (ecart || 1), uy = (d.y - a.y) / (ecart || 1);
  d.vx += ux * (0.8 + deg * 0.12); d.vy += uy * (0.8 + deg * 0.12);
  m.stats.touches[a.e] += 1;
  m.stats[c.corps ? 'corps' : 'tete'][a.e] += 1;
  if (contre) m.stats.contres[a.e] += 1;
  if (critique) m.stats.critiques[a.e] += 1;
  m.rd.pts[a.e] += C.points * (contre ? 1.25 : 1) * (critique ? 1.5 : 1);
  evs.push({ type: 'touche', boxeur: a.e, cible: d.e, coup: c.type, corps: c.corps, contre, critique, degats: deg, sante: d.sante });
  if (d.sante <= 0) auTapis(m, d, a, evs);
}

/* ------------------------------------------------------------------ */
/* Le tapis, le compte                                                 */
/* ------------------------------------------------------------------ */

function auTapis(m, d, a, evs) {
  d.sante = 0;
  d.sol = true;
  d.coup = null; d.garde = null; d.esquive = 0;
  d.kdRound += 1;
  d.kdTotal += 1;
  d.santeMax = Math.max(25, d.santeMax - 15);
  d.relever = 0;
  m.rd.kd[d.e] += 1;
  m.stats.kd[a.e] += 1;
  m.auTapis = d.e;
  m.compte = 0;
  m.t = 0;
  evs.push({ type: 'kd', boxeur: d.e, attaquant: a.e, fois: d.kdRound });
  // Trois fois au tapis dans le même round : l'arbitre arrête tout.
  if (d.kdRound >= 3 && !m.entrainement) { finir(m, a.e, 'arret', evs); return; }
  m.phase = 'compte';
  // L'ordinateur : se relèvera-t-il, et à quel chiffre ?
  if (m.coins[d.e].ctrl !== 'humain') {
    const chance = clamp(0.93 - 0.2 * (d.kdTotal - 1) - (SANTE_MAX - d.santeMax) / 260 + (d.n.menton - 75) / 110 + (d.endu / ENDU_MAX - 0.5) * 0.2, 0.05, 0.96);
    d.seRelevera = m.coins[d.e].ctrl === 'aucun' || hasard(m) < chance ? 3 + Math.floor(hasard(m) * 5) : -1;
  }
}

/** Ce qu'il faut de coups de touches pour se relever (l'humain). */
export const effortRelever = (p) => Math.round(9 + 5 * (p.kdTotal - 1) + (SANTE_MAX - p.santeMax) / 6);

function compter(m, ap, evs) {
  const d = m.boxeurs[m.auTapis], a = m.boxeurs[1 - m.auTapis];
  // L'autre file au coin neutre.
  const cx = -Math.sign(d.x || 1) * (RING - 0.6), cy = d.y > 0 ? -(RING - 0.6) : RING - 0.6;
  a.vx = (cx - a.x) * 1.5; a.vy = (cy - a.y) * 1.5;
  a.x += a.vx * DT; a.y += a.vy * DT;
  a.coup = null; a.garde = null;
  if (m.coins[d.e].ctrl === 'humain' && ap[d.e] & (T.A | T.B | T.X | T.G)) d.relever += 1;
  m.t += 1;
  if (m.t % COMPTE_PAS === 0) {
    m.compte += 1;
    evs.push({ type: 'compte', n: m.compte, boxeur: d.e });
  }
  // À l'entraînement : debout à 3, comme neuf.
  if (m.entrainement && m.compte >= 3) {
    Object.assign(d, { sol: false, sante: SANTE_MAX, santeMax: SANTE_MAX, sonne: 20 });
    m.phase = 'combat';
    evs.push({ type: 'debout', boxeur: d.e, compte: m.compte });
    return;
  }
  const debout = m.compte >= 2 && (m.coins[d.e].ctrl === 'humain' ? d.relever >= effortRelever(d) : d.seRelevera >= 0 && m.compte >= d.seRelevera);
  if (debout) {
    d.sol = false;
    d.sante = d.santeMax * 0.45;
    d.sonne = 30;
    d.etourdi = 60;
    m.phase = 'combat';
    evs.push({ type: 'debout', boxeur: d.e, compte: m.compte });
    return;
  }
  if (m.compte >= 10) finir(m, a.e, 'ko', evs);
}

/* ------------------------------------------------------------------ */
/* Les rounds, les juges, la fin                                       */
/* ------------------------------------------------------------------ */

function finRound(m, evs) {
  // Chaque juge voit le round à sa façon (un peu), donne 10 au meilleur, 9 à l'autre, un point de moins par tapis.
  for (let j = 0; j < 3; j++) {
    const vu = m.rd.pts.map((p) => p * (1 + gauss(m) * 0.08));
    let s = [10, 10];
    if (Math.abs(vu[0] - vu[1]) >= 1) s = vu[0] > vu[1] ? [10, 9] : [9, 10];
    s = [s[0] - m.rd.kd[0], s[1] - m.rd.kd[1]];
    m.cartes[j].push(s);
  }
  evs.push({ type: 'cloche', round: m.round, debut: false });
  if (m.round >= m.rounds) { decision(m, evs); return; }
  m.phase = 'repos';
  m.t = REPOS;
  evs.push({ type: 'repos', round: m.round });
}

function decision(m, evs) {
  const totaux = m.cartes.map((c) => c.reduce((t, s) => [t[0] + s[0], t[1] + s[1]], [0, 0]));
  const voix = [0, 0];
  for (const t of totaux) if (t[0] !== t[1]) voix[t[0] > t[1] ? 0 : 1] += 1;
  let v;
  if (voix[0] !== voix[1]) v = voix[0] > voix[1] ? 0 : 1;
  else if (m.stats.touches[0] !== m.stats.touches[1]) v = m.stats.touches[0] > m.stats.touches[1] ? 0 : 1;
  else v = hasard(m) < 0.5 ? 0 : 1;
  m.decision = { totaux, voix, type: voix[v] === 3 ? 'unanime' : voix[1 - v] > 0 ? 'partagee' : voix[v] >= 2 ? 'majorite' : 'arbitre' };
  finir(m, v, 'points', evs);
}

function finir(m, v, issue, evs) {
  m.phase = 'fin';
  m.vainqueur = v;
  m.issue = issue;
  evs.push({ type: 'fin', vainqueur: v, issue, round: m.round, decision: m.decision });
}

/* ------------------------------------------------------------------ */
/* Les déplacements                                                    */
/* ------------------------------------------------------------------ */

function deplacer(m, p, c) {
  const o = m.boxeurs[1 - p.e];
  if (p.esquive > 0) {
    // L'esquive : un pas vif au début, puis on se repose sur ses appuis.
    const v = p.esquive > ESQUIVE.duree - 10 ? ESQUIVE.pas / (10 * DT) : 0;
    p.vx = p.esqX * v; p.vy = p.esqY * v;
  } else {
    let vm = vitesseMax(p) * (p.garde ? 0.6 : 1) * (p.coup ? 0.25 : 1) * (p.etourdi > 0 ? 0.55 : 1) * (p.sonne > 0 ? 0.2 : 1) * (0.7 + 0.3 * p.endu / ENDU_MAX);
    if (m.coins[p.e].ctrl === 'ia') vm *= niveauDe(m.coins[p.e]).vitesse;
    const kk = c.mx || c.my ? 0.22 : 0.18;
    p.vx += (c.mx * vm - p.vx) * kk;
    p.vy += (c.my * vm - p.vy) * kk;
  }
  p.x += p.vx * DT; p.y += p.vy * DT;
  const lim = RING - CORPS_R;
  p.x = clamp(p.x, -lim, lim);
  p.y = clamp(p.y, -lim, lim);
  // Toujours face à l'autre.
  const fx = o.x - p.x, fy = o.y - p.y, l = Math.sqrt(fx * fx + fy * fy);
  if (l > 1e-6) { p.dx = fx / l; p.dy = fy / l; }
}

/** Les deux corps ne se traversent pas. */
function separer(m) {
  const [p, q] = m.boxeurs;
  const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy, min = CORPS_R * 2;
  if (d2 >= min * min || d2 < 1e-9) return;
  const d = Math.sqrt(d2), k = (min - d) / 2;
  p.x -= (dx / d) * k; p.y -= (dy / d) * k;
  q.x += (dx / d) * k; q.y += (dy / d) * k;
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Le temps du round en cours, à afficher : « 1:41 » (il descend). */
export function chronoTexte(m) {
  if (m.entrainement) return '∞';
  const reste = Math.max(0, Math.ceil((m.duree - m.chrono) / FPS));
  return `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`;
}

/** L'empreinte d'un combat : de quoi voir si deux appareils jouent toujours la même chose. */
export function empreinte(m) {
  let h = m.f | 0;
  for (const v of [m.alea, m.round, m.chrono, m.compte]) h = (Math.imul(h, 31) + v) | 0;
  for (const p of m.boxeurs) for (const v of [p.x, p.y, p.sante, p.endu]) h = (Math.imul(h, 31) + Math.round(v * 100)) | 0;
  return String(h >>> 0);
}

/** Joue un combat entier sans humain (pour les tests et l'équilibrage). */
export function simuler(opts) {
  const m = creerCombat({ ...opts, controles: ['ia', 'ia'] });
  let garde = 0;
  while (m.phase !== 'fin' && garde++ < 400000) pas(m, [0, 0]);
  return m;
}
