/**
 * PETIT PONT — l'ordinateur : les coéquipiers du joueur, toute l'équipe
 * adverse en solo, et les gardiens (toujours).
 *
 * Chaque image, pour chaque joueur qu'il dirige, il rend une consigne :
 * { mx, my } la direction voulue (longueur 0 à 1), sprint, et parfois une
 * action (passe, tir, tacle, plongeon, relance). Le moteur (match.js)
 * l'applique exactement comme il applique les touches d'un humain.
 *
 * Il fait partie du moteur : en ligne, les deux appareils le font tourner
 * et doivent prendre les mêmes décisions. Son hasard est celui du match, ses
 * souvenirs (le temps avant sa prochaine décision…) sont dans l'état.
 *
 * Le style de l'équipe (equipes.js, STYLES) pèse sur tout : où se placent
 * les joueurs, s'ils pressent, s'ils passent, tirent ou dribblent. Le niveau
 * (facile, normal, difficile) règle la vivacité de ses décisions, sa
 * précision et ses jambes.
 */

import { DEMI_L, DEMI_W, DEMI_BUT, SURFACE, CHARGE_MAX, G, hasard, clamp, dist, distSegment, vitesseMax } from './terrain.js';
import { STYLES } from './equipes.js';

export const NIVEAUX = [
  { nom: 'Facile', decision: 22, reaction: 15, bruit: 0.4, vitesse: 0.9, vol: 0.55, tacle: 0.45, precision: 0.82, gardien: -9 },
  { nom: 'Normal', decision: 12, reaction: 9, bruit: 0.2, vitesse: 0.985, vol: 0.95, tacle: 0.9, precision: 1, gardien: 0 },
  { nom: 'Difficile', decision: 6, reaction: 5, bruit: 0.07, vitesse: 1.04, vol: 1.2, tacle: 1.15, precision: 1.12, gardien: 5 },
];
/** Le niveau qui dirige les joueurs d'une équipe (les coéquipiers d'un humain : Normal). */
export const niveauDe = (eq) => NIVEAUX[eq.ctrl === 'ia' ? eq.niveau : 1];
/** Le gardien d'une équipe dirigée par un humain est un cran au-dessus (on ne le dirige pas : il doit être sûr). */
export const bonusGardien = (eq) => (eq.ctrl === 'humain' ? 8 : niveauDe(eq).gardien);

const RIEN = { mx: 0, my: 0, sprint: false, action: null };

/** Aller vers un point : la direction, ralentie à l'arrivée. */
function vers(p, x, y, sprint = false, marge = 0.25) {
  const dx = x - p.x, dy = y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < marge) return { mx: 0, my: 0, sprint: false, action: null };
  const k = Math.min(1, d / 1.6) / d;
  return { mx: dx * k, my: dy * k, sprint: sprint && d > 3, action: null };
}

/** Où et quand un joueur peut-il atteindre le ballon libre ? */
export function interception(m, p, traj) {
  const b = m.ballon;
  const v = vitesseMax(p) * 1.15;
  if (dist(p.x, p.y, b.x, b.y) < 0.6) return { t: 0, x: b.x, y: b.y };
  for (const pt of traj) {
    if (pt.z > 1.8) continue;
    if (dist(p.x, p.y, pt.x, pt.y) - 0.45 <= v * pt.t) return { t: pt.t, x: pt.x, y: pt.y };
  }
  const der = traj[traj.length - 1];
  return { t: der.t + dist(p.x, p.y, der.x, der.y) / v, x: der.x, y: der.y };
}

/** La place d'un joueur dans le dispositif de son équipe (selon le ballon et le style). */
function place(m, e, i, attaque) {
  const eq = m.equipes[e], st = STYLES[eq.style], s = eq.sens, b = m.ballon;
  const bX = b.x * s, by = b.y;
  const L = st.ligne, W = st.largeur;
  let X, Y;
  if (attaque) {
    if (i === 1) { X = clamp(bX - 8 + L * 0.5, -15, 4); Y = clamp(-by * 0.25, -3, 3); }
    else if (i === 4) { X = clamp(bX + 7, 2, 15.5); Y = clamp(-by * 0.45, -4.5, 4.5); }
    else {
      const cote = i === 2 ? 1 : -1;
      X = clamp(bX + 2.5, -8, 14.5); Y = cote * 6.5 * W;
      // Le milieu du côté du ballon vient proposer une solution, un peu en retrait.
      if (by * cote > 3) { X = clamp(bX - 1.5, -10, 12); Y = cote * clamp(Math.abs(by) - 3.5, 2, 6); }
    }
  } else {
    if (i === 1) { X = clamp(bX - 6 + L * 0.4, -16.5, 2); Y = by * 0.35; }
    else if (i === 4) { X = clamp(bX + 2 + L * 0.7, -7, 10); Y = by * 0.3; }
    else { const cote = i === 2 ? 1 : -1; X = clamp(bX - 2 + L * 0.6, -14, 7); Y = cote * 4.6 * W + by * 0.35; }
  }
  return [X * s, clamp(Y, -9, 9)];
}

/** S'écarter de l'adversaire le plus proche (pour se rendre disponible). */
function demarquer(m, e, x, y) {
  let best = null, bd = 1.8;
  for (let k = 0; k < 5; k++) {
    const q = m.joueurs[(1 - e) * 5 + k];
    const d = dist(q.x, q.y, x, y);
    if (d < bd) { bd = d; best = q; }
  }
  if (!best) return [x, y];
  const d = Math.max(0.2, bd);
  return [clamp(x + ((x - best.x) / d) * 1.6, -DEMI_L + 1, DEMI_L - 1), clamp(y + ((y - best.y) / d) * 1.6, -9, 9)];
}

/** Quelle frappe a-t-on d'ici ? (0 : aucune, 1 : immanquable) */
export function valeurTir(m, p, x = p.x, y = p.y) {
  const s = m.equipes[p.e].sens, gx = DEMI_L * s;
  const d = dist(x, y, gx, 0);
  if (d > 23 || (gx - x) * s < 0.5) return 0;
  const angle = 1 - Math.min(1, Math.abs(y) / (d * 0.9 + 1)) * 0.65;
  let v = Math.pow(1 - d / 23, 1.25) * angle * (0.6 + p.n.tir / 200);
  for (let k = 1; k < 5; k++) {
    const q = m.joueurs[(1 - p.e) * 5 + k];
    const { d: ds, t } = distSegment(q.x, q.y, x, y, gx, 0);
    if (ds < 0.9 && t > 0.05 && t < 0.95) v *= 0.55;
  }
  return v;
}

/** L'adversaire le plus proche d'un point, et sa distance. */
function plusProcheAdv(m, e, x, y, gardienAussi = false) {
  let bd = 99, best = null;
  for (let k = gardienAussi ? 0 : 1; k < 5; k++) {
    const q = m.joueurs[(1 - e) * 5 + k];
    const d = dist(q.x, q.y, x, y);
    if (d < bd) { bd = d; best = q; }
  }
  return { q: best, d: bd };
}

/** Une passe vers r, vue de p : ce qu'elle vaut, et s'il faut la lever. */
export function valeurPasse(m, p, r, st) {
  const s = m.equipes[p.e].sens;
  const d = dist(p.x, p.y, r.x, r.y);
  if (d < 2.5 || d > 27) return null;
  let couloir = 99;
  for (let k = 0; k < 5; k++) {
    const q = m.joueurs[(1 - p.e) * 5 + k];
    const { d: ds, t } = distSegment(q.x, q.y, p.x, p.y, r.x, r.y);
    if (t > 0.05 && t < 0.97) couloir = Math.min(couloir, ds + t * 0.35);
  }
  const libre = plusProcheAdv(m, p.e, r.x, r.y, true).d;
  let v = st.passe + clamp(libre, 0, 5) * 0.045 + (r.x - p.x) * s * 0.018 * st.progres + valeurTir(m, r) * 0.6;
  if (r.i === 0) v -= 0.45;
  if (d > 15) v -= 0.12;
  let lob = false;
  if (couloir < 1.1) {
    if (d > 7 && st.lob > 0.5) { lob = true; v = v * 0.7 * Math.min(1.2, st.lob) - 0.05; }
    else v -= 0.7;
  } else if (couloir < 1.8) v -= 0.15;
  if (libre < 1.2) v -= 0.25;
  return { v, lob };
}

/**
 * Le chemin du porteur : vers le but, en contournant les adversaires devant lui.
 * Près du but, il rentre vers l'axe ; près d'une bande, il s'en écarte (jamais coincé dans un coin).
 */
function cheminDribble(m, p, st) {
  const s = m.equipes[p.e].sens;
  const X = p.x * s;
  let dx = s, dy = -p.y * 0.06;
  // Près de la ligne de but, on rentre vers l'axe (pas vers le poteau de corner).
  if (X > 12) dy -= p.y * 0.12 * (X - 12);
  let espace = 7;
  for (let k = 0; k < 5; k++) {
    const q = m.joueurs[(1 - p.e) * 5 + k];
    const ox = q.x - p.x, oy = q.y - p.y;
    const d = Math.sqrt(ox * ox + oy * oy);
    if (d > 5 || d < 0.01) continue;
    const devant = (ox * s) / d;
    if (devant > 0.2) espace = Math.min(espace, d);
    if (devant > -0.3) {
      // On s'écarte sur le côté (le plus libre), d'autant plus qu'il est proche ;
      // près d'une bande, toujours vers l'intérieur (sinon on finit coincé).
      let cote = oy > 0 ? -1 : 1;
      if (Math.abs(p.y) > 5 && cote * p.y > 0) cote = -cote;
      const f = ((5 - d) / 5) * (0.9 + 0.6 * st.dribble);
      dy += cote * f * 1.2;
      dx -= s * f * 0.25;
    }
  }
  // Les bandes repoussent, d'autant plus qu'on s'en approche ; la ligne de but aussi.
  if (Math.abs(p.y) > 6.5) dy -= Math.sign(p.y) * (Math.abs(p.y) - 6.5) * 0.9;
  if (X > 15.5) { dx -= s * (X - 15.5) * 0.5; dy -= Math.sign(p.y) * (X - 15.5) * 0.4; }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx: dx / l, dy: dy / l, espace };
}

/**
 * De quel côté partir en roulette : là où l'on pousse (sur le côté de sa course) ; sans
 * direction, loin de l'adversaire le plus proche. Rend le vecteur latéral (unitaire).
 */
export function coteRoulette(m, p, mx, my) {
  // Les deux côtés possibles : la gauche et la droite de sa course.
  const gx = -p.dy, gy = p.dx;
  let s;
  if (mx || my) s = mx * gx + my * gy >= 0 ? 1 : -1;
  else {
    let q = null, bd = 1e9;
    for (let k = 0; k < 5; k++) { const o = m.joueurs[(1 - p.e) * 5 + k]; const d = dist(o.x, o.y, p.x, p.y); if (d < bd) { bd = d; q = o; } }
    s = q && (q.x - p.x) * gx + (q.y - p.y) * gy > 0 ? -1 : 1;
  }
  // Pas contre la bande : si l'on y va, l'autre côté.
  if (Math.abs(p.y + gy * s * 1.5) > DEMI_W - 0.8) s = -s;
  return { lx: gx * s, ly: gy * s };
}

/* ------------------------------------------------------------------ */
/* Le gardien                                                          */
/* ------------------------------------------------------------------ */

function gardien(m, e, cons, N, traj) {
  const p = m.joueurs[e * 5];
  if (cons[p.id]) return;
  const eq = m.equipes[e], s = eq.sens, b = m.ballon;
  const gx = -DEMI_L * s;
  if (p.etat === 'tient') {
    if (p.dec > 0) { p.dec -= 1; cons[p.id] = RIEN; return; }
    // La relance : le coéquipier le plus libre, à la main (ou au pied, loin).
    const st = STYLES[eq.style];
    let best = null;
    for (let k = 1; k < 5; k++) {
      const r = m.joueurs[e * 5 + k];
      const o = valeurPasse(m, p, r, st);
      if (o && (!best || o.v > best.v)) best = { ...o, r };
    }
    if (!best) best = { r: m.joueurs[e * 5 + 1], lob: false };
    cons[p.id] = { mx: 0, my: 0, sprint: false, action: { type: 'relance', cible: best.r.id, lob: best.lob } };
    return;
  }
  if (p.etat !== 'normal') { cons[p.id] = RIEN; return; }
  if (b.porteur === p.id) return; // il a le ballon au pied : c'est le porteur qui décide (plus bas)

  // Un ballon haut file vers son but (un lob, une frappe de loin) et passerait au-dessus de lui :
  // il recule sur sa ligne, sous le ballon, pour le cueillir.
  const gard = p.n.gardien + bonusGardien(eq);
  const adverse = b.tir ? b.tir.e !== e : b.dernier >= 0 && m.joueurs[b.dernier].e !== e;
  if (b.porteur < 0 && adverse && b.vx * -s > 3) {
    const tl = (gx - b.x) / b.vx, tk = (p.x - b.x) / b.vx;
    const yl = b.y + b.vy * tl;
    const zk = b.z + b.vz * tk - (G * tk * tk) / 2;
    if (tl > 0.15 && tl < 2.5 && Math.abs(yl) < DEMI_BUT + 0.5 && zk > 1.9) {
      cons[p.id] = vers(p, gx + s * 0.35, clamp(yl, -DEMI_BUT + 0.2, DEMI_BUT - 0.2), true, 0.05);
      return;
    }
  }
  // Une frappe arrive : il plonge (s'il a eu le temps de la voir partir).
  if (b.tir && b.tir.e !== e && b.porteur < 0 && b.vx * -s > 2) {
    const tk = (p.x - b.x) / b.vx;
    const reaction = Math.round(N.reaction * 0.6 + (95 - gard) * 0.12);
    if (tk > 0 && tk < 1.4 && m.f - b.tir.f >= reaction) {
      const yk = b.y + b.vy * tk;
      const zk = b.z + b.vz * tk - (G * tk * tk) / 2;
      const dy = yk - p.y;
      if (Math.abs(yk) < DEMI_BUT + 0.7) {
        // Pas trop tôt : un plongeon dure un peu plus d'une demi-seconde, il serait au sol à l'arrivée.
        if (Math.abs(dy) > 0.5 && tk < 0.42) {
          const vd = 3.6 + gard * 0.032;
          cons[p.id] = { mx: 0, my: 0, sprint: false, action: { type: 'plonge', vy: clamp(dy / Math.max(tk, 0.1), -vd, vd), haut: zk > 1.1 } };
          return;
        }
        cons[p.id] = vers(p, p.x, clamp(yk, -DEMI_BUT, DEMI_BUT), true, 0.05);
        return;
      }
    }
  }

  // Le ballon libre dans sa surface : il sort le prendre s'il y est le premier.
  const dBut = dist(b.x, b.y, gx, 0);
  if (b.porteur < 0 && dBut < SURFACE - 0.3 && b.z < 1.6 && !(b.tir && b.tir.e !== e)) {
    const moi = interception(m, p, traj);
    let premier = true;
    for (let k = 1; k < 5; k++) {
      const q = m.joueurs[(1 - e) * 5 + k];
      if (interception(m, q, traj).t < moi.t - 0.1) { premier = false; break; }
    }
    if (premier) { cons[p.id] = vers(p, moi.x, moi.y, true, 0.05); return; }
  }
  // Un attaquant seul face à lui : il sort fermer l'angle.
  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  if (porteur && porteur.e !== e && dBut < SURFACE + 1.5) {
    const d = Math.max(0.5, dBut);
    const sortie = clamp(d - 1.4, 0.6, 3.6);
    cons[p.id] = vers(p, gx + ((b.x - gx) / d) * sortie, ((b.y) / d) * sortie, true, 0.08);
    return;
  }
  // Sinon : sur la ligne entre le ballon et le milieu de son but.
  const d = Math.max(0.5, dBut);
  const prof = clamp(0.5 + d * 0.085, 0.5, 2.3);
  const tx = gx + ((b.x - gx) / d) * prof;
  const ty = clamp((b.y / d) * prof * 1.4, -1.35, 1.35);
  cons[p.id] = vers(p, tx, ty, false, 0.06);
}

/* ------------------------------------------------------------------ */
/* Le porteur                                                          */
/* ------------------------------------------------------------------ */

function porteurIA(m, p, N, st) {
  const eq = m.equipes[p.e], s = eq.sens;
  const ch = cheminDribble(m, p, st);
  const pression = plusProcheAdv(m, p.e, p.x, p.y).d;
  // Une frappe en préparation : il la mène au bout.
  if (p.charge > 0) {
    if (p.charge >= p.chargeCible) return { mx: ch.dx * 0.5, my: ch.dy * 0.5, sprint: false, action: { type: 'tir', puissance: p.charge / CHARGE_MAX, vise: p.vise } };
    return { mx: ch.dx * 0.6, my: ch.dy * 0.6, sprint: false, action: null, charge: true };
  }
  const garde = p.i === 0;
  if (p.dec > 0 && !(pression < 1.1 && p.dec > 3)) {
    p.dec -= 1;
    return garde ? RIEN : { mx: ch.dx, my: ch.dy, sprint: ch.espace > 3.5 && p.endu > 0.35, action: null };
  }
  p.dec = N.decision + Math.floor(hasard(m) * 5);

  const bruit = () => (hasard(m) - 0.5) * N.bruit;
  // Tirer ?
  const vt = valeurTir(m, p) / st.tir;
  let choix = { v: vt > 0.34 ? vt * 1.5 + bruit() : -1, type: 'tir' };
  // Passer ?
  for (let k = 0; k < 5; k++) {
    const r = m.joueurs[p.e * 5 + k];
    if (r === p) continue;
    const o = valeurPasse(m, p, r, st);
    if (!o) continue;
    // Dans un coin ou collé à une bande : la passe (en retrait) vaut mieux que de s'entêter.
    const coince = (p.x * s > 15 && Math.abs(p.y) > 4) || Math.abs(p.y) > 8.3;
    const v = o.v + (pression < 1.4 ? 0.18 : 0) - (p.recu < 30 && !coince ? 0.15 : 0) + (coince ? 0.3 : 0) + bruit();
    if (v > choix.v) choix = { v, type: 'passe', cible: r.id, lob: o.lob };
  }
  // Garder le ballon ?
  if (!garde) {
    // Garder le ballon trop longtemps finit par ne plus rien donner : il faut passer ou tirer.
    const coince = (p.x * s > 15 && Math.abs(p.y) > 4) || Math.abs(p.y) > 8.3;
    const vd = 0.4 + Math.min(ch.espace, 6) * 0.06 * st.dribble - (pression < 1.2 ? 0.3 : 0) - (coince ? 0.3 : 0) - Math.max(0, p.recu - 150) * 0.002 + bruit();
    if (vd > choix.v || p.recu < 10) choix = { v: vd, type: 'dribble' };
  }
  if (choix.type === 'tir') {
    const d = dist(p.x, p.y, DEMI_L * s, 0);
    const puissance = clamp(d < 9 ? 0.5 + hasard(m) * 0.25 : 0.78 + hasard(m) * 0.22, 0.3, 1);
    // Il vise le côté que le gardien couvre le moins.
    const g = m.joueurs[(1 - p.e) * 5];
    p.vise = g.y > 0.15 ? -1 : g.y < -0.15 ? 1 : hasard(m) < 0.5 ? -1 : 1;
    if (hasard(m) < 0.2) p.vise = 0;
    p.chargeCible = Math.max(6, Math.round(puissance * CHARGE_MAX));
    p.charge = 1;
    return { mx: ch.dx * 0.6, my: ch.dy * 0.6, sprint: false, action: null, charge: true };
  }
  if (choix.type === 'passe') return { mx: ch.dx * 0.5, my: ch.dy * 0.5, sprint: false, action: { type: 'passe', cible: choix.cible, lob: choix.lob } };
  // Un défenseur au contact : parfois une roulette pour l'éliminer (les dribbleurs plus souvent).
  if (!garde && choix.type === 'dribble' && pression < 1.4 && p.gesteRepos <= 0 && hasard(m) < 0.05 * Math.max(0.2, st.dribble - 0.8)) {
    return { mx: ch.dx, my: ch.dy, sprint: false, action: { type: 'geste', arc: false, ...coteRoulette(m, p, 0, 0) } };
  }
  if (garde) return RIEN;
  return { mx: ch.dx, my: ch.dy, sprint: ch.espace > 3.5 && p.endu > 0.35, action: null };
}

/* ------------------------------------------------------------------ */
/* L'équipe                                                            */
/* ------------------------------------------------------------------ */

/**
 * Les consignes de l'équipe e pour cette image, dans cons[] (indice du
 * joueur). Une case déjà remplie (le joueur dirigé par un humain) est laissée.
 * `traj` : la trajectoire à venir du ballon (terrain.js), calculée une fois par image.
 */
export function decider(m, e, cons, traj) {
  const eq = m.equipes[e], st = STYLES[eq.style], N = niveauDe(eq), s = eq.sens, b = m.ballon;
  // L'entraînement : les absents ne font rien ; les plots non plus.
  for (let k = 0; k < 5; k++) { const q = m.joueurs[e * 5 + k]; if (!cons[q.id] && (q.absent || eq.immobile)) cons[q.id] = RIEN; }
  gardien(m, e, cons, N, traj);

  const porteur = b.porteur >= 0 ? m.joueurs[b.porteur] : null;
  const libres = [];
  for (let k = 1; k < 5; k++) if (!cons[e * 5 + k]) libres.push(m.joueurs[e * 5 + k]);
  const humain = eq.ctrl === 'humain' && eq.actif >= 0 ? m.joueurs[eq.actif] : null;

  // Nous avons le ballon.
  if (porteur && porteur.e === e) {
    if (!cons[porteur.id]) cons[porteur.id] = porteurIA(m, porteur, N, st);
    for (const p of libres) {
      if (p === porteur) continue;
      let [x, y] = place(m, e, p.i, true);
      [x, y] = demarquer(m, e, x, y);
      // L'appel en profondeur : l'attaquant part quand le porteur lève la tête au milieu.
      const avance = (x - p.x) * s;
      cons[p.id] = vers(p, x, y, avance > 4, 0.4);
    }
    return;
  }

  // Une passe est en route vers l'un des nôtres : il va à sa rencontre, les autres se placent.
  if (!porteur && b.cible >= 0 && m.joueurs[b.cible].e === e) {
    for (const p of libres) {
      if (p.id === b.cible) {
        const i = interception(m, p, traj);
        cons[p.id] = vers(p, i.x, i.y, i.t > 0.6, 0.1);
      } else {
        const [x, y] = place(m, e, p.i, true);
        cons[p.id] = vers(p, x, y, false, 0.4);
      }
    }
    return;
  }

  // Le ballon est libre : le plus rapide de chaque équipe y va.
  if (!porteur) {
    let chasseur = null, tBest = 99;
    for (const p of libres) {
      if (p.etat !== 'normal') continue;
      const t = interception(m, p, traj).t;
      if (t < tBest) { tBest = t; chasseur = p; }
    }
    // Si l'humain est déjà le plus près, personne ne lui court dans les pattes.
    if (humain && humain.i > 0 && interception(m, humain, traj).t < tBest - 0.15) chasseur = null;
    const notreMoitie = b.x * s < 0;
    for (const p of libres) {
      if (p === chasseur) {
        const i = interception(m, p, traj);
        cons[p.id] = vers(p, i.x, i.y, true, 0.05);
      } else {
        const [x, y] = place(m, e, p.i, !notreMoitie);
        cons[p.id] = vers(p, x, y, false, 0.4);
      }
    }
    return;
  }

  // L'adversaire a le ballon : on presse, on couvre, on marque.
  const gx = -DEMI_L * s;
  const restants = libres.filter((p) => p.etat === 'normal');
  restants.sort((a, c) => dist(a.x, a.y, porteur.x, porteur.y) - dist(c.x, c.y, porteur.x, porteur.y) || a.id - c.id);
  const presseurs = [];
  const humainPresse = humain && humain.i > 0 && dist(humain.x, humain.y, porteur.x, porteur.y) < 3.2;
  if (restants.length && !humainPresse) presseurs.push(restants.shift());
  const contre = st.contre && eq.contre > 0;
  if (restants.length && (eq.pressing > 0 || contre || (st.pressing > 0.8 && porteur.x * s < 6))) presseurs.push(restants.shift());
  const dangerBut = dist(porteur.x, porteur.y, gx, 0);
  for (const p of presseurs) {
    const d = dist(p.x, p.y, porteur.x, porteur.y);
    // Il se place entre le porteur et le but, puis vient au contact (plus ou moins vite selon le style).
    const ux = (gx - porteur.x) / Math.max(0.5, dangerBut), uy = -porteur.y / Math.max(0.5, dangerBut);
    const engage = st.pressing > 0.5 || contre || dangerBut < 15 || p !== presseurs[0];
    const ecart = engage ? 0.25 : 2.2;
    const c = vers(p, b.x + ux * ecart, b.y + uy * ecart, engage && d > 2.5, 0.05);
    // Le tacle glissé : bien placé, face au ballon, et l'envie (le style, le niveau).
    if (d > 1 && d < 2.3 && p.verrou <= 0) {
      const fx = (b.x - p.x) / d, fy = (b.y - p.y) / d;
      if (fx * p.dx + fy * p.dy > 0.85 && hasard(m) < 0.02 * st.tacle * N.tacle) c.action = { type: 'tacle' };
    }
    cons[p.id] = c;
  }
  // Les autres : marquer les adversaires les plus dangereux, sinon tenir sa place.
  const adv = [];
  for (let k = 1; k < 5; k++) { const q = m.joueurs[(1 - e) * 5 + k]; if (q !== porteur && !q.absent) adv.push(q); }
  adv.sort((a, c) => dist(a.x, a.y, gx, 0) - dist(c.x, c.y, gx, 0) || a.id - c.id);
  for (const q of adv) {
    if (!restants.length) break;
    const dq = dist(q.x, q.y, gx, 0);
    if (dq > 24) continue;
    let ri = 0, rd = 99;
    restants.forEach((r, k) => { const d = dist(r.x, r.y, q.x, q.y); if (d < rd) { rd = d; ri = k; } });
    const r = restants.splice(ri, 1)[0];
    const k = 1.3 / Math.max(0.5, dq);
    const tx = q.x + (gx - q.x) * k + (b.x - q.x) * 0.08;
    const ty = q.y + (0 - q.y) * k + (b.y - q.y) * 0.08;
    cons[r.id] = vers(r, tx, ty, dist(r.x, r.y, tx, ty) > 4, 0.2);
  }
  for (const p of restants) {
    const [x, y] = place(m, e, p.i, false);
    cons[p.id] = vers(p, x, y, false, 0.4);
  }
  for (const p of libres) if (!cons[p.id]) cons[p.id] = RIEN;
}
