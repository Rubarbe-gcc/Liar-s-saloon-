/**
 * DOUBLE PAS — l'ordinateur : ce que fait chaque joueur qu'aucun humain ne
 * dirige (les deux équipes contre l'ordinateur, les coéquipiers de l'humain).
 *
 * En attaque : le porteur compare son tir, sa pénétration et ses passes
 * (la valeur d'un tir : sa chance de rentrer × ses points) ; plus la
 * possession dure, moins il est exigeant. Les autres s'écartent sur des
 * places (la ligne à 3 points, le poste bas) et coupent vers le panier.
 * En défense : chacun son joueur (homme à homme), entre lui et le panier,
 * plus ou moins près selon le style ; on aide sur les pénétrations, on saute
 * pour contrer, on tente des interceptions.
 * Au rebond : les plus proches y vont, les autres repartent.
 *
 * Le style du club (equipes.js, STYLES) règle tout cela.
 * Module partagé, sans DOM ; déterministe (le hasard vient du match).
 */

import {
  FPS, PANIER_X, CHARGE_IDEALE, CHARGE_MAX, PORTEE_DUNK, DEMI_L, DEMI_W,
  hasard, gauss, clamp, dist, distSegment, panierX, estTrois, ecartTir, chanceDe, trajectoire, allonge,
} from './terrain.js';
import { STYLES } from './equipes.js';

export const NIVEAUX = [
  { nom: 'Facile', reaction: 13, precision: 4.4, vol: 0.45, lecture: 0.55, allure: 0.88 },
  { nom: 'Normal', reaction: 8, precision: 2.7, vol: 0.8, lecture: 0.85, allure: 1 },
  { nom: 'Difficile', reaction: 4, precision: 1.8, vol: 1, lecture: 1, allure: 1 },
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

/** La valeur d'un tir de p pris en (x, y) : sa chance × ses points, à la façon du club. */
export function valeurTir(m, p, x, y, st, niv, gene = true) {
  const hx = panierX(m, p.e);
  const s = ecartTir(m, p, x, y, 1 - niv.precision * 0.035, gene);
  const pts = estTrois(x, y, hx) ? 3 : 2;
  let v = chanceDe(s, dist(x, y, hx, 0)) * pts;
  if (pts === 3) v *= st.trois;
  if (st.vedette) v *= p.vedette ? 1.2 : 0.82;
  return v;
}

/** Le défenseur le plus proche de p (et sa distance). */
function gardien(m, p) {
  let best = null, bd = 1e9;
  for (let k = 0; k < 3; k++) {
    const o = m.joueurs[(1 - p.e) * 3 + k];
    const d = dist(o.x, o.y, p.x, p.y);
    if (d < bd) { bd = d; best = o; }
  }
  return { o: best, d: bd };
}

/** Une passe vers r risque-t-elle l'interception ? (0 : non, jusqu'à 1) */
function risquePasse(m, p, r) {
  let risque = 0;
  for (let k = 0; k < 3; k++) {
    const o = m.joueurs[(1 - p.e) * 3 + k];
    const { d, t } = distSegment(o.x, o.y, p.x, p.y, r.x, r.y);
    if (t > 0.08 && t < 0.97 && d < 1) risque = Math.max(risque, (1 - d) * (0.6 + (o.n.defense - 60) / 100));
  }
  return clamp(risque, 0, 1);
}

/** La meilleure passe : { r, v } (la valeur du tir du receveur, moins le risque). */
function meilleurePasse(m, p, st, niv) {
  let best = null, bv = -1;
  for (let i = 0; i < 3; i++) {
    const r = m.joueurs[p.e * 3 + i];
    if (r === p || r.z > 0) continue;
    let v = valeurTir(m, r, r.x, r.y, st, niv) * 0.94;
    if (st.vedette && r.vedette) v *= 1.25;
    v *= 1 - risquePasse(m, p, r) * 0.85;
    // Il coupe vers le panier, seul : la passe vaut un dunk.
    if (r.coupe > 0 && dist(r.x, r.y, panierX(m, p.e), 0) < 3.2 && gardien(m, r).d > 1.6) v = Math.max(v, 1.5);
    if (v > bv) { bv = v; best = r; }
  }
  return best ? { r: best, v: bv } : null;
}

/** Le marquage (homme à homme) : revu de temps en temps, au plus court (sans changer pour rien). */
function majMarquage(m, e) {
  const eq = m.equipes[e];
  if (eq.revoir > 0) return;
  eq.revoir = 40;
  const D = (a, b) => { const p = m.joueurs[e * 3 + a], q = m.joueurs[(1 - e) * 3 + b]; return dist(p.x, p.y, q.x, q.y); };
  const cout = (perm) => D(0, perm[0]) + D(1, perm[1]) + D(2, perm[2]);
  let best = eq.marque, bc = cout(eq.marque) - 2;
  for (const perm of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
    const c = cout(perm);
    if (c < bc) { bc = c; best = perm; }
  }
  eq.marque = [...best];
}

/**
 * Remplit les consignes (cons[id]) des joueurs de l'équipe e qu'aucun humain ne dirige.
 * Une consigne : { mx, my, sprint, action, fx, fy }.
 */
export function decider(m, e, cons) {
  const eq = m.equipes[e], b = m.ballon;
  if (eq.ctrl === 'aucun') { for (let i = 0; i < 3; i++) if (!cons[e * 3 + i]) cons[e * 3 + i] = RIEN; return; }
  const st = STYLES[eq.style], niv = niveauDe(eq);
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const etat = porteur ? (porteur.e === e ? 'att' : 'def') : b.cible >= 0 ? (m.joueurs[b.cible].e === e ? 'att' : 'def') : 'libre';
  if (etat === 'def') majMarquage(m, e);
  for (let i = 0; i < 3; i++) {
    const p = m.joueurs[e * 3 + i];
    if (cons[p.id]) continue;
    if (p.z > 0 || p.vz > 0 || p.etat === 'dunk') { cons[p.id] = RIEN; continue; }
    if (porteur === p) cons[p.id] = porteurIA(m, p, st, niv);
    else if (etat === 'att') cons[p.id] = appel(m, p, st, niv);
    else if (etat === 'def') cons[p.id] = defendre(m, p, st, niv);
    else cons[p.id] = balleLibre(m, p, st, niv);
    if (niv.allure < 1) { cons[p.id].mx *= niv.allure; cons[p.id].my *= niv.allure; }
  }
}

/* ---------------- Le porteur ---------------- */

function porteurIA(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const hx = panierX(m, p.e), s = eq.sens;
  // La remise en jeu : on attend que les autres se placent, puis la passe.
  if (b.remise === p.id) {
    if (m.t < 24 + (p.id % 3) * 5) return RIEN;
    const mp = meilleurePasse(m, p, st, niv);
    return { ...RIEN, action: { type: 'passe', cible: mp ? mp.r.id : p.e * 3 + ((p.i + 1) % 3) } };
  }
  if (p.etat !== 'normal') return RIEN;
  const dH = dist(p.x, p.y, hx, 0);
  if (dH < PORTEE_DUNK - 0.15 && s * (hx - p.x) > 0.2) return { ...RIEN, action: { type: 'dunk' } };
  if (p.dec > 0 && p.but) { p.dec -= 1; return suivre(m, p, p.but); }
  p.dec = 5 + (niv.reaction >> 1);

  const g = gardien(m, p);
  const tPoss = (m.f - m.poss.f) / FPS;
  const reste = m.enOr ? 99 : (m.duree - m.chrono) / FPS;
  const vTir = valeurTir(m, p, p.x, p.y, st, niv);
  let seuil = clamp(1.02 - tPoss * 0.04, 0.3, 1.02);
  if (st.passe > 1.3 && m.poss.passes < 2 && tPoss < 8) seuil += 0.12;
  if (reste < 2.6) seuil = 0.02;
  const mp = p.recu > 10 ? meilleurePasse(m, p, st, niv) : null;
  // La pénétration : la valeur d'un tir 2,5 m plus près, si la voie est libre.
  const k = Math.min(1, 2.6 / Math.max(dH, 0.1));
  const ax = p.x + (hx - p.x) * k, ay = p.y - p.y * k;
  // La voie est-elle bouchée ? (un défenseur sur la ligne du panier, ou qui garde le cercle)
  let bouche = 0;
  for (let j = 0; j < 3; j++) {
    const o = m.joueurs[(1 - p.e) * 3 + j];
    const { d, t } = distSegment(o.x, o.y, p.x, p.y, hx, 0);
    if (t > 0.05 && d < 1.1) bouche += (1.1 - d) * (t < 0.5 ? 0.9 : 0.6);
  }
  const vDrive = (dH < 4.2 ? 1.45 : valeurTir(m, p, ax, ay, st, niv, false) * 0.85) * st.penetre * (1 - clamp(bouche, 0, 1) * 0.75);
  // On tire ?
  if (vTir >= seuil && vTir >= vDrive * 0.92 && (!mp || vTir >= mp.v - 0.06)) {
    p.but = null;
    return { ...RIEN, action: { type: 'armer', cible: clamp(Math.round(CHARGE_IDEALE + gauss(m) * niv.precision), 6, CHARGE_MAX) } };
  }
  // On passe ?
  const marge = 0.1 / st.passe;
  if (mp && mp.v > Math.max(vTir, vDrive * 0.95) + marge && (mp.v > seuil * 0.75 || tPoss > 3 || st.passe > 1.3)) {
    p.but = null;
    return { ...RIEN, action: { type: 'passe', cible: mp.r.id, aTerre: risquePasse(m, p, mp.r) > 0.3 } };
  }
  // Un crochet, si le défenseur colle.
  if (g.d < 1.05 && p.verrou <= 0 && hasard(m) < 0.1 * (st.penetre > 1.2 ? 1.5 : 1)) {
    const vx = hx - p.x, vy = -p.y;
    const sx = (g.o.x - p.x) * vy - (g.o.y - p.y) * vx > 0 ? -1 : 1; // du côté opposé au défenseur
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    p.but = null;
    return { ...RIEN, action: { type: 'crochet', dx: vx / l * 0.6 - (vy / l) * sx * 0.8, dy: vy / l * 0.6 + (vx / l) * sx * 0.8 } };
  }
  // Sinon, on avance : vers le panier si ça s'ouvre, sinon vers une meilleure place.
  let tx, ty, sprint = false;
  const derriere = m.joueurs.filter((o) => o.e !== p.e && s * (o.x - p.x) > 0).length;
  if (s * (hx - p.x) > 10) {
    // Encore dans sa moitié : on remonte (vite, s'il n'y a personne devant : la contre-attaque).
    tx = hx - s * (derriere === 0 ? 1 : 7.2); ty = derriere === 0 ? 0 : p.y * 0.5;
    sprint = derriere <= 1 || st.transition > 1.3;
  } else if (vDrive > vTir * 1.05 || bouche < 0.4) {
    tx = hx - s * 0.6; ty = 0;
    // On contourne le défenseur qui barre la route.
    if (g.d < 1.6 && s * (g.o.x - p.x) > 0) ty = p.y + (p.y >= g.o.y ? 1.4 : -1.4);
    sprint = derriere === 0 || p.endu > 0.5;
  } else {
    // Vers la ligne à 3 points (ou un peu dedans), loin de son défenseur.
    const r = st.trois > 1.2 ? 7.1 : 5.5;
    const ang = p.y >= 0 ? 1 : -1;
    tx = hx - s * r * 0.8; ty = ang * r * 0.55 + (p.y - g.o.y) * 0.4;
  }
  p.but = { x: tx, y: ty, sprint };
  return suivre(m, p, p.but);
}

function suivre(m, p, but) {
  const hx = panierX(m, p.e);
  return vers(p, but.x, but.y, { sprint: but.sprint, fx: hx - p.x, fy: -p.y });
}

/* ---------------- Sans le ballon, en attaque ---------------- */

/** Les places (à quelle distance du panier vers le milieu du terrain, de quel côté). */
const PLACES = {
  trois: [[7.3, 0], [5.6, 4.9], [5.6, -4.9], [1.2, 6.9], [1.2, -6.9]],
  interieur: [[2, 2], [2, -2], [6.4, 3.6], [6.4, -3.6], [7, 0]],
  normal: [[7, 0], [5.4, 4.8], [5.4, -4.8], [2.3, 2.4], [2.3, -2.4], [1, 6.8], [1, -6.8]],
};

function appel(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const hx = panierX(m, p.e), s = eq.sens;
  // La passe arrive : on va au-devant.
  if (b.cible === p.id && b.porteur < 0) return vers(p, b.x + b.vx * 0.12, b.y + b.vy * 0.12, { fx: b.x - p.x, fy: b.y - p.y });
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  if (p.coupe > 0) {
    p.coupe -= 1;
    return vers(p, hx - s * 1.1, p.y >= 0 ? 0.8 : -0.8, { sprint: true, fx: porteur ? porteur.x - p.x : 0, fy: porteur ? porteur.y - p.y : 0 });
  }
  if (p.dec > 0 && p.but) {
    p.dec -= 1;
  } else {
    p.dec = 70 + Math.floor(hasard(m) * 90);
    const liste = st.trois > 1.2 ? PLACES.trois : st.penetre > 1.3 || st.rebond > 1.4 ? (p.i === 2 ? PLACES.interieur : PLACES.normal) : PLACES.normal;
    const autre = m.joueurs[p.e * 3 + ([0, 1, 2].find((i) => i !== p.i && m.joueurs[p.e * 3 + i] !== porteur) ?? p.i)];
    let best = null, bv = -1e9;
    for (const [r, y] of liste) {
      const x = hx - s * r * st.ecart, yy = y * (st.ecart > 1 ? 1 : st.ecart + 0.1);
      let v = 0;
      if (porteur) { const d = dist(x, yy, porteur.x, porteur.y); v -= Math.abs(d - 5) * 0.6; }
      if (autre !== p && autre !== porteur && autre.but) v -= Math.max(0, 4 - dist(x, yy, autre.but.x, autre.but.y)) * 1.2;
      let libre = 9;
      for (let k = 0; k < 3; k++) { const o = m.joueurs[(1 - p.e) * 3 + k]; libre = Math.min(libre, dist(o.x, o.y, x, yy)); }
      v += Math.min(libre, 4) * 0.5 + hasard(m) * 1.4;
      if (v > bv) { bv = v; best = { x, y: yy }; }
    }
    p.but = best;
    // Une coupe vers le panier (les clubs qui font tourner la balle en font plus).
    if (porteur && s * (hx - porteur.x) < 9 && hasard(m) < (st.passe > 1.3 ? 0.4 : 0.2) * (p.i === 2 ? 1.2 : 1)) p.coupe = 55;
  }
  const loin = Math.abs(p.x - p.but.x) > 5;
  const vise = porteur || b;
  return vers(p, p.but.x, p.but.y, { sprint: loin && (st.transition > 1.2 || p.endu > 0.6), fx: vise.x - p.x, fy: vise.y - p.y });
}

/* ---------------- En défense ---------------- */

function defendre(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const dhx = -panierX(m, p.e);
  const a = m.joueurs[(1 - p.e) * 3 + eq.marque[p.i]];
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const surBalle = porteur === a;
  const dAH = Math.max(0.5, dist(a.x, a.y, dhx, 0));
  // Loin de notre panier, on attend dans sa moitié… sauf s'il traîne : alors on va le chercher.
  let tTraine = (m.f - m.poss.f) / FPS - 5;
  if (porteur && porteur.e !== p.e && porteur.vx * porteur.vx + porteur.vy * porteur.vy < 0.2) tTraine = Math.max(tTraine, porteur.recu / FPS - 1.5);
  const traine = clamp(1 - tTraine / 2.5, 0, 1);
  let gap = surBalle ? (0.75 + (1 - st.serre) * 0.6) * (0.65 + 0.35 * traine) : 1.3 + dAH * 0.11 * (1.6 - st.serre);
  if (dAH > 9.5 && st.serre < 0.9) gap += (dAH - 9.5) * 0.55 * traine;
  let tx = a.x + ((dhx - a.x) / dAH) * gap, ty = a.y + (-a.y / dAH) * gap;
  // L'aide : le porteur s'approche du panier, on se décale vers lui.
  if (!surBalle && porteur && porteur.e !== p.e) {
    const dPH = dist(porteur.x, porteur.y, dhx, 0);
    if (dPH < 5.5) { const f = (5.5 - dPH) / 5.5 * 0.45; tx += (porteur.x - tx) * f; ty += (porteur.y - ty) * f; }
  }
  // Une passe part vers mon joueur : on attaque la ligne de passe.
  if (b.porteur < 0 && b.cible === a.id) {
    const l = niv.lecture;
    tx += (b.x + b.vx * 0.2 - tx) * 0.5 * l; ty += (b.y + b.vy * 0.2 - ty) * 0.5 * l;
  }
  const c = vers(p, tx, ty, { sprint: dist(p.x, p.y, tx, ty) > 2.5, fx: a.x - p.x, fy: a.y - p.y });
  const dA = dist(p.x, p.y, a.x, a.y);
  if (porteur && porteur.e !== p.e) {
    // Le contre : on saute quand il arme son tir (plus ou moins vite selon le niveau).
    if (porteur.etat === 'tir' && dist(p.x, p.y, porteur.x, porteur.y) < 1.9 && porteur.charge === niv.reaction + (p.i % 2) && hasard(m) < 0.8) c.action = { type: 'saut' };
    // Sur un dunk, le défenseur près du cercle s'envole.
    else if (porteur.etat === 'dunk' && porteur.t === 12 + (niv.reaction >> 2) && dist(p.x, p.y, -dhx, 0) > 0 && dist(p.x, p.y, panierX(m, porteur.e), 0) < 2.2 && hasard(m) < 0.75) c.action = { type: 'saut' };
    // Le vol : collé au porteur.
    else if (surBalle && porteur.etat === 'normal' && b.remise < 0 && dA < 1.15 && p.verrou <= 0 && hasard(m) < 0.009 * st.vol * niv.vol * (1 + 5 * (1 - traine))) c.action = { type: 'vol' };
  }
  return c;
}

/* ---------------- Le ballon est libre ---------------- */

function balleLibre(m, p, st, niv) {
  const b = m.ballon, eq = m.equipes[p.e];
  const s = eq.sens;
  // L'entre-deux : le pivot saute, les autres attendent.
  if (b.entre) {
    if (p.i !== 2) return RIEN;
    const c = vers(p, -s * 0.55, 0, { fx: s, fy: 0 });
    if (b.vz < 0 && b.z < 3.9 - (niv.reaction - 8) * 0.02 && hasard(m) < 0.45) c.action = { type: 'saut' };
    return c;
  }
  // Où le ballon redevient attrapable.
  const traj = trajectoire(b, 14, 0.08);
  let cible = traj[traj.length - 1];
  for (const q of traj) if (q.z < 2.6) { cible = q; break; }
  if (b.z < 2.6) cible = { x: b.x + b.vx * 0.15, y: b.y + b.vy * 0.15, z: b.z };
  // Mon rang dans l'équipe (le plus proche va au ballon).
  const d = dist(p.x, p.y, cible.x, cible.y);
  let rang = 0;
  for (let i = 0; i < 3; i++) { const q = m.joueurs[p.e * 3 + i]; if (q !== p && dist(q.x, q.y, cible.x, cible.y) < d) rang += 1; }
  const tireur = b.rebond ? b.rebond.e : -1;
  const offensif = tireur === p.e;
  const chasseurs = tireur < 0 ? 2 : offensif ? (st.rebond >= 1.4 ? 2 : st.rebond <= 0.7 ? 0 : 1) : st.transition > 1.4 ? 1 : 2;
  if (rang < Math.max(1, chasseurs)) {
    const c = vers(p, cible.x, cible.y, { sprint: d > 1.5, fx: b.x - p.x, fy: b.y - p.y });
    // Le rebond : on saute pour le prendre au plus haut.
    const hd = dist(p.x, p.y, b.x, b.y);
    if (hd < 1.3 && b.vz < 0 && b.z > 2 && b.z < allonge(p) + 0.9 && p.verrou <= 0 && hasard(m) < 0.25 * (st.rebond > 1.3 ? 1.4 : 1)) c.action = { type: 'saut' };
    return c;
  }
  if (offensif) return vers(p, -panierX(m, p.e) * 0.35, p.y * 0.6, { allure: 0.8 });
  // On s'échappe pour la contre-attaque (le club qui court y va franchement).
  const hx = panierX(m, p.e);
  return vers(p, hx * (st.transition > 1.4 ? 0.62 : 0.15), p.y >= 0 ? 4 : -4, { sprint: st.transition > 1.4 });
}
