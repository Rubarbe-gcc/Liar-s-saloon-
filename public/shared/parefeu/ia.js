/**
 * PARE-FEU — l'ordinateur.
 *
 * À chaque décision (toutes les `reflexion` secondes selon le niveau), il
 * regarde d'abord ce qui arrive sur ses nœuds (et ceux de son coéquipier) et
 * se défend, puis il attaque : il garde une cible (selon `focus`), choisit le
 * programme qui convient (sonde si les défenses sont cachées, saturation
 * contre un gros pare-feu ou un antivirus, cheval de Troie contre un pare-feu,
 * rançongiciel contre un joueur riche, brèche de temps en temps, sinon des vers).
 *
 * Tout passe par `commande`, comme pour un humain, et le hasard par `alea(E)`.
 */

import { PROGRAMMES, DEFENSES, BRECHE, NIVEAUX, LISTE_TECHS } from './donnees.js';
import { allies, ami, frontiere, recharge, voit, alea, prixTech, prixUp, up } from './regles.js';
import { commande, verifier } from './partie.js';

const VALEUR = { noyau: 6, nexus: 4, serveur: 3, relais: 2.4, eteint: 2 };
const DEGATS = { ver: 5, cheval: 13, saturation: 4, rancon: 4, sonde: 0 };

/** Ce qui arrive sur chaque nœud : dégâts attendus et nombre de programmes. */
function menaces(E, j) {
  const m = new Map();
  for (const p of E.progs) {
    const nd = E.noeuds[p.vers];
    if (!ami(E, j, p.vers) || allies(E, p.j, nd.proprio)) continue;
    const x = m.get(p.vers) || { dg: 0, n: 0, proche: 0 };
    x.dg += DEGATS[p.type] * E.mult;
    x.n++;
    if ((1 - p.t) * p.len < 150) x.proche++;
    m.set(p.vers, x);
  }
  return m;
}

/** Un ordre, avec son mini-défi réussi sans faute selon le niveau. */
function essayer(E, j, t, cible, extra = {}) {
  if (!verifier(E, j, { t, cible, ...extra }).ok) return false;
  const N = NIVEAUX[E.joueurs[j].ia] || NIVEAUX.normal;
  return commande(E, j, { t, cible, parfait: alea(E) < N.parfait, ...extra }).ok;
}

function defendre(E, j, N) {
  const J = E.joueurs[j];
  const M = menaces(E, j);
  let pire = null, danger = 0;
  for (const [n, x] of M) {
    const nd = E.noeuds[n];
    const imp = (nd.type === 'noyau' && !nd.eteint ? 3 : 1) * (nd.proprio === j ? 1 : 0.7);
    const d = (Math.max(0, x.dg - nd.pf * 5) / Math.max(4, nd.pv)) * imp + x.n * 0.04;
    if (d > danger) { danger = d; pire = n; }
  }
  // Une saturation sur un de mes nœuds : le correctif la lève.
  for (const nd of E.noeuds) {
    if (nd.proprio === j && nd.sature > E.temps + 1.5 && (M.has(nd.id) || nd.type === 'noyau') && alea(E) < N.defense) {
      if (essayer(E, j, 'correctif', nd.id)) return true;
    }
  }
  if (pire !== null && danger > 0.12 && alea(E) < N.defense) {
    const nd = E.noeuds[pire];
    const x = M.get(pire);
    const coeur = nd.type === 'noyau' && !nd.eteint;
    if (x.n >= 3 && essayer(E, j, 'antivirus', pire)) return true;
    if (nd.pf < 2 && essayer(E, j, 'parefeu', pire)) return true;
    if (coeur && danger > 0.35) {
      if (essayer(E, j, 'chiffrement', pire)) return true;
      const voisin = nd.liens.find((v) => E.noeuds[v].proprio === j && E.noeuds[v].sature <= E.temps);
      if (voisin !== undefined && essayer(E, j, 'leurre', voisin)) return true;
    }
    if (nd.pv / nd.max < 0.5 && essayer(E, j, 'correctif', pire)) return true;
    if (danger > 0.5 && essayer(E, j, 'chiffrement', pire)) return true;
  }
  // Un nœud abîmé au calme : on le répare quand on est à l'aise.
  if (J.res > 70) {
    for (const nd of E.noeuds) {
      if (nd.proprio === j && nd.pv / nd.max < 0.4 && essayer(E, j, 'correctif', nd.id)) return true;
    }
  }
  // Prévoir : un pare-feu sur les nœuds qui touchent l'ennemi, le Noyau d'abord.
  if (J.res > 55 + N.reserve) {
    const exposes = E.noeuds
      .filter((nd) => nd.proprio === j && nd.liens.some((v) => E.noeuds[v].proprio >= 0 && !ami(E, j, v)))
      .sort((a, b) => (b.type === 'noyau') - (a.type === 'noyau') || a.pf - b.pf);
    for (const nd of exposes) {
      if (nd.pf < (nd.type === 'noyau' ? 4 : 2) && essayer(E, j, 'parefeu', nd.id)) return true;
    }
  }
  return false;
}

function score(E, j, n, focusJ) {
  const nd = E.noeuds[n];
  const type = nd.eteint ? 'eteint' : nd.type;
  let v = VALEUR[type];
  if (nd.type === 'noyau' && !nd.eteint) v *= 1.6;
  // Un serveur ennemi qui touche son Noyau ouvre la route.
  if (nd.type === 'serveur' && nd.proprio >= 0) v += 0.8;
  const pf = voit(E, j, n) ? Math.max(0, nd.pf) : 1.5;
  let s = (v * (2.2 - nd.pv / nd.max)) / (1 + pf * 0.45);
  if (nd.av > E.temps) s *= 0.4;
  if (nd.proprio >= 0 && nd.proprio === focusJ) s *= 1.5;
  if (nd.proprio < 0) s *= E.temps < 60 ? 1.2 : 0.8;
  if (E.ev && E.ev.k === 'cache' && E.ev.n === n) s *= 3;
  return s * (0.85 + 0.3 * alea(E));
}

/** L'adversaire qu'on vise : celui qui nous attaque, sinon le plus gros. */
function adversaire(E, j) {
  const J = E.joueurs[j];
  const coups = new Map();
  for (const p of E.progs) if (ami(E, j, p.vers) && !allies(E, j, p.j)) coups.set(p.j, (coups.get(p.j) || 0) + 1);
  let best = -1, max = 0;
  for (const [k, c] of coups) if (c > max) { max = c; best = k; }
  if (best >= 0) return best;
  if (J.memo.focus >= 0 && E.joueurs[J.memo.focus]?.vivant) return J.memo.focus;
  const taille = E.joueurs.map((_, k) => E.noeuds.filter((nd) => nd.proprio === k).length);
  let gros = -1, tmax = -1;
  E.joueurs.forEach((K, k) => { const t = taille[k] + alea(E) * 3; if (K.vivant && !allies(E, j, k) && t > tmax) { tmax = t; gros = k; } });
  return gros;
}

function attaquer(E, j, N) {
  const J = E.joueurs[j];
  if (J.res < N.reserve * 0.5 + PROGRAMMES.ver.cout) return false;
  const cibles = frontiere(E, j);
  if (!cibles.length) return false;
  const focusJ = adversaire(E, j);
  J.memo.focus = focusJ;
  let cible = J.memo.cible;
  if (!(cibles.includes(cible) && alea(E) < N.focus)) {
    let best = -1, smax = -1;
    for (const n of cibles) { const s = score(E, j, n, focusJ); if (s > smax) { smax = s; best = n; } }
    cible = best;
  }
  J.memo.cible = cible;
  const nd = E.noeuds[cible];
  const proprio = nd.proprio;
  const vu = voit(E, j, cible);
  const riche = J.res > N.reserve + 30;

  if (proprio >= 0 && !vu && recharge(E, j, 'sonde') === 0 && alea(E) < 0.35 && essayer(E, j, 'sonde', cible)) return true;
  if ((nd.av > E.temps || (vu && nd.pf >= 3) || nd.leurre > E.temps) && riche && essayer(E, j, 'saturation', cible)) return true;
  if (nd.av > E.temps && nd.sature <= E.temps) return false; // on attend que l'antivirus s'éteigne
  if (proprio >= 0 && E.joueurs[proprio].res > 60 && riche && alea(E) < 0.6 && essayer(E, j, 'rancon', cible)) return true;
  if (riche && alea(E) < 0.35) {
    const [a, b] = N.breche;
    const sc = a + Math.floor(alea(E) * (b - a + 1));
    if (essayer(E, j, 'breche', cible, { score: Math.min(BRECHE.longueur, sc) })) return true;
  }
  if ((!vu || nd.pf >= 1) && J.res > N.reserve + 15 && essayer(E, j, 'cheval', cible)) return true;
  if (J.res >= N.reserve * 0.5 + PROGRAMMES.ver.cout && essayer(E, j, 'ver', cible)) return true;
  return false;
}

/** Les technologies que l'ordinateur préfère, dans l'ordre. */
const PREFERES = ['overclock', 'ver', 'regen', 'parefeu', 'recharge', 'vitesse', 'cheval', 'antivirus', 'correctif', 'chiffrement', 'saturation', 'rancon', 'leurre', 'breche', 'sonde'];

/** Quand il a de quoi, l'ordinateur achète une amélioration. */
function ameliorer(E, j, N) {
  const J = E.joueurs[j];
  if (alea(E) > N.ameliore) return false;
  const choix = [];
  PREFERES.forEach((k, i) => { const p = prixTech(E, j, k); if (p < Infinity) choix.push({ c: { t: 'tech', k }, p, w: 1 / (1 + i * 0.15) }); });
  for (const nd of E.noeuds) {
    if (nd.proprio !== j) continue;
    const coeur = nd.type === 'noyau' && !nd.eteint;
    const expose = nd.liens.some((v) => !ami(E, j, v));
    const vouloir = coeur ? ['blindage', 'bouclier', 'tourelle'] : expose ? ['tourelle', 'propulseur', 'bouclier'] : ['rendement'];
    for (const k of vouloir) {
      const p = prixUp(nd, k);
      if (p < Infinity) choix.push({ c: { t: 'up', k, cible: nd.id }, p, w: (coeur ? 1.2 : 0.7) / (1 + up(nd, k)) });
    }
  }
  const abordables = choix.filter((x) => J.res >= x.p + N.reserve + 20);
  if (!abordables.length) return false;
  let tot = abordables.reduce((s, x) => s + x.w, 0) * alea(E);
  for (const x of abordables) { tot -= x.w; if (tot <= 0) return commande(E, j, x.c).ok; }
  return false;
}

/**
 * Une décision = un seul geste, comme une personne qui tape une commande à la
 * fois. On regarde d'abord s'il faut se défendre, sinon on attaque, sinon on
 * améliore. Le rythme (combien de temps entre deux gestes) vient de `reflexion`
 * dans donnees.js : lent pour qui n'a jamais touché un ordinateur, vif pour qui
 * connaît son clavier. Le joueur hésite parfois (`hesite`) et ne fait rien.
 */
export function decider(E, j) {
  const N = NIVEAUX[E.joueurs[j].ia] || NIVEAUX.normal;
  if (N.hesite && alea(E) < N.hesite) return;   // il réfléchit, cherche ses touches…
  if (defendre(E, j, N)) return;
  if (attaquer(E, j, N)) return;
  ameliorer(E, j, N);
}

