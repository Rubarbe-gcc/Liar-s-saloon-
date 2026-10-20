/**
 * DOUBLE PAS — le moteur d'un match de basket à trois contre trois, sur un
 * terrain entier.
 *
 * Deux périodes ; en cas d'égalité, un panier en or (le premier qui marque
 * gagne). Un entre-deux pour commencer ; après un panier, l'équipe qui l'a
 * encaissé remet en jeu depuis sa ligne de fond. Pas de faute, pas de lancer
 * franc, pas de sortie (le ballon rebondit sur les lignes) : de l'arcade.
 *
 * Les touches de chaque équipe, à chaque image : un nombre (terrain.js, T).
 *   en attaque : A passe, R passe à rebond, B tir (on saute en appuyant ; on lâche en haut du
 *                saut) ou dunk tout près du panier, X crochet (on élimine son défenseur) ;
 *   en défense : A vol de balle, B saut (contre, rebond), G change de joueur ;
 *   S : sprint (l'endurance baisse).
 *
 * L'entraînement (o.entrainement) : on joue librement, sans chrono ni fin,
 * avec moins de joueurs (les absents sont garés hors du terrain), et des
 * adversaires qui jouent ou qui restent plantés comme des plots (ils ne
 * touchent jamais le ballon). Après un panier, le ballon revient à l'équipe 0.
 *
 * Déterministe : même graine, mêmes touches → même match, image par image.
 * L'état est un objet simple (copiable par structuredClone) ; `pas` le fait
 * avancer d'une image et rend ce qui s'est passé (les événements).
 *
 * Module partagé, sans DOM.
 */

import {
  FPS, DT, G, DEMI_L, DEMI_W, PANIER_X, ANNEAU_Z, ANNEAU_R, PLANCHE_X, PLANCHE_DL, PLANCHE_BAS, PLANCHE_HAUT,
  BALLE_R, JOUEUR_R, CHARGE_IDEALE, CHARGE_MAX, PORTEE_DUNK, T,
  hasard, gauss, clamp, dist, panierX, estTrois, vitesseMax, allonge, elan, ecartTir,
} from './terrain.js';
import { EQUIPE, notesJoueur } from './equipes.js';
import { decider } from './ia.js';

export { FPS, T, CHARGE_IDEALE, CHARGE_MAX, DEMI_L, DEMI_W, PANIER_X, ANNEAU_Z, PORTEE_DUNK };

/** Les attentes (en images). */
const ENGAGEMENT = 70;
const APRES_PANIER = 105;
const PAUSE = 200;
const REMISE_MAX = 150;
const DUNK_ENVOL = 22;
const RIEN = { mx: 0, my: 0, sprint: false, action: null };
/** Le cycle du dribble (le ballon touche le sol toutes les 24 images). */
export const CYCLE_DRIBBLE = 24;

/** L'ordre dans lequel les joueurs entrent sur le terrain à l'entraînement : nous (meneur d'abord), eux (le pivot d'abord, pour garder le cercle). */
const ORDRE_ENTREE = [[0, 1, 2], [2, 0, 1]];

/**
 * Un match.
 * @param {object} o
 * @param {[string, string]} o.equipes      les deux équipes (identifiants d'equipes.js)
 * @param {number} [o.graine]
 * @param {number} [o.minutes]              la durée d'une période
 * @param {[string, string]} [o.controles]  'humain' ou 'ia', pour chaque équipe
 * @param {[number, number]} [o.niveaux]    0 facile, 1 normal, 2 difficile (pour l'ordinateur)
 * @param {{ nous: number, eux: number, immobiles: boolean }} [o.entrainement]  nous : 1 à 3, eux : 0 à 3
 */
export function creerMatch({ equipes, graine = 1, minutes = 3, controles = ['humain', 'ia'], niveaux = [1, 1], entrainement = null }) {
  const m = {
    f: 0, alea: (graine >>> 0) || 1,
    phase: 'engagement', t: ENGAGEMENT, periode: 1, chrono: 0, duree: Math.round(minutes * 60 * FPS),
    score: [0, 0], enOr: false, tip: -1, attente: 0,
    poss: { e: -1, f: 0, passes: 0 },
    equipes: [0, 1].map((e) => ({ id: equipes[e], style: EQUIPE[equipes[e]].style, sens: e === 0 ? 1 : -1, ctrl: controles[e], niveau: niveaux[e] ?? 1, actif: e * 3, marque: [0, 1, 2], revoir: 0 })),
    joueurs: [],
    ballon: { x: 0, y: 0, z: 1.5, vx: 0, vy: 0, vz: 0, porteur: -1, dernier: -1, passeur: -1, cible: -1, essais: 0, tir: null, rebond: null, entre: false, remise: -1, marque: false, touche: 0, aTerre: false },
    prec: [0, 0],
    stats: { tirs: [0, 0], reussis: [0, 0], trois: [0, 0], troisReussis: [0, 0], dunks: [0, 0], rebonds: [0, 0], rebondsOff: [0, 0], passes: [0, 0], decisives: [0, 0], vols: [0, 0], contres: [0, 0], possession: [0, 0] },
    paniers: [],
    perso: new Array(6).fill(null).map(() => ({ pts: 0, rebonds: 0, passes: 0, vols: 0, contres: 0 })),
    vainqueur: -1,
  };
  for (let e = 0; e < 2; e++) {
    const eq = EQUIPE[equipes[e]];
    for (let i = 0; i < 3; i++) {
      m.joueurs.push({
        id: e * 3 + i, e, i, n: notesJoueur(eq, i), vedette: !!eq.joueurs[i].vedette,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dx: 1, dy: 0, etat: 'normal', t: 0,
        charge: 0, chargeCible: 0, layup: false, verrou: 0, lache: 0, surpris: 0, crochet: 0, endu: 1,
        recu: 0, passeDe: -1, passeF: -1000, dec: 0, but: null, coupe: 0,
      });
    }
  }
  if (entrainement) {
    m.entrainement = { nous: clamp(entrainement.nous | 0, 1, 3), eux: clamp(entrainement.eux | 0, 0, 3), immobiles: !!entrainement.immobiles };
    const n = [m.entrainement.nous, m.entrainement.eux];
    for (let e = 0; e < 2; e++) ORDRE_ENTREE[e].forEach((i, k) => { m.joueurs[e * 3 + i].absent = k >= n[e]; });
    if (m.entrainement.immobiles) m.equipes[1].immobile = true;
    placerDepart(m);
    return m;
  }
  placerEntreDeux(m);
  return m;
}

/** L'entraînement : le ballon à notre premier joueur, dans notre moitié ; les adversaires en défense ; les absents garés. */
function placerDepart(m) {
  const s = m.equipes[0].sens;
  for (const p of m.joueurs) {
    let [X, Y] = p.e === 0 ? [[-1.5, 0], [3, -4.5], [4, 3.5]][p.i] : [[8, 0.5], [8.5, -3.5], [10.5, 1]][p.i];
    if (p.absent) [X, Y] = [-12 + p.id * 4.5, -(DEMI_W + 50)];
    Object.assign(p, { x: X * s, y: Y, z: 0, vx: 0, vy: 0, vz: 0, dx: p.e === 0 ? s : -s, dy: 0, etat: 'normal', t: 0, charge: 0, chargeCible: 0, verrou: 0, lache: 0, surpris: 0, crochet: 0, dec: 0 });
    if (p.absent) p.x = X;
  }
  const r = m.joueurs.find((p) => p.e === 0 && !p.absent);
  Object.assign(m.ballon, { x: r.x, y: r.y, z: 1, vx: 0, vy: 0, vz: 0, porteur: r.id, dernier: r.id, passeur: -1, cible: -1, essais: 0, tir: null, rebond: null, entre: false, remise: -1, marque: false, touche: 0, aTerre: false });
  m.equipes[0].actif = r.id;
  const r1 = m.joueurs.find((p) => p.e === 1 && !p.absent);
  m.equipes[1].actif = r1 ? r1.id : 3;
  m.poss = { e: 0, f: m.f, passes: 0 };
  m.phase = 'engagement';
  m.t = 30;
}

/** L'entre-deux : les deux pivots au centre, le ballon lancé en l'air. */
function placerEntreDeux(m) {
  for (const p of m.joueurs) {
    const s = m.equipes[p.e].sens;
    const [X, Y] = p.i === 2 ? [-0.55, 0] : p.i === 0 ? [-3.2, p.e === 0 ? 3 : 2] : [-3.2, p.e === 0 ? -3 : -2];
    Object.assign(p, { x: X * s, y: Y, z: 0, vx: 0, vy: 0, vz: 0, dx: s, dy: 0, etat: 'normal', t: 0, charge: 0, chargeCible: 0, verrou: 0, lache: 0, surpris: 0, crochet: 0, dec: 0 });
  }
  Object.assign(m.ballon, { x: 0, y: 0, z: 1.6, vx: 0, vy: 0, vz: 0, porteur: -1, dernier: -1, passeur: -1, cible: -1, essais: 0, tir: null, rebond: null, entre: true, remise: -1, marque: false, touche: 0 });
  m.equipes[0].actif = 2; m.equipes[1].actif = 5;
  m.poss = { e: -1, f: m.f, passes: 0 };
  m.phase = 'engagement';
  m.t = ENGAGEMENT;
}

/**
 * La remise en jeu de l'équipe e, depuis sa ligne de fond (sous le panier qu'elle défend).
 * Ses adversaires repartent vers leur moitié.
 */
function placerRemise(m, e) {
  const s = m.equipes[e].sens; // e attaque vers s : sa ligne de fond est en -s
  for (const p of m.joueurs) {
    let X, Y;
    if (p.e === e) [X, Y] = [[-(DEMI_L + 0.45), 1.6], [-8.8, -3.6], [-7.6, 3.4]][p.i];
    else [X, Y] = [[3.5, 1.5], [5.5, -3], [6, 2.8]][p.i]; // dans leur moitié, celle qu'ils défendent
    Object.assign(p, { x: X * s, y: Y, z: 0, vx: 0, vy: 0, vz: 0, dx: p.e === e ? s : -s, dy: 0, etat: 'normal', t: 0, charge: 0, chargeCible: 0, verrou: 0, lache: 0, surpris: 0, crochet: 0, dec: 0 });
  }
  const r = m.joueurs[e * 3];
  Object.assign(m.ballon, { x: r.x, y: r.y, z: 1.2, vx: 0, vy: 0, vz: 0, porteur: r.id, dernier: r.id, passeur: -1, cible: -1, essais: 0, tir: null, rebond: null, entre: false, remise: r.id, marque: false, touche: 0 });
  m.equipes[e].actif = r.id;
  if (m.equipes[1 - e].actif < 0) m.equipes[1 - e].actif = (1 - e) * 3;
  m.poss = { e, f: m.f, passes: 0 };
  m.phase = 'jeu';
  m.t = 0;
}

/* ------------------------------------------------------------------ */
/* Une image                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fait avancer le match d'une image.
 * @param {object} m
 * @param {[number, number]} entrees  les touches de chaque équipe (ignorées pour l'ordinateur)
 * @returns {object[]} les événements de l'image
 */
export function pas(m, entrees = [0, 0]) {
  const evs = [];
  const k = [entrees[0] | 0, entrees[1] | 0];
  const ap = [k[0] & ~m.prec[0], k[1] & ~m.prec[1]];
  const rel = [m.prec[0] & ~k[0], m.prec[1] & ~k[1]];
  m.prec = k;
  m.f += 1;
  switch (m.phase) {
    case 'engagement':
      if (--m.t <= 0) {
        m.phase = 'jeu';
        if (m.ballon.entre) { m.ballon.vz = 7; evs.push({ type: 'entredeux' }); }
        evs.push({ type: 'sifflet', n: 1 });
      }
      break;
    case 'jeu':
      jouer(m, k, ap, rel, evs);
      break;
    case 'panier':
      // La joie (ou la déception) : le ballon finit de tomber, les joueurs ralentissent.
      for (const p of m.joueurs) if (!p.absent) deplacer(m, p, RIEN);
      physiqueBallon(m, evs, false);
      if (--m.t <= 0) {
        if (m.entrainement) { placerDepart(m); evs.push({ type: 'remise', equipe: 0 }); }
        else if (m.enOr) finir(m, evs);
        else if (m.chrono >= m.duree) finPeriode(m, evs);
        else { placerRemise(m, m.aRemettre); evs.push({ type: 'remise', equipe: m.aRemettre }); }
      }
      break;
    case 'pause':
      if (--m.t <= 0) {
        if (m.periode === 1) {
          m.periode = 2;
          m.chrono = 0;
          for (const eq of m.equipes) eq.sens = -eq.sens;
          // La deuxième période : l'équipe qui a perdu l'entre-deux commence.
          placerRemise(m, m.tip >= 0 ? 1 - m.tip : 1);
          evs.push({ type: 'reprise' });
        } else {
          m.enOr = true;
          placerEntreDeux(m);
          evs.push({ type: 'enor' });
        }
      }
      break;
    default:
  }
  return evs;
}

function jouer(m, k, ap, rel, evs) {
  const b = m.ballon;
  for (const p of m.joueurs) {
    if (p.verrou > 0) p.verrou -= 1;
    if (p.lache > 0) p.lache -= 1;
    if (p.surpris > 0) p.surpris -= 1;
    if (p.crochet > 0) p.crochet -= 1;
    if (b.porteur === p.id) p.recu += 1;
  }
  for (const eq of m.equipes) if (eq.revoir > 0) eq.revoir -= 1;
  // La remise traîne : elle part toute seule.
  if (b.remise >= 0 && ++m.t > REMISE_MAX) {
    const p = m.joueurs[b.remise];
    passer(m, p, m.joueurs[choisirReceveur(m, p, 0, 0)], evs);
  }

  const cons = new Array(6).fill(null);
  for (let e = 0; e < 2; e++) if (m.equipes[e].ctrl === 'humain') humain(m, e, k[e], ap[e], rel[e], cons, evs);
  for (let e = 0; e < 2; e++) decider(m, e, cons);
  for (let i = 0; i < 6; i++) {
    const c = cons[i];
    if (c && c.action) agir(m, m.joueurs[i], c.action, evs);
  }
  // Le tir en préparation : il monte (le saut), et part tout seul s'il a trop attendu.
  for (const p of m.joueurs) {
    if (p.etat !== 'tir' || b.porteur !== p.id) continue;
    p.charge += 1;
    if ((p.chargeCible && p.charge >= p.chargeCible) || p.charge >= CHARGE_MAX) lacherTir(m, p, evs);
  }
  for (const p of m.joueurs) if (p.etat === 'dunk') dunk(m, p, evs);
  for (const p of m.joueurs) if (!p.absent) deplacer(m, p, cons[p.id] || RIEN);
  separer(m);
  if (m.ballon.remise >= 0) for (const p of m.joueurs) borner(m, p);
  physiqueBallon(m, evs, true);
  if (m.phase !== 'jeu') return;
  attraper(m, evs);

  if (b.porteur >= 0) m.stats.possession[m.joueurs[b.porteur].e] += 1;
  // Le chrono s'arrête pendant la remise en jeu et l'entre-deux (et il n'y en a plus pendant le panier en or).
  if (m.entrainement) return;
  if (!m.enOr && b.remise < 0 && !b.entre) m.chrono += 1;
  if (!m.enOr && m.chrono >= m.duree) {
    // Un tir parti avant la sirène a le droit d'arriver.
    const enVol = (b.tir && b.porteur < 0) || m.joueurs.some((p) => p.etat === 'dunk' && b.porteur === p.id);
    if (!enVol || ++m.attente > 200) { m.attente = 0; evs.push({ type: 'sirene' }); finPeriode(m, evs); }
  }
}

function finPeriode(m, evs) {
  if (m.periode === 1) {
    m.phase = 'pause';
    m.t = PAUSE;
    evs.push({ type: 'mitemps' });
    return;
  }
  if (m.score[0] === m.score[1]) {
    m.phase = 'pause';
    m.t = 150;
    evs.push({ type: 'egalite' });
    return;
  }
  finir(m, evs);
}

function finir(m, evs) {
  m.phase = 'fin';
  m.vainqueur = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1;
  evs.push({ type: 'fin', vainqueur: m.vainqueur });
}

/* ------------------------------------------------------------------ */
/* L'humain                                                            */
/* ------------------------------------------------------------------ */

/** Le joueur de l'équipe e le plus proche du ballon (sauf `sauf`). */
function plusProche(m, e, sauf = -1) {
  const b = m.ballon;
  let best = -1, bd = 1e9;
  for (let i = 0; i < 3; i++) {
    const p = m.joueurs[e * 3 + i];
    if (p.id === sauf || p.absent) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

/** Le coéquipier qu'on vise en passant dans la direction (dx, dy) (sinon : le mieux placé, vers le panier). */
export function choisirReceveur(m, p, dx, dy) {
  const hx = panierX(m, p.e);
  if (!dx && !dy) { dx = hx - p.x; dy = -p.y; }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= l; dy /= l;
  let best = -1, bv = -1e9;
  for (let i = 0; i < 3; i++) {
    const r = m.joueurs[p.e * 3 + i];
    if (r === p || r.absent) continue;
    const ux = r.x - p.x, uy = r.y - p.y;
    const d = Math.sqrt(ux * ux + uy * uy) || 1;
    const v = ((ux * dx + uy * dy) / d) * 2 - d * 0.03;
    if (v > bv) { bv = v; best = r.id; }
  }
  return best;
}

/** Assez près du panier (et devant lui) pour aller dunker ? */
export function peutDunker(m, p) {
  const hx = panierX(m, p.e);
  const s = m.equipes[p.e].sens;
  return dist(p.x, p.y, hx, 0) < PORTEE_DUNK && s * (hx - p.x) > -0.3;
}

function humain(m, e, k, ap, rel, cons, evs) {
  const eq = m.equipes[e], b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const aLaBalle = porteur && porteur.e === e;
  if (aLaBalle) eq.actif = porteur.id;
  else if (!porteur && b.cible >= 0 && m.joueurs[b.cible].e === e) eq.actif = b.cible;
  if ((ap & T.G) && !aLaBalle) {
    const autre = plusProche(m, e, eq.actif);
    if (autre >= 0) eq.actif = autre;
    evs.push({ type: 'change', joueur: eq.actif });
  }
  const p = m.joueurs[eq.actif];
  let mx = (k & T.d ? 1 : 0) - (k & T.g ? 1 : 0);
  let my = (k & T.h ? 1 : 0) - (k & T.b ? 1 : 0);
  if (mx && my) { mx *= 0.7071; my *= 0.7071; }
  const c = { mx, my, sprint: !!(k & T.S), action: null };
  if (porteur === p) {
    if (b.remise === p.id) {
      c.mx = 0; c.my = 0;
      if (ap & (T.A | T.R)) c.action = { type: 'passe', cible: choisirReceveur(m, p, mx, my), aTerre: !!(ap & T.R) };
    } else if (p.etat === 'tir') {
      if (rel & T.B) c.action = { type: 'lacher' };
    } else if (p.etat === 'normal') {
      if (ap & T.B) c.action = peutDunker(m, p) ? { type: 'dunk' } : { type: 'armer' };
      else if (ap & (T.A | T.R)) c.action = { type: 'passe', cible: choisirReceveur(m, p, mx, my), aTerre: !!(ap & T.R) };
      else if (ap & T.X) c.action = { type: 'crochet', dx: mx, dy: my };
    }
  } else if (ap & T.A) c.action = { type: 'vol' };
  else if (ap & T.B) c.action = { type: 'saut' };
  cons[p.id] = c;
}

/* ------------------------------------------------------------------ */
/* Les actions                                                         */
/* ------------------------------------------------------------------ */

function agir(m, p, a, evs) {
  const b = m.ballon;
  const aLaBalle = b.porteur === p.id;
  switch (a.type) {
    case 'passe':
      if (aLaBalle && a.cible >= 0 && p.etat === 'normal') passer(m, p, m.joueurs[a.cible], evs, !!a.aTerre);
      break;
    case 'armer':
      if (!aLaBalle || p.etat !== 'normal' || b.remise >= 0) break;
      p.etat = 'tir';
      p.charge = 0;
      p.chargeCible = a.cible || 0;
      p.layup = false;
      p.vz = (G * CHARGE_IDEALE) / FPS;
      p.vx *= 0.35; p.vy *= 0.35;
      evs.push({ type: 'arme', joueur: p.id });
      break;
    case 'lacher':
      if (aLaBalle && p.etat === 'tir') lacherTir(m, p, evs);
      break;
    case 'dunk':
      if (!aLaBalle || p.etat !== 'normal' || b.remise >= 0) break;
      if (p.n.saut >= 62 || dist(p.x, p.y, panierX(m, p.e), 0) < 1.3) commencerDunk(m, p, evs);
      else {
        // Pas assez de détente : un double pas (un tir tout près, lâché au bon moment).
        agir(m, p, { type: 'armer', cible: CHARGE_IDEALE }, evs);
        p.layup = true;
      }
      break;
    case 'crochet':
      if (aLaBalle && p.etat === 'normal' && p.crochet <= 0 && p.verrou <= 0) crochet(m, p, a.dx, a.dy, evs);
      break;
    case 'vol':
      if (!aLaBalle && p.verrou <= 0 && p.z === 0) voler(m, p, evs);
      break;
    case 'saut':
      if (!aLaBalle && p.z === 0 && p.vz === 0 && p.verrou <= 0 && p.etat === 'normal') {
        p.vz = elan(p);
        p.etat = 'saut';
        p.verrou = 40;
        evs.push({ type: 'saut', joueur: p.id });
      }
      break;
    default:
  }
}

/** La passe : directe, ou à rebond (aTerre : plus lente, mais elle passe sous les bras des défenseurs). */
function passer(m, p, r, evs, aTerre = false) {
  const b = m.ballon;
  const vit = (aTerre ? 8 : 10) + p.n.passe * 0.045;
  // On vise là où sera le receveur (deux fois, pour que l'avance tienne compte du temps de vol).
  let tx = r.x, ty = r.y, T = 0.3;
  for (let k = 0; k < 2; k++) {
    T = Math.max(0.12, dist(p.x, p.y, tx, ty) / vit);
    tx = r.x + r.vx * T * 0.85; ty = r.y + r.vy * T * 0.85;
  }
  const err = (0.04 + T * 0.18) * (1.5 - p.n.passe / 100) * (p.surpris > 0 ? 1.5 : 1);
  tx += gauss(m) * err; ty += gauss(m) * err;
  tx = clamp(tx, -DEMI_L + 0.3, DEMI_L - 0.3); ty = clamp(ty, -DEMI_W + 0.3, DEMI_W - 0.3);
  const z0 = aTerre ? 1 : 1.35, z1 = 1.25;
  Object.assign(b, {
    x: p.x + p.dx * 0.3, y: p.y + p.dy * 0.3, z: z0, porteur: -1, dernier: p.id, passeur: p.id, cible: r.id, essais: 0, tir: null, rebond: null, aTerre,
    vx: (tx - p.x) / T, vy: (ty - p.y) / T, vz: (z1 - z0 + 0.5 * G * T * T) / T, remise: -1,
  });
  if (aTerre) {
    // Le ballon touche le parquet aux trois cinquièmes du chemin (le rebond le ralentit d'un dixième).
    const T1 = T * 0.6, f = (0.6 + 0.4 / 0.9) / 1;
    b.vx *= f; b.vy *= f;
    b.vz = (BALLE_R - z0 + 0.5 * G * T1 * T1) / T1;
  }
  p.lache = 10;
  m.stats.passes[p.e] += 1;
  m.poss.passes += 1;
  evs.push({ type: 'passe', joueur: p.id, cible: r.id, aTerre });
}

/** Le tir part : la qualité dépend du moment où l'on lâche (en haut du saut, c'est parfait). */
function lacherTir(m, p, evs) {
  const b = m.ballon;
  const hx = panierX(m, p.e);
  const d = dist(p.x, p.y, hx, 0);
  const q = p.layup ? 1 : clamp(1 - Math.abs(p.charge - CHARGE_IDEALE) / 15, 0, 1);
  const pts = estTrois(p.x, p.y, hx) ? 3 : 2;
  let s = ecartTir(m, p, p.x, p.y, q);
  if (p.layup) s *= 0.85;
  const ux = (hx - p.x) / (d || 1), uy = -p.y / (d || 1);
  // Le point visé : le centre de l'arceau, décalé par l'imprécision (dans l'axe et sur le côté).
  const e1 = gauss(m) * s * 1.05, e2 = gauss(m) * s;
  const tx = hx + ux * e1 - uy * e2, ty = ux * e2 + uy * e1;
  const x0 = p.x + ux * 0.3, y0 = p.y + uy * 0.3, z0 = 2.25 + p.z;
  const Tv = 0.68 + d * 0.085;
  Object.assign(b, {
    x: x0, y: y0, z: z0, porteur: -1, dernier: p.id, passeur: -1, cible: -1, essais: 0, remise: -1, marque: false, touche: 0,
    vx: (tx - x0) / Tv, vy: (ty - y0) / Tv, vz: (ANNEAU_Z - z0 + 0.5 * G * Tv * Tv) / Tv,
    tir: { e: p.e, j: p.id, pts, passeur: m.f - p.passeF < 300 ? p.passeDe : -1, dunk: false, d },
    rebond: { e: p.e },
  });
  p.etat = 'saut';
  p.lache = 14;
  p.charge = 0; p.chargeCible = 0;
  m.stats.tirs[p.e] += 1;
  if (pts === 3) m.stats.trois[p.e] += 1;
  evs.push({ type: 'tir', joueur: p.id, pts, q, layup: p.layup, d });
  // Un défenseur en l'air, tout près, devant : il peut le contrer.
  contrer(m, p, ux, uy, 1, evs);
}

/** Un défenseur en l'air devant le tireur (ou le dunkeur) contre-t-il le ballon ? */
function contrer(m, p, ux, uy, facilite, evs) {
  const b = m.ballon;
  for (let k = 0; k < 3; k++) {
    const o = m.joueurs[(1 - p.e) * 3 + k];
    const dx = o.x - p.x, dy = o.y - p.y, dd = Math.sqrt(dx * dx + dy * dy);
    if (dd > 1.35 || o.z < 0.15 || dx * ux + dy * uy < -0.2) continue;
    const chance = clamp((o.z - 0.1) * 0.45 + (o.n.saut - 65) / 220 + (o.n.defense - 65) / 260 - (dd - 0.5) * 0.35 - (p.n.saut - 65) / 300, 0, 0.4) * facilite;
    if (hasard(m) < chance) {
      const lat = gauss(m) * 2.5;
      Object.assign(b, { vx: -ux * 2.5 - uy * lat + o.vx * 0.3, vy: -uy * 2.5 + ux * lat + o.vy * 0.3, vz: 0.8 + hasard(m) * 1.5, tir: null, dernier: o.id, z: Math.max(b.z, 2.2) });
      b.rebond = { e: p.e };
      m.stats.contres[o.e] += 1;
      m.perso[o.id].contres += 1;
      evs.push({ type: 'contre', joueur: o.id, tireur: p.id });
      return true;
    }
  }
  return false;
}

function commencerDunk(m, p, evs) {
  const hx = panierX(m, p.e);
  const s = m.equipes[p.e].sens;
  const cx = hx - s * 0.45, cy = p.y * 0.15;
  p.etat = 'dunk';
  p.t = DUNK_ENVOL;
  p.vz = 4.3 + (p.n.saut - 60) * 0.012;
  p.vx = (cx - p.x) / (DUNK_ENVOL / FPS);
  p.vy = (cy - p.y) / (DUNK_ENVOL / FPS);
  const l = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
  p.dx = p.vx / l; p.dy = p.vy / l;
  evs.push({ type: 'envol', joueur: p.id });
}

/** Le dunk : l'envol, puis le ballon écrasé dans le cercle (sauf contre). */
function dunk(m, p, evs) {
  const b = m.ballon;
  if (b.porteur !== p.id) return;
  if (--p.t > 0) return;
  const hx = panierX(m, p.e);
  const s = m.equipes[p.e].sens;
  m.stats.tirs[p.e] += 1;
  m.stats.dunks[p.e] += 1;
  Object.assign(b, {
    x: hx - s * 0.04, y: 0, z: ANNEAU_Z + 0.32, vx: 0, vy: 0, vz: -5, porteur: -1, dernier: p.id, passeur: -1, cible: -1, remise: -1, marque: false, touche: 0,
    tir: { e: p.e, j: p.id, pts: 2, passeur: m.f - p.passeF < 300 ? p.passeDe : -1, dunk: true, d: 0.5 },
    rebond: { e: p.e },
  });
  p.vx *= 0.2; p.vy *= 0.2;
  p.lache = 20;
  p.etat = 'saut';
  // Contrer un dunk, c'est plus dur.
  if (contrer(m, p, (hx - p.x) || s, -p.y, 0.55, evs)) { m.stats.dunks[p.e] -= 1; return; }
  // Gêné (un défenseur tout près du cercle), le dunk peut ressortir : le cercle le recrache.
  let gene = 0.05 + (75 - p.n.saut) * 0.002;
  for (let k = 0; k < 3; k++) {
    const o = m.joueurs[(1 - p.e) * 3 + k];
    const d = dist(o.x, o.y, p.x, p.y);
    if (d < 1.7) gene += ((1.7 - d) / 1.7) * (0.2 + (o.n.defense - 70) / 250);
  }
  if (hasard(m) < gene) {
    Object.assign(b, { z: ANNEAU_Z + 0.2, vz: 2.6 + hasard(m), vx: -s * (1.2 + hasard(m) * 1.5), vy: gauss(m) * 1.4 });
    m.stats.dunks[p.e] -= 1;
    evs.push({ type: 'dunk-rate', joueur: p.id });
    return;
  }
  evs.push({ type: 'dunk', joueur: p.id });
}

/** Le crochet : un changement de direction sec ; le défenseur tout près peut se faire prendre. */
function crochet(m, p, dx, dy, evs) {
  if (!dx && !dy) { dx = -p.dy; dy = p.dx; if (hasard(m) < 0.5) { dx = -dx; dy = -dy; } }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= l; dy /= l;
  const v = vitesseMax(p) * 1.3;
  p.vx = dx * v; p.vy = dy * v;
  p.dx = dx; p.dy = dy;
  p.crochet = 14;
  p.verrou = 45;
  let pris = 0;
  for (let k = 0; k < 3; k++) {
    const o = m.joueurs[(1 - p.e) * 3 + k];
    if (dist(o.x, o.y, p.x, p.y) > 1.7 || o.z > 0) continue;
    if (hasard(m) < 0.4 + (p.n.vitesse + p.n.passe - 2 * o.n.defense) / 160) { o.surpris = 32; pris += 1; }
  }
  evs.push({ type: 'crochet', joueur: p.id, reussi: pris > 0 });
}

/** Le vol : tout près du porteur ; raté, on est en retard (il file). */
function voler(m, p, evs) {
  const b = m.ballon;
  if (b.porteur < 0 || b.remise >= 0) return;
  const c = m.joueurs[b.porteur];
  if (c.e === p.e) return;
  p.verrou = 40;
  if (dist(p.x, p.y, c.x, c.y) > 1.25) { evs.push({ type: 'vol-rate', joueur: p.id }); p.surpris = 10; return; }
  let chance = 0.22 + (p.n.defense - (c.n.passe + c.n.vitesse) / 2) / 140;
  if (c.crochet > 0) chance *= 0.3;
  if (c.etat !== 'normal') chance *= 0.25;
  if (p.surpris > 0) chance *= 0.3;
  if (hasard(m) < clamp(chance, 0.04, 0.5)) {
    b.porteur = p.id;
    b.dernier = p.id;
    p.recu = 0; p.passeDe = -1;
    c.verrou = 25; c.surpris = 18; c.etat = 'normal'; c.charge = 0;
    m.stats.vols[p.e] += 1;
    m.perso[p.id].vols += 1;
    m.poss = { e: p.e, f: m.f, passes: 0 };
    evs.push({ type: 'vol', joueur: p.id, victime: c.id });
  } else {
    p.surpris = 22;
    evs.push({ type: 'vol-rate', joueur: p.id });
  }
}

/* ------------------------------------------------------------------ */
/* Les déplacements                                                    */
/* ------------------------------------------------------------------ */

function deplacer(m, p, c) {
  const b = m.ballon;
  // En l'air : on ne dirige plus rien.
  if (p.z > 0 || p.vz > 0) {
    p.z += p.vz * DT - 0.5 * G * DT * DT;
    p.vz -= G * DT;
    p.x += p.vx * DT; p.y += p.vy * DT;
    if (p.z <= 0) {
      p.z = 0; p.vz = 0;
      p.vx *= 0.4; p.vy *= 0.4;
      if (p.etat === 'saut' || p.etat === 'tir' || p.etat === 'dunk') { p.etat = 'normal'; p.charge = 0; }
    }
    borner(m, p);
    return;
  }
  const porte = b.porteur === p.id;
  if (porte && b.remise === p.id) { p.vx = 0; p.vy = 0; viser(m, p, c); return; }
  if (p.crochet > 0) {
    p.x += p.vx * DT; p.y += p.vy * DT;
    borner(m, p);
    return;
  }
  const sprint = c.sprint && p.endu > 0.12 && (c.mx || c.my);
  let vm = vitesseMax(p) * (porte ? 0.9 : 1) * (sprint ? 1.28 : 1) * (0.78 + 0.22 * p.endu);
  if (p.surpris > 0) vm *= 0.4;
  // À reculons (le défenseur face à son joueur), on va moins vite.
  const regard = c.fx || c.fy ? c.mx * p.dx + c.my * p.dy : 1;
  if (regard < 0) vm *= 1 + regard * 0.2;
  const tx = c.mx * vm, ty = c.my * vm;
  const k = c.mx || c.my ? (porte ? 0.16 : 0.2) : 0.24;
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  p.x += p.vx * DT; p.y += p.vy * DT;
  if (sprint) p.endu = Math.max(0, p.endu - 0.0016);
  else p.endu = Math.min(1, p.endu + 0.0009);
  viser(m, p, c);
  borner(m, p);
}

/** Où il regarde : là où il court, ou ce que l'ordinateur lui dit de regarder. */
function viser(m, p, c) {
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  let fx = 0, fy = 0;
  if (c.fx || c.fy) { fx = c.fx; fy = c.fy; }
  else if (v > 0.5) { fx = p.vx; fy = p.vy; }
  const l = Math.sqrt(fx * fx + fy * fy);
  if (l > 1e-6) {
    // Il se tourne vite, mais pas d'un coup.
    const nx = p.dx + (fx / l - p.dx) * 0.3, ny = p.dy + (fy / l - p.dy) * 0.3;
    const n = Math.sqrt(nx * nx + ny * ny) || 1;
    p.dx = nx / n; p.dy = ny / n;
  }
}

function borner(m, p) {
  const b = m.ballon;
  const lx = b.remise === p.id ? DEMI_L + 0.6 : DEMI_L - 0.25;
  p.x = clamp(p.x, -lx, lx);
  p.y = clamp(p.y, -DEMI_W + 0.25, DEMI_W - 0.25);
  // Pendant la remise en jeu, l'équipe qui vient de marquer reste dans sa moitié (celle qu'elle défend).
  if (b.remise >= 0) {
    const e = m.joueurs[b.remise].e;
    const s = m.equipes[e].sens;
    if (p.e !== e && s * p.x < 0.4) p.x = s * 0.4;
  }
}

/** Deux joueurs ne se traversent pas. */
function separer(m) {
  const J = m.joueurs;
  for (let a = 0; a < 6; a++) for (let c = a + 1; c < 6; c++) {
    const p = J[a], q = J[c];
    const dx = q.x - p.x, dy = q.y - p.y;
    const d2 = dx * dx + dy * dy, min = JOUEUR_R * 2;
    if (d2 >= min * min || d2 < 1e-9) continue;
    const d = Math.sqrt(d2), pousse = (min - d) / 2;
    const ux = dx / d, uy = dy / d;
    // Le porteur passe un peu moins facilement à travers un défenseur bien placé.
    const fp = m.ballon.porteur === p.id ? 1.15 : 1, fq = m.ballon.porteur === q.id ? 1.15 : 1;
    p.x -= ux * pousse * fp; p.y -= uy * pousse * fp;
    q.x += ux * pousse * fq; q.y += uy * pousse * fq;
  }
}

/* ------------------------------------------------------------------ */
/* Le ballon                                                           */
/* ------------------------------------------------------------------ */

function physiqueBallon(m, evs, enJeu) {
  const b = m.ballon;
  if (b.porteur >= 0) {
    const p = m.joueurs[b.porteur];
    const cote = p.i === 2 ? -1 : 1;
    b.x = p.x + p.dx * 0.32 - p.dy * 0.22 * cote;
    b.y = p.y + p.dy * 0.32 + p.dx * 0.22 * cote;
    if (p.etat === 'tir') b.z = 2.25 + p.z;
    else if (p.etat === 'dunk') { b.z = 2.4 + p.z; b.x = p.x + p.dx * 0.25; b.y = p.y + p.dy * 0.25; }
    else if (b.remise === p.id) b.z = 1.25;
    else {
      // Le dribble : le ballon descend et remonte (un rebond par cycle).
      const u = ((m.f + p.id * 7) % CYCLE_DRIBBLE) / (CYCLE_DRIBBLE / 2);
      const tri = u < 1 ? u : 2 - u;
      b.z = BALLE_R + (1 - tri) * 0.85;
      if ((m.f + p.id * 7) % CYCLE_DRIBBLE === CYCLE_DRIBBLE / 2) evs.push({ type: 'dribble', joueur: p.id });
    }
    b.vx = p.vx; b.vy = p.vy; b.vz = 0;
    return;
  }
  const N = 4, h = DT / N;
  for (let s = 0; s < N; s++) {
    const pz = b.z;
    b.x += b.vx * h; b.y += b.vy * h;
    b.z += b.vz * h - 0.5 * G * h * h;
    b.vz -= G * h;
    for (const cote of [-1, 1]) {
      const hx = cote * PANIER_X;
      const rx = b.x - hx, ry = b.y;
      const rh = Math.sqrt(rx * rx + ry * ry);
      // Dedans ! (le ballon passe l'arceau en descendant, assez près du centre)
      if (enJeu && !b.marque && pz >= ANNEAU_Z && b.z < ANNEAU_Z && b.vz < 0 && rh < ANNEAU_R - 0.02) {
        b.marque = true;
        b.vx *= 0.25; b.vy *= 0.25; b.vz *= 0.6;
        marquer(m, cote, evs);
        if (m.phase !== 'jeu' && m.phase !== 'panier') return;
      }
      // L'arceau : le point du cercle le plus proche.
      const cx = rh > 1e-6 ? hx + (rx / rh) * ANNEAU_R : hx + ANNEAU_R, cy = rh > 1e-6 ? (ry / rh) * ANNEAU_R : 0;
      const ex = b.x - cx, ey = b.y - cy, ez = b.z - ANNEAU_Z;
      const dd = Math.sqrt(ex * ex + ey * ey + ez * ez), lim = BALLE_R + 0.012;
      if (dd < lim && dd > 1e-6) {
        const nx = ex / dd, ny = ey / dd, nz = ez / dd;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        if (vn < 0) {
          b.vx -= 1.45 * vn * nx; b.vy -= 1.45 * vn * ny; b.vz -= 1.45 * vn * nz;
          b.vx *= 0.88; b.vy *= 0.88;
          if (b.touche++ % 3 === 0 && -vn > 0.8) evs.push({ type: 'arceau', force: -vn });
        }
        b.x = cx + nx * lim; b.y = cy + ny * lim; b.z = ANNEAU_Z + nz * lim;
      }
      // La planche.
      const px = cote * PLANCHE_X;
      if (Math.abs(b.y) < PLANCHE_DL && b.z > PLANCHE_BAS - BALLE_R && b.z < PLANCHE_HAUT + BALLE_R && cote * b.vx > 0) {
        const avant = cote * (b.x - px);
        if (avant > -BALLE_R && avant < 0.15) {
          b.x = px - cote * BALLE_R;
          b.vx = -b.vx * 0.55;
          evs.push({ type: 'planche', force: Math.abs(b.vx) });
        }
      }
    }
    // Le parquet.
    if (b.z < BALLE_R) {
      b.z = BALLE_R;
      if (b.vz < -0.9) {
        b.vz = -b.vz * 0.74;
        evs.push({ type: 'sol', force: b.vz });
      } else b.vz = 0;
      b.vx *= 0.9; b.vy *= 0.9;
      b.tir = null;
      b.marque = false;
    }
    // Les lignes (version arcade : le ballon rebondit dessus).
    if (Math.abs(b.y) > DEMI_W) { b.y = clamp(b.y, -DEMI_W, DEMI_W); b.vy = -b.vy * 0.5; }
    if (Math.abs(b.x) > DEMI_L + 0.4) { b.x = clamp(b.x, -DEMI_L - 0.4, DEMI_L + 0.4); b.vx = -b.vx * 0.5; }
  }
  if (b.z <= BALLE_R + 1e-6 && b.vz === 0) { b.vx *= 0.97; b.vy *= 0.97; }
}

/** Un panier dans l'arceau du côté `cote` : les points vont à l'équipe qui attaque ce panier. */
function marquer(m, cote, evs) {
  const b = m.ballon;
  const e = m.equipes[0].sens === cote ? 0 : 1;
  const tir = b.tir && b.tir.e === e ? b.tir : null;
  const pts = tir ? tir.pts : 2;
  const j = tir ? tir.j : b.dernier;
  m.score[e] += pts;
  if (tir) {
    m.stats.reussis[e] += 1;
    if (pts === 3) m.stats.troisReussis[e] += 1;
    if (tir.passeur >= 0) { m.stats.decisives[e] += 1; m.perso[tir.passeur].passes += 1; }
  }
  if (j >= 0 && m.joueurs[j].e === e) m.perso[j].pts += pts;
  m.paniers.push({ e, j, pts, passeur: tir ? tir.passeur : -1, dunk: !!tir?.dunk, periode: m.periode, chrono: m.chrono, enOr: m.enOr });
  b.tir = null;
  b.rebond = null;
  m.phase = 'panier';
  m.t = m.entrainement ? 60 : APRES_PANIER;
  m.aRemettre = 1 - e;
  evs.push({ type: 'panier', equipe: e, joueur: j, pts, passeur: tir ? tir.passeur : -1, dunk: !!tir?.dunk, enOr: m.enOr });
}

/** Qui attrape le ballon libre (une passe, un rebond, un ballon qui traîne) ? */
function attraper(m, evs) {
  const b = m.ballon;
  if (b.porteur >= 0) return;
  // L'entre-deux : les deux pivots seulement, et on tape le ballon vers un coéquipier.
  if (b.entre) {
    let best = null, bv = -1e9;
    for (const p of m.joueurs) {
      if (p.i !== 2) continue;
      const hd = dist(p.x, p.y, b.x, b.y);
      if (hd > 0.9 || b.z > allonge(p) + 0.05 || b.vz > 0) continue;
      const v = allonge(p) - b.z + hasard(m) * 0.25;
      if (v > bv) { bv = v; best = p; }
    }
    if (best) {
      const r = m.joueurs[best.e * 3 + (hasard(m) < 0.5 ? 0 : 1)];
      const T = 0.55;
      Object.assign(b, { vx: (r.x - b.x) / T, vy: (r.y - b.y) / T, vz: (1.2 - b.z + 0.5 * G * T * T) / T, entre: false, dernier: best.id, cible: r.id, passeur: -1, aTerre: false });
      m.tip = best.e;
      evs.push({ type: 'tape', joueur: best.id, equipe: best.e });
    } else if (b.z < 1.8) b.entre = false;
    return;
  }
  if (b.marque) return;
  let best = null, bv = -1e9;
  for (const p of m.joueurs) {
    if (p.lache > 0 || p.etat === 'dunk' || p.absent || m.equipes[p.e].immobile) continue;
    const hd = dist(p.x, p.y, b.x, b.y);
    if (hd > 0.62 || b.z > allonge(p) + 0.05) continue;
    // Un tir encore au-dessus de l'arceau : personne n'y touche.
    if (b.tir && b.z > ANNEAU_Z - 0.25) continue;
    // Une passe : le receveur l'attrape ; un défenseur sur la trajectoire peut l'intercepter (une fois chacun).
    if (b.cible >= 0 && p.e !== m.joueurs[b.cible].e) {
      if (b.essais & (1 << p.id)) continue;
      b.essais |= 1 << p.id;
      const chance = clamp(0.3 + (p.n.defense - 70) / 110 - (b.z > 2 ? 0.15 : 0) + (p.surpris > 0 ? -0.2 : 0), 0.05, 0.75) * (b.aTerre ? 0.5 : 1);
      if (hasard(m) >= chance) continue;
    }
    const v = -hd + (p.id === b.cible ? 0.5 : 0) + p.z * 0.4 + hasard(m) * 0.2;
    if (v > bv) { bv = v; best = p; }
  }
  if (!best) return;
  const p = best;
  const ancien = b.dernier >= 0 ? m.joueurs[b.dernier].e : -1;
  if (b.rebond) {
    m.stats.rebonds[p.e] += 1;
    m.perso[p.id].rebonds += 1;
    if (p.e === b.rebond.e) m.stats.rebondsOff[p.e] += 1;
    evs.push({ type: 'rebond', joueur: p.id, offensif: p.e === b.rebond.e });
  } else if (b.cible >= 0 && p.id !== b.cible && p.e !== m.joueurs[b.cible].e) {
    m.stats.vols[p.e] += 1;
    m.perso[p.id].vols += 1;
    evs.push({ type: 'interception', joueur: p.id, passeur: b.passeur });
  } else evs.push({ type: 'reception', joueur: p.id });
  p.passeDe = b.passeur >= 0 && b.cible === p.id ? b.passeur : -1;
  p.passeF = m.f;
  p.recu = 0;
  Object.assign(b, { porteur: p.id, dernier: p.id, cible: -1, passeur: -1, essais: 0, tir: null, rebond: null, remise: -1, aTerre: false });
  if (p.e !== m.poss.e || ancien !== p.e) {
    if (p.e !== m.poss.e) m.poss = { e: p.e, f: m.f, passes: 0 };
  }
  if (m.equipes[p.e].ctrl === 'humain') m.equipes[p.e].actif = p.id;
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Le temps de la période en cours, à afficher : « 2:41 » (il descend). */
export function chronoTexte(m) {
  if (m.entrainement) return '∞';
  if (m.enOr) return 'OR';
  const reste = Math.max(0, Math.ceil((m.duree - m.chrono) / FPS));
  return `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`;
}

/** L'empreinte d'un match : de quoi voir si deux appareils jouent toujours la même chose. */
export function empreinte(m) {
  let h = m.f | 0;
  const b = m.ballon;
  for (const v of [b.x, b.y, b.z, b.porteur, m.score[0], m.score[1], m.alea]) h = (Math.imul(h, 31) + Math.round(v * 100)) | 0;
  for (const p of m.joueurs) h = (Math.imul(h, 31) + Math.round(p.x * 100) * 7 + Math.round(p.y * 100) + Math.round(p.z * 100) * 13) | 0;
  return String(h >>> 0);
}

/** Le vainqueur d'un match fini (0 ou 1). */
export const vainqueur = (m) => m.vainqueur;

/** Joue un match entier sans humain (pour les tests et l'équilibrage). */
export function simuler(opts) {
  const m = creerMatch({ ...opts, controles: ['ia', 'ia'] });
  let garde = 0;
  while (m.phase !== 'fin' && garde++ < 400000) pas(m, [0, 0]);
  return m;
}
