/**
 * LE VELOURS NOIR — les tables en ligne : blackjack, roulette, poker.
 *
 * Le serveur tient la table : il mélange, tire les cartes et les numéros,
 * fait jouer les habitués (bots) du poker, et raconte tout aux joueurs sous
 * forme d'événements que leurs écrans rejouent. Les caisses restent chez
 * les joueurs (des jetons fictifs) : le serveur dit ce qui se mise et ce qui
 * se gagne, chacun règle la sienne.
 *
 * Une table a un code de quatre lettres ; « publique », elle apparaît dans
 * la liste du hall. Un joueur qui perd la connexion garde sa place un moment
 * (ABSENCE_MS) : il la reprend avec son jeton de place (`revenir`). Pendant
 * son absence, la table joue pour lui le plus prudemment possible.
 *
 * Messages (le champ `g` vaut 'velours') :
 *   → tables                                    ← tables { liste }
 *   → creer { jeu, nom, avatar, publique, petite, cave, jeton }
 *   → rejoindre { code, nom, avatar, cave, jeton }
 *   → info { code }                             ← info { jeu, petite, joueurs, max }
 *   → revenir { code, jeton }                   ← etat {…} ou perdu
 *   → quitter                                   ← parti { jetons? }
 *   blackjack : miser { mise }, pret, action { a }, assurance { oui }
 *   roulette  : paris { paris }, pret
 *   poker     : agir { a }, recave { montant }
 *   ← etat, membres, evts { evts }, compte { reste }, options, reflechit,
 *     mise, paris, lance { numero }, tour, piles { jetons }, erreur { msg }
 */

import crypto from 'node:crypto';
import * as BJ from '../public/shared/casino/blackjack.js';
import * as P from '../public/shared/casino/poker.js';
import * as REACT from '../public/shared/casino/reactions.js';
import * as R from '../public/shared/casino/roulette.js';
import { makeRng, melanger } from '../public/shared/hasard.js';

const JEUX = ['blackjack', 'roulette', 'poker'];
const MAX = { blackjack: BJ.PLACES, roulette: 8, poker: 5 };
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ABSENCE_MS = 2 * 60 * 1000;
const MISES_MS = { blackjack: 15000, roulette: 30000 };
const TOUR_MS = { blackjack: 25000 };   // au poker, pas de limite : la table attend le joueur
const ASSURANCE_MS = 10000;
const LANCER_MS = 7600;
const PETITES = [5, 25];

/** Les habitués du poker. */
export const HABITUES = [
  { nom: 'Lucienne', avatar: '👒', style: 'prudent' },
  { nom: 'Le Baron', avatar: '🎩', style: 'requin' },
  { nom: 'Tony', avatar: '🕶️', style: 'flambeur' },
  { nom: 'Mme Irma', avatar: '🔮', style: 'bluffeur' },
  { nom: 'Kevin', avatar: '🧢', style: 'touriste' },
  { nom: 'Dolores', avatar: '💃', style: 'flambeur' },
  { nom: 'Le Professeur', avatar: '🧐', style: 'prudent' },
  { nom: 'Gaston', avatar: '🥖', style: 'touriste' },
  { nom: 'Vera', avatar: '🦊', style: 'bluffeur' },
  { nom: 'Sergueï', avatar: '🐻', style: 'requin' },
  { nom: 'Rocco', avatar: '🎲', style: 'flambeur' },
  { nom: 'Jeanne', avatar: '🌹', style: 'prudent' },
  { nom: 'Big Sam', avatar: '🤠', style: 'requin' },
  { nom: 'Nadia', avatar: '💎', style: 'bluffeur' },
  { nom: 'Hector', avatar: '🦉', style: 'prudent' },
  { nom: 'Mila', avatar: '🐱', style: 'touriste' },
  { nom: 'Oscar', avatar: '🎷', style: 'requin' },
  { nom: 'Zoé', avatar: '🍀', style: 'flambeur' },
];

/* Le temps : les tests le raccourcissent. */
let vitesse = 1;
export function reglerVitesse(f) { vitesse = f; }

const salles = new Map();
const clients = new Map();
const rnd = (n) => Math.floor(Math.random() * n);

const nettoyerNom = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 14) || 'Joueur';
const nettoyerAvatar = (s) => (typeof s === 'string' && s.length <= 8 && !/[<>]/.test(s) ? s : '🙂');
const jetonValide = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(s);
const entier = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };

function nouveauCode() {
  for (let i = 0; i < 200; i++) {
    let c = '';
    for (let k = 0; k < 4; k++) c += ALPHABET[rnd(ALPHABET.length)];
    if (!salles.has(c)) return c;
  }
  return Date.now().toString(36).toUpperCase().slice(-6);
}

const envoyer = (m, msg) => { if (m?.conn) m.conn.send({ g: 'velours', ...msg }); };
const diffuser = (salle, msg) => { for (const m of salle.membres) envoyer(m, typeof msg === 'function' ? msg(m) : msg); };

function programmer(salle, ms, f) {
  clearTimeout(salle.minuteur);
  salle.minuteur = setTimeout(() => {
    salle.minuteur = null;
    if (!salles.has(salle.code)) return;
    try { f(); } catch (err) { console.error('[velours]', err); }
  }, Math.max(0, ms * vitesse));
  if (typeof salle.minuteur.unref === 'function') salle.minuteur.unref();
}

/** Le temps que mettent les écrans à rejouer des événements (pour ne pas courir devant eux). */
const DUREES = {
  poker: { 'nouvelle-main': 700, blinde: 300, donne: 360, action: 700, ramasser: 700, board: 600, abattage: 1500, gain: 2600, 'fin-main': 300 },
  blackjack: { melange: 1100, donne: 300, carte: 650, assurance: 200, verifie: 900, revele: 800, 'assurance-prise': 300, 'assurance-reglee': 400, brule: 700, double: 900, separe: 600, resultat: 1300, fin: 900 },
};
export function duree(jeu, evts) {
  let d = 0;
  for (const e of evts) {
    d += DUREES[jeu][e.type] || 0;
    if (e.type === 'board') d += 900 * e.cartes.length;
    if (e.type === 'abattage') d += 600 * e.mains.length;
    if (e.type === 'action' && e.quoi === 'tapis') d += 400;
  }
  return d;
}

/** Un seul joueur connecté à la table : pas de compte à rebours, la partie part quand il est prêt. */
const seul = (salle) => salle.membres.filter((m) => m.conn).length <= 1;
const membreDe = (salle, s) => salle.membres.find((m) => m.s === s) || null;
const listeMembres = (salle) => salle.membres.map((m) => ({ s: m.s, nom: m.nom, avatar: m.avatar, absent: !m.conn }));

/* ------------------------------------------------------------------ */
/* Arrivées et départs                                                 */
/* ------------------------------------------------------------------ */

function creerSalle(jeu, o) {
  const code = nouveauCode();
  const rng = makeRng(rnd(2 ** 31));
  const salle = { code, jeu, publique: o.publique !== false, hote: o.nom, membres: [], rng, cree: Date.now(), vu: Date.now(), minuteur: null, attente: [] };
  if (jeu === 'blackjack') salle.b = BJ.creerBlackjack({ rng, places: BJ.PLACES });
  if (jeu === 'roulette') { salle.paris = {}; salle.phase = 'mises'; salle.histo = []; }
  if (jeu === 'poker' && o.tournoi) {
    salle.tournoi = o.tournoi;
    salle.petite = BLINDES[0];
    salle.t = P.creerTable({ rng, petite: BLINDES[0], sieges: o.sieges.map((j) => ({ nom: j.nom, avatar: j.avatar, style: j.style, jetons: j.jetons, humain: j.humain, inscrit: j.inscrit, membre: j.membre })) });
    salle.t.bouton = Math.floor(rng() * o.sieges.length) - 1;
  } else if (jeu === 'poker') {
    salle.petite = PETITES.includes(Number(o.petite)) ? Number(o.petite) : 5;
    const bots = [];
    for (let k = 0; k < 5; k++) bots.push(nouveauBot(salle, bots.map((b) => b.nom)));
    salle.t = P.creerTable({ rng, petite: salle.petite, sieges: bots });
    salle.t.bouton = rnd(5) - 1;
  }
  salles.set(code, salle);
  return salle;
}

function nouveauBot(salle, exclus) {
  const libres = HABITUES.filter((h) => !exclus.includes(h.nom));
  const h = libres[Math.floor(salle.rng() * libres.length)] || HABITUES[0];
  const p = salle.petite;
  const jetons = Math.round(((p === 5 ? 400 : 2000) + salle.rng() * (p === 5 ? 800 : 4000)) / (p * 2)) * p * 2;
  return { ...h, jetons };
}

const caveValide = (salle, v) => {
  const [min, max] = salle.petite === 5 ? [200, 1000] : [1000, 5000];
  return Math.max(min, Math.min(max, entier(v, max) || min));
};

function entrer(c, salle, o) {
  if (salle.tournoi) return envoyer(c, { t: 'erreur', msg: 'C’est une table de tournoi : on s’y inscrit quand le tournoi est annoncé.' });
  const libres = [...Array(MAX[salle.jeu]).keys()].filter((s) => !salle.membres.some((m) => m.s === s));
  if (salle.jeu === 'poker') {
    const humains = salle.t.joueurs.filter((j) => j.humain).length + salle.attente.length;
    if (humains >= 5) return envoyer(c, { t: 'erreur', msg: 'Cette table est complète.' });
  } else if (!libres.length) return envoyer(c, { t: 'erreur', msg: 'Cette table est complète.' });
  sortir(c);
  const m = { jeton: jetonValide(o.jeton) ? o.jeton : `j${Date.now().toString(36)}${rnd(1e9)}`, nom: nettoyerNom(o.nom), avatar: nettoyerAvatar(o.avatar), conn: c.conn, s: -1, depuis: 0, pret: false };
  c.membre = m;
  c.code = salle.code;
  salle.membres.push(m);
  salle.vu = Date.now();
  if (salle.jeu === 'poker') {
    m.cave = caveValide(salle, o.cave);
    salle.attente.push(m);
  } else {
    m.s = libres[0];
    if (salle.jeu === 'blackjack') {
      if (salle.b.sieges[m.s]?.parti) salle.b.sieges[m.s] = null;
      if (!salle.b.sieges[m.s]) BJ.asseoir(salle.b, m.s, { nom: m.nom, avatar: m.avatar });
    }
  }
  envoyer(m, { t: 'entre', code: salle.code, jeu: salle.jeu, jeton: m.jeton });
  envoyer(m, etat(salle, m));
  diffuser(salle, { t: 'membres', liste: listeMembres(salle), arrive: m.nom });
  if (salle.jeu === 'roulette' && !salle.minuteur && salle.phase === 'mises') tourRoulette(salle);
  if (salle.jeu === 'poker' && !salle.minuteur && !(salle.attendu >= 0)) etapePoker(salle);
}

/** Un membre s'en va pour de bon (il est parti, ou n'est pas revenu à temps). */
function partir(salle, m, rendre) {
  const k = salle.membres.indexOf(m);
  if (k < 0) return;
  salle.membres.splice(k, 1);
  clearTimeout(m.absence);
  if (salle.jeu === 'blackjack' && m.s >= 0) {
    const tour = salle.b.tour?.s === m.s;
    BJ.lever(salle.b, m.s);
    diffuserEvts(salle);
    if (tour || salle.b.phase === 'assurance' || salle.b.phase === 'fin') suiteBlackjack(salle);
  }
  if (salle.jeu === 'roulette') { delete salle.paris[m.s]; diffuser(salle, { t: 'paris', s: m.s, paris: {} }); }
  if (salle.jeu === 'poker') {
    salle.attente = salle.attente.filter((x) => x !== m);
    const j = m.s >= 0 ? salle.t.joueurs[m.s] : null;
    if (j && j.humain === m.jeton) {
      j.partant = true;
      if (rendre) envoyer(m, salle.tournoi ? { t: 'parti', tournoi: true } : { t: 'parti', jetons: j.jetons });
      if (salle.t.aQui === m.s && !salle.t.joueurs[m.s].couche) { clearTimeout(salle.minuteur); salle.minuteur = null; jouerPour(salle, m.s); }
      if (!enMain(salle) && !salle.tournoi) placerPoker(salle);
    } else if (rendre) envoyer(m, { t: 'parti', jetons: m.cave || 0 });
  } else if (rendre) envoyer(m, { t: 'parti' });
  diffuser(salle, { t: 'membres', liste: listeMembres(salle), part: m.nom });
  if (!salle.membres.length && !salle.tournoi) fermer(salle);
}

function fermer(salle) {
  clearTimeout(salle.minuteur);
  for (const m of salle.membres) clearTimeout(m.absence);
  salles.delete(salle.code);
}

function sortir(c) {
  const salle = c.code && salles.get(c.code);
  const m = c.membre;
  c.code = null; c.membre = null;
  if (salle && m) partir(salle, m, true);
}

/* ------------------------------------------------------------------ */
/* L'état complet, pour qui arrive ou revient                          */
/* ------------------------------------------------------------------ */

function etat(salle, m) {
  const base = { t: 'etat', jeu: salle.jeu, code: salle.code, publique: salle.publique, moi: m.s, membres: listeMembres(salle) };
  if (salle.jeu === 'blackjack') {
    return { ...base, table: BJ.photo(salle.b), compte: salle.finMises ? Math.max(0, salle.finMises - Date.now()) : 0 };
  }
  if (salle.jeu === 'roulette') {
    return { ...base, phase: salle.phase, paris: salle.paris, histo: salle.histo, compte: salle.finMises ? Math.max(0, salle.finMises - Date.now()) : 0 };
  }
  const t = salle.t;
  return {
    ...base, petite: t.petite, grosse: t.grosse, bouton: t.bouton, phase: t.phase, board: t.board, pot: t.pot, aQui: t.aQui,
    attente: salle.attente.includes(m),
    tournoi: salle.tournoi ? infoTournoi(salle) : null,
    joueurs: t.joueurs.map((j, i) => ({
      nom: j.nom, avatar: j.avatar, style: j.style || null, humain: !!j.humain, jetons: j.jetons, mise: j.mise,
      couche: j.couche, tapis: j.tapis, absent: j.absent, cartes: i === m.s ? j.cartes : j.cartes.map(() => null),
    })),
  };
}

/** Envoie les événements de la table à chacun (au poker, sans les cartes des autres). */
function diffuserEvts(salle) {
  const moteur = salle.jeu === 'poker' ? salle.t : salle.b;
  const evts = moteur.evts;
  moteur.evts = [];
  if (!evts.length) return 0;
  if (salle.jeu === 'poker') {
    diffuser(salle, (m) => ({ t: 'evts', evts: evts.map((e) => (e.type === 'donne' && e.i !== m.s ? { ...e, carte: null } : e)) }));
    if (evts.some((e) => e.type === 'fin-main')) diffuser(salle, { t: 'piles', jetons: salle.t.joueurs.map((j) => j.jetons) });
  } else diffuser(salle, { t: 'evts', evts });
  return duree(salle.jeu, evts);
}

/* ------------------------------------------------------------------ */
/* Blackjack                                                           */
/* ------------------------------------------------------------------ */

function miserBlackjack(salle, m, mise) {
  const b = salle.b;
  if (b.phase !== 'mise' && b.phase !== 'fin') return;
  if (!BJ.miser(b, m.s, entier(mise, 10 ** 9))) return;   // pas de mise maximum
  diffuser(salle, { t: 'mise', s: m.s, mise: b.sieges[m.s].mise });
  const misent = b.sieges.some((x) => x?.mise > 0);
  if (misent && !salle.finMises && !seul(salle)) {
    salle.finMises = Date.now() + MISES_MS.blackjack * vitesse;
    diffuser(salle, { t: 'compte', reste: MISES_MS.blackjack * vitesse });
    programmer(salle, MISES_MS.blackjack, () => donnerBlackjack(salle));
  }
  if (!misent && salle.finMises) { salle.finMises = 0; clearTimeout(salle.minuteur); salle.minuteur = null; diffuser(salle, { t: 'compte', reste: 0 }); }
}

function donnerBlackjack(salle) {
  salle.finMises = 0;
  for (const m of salle.membres) m.pret = false;
  if (!BJ.distribuer(salle.b)) return;
  const d = diffuserEvts(salle);
  programmer(salle, d, () => suiteBlackjack(salle));
}

/** Ce qui doit se passer maintenant à la table de blackjack. */
function suiteBlackjack(salle) {
  const b = salle.b;
  if (b.phase === 'assurance') {
    for (const [s, x] of b.sieges.entries()) {
      if (x?.enJeu && !x.decide && !membreDe(salle, s)?.conn) BJ.assurer(b, s, false);
    }
    if (b.phase === 'assurance') return programmer(salle, ASSURANCE_MS, () => {
      for (const [s, x] of b.sieges.entries()) if (x?.enJeu && !x.decide) BJ.assurer(b, s, false);
      programmer(salle, diffuserEvts(salle), () => suiteBlackjack(salle));
    });
    return programmer(salle, diffuserEvts(salle), () => suiteBlackjack(salle));
  }
  if (b.phase === 'jeu') {
    const s = b.tour.s;
    const m = membreDe(salle, s);
    const auto = () => { BJ.rester(b, s); programmer(salle, diffuserEvts(salle), () => suiteBlackjack(salle)); };
    if (!m?.conn) return programmer(salle, 700, auto);
    return programmer(salle, TOUR_MS.blackjack, auto);
  }
  if (b.phase === 'fin') {
    programmer(salle, 2500, () => diffuser(salle, { t: 'tour' }));
  }
}

function actionBlackjack(salle, m, msg) {
  const b = salle.b;
  if (msg.t === 'assurance') {
    if (b.phase !== 'assurance') return;
    BJ.assurer(b, m.s, !!msg.oui);
    const d = diffuserEvts(salle);
    if (b.phase !== 'assurance') { clearTimeout(salle.minuteur); salle.minuteur = null; programmer(salle, d, () => suiteBlackjack(salle)); }
    return;
  }
  const f = { carte: BJ.carte, rester: BJ.rester, doubler: BJ.doubler, separer: BJ.separer }[msg.a];
  if (!f || b.tour?.s !== m.s) return;
  if (!f(b, m.s)) return;
  clearTimeout(salle.minuteur); salle.minuteur = null;
  programmer(salle, diffuserEvts(salle), () => suiteBlackjack(salle));
}

/* ------------------------------------------------------------------ */
/* Roulette                                                            */
/* ------------------------------------------------------------------ */

function tourRoulette(salle) {
  salle.phase = 'mises';
  if (seul(salle)) {
    salle.finMises = 0;
    clearTimeout(salle.minuteur); salle.minuteur = null;
    for (const m of salle.membres) m.pret = false;
    return diffuser(salle, { t: 'compte', reste: 0, phase: 'mises' });
  }
  salle.finMises = Date.now() + MISES_MS.roulette * vitesse;
  for (const m of salle.membres) m.pret = false;
  diffuser(salle, { t: 'compte', reste: MISES_MS.roulette * vitesse, phase: 'mises' });
  programmer(salle, MISES_MS.roulette, () => lancerRoulette(salle));
}

function lancerRoulette(salle) {
  const mises = Object.values(salle.paris).some((p) => Object.keys(p).length);
  if (!mises) return tourRoulette(salle);
  const numero = R.tirer(salle.rng);
  salle.phase = 'lance';
  salle.finMises = 0;
  salle.histo.unshift(numero);
  salle.histo = salle.histo.slice(0, 40);
  diffuser(salle, { t: 'lance', numero });
  programmer(salle, LANCER_MS + 7000, () => {
    salle.paris = {};
    diffuser(salle, { t: 'tour' });
    tourRoulette(salle);
  });
}

function parisRoulette(salle, m, paris) {
  if (salle.phase !== 'mises') return;
  const propres = {};
  let total = 0;
  for (const [id, v] of Object.entries(paris && typeof paris === 'object' ? paris : {})) {
    const n = entier(v, 100000);
    if (!R.PAR_ID[id] || !n || total + n > 100000) continue;
    propres[id] = n;
    total += n;
  }
  salle.paris[m.s] = propres;
  diffuser(salle, { t: 'paris', s: m.s, paris: propres });
}

/* ------------------------------------------------------------------ */
/* Poker                                                               */
/* ------------------------------------------------------------------ */

const enMain = (salle) => !['attente', 'fin', 'fin-partie'].includes(salle.t.phase);

/** Entre deux mains : les partants s'en vont, les arrivants s'assoient, les habitués ruinés sont remplacés. */
function placerPoker(salle) {
  const t = salle.t;
  const noms = () => t.joueurs.map((j) => j.nom);
  t.joueurs.forEach((j, i) => {
    const m = j.humain && salle.membres.find((x) => x.jeton === j.humain);
    if (j.humain && (!m || j.partant)) P.asseoir(t, i, nouveauBot(salle, noms()));
    else if (!j.humain && j.jetons <= 0) P.asseoir(t, i, nouveauBot(salle, noms()));
  });
  while (salle.attente.length) {
    const libre = t.joueurs.map((j, i) => (!j.humain ? i : -1)).filter((i) => i >= 0);
    if (!libre.length) break;
    const m = salle.attente.shift();
    const i = libre[Math.floor(salle.rng() * libre.length)];
    P.asseoir(t, i, { nom: m.nom, avatar: m.avatar, jetons: m.cave, humain: m.jeton });
    m.s = i;
  }
  diffuser(salle, (m) => etat(salle, m));
}

function etapePoker(salle) {
  const t = salle.t;
  if (!salle.membres.length && !salle.tournoi) return;
  if (salle.tournoi && !salles.has(salle.code)) return;
  if (!enMain(salle)) {
    if (t.phase === 'fin' && !salle.pause) { salle.pause = true; return programmer(salle, 3000, () => etapePoker(salle)); }
    salle.pause = false;
    if (salle.tournoi) { if (!entreMainsTournoi(salle)) return; } else placerPoker(salle);
    P.nouvelleMain(t);
    if (t.phase === 'fin-partie') { t.phase = 'attente'; return; }
    return programmer(salle, diffuserEvts(salle), () => etapePoker(salle));
  }
  const i = t.aQui;
  const j = t.joueurs[i];
  if (!j.humain) {
    diffuser(salle, { t: 'reflechit', i });
    return programmer(salle, 600 + salle.rng() * 900, () => {
      P.agir(t, P.decider(t));
      programmer(salle, diffuserEvts(salle), () => etapePoker(salle));
    });
  }
  const m = salle.membres.find((x) => x.jeton === j.humain);
  if (!m?.conn || j.partant) return programmer(salle, 700, () => jouerPour(salle, i));
  // pas de limite de temps : la table attend sa décision (elle ne joue pour lui que s'il se déconnecte)
  salle.attendu = i;
  envoyer(m, { t: 'options', ...P.options(t, i), miseCourante: t.miseCourante });
  diffuser(salle, { t: 'reflechit', i });
}

/** La table joue à la place d'un absent : parole si c'est gratuit, sinon il se couche. */
function jouerPour(salle, i) {
  const t = salle.t;
  salle.attendu = -1;
  if (t.aQui !== i || !enMain(salle) || t.phase === 'fin') return etapePoker(salle);
  P.agir(t, { type: P.options(t, i).parole ? 'parole' : 'coucher' });
  programmer(salle, diffuserEvts(salle), () => etapePoker(salle));
}

function agirPoker(salle, m, a) {
  const t = salle.t;
  if (!enMain(salle) || t.phase === 'fin' || t.aQui !== m.s || t.joueurs[m.s]?.humain !== m.jeton) return;
  const type = ['coucher', 'parole', 'suivre', 'relancer', 'tapis'].includes(a?.type) ? a.type : 'coucher';
  clearTimeout(salle.minuteur); salle.minuteur = null;
  salle.attendu = -1;
  P.agir(t, { type, total: entier(a?.total, 10 ** 9) });
  programmer(salle, diffuserEvts(salle), () => etapePoker(salle));
}

function recavePoker(salle, m, montant) {
  const j = m.s >= 0 ? salle.t.joueurs[m.s] : null;
  if (!j || j.humain !== m.jeton || j.jetons > 0) return;
  j.jetons = caveValide(salle, montant);
  diffuser(salle, (x) => etat(salle, x));
  if (!salle.minuteur && !(salle.attendu >= 0)) etapePoker(salle);
}

/* ------------------------------------------------------------------ */
/* Les tournois de poker                                               */
/* ------------------------------------------------------------------ */

/*
 * Un tournoi surgit au hasard (un seul à la fois) : une affiche est envoyée
 * à tous ceux qui sont au Velours Noir, les inscriptions restent ouvertes
 * deux minutes, puis les places vides sont prises par les habitués. Tables
 * de cinq ; plusieurs tables fusionnent en une table finale quand il ne
 * reste que cinq joueurs. Même tapis pour tous, blindes qui montent toutes
 * les six mains, pas de recave ; les trois premiers se partagent le prix.
 */
export const TOURNOIS = [
  { id: 'mardi', nom: 'Partie du mardi', entree: 100, places: 5, prix: 500, poids: 50 },
  { id: 'coupe', nom: 'Coupe du Velours', entree: 500, places: 10, prix: 4000, poids: 30 },
  { id: 'nuit', nom: 'Nuit des Flambeurs', entree: 2000, places: 10, prix: 15000, poids: 15 },
  { id: 'grand', nom: 'Grand Prix du Velours', entree: 10000, places: 15, prix: 100000, poids: 5 },
];
export const TAPIS_TOURNOI = 1500;
export const MAINS_PAR_NIVEAU = 6;
export const BLINDES = [10, 15, 25, 50, 75, 100, 150, 200, 300, 500, 800, 1000, 1500, 2000];
export const PARTS = [0.5, 0.3, 0.2];
const INSCRIPTION_MS = 2 * 60 * 1000;
const ENTRE_TOURNOIS = [10 * 60 * 1000, 20 * 60 * 1000];

let tournoi = null;
let prochain = null;
let numero = 0;

export const prixDe = (tn, place) => (place >= 1 && place <= PARTS.length ? Math.round(tn.prix * PARTS[place - 1]) : 0);

/** Tous ceux qui sont au Velours Noir. */
function aTous(msg) { for (const c of clients.values()) if (c.conn) c.conn.send({ g: 'velours', ...msg }); }

const affiche = (tn) => ({
  id: tn.id, nom: tn.nom, entree: tn.entree, prix: tn.prix, places: tn.places, parts: PARTS.map((p) => Math.round(tn.prix * p)),
  inscrits: tn.inscrits.length, reste: Math.max(0, tn.debut - Date.now()), phase: tn.phase,
});

/** Le prochain tournoi, dans 10 à 20 minutes. */
export function planifierTournoi(ms = ENTRE_TOURNOIS[0] + Math.random() * (ENTRE_TOURNOIS[1] - ENTRE_TOURNOIS[0])) {
  clearTimeout(prochain);
  prochain = setTimeout(() => {
    // personne au casino : on repasse plus tard
    if (![...clients.values()].some((c) => c.velours)) return planifierTournoi();
    annoncerTournoi();
  }, ms * vitesse);
  if (typeof prochain.unref === 'function') prochain.unref();
}

/** Un tournoi est annoncé (au hasard parmi les types, les gros plus rares). */
export function annoncerTournoi(type = null, inscriptionMs = INSCRIPTION_MS) {
  if (tournoi) return tournoi;
  let modele = TOURNOIS.find((x) => x.id === type);
  if (!modele) {
    let x = Math.random() * TOURNOIS.reduce((s, t) => s + t.poids, 0);
    modele = TOURNOIS.find((t) => (x -= t.poids) <= 0) || TOURNOIS[0];
  }
  tournoi = { ...modele, type: modele.id, id: `T${++numero}${Date.now().toString(36)}`, inscrits: [], phase: 'inscription', debut: Date.now() + inscriptionMs * vitesse, tables: [], restants: 0, classement: [], rng: makeRng(rnd(2 ** 31)) };
  const tn = tournoi;
  tn.minuteur = setTimeout(() => demarrerTournoi(tn), inscriptionMs * vitesse);
  if (typeof tn.minuteur.unref === 'function') tn.minuteur.unref();
  aTous({ t: 'tournoi-annonce', tournoi: affiche(tn) });
  return tn;
}

function inscrire(c, msg) {
  const tn = tournoi;
  if (!tn || tn.id !== msg.id || tn.phase !== 'inscription') return c.conn.send({ g: 'velours', t: 'tournoi-refus', id: msg.id, msg: 'Les inscriptions sont fermées.' });
  if (tn.inscrits.some((x) => x.c === c)) return;
  if (tn.inscrits.length >= tn.places) return c.conn.send({ g: 'velours', t: 'tournoi-refus', id: msg.id, msg: 'Le tournoi est complet.' });
  tn.inscrits.push({ c, nom: nettoyerNom(msg.nom), avatar: nettoyerAvatar(msg.avatar), jeton: jetonValide(msg.jeton) ? msg.jeton : `t${rnd(1e12)}` });
  c.conn.send({ g: 'velours', t: 'tournoi-inscrit', id: tn.id });
  aTous({ t: 'tournoi-maj', tournoi: affiche(tn) });
}

function desinscrire(c, msg) {
  const tn = tournoi;
  if (!tn || tn.id !== msg.id || tn.phase !== 'inscription') return;
  const k = tn.inscrits.findIndex((x) => x.c === c);
  if (k < 0) return;
  tn.inscrits.splice(k, 1);
  c.conn.send({ g: 'velours', t: 'tournoi-rembourse', id: tn.id, montant: tn.entree });
  aTous({ t: 'tournoi-maj', tournoi: affiche(tn) });
}

/** Les inscriptions se ferment : les places vides vont aux habitués, et on s'assoit. */
export function demarrerTournoi(tn = tournoi) {
  if (!tn || tn.phase !== 'inscription' || tournoi !== tn) return;
  clearTimeout(tn.minuteur);
  const humains = tn.inscrits.filter((x) => x.c.conn && clients.get(x.c.conn.id) === x.c);
  if (!humains.length) {
    tournoi = null;
    aTous({ t: 'tournoi-annule', id: tn.id });
    planifierTournoi();
    return;
  }
  tn.phase = 'jeu';
  const noms = humains.map((h) => h.nom);
  const joueurs = humains.map((h) => ({ nom: h.nom, avatar: h.avatar, jetons: TAPIS_TOURNOI, humain: h.jeton, inscrit: h }));
  while (joueurs.length < tn.places) {
    const libres = HABITUES.filter((h) => !noms.includes(h.nom));
    const h = libres[Math.floor(tn.rng() * libres.length)] || HABITUES[joueurs.length % HABITUES.length];
    noms.push(h.nom);
    joueurs.push({ ...h, jetons: TAPIS_TOURNOI });
  }
  melanger(joueurs, tn.rng);
  tn.restants = joueurs.length;
  const nb = Math.ceil(joueurs.length / 5);
  const groupes = Array.from({ length: nb }, () => []);
  joueurs.forEach((j, k) => groupes[k % nb].push(j));
  aTous({ t: 'tournoi-debut', id: tn.id });
  for (const g of groupes) ouvrirTableTournoi(tn, g);
}

/** Une table du tournoi, avec ses joueurs (les humains y sont installés). */
function ouvrirTableTournoi(tn, joueurs) {
  const salle = creerSalle('poker', { publique: false, nom: tn.nom, tournoi: tn, sieges: joueurs });
  tn.tables.push(salle);
  joueurs.forEach((j, i) => {
    if (!j.humain) return;
    const ins = j.inscrit;
    const c = ins?.c;
    const ancien = j.membre;
    const m = ancien || { jeton: j.humain, nom: j.nom, avatar: j.avatar, conn: c?.conn || null, depuis: 0, pret: false };
    m.s = i;
    if (ancien) for (const x of clients.values()) if (x.membre === ancien) x.code = salle.code;
    if (c && c.membre !== m) {
      const avant = c.code && salles.get(c.code);
      if (avant && avant !== salle && !avant.tournoi) sortir(c);
      c.membre = m; c.code = salle.code;
    }
    salle.membres.push(m);
    envoyer(m, { t: 'entre', code: salle.code, jeu: 'poker', jeton: m.jeton });
    envoyer(m, etat(salle, m));
  });
  salle.t.joueurs.forEach((j) => { delete j.inscrit; delete j.membre; });
  if (salle.membres.length) etapePoker(salle);
  else programmer(salle, 300, () => etapePoker(salle));
  return salle;
}

const vivants = (salle) => salle.t.joueurs.filter((j) => j.jetons > 0 && !j.elimine);

/** Ce que les écrans affichent du tournoi. */
export function infoTournoi(salle) {
  const tn = salle.tournoi;
  const n = salle.mainsTournoi || 0;
  return {
    id: tn.id, nom: tn.nom, prix: tn.prix, parts: PARTS.map((p) => Math.round(tn.prix * p)), places: tn.places, restants: tn.restants,
    niveau: Math.min(BLINDES.length, Math.floor(n / MAINS_PAR_NIVEAU) + 1), petite: salle.t.petite, grosse: salle.t.grosse,
    avantNiveau: MAINS_PAR_NIVEAU - (n % MAINS_PAR_NIVEAU), finale: tn.tables.length === 1 && tn.places > 5,
  };
}
const aLaTable = (tn, msg) => { for (const s of tn.tables) diffuser(s, typeof msg === 'function' ? (m) => msg(s, m) : msg); };

/**
 * Entre deux mains d'une table du tournoi : les éliminés, la montée des
 * blindes, la fusion des tables, la fin. Vrai si la table peut redistribuer.
 */
function entreMainsTournoi(salle) {
  const tn = salle.tournoi;
  const t = salle.t;
  // les éliminés (ou ceux qui ont quitté le tournoi)
  const tombes = t.joueurs.filter((j) => !j.elimine && (j.jetons <= 0 || j.partant));
  tombes.sort((a, b) => (a.jetonsAvant || 0) - (b.jetonsAvant || 0));
  for (const j of tombes) {
    j.elimine = true;
    j.jetons = 0;
    const place = tn.restants;
    tn.restants--;
    tn.classement.push({ nom: j.nom, place });
    const m = j.humain && salle.membres.find((x) => x.jeton === j.humain);
    if (m) {
      envoyer(m, { t: 'tournoi-fin', id: tn.id, nom: tn.nom, place, sur: tn.places, prix: j.partant ? 0 : prixDe(tn, place) });
      salle.membres.splice(salle.membres.indexOf(m), 1);
      for (const c of clients.values()) if (c.membre === m) { c.membre = null; c.code = null; }
    }
    aLaTable(tn, { t: 'tournoi-elimine', nom: j.nom, place, restants: tn.restants });
  }
  // plus aucun vrai joueur dans le tournoi : les habitués n'ont pas besoin de finir
  if (!tn.tables.some((s) => s.membres.length)) { finirTournoi(tn); return false; }
  if (tombes.length) for (const s of tn.tables) if (s !== salle && s.enAttente && !s.minuteur) programmer(s, 50, () => etapePoker(s));
  // le vainqueur
  if (tn.restants <= 1) {
    const tous = tn.tables.flatMap((s) => s.t.joueurs);
    const v = tous.find((j) => !j.elimine && j.jetons > 0);
    if (v) {
      tn.classement.push({ nom: v.nom, place: 1 });
      const s = tn.tables.find((x) => x.t.joueurs.includes(v));
      const m = v.humain && s.membres.find((x) => x.jeton === v.humain);
      if (m) envoyer(m, { t: 'tournoi-fin', id: tn.id, nom: tn.nom, place: 1, sur: tn.places, prix: prixDe(tn, 1), vainqueur: true });
      aLaTable(tn, { t: 'tournoi-elimine', nom: v.nom, place: 1, restants: 0, vainqueur: true });
    }
    finirTournoi(tn);
    return false;
  }
  // plusieurs tables : fusion quand il ne reste que cinq joueurs, ou quand une table est seule
  if (tn.tables.length > 1) {
    salle.enAttente = false;
    if (tn.restants <= 5 || vivants(salle).length < 2) {
      salle.enAttente = true;
      if (tn.restants <= 5) {
        if (tn.tables.every((s) => s.enAttente || !enMain(s))) { fusionnerTables(tn); return false; }
        return false;
      }
      // une table d'un seul joueur : il rejoint une table qui a une place (à sa prochaine donne)
      const seul = vivants(salle)[0];
      const cible = tn.tables.find((s) => s !== salle && s.t.joueurs.some((j) => j.elimine) && !s.transfert);
      if (seul && cible) {
        cible.transfert = { joueur: seul, depuis: salle };
        if (!enMain(cible) && !cible.minuteur) etapePoker(cible);
      }
      return false;
    }
  }
  // un joueur transféré d'une autre table s'assoit à une place libérée
  if (salle.transfert) {
    const { joueur, depuis } = salle.transfert;
    salle.transfert = null;
    const i = t.joueurs.findIndex((j) => j.elimine);
    if (i >= 0) {
      const m = joueur.humain && depuis.membres.find((x) => x.jeton === joueur.humain);
      P.asseoir(t, i, { nom: joueur.nom, avatar: joueur.avatar, style: joueur.style, jetons: joueur.jetons, humain: joueur.humain });
      joueur.jetons = 0; joueur.elimine = true; joueur.transfere = true;
      if (m) {
        depuis.membres.splice(depuis.membres.indexOf(m), 1);
        m.s = i;
        salle.membres.push(m);
        for (const c of clients.values()) if (c.membre === m) c.code = salle.code;
        envoyer(m, { t: 'entre', code: salle.code, jeu: 'poker', jeton: m.jeton });
      }
      clearTimeout(depuis.minuteur);
      tn.tables = tn.tables.filter((s) => s !== depuis);
      salles.delete(depuis.code);
      diffuser(salle, (x) => etat(salle, x));
    }
  }
  // les blindes
  const niveau = Math.min(BLINDES.length - 1, Math.floor((salle.mainsTournoi || 0) / MAINS_PAR_NIVEAU));
  if (t.petite !== BLINDES[niveau]) {
    t.petite = BLINDES[niveau]; t.grosse = t.petite * 2; t.relanceMin = t.grosse;
    diffuser(salle, { t: 'tournoi-info', tournoi: infoTournoi(salle), monte: true });
  } else diffuser(salle, { t: 'tournoi-info', tournoi: infoTournoi(salle) });
  salle.mainsTournoi = (salle.mainsTournoi || 0) + 1;
  for (const j of t.joueurs) j.jetonsAvant = j.jetons;
  return true;
}

/** La table finale : tous ceux qui restent, avec leurs jetons. */
function fusionnerTables(tn) {
  const anciennes = tn.tables;
  const joueurs = [];
  for (const s of anciennes) {
    clearTimeout(s.minuteur);
    for (const j of vivants(s)) {
      const m = j.humain && s.membres.find((x) => x.jeton === j.humain);
      joueurs.push({ nom: j.nom, avatar: j.avatar, style: j.style, jetons: j.jetons, humain: j.humain, membre: m || null });
    }
    salles.delete(s.code);
  }
  tn.tables = [];
  const finale = ouvrirTableTournoi(tn, joueurs);
  finale.mainsTournoi = Math.max(...anciennes.map((s) => s.mainsTournoi || 0));
  diffuser(finale, { t: 'tournoi-finale' });
}

function finirTournoi(tn) {
  for (const s of tn.tables) {
    clearTimeout(s.minuteur);
    for (const m of s.membres) for (const c of clients.values()) if (c.membre === m) { c.membre = null; c.code = null; }
    salles.delete(s.code);
  }
  tn.tables = [];
  tn.phase = 'fin';
  if (tournoi === tn) tournoi = null;
  planifierTournoi();
}

/** Pour les tests : plus de tournoi programmé. */
export function arreterTournois() { clearTimeout(prochain); if (tournoi) clearTimeout(tournoi.minuteur); tournoi = null; }
export const tournoiEnCours = () => tournoi;

/* ------------------------------------------------------------------ */
/* Le modérateur                                                       */
/* ------------------------------------------------------------------ */

/*
 * Le code du modérateur vit dans une variable d'environnement du serveur
 * (MODERATEUR_CODE, sur Render) — jamais dans le code du site. Le bon code
 * donne un jeton signé (HMAC), valable 30 jours, que l'écran garde et
 * présente à chaque connexion. Sans code configuré, personne n'est
 * modérateur — sauf en développement (ni Render ni Vercel), où le code
 * « moderateur » permet d'essayer.
 *
 * Le compte : MODERATEUR_PROFIL (le code de profil de l'arcade du modérateur).
 * Réglé, il réserve tout à ce seul profil ; le jeton est lié au profil.
 *
 * Messages : → moderateur { code, profil } ou { jeton, profil }   ← moderateur { ok, jeton?, msg? }
 */

const JOUR = 24 * 60 * 60 * 1000;
const DUREE_JETON = 30 * JOUR;
const ESSAIS_MAX = 5;            // par connexion et par minute

function codeModerateur() {
  const env = typeof process !== 'undefined' ? process.env : {};
  if (env.MODERATEUR_CODE) return String(env.MODERATEUR_CODE);
  return !env.RENDER && !env.VERCEL ? 'moderateur' : null;
}

/**
 * Le compte du modérateur : son code de profil de l'arcade (MODERATEUR_PROFIL).
 * S'il est réglé, aucun autre profil ne peut devenir modérateur, même avec le code.
 */
function profilModerateur() {
  const env = typeof process !== 'undefined' ? process.env : {};
  return env.MODERATEUR_PROFIL ? normaliserProfil(env.MODERATEUR_PROFIL) : null;
}
const normaliserProfil = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

/** Le jeton est lié au profil : il ne sert à rien sur un autre compte. */
function signer(exp, code, profil) {
  return crypto.createHmac('sha256', code).update(`velours-moderateur|${exp}|${profil}`).digest('base64url');
}

const egaux = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Un jeton de modérateur encore valable ? */
export function jetonValideModerateur(jeton, profil) {
  const code = codeModerateur();
  const p = normaliserProfil(profil);
  if (!code || typeof jeton !== 'string' || !p) return false;
  const attendu = profilModerateur();
  if (attendu && p !== attendu) return false;
  const [exp, sig] = jeton.split('.');
  return Number(exp) > Date.now() && egaux(sig || '', signer(exp, code, p));
}

function moderateur(c, msg) {
  const code = codeModerateur();
  const repondre = (o) => c.conn.send({ g: 'velours', t: 'moderateur', ...o });
  if (!code) return repondre({ ok: false, msg: 'Aucun code de modérateur n’est configuré sur le serveur.' });
  const profil = normaliserProfil(msg.profil);
  if (msg.jeton !== undefined) {
    c.moderateur = jetonValideModerateur(msg.jeton, profil);
    return repondre({ ok: c.moderateur, verif: true });
  }
  const maintenant = Date.now();
  c.essais = (c.essais || []).filter((t) => maintenant - t < 60000);
  if (c.essais.length >= ESSAIS_MAX) return repondre({ ok: false, msg: 'Trop d’essais. Réessayez dans une minute.' });
  c.essais.push(maintenant);
  // sur un autre compte que celui de la direction : refusé, et on ne dit pas si le code était bon
  const attendu = profilModerateur();
  if (!profil || (attendu && profil !== attendu)) { c.moderateur = false; return repondre({ ok: false, msg: 'Accès refusé.' }); }
  if (typeof msg.code !== 'string' || !egaux(msg.code.trim(), code)) { c.moderateur = false; return repondre({ ok: false, msg: 'Accès refusé.' }); }
  c.moderateur = true;
  const exp = String(maintenant + DUREE_JETON);
  repondre({ ok: true, jeton: `${exp}.${signer(exp, code, profil)}` });
}

planifierTournoi();

/* ------------------------------------------------------------------ */
/* Le routeur                                                          */
/* ------------------------------------------------------------------ */

export function handleOpen(conn) {
  clients.set(conn.id, { conn, code: null, membre: null });
}

export function handleMessage(conn, msg) {
  if (!msg || typeof msg !== 'object') return;
  let c = clients.get(conn.id);
  if (!c) { handleOpen(conn); c = clients.get(conn.id); }
  c.conn = conn;
  const salle = c.code ? salles.get(c.code) : null;
  const m = c.membre;
  if (salle) salle.vu = Date.now();
  c.velours = true;
  switch (msg.t) {
    case 'bonjour':
      if (tournoi?.phase === 'inscription') conn.send({ g: 'velours', t: 'tournoi-annonce', tournoi: affiche(tournoi), inscrit: tournoi.inscrits.some((x) => x.c === c) });
      return;
    case 'tournoi-inscrire': return inscrire(c, msg);
    // en développement seulement (ni Render ni Vercel) : un tournoi tout de suite, pour essayer
    case 'moderateur': return moderateur(c, msg);
    // un tournoi tout de suite : pour le modérateur (ou en développement)
    case 'tournoi-demo':
      if (c.moderateur || (typeof process !== 'undefined' && !process.env.RENDER && !process.env.VERCEL)) {
        if (tournoi) conn.send({ g: 'velours', t: 'erreur', msg: 'Un tournoi est déjà en cours.' });
        else annoncerTournoi(msg.type, c.moderateur ? 30000 : 15000);
      }
      return;
    case 'tournoi-desinscrire': return desinscrire(c, msg);
    case 'ping': return conn.send({ t: 'pong' });
    case 'tables':
      return conn.send({ g: 'velours', t: 'tables', liste: [...salles.values()]
        .filter((s) => s.publique && (!msg.jeu || s.jeu === msg.jeu))
        .map((s) => ({ code: s.code, jeu: s.jeu, hote: s.hote, joueurs: s.membres.length, max: MAX[s.jeu], petite: s.petite || 0 }))
        .filter((s) => s.joueurs < s.max)
        .slice(0, 30) });
    case 'info': {
      const s = salles.get(String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
      if (!s) return conn.send({ g: 'velours', t: 'erreur', msg: 'Aucune table avec ce code.' });
      return conn.send({ g: 'velours', t: 'info', code: s.code, jeu: s.jeu, petite: s.petite || 0, joueurs: s.membres.length, max: MAX[s.jeu] });
    }
    case 'creer': {
      if (!JEUX.includes(msg.jeu)) return;
      const s = creerSalle(msg.jeu, { publique: msg.publique, nom: nettoyerNom(msg.nom), petite: msg.petite });
      return entrer(c, s, msg);
    }
    case 'rejoindre': {
      const s = salles.get(String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
      if (!s) return conn.send({ g: 'velours', t: 'erreur', msg: 'Aucune table avec ce code.' });
      return entrer(c, s, msg);
    }
    case 'revenir': {
      const s = salles.get(String(msg.code || '').toUpperCase());
      const ancien = s && jetonValide(msg.jeton) && s.membres.find((x) => x.jeton === msg.jeton);
      if (!ancien) return conn.send({ g: 'velours', t: 'perdu' });
      clearTimeout(ancien.absence);
      for (const autre of clients.values()) if (autre !== c && autre.membre === ancien) { autre.membre = null; autre.code = null; }
      ancien.conn = conn;
      c.membre = ancien; c.code = s.code;
      envoyer(ancien, { t: 'entre', code: s.code, jeu: s.jeu, jeton: ancien.jeton, repris: true });
      envoyer(ancien, etat(s, ancien));
      diffuser(s, { t: 'membres', liste: listeMembres(s), revient: ancien.nom });
      if (s.jeu === 'poker' && s.t.aQui === ancien.s && !s.minuteur) etapePoker(s);
      return;
    }
    case 'quitter': return sortir(c);
    default:
  }
  if (!salle || !m) return;
  // une réaction de la roue : seulement les emojis prévus, une toutes les 3 s au plus
  if (msg.t === 'reaction') {
    if (!REACT.valide(msg.e)) return;
    const maintenant = Date.now();
    if (maintenant - (m.reaction || 0) < REACT.ESPACEMENT_MS) return;
    m.reaction = maintenant;
    return diffuser(salle, { t: 'reaction', jeu: salle.jeu, s: m.s, e: msg.e });
  }
  if (salle.jeu === 'blackjack') {
    if (msg.t === 'miser') return miserBlackjack(salle, m, msg.mise);
    if (msg.t === 'pret') {
      m.pret = true;
      const b = salle.b;
      const presents = salle.membres.filter((x) => x.conn);
      if ((b.phase === 'mise' || b.phase === 'fin') && b.sieges.some((x) => x?.mise > 0) && presents.every((x) => x.pret || !(b.sieges[x.s]?.mise > 0))) {
        clearTimeout(salle.minuteur); salle.minuteur = null;
        donnerBlackjack(salle);
      }
      return;
    }
    if (msg.t === 'action' || msg.t === 'assurance') return actionBlackjack(salle, m, msg);
  }
  if (salle.jeu === 'roulette') {
    if (msg.t === 'paris') return parisRoulette(salle, m, msg.paris);
    if (msg.t === 'pret' && salle.phase === 'mises') {
      m.pret = true;
      const avecMises = salle.membres.filter((x) => x.conn && Object.keys(salle.paris[x.s] || {}).length);
      if (avecMises.length && salle.membres.filter((x) => x.conn).every((x) => x.pret)) { clearTimeout(salle.minuteur); salle.minuteur = null; lancerRoulette(salle); }
      return;
    }
  }
  if (salle.jeu === 'poker') {
    if (msg.t === 'agir') return agirPoker(salle, m, msg.a);
    if (msg.t === 'recave') return recavePoker(salle, m, msg.montant);
  }
}

export function handleClose(conn) {
  const c = clients.get(conn.id);
  clients.delete(conn.id);
  // une inscription à un tournoi qui n'a pas commencé : la place se libère (l'écran rembourse en revenant)
  const k = tournoi?.phase === 'inscription' ? tournoi.inscrits.findIndex((x) => x.c === c) : -1;
  if (k >= 0) { tournoi.inscrits.splice(k, 1); aTous({ t: 'tournoi-maj', tournoi: affiche(tournoi) }); }
  if (!c?.membre) return;
  const salle = salles.get(c.code);
  const m = c.membre;
  if (!salle || m.conn !== conn) return;
  m.conn = null;
  diffuser(salle, { t: 'membres', liste: listeMembres(salle), absent: m.nom });
  m.absence = setTimeout(() => { if (!m.conn && salles.has(salle.code)) partir(salle, m, false); }, ABSENCE_MS * vitesse);
  if (typeof m.absence.unref === 'function') m.absence.unref();
  if (salle.jeu === 'poker' && salle.t.aQui === m.s && enMain(salle)) { clearTimeout(salle.minuteur); salle.minuteur = null; programmer(salle, 700, () => jouerPour(salle, m.s)); }
  if (salle.jeu === 'blackjack' && salle.b.tour?.s === m.s) suiteBlackjack(salle);
}

export function sweep() {
  const maintenant = Date.now();
  for (const s of salles.values()) {
    if (maintenant - s.vu > 2 * 60 * 60 * 1000 || !s.membres.some((m) => m.conn || m.absence)) fermer(s);
  }
}

export function stats() {
  return { veloursTables: salles.size, veloursTournoi: tournoi ? tournoi.phase : null };
}

/** Pour les tests. */
export const _salles = salles;
