/**
 * PARE-FEU — le moteur d'une partie, déterministe.
 *
 * L'état est un simple objet JSON (on peut l'envoyer sur le réseau tel quel).
 * `commande` range un ordre dans la file ; `pas` avance d'une image (DT) :
 * il applique les ordres, fait réfléchir l'ordinateur, verse les cycles,
 * répare les nœuds, fait voyager les programmes et résout leurs arrivées.
 *
 * Chaque image remplit `E.evts` (lancers, blocages, captures…) pour
 * l'affichage ; ils sont remis à zéro à l'image suivante.
 *
 * En ligne, le client prédit entre deux états du serveur avec
 * `pas(E, { prediction: true })` : rien n'arrive, personne ne décide, les
 * programmes avancent et les cycles montent.
 */

import {
  DT, CYCLES, NOEUDS, CALME, CALME_NEUTRE, REGEN_NEUTRE, PRISE_PV, ABANDON_PV, PRIME_NOYAU,
  PROGRAMMES, DEFENSES, BRECHE, SURCHAUFFE, DUREE_MAX, NIVEAUX, NOMS_IA, PARFAIT,
} from './donnees.js';
import { creerCarte, longueur } from './carte.js';
import { allies, ami, source, action, recharge, equipesVivantes, alea, voit } from './regles.js';
import { decider } from './ia.js';

/**
 * @param {{ joueurs: {nom?: string, ia?: string|null}[], mode?: 'ffa'|'2v2', graine?: number }} o
 */
export function creerPartie(o = {}) {
  const liste = o.joueurs || [{ nom: 'Toi' }, { ia: 'normal' }];
  const mode = o.mode === '2v2' ? '2v2' : 'ffa';
  if (mode === '2v2' && liste.length !== 4) throw new Error('Le 2 contre 2 se joue à quatre');
  const n = liste.length;
  const carte = creerCarte(n);
  const noeuds = carte.noeuds.map((c) => {
    const type = c.type;
    const max = NOEUDS[type].pv;
    return {
      id: c.id, type, x: c.x, y: c.y, liens: c.liens, base: c.base,
      proprio: c.base, pv: max, max, eteint: false,
      pf: 0, av: 0, avProchain: 0, leurre: 0, leurreReste: 0, chiffre: 0, sature: 0, touche: -99,
    };
  });
  const joueurs = liste.map((p, j) => ({
    nom: (p.nom || (p.ia ? NOMS_IA[j % NOMS_IA.length] : `Joueur ${j + 1}`)).slice(0, 14),
    equipe: mode === '2v2' ? (j < 2 ? 0 : 1) : j,
    ia: p.ia && NIVEAUX[p.ia] ? p.ia : null,
    noyau: carte.bases[j],
    angle: carte.angles[j],
    res: CYCLES.depart,
    revenu: CYCLES.base,
    cd: {},
    vivant: true,
    elimineA: null,
    revele: {},
    memo: {},
    stats: { lances: 0, captures: 0, bloques: 0, degats: 0, vols: 0, noeudsMax: 4 },
  }));
  return {
    v: 1, mode, tick: 0, temps: 0, fini: false, gagnant: -1, mult: 1,
    joueurs, noeuds, liens: carte.liens,
    progs: [], file: [], evts: [], suivant: 1,
    alea: (o.graine ?? 1) >>> 0,
  };
}

/* ------------------------------------------------------------------ */
/* Les ordres                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cet ordre est-il possible maintenant ? Renvoie { ok, raison }.
 * c = { t: 'ver'|'cheval'|…|'parefeu'|…|'breche', cible, score?, parfait? }
 * (parfait : le mini-défi a été réussi sans faute, l'action vaut plus)
 */
export function verifier(E, j, c) {
  const J = E.joueurs[j];
  if (!J || E.fini || !J.vivant) return { ok: false, raison: 'Hors jeu' };
  const A = c && action(c.t);
  if (!A) return { ok: false, raison: 'Action inconnue' };
  const nd = E.noeuds[c.cible];
  if (!nd) return { ok: false, raison: 'Choisis un nœud' };
  if (recharge(E, j, c.t) > 0) return { ok: false, raison: 'En recharge' };
  if (J.res < A.cout) return { ok: false, raison: `Il faut ${A.cout} cycles` };
  if (DEFENSES[c.t]) {
    if (!ami(E, j, c.cible)) return { ok: false, raison: 'Une défense se pose sur tes nœuds' };
    if (c.t === 'parefeu' && nd.pf >= DEFENSES.parefeu.max) return { ok: false, raison: 'Pare-feu au maximum' };
    if (c.t === 'correctif' && nd.pv >= nd.max && nd.sature <= E.temps) return { ok: false, raison: 'Nœud intact' };
    return { ok: true };
  }
  if (source(E, j, c.cible) < 0) {
    return { ok: false, raison: ami(E, j, c.cible) ? 'C’est un nœud ami' : 'Hors de portée : il faut tenir un nœud voisin' };
  }
  if (c.t === 'sonde' && nd.proprio < 0) return { ok: false, raison: 'Rien à sonder sur un nœud neutre' };
  return { ok: true };
}

/** Range un ordre (appliqué à la prochaine image). */
export function commande(E, j, c) {
  const r = verifier(E, j, c);
  if (r.ok) {
    const o = { t: c.t, cible: c.cible | 0 };
    if (c.parfait && c.t !== 'breche') o.parfait = true;
    if (c.t === 'breche') o.score = Math.max(0, Math.min(BRECHE.longueur, Math.round(Number(c.score) || 0)));
    E.file.push({ j, c: o });
  }
  return r;
}

function evt(E, e) { E.evts.push(e); }

function appliquer(E, j, c) {
  if (!verifier(E, j, c).ok) return;
  const J = E.joueurs[j];
  const A = action(c.t);
  J.res -= A.cout;
  J.cd[c.t] = E.temps + A.recharge;
  const nd = E.noeuds[c.cible];

  if (PROGRAMMES[c.t]) {
    const de = source(E, j, c.cible);
    E.progs.push({
      id: E.suivant++, type: c.t, j, de, vers: c.cible, t: 0,
      len: longueur(E.noeuds, de, c.cible), cheval: c.t === 'cheval', devie: false, fort: !!c.parfait,
    });
    J.stats.lances++;
    evt(E, { k: 'lance', j, n: de, cible: c.cible, type: c.t, parfait: !!c.parfait });
    return;
  }

  if (c.t === 'breche') {
    const dg = (BRECHE.degats * c.score) / BRECHE.longueur;
    evt(E, { k: 'breche', j, n: c.cible, score: c.score });
    if (c.score >= BRECHE.longueur) nd.sature = Math.max(nd.sature, E.temps + BRECHE.sature);
    if (dg > 0) frapper(E, c.cible, dg, j);
    return;
  }

  const D = DEFENSES[c.t];
  const b = c.parfait ? PARFAIT : 1;
  switch (c.t) {
    case 'parefeu': nd.pf = Math.min(D.max, nd.pf + D.charges + (c.parfait ? 1 : 0)); break;
    case 'antivirus': nd.av = E.temps + D.duree * b; nd.avProchain = E.temps; break;
    case 'leurre': nd.leurre = E.temps + D.duree * b; nd.leurreReste = D.absorbe + (c.parfait ? 2 : 0); break;
    case 'chiffrement': nd.chiffre = E.temps + D.duree * b; break;
    case 'correctif': nd.pv = Math.min(nd.max, nd.pv + nd.max * D.soin * b); nd.sature = 0; break;
    default:
  }
  evt(E, { k: 'defense', j, n: c.cible, type: c.t, parfait: !!c.parfait });
}

/* ------------------------------------------------------------------ */
/* Dégâts, captures, éliminations                                      */
/* ------------------------------------------------------------------ */

function viderDefenses(nd) {
  nd.pf = 0; nd.av = 0; nd.leurre = 0; nd.leurreReste = 0; nd.chiffre = 0; nd.sature = 0;
}

function frapper(E, n, dg, j) {
  const nd = E.noeuds[n];
  let d = dg * E.mult;
  if (nd.chiffre > E.temps) d *= DEFENSES.chiffrement.facteur;
  if (nd.sature > E.temps) d *= 1.25;
  nd.pv -= d;
  nd.touche = E.temps;
  E.joueurs[j].stats.degats += d;
  if (nd.pv <= 0) capturer(E, n, j);
}

function capturer(E, n, j) {
  const nd = E.noeuds[n];
  const ancien = nd.proprio;
  nd.proprio = j;
  viderDefenses(nd);
  nd.touche = E.temps;
  const J = E.joueurs[j];
  J.stats.captures++;
  let noyau = false;
  if (nd.type === 'noyau' && !nd.eteint && ancien >= 0 && nd.base === ancien) {
    noyau = true;
    nd.eteint = true;
    nd.max = NOEUDS.eteint.pv;
    J.res = Math.min(CYCLES.max, J.res + PRIME_NOYAU);
  }
  nd.pv = nd.max * PRISE_PV;
  evt(E, { k: 'capture', n, j, ancien, noyau });
  let compte = 0;
  for (const x of E.noeuds) if (x.proprio === j) compte++;
  J.stats.noeudsMax = Math.max(J.stats.noeudsMax, compte);
  if (noyau) eliminer(E, ancien, j);
}

function eliminer(E, p, par) {
  const P = E.joueurs[p];
  if (!P.vivant) return;
  P.vivant = false;
  P.elimineA = E.temps;
  for (const nd of E.noeuds) {
    if (nd.proprio !== p) continue;
    nd.proprio = -1;
    viderDefenses(nd);
    nd.pv = Math.max(1, nd.max * ABANDON_PV);
  }
  E.progs = E.progs.filter((x) => x.j !== p);
  evt(E, { k: 'elimine', j: par, p });
  const vivantes = equipesVivantes(E);
  if (vivantes.length <= 1) finir(E, vivantes.length ? vivantes[0] : -1);
}

function finir(E, equipe) {
  if (E.fini) return;
  E.fini = true;
  E.gagnant = equipe;
  evt(E, { k: 'fin', equipe });
}

/** Au bout du temps : l'équipe qui tient le plus de nœuds (puis de PV) gagne. */
function finAuTemps(E) {
  const score = new Map();
  for (const nd of E.noeuds) {
    if (nd.proprio < 0) continue;
    const eq = E.joueurs[nd.proprio].equipe;
    score.set(eq, (score.get(eq) || 0) + 1000 + nd.pv);
  }
  let best = -1, max = -1;
  for (const [eq, s] of score) if (s > max) { max = s; best = eq; }
  finir(E, best);
}

/* ------------------------------------------------------------------ */
/* Les programmes en route                                             */
/* ------------------------------------------------------------------ */

/** Un programme arrive. Renvoie vrai s'il continue sa route (dévié par un leurre). */
function arriver(E, p) {
  const n = p.vers;
  const nd = E.noeuds[n];
  if (allies(E, p.j, nd.proprio)) return false;      // le nœud a changé de main en route
  const P = PROGRAMMES[p.type];
  const b = p.fort ? PARFAIT : 1;
  const libre = nd.sature <= E.temps;

  if (p.type !== 'sonde' && libre && nd.proprio >= 0) {
    if (nd.leurre > E.temps && nd.leurreReste > 0) {
      nd.leurreReste--;
      evt(E, { k: 'absorbe', n, j: p.j, type: p.type });
      return false;
    }
    if (!p.devie) {
      for (const v of nd.liens) {
        const m = E.noeuds[v];
        if (m.leurre > E.temps && m.leurreReste > 0 && m.sature <= E.temps && allies(E, m.proprio, nd.proprio)) {
          p.de = n; p.vers = v; p.t = 0; p.len = longueur(E.noeuds, n, v); p.devie = true;
          evt(E, { k: 'devie', n, vers: v, j: p.j, type: p.type });
          return true;
        }
      }
    }
  }
  if (p.type !== 'sonde' && libre && nd.pf > 0) {
    if (p.cheval) {
      p.cheval = false;
      evt(E, { k: 'passe', n, j: p.j });
    } else {
      nd.pf--;
      if (nd.proprio >= 0) E.joueurs[nd.proprio].stats.bloques++;
      evt(E, { k: 'bloque', n, j: p.j, type: p.type });
      return false;
    }
  }

  const proprio = nd.proprio;
  switch (p.type) {
    case 'saturation':
      nd.sature = E.temps + P.duree * b;
      evt(E, { k: 'sature', n, j: p.j });
      break;
    case 'rancon':
      if (proprio >= 0) {
        const V = E.joueurs[proprio];
        const v = Math.min(P.volMax, Math.floor(V.res * P.vol * b));
        V.res -= v;
        const J = E.joueurs[p.j];
        J.res = Math.min(CYCLES.max, J.res + v);
        J.stats.vols += v;
        evt(E, { k: 'vol', n, j: p.j, p: proprio, v });
      }
      break;
    case 'sonde':
      if (proprio >= 0) {
        E.joueurs.forEach((J, k) => { if (allies(E, k, p.j)) J.revele[proprio] = E.temps + P.duree * b; });
        evt(E, { k: 'sonde', n, j: p.j, p: proprio });
      }
      return false;
    default:
  }
  if (P.degats > 0) {
    evt(E, { k: 'impact', n, j: p.j, type: p.type, fort: p.fort });
    frapper(E, n, P.degats * b, p.j);
  }
  return false;
}

function antivirus(E, nd) {
  if (nd.av <= E.temps || nd.sature > E.temps || nd.proprio < 0 || E.temps < nd.avProchain) return;
  const D = DEFENSES.antivirus;
  let best = null, dmin = D.portee;
  for (const p of E.progs) {
    if (p.vers !== nd.id || allies(E, p.j, nd.proprio)) continue;
    const reste = (1 - p.t) * p.len;
    if (reste <= dmin) { dmin = reste; best = p; }
  }
  if (!best) return;
  const de = E.noeuds[best.de];
  evt(E, { k: 'zap', n: nd.id, j: best.j, type: best.type, x: de.x + (nd.x - de.x) * best.t, y: de.y + (nd.y - de.y) * best.t });
  best.mort = true;
  nd.avProchain = E.temps + D.cadence;
}

/* ------------------------------------------------------------------ */
/* Une image                                                           */
/* ------------------------------------------------------------------ */

export function pas(E, opts = {}) {
  if (E.fini) return E;
  const pred = !!opts.prediction;
  E.evts = [];
  if (!pred) {
    const file = E.file;
    E.file = [];
    for (const { j, c } of file) appliquer(E, j, c);
    E.joueurs.forEach((J, j) => {
      if (!J.ia || !J.vivant || E.fini) return;
      if (E.temps >= (J.memo.prochain || 0)) {
        decider(E, j);
        J.memo.prochain = E.temps + NIVEAUX[J.ia].reflexion * (0.75 + 0.5 * alea(E));
      }
    });
  }
  E.tick++;
  E.temps = Math.round(E.tick * DT * 1000) / 1000;
  E.mult = 1;
  for (const s of SURCHAUFFE) if (E.temps >= s.apres) E.mult = s.mult;

  // Les cycles.
  const revenus = E.joueurs.map(() => CYCLES.base);
  for (const nd of E.noeuds) if (nd.proprio >= 0) revenus[nd.proprio] += NOEUDS[nd.eteint ? 'eteint' : nd.type].revenu;
  E.joueurs.forEach((J, j) => {
    if (!J.vivant) { J.revenu = 0; return; }
    J.revenu = revenus[j] * (J.ia ? NIVEAUX[J.ia].revenu : 1);
    J.res = Math.min(CYCLES.max, J.res + J.revenu * DT);
  });

  // Les nœuds se réparent, les leurres s'éteignent, l'antivirus tire.
  for (const nd of E.noeuds) {
    const calme = E.temps - nd.touche;
    if (nd.sature <= E.temps && nd.pv < nd.max) {
      if (nd.proprio >= 0 && calme > CALME) nd.pv = Math.min(nd.max, nd.pv + NOEUDS[nd.eteint ? 'eteint' : nd.type].regen * DT);
      else if (nd.proprio < 0 && calme > CALME_NEUTRE) nd.pv = Math.min(nd.max, nd.pv + REGEN_NEUTRE * DT);
    }
    if (nd.leurre <= E.temps) nd.leurreReste = 0;
    if (!pred) antivirus(E, nd);
  }

  // Les programmes avancent.
  const restent = [];
  for (const p of E.progs) {
    if (p.mort) continue;
    p.t += (PROGRAMMES[p.type].vitesse * DT) / Math.max(1, p.len);
    if (p.t < 1) { restent.push(p); continue; }
    if (pred) { p.t = 0.995; restent.push(p); continue; }
    if (E.fini) continue;
    if (arriver(E, p)) restent.push(p);
  }
  E.progs = restent.filter((p) => !p.mort && E.joueurs[p.j].vivant);

  if (!E.fini && E.temps >= DUREE_MAX) finAuTemps(E);
  return E;
}

/* ------------------------------------------------------------------ */
/* Pour le réseau, les tests et l'affichage                            */
/* ------------------------------------------------------------------ */

const r2 = (x) => Math.round(x * 100) / 100;

/**
 * L'état tel que j le voit : sans la file ni la mémoire de l'ordinateur, et
 * sans les défenses adverses qu'aucune sonde n'a révélées (pf = -1 : inconnu).
 */
export function vuePour(E, j) {
  return {
    v: E.v, mode: E.mode, tick: E.tick, temps: E.temps, fini: E.fini, gagnant: E.gagnant, mult: E.mult,
    liens: E.liens, suivant: E.suivant, alea: 0, file: [], evts: [],
    joueurs: E.joueurs.map((J) => ({
      nom: J.nom, equipe: J.equipe, ia: J.ia, noyau: J.noyau, angle: J.angle, res: r2(J.res), revenu: r2(J.revenu),
      cd: J.cd, vivant: J.vivant, elimineA: J.elimineA, revele: J.revele, memo: {}, stats: J.stats,
    })),
    noeuds: E.noeuds.map((nd) => {
      const o = { ...nd, pv: r2(nd.pv) };
      if (j >= 0 && !voit(E, j, nd.id)) { o.pf = -1; o.leurre = 0; o.leurreReste = 0; o.chiffre = 0; }
      return o;
    }),
    progs: E.progs.map((p) => ({ ...p, t: Math.round(p.t * 1000) / 1000, len: r2(p.len) })),
  };
}

/** Une empreinte courte de l'état (tests de déterminisme). */
export function empreinte(E) {
  const s = JSON.stringify([E.tick, E.joueurs.map((J) => [r2(J.res), J.vivant]), E.noeuds.map((n) => [n.proprio, r2(n.pv), n.pf]), E.progs.map((p) => [p.id, r2(p.t)])]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

/** Joue une partie jusqu'au bout (ou `maxSec`). */
export function simuler(o, maxSec = DUREE_MAX + 1) {
  const E = creerPartie(o);
  const fin = Math.ceil(maxSec / DT);
  while (!E.fini && E.tick < fin) pas(E);
  return E;
}

export { DT };
