/**
 * CROCHET — l'ordinateur : ce que fait un boxeur qu'aucun humain ne dirige.
 *
 * Il garde la distance de son style (le cogneur colle, le mobile tourne au
 * large), lit les coups de l'autre (il voit le bras partir, plus ou moins vite
 * selon le niveau) et y répond : garde dans la bonne zone, esquive, ou coup
 * plus rapide en contre. Il punit celui qui frappe dans le vide, frappe quand il
 * est à portée (le jab de loin, crochet et uppercut de près), et recule pour
 * souffler quand il est à bout.
 *
 * Au combat libre, il plonge parfois sur les jambes (plus volontiers sur un adversaire qui frappe
 * ou qui fatigue), contre les plongeons (garde basse, esquive, ou un coup qui l'arrête), et au sol,
 * il frappe, tente une prise ou tape pour s'en sortir, à la vitesse de son niveau.
 *
 * Module partagé, sans DOM ; déterministe (le hasard vient du combat).
 */

import { COUPS, RING, ENDU_MAX, SANTE_MAX, AMENEE, hasard, clamp, dist } from './terrain.js';
import { STYLES } from './boxeurs.js';

/**
 * Les niveaux : ses réflexes (reaction : les images avant de voir un coup partir), sa lecture
 * de la zone visée (lecture), sa défense (garde, esquive : ×), son envie de frapper (envie : ×),
 * et ce que le moteur lui applique : la force de ses coups (puissance : ×) et sa vitesse (vitesse : ×).
 */
export const NIVEAUX = [
  { nom: 'Facile', reaction: 13, lecture: 0.45, garde: 0.45, esquive: 0.35, envie: 0.65, puissance: 0.8, vitesse: 0.9, tape: 13 },
  { nom: 'Normal', reaction: 7, lecture: 0.8, garde: 1, esquive: 1, envie: 1, puissance: 1, vitesse: 1, tape: 8 },
  { nom: 'Difficile', reaction: 3, lecture: 0.95, garde: 1.3, esquive: 1.4, envie: 1.15, puissance: 1.12, vitesse: 1.06, tape: 6 },
];
export const niveauDe = (coin) => NIVEAUX[coin.ctrl === 'ia' ? coin.niveau : 1];

const RIEN = { mx: 0, my: 0, coup: null, corps: false, garde: null, esquive: false };

/** Ce que fait le boxeur e (une consigne : { mx, my, coup, corps, garde, esquive }). */
export function decider(m, e) {
  const p = m.boxeurs[e], o = m.boxeurs[1 - e];
  const st = STYLES[m.coins[e].style], niv = niveauDe(m.coins[e]);
  if (p.sonne > 0 || p.sol) return RIEN;
  const d = dist(p.x, p.y, o.x, o.y);
  const c = { mx: 0, my: 0, coup: null, corps: false, garde: null, esquive: false };
  const fatigue = p.endu < 25;
  // L'autre ne frappe plus depuis cinq secondes (un sac, un boxeur qui se cache) : on y va.
  const passif = m.f - o.dernierCoup > 300;

  // L'autre plonge sur nos jambes : on le voit (ou pas), et on le contre une fois.
  if (o.amenee > 0 && o.amenee >= niv.reaction * 0.8 && p.luA !== m.f - o.amenee) {
    p.luA = m.f - o.amenee;
    const r = hasard(m);
    const pEsq = st.esquive * niv.esquive * 0.4, pBas = st.garde * niv.garde * 0.75, pCoup = st.contre * 0.4 * niv.envie;
    p.reponseA = !p.coup && p.esqRepos <= 0 && r < pEsq ? 'esquive' : r < pEsq + pBas ? 'basse' : !p.coup && !m.coins[e].sparring && r < pEsq + pBas + pCoup ? 'coup' : null;
  }
  if (o.amenee > 0 && p.luA === m.f - o.amenee && p.reponseA) {
    if (p.reponseA === 'esquive') { p.reponseA = null; return { ...c, mx: -p.dx, my: -p.dy, esquive: true }; }
    if (p.reponseA === 'coup') { p.reponseA = null; return { ...c, coup: d < COUPS.upper.portee ? 'upper' : 'jab' }; }
    return { ...c, garde: 'basse' };
  }

  // Le coup de l'autre part : on le voit (plus ou moins vite), et on y répond une fois.
  const oc = o.coup;
  if (oc && oc.t <= COUPS[oc.type].armer && d < COUPS[oc.type].portee + 0.25) {
    if (oc.t >= niv.reaction && p.lu !== oc.num) {
      p.lu = oc.num;
      const r = hasard(m);
      const pEsq = st.esquive * niv.esquive * 0.55, pGarde = st.garde * niv.garde * 1.05;
      if (!p.coup && p.esqRepos <= 0 && r < pEsq && p.endu > 10) p.reponse = 'esquive';
      else if (r < pEsq + pGarde) p.reponse = hasard(m) < niv.lecture ? (oc.corps ? 'basse' : 'haute') : (oc.corps ? 'haute' : 'basse');
      // Un jab part plus vite que son coup : le contre.
      else if (!m.coins[e].sparring && !p.coup && COUPS.jab.armer < COUPS[oc.type].armer - oc.t && d < COUPS.jab.portee && hasard(m) < st.contre * 0.5) p.reponse = 'jab';
      else p.reponse = null;
    }
    if (p.lu === oc.num && p.reponse) {
      if (p.reponse === 'esquive') { const s = hasard(m) < 0.5 ? 1 : -1; return { ...c, mx: -p.dy * s - p.dx * 0.4, my: p.dx * s - p.dy * 0.4, esquive: true }; }
      if (p.reponse === 'jab') { p.reponse = null; return { ...c, coup: 'jab' }; }
      return { ...c, garde: p.reponse };
    }
  }
  if (p.coup) return RIEN;
  // Le sparring (l'entraînement) : il se défend, il tourne, mais il ne frappe jamais.
  const sparring = !!m.coins[e].sparring;

  // L'autre a frappé dans le vide : on le punit.
  if (!sparring && o.ouvert > 0 && p.puni !== o.ouvertN && d < COUPS.crochet.portee && (p.puni = o.ouvertN) && hasard(m) < st.contre * 0.6 * niv.envie) {
    return { ...c, coup: d < COUPS.upper.portee && hasard(m) < 0.5 ? 'upper' : 'crochet', corps: hasard(m) < st.corps * 0.5 };
  }

  // Frapper : à portée, de temps en temps (moins quand on est à bout).
  if (p.dec > 0) p.dec -= 1;
  else if (!sparring) {
    p.dec = 10 + Math.floor(hasard(m) * 26);
    const envie = st.envie * niv.envie * (fatigue ? 0.35 : 1) * (o.sonne > 0 || o.etourdi > 0 ? 1.6 : 1) * (passif ? 1.7 : 1);
    // Au combat libre : parfois, on plonge sur les jambes (plus volontiers sur un adversaire à bout ou sonné).
    if (m.regles === 'libre' && d < AMENEE.portee && p.endu > 25 && hasard(m) < (0.022 + (o.endu < 30 ? 0.04 : 0) + (o.etourdi > 0 ? 0.08 : 0)) * niv.envie) return { ...c, amenee: true };
    if (hasard(m) < envie * 0.4) {
      const types = ['jab', 'crochet', 'upper'].filter((t) => d < COUPS[t].portee - 0.04);
      if (types.length) {
        let total = 0;
        for (const t of types) total += st[t];
        let r = hasard(m) * total, choix = types[0];
        for (const t of types) { r -= st[t]; if (r <= 0) { choix = t; break; } }
        return { ...c, coup: choix, corps: choix !== 'jab' && hasard(m) < st.corps };
      }
    }
  }

  // Se placer : la distance du style (plus loin quand on souffle), en tournant un peu.
  const voulu = (passif ? Math.min(st.distance, 1.05) : st.distance) + (fatigue ? 0.45 : 0);
  const avance = clamp((d - voulu) * 2.2, -1, 1);
  if (hasard(m) < 0.006) p.tour = -p.tour;
  const tourne = st.tourne * 0.7 * p.tour;
  let mx = p.dx * avance - p.dy * tourne, my = p.dy * avance + p.dx * tourne;
  // Pas dans les cordes : on revient vers le centre.
  const bord = Math.max(Math.abs(p.x), Math.abs(p.y));
  if (bord > RING - 0.8) { mx -= p.x * 0.35; my -= p.y * 0.35; }
  const l = Math.sqrt(mx * mx + my * my);
  if (l > 1) { mx /= l; my /= l; }
  c.mx = mx; c.my = my;
  // La garde, quand l'autre est près et qu'on ne frappe pas.
  if (d < 1.45) {
    // Elle tient un moment (puis on la lâche un moment) : pas un clignotement.
    if (p.gardeT > 0) p.gardeT -= 1;
    else if (p.gardeT < 0) p.gardeT += 1;
    else {
      const n = 10 + Math.floor(hasard(m) * 30);
      if (hasard(m) < st.garde * niv.garde * 0.8 + (fatigue ? 0.3 : 0)) { p.gardeT = n; p.gardeZ = hasard(m) < 0.75 ? 'haute' : 'basse'; } else p.gardeT = -n;
    }
    if (p.gardeT > 0) c.garde = p.gardeZ;
  }
  return c;
}

/**
 * Au sol : { tape, coup, prise, releve, garde }. Il tape à la vitesse de son niveau ; au-dessus, il frappe
 * ou tente une prise (plus volontiers sur un adversaire à bout de souffle) ; en dessous, il se protège et se dégage.
 */
export function deciderSol(m, e) {
  const S = m.sol, p = m.boxeurs[e], o = m.boxeurs[1 - e], niv = niveauDe(m.coins[e]);
  let tape = false;
  if (p.tapeT > 0) p.tapeT -= 1;
  else { tape = true; p.tapeT = niv.tape + Math.floor(hasard(m) * 4); }
  if (S.prise) return { tape };
  if (S.dessus !== e) return { tape: tape && hasard(m) < 0.8, garde: S.recharge < 10 || hasard(m) < 0.3 };
  if (S.dec > 0) { S.dec -= 1; return {}; }
  S.dec = 20 + Math.floor(hasard(m) * 30 / niv.envie);
  if (m.coins[e].sparring) return { releve: hasard(m) < 0.2 };
  const fatigue = 1 - o.endu / ENDU_MAX, blesse = 1 - o.sante / SANTE_MAX;
  if (hasard(m) < 0.18 + fatigue * 0.3 + blesse * 0.15) {
    const r = hasard(m);
    return { prise: r < 0.4 ? 'bras' : r < 0.75 ? 'gorge' : 'cheville' };
  }
  if (p.endu < 12 && hasard(m) < 0.3) return { releve: true };
  return { coup: true };
}
