/**
 * REMPART — un joueur automatique.
 *
 * Sert aux tests d'équilibre (un niveau doit être gagnable par un joueur
 * raisonnable, et perdu par un joueur qui ne fait presque rien) et à la
 * partie de démonstration derrière le menu.
 */

import { TOURS, ENNEMIS } from './donnees.js';
import { construire, ameliorer, coutAmelioration, lancerVague, surChemin, apercuVague } from './partie.js';

/** Combien de bouts de chemin (sol, air) passent à portée d'un emplacement. */
export function couverture(carte, emp, portee = 3) {
  let sol = 0, air = 0;
  const r2 = portee * portee;
  const compter = ch => {
    let n = 0;
    for (let d = 0; d < ch.total; d += 0.25) {
      const q = surChemin(ch, d);
      if ((q.x - emp.x) ** 2 + (q.z - emp.z) ** 2 <= r2) n++;
    }
    return n;
  };
  for (const ch of carte.chemins) sol += compter(ch);
  for (const ch of carte.vols) air += compter(ch);
  return { sol, air };
}

const PLAN = ['rafale', 'mortier', 'givre', 'perce', 'rafale', 'foudre', 'mortier', 'perce', 'foudre', 'givre', 'rafale', 'mortier', 'perce', 'foudre'];

/**
 * @param {object} p  la partie
 * @param {object} [o]
 * @param {string[]} [o.types]     tours permises (par défaut, celles du niveau)
 * @param {number}   [o.maxTours]  nombre de tours au plus
 * @param {boolean}  [o.ameliore]  améliore-t-il ses tours ?
 * @param {boolean}  [o.appelle]   appelle-t-il les vagues en avance ?
 */
export function creerIA(p, { types = null, maxTours = Infinity, ameliore = true, appelle = false } = {}) {
  const permis = (types || p.def.tours).filter(t => p.def.tours.includes(t));
  const plan = PLAN.filter(t => permis.includes(t));
  const scores = p.carte.emplacements.map(emp => ({ emp, ...couverture(p.carte, emp) }));
  return { plan: plan.length ? plan : permis, maxTours, ameliore, appelle, scores, k: 0, n: 0, attente: 0 };
}

function meilleurEmplacement(p, ia, type) {
  const def = TOURS[type];
  const libres = ia.scores.filter(s => !p.tours.some(t => t.emp === s.emp.id));
  let best = null, v = -1;
  for (const s of libres) {
    const val = (def.sol ? s.sol : 0) + (def.air ? s.air * 0.8 : 0);
    if (val > v) { v = val; best = s.emp; }
  }
  return best;
}

/** Une décision ; à appeler à chaque pas (elle ne réfléchit que deux fois par seconde). */
export function jouerIA(p, ia) {
  if (p.phase === 'victoire' || p.phase === 'defaite') return;
  if ((ia.attente -= 1) > 0) return;
  ia.attente = 15;
  if (p.phase === 'preparation' && p.tours.length >= 2) { lancerVague(p); return; }
  if (ia.appelle && p.compte != null && p.compte < 10 && p.ennemis.length === 0) lancerVague(p);

  // Au début, il construit ; ensuite, il alterne une tour neuve et une amélioration.
  const nb = p.tours.length;
  const peutConstruire = nb < Math.min(ia.maxTours, p.carte.emplacements.length);
  const aAmeliorer = ia.ameliore ? p.tours.filter(t => t.niveau < 3).sort((a, b) => a.niveau - b.niveau || a.id - b.id)[0] : null;
  const construireMaintenant = peutConstruire && (nb < 4 || !aAmeliorer || ia.k % 2 === 0);
  if (construireMaintenant) {
    let type = ia.plan[ia.n % ia.plan.length];
    // Des volants arrivent et peu de tours visent le ciel : il en ajoute une.
    const proch = apercuVague(p, Math.max(0, p.vague - (p.ennemis.length ? 1 : 0))) || {};
    const volants = Object.entries(proch).reduce((s, [ty, n]) => s + (ENNEMIS[ty].vole ? n : 0), 0);
    const total = Object.values(proch).reduce((s, n) => s + n, 0) || 1;
    const air = p.tours.filter(t => TOURS[t.type].air).length;
    if (!TOURS[type].air && volants / total > 0.25 && air < (nb + 1) * (volants / total + 0.2)) {
      type = ia.plan.find(ty => TOURS[ty].air) || type;
    }
    if (p.or < TOURS[type].niveaux[0].cout) return;
    const emp = meilleurEmplacement(p, ia, type);
    if (emp && construire(p, emp.id, type).ok) { ia.n++; ia.k++; }
    return;
  }
  if (aAmeliorer && p.or >= coutAmelioration(aAmeliorer) && ameliorer(p, aAmeliorer.id).ok) ia.k++;
}

