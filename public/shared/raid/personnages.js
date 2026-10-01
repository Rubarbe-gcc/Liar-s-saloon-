/**
 * RAID — les personnages du jeu de rôle.
 *
 * Les quinze fiches de la guilde (`heros.js`) restent la source : école,
 * rôle, peuple, sorts. Ce module en tire des personnages qui GRANDISSENT —
 * niveau, expérience, points de vie et de mana à l'échelle d'un jeu de rôle,
 * équipement — au lieu de valoir d'emblée tout ce que leur fiche promet.
 *
 * Module ISO : ni DOM ni Node.
 */

import { HEROS, PAR_ID, ROLES } from './heros.js';
import { effetsTalents } from './talents.js';

export const NIVEAU_MAX = 20;

/** Expérience cumulée pour atteindre chaque niveau (index = niveau). */
export const SEUILS_XP = [
  0, 0, 30, 75, 135, 210, 300, 405, 525, 660, 810, 975, 1160,
  1365, 1590, 1835, 2100, 2385, 2690, 3015, 3360,
];

export function niveauDe(xp) {
  let n = 1;
  while (n < NIVEAU_MAX && xp >= SEUILS_XP[n + 1]) n++;
  return n;
}

export function progressionNiveau(xp) {
  const n = niveauDe(xp);
  if (n >= NIVEAU_MAX) return 1;
  return (xp - SEUILS_XP[n]) / (SEUILS_XP[n + 1] - SEUILS_XP[n]);
}

/**
 * Gabarit de chaque rôle : valeurs au niveau 1, et gain par niveau. Le tank
 * encaisse, le DPS frappe et agit tôt, le soigneur a de quoi lancer ses sorts.
 */
export const GABARITS = {
  tank: { pv: 64, pvN: 11, pm: 16, pmN: 2, atk: 9, atkN: 2.0, def: 7, defN: 1.7, vit: 4 },
  dps: { pv: 44, pvN: 7, pm: 18, pmN: 2, atk: 13, atkN: 3.0, def: 3, defN: 0.9, vit: 7 },
  soigneur: { pv: 48, pvN: 8, pm: 26, pmN: 3, atk: 9, atkN: 2.0, def: 4, defN: 1.1, vit: 5 },
};

/** Ce qu'un compagnon revenu « éveillé » de son voyage gagne en vie, attaque et armure. */
export const EVEIL = 0.12;

/** Coût des sorts, et niveau auquel l'ultime s'apprend. */
export const COUT = { special: 8, ultime: 16 };
export const NIVEAU_ULTIME = 3;

/**
 * Chaque fiche s'écarte un peu de la moyenne de son rôle : on garde cet écart
 * (quelques pour cent) pour que deux tanks ne soient pas des jumeaux.
 */
const moyennes = Object.fromEntries(Object.keys(GABARITS).map((r) => {
  const l = HEROS.filter((h) => h.role === r);
  const m = (k) => l.reduce((s, h) => s + h[k], 0) / l.length;
  return [r, { pv: m('pv'), atk: m('atk'), def: m('def') }];
}));

function ecart(h, k) {
  return h[k] / moyennes[h.role][k];
}

/** Les effets de soutien visent les alliés et ne blessent personne. */
const SOUTIENS = ['soin', 'garde', 'elan', 'mana', 'provoc', 'bastion', 'purge', 'resurrection', 'renouveau'];
export const estSoutien = (sort) => !!sort.effet && SOUTIENS.includes(sort.effet.type);

/** Les sorts d'un personnage, à l'échelle du jeu de rôle. */
export function sortsDe(fiche) {
  const conv = (s, cout) => ({
    nom: s.nom,
    cout,
    // Les multiplicateurs des fiches valaient pour un raid de six ; ramenés
    // à un groupe de quatre, ils restent ordonnés sans écraser l'attaque.
    mult: +(s.mult * 0.72).toFixed(2),
    effet: s.effet ? { ...s.effet } : null,
    soutien: estSoutien(s),
  });
  return { special: conv(fiche.special, COUT.special), ultime: conv(fiche.ultime, COUT.ultime) };
}

/** Un nouveau personnage, prêt à partir. */
export function creerPersonnage(id, niveau = 1) {
  const f = PAR_ID[id];
  if (!f) throw new Error(`personnage inconnu : ${id}`);
  const p = {
    id: f.id, nom: f.nom, titre: f.titre, classe: f.classe, ecole: f.ecole,
    role: f.role, peuple: f.peuple, legendaire: !!f.legendaire,
    niveau, xp: 0, pv: 0, pm: 0,
    equip: { arme: null, armure: null, bijou: null },
    talents: {},
  };
  p.xp = Math.max(0, (SEUILS_XP[niveau] || 0));
  const s = statsBase(p);
  p.pv = s.pvMax;
  p.pm = s.pmMax;
  return p;
}

/** Statistiques du personnage nu, à son niveau. */
export function statsBase(p) {
  const f = PAR_ID[p.id];
  const g = GABARITS[p.role];
  const n = p.niveau - 1;
  return {
    pvMax: Math.round((g.pv + g.pvN * n) * ecart(f, 'pv')),
    pmMax: Math.round(g.pm + g.pmN * n),
    atk: Math.round((g.atk + g.atkN * n) * ecart(f, 'atk')),
    def: Math.round((g.def + g.defN * n) * ecart(f, 'def')),
    vit: g.vit,
  };
}

/**
 * Statistiques effectives : base, équipement, puis talents du personnage et
 * bonus du groupe (dons, bénédictions, reliques) en parts.
 */
export function statsDe(p, bonus = {}) {
  const s = statsBase(p);
  const plus = { pvMax: 0, pmMax: 0, atk: 0, def: 0, vit: 0, crit: 0 };
  for (const it of Object.values(p.equip || {})) {
    if (!it) continue;
    plus.atk += it.atk || 0;
    plus.def += it.def || 0;
    plus.pvMax += it.pv || 0;
    plus.pmMax += it.pm || 0;
    plus.vit += it.vit || 0;
    plus.crit += it.crit || 0;
  }
  const t = effetsTalents(p);
  const e = p.eveil ? EVEIL : 0;
  return {
    pvMax: Math.round((s.pvMax + plus.pvMax) * (1 + (bonus.pv || 0) + (t.pv || 0) + e)),
    pmMax: s.pmMax + plus.pmMax + (bonus.pm || 0) + (t.pm || 0),
    atk: Math.round((s.atk + plus.atk) * (1 + (bonus.atk || 0) + (t.atk || 0) + e)),
    def: Math.round((s.def + plus.def) * (1 + (bonus.def || 0) + (t.def || 0) + e)),
    vit: s.vit + plus.vit + (t.vit || 0),
    crit: plus.crit + (t.crit || 0),
  };
}

/**
 * Ajoute de l'expérience. Un niveau gagné rend la différence de vie et de
 * mana qu'il apporte : on se relève plus fort, pas plus blessé.
 */
export function gagnerXp(p, gain, bonus = {}) {
  const avant = p.niveau;
  const sAvant = statsDe(p, bonus);
  p.xp += gain;
  p.niveau = niveauDe(p.xp);
  if (p.niveau !== avant) {
    const s = statsDe(p, bonus);
    if (p.pv > 0) p.pv = Math.min(s.pvMax, p.pv + (s.pvMax - sAvant.pvMax));
    p.pm = Math.min(s.pmMax, p.pm + (s.pmMax - sAvant.pmMax));
  }
  return { avant, apres: p.niveau, apprend: avant < NIVEAU_ULTIME && p.niveau >= NIVEAU_ULTIME };
}

/** Ramène vie et mana sous leurs maximums (après un changement d'équipement). */
export function borner(p, bonus = {}) {
  const s = statsDe(p, bonus);
  p.pv = Math.min(p.pv, s.pvMax);
  p.pm = Math.min(p.pm, s.pmMax);
}

/** Les héros de départ : un par école, les trois rôles représentés. */
export const DEPARTS = ['brandel', 'mordrec', 'kaelis', 'pix', 'mei'];

export { ROLES };
