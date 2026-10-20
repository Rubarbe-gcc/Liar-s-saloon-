/**
 * PETIT PONT — le moteur d'un match de foot à cinq contre cinq.
 *
 * Un gardien et quatre joueurs de champ par équipe, un terrain fermé par des
 * bandes (le ballon ne sort jamais : il rebondit), pas de hors-jeu, deux
 * mi-temps. Chaque équipe est dirigée par un humain (le joueur le plus
 * proche du ballon, qu'il peut changer) ou par l'ordinateur (ia.js), qui
 * dirige aussi les coéquipiers de l'humain et les gardiens.
 *
 * Les touches de chaque équipe, à chaque image : un nombre (terrain.js, T).
 *   en attaque : A passe, X passe lobée, B tir (pour les trois, plus on tient, plus c'est fort) ;
 *                le ballon arrive vers soi : A la remise, B la reprise de volée ;
 *   en défense : A change de joueur, B tacle glissé, X appelle un coéquipier au pressing ;
 *   S : sprint (l'endurance baisse).
 *   G : un geste technique, ballon au pied : la roulette (on tourne autour du défenseur, du côté
 *       où l'on pousse) ; en sprintant, l'arc-en-ciel (le ballon passe par-dessus sa tête et celle
 *       du défenseur, on le récupère devant).
 *
 * L'entraînement (o.entrainement) : on joue librement, sans chrono ni mi-temps,
 * avec moins de joueurs (les absents sont garés hors du terrain), avec ou
 * sans gardien, et des adversaires qui jouent ou qui restent plantés comme
 * des plots (ils ne touchent jamais le ballon). Après un but, l'équipe 0 réengage.
 *
 * Déterministe : même graine, mêmes touches → même match, image par image,
 * sur tous les appareils (le jeu en ligne en dépend : shared/rollback.js).
 * L'état est un objet simple (copiable par structuredClone) ; `pas` le fait
 * avancer d'une image et rend ce qui s'est passé (les événements : sons,
 * effets, commentaires).
 *
 * Module partagé, sans DOM.
 */

import {
  FPS, DT, DEMI_L, DEMI_W, DEMI_BUT, BUT_H, BUT_P, SURFACE, BALLON_R, G, CHARGE_MAX, CHARGE_PASSE, T,
  DUREE_ROULETTE, DUREE_ARC, REPOS_GESTE,
  hasard, gauss, clamp, dist, vitesseMax, trajectoire,
} from './terrain.js';
import { EQUIPE, POSTES, STYLES, notesJoueur } from './equipes.js';
import { decider, niveauDe, bonusGardien, interception, valeurPasse, coteRoulette } from './ia.js';

export { FPS, T, CHARGE_MAX, CHARGE_PASSE, DEMI_L, DEMI_W, DEMI_BUT, BUT_H, BUT_P, SURFACE };

/** Les images d'attente : avant le coup d'envoi, après un but, à la mi-temps. */
const ENGAGEMENT = 75;
const APRES_BUT = 450;
const MI_TEMPS = 200;
/** Les places au coup d'envoi (dans le sens de l'attaque) : G, D, M, M, A. */
const PLACES = [[-19.2, 0], [-9, 0], [-5, 5], [-5, -5], [-3.4, 0]];
const RIEN = { mx: 0, my: 0, sprint: false, action: null };
/** Tourner d'un pas fixe (cosinus et sinus écrits en dur : pas de trigonométrie dans le moteur). */
const ROT = { lent: [0.98007, 0.19867], vif: [0.93937, 0.34290] };

/**
 * Un match.
 * @param {object} o
 * @param {[string, string]} o.equipes   les deux équipes (identifiants d'equipes.js)
 * @param {number} [o.graine]
 * @param {number} [o.minutes]           la durée d'une mi-temps
 * @param {[string, string]} [o.controles]  'humain' ou 'ia', pour chaque équipe
 * @param {[number, number]} [o.niveaux]    0 facile, 1 normal, 2 difficile (pour l'ordinateur)
 * @param {boolean} [o.tab]              des tirs au but en cas d'égalité
 * @param {{ nous: number, eux: number, gardiens: [boolean, boolean], immobiles: boolean }} [o.entrainement]
 *   nous : 1 à 4 joueurs de champ, eux : 0 à 4
 */
export function creerMatch({ equipes, graine = 1, minutes = 3, controles = ['humain', 'ia'], niveaux = [1, 1], tab = false, entrainement = null }) {
  const m = {
    f: 0, alea: (graine >>> 0) || 1,
    phase: 'engagement', t: ENGAGEMENT, mi: 1, chrono: 0, duree: Math.round(minutes * 60 * FPS),
    tabSiNul: !!tab, score: [0, 0], engage: 0, premierEngage: 0,
    equipes: [0, 1].map((e) => ({ id: equipes[e], style: EQUIPE[equipes[e]].style, sens: e === 0 ? 1 : -1, ctrl: controles[e], niveau: niveaux[e] ?? 1, actif: -1, pressing: 0, auto: 0, contre: 0 })),
    joueurs: [],
    ballon: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, porteur: -1, dernier: -1, passeur: -1, cible: -1, tireur: -1, tir: null, dansBut: false, guide: false, arc: 0 },
    prec: [0, 0],
    stats: { tirs: [0, 0], cadres: [0, 0], passes: [0, 0], possession: [0, 0], tacles: [0, 0] },
    buts: [],
    arrets: new Array(10).fill(0), // les arrêts du gardien pendant le jeu (pas aux tirs au but), par joueur
    dernierePasse: null,
    tab: null,
    vainqueur: -1,
  };
  m.engage = m.premierEngage = hasard(m) < 0.5 ? 0 : 1;
  for (let e = 0; e < 2; e++) {
    const eq = EQUIPE[equipes[e]];
    for (let i = 0; i < 5; i++) {
      m.joueurs.push({
        id: e * 5 + i, e, i, poste: POSTES[i], n: notesJoueur(eq, i),
        x: 0, y: 0, vx: 0, vy: 0, dx: 1, dy: 0, etat: 'normal', t: 0, endu: 1,
        charge: 0, chargeCible: 0, vise: 0, verrou: 0, dec: 0, recu: 0, frappe: 0,
        reprise: 0, remise: 0, rx: 0, ry: 0, haut: false, chargeP: 0, passeLob: false, volee: 0,
        geste: 0, gesteType: 0, glx: 0, gly: 0, gesteRepos: 0, surpris: 0,
      });
    }
  }
  if (entrainement) { reglerEntrainement(m, entrainement); return m; }
  placerEngagement(m);
  return m;
}

/**
 * Change les réglages de l'entraînement en pleine partie (le menu pause) :
 * o : { nous: 1 à 4, eux: 0 à 4, gardiens: [bool, bool], immobiles, niveau (de l'ordinateur) }.
 * On réengage, le ballon pour nous.
 */
export function reglerEntrainement(m, o) {
  const n = [clamp(o.nous | 0, 1, 4), clamp(o.eux | 0, 0, 4)];
  const g = o.gardiens || [true, true];
  m.entrainement = { nous: n[0], eux: n[1], gardiens: [!!g[0], !!g[1]], immobiles: !!o.immobiles };
  for (let e = 0; e < 2; e++) {
    m.joueurs[e * 5].absent = !m.entrainement.gardiens[e];
    ORDRE_ENTREE.forEach((i, k) => { m.joueurs[e * 5 + i].absent = k >= n[e]; });
  }
  m.equipes[1].immobile = m.entrainement.immobiles;
  if (o.niveau >= 0 && o.niveau <= 2) m.equipes[1].niveau = o.niveau;
  m.engage = m.premierEngage = 0;
  placerEngagement(m);
}

/** À l'entraînement, les joueurs de champ entrent dans cet ordre : l'attaquant, les milieux, le défenseur. */
const ORDRE_ENTREE = [4, 2, 3, 1];

/** Les absents (l'entraînement) : garés hors du terrain, immobiles, loin de tout. */
function garer(m) {
  for (const p of m.joueurs) if (p.absent) Object.assign(p, { x: -20 + p.id * 4.5, y: -(DEMI_W + 50), vx: 0, vy: 0 });
}

function placerEngagement(m) {
  for (const p of m.joueurs) {
    const s = m.equipes[p.e].sens;
    let [X, Y] = PLACES[p.i];
    if (p.i === 4 && p.e === m.engage) X = -0.42;
    Object.assign(p, { x: X * s, y: Y, vx: 0, vy: 0, dx: s, dy: 0, etat: 'normal', t: 0, charge: 0, verrou: 0, dec: 8, reprise: 0, remise: 0, frappe: 0, recu: 20, geste: 0, gesteType: 0, gesteRepos: 0, surpris: 0 });
  }
  const a = m.engage * 5 + 4;
  Object.assign(m.ballon, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, porteur: a, dernier: a, passeur: -1, cible: -1, tireur: -1, tir: null, dansBut: false, guide: false, arc: 0 });
  for (const eq of m.equipes) { eq.pressing = 0; eq.auto = 0; }
  m.equipes[0].actif = 4;
  m.equipes[1].actif = 9;
  if (m.entrainement) {
    garer(m);
    // Le joueur qui engage : le premier présent (l'attaquant, sinon un milieu…).
    const s = m.equipes[m.engage].sens;
    const k = m.joueurs.find((p) => p.e === m.engage && p.i > 0 && !p.absent);
    if (k && k.i !== 4) { Object.assign(k, { x: -0.42 * s, y: 0 }); Object.assign(m.ballon, { porteur: k.id, dernier: k.id }); }
    for (let e = 0; e < 2; e++) { const q = m.joueurs.find((p) => p.e === e && p.i > 0 && !p.absent); m.equipes[e].actif = q ? q.id : e * 5 + 4; }
  }
  m.phase = 'engagement';
  m.t = ENGAGEMENT;
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
      if (--m.t <= 0) { m.phase = 'jeu'; evs.push({ type: 'sifflet', n: 1 }); }
      break;
    case 'jeu':
      jouer(m, k, ap, rel, evs);
      break;
    case 'but':
      celebrer(m, evs);
      if (--m.t <= 0) {
        if (m.chrono >= m.duree) finMiTemps(m, evs);
        else { placerEngagement(m); evs.push({ type: 'engagement' }); }
      }
      break;
    case 'mitemps':
      if (--m.t <= 0) {
        m.mi = 2;
        m.chrono = 0;
        for (const eq of m.equipes) eq.sens = -eq.sens;
        m.engage = 1 - m.premierEngage;
        placerEngagement(m);
        evs.push({ type: 'reprise' });
      }
      break;
    case 'tab':
      tirsAuBut(m, k, ap, rel, evs);
      break;
    default:
  }
  return evs;
}

function jouer(m, k, ap, rel, evs) {
  const b = m.ballon;
  for (const p of m.joueurs) {
    if (p.verrou > 0) p.verrou -= 1;
    if (p.t > 0) p.t -= 1;
    if (p.frappe > 0) p.frappe -= 1;
    if (p.volee > 0) p.volee -= 1;
    if (p.geste > 0) p.geste -= 1;
    if (p.gesteRepos > 0) p.gesteRepos -= 1;
    if (p.surpris > 0) p.surpris -= 1;
    if (p.reprise > 0) p.reprise -= 1;
    if (p.remise > 0) p.remise -= 1;
    if (b.porteur === p.id) p.recu += 1;
    // Plus de ballon (chipé, taclé…) : plus de passe ni de frappe en préparation.
    else { p.charge = 0; p.chargeP = 0; if (p.gesteType === 1) p.geste = 0; }
  }
  for (const eq of m.equipes) { if (eq.pressing > 0) eq.pressing -= 1; if (eq.auto > 0) eq.auto -= 1; if (eq.contre > 0) eq.contre -= 1; }

  const traj = b.porteur < 0 ? trajectoire(b) : null;
  const cons = new Array(10).fill(null);
  for (let e = 0; e < 2; e++) if (m.equipes[e].ctrl === 'humain') humain(m, e, k[e], ap[e], rel[e], cons, evs, traj);
  for (let e = 0; e < 2; e++) decider(m, e, cons, traj);
  for (let i = 0; i < 10; i++) {
    const c = cons[i];
    if (c && c.charge && b.porteur === i && m.joueurs[i].charge > 0) m.joueurs[i].charge += 1;
    if (c && c.action) agir(m, m.joueurs[i], c.action, evs);
  }
  for (const p of m.joueurs) deplacer(m, p, cons[p.id] || RIEN);
  separer(m);
  const avant = { x: b.x, y: b.y, z: b.z };
  physiqueBallon(m, evs);
  if (m.phase !== 'jeu') return;
  contacts(m, avant, evs);

  if (b.porteur >= 0) m.stats.possession[m.joueurs[b.porteur].e] += 1;
  if (m.entrainement) return;
  m.chrono += 1;
  if (m.chrono >= m.duree) {
    // Une frappe partie juste avant la fin a le droit d'arriver.
    const enVol = b.tir && b.porteur < 0 && m.chrono < m.duree + 120;
    if (!enVol) finMiTemps(m, evs);
  }
}

function finMiTemps(m, evs) {
  if (m.mi === 1) {
    m.phase = 'mitemps';
    m.t = MI_TEMPS;
    evs.push({ type: 'mitemps' });
    return;
  }
  if (m.score[0] === m.score[1] && m.tabSiNul) { debutTab(m, evs); return; }
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
  for (let i = 1; i < 5; i++) {
    const p = m.joueurs[e * 5 + i];
    if (p.id === sauf || p.absent) continue;
    const d = dist(p.x, p.y, b.x, b.y) + (p.etat === 'normal' ? 0 : 3);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}

/** Les adversaires juste devant le dribbleur (à moins de `portee` m) se font prendre : ils se retournent. */
function surprendre(m, p, portee, duree) {
  for (let k = 0; k < 5; k++) {
    const q = m.joueurs[(1 - p.e) * 5 + k];
    if (q.i === 0) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < portee && dx * p.dx + dy * p.dy > -0.3 * d) { q.surpris = duree; q.verrou = Math.max(q.verrou, Math.round(duree * 0.6)); }
  }
}

/** Le coéquipier le mieux placé pour recevoir (le même calcul que l'ordinateur), sinon le plus proche devant. */
export function meilleurReceveur(m, p) {
  const st = STYLES[m.equipes[p.e].style];
  let best = -1, bv = -1e9;
  for (let i = 1; i < 5; i++) {
    const r = m.joueurs[p.e * 5 + i];
    if (r === p) continue;
    const o = valeurPasse(m, p, r, st);
    if (o && o.v > bv) { bv = o.v; best = r.id; }
  }
  return best >= 0 ? best : choisirReceveur(m, p, 0, 0);
}

/** Le coéquipier qu'on vise en passant dans la direction (dx, dy) (sinon : là où l'on regarde). */
export function choisirReceveur(m, p, dx, dy) {
  if (!dx && !dy) { dx = p.dx; dy = p.dy; }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= l; dy /= l;
  let best = -1, bv = -1e9;
  for (let i = 0; i < 5; i++) {
    const r = m.joueurs[p.e * 5 + i];
    if (r === p || r.absent) continue;
    const ux = r.x - p.x, uy = r.y - p.y;
    const d = Math.sqrt(ux * ux + uy * uy) || 1;
    const v = ((ux * dx + uy * dy) / d) * 2 - d * 0.035 - (r.i === 0 ? 0.9 : 0);
    if (v > bv) { bv = v; best = r.id; }
  }
  return best;
}

function humain(m, e, k, ap, rel, cons, evs, traj) {
  const eq = m.equipes[e], b = m.ballon;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  if (porteur && porteur.e === e && porteur.i > 0) eq.actif = porteur.id;
  if (eq.actif < 0 || m.joueurs[eq.actif].i === 0) eq.actif = plusProche(m, e);
  let p = m.joueurs[eq.actif];
  const attaque = porteur ? porteur.e === e : b.cible >= 0 && m.joueurs[b.cible].e === e;

  // Changer de joueur (en défense) : à la main, ou tout seul quand on est loin de l'action.
  if (!attaque) {
    if (ap & T.A) {
      const q = plusProche(m, e, p.id);
      const proche = plusProche(m, e);
      const choix = proche !== p.id ? proche : q;
      if (choix >= 0) { eq.actif = choix; eq.auto = 50; evs.push({ type: 'changer', equipe: e, joueur: choix }); }
      ap &= ~T.A;
    } else if (eq.auto <= 0) {
      const q = plusProche(m, e);
      const dq = dist(m.joueurs[q].x, m.joueurs[q].y, b.x, b.y), dp = dist(p.x, p.y, b.x, b.y);
      if (q !== p.id && dp > 7 && dq < dp - 4) { eq.actif = q; eq.auto = 50; evs.push({ type: 'changer', equipe: e, joueur: q }); }
    }
    p = m.joueurs[eq.actif];
  }

  let mx = (k & T.d ? 1 : 0) - (k & T.g ? 1 : 0);
  let my = (k & T.h ? 1 : 0) - (k & T.b ? 1 : 0);
  if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
  let action = null;
  if (porteur === p) {
    if (p.chargeP > 0) {
      // La passe se charge tant qu'on tient (A, ou X pour le lob) ; elle part quand on lâche.
      if (mx || my) { p.rx = mx; p.ry = my; }
      const tient = k & (p.passeLob ? T.X : T.A);
      if (tient) p.chargeP += 1;
      if (!tient || p.chargeP >= CHARGE_PASSE + 10) {
        // Avec une direction, le coéquipier de ce côté ; sans, le mieux placé. La passe est guidée : on ne règle que la force.
        const cible = p.rx || p.ry ? choisirReceveur(m, p, p.rx, p.ry) : meilleurReceveur(m, p);
        action = { type: 'passe', cible, lob: p.passeLob, puissance: Math.min(1, p.chargeP / CHARGE_PASSE), guide: true };
        p.chargeP = 0;
      }
    } else if (ap & T.G && !(p.charge > 0) && p.geste <= 0 && p.gesteRepos <= 0) {
      // Le geste technique : en sprintant, l'arc-en-ciel ; sinon la roulette, du côté où l'on pousse.
      action = k & T.S ? { type: 'geste', arc: true } : { type: 'geste', arc: false, ...coteRoulette(m, p, mx, my) };
    } else if (ap & (T.A | T.X) && !(p.charge > 0)) { p.chargeP = 1; p.passeLob = !(ap & T.A); p.rx = mx; p.ry = my; }
    else if (ap & T.B) { p.charge = 1; p.vise = my; }
    else if (k & T.B && p.charge > 0) {
      p.charge += 1;
      if (my) p.vise = my;
      if (p.charge >= CHARGE_MAX + 12) action = { type: 'tir', puissance: 1, vise: p.vise };
    } else if (rel & T.B && p.charge > 0) action = { type: 'tir', puissance: Math.min(1, p.charge / CHARGE_MAX), vise: my || p.vise };
  } else {
    p.charge = 0;
    p.chargeP = 0;
    if (attaque) {
      // Le ballon vient vers nous : on prépare une reprise (B) ou une remise (A).
      // Sur une passe pour lui, la reprise reste armée jusqu'à l'arrivée du ballon.
      if (ap & T.B) { p.reprise = b.cible === p.id ? 240 : 26; p.vise = my; }
      if (ap & T.A) { p.remise = 26; p.rx = mx; p.ry = my; }
      // Sans direction, il va tout seul à la rencontre du ballon.
      if (!mx && !my && b.cible === p.id && traj) {
        const i = interception(m, p, traj);
        const dx = i.x - p.x, dy = i.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.15) { const f = Math.min(1, d / 1.2) / d; mx = dx * f; my = dy * f; }
      }
    } else {
      if (ap & T.B && p.etat === 'normal') {
        if (mx || my) { const l = Math.sqrt(mx * mx + my * my); p.dx = mx / l; p.dy = my / l; }
        action = { type: 'tacle' };
      }
      if (ap & T.X) { eq.pressing = 90; evs.push({ type: 'pressing', equipe: e }); }
    }
  }
  cons[p.id] = { mx, my, sprint: !!(k & T.S), action, humain: true };
}

/* ------------------------------------------------------------------ */
/* Les actions                                                         */
/* ------------------------------------------------------------------ */

function agir(m, p, a, evs) {
  const b = m.ballon;
  switch (a.type) {
    case 'passe':
      if (b.porteur === p.id && a.cible >= 0 && p.etat === 'normal') passer(m, p, m.joueurs[a.cible], a.lob, evs, false, a.puissance, a.guide);
      break;
    case 'relance':
      if (b.porteur === p.id && p.etat === 'tient') {
        p.etat = 'normal';
        b.z = 0.5;
        passer(m, p, m.joueurs[a.cible], a.lob, evs, true);
      }
      break;
    case 'tir':
      if (b.porteur === p.id && p.etat === 'normal') tirer(m, p, a.puissance, a.vise, evs);
      p.charge = 0;
      break;
    case 'tacle':
      if (p.etat === 'normal' && b.porteur !== p.id && p.verrou <= 0) {
        const sp = Math.max(7.4, Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 1.1);
        p.etat = 'tacle'; p.t = 26; p.vx = p.dx * sp; p.vy = p.dy * sp;
        m.stats.tacles[p.e] += 1;
        evs.push({ type: 'glisse', joueur: p.id });
      }
      break;
    case 'geste':
      if (b.porteur === p.id && p.etat === 'normal' && p.geste <= 0 && p.gesteRepos <= 0) {
        p.gesteRepos = REPOS_GESTE;
        if (a.arc) {
          // L'arc-en-ciel : le ballon, coincé entre les talons, passe par-dessus la tête et retombe devant.
          const sp = Math.max(3, Math.sqrt(p.vx * p.vx + p.vy * p.vy)) + 1;
          lancer(m, p, p.dx * sp, p.dy * sp, 7.2);
          p.frappe = 0;
          b.cible = p.id; b.passeur = -1; b.arc = 60;
          p.verrou = 18; p.geste = DUREE_ARC; p.gesteType = 2;
          surprendre(m, p, 3.2, 40);
          evs.push({ type: 'geste', joueur: p.id, nom: 'arc-en-ciel' });
        } else {
          // La roulette : on tourne sur soi en contournant le défenseur, le ballon collé au pied.
          p.geste = DUREE_ROULETTE; p.gesteType = 1; p.glx = a.lx; p.gly = a.ly;
          surprendre(m, p, 1.8, 16);
          evs.push({ type: 'geste', joueur: p.id, nom: 'roulette' });
        }
      }
      break;
    case 'plonge':
      if (p.etat === 'normal' && p.i === 0 && b.porteur !== p.id) {
        p.etat = 'plonge'; p.t = 40; p.vx = 0; p.vy = a.vy; p.haut = !!a.haut;
        evs.push({ type: 'plonge', joueur: p.id, cote: a.vy > 0 ? 1 : -1 });
      }
      break;
    default:
  }
}

/** Le ballon part du pied (ou de la main) de p. */
function lancer(m, p, vx, vy, vz) {
  const b = m.ballon;
  b.porteur = -1; b.vx = vx; b.vy = vy; b.vz = vz;
  b.dernier = p.id; b.tir = null; b.cible = -1; b.passeur = -1; b.tireur = -1; b.guide = false; b.arc = 0;
  p.verrou = 14; p.frappe = 16; p.charge = 0; p.chargeP = 0; p.recu = 0;
}

/**
 * Une passe de p vers r. puissance (de 0 à 1, une passe chargée par un humain) : douce, elle
 * arrive lentement ; forte, elle fuse. Sans puissance (l'ordinateur), une passe normale.
 */
function passer(m, p, r, lob, evs, main = false, puissance = null, guide = false) {
  const b = m.ballon;
  const force = puissance === null || puissance === undefined ? 1 : 0.82 + 0.45 * puissance;
  const ox = b.x, oy = b.y;
  let tx = r.x, ty = r.y, t = 0, v0 = 0, vh = 0;
  // Là où sera le receveur quand le ballon arrivera.
  for (let k = 0; k < 3; k++) {
    const d = Math.max(0.5, dist(ox, oy, tx, ty));
    if (lob) { vh = clamp(6 + d * 0.42, 7.5, 15.5) * force; t = d / vh; }
    else { v0 = clamp(Math.sqrt(30 + 7.5 * d), 7.5, 21) * force; t = d / ((v0 + 5.5) / 2); }
    tx = clamp(r.x + r.vx * t * 0.8, -DEMI_L + 0.6, DEMI_L - 0.6);
    ty = clamp(r.y + r.vy * t * 0.8, -DEMI_W + 0.6, DEMI_W - 0.6);
  }
  let ux = tx - ox, uy = ty - oy;
  const d = Math.sqrt(ux * ux + uy * uy) || 1;
  ux /= d; uy /= d;
  const N = niveauDe(m.equipes[p.e]);
  // Une passe guidée (celle d'un humain) part droit sur le receveur ; celles de l'ordinateur dévient un peu selon sa note.
  const err = guide ? 0 : (gauss(m) * (1.05 - p.n.passe / 100) * (lob ? 0.16 : 0.09)) / N.precision;
  const ex = ux - uy * err, ey = uy + ux * err, el = Math.sqrt(ex * ex + ey * ey);
  ux = ex / el; uy = ey / el;
  if (lob) lancer(m, p, ux * vh, uy * vh, (G * t) / 2 - (b.z > 0.3 ? b.z / t : 0));
  else lancer(m, p, ux * v0, uy * v0, main ? 0.6 : 0);
  b.cible = r.id;
  b.guide = !!guide;
  b.passeur = p.id;
  m.stats.passes[p.e] += 1;
  const eq = m.equipes[p.e];
  if (eq.ctrl === 'humain' && r.i > 0) eq.actif = r.id;
  evs.push({ type: 'passe', joueur: p.id, cible: r.id, lob: !!lob, main });
}

function tirer(m, p, puissance, vise, evs, geste = null) {
  const b = m.ballon, s = m.equipes[p.e].sens, gx = DEMI_L * s;
  const N = niveauDe(m.equipes[p.e]);
  puissance = clamp(puissance, 0.15, 1);
  const p3 = puissance * puissance * puissance;
  let ty = vise ? (vise > 0 ? 1.2 : -1.2) : Math.abs(p.y) < 0.8 ? 0 : p.y > 0 ? -0.95 : 0.95;
  let tz = 0.22 + puissance * puissance * 1.3;
  const d = Math.max(2, dist(b.x, b.y, gx, ty));
  const fd = clamp(d / 12, 0.6, 2.2);
  // Les frappes d'un humain partent un peu plus droit (il a visé lui-même) ; celles de l'ordinateur dépendent de son niveau.
  const humain = m.equipes[p.e].ctrl === 'humain';
  const sy = ((humain ? 0.2 + (1 - p.n.tir / 100) * 0.8 + p3 * 0.3 : 0.24 + (1 - p.n.tir / 100) * 0.9 + p3 * 0.45) * fd) / N.precision;
  const sz = ((0.08 + p3 * (humain ? 0.34 : 0.5)) * fd) / N.precision;
  ty += gauss(m) * sy;
  tz = Math.max(0.12, tz + gauss(m) * sz);
  const vit = 14.5 + puissance * 12.5 + (p.n.tir - 75) * 0.09;
  let ux = gx - b.x, uy = ty - b.y;
  const l = Math.sqrt(ux * ux + uy * uy) || 1;
  ux /= l; uy /= l;
  const t = l / vit;
  lancer(m, p, ux * vit, uy * vit, (tz - b.z) / t + (G * t) / 2);
  b.tir = { e: p.e, j: p.id, f: m.f, teste: false, d };
  b.tireur = p.id;
  m.stats.tirs[p.e] += 1;
  if (Math.abs(ty) < DEMI_BUT - 0.05 && tz < BUT_H - 0.05) m.stats.cadres[p.e] += 1;
  evs.push({ type: 'tir', joueur: p.id, puissance, geste, distance: d });
}

/* ------------------------------------------------------------------ */
/* Les déplacements                                                    */
/* ------------------------------------------------------------------ */

/** Tourne le regard de p vers (tx, ty) (unitaire), d'un pas au plus. */
function tourner(p, tx, ty, vif) {
  const dot = p.dx * tx + p.dy * ty;
  const [c, s0] = vif ? ROT.vif : ROT.lent;
  if (dot >= c) { p.dx = tx; p.dy = ty; return; }
  const s = p.dx * ty - p.dy * tx >= 0 ? s0 : -s0;
  const nx = p.dx * c - p.dy * s, ny = p.dx * s + p.dy * c;
  const l = Math.sqrt(nx * nx + ny * ny);
  p.dx = nx / l; p.dy = ny / l;
}

function dansSurface(m, p) {
  const s = m.equipes[p.e].sens;
  return dist(p.x, p.y, -DEMI_L * s, 0) < SURFACE + 0.25;
}

function deplacer(m, p, c) {
  if (p.absent) return;
  const b = m.ballon, eq = m.equipes[p.e];
  if (p.etat === 'tacle') {
    p.vx *= 0.955; p.vy *= 0.955;
    if (p.t <= 0) { p.etat = 'sol'; p.t = 16; }
  } else if (p.etat === 'sol') {
    p.vx *= 0.8; p.vy *= 0.8;
    if (p.t <= 0) p.etat = 'normal';
  } else if (p.etat === 'plonge') {
    p.vx = 0; p.vy *= 0.94;
    if (p.t <= 0) { p.etat = 'sol'; p.t = 22; }
  } else if (p.etat === 'tient') {
    p.vx *= 0.75; p.vy *= 0.75;
  } else if (p.geste > 0 && p.gesteType === 1) {
    // La roulette, comme la vraie : il freine en posant la semelle sur le ballon, pivote dos au
    // défenseur en le glissant de côté, puis repart en accélérant.
    const u = 1 - p.geste / DUREE_ROULETTE;
    const avance = u < 0.3 ? 2.6 - u * 5 : u < 0.75 ? 1.1 : 1.1 + (u - 0.75) * 16;
    const cote = u < 0.2 ? 0 : u < 0.8 ? 3.4 : 3.4 * (1 - (u - 0.8) * 4);
    p.vx = p.dx * avance + p.glx * cote;
    p.vy = p.dy * avance + p.gly * cote;
  } else {
    const porte = b.porteur === p.id;
    let vmax = vitesseMax(p) * (eq.ctrl === 'ia' ? niveauDe(eq).vitesse : 1);
    const sprint = c.sprint && p.endu > 0.06 && !(p.charge > 0);
    if (sprint) vmax *= 1.3;
    if (porte) vmax *= 0.9;
    if (p.charge > 0) vmax *= 0.62;
    if (p.chargeP > 0) vmax *= 0.85;
    // Un défenseur pris par un geste technique se retourne : il repart lentement.
    if (p.surpris > 0) vmax *= 0.35;
    let dvx = c.mx * vmax - p.vx, dvy = c.my * vmax - p.vy;
    const dv = Math.sqrt(dvx * dvx + dvy * dvy), acc = (porte ? 22 : 28) * DT;
    if (dv > acc) { dvx *= acc / dv; dvy *= acc / dv; }
    p.vx += dvx; p.vy += dvy;
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sprint && sp > 1) p.endu = Math.max(0, p.endu - 0.0032);
    else p.endu = Math.min(1, p.endu + 0.0024);
    const l = Math.sqrt(c.mx * c.mx + c.my * c.my);
    if (l > 0.05) tourner(p, c.mx / l, c.my / l, !porte);
    else if (!porte) {
      const fx = b.x - p.x, fy = b.y - p.y, fl = Math.sqrt(fx * fx + fy * fy);
      if (fl > 0.3) tourner(p, fx / fl, fy / fl, false);
    }
  }
  p.x = clamp(p.x + p.vx * DT, -DEMI_L + 0.3, DEMI_L - 0.3);
  p.y = clamp(p.y + p.vy * DT, -DEMI_W + 0.3, DEMI_W - 0.3);
  // Le gardien ne quitte pas sa surface.
  if (p.i === 0) {
    const gx = -DEMI_L * eq.sens;
    const d = dist(p.x, p.y, gx, 0);
    if (d > SURFACE) { p.x = gx + ((p.x - gx) / d) * SURFACE; p.y = (p.y / d) * SURFACE; }
  }
}

/** Les joueurs ne se traversent pas. */
function separer(m) {
  const J = m.joueurs;
  for (let i = 0; i < 10; i++) {
    for (let j = i + 1; j < 10; j++) {
      const a = J[i], c = J[j];
      // Pendant son arc-en-ciel, le dribbleur passe à côté de son adversaire (on ne le bloque pas).
      if (a.e !== c.e && ((a.geste > 0 && a.gesteType === 2) || (c.geste > 0 && c.gesteType === 2))) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= 0.4624) continue;
      const d = Math.sqrt(d2);
      const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
      const push = (0.68 - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      c.x += nx * push; c.y += ny * push;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Le ballon                                                           */
/* ------------------------------------------------------------------ */

function physiqueBallon(m, evs) {
  const b = m.ballon;
  if (b.porteur >= 0) {
    const p = m.joueurs[b.porteur];
    if (p.etat === 'tient') { b.x = p.x + p.dx * 0.3; b.y = p.y + p.dy * 0.3; b.z = 0.95; }
    else {
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const off = 0.38 + sp * 0.025;
      // Le ballon au pied reste entre les bandes : pour marquer, il faut tirer.
      b.x = clamp(p.x + p.dx * off, -DEMI_L + BALLON_R, DEMI_L - BALLON_R);
      b.y = clamp(p.y + p.dy * off, -DEMI_W + BALLON_R, DEMI_W - BALLON_R);
      b.z = 0;
    }
    b.vx = p.vx; b.vy = p.vy; b.vz = 0;
    return;
  }
  // Une passe guidée suit son receveur (sans faire demi-tour) : elle arrive même s'il a bougé.
  if (b.guide && b.cible >= 0) {
    const r = m.joueurs[b.cible];
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    let dx = r.x - b.x, dy = r.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (sp > 0.5 && d > 0.4) {
      dx /= d; dy /= d;
      const ux = b.vx / sp, uy = b.vy / sp;
      if (ux * dx + uy * dy > 0) {
        const k = b.z > 0.3 ? 0.05 : 0.12;
        const nx = ux + (dx - ux) * k, ny = uy + (dy - uy) * k, nl = Math.sqrt(nx * nx + ny * ny);
        b.vx = (nx / nl) * sp; b.vy = (ny / nl) * sp;
      }
    }
  }
  const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
  const n = Math.min(6, 1 + Math.floor((v * DT) / 0.12));
  const h = DT / n;
  for (let k = 0; k < n; k++) {
    if (b.z > 0 || b.vz > 0) {
      b.vz -= G * h;
      const f = 1 - 0.1 * h;
      b.vx *= f; b.vy *= f;
    } else {
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > 0) {
        const f = Math.max(0, sp - (1.2 + 0.15 * sp) * h) / sp;
        b.vx *= f; b.vy *= f;
        if (sp < 0.05) { b.vx = 0; b.vy = 0; }
      }
    }
    b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    if (b.z < 0) {
      b.z = 0;
      if (b.vz < -1.2) {
        if (b.vz < -4) evs.push({ type: 'rebond', force: -b.vz });
        b.vz = -b.vz * 0.5; b.vx *= 0.88; b.vy *= 0.88;
      } else b.vz = 0;
    }
    murs(m, evs);
    if (!b.dansBut && Math.abs(b.x) > DEMI_L + BALLON_R && Math.abs(b.y) < DEMI_BUT && b.z < BUT_H) {
      b.dansBut = true;
      if (m.phase === 'jeu') marquer(m, b.x > 0 ? 1 : -1, evs);
    }
  }
}

function murs(m, evs) {
  const b = m.ballon, R = BALLON_R;
  // Les bandes, sur les côtés.
  const ly = DEMI_W - R;
  if (b.y > ly || b.y < -ly) {
    const sy = b.y > 0 ? 1 : -1;
    b.y = sy * 2 * ly - b.y;
    if (Math.abs(b.vy) > 4) evs.push({ type: 'bande', force: Math.abs(b.vy) });
    b.vy = -sy * Math.abs(b.vy) * 0.7; b.vx *= 0.92;
  }
  // Les poteaux et la barre.
  const sx = b.x > 0 ? 1 : -1;
  if (Math.abs(Math.abs(b.x) - DEMI_L) < 0.6) {
    const rr = R + 0.06;
    for (const py of [-DEMI_BUT, DEMI_BUT]) {
      if (b.z > BUT_H + 0.05) break;
      const dx = b.x - sx * DEMI_L, dy = b.y - py, d = Math.sqrt(dx * dx + dy * dy);
      if (d < rr && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        b.x = sx * DEMI_L + nx * rr; b.y = py + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; if (-vn > 3) evs.push({ type: 'poteau', force: -vn }); }
      }
    }
    if (Math.abs(b.y) < DEMI_BUT) {
      const dx = b.x - sx * DEMI_L, dz = b.z - BUT_H, d = Math.sqrt(dx * dx + dz * dz);
      if (d < rr && d > 1e-6) {
        const nx = dx / d, nz = dz / d;
        b.x = sx * DEMI_L + nx * rr; b.z = BUT_H + nz * rr;
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; if (-vn > 3) evs.push({ type: 'poteau', force: -vn, barre: true }); }
      }
    }
  }
  // Le fond : la bande, sauf l'ouverture du but (et dedans, le filet).
  const lx = DEMI_L - R;
  if (Math.abs(b.x) > lx) {
    const ouvert = b.dansBut || (Math.abs(b.y) < DEMI_BUT - R * 0.5 && b.z < BUT_H - R * 0.5);
    if (!ouvert) {
      b.x = sx * 2 * lx - b.x;
      if (Math.abs(b.vx) > 4) evs.push({ type: 'bande', force: Math.abs(b.vx) });
      b.vx = -sx * Math.abs(b.vx) * 0.7; b.vy *= 0.92;
    } else if (Math.abs(b.x) > DEMI_L) {
      // Dans le but : le filet amortit tout.
      const fx = DEMI_L + BUT_P - R;
      if (Math.abs(b.x) > fx) { b.x = sx * fx; if (Math.abs(b.vx) > 3) evs.push({ type: 'filet', force: Math.abs(b.vx) }); b.vx = -sx * Math.abs(b.vx) * 0.12; b.vy *= 0.5; b.vz *= 0.5; }
      const fy = DEMI_BUT - R;
      if (Math.abs(b.y) > fy) { const sy = b.y > 0 ? 1 : -1; b.y = sy * fy; b.vy = -sy * Math.abs(b.vy) * 0.15; b.vx *= 0.7; }
      if (b.z > BUT_H - R) { b.z = BUT_H - R; b.vz = -Math.abs(b.vz) * 0.15; }
    }
  }
}

function marquer(m, cote, evs) {
  const b = m.ballon;
  const e = m.equipes[0].sens === cote ? 0 : 1;
  m.score[e] += 1;
  let buteur, csc = false;
  if (b.tireur >= 0 && m.joueurs[b.tireur].e === e) buteur = b.tireur;
  else if (b.dernier >= 0 && m.joueurs[b.dernier].e === e) buteur = b.dernier;
  else { buteur = b.dernier >= 0 ? b.dernier : e * 5 + 4; csc = true; }
  let passeur = -1;
  const dp = m.dernierePasse;
  if (!csc && dp && dp.a === buteur && m.f - dp.f < 420) passeur = dp.de;
  m.buts.push({ e, j: buteur, passeur, csc, mi: m.mi, chrono: m.chrono });
  m.phase = 'but';
  m.t = m.entrainement ? 100 : APRES_BUT;
  m.engage = m.entrainement ? 0 : 1 - e;
  for (const p of m.joueurs) { p.charge = 0; if (p.etat === 'tient') p.etat = 'normal'; }
  evs.push({ type: 'but', equipe: e, joueur: buteur, passeur, csc });
}

/** Après un but : le buteur file vers le poteau de corner, ses coéquipiers le rejoignent, les autres repartent. */
function celebrer(m, evs) {
  const but = m.buts[m.buts.length - 1];
  const e = but.e, s = m.equipes[e].sens;
  const heros = but.csc ? m.joueurs[e * 5 + 4] : m.joueurs[but.j];
  const coin = heros.y >= 0 ? 8.6 : -8.6;
  for (const p of m.joueurs) {
    p.t = Math.max(0, p.t - 1);
    if (p.etat !== 'normal' && p.t <= 0) p.etat = 'normal';
    let c = RIEN;
    if (p.etat === 'normal') {
      if (p === heros) c = allerVers(p, 17.5 * s, coin, 1);
      else if (p.e === e && p.i > 0) c = allerVers(p, 17.5 * s - s * 1.2 * (p.i % 2 ? 1 : -1), coin - (coin > 0 ? 1 : -1) * (0.6 + p.i * 0.35), 0.9);
      else if (p.i > 0) c = allerVers(p, p.x * 0.6, p.y * 0.8, 0.35);
    }
    deplacer(m, p, c);
  }
  separer(m);
  physiqueBallon(m, evs);
}

function allerVers(p, x, y, vit) {
  const dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.4) return RIEN;
  const k = (Math.min(1, d / 1.5) * vit) / d;
  return { mx: dx * k, my: dy * k, sprint: vit > 0.95 && d > 3, action: null };
}

/* ------------------------------------------------------------------ */
/* Les contacts                                                        */
/* ------------------------------------------------------------------ */

/** Le ballon libre a-t-il croisé quelqu'un pendant cette image ? */
function contacts(m, avant, evs) {
  const b = m.ballon;
  if (b.porteur >= 0) { duels(m, evs); return; }
  if (b.dansBut) return;
  let best = null, bk = 1;
  if (b.arc > 0) b.arc -= 1;
  for (const p of m.joueurs) {
    if (p.verrou > 0 || p.etat === 'sol' || p.etat === 'tient' || p.absent || m.equipes[p.e].immobile) continue;
    // L'arc-en-ciel passe au-dessus des têtes : tant qu'il est en l'air, seul le gardien peut le capter.
    if (b.arc > 0 && b.z > 0.35 && p.id !== b.cible && p.i > 0) continue;
    const mains = p.i === 0 && dansSurface(m, p);
    let fx = p.x, fy = p.y, reach, zmax, demi = 0;
    if (p.etat === 'tacle') { fx += p.dx * 0.45; fy += p.dy * 0.45; reach = 0.75; zmax = 0.55; }
    else if (p.etat === 'plonge') { reach = 0.5; demi = 0.75; zmax = p.haut ? 2.35 : 1.45; }
    else if (mains) { reach = 0.62; zmax = 2.45; }
    else { reach = 0.52; zmax = 1.9; }
    // Quelques points le long du trajet du ballon pendant l'image (il va vite).
    for (let s = 1; s <= 4; s++) {
      const u = s / 4;
      const x = avant.x + (b.x - avant.x) * u, y = avant.y + (b.y - avant.y) * u, z = avant.z + (b.z - avant.z) * u;
      if (z > zmax) continue;
      const r = (p.etat === 'tacle' || p.etat === 'plonge' || mains || z < 0.7) ? reach : 0.4;
      const dy = Math.max(0, Math.abs(y - fy) - demi);
      const d = Math.sqrt((x - fx) * (x - fx) + dy * dy) / r;
      if (d < bk) { bk = d; best = { p, mains }; }
    }
  }
  if (best) toucher(m, best.p, best.mains, evs);
}

function toucher(m, p, mains, evs) {
  const b = m.ballon, eq = m.equipes[p.e];
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz * 0.3);
  const tirAdverse = b.tir && b.tir.e !== p.e;
  // Le gardien, avec les mains (pas sur une passe d'un coéquipier).
  const passeAmie = b.dernier >= 0 && m.joueurs[b.dernier].e === p.e && !b.tir;
  if (mains && !passeAmie) {
    if (tirAdverse && !b.tir.teste) {
      b.tir.teste = true;
      const gard = p.n.gardien + bonusGardien(eq);
      // Face à la frappe d'un humain, le gardien est plus battable (une frappe forte et bien placée doit pouvoir rentrer) ;
      // face à l'ordinateur, il reste solide (sinon les matchs contre l'ordinateur deviendraient des festivals).
      const parHumain = m.equipes[b.tir.e].ctrl === 'humain';
      // La distance compte beaucoup : de près, le gardien n'a pas le temps de réagir ; de loin, il voit tout venir.
      const ecart9 = b.tir.d - 9;
      const loin = ecart9 < 0 ? Math.max(-0.45, ecart9 * (parHumain ? 0.075 : 0.035)) : Math.min(0.35, ecart9 * (parHumain ? 0.045 : 0.035));
      let pr = parHumain
        ? 0.69 + (gard - 75) * 0.012 - (speed - 20) * 0.03 + loin - (Math.abs(b.y) > 0.9 ? 0.18 : 0) + (p.etat === 'plonge' ? 0 : 0.1)
        : 0.88 + (gard - 75) * 0.012 - (speed - 20) * 0.02 + loin - (Math.abs(b.y) > 0.9 ? 0.1 : 0) + (p.etat === 'plonge' ? 0 : 0.1);
      pr = clamp(pr, 0.1, 0.96);
      if (hasard(m) < pr) {
        if (speed < 19 && hasard(m) < 0.4 + (gard - 75) * 0.015) { prendre(m, p, true, evs); m.arrets[p.id] += 1; evs.push({ type: 'arret', joueur: p.id, capte: true }); return; }
        // Il repousse : vers l'extérieur, loin du but.
        const s = m.equipes[p.e].sens;
        b.vx = s * (3 + hasard(m) * 4); b.vy = (hasard(m) - 0.5) * 10 + (b.y >= 0 ? 2 : -2); b.vz = 2 + hasard(m) * 3;
        b.dernier = p.id; b.tir = null; b.cible = -1;
        p.verrou = 20;
        m.arrets[p.id] += 1;
        evs.push({ type: 'arret', joueur: p.id, capte: false });
        return;
      }
      p.verrou = 40;
      evs.push({ type: 'frole', joueur: p.id });
      return;
    }
    if (!tirAdverse && speed < 24) { prendre(m, p, true, evs); return; }
  }
  if (p.etat === 'tacle') {
    const sp = 5.5 + hasard(m) * 1.5;
    b.vx = p.dx * sp + p.vx * 0.15; b.vy = p.dy * sp + p.vy * 0.15; b.vz = 0.8;
    b.dernier = p.id; b.tir = null; b.cible = -1; b.passeur = -1;
    p.verrou = 6;
    evs.push({ type: 'tacle', joueur: p.id, reussi: true });
    return;
  }
  let seuil = 11.5 + p.n.passe * 0.05;
  if (b.cible === p.id) seuil += 7;
  if (b.z > 0.7) seuil -= 3;
  if (tirAdverse) seuil -= 3;
  if (p.etat === 'normal' && speed <= seuil) { prendre(m, p, false, evs); return; }
  // Trop fort (ou en plein plongeon) : le ballon rebondit sur lui.
  let nx = b.x - p.x, ny = b.y - p.y;
  const l = Math.sqrt(nx * nx + ny * ny) || 1;
  nx /= l; ny /= l;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
  b.vx *= 0.5; b.vy *= 0.5; b.vz = 1 + hasard(m) * 2;
  b.dernier = p.id; b.cible = -1; b.passeur = -1;
  if (b.tir) b.tir.teste = b.tir.teste || p.i === 0;
  p.verrou = 10;
  evs.push({ type: 'contre', joueur: p.id });
}

function prendre(m, p, mains, evs) {
  const b = m.ballon, eq = m.equipes[p.e];
  const pourLui = b.cible === p.id, enLAir = b.z > 0.45;
  const passeur = b.cible === p.id ? b.passeur : -1;
  if (passeur >= 0 && passeur !== p.id && m.joueurs[passeur].e === p.e) m.dernierePasse = { de: passeur, a: p.id, f: m.f };
  const recupere = b.dernier >= 0 && m.joueurs[b.dernier].e !== p.e;
  // L'équipe qui vient de perdre le ballon : trois secondes pour le contre-pressing (si c'est son style).
  if (recupere) m.equipes[1 - p.e].contre = 180;
  b.porteur = p.id; b.vx = 0; b.vy = 0; b.vz = 0;
  b.tir = null; b.cible = -1; b.passeur = -1; b.tireur = -1; b.dernier = p.id;
  p.recu = 0; p.dec = 3; p.charge = 0; p.chargeP = 0;
  if (mains) { p.etat = 'tient'; p.dec = 40 + Math.floor(hasard(m) * 30); p.vx *= 0.3; p.vy *= 0.3; }
  else evs.push({ type: 'controle', joueur: p.id, recupere });
  if (eq.ctrl === 'humain' && p.i > 0) eq.actif = p.id;
  if (mains) return;
  // Le geste préparé par l'humain : une reprise ou une remise en une touche.
  if (p.reprise > 0 && (pourLui || p.reprise <= 26)) {
    // Du premier coup : une reprise de volée si le ballon arrive en l'air (plus forte), sinon une frappe en première intention.
    p.reprise = 0;
    if (enLAir) p.volee = 30;
    tirer(m, p, enLAir ? 0.95 : 0.85, p.vise, evs, enLAir ? 'volee' : 'premiere');
  }
  else if (p.remise > 0) {
    p.remise = 0;
    const r = p.rx || p.ry ? choisirReceveur(m, p, p.rx, p.ry) : meilleurReceveur(m, p);
    if (r >= 0) passer(m, p, m.joueurs[r], false, evs, false, 0.6, true);
  }
}

/** Autour du porteur : les tacles glissés et le ballon chipé dans les pieds. */
function duels(m, evs) {
  const b = m.ballon, c = m.joueurs[b.porteur];
  if (c.etat === 'tient') return;
  for (let k = 0; k < 10; k++) {
    const q = m.joueurs[k];
    if (q.e === c.e || q.verrou > 0) continue;
    if (q.etat === 'tacle') {
      const fx = q.x + q.dx * 0.45, fy = q.y + q.dy * 0.45;
      if (dist(fx, fy, b.x, b.y) < 0.75) {
        const sp = 4.5 + hasard(m) * 2;
        b.porteur = -1; b.vx = q.dx * sp; b.vy = q.dy * sp; b.vz = 0.6;
        b.dernier = q.id; b.tir = null; b.cible = -1; b.passeur = -1; b.tireur = -1;
        c.etat = 'sol'; c.t = 24; c.charge = 0; c.verrou = 24;
        q.verrou = 5;
        evs.push({ type: 'tacle', joueur: q.id, victime: c.id, reussi: true });
        return;
      }
      if (dist(q.x, q.y, c.x, c.y) < 0.75) {
        // Raté : il fauche les jambes sans toucher le ballon. Le porteur trébuche, lui reste au sol.
        c.vx *= 0.3; c.vy *= 0.3;
        q.t = 0; q.verrou = 30;
        evs.push({ type: 'tacle', joueur: q.id, victime: c.id, reussi: false });
      }
      continue;
    }
    if (q.etat !== 'normal') continue;
    // Pendant la roulette, on ne lui chipe pas le ballon dans les pieds (un tacle glissé, si).
    if (c.geste > 0 && c.gesteType === 1) continue;
    if (q.i === 0 && !dansSurface(m, q)) continue;
    if (dist(q.x, q.y, b.x, b.y) > 0.62) continue;
    const eq = m.equipes[q.e];
    let pr = 0.04 + (q.n.defense - c.n.passe) * 0.0016;
    if (eq.ctrl === 'ia') pr *= niveauDe(eq).vol;
    if (Math.sqrt(c.vx * c.vx + c.vy * c.vy) > vitesseMax(c) * 1.05) pr *= 1.35;
    pr = clamp(pr, 0.012, 0.11);
    if (hasard(m) < pr) {
      b.porteur = -1;
      b.vx = q.dx * 2.6 + q.vx * 0.4; b.vy = q.dy * 2.6 + q.vy * 0.4; b.vz = 0;
      b.dernier = q.id; b.tir = null; b.cible = -1; b.passeur = -1; b.tireur = -1;
      c.verrou = 20; c.charge = 0;
      evs.push({ type: 'vol', joueur: q.id, victime: c.id });
      return;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Les tirs au but                                                     */
/* ------------------------------------------------------------------ */

const TAB_X = 14;

function debutTab(m, evs) {
  m.phase = 'tab';
  const ordre = (e) => [1, 2, 3, 4].sort((a, c) => m.joueurs[e * 5 + c].n.tir - m.joueurs[e * 5 + a].n.tir || a - c).concat([0]);
  m.tab = { tireur: hasard(m) < 0.5 ? 0 : 1, ordres: [ordre(0), ordre(1)], buts: [[], []], etape: 'place', t: 90, ia: 0, issue: null, plongeon: 0, cible: null };
  placerTab(m);
  evs.push({ type: 'tab' });
}

/** Le tireur et le gardien de ce tir. */
export function acteursTab(m) {
  const tb = m.tab, e = tb.tireur;
  const n = tb.buts[e].length;
  return { tireur: m.joueurs[e * 5 + tb.ordres[e][n % 5]], gardien: m.joueurs[(1 - e) * 5] };
}

function placerTab(m) {
  const { tireur, gardien } = acteursTab(m);
  let k = 0;
  for (const p of m.joueurs) {
    Object.assign(p, { vx: 0, vy: 0, etat: 'normal', t: 0, charge: 0, verrou: 0, frappe: 0, vise: 0 });
    if (p === tireur) { p.x = TAB_X - 0.5; p.y = 0; p.dx = 1; p.dy = 0; }
    else if (p === gardien) { p.x = DEMI_L - 0.4; p.y = 0; p.dx = -1; p.dy = 0; }
    else {
      // Les autres attendent au milieu, bras dessus bras dessous.
      p.x = (p.e === 0 ? -1.2 : 1.2) + (k % 2) * 0.1; p.y = -3.5 + (k % 4) * 2.3; p.dx = 1; p.dy = 0;
      if (p.e === 1) p.y = -3.5 + ((k - 4) % 4) * 2.3;
      k += 1;
    }
  }
  Object.assign(m.ballon, { x: TAB_X, y: 0, z: 0, vx: 0, vy: 0, vz: 0, porteur: -1, dernier: tireur.id, passeur: -1, cible: -1, tireur: tireur.id, tir: null, dansBut: false });
  m.tab.etape = 'place';
  m.tab.t = 80;
  m.tab.issue = null;
}

function tirsAuBut(m, k, ap, rel, evs) {
  const tb = m.tab, b = m.ballon;
  const { tireur, gardien } = acteursTab(m);
  const te = tireur.e, ge = gardien.e;
  for (const p of m.joueurs) if (p.frappe > 0) p.frappe -= 1;
  if (tb.etape === 'place') {
    if (--tb.t <= 0) { tb.etape = 'vise'; tb.t = 360; tb.ia = 40 + Math.floor(hasard(m) * 50); tireur.charge = 0; evs.push({ type: 'sifflet', n: 1 }); }
    return;
  }
  if (tb.etape === 'vise') {
    tb.t -= 1;
    let tir = null;
    if (m.equipes[te].ctrl === 'humain') {
      const kk = k[te];
      const my = (kk & T.h ? 1 : 0) - (kk & T.b ? 1 : 0);
      if (my) tireur.vise = my;
      if (ap[te] & T.B) tireur.charge = 1;
      else if (kk & T.B && tireur.charge > 0) { tireur.charge += 1; if (tireur.charge >= CHARGE_MAX + 12) tir = { puissance: 1, vise: tireur.vise }; }
      else if (rel[te] & T.B && tireur.charge > 0) tir = { puissance: Math.min(1, tireur.charge / CHARGE_MAX), vise: my || tireur.vise };
      if (!tir && tb.t <= 0) tir = { puissance: 0.6, vise: tireur.vise };
      if (!(kk & T.B) && !tir && tireur.charge === 0 && !my && tb.t > 300) tireur.vise = 0;
    } else if (--tb.ia <= 0) {
      const r = hasard(m);
      tir = { puissance: 0.55 + hasard(m) * 0.4, vise: r < 0.42 ? -1 : r < 0.84 ? 1 : 0 };
    }
    if (!tir) return;
    // Le gardien choisit son côté au moment de la frappe.
    const gard = gardien.n.gardien + bonusGardien(m.equipes[ge]);
    let plongeon;
    if (m.equipes[ge].ctrl === 'humain') plongeon = (k[ge] & T.h ? 1 : 0) - (k[ge] & T.b ? 1 : 0);
    else {
      const bon = tir.vise;
      if (hasard(m) < 0.34 + (gard - 70) * 0.008) plongeon = bon;
      else { const autres = [-1, 0, 1].filter((v) => v !== bon); plongeon = autres[hasard(m) < 0.5 ? 0 : 1]; }
    }
    const pu = clamp(tir.puissance, 0.2, 1), p3 = pu * pu * pu;
    let ty = tir.vise * 1.05 + gauss(m) * (0.1 + (1 - tireur.n.tir / 100) * 0.45 + p3 * 0.25);
    const tz = Math.max(0.15, 0.25 + pu * 1.2 + gauss(m) * (0.06 + p3 * 0.3));
    const cote = Math.abs(ty) < 0.45 ? 0 : ty > 0 ? 1 : -1;
    let issue;
    if (Math.abs(ty) > DEMI_BUT - 0.05 || tz > BUT_H - 0.05) issue = 'rate';
    else if (plongeon === cote) {
      const ps = clamp(0.62 + (gard - 75) * 0.012 - (pu - 0.6) * 0.6 - (Math.abs(ty) > 1.1 ? 0.22 : 0), 0.12, 0.9);
      issue = hasard(m) < ps ? 'arret' : 'but';
    } else issue = 'but';
    // Le ballon part : il arrive sur la ligne en un tiers de seconde environ.
    const vit = 17 + pu * 9;
    const l = Math.sqrt((DEMI_L - b.x) * (DEMI_L - b.x) + ty * ty);
    const tv = l / vit;
    b.vx = ((DEMI_L - b.x) / l) * vit; b.vy = (ty / l) * vit; b.vz = (tz - b.z) / tv + (G * tv) / 2;
    tireur.frappe = 16; tireur.charge = 0;
    gardien.etat = plongeon ? 'plonge' : 'normal'; gardien.t = 40; gardien.vy = plongeon * 4.2; gardien.haut = tz > 1.1;
    tb.issue = issue; tb.plongeon = plongeon; tb.cible = { y: ty, z: tz };
    tb.etape = 'vol'; tb.t = Math.max(4, Math.round(((DEMI_L - 0.5 - b.x) / b.vx) * FPS));
    evs.push({ type: 'tir', joueur: tireur.id, puissance: pu });
    if (plongeon) evs.push({ type: 'plonge', joueur: gardien.id, cote: plongeon });
    return;
  }
  if (tb.etape === 'vol' || tb.etape === 'resultat') {
    gardien.y = clamp(gardien.y + gardien.vy * DT, -DEMI_BUT - 0.3, DEMI_BUT + 0.3);
    gardien.vy *= 0.93;
    if (gardien.t > 0) gardien.t -= 1;
    physiqueBallon(m, evs);
  }
  if (tb.etape === 'vol') {
    if (--tb.t > 0) return;
    if (tb.issue === 'arret') {
      b.vx = -(4 + hasard(m) * 3); b.vy = (hasard(m) - 0.5) * 6; b.vz = 2 + hasard(m) * 2;
      evs.push({ type: 'arret', joueur: gardien.id, capte: false });
    } else if (tb.issue === 'rate') evs.push({ type: 'tab-rate', joueur: tireur.id });
    else evs.push({ type: 'tab-but', joueur: tireur.id });
    tb.buts[te].push(tb.issue === 'but');
    tb.etape = 'resultat';
    tb.t = 110;
    return;
  }
  if (tb.etape === 'resultat') {
    if (--tb.t > 0) return;
    const [a, c] = tb.buts;
    const sa = a.filter(Boolean).length, sc = c.filter(Boolean).length;
    let v = -1;
    if (a.length <= 5 && c.length <= 5) {
      if (sa + (5 - a.length) < sc) v = 1;
      else if (sc + (5 - c.length) < sa) v = 0;
    }
    if (v < 0 && a.length >= 5 && a.length === c.length && sa !== sc) v = sa > sc ? 0 : 1;
    if (v >= 0) {
      m.phase = 'fin';
      m.vainqueur = v;
      evs.push({ type: 'fin', vainqueur: v, tab: true });
      return;
    }
    tb.tireur = 1 - tb.tireur;
    placerTab(m);
  }
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Le temps de la mi-temps en cours, à afficher : « 2:41 » (il descend). */
export function chronoTexte(m) {
  if (m.entrainement) return '∞';
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

/** Le vainqueur d'un match fini (0, 1, ou -1 pour un nul), tirs au but compris. */
export const vainqueur = (m) => m.vainqueur;

/** Joue un match entier sans humain (pour les tests et l'équilibrage). */
export function simuler(opts) {
  const m = creerMatch({ ...opts, controles: ['ia', 'ia'] });
  let garde = 0;
  while (m.phase !== 'fin' && garde++ < 200000) pas(m, [0, 0]);
  return m;
}
