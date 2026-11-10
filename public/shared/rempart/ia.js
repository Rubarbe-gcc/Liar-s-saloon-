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
      // Sur une carte à murs, seuls comptent les bouts de chemin que l'emplacement voit.
      if ((q.x - emp.x) ** 2 + (q.z - emp.z) ** 2 <= r2 && (!carte.murs || carte.voitDe(emp.x, emp.z, Math.floor(q.x) + 0.5, Math.floor(q.z) + 0.5))) n++;
    }
    return n;
  };
  for (const ch of carte.chemins) sol += compter(ch);
  for (const ch of carte.vols) air += compter(ch);
  return { sol, air };
}

const PLAN = ['rafale', 'mortier', 'givre', 'perce', 'garnison', 'rafale', 'foudre', 'braise', 'harpon', 'rayon', 'mortier', 'piegeur', 'aimant', 'perce', 'foudre', 'givre', 'harpon', 'rafale', 'braise', 'garnison', 'piegeur', 'rayon', 'mortier', 'perce', 'foudre'];

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
  return { plan: plan.length ? plan : permis, permis, maxTours, ameliore, appelle, scores, k: 0, n: 0, attente: 0 };
}

/** Les bouts de chemin qu'un Phare posé là éclairerait et qui sont encore dans le noir. */
function lumiereUtile(p, emp, portee = 3) {
  const phares = p.tours.filter(t => TOURS[t.type].soutien);
  let n = 0;
  for (const ch of p.carte.chemins) for (let d = 0; d < ch.total; d += 0.25) {
    const q = surChemin(ch, d);
    if ((q.x - emp.x) ** 2 + (q.z - emp.z) ** 2 > portee * portee) continue;
    if (phares.some(ph => (q.x - ph.x) ** 2 + (q.z - ph.z) ** 2 <= 3 * 3)) continue;
    n++;
  }
  return n;
}

function meilleurEmplacement(p, ia, type) {
  const def = TOURS[type];
  const libres = ia.scores.filter(s => !p.tours.some(t => t.emp === s.emp.id));
  let best = null, v = -1;
  for (const s of libres) {
    // Un Phare se pose là où il éclaire le chemin et le plus de tours.
    const voisines = def.soutien ? p.tours.filter(t => (t.x - s.emp.x) ** 2 + (t.z - s.emp.z) ** 2 <= 2.6 ** 2).length : 0;
    const val = def.soutien ? lumiereUtile(p, s.emp) + voisines * 4 : (def.sol ? s.sol : 0) + (def.air ? s.air * 0.8 : 0);
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

  const nb = p.tours.length;
  // Des Furtifs arrivent bientôt : un Phare par chemin, avant tout le reste.
  const bientot = [p.vague - 1, p.vague, p.vague + 1].some(i => i >= 0 && apercuVague(p, i)?.furtif);
  if (bientot && ia.permis.includes('phare') && nb < p.carte.emplacements.length && p.tours.filter(t => t.type === 'phare').length < p.carte.chemins.length) {
    if (p.or >= TOURS.phare.niveaux[0].cout) { const emp = meilleurEmplacement(p, ia, 'phare'); if (emp) construire(p, emp.id, 'phare'); }
    return;
  }
  // Au début, il construit ; ensuite, il alterne une tour neuve et une amélioration.
  const peutConstruire = nb < Math.min(ia.maxTours, p.carte.emplacements.length);
  const aAmeliorer = ia.ameliore ? p.tours.filter(t => t.niveau < 4).sort((a, b) => a.niveau - b.niveau || a.id - b.id)[0] : null;
  // Au niveau 3, il choisit une spécialisation (une sur deux, selon la tour).
  const branche = aAmeliorer && aAmeliorer.niveau === 3 ? aAmeliorer.id % 2 : null;
  const construireMaintenant = peutConstruire && (nb < 4 || !aAmeliorer || ia.k % 2 === 0);
  if (construireMaintenant) {
    let type = ia.plan[ia.n % ia.plan.length];
    // Des volants arrivent et peu de tours visent le ciel : il en ajoute une.
    // La vague en cours et la suivante : il prépare ses défenses à l'avance.
    const cur = Math.max(0, p.vague - (p.ennemis.length ? 1 : 0));
    const proch = {};
    for (const i of [cur, cur + 1]) for (const [ty, n] of Object.entries(apercuVague(p, i) || {})) proch[ty] = (proch[ty] || 0) + n;
    const volants = Object.entries(proch).reduce((s, [ty, n]) => s + (ENNEMIS[ty].vole ? n : 0), 0);
    const total = Object.values(proch).reduce((s, n) => s + n, 0) || 1;
    const air = p.tours.filter(t => TOURS[t.type].air).length;
    if (!TOURS[type].air && volants / total > 0.25 && air < (nb + 1) * (volants / total + 0.2)) {
      // Contre des volants blindés, le Harpon ; sinon la première tour qui vise le ciel.
      const blindes = Object.keys(proch).some(ty => ENNEMIS[ty].vole && ENNEMIS[ty].armure >= 3);
      type = (blindes && ia.plan.includes('harpon') ? 'harpon' : ia.plan.find(ty => TOURS[ty].air)) || type;
    }
    // Des Furtifs arrivent et aucun Phare n'est là : il en bâtit un.
    if (p.or < TOURS[type].niveaux[0].cout) return;
    const emp = meilleurEmplacement(p, ia, type);
    if (emp && construire(p, emp.id, type).ok) { ia.n++; ia.k++; }
    return;
  }
  if (aAmeliorer && p.or >= coutAmelioration(aAmeliorer, branche ?? 0) && ameliorer(p, aAmeliorer.id, branche).ok) ia.k++;
}

