/**
 * RAFFUT — l'ordinateur : ce que fait chaque joueur qu'aucun humain ne
 * dirige (les deux équipes contre l'ordinateur, les coéquipiers de l'humain).
 *
 * En attaque : le porteur court vers l'en-but en évitant les défenseurs ;
 * pressé, il passe (vers l'arrière) au coéquipier qui a le plus d'espace, ou
 * il tape (un dégagement, un drop en fin de match) ; les autres se placent en
 * escalier, derrière lui, des deux côtés.
 * En défense : le plus proche du porteur va le plaquer, un deuxième le couvre,
 * les autres forment une ligne face aux attaquants (plus ou moins haute selon
 * le style), le dernier reste en couverture derrière.
 * Au ruck : le demi de mêlée vient chercher le ballon, un avant pousse, un
 * défenseur gratte, les autres se replacent derrière la ligne de hors-jeu.
 * Ballon libre (un coup de pied, un ballon qui roule) : les deux plus proches
 * de chaque équipe y vont, les autres se replacent.
 *
 * Le style du club (equipes.js, STYLES) règle tout cela.
 * Module partagé, sans DOM ; déterministe (le hasard vient du match).
 */

import { DEMI_L, MORT, DEMI_W, N, PORTEE_PLAQUAGE, hasard, clamp, dist, distSegment, chute, resteEssai } from './terrain.js';
import { STYLES } from './equipes.js';

/**
 * Les niveaux de l'ordinateur. Ses réflexes (reaction : plus c'est petit, plus il plonge vite),
 * ses plaquages (plaquage : + à la chance), ses percussions (percussion : − à la chance de le plaquer),
 * ses grattages (gratte : + au ruck, à la mêlée, en touche), sa vitesse (vitesse, ×),
 * l'adresse de ses transformations (adresse : l'écart, × ; pied : l'erreur sur la force, ×),
 * et sa lecture du jeu (lecture : le choix des passes). Normal : neutre (l'équilibre des clubs).
 */
export const NIVEAUX = [
  { nom: 'Facile', reaction: 22, plaquage: -0.16, percussion: -0.08, gratte: -0.06, vitesse: 0.9, adresse: 1.4, pied: 1.6, lecture: 0.5 },
  { nom: 'Normal', reaction: 9, plaquage: 0, percussion: 0, gratte: 0, vitesse: 1, adresse: 1, pied: 1, lecture: 0.85 },
  { nom: 'Difficile', reaction: 4, plaquage: 0.07, percussion: 0.05, gratte: 0.05, vitesse: 1.06, adresse: 0.8, pied: 0.7, lecture: 1 },
];
export const niveauDe = (eq) => NIVEAUX[eq.ctrl === 'ia' ? eq.niveau : 1];

const RIEN = { mx: 0, my: 0, sprint: false, action: null };

/** Aller vers (x, y) : on ralentit en arrivant. o : { sprint, fx, fy (où regarder), allure } */
function vers(p, x, y, o = {}) {
  x = clamp(x, -MORT + 0.5, MORT - 0.5);
  y = clamp(y, -DEMI_W + 0.6, DEMI_W - 0.6);
  const dx = x - p.x, dy = y - p.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.15) return { mx: 0, my: 0, sprint: false, action: null, fx: o.fx || 0, fy: o.fy || 0 };
  const f = Math.min(1, d / 1.2) * (o.allure ?? 1);
  return { mx: (dx / d) * f, my: (dy / d) * f, sprint: !!o.sprint && d > 2.5, action: null, fx: o.fx || 0, fy: o.fy || 0 };
}

const debout = (p) => !p.absent && p.etat !== 'sol' && p.etat !== 'plonge';
/** Les joueurs de l'équipe e (les tableaux sont gardés : ils ne changent pas pendant un match). */
const cache = new WeakMap();
function equipe(m, e) {
  let t = cache.get(m.joueurs);
  if (!t) { t = [m.joueurs.slice(0, N), m.joueurs.slice(N, 2 * N)]; cache.set(m.joueurs, t); }
  return t[e];
}

/** L'espace autour de r : la distance du défenseur debout le plus proche (au plus 10 m). */
function espace(m, r) {
  let d = 10;
  for (const o of equipe(m, 1 - r.e)) if (debout(o)) d = Math.min(d, dist(o.x, o.y, r.x, r.y));
  return d;
}

/** Une passe de p vers r risque-t-elle l'interception ? (0 : non, jusqu'à 1) */
function risquePasse(m, p, r) {
  let risque = 0;
  for (const o of equipe(m, 1 - p.e)) {
    if (!debout(o)) continue;
    const { d, t } = distSegment(o.x, o.y, p.x, p.y, r.x, r.y);
    if (t > 0.1 && t < 0.95 && d < 1.2) risque = Math.max(risque, 1 - d / 1.2);
  }
  return risque;
}

/**
 * L'escalier d'attaque : les coéquipiers du porteur (réel ou à venir, en (cx, cy)),
 * derrière lui, des deux côtés, d'autant plus écartés que le club joue au large.
 * Rend { id: [x, y] }.
 */
function escalier(m, e, cx, cy, sauf, profondeur = 0) {
  const s = m.equipes[e].sens;
  const st = STYLES[m.equipes[e].style];
  const autres = equipe(m, e).filter((p) => !p.absent && p.id !== sauf && !(sauf2(p)));
  const n = autres.length;
  const places = {};
  if (!n) return places;
  const gG = cy + DEMI_W - 1, gD = DEMI_W - 1 - cy;
  let nD = Math.round((n * gD) / Math.max(1, gG + gD));
  nD = clamp(nD, n > 1 && gD > 5 ? 1 : 0, n);
  const nG = n - nD;
  const ecart = (g, k) => clamp((g - 1) / (k + 0.4), 2.2, 4.5 + 2.5 * st.large);
  const eD = ecart(gD, nD), eG = ecart(gG, nG);
  const slots = [];
  for (let k = nG; k >= 1; k--) slots.push([cx - s * (1.8 + 1.2 * k + profondeur), cy - k * eG]);
  for (let k = 1; k <= nD; k++) slots.push([cx - s * (1.8 + 1.2 * k + profondeur), cy + k * eD]);
  autres.sort((a, b) => a.y - b.y || a.id - b.id);
  autres.forEach((p, k) => { places[p.id] = slots[k]; });
  return places;
}
const sauf2 = () => false;

/* ------------------------------------------------------------------ */
/* L'attaque                                                           */
/* ------------------------------------------------------------------ */

function porteur(m, c, cons) {
  const e = c.e, s = m.equipes[e].sens;
  const eq = m.equipes[e];
  const st = STYLES[eq.style];
  const niv = niveauDe(eq);
  if (c.etat === 'pied') { cons[c.id] = { ...RIEN }; return; }
  const reste = resteEssai(m, c);
  // Les défenseurs qui menacent : devant lui (ou presque), debout.
  let dmin = 20, proche = null, py = 0;
  const avant = c.i <= 2;
  const evite = (avant ? 0.6 : 1.1) * (2 - st.percussion) * (c.vedette && st.vedette ? 1.2 : 1);
  for (const o of equipe(m, 1 - e)) {
    if (!debout(o) && o.etat !== 'plonge') continue;
    const dev = s * (o.x - c.x);
    const d = dist(o.x, o.y, c.x, c.y);
    if (dev < -1.2) continue;
    if (d < dmin) { dmin = d; proche = o; }
    if (d < 8 && dev > -0.5) {
      const w = ((8 - d) / 8) * evite;
      const ly = (c.y - o.y) / (d || 1);
      py += (ly === 0 ? (c.y > 0 ? -1 : 1) : ly) * w * (dev > 0 ? 1.4 : 0.6);
    }
  }
  // Près de la touche : on rentre ; tout près de l'en-but : droit devant (vers le milieu des poteaux si on peut).
  if (c.y > DEMI_W - 3.5) py -= (c.y - DEMI_W + 3.5) * 0.6;
  if (c.y < -DEMI_W + 3.5) py += (-DEMI_W + 3.5 - c.y) * 0.6;
  if (reste < 6 && dmin > 2.5) py = clamp(-c.y * 0.05, -0.3, 0.3);
  if (reste < 0) py += -c.y * 0.08;
  let mx = s, my = clamp(py, -1.3, 1.3);
  const l = Math.sqrt(mx * mx + my * my);
  mx /= l; my /= l;
  const cons0 = { mx, my, sprint: c.endu > 0.25 && (dmin < 9 || reste < 18 || st.relance > 1.2), action: null };
  cons[c.id] = cons0;

  // Un plaqueur qui plonge sur lui : le raffut, ou un geste technique (le crochet pour les rapides, la roulette pour les costauds).
  const libre = c.recup <= 0 && !c.geste;
  if (proche && proche.etat === 'plonge' && dmin < 2.2 && hasard(m) < 0.25 + Math.max(c.n.force, c.n.vitesse) / 300) {
    const raffutPret = c.raffut <= 0 && c.verrou <= 0;
    if (libre && (!raffutPret || hasard(m) < 0.5)) {
      cons0.action = { type: 'geste', geste: c.n.vitesse >= c.n.force ? 'crochet' : 'roulette', dy: 0 };
      return;
    }
    if (raffutPret) { cons0.action = { type: 'raffut' }; return; }
  }
  // Un défenseur qui arrive en face : parfois, un crochet avant le contact.
  if (libre && proche && proche.etat === 'normal' && dmin < 2.6 && dmin > 1.2 && c.n.vitesse > 75 && hasard(m) < 0.05) {
    cons0.action = { type: 'geste', geste: 'crochet', dy: 0 };
    return;
  }
  if (c.dec > 0 || c.recu < 6) return;
  c.dec = 8;

  // Le drop : en fin de match ou au point en or, assez près, bien en face.
  const ecart = m.score[e] - m.score[1 - e];
  const fin = m.enOr || ((m.sirene || m.chrono > m.duree - 25 * 60) && m.periode === 2 && ecart < 0 && ecart >= -3);
  if (reste > 7 && reste < 24 && Math.abs(c.y) < 9 && dmin > 3.2 && (fin || (st.pied > 1.4 && hasard(m) < 0.0015 * st.pied)) && c.n.pied > 55) {
    cons0.action = { type: 'armer', cible: 16, viser: { tx: s * DEMI_L, ty: 0, z1: 5.5, pente: 0.75 } };
    c.dec = 30;
    return;
  }

  // La passe : pressé (ou le demi qui sort le ballon du ruck), au coéquipier qui a le plus d'espace.
  const demi = c.i === 3 && c.recu < 45 && m.f - m.poss.f < 200;
  const seuil = 1.8 + 0.8 * st.large - 0.6 * (st.percussion - 1) - (avant ? 0.4 : 0) - (c.vedette && st.vedette ? 0.6 : 0);
  const presse = dmin < seuil && c.recu > 24;
  let best = null, bv = -1e9;
  if (presse || demi || (dmin < 6 && c.recu > 30 && hasard(m) < 0.02 * st.large)) {
    for (const r of equipe(m, e)) {
      if (r === c || !debout(r)) continue;
      const av = s * (r.x - c.x);
      const d = dist(r.x, r.y, c.x, c.y);
      if (av > 0.2 || d > 15 || d < 1) continue;
      const esp = espace(m, r);
      let v = esp * niv.lecture + hasard(m) * 1.5 - risquePasse(m, c, r) * 7 - d * 0.08 + Math.abs(r.y - c.y) * 0.06 * st.large;
      if (st.vedette && r.vedette) v += 2.5;
      if (r.i === 6 || r.i === 5) v += 0.4 * st.large;
      if (v > bv) { bv = v; best = r; }
    }
  }
  if (best && (demi || (espace(m, best) > Math.max(4, dmin + 2)) || (dmin < 1.3 && hasard(m) < 0.2))) {
    cons0.action = { type: 'passe', cible: best.id };
    c.dec = 14;
    return;
  }

  // Pressé, sans passe qui vaille : la feinte de passe, pour faire mordre la défense.
  if (libre && presse && dmin > 1.2 && hasard(m) < 0.12 && c.n.passe > 70) {
    cons0.action = { type: 'geste', geste: 'feinte', dy: 0 };
    return;
  }
  // Le dégagement : dans son camp, pressé, sans solution.
  if (s * c.x < -5 && dmin < 4 && hasard(m) < 0.06 * st.pied && c.n.pied > 50) {
    const vers22 = Math.abs(c.y) > 5 ? Math.sign(c.y) : (hasard(m) < 0.5 ? -1 : 1);
    cons0.action = { type: 'armer', cible: 34 + Math.floor(hasard(m) * 18), dy: vers22 * (0.3 + hasard(m) * 0.6) };
    c.dec = 30;
    return;
  }
  // Le coup de pied à suivre (les clubs qui jouent au pied) : dans le camp adverse, une défense regroupée.
  if (st.pied > 1.4 && s * c.x > -8 && s * c.x < 14 && dmin < 3.5 && hasard(m) < 0.02 * st.pied && c.n.pied > 70) {
    cons0.action = { type: 'armer', cible: 16 + Math.floor(hasard(m) * 10), dy: (hasard(m) - 0.5) * 1.2 };
    c.dec = 30;
  }
}

function attaque(m, e, c, cons) {
  if (!cons[c.id]) porteur(m, c, cons);
  const places = escalier(m, e, c.x + c.vx * 0.3, c.y, c.id);
  for (const id in places) {
    const p = m.joueurs[id];
    if (cons[p.id] || !debout(p)) continue;
    const [x, y] = places[id];
    cons[p.id] = vers(p, x, y, { sprint: dist(p.x, p.y, x, y) > 3, fx: m.equipes[e].sens });
  }
}

/* ------------------------------------------------------------------ */
/* La défense                                                          */
/* ------------------------------------------------------------------ */

/**
 * La défense face à un porteur (cx, cy) de l'autre équipe, qui attaque dans le sens sa ;
 * plaquer : on a affaire à un vrai porteur (on peut plonger sur lui).
 */
function defense(m, e, cons, c, cx, cy, plaquer, ligneX = null) {
  const eq = m.equipes[e];
  const st = STYLES[eq.style];
  const niv = niveauDe(eq);
  const sa = -eq.sens; // le sens des attaquants
  const nous = equipe(m, e).filter((p) => debout(p));
  if (!nous.length) return;
  // Le plaqueur : le plus proche (un défenseur déjà dépassé compte plus loin).
  const cout = (p) => dist(p.x, p.y, cx, cy) + (sa * (p.x - cx) < -0.5 ? 3 : 0);
  const tri = [...nous].sort((a, b) => cout(a) - cout(b) || a.id - b.id);
  const plaqueur = ligneX === null ? tri[0] : null;
  const couvreur = plaquer && ligneX === null && tri[1] && cout(tri[1]) < 6 ? tri[1] : null;
  // La couverture : l'ailier (ou le dernier), s'il n'est pas le plaqueur.
  let arriere = nous.find((p) => p.i === 6) || null;
  if (arriere === plaqueur || arriere === couvreur || nous.length < 4) arriere = null;
  if (plaqueur && !cons[plaqueur.id]) {
    const d = dist(plaqueur.x, plaqueur.y, cx, cy);
    const lead = Math.min(0.5, d / 9);
    const vx = c ? c.vx : 0, vy = c ? c.vy : 0;
    const k = vers(plaqueur, cx + vx * lead, cy + vy * lead, { sprint: plaquer && d > 1.5, allure: plaquer ? 1 : 0.7, fx: cx - plaqueur.x, fy: cy - plaqueur.y });
    k.mx = k.mx || 0; k.my = k.my || 0;
    if (d > 0.3 && plaquer) { const l = Math.sqrt(k.mx * k.mx + k.my * k.my) || 1; k.mx /= l; k.my /= l; }
    if (plaquer && d < PORTEE_PLAQUAGE * 0.7 && plaqueur.verrou <= 0 && hasard(m) < Math.min(1, 2 / (niv.reaction * 0.5 + 1))) k.action = { type: 'plaquer' };
    cons[plaqueur.id] = k;
  }
  if (couvreur && !cons[couvreur.id]) {
    const d = dist(couvreur.x, couvreur.y, cx, cy);
    const k = vers(couvreur, cx + sa * 1.2, cy + (couvreur.y > cy ? 1.2 : -1.2), { sprint: true, fx: cx - couvreur.x, fy: cy - couvreur.y });
    if (plaquer && d < PORTEE_PLAQUAGE * 0.6 && couvreur.verrou <= 0 && hasard(m) < 1 / (niv.reaction * 0.5 + 1)) k.action = { type: 'plaquer' };
    cons[couvreur.id] = k;
  }
  if (arriere && !cons[arriere.id]) {
    const x = clamp(cx + sa * 11, -DEMI_L + 2, DEMI_L - 2);
    cons[arriere.id] = vers(arriere, sa > 0 ? Math.max(x, cx + 4) : Math.min(x, cx - 4), cy * 0.6, { fx: cx - arriere.x, fy: cy - arriere.y });
  }
  // La ligne : face aux attaquants, rangés de la même façon (par la largeur).
  const ligne = nous.filter((p) => p !== plaqueur && p !== couvreur && p !== arriere && !cons[p.id]).sort((a, b) => a.y - b.y || a.id - b.id);
  const att = equipe(m, 1 - e).filter((p) => !p.absent && (!c || p.id !== c.id)).sort((a, b) => a.y - b.y || a.id - b.id);
  const gap = clamp(5 - (st.monte - 1) * 5, 2.5, 6);
  ligne.forEach((p, k) => {
    let ax, ay;
    if (att.length) {
      const a = att[Math.min(att.length - 1, Math.round((k * (att.length - 1)) / Math.max(1, ligne.length - 1)))];
      ax = a.x; ay = a.y + (cy - a.y) * 0.18;
    } else { ax = cx; ay = -12 + (24 * k) / Math.max(1, ligne.length - 1); }
    let x = ligneX !== null ? ligneX : ax + sa * gap;
    // On ne défend pas derrière le ballon : la ligne reste devant (de notre côté).
    if (ligneX === null && sa * (x - cx) < 1.5) x = cx + sa * 1.5;
    cons[p.id] = vers(p, x, ay, { sprint: dist(p.x, p.y, x, ay) > 4, fx: cx - p.x, fy: cy - p.y });
  });
}

/* ------------------------------------------------------------------ */
/* Le ruck, le ballon libre                                            */
/* ------------------------------------------------------------------ */

function ruck(m, e, cons) {
  const r = m.ruck;
  const eq = m.equipes[e];
  const s = eq.sens;
  const st = STYLES[eq.style];
  const nous = equipe(m, e).filter((p) => debout(p) && !cons[p.id]);
  if (r.e === e) {
    // Le demi de mêlée (ou le plus proche) vient chercher le ballon ; un avant pousse ; les autres derrière.
    const ox = r.x - s * 1.1;
    const tri = [...nous].sort((a, b) => dist(a.x, a.y, ox, r.y) - dist(b.x, b.y, ox, r.y) || a.id - b.id);
    const dm = nous.find((p) => p.i === 3 && dist(p.x, p.y, ox, r.y) < 14) || tri[0];
    if (dm) cons[dm.id] = vers(dm, ox, r.y, { sprint: true, fx: s, fy: 0 });
    const pousseur = tri.find((p) => p !== dm);
    if (pousseur && dist(pousseur.x, pousseur.y, r.x, r.y) < 9) cons[pousseur.id] = vers(pousseur, r.x - s * 0.3, r.y + (pousseur.y > r.y ? 0.5 : -0.5), { sprint: true, fx: s });
    const places = escalier(m, e, r.x - s * 1.2, r.y, dm ? dm.id : -1, 1.5);
    for (const id in places) {
      const p = m.joueurs[id];
      if (cons[p.id] || !debout(p) || p === pousseur) continue;
      const [x, y] = places[id];
      cons[p.id] = vers(p, x, y, { sprint: dist(p.x, p.y, x, y) > 3, fx: s });
    }
    return;
  }
  // La défense : un gratteur (le plus proche), les autres en ligne devant le ruck, de notre côté.
  const tri = [...nous].sort((a, b) => dist(a.x, a.y, r.x, r.y) - dist(b.x, b.y, r.x, r.y) || a.id - b.id);
  const g = tri[0];
  if (g && dist(g.x, g.y, r.x, r.y) < 7) {
    const k = vers(g, r.x + s * 0.2, r.y, { sprint: true, fx: r.x - g.x, fy: r.y - g.y });
    if (dist(g.x, g.y, r.x, r.y) < 2.4 && g.verrou <= 0 && hasard(m) < 0.03 * st.gratte) k.action = { type: 'gratter' };
    cons[g.id] = k;
  }
  defense(m, e, cons, null, r.x, r.y, false, r.x + s * 3);
}

function balleLibre(m, e, cons) {
  const b = m.ballon;
  const eq = m.equipes[e];
  const s = eq.sens;
  const cible = b.cible >= 0 ? m.joueurs[b.cible] : null;
  if (cible && !b.pied) {
    // Une passe en l'air : le receveur va au ballon, ses coéquipiers s'étagent ; la défense, elle, monte sur lui.
    const c = chute(b, 1.15);
    if (cible.e === e) {
      if (!cons[cible.id]) cons[cible.id] = vers(cible, c.x + s * 0.4, c.y, { sprint: true });
      const places = escalier(m, e, c.x, c.y, cible.id);
      for (const id in places) {
        const p = m.joueurs[id];
        if (cons[p.id] || !debout(p)) continue;
        const [x, y] = places[id];
        cons[p.id] = vers(p, x, y, { sprint: dist(p.x, p.y, x, y) > 3, fx: s });
      }
    } else defense(m, e, cons, cible, c.x, c.y, false);
    return;
  }
  // Un coup de pied, un ballon qui roule : les deux plus proches y vont, les autres se replacent derrière.
  const L = b.pied && !b.pied.sol && b.z > 1 ? chute(b, 1.6) : { x: b.x + b.vx * 0.35, y: b.y + b.vy * 0.35 };
  const tx = clamp(L.x, -MORT + 0.5, MORT - 0.5), ty = clamp(L.y, -DEMI_W + 0.5, DEMI_W - 0.5);
  const nous = equipe(m, e).filter((p) => debout(p) && !cons[p.id]);
  const tri = [...nous].sort((a, b2) => dist(a.x, a.y, tx, ty) - dist(b2.x, b2.y, tx, ty) || a.id - b2.id);
  tri.slice(0, 2).forEach((p, k) => {
    cons[p.id] = vers(p, tx + (k ? -s * 1.5 : 0), ty + (k ? (p.y > ty ? 1 : -1) : 0), { sprint: true, fx: b.x - p.x, fy: b.y - p.y });
  });
  const reste = tri.slice(2).sort((a, b2) => a.y - b2.y || a.id - b2.id);
  const n = reste.length;
  const kicke = b.pied && b.pied.e === e;
  reste.forEach((p, k) => {
    const y = -DEMI_W + 3 + ((2 * DEMI_W - 6) * (k + 0.5)) / Math.max(1, n);
    // L'équipe qui a tapé monte (pour mettre la pression) ; l'autre se replie derrière le ballon.
    const x = kicke ? tx - s * 5 : tx - s * 7;
    cons[p.id] = vers(p, x, y, { sprint: dist(p.x, p.y, x, y) > 5, fx: b.x - p.x, fy: b.y - p.y });
  });
}

/* ------------------------------------------------------------------ */
/* Pour chaque image                                                   */
/* ------------------------------------------------------------------ */

/** Ce que font les joueurs de l'équipe e qu'aucun humain ne dirige (cons : les consignes, à remplir). */
export function decider(m, e, cons) {
  if (m.phase !== 'jeu' && m.phase !== 'ruck') return;
  const eq = m.equipes[e];
  const b = m.ballon;
  const nous = equipe(m, e);
  // L'ordinateur réfléchit une image sur deux ; entre-temps, chacun garde sa consigne (sans refaire l'action).
  if ((m.f + e) % 2 === 1) {
    for (const p of nous) {
      if (cons[p.id]) continue;
      if (p.ordre) { p.ordre.action = null; cons[p.id] = p.ordre; } else cons[p.id] = { ...RIEN, fx: b.x - p.x, fy: b.y - p.y };
    }
    return;
  }
  const deja = nous.map((p) => !!cons[p.id]);
  decider2(m, e, cons);
  nous.forEach((p, k) => { if (!deja[k]) p.ordre = cons[p.id]; });
}

function decider2(m, e, cons) {
  const eq = m.equipes[e];
  const b = m.ballon;
  if (eq.immobile) {
    for (const p of equipe(m, e)) if (!cons[p.id]) cons[p.id] = { ...RIEN, fx: b.x - p.x, fy: b.y - p.y };
    return;
  }
  if (m.phase === 'ruck') ruck(m, e, cons);
  else if (b.porteur >= 0) {
    const c = m.joueurs[b.porteur];
    if (c.e === e) attaque(m, e, c, cons);
    else if (!b.bloque) defense(m, e, cons, c, c.x, c.y, true);
  } else balleLibre(m, e, cons);
  // Ceux qui n'ont rien à faire : ils regardent le ballon.
  for (const p of equipe(m, e)) if (!cons[p.id]) cons[p.id] = { ...RIEN, fx: b.x - p.x, fy: b.y - p.y };
}
