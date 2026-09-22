/**
 * ZÉNITH — adversaires du mode hors-ligne.
 *
 * L'ordinateur ne triche pas : il ne lit que ce qu'un joueur humain voit, et
 * subit les mêmes contraintes de ki, d'altérations et d'ordre de tour. La
 * difficulté ne change pas ses ressources, seulement la qualité de son
 * raisonnement — à quel point il anticipe plutôt que de frapper au plus fort.
 */

import { FIGHTERS, getFighter, elementMultiplier } from './fighters.js';
import {
  MOVES, MOVE_KEYS, STATUS, ELEMENT_STATUS, GUARD_KI, KI_MAX,
  activeUnit, fighterOf, choose, estimateDamage, speedOf, availableCommands,
} from './battle.js';

export const LEVELS = {
  recrue: {
    key: 'recrue', label: 'Recrue',
    // Joue presque au hasard, ne garde pas, ignore les éléments.
    bruit: 0.9, garde: 0.05, change: 0.05, prevoyance: 0,
  },
  guerrier: {
    key: 'guerrier', label: 'Guerrier',
    bruit: 0.3, garde: 0.35, change: 0.55, prevoyance: 0.6,
  },
  legende: {
    key: 'legende', label: 'Légende',
    bruit: 0.02, garde: 0.6, change: 0.95, prevoyance: 1,
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS);

export function createBrain(levelKey = 'guerrier') {
  return { level: LEVELS[levelKey] ? levelKey : 'guerrier' };
}

/* ------------------------------------------------------------------ */
/* Évaluation                                                          */
/* ------------------------------------------------------------------ */

/** Valeur d'une attaque : dégâts, plus la prime d'une altération utile. */
function valeurAttaque(state, side, foe, moveKey, lvl) {
  const unit = activeUnit(side);
  const cible = activeUnit(foe);
  const af = fighterOf(unit);
  const df = fighterOf(cible);
  const m = MOVES[moveKey];

  let v = estimateDamage(af, df, moveKey);

  // Achever vaut mieux que tout : on préfère le coup le moins cher qui tue.
  if (v >= cible.hp) v += 900 - m.ki * 3;

  // L'altération ne vaut que si la cible n'en subit pas déjà une.
  if (m.applique && lvl.prevoyance > 0) {
    const cle = ELEMENT_STATUS[af.element];
    if (cle === 'seve') {
      // La sève se pose sur soi : intéressante si le combat va durer.
      if (!unit.status && unit.hp / unit.maxHp < 0.8) v += 60 * lvl.prevoyance;
    } else if (!cible.status) {
      v += 90 * lvl.prevoyance;
    }
  }

  // On évite seulement de la brûler sur une cible encore intacte : une
  // pénalité plus lourde la rendait purement décorative.
  if (m.uneFois && v < cible.hp && lvl.prevoyance > 0
      && cible.hp / cible.maxHp > 0.75 && unit.hp / unit.maxHp > 0.5) {
    v -= 70 * lvl.prevoyance;
  }

  // Sans ki, on ne pourra plus rien faire au tour suivant : la frappe, qui
  // en regagne, prend de la valeur quand la réserve est basse.
  if (moveKey === 'frappe' && unit.ki < MOVES.souffle.ki) v += 50 * lvl.prevoyance;

  return v;
}

/** Vaut-il mieux se mettre en garde ? */
function valeurGarde(state, side, foe, lvl) {
  const unit = activeUnit(side);
  const cible = activeUnit(foe);
  const af = fighterOf(unit);
  const df = fighterOf(cible);

  // On estime le pire coup que l'adversaire puisse porter ce tour-ci.
  let menace = 0;
  for (const key of MOVE_KEYS) {
    const m = MOVES[key];
    if (cible.ki < m.ki) continue;
    if (m.uneFois && cible.ultUsed) continue;
    menace = Math.max(menace, estimateDamage(df, af, key));
  }

  // Ce que la garde rapporte : les dégâts évités, plus le ki regagné.
  let v = menace * 0.5 + Math.min(GUARD_KI, KI_MAX - unit.ki) * 1.6;

  // Se garder est vital si le prochain coup peut tuer.
  if (menace >= unit.hp) v += 420;
  // Mais stérile si l'on est déjà au maximum de ki et hors de danger.
  if (unit.ki >= KI_MAX - 4 && menace < unit.hp * 0.25) v -= 200;

  return v * lvl.garde * 2;
}

/** Vaut-il mieux changer de combattant ? */
function meilleurChangement(state, side, foe, lvl) {
  const unit = activeUnit(side);
  const cible = activeUnit(foe);
  const af = fighterOf(unit);
  const df = fighterOf(cible);
  const actuel = elementMultiplier(af.element, df.element);

  let best = null;
  side.team.forEach((u, slot) => {
    if (u.ko || slot === side.active) return;
    const cf = getFighter(u.fighterId);
    const gain = elementMultiplier(cf.element, df.element);
    const subit = elementMultiplier(df.element, cf.element);

    // On ne change que pour un avantage net, et vers un combattant en état.
    let v = (gain - actuel) * 620 + (1 - subit) * 240;
    v *= u.hp / u.maxHp;
    // Changer coûte un tour : il faut que cela en vaille la peine.
    v -= 110;
    // Fuir un combattant agonisant a sa valeur propre.
    if (unit.hp / unit.maxHp < 0.2) v += 180;

    if (!best || v > best.v) best = { slot, v };
  });

  return best ? { slot: best.slot, v: best.v * lvl.change } : null;
}

/* ------------------------------------------------------------------ */
/* Décision                                                            */
/* ------------------------------------------------------------------ */

/**
 * Choisit et enregistre la commande du tour.
 * @returns {object|null} la commande retenue
 */
export function think(state, sideIndex, brain) {
  const lvl = LEVELS[brain.level] || LEVELS.guerrier;
  const side = state.sides[sideIndex];
  const foe = state.sides[1 - sideIndex];
  if (!side || side.queued) return null;

  const unit = activeUnit(side);
  if (unit.ko) return null;

  const dispo = availableCommands(state, sideIndex);
  const options = [];

  for (const m of dispo.moves) {
    if (!m.utilisable) continue;
    options.push({ cmd: { type: 'move', move: m.key }, v: valeurAttaque(state, side, foe, m.key, lvl) });
  }
  options.push({ cmd: { type: 'guard' }, v: valeurGarde(state, side, foe, lvl) });

  const chg = meilleurChangement(state, side, foe, lvl);
  if (chg && chg.v > 0) options.push({ cmd: { type: 'swap', slot: chg.slot }, v: chg.v });

  if (options.length === 0) return null;

  // Le bruit brouille le classement : un débutant se trompe de priorité.
  const echelle = Math.max(...options.map((o) => Math.abs(o.v))) || 1;
  for (const o of options) o.v += (Math.random() - 0.5) * lvl.bruit * echelle * 2;

  const choix = options.reduce((a, b) => (b.v > a.v ? b : a));
  const res = choose(state, sideIndex, choix.cmd);
  return res.ok ? choix.cmd : null;
}

/* ------------------------------------------------------------------ */
/* Adversaires                                                         */
/* ------------------------------------------------------------------ */

const NOMS = [
  'Dojo Kuroba', 'Cercle d\'Ambre', 'Les Neuf Vents', 'Meute du Nord',
  'Ordre du Zénith', 'Fils de la Cendre', 'Garde Silencieuse', 'Écoles Jumelles',
];

/** Constitue un adversaire complet : nom et équipe de trois. */
export function makeOpponent(rng = Math.random, avoid = []) {
  return {
    id: 'bot',
    name: NOMS[Math.floor(rng() * NOMS.length)],
    team: tirerEquipe(rng, avoid),
    isBot: true,
  };
}


function tirerEquipe(rng, avoid) {
  const pool = FIGHTERS.filter((f) => !avoid.includes(f.id));
  const out = [];
  const copie = [...pool];
  for (let i = 0; i < 3 && copie.length; i++) {
    out.push(copie.splice(Math.floor(rng() * copie.length), 1)[0].id);
  }
  return out;
}
