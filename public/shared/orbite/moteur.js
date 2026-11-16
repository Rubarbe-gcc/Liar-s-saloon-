// ORBITE NOIRE — moteur déterministe (entiers, millièmes de case, 20 pas/s). Aucun DOM.
export const W = 64, H = 64;
export const UN = {
  ouvrier:   { pv: 40,  v: 70, pt: 1000, deg: 0,  cd: 10, cout: 50,  tp: 160, vue: 6000 },
  fantassin: { pv: 117,  v: 80, pt: 1200, deg: 10, cd: 10, cout: 80,  tp: 200, vue: 6000 },
  tireur:    { pv: 78,  v: 75, pt: 5500, deg: 9,  cd: 12, cout: 100, tp: 240, vue: 7000 },
  blinde:    { pv: 286, v: 55, pt: 2000, deg: 22, cd: 16, cout: 220, tp: 400, vue: 6000 },
};
export const BA = {
  noyau:   { pv: 800, cout: 0,   tc: 0,   vue: 8000, prod: ['ouvrier'] },
  caserne: { pv: 400, cout: 150, tc: 300, vue: 5000, prod: ['fantassin', 'tireur'] },
  atelier: { pv: 450, cout: 250, tc: 400, vue: 5000, prod: ['blinde'] },
  tour:    { pv: 300, cout: 120, tc: 200, vue: 7000, pt: 6500, deg: 12, cd: 10 },
};
Object.assign(UN, {
  semeur:      { pv: 45,  v: 65, pt: 1000, deg: 0,  cd: 10, cout: 45,  tp: 150, vue: 6000 },
  rejeton:     { pv: 110,  v: 85, pt: 1200, deg: 8,  cd: 8,  cout: 55,  tp: 130, vue: 6000, pra: 1 },
  epine:       { pv: 75,  v: 70, pt: 5000, deg: 8,  cd: 10, cout: 90,  tp: 205, vue: 7000, pra: 1 },
  colosse:     { pv: 531, v: 45, pt: 1800, deg: 26, cd: 20, cout: 240, tp: 420, vue: 6000, pra: 1 },
  tisseur:     { pv: 35,  v: 75, pt: 1000, deg: 0,  cd: 10, cout: 55,  tp: 170, vue: 6000 },
  eclat:       { pv: 52,  v: 95, pt: 1200, deg: 9,  cd: 9,  cout: 85,  tp: 200, vue: 6000, bm: 42,  res: 1 },
  pulse:       { pv: 42,  v: 75, pt: 5500, deg: 10, cd: 12, cout: 110, tp: 250, vue: 7000, bm: 31,  res: 1 },
  sentinelle:  { pv: 147, v: 55, pt: 2000, deg: 18, cd: 16, cout: 230, tp: 400, vue: 6000, bm: 127, res: 1 },
});
Object.assign(BA, {
  coeur:   { pv: 900, cout: 0,   tc: 0,   vue: 8000, prod: ['semeur'], qg: 1, enr: 1 },
  ruche:   { pv: 350, cout: 120, tc: 200, vue: 5000, prod: ['rejeton', 'epine'], enr: 1 },
  serre:   { pv: 400, cout: 220, tc: 280, vue: 5000, prod: ['colosse'], enr: 1 },
  ronce:   { pv: 280, cout: 100, tc: 150, vue: 7000, pt: 6000, deg: 10, cd: 10, enr: 1 },
  nexus:   { pv: 700, cout: 0,   tc: 0,   vue: 8000, prod: ['tisseur'], qg: 1 },
  foyer:   { pv: 380, cout: 150, tc: 300, vue: 5000, prod: ['eclat', 'pulse'] },
  forge:   { pv: 420, cout: 250, tc: 400, vue: 5000, prod: ['sentinelle'] },
  phare:   { pv: 300, cout: 130, tc: 200, vue: 7000, pt: 6500, deg: 12, cd: 10 },
});
Object.assign(UN, {
  gardien:  { pv: 120, v: 60, pt: 1200, deg: 9,  cd: 10, cout: 0, tp: 0, vue: 3500 },   // neutre (équipe 2)
  marechal: { pv: 700, v: 60, pt: 2200, deg: 30, cd: 14, cout: 300, en: 100, tp: 500, vue: 7000, ch: 1 },            // Champion Ligue de Fer
  ancien:   { pv: 800, v: 50, pt: 2000, deg: 28, cd: 14, cout: 300, en: 100, tp: 500, vue: 7000, ch: 1, pra: 1 },    // Champion Bosquet
  oracle:   { pv: 500, bm: 300, v: 65, pt: 5500, deg: 26, cd: 14, cout: 300, en: 100, tp: 500, vue: 7500, ch: 1, res: 1 }, // Champion Échos
});
BA.atelier.prod.push('marechal'); BA.serre.prod.push('ancien'); BA.forge.prod.push('oracle');
UN.ouvrier.ouv = UN.semeur.ouv = UN.tisseur.ouv = 1; BA.noyau.qg = 1;
// Bosquet : Enracinement (bâtiments qui se régénèrent) + Prairie (unités soignées près de leurs bâtiments)
// Échos : Résonance (+dégâts par allié proche, max +3) + boucliers qui se rechargent hors combat
export const FA = {
  fer:    { qg: 'noyau', ouv: 'ouvrier', bat: ['caserne', 'atelier', 'tour'], u: ['fantassin', 'tireur', 'blinde'] },
  bosquet:{ qg: 'coeur', ouv: 'semeur',  bat: ['ruche', 'serre', 'ronce'], u: ['rejeton', 'epine', 'colosse'] },
  echos:  { qg: 'nexus', ouv: 'tisseur', bat: ['foyer', 'forge', 'phare'], u: ['eclat', 'pulse', 'sentinelle'] },
};
// Cendres : Brûlure (les coups enflamment : 2 dégâts toutes les 0,5 s pendant 3 s) + Braise (une unité qui meurt explose : 12 dégâts à 1,5 case)
Object.assign(UN, {
  porteur:  { pv: 42,  v: 70, pt: 1000, deg: 0,  cd: 10, cout: 50,  tp: 160, vue: 6000 },
  tison:    { pv: 105, v: 90, pt: 1200, deg: 10, cd: 9,  cout: 75,  tp: 180, vue: 6000, brule: 1, braise: 1 },
  lanceur:  { pv: 78,  v: 72, pt: 5000, deg: 8,  cd: 12, cout: 100, tp: 240, vue: 7000, brule: 1, braise: 1 },
  brasero:  { pv: 310, v: 50, pt: 2500, deg: 19, cd: 16, cout: 230, tp: 400, vue: 6000, brule: 1, braise: 1 },
  pyrarque: { pv: 650, v: 58, pt: 2600, deg: 26, cd: 14, cout: 300, en: 100, tp: 500, vue: 7000, ch: 1, brule: 1 }, // Champion Cendres
});
Object.assign(BA, {
  fournaise: { pv: 800, cout: 0,   tc: 0,   vue: 8000, prod: ['porteur'], qg: 1 },
  atre:      { pv: 380, cout: 140, tc: 280, vue: 5000, prod: ['tison', 'lanceur'] },
  creuset:   { pv: 430, cout: 240, tc: 380, vue: 5000, prod: ['brasero', 'pyrarque'] },
  geyser:    { pv: 280, cout: 120, tc: 200, vue: 7000, pt: 6000, deg: 11, cd: 10, brule: 1 },
});
UN.porteur.ouv = 1;
FA.cendres = { qg: 'fournaise', ouv: 'porteur', bat: ['atre', 'creuset', 'geyser'], u: ['tison', 'lanceur', 'brasero'] };
// population : chaque unité occupe de la place ; le QG en donne 10, chaque bâtiment de ravitaillement 8 (100 au plus)
Object.assign(BA, {
  entrepot: { pv: 220, cout: 100, tc: 160, vue: 4000, pop: 8 },   // Ligue de Fer
  terrier:  { pv: 200, cout: 100, tc: 160, vue: 4000, pop: 8, enr: 1 }, // Bosquet
  diapason: { pv: 180, cout: 100, tc: 160, vue: 4000, pop: 8 },   // Échos
  braisier: { pv: 200, cout: 100, tc: 160, vue: 4000, pop: 8 },   // Cendres
});
for (const k of ['noyau', 'coeur', 'nexus', 'fournaise']) { BA[k].pop = 10; BA[k].cout = 400; BA[k].tc = 600; } // un QG de plus = une expansion
FA.fer.ravit = 'entrepot'; FA.bosquet.ravit = 'terrier'; FA.echos.ravit = 'diapason'; FA.cendres.ravit = 'braisier';
export const POP_MAX = 100;
export const popDe = k => (UN[k].ch ? 4 : UN[k].pv >= 250 ? 3 : 1);
/** [population utilisée (files comprises), population disponible] d'une équipe. */
export function population(s, eq) {
  let u = 0, m = 0;
  for (const e of s.ent) if (e.eq === eq && e.pv > 0) { if (UN[e.k]) u += popDe(e.k); else { if (!e.cons) m += BA[e.k].pop || 0; for (const k of e.file) u += popDe(k); } }
  return [u, Math.min(POP_MAX, m)];
}
function hit(s, c, d, k) { c.last = k.eq; if ((UN[k.k] || BA[k.k] || {}).brule) c.feu = Math.max(c.feu || 0, 60); d = Math.max(1, Math.floor(d * 10 / (10 + s.up[c.eq].arm))); if (c.bc > 0) { const perce = FAC_U[k.k] === 'fer' || k.k === 'tour', ds = perce ? Math.floor(d * 3 / 2) : d, a = Math.min(c.bc, ds); c.bc -= a; d = Math.max(0, d - (perce ? Math.ceil(a * 2 / 3) : a)); } c.pv -= d; c.rg = 0; } // Ligue de Fer : munitions perforantes (+50 % sur les boucliers)
function regen(s, e) {
  const d = UN[e.k] || BA[e.k];
  if (e.bm) { if (e.rg < 60) e.rg++; else if (e.bc < e.bm && s.tick % 2 === 0) e.bc++; }
  if (e.feu > 0) { e.feu--; if (e.feu % 10 === 0) { if (e.bc > 0) e.bc = Math.max(0, e.bc - 2); else e.pv -= 2; } }
  if (e.feu > 0) return; // ce qui brûle ne se régénère pas
  if (d.enr && !e.cons && s.tick % 10 === 0 && e.pv < e.max) e.pv++;
  if (d.pra && s.tick % 20 === 0 && e.pv < e.max && s.ent.some(b => b.eq === e.eq && BA[b.k] && BA[b.k].enr && d2(b, e) <= 5000 * 5000)) e.pv = Math.min(e.max, e.pv + 2);
}
const mir = a => a.map(([x, y]) => [W - 1 - x, H - 1 - y]);
// 6 cartes 64x64 : base de l'équipe 0 (l'équipe 1 est en miroir : 63 - x, 63 - y), mines, Relais, sites d'expansion `exp` et massifs `rocs` d'un côté (miroir ajouté) ; `centre` et `rc` non mirorés
export const MAPS = [
  { nom: 'Croisée',        base: [8, 8],   mines: [[13, 8], [8, 13], [6, 26], [10, 31], [26, 6], [31, 10]], exp: [[10, 26], [26, 10]], centre: [[31, 32], [32, 31]], relais: [[18, 44], [34, 18]], rocs: [[21, 21, 2], [15, 36, 1], [36, 15, 1], [42, 26, 2]] },
  { nom: 'Diagonale',      base: [6, 6],   mines: [[11, 6], [6, 11], [16, 23], [23, 16], [4, 31], [8, 35]], exp: [[20, 20], [8, 30]], centre: [[31, 31], [32, 32]], relais: [[17, 42], [33, 13]], rocs: [[28, 8, 2], [14, 28, 1], [27, 27, 1]] },
  { nom: 'Duel au centre', base: [10, 10], mines: [[15, 10], [10, 15], [30, 10], [26, 7]], exp: [[26, 12]], centre: [[31, 31], [32, 32]], relais: [[20, 32], [33, 17]], rocs: [[24, 21, 2], [18, 26, 2], [40, 8, 1]] },
  { nom: 'Couloirs',       base: [6, 32],  mines: [[6, 26], [6, 38], [14, 11], [18, 8]], exp: [[18, 13]], centre: [[32, 16], [31, 47]], relais: [[24, 29]], rc: [[32, 32]], rocs: [[19, 22, 2], [19, 42, 2], [32, 24, 1]] },
  { nom: 'Archipel',       base: [8, 55],  mines: [[13, 55], [8, 50], [18, 37], [22, 35]], exp: [[22, 40]], centre: [[31, 32]], relais: [[15, 26], [33, 48]], rocs: [[25, 55, 2], [11, 38, 2], [28, 32, 1]] },
  { nom: 'Forteresse',     base: [32, 7],  mines: [[27, 7], [37, 7], [10, 12], [14, 9]], exp: [[14, 14]], centre: [[32, 32]], relais: [[12, 28], [20, 44]], rc: [[32, 38]], rocs: [[22, 17, 2], [42, 17, 2], [32, 25, 1]] },
];
// cartes de l'éditeur : même forme que MAPS ; refusée si une valeur sort des bornes (alors la carte 0 sert)
const pt = p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isInteger(v) && v >= 2 && v <= W - 3);
const pts = (l, max) => Array.isArray(l) && l.length <= max && l.every(pt);
export function carteValide(d) {
  if (!d || typeof d !== 'object' || !pt(d.base) || !pts(d.mines, 10) || !pts(d.exp || [], 3) || !pts(d.centre || [], 3) || !pts(d.relais || [], 4) || !pts(d.rc || [], 2) || !(d.rocs === undefined || (Array.isArray(d.rocs) && d.rocs.length <= 8 && d.rocs.every(r => Array.isArray(r) && r.length === 3 && pt(r.slice(0, 2)) && Number.isInteger(r[2]) && r[2] >= 1 && r[2] <= 3)))) return false;
  const [bx, by] = d.base; if (bx < 3 || by < 3 || bx > W - 4 || by > H - 4 || Math.hypot(bx - (W - 1 - bx), by - (H - 1 - by)) < 16 || !d.mines.length) return false;
  return [...d.mines, ...(d.relais || [])].every(([x, y]) => Math.hypot(x - bx, y - by) >= 3);
}
// niveaux d'IA : pas = décision tous les N pas ; th/nw = écart de taille de vague / d'ouvriers ; nb = bâtiments max ; bonus = multiplicateur de récolte
export const NIV = {
  1: { pas: 100, th: 3, nw: -2, nb: 2, bonus: 0.6,  rally: 0, up: 0 },
  2: { pas: 20, th: 0,  nw: 0,  nb: 5, bonus: 1,    rally: 1, up: 0 },
  3: { pas: 10, th: -2, nw: 2,  nb: 7, bonus: 1.1,  rally: 1, up: 1 },
  4: { pas: 10, th: -2, nw: 3,  nb: 7, bonus: 1.25, rally: 1, up: 1 },
};
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const sq = n => Math.floor(Math.sqrt(n));
const hasard = (s, n) => { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) | 0; return (s.rng >>> 8) % n; };
// ---------- terrain : grille de cases (niveau bas/haut, rampes, rochers, cristaux, bâtiments) ----------
// Tout en entiers (coordonnées doublées) : la même grille partout, donc la même partie en ligne.
const INF = 1 << 29;
const DIRS = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
export function terrain(M) {
  const N = W * H, g = { niv: new Uint8Array(N), rampe: new Uint8Array(N), roc: new Uint8Array(N), cristal: new Int16Array(N).fill(-1), occ: new Int32Array(N), champs: new Map(), ver: 0 };
  const bases = [M.base, ...mir([M.base])];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = 2 * x + 1, Y = 2 * y + 1, i = y * W + x;
    for (const [bx, by] of bases) {
      const dx = X - 2 * bx, dy = Y - 2 * by, D = dx * dx + dy * dy, cx = W - 2 * bx, cy = H - 2 * by, C = cx * cx + cy * cy, dot = dx * cx + dy * cy;
      if (D <= 354) g.niv[i] = 1;                                                    // plateau de la base : rayon ~9,4 cases
      if (D >= 225 && D <= 484 && dot > 0 && dot * dot * 100 >= 81 * D * C) g.rampe[i] = 1; // rampe tournée vers le centre
    }
  }
  const points = [...bases, ...(M.exp || []), ...mir(M.exp || []), ...M.mines, ...mir(M.mines), ...(M.centre || []), ...(M.relais || []), ...mir(M.relais || []), ...(M.rc || [])];
  const loin = (X, Y, r2) => points.every(([px, py]) => (X - 2 * px) ** 2 + (Y - 2 * py) ** 2 > r2);
  for (const [rx, ry, r] of [...(M.rocs || []), ...(M.rocs || []).map(([x, y, r]) => [W - 1 - x, H - 1 - y, r])])
    for (let y = Math.max(0, ry - r - 1); y <= Math.min(H - 1, ry + r + 1); y++) for (let x = Math.max(0, rx - r - 1); x <= Math.min(W - 1, rx + r + 1); x++) {
      const X = 2 * x + 1, Y = 2 * y + 1, i = y * W + x;
      if ((X - 2 * rx) ** 2 + (Y - 2 * ry) ** 2 <= 4 * r * r + 2 && !g.rampe[i] && loin(X, Y, 49)) g.roc[i] = 1;
    }
  // cristaux : les cases derrière chaque mine proche d'une base (vues depuis la base) bloquent le passage
  const sites = [...bases, ...(M.exp || []), ...mir(M.exp || [])];
  [...M.mines, ...mir(M.mines), ...(M.centre || [])].forEach(([mx, my], k) => {
    let bb = null, bd = INF; for (const [bx, by] of sites) { const d = (mx - bx) ** 2 + (my - by) ** 2; if (d < bd) { bd = d; bb = [bx, by]; } }
    if (bd > 225) return;
    for (let y = my - 3; y <= my + 2; y++) for (let x = mx - 3; x <= mx + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = 2 * x + 1 - 2 * mx, dy = 2 * y + 1 - 2 * my, D = dx * dx + dy * dy, dot = dx * (mx - bb[0]) + dy * (my - bb[1]);
      if (D >= 2 && D <= 14 && dot > 0) g.cristal[y * W + x] = k;
    }
  });
  // sécurité : si des rochers coupent la carte, on les enlève
  const s0 = { g }, c0 = cellule(bases[0][0] * 1000, bases[0][1] * 1000), f = champ(s0, c0 % W, (c0 / W) | 0);
  if (points.some(([px, py]) => f[cellule(px * 1000 - 500, py * 1000 - 500)] >= INF && f[cellule(px * 1000, py * 1000)] >= INF)) { g.roc.fill(0); g.champs.clear(); }
  return g;
}
const cellule = (x, y) => Math.max(0, Math.min(H - 1, Math.floor(y / 1000))) * W + Math.max(0, Math.min(W - 1, Math.floor(x / 1000)));
const libreCase = (g, i) => !g.roc[i] && g.cristal[i] < 0 && !g.occ[i];
/** Peut-on passer de la case a à la case b (voisines) ? Même niveau, ou l'une est une rampe. */
function passe(g, a, b) { return libreCase(g, b) && (g.niv[a] === g.niv[b] || g.rampe[a] || g.rampe[b]); }
function passeDiag(g, a, b) { const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0; return passe(g, a, b) && passe(g, a, ay * W + bx) && passe(g, a, by * W + ax); }
/** Champ de distances vers une case (mis en cache tant qu'aucun bâtiment ne change). */
function champ(s, gx, gy) {
  const g = s.g, but = gy * W + gx, cle = but + ':' + g.ver;
  let f = g.champs.get(cle); if (f) return f;
  f = new Int32Array(W * H).fill(INF); f[but] = 0;
  const seaux = [[but]];
  if (!libreCase(g, but)) for (let y = gy - 2; y <= gy + 2; y++) for (let x = gx - 2; x <= gx + 2; x++) { const i = y * W + x; if (x >= 0 && y >= 0 && x < W && y < H && !libreCase(g, i) && f[i]) { f[i] = 0; seaux[0].push(i); } } // but dans un obstacle : on part de tout l'obstacle
  for (let d = 0; d < seaux.length; d++) {
    const l = seaux[d]; if (!l) continue;
    for (const c of l) {
      if (f[c] !== d) continue;
      const cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy, k] of DIRS) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const n = y * W + x; // on remonte le chemin : il faut pouvoir aller de n vers c
        if (!libreCase(g, n)) continue;
        if (libreCase(g, c) && !(k === 10 ? passe(g, n, c) : passeDiag(g, n, c))) continue;
        const nd = d + k; if (nd < f[n]) { f[n] = nd; (seaux[nd] = seaux[nd] || []).push(n); }
      }
    }
  }
  if (g.champs.size > 60) g.champs.delete(g.champs.keys().next().value);
  g.champs.set(cle, f); return f;
}
/** La ligne droite de a vers (x, y) traverse-t-elle seulement des cases où l'on passe ? */
function ligne(g, ax, ay, x, y) {
  const dx = x - ax, dy = y - ay, n = Math.max(1, (Math.max(Math.abs(dx), Math.abs(dy)) / 250) | 0);
  let p = cellule(ax, ay);
  for (let i = 1; i <= n; i++) {
    const c = cellule(ax + Math.trunc(dx * i / n), ay + Math.trunc(dy * i / n));
    if (c === p) continue;
    const diag = (p % W) !== (c % W) && ((p / W) | 0) !== ((c / W) | 0);
    if (Math.abs((p % W) - (c % W)) > 1 || Math.abs(((p / W) | 0) - ((c / W) | 0)) > 1 || !(diag ? passeDiag(g, p, c) : passe(g, p, c))) return false;
    p = c;
  }
  return true;
}
/** Déplace e de (dx, dy) sans entrer dans une case interdite (glisse le long des murs). */
function pousser(s, e, dx, dy) {
  const g = s.g, a = cellule(e.x, e.y), ok = (x, y) => { const c = cellule(x, y); return c === a || !libreCase(g, a) || passe(g, a, c); };
  const nx = Math.max(500, Math.min(W * 1000 - 500, e.x + dx)), ny = Math.max(500, Math.min(H * 1000 - 500, e.y + dy));
  if (ok(nx, ny)) { e.x = nx; e.y = ny; } else if (ok(nx, e.y)) e.x = nx; else if (ok(e.x, ny)) e.y = ny;
}
/** Sort une unité d'une case occupée (bâtiment posé sur elle, poussée) vers la case libre la plus proche. */
function degager(s, e) {
  const g = s.g, a = cellule(e.x, e.y); if (libreCase(g, a)) return false;
  const ax = a % W, ay = (a / W) | 0;
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = ax + dx, y = ay + dy; if (x < 0 || y < 0 || x >= W || y >= H || !libreCase(g, y * W + x)) continue;
    e.x = x * 1000 + 500; e.y = y * 1000 + 500; return true;
  }
  return false;
}
/** Les cases d'un bâtiment posé en (x, y) : 4×4 pour un QG, 2×2 sinon. */
function emprise(k, x, y) {
  const h = BA[k].qg ? 2 : 1, cx = Math.round(x / 1000), cy = Math.round(y / 1000), l = [];
  for (let j = cy - h; j < cy + h; j++) for (let i = cx - h; i < cx + h; i++) if (i >= 0 && j >= 0 && i < W && j < H) l.push(j * W + i);
  return l;
}
/** Peut-on construire k en (x, y) ? Cases libres, même niveau, pas de rampe, rien dessus. */
export function placeLibre(s, k, x, y) {
  const g = s.g, l = emprise(k, x, y), h = BA[k].qg ? 2 : 1, cx = Math.round(x / 1000), cy = Math.round(y / 1000);
  if (cx - h < 1 || cy - h < 1 || cx + h > W - 1 || cy + h > H - 1) return false;
  return l.every(i => libreCase(g, i) && !g.rampe[i] && g.niv[i] === g.niv[l[0]]) && !s.mines.some(m => Math.abs(m.x - x) < (BA[k].qg ? 3500 : 2500) && Math.abs(m.y - y) < (BA[k].qg ? 3500 : 2500)) && !s.relais.some(r => Math.abs(r.x - x) < 3000 && Math.abs(r.y - y) < 3000);
}
function occuper(s, e, v) { for (const i of emprise(e.k, e.x, e.y)) s.g.occ[i] = v ? e.id : 0; s.g.ver++; }


// réglage d'équilibre : PV des unités par faction (pourcents), mesuré IA contre IA sur les 6 cartes avec le terrain
export const PV_FAC = { fer: 128, bosquet: 92, echos: 107, cendres: 87 };
const FAC_U = {}; for (const [f, d] of Object.entries(FA)) for (const k of [d.ouv, ...d.u]) FAC_U[k] = f;
FAC_U.marechal = 'fer'; FAC_U.ancien = 'bosquet'; FAC_U.oracle = 'echos'; FAC_U.pyrarque = 'cendres';
export function ajout(s, eq, k, x, y, fait = 1) {
  const d = UN[k] || BA[k], pv = UN[k] && FAC_U[k] ? Math.floor(d.pv * PV_FAC[FAC_U[k]] / 100) : d.pv;
  const e = { id: s.n++, eq, k, x, y, pv, max: pv, ordre: null, cd: 0, file: [], prog: 0, port: 0, w: 0, cons: fait ? 0 : d.tc, bc: d.bm || 0, bm: d.bm || 0, rg: 99, pc: 0 };
  s.ent.push(e);
  if (s.g) { if (BA[k]) occuper(s, e, 1); else degager(s, e); }
  return e;
}

export function creer(graine = 1, f0 = 'fer', f1 = 'fer', carte = 0, n0 = 2, n1 = 2, opt = {}) {
  const M = carteValide(opt.def) ? opt.def : (MAPS[carte] || MAPS[0]), B = [M.base, ...mir([M.base])];
  const s = { niv: [n0, n1], carte, bonus: [NIV[n0].bonus, NIV[n1].bonus], fac: [f0, f1], en: [0, 0], relais: [], tick: 0, pr: [300, 300], ent: [], n: 1, mines: [], fin: -1, rng: graine | 0, vis: [new Uint8Array(W * H), new Uint8Array(W * H)] };
  s.g = terrain(M);
  for (const [q, [x, y]] of B.entries()) {
    const F = FA[s.fac[q]]; ajout(s, q, F.qg, x * 1000, y * 1000);
    for (let i = 0; i < 3; i++) ajout(s, q, F.ouv, x * 1000 + i * 600 - 600, y * 1000 + 2500 * (q ? -1 : 1));
  }
  for (const [x, y] of [...M.mines, ...mir(M.mines), ...(M.centre || [])])
    s.mines.push({ x: x * 1000, y: y * 1000, q: 3500 + hasard(s, 1000) });
  // point d'approche des ouvriers : devant les cristaux, du côté de la base la plus proche
  const SITES = [...B, ...(M.exp || []), ...mir(M.exp || [])]; s.exp = [...(M.exp || []), ...mir(M.exp || [])].map(([x, y]) => ({ x: x * 1000, y: y * 1000 }));
  for (const m of s.mines) { let bb = SITES[0]; for (const b of SITES) if ((m.x - b[0] * 1000) ** 2 + (m.y - b[1] * 1000) ** 2 < (m.x - bb[0] * 1000) ** 2 + (m.y - bb[1] * 1000) ** 2) bb = b; const dx = bb[0] * 1000 - m.x, dy = bb[1] * 1000 - m.y, d = sq(dx * dx + dy * dy) || 1; m.ax = m.x + Math.trunc(dx * 700 / d); m.ay = m.y + Math.trunc(dy * 700 / d); }
  for (const [x, y] of [...(M.relais || []), ...mir(M.relais || []), ...(M.rc || [])]) {
    s.relais.push({ x: x * 1000, y: y * 1000, prog: 0, own: -1 });
    ajout(s, 2, 'gardien', x * 1000 - 800, y * 1000); ajout(s, 2, 'gardien', x * 1000 + 800, y * 1000);
  }
  s.opt = opt; s.up = [0, 1, 2].map(() => ({ att: 0, arm: 0, rec: 0 })); s.tot = [0, 0]; s.kills = [0, 0];
  if (opt.pr) s.pr = [...opt.pr]; if (opt.en) s.en = [...opt.en]; if (opt.bonus) s.bonus = [...opt.bonus];
  for (const d of opt.depart || []) renfort(s, d.eq, d.role, d.n);
  vue(s); return s;
}

/** Avance e vers (x, y) en contournant les obstacles ; vrai à l'arrivée (ou au plus près si le but est inaccessible). */
function aller(s, e, x, y, v) {
  const g = s.g, a = cellule(e.x, e.y), b = cellule(x, y);
  let tx = x, ty = y;
  if (a !== b && !ligne(g, e.x, e.y, x, y)) {
    const f = champ(s, b % W, (b / W) | 0);
    if (f[a] >= INF) { // enfermée (bâtiments autour) : on la pose sur la case accessible la plus proche
      const ax = a % W, ay = (a / W) | 0;
      for (let r = 1; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x2 = ax + dx, y2 = ay + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || x2 < 0 || y2 < 0 || x2 >= W || y2 >= H) continue; const n = y2 * W + x2; if (f[n] < INF && libreCase(g, n)) { e.x = x2 * 1000 + 500; e.y = y2 * 1000 + 500; return false; } }
    }
    if (f[a] < INF) {
      // on suit le champ quelques cases, et on vise la plus lointaine encore en ligne droite
      let c = a, vise = -1;
      for (let k = 0; k < 5 && c !== b; k++) {
        const cx = c % W, cy = (c / W) | 0; let m = f[c], nb = -1;
        for (const [dx, dy, kk] of DIRS) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx; if (f[n] < m && (kk === 10 ? passe(g, c, n) : passeDiag(g, c, n))) { m = f[n]; nb = n; } }
        if (nb < 0) break; c = nb;
        if (k === 0 || ligne(g, e.x, e.y, (c % W) * 1000 + 500, ((c / W) | 0) * 1000 + 500)) vise = c; else break;
      }
      if (vise < 0) return true; // déjà au plus près
      if (vise !== b) { tx = (vise % W) * 1000 + 500; ty = ((vise / W) | 0) * 1000 + 500; }
    }
  }
  const dx = tx - e.x, dy = ty - e.y, d = sq(dx * dx + dy * dy);
  if (d <= v) { pousser(s, e, dx, dy); return tx === x && ty === y; }
  const ox = e.x, oy = e.y; pousser(s, e, Math.trunc(dx * v / d), Math.trunc(dy * v / d));
  if (e.x === ox && e.y === oy && cellule(x, y) !== a && !libreCase(g, b) && Math.abs(x - e.x) + Math.abs(y - e.y) < 2600) return true; // collé à un but bloqué
  return false;
}
function cible(s, e, r) {
  let b = null, m = r * r + 1; const v = s.vis[e.eq], ne = s.g.niv[cellule(e.x, e.y)];
  for (const o of s.ent) if (o.eq !== e.eq && o.pv > 0) { const d = d2(e, o); if (d < m) { const c = cellule(o.x, o.y); if (v ? v[c] !== 2 : s.g.niv[c] > ne) continue; m = d; b = o; } }
  return b;
}
function frappe(s, e, c, u) {
  const r = u.pt + (BA[c.k] ? (BA[c.k].qg ? 2200 : 1200) : 0);
  if (d2(e, c) <= r * r) { if (!e.cd) { let d = Math.floor(u.deg * (10 + s.up[e.eq].att) / 10); if (u.res) d += Math.min(3, s.ent.filter(a => a !== e && a.eq === e.eq && a.pv > 0 && UN[a.k] && UN[a.k].res && d2(a, e) <= 3000 * 3000).length); hit(s, c, d, e); e.cd = u.cd; e.tg = c.id; e.ht = s.tick; } } else aller(s, e, c.x, c.y, u.v);
}
function rec(s, e, u, o) {
  const m = s.mines[o.m];
  if (e.port >= 10) {
    const n = s.ent.filter(x => x.eq === e.eq && BA[x.k] && BA[x.k].qg && x.pv > 0).sort((a, b) => d2(a, e) - d2(b, e))[0];
    if (!n) { e.ordre = null; return; }
    if (d2(e, n) <= 3000 * 3000) { s.pr[e.eq] += Math.floor(e.port * s.bonus[e.eq]); s.tot[e.eq] += e.port; e.port = 0; } else aller(s, e, n.x, n.y, u.v);
    return;
  }
  if (m.q <= 0) { e.ordre = null; return; }
  if (d2(e, m) <= 1200 * 1200) { if (++e.w >= 30) { e.w = 0; e.port = 10 + 2 * s.up[e.eq].rec; m.q -= 10; } } else aller(s, e, m.ax ?? m.x, m.ay ?? m.y, u.v);
}
function mob(s, e) {
  const u = UN[e.k], o = e.ordre;
  if (degager(s, e)) return;
  if (o) {
    if (o.t === 'move') { if (aller(s, e, o.x, o.y, u.v)) e.ordre = null; return; }
    if (o.t === 'att') { const c = s.ent.find(x => x.id === o.c && x.pv > 0); if (!c) e.ordre = null; else { frappe(s, e, c, u); return; } }
    if (o.t === 'am') { const c = u.deg && cible(s, e, u.vue); if (c) frappe(s, e, c, u); else if (aller(s, e, o.x, o.y, u.v)) e.ordre = null; return; }
    if (o.t === 'bat') { if (aller(s, e, o.x, o.y, u.v) || d2(e, o) <= 1500 * 1500) { if (placeLibre(s, o.k, o.x, o.y)) ajout(s, e.eq, o.k, o.x, o.y, 0); else s.pr[e.eq] += BA[o.k].cout; e.ordre = null; } return; }
    if (o.t === 'rec') { rec(s, e, u, o); return; }
  }
  if (u.deg) { const c = cible(s, e, u.vue); if (c) frappe(s, e, c, u); }
}
function bat(s, e) {
  const b = BA[e.k];
  if (e.cons) { e.cons--; return; }
  if (b.deg) { const c = cible(s, e, b.pt); if (c && !e.cd) { hit(s, c, b.deg, e); e.cd = b.cd; e.tg = c.id; e.ht = s.tick; } return; }
  if (e.file.length && ++e.prog >= UN[e.file[0]].tp) {
    e.prog = 0; const k = e.file.shift(), dx = e.eq ? -1 : 1;
    const n = ajout(s, e.eq, k, e.x + dx * (1800 + (s.n % 5) * 200), e.y + ((s.n % 3) - 1) * 600);
    // ralliement : vers le point choisi ; un ouvrier part récolter (la mine du point, sinon la plus proche)
    const p = e.ral || n, mi = UN[k].ouv ? s.mines.map((m, i) => i).filter(i => s.mines[i].q > 0).sort((a, b) => d2(s.mines[a], p) - d2(s.mines[b], p))[0] : undefined;
    if (mi !== undefined && (!e.ral || d2(s.mines[mi], e.ral) <= 3000 * 3000 || !e.ral)) n.ordre = { t: 'rec', m: mi };
    else if (e.ral) n.ordre = { t: 'am', x: e.ral.x, y: e.ral.y };
  }
}
function sep(s) {
  const U = s.ent.filter(e => !BA[e.k] && e.pv > 0);
  for (let i = 0; i < U.length; i++) for (let j = i + 1; j < U.length; j++) {
    const a = U[i], b = U[j], dx = a.x - b.x, dy = a.y - b.y, dd = dx * dx + dy * dy;
    if (dd >= 640000) continue;
    if (!dd) { pousser(s, a, 50, 0); continue; }
    const d = sq(dd) || 1, p = (800 - d) >> 3, px = Math.trunc(dx * p / d), py = Math.trunc(dy * p / d);
    pousser(s, a, px, py); pousser(s, b, -px, -py);
  }
  for (const e of U) { e.x = Math.max(500, Math.min(W * 1000 - 500, e.x)); e.y = Math.max(500, Math.min(H * 1000 - 500, e.y)); }
}
// brouillard : 0 inconnu, 1 exploré, 2 visible
function vue(s) {
  for (const q of [0, 1]) {
    const v = s.vis[q];
    for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
    for (const e of s.ent) if (e.eq === q && e.pv > 0) {
      const r = ((UN[e.k] || BA[e.k]).vue / 1000) | 0, cx = (e.x / 1000) | 0, cy = (e.y / 1000) | 0, c0 = cellule(e.x, e.y), haut = s.g.niv[c0] || s.g.rampe[c0];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (dx * dx + dy * dy <= r * r && x >= 0 && y >= 0 && x < W && y < H && (haut || !s.g.niv[y * W + x] || s.g.rampe[y * W + x])) v[y * W + x] = 2;
      }
    }
  }
}
export function relais(s) {
  for (const r of s.relais) {
    const n = [0, 0, 0];
    for (const e of s.ent) if (!BA[e.k] && e.pv > 0 && d2(e, r) <= 2500 * 2500) n[e.eq]++;
    if (n[2]) continue; // les neutres bloquent la capture
    if (n[0] && !n[1]) r.prog = Math.min(100, r.prog + 5); else if (n[1] && !n[0]) r.prog = Math.max(-100, r.prog - 5);
    if (r.prog >= 100) r.own = 0; else if (r.prog <= -100) r.own = 1;
  }
}
export function step(s) {
  if (s.fin >= 0) return;
  s.tick++;
  for (const e of s.ent) { if (e.pv <= 0) continue; if (e.cd) e.cd--; if (e.pc) e.pc--; BA[e.k] ? bat(s, e) : mob(s, e); regen(s, e); }
  sep(s);
  for (const e of s.ent) if (e.pv <= 0) {
    if (e.eq === 2 && e.last < 2) s.pr[e.last] += 40; // butin des neutres
    if (e.eq < 2 && e.last < 2 && e.last !== e.eq && !BA[e.k]) s.kills[e.last]++;
    if (UN[e.k] && UN[e.k].braise && !e.boum) { e.boum = 1; for (const o of s.ent) if (o.pv > 0 && o.eq !== e.eq && d2(o, e) <= 1500 * 1500) { let d = 12; if (o.bc > 0) { const b = Math.min(o.bc, d); o.bc -= b; d -= b; } o.pv -= d; o.last = e.eq; } }
  }
  for (const e of s.ent) if (e.pv <= 0 && BA[e.k]) occuper(s, e, 0);
  s.ent = s.ent.filter(e => e.pv > 0);
  if (s.tick % 5 === 0) { vue(s); relais(s); }
  if (s.tick % 10 === 0) for (const r of s.relais) if (r.own >= 0) s.en[r.own]++;
  for (const r of [].concat(s.opt.renfort || [])) if (s.tick >= (r.debut || 0) && s.tick % r.periode === 0) renfort(s, r.eq, r.role, r.n);
  for (const q of [0, 1]) if (!s.ent.some(e => e.eq === q && BA[e.k] && BA[e.k].qg)) s.fin = 1 - q;
}
// ordres : seul point d'entrée des joueurs (prêt pour le lockstep)
export const UPG = { att: { nom: 'Armement', pr: 100, en: 20 }, arm: { nom: 'Blindage', pr: 100, en: 20 }, rec: { nom: 'Collecte', pr: 80, en: 10 } };
const nombre = v => Number.isFinite(v);
function ordreNet(s, c) {
  if (c.t === 'att' && nombre(c.c)) return { t: 'att', c: c.c };
  if (c.t === 'rec' && s.mines[c.m]) return { t: 'rec', m: c.m };
  if ((c.t === 'move' || c.t === 'am') && nombre(c.x) && nombre(c.y)) return { t: c.t, x: Math.max(500, Math.min(W * 1000 - 500, Math.trunc(c.x))), y: Math.max(500, Math.min(H * 1000 - 500, Math.trunc(c.y))) };
  return null;
}
function renfort(s, eq, role, n) {
  const q = s.ent.find(e => e.eq === eq && BA[e.k] && BA[e.k].qg); if (!q) return;
  const k = FA[s.fac[eq]].u[role], ux = Math.sign(W * 500 - q.x) || 1, uy = Math.sign(H * 500 - q.y) || 1;
  for (let i = 0; i < n; i++) ajout(s, eq, k, q.x + ux * (2500 + (i % 4) * 400), q.y + uy * (1500 + ((i / 4) | 0) * 400));
}
// pouvoirs des Champions (recharge 30 s) : Maréchal = frappe de zone, Ancien = soin de zone, Oracle = boucliers de zone
function pouvoir(s, e) {
  const u = UN[e.k]; if (!u || !u.ch || e.pc) return;
  e.pc = 600;
  for (const o of s.ent) {
    if (o.pv <= 0) continue; const d = d2(o, e);
    if (e.k === 'marechal') { if (o.eq !== e.eq && d <= 3000 * 3000) hit(s, o, 100, e); }
    else if (e.k === 'pyrarque') { if (o.eq !== e.eq && d <= 4000 * 4000) { hit(s, o, 40, e); o.feu = 120; } }
    else if (o.eq === e.eq && !BA[o.k] && d <= 5000 * 5000) { if (e.k === 'ancien') o.pv = Math.min(o.max, o.pv + 90); else { o.bc = o.bm; o.pv = Math.min(o.max, o.pv + 30); } }
  }
}
export function cmd(s, eq, ids, c) {
  if (!c || !Array.isArray(ids) || s.fin >= 0) return;
  for (const id of ids) {
    const e = s.ent.find(x => x.id === id && x.eq === eq && x.pv > 0); if (!e) continue;
    if (c.t === 'prod') {
      const u = UN[c.k], b = BA[e.k];
      if (b && b.prod && b.prod.includes(c.k) && !e.cons && s.pr[eq] >= u.cout && (!u.en || s.en[eq] >= u.en) && e.file.length < 5 && !(u.ch && s.ent.some(x => x.eq === eq && (x.k === c.k || x.file.includes(c.k)))) && (() => { const [pu, pm] = population(s, eq); return pu + popDe(c.k) <= pm; })()) { s.pr[eq] -= u.cout; s.en[eq] -= u.en || 0; e.file.push(c.k); }
    } else if (c.t === 'bat') {
      const b = BA[c.k];
      const x = nombre(c.x) ? Math.round(Math.max(1500, Math.min(W * 1000 - 1500, c.x)) / 1000) * 1000 : 0, y = nombre(c.y) ? Math.round(Math.max(1500, Math.min(H * 1000 - 1500, c.y)) / 1000) * 1000 : 0;
      if (UN[e.k] && UN[e.k].ouv && b && b.cout && x && y && s.pr[eq] >= b.cout && placeLibre(s, c.k, x, y)) { s.pr[eq] -= b.cout; e.ordre = { t: 'bat', k: c.k, x, y }; break; }
    } else if (c.t === 'up') {
      const g = UPG[c.k], l = g && BA[e.k] && BA[e.k].qg ? s.up[eq][c.k] : 9;
      if (l < 3 && s.pr[eq] >= g.pr * (l + 1) && s.en[eq] >= g.en * (l + 1)) { s.pr[eq] -= g.pr * (l + 1); s.en[eq] -= g.en * (l + 1); s.up[eq][c.k]++; }
      break;
    } else if (c.t === 'pouv') { pouvoir(s, e);
    } else if (c.t === 'ral') { if (BA[e.k] && BA[e.k].prod && nombre(c.x) && nombre(c.y)) e.ral = { x: Math.max(500, Math.min(W * 1000 - 500, Math.trunc(c.x))), y: Math.max(500, Math.min(H * 1000 - 500, Math.trunc(c.y))) };
    } else if (c.t === 'stop') { if (!BA[e.k]) e.ordre = null;
    } else if (!BA[e.k]) { const o = ordreNet(s, c); if (o) { e.ordre = o; e.w = 0; } }
  }
}
function chercherPlace(s, k, x, y) {
  const cx = Math.round(x / 1000), cy = Math.round(y / 1000);
  for (let r = 0; r < 7; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (placeLibre(s, k, (cx + dx) * 1000, (cy + dy) * 1000)) return [(cx + dx) * 1000, (cy + dy) * 1000];
  }
  return null;
}
// IA simple (une décision par seconde)
export function ia(s, eq) {
  const L = NIV[s.niv[eq]] || NIV[2];
  if (s.fin >= 0 || s.tick % L.pas) return;
  const mi = s.ent.filter(e => e.eq === eq), q = k => mi.filter(e => e.k === k), noy = mi.find(e => BA[e.k] && BA[e.k].qg);
  if (!noy) return;
  const ux = Math.sign(W * 500 - noy.x) || 1, uy = Math.sign(H * 500 - noy.y) || 1; // direction vers le centre
  const st = (s.ia = s.ia || [{}, {}])[eq];
  if (st.th === undefined) { st.th = Math.max(4, 6 + L.th + hasard(s, 5)); st.nw = Math.max(3, 5 + L.nw + hasard(s, 3)); } // variété : taille de la 1re vague, nombre d'ouvriers
  const F = FA[s.fac[eq]], ou = q(F.ouv), en = s.ent.find(e => e.eq !== eq && BA[e.k] && BA[e.k].qg);
  const qgs = mi.filter(e => BA[e.k] && BA[e.k].qg && !e.cons), dq = p => Math.min(...qgs.map(q => d2(q, p)));
  for (const q of qgs) if (ou.length < st.nw + 7 * (qgs.length - 1) && q.file.length < 2) cmd(s, eq, [q.id], { t: 'prod', k: F.ouv });
  const ms = s.mines.map((m, i) => i).filter(i => s.mines[i].q > 0).sort((a, b) => dq(s.mines[a]) - dq(s.mines[b]));
  // expansion : un QG de plus sur le site libre le plus proche (au bout de 3 min, ou quand les mines de la base s'épuisent)
  if (qgs.length < 3 && s.pr[eq] >= BA[F.qg].cout && (s.tick > 3600 || ms.length && dq(s.mines[ms[0]]) > 8000 * 8000) && !mi.some(e => e.k === F.qg && e.cons) && !ou.some(o => o.ordre && o.ordre.t === 'bat' && o.ordre.k === F.qg)) {
    const site = (s.exp || []).filter(p => !s.ent.some(e => BA[e.k] && BA[e.k].qg && d2(e, p) < 7000 * 7000)).sort((a, b) => d2(a, noy) - d2(b, noy))[0];
    const p = site && chercherPlace(s, F.qg, site.x, site.y), o = ou.find(o => !o.ordre || o.ordre.t === 'rec');
    if (p && o) cmd(s, eq, [o.id], { t: 'bat', k: F.qg, x: p[0], y: p[1] });
  }
  if (ms.length) for (const o of ou) if (!o.ordre) cmd(s, eq, [o.id], { t: 'rec', m: ms[o.id % Math.min(2, ms.length)] });
  const W2 = [F.bat[0], F.bat[1], F.bat[2], F.bat[0], F.bat[2], F.bat[1], F.bat[2]], O = [[4, 0], [0, 4], [4, 4], [7, 1], [1, 7], [8, 5], [5, 8]];
  const nb = mi.filter(e => BA[e.k] && !BA[e.k].qg).length;
  if (nb < L.nb && ou.length >= 4 && !ou.some(o => o.ordre && o.ordre.t === 'bat') && s.pr[eq] >= BA[W2[nb]].cout)
    { const p = chercherPlace(s, W2[nb], noy.x + ux * O[nb][0] * 1000, noy.y + uy * O[nb][1] * 1000); if (p) cmd(s, eq, [ou[0].id], { t: 'bat', k: W2[nb], x: p[0], y: p[1] }); }
  { const [pu, pm] = population(s, eq), enCours = mi.some(e => e.k === F.ravit && e.cons) || ou.some(o => o.ordre && o.ordre.t === 'bat' && o.ordre.k === F.ravit);
    if (pm < POP_MAX && pu >= pm - 4 && !enCours && ou.length && s.pr[eq] >= BA[F.ravit].cout) { const n = mi.filter(e => e.k === F.ravit).length, p = chercherPlace(s, F.ravit, noy.x - ux * (3 + (n % 3) * 3) * 1000, noy.y - uy * (3 + ((n / 3) | 0) * 3) * 1000) || chercherPlace(s, F.ravit, noy.x + ux * 9000, noy.y - uy * 2000); const o = ou.find(o => !o.ordre || o.ordre.t === 'rec'); if (p && o) cmd(s, eq, [o.id], { t: 'bat', k: F.ravit, x: p[0], y: p[1] }); } }
  for (const b of mi) {
    if (!BA[b.k] || b.cons || b.file.length > 1 || BA[b.k].qg || !BA[b.k].prod) continue;
    if (hasard(s, 6) === 0) continue; // petite hésitation
    const p = BA[b.k].prod; cmd(s, eq, [b.id], { t: 'prod', k: p[((s.tick / 20) | 0) % p.length] });
  }
  const ar = mi.filter(e => !BA[e.k] && UN[e.k].deg), ids = l => l.map(e => e.id);
  const rl = s.relais.filter(r => r.own !== eq).sort((a, b) => d2(a, noy) - d2(b, noy))[0];
  const home = { x: noy.x + ux * 5000, y: noy.y + uy * 5000 };
  const rally = rl && L.rally && ar.length >= 5 ? { x: rl.x, y: rl.y } : home;
  const foe = s.ent.find(e => e.eq !== eq && !BA[e.k] && d2(e, noy) <= 9000 * 9000);
  const libres = ar.filter(e => !e.ordre);
  if (foe && ar.length) { cmd(s, eq, ids(ar), { t: 'am', x: foe.x, y: foe.y }); st.att = 0; }                // défense
  else if (st.att && ar.length < 4) { cmd(s, eq, ids(ar), { t: 'move', x: home.x, y: home.y }); st.att = 0; } // repli
  else if (en && !st.att && ar.length >= st.th + 2 * (st.w || 0)) { cmd(s, eq, ids(ar), { t: 'am', x: en.x, y: en.y }); st.att = 1; st.w = (st.w || 0) + 1; } // nouvelle vague
  else if (st.att && en) cmd(s, eq, ids(libres), { t: 'am', x: en.x, y: en.y });                                // renforts
  else cmd(s, eq, ids(libres), { t: 'am', x: rally.x, y: rally.y });
  for (const c of ar) if (UN[c.k].ch && !c.pc && s.ent.some(o => o.eq !== eq && d2(o, c) <= 4000 * 4000)) cmd(s, eq, [c.id], { t: 'pouv' });
  if (L.up && s.pr[eq] > 350) { const k = ['att', 'arm', 'rec'].sort((a, b) => s.up[eq][a] - s.up[eq][b])[0]; cmd(s, eq, [noy.id], { t: 'up', k }); }                                              // rassemblement
}

// empreinte de l'état (détection de désynchronisation en ligne)
export function hash(s) {
  let h = 2166136261; const m = v => { h = Math.imul(h ^ (v | 0), 16777619); };
  m(s.tick); m(s.pr[0]); m(s.pr[1]); m(s.en[0]); m(s.en[1]);
  for (const e of s.ent) { m(e.id); m(e.x); m(e.y); m(e.pv); }
  for (const x of s.mines) m(x.q);
  return h >>> 0;
}
// un « tour » = TOUR pas ; les ordres du tour sont appliqués au début (lockstep, rejeu). avecIA : l'équipe 1 est pilotée par l'IA
export const TOUR = 3;
export function jouerTour(s, ordres = [], avecIA = false) {
  for (const o of ordres) cmd(s, o.eq, o.ids, o.c);
  for (let i = 0; i < TOUR; i++) { if (avecIA) ia(s, 1); step(s); }
}
