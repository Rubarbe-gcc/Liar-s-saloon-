/**
 * ROUCOULETTE — l'ordinateur : ce que fait chaque joueur qu'aucun humain ne
 * dirige (les deux équipes contre l'ordinateur, les coéquipiers de l'humain,
 * et toujours les gardiens).
 *
 * En attaque : chacun à son poste (deux ailiers dans les coins, deux arrières
 * et un demi-centre à neuf mètres, le pivot sur la zone, entre les
 * défenseurs) ; le porteur compare son tir (la chance de marquer : la
 * distance, l'angle, les bras devant lui, le gardien), le duel (le même tir
 * pris plus près, si la voie est libre) et ses passes ; plus la possession
 * dure, moins il est exigeant. Le ballon récupéré, les ailiers filent : la
 * contre-attaque.
 * En défense : une ligne devant la zone (6-0, 5-1 ou 3-2-1 selon le club)
 * qui glisse du côté du ballon ; le défenseur en face du porteur sort sur
 * lui ; on saute pour contrer, on tente des interceptions.
 * Le gardien : placé entre le ballon et le milieu de son but ; il relance
 * vite (et loin, si un coéquipier file seul).
 *
 * Le style du club (equipes.js, STYLES) règle tout cela.
 * Module partagé, sans DOM ; déterministe (le hasard vient du match).
 */

import {
  FPS, DEMI_L, DEMI_W, DEMI_BUT, ZONE, CHARGE_IDEALE, CHARGE_MAX,
  hasard, gauss, clamp, dist, distSegment, butX, distBut, zoneDe, sortirZone, chanceBut, blocage, trajectoire, allonge,
} from './terrain.js';
import { STYLES } from './equipes.js';

const N = 7;

/**
 * Les niveaux de l'ordinateur. Ses réflexes (reaction : images avant de sauter au contre),
 * le moment où il lâche ses tirs (precision), ses vols (vol), sa lecture des passes (lecture : ×),
 * et ce que le moteur lui applique : son adresse (adresse : l'écart de ses tirs, × ; plus petit, plus adroit),
 * sa vitesse de course (vitesse, ×), ses contres (contre, ×) et son gardien face à l'humain (gardien : +).
 * Normal : 1 partout (l'équilibre des clubs).
 */
export const NIVEAUX = [
  { nom: 'Facile', reaction: 16, precision: 6, vol: 0.3, lecture: 0.45, allure: 0.86, adresse: 1.35, vitesse: 0.9, contre: 0.4, gardien: -0.1 },
  { nom: 'Normal', reaction: 8, precision: 2.7, vol: 0.8, lecture: 1, allure: 1, adresse: 1, vitesse: 1, contre: 1, gardien: 0 },
  { nom: 'Difficile', reaction: 3, precision: 1.2, vol: 1.4, lecture: 1.25, allure: 1, adresse: 0.82, vitesse: 1.06, contre: 1.5, gardien: 0.07 },
];
export const niveauDe = (eq) => NIVEAUX[eq.ctrl === 'ia' ? eq.niveau : 1];

const RIEN = { mx: 0, my: 0, sprint: false, action: null };

/** Aller vers (x, y) : on ralentit en arrivant. o : { sprint, fx, fy (où regarder), allure } */
function vers(p, x, y, o = {}) {
  x = clamp(x, -DEMI_L + 0.4, DEMI_L - 0.4);
  y = clamp(y, -DEMI_W + 0.4, DEMI_W - 0.4);
  const dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.12) return { mx: 0, my: 0, sprint: false, action: null, fx: o.fx || 0, fy: o.fy || 0 };
  const f = Math.min(1, d / 1.1) * (o.allure ?? 1);
  return { mx: (dx / d) * f, my: (dy / d) * f, sprint: !!o.sprint && d > 2.2, action: null, fx: o.fx || 0, fy: o.fy || 0 };
}

/* ---------------- Les postes ---------------- */

/** Le poste d'attaque de p, « vu par son équipe » (X vers le but attaqué, à X = 20 ; Y vers sa gauche). */
export function posteAttaque(m, p) {
  const st = STYLES[m.equipes[p.e].style];
  const b = m.ballon, s = m.equipes[p.e].sens;
  const bY = b.y * s;
  const loin = st.loin > 1.2 ? 0.6 : 0;
  switch (p.i) {
    case 1: return { X: 18.6, Y: 8.2 };
    case 2: return { X: 10.6 - loin, Y: 5.4 };
    case 3: return { X: 10.2 - loin, Y: 0 };
    case 4: return { X: 10.6 - loin, Y: -5.4 };
    case 5: return { X: 18.6, Y: -8.2 };
    case 6: return { X: 13.4, Y: clamp(bY * 0.3, -2.6, 2.6) };
    default: return { X: -19, Y: 0 };
  }
}

/** Les places de la défense, de la gauche à la droite du but défendu : [Y, profondeur depuis le but]. */
const SYSTEMES = {
  '6-0': [[7.4, 6.5], [4.4, 6.6], [1.5, 6.6], [-1.5, 6.6], [-4.4, 6.6], [-7.4, 6.5]],
  '5-1': [[7.4, 6.5], [4.2, 6.6], [0, 9], [0.1, 6.6], [-4.2, 6.6], [-7.4, 6.5]],
  '3-2-1': [[7.2, 6.5], [4.4, 7.9], [0, 9.6], [0, 6.7], [-4.4, 7.9], [-7.2, 6.5]],
};
/** Quelle place pour quel joueur (son poste : 1 AG … 6 PV). */
const PLACE = [-1, 0, 1, 2, 4, 5, 3];

/**
 * Le poste de défense de p (même repère que posteAttaque : le but défendu est à X = -20).
 * bY : où est le ballon (Y, vu par l'équipe) : la ligne glisse de son côté.
 */
export function posteDefense(m, p, systeme, bY) {
  const sl = (SYSTEMES[systeme] || SYSTEMES['6-0'])[PLACE[p.i]];
  // La ligne défend « face » : la gauche de l'équipe en attaque est à sa droite en défense, mais on garde son côté du terrain.
  const glisse = clamp(bY * 0.32, -2.2, 2.2);
  const Y = clamp(sl[0] + glisse * (Math.abs(sl[0]) > 6 ? 0.4 : 1), -DEMI_W + 0.6, DEMI_W - 0.6);
  const prof = sl[1];
  // De la profondeur au point : autour du but (segment de -1,5 à 1,5).
  const ay = Math.abs(Y) - DEMI_BUT;
  let dx = prof;
  if (ay > 0) dx = ay < prof ? Math.sqrt(prof * prof - ay * ay) : 0.6;
  return { X: -DEMI_L + Math.max(0.6, dx), Y };
}

/* ---------------- Les valeurs ---------------- */

/** La valeur d'un tir de p pris en (x, y), à la façon du club. */
export function valeurTir(m, p, x, y, st, niv, gene = true) {
  const gx = butX(m, p.e);
  let v = chanceBut(m, p, x, y, 1 - niv.precision * 0.03, gene);
  const d = distBut(x, y, gx);
  if (d > 9.3) v *= 0.82 * st.loin;
  if (st.vedette) v *= p.vedette ? 1.1 : 0.92;
  return v;
}

/** Une passe vers r risque-t-elle l'interception ? (0 : non, jusqu'à 1) */
function risquePasse(m, p, r) {
  let risque = 0;
  for (let k = 1; k < N; k++) {
    const o = m.joueurs[(1 - p.e) * N + k];
    if (o.absent || m.equipes[o.e].immobile) continue;
    const { d, t } = distSegment(o.x, o.y, p.x, p.y, r.x, r.y);
    if (t > 0.08 && t < 0.97 && d < 1.1) risque = Math.max(risque, (1.1 - d) * (0.55 + (o.n.defense - 60) / 100));
  }
  return clamp(risque, 0, 1);
}

/** Le défenseur le plus proche de p (et sa distance). */
function marqueur(m, p) {
  let best = null, bd = 1e9;
  for (let k = 1; k < N; k++) {
    const o = m.joueurs[(1 - p.e) * N + k];
    if (o.absent) continue;
    const d = dist(o.x, o.y, p.x, p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return { o: best, d: bd };
}

/** La meilleure passe : { r, v } (ce que vaut le ballon chez le receveur, moins le risque). */
function meilleurePasse(m, p, st, niv) {
  let best = null, bv = -1;
  const gx = butX(m, p.e);
  for (let i = 1; i < N; i++) {
    const r = m.joueurs[p.e * N + i];
    if (r === p || r.z > 0 || r.absent || r.sortie) continue;
    const dR = distBut(r.x, r.y, gx);
    // Ce que vaut le ballon chez lui : son tir, ou mieux s'il peut aller au duel.
    let v = valeurTir(m, r, r.x, r.y, st, niv) * 0.92;
    if (dR > 9.5) v = Math.max(v, valeurTir(m, r, r.x + (gx - r.x) * 0.25, r.y * 0.85, st, niv) * 0.75);
    if (i === 6) v *= 1 + (st.pivot - 1) * 0.4;
    if ((i === 1 || i === 5) && p.i !== 1 && p.i !== 5) v *= 1 + (st.ailes - 1) * 0.4;
    if (st.vedette && r.vedette) v *= 1.2;
    // Seul devant le but (la contre-attaque) : la passe vaut un but.
    if (marqueur(m, r).d > 3.5 && dR < 11) v = Math.max(v, 0.7);
    const dP = dist(p.x, p.y, r.x, r.y);
    v *= 1 - risquePasse(m, p, r) * 0.9;
    if (dP > 12) v *= 1 - Math.min(0.4, (dP - 12) * 0.05);
    if (v > bv) { bv = v; best = r; }
  }
  return best ? { r: best, v: bv } : null;
}

/**
 * Remplit les consignes (cons[id]) des joueurs de l'équipe e qu'aucun humain ne dirige.
 * Une consigne : { mx, my, sprint, action, fx, fy }.
 */
export function decider(m, e, cons) {
  const eq = m.equipes[e], b = m.ballon;
  const st = STYLES[eq.style], niv = niveauDe(eq);
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const etat = porteur ? (porteur.e === e ? 'att' : 'def') : b.cible >= 0 ? (m.joueurs[b.cible].e === e ? 'att' : 'def') : 'libre';
  for (let i = 0; i < N; i++) {
    const p = m.joueurs[e * N + i];
    if (cons[p.id]) continue;
    if (p.absent || p.z > 0 || p.vz > 0) { cons[p.id] = RIEN; continue; }
    if (i === 0) { cons[p.id] = gardienIA(m, p, st, niv); continue; }
    if (eq.immobile) { cons[p.id] = RIEN; continue; }
    if (porteur === p) cons[p.id] = porteurIA(m, p, st, niv);
    else if (etat === 'att') cons[p.id] = appel(m, p, st, niv);
    else if (etat === 'def') cons[p.id] = defendre(m, p, st, niv);
    else cons[p.id] = balleLibre(m, p, st, niv);
    if (niv.allure < 1) { cons[p.id].mx *= niv.allure; cons[p.id].my *= niv.allure; }
  }
}

/* ---------------- Le gardien ---------------- */

function gardienIA(m, p, st, niv) {
  const b = m.ballon, s = m.equipes[p.e].sens;
  const gx = -s * DEMI_L;
  if (p.etat !== 'normal') return RIEN;
  // Il a le ballon : il relance (vite, et loin si quelqu'un file seul).
  if (b.porteur === p.id) {
    const attente = b.remise === p.id ? 30 + (p.id % 3) * 6 : 22;
    if (p.recu < attente) return vers(p, gx + s * 1.2, 0, { fx: s, fy: 0 });
    const mp = meilleurePasse(m, p, st, niv);
    if (mp) return { ...RIEN, action: { type: 'passe', cible: mp.r.id } };
    return RIEN;
  }
  // Un ballon libre dans sa zone : il va le chercher.
  if (b.porteur < 0 && !b.tir && zoneDe(b.x, b.y) === gx && b.z < 2.2) return vers(p, b.x, b.y, { fx: b.x - p.x, fy: b.y - p.y });
  // Sa place : entre le ballon et le milieu du but, un peu devant sa ligne.
  const dx = Math.abs(b.x - gx);
  const sort = dx > 14 ? 1.9 : 0.75 + dx * 0.05;
  const y = clamp((b.y * sort) / Math.max(1, dx), -1.35, 1.35);
  return vers(p, gx + s * sort, y, { fx: b.x - p.x, fy: b.y - p.y, allure: 1 });
}

/* ---------------- Le porteur ---------------- */

function porteurIA(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const gx = butX(m, p.e), s = eq.sens;
  // L'engagement : on attend un peu, puis la passe.
  if (b.remise === p.id) {
    if (m.t < 18 + (p.id % 3) * 5) return RIEN;
    const mp = meilleurePasse(m, p, st, niv);
    return { ...RIEN, action: { type: 'passe', cible: mp ? mp.r.id : p.e * N + (p.i === 2 ? 4 : 2) } };
  }
  if (p.etat !== 'normal') return RIEN;
  if (p.dec > 0 && p.but) { p.dec -= 1; return suivre(m, p, p.but); }
  p.dec = 5 + (niv.reaction >> 1);

  const g = marqueur(m, p);
  const d = distBut(p.x, p.y, gx);
  const X = p.x * s;
  const tPoss = (m.f - m.poss.f) / FPS;
  const reste = m.enOr ? 99 : (m.duree - m.chrono) / FPS;
  const vTir = d < 13 ? valeurTir(m, p, p.x, p.y, st, niv) : 0;
  let seuil = clamp(0.5 - tPoss * 0.025, 0.2, 0.5);
  if (st.passe > 1.1 && m.poss.passes < 3 && tPoss < 10) seuil += 0.06;
  if (!m.entrainement && reste < 2.2) seuil = 0.02;
  const mp = p.recu > 9 ? meilleurePasse(m, p, st, niv) : null;
  // Le duel : la valeur d'un tir pris 2,5 m plus près (sans aller dans la zone), si la voie est libre.
  const k = Math.min(1, 2.5 / Math.max(d, 0.1));
  let ax = p.x + (gx - p.x) * k, ay = p.y - p.y * k * 0.6;
  if (distBut(ax, ay, gx) < ZONE + 0.8) { const q = sortirZone(ax, ay, gx, ZONE + 0.8); ax = q.x; ay = q.y; }
  const bouche = blocage(m, p, ax, ay) + (g.d < 1.2 && s * (g.o.x - p.x) > 0 ? 0.25 : 0);
  const vDuel = d > 7.3 ? valeurTir(m, p, ax, ay, st, niv, false) * 0.9 * st.penetre * (1 - clamp(bouche, 0, 1) * 0.8) : 0;
  // On tire ?
  if (vTir >= seuil && vTir >= vDuel * 0.92 && (!mp || vTir >= mp.v - 0.05)) {
    p.but = null;
    return { ...RIEN, action: { type: 'armer', cible: clamp(Math.round(CHARGE_IDEALE + gauss(m) * niv.precision), 6, CHARGE_MAX) } };
  }
  // On passe ?
  const marge = 0.06 / st.passe;
  if (mp && mp.v > Math.max(vTir, vDuel * 0.95) + marge && (mp.v > seuil * 0.7 || tPoss > 3 || st.passe > 1.1)) {
    p.but = null;
    return { ...RIEN, action: { type: 'passe', cible: mp.r.id, aTerre: risquePasse(m, p, mp.r) > 0.35 } };
  }
  // Une feinte, si le défenseur colle.
  if (g.o && g.d < 1.15 && p.verrou <= 0 && X > 8 && hasard(m) < 0.09 * (st.penetre > 1.05 ? 1.4 : 1)) {
    const vx = gx - p.x, vy = -p.y;
    const sx = (g.o.x - p.x) * vy - (g.o.y - p.y) * vx > 0 ? -1 : 1;
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    p.but = null;
    return { ...RIEN, action: { type: 'feinte', dx: vx / l * 0.55 - (vy / l) * sx * 0.85, dy: vy / l * 0.55 + (vx / l) * sx * 0.85 } };
  }
  // Sinon, on avance : vers le but si ça s'ouvre, sinon vers une meilleure place.
  let tx, ty, sprint = false;
  const devant = m.joueurs.filter((o) => o.e !== p.e && o.i > 0 && !o.absent && s * (o.x - p.x) > 0).length;
  if (X < 6) {
    // Encore loin : on remonte (vite, s'il n'y a presque personne devant : la contre-attaque).
    tx = gx - s * (devant <= 1 ? 7 : 10.5); ty = devant <= 1 ? p.y * 0.4 : p.y * 0.8;
    sprint = devant <= 2 || st.transition > 1.3;
  } else if (vDuel > vTir * 1.05 || devant <= 1) {
    tx = ax; ty = ay;
    if (g.o && g.d < 1.6 && s * (g.o.x - p.x) > 0) ty = p.y + (p.y >= g.o.y ? 1.3 : -1.3);
    sprint = devant <= 1 || p.endu > 0.55;
  } else {
    // On revient à son poste, en cherchant l'espace entre deux défenseurs.
    const a = posteAttaque(m, p);
    tx = a.X * s; ty = a.Y * s + (p.y - (g.o ? g.o.y : p.y)) * 0.3;
  }
  p.but = { x: tx, y: ty, sprint };
  return suivre(m, p, p.but);
}

function suivre(m, p, but) {
  const gx = butX(m, p.e);
  return vers(p, but.x, but.y, { sprint: but.sprint, fx: gx - p.x, fy: -p.y });
}

/* ---------------- Sans le ballon, en attaque ---------------- */

function appel(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const gx = butX(m, p.e), s = eq.sens;
  // La passe arrive : on va au-devant.
  if (b.cible === p.id && b.porteur < 0) return vers(p, b.x + b.vx * 0.12, b.y + b.vy * 0.12, { fx: b.x - p.x, fy: b.y - p.y });
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const vise = porteur || b;
  // La contre-attaque : le ballon vient d'être récupéré, les ailiers (et les plus rapides) filent.
  const tPoss = (m.f - m.poss.f) / FPS;
  if (m.poss.contre && tPoss < 4.5 && (p.i === 1 || p.i === 5 || (st.transition > 1.4 && p.i !== 6))) {
    const porteX = porteur ? porteur.x * s : b.x * s;
    if (p.x * s < 15 && porteX < 12) {
      const cote = p.i === 1 ? 1 : p.i === 5 ? -1 : p.i <= 3 ? 0.5 : -0.5;
      return vers(p, gx - s * 8.5, s * cote * 3.5, { sprint: true, fx: vise.x - p.x, fy: vise.y - p.y });
    }
  }
  if (p.coupe > 0) {
    // Un appel vers la zone (un « duel » sans le ballon).
    p.coupe -= 1;
    const a = posteAttaque(m, p);
    const q = sortirZone(a.X * s + (gx - a.X * s) * 0.4, a.Y * s * 0.8, gx, ZONE + 0.5);
    return vers(p, q.x, q.y, { sprint: true, fx: vise.x - p.x, fy: vise.y - p.y });
  }
  if (p.dec > 0 && p.but) p.dec -= 1;
  else {
    p.dec = 50 + Math.floor(hasard(m) * 70);
    const a = posteAttaque(m, p);
    // Un peu de mouvement autour de son poste.
    const jx = (hasard(m) - 0.5) * 1.6, jy = (hasard(m) - 0.5) * 1.6;
    let x = (a.X + jx) * s, y = (a.Y + jy) * s;
    if (distBut(x, y, gx) < ZONE + 0.25) { const q = sortirZone(x, y, gx, ZONE + 0.3); x = q.x; y = q.y; }
    p.but = { x, y };
    if (porteur && porteur.x * s > 8 && p.i !== 6 && hasard(m) < (st.penetre > 1.05 ? 0.22 : 0.14)) p.coupe = 40;
  }
  const loin = dist(p.x, p.y, p.but.x, p.but.y) > 5;
  return vers(p, p.but.x, p.but.y, { sprint: loin && (st.transition > 1.2 || p.endu > 0.6), fx: vise.x - p.x, fy: vise.y - p.y });
}

/* ---------------- En défense ---------------- */

function defendre(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const s = eq.sens, dgx = -s * DEMI_L;
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const vb = porteur || b;
  const bY = vb.y * s;
  const pos = posteDefense(m, p, st.systeme, bY);
  let tx = pos.X * s, ty = pos.Y * s;
  const loinDuBut = dist(vb.x, vb.y, dgx, 0);
  // Le repli : l'adversaire remonte, on court se replacer.
  const repli = loinDuBut > 15;
  // Le défenseur le plus proche du porteur (parmi les présents) sort sur lui.
  let surBalle = false;
  if (porteur && porteur.e !== p.e && !repli) {
    let best = null, bd = 1e9;
    for (let k = 1; k < N; k++) {
      const q = m.joueurs[p.e * N + k];
      if (q.absent) continue;
      const qp = posteDefense(m, q, st.systeme, bY);
      const d = dist(qp.X * s, qp.Y * s, porteur.x, porteur.y);
      if (d < bd) { bd = d; best = q; }
    }
    surBalle = best === p;
  }
  if (surBalle) {
    const dP = Math.max(0.5, distBut(porteur.x, porteur.y, dgx));
    const gap = 0.95 + (1 - st.monte) * 0.5;
    const ux = (dgx - porteur.x), uy = (-porteur.y * 0.6);
    const l = Math.sqrt(ux * ux + uy * uy) || 1;
    tx = porteur.x + (ux / l) * gap; ty = porteur.y + (uy / l) * gap;
    // Pas trop loin de sa ligne (selon le système).
    const max = 6.5 + 3.2 * st.monte + (st.systeme === '3-2-1' ? 1 : 0);
    if (dP > max + gap) { const f = (max) / Math.max(0.5, distBut(tx, ty, dgx)); tx = dgx + (tx - dgx) * Math.min(1, f); ty *= Math.min(1, f); }
  } else if (porteur && porteur.e !== p.e && !repli) {
    // Le pivot adverse tout près : on le serre.
    const pv = m.joueurs[(1 - p.e) * N + 6];
    if (!pv.absent && dist(pv.x, pv.y, tx, ty) < 2.2) { tx += (pv.x - tx) * 0.3; ty += (pv.y - ty) * 0.3; }
  }
  // Une passe part vers une zone : on attaque la ligne de passe.
  if (b.porteur < 0 && b.cible >= 0 && m.joueurs[b.cible].e !== p.e) {
    const r = m.joueurs[b.cible];
    if (dist(r.x, r.y, p.x, p.y) < 3.2) { const l2 = niv.lecture * 0.5; tx += (b.x + b.vx * 0.2 - tx) * l2; ty += (b.y + b.vy * 0.2 - ty) * l2; }
  }
  if (distBut(tx, ty, dgx) < ZONE + 0.1) { const q = sortirZone(tx, ty, dgx, ZONE + 0.15); tx = q.x; ty = q.y; }
  const c = vers(p, tx, ty, { sprint: dist(p.x, p.y, tx, ty) > 2.5, fx: vb.x - p.x, fy: vb.y - p.y });
  if (porteur && porteur.e !== p.e) {
    const dA = dist(p.x, p.y, porteur.x, porteur.y);
    // Le contre : on saute quand il arme son tir (plus ou moins vite selon le niveau).
    if (porteur.etat === 'tir' && dA < 2 && porteur.charge === niv.reaction + (p.i % 3) && hasard(m) < 0.8) c.action = { type: 'saut' };
    // Le vol : collé au porteur.
    else if (surBalle && porteur.etat === 'normal' && b.remise < 0 && dA < 1.15 && p.verrou <= 0 && hasard(m) < 0.008 * st.vol * niv.vol) c.action = { type: 'vol' };
  }
  return c;
}

/* ---------------- Le ballon est libre ---------------- */

function balleLibre(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const s = eq.sens;
  // Où le ballon redevient attrapable.
  const traj = trajectoire(b, 14, 0.08);
  let cible = traj[traj.length - 1];
  for (const q of traj) if (q.z < 2.3) { cible = q; break; }
  if (b.z < 2.3) cible = { x: b.x + b.vx * 0.15, y: b.y + b.vy * 0.15, z: b.z };
  // Dans une zone, il est au gardien : on attend dehors.
  const gz = zoneDe(cible.x, cible.y);
  if (gz) { const q = sortirZone(cible.x, cible.y, gz, ZONE + 0.3); cible = { ...cible, x: q.x, y: q.y }; }
  const d = dist(p.x, p.y, cible.x, cible.y);
  let rang = 0;
  for (let i = 1; i < N; i++) { const q = m.joueurs[p.e * N + i]; if (q !== p && !q.absent && dist(q.x, q.y, cible.x, cible.y) < d) rang += 1; }
  const tireur = b.rebond ? b.rebond.e : -1;
  const chasseurs = tireur < 0 ? 2 : tireur === p.e ? 1 : 2;
  if (rang < chasseurs) return vers(p, cible.x, cible.y, { sprint: d > 1.5, fx: b.x - p.x, fy: b.y - p.y });
  // Les autres : à leur poste de défense (on ne sait jamais), ou en avant pour la contre-attaque.
  if (tireur >= 0 && tireur !== p.e && (p.i === 1 || p.i === 5) && st.transition > 1.1) {
    return vers(p, s * 5, p.i === 1 ? s * 6 : -s * 6, { sprint: true });
  }
  const pos = posteDefense(m, p, st.systeme, b.y * s);
  return vers(p, pos.X * s, pos.Y * s, { fx: b.x - p.x, fy: b.y - p.y });
}

export { allonge };
