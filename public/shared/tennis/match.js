/**
 * REVERS — le moteur d'un match de tennis (un contre un), image par image.
 *
 * Déterministe : avec la même graine et les mêmes touches, deux appareils jouent exactement le même match
 * (le jeu en ligne en dépend, comme le foot, le basket et la boxe).
 *
 * Comment on frappe : on appuie sur un coup (lift, slice, lob, amortie) avant que la balle arrive ; tant
 * qu'on tient le bouton, le coup se charge (plus fort, mais moins précis). Le joueur frappe tout seul dès
 * que la balle passe à sa portée. Le stick, au moment de la frappe, choisit la direction (gauche, droite)
 * et la profondeur (vers le haut : plus long, vers le bas : plus court). Une balle haute près du filet
 * devient un smash ; une balle prise avant le rebond, une volée.
 *
 * Le service : un appui lance la balle, un second la frappe (le meilleur moment : tout en haut). Le stick
 * choisit où viser dans le carré de service. Deux fautes : double faute.
 *
 * Le comptage : 15, 30, 40, égalité, avantage ; les jeux, les sets (FORMATS), le tie-break à égalité.
 *
 * pas(m, entrees) rend les événements de l'image : lancer, frappe, rebond, filet, faute, point, jeu, set,
 * tiebreak, fin.
 */

import { FPS, LONG, DEMI_SIMPLE, SERVICE, RAYON, COUPS, BOUTONS, T, hasard, gauss, clamp, dist, sens, vitesseMax, avancerBalle, viser } from './terrain.js';
import { JOUEUR, SURFACES, STYLES } from './joueurs.js';
import { decider } from './ia.js';

export { FPS, T, COUPS, LONG, DEMI_SIMPLE, SERVICE };

export const FORMATS = {
  court: { nom: '1 set de 3 jeux', jeux: 3, sets: 1 },
  normal: { nom: '1 set de 6 jeux', jeux: 6, sets: 1 },
  long: { nom: '2 sets gagnants (4 jeux)', jeux: 4, sets: 2 },
};
/** La pause entre deux points, et après une faute de service (images). */
const PAUSE_POINT = 100, PAUSE_FAUTE = 55;

function joueur(id, e, ctrl, niveau) {
  const x = JOUEUR[id];
  return { e, id, n: x.notes, style: x.style, ctrl, niveau, x: 0, y: -sens(e) * LONG, vx: 0, vy: 0, prepa: null, anim: null, recup: 0, lance: false, dPrec: -1, ia: {} };
}

const balleVide = () => ({ x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, grav: 1, rebondK: 0.72, rebondH: 0.62, rebonds: 0, dernier: -1, service: false, filet: false, tenue: true, touche: false });

/**
 * Un nouveau match. o : { joueurs: [id, id], graine, format, surface, controles, niveaux, entrainement }
 * entrainement : { serveur: 'moi' | 'lui' } — pas de score, pas de fin (le joueur 0 est « moi »).
 */
export function creerMatch({ joueurs, graine = 1, format = 'court', surface = 'dur', controles = ['humain', 'ia'], niveaux = [1, 1], entrainement = null }) {
  const m = {
    f: 0, t: 0, alea: (graine >>> 0) || 1, format: FORMATS[format] ? format : 'court', surface: SURFACES[surface] ? surface : 'dur',
    joueurs: joueurs.map((id, e) => joueur(id, e, controles[e], niveaux[e])),
    balle: balleVide(), phase: 'service', serveur: 0, serveurJeu: 0, deuxieme: false, echange: 0,
    score: { points: [0, 0], jeux: [0, 0], sets: [], setsGagnes: [0, 0], tb: false },
    stats: { aces: [0, 0], doubles: [0, 0], gagnants: [0, 0], fautes: [0, 0], points: [0, 0], premiers: [0, 0], premiersTentes: [0, 0], filets: [0, 0], plusLong: 0, vitesseMax: [0, 0] },
    vainqueur: -1, entrainement, prec: [0, 0],
  };
  m.F = FORMATS[m.format];
  m.serveurJeu = m.serveur = entrainement ? (entrainement.serveur === 'lui' ? 1 : 0) : hasard(m) < 0.5 ? 0 : 1;
  placerService(m);
  return m;
}

/** Les réglages de l'entraînement, changés en cours de route (depuis la pause). */
export function reglerEntrainement(m, o) {
  m.entrainement = { ...m.entrainement, ...o };
  m.joueurs[1].niveau = o.niveau ?? m.joueurs[1].niveau;
  m.serveurJeu = m.serveur = m.entrainement.serveur === 'lui' ? 1 : 0;
  m.deuxieme = false;
  placerService(m);
}

/** Le côté du service : à droite (égalité) quand le total des points du jeu est pair. */
const cotEgalite = (m) => (m.score.points[0] + m.score.points[1]) % 2 === 0;

/** Tout le monde en place pour un service. */
function placerService(m) {
  const sv = m.joueurs[m.serveur], rc = m.joueurs[1 - m.serveur];
  const ss = sens(sv.e), sr = sens(rc.e), eg = cotEgalite(m);
  Object.assign(sv, { x: ss * (eg ? 0.7 : -0.7), y: -ss * (LONG + 0.25), vx: 0, vy: 0, prepa: null, lance: false, recup: 0, dPrec: -1, ia: {} });
  Object.assign(rc, { x: sr * (eg ? 2.5 : -2.5), y: -sr * (LONG - 0.3), vx: 0, vy: 0, prepa: null, lance: false, recup: 0, dPrec: -1, ia: {} });
  m.balle = { ...balleVide(), x: sv.x + ss * 0.25, y: sv.y + ss * 0.2, z: 1, dernier: -1 };
  m.phase = 'service';
  m.t = 0;
  m.echange = 0;
}

/** Une image du match. entrees : les touches des deux joueurs (celles de l'ordinateur sont décidées ici). */
export function pas(m, entrees = [0, 0]) {
  m.f += 1;
  m.t += 1;
  const evs = [];
  const ent = [0, 1].map((e) => (m.joueurs[e].ctrl === 'ia' ? decider(m, e) : (entrees[e] | 0)));
  const neuf = ent.map((x, e) => x & ~m.prec[e]);
  m.prec = ent;
  for (const p of m.joueurs) {
    if (p.anim) { p.anim.t += 1; if (p.anim.t > 34) p.anim = null; }
    if (p.recup > 0) p.recup -= 1;
  }
  if (m.phase === 'fin') { for (const p of m.joueurs) freiner(p); return evs; }
  if (m.phase === 'point' || m.phase === 'faute') {
    for (const p of m.joueurs) freiner(p);
    const b = m.balle;
    if (!b.tenue) avancerBalle(b);
    if (m.t >= (m.phase === 'faute' ? PAUSE_FAUTE : PAUSE_POINT)) placerService(m);
    return evs;
  }
  for (const p of m.joueurs) deplacer(m, p, ent[p.e]);
  if (m.phase === 'service') service(m, ent, neuf, evs);
  else jeu(m, ent, neuf, evs);
  return evs;
}

/** Le joueur s'arrête doucement (entre deux points). */
function freiner(p) {
  p.vx *= 0.85; p.vy *= 0.85;
  p.x += p.vx / FPS; p.y += p.vy / FPS;
}

/** Les déplacements : le stick, dans le sens où le joueur regarde ; il ralentit quand il arme son coup. */
function deplacer(m, p, ent) {
  const s = sens(p.e);
  let mx = ((ent & T.d) ? 1 : 0) - ((ent & T.g) ? 1 : 0);
  let my = ((ent & T.h) ? 1 : 0) - ((ent & T.b) ? 1 : 0);
  // Au service, le serveur ne bouge que le long de sa ligne, une fois la balle lancée il est planté.
  const serveur = m.phase === 'service' && p.e === m.serveur;
  if (serveur) { my = 0; if (p.lance) mx = 0; }
  const n = Math.sqrt(mx * mx + my * my) || 1;
  const v = vitesseMax(p) * (p.prepa ? 0.78 : 1) * (p.recup > 0 ? 0.45 : 1);
  let tvx = (mx / n) * v * s;
  const tvy = (my / n) * v * s;
  // L'aide au placement (pour un humain) : coup armé, sans toucher la direction, il se met dans l'axe de la
  // balle qui arrive (en coup droit si possible), sans avancer ni reculer.
  const b = m.balle;
  if (p.ctrl === 'humain' && p.prepa && mx === 0 && my === 0 && b.dernier >= 0 && b.dernier !== p.e && b.vy * s < -0.5) {
    const t = (p.y - b.y) / b.vy;
    const bx = b.x + b.vx * clamp(t, 0, 2);
    const cible = bx - s * 0.6;
    tvx = clamp((cible - p.x) * 6, -v * 0.6, v * 0.6);
  }
  const acc = 30 / FPS;
  p.vx += clamp(tvx - p.vx, -acc, acc);
  p.vy += clamp(tvy - p.vy, -acc, acc);
  p.x += p.vx / FPS; p.y += p.vy / FPS;
  // Les limites : son côté du filet, et pas trop loin dans les tribunes.
  p.x = clamp(p.x, -DEMI_SIMPLE - 3.2, DEMI_SIMPLE + 3.2);
  const yMin = 0.45, yMax = LONG + 5;
  if (s > 0) p.y = clamp(p.y, -yMax, -yMin); else p.y = clamp(p.y, yMin, yMax);
  if (serveur) {
    const eg = cotEgalite(m);
    // Il reste derrière sa ligne, de son côté de la marque centrale.
    p.y = -s * (LONG + 0.25);
    const cote = s * (eg ? 1 : -1);
    p.x = cote > 0 ? clamp(p.x, 0.25, DEMI_SIMPLE - 0.3) : clamp(p.x, -DEMI_SIMPLE + 0.3, -0.25);
  }
}

/** Le stick, dans le repère du terrain : x vers la droite du court, y vers le fond adverse (+1) ou vers soi (-1). */
function stick(e, ent) {
  const s = sens(e);
  return { ax: (((ent & T.d) ? 1 : 0) - ((ent & T.g) ? 1 : 0)) * s, ay: ((ent & T.h) ? 1 : 0) - ((ent & T.b) ? 1 : 0) };
}

/* ---------------- Le service ---------------- */

function service(m, ent, neuf, evs) {
  const p = m.joueurs[m.serveur], b = m.balle, s = sens(p.e);
  const appui = (neuf[p.e] & (T.A | T.B | T.X | T.G)) !== 0;
  if (!p.lance) {
    // La balle dans la main, devant lui.
    b.x = p.x + s * 0.25; b.y = p.y + s * 0.2; b.z = 1;
    if (appui) {
      p.lance = true;
      Object.assign(b, { tenue: false, x: p.x + s * 0.12, y: p.y + s * 0.35, z: 1.25, vx: 0, vy: 0, vz: 5.3, grav: 1 });
      evs.push({ type: 'lancer', e: p.e });
    }
    return;
  }
  // La balle monte puis redescend.
  b.vz -= 9.81 / FPS;
  b.z += b.vz / FPS;
  if (appui && b.z > 1.55) { servir(m, p, ent[p.e], evs); return; }
  if (b.z < 1.1 && b.vz < 0) {
    // Pas frappée : on la rattrape, on relance.
    p.lance = false;
    b.tenue = true;
    evs.push({ type: 'relance', e: p.e });
  }
}

function servir(m, p, ent, evs) {
  const b = m.balle, s = sens(p.e), n = p.n, S = SURFACES[m.surface];
  const eg = cotEgalite(m);
  // Le carré visé : en diagonale (côté égalité : à gauche du serveur vu de face… donc de l'autre côté de x).
  const signe = eg ? -s : s;
  const { ax } = stick(p.e, ent);
  const q = clamp(1 - Math.abs(b.z - 2.55) * 1.1, 0.25, 1);
  const nk = (n.service - 50) / 50;
  let tx = signe * 2.05 + ax * 1.55;
  tx = signe > 0 ? clamp(tx, 0.3, DEMI_SIMPLE - 0.25) : clamp(tx, -DEMI_SIMPLE + 0.25, -0.3);
  let ty = s * (SERVICE - 0.75);
  const C = COUPS.service;
  let vh = C.vitesse[0] + (C.vitesse[1] - C.vitesse[0]) * clamp(0.2 + 0.55 * nk + 0.25 * q, 0, 1);
  if (m.deuxieme) vh *= 0.72;
  vh *= S.vitesse;
  const sigma = (0.42 + (1 - q) * 0.95 + (1 - nk) * 0.5) * (m.deuxieme ? 0.42 : 1);
  tx += gauss(m) * sigma * 0.75;
  ty += gauss(m) * sigma * 0.85;
  const grav = m.deuxieme ? 1.55 : 1.12;
  const t = viser(b.x, b.y, b.z, tx, ty, vh, grav, (m.deuxieme ? 0.3 : 0.06) + gauss(m) * sigma * 0.07);
  Object.assign(b, { vx: t.vx, vy: t.vy, vz: t.vz, grav, rebondK: C.rebondK * S.rebondK, rebondH: C.rebondH * S.rebondH, rebonds: 0, dernier: p.e, service: true, filet: false, tenue: false, touche: false });
  m.phase = 'jeu';
  m.t = 0;
  m.echange = 1;
  p.lance = false;
  p.anim = { type: 'service', cote: 'cd', t: 0 };
  p.recup = 14;
  if (!m.deuxieme) m.stats.premiersTentes[p.e] += 1;
  const kmh = Math.round(vh * 3.6);
  m.stats.vitesseMax[p.e] = Math.max(m.stats.vitesseMax[p.e], kmh);
  evs.push({ type: 'frappe', e: p.e, coup: 'service', cote: 'cd', qualite: q, vitesse: kmh, deuxieme: m.deuxieme });
}

/* ---------------- L'échange ---------------- */

/** La balle est-elle à la portée de ce joueur (et peut-il la jouer) ? Rend la distance, ou -1. */
export function portee(m, p) {
  const b = m.balle;
  if (b.tenue || b.filet || b.dernier === p.e || b.dernier < 0) return -1;
  if (b.y * sens(p.e) > 0.05) return -1; // pas encore de son côté
  if (b.service && b.rebonds === 0) return -1; // le retour de service se joue après le rebond
  if (b.rebonds > 1) return -1;
  if (b.rebonds === 0 && b.z < 0.45 && b.vz < 0) return -1; // une balle basse qui tombe : on la laisse rebondir
  if (b.z < 0.06 || b.z > 3.05) return -1;
  const d = dist(b.x, b.y, p.x, p.y + sens(p.e) * 0.15);
  // De volée (avant le rebond), il faut être plus près de la balle, et d'autant plus qu'elle arrive vite.
  const vin = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const allonge = b.rebonds === 0 ? 0.95 - Math.max(0, vin - 16) * 0.035 + (p.n.volee - 70) * 0.006 : 1.3;
  return d <= Math.max(0.45, allonge) + p.n.vitesse * 0.003 ? d : -1;
}

function jeu(m, ent, neuf, evs) {
  const b = m.balle;
  if (b.tenue || b.dernier < 0) return;
  // Les coups qu'on arme (un appui), qui se chargent tant qu'on tient le bouton.
  // On n'arme que contre une balle qui vient (pas la sienne) ; un bouton tenu arme dès qu'elle part de chez l'autre.
  for (const p of m.joueurs) {
    if (b.dernier === p.e || b.dernier < 0) { p.prepa = null; continue; }
    for (const [type, bit] of Object.entries(BOUTONS)) {
      if ((neuf[p.e] & bit) || (!p.prepa && (ent[p.e] & bit))) p.prepa = { type, t: 0, bit };
    }
    if (p.prepa && (ent[p.e] & p.prepa.bit)) p.prepa.t += 1;
  }
  // La frappe, pour un joueur qui a armé son coup : quand la balle est au plus près (assez près, ou elle commence à s'éloigner).
  for (const p of m.joueurs) {
    if (!p.prepa) { p.dPrec = -1; continue; }
    const d = portee(m, p);
    if (d < 0) { p.dPrec = -1; continue; }
    if (d <= 0.7 || (p.dPrec >= 0 && d > p.dPrec + 0.002)) { p.dPrec = -1; frapper(m, p, ent[p.e], d, evs); break; }
    p.dPrec = d;
  }
  const r = avancerBalle(b);
  if (r === 'filet') {
    m.stats.filets[b.dernier] += 1;
    if (b.service) { fauteService(m, evs, 'filet'); return; }
    m.stats.fautes[b.dernier] += 1;
    finPoint(m, 1 - b.dernier, 'filet', evs);
    return;
  }
  if (r === 'rebond') {
    b.rebonds += 1;
    evs.push({ type: 'rebond', x: b.x, y: b.y, n: b.rebonds });
    const camp = b.y < 0 ? 0 : 1; // le côté du joueur 0 est y < 0
    if (b.rebonds === 1) {
      // Le premier rebond : de l'autre côté du frappeur, dans le court (dans le carré, pour un service).
      const dedans = b.service ? dansCarre(m, b) : camp !== b.dernier && Math.abs(b.x) <= DEMI_SIMPLE + RAYON && Math.abs(b.y) <= LONG + RAYON;
      if (!dedans) {
        if (b.service) { fauteService(m, evs, 'dehors'); return; }
        m.stats.fautes[b.dernier] += 1;
        finPoint(m, 1 - b.dernier, 'dehors', evs, { x: b.x, y: b.y });
        return;
      }
      if (b.service && !m.deuxieme) m.stats.premiers[b.dernier] += 1;
      if (b.service && m.deuxieme) m.balle.secondeBonne = true;
    } else if (b.rebonds >= 2) {
      // Deux rebonds : le point est au dernier frappeur.
      const ace = b.service && !b.touche;
      if (ace) m.stats.aces[b.dernier] += 1;
      m.stats.gagnants[b.dernier] += 1;
      finPoint(m, b.dernier, ace ? 'ace' : 'gagnant', evs);
      return;
    }
  }
  // La balle s'en va dans les tribunes (au-delà de tout).
  if (Math.abs(b.y) > LONG + 9 || Math.abs(b.x) > DEMI_SIMPLE + 8) {
    // Déjà rebondie dans le court : personne ne l'a rattrapée, le point est au frappeur.
    if (b.rebonds >= 1) {
      const ace = b.service && !b.touche;
      if (ace) m.stats.aces[b.dernier] += 1;
      m.stats.gagnants[b.dernier] += 1;
      finPoint(m, b.dernier, ace ? 'ace' : 'gagnant', evs);
      return;
    }
    if (b.service) { fauteService(m, evs, 'dehors'); return; }
    m.stats.fautes[b.dernier] += 1;
    finPoint(m, 1 - b.dernier, 'dehors', evs);
  }
}

/** Le premier rebond d'un service : dans le carré visé ? */
function dansCarre(m, b) {
  const s = sens(b.dernier), eg = cotEgalite(m);
  const signe = eg ? -s : s;
  const yy = b.y * s; // de l'autre côté : yy > 0
  if (yy < -RAYON || yy > SERVICE + RAYON) return false;
  const xx = b.x * signe;
  return xx >= -RAYON && xx <= DEMI_SIMPLE + RAYON;
}

function frapper(m, p, ent, d, evs) {
  const b = m.balle, s = sens(p.e), n = p.n, S = SURFACES[m.surface];
  let type = p.prepa.type;
  const auVol = b.rebonds === 0;
  if (b.z > 2.15 && type !== 'amortie' && type !== 'lob') type = 'smash';
  else if (auVol && (type === 'lift' || type === 'slice')) type = 'volee';
  const cote = (b.x - p.x) * s >= 0 ? 'cd' : 'rv';
  const note = type === 'volee' || type === 'smash' ? n.volee : cote === 'cd' ? n.coupDroit : n.revers;
  const nk = (note - 50) / 50;
  const charge = clamp(p.prepa.t / 40, 0, 1);
  const vit = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  // Une balle qui arrive vite est plus dure à bien reprendre (surtout de volée).
  const vin = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const durete = Math.max(0, vin - 12) * (auVol ? 0.03 : 0.018);
  const qualite = clamp(1 - Math.max(0, d - 0.7) * 0.55 - Math.abs(b.z - 1) * 0.11 - vit * 0.025 - durete, 0.2, 1);
  const C = COUPS[type];
  const { ax, ay } = stick(p.e, ent);
  const prof = C.prof[0] + (C.prof[1] - C.prof[0]) * clamp(0.55 + ay * 0.45, 0, 1);
  // Sans direction : on croise un peu (vers le côté opposé à celui où l'on est).
  let tx = ax !== 0 ? ax * 3.05 : Math.abs(p.x) > 0.8 ? -Math.sign(p.x) * 1.4 : 0;
  let ty = s * LONG * prof;
  let vh = C.vitesse[0] + (C.vitesse[1] - C.vitesse[0]) * clamp(0.3 * charge + 0.45 * nk + 0.25 * qualite, 0, 1);
  vh *= S.vitesse;
  const sigma = C.err * (0.2 + (1 - qualite) * 0.95 + charge * charge * 0.6 + (1 - nk) * 0.5);
  tx += gauss(m) * sigma * 0.85;
  ty += gauss(m) * sigma * 1.05;
  const t = viser(b.x, b.y, b.z, tx, ty, vh, C.grav, C.marge * (0.55 + 0.45 * qualite) + gauss(m) * sigma * 0.22);
  Object.assign(b, { vx: t.vx, vy: t.vy, vz: t.vz, grav: C.grav, rebondK: C.rebondK * S.rebondK, rebondH: C.rebondH * S.rebondH, rebonds: 0, dernier: p.e, service: false, filet: false, touche: true });
  m.echange += 1;
  m.stats.plusLong = Math.max(m.stats.plusLong, m.echange);
  p.prepa = null;
  p.anim = { type, cote, t: 0 };
  p.recup = 8;
  // L'ordinateur, s'il aime le filet, y monte après une bonne attaque.
  if (p.ctrl === 'ia') p.ia.monte = type !== 'lob' && hasard(m) < (STYLES[p.style]?.filet || 0) * (type === 'volee' || type === 'smash' ? 1.6 : 1);
  evs.push({ type: 'frappe', e: p.e, coup: type, cote, qualite, puissance: charge, vitesse: Math.round(vh * 3.6) });
}

/* ---------------- Les fautes, les points, le score ---------------- */

function fauteService(m, evs, raison) {
  const sv = m.serveur;
  if (!m.deuxieme) {
    m.deuxieme = true;
    evs.push({ type: 'faute', e: sv, raison });
    m.phase = 'faute';
    m.t = 0;
    return;
  }
  m.stats.doubles[sv] += 1;
  evs.push({ type: 'faute', e: sv, raison, double: true });
  finPoint(m, 1 - sv, 'doublefaute', evs);
}

function finPoint(m, g, raison, evs, ou = null) {
  m.deuxieme = false;
  m.phase = 'point';
  m.t = 0;
  m.stats.points[g] += 1;
  for (const p of m.joueurs) p.prepa = null;
  evs.push({ type: 'point', gagnant: g, raison, echange: m.echange, ...(ou ? { ou } : {}) });
  if (m.entrainement) return;
  marquer(m, g, evs);
}

/** Donne un point à g, comme s'il venait de le gagner (les tests du comptage). Rend les événements. */
export function donnerPoint(m, g) {
  const evs = [];
  finPoint(m, g, 'gagnant', evs);
  if (m.phase !== 'fin') placerService(m);
  return evs;
}

function marquer(m, g, evs) {
  const S = m.score;
  S.points[g] += 1;
  const a = S.points[g], b = S.points[1 - g];
  if (S.tb) {
    if (a >= 7 && a - b >= 2) { gagnerJeu(m, g, evs); return; }
    // Au tie-break : le service change après le premier point, puis tous les deux points.
    if ((a + b) % 2 === 1) m.serveur = 1 - m.serveur;
    return;
  }
  if (a >= 4 && a - b >= 2) gagnerJeu(m, g, evs);
}

function gagnerJeu(m, g, evs) {
  const S = m.score, F = m.F;
  const etaitTb = S.tb;
  S.jeux[g] += 1;
  S.points = [0, 0];
  const brk = !etaitTb && g !== m.serveurJeu;
  evs.push({ type: 'jeu', gagnant: g, jeux: [...S.jeux], break: brk });
  m.serveurJeu = 1 - m.serveurJeu;
  m.serveur = m.serveurJeu;
  const n = F.jeux;
  if (etaitTb || (S.jeux[g] >= n && S.jeux[g] - S.jeux[1 - g] >= 2)) {
    S.sets.push([...S.jeux]);
    S.setsGagnes[g] += 1;
    S.jeux = [0, 0];
    S.tb = false;
    evs.push({ type: 'set', gagnant: g, sets: S.sets.map((x) => [...x]) });
    if (S.setsGagnes[g] >= F.sets) {
      m.vainqueur = g;
      m.phase = 'fin';
      evs.push({ type: 'fin', vainqueur: g });
    }
    return;
  }
  if (S.jeux[0] === n && S.jeux[1] === n) { S.tb = true; evs.push({ type: 'tiebreak' }); }
}

/* ---------------- Pour l'affichage ---------------- */

const NOMS_POINTS = ['0', '15', '30', '40'];
/** Les points du jeu en cours, à la façon du tennis : ['30', '15'], ['40', 'AV'], ['ÉG.', ''], ou les points du tie-break. */
export function pointsTexte(m) {
  const [a, b] = m.score.points;
  if (m.score.tb) return [String(a), String(b)];
  if (a >= 3 && b >= 3) {
    if (a === b) return ['40', '40'];
    return a > b ? ['AV', ''] : ['', 'AV'];
  }
  return [NOMS_POINTS[Math.min(3, a)], NOMS_POINTS[Math.min(3, b)]];
}

/** Le moment à souligner : balle de break, de set, de match (pour le joueur g), ou null. */
export function enjeu(m) {
  if (m.entrainement || m.phase === 'fin') return null;
  const S = m.score, F = m.F;
  for (const g of [0, 1]) {
    // Gagner le point suivant donne-t-il le jeu ?
    const [a, b] = [S.points[g] + 1, S.points[1 - g]];
    const jeu = S.tb ? a >= 7 && a - b >= 2 : a >= 4 && a - b >= 2;
    if (!jeu) continue;
    const jeux = S.jeux[g] + 1, autres = S.jeux[1 - g];
    const set = S.tb || (jeux >= F.jeux && jeux - autres >= 2);
    if (set && S.setsGagnes[g] + 1 >= F.sets) return { type: 'match', e: g };
    if (set) return { type: 'set', e: g };
    if (g !== m.serveurJeu && !S.tb) return { type: 'break', e: g };
  }
  return null;
}

/** L'empreinte de l'état (le jeu en ligne compare celle des deux appareils). */
export function empreinte(m) {
  const b = m.balle, r = (v) => Math.round(v * 1000);
  return [m.f, m.alea, m.phase, r(b.x), r(b.y), r(b.z), ...m.joueurs.flatMap((p) => [r(p.x), r(p.y)]), ...m.score.points, ...m.score.jeux].join(',');
}

/** Un match entier sans affichage (les tests, le Tournoi quand je ne joue pas). */
export function simuler(opts) {
  const m = creerMatch({ ...opts, controles: ['ia', 'ia'] });
  let k = 0;
  while (m.phase !== 'fin' && k < 60 * 60 * 60) { pas(m, [0, 0]); k += 1; }
  return m;
}
