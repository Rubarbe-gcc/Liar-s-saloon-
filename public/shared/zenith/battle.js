/**
 * ZÉNITH — moteur de combat au tour par tour.
 *
 * Module ISO (aucune API navigateur ni Node) : il fait tourner aussi bien une
 * partie locale contre l'ordinateur qu'un affrontement en ligne arbitré par
 * le serveur.
 *
 * Déroulement d'un tour, dans l'esprit des jeux de rôle classiques :
 *   1. les deux camps choisissent leur commande, sans voir celle de l'autre ;
 *   2. les changements de combattant se résolvent d'abord ;
 *   3. les actions se résolvent ensuite par ordre de vitesse ;
 *   4. les altérations d'état s'appliquent en fin de tour.
 *
 * Aucun tirage ne décide de ce que l'on peut faire : toutes les commandes
 * sont disponibles en permanence, seule la réserve de ki les limite. C'est
 * ce qui distingue ce moteur de la version à cartes qui l'a précédé, où la
 * main tirée au hasard réduisait le choix à un réflexe.
 */

import { getFighter, elementMultiplier } from './fighters.js';

export const TEAM_SIZE = 3;
export const KI_MAX = 100;

/**
 * Ki regagné en fin de tour par le combattant en lice, quoi qu'il ait fait.
 *
 * Ce revenu fixe est ce qui rend le jeu tactique. Dans une version
 * antérieure, le ki ne venait que de la Frappe : dépenser réduisait ses
 * revenus futurs, si bien que marteler la commande gratuite restait toujours
 * la meilleure ligne et qu'aucun arbitrage ne se posait. Avec un revenu
 * indépendant de l'action, la question devient « quand dépenser, et pour
 * quoi » — et épargner trois tours pour une Ultime devient une vraie option.
 */
export const KI_PAR_TOUR = 14;

/** Au-delà, le combat est tranché aux points de vie restants. */
export const MAX_TURNS = 60;

export const PHASE = {
  CHOOSE: 'choose',   // en attente des commandes
  RESOLVE: 'resolve', // résolution en cours (état transitoire)
  OVER: 'over',
};

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

/**
 * Les quatre offensives, plus la garde et le changement.
 *
 * `stat` désigne la statistique employée ; `mixte` prend la moyenne de la
 * force et du souffle, de sorte qu'à investissement offensif égal les profils
 * spécialisés et polyvalents se valent.
 */
export const MOVES = {
  frappe: {
    key: 'frappe', label: 'Frappe', glyph: '👊',
    stat: 'strike', power: 1.0, ki: 0, kiGain: 5,
    blurb: 'Attaque au corps à corps. Ne coûte rien et rapporte un peu de ki.',
  },
  souffle: {
    key: 'souffle', label: 'Souffle', glyph: '💠',
    stat: 'blast', power: 1.35, ki: 18, kiGain: 0,
    blurb: 'Décharge d\'énergie, plus puissante mais coûteuse.',
  },
  speciale: {
    key: 'speciale', label: 'Spéciale', glyph: '✦',
    stat: 'mixte', power: 1.75, ki: 38, kiGain: 0, applique: true,
    blurb: 'Technique signature : inflige en plus l\'altération de son élément.',
  },
  ultime: {
    // Sa puissance doit franchement dépasser celle de la Spéciale rapportée
    // au ki dépensé, sans quoi personne n'a de raison d'épargner pour elle :
    // à 3,2 pour 72 ki, elle rendait moins que la Spéciale à 1,75 pour 38,
    // qui inflige en plus une altération. Elle n'était jamais jouée.
    key: 'ultime', label: 'Ultime', glyph: '☄️',
    stat: 'mixte', power: 4.6, ki: 72, kiGain: 0, uneFois: true,
    blurb: 'Coup décisif. Une seule fois par combattant et par combat.',
  },
};

export const MOVE_KEYS = Object.keys(MOVES);

/** Garde : on encaisse moitié moins, et l'on récupère du ki. */
export const GUARD_REDUCTION = 0.45;
export const GUARD_KI = 20;

/* ------------------------------------------------------------------ */
/* Altérations d'état                                                  */
/* ------------------------------------------------------------------ */

/**
 * Chaque élément inflige la sienne. Elles donnent au cycle élémentaire un
 * second rôle : au-delà des dégâts, choisir son combattant décide de ce que
 * l'on impose à l'adversaire.
 */
export const STATUS = {
  brulure: {
    key: 'brulure', label: 'Brûlure', glyph: '🔥', tours: 3,
    blurb: 'Perd des points de vie à chaque tour.',
  },
  paralysie: {
    key: 'paralysie', label: 'Paralysie', glyph: '⚡', tours: 3,
    blurb: 'Vitesse réduite de moitié : agit après presque tout le monde.',
  },
  gel: {
    key: 'gel', label: 'Gel', glyph: '❄️', tours: 2,
    blurb: 'Risque de perdre son tour.',
  },
  drain: {
    key: 'drain', label: 'Drain', glyph: '🔮', tours: 3,
    blurb: 'Perd du ki à chaque tour.',
  },
  seve: {
    key: 'seve', label: 'Sève', glyph: '🍃', tours: 3,
    blurb: 'Soigne celui qui l\'a posée à chacun de ses coups.',
  },
};

/** Altération infligée par la Spéciale de chaque élément. */
export const ELEMENT_STATUS = {
  braise: 'brulure',
  orage: 'paralysie',
  givre: 'gel',
  abysse: 'drain',
  sylve: 'seve',
};

const BRULURE_PART = 0.07;   // des points de vie maximum, par tour
const DRAIN_KI = 14;         // ki perdu par tour
const GEL_RISQUE = 0.35;     // probabilité de perdre son tour
const SEVE_PART = 0.3;       // soin, en part des dégâts infligés

/* ------------------------------------------------------------------ */
/* Aléa                                                                */
/* ------------------------------------------------------------------ */

export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Statistiques                                                        */
/* ------------------------------------------------------------------ */

/**
 * Résout la statistique d'une commande.
 *
 * « mixte » prend la moyenne de la force et du souffle. Ce choix n'est pas
 * cosmétique : si les techniques retenaient seulement le meilleur score, un
 * combattant tout en force frapperait plus fort au corps à corps *et*
 * lancerait d'aussi bonnes spéciales qu'un polyvalent ayant investi autant
 * de points — il n'y aurait plus de compromis.
 */
export function statOf(fighter, stat) {
  if (stat !== 'mixte') return fighter[stat];
  return (fighter.strike + fighter.blast) / 2;
}

/** Vitesse effective, paralysie comprise. Elle décide de l'ordre du tour. */
export function speedOf(unit) {
  const base = getFighter(unit.fighterId).speed;
  return unit.status && unit.status.key === 'paralysie' ? base / 2 : base;
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

function makeUnit(fighterId) {
  const f = getFighter(fighterId);
  if (!f) throw new Error(`combattant inconnu : ${fighterId}`);
  return {
    fighterId,
    hp: f.hp,
    maxHp: f.hp,
    ki: 30,
    ko: false,
    status: null,      // { key, tours, from }
    guard: false,
    ultUsed: false,
  };
}

/**
 * @param {Array<{id:string,name:string,team:string[],isBot?:boolean}>} sides
 * @param {{seed?:number}} [options]
 */
export function createBattle(sides, options = {}) {
  if (sides.length !== 2) throw new Error('un combat oppose exactement deux camps');
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);

  return {
    seed,
    rng: makeRng(seed),
    turn: 1,
    phase: PHASE.CHOOSE,
    winner: null,
    effects: [],
    log: [],
    sides: sides.map((s, i) => ({
      index: i,
      id: s.id,
      name: s.name,
      isBot: !!s.isBot,
      team: s.team.slice(0, TEAM_SIZE).map(makeUnit),
      active: 0,
      queued: null,
      stats: { coups: 0, degats: 0, subis: 0, gardes: 0, speciales: 0, ultimes: 0, kos: 0 },
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Accès                                                               */
/* ------------------------------------------------------------------ */

export const activeUnit = (side) => side.team[side.active];
export const fighterOf = (unit) => getFighter(unit.fighterId);
export const aliveCount = (side) => side.team.filter((u) => !u.ko).length;

function log(state, text) {
  state.log.push({ turn: state.turn, text });
  if (state.log.length > 80) state.log.shift();
}

function effect(state, e) {
  state.effects.push({ turn: state.turn, ...e });
}

/* ------------------------------------------------------------------ */
/* Commandes disponibles                                               */
/* ------------------------------------------------------------------ */

/**
 * Ce que le camp peut faire ce tour-ci, et pourquoi il ne peut pas le reste.
 * L'interface s'en sert directement : aucune commande n'est jamais cachée,
 * seulement désactivée avec sa raison.
 */
export function availableCommands(state, sideIndex) {
  const side = state.sides[sideIndex];
  const unit = activeUnit(side);

  const moves = MOVE_KEYS.map((key) => {
    const m = MOVES[key];
    let raison = null;
    if (m.uneFois && unit.ultUsed) raison = 'déjà utilisée';
    else if (unit.ki < m.ki) raison = 'ki insuffisant';
    return { key, ki: m.ki, utilisable: !raison, raison };
  });

  const swaps = side.team.map((u, slot) => ({
    slot,
    utilisable: !u.ko && slot !== side.active,
    raison: u.ko ? 'hors de combat' : (slot === side.active ? 'déjà en lice' : null),
  }));

  return { moves, garde: { utilisable: true }, swaps };
}

/* ------------------------------------------------------------------ */
/* Choix                                                               */
/* ------------------------------------------------------------------ */

/**
 * Enregistre la commande d'un camp. Le tour ne se résout que lorsque les deux
 * l'ont fait : ni l'un ni l'autre ne voit le choix adverse avant.
 *
 * @param {{type:'move',move:string}|{type:'guard'}|{type:'swap',slot:number}} cmd
 */
export function choose(state, sideIndex, cmd) {
  if (state.phase !== PHASE.CHOOSE) return { ok: false, error: 'phase' };
  const side = state.sides[sideIndex];
  if (!side) return { ok: false, error: 'camp inconnu' };
  if (side.queued) return { ok: false, error: 'déjà choisi' };

  const unit = activeUnit(side);
  if (unit.ko) return { ok: false, error: 'ko' };

  if (cmd.type === 'move') {
    const m = MOVES[cmd.move];
    if (!m) return { ok: false, error: 'commande inconnue' };
    if (m.uneFois && unit.ultUsed) return { ok: false, error: 'déjà utilisée' };
    if (unit.ki < m.ki) return { ok: false, error: 'ki' };
    side.queued = { type: 'move', move: cmd.move };
    return { ok: true };
  }

  if (cmd.type === 'guard') {
    side.queued = { type: 'guard' };
    return { ok: true };
  }

  if (cmd.type === 'swap') {
    const slot = cmd.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= side.team.length) {
      return { ok: false, error: 'slot' };
    }
    if (slot === side.active) return { ok: false, error: 'déjà en lice' };
    if (side.team[slot].ko) return { ok: false, error: 'ko' };
    side.queued = { type: 'swap', slot };
    return { ok: true };
  }

  return { ok: false, error: 'commande inconnue' };
}

/** Les deux camps ont-ils choisi ? */
export const pretARésoudre = (state) =>
  state.phase === PHASE.CHOOSE && state.sides.every((s) => s.queued || activeUnit(s).ko);

/* ------------------------------------------------------------------ */
/* Résolution                                                          */
/* ------------------------------------------------------------------ */

/** Dégâts attendus d'une commande, sans la part d'aléa. */
export function estimateDamage(attacker, defender, moveKey, { garde = false } = {}) {
  const m = MOVES[moveKey];
  if (!m) return 0;
  const raw = statOf(attacker, m.stat) * m.power * 2.2;
  const elem = elementMultiplier(attacker.element, defender.element);
  const mitigation = 100 / (100 + defender.armor);
  const g = garde ? GUARD_REDUCTION : 1;
  return Math.max(1, Math.round(raw * elem * mitigation * g));
}

function appliquerDegats(state, side, foe, moveKey) {
  const unit = activeUnit(side);
  const cible = activeUnit(foe);
  const af = fighterOf(unit);
  const df = fighterOf(cible);
  const m = MOVES[moveKey];

  const elem = elementMultiplier(af.element, df.element);
  const jitter = 0.95 + state.rng() * 0.1;
  const base = estimateDamage(af, df, moveKey, { garde: cible.guard });
  const montant = Math.max(1, Math.round(base * jitter));

  cible.hp = Math.max(0, cible.hp - montant);
  unit.ki = Math.min(KI_MAX, unit.ki - m.ki + m.kiGain);

  side.stats.coups += 1;
  side.stats.degats += montant;
  foe.stats.subis += montant;
  if (moveKey === 'speciale') side.stats.speciales += 1;
  if (moveKey === 'ultime') { side.stats.ultimes += 1; unit.ultUsed = true; }

  effect(state, {
    type: 'hit', side: side.index, move: moveKey, amount: montant,
    elem, garde: cible.guard, name: moveName(unit, moveKey),
  });
  log(state, `${af.name} utilise ${moveName(unit, moveKey)} — ${montant} dégâts.`
    + (elem > 1 ? ' C\'est très efficace !' : (elem < 1 ? ' Ce n\'est pas très efficace…' : '')));

  // Sève : l'attaquant se soigne d'une part des dégâts infligés.
  if (unit.status && unit.status.key === 'seve') {
    const soin = Math.round(montant * SEVE_PART);
    unit.hp = Math.min(unit.maxHp, unit.hp + soin);
    effect(state, { type: 'heal', side: side.index, amount: soin });
  }

  // La Spéciale impose l'altération de son élément.
  if (m.applique) {
    const cle = ELEMENT_STATUS[af.element];
    if (cle === 'seve') {
      unit.status = { key: 'seve', tours: STATUS.seve.tours };
      effect(state, { type: 'status', side: side.index, status: 'seve' });
      log(state, `${af.name} s'entoure de sève.`);
    } else if (cle && !cible.ko) {
      cible.status = { key: cle, tours: STATUS[cle].tours };
      effect(state, { type: 'status', side: foe.index, status: cle });
      log(state, `${df.name} subit ${STATUS[cle].label} !`);
    }
  }

  if (cible.hp === 0) mettreAuTapis(state, foe, side);
}

function mettreAuTapis(state, side, killer) {
  const unit = activeUnit(side);
  unit.ko = true;
  unit.status = null;
  killer.stats.kos += 1;
  effect(state, { type: 'ko', side: side.index, fighter: unit.fighterId });
  log(state, `${fighterOf(unit).name} est hors de combat.`);

  if (aliveCount(side) === 0) {
    state.phase = PHASE.OVER;
    state.winner = killer.index;
    effect(state, { type: 'victory', side: killer.index });
    log(state, `${killer.name} remporte le combat.`);
    return;
  }
  // Le camp doit envoyer un remplaçant : on le fait entrer immédiatement,
  // sans lui faire perdre son tour suivant.
  const suivant = side.team.findIndex((u) => !u.ko);
  side.active = suivant;
  effect(state, { type: 'enter', side: side.index, fighter: side.team[suivant].fighterId });
  log(state, `${fighterOf(side.team[suivant]).name} entre en lice.`);
}

function resoudreGarde(state, side) {
  const unit = activeUnit(side);
  unit.guard = true;
  unit.ki = Math.min(KI_MAX, unit.ki + GUARD_KI);
  side.stats.gardes += 1;
  effect(state, { type: 'guard', side: side.index });
  log(state, `${fighterOf(unit).name} se met en garde.`);
}

function resoudreChangement(state, side, slot) {
  if (side.team[slot].ko) return;
  const sortant = activeUnit(side);
  side.active = slot;
  effect(state, {
    type: 'swap', side: side.index,
    from: sortant.fighterId, to: activeUnit(side).fighterId,
  });
  log(state, `${side.name} rappelle ${fighterOf(sortant).name} et envoie ${fighterOf(activeUnit(side)).name}.`);
}

/**
 * Résout le tour complet. À n'appeler que lorsque les deux camps ont choisi.
 * @returns {{ok:boolean, effects:Array}}
 */
export function resolveTurn(state) {
  if (state.phase !== PHASE.CHOOSE) return { ok: false, effects: [] };
  if (!pretARésoudre(state)) return { ok: false, effects: [] };

  state.effects = [];
  state.phase = PHASE.RESOLVE;

  // La garde ne vaut que pour le tour en cours.
  for (const s of state.sides) activeUnit(s).guard = false;

  // 1. Les changements passent avant tout le reste : c'est ce qui permet
  //    d'anticiper un coup plutôt que de le subir.
  for (const side of state.sides) {
    if (side.queued && side.queued.type === 'swap') {
      resoudreChangement(state, side, side.queued.slot);
      side.queued = null;
    }
  }

  // 2. Les gardes s'établissent ensuite, avant les coups qu'elles amortissent.
  for (const side of state.sides) {
    if (side.queued && side.queued.type === 'guard') {
      resoudreGarde(state, side);
      side.queued = null;
    }
  }

  // 3. Les attaques, par ordre de vitesse décroissante.
  const attaquants = state.sides
    .filter((s) => s.queued && s.queued.type === 'move')
    .sort((a, b) => {
      const va = speedOf(activeUnit(a));
      const vb = speedOf(activeUnit(b));
      if (vb !== va) return vb - va;
      return state.rng() < 0.5 ? -1 : 1;   // égalité tranchée au hasard
    });

  for (const side of attaquants) {
    const cmd = side.queued;
    side.queued = null;
    if (state.phase === PHASE.OVER) break;

    const unit = activeUnit(side);
    if (unit.ko) continue;

    // Le gel peut coûter le tour.
    if (unit.status && unit.status.key === 'gel' && state.rng() < GEL_RISQUE) {
      effect(state, { type: 'frozen', side: side.index });
      log(state, `${fighterOf(unit).name} est figé et ne peut pas agir.`);
      continue;
    }

    const m = MOVES[cmd.move];
    // La situation a pu changer depuis le choix : on revérifie.
    if (!m || unit.ki < m.ki || (m.uneFois && unit.ultUsed)) continue;

    appliquerDegats(state, side, state.sides[1 - side.index], cmd.move);
  }

  // 4. Altérations de fin de tour.
  if (state.phase !== PHASE.OVER) finDeTour(state);

  // 5. Tour suivant.
  if (state.phase !== PHASE.OVER) {
    state.turn += 1;
    state.phase = PHASE.CHOOSE;
    for (const s of state.sides) s.queued = null;

    if (state.turn > MAX_TURNS) trancherAuxPoints(state);
  }

  return { ok: true, effects: state.effects };
}

function finDeTour(state) {
  // Revenu de ki, versé à tous avant les altérations.
  for (const side of state.sides) {
    const unit = activeUnit(side);
    if (!unit.ko) unit.ki = Math.min(KI_MAX, unit.ki + KI_PAR_TOUR);
  }

  for (const side of state.sides) {
    const unit = activeUnit(side);
    if (unit.ko || !unit.status) continue;
    const st = unit.status;

    if (st.key === 'brulure') {
      const perte = Math.max(1, Math.round(unit.maxHp * BRULURE_PART));
      unit.hp = Math.max(0, unit.hp - perte);
      effect(state, { type: 'status-tick', side: side.index, status: 'brulure', amount: perte });
      log(state, `${fighterOf(unit).name} souffre de sa brûlure (${perte}).`);
      if (unit.hp === 0) {
        mettreAuTapis(state, side, state.sides[1 - side.index]);
        if (state.phase === PHASE.OVER) return;
        continue;
      }
    } else if (st.key === 'drain') {
      const perte = Math.min(unit.ki, DRAIN_KI);
      unit.ki -= perte;
      effect(state, { type: 'status-tick', side: side.index, status: 'drain', amount: perte });
    }

    st.tours -= 1;
    if (st.tours <= 0) {
      effect(state, { type: 'status-end', side: side.index, status: st.key });
      log(state, `${fighterOf(unit).name} se remet de ${STATUS[st.key].label}.`);
      unit.status = null;
    }
  }
}

/** Au-delà de la limite de tours, on départage aux points de vie restants. */
function trancherAuxPoints(state) {
  const part = (s) => s.team.reduce((a, u) => a + u.hp / u.maxHp, 0);
  const a = part(state.sides[0]), b = part(state.sides[1]);
  state.phase = PHASE.OVER;
  state.winner = a === b ? null : (a > b ? 0 : 1);
  effect(state, { type: 'timeout', winner: state.winner });
  log(state, 'Le combat s\'achève sur la limite de tours.');
}

/** Nom affiché d'une commande : les techniques portent celui du combattant. */
export function moveName(unit, moveKey) {
  const f = fighterOf(unit);
  if (moveKey === 'speciale') return f.special.name;
  if (moveKey === 'ultime') return f.ultimate.name;
  return MOVES[moveKey].label;
}

/** Abandon ou déconnexion : la victoire revient à celui qui reste. */
export function forfeit(state, sideIndex) {
  if (state.phase === PHASE.OVER) return [];
  state.effects = [];
  for (const u of state.sides[sideIndex].team) { u.ko = true; u.hp = 0; }
  state.phase = PHASE.OVER;
  state.winner = 1 - sideIndex;
  effect(state, { type: 'forfeit', side: sideIndex });
  log(state, `${state.sides[sideIndex].name} abandonne.`);
  return state.effects;
}

/* ------------------------------------------------------------------ */
/* Vue client                                                          */
/* ------------------------------------------------------------------ */

/**
 * Projette l'état pour un camp. Tout est public dans un combat au tour par
 * tour, à une exception près : la commande déjà choisie par l'adversaire,
 * qui ruinerait l'anticipation.
 */
export function viewFor(state, viewerId) {
  const me = state.sides.findIndex((s) => s.id === viewerId);
  const mine = me < 0 ? 0 : me;

  return {
    turn: state.turn,
    phase: state.phase,
    winner: state.winner,
    viewerSide: mine,
    maxTurns: MAX_TURNS,
    sides: state.sides.map((s, i) => ({
      index: i,
      id: s.id,
      name: s.name,
      isBot: s.isBot,
      active: s.active,
      // On indique qu'un choix est fait, jamais lequel.
      aChoisi: !!s.queued,
      stats: s.stats,
      team: s.team.map((u) => ({
        fighterId: u.fighterId,
        hp: u.hp,
        maxHp: u.maxHp,
        ki: Math.round(u.ki),
        ko: u.ko,
        guard: u.guard,
        ultUsed: u.ultUsed,
        status: u.status ? { key: u.status.key, tours: u.status.tours } : null,
        vitesse: u.ko ? 0 : Math.round(speedOf(u)),
      })),
    })),
    commandes: availableCommands(state, mine),
    log: state.log.slice(-6),
  };
}
