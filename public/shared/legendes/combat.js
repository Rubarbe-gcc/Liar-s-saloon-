/**
 * LÉGENDES — le combat, à la façon des grands gachas de combat.
 *
 * L'équipe : six personnages (le premier est le CHEF : sa compétence renforce une ou deux catégories), et un
 * AMI (le chef d'un autre joueur : ici, un second chef choisi dans sa collection, qui ne combat pas). Trois
 * combattants jouent par tour, à tour de rôle (la rotation).
 *
 * Un tour :
 *   1. le début du tour : les passifs (ATQ, DÉF, ki, soins, soutien aux alliés), les liens entre voisins ;
 *   2. les sphères de ki : le joueur choisit une couleur et ramasse toutes ses sphères (triple ki pour un
 *      combattant de cet élément) ;
 *   3. chaque combattant frappe : une attaque, sa SUPER à 12 de ki, l'ULTIME d'un LR à 18 ; puis, selon son
 *      passif, une attaque ou une super additionnelle ; critiques ;
 *   4. l'ennemi riposte : deux à cinq coups, parfois sa propre super attaque ; les combattants esquivent,
 *      gardent, réduisent les dégâts, contre-attaquent ;
 *   5. un boss qui passe sous un seuil de PV se TRANSFORME (plus fort, ses PV remontent parfois).
 *
 * Déterministe (une graine) : les tests rejouent un combat à l'identique.
 */

import { PERSO, CYCLE, LIENS, avantage, stats } from './persos.js';

export const KI_SUPER = 12, KI_ULTIME = 18, KI_MAX = 24;
/**
 * Le plateau de sphères : une grille de COLS × LIGNES places (décalées une ligne sur deux, à l'écran). On trace
 * un CHEMIN d'une sphère à une voisine (les huit autour), sans repasser : chaque combattant de la rotation gagne
 * 2 ki par sphère de son élément, 1 par autre sphère ; l'arc-en-ciel donne 1 ki à tous et soigne un peu.
 */
export const COLS = 5, LIGNES = 5, NB_SPHERES = COLS * LIGNES;
export const voisines = (a, b) => a !== b && Math.abs((a % COLS) - (b % COLS)) <= 1 && Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) <= 1;
/** Un chemin valable : des places existantes, voisines deux à deux, sans doublon. */
export function cheminValide(chemin) {
  if (!Array.isArray(chemin) || !chemin.length) return false;
  if (new Set(chemin).size !== chemin.length) return false;
  return chemin.every((p, k) => Number.isInteger(p) && p >= 0 && p < NB_SPHERES && (k === 0 || voisines(chemin[k - 1], p)));
}

function hasard(c) {
  let t = (c.alea = (c.alea + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const effets = (id, t) => PERSO[id].passif.effets.filter((e) => e.t === t);
const effet = (id, t) => effets(id, t)[0];

/** Le bonus d'un chef sur un personnage (le taux sur PV, ATQ, DÉF ; le ki). */
export function bonusChef(chef, id) {
  if (!chef) return 0;
  const c = PERSO[chef].chef, x = PERSO[id];
  return x.categories.some((k) => c.cats.includes(k)) ? c.taux : c.autres;
}
const kiChef = (chef, id) => (chef && PERSO[id].categories.some((k) => PERSO[chef].chef.cats.includes(k)) ? PERSO[chef].chef.ki : 0);

/**
 * Un combat. equipe : [{ id, eveil }] (6 au plus, le premier est le chef) ; ami : l'id du chef ami (ou null) ;
 * ennemis : [{ nom, element, pv, atq, def, coups: [min, max], boss, super: { nom, mult, chance, tous },
 * phases: [{ seuil, nom, atq, def, soin }], reduction, esquive }] ; graine.
 */
export function creerCombat({ equipe, ennemis, graine = 1, ami = null }) {
  const chef = equipe[0].id;
  const membres = equipe.map((m) => {
    const s = stats(m.id, m.eveil || 0), b = 1 + bonusChef(chef, m.id) + bonusChef(ami, m.id);
    return { id: m.id, pv: Math.round(s.pv * b), atq: Math.round(s.atq * b), def: Math.round(s.def * b), ki: 0, cumulAtq: 0, cumulDef: 0, apresEsquive: 0 };
  });
  const pvMax = membres.reduce((t, m) => t + m.pv, 0);
  const c = {
    alea: (graine >>> 0) || 1, tour: 0, membres, pv: pvMax, pvMax, chef, ami,
    ennemis: ennemis.map((e) => ({ reduction: 0, esquive: 0, coups: [2, 3], ...e, pvMax: e.pv, phase: 0, defBaisse: 0 })), cible: 0, spheres: [], fin: null, journal: [],
  };
  c.spheres = tirerSpheres(c);
  return c;
}

/** Une sphère au hasard : parfois un arc-en-ciel, un peu plus souvent l'élément d'un combattant de la rotation. */
function uneSphere(c) {
  if (hasard(c) < 0.07) return 'arc';
  const rot = rotation(c).map((i) => PERSO[c.membres[i].id].element);
  return hasard(c) < 0.25 && rot.length ? rot[Math.floor(hasard(c) * rot.length)] : CYCLE[Math.floor(hasard(c) * 5)];
}
function tirerSpheres(c) {
  const s = [];
  for (let k = 0; k < NB_SPHERES; k++) s.push(uneSphere(c));
  return s;
}

/** Les trois combattants (leurs places dans l'équipe) qui jouent ce tour. */
export function rotation(c) {
  const n = c.membres.length;
  if (n <= 3) return c.membres.map((_, i) => i);
  const debut = (c.tour * 3) % n;
  return [0, 1, 2].map((k) => (debut + k) % n);
}

/** Les liens actifs de chaque combattant de la rotation (ceux qu'il partage avec un voisin). */
export function liensActifs(c) {
  const rot = rotation(c);
  return rot.map((i, k) => {
    const mien = PERSO[c.membres[i].id].liens;
    const voisins = [rot[k - 1], rot[k + 1]].filter((j) => j !== undefined).map((j) => PERSO[c.membres[j].id].liens);
    return mien.filter((l) => voisins.some((v) => v.includes(l)));
  });
}
/** Le nombre de liens actifs (pour l'affichage). */
export const liens = (c) => liensActifs(c).map((l) => l.length);

/** Le soutien des alliés de la rotation (ki et ATQ donnés par les soutiens). */
function soutienPour(c, k) {
  const rot = rotation(c);
  let ki = 0, atq = 0;
  rot.forEach((j, kk) => { if (kk === k) return; for (const e of effets(c.membres[j].id, 'soutien')) { ki += e.ki; atq += e.atq; } });
  return { ki, atq };
}

/** Combien de ki chaque combattant gagnerait avec ce chemin (passif, chef, liens et soutien compris). */
export function kiPour(c, chemin) {
  const sph = (cheminValide(chemin) ? chemin : []).map((p) => c.spheres[p]);
  const li = liensActifs(c);
  return rotation(c).map((i, k) => {
    const id = c.membres[i].id, x = PERSO[id];
    const passif = effets(id, 'ki').reduce((t, e) => t + e.n, 0);
    const liensKi = li[k].reduce((t, l) => t + (LIENS[l].ki || 0), 0);
    const doux = sph.reduce((t, s) => t + (s === x.element ? 2 : 1), 0);
    return doux + passif + kiChef(c.chef, id) + kiChef(c.ami, id) + liensKi + soutienPour(c, k).ki;
  });
}

/** L'ATQ et la DÉF d'un combattant pour ce tour (passifs, liens, soutien, cumuls), sans la super. */
function forme(c, i, k, spheres) {
  const m = c.membres[i], id = m.id;
  let atq = 0, def = 0;
  for (const e of effets(id, 'stat')) { atq += e.atq; def += e.def; }
  for (const e of effets(id, 'sphere')) atq += e.atq * Math.min(10, spheres);
  for (const l of liensActifs(c)[k]) { atq += LIENS[l].atq || 0; def += LIENS[l].def || 0; }
  atq += soutienPour(c, k).atq;
  const bas = c.pv <= c.pvMax * 0.5;
  for (const e of effets(id, 'pvBas')) if (bas) { atq += e.atq; if (e.def) def += e.atq; }
  const e = c.ennemis[c.cible];
  if (e?.boss) for (const b of effets(id, 'boss')) atq += b.atq;
  atq += m.cumulAtq + m.apresEsquive;
  def += m.cumulDef;
  return { atq: m.atq * (1 + atq), def: m.def * (1 + def) };
}

/** Une frappe sur l'ennemi en cours. type : 'attaque' | 'super' | 'ultime'. Rend l'événement (ou null). */
function frapper(c, i, k, type, f, ki, evs, add = false) {
  const e = c.ennemis[c.cible];
  if (!e || c.fin) return null;
  const m = c.membres[i], x = PERSO[m.id];
  let mult = type === 'ultime' ? x.super.ultime.mult : type === 'super' ? x.super.mult : 1 + Math.min(ki, 11) * 0.05;
  let atq = f.atq;
  if (type !== 'attaque') {
    for (const s of effets(m.id, 'surSuper')) atq *= 1 + s.atq;
    if (x.super.atqTour) atq *= 1 + x.super.atqTour;
  }
  const adv = avantage(x.element, e.element);
  const crit = effets(m.id, 'critique').some((cr) => hasard(c) < cr.chance);
  if (e.esquive && !crit && hasard(c) < e.esquive) { evs.push({ type: 'esquiveEnnemi', qui: i, id: m.id, add }); return null; }
  const defE = crit ? 0 : e.def * (1 - e.defBaisse);
  const brut = atq * mult * (crit ? 1.6 : adv) * (0.95 + hasard(c) * 0.1);
  const degats = Math.max(1, Math.round((brut - defE) * (1 - e.reduction)));
  e.pv -= degats;
  const ev = { type, qui: i, id: m.id, degats, avantage: crit ? 1.6 : adv, crit, cible: c.cible, ki, add };
  evs.push(ev);
  // Les effets de la super (après la frappe).
  if (type !== 'attaque') {
    if (x.super.atqCumul) m.cumulAtq = Math.min(2, m.cumulAtq + (type === 'ultime' ? 0.6 : x.super.atqCumul));
    if (x.super.defBaisse) e.defBaisse = Math.min(0.6, e.defBaisse + x.super.defBaisse);
    if (x.super.defTour) f.def *= 1 + x.super.defTour;
    if (x.super.esquiveTour) m.esquiveTour = x.super.esquiveTour;
    if (x.super.kiAllies) for (const j of rotation(c)) if (j !== i) c.membres[j].ki = Math.min(KI_MAX, c.membres[j].ki + x.super.kiAllies);
  }
  for (const cu of effets(m.id, 'cumul')) if (cu.quand === 'attaque' && cu.atq) m.cumulAtq = Math.min(cu.max + 2, m.cumulAtq + cu.atq);
  m.apresEsquive = 0;
  verifierEnnemi(c, evs);
  return ev;
}

/** L'ennemi en cours : transformation (un seuil de PV), ou K.-O. */
function verifierEnnemi(c, evs) {
  const e = c.ennemis[c.cible];
  if (!e) return;
  const ph = e.phases?.[e.phase];
  if (ph && e.pv > 0 && e.pv <= e.pvMax * ph.seuil) {
    e.phase += 1;
    e.nomBase = e.nomBase || e.nom;
    e.nom = ph.nom;
    e.atq = Math.round(e.atq * (ph.atq || 1));
    e.def = Math.round(e.def * (ph.def || 1));
    if (ph.soin) e.pv = Math.min(e.pvMax, e.pv + Math.round(e.pvMax * ph.soin));
    if (ph.element) e.element = ph.element;
    if (ph.reduction !== undefined) e.reduction = ph.reduction;
    e.defBaisse = 0;
    evs.push({ type: 'transformation', cible: c.cible, nom: ph.nom, texte: ph.texte || '', pv: e.pv });
    return;
  }
  if (e.pv <= 0) {
    e.pv = 0;
    evs.push({ type: 'ko', cible: c.cible, nom: e.nom });
    c.cible += 1;
    if (c.cible >= c.ennemis.length) { c.fin = 'victoire'; evs.push({ type: 'victoire' }); }
  }
}

/**
 * Un tour (le joueur a choisi sa couleur). Rend les événements : debut { soin }, attaque | super | ultime
 * { qui, degats, crit, avantage, add }, esquiveEnnemi, transformation { nom }, ko, superEnnemi { nom },
 * riposte { cible, degats, super, garde, avantage }, esquive { cible }, contre { qui, degats }, victoire, defaite.
 */
export function jouerTour(c, chemin) {
  if (c.fin) return [];
  const evs = [];
  if (!cheminValide(chemin)) chemin = meilleurChemin(c);
  const rot = rotation(c), gains = kiPour(c, chemin);
  const nSph = chemin.length;
  const arcs = chemin.filter((p) => c.spheres[p] === 'arc').length;
  // Le début du tour : les soins.
  let soin = Math.round(c.pvMax * 0.03 * arcs);
  for (const i of rot) for (const e of effets(c.membres[i].id, 'soin')) soin += Math.round(c.pvMax * e.taux);
  if (soin) { c.pv = Math.min(c.pvMax, c.pv + soin); evs.push({ type: 'debut', soin }); }
  const formes = rot.map((i, k) => forme(c, i, k, rot.length ? nSph : 0));
  rot.forEach((i, k) => {
    if (c.fin) return;
    const m = c.membres[i], x = PERSO[m.id];
    m.ki = Math.min(KI_MAX, m.ki + gains[k]);
    const ki = m.ki;
    const type = x.rarete === 'LR' && ki >= KI_ULTIME ? 'ultime' : ki >= KI_SUPER ? 'super' : 'attaque';
    frapper(c, i, k, type, formes[k], ki, evs);
    // Les attaques additionnelles.
    for (const a of effets(m.id, 'attAdd')) if (!c.fin && hasard(c) < a.chance) frapper(c, i, k, hasard(c) < 0.5 ? 'super' : 'attaque', formes[k], ki, evs, true);
    for (const a of effets(m.id, 'superAdd')) if (!c.fin && type !== 'attaque' && hasard(c) < a.chance) frapper(c, i, k, 'super', formes[k], ki, evs, true);
    m.ki = 0;
  });
  if (!c.fin) riposte(c, rot, formes, evs);
  for (const i of rot) c.membres[i].esquiveTour = 0;
  c.tour += 1;
  // Les sphères ramassées sont remplacées.
  for (const p of chemin) c.spheres[p] = uneSphere(c);
  c.journal.push(chemin.join('-'));
  return evs;
}

/** L'ennemi frappe : ses coups (et sa super), sur les combattants de la rotation. */
function riposte(c, rot, formes, evs) {
  const e = c.ennemis[c.cible];
  const [a, b] = e.coups;
  const n = a + Math.floor(hasard(c) * (b - a + 1));
  const sup = e.super && hasard(c) < (e.super.chance ?? 0.3);
  const superA = sup ? (e.super.tous ? -1 : Math.floor(hasard(c) * n)) : -2;
  if (sup) evs.push({ type: 'superEnnemi', nom: e.super.nom, cible: c.cible, tous: !!e.super.tous });
  const coups = superA === -1 ? rot.map((i) => ({ i, sup: true })) : Array.from({ length: n }, (_, k) => ({ i: rot[Math.floor(hasard(c) * rot.length)], sup: k === superA }));
  for (const coup of coups) {
    if (c.fin) return;
    const i = coup.i, m = c.membres[i], x = PERSO[m.id], k = rot.indexOf(i);
    const esq = effets(m.id, 'esquive').reduce((t, x2) => t + x2.chance, 0) + (m.esquiveTour || 0);
    if (esq && hasard(c) < esq) {
      evs.push({ type: 'esquive', cible: i });
      for (const ae of effets(m.id, 'apresEsquive')) m.apresEsquive = ae.atq;
      contre(c, i, k, formes, evs);
      continue;
    }
    const garde = effets(m.id, 'garde').length > 0;
    const adv = garde ? 1 : avantage(e.element, x.element);
    const reduc = effets(m.id, 'reduction').reduce((t, r) => t + r.taux, 0) + rot.filter((j) => j !== i).reduce((t, j) => t + effets(c.membres[j].id, 'reduction').filter(() => PERSO[c.membres[j].id].role === 'soutien').reduce((u, r) => u + r.taux, 0), 0);
    const mult = coup.sup ? e.super.mult : 1;
    const brut = e.atq * mult * adv * (0.92 + hasard(c) * 0.16);
    let degats = Math.max(1, Math.round((brut - formes[k].def) * (1 - Math.min(0.75, reduc))));
    if (garde) degats = Math.round(degats * 0.5);
    c.pv -= degats;
    evs.push({ type: 'riposte', cible: i, degats, super: coup.sup, garde, avantage: adv, fort: coup.sup });
    for (const cu of effets(m.id, 'cumul')) if (cu.quand === 'coup' && cu.def && m.cumulDef < cu.max) { m.cumulDef = Math.min(cu.max, m.cumulDef + cu.def); formes[k].def += m.def * cu.def; }
    if (c.pv <= 0) { c.pv = 0; c.fin = 'defaite'; evs.push({ type: 'defaite' }); return; }
    contre(c, i, k, formes, evs);
  }
}

function contre(c, i, k, formes, evs) {
  const m = c.membres[i];
  for (const ct of effets(m.id, 'contre')) {
    const e = c.ennemis[c.cible];
    if (!e || c.fin) return;
    const degats = Math.max(1, Math.round((formes[k].atq * ct.mult * avantage(PERSO[m.id].element, e.element) - e.def) * (1 - e.reduction)));
    e.pv -= degats;
    evs.push({ type: 'contre', qui: i, id: m.id, degats, cible: c.cible });
    verifierEnnemi(c, evs);
  }
}

/**
 * Le meilleur chemin (l'aide, et l'ordinateur des tests) : depuis chaque sphère, on avance vers la voisine qui
 * rapporte le plus (en visant les supers), jusqu'à douze sphères.
 */
export function meilleurChemin(c) {
  const rot = rotation(c);
  const valeur = (ch) => {
    const g = kiPour(c, ch);
    return rot.reduce((t, i, k) => {
      const ki = Math.min(KI_MAX, c.membres[i].ki + g[k]);
      return t + (PERSO[c.membres[i].id].rarete === 'LR' && ki >= KI_ULTIME ? 45 : ki >= KI_SUPER ? 30 : 0) + g[k];
    }, 0);
  };
  let best = [0], score = -1;
  for (let d = 0; d < NB_SPHERES; d++) {
    const ch = [d];
    for (let l = 1; l < 12; l++) {
      let suiv = -1, sv = valeur(ch);
      for (let p = 0; p < NB_SPHERES; p++) {
        if (ch.includes(p) || !voisines(ch[ch.length - 1], p)) continue;
        const v = valeur([...ch, p]);
        if (v > sv) { sv = v; suiv = p; }
      }
      if (suiv < 0) break;
      ch.push(suiv);
    }
    const v = valeur(ch);
    if (v > score) { score = v; best = ch; }
  }
  return best;
}
/** Ancien nom. */
export const meilleureCouleur = meilleurChemin;
