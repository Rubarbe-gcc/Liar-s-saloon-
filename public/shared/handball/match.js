/**
 * ROUCOULETTE — le moteur d'un match de handball à sept contre sept (un
 * gardien et six joueurs de champ par équipe), sur un terrain de 40 × 20 m.
 *
 * Deux mi-temps ; en cas d'égalité, un but en or (le premier qui marque
 * gagne). Un engagement au centre pour commencer ; après un but, l'équipe qui
 * l'a encaissé réengage. La zone des 6 m n'est qu'au gardien : un joueur de
 * champ peut y voler (le tir en suspension) mais pas s'y poser (le ballon
 * revient alors au gardien). Un ballon qui sort derrière le but revient au
 * gardien. Pas de faute, pas de jet de 7 m, le ballon rebondit sur les lignes
 * de côté : de l'arcade.
 *
 * Les touches de chaque équipe, à chaque image : un nombre (terrain.js, T).
 *   en attaque : A passe, R passe à terre, B tir (on saute en appuyant ; on lâche
 *                en haut du saut ; le stick vise : vers le fond ou vers soi pour
 *                le poteau, vers le but pour la lucarne, en arrière à ras de terre),
 *                X feinte (on élimine son défenseur) ; quand notre gardien a le
 *                ballon, A le lui demande ;
 *   en défense : A vol de balle, B saut (contrer un tir), G change de joueur ;
 *   S : sprint (l'endurance baisse).
 * Les gardiens sont toujours dirigés par l'ordinateur.
 *
 * L'entraînement (o.entrainement) : on joue librement, sans chrono ni fin,
 * avec moins de joueurs (les absents sont garés hors du terrain), avec ou
 * sans gardiens, et des adversaires qui jouent ou qui restent plantés comme
 * des plots (ils ne touchent jamais le ballon ; leur gardien, lui, garde son
 * but). Après un but, le ballon revient à l'équipe 0.
 *
 * Déterministe : même graine, mêmes touches → même match, image par image.
 * L'état est un objet simple (copiable par structuredClone) ; `pas` le fait
 * avancer d'une image et rend ce qui s'est passé (les événements).
 *
 * Module partagé, sans DOM.
 */

import {
  FPS, DT, G, DEMI_L, DEMI_W, DEMI_BUT, BUT_H, BUT_P, ZONE, BALLE_R, JOUEUR_R, CHARGE_IDEALE, CHARGE_MAX, T,
  hasard, gauss, clamp, dist, butX, distBut, zoneDe, sortirZone, vitesseMax, allonge, elan,
} from './terrain.js';
import { EQUIPE, notesJoueur } from './equipes.js';
import { decider, niveauDe, posteDefense, posteAttaque } from './ia.js';

export { FPS, T, CHARGE_IDEALE, CHARGE_MAX, DEMI_L, DEMI_W, DEMI_BUT, BUT_H, ZONE };

/** Les attentes (en images). */
const ENGAGEMENT = 55;
const APRES_BUT = 110;
const SORTIE = 32;
const PAUSE = 200;
const REMISE_MAX = 170;
const RIEN = { mx: 0, my: 0, sprint: false, action: null };
/** Le cycle du dribble (le ballon touche le sol toutes les 30 images). */
export const CYCLE_DRIBBLE = 30;
/** Le nombre de joueurs par équipe. */
export const N = 7;

/** L'ordre dans lequel les joueurs de champ entrent sur le terrain à l'entraînement : nous (le demi-centre d'abord), eux (la défense centrale d'abord). */
const ORDRE_ENTREE = [[3, 1, 5, 2, 4, 6], [3, 2, 4, 6, 1, 5]];

/**
 * Un match.
 * @param {object} o
 * @param {[string, string]} o.equipes      les deux équipes (identifiants d'equipes.js)
 * @param {number} [o.graine]
 * @param {number} [o.minutes]              la durée d'une mi-temps
 * @param {[string, string]} [o.controles]  'humain' ou 'ia', pour chaque équipe
 * @param {[number, number]} [o.niveaux]    0 facile, 1 normal, 2 difficile (pour l'ordinateur)
 * @param {{ nous: number, eux: number, gardiens: [boolean, boolean], immobiles: boolean }} [o.entrainement]  nous : 1 à 6, eux : 0 à 6
 */
export function creerMatch({ equipes, graine = 1, minutes = 3, controles = ['humain', 'ia'], niveaux = [1, 1], entrainement = null }) {
  const m = {
    f: 0, alea: (graine >>> 0) || 1,
    phase: 'engagement', t: ENGAGEMENT, periode: 1, chrono: 0, duree: Math.round(minutes * 60 * FPS),
    score: [0, 0], enOr: false, attente: 0, premier: (graine >>> 0) & 1, aEngager: 0, aRenvoi: 0,
    poss: { e: -1, f: 0, passes: 0, contre: false },
    equipes: [0, 1].map((e) => ({ id: equipes[e], style: EQUIPE[equipes[e]].style, sens: e === 0 ? 1 : -1, ctrl: controles[e], niveau: niveaux[e] ?? 1, actif: e * N + 3, revoir: 0, immobile: false })),
    joueurs: [],
    ballon: { x: 0, y: 0, z: 1.2, vx: 0, vy: 0, vz: 0, porteur: -1, dernier: -1, passeur: -1, cible: -1, essais: 0, tir: null, rebond: null, remise: -1, engage: false, aTerre: false, dansBut: false },
    prec: [0, 0],
    stats: { tirs: [0, 0], cadres: [0, 0], arrets: [0, 0], passes: [0, 0], decisives: [0, 0], vols: [0, 0], contres: [0, 0], contreAttaques: [0, 0], possession: [0, 0] },
    buts: [],
    perso: new Array(2 * N).fill(null).map(() => ({ buts: 0, tirs: 0, passes: 0, arrets: 0, vols: 0, contres: 0 })),
    vainqueur: -1,
  };
  for (let e = 0; e < 2; e++) {
    const eq = EQUIPE[equipes[e]];
    for (let i = 0; i < N; i++) {
      m.joueurs.push({
        id: e * N + i, e, i, n: notesJoueur(eq, i), vedette: !!eq.joueurs[i].vedette,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dx: 1, dy: 0, etat: 'normal', t: 0,
        charge: 0, chargeCible: 0, verrou: 0, lache: 0, surpris: 0, feinte: 0, endu: 1, sortie: false,
        recu: 0, passeDe: -1, passeF: -1000, dec: 0, but: null, coupe: 0, cote: 0, haut: false, visee: null,
      });
    }
  }
  if (entrainement) {
    reglerEntrainement(m, entrainement);
    return m;
  }
  placerEngagement(m, m.premier);
  return m;
}

/**
 * Change les réglages de l'entraînement en pleine partie (le menu pause) :
 * o : { nous: 1 à 6, eux: 0 à 6, gardiens: [bool, bool], immobiles, niveau (de l'ordinateur) }. L'action repart, le ballon pour nous.
 */
export function reglerEntrainement(m, o) {
  const g = o.gardiens || [true, true];
  m.entrainement = { nous: clamp(o.nous | 0, 1, 6), eux: clamp(o.eux | 0, 0, 6), gardiens: [!!g[0], !!g[1]], immobiles: !!o.immobiles };
  const n = [m.entrainement.nous, m.entrainement.eux];
  for (let e = 0; e < 2; e++) {
    m.joueurs[e * N].absent = !m.entrainement.gardiens[e];
    ORDRE_ENTREE[e].forEach((i, k) => { m.joueurs[e * N + i].absent = k >= n[e]; });
  }
  m.equipes[1].immobile = m.entrainement.immobiles;
  if (o.niveau >= 0 && o.niveau <= 2) m.equipes[1].niveau = o.niveau;
  placerDepart(m);
}

const RAZ = { z: 0, vx: 0, vy: 0, vz: 0, etat: 'normal', t: 0, charge: 0, chargeCible: 0, verrou: 0, lache: 0, surpris: 0, feinte: 0, dec: 0, but: null, coupe: 0, sortie: false, visee: null };

function garer(p) { Object.assign(p, RAZ, { x: -18 + p.id * 2.6, y: -(DEMI_W + 50), dx: 1, dy: 0 }); }

/** Place un joueur en (X, Y) « vus par son équipe » (X vers le but qu'elle attaque, Y vers sa gauche). */
function placer(m, p, X, Y) {
  const s = m.equipes[p.e].sens;
  Object.assign(p, RAZ, { x: X * s, y: Y * s, dx: s, dy: 0 });
}

function ballonA(m, p, remise = -1, engage = false) {
  Object.assign(m.ballon, { x: p.x, y: p.y, z: 1.1, vx: 0, vy: 0, vz: 0, porteur: p.id, dernier: p.id, passeur: -1, cible: -1, essais: 0, tir: null, rebond: null, remise, engage, aTerre: false, dansBut: false });
  p.recu = 0;
}

/** L'entraînement : le ballon à notre premier joueur, vers le but adverse ; les adversaires en défense ; les absents garés. */
function placerDepart(m) {
  for (const p of m.joueurs) {
    if (p.absent) { garer(p); continue; }
    if (p.i === 0) { placer(m, p, -DEMI_L + 1, 0); continue; }
    if (p.e === 0) { const a = posteAttaque(m, p); placer(m, p, a.X - 5, a.Y); } else { const d = posteDefense(m, p, '6-0', 0); placer(m, p, d.X, d.Y); }
  }
  const r = m.joueurs.find((p) => p.e === 0 && !p.absent && p.i > 0);
  const s = m.equipes[0].sens;
  r.x = 6 * s; r.y = 0;
  ballonA(m, r);
  m.equipes[0].actif = r.id;
  const r1 = m.joueurs.find((p) => p.e === 1 && !p.absent && p.i > 0);
  m.equipes[1].actif = r1 ? r1.id : N + 3;
  m.poss = { e: 0, f: m.f, passes: 0, contre: false };
  m.phase = 'engagement';
  m.t = 30;
}

/**
 * L'engagement de l'équipe e, au centre : chacun dans sa moitié, le demi-centre
 * (ou le premier joueur de champ présent) avec le ballon ; il doit passer.
 */
function placerEngagement(m, e) {
  for (const p of m.joueurs) {
    if (p.absent) { garer(p); continue; }
    if (p.i === 0) { placer(m, p, -DEMI_L + 1, 0); continue; }
    if (p.e === e) {
      const [X, Y] = [null, [-1.2, 7.2], [-4.5, 3.8], [-0.35, 0], [-4.5, -3.8], [-1.2, -7.2], [-2.2, 1.4]][p.i];
      placer(m, p, X, Y);
    } else {
      const d = posteDefense(m, p, '6-0', 0);
      placer(m, p, d.X + 1.5, d.Y);
    }
  }
  const r = m.joueurs[e * N + 3].absent ? m.joueurs.find((p) => p.e === e && !p.absent && p.i > 0) : m.joueurs[e * N + 3];
  if (r) { r.x = -0.35 * m.equipes[e].sens; r.y = 0; ballonA(m, r, r.id, true); m.equipes[e].actif = r.id; }
  const o = m.joueurs.find((p) => p.e === 1 - e && !p.absent && p.i === 3) || m.joueurs.find((p) => p.e === 1 - e && !p.absent && p.i > 0);
  if (o) m.equipes[1 - e].actif = o.id;
  m.poss = { e, f: m.f, passes: 0, contre: false };
  m.phase = 'engagement';
  m.t = ENGAGEMENT;
}

/** Le renvoi : le gardien de l'équipe e reprend le ballon dans sa zone (ballon sorti, pied dans la zone). */
function placerRenvoi(m, e) {
  const gk = m.joueurs[e * N];
  if (gk.absent) { if (m.entrainement) { placerDepart(m); return; } }
  const s = m.equipes[e].sens;
  Object.assign(gk, RAZ, { x: -s * (DEMI_L - 1.2), y: clamp(gk.y, -1.5, 1.5), dx: s, dy: 0 });
  ballonA(m, gk, gk.id);
  m.poss = { e, f: m.f, passes: 0, contre: false };
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
        m.t = 0;
        evs.push({ type: 'sifflet', n: 1 });
      }
      break;
    case 'jeu':
      jouer(m, k, ap, rel, evs);
      break;
    case 'but':
    case 'sortie':
      // La joie (ou la déception) : le ballon finit sa course, les joueurs ralentissent.
      for (const p of m.joueurs) if (!p.absent) { deplacer(m, p, RIEN); borner(m, p); }
      physiqueBallon(m, evs, false);
      if (--m.t <= 0) {
        if (m.phase === 'sortie') { placerRenvoi(m, m.aRenvoi); evs.push({ type: 'renvoi', equipe: m.aRenvoi }); }
        else if (m.entrainement) { placerDepart(m); evs.push({ type: 'remise', equipe: 0 }); }
        else if (m.enOr) finir(m, evs);
        else if (m.chrono >= m.duree) finPeriode(m, evs);
        else { placerEngagement(m, m.aEngager); evs.push({ type: 'engagement', equipe: m.aEngager }); }
      }
      break;
    case 'pause':
      if (--m.t <= 0) {
        if (m.periode === 1) {
          m.periode = 2;
          m.chrono = 0;
          for (const eq of m.equipes) eq.sens = -eq.sens;
          // La deuxième mi-temps : l'autre équipe engage.
          placerEngagement(m, 1 - m.premier);
          evs.push({ type: 'reprise' });
        } else {
          m.enOr = true;
          placerEngagement(m, hasard(m) < 0.5 ? 0 : 1);
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
    if (p.feinte > 0) p.feinte -= 1;
    if (b.porteur === p.id) p.recu += 1;
  }
  for (const eq of m.equipes) if (eq.revoir > 0) eq.revoir -= 1;
  // La remise traîne : elle part toute seule.
  if (b.remise >= 0 && ++m.t > REMISE_MAX) {
    const p = m.joueurs[b.remise];
    const r = choisirReceveur(m, p, 0, 0);
    if (r >= 0) passer(m, p, m.joueurs[r], evs);
  }

  const cons = new Array(2 * N).fill(null);
  for (let e = 0; e < 2; e++) if (m.equipes[e].ctrl === 'humain') humain(m, e, k[e], ap[e], rel[e], cons, evs);
  for (let e = 0; e < 2; e++) decider(m, e, cons);
  for (let i = 0; i < 2 * N; i++) {
    const c = cons[i];
    if (c && c.action) agir(m, m.joueurs[i], c.action, evs);
  }
  // Le tir en préparation : il monte (le saut), et part tout seul s'il a trop attendu (ou avant de retomber).
  for (const p of m.joueurs) {
    if (p.etat !== 'tir' || b.porteur !== p.id) continue;
    p.charge += 1;
    const retombe = p.vz < 0 && p.z + p.vz * DT < 0.04;
    if ((p.chargeCible && p.charge >= p.chargeCible) || p.charge >= CHARGE_MAX || retombe) lacherTir(m, p, evs);
  }
  gardiens(m, evs);
  for (const p of m.joueurs) if (!p.absent) deplacer(m, p, cons[p.id] || RIEN);
  separer(m);
  for (const p of m.joueurs) if (!p.absent) borner(m, p);
  // Un joueur de champ posé dans la zone avec le ballon : il revient au gardien.
  if (b.porteur >= 0) {
    const p = m.joueurs[b.porteur];
    if (p.i > 0 && p.z === 0 && p.vz === 0 && zoneDe(p.x, p.y)) {
      const e = 1 - p.e;
      evs.push({ type: 'zone', joueur: p.id });
      if (m.joueurs[e * N].absent) { if (m.entrainement) { placerDepart(m); evs.push({ type: 'remise', equipe: 0 }); return; } }
      else { placerRenvoi(m, e); evs.push({ type: 'renvoi', equipe: e }); return; }
    }
  }
  physiqueBallon(m, evs, true);
  if (m.phase !== 'jeu') return;
  attraper(m, evs);

  if (b.porteur >= 0) m.stats.possession[m.joueurs[b.porteur].e] += 1;
  // L'entraînement : un ballon arrêté dans une zone sans gardien repart pour nous.
  if (m.entrainement) {
    if (b.porteur < 0 && b.z < 0.3 && Math.abs(b.vx) + Math.abs(b.vy) < 1.2) {
      const gx = zoneDe(b.x, b.y);
      if (gx && m.joueurs[(m.equipes[0].sens === -Math.sign(gx) ? 0 : 1) * N].absent) { placerDepart(m); evs.push({ type: 'remise', equipe: 0 }); }
    }
    return;
  }
  // Le chrono s'arrête pendant l'engagement et le renvoi (et il n'y en a plus pendant le but en or).
  if (!m.enOr && b.remise < 0) m.chrono += 1;
  if (!m.enOr && m.chrono >= m.duree) {
    // Un tir parti avant la sirène a le droit d'arriver.
    const enVol = (b.tir && b.porteur < 0) || m.joueurs.some((p) => p.etat === 'tir' && b.porteur === p.id);
    if (!enVol || ++m.attente > 150) { m.attente = 0; evs.push({ type: 'sirene' }); finPeriode(m, evs); }
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

/** Le joueur de champ de l'équipe e le plus proche du ballon (sauf `sauf`). */
function plusProche(m, e, sauf = -1) {
  const b = m.ballon;
  let best = -1, bd = 1e9;
  for (let i = 1; i < N; i++) {
    const p = m.joueurs[e * N + i];
    if (p.id === sauf || p.absent) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

/** Le coéquipier (de champ) qu'on vise en passant dans la direction (dx, dy) (sinon : le mieux placé, vers le but). */
export function choisirReceveur(m, p, dx, dy) {
  const gx = butX(m, p.e);
  if (!dx && !dy) { dx = gx - p.x; dy = -p.y; }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= l; dy /= l;
  let best = -1, bv = -1e9;
  for (let i = 1; i < N; i++) {
    const r = m.joueurs[p.e * N + i];
    if (r === p || r.absent) continue;
    const ux = r.x - p.x, uy = r.y - p.y;
    const d = Math.sqrt(ux * ux + uy * uy) || 1;
    const v = ((ux * dx + uy * dy) / d) * 2 - d * 0.04;
    if (v > bv) { bv = v; best = r.id; }
  }
  return best;
}

function humain(m, e, k, ap, rel, cons, evs) {
  const eq = m.equipes[e], b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const aLaBalle = porteur && porteur.e === e && porteur.i > 0;
  if (aLaBalle) eq.actif = porteur.id;
  else if (!porteur && b.cible >= 0 && m.joueurs[b.cible].e === e) eq.actif = b.cible;
  if (eq.actif < 0 || m.joueurs[eq.actif].absent || m.joueurs[eq.actif].i === 0 || m.joueurs[eq.actif].e !== e) eq.actif = plusProche(m, e);
  if (eq.actif < 0) return;
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
  // Notre gardien a le ballon : on le lui demande.
  if (porteur && porteur.e === e && porteur.i === 0 && (ap & (T.A | T.R)) && porteur.etat === 'normal') {
    cons[porteur.id] = { ...RIEN, action: { type: 'passe', cible: p.id, aTerre: !!(ap & T.R) } };
  }
  if (porteur === p) {
    if (b.remise === p.id) {
      c.mx = 0; c.my = 0;
      if (ap & (T.A | T.R)) c.action = { type: 'passe', cible: choisirReceveur(m, p, mx, my), aTerre: !!(ap & T.R) };
    } else if (p.etat === 'tir') {
      p.visee = { mx, my };
      if (rel & T.B) c.action = { type: 'lacher' };
    } else if (p.etat === 'saut' && p.z > 0.05) {
      // Attrapé en l'air : on peut tirer tout de suite (avant de retomber).
      if (ap & T.B) { p.visee = { mx, my }; c.action = { type: 'enlair' }; }
      else if (ap & (T.A | T.R)) c.action = { type: 'passe', cible: choisirReceveur(m, p, mx, my), aTerre: !!(ap & T.R) };
    } else if (p.etat === 'normal') {
      if (ap & T.B) { p.visee = { mx, my }; c.action = { type: 'armer' }; }
      else if (ap & (T.A | T.R)) c.action = { type: 'passe', cible: choisirReceveur(m, p, mx, my), aTerre: !!(ap & T.R) };
      else if (ap & T.X) c.action = { type: 'feinte', dx: mx, dy: my };
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
      if (aLaBalle && a.cible >= 0 && a.cible !== p.id && (p.etat === 'normal' || (p.etat === 'saut' && p.z > 0))) passer(m, p, m.joueurs[a.cible], evs, !!a.aTerre);
      break;
    case 'armer':
      // Le tir en suspension : l'appel, le saut (on garde l'élan : on peut voler dans la zone).
      if (!aLaBalle || p.etat !== 'normal' || b.remise >= 0 || p.i === 0) break;
      p.etat = 'tir';
      p.charge = 0;
      p.chargeCible = a.cible || 0;
      if (a.visee) p.visee = a.visee;
      p.vz = elan(p) * 0.95;
      p.vx *= 0.75; p.vy *= 0.75;
      evs.push({ type: 'arme', joueur: p.id });
      break;
    case 'enlair':
      if (aLaBalle && p.etat === 'saut') { p.etat = 'tir'; p.charge = CHARGE_IDEALE - 3; p.chargeCible = CHARGE_IDEALE; }
      break;
    case 'lacher':
      if (aLaBalle && p.etat === 'tir') lacherTir(m, p, evs);
      break;
    case 'feinte':
      if (aLaBalle && p.etat === 'normal' && p.feinte <= 0 && p.verrou <= 0 && b.remise < 0) feinte(m, p, a.dx, a.dy, evs);
      break;
    case 'vol':
      if (!aLaBalle && p.verrou <= 0 && p.z === 0 && p.i > 0) voler(m, p, evs);
      break;
    case 'saut':
      if (!aLaBalle && p.z === 0 && p.vz === 0 && p.verrou <= 0 && p.etat === 'normal' && p.i > 0) {
        p.vz = elan(p);
        p.etat = 'saut';
        p.verrou = 40;
        evs.push({ type: 'saut', joueur: p.id });
      }
      break;
    default:
  }
}

/** La passe : directe, ou à terre (aTerre : plus lente, mais elle passe sous les bras des défenseurs). */
function passer(m, p, r, evs, aTerre = false) {
  const b = m.ballon;
  const vit = (aTerre ? 9.5 : 12) + p.n.passe * 0.05;
  // On vise là où sera le receveur (deux fois, pour que l'avance tienne compte du temps de vol).
  let tx = r.x, ty = r.y, Tv = 0.3;
  for (let k = 0; k < 2; k++) {
    Tv = Math.max(0.12, dist(p.x, p.y, tx, ty) / vit);
    tx = r.x + r.vx * Tv * 0.65; ty = r.y + r.vy * Tv * 0.65;
  }
  // Une longue relance monte un peu plus (le temps de vol aussi).
  const d = dist(p.x, p.y, tx, ty);
  if (d > 14 && !aTerre) Tv *= 1 + (d - 14) * 0.02;
  const err = (0.05 + Tv * 0.22) * (1.5 - p.n.passe / 100) * (p.surpris > 0 ? 1.5 : 1);
  tx += gauss(m) * err; ty += gauss(m) * err;
  tx = clamp(tx, -DEMI_L + 0.3, DEMI_L - 0.3); ty = clamp(ty, -DEMI_W + 0.3, DEMI_W - 0.3);
  const z0 = aTerre ? 0.9 : 1.6 + p.z, z1 = 1.3;
  Object.assign(b, {
    x: p.x + p.dx * 0.3, y: p.y + p.dy * 0.3, z: z0, porteur: -1, dernier: p.id, passeur: p.id, cible: r.id, essais: 0, tir: null, rebond: null, aTerre,
    vx: (tx - p.x) / Tv, vy: (ty - p.y) / Tv, vz: (z1 - z0 + 0.5 * G * Tv * Tv) / Tv, remise: -1, engage: false,
  });
  if (aTerre) {
    // Le ballon touche le sol aux trois cinquièmes du chemin (le rebond le ralentit un peu).
    const T1 = Tv * 0.6, f = 0.6 + 0.4 / 0.85;
    b.vx *= f; b.vy *= f;
    b.vz = (BALLE_R - z0 + 0.5 * G * T1 * T1) / T1;
  }
  p.lache = 10;
  if (p.etat === 'saut' || p.etat === 'tir') { p.etat = 'saut'; p.charge = 0; }
  m.stats.passes[p.e] += 1;
  m.poss.passes += 1;
  evs.push({ type: 'passe', joueur: p.id, cible: r.id, aTerre });
}

/** Où vise le tireur : un coin du but (ty : de -1,5 à 1,5 ; tz : la hauteur). */
function viser(m, p) {
  const gx = butX(m, p.e), s = m.equipes[p.e].sens;
  const gk = m.joueurs[(1 - p.e) * N];
  const v = m.equipes[p.e].ctrl === 'humain' ? p.visee : null;
  let ty, tz;
  if (v && v.my) ty = v.my > 0 ? 1.12 : -1.12;
  else {
    // Le côté ouvert : à l'opposé du gardien (et un peu au hasard).
    const gy = gk.absent ? 0 : gk.y;
    const cote = Math.abs(gy) > 0.15 ? -Math.sign(gy) : (hasard(m) < 0.5 ? 1 : -1);
    ty = cote * (0.85 + hasard(m) * 0.35);
    // De l'aile, on vise plutôt le premier poteau ou le petit côté… ou le long.
    if (Math.abs(p.y) > 5 && hasard(m) < 0.4) ty = -ty;
  }
  const avant = v ? v.mx * s : 0;
  if (v && avant > 0.3) tz = 1.62;
  else if (v && avant < -0.3) tz = 0.3;
  else tz = hasard(m) < 0.5 ? 0.38 + hasard(m) * 0.3 : 1.3 + hasard(m) * 0.35;
  return { gx, ty, tz };
}

/** Le tir part : la qualité dépend du moment où l'on lâche (en haut du saut, c'est parfait). */
function lacherTir(m, p, evs) {
  const b = m.ballon;
  const s = m.equipes[p.e].sens;
  const { gx, ty: ty0, tz: tz0 } = viser(m, p);
  const d = distBut(p.x, p.y, gx);
  const q = clamp(1 - Math.abs(p.charge - CHARGE_IDEALE) / 14, 0, 1);
  // L'imprécision : la distance, l'adresse, le lâcher, la fatigue (et le niveau de l'ordinateur).
  let sig = (0.1 + d * 0.028 + Math.max(0, d - 8) * 0.035) * (1.55 - p.n.tir * 0.009) * (1 + 0.7 * (1 - q) + 1.4 * (1 - q) * (1 - q)) * (1 + (1 - p.endu) * 0.3);
  if (m.equipes[p.e].ctrl === 'ia') sig *= niveauDe(m.equipes[p.e]).adresse;
  if (p.surpris > 0) sig *= 1.3;
  const ty = ty0 + gauss(m) * sig, tz = tz0 + gauss(m) * sig * 0.7;
  const v = 16 + p.n.tir * 0.08 + q * 3;
  const x0 = p.x + s * 0.25, y0 = p.y, z0 = 2.05 + p.z;
  const L = dist(x0, y0, gx, ty);
  const Tv = Math.max(0.08, L / v);
  Object.assign(b, {
    x: x0, y: y0, z: z0, porteur: -1, dernier: p.id, passeur: -1, cible: -1, essais: 0, remise: -1, engage: false, dansBut: false, aTerre: false,
    vx: (gx - x0) / Tv, vy: (ty - y0) / Tv, vz: (tz - z0 + 0.5 * G * Tv * Tv) / Tv,
    tir: { e: p.e, j: p.id, passeur: m.f - p.passeF < 300 ? p.passeDe : -1, d, ty, tz, q, arret: false, fait: false, plonge: false, v, contre: m.poss.contre },
    rebond: { e: p.e },
  });
  p.etat = 'saut';
  p.lache = 14;
  p.charge = 0; p.chargeCible = 0;
  m.stats.tirs[p.e] += 1;
  m.perso[p.id].tirs += 1;
  const cadre = Math.abs(ty) < DEMI_BUT - BALLE_R && tz < BUT_H - BALLE_R && tz > -0.3;
  if (cadre) m.stats.cadres[p.e] += 1;
  evs.push({ type: 'tir', joueur: p.id, q, d, aile: Math.abs(p.y) > 5.5 && Math.abs(p.x - gx) < 5 });
  // Un défenseur devant, les bras levés : il peut contrer.
  if (contrer(m, p, (gx - x0) / L, (ty - y0) / L, evs)) return;
  // Le gardien : l'arrêtera-t-il ? (décidé maintenant, montré quand le ballon arrive)
  const gk = m.joueurs[(1 - p.e) * N];
  if (cadre && !gk.absent) b.tir.arret = hasard(m) < chanceArret(m, gk, p, b.tir);
}

/**
 * La chance que le gardien arrête un tir cadré : sa note, la distance (de loin,
 * il voit venir), l'angle (des ailes, c'est plus facile pour lui), le coin visé,
 * la puissance, et s'il est bien placé (à combien du point visé, et le temps qu'il a).
 */
export function chanceArret(m, gk, p, tir) {
  const gx = butX(m, p.e);
  const dx = Math.abs(p.x - gx);
  const ouv = dx / Math.sqrt(dx * dx + p.y * p.y + 0.01);
  let c = 0.37 + (gk.n.gardien - 72) * 0.0095 + (tir.d - 8) * 0.042 + (1 - ouv) * 0.22;
  if (Math.abs(tir.ty) > 0.85) c -= 0.07;
  if (tir.tz < 0.55 || tir.tz > 1.45) c -= 0.06;
  c -= (tir.q - 0.7) * 0.15;
  c -= (tir.v - 23) * 0.012;
  // Le placement : le gardien loin du point visé, avec peu de temps, n'y arrivera pas.
  const tA = Math.max(0.05, tir.d / tir.v);
  const portee = 0.75 + tA * (2.4 + (gk.n.gardien - 70) * 0.03);
  const ecart = Math.abs(gk.y - tir.ty) + Math.max(0, Math.abs(tir.tz - 1) - 0.6) * 0.6;
  if (ecart > portee) c -= (ecart - portee) * 0.55;
  if (gk.surpris > 0) c -= 0.12;
  const eq = m.equipes[gk.e];
  if (eq.ctrl === 'ia' && m.equipes[p.e].ctrl === 'humain') c += niveauDe(eq).gardien;
  return clamp(c, 0.04, 0.82);
}

/** Un défenseur devant le tireur (en l'air, ou les bras levés) contre-t-il le ballon ? */
function contrer(m, p, ux, uy, evs) {
  const b = m.ballon;
  for (let k = 1; k < N; k++) {
    const o = m.joueurs[(1 - p.e) * N + k];
    if (o.absent || m.equipes[o.e].immobile) continue;
    const dx = o.x - p.x, dy = o.y - p.y, dd = Math.sqrt(dx * dx + dy * dy);
    const devant = dx * ux + dy * uy;
    if (dd > 1.9 || devant < 0.15) continue;
    const lat = Math.abs(dx * uy - dy * ux);
    if (lat > 0.75) continue;
    const eqo = m.equipes[o.e], humain = eqo.ctrl === 'humain' && eqo.actif === o.id;
    let chance;
    if (o.z > 0.1) {
      chance = clamp((o.z - 0.1) * 0.5 + (o.n.saut - 65) / 220 + (o.n.defense - 65) / 260 - (dd - 0.7) * 0.25 - p.z * 0.25 - lat * 0.25, 0, 0.42);
      if (humain) chance = clamp(0.6 * Math.min(1, o.z / 0.5) * (1 - Math.max(0, dd - 0.8) / 1.4) + (o.n.saut - 65) / 300, 0, 0.7);
    } else chance = clamp(0.07 + (o.n.defense - 70) / 350 - p.z * 0.12 - lat * 0.08, 0, 0.12);
    if (eqo.ctrl === 'ia') chance *= niveauDe(eqo).contre;
    if (hasard(m) < chance) {
      const l = gauss(m) * 2.5;
      Object.assign(b, { vx: -ux * 3 - uy * l + o.vx * 0.3, vy: -uy * 3 + ux * l + o.vy * 0.3, vz: 0.6 + hasard(m) * 1.8, tir: null, dernier: o.id, z: Math.max(b.z, 1.9) });
      b.rebond = { e: p.e };
      m.stats.contres[o.e] += 1;
      m.perso[o.id].contres += 1;
      evs.push({ type: 'contre', joueur: o.id, tireur: p.id });
      return true;
    }
  }
  return false;
}

/** La feinte : un changement de direction sec ; le défenseur tout près peut se faire prendre. */
function feinte(m, p, dx, dy, evs) {
  if (!dx && !dy) { dx = -p.dy; dy = p.dx; if (hasard(m) < 0.5) { dx = -dx; dy = -dy; } }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= l; dy /= l;
  const v = vitesseMax(p) * 1.3;
  p.vx = dx * v; p.vy = dy * v;
  p.dx = dx; p.dy = dy;
  p.feinte = 14;
  p.verrou = 45;
  let pris = 0;
  for (let k = 1; k < N; k++) {
    const o = m.joueurs[(1 - p.e) * N + k];
    if (o.absent || dist(o.x, o.y, p.x, p.y) > 1.8 || o.z > 0) continue;
    if (hasard(m) < 0.42 + (p.n.vitesse + p.n.passe - 2 * o.n.defense) / 160) { o.surpris = 34; pris += 1; }
  }
  evs.push({ type: 'feinte', joueur: p.id, reussi: pris > 0 });
}

/** Le vol : tout près du porteur ; raté, on est en retard (il file). */
function voler(m, p, evs) {
  const b = m.ballon;
  if (b.porteur < 0 || b.remise >= 0) return;
  const c = m.joueurs[b.porteur];
  if (c.e === p.e || c.i === 0) return;
  p.verrou = 40;
  if (dist(p.x, p.y, c.x, c.y) > 1.25) { evs.push({ type: 'vol-rate', joueur: p.id }); p.surpris = 10; return; }
  let chance = 0.2 + (p.n.defense - (c.n.passe + c.n.vitesse) / 2) / 140;
  if (c.feinte > 0) chance *= 0.3;
  if (c.etat !== 'normal') chance *= 0.2;
  if (p.surpris > 0) chance *= 0.3;
  if (hasard(m) < clamp(chance, 0.04, 0.45)) {
    b.porteur = p.id;
    b.dernier = p.id;
    p.recu = 0; p.passeDe = -1;
    c.verrou = 25; c.surpris = 18; c.etat = 'normal'; c.charge = 0;
    m.stats.vols[p.e] += 1;
    m.perso[p.id].vols += 1;
    m.poss = { e: p.e, f: m.f, passes: 0, contre: true };
    evs.push({ type: 'vol', joueur: p.id, victime: c.id });
  } else {
    p.surpris = 22;
    evs.push({ type: 'vol-rate', joueur: p.id });
  }
}

/* ------------------------------------------------------------------ */
/* Les gardiens                                                        */
/* ------------------------------------------------------------------ */

/** Le tir arrive : le gardien plonge (vers le bon coin s'il va l'arrêter ; trop court, ou du mauvais côté, sinon). */
function gardiens(m, evs) {
  const b = m.ballon;
  for (let e = 0; e < 2; e++) {
    const gk = m.joueurs[e * N];
    if (gk.absent) continue;
    if (gk.etat === 'plonge') {
      gk.y += gk.vy * DT;
      gk.vy *= 0.9;
      if (--gk.t <= 0) { gk.etat = 'normal'; gk.vy = 0; gk.verrou = 12; }
      continue;
    }
    const tir = b.tir;
    if (!tir || tir.e === e || b.porteur >= 0 || tir.plonge || tir.fait) continue;
    const tA = (gk.x - b.x) / (b.vx || 1e-6);
    if (tA < 0 || tA > 0.26) continue;
    tir.plonge = true;
    const ecart = tir.ty - gk.y;
    const haut = tir.tz > 1.15;
    if (Math.abs(ecart) < 0.4 && !haut && tir.tz > 0.5) continue; // sur lui : il ne bouge pas
    let vise = ecart;
    if (!tir.arret) vise = hasard(m) < 0.35 ? -ecart * 0.6 : ecart * 0.45;
    gk.etat = 'plonge';
    gk.t = 34;
    gk.cote = vise >= 0 ? 1 : -1;
    gk.haut = haut;
    gk.vy = clamp(vise / Math.max(0.12, tA), -7, 7);
    evs.push({ type: 'plonge', joueur: gk.id, cote: gk.cote * m.equipes[e].sens, haut });
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
      if (p.etat === 'saut' || p.etat === 'tir') { p.etat = 'normal'; p.charge = 0; }
      if (p.i > 0 && zoneDe(p.x, p.y)) p.sortie = true;
    }
    return;
  }
  if (p.etat === 'plonge') return;
  const porte = b.porteur === p.id;
  if (porte && b.remise === p.id && p.i > 0) { p.vx = 0; p.vy = 0; orienter(p, c); return; }
  // Retombé dans la zone : il en ressort, sans rien faire d'autre.
  if (p.sortie) {
    const gx = zoneDe(p.x, p.y, 0.02);
    if (!gx) { p.sortie = false; }
    else {
      const q = sortirZone(p.x, p.y, gx, ZONE + 0.1);
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx = (dx / d) * 3.6; p.vy = (dy / d) * 3.6;
      p.x += p.vx * DT; p.y += p.vy * DT;
      return;
    }
  }
  if (p.feinte > 0) {
    p.x += p.vx * DT; p.y += p.vy * DT;
    return;
  }
  const sprint = c.sprint && p.endu > 0.12 && (c.mx || c.my);
  let vm = vitesseMax(p) * (porte ? 0.92 : 1) * (sprint ? 1.27 : 1) * (0.78 + 0.22 * p.endu);
  if (p.i === 0) vm = 4.2 + (p.n.vitesse - 50) * 0.02;
  if (m.equipes[p.e].ctrl === 'ia') vm *= niveauDe(m.equipes[p.e]).vitesse;
  if (p.surpris > 0) vm *= 0.4;
  // À reculons (le défenseur face à son joueur), on va moins vite.
  const regard = c.fx || c.fy ? c.mx * p.dx + c.my * p.dy : 1;
  if (regard < 0) vm *= 1 + regard * 0.2;
  const tx = c.mx * vm, ty = c.my * vm;
  const k = c.mx || c.my ? (porte ? 0.16 : 0.2) : 0.24;
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  p.x += p.vx * DT; p.y += p.vy * DT;
  if (sprint) p.endu = Math.max(0, p.endu - 0.0014);
  else p.endu = Math.min(1, p.endu + 0.0009);
  orienter(p, c);
}

/** Où il regarde : là où il court, ou ce que l'ordinateur lui dit de regarder. */
function orienter(p, c) {
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  let fx = 0, fy = 0;
  if (c.fx || c.fy) { fx = c.fx; fy = c.fy; }
  else if (v > 0.5) { fx = p.vx; fy = p.vy; }
  const l = Math.sqrt(fx * fx + fy * fy);
  if (l > 1e-6) {
    const nx = p.dx + (fx / l - p.dx) * 0.3, ny = p.dy + (fy / l - p.dy) * 0.3;
    const n = Math.sqrt(nx * nx + ny * ny) || 1;
    p.dx = nx / n; p.dy = ny / n;
  }
}

function borner(m, p) {
  const b = m.ballon;
  p.x = clamp(p.x, -DEMI_L + 0.25, DEMI_L - 0.25);
  p.y = clamp(p.y, -DEMI_W + 0.25, DEMI_W - 0.25);
  if (p.i === 0) {
    // Le gardien ne quitte pas sa zone (et reste devant sa ligne).
    const gx = -m.equipes[p.e].sens * DEMI_L;
    if (Math.abs(p.x) > DEMI_L - 0.35) p.x = Math.sign(p.x) * (DEMI_L - 0.35);
    if (distBut(p.x, p.y, gx) > ZONE - 0.4) { const q = sortirZone(p.x, p.y, gx, ZONE - 0.4); p.x = q.x; p.y = q.y; }
    if (Math.sign(p.x) !== Math.sign(gx)) p.x = gx * 0.7;
    return;
  }
  // Un joueur de champ, au sol, ne pose pas le pied dans une zone (sauf s'il y est retombé : il en sort).
  if (p.z === 0 && p.vz === 0 && !p.sortie) {
    const gx = zoneDe(p.x, p.y);
    if (gx) { const q = sortirZone(p.x, p.y, gx); p.x = q.x; p.y = q.y; }
  }
  // L'engagement : chacun dans sa moitié tant que le ballon n'est pas parti.
  if (b.remise >= 0 && b.engage) {
    const s = m.equipes[p.e].sens;
    if (s * p.x > -0.3 && b.remise !== p.id) p.x = -0.3 * s;
  }
}

/** Deux joueurs ne se traversent pas. */
function separer(m) {
  const J = m.joueurs;
  for (let a = 0; a < 2 * N; a++) {
    const p = J[a];
    if (p.absent) continue;
    for (let c = a + 1; c < 2 * N; c++) {
      const q = J[c];
      if (q.absent) continue;
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
}

/* ------------------------------------------------------------------ */
/* Le ballon                                                           */
/* ------------------------------------------------------------------ */

function physiqueBallon(m, evs, enJeu) {
  const b = m.ballon;
  if (b.porteur >= 0) {
    const p = m.joueurs[b.porteur];
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (p.etat === 'tir') {
      // Armé au-dessus de l'épaule, en arrière.
      b.x = p.x - p.dx * 0.18 - p.dy * 0.28; b.y = p.y - p.dy * 0.18 + p.dx * 0.28; b.z = 2.05 + p.z;
    } else if (p.i === 0 || b.remise === p.id || sp < 2.2 || p.z > 0) {
      b.x = p.x + p.dx * 0.3 - p.dy * 0.2; b.y = p.y + p.dy * 0.3 + p.dx * 0.2; b.z = 1.15 + p.z;
    } else {
      // Le dribble : le ballon descend et remonte (un rebond par cycle).
      b.x = p.x + p.dx * 0.38 - p.dy * 0.22; b.y = p.y + p.dy * 0.38 + p.dx * 0.22;
      const u = ((m.f + p.id * 7) % CYCLE_DRIBBLE) / (CYCLE_DRIBBLE / 2);
      const tri = u < 1 ? u : 2 - u;
      b.z = BALLE_R + (1 - tri) * 0.9;
      if ((m.f + p.id * 7) % CYCLE_DRIBBLE === CYCLE_DRIBBLE / 2) evs.push({ type: 'dribble', joueur: p.id });
    }
    b.vx = p.vx; b.vy = p.vy; b.vz = 0;
    return;
  }
  const NS = 4, h = DT / NS;
  for (let s = 0; s < NS; s++) {
    const px = b.x;
    b.x += b.vx * h; b.y += b.vy * h;
    b.z += b.vz * h - 0.5 * G * h * h;
    b.vz -= G * h;
    // L'arrêt du gardien : le ballon arrive sur lui.
    const tir = b.tir;
    if (enJeu && tir && tir.arret && !tir.fait) {
      const gk = m.joueurs[(1 - tir.e) * N];
      const sa = m.equipes[tir.e].sens;
      if ((b.x - gk.x) * sa >= 0) { arreter(m, gk, evs); if (b.porteur >= 0) return; continue; }
    }
    // Le filet : une fois dedans, le ballon y reste.
    if (b.dansBut) {
      const c = Math.sign(b.x);
      if (Math.abs(b.x) > DEMI_L + BUT_P - BALLE_R) { b.x = c * (DEMI_L + BUT_P - BALLE_R); b.vx = -b.vx * 0.15; b.vy *= 0.5; }
      if (Math.abs(b.y) > DEMI_BUT - BALLE_R) { b.y = Math.sign(b.y) * (DEMI_BUT - BALLE_R); b.vy = -b.vy * 0.2; }
      if (b.z > BUT_H - BALLE_R) { b.z = BUT_H - BALLE_R; b.vz = Math.min(0, b.vz); }
    } else if (Math.abs(px) < DEMI_L && Math.abs(b.x) >= DEMI_L) {
      // La ligne de but : dedans, sur le poteau ou la barre, ou à côté.
      const c = Math.sign(b.x);
      const ay = Math.abs(b.y);
      if (ay < DEMI_BUT - BALLE_R * 0.6 && b.z < BUT_H - BALLE_R * 0.6) {
        b.dansBut = true;
        if (enJeu) { marquer(m, c, evs); if (m.phase !== 'but') return; }
      } else if (ay < DEMI_BUT + BALLE_R + 0.04 && b.z < BUT_H + BALLE_R + 0.04) {
        // Le poteau (ou la barre) : il revient en jeu.
        b.x = c * (DEMI_L - 0.02);
        b.vx = -b.vx * 0.42;
        if (b.z > BUT_H - 0.1) b.vz = -Math.abs(b.vz) * 0.5 - 0.5; else b.vy = b.vy * 0.5 + (ay > DEMI_BUT ? Math.sign(b.y) : -Math.sign(b.y)) * 2.5;
        if (b.tir) b.tir.fait = true;
        b.tir = null;
        evs.push({ type: 'poteau', barre: b.z > BUT_H - 0.1 });
      } else if (enJeu) {
        sortir(m, c, evs);
        return;
      }
    }
    // Le sol.
    if (b.z < BALLE_R) {
      b.z = BALLE_R;
      if (b.vz < -1) {
        b.vz = -b.vz * 0.6;
        evs.push({ type: 'sol', force: b.vz });
      } else b.vz = 0;
      b.vx *= 0.86; b.vy *= 0.86;
      if (b.tir && Math.abs(b.vx) < 6) b.tir = null;
    }
    // Les lignes de côté (version arcade : le ballon rebondit dessus).
    if (Math.abs(b.y) > DEMI_W) { b.y = clamp(b.y, -DEMI_W, DEMI_W); b.vy = -b.vy * 0.5; }
    if (!enJeu && !b.dansBut && Math.abs(b.x) > DEMI_L + 3) { b.x = clamp(b.x, -DEMI_L - 3, DEMI_L + 3); b.vx = 0; b.vy *= 0.5; }
  }
  if (b.z <= BALLE_R + 1e-6 && b.vz === 0) { b.vx *= 0.97; b.vy *= 0.97; }
}

/** Le gardien arrête le tir : il le capte (s'il n'est pas trop fort), ou le repousse. */
function arreter(m, gk, evs) {
  const b = m.ballon, tir = b.tir;
  tir.fait = true;
  const sa = m.equipes[tir.e].sens;
  m.stats.arrets[gk.e] += 1;
  m.perso[gk.id].arrets += 1;
  const capte = tir.v < 24.5 && hasard(m) < 0.38 + (gk.n.gardien - 75) * 0.012 + (tir.d - 8) * 0.03;
  b.x = gk.x - sa * 0.05;
  if (capte) {
    b.tir = null; b.rebond = null;
    ballonA(m, gk);
    gk.etat = 'normal'; gk.t = 0; gk.vy = 0;
    m.poss = { e: gk.e, f: m.f, passes: 0, contre: true };
    evs.push({ type: 'arret', joueur: gk.id, capte: true, tireur: tir.j });
    return;
  }
  // Il repousse : vers l'avant, sur un côté.
  Object.assign(b, { vx: -sa * (2 + hasard(m) * 4.5), vy: (hasard(m) - 0.5) * 9, vz: 1.2 + hasard(m) * 3.5, dernier: gk.id, tir: null, cible: -1, passeur: -1 });
  b.rebond = { e: tir.e };
  evs.push({ type: 'arret', joueur: gk.id, capte: false, tireur: tir.j });
}

/** Le ballon sort derrière le but (côté c) : il revient au gardien de ce but. */
function sortir(m, c, evs) {
  const b = m.ballon;
  const e = m.equipes[0].sens === -c ? 0 : 1;
  b.tir = null; b.rebond = null;
  m.phase = 'sortie';
  m.t = SORTIE;
  m.aRenvoi = e;
  evs.push({ type: 'sortie', equipe: e });
}

/** Un but dans le but du côté `c` : il va à l'équipe qui attaque ce but. */
function marquer(m, c, evs) {
  const b = m.ballon;
  const e = m.equipes[0].sens === c ? 0 : 1;
  const tir = b.tir && b.tir.e === e ? b.tir : null;
  const j = tir ? tir.j : b.dernier >= 0 && m.joueurs[b.dernier].e === e ? b.dernier : -1;
  m.score[e] += 1;
  if (tir && tir.passeur >= 0) { m.stats.decisives[e] += 1; m.perso[tir.passeur].passes += 1; }
  if (tir && tir.contre) m.stats.contreAttaques[e] += 1;
  if (j >= 0) m.perso[j].buts += 1;
  const passeur = tir ? tir.passeur : -1;
  m.buts.push({ e, j, passeur, periode: m.periode, chrono: m.chrono, enOr: m.enOr, contre: !!tir?.contre });
  b.vx *= 0.35; b.vy *= 0.35;
  b.tir = null;
  b.rebond = null;
  m.phase = 'but';
  m.t = m.entrainement ? 60 : APRES_BUT;
  m.aEngager = 1 - e;
  evs.push({ type: 'but', equipe: e, joueur: j, passeur, enOr: m.enOr, contre: !!tir?.contre, d: tir ? tir.d : 0, lucarne: !!tir && tir.tz > 1.5 });
}

/** Qui attrape le ballon libre (une passe, un ballon repoussé, un ballon qui traîne) ? */
function attraper(m, evs) {
  const b = m.ballon;
  if (b.porteur >= 0 || b.dansBut) return;
  // Un tir qui file vers le but : seul le gardien y touche (l'arrêt est déjà décidé).
  if (b.tir && Math.abs(b.vx) > 5) return;
  const gz = zoneDe(b.x, b.y);
  let best = null, bv = -1e9;
  for (const p of m.joueurs) {
    if (p.lache > 0 || p.absent || p.etat === 'plonge') continue;
    if (p.i > 0 && m.equipes[p.e].immobile) continue;
    const hd = dist(p.x, p.y, b.x, b.y);
    const gardien = p.i === 0;
    if (hd > (gardien ? 0.8 : p.id === b.cible ? 0.9 : 0.62) || b.z > allonge(p) + (gardien ? 0.2 : 0.05)) continue;
    // Dans la zone, le ballon est au gardien (un joueur de champ peut l'y prendre en l'air).
    if (!gardien && gz && p.z < 0.05 && (b.z < 0.5 || zoneDe(p.x, p.y))) continue;
    // Une passe : le receveur l'attrape ; un défenseur sur la trajectoire peut l'intercepter (une fois chacun).
    if (b.cible >= 0 && p.e !== m.joueurs[b.cible].e && !gardien) {
      if (b.essais & (1 << p.id)) continue;
      b.essais |= 1 << p.id;
      let chance = clamp(0.2 + (p.n.defense - 70) / 120 - (b.z > 2 ? 0.15 : 0) + (p.surpris > 0 ? -0.2 : 0), 0.05, 0.7) * (b.aTerre ? 0.5 : 1);
      if (m.equipes[p.e].ctrl === 'ia') chance *= niveauDe(m.equipes[p.e]).lecture;
      if (hasard(m) >= chance) continue;
    }
    const v = -hd + (p.id === b.cible ? 0.5 : 0) + (gardien ? 0.3 : 0) + p.z * 0.4 + hasard(m) * 0.2;
    if (v > bv) { bv = v; best = p; }
  }
  if (!best) return;
  const p = best;
  const recupere = b.dernier >= 0 && m.joueurs[b.dernier].e !== p.e;
  if (b.cible >= 0 && p.id !== b.cible && p.e !== m.joueurs[b.cible].e) {
    m.stats.vols[p.e] += 1;
    m.perso[p.id].vols += 1;
    evs.push({ type: 'interception', joueur: p.id, passeur: b.passeur });
  } else if (b.rebond) evs.push({ type: 'rebond', joueur: p.id, offensif: p.e === b.rebond.e });
  else evs.push({ type: 'reception', joueur: p.id });
  p.passeDe = b.passeur >= 0 && b.cible === p.id ? b.passeur : -1;
  p.passeF = m.f;
  p.recu = 0;
  Object.assign(b, { porteur: p.id, dernier: p.id, cible: -1, passeur: -1, essais: 0, tir: null, rebond: null, remise: -1, engage: false, aTerre: false });
  if (p.e !== m.poss.e) m.poss = { e: p.e, f: m.f, passes: 0, contre: recupere };
  if (m.equipes[p.e].ctrl === 'humain' && p.i > 0) m.equipes[p.e].actif = p.id;
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Le temps de la mi-temps en cours, à afficher : « 2:41 » (il descend). */
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
