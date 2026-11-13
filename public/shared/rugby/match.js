/**
 * RAFFUT — le moteur d'un match de rugby à 7 contre 7.
 *
 * Deux mi-temps ; en cas d'égalité, un point en or (le premier qui marque
 * gagne ; après 3 minutes sans point, le terrain gagné départage). Les règles, version arcade :
 *   - le coup d'envoi : un coup de pied haut dans le camp adverse (après un
 *     essai, comme au rugby à 7, c'est l'équipe qui a marqué qui renvoie) ;
 *   - les passes à la main vont vers l'arrière : une passe vers l'avant, c'est
 *     une faute (mêlée pour l'adversaire) ; un ballon échappé vers l'avant à la
 *     réception, c'est un en-avant (mêlée aussi) ;
 *   - le plaquage : le défenseur plonge (B) ; réussi, le porteur va au sol et
 *     c'est un ruck (les deux équipes poussent, la défense peut gratter le
 *     ballon : X) ; raté, le porteur file ; le raffut (X) repousse le plaqueur ;
 *   - l'essai (5 points) : le ballon aplati dans l'en-but ; puis la
 *     transformation (2 points) : on vise (haut, bas), on tient B pour la force ;
 *   - le coup de pied (B, tenu : plus long) : un ballon qui passe entre les
 *     poteaux, au-dessus de la barre, c'est un drop (3 points) ;
 *   - la touche (le ballon ou le porteur sort sur le côté) : un alignement,
 *     le lancer pour l'équipe qui n'a pas sorti le ballon ; le ballon mort
 *     (derrière l'en-but) : renvoi aux 22 ;
 *   - la sirène : la mi-temps finit au prochain arrêt de jeu.
 *
 * Les touches de chaque équipe, à chaque image : un nombre (terrain.js, T).
 *
 * L'entraînement (o.entrainement) : on joue librement, sans chrono ni fin,
 * avec moins de joueurs (les absents sont garés hors du terrain), et des
 * adversaires qui jouent ou qui restent plantés comme des plots (ils ne
 * touchent jamais le ballon, ne plaquent jamais). Après un arrêt de jeu, le
 * ballon revient à l'équipe 0 ; les transformations se jouent.
 *
 * Déterministe : même graine, mêmes touches → même match, image par image.
 * L'état est un objet simple (copiable par structuredClone) ; `pas` le fait
 * avancer d'une image et rend ce qui s'est passé (les événements).
 *
 * Module partagé, sans DOM.
 */

import {
  FPS, DT, G, DEMI_L, MORT, DEMI_W, LIGNE_22, POTEAU_Y, BARRE_Z, POTEAU_H, BALLE_R, JOUEUR_R, N,
  CHARGE_MAX, PORTEE_PLAQUAGE, T,
  hasard, gauss, clamp, dist, vitesseMax, allonge, vitessePied,
} from './terrain.js';
import { EQUIPE, STYLES, notesJoueur } from './equipes.js';
import { decider, niveauDe } from './ia.js';

export { FPS, T, CHARGE_MAX, DEMI_L, MORT, DEMI_W, POTEAU_Y, BARRE_Z, POTEAU_H, N };

/** Les attentes (en images). */
const ENGAGEMENT = 90;
const APRES_ESSAI = 120;
const APRES_TRANSFO = 90;
const PAUSE = 200;
const RUCK = 44;
const MELEE = 120;
const TOUCHE = 96;
const TRANSFO_IA = 80;
const TRANSFO_MAX = 600;
/** Après la sirène, on laisse au plus 40 secondes de jeu. */
const APRES_SIRENE = 40 * FPS;
/** Le point en or dure au plus 3 minutes de jeu : ensuite, le terrain gagné départage. */
const OR_MAX = 180 * FPS;
/** La force idéale d'une transformation (la part de la jauge). */
export const FORCE_IDEALE = 0.6;
const RIEN = { mx: 0, my: 0, sprint: false, action: null };

/** L'ordre dans lequel les joueurs entrent sur le terrain à l'entraînement. */
const ORDRE_ENTREE = [[4, 3, 5, 6, 1, 0, 2], [5, 1, 6, 3, 4, 0, 2]];

const nouveauBallon = () => ({
  x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, porteur: -1, dernier: -1, passeur: -1, cible: -1, essais: 0,
  pied: null, ruck: false, bloque: false, lancer: false, avant: false,
});

/**
 * Un match.
 * @param {object} o
 * @param {[string, string]} o.equipes      les deux équipes (identifiants d'equipes.js)
 * @param {number} [o.graine]
 * @param {number} [o.minutes]              la durée d'une mi-temps
 * @param {[string, string]} [o.controles]  'humain' ou 'ia', pour chaque équipe
 * @param {[number, number]} [o.niveaux]    0 facile, 1 normal, 2 difficile (pour l'ordinateur)
 * @param {{ nous: number, eux: number, immobiles: boolean }} [o.entrainement]  nous : 1 à 7, eux : 0 à 7
 */
export function creerMatch({ equipes, graine = 1, minutes = 3, controles = ['humain', 'ia'], niveaux = [1, 1], entrainement = null }) {
  const m = {
    f: 0, alea: (graine >>> 0) || 1,
    phase: 'engagement', t: ENGAGEMENT, periode: 1, chrono: 0, duree: Math.round(minutes * 60 * FPS),
    score: [0, 0], enOr: false, sirene: false, apresSirene: 0, premierEnvoi: 0, envoi: null,
    poss: { e: -1, f: 0 },
    equipes: [0, 1].map((e) => ({ id: equipes[e], style: EQUIPE[equipes[e]].style, sens: e === 0 ? 1 : -1, ctrl: controles[e], niveau: niveaux[e] ?? 1, actif: e * N + 4, immobile: false })),
    joueurs: [],
    ballon: nouveauBallon(),
    ruck: null, melee: null, touche: null, marque: null, transfo: null, faute: null,
    prec: [0, 0],
    stats: {
      essais: [0, 0], transfos: [0, 0], transfosTentees: [0, 0], drops: [0, 0], pieds: [0, 0], passes: [0, 0],
      plaquages: [0, 0], plaquagesRates: [0, 0], franchissements: [0, 0], enAvants: [0, 0], rucks: [0, 0], grattages: [0, 0],
      melees: [0, 0], touches: [0, 0], possession: [0, 0], territoire: [0, 0], metres: [0, 0],
    },
    points: [],
    perso: new Array(2 * N).fill(null).map(() => ({ pts: 0, essais: 0, plaquages: 0, passes: 0, franchis: 0, metres: 0 })),
    vainqueur: -1,
  };
  for (let e = 0; e < 2; e++) {
    const eq = EQUIPE[equipes[e]];
    for (let i = 0; i < N; i++) {
      m.joueurs.push({
        id: e * N + i, e, i, n: notesJoueur(eq, i), vedette: !!eq.joueurs[i].vedette,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, dx: 1, dy: 0, etat: 'normal', t: 0, cible: -1,
        charge: 0, chargeCible: 0, visee: 0, viser: null, verrou: 0, lache: 0, surpris: 0, raffut: 0, frappe: 0, endu: 1,
        recu: 0, passeDe: -1, passeF: -1000, dec: 0, absent: false, ordre: null,
      });
    }
  }
  if (entrainement) {
    reglerEntrainement(m, entrainement);
    return m;
  }
  // Le tirage au sort : qui donne le coup d'envoi.
  m.premierEnvoi = hasard(m) < 0.5 ? 0 : 1;
  placerEnvoi(m, m.premierEnvoi, 0);
  return m;
}

/**
 * Change les réglages de l'entraînement en pleine partie (le menu pause) :
 * o : { nous: 1 à 7, eux: 0 à 7, immobiles, niveau (de l'ordinateur) }. L'action repart, le ballon pour nous.
 */
export function reglerEntrainement(m, o) {
  m.entrainement = { nous: clamp(o.nous | 0, 1, N), eux: clamp(o.eux | 0, 0, N), immobiles: !!o.immobiles };
  const n = [m.entrainement.nous, m.entrainement.eux];
  for (let e = 0; e < 2; e++) ORDRE_ENTREE[e].forEach((i, k) => { m.joueurs[e * N + i].absent = k >= n[e]; });
  m.equipes[1].immobile = m.entrainement.immobiles;
  if (o.niveau >= 0 && o.niveau <= 2) m.equipes[1].niveau = o.niveau;
  placerDepart(m);
}

/* ------------------------------------------------------------------ */
/* Les placements                                                      */
/* ------------------------------------------------------------------ */

function remettre(p, x, y, dx, dy = 0) {
  Object.assign(p, { x, y, z: 0, vx: 0, vy: 0, vz: 0, dx, dy, etat: 'normal', t: 0, cible: -1, charge: 0, chargeCible: 0, viser: null, verrou: 0, lache: 0, surpris: 0, raffut: 0, frappe: 0, dec: 0 });
}
function garer(m) {
  for (const p of m.joueurs) if (p.absent) remettre(p, -24 + p.id * 3.4, -(DEMI_W + 60), 1);
}
const disponibles = (m, e) => m.joueurs.filter((p) => p.e === e && !p.absent);
function premierDe(m, e, ordre) {
  for (const i of ordre) { const p = m.joueurs[e * N + i]; if (!p.absent) return p; }
  return disponibles(m, e)[0] || null;
}
function donner(m, p, o = {}) {
  Object.assign(m.ballon, nouveauBallon(), { x: p.x, y: p.y, z: 1, porteur: p.id, dernier: p.id }, o);
  p.recu = 0;
  m.poss = { e: p.e, f: m.f };
}
/** Le joueur dirigé par l'humain : celui qui a le ballon, sinon le plus proche du ballon. */
function recadrerActifs(m) {
  const b = m.ballon;
  for (let e = 0; e < 2; e++) {
    const eq = m.equipes[e];
    if (b.porteur >= 0 && m.joueurs[b.porteur].e === e) eq.actif = b.porteur;
    else if (b.cible >= 0 && m.joueurs[b.cible].e === e) eq.actif = b.cible;
    else { const p = plusProche(m, e, -1, b.x, b.y); if (p >= 0) eq.actif = p; }
  }
}

/**
 * Le coup d'envoi (ou le renvoi aux 22) de l'équipe e, depuis x0 (dans son camp) :
 * le botteur au milieu, ses coéquipiers alignés derrière lui, les adversaires dans leur camp.
 */
function placerEnvoi(m, e, x0) {
  const s = m.equipes[e].sens;
  const botteur = premierDe(m, e, [4, 3, 5, 6, 1, 0, 2]);
  const K = [[-1.5, -12], [-1.5, -6], [-1.5, 6], [-1.5, 12], [-3, -2], [-3, 3]];
  const R = [[11, -4], [11, 0], [11, 4], [14, -9], [16, 7], [19, -12], [24, 0]];
  let k = 0;
  for (const p of m.joueurs) {
    if (p.absent) continue;
    let X, Y;
    if (p.e === e) [X, Y] = p === botteur ? [-0.7, 0] : K[k++ % K.length];
    else [X, Y] = R[p.i];
    remettre(p, clamp(x0 + s * X, -MORT + 1, MORT - 1), Y, p.e === e ? s : -s);
  }
  garer(m);
  if (botteur) donner(m, botteur, { bloque: true, z: 0.3 });
  m.envoi = { e, x0 };
  m.ruck = m.melee = m.touche = m.marque = m.transfo = m.faute = null;
  recadrerActifs(m);
  m.phase = 'engagement';
  m.t = m.entrainement ? 30 : ENGAGEMENT;
}

/** L'entraînement : le ballon à notre premier joueur, dans notre camp ; les adversaires en défense ; les absents garés. */
function placerDepart(m) {
  const s = m.equipes[0].sens;
  const A = [[-8, 0], [-10, -5], [-10, 5], [-12, -10], [-12, 10], [-13, -14], [-13, 14]];
  const D = [[2, 0], [2, -6], [2, 6], [3, -11], [3, 11], [9, -3], [12, 3]];
  let ka = 0, kd = 0;
  const ordre = (e) => ORDRE_ENTREE[e].map((i) => m.joueurs[e * N + i]).filter((p) => !p.absent);
  for (const p of ordre(0)) { const [X, Y] = A[ka++]; remettre(p, s * X, Y, s); }
  for (const p of ordre(1)) { const [X, Y] = D[kd++]; remettre(p, s * X, Y, -s); }
  garer(m);
  const r = ordre(0)[0];
  donner(m, r);
  m.envoi = null;
  m.ruck = m.melee = m.touche = m.marque = m.transfo = m.faute = null;
  recadrerActifs(m);
  m.phase = 'engagement';
  m.t = 30;
}

/** La mêlée : les trois avants de chaque équipe liés, le ballon au demi de mêlée de l'équipe e (l'introduction). */
function placerMelee(m, x, y, e) {
  x = clamp(x, -(DEMI_L - 5), DEMI_L - 5);
  y = clamp(y, -(DEMI_W - 5), DEMI_W - 5);
  const s = m.equipes[e].sens;
  const ouvert = y <= 0 ? 1 : -1;
  const kb = [0, 0];
  for (const p of m.joueurs) {
    if (p.absent) continue;
    const se = p.e === e ? s : -s; // le sens de son équipe
    if (p.i <= 2) remettre(p, x - se * 0.72, y + (p.i - 1) * 0.72, se);
    else if (p.i === 3) remettre(p, x - se * (p.e === e ? 0.2 : -0.6), y - ouvert * 1.5, se, ouvert);
    else {
      const k = kb[p.e]++;
      remettre(p, clamp(x - se * (5.5 + k * 1.6), -MORT + 1, MORT - 1), clamp(y + ouvert * (4 + k * 4.5), -DEMI_W + 1, DEMI_W - 1), se);
    }
  }
  garer(m);
  const dm = premierDe(m, e, [3, 4, 5, 6, 1, 0, 2]);
  donner(m, dm, { bloque: true, z: 0.35 });
  m.melee = { x, y, e, t: MELEE, pousse: 0 };
  m.ruck = m.touche = m.faute = null;
  m.stats.melees[e] += 1;
  m.phase = 'melee';
  m.t = MELEE;
}

/** La touche : l'alignement perpendiculaire à la ligne, le lancer pour l'équipe e. */
function placerTouche(m, x, cote, e) {
  x = clamp(x, -(DEMI_L - 5), DEMI_L - 5);
  const s = m.equipes[e].sens;
  const Y = (d) => cote * (DEMI_W - d);
  const kb = [0, 0], ka = [0, 0];
  for (const p of m.joueurs) {
    if (p.absent) continue;
    const se = p.e === e ? s : -s;
    const recule = p.e === e ? -0.55 : 0.55;
    if (p.e === e && p.i === 1) remettre(p, x, cote * (DEMI_W + 0.4), 0, -cote);
    else if (p.i <= 2) { const k = ka[p.e]++; remettre(p, x + s * recule, Y(5 + k * 3), se); }
    else if (p.i === 3) remettre(p, x + s * recule * 2.5, Y(12), se);
    else { const k = kb[p.e]++; remettre(p, clamp(x - se * 10, -MORT + 1, MORT - 1), Y(13 + k * 3.5), se); }
  }
  garer(m);
  const lanceur = m.joueurs[e * N + 1].absent ? premierDe(m, e, [1, 0, 2, 3]) : m.joueurs[e * N + 1];
  donner(m, lanceur, { bloque: true, z: 2 });
  m.touche = { x, cote, e, t: TOUCHE, sauteur: -1, vol: false };
  m.ruck = m.melee = m.faute = null;
  m.stats.touches[e] += 1;
  m.phase = 'touche';
  m.t = TOUCHE;
}

/** La transformation : le buteur sur la ligne de l'essai, à 10-12 m ; les autres derrière lui, les défenseurs dans leur en-but. */
function placerTransfo(m) {
  const { e, y: ye } = m.marque;
  const s = m.equipes[e].sens;
  const by = clamp(ye, -14, 14);
  const bx = s * (DEMI_L - 10 - Math.abs(by) * 0.12);
  let buteur = null;
  for (const p of disponibles(m, e)) if (!buteur || p.n.pied > buteur.n.pied) buteur = p;
  const k = [0, 0];
  for (const p of m.joueurs) {
    if (p.absent) continue;
    if (p === buteur) { remettre(p, bx - s * 1.6, by, s); continue; }
    const n = k[p.e]++;
    if (p.e === e) remettre(p, bx - s * (7 + (n % 2) * 1.5), clamp(by + (n - 2.5) * 2.2, -DEMI_W + 1, DEMI_W - 1), s);
    else remettre(p, s * (DEMI_L + 1.2), (n - 3) * 2.4, -s);
  }
  garer(m);
  Object.assign(m.ballon, nouveauBallon(), { x: bx, y: by, z: BALLE_R + 0.1, porteur: -1, dernier: buteur.id, bloque: true });
  m.transfo = { e, j: buteur.id, bx, by, vise: 0, charge: 0, parti: false, fini: false, t: 0, reussi: false };
  m.equipes[e].actif = buteur.id;
  m.phase = 'transfo';
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
      for (const p of m.joueurs) if (!p.absent) deplacer(m, p, RIEN);
      physiqueBallon(m, evs);
      if (--m.t <= 0) {
        m.phase = 'jeu';
        if (m.envoi) coupEnvoi(m, evs);
        evs.push({ type: 'sifflet', n: 1 });
      }
      break;
    case 'jeu':
    case 'ruck':
      jouer(m, k, ap, rel, evs);
      break;
    case 'melee':
      melee(m, evs);
      break;
    case 'touche':
      touche(m, evs);
      break;
    case 'marque':
      // La joie (ou la déception) : les joueurs ralentissent, le ballon finit de rouler.
      for (const p of m.joueurs) if (!p.absent) deplacer(m, p, RIEN);
      physiqueBallon(m, evs, false);
      if (--m.t <= 0) {
        const mq = m.marque;
        if (mq.type === 'essai' && !m.enOr) placerTransfo(m);
        else if (m.enOr) finir(m, evs);
        else if (m.entrainement) placerDepart(m);
        else if (m.sirene) finPeriode(m, evs);
        else { placerEnvoi(m, mq.e, 0); evs.push({ type: 'renvoi', equipe: mq.e }); }
      }
      break;
    case 'transfo':
      transformation(m, k, ap, rel, evs);
      break;
    case 'pause':
      if (--m.t <= 0) {
        if (m.periode === 1) {
          m.periode = 2;
          m.chrono = 0;
          m.sirene = false; m.apresSirene = 0;
          for (const eq of m.equipes) eq.sens = -eq.sens;
          placerEnvoi(m, 1 - m.premierEnvoi, 0);
          evs.push({ type: 'reprise' });
        } else {
          m.enOr = true;
          m.chrono = 0;
          m.territoireOr = [...m.stats.territoire];
          m.periode = 3;
          m.sirene = false;
          placerEnvoi(m, hasard(m) < 0.5 ? 0 : 1, 0);
          evs.push({ type: 'enor' });
        }
      }
      break;
    default:
  }
  return evs;
}

/** Un arrêt de jeu : après la sirène, c'est la fin de la mi-temps ; sinon, f() relance le jeu. */
function arret(m, evs, f) {
  if (m.sirene && !m.enOr && !m.entrainement) { finPeriode(m, evs); return; }
  if (m.entrainement) { placerDepart(m); return; }
  f();
}

function jouer(m, k, ap, rel, evs) {
  const b = m.ballon;
  for (const p of m.joueurs) {
    if (p.verrou > 0) p.verrou -= 1;
    if (p.lache > 0) p.lache -= 1;
    if (p.surpris > 0) p.surpris -= 1;
    if (p.raffut > 0) p.raffut -= 1;
    if (p.dec > 0) p.dec -= 1;
    if (b.porteur === p.id) p.recu += 1;
  }
  const cons = new Array(2 * N).fill(null);
  for (let e = 0; e < 2; e++) if (m.equipes[e].ctrl === 'humain') humain(m, e, k[e], ap[e], rel[e], cons, evs);
  for (let e = 0; e < 2; e++) decider(m, e, cons);
  for (let i = 0; i < 2 * N; i++) {
    const c = cons[i];
    if (c && c.action) agir(m, m.joueurs[i], c.action, evs);
    if (m.phase !== 'jeu' && m.phase !== 'ruck') return;
  }
  // Le coup de pied en préparation : la force monte, et il part tout seul s'il a trop attendu.
  for (const p of m.joueurs) {
    if (p.etat !== 'pied' || b.porteur !== p.id) continue;
    p.charge += 1;
    if ((p.chargeCible && p.charge >= p.chargeCible) || p.charge >= CHARGE_MAX) taper(m, p, evs, p.viser || { dy: p.visee });
  }
  const x0 = b.porteur >= 0 ? b.x : null, e0 = b.porteur >= 0 ? m.joueurs[b.porteur].e : -1;
  for (const p of m.joueurs) if (!p.absent) deplacer(m, p, cons[p.id] || RIEN, evs);
  if (m.phase !== 'jeu' && m.phase !== 'ruck') return;
  separer(m);
  if (m.phase === 'ruck') horsJeu(m);
  physiqueBallon(m, evs, true);
  if (m.phase === 'ruck') {
    if (--m.ruck.t <= 0) finRuck(m, evs);
  } else if (m.phase === 'jeu') {
    attraper(m, evs);
    if (m.phase === 'jeu') verifier(m, evs);
  }
  if (m.phase !== 'jeu' && m.phase !== 'ruck') return;
  // Les mètres gagnés ballon en main.
  if (b.porteur >= 0 && x0 !== null && m.joueurs[b.porteur].e === e0) {
    const gain = m.equipes[e0].sens * (b.x - x0);
    if (gain > 0) { m.stats.metres[e0] += gain; m.perso[b.porteur].metres += gain; }
  }
  if (b.porteur >= 0) m.stats.possession[m.joueurs[b.porteur].e] += 1;
  for (let e = 0; e < 2; e++) if (m.equipes[e].sens * b.x > 0) m.stats.territoire[e] += 1;
  if (m.entrainement) return;
  if (m.enOr) {
    if (++m.chrono >= OR_MAX) {
      const t = [0, 1].map((e) => m.stats.territoire[e] - (m.territoireOr?.[e] || 0));
      finir(m, evs, t[0] >= t[1] ? 0 : 1);
    }
    return;
  }
  if (!m.sirene) {
    m.chrono += 1;
    if (m.chrono >= m.duree) { m.sirene = true; evs.push({ type: 'sirene' }); }
  } else if (++m.apresSirene > APRES_SIRENE) finPeriode(m, evs);
}

/** Les fautes, l'essai, la touche, le ballon mort. */
function verifier(m, evs) {
  const b = m.ballon;
  // Une faute en attente (en-avant, passe en avant) : on siffle quand le ballon touche le sol ou une main.
  if (m.faute) {
    const fa = m.faute;
    if (b.porteur >= 0 || b.z <= BALLE_R + 0.02 || m.f - fa.f > 50 || Math.abs(b.y) > DEMI_W || Math.abs(b.x) > MORT) {
      m.faute = null;
      evs.push({ type: 'sifflet', n: 2 });
      arret(m, evs, () => { placerMelee(m, fa.x, fa.y, fa.e); evs.push({ type: 'melee', equipe: fa.e }); });
      return;
    }
  }
  if (b.porteur >= 0) {
    const p = m.joueurs[b.porteur];
    const s = m.equipes[p.e].sens;
    if (s * p.x > DEMI_L + 0.35 && Math.abs(p.y) < DEMI_W) { marquerEssai(m, p, evs); return; }
    if (Math.abs(p.y) > DEMI_W) {
      // Le porteur a mis le pied en touche : le lancer pour l'adversaire.
      evs.push({ type: 'touche', equipe: 1 - p.e, x: p.x, cote: Math.sign(p.y) });
      arret(m, evs, () => placerTouche(m, p.x, Math.sign(p.y), 1 - p.e));
      return;
    }
    if (s * p.x < -MORT) {
      evs.push({ type: 'mort' });
      arret(m, evs, () => { placerMelee(m, -s * (DEMI_L - 5), p.y, 1 - p.e); evs.push({ type: 'melee', equipe: 1 - p.e }); });
    }
    return;
  }
  if (b.ruck || b.bloque) return;
  const der = b.dernier >= 0 ? m.joueurs[b.dernier].e : 0;
  const dansEnBut = Math.abs(b.x) > DEMI_L;
  if (Math.abs(b.y) > DEMI_W && !dansEnBut) {
    evs.push({ type: 'touche', equipe: 1 - der, x: b.x, cote: Math.sign(b.y) });
    arret(m, evs, () => placerTouche(m, b.x, Math.sign(b.y), 1 - der));
    return;
  }
  if (Math.abs(b.x) > MORT || (dansEnBut && Math.abs(b.y) > DEMI_W)) {
    // Ballon mort : l'en-but de l'équipe d qui le défend.
    const cote = Math.sign(b.x);
    const d = m.equipes[0].sens === cote ? 1 : 0; // l'équipe qui défend cet en-but
    evs.push({ type: 'mort' });
    arret(m, evs, () => {
      if (der !== d) { placerEnvoi(m, d, -m.equipes[d].sens * (DEMI_L - LIGNE_22)); evs.push({ type: 'renvoi', equipe: d, vingtDeux: true }); }
      else { placerMelee(m, cote * (DEMI_L - 5), b.y, 1 - d); evs.push({ type: 'melee', equipe: 1 - d }); }
    });
  }
}

function finPeriode(m, evs) {
  m.ruck = m.melee = m.touche = m.transfo = m.faute = null;
  Object.assign(m.ballon, { porteur: -1, cible: -1, bloque: false, ruck: false, vx: 0, vy: 0, vz: 0 });
  for (const p of m.joueurs) if (p.etat !== 'normal' && p.etat !== 'sol') { p.etat = 'normal'; p.charge = 0; }
  evs.push({ type: 'sifflet', n: 3 });
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

function finir(m, evs, auTerrain = -1) {
  m.phase = 'fin';
  m.vainqueur = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : auTerrain;
  if (auTerrain >= 0 && m.score[0] === m.score[1]) m.auTerrain = true;
  evs.push({ type: 'fin', vainqueur: m.vainqueur });
}

/* ------------------------------------------------------------------ */
/* L'humain                                                            */
/* ------------------------------------------------------------------ */

/** Le joueur de l'équipe e le plus proche du point (x, y) (sauf `sauf`). */
function plusProche(m, e, sauf, x, y) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < N; i++) {
    const p = m.joueurs[e * N + i];
    if (p.id === sauf || p.absent) continue;
    const d = dist(p.x, p.y, x, y) + (p.etat === 'sol' ? 4 : 0);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

/**
 * Le coéquipier qu'on vise en passant : derrière le porteur (ou à sa hauteur),
 * du côté où l'on pousse le stick (dy > 0 : vers le fond ; dy < 0 : vers soi),
 * sinon le mieux placé. sautee : on saute le premier receveur.
 */
export function choisirReceveur(m, p, dy, sautee = false) {
  const s = m.equipes[p.e].sens;
  const cands = [];
  for (let i = 0; i < N; i++) {
    const r = m.joueurs[p.e * N + i];
    if (r === p || r.absent || r.etat === 'sol' || r.etat === 'plonge') continue;
    const av = s * (r.x - p.x);
    if (av > 0.6) continue;
    const lat = r.y - p.y;
    cands.push({ r, lat, d: dist(r.x, r.y, p.x, p.y), av });
  }
  if (!cands.length) {
    // Personne derrière : la passe ira vers l'avant (faute !) au plus proche.
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) { const r = m.joueurs[p.e * N + i]; if (r === p || r.absent) continue; const d = dist(r.x, r.y, p.x, p.y); if (d < bd) { bd = d; best = r.id; } }
    return best;
  }
  let cote = dy > 0.2 ? 1 : dy < -0.2 ? -1 : 0;
  if (!cote) {
    // Le côté où il y a le plus de place et de monde.
    const g = cands.filter((c) => c.lat < 0).length, d = cands.filter((c) => c.lat > 0).length;
    cote = d > g ? 1 : g > d ? -1 : p.y < 0 ? 1 : -1;
  }
  let liste = cands.filter((c) => c.lat * cote > 0.3 && c.d < 22).sort((a, b) => Math.abs(a.lat) - Math.abs(b.lat));
  if (!liste.length) liste = cands.filter((c) => c.d < 22).sort((a, b) => a.d - b.d);
  if (!liste.length) liste = cands.sort((a, b) => a.d - b.d);
  return (sautee && liste[1] ? liste[1] : liste[0]).r.id;
}

function humain(m, e, k, ap, rel, cons, evs) {
  const eq = m.equipes[e], b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const aLaBalle = porteur && porteur.e === e;
  if (aLaBalle) eq.actif = porteur.id;
  else if (!porteur && b.cible >= 0 && m.joueurs[b.cible].e === e) eq.actif = b.cible;
  if (!aLaBalle && (ap & T.G)) {
    const autre = plusProche(m, e, eq.actif, b.x, b.y);
    if (autre >= 0) eq.actif = autre;
    evs.push({ type: 'change', joueur: eq.actif });
  }
  const p = m.joueurs[eq.actif];
  if (!p || p.absent) return;
  let mx = (k & T.d ? 1 : 0) - (k & T.g ? 1 : 0);
  let my = (k & T.h ? 1 : 0) - (k & T.b ? 1 : 0);
  if (mx && my) { mx *= 0.7071; my *= 0.7071; }
  const c = { mx, my, sprint: !!(k & T.S), action: null };
  if (porteur === p) {
    if (b.bloque) { c.mx = 0; c.my = 0; }
    else if (p.etat === 'pied') {
      p.visee = my;
      if (rel & T.B) c.action = { type: 'taper', dy: my };
    } else if (p.etat === 'normal') {
      if (ap & T.B) c.action = { type: 'armer' };
      else if (ap & (T.A | T.R)) c.action = { type: 'passe', cible: choisirReceveur(m, p, my, !!(ap & T.R)) };
      else if (ap & T.X) c.action = { type: 'raffut' };
    }
  } else if (ap & T.B) c.action = { type: 'plaquer' };
  else if (ap & (T.X | T.A)) c.action = { type: 'gratter' };
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
      if (aLaBalle && a.cible >= 0 && p.etat === 'normal' && !b.bloque) passer(m, p, m.joueurs[a.cible], evs);
      break;
    case 'armer':
      if (!aLaBalle || p.etat !== 'normal' || b.bloque) break;
      p.etat = 'pied';
      p.charge = 0;
      p.chargeCible = a.cible || 0;
      p.visee = a.dy || 0;
      p.viser = a.viser || null;
      evs.push({ type: 'arme', joueur: p.id });
      break;
    case 'taper':
      if (aLaBalle && p.etat === 'pied') taper(m, p, evs, a.viser || { dy: a.dy });
      break;
    case 'raffut':
      if (aLaBalle && p.etat === 'normal' && p.raffut <= 0 && p.verrou <= 0) raffut(m, p, evs);
      break;
    case 'plaquer':
      if (!aLaBalle && p.etat === 'normal' && p.verrou <= 0 && !m.equipes[p.e].immobile) plonger(m, p, evs);
      break;
    case 'gratter':
      if (m.phase === 'ruck' && p.verrou <= 0 && p.etat === 'normal' && p.e !== m.ruck.e && dist(p.x, p.y, m.ruck.x, m.ruck.y) < 2.8 && !m.equipes[p.e].immobile) {
        m.ruck.gratte[p.e] += 1;
        p.verrou = 30;
        evs.push({ type: 'gratte', joueur: p.id });
      }
      break;
    default:
  }
}

/** La passe : vers le receveur (là où il sera) ; vers l'avant, c'est une faute. */
function passer(m, p, r, evs, depuis = null) {
  const b = m.ballon;
  const s = m.equipes[p.e].sens;
  const vit = 14 + p.n.passe * 0.06;
  const ox = depuis ? depuis.x : p.x + p.dx * 0.25, oy = depuis ? depuis.y : p.y + p.dy * 0.25;
  // On vise là où sera le receveur (deux fois, pour que l'avance tienne compte du temps de vol).
  let tx = r.x, ty = r.y, Tv = 0.3;
  for (let k = 0; k < 2; k++) {
    Tv = Math.max(0.16, dist(ox, oy, tx, ty) / vit);
    tx = r.x + r.vx * Tv * 0.9; ty = r.y + r.vy * Tv * 0.9;
  }
  const err = (0.06 + Tv * 0.25) * (1.5 - p.n.passe / 100) * (p.surpris > 0 ? 1.6 : 1);
  tx += gauss(m) * err; ty += gauss(m) * err;
  const z0 = depuis ? 0.4 : 1.1, z1 = 1.15;
  Object.assign(b, {
    x: ox, y: oy, z: z0, porteur: -1, dernier: p.id, passeur: depuis ? -1 : p.id, cible: r.id, essais: 0, pied: null, bloque: false, ruck: false,
    vx: (tx - ox) / Tv, vy: (ty - oy) / Tv, vz: (z1 - z0 + 0.5 * G * Tv * Tv) / Tv,
  });
  if (depuis) return;
  p.lache = 12;
  m.stats.passes[p.e] += 1;
  const avant = s * b.vx > 1.2;
  evs.push({ type: 'passe', joueur: p.id, cible: r.id, avant });
  if (avant && !m.faute) {
    m.faute = { type: 'passe', x: p.x, y: p.y, e: 1 - p.e, f: m.f };
    m.stats.enAvants[p.e] += 1;
    evs.push({ type: 'passe-avant', joueur: p.id });
  }
}

/**
 * Le coup de pied à suivre (un drop, en fait) : la force vient de la charge.
 * v : { dy (la direction : -1 à 1) } ou une cible précise { tx, ty, z1, pente } (l'ordinateur).
 */
function taper(m, p, evs, v = {}) {
  const b = m.ballon;
  const s = m.equipes[p.e].sens;
  const u = clamp(p.charge / CHARGE_MAX, 0.12, 1);
  const x0 = p.x + s * 0.35, y0 = p.y, z0 = 0.45;
  const prec = 1.45 - p.n.pied / 100;
  let tx, ty, z1, pente;
  if (v.tx !== undefined) {
    ({ tx, ty } = v);
    const d = dist(x0, y0, tx, ty);
    tx += gauss(m) * d * 0.035 * prec; ty += gauss(m) * d * 0.035 * prec;
    z1 = v.z1 ?? BALLE_R; pente = v.pente ?? 0.9;
  } else {
    const D = (9 + 41 * u) * (0.72 + p.n.pied / 360);
    let ux = s, uy = clamp(v.dy || 0, -1, 1) * 0.6;
    const l = Math.sqrt(ux * ux + uy * uy);
    ux /= l; uy /= l;
    tx = x0 + ux * D + gauss(m) * D * 0.05 * prec;
    ty = y0 + uy * D + gauss(m) * D * 0.05 * prec;
    z1 = BALLE_R; pente = 0.95;
  }
  const d = dist(x0, y0, tx, ty);
  pente = Math.max(pente, (z1 - z0) / (d || 1) + 0.3);
  const w = vitessePied(x0, y0, z0, tx, ty, z1, pente);
  Object.assign(b, { x: x0, y: y0, z: z0, vx: w.vx, vy: w.vy, vz: w.vz, porteur: -1, dernier: p.id, passeur: -1, cible: -1, essais: 0, bloque: false, ruck: false, pied: { e: p.e, j: p.id, drop: true, sol: false } });
  p.etat = 'normal';
  p.charge = 0; p.chargeCible = 0; p.viser = null;
  p.frappe = 16;
  p.lache = 24;
  m.stats.pieds[p.e] += 1;
  evs.push({ type: 'pied', joueur: p.id, force: u });
}

/** Le coup d'envoi : haut, dans le camp adverse, pour que les deux équipes se le disputent. */
function coupEnvoi(m, evs) {
  const b = m.ballon;
  const { e, x0 } = m.envoi;
  m.envoi = null;
  const p = m.joueurs[b.porteur];
  if (!p) return;
  const s = m.equipes[e].sens;
  const tx = x0 + s * (11 + hasard(m) * 7), ty = clamp((hasard(m) - 0.5) * 24, -14, 14);
  const w = vitessePied(p.x + s * 0.4, p.y, 0.3, tx, ty, BALLE_R, 1.35);
  Object.assign(b, { x: p.x + s * 0.4, z: 0.3, vx: w.vx, vy: w.vy, vz: w.vz, porteur: -1, dernier: p.id, cible: -1, bloque: false, pied: { e, j: p.id, drop: false, sol: false, envoi: true } });
  p.frappe = 16;
  p.lache = 30;
  evs.push({ type: 'envoi', joueur: p.id, equipe: e });
}

/** Le raffut : le porteur repousse d'une main le défenseur qui arrive. */
function raffut(m, p, evs) {
  p.raffut = 24;
  p.verrou = 70;
  let o = null, od = 1.6;
  for (let i = 0; i < N; i++) {
    const q = m.joueurs[(1 - p.e) * N + i];
    if (q.absent || q.etat === 'sol') continue;
    const d = dist(q.x, q.y, p.x, p.y);
    if (d < od) { od = d; o = q; }
  }
  let reussi = false;
  if (o && hasard(m) < clamp(0.4 + (p.n.force - o.n.defense) / 110, 0.1, 0.8)) {
    reussi = true;
    o.etat = 'sol'; o.t = 32; o.cible = -1;
    o.vx = (o.x - p.x) * 2; o.vy = (o.y - p.y) * 2;
  }
  evs.push({ type: 'raffut', joueur: p.id, reussi, sur: o ? o.id : -1 });
}

/** Le plongeon du plaqueur, vers là où sera le porteur. */
function plonger(m, p, evs) {
  const b = m.ballon;
  const c = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  if (!c || c.e === p.e || b.bloque) return;
  const d = dist(p.x, p.y, c.x, c.y);
  if (d > PORTEE_PLAQUAGE * 1.6) return;
  const vit = vitesseMax(p) * 1.45;
  const lead = Math.min(0.35, d / vit);
  const tx = c.x + c.vx * lead * 0.8, ty = c.y + c.vy * lead * 0.8;
  const dx = tx - p.x, dy = ty - p.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
  p.etat = 'plonge';
  p.t = 18;
  p.cible = c.id;
  p.vx = (dx / l) * vit; p.vy = (dy / l) * vit;
  p.dx = dx / l; p.dy = dy / l;
  p.verrou = 30;
  evs.push({ type: 'plonge', joueur: p.id });
  if (d < 1) resoudrePlaquage(m, p, c, evs);
}

/** Le contact : plaqué (ruck), ou le porteur passe. */
function resoudrePlaquage(m, p, c, evs) {
  const s = m.equipes[c.e].sens;
  const eqp = m.equipes[p.e];
  // De face ou de dos ? (de dos, c'est plus facile)
  const deDos = (p.x - c.x) * c.dx + (p.y - c.y) * c.dy < 0;
  let chance = 0.7 + (p.n.defense - c.n.force) * 0.0085 + (deDos ? 0.08 : 0) - (c.surpris > 0 ? -0.1 : 0);
  if (c.raffut > 0) chance -= 0.26 * (c.n.force / 85);
  if (eqp.ctrl === 'humain' && eqp.actif === p.id) chance += 0.12;
  else if (eqp.ctrl === 'ia') chance += niveauDe(eqp).plaquage;
  const eqc = m.equipes[c.e];
  if (eqc.ctrl === 'ia') chance -= niveauDe(eqc).percussion;
  chance = clamp(chance, 0.15, 0.93);
  if (hasard(m) < chance) {
    m.stats.plaquages[p.e] += 1;
    m.perso[p.id].plaquages += 1;
    c.etat = 'sol'; c.t = 58; c.charge = 0; c.vx *= 0.3; c.vy *= 0.3;
    p.etat = 'sol'; p.t = 42; p.cible = -1; p.vx *= 0.3; p.vy *= 0.3;
    evs.push({ type: 'plaquage', joueur: p.id, victime: c.id });
    // Plaqué sur la ligne : l'essai est quand même aplati.
    if (s * c.x > DEMI_L - 0.7 && Math.abs(c.y) < DEMI_W) { marquerEssai(m, c, evs); return; }
    // Plaqué dans son propre en-but : mêlée à 5 m pour l'adversaire.
    if (s * c.x < -DEMI_L) {
      evs.push({ type: 'sifflet', n: 2 });
      arret(m, evs, () => { placerMelee(m, -s * (DEMI_L - 5), c.y, p.e); evs.push({ type: 'melee', equipe: p.e }); });
      return;
    }
    debutRuck(m, c, evs);
  } else {
    m.stats.plaquagesRates[p.e] += 1;
    m.perso[c.id].franchis += 1;
    p.etat = 'sol'; p.t = 46; p.cible = -1; p.vx *= 0.4; p.vy *= 0.4;
    c.surpris = 6;
    // Un franchissement : plus aucun défenseur debout devant lui.
    const devant = m.joueurs.some((o) => o.e !== c.e && !o.absent && o.etat !== 'sol' && s * (o.x - c.x) > 0);
    if (!devant) m.stats.franchissements[c.e] += 1;
    evs.push({ type: 'plaquage-rate', joueur: p.id, porteur: c.id, franchi: !devant });
  }
}

/* ------------------------------------------------------------------ */
/* Le ruck, la mêlée, la touche                                        */
/* ------------------------------------------------------------------ */

function debutRuck(m, c, evs) {
  const s = m.equipes[c.e].sens;
  const b = m.ballon;
  const rx = c.x - s * 0.7, ry = c.y;
  Object.assign(b, { x: rx, y: ry, z: BALLE_R, vx: 0, vy: 0, vz: 0, porteur: -1, cible: -1, passeur: -1, pied: null, ruck: true, bloque: false });
  m.ruck = { x: rx, y: ry, e: c.e, t: RUCK, gratte: [0, 0], plaque: c.id };
  m.phase = 'ruck';
  evs.push({ type: 'ruck', equipe: c.e, x: rx, y: ry });
}

/** Pendant un ruck, on joue derrière le ballon (la ligne de hors-jeu) : les autres reculent. */
function horsJeu(m) {
  const r = m.ruck;
  const s = m.equipes[r.e].sens;
  for (const p of m.joueurs) {
    if (p.absent || dist(p.x, p.y, r.x, r.y) < 1.8) continue;
    const se = p.e === r.e ? s : -s;
    const ecart = se * (p.x - r.x); // > 0 : du côté adverse du ballon (hors-jeu)
    if (ecart > -2.2) p.x -= se * Math.min(0.12, ecart + 2.2);
  }
}

function finRuck(m, evs) {
  const r = m.ruck;
  const e = r.e, o = 1 - e;
  const plaque = m.joueurs[r.plaque];
  let best = null, nA = 0, nD = 0;
  for (const p of m.joueurs) {
    if (p.absent || p.etat !== 'normal' || dist(p.x, p.y, r.x, r.y) > 2.7) continue;
    if (p.e === e) nA += 1;
    else { nD += 1; if (!best || p.n.defense > best.n.defense) best = p; }
  }
  let gagne = e;
  if (best && !m.equipes[o].immobile) {
    const eqo = m.equipes[o];
    let chance = 0.07 + (best.n.defense - plaque.n.force) / 260 + 0.1 * Math.min(2, r.gratte[o]) - 0.05 * nA + 0.04 * (nD - 1) + (STYLES[eqo.style].gratte - 1) * 0.12;
    if (eqo.ctrl === 'ia') chance += niveauDe(eqo).gratte;
    if (hasard(m) < clamp(chance, 0.02, 0.5)) gagne = o;
  }
  m.stats.rucks[gagne] += 1;
  if (gagne === o) { m.stats.grattages[o] += 1; evs.push({ type: 'grattage', equipe: o, joueur: best.id }); }
  // Le ballon sort vers le joueur de l'équipe gagnante le mieux placé derrière le ruck.
  const sg = m.equipes[gagne].sens;
  const ox = r.x - sg * 1.2;
  let rec = null, rd = 1e9;
  for (const p of disponibles(m, gagne)) {
    const d = dist(p.x, p.y, ox, r.y) + (p.etat !== 'normal' ? 6 : 0) + (p.i === 3 ? -1.5 : 0);
    if (d < rd) { rd = d; rec = p; }
  }
  // Ceux qui étaient dans le ruck se relèvent : il leur faut un instant avant de repartir.
  for (const p of m.joueurs) {
    if (p.absent || p.e === gagne || dist(p.x, p.y, r.x, r.y) > 3) continue;
    p.verrou = Math.max(p.verrou, 40); p.surpris = Math.max(p.surpris, 16);
  }
  m.ruck = null;
  m.phase = 'jeu';
  m.ballon.ruck = false;
  if (rec.etat !== 'normal') { rec.etat = 'normal'; rec.t = 0; }
  if (dist(rec.x, rec.y, r.x, r.y) < 1.3) donner(m, rec);
  else {
    passer(m, rec, rec, evs, { x: r.x, y: r.y });
    m.ballon.dernier = rec.id;
    m.poss = { e: gagne, f: m.f };
  }
  recadrerActifs(m);
  evs.push({ type: 'sortie', equipe: gagne, joueur: rec.id });
}

/** La mêlée : les packs poussent ; l'équipe qui introduit la gagne le plus souvent. */
function melee(m, evs) {
  const ml = m.melee;
  const e = ml.e, o = 1 - e;
  const s = m.equipes[e].sens;
  const force = (k) => m.joueurs.filter((p) => p.e === k && p.i <= 2 && !p.absent).reduce((t, p) => t + p.n.force, 0);
  const fe = force(e), fo = force(o);
  if (ml.t === MELEE) evs.push({ type: 'liaison', equipe: e });
  ml.t -= 1;
  // La poussée (pour le spectacle) : le pack le plus fort avance un peu.
  if (ml.t < MELEE - 40) {
    const v = clamp((fe - fo) / 900, -0.012, 0.012);
    ml.pousse += v;
    for (const p of m.joueurs) if (p.i <= 2 && !p.absent) p.x += s * v;
  }
  for (const p of m.joueurs) if (!p.absent) deplacer(m, p, RIEN);
  physiqueBallon(m, evs);
  if (ml.t > 0) return;
  let chance = 0.86 + (fe - fo) / 280;
  if (m.equipes[o].ctrl === 'ia') chance -= niveauDe(m.equipes[o]).gratte * 0.5;
  const gagne = hasard(m) < clamp(chance, 0.6, 0.97) ? e : o;
  const dm = premierDe(m, gagne, [3, 4, 5, 6, 1, 0, 2]);
  m.melee = null;
  m.phase = 'jeu';
  donner(m, dm);
  m.ballon.z = 0.4;
  recadrerActifs(m);
  evs.push({ type: 'melee-gagnee', equipe: gagne, contre: gagne !== e });
}

/** La touche : le lancer, le sauteur soulevé, le ballon pris (ou volé). */
function touche(m, evs) {
  const tc = m.touche;
  const e = tc.e, o = 1 - e;
  const b = m.ballon;
  tc.t -= 1;
  if (tc.t === 34) {
    // Le lancer : vers un sauteur de l'équipe (le premier ou le dernier de l'alignement).
    const sauteurs = m.joueurs.filter((p) => p.e === e && p.i !== 1 && p.i <= 2 && !p.absent);
    const s1 = sauteurs.length ? sauteurs[hasard(m) < 0.5 ? 0 : sauteurs.length - 1] : premierDe(m, e, [0, 2, 3, 4]);
    const ff = (k) => m.joueurs.filter((p) => p.e === k && p.i <= 2 && !p.absent).reduce((t, p) => t + p.n.force, 0);
    let vol = 0.15 + (ff(o) - ff(e)) / 400;
    if (m.equipes[o].ctrl === 'ia') vol += niveauDe(m.equipes[o]).gratte * 0.4;
    tc.vol = hasard(m) < clamp(vol, 0.05, 0.3);
    let sauteur = s1;
    if (tc.vol) {
      let bd = 1e9;
      for (const p of m.joueurs) if (p.e === o && p.i <= 2 && !p.absent) { const d = Math.abs(p.y - s1.y); if (d < bd) { bd = d; sauteur = p; } }
    }
    tc.sauteur = sauteur.id;
    const Tv = 34 / FPS;
    const lanceur = m.joueurs[b.porteur];
    Object.assign(b, { porteur: -1, bloque: true, lancer: true, x: lanceur.x, y: lanceur.y, z: 2.1, vx: (s1.x - lanceur.x) / Tv, vy: (s1.y - lanceur.y) / Tv, vz: (3.1 - 2.1 + 0.5 * G * Tv * Tv) / Tv, dernier: lanceur.id });
    evs.push({ type: 'lancer', joueur: lanceur.id });
  }
  // Le sauteur : soulevé par ses coéquipiers (une parabole, pas de sinus).
  if (tc.sauteur >= 0) {
    const p = m.joueurs[tc.sauteur];
    const u = clamp((34 - tc.t) / 34, 0, 1);
    p.z = 4 * 0.95 * u * (1 - u * 0.5);
  }
  for (const p of m.joueurs) if (!p.absent && p.id !== tc.sauteur) deplacer(m, p, RIEN);
  if (b.porteur < 0) {
    b.x += b.vx * DT; b.y += b.vy * DT; b.z += b.vz * DT - 0.5 * G * DT * DT; b.vz -= G * DT;
  } else physiqueBallon(m, evs);
  if (tc.t > 0) return;
  const p = m.joueurs[tc.sauteur];
  p.z = 0;
  m.touche = null;
  m.phase = 'jeu';
  donner(m, p);
  recadrerActifs(m);
  evs.push({ type: 'touche-gagnee', equipe: p.e, joueur: p.id, vol: p.e !== e });
}

/* ------------------------------------------------------------------ */
/* L'essai, la transformation, le drop                                 */
/* ------------------------------------------------------------------ */

function marquerEssai(m, p, evs) {
  const e = p.e;
  const passeur = m.f - p.passeF < 300 ? p.passeDe : -1;
  m.score[e] += 5;
  m.stats.essais[e] += 1;
  m.perso[p.id].pts += 5;
  m.perso[p.id].essais += 1;
  if (passeur >= 0) m.perso[passeur].passes += 1;
  m.points.push({ e, j: p.id, type: 'essai', pts: 5, passeur, periode: m.periode, chrono: m.chrono, enOr: m.enOr });
  const s = m.equipes[e].sens;
  const b = m.ballon;
  Object.assign(b, { porteur: -1, cible: -1, x: clamp(p.x, s > 0 ? DEMI_L + 0.3 : -MORT, s > 0 ? MORT : -DEMI_L - 0.3), y: p.y, z: BALLE_R, vx: p.vx * 0.3, vy: p.vy * 0.3, vz: 0, ruck: false, pied: null });
  p.etat = 'sol'; p.t = 40;
  m.ruck = m.faute = null;
  m.marque = { type: 'essai', e, j: p.id, x: p.x, y: p.y };
  m.phase = 'marque';
  m.t = m.entrainement ? 70 : APRES_ESSAI;
  evs.push({ type: 'essai', equipe: e, joueur: p.id, passeur, x: p.x, y: p.y, enOr: m.enOr });
}

/** La transformation : l'humain vise (haut, bas) et tient B pour la force ; l'ordinateur prend son temps. */
function transformation(m, k, ap, rel, evs) {
  const tr = m.transfo;
  const eq = m.equipes[tr.e];
  const p = m.joueurs[tr.j];
  tr.t += 1;
  for (const q of m.joueurs) {
    if (q.absent) continue;
    if (q.frappe > 0) q.frappe -= 1;
    // Le buteur prend son élan quand il tape.
    if (q === p && tr.parti && tr.t - tr.tFrappe < 20) { q.x += eq.sens * 0.05; continue; }
    q.vx *= 0.8; q.vy *= 0.8;
    if (q.etat === 'sol' && --q.t <= 0) q.etat = 'normal';
  }
  if (!tr.parti) {
    // Le buteur regarde les poteaux.
    const ex = eq.sens * DEMI_L - p.x, ey = tr.vise - p.y, l = Math.sqrt(ex * ex + ey * ey) || 1;
    p.dx = ex / l; p.dy = ey / l;
    if (eq.ctrl === 'humain') {
      const e = tr.e;
      const my = (k[e] & T.h ? 1 : 0) - (k[e] & T.b ? 1 : 0);
      if (tr.charge === 0) tr.vise = clamp(tr.vise + my * 0.06, -7, 7);
      if (k[e] & T.B) { tr.charge += 1; p.etat = 'pied'; p.charge = tr.charge; }
      if ((rel[e] & T.B && tr.charge > 0) || tr.charge >= CHARGE_MAX || tr.t > TRANSFO_MAX) frapperTransfo(m, tr.charge ? tr.charge / CHARGE_MAX : FORCE_IDEALE, evs);
    } else if (tr.t >= TRANSFO_IA) {
      const niv = niveauDe(eq);
      frapperTransfo(m, clamp(FORCE_IDEALE + gauss(m) * 0.06 * niv.pied, 0.2, 1), evs);
    } else if (tr.t > TRANSFO_IA - 30) { p.etat = 'pied'; p.charge = (tr.t - TRANSFO_IA + 30) * 1.1; }
    return;
  }
  physiqueBallon(m, evs, true);
  if (!tr.fini && (m.ballon.z <= BALLE_R + 0.01 || eq.sens * m.ballon.x > MORT + 5)) {
    tr.fini = true; tr.tFin = tr.t;
    evs.push({ type: 'transfo', equipe: tr.e, joueur: tr.j, reussi: false });
  }
  if (tr.fini && tr.t - tr.tFin > APRES_TRANSFO) {
    m.transfo = null;
    if (m.entrainement) placerDepart(m);
    else if (m.sirene) finPeriode(m, evs);
    else { placerEnvoi(m, tr.e, 0); evs.push({ type: 'renvoi', equipe: tr.e }); }
  }
}

function frapperTransfo(m, u, evs) {
  const tr = m.transfo;
  const eq = m.equipes[tr.e];
  const p = m.joueurs[tr.j];
  const s = eq.sens;
  const b = m.ballon;
  const q = clamp(1 - Math.abs(u - FORCE_IDEALE) / 0.4, 0, 1);
  const d = dist(tr.bx, tr.by, s * DEMI_L, tr.vise);
  let sigma = (0.5 + d * 0.05) * (1.6 - p.n.pied / 100) * (1 + 1.6 * (1 - q)) * (1 + (Math.abs(tr.by) / 14) * 1.5);
  if (eq.ctrl === 'ia') sigma *= niveauDe(eq).adresse;
  const ay = tr.vise + gauss(m) * sigma;
  const zPoteaux = 1 + 8.5 * u;
  const pente = Math.max(0.7, (zPoteaux - BALLE_R) / d + 0.35);
  const w = vitessePied(tr.bx, tr.by, BALLE_R + 0.1, s * DEMI_L, ay, zPoteaux, pente);
  Object.assign(b, { vx: w.vx, vy: w.vy, vz: w.vz, porteur: -1, bloque: false, pied: { e: tr.e, j: p.id, transfo: true, sol: false } });
  tr.parti = true;
  tr.tFrappe = tr.t;
  p.etat = 'normal'; p.charge = 0;
  p.frappe = 16;
  m.stats.transfosTentees[tr.e] += 1;
  evs.push({ type: 'pied', joueur: p.id, transfo: true, force: u, q });
}

/** Le ballon franchit la ligne d'essai par les airs : entre les poteaux et au-dessus de la barre ? */
function passePoteaux(m, b, px, evs) {
  const pd = b.pied;
  if (!pd || pd.sol || pd.envoi || pd.fait) return;
  const s = m.equipes[pd.e].sens;
  const xl = s * DEMI_L;
  if (!((px - xl) * (b.x - xl) <= 0 && s * (b.x - px) > 0)) return;
  pd.fait = true;
  const ay = Math.abs(b.y);
  if (Math.abs(ay - POTEAU_Y) < 0.14 && b.z < POTEAU_H) {
    // Sur le poteau !
    b.vx = -b.vx * 0.35; b.vy += gauss(m) * 1.5; b.x = xl - s * 0.15;
    evs.push({ type: 'poteau' });
    if (pd.transfo) return;
    pd.sol = true;
    return;
  }
  const reussi = ay < POTEAU_Y && b.z > BARRE_Z;
  if (pd.transfo) {
    const tr = m.transfo;
    if (!tr || tr.fini) return;
    tr.fini = true; tr.tFin = tr.t; tr.reussi = reussi;
    if (reussi) {
      m.score[pd.e] += 2;
      m.stats.transfos[pd.e] += 1;
      m.perso[pd.j].pts += 2;
      m.points.push({ e: pd.e, j: pd.j, type: 'transfo', pts: 2, passeur: -1, periode: m.periode, chrono: m.chrono, enOr: m.enOr });
    }
    evs.push({ type: 'transfo', equipe: pd.e, joueur: pd.j, reussi });
    return;
  }
  if (pd.drop && reussi && m.phase === 'jeu') {
    m.score[pd.e] += 3;
    m.stats.drops[pd.e] += 1;
    m.perso[pd.j].pts += 3;
    m.points.push({ e: pd.e, j: pd.j, type: 'drop', pts: 3, passeur: -1, periode: m.periode, chrono: m.chrono, enOr: m.enOr });
    m.marque = { type: 'drop', e: pd.e, j: pd.j, x: b.x, y: b.y };
    m.faute = null;
    m.phase = 'marque';
    m.t = APRES_ESSAI - 20;
    evs.push({ type: 'drop', equipe: pd.e, joueur: pd.j, enOr: m.enOr });
  }
}

/* ------------------------------------------------------------------ */
/* Les déplacements                                                    */
/* ------------------------------------------------------------------ */

function deplacer(m, p, c, evs = null) {
  const b = m.ballon;
  if (p.frappe > 0) p.frappe -= 1;
  if (p.etat === 'sol') {
    p.vx *= 0.86; p.vy *= 0.86;
    p.x += p.vx * DT; p.y += p.vy * DT;
    if (--p.t <= 0) { p.etat = 'normal'; p.t = 0; }
    borner(m, p);
    return;
  }
  if (p.etat === 'plonge') {
    p.vx *= 0.96; p.vy *= 0.96;
    p.x += p.vx * DT; p.y += p.vy * DT;
    const c2 = p.cible >= 0 ? m.joueurs[p.cible] : null;
    if (c2 && b.porteur === c2.id && dist(p.x, p.y, c2.x, c2.y) < 0.95 && m.phase === 'jeu') { resoudrePlaquage(m, p, c2, evs || []); return; }
    if (--p.t <= 0) { p.etat = 'sol'; p.t = 28; p.cible = -1; }
    borner(m, p);
    return;
  }
  const porte = b.porteur === p.id;
  if (porte && b.bloque) { p.vx = 0; p.vy = 0; return; }
  const sprint = c.sprint && p.endu > 0.12 && (c.mx || c.my);
  let vm = vitesseMax(p) * (porte ? 0.94 : 1) * (sprint ? 1.25 : 1) * (0.76 + 0.24 * p.endu) * (p.etat === 'pied' ? 0.45 : 1);
  if (m.equipes[p.e].ctrl === 'ia') vm *= niveauDe(m.equipes[p.e]).vitesse;
  if (p.surpris > 0) vm *= 0.5;
  const tx = c.mx * vm, ty = c.my * vm;
  const k = c.mx || c.my ? (porte ? 0.14 : 0.17) : 0.2;
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  p.x += p.vx * DT; p.y += p.vy * DT;
  if (sprint) p.endu = Math.max(0, p.endu - 0.0014);
  else p.endu = Math.min(1, p.endu + 0.0008);
  viser(p, c);
  borner(m, p);
}

/** Où il regarde : là où il court, ou ce que l'ordinateur lui dit de regarder. */
function viser(p, c) {
  const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  let fx = 0, fy = 0;
  if (c.fx || c.fy) { fx = c.fx; fy = c.fy; }
  else if (v > 0.5) { fx = p.vx; fy = p.vy; }
  const l = Math.sqrt(fx * fx + fy * fy);
  if (l > 1e-6) {
    const nx = p.dx + (fx / l - p.dx) * 0.25, ny = p.dy + (fy / l - p.dy) * 0.25;
    const n = Math.sqrt(nx * nx + ny * ny) || 1;
    p.dx = nx / n; p.dy = ny / n;
  }
}

function borner(m, p) {
  p.x = clamp(p.x, -MORT - 1.5, MORT + 1.5);
  p.y = clamp(p.y, -DEMI_W - 1.5, DEMI_W + 1.5);
}

/** Deux joueurs ne se traversent pas (ceux au sol non plus : on les enjambe en les contournant). */
function separer(m) {
  const J = m.joueurs;
  const n = J.length;
  const porteur = m.ballon.porteur;
  for (let a = 0; a < n; a++) {
    const p = J[a];
    if (p.absent) continue;
    for (let c = a + 1; c < n; c++) {
      const q = J[c];
      if (q.absent) continue;
      const dx = q.x - p.x, dy = q.y - p.y;
      const min = JOUEUR_R * 2;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), pousse = (min - d) / 2;
      const ux = dx / d, uy = dy / d;
      // Le porteur, lancé, bouscule un peu plus qu'il n'est bousculé.
      const fp = porteur === p.id ? 0.7 : 1, fq = porteur === q.id ? 0.7 : 1;
      p.x -= ux * pousse * fp; p.y -= uy * pousse * fp;
      q.x += ux * pousse * fq; q.y += uy * pousse * fq;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Le ballon                                                           */
/* ------------------------------------------------------------------ */

function physiqueBallon(m, evs, enJeu = true) {
  const b = m.ballon;
  if (b.porteur >= 0) {
    const p = m.joueurs[b.porteur];
    if (b.bloque && m.phase === 'touche') { b.x = p.x; b.y = p.y; b.z = 2.1; }
    else if (b.bloque) { b.x = p.x + p.dx * 0.35; b.y = p.y + p.dy * 0.35; b.z = m.phase === 'melee' ? 0.35 : 0.3; }
    else {
      b.x = p.x + p.dx * 0.22 + p.dy * 0.18;
      b.y = p.y + p.dy * 0.22 - p.dx * 0.18;
      b.z = p.etat === 'pied' ? 0.95 : p.etat === 'sol' ? 0.3 : 1.05 + p.z;
    }
    b.vx = p.vx; b.vy = p.vy; b.vz = 0;
    return;
  }
  if (b.ruck || (b.bloque && m.phase !== 'touche')) return;
  const n = 3, h = DT / n;
  for (let k = 0; k < n; k++) {
    const px = b.x;
    b.x += b.vx * h; b.y += b.vy * h;
    b.z += b.vz * h - 0.5 * G * h * h;
    b.vz -= G * h;
    if (enJeu) passePoteaux(m, b, px, evs);
    if (m.phase === 'marque' && enJeu) return;
    if (b.z < BALLE_R) {
      b.z = BALLE_R;
      if (b.vz < -1.2) {
        // Le rebond d'un ballon ovale : on ne sait jamais où il part.
        const f = -b.vz;
        b.vz = f * (0.3 + hasard(m) * 0.35);
        const dev = f * 0.18;
        b.vx = b.vx * 0.62 + gauss(m) * dev; b.vy = b.vy * 0.62 + gauss(m) * dev;
        evs.push({ type: 'rebond', force: f });
      } else b.vz = 0;
      if (b.pied) b.pied.sol = true;
      b.cible = -1;
    }
  }
  if (b.z <= BALLE_R + 1e-6 && b.vz === 0) { b.vx *= 0.955; b.vy *= 0.955; }
}

/** Qui attrape le ballon libre (une passe, un coup de pied, un ballon qui roule) ? */
function attraper(m, evs) {
  const b = m.ballon;
  if (b.porteur >= 0 || b.ruck || b.bloque) return;
  const enLAir = b.pied && !b.pied.sol && b.z > 0.5;
  let best = null, bv = -1e9;
  for (const p of m.joueurs) {
    if (p.lache > 0 || p.absent || p.etat === 'sol' || p.etat === 'plonge' || m.equipes[p.e].immobile) continue;
    const hd = dist(p.x, p.y, b.x, b.y);
    if (hd > 0.85 || b.z > allonge(p) + 0.05) continue;
    // Une passe : le receveur l'attrape ; un défenseur sur la trajectoire peut l'intercepter (une fois chacun).
    if (b.cible >= 0 && p.e !== m.joueurs[b.cible].e) {
      if (b.essais & (1 << p.id)) continue;
      b.essais |= 1 << p.id;
      const chance = clamp(0.12 + (p.n.defense - 70) / 150, 0.03, 0.35);
      if (hasard(m) >= chance) continue;
    }
    const v = -hd + (p.id === b.cible ? 0.6 : 0) + hasard(m) * 0.3;
    if (v > bv) { bv = v; best = p; }
  }
  if (!best) return;
  const p = best;
  const s = m.equipes[p.e].sens;
  // L'en-avant : le ballon lui échappe des mains, vers l'avant.
  let gene = 0;
  for (const o of m.joueurs) if (o.e !== p.e && !o.absent && o.etat !== 'sol' && dist(o.x, o.y, p.x, p.y) < 1.3) gene = 1;
  const rate = enLAir ? 0.05 + (85 - p.n.passe) / 450 + gene * 0.1 : b.z > 0.35 ? 0.012 + (80 - p.n.passe) / 900 + gene * 0.04 : 0;
  if (rate > 0 && hasard(m) < clamp(rate, 0, 0.35)) {
    Object.assign(b, { vx: s * (2.2 + hasard(m) * 1.5), vy: gauss(m) * 1.2, vz: 1.6, dernier: p.id, cible: -1, passeur: -1 });
    if (b.pied) b.pied.sol = true;
    p.lache = 25;
    if (!m.faute) m.faute = { type: 'enavant', x: p.x, y: p.y, e: 1 - p.e, f: m.f };
    m.stats.enAvants[p.e] += 1;
    evs.push({ type: 'en-avant', joueur: p.id });
    return;
  }
  const deLui = b.dernier >= 0 ? m.joueurs[b.dernier].e : -1;
  if (b.cible >= 0 && p.id !== b.cible && p.e !== m.joueurs[b.cible].e) evs.push({ type: 'interception', joueur: p.id, passeur: b.passeur });
  else if (enLAir) evs.push({ type: 'reception', joueur: p.id, pied: true, adverse: deLui >= 0 && deLui !== p.e });
  else if (b.cible === p.id) evs.push({ type: 'reception', joueur: p.id });
  else evs.push({ type: 'ramasse', joueur: p.id });
  p.passeDe = b.passeur >= 0 && b.cible === p.id ? b.passeur : -1;
  p.passeF = m.f;
  p.recu = 0;
  Object.assign(b, { porteur: p.id, dernier: p.id, cible: -1, passeur: -1, essais: 0, pied: null });
  if (p.e !== m.poss.e) m.poss = { e: p.e, f: m.f };
  if (m.equipes[p.e].ctrl === 'humain') m.equipes[p.e].actif = p.id;
  // La défense change de joueur : le plus proche du nouveau porteur.
  const o = 1 - p.e;
  if (m.equipes[o].ctrl === 'humain' && deLui !== o) {
    const q = plusProche(m, o, -1, p.x, p.y);
    if (q >= 0) m.equipes[o].actif = q;
  }
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Le temps de la mi-temps en cours, à afficher : « 2:41 » (il descend) ; « 0:00 » après la sirène. */
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
  for (const p of m.joueurs) h = (Math.imul(h, 31) + Math.round(p.x * 100) * 7 + Math.round(p.y * 100)) | 0;
  return String(h >>> 0);
}

/** Le vainqueur d'un match fini (0 ou 1). */
export const vainqueur = (m) => m.vainqueur;

/** Joue un match entier sans humain (pour les tests et l'équilibrage). */
export function simuler(opts) {
  const m = creerMatch({ ...opts, controles: ['ia', 'ia'] });
  let garde = 0;
  while (m.phase !== 'fin' && garde++ < 600000) pas(m, [0, 0]);
  return m;
}
