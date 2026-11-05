/**
 * REVERS — l'ordinateur. Il rend les touches qu'un joueur appuierait (les mêmes bits que la manette),
 * pour que le moteur le traite comme un humain.
 *
 * Il prévoit la balle (une copie qu'il fait avancer avec la même physique), choisit où la frapper (après le
 * rebond, à bonne hauteur ; au vol s'il est au filet), y court, arme son coup assez tôt pour le charger, et
 * vise au dernier moment le côté où l'adversaire n'est pas. Son niveau (0 facile, 1 moyen, 2 fort) règle
 * son temps de réaction, l'erreur de sa prévision, la charge de ses coups et la justesse de sa visée.
 *
 * Déterministe : son hasard est celui du match (hasard(m)).
 */

import { FPS, LONG, DEMI_SIMPLE, RAYON, T, BOUTONS, hasard, gauss, clamp, dist, sens, vitesseMax, avancerBalle } from './terrain.js';
import { STYLES } from './joueurs.js';

export const NIVEAUX = [
  { nom: 'Facile', reaction: 16, erreur: 0.75, charge: 4, vise: 0.2, lent: 0.8, service: 0.32 },
  { nom: 'Moyen', reaction: 10, erreur: 0.45, charge: 10, vise: 0.4, lent: 0.92, service: 0.16 },
  { nom: 'Fort', reaction: 4, erreur: 0.1, charge: 16, vise: 0.6, lent: 1, service: 0.07 },
];
const niv = (p) => NIVEAUX[clamp(p.niveau | 0, 0, 2)];

/** Les touches pour aller vers (x, y) (dans le repère du terrain). */
function aller(p, x, y, zone = 0.14) {
  const s = sens(p.e), dx = (x - p.x) * s, dy = (y - p.y) * s;
  let k = 0;
  if (dx > zone) k |= T.d; else if (dx < -zone) k |= T.g;
  if (dy > zone) k |= T.h; else if (dy < -zone) k |= T.b;
  return k;
}

/** Les touches de visée : x vers le côté voulu du court (sx = -1, 0, 1), plus long (prof = 1) ou plus court (-1). */
function viser(p, sx, prof) {
  const s = sens(p.e);
  let k = 0;
  if (sx * s > 0) k |= T.d; else if (sx * s < 0) k |= T.g;
  if (prof > 0) k |= T.h; else if (prof < 0) k |= T.b;
  return k;
}

/**
 * Où et quand frapper la balle qui vient : { x, y, k } (k images d'ici là), ou null si elle ne viendra pas
 * jouable (filet, dehors).
 */
function prevoir(m, p) {
  const b = { ...m.balle }, s = sens(p.e), v = vitesseMax(p) * niv(p).lent;
  const auFilet = Math.abs(p.y) < 5.5;
  let secours = null;
  for (let k = 1; k <= 170; k++) {
    const r = avancerBalle(b);
    if (r === 'filet') return null;
    if (r === 'rebond') {
      b.rebonds += 1;
      if (b.rebonds > 1) break;
      // Elle tombe dehors (ou de son côté à lui) : on la laisse.
      const camp = b.y < 0 ? 0 : 1;
      if (camp !== p.e || Math.abs(b.x) > DEMI_SIMPLE + RAYON || Math.abs(b.y) > LONG + RAYON) return null;
    }
    if (b.y * s > 0.05) continue;
    if (b.service && b.rebonds === 0) continue;
    if (b.z < 0.2 || b.z > 2.9) continue;
    // Il se place à côté de la balle (coup droit ou revers, le plus près), un peu derrière.
    const cote = b.x >= p.x ? 1 : -1;
    const sx = b.x - cote * s * 0.55 * s, sy = b.y - s * 0.2;
    const besoin = Math.max(0, dist(sx, sy, p.x, p.y) - 0.45);
    const peut = v * (k / FPS) * 0.88 - 0.12;
    const bonne = b.rebonds === 1 ? b.z > 0.3 && b.z < 1.55 : auFilet && b.z > 0.5;
    if (besoin <= peut && bonne) return { x: sx, y: sy, k };
    if (b.rebonds === 1 && (!secours || besoin - peut < secours.manque)) secours = { x: sx, y: sy, k, manque: besoin - peut };
  }
  return secours;
}

/** Le coup qu'il choisit, selon son style et ce que fait l'adversaire. */
function choisirCoup(m, p) {
  const st = STYLES[p.style] || STYLES.fond, o = m.joueurs[1 - p.e], r = hasard(m);
  const oFilet = Math.abs(o.y) < 6, oLoin = Math.abs(o.y) > LONG + 1.2, moiDedans = Math.abs(p.y) < LONG - 2;
  if (oFilet && r < st.lob * 3 + 0.12) return 'lob';
  if (oLoin && moiDedans && r < st.amortie * 2.5) return 'amortie';
  if (hasard(m) < st.slice) return 'slice';
  return 'lift';
}

/** Une image de décision : les touches de l'ordinateur pour le joueur e. */
export function decider(m, e) {
  const p = m.joueurs[e], N = niv(p), b = m.balle, s = sens(e), prec = m.prec[e];
  const I = p.ia;
  if (m.phase === 'fin' || m.phase === 'point' || m.phase === 'faute') return 0;

  // Le service.
  if (m.phase === 'service') {
    if (m.serveur !== e) return 0;
    if (!p.lance) {
      I.hz = undefined;
      return m.t >= 46 && !(prec & T.A) ? T.A : 0;
    }
    if (I.hz === undefined) {
      I.hz = clamp(2.55 + gauss(m) * N.service * 1.6, 1.7, 2.66);
      const r = hasard(m);
      I.sx = r < 0.38 ? -1 : r < 0.76 ? 1 : 0;
    }
    if (b.vz < 0 && b.z <= I.hz) return T.A | viser(p, I.sx * (cotEgaliteSigne(m, p)), 0);
    return 0;
  }

  // L'échange : une nouvelle balle (une frappe de plus) → on refait le plan.
  const cle = m.stats.points[0] + m.stats.points[1] * 1000 + m.echange * 1e6;
  if (I.cle !== cle) {
    I.cle = cle;
    I.age = 0;
    I.plan = null;
    if (b.dernier === e && m.echange === 1) I.monte = hasard(m) < (STYLES[p.style]?.filet || 0) * 0.85;
  } else I.age += 1;

  // Sa balle à lui part chez l'autre : il se replace (au filet s'il a décidé d'y monter).
  if (b.dernier === e) {
    const o = m.joueurs[1 - e];
    const y = I.monte ? -s * 3.6 : -s * (LONG + 0.9);
    const x = clamp(b.x * 0.35 + o.x * 0.15, -2.2, 2.2);
    return aller(p, x, y, 0.3);
  }

  // Il réagit avec un temps de retard.
  if (I.age < N.reaction) return prec & (T.g | T.d | T.h | T.b);
  if (!I.plan) {
    const c = prevoir(m, p);
    if (!c) { I.plan = { rien: true }; } else {
      const err = gauss(m) * N.erreur;
      const o = m.joueurs[1 - e];
      let charge = N.charge * (p.style === 'puissance' ? 1.15 : 1);
      const coup = choisirCoup(m, p);
      if (coup === 'amortie' || coup === 'lob') charge *= 0.4;
      // Contre un joueur au filet, on cherche le passing (le côté où il n'est pas).
      const oFilet = Math.abs(o.y) < 6;
      const vise = hasard(m) < (oFilet ? Math.min(1, N.vise + 0.35) : N.vise) ? (o.x > 0.4 ? -1 : o.x < -0.4 ? 1 : hasard(m) < 0.5 ? -1 : 1) : 0;
      I.plan = { x: c.x + err, y: c.y + err * 0.6, contact: m.f + c.k, coup, charge, vise, prof: hasard(m) < N.vise * 0.5 ? 1 : 0 };
    }
  }
  const P = I.plan;
  if (P.rien) return aller(p, clamp(b.x * 0.3, -2, 2), -s * (LONG + 0.8), 0.4);
  const reste = P.contact - m.f;
  const bit = BOUTONS[P.coup];
  let k = 0;
  // Au dernier moment, la visée prend la place du déplacement.
  if (reste <= 3 && p.prepa) k = viser(p, P.vise, P.prof);
  else k = aller(p, P.x, P.y);
  // Il arme son coup assez tôt pour le charger (et relâche d'abord si le bouton était encore tenu).
  const pres = dist(p.x, p.y, P.x, P.y) < 0.9;
  if ((reste <= P.charge + 4 && pres) || reste <= 5) {
    if (p.prepa) k |= p.prepa.bit;
    else if (!(prec & bit)) k |= bit;
  }
  return k;
}

/** Au service : le côté du court du carré visé (pour que « dehors » vise l'extérieur, « dedans » le T). */
function cotEgaliteSigne(m, p) {
  const eg = (m.score.points[0] + m.score.points[1]) % 2 === 0;
  return eg ? -sens(p.e) : sens(p.e);
}
