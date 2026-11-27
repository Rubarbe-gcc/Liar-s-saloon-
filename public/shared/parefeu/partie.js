/**
 * PARE-FEU — le moteur d'une partie, déterministe.
 *
 * L'état est un simple objet JSON (on peut l'envoyer sur le réseau tel quel).
 * `commande` range un ordre dans la file ; `pas` avance d'une image (DT) :
 * il applique les ordres, fait réfléchir l'ordinateur, gère les événements,
 * verse les cycles, répare les nœuds, fait tirer tourelles et antivirus,
 * fait voyager les programmes et résout leurs arrivées.
 *
 * Les ordres : un programme ou une défense { t, cible, parfait? }, la brèche
 * { t: 'breche', cible, score }, une technologie du Laboratoire
 * { t: 'tech', k } et une amélioration de nœud { t: 'up', k, cible }.
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
  TECHS, AMELIORATIONS, NIV_MAX, TOURELLE, BOUCLIER, CHIFFRE_TECH,
  EVENEMENTS, LISTE_EVENEMENTS, PREMIER_EVENEMENT, ECART_EVENEMENTS,
} from './donnees.js';
import { creerCarte, longueur } from './carte.js';
import {
  allies, ami, source, action, recharge, equipesVivantes, alea, voit,
  evenement, tech, up, coutDe, rechargeDe, prixTech, prixUp,
} from './regles.js';
import { decider } from './ia.js';

const vierge = () => ({ blindage: 0, rendement: 0, tourelle: 0, bouclier: 0, propulseur: 0 });

/**
 * @param {{ joueurs: {nom?: string, ia?: string|null}[], mode?: 'ffa'|'2v2', graine?: number, evenements?: boolean }} o
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
      proprio: c.base, pv: max, max, eteint: false, up: vierge(),
      pf: 0, av: 0, avProchain: 0, avCadence: DEFENSES.antivirus.cadence, leurre: 0, leurreReste: 0,
      chiffre: 0, chiffreF: DEFENSES.chiffrement.facteur, sature: 0, touche: -99, tourProchain: 0, boucProchain: 0,
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
    tech: {},
    vivant: true,
    elimineA: null,
    revele: {},
    memo: {},
    stats: { lances: 0, captures: 0, bloques: 0, degats: 0, vols: 0, noeudsMax: 4, ameliorations: 0 },
  }));
  const E = {
    v: 2, mode, tick: 0, temps: 0, fini: false, gagnant: -1, mult: 1,
    joueurs, noeuds, liens: carte.liens,
    progs: [], file: [], evts: [], suivant: 1,
    alea: (o.graine ?? 1) >>> 0,
    evenements: o.evenements !== false,
    ev: null, evProchain: 0,
  };
  E.evProchain = PREMIER_EVENEMENT[0] + Math.round(alea(E) * (PREMIER_EVENEMENT[1] - PREMIER_EVENEMENT[0]));
  return E;
}

/* ------------------------------------------------------------------ */
/* Ce que valent les choses, technologies et améliorations comprises   */
/* ------------------------------------------------------------------ */

const baseMax = (nd) => (nd.eteint ? NOEUDS.eteint.pv : NOEUDS[nd.type].pv);
const maxDe = (nd) => Math.round(baseMax(nd) * (1 + 0.35 * up(nd, 'blindage')));
const maxPf = (E, j) => DEFENSES.parefeu.max + 2 * tech(E, j, 'parefeu');
const panne = (E) => evenement(E, 'panne');

/** Les dégâts d'un programme au départ (technologie et propulseur du nœud de départ). */
function degatsDe(E, j, type, de) {
  const P = PROGRAMMES[type];
  let d = P.degats;
  if (type === 'ver') d += 2 * tech(E, j, 'ver');
  if (type === 'cheval') d += 4 * tech(E, j, 'cheval');
  return d * (1 + 0.1 * up(E.noeuds[de], 'propulseur'));
}

const vitesseDe = (E, j, type, de) => PROGRAMMES[type].vitesse * (1 + 0.12 * tech(E, j, 'vitesse')) * (1 + 0.15 * up(E.noeuds[de], 'propulseur'));

/* ------------------------------------------------------------------ */
/* Les ordres                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cet ordre est-il possible maintenant ? Renvoie { ok, raison }.
 * (parfait : le mini-défi a été réussi sans faute, l'action vaut plus)
 */
export function verifier(E, j, c) {
  const J = E.joueurs[j];
  if (!J || E.fini || !J.vivant) return { ok: false, raison: 'Hors jeu' };
  if (!c) return { ok: false, raison: 'Action inconnue' };

  if (c.t === 'tech') {
    if (!TECHS[c.k]) return { ok: false, raison: 'Technologie inconnue' };
    const p = prixTech(E, j, c.k);
    if (p === Infinity) return { ok: false, raison: 'Déjà au maximum' };
    if (J.res < p) return { ok: false, raison: `Il faut ${p} cycles` };
    return { ok: true };
  }
  const nd = E.noeuds[c.cible];
  if (c.t === 'up') {
    if (!AMELIORATIONS[c.k]) return { ok: false, raison: 'Amélioration inconnue' };
    if (!nd || nd.proprio !== j) return { ok: false, raison: 'On n’améliore que ses propres nœuds' };
    const p = prixUp(nd, c.k);
    if (p === Infinity) return { ok: false, raison: 'Déjà au maximum' };
    if (J.res < p) return { ok: false, raison: `Il faut ${p} cycles` };
    return { ok: true };
  }

  const A = action(c.t);
  if (!A) return { ok: false, raison: 'Action inconnue' };
  if (!nd) return { ok: false, raison: 'Choisis un nœud' };
  if (recharge(E, j, c.t) > 0) return { ok: false, raison: 'En recharge' };
  const cout = coutDe(E, j, c.t);
  if (J.res < cout) return { ok: false, raison: `Il faut ${cout} cycles` };
  if (DEFENSES[c.t]) {
    if (!ami(E, j, c.cible)) return { ok: false, raison: 'Une défense se pose sur tes nœuds' };
    if (c.t === 'parefeu' && nd.pf >= maxPf(E, j)) return { ok: false, raison: 'Pare-feu au maximum' };
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
    const o = { t: c.t };
    if (c.t === 'tech') o.k = c.k;
    else {
      o.cible = c.cible | 0;
      if (c.t === 'up') o.k = c.k;
      if (c.parfait && c.t !== 'breche' && c.t !== 'up') o.parfait = true;
      if (c.t === 'breche') o.score = Math.max(0, Math.min(BRECHE.longueur, Math.round(Number(c.score) || 0)));
    }
    E.file.push({ j, c: o });
  }
  return r;
}

function evt(E, e) { E.evts.push(e); }

function appliquer(E, j, c) {
  if (!verifier(E, j, c).ok) return;
  const J = E.joueurs[j];

  if (c.t === 'tech') {
    J.res -= prixTech(E, j, c.k);
    J.tech[c.k] = tech(E, j, c.k) + 1;
    J.stats.ameliorations++;
    evt(E, { k: 'tech', j, tech: c.k, niv: J.tech[c.k] });
    return;
  }
  const nd = E.noeuds[c.cible];
  if (c.t === 'up') {
    J.res -= prixUp(nd, c.k);
    nd.up[c.k] = up(nd, c.k) + 1;
    J.stats.ameliorations++;
    if (c.k === 'blindage') { const m = maxDe(nd); nd.pv += m - nd.max; nd.max = m; }
    evt(E, { k: 'up', j, n: c.cible, up: c.k, niv: nd.up[c.k] });
    return;
  }

  J.res -= coutDe(E, j, c.t);
  J.cd[c.t] = E.temps + rechargeDe(E, j, c.t);

  if (PROGRAMMES[c.t]) {
    const de = source(E, j, c.cible);
    E.progs.push({
      id: E.suivant++, type: c.t, j, de, vers: c.cible, t: 0,
      len: longueur(E.noeuds, de, c.cible), cheval: c.t === 'cheval', devie: false, fort: !!c.parfait,
      dg: degatsDe(E, j, c.t, de), vit: vitesseDe(E, j, c.t, de),
    });
    J.stats.lances++;
    evt(E, { k: 'lance', j, n: de, cible: c.cible, type: c.t, parfait: !!c.parfait });
    return;
  }

  if (c.t === 'breche') {
    const dg = ((BRECHE.degats + 6 * tech(E, j, 'breche')) * c.score) / BRECHE.longueur;
    evt(E, { k: 'breche', j, n: c.cible, score: c.score });
    if (c.score >= BRECHE.longueur) nd.sature = Math.max(nd.sature, E.temps + BRECHE.sature);
    if (dg > 0) frapper(E, c.cible, dg, j);
    return;
  }

  const D = DEFENSES[c.t];
  const b = c.parfait ? PARFAIT : 1;
  const n = tech(E, j, c.t);
  switch (c.t) {
    case 'parefeu': nd.pf = Math.min(maxPf(E, j), nd.pf + D.charges + n + (c.parfait ? 1 : 0)); break;
    case 'antivirus': nd.av = E.temps + (D.duree + 3 * n) * b; nd.avProchain = E.temps; nd.avCadence = D.cadence * (1 - 0.2 * n); break;
    case 'leurre': nd.leurre = E.temps + (D.duree + 3 * n) * b; nd.leurreReste = D.absorbe + 3 * n + (c.parfait ? 2 : 0); break;
    case 'chiffrement': nd.chiffre = E.temps + D.duree * b; nd.chiffreF = CHIFFRE_TECH[n]; break;
    case 'correctif': nd.pv = Math.min(nd.max, nd.pv + nd.max * (D.soin + 0.12 * n) * b); nd.sature = 0; break;
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
  if (nd.chiffre > E.temps && !panne(E)) d *= nd.chiffreF;
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
  nd.up = vierge();
  nd.touche = E.temps;
  const J = E.joueurs[j];
  J.stats.captures++;
  let noyau = false;
  if (nd.type === 'noyau' && !nd.eteint && ancien >= 0 && nd.base === ancien) {
    noyau = true;
    nd.eteint = true;
    J.res = Math.min(CYCLES.max, J.res + PRIME_NOYAU);
  }
  nd.max = maxDe(nd);
  nd.pv = nd.max * PRISE_PV;
  evt(E, { k: 'capture', n, j, ancien, noyau });
  // La cache de données : le premier qui prend le nœud empoche la prime.
  if (E.ev && E.ev.k === 'cache' && E.ev.n === n && E.ev.fin > E.temps) {
    const prime = EVENEMENTS.cache.prime;
    J.res = Math.min(CYCLES.max, J.res + prime);
    evt(E, { k: 'tresor', n, j, v: prime });
    finEvenement(E);
  }
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
    nd.up = vierge();
    nd.max = maxDe(nd);
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
/* Les événements                                                      */
/* ------------------------------------------------------------------ */

function lancerEvenement(E) {
  const possibles = LISTE_EVENEMENTS.filter((k) => k !== 'cache' || E.noeuds.some((nd) => nd.proprio < 0));
  const k = possibles[Math.floor(alea(E) * possibles.length)];
  E.ev = { k, debut: E.temps, fin: E.temps + EVENEMENTS[k].duree };
  if (k === 'cache') {
    const neutres = E.noeuds.filter((nd) => nd.proprio < 0);
    E.ev.n = neutres[Math.floor(alea(E) * neutres.length)].id;
  }
  evt(E, { k: 'evenement', ev: k, n: E.ev.n ?? -1 });
}

function finEvenement(E) {
  if (!E.ev) return;
  evt(E, { k: 'finEvenement', ev: E.ev.k });
  E.ev = null;
  E.evProchain = E.temps + ECART_EVENEMENTS[0] + Math.round(alea(E) * (ECART_EVENEMENTS[1] - ECART_EVENEMENTS[0]));
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
  const libre = nd.sature <= E.temps && !panne(E);

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
      nd.sature = E.temps + (P.duree + 1.5 * tech(E, p.j, 'saturation')) * b;
      evt(E, { k: 'sature', n, j: p.j });
      break;
    case 'rancon':
      if (proprio >= 0) {
        const V = E.joueurs[proprio];
        const n2 = tech(E, p.j, 'rancon');
        const v = Math.min(P.volMax + 10 * n2, Math.floor(V.res * (P.vol + 0.1 * n2) * b));
        V.res -= v;
        const J = E.joueurs[p.j];
        J.res = Math.min(CYCLES.max, J.res + v);
        J.stats.vols += v;
        evt(E, { k: 'vol', n, j: p.j, p: proprio, v });
      }
      break;
    case 'sonde':
      if (proprio >= 0) {
        const duree = (P.duree + 6 * tech(E, p.j, 'sonde')) * b;
        E.joueurs.forEach((J, k) => { if (allies(E, k, p.j)) J.revele[proprio] = E.temps + duree; });
        evt(E, { k: 'sonde', n, j: p.j, p: proprio });
      }
      return false;
    default:
  }
  const dg = p.dg ?? P.degats;
  if (dg > 0) {
    evt(E, { k: 'impact', n, j: p.j, type: p.type, fort: p.fort, dg: Math.round(dg * b * E.mult) });
    frapper(E, n, dg * b, p.j);
  }
  return false;
}

/** Le plus proche des programmes ennemis qui visent ce nœud, à portée. */
function cibleProche(E, nd, portee) {
  let best = null, dmin = portee;
  for (const p of E.progs) {
    if (p.mort || p.vers !== nd.id || allies(E, p.j, nd.proprio)) continue;
    const reste = (1 - p.t) * p.len;
    if (reste <= dmin) { dmin = reste; best = p; }
  }
  return best;
}

function abattre(E, nd, p, k) {
  const de = E.noeuds[p.de];
  evt(E, { k, n: nd.id, j: p.j, type: p.type, x: de.x + (nd.x - de.x) * p.t, y: de.y + (nd.y - de.y) * p.t });
  p.mort = true;
}

function tirer(E, nd) {
  if (nd.proprio < 0 || nd.sature > E.temps || panne(E)) return;
  if (nd.av > E.temps && E.temps >= nd.avProchain) {
    const p = cibleProche(E, nd, DEFENSES.antivirus.portee);
    if (p) { abattre(E, nd, p, 'zap'); nd.avProchain = E.temps + nd.avCadence; }
  }
  const t = up(nd, 'tourelle');
  if (t > 0 && E.temps >= nd.tourProchain) {
    const p = cibleProche(E, nd, TOURELLE.portee);
    if (p) { abattre(E, nd, p, 'tourelle'); nd.tourProchain = E.temps + TOURELLE.cadence[t - 1]; }
  }
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

  // Les événements.
  if (!pred && E.evenements) {
    if (E.ev && E.temps >= E.ev.fin) finEvenement(E);
    else if (!E.ev && E.temps >= E.evProchain) lancerEvenement(E);
  }

  // Les cycles.
  const revenus = E.joueurs.map(() => CYCLES.base);
  for (const nd of E.noeuds) if (nd.proprio >= 0) revenus[nd.proprio] += NOEUDS[nd.eteint ? 'eteint' : nd.type].revenu + 0.8 * up(nd, 'rendement');
  const surtension = evenement(E, 'surtension') ? 2 : 1;
  E.joueurs.forEach((J, j) => {
    if (!J.vivant) { J.revenu = 0; return; }
    J.revenu = revenus[j] * (J.ia ? NIVEAUX[J.ia].revenu : 1) * (1 + 0.1 * tech(E, j, 'overclock')) * surtension;
    J.res = Math.min(CYCLES.max, J.res + J.revenu * DT);
  });

  // Les nœuds se réparent, les boucliers se rechargent, les leurres s'éteignent, on tire.
  for (const nd of E.noeuds) {
    const calme = E.temps - nd.touche;
    if (nd.sature <= E.temps && nd.pv < nd.max) {
      if (nd.proprio >= 0 && calme > CALME) {
        const r = NOEUDS[nd.eteint ? 'eteint' : nd.type].regen * (1 + 0.4 * tech(E, nd.proprio, 'regen'));
        nd.pv = Math.min(nd.max, nd.pv + r * DT);
      } else if (nd.proprio < 0 && calme > CALME_NEUTRE) nd.pv = Math.min(nd.max, nd.pv + REGEN_NEUTRE * DT);
    }
    const bq = up(nd, 'bouclier');
    if (bq > 0 && nd.proprio >= 0) {
      if (nd.pf >= bq + 1) nd.boucProchain = E.temps + BOUCLIER.periode[bq - 1];
      else if (E.temps >= nd.boucProchain) {
        if (nd.boucProchain > 0 && !pred) { nd.pf++; evt(E, { k: 'bouclier', n: nd.id, j: nd.proprio }); }
        nd.boucProchain = E.temps + BOUCLIER.periode[bq - 1];
      }
    }
    if (nd.leurre <= E.temps) nd.leurreReste = 0;
    if (!pred) tirer(E, nd);
  }

  // Les programmes avancent.
  const tempete = evenement(E, 'tempete') ? 1.4 : 1;
  const restent = [];
  for (const p of E.progs) {
    if (p.mort) continue;
    p.t += ((p.vit ?? PROGRAMMES[p.type].vitesse) * tempete * DT) / Math.max(1, p.len);
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
    evenements: E.evenements, ev: E.ev, evProchain: E.evProchain,
    joueurs: E.joueurs.map((J) => ({
      nom: J.nom, equipe: J.equipe, ia: J.ia, noyau: J.noyau, angle: J.angle, res: r2(J.res), revenu: r2(J.revenu),
      cd: J.cd, tech: J.tech, vivant: J.vivant, elimineA: J.elimineA, revele: J.revele, memo: {}, stats: J.stats,
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
  const s = JSON.stringify([E.tick, E.joueurs.map((J) => [r2(J.res), J.vivant, J.tech]), E.noeuds.map((n) => [n.proprio, r2(n.pv), n.pf, n.up]), E.progs.map((p) => [p.id, r2(p.t)]), E.ev]);
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

export { DT, maxDe, maxPf };
