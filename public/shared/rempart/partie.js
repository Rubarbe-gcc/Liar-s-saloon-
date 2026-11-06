/**
 * REMPART — le moteur d'une partie.
 *
 * Déterministe et sans DOM : la même graine et les mêmes actions donnent la
 * même partie. Le temps avance par pas fixes (`DT`) ; l'affichage lit l'état
 * et vide `p.evts` (tirs, impacts, morts…) pour ses effets et ses sons.
 *
 * Repère : x = colonne, z = ligne (le centre d'une case est à +0,5), y = hauteur.
 */

import { TOURS, ENNEMIS, REVENTE, ALTITUDE, FACTEUR_OR_DEPART } from './donnees.js';
import { niveau as trouverNiveau } from './niveaux.js';
import { makeRng } from '../hasard.js';

export const DT = 1 / 30;
/** Secondes entre la fin d'une vague (tout est sorti) et l'arrivée de la suivante. */
export const PAUSE_VAGUES = 16;
/** Hauteur d'où partent les tirs. */
const HAUT_TOUR = 1.05;
const MODES = ['premier', 'fort', 'proche', 'dernier'];
export const NOMS_MODES = { premier: 'Le plus avancé', fort: 'Le plus solide', proche: 'Le plus proche', dernier: 'Le moins avancé' };

/* ------------------------------------------------------------------ carte */

const CHEMIN = new Set(['#', 'S', 'R', 'B']);

/** Lit une carte texte : emplacements, départs, Cœur et chemins. */
export function analyserCarte(carte) {
  const H = carte.length, W = carte[0].length;
  const at = (c, r) => (r >= 0 && r < H && c >= 0 && c < W ? carte[r][c] : null);
  const emplacements = [], departs = [];
  let base = null;
  for (let r = 0; r < H; r++) {
    if (carte[r].length !== W) throw new Error(`ligne ${r} : ${carte[r].length} cases au lieu de ${W}`);
    for (let c = 0; c < W; c++) {
      const ch = carte[r][c];
      if (ch === 'T') emplacements.push({ id: emplacements.length, c, r, x: c + 0.5, z: r + 0.5 });
      else if (ch === 'S') departs[0] = { c, r };
      else if (ch === 'R') departs[1] = { c, r };
      else if (ch === 'B') base = { c, r, x: c + 0.5, z: r + 0.5 };
    }
  }
  if (!base) throw new Error('pas de Cœur (B)');
  if (!departs[0]) throw new Error('pas de départ (S)');

  // Distance au Cœur, case par case, sur le chemin.
  const dist = new Map();
  const cle = (c, r) => r * W + c;
  const voisins = (c, r) => [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
  const file = [[base.c, base.r]];
  dist.set(cle(base.c, base.r), 0);
  while (file.length) {
    const [c, r] = file.shift();
    for (const [c2, r2] of voisins(c, r)) {
      if (!CHEMIN.has(at(c2, r2)) || dist.has(cle(c2, r2))) continue;
      dist.set(cle(c2, r2), dist.get(cle(c, r)) + 1);
      file.push([c2, r2]);
    }
  }

  const casesChemin = new Set();
  const chemins = departs.filter(Boolean).map((dep, i) => {
    if (!dist.has(cle(dep.c, dep.r))) throw new Error(`départ ${i} : aucun chemin vers le Cœur`);
    const cases = [[dep.c, dep.r]];
    let [c, r] = [dep.c, dep.r];
    while (c !== base.c || r !== base.r) {
      const d = dist.get(cle(c, r));
      const suite = voisins(c, r).filter(([c2, r2]) => dist.get(cle(c2, r2)) === d - 1);
      if (suite.length !== 1) throw new Error(`chemin ambigu en (${c}, ${r})`);
      [c, r] = suite[0];
      cases.push([c, r]);
    }
    for (const [cc, rr] of cases) casesChemin.add(cle(cc, rr));
    // Les Rouilleux sortent de derrière le bord de la carte.
    const [c0, r0] = cases[0], [c1, r1] = cases[1];
    const pts = [{ x: c0 + 0.5 + (c0 - c1) * 1.5, z: r0 + 0.5 + (r0 - r1) * 1.5 }];
    for (const [cc, rr] of cases) pts.push({ x: cc + 0.5, z: rr + 0.5 });
    return preparer(simplifier(pts));
  });
  // Les volants coupent par les airs : ils sautent un virage sur deux.
  const vols = chemins.map(ch => {
    const pts = ch.points, coins = pts.slice(1, -1);
    return preparer([pts[0], ...coins.filter((_, i) => i % 2 === 1), pts[pts.length - 1]]);
  });

  // Une case de chemin isolée (dessinée mais jamais empruntée) est une erreur.
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (CHEMIN.has(carte[r][c]) && !casesChemin.has(cle(c, r))) throw new Error(`case de chemin orpheline en (${c}, ${r})`);
  }
  return { W, H, emplacements, base, chemins, vols, estChemin: (c, r) => casesChemin.has(cle(c, r)) };
}

function simplifier(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function preparer(points) {
  const cumul = [0];
  for (let i = 1; i < points.length; i++) {
    cumul.push(cumul[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  }
  return { points, cumul, total: cumul[cumul.length - 1] };
}

/** Position à la distance `d` sur un chemin, décalée de côté de `decal`. */
export function surChemin(ch, d, decal = 0) {
  const { points, cumul } = ch;
  let i = 1;
  while (i < points.length - 1 && cumul[i] < d) i++;
  const a = points[i - 1], b = points[i];
  const L = cumul[i] - cumul[i - 1] || 1;
  const u = Math.max(0, Math.min(1, (d - cumul[i - 1]) / L));
  const dx = (b.x - a.x) / L, dz = (b.z - a.z) / L;
  return { x: a.x + (b.x - a.x) * u - dz * decal, z: a.z + (b.z - a.z) * u + dx * decal, angle: Math.atan2(dx, dz) };
}

/* ---------------------------------------------------------------- partie */

export function creerPartie(id, { graine = 1 } = {}) {
  const def = trouverNiveau(id);
  if (!def) throw new Error(`niveau inconnu : ${id}`);
  return {
    niveau: id, def, carte: analyserCarte(def.carte), rng: makeRng(graine),
    t: 0, or: Math.round(def.or * FACTEUR_OR_DEPART), vies: def.vies, viesMax: def.vies,
    vague: 0, totalVagues: def.vagues.length,
    file: [], compte: null, phase: 'preparation',
    ennemis: [], tours: [], projectiles: [],
    prochainId: 1, evts: [], phares: [], mines: [],
    stats: { tues: 0, fuites: 0, orGagne: 0, bonus: 0, tirs: 0, degats: 0 },
  };
}

const evt = (p, e) => {
  p.evts.push(e);
  if (p.evts.length > 600) p.evts.splice(0, p.evts.length - 600);
};

/** Les caractéristiques d'un niveau (1 à 3) ou d'une spécialisation (niveau 4, branche 0 ou 1). */
export const statsTour = (type, niv, branche = 0) => (niv <= 3 ? TOURS[type].niveaux[niv - 1] : TOURS[type].branches[branche]);
export const statsDe = t => statsTour(t.type, t.niveau, t.branche ?? 0);
/** Prix du niveau suivant ; au niveau 3, celui de la branche choisie. */
export const coutAmelioration = (t, branche = 0) => (t.niveau < 3 ? TOURS[t.type].niveaux[t.niveau].cout : t.niveau === 3 ? TOURS[t.type].branches[branche].cout : null);
export const brancheDe = t => (t.niveau === 4 ? TOURS[t.type].branches[t.branche] : null);
export const valeurRevente = t => Math.floor(t.investi * REVENTE);

export function construire(p, empId, type) {
  if (p.phase === 'victoire' || p.phase === 'defaite') return { ok: false, raison: 'fin' };
  const emp = p.carte.emplacements[empId];
  if (!emp) return { ok: false, raison: 'emplacement' };
  if (!p.def.tours.includes(type)) return { ok: false, raison: 'verrouillee' };
  if (p.tours.some(t => t.emp === empId)) return { ok: false, raison: 'occupe' };
  const cout = TOURS[type].niveaux[0].cout;
  if (p.or < cout) return { ok: false, raison: 'or' };
  p.or -= cout;
  const t = {
    id: p.prochainId++, type, niveau: 1, emp: empId, x: emp.x, z: emp.z,
    recharge: 0.2, cible: null, mode: 'premier', investi: cout, angle: 0, tirs: 0, degats: 0, branche: null, renfort: 0,
  };
  p.tours.push(t);
  evt(p, { k: 'construit', tour: t.id, type, x: t.x, z: t.z });
  return { ok: true, tour: t };
}

/** Monte une tour d'un niveau. Du niveau 3 au 4, il faut choisir la branche (0 ou 1). */
export function ameliorer(p, tourId, branche = null) {
  const t = p.tours.find(x => x.id === tourId);
  if (!t) return { ok: false, raison: 'tour' };
  if (t.niveau >= 4) return { ok: false, raison: 'max' };
  if (t.niveau === 3 && branche !== 0 && branche !== 1) return { ok: false, raison: 'branche' };
  const cout = coutAmelioration(t, branche ?? 0);
  if (p.or < cout) return { ok: false, raison: 'or' };
  p.or -= cout;
  t.niveau++;
  if (t.niveau === 4) t.branche = branche;
  t.investi += cout;
  evt(p, { k: 'ameliore', tour: t.id, type: t.type, niveau: t.niveau, branche: t.branche, x: t.x, z: t.z });
  return { ok: true, tour: t };
}

export function vendre(p, tourId) {
  const i = p.tours.findIndex(x => x.id === tourId);
  if (i < 0) return { ok: false };
  const t = p.tours[i];
  const gain = valeurRevente(t);
  p.or += gain;
  p.tours.splice(i, 1);
  p.mines = p.mines.filter(m => m.tour !== t.id);
  evt(p, { k: 'vendu', tour: t.id, type: t.type, x: t.x, z: t.z, or: gain });
  return { ok: true, or: gain };
}

export function changerCible(p, tourId) {
  const t = p.tours.find(x => x.id === tourId);
  if (!t) return null;
  t.mode = MODES[(MODES.indexOf(t.mode) + 1) % MODES.length];
  return t.mode;
}

/** Ce qui arrive à la prochaine vague : { type: nombre }. */
export function apercuVague(p, index = p.vague) {
  const v = p.def.vagues[index];
  if (!v) return null;
  const out = {};
  for (const gr of v) out[gr.type] = (out[gr.type] || 0) + gr.n;
  return out;
}

/** Or offert si on appelle la vague avant la fin du compte à rebours. */
export const bonusAppel = p => (p.compte == null ? 0 : Math.max(0, Math.floor(p.compte)));

export function peutLancer(p) {
  if (p.phase === 'victoire' || p.phase === 'defaite') return false;
  if (p.vague >= p.totalVagues) return false;
  return p.vague === 0 || p.compte != null;
}

export function lancerVague(p) {
  if (!peutLancer(p)) return { ok: false };
  const bonus = bonusAppel(p);
  if (bonus) { p.or += bonus; p.stats.bonus += bonus; }
  const index = p.vague;
  for (const gr of p.def.vagues[index]) {
    for (let i = 0; i < gr.n; i++) {
      p.file.push({ t: p.t + gr.debut + i * gr.ecart, type: gr.type, depart: Math.min(gr.depart, p.carte.chemins.length - 1), vague: index });
    }
  }
  p.file.sort((a, b) => a.t - b.t);
  p.vague++;
  p.compte = null;
  p.phase = 'jeu';
  const boss = p.def.vagues[index].filter(gr => ENNEMIS[gr.type].boss).map(gr => gr.type);
  evt(p, { k: 'vague', n: p.vague, total: p.totalVagues, bonus, boss });
  return { ok: true, bonus };
}

/* -------------------------------------------------------------- ennemis */

function apparaitre(p, type, depart, vague, d = 0, decal = null) {
  const def = ENNEMIS[type];
  const ch = def.vole ? p.carte.vols[depart] : p.carte.chemins[depart];
  const echelle = p.def.force * (def.boss ? 1 : 1 + 0.045 * vague);
  const pvMax = Math.round(def.pv * echelle);
  const pos = surChemin(ch, d, 0);
  const e = {
    id: p.prochainId++, type, def, pv: pvMax, pvMax, armure: def.armure,
    d, depart, vague, ch,
    decal: decal ?? (def.boss ? 0 : (p.rng() - 0.5) * 0.36),
    x: pos.x, z: pos.z, y: def.vole ? ALTITUDE : 0, px: pos.x, pz: pos.z, angle: pos.angle,
    ralenti: 0, ralentiT: 0, ponteT: def.ponte ? def.ponte.toutes : 0, soinT: 1, mort: false,
    etourdiT: 0, brule: 0, bruleT: 0, bruleSrc: null, bouclier: 0, bouclierT: 1, sous: false,
    fouitT: def.fouit ? def.fouit.toutes * (0.5 + p.rng() * 0.5) : 0, revele: !def.furtif,
    sautT: def.saut ? def.saut.toutes * (0.4 + p.rng() * 0.6) : 0, saute: 0, calme: 99, enrage: false,
  };
  if (def.bouclierInitial) e.bouclier = def.bouclierInitial * echelle;
  const p2 = surChemin(ch, d, e.decal);
  e.x = e.px = p2.x; e.z = e.pz = p2.z;
  p.ennemis.push(e);
  evt(p, { k: 'apparait', id: e.id, type, boss: !!def.boss });
  return e;
}

const reste = e => e.ch.total - e.d;
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

function infliger(p, e, degats, { perce = false, demi = false, source = null } = {}) {
  if (e.mort || e.sous) return 0;
  const armure = perce ? 0 : (demi ? e.armure / 2 : e.armure);
  let eff = Math.max(degats * 0.25, degats - armure);
  e.calme = 0;
  // Le bouclier d'un Pavois encaisse d'abord.
  if (e.bouclier > 0) {
    const pris = Math.min(e.bouclier, eff);
    e.bouclier -= pris;
    eff -= pris;
    if (e.bouclier <= 0) evt(p, { k: 'bouclierBrise', id: e.id, x: e.x, y: e.y, z: e.z });
  }
  e.pv -= eff;
  p.stats.degats += eff;
  if (source) source.degats += eff;
  if (e.pv <= 0) mourir(p, e);
  return eff;
}

function mourir(p, e) {
  e.mort = true;
  e.pv = 0;
  // Un Phare marchand rapporte un peu d'or sur ce qui meurt dans sa lumière.
  let bonus = 0;
  for (const ph of p.phares) {
    const s = statsDe(ph);
    if (s.orBonus && distance2(ph, e) <= s.portee ** 2) bonus = Math.max(bonus, s.orBonus);
  }
  const gain = e.def.or + bonus;
  p.or += gain;
  p.stats.tues++;
  p.stats.orGagne += gain;
  evt(p, { k: 'mort', id: e.id, type: e.type, x: e.x, y: e.y, z: e.z, or: gain, boss: !!e.def.boss });
  const div = e.def.division;
  if (div) {
    for (let i = 0; i < div.n; i++) {
      apparaitre(p, div.type, e.depart, e.vague, Math.max(0, e.d - 0.22 * i), e.decal + (i - 1) * 0.16);
    }
    evt(p, { k: 'division', x: e.x, z: e.z });
  }
}

function bougerEnnemis(p) {
  for (const e of p.ennemis) {
    if (e.mort) continue;
    e.px = e.x; e.pz = e.z;
    if (e.ralentiT > 0) { e.ralentiT -= DT; if (e.ralentiT <= 0) e.ralenti = 0; }
    // Le feu continue de brûler, et passe sous l'armure.
    if (e.bruleT > 0) {
      e.bruleT -= DT;
      infliger(p, e, e.brule * DT, { perce: true, source: e.bruleSrc });
      if (e.bruleT <= 0) e.brule = 0;
      if (e.mort) continue;
    }
    // Le Fouisseur plonge sous terre, puis ressort.
    if (e.def.fouit && (e.fouitT -= DT) <= 0) {
      e.sous = !e.sous;
      e.fouitT = e.sous ? e.def.fouit.duree : e.def.fouit.toutes;
      evt(p, { k: 'fouit', id: e.id, x: e.x, z: e.z, sous: e.sous });
    }
    // La Mue (et le Seigneur) se réparent quand on les laisse tranquilles.
    e.calme += DT;
    if (e.def.regen && e.calme > 1 && e.pv < e.pvMax) e.pv = Math.min(e.pvMax, e.pv + e.pvMax * e.def.regen * DT);
    // La rage d'un boss affaibli : plus vite, mieux protégé.
    if (e.def.rage && !e.enrage && e.pv < e.pvMax * e.def.rage.seuil) {
      e.enrage = true;
      e.armure += e.def.rage.armure;
      evt(p, { k: 'rage', id: e.id, type: e.type, x: e.x, z: e.z });
    }
    const frein = e.ralenti * (1 - (e.def.resisteRalenti || 0));
    let v = e.def.vitesse * (1 - frein) * (e.sous ? e.def.fouit.vitesse : 1) * (e.enrage ? e.def.rage.vitesse : 1);
    // Le Bondisseur : un grand bond en avant de temps en temps.
    if (e.def.saut && e.etourdiT <= 0) {
      if (e.saute > 0) { e.saute -= DT; v = e.def.saut.distance / 0.4; }
      else if ((e.sautT -= DT) <= 0) {
        e.sautT = e.def.saut.toutes;
        e.saute = 0.4;
        evt(p, { k: 'saut', id: e.id, x: e.x, z: e.z });
      }
    }
    if (e.etourdiT > 0) { e.etourdiT -= DT; v = 0; }
    e.d += v * DT;
    if (e.d >= e.ch.total) {
      e.mort = true;
      p.vies = Math.max(0, p.vies - e.def.vies);
      p.stats.fuites++;
      evt(p, { k: 'fuite', id: e.id, type: e.type, vies: e.def.vies, x: p.carte.base.x, z: p.carte.base.z });
      continue;
    }
    const pos = surChemin(e.ch, e.d, e.decal);
    e.x = pos.x; e.z = pos.z; e.angle = pos.angle;
    // Le Tisseur répare ses voisins.
    if (e.def.soin && (e.soinT -= DT) <= 0) {
      e.soinT += 1;
      const r2 = e.def.soin.rayon ** 2;
      let n = 0;
      for (const o of p.ennemis) {
        if (o === e || o.mort || o.def.boss || o.pv >= o.pvMax || distance2(o, e) > r2) continue;
        o.pv = Math.min(o.pvMax, o.pv + e.def.soin.pv * p.def.force);
        n++;
      }
      evt(p, { k: 'soin', id: e.id, x: e.x, z: e.z, n });
    }
    // Le Pavois couvre ses voisins d'un bouclier.
    if (e.def.bouclier && (e.bouclierT -= DT) <= 0) {
      const b = e.def.bouclier;
      e.bouclierT += b.toutes;
      const val = b.pv * p.def.force, r2 = b.rayon ** 2;
      for (const o of p.ennemis) if (!o.mort && distance2(o, e) <= r2) o.bouclier = Math.max(o.bouclier, val);
      evt(p, { k: 'bouclier', id: e.id, x: e.x, z: e.z, rayon: b.rayon });
    }
    // Le Réparateur soigne sans arrêt ses voisins, sauf s'il est sonné.
    if (e.def.repare && e.etourdiT <= 0) {
      const r2 = e.def.repare.rayon ** 2, soin = e.def.repare.pv * p.def.force * DT;
      let n = 0;
      for (const o of p.ennemis) {
        if (o === e || o.mort || o.def.boss || o.pv >= o.pvMax || distance2(o, e) > r2) continue;
        o.pv = Math.min(o.pvMax, o.pv + soin);
        n++;
      }
      if ((e.soinT -= DT) <= 0) { e.soinT += 1; if (n) evt(p, { k: 'soin', id: e.id, x: e.x, z: e.z, n, rayon: e.def.repare.rayon }); }
    }
    // La Grande Nuée (et d'autres) pondent en chemin ; le Colosse seulement une fois blessé.
    if (e.def.ponte && (!e.def.ponte.seuil || e.pv < e.pvMax * e.def.ponte.seuil) && (e.ponteT -= DT) <= 0) {
      e.ponteT += e.def.ponte.toutes;
      for (let i = 0; i < e.def.ponte.n; i++) apparaitre(p, e.def.ponte.type, e.depart, e.vague, e.d, (i - 0.5) * 0.6);
      evt(p, { k: 'ponte', id: e.id, x: e.x, z: e.z });
    }
  }
}

/* ---------------------------------------------------------------- tours */

function choisirCible(p, t, s, def) {
  const r2 = s.portee ** 2;
  const air = s.air ?? def.air;
  let meilleure = null, score = -Infinity;
  for (const e of p.ennemis) {
    if (e.mort || e.d < 0.4 || e.sous || !e.revele) continue;
    if (e.def.vole ? !air : !def.sol) continue;
    const d2 = distance2(e, t);
    if (d2 > r2) continue;
    let v;
    switch (t.mode) {
      case 'fort': v = e.pv * 1000 - reste(e); break;
      case 'proche': v = -d2; break;
      case 'dernier': v = reste(e); break;
      default: v = -reste(e);
    }
    if (v > score) { score = v; meilleure = e; }
  }
  return meilleure;
}

const etourdir = (o, d) => { if (!o.mort) o.etourdiT = Math.max(o.etourdiT, d * (o.def.boss ? 0.35 : 1)); };

function tirer(p, t, e, s, def) {
  t.tirs++;
  p.stats.tirs++;
  const depart = { x: t.x, y: HAUT_TOUR + 0.12 * t.niveau, z: t.z };
  if (def.projectile === 'flamme') {
    // Un jet de flammes : touche tout autour de la cible et y met le feu.
    const air = s.air ?? def.air, r2 = s.rayon ** 2;
    for (const o of p.ennemis.slice()) {
      if (o.mort || o.sous || (o.def.vole && !air) || distance2(o, e) > r2) continue;
      infliger(p, o, s.degats, { source: t });
      if (!o.mort && s.brulure >= o.brule) { o.brule = s.brulure; o.bruleT = Math.max(o.bruleT, s.duree); o.bruleSrc = t; }
    }
    evt(p, { k: 'flamme', tour: t.id, x0: depart.x, y0: depart.y, z0: depart.z, x: e.x, y: e.y + 0.3, z: e.z, rayon: s.rayon, air: !!e.def.vole });
    return;
  }
  if (s.traverse) {
    // La Baliste : un carreau qui traverse toute la file.
    const ux = Math.sin(t.angle), uz = Math.cos(t.angle), L = s.portee + 0.6;
    for (const o of p.ennemis.slice()) {
      if (o.mort || o.sous || o.def.vole) continue;
      const rx = o.x - t.x, rz = o.z - t.z, proj = rx * ux + rz * uz;
      if (proj < 0 || proj > L || rx * rx + rz * rz - proj * proj > 0.42 ** 2) continue;
      infliger(p, o, s.degats, { perce: true, source: t });
      if (s.brise) o.armure = Math.max(0, o.armure - s.brise);
    }
    evt(p, { k: 'traverse', tour: t.id, pts: [depart, { x: t.x + ux * L, y: 0.35, z: t.z + uz * L }] });
    evt(p, { k: 'tir', tour: t.id, type: t.type });
    return;
  }
  if (def.projectile === 'eclair') {
    const touches = [e];
    let dernier = e;
    const saut = (s.saut || 1.9) ** 2;
    for (let k = 1; k < s.chaine; k++) {
      let suivant = null, best = saut;
      for (const o of p.ennemis) {
        if (o.mort || o.sous || touches.includes(o)) continue;
        const d2 = distance2(o, dernier);
        if (d2 < best) { best = d2; suivant = o; }
      }
      if (!suivant) break;
      touches.push(suivant);
      dernier = suivant;
    }
    const pts = [depart, ...touches.map(o => ({ x: o.x, y: o.y + 0.35, z: o.z }))];
    touches.forEach((o, k) => { infliger(p, o, s.degats * 0.85 ** k, { demi: true, source: t }); if (s.etourdit) etourdir(o, s.etourdit); });
    evt(p, { k: 'eclair', tour: t.id, pts });
    return;
  }
  if (def.projectile === 'obus') {
    const dist = Math.sqrt(distance2(e, t));
    const T = 0.55 + dist * 0.07;
    const frein = e.ralenti * (1 - (e.def.resisteRalenti || 0));
    const vise = surChemin(e.ch, Math.min(e.ch.total, e.d + e.def.vitesse * (1 - frein) * T), e.decal);
    p.projectiles.push({
      id: p.prochainId++, k: 'obus', tour: t.id, x0: depart.x, y0: depart.y, z0: depart.z,
      x1: vise.x, z1: vise.z, u: 0, T, arc: 1.4 + dist * 0.25, degats: s.degats, rayon: s.rayon, etourdit: s.etourdit,
      x: depart.x, y: depart.y, z: depart.z, px: depart.x, py: depart.y, pz: depart.z,
    });
    evt(p, { k: 'tir', tour: t.id, type: t.type });
    return;
  }
  const vitesse = { balle: 15, eclat: 10, trait: 20, harpon: 16 }[def.projectile];
  const n = s.canons || 1;
  for (let i = 0; i < n; i++) {
    const cote = n > 1 ? (i - 0.5) * 0.22 : 0;
    const x = depart.x + Math.cos(t.angle) * cote, z = depart.z - Math.sin(t.angle) * cote;
    p.projectiles.push({
      id: p.prochainId++, k: def.projectile, tour: t.id, cible: e.id, vitesse,
      x, y: depart.y, z, px: x, py: depart.y, pz: z, tx: e.x, ty: e.y + 0.3, tz: e.z,
      degats: s.degats, ralenti: s.ralenti, duree: s.duree, zone: s.zone, brise: s.brise, etourdit: s.etourdit, perce: s.perce,
    });
  }
  evt(p, { k: 'tir', tour: t.id, type: t.type });
}

/** Les points du chemin où un Piégeur peut poser ses mines (recalculés quand il change de niveau). */
function pointsMines(p, t, s) {
  const cle = `${t.niveau}-${t.branche}`;
  if (t.pointsMines?.cle === cle) return t.pointsMines.pts;
  const pts = [], r2 = (s.portee - 0.2) ** 2;
  for (const ch of p.carte.chemins) {
    for (let d = 1; d < ch.total - 0.5; d += 0.5) {
      const q = surChemin(ch, d);
      if ((q.x - t.x) ** 2 + (q.z - t.z) ** 2 <= r2) pts.push({ x: q.x, z: q.z });
    }
  }
  t.pointsMines = { cle, pts };
  return pts;
}

function poserMine(p, t, s, b) {
  const miennes = p.mines.filter(m => m.tour === t.id);
  if (t.recharge > 0 || miennes.length >= s.mines) { if (t.recharge < 0) t.recharge = 0; return; }
  const pts = pointsMines(p, t, s);
  if (!pts.length) return;
  // On essaie quelques points, et l'on garde le premier assez loin des autres mines.
  for (let essai = 0; essai < pts.length; essai++) {
    t.kMine = ((t.kMine || 0) + 7) % pts.length;
    const q = pts[t.kMine];
    if (miennes.some(m => (m.x - q.x) ** 2 + (m.z - q.z) ** 2 < 0.5 ** 2)) continue;
    const m = { id: p.prochainId++, tour: t.id, x: q.x, z: q.z, degats: s.degats * (1 + b.d), rayon: s.rayon, etourdit: s.etourdit, arme: 0.6 };
    p.mines.push(m);
    t.tirs++;
    evt(p, { k: 'mine', id: m.id, tour: t.id, x: m.x, z: m.z });
    break;
  }
  t.recharge += 1 / (s.cadence * (1 + b.c));
}

/** Une mine saute quand un Rouilleux (au sol, même invisible) marche dessus. */
function majMines(p) {
  if (!p.mines.length) return;
  const tourDe = id => p.tours.find(t => t.id === id) || null;
  for (const m of p.mines) {
    if ((m.arme -= DT) > 0) continue;
    if (!p.ennemis.some(e => !e.mort && !e.sous && !e.def.vole && (e.x - m.x) ** 2 + (e.z - m.z) ** 2 < 0.4 ** 2)) continue;
    m.saute = true;
    const r2 = m.rayon ** 2, src = tourDe(m.tour);
    for (const e of p.ennemis.slice()) {
      if (e.mort || e.def.vole || (e.x - m.x) ** 2 + (e.z - m.z) ** 2 > r2) continue;
      infliger(p, e, m.degats, { source: src });
      if (m.etourdit) etourdir(e, m.etourdit);
    }
    evt(p, { k: 'explosion', x: m.x, z: m.z, rayon: m.rayon, mine: m.id });
  }
  p.mines = p.mines.filter(m => !m.saute);
}

/** Le meilleur renfort des Phares voisins : { d: bonus de dégâts, c: bonus de cadence }. */
function renfort(p, t) {
  let d = 0, c = 0;
  for (const ph of p.phares) {
    if (ph === t) continue;
    const s = statsDe(ph);
    if (distance2(ph, t) > s.portee ** 2) continue;
    d = Math.max(d, s.bonus || 0);
    c = Math.max(c, s.bonusCadence || 0);
  }
  return { d, c };
}

function majTours(p) {
  // La lumière des Phares : elle révèle les Furtifs.
  p.phares = p.tours.filter(t => TOURS[t.type].soutien);
  for (const e of p.ennemis) {
    e.revele = !e.def.furtif || p.phares.some(ph => distance2(ph, e) <= statsDe(ph).portee ** 2);
  }
  for (const t of p.tours) {
    const def = TOURS[t.type], s = statsDe(t);
    if (def.soutien) { t.cible = null; continue; }
    const b = renfort(p, t);
    t.renfort = b.d;
    if (s.aura) {
      // Le Blizzard : tout ce qui passe autour est ralenti et gèle peu à peu.
      const r2 = s.portee ** 2;
      let n = 0;
      for (const e of p.ennemis) {
        if (e.mort || e.sous || distance2(e, t) > r2) continue;
        if (s.ralenti >= e.ralenti) { e.ralenti = s.ralenti; e.ralentiT = Math.max(e.ralentiT, s.duree); }
        infliger(p, e, s.degats * (1 + b.d) * DT, { perce: true, source: t });
        n++;
      }
      t.cible = n ? -1 : null;
      if ((t.recharge -= DT) <= 0) { t.recharge = 0.6; if (n) evt(p, { k: 'aura', tour: t.id, x: t.x, z: t.z, rayon: s.portee }); }
      continue;
    }
    t.recharge -= DT;
    if (def.projectile === 'mine') { poserMine(p, t, s, b); continue; }
    const e = choisirCible(p, t, s, def);
    t.cible = e ? e.id : null;
    if (!e) { if (t.recharge < 0) t.recharge = 0; continue; }
    t.angle = Math.atan2(e.x - t.x, e.z - t.z);
    if (t.recharge <= 0) {
      const k = 1 + b.d;
      tirer(p, t, e, k > 1 ? { ...s, degats: s.degats * k, brulure: s.brulure && s.brulure * k } : s, def);
      t.recharge += 1 / (s.cadence * (1 + b.c));
    }
  }
}

function majProjectiles(p) {
  const parId = new Map(p.ennemis.map(e => [e.id, e]));
  const tourDe = id => p.tours.find(t => t.id === id) || null;
  for (const pr of p.projectiles) {
    pr.px = pr.x; pr.py = pr.y; pr.pz = pr.z;
    if (pr.k === 'obus') {
      pr.u += DT / pr.T;
      const u = Math.min(1, pr.u);
      pr.x = pr.x0 + (pr.x1 - pr.x0) * u;
      pr.z = pr.z0 + (pr.z1 - pr.z0) * u;
      pr.y = pr.y0 * (1 - u) + pr.arc * 4 * u * (1 - u);
      if (pr.u >= 1) {
        pr.fini = true;
        const r2 = pr.rayon ** 2, src = tourDe(pr.tour);
        let n = 0;
        for (const e of p.ennemis.slice()) {
          if (e.mort || e.def.vole) continue;
          const d2 = distance2(e, pr);
          if (d2 > r2) continue;
          infliger(p, e, pr.degats * (d2 < r2 / 4 ? 1 : 0.6), { source: src });
          if (pr.etourdit) etourdir(e, pr.etourdit);
          n++;
        }
        evt(p, { k: 'explosion', x: pr.x1, z: pr.z1, rayon: pr.rayon, n });
      }
      continue;
    }
    const e = parId.get(pr.cible);
    if (e && !e.mort) { pr.tx = e.x; pr.ty = e.y + 0.3; pr.tz = e.z; }
    const dx = pr.tx - pr.x, dy = pr.ty - pr.y, dz = pr.tz - pr.z;
    const d = Math.hypot(dx, dy, dz), pasD = pr.vitesse * DT;
    if (d > pasD) {
      pr.x += dx / d * pasD; pr.y += dy / d * pasD; pr.z += dz / d * pasD;
      continue;
    }
    pr.x = pr.tx; pr.y = pr.ty; pr.z = pr.tz;
    pr.fini = true;
    if (!e || e.mort) { evt(p, { k: 'rate', x: pr.x, y: pr.y, z: pr.z, p: pr.k }); continue; }
    const src = tourDe(pr.tour);
    if (pr.k === 'eclat') {
      const cibles = pr.zone ? p.ennemis.filter(o => !o.mort && distance2(o, e) <= pr.zone ** 2) : [e];
      for (const o of cibles) {
        if (pr.ralenti >= o.ralenti) { o.ralenti = pr.ralenti; o.ralentiT = Math.max(o.ralentiT, pr.duree); }
        infliger(p, o, pr.degats, { source: src });
        if (pr.etourdit) etourdir(o, pr.etourdit);
      }
      evt(p, { k: 'gel', x: e.x, y: e.y, z: e.z, zone: pr.zone || 0 });
    } else if (pr.k === 'harpon') {
      // Le harpon accroche ; le Lance-filet cloue tous les volants autour.
      const cibles = pr.zone ? p.ennemis.filter(o => !o.mort && o.def.vole && distance2(o, e) <= pr.zone ** 2) : [e];
      for (const o of cibles) {
        if (pr.ralenti && pr.ralenti >= o.ralenti) { o.ralenti = pr.ralenti; o.ralentiT = Math.max(o.ralentiT, pr.duree); }
        infliger(p, o, pr.degats, { perce: !!pr.perce, source: src });
        if (pr.etourdit) etourdir(o, pr.etourdit);
      }
      evt(p, { k: 'impact', x: e.x, y: e.y + 0.3, z: e.z, p: 'harpon', zone: pr.zone || 0 });
    } else if (pr.k === 'trait') {
      infliger(p, e, pr.degats, { perce: true, source: src });
      if (pr.brise) e.armure = Math.max(0, e.armure - pr.brise);
      evt(p, { k: 'impact', x: e.x, y: e.y + 0.3, z: e.z, p: 'trait' });
    } else {
      infliger(p, e, pr.degats, { source: src });
      evt(p, { k: 'impact', x: e.x, y: e.y + 0.3, z: e.z, p: 'balle', blinde: e.armure > 0 });
    }
  }
  p.projectiles = p.projectiles.filter(pr => !pr.fini);
}

/* ------------------------------------------------------------------ pas */

export function pas(p) {
  if (p.phase === 'victoire' || p.phase === 'defaite') return;
  p.t += DT;
  if (p.phase === 'preparation') return;

  while (p.file.length && p.file[0].t <= p.t) {
    const s = p.file.shift();
    apparaitre(p, s.type, s.depart, s.vague);
  }
  bougerEnnemis(p);
  majTours(p);
  majProjectiles(p);
  majMines(p);
  p.ennemis = p.ennemis.filter(e => !e.mort);

  if (p.vies <= 0) {
    p.phase = 'defaite';
    evt(p, { k: 'defaite' });
    return;
  }
  if (!p.file.length && p.vague < p.totalVagues) {
    if (p.compte == null) p.compte = PAUSE_VAGUES;
    else if ((p.compte -= DT) <= 0) { p.compte = 0; lancerVague(p); }
  }
  if (p.vague >= p.totalVagues && !p.file.length && !p.ennemis.length) {
    p.phase = 'victoire';
    evt(p, { k: 'victoire', etoiles: etoiles(p) });
  }
}

/** Étoiles d'une victoire : 3 en perdant au plus 2 vies sur 20, 2 en gardant la moitié. */
export function etoiles(p) {
  if (p.phase === 'defaite' || p.vies <= 0) return 0;
  const f = p.vies / p.viesMax;
  return f >= 0.9 ? 3 : f >= 0.5 ? 2 : 1;
}
