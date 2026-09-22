/**
 * ZÉNITH — adversaires du mode hors-ligne.
 *
 * L'ordinateur ne triche pas : il ne lit que ce qu'un joueur humain voit,
 * et subit les mêmes contraintes de ki, de recharge et d'immobilisation.
 * La difficulté ne change pas ses ressources, seulement la qualité de ses
 * décisions et son temps de réaction.
 */

import {
  CARD_KINDS, elementMultiplier, getFighter, randomTeam,
} from './fighters.js';
import {
  activeUnit, fighterOf, queueAction, statOf, VANISH_COST, KI_MAX, TEAM_SIZE,
} from './battle.js';

export const LEVELS = {
  recrue: {
    key: 'recrue', label: 'Recrue',
    reaction: 9,      // ticks entre deux décisions
    skill: 0.35,      // qualité du choix de carte
    vanish: 0.15,     // propension à esquiver au bon moment
    swap: 0.2,        // sens du changement élémentaire
  },
  guerrier: {
    key: 'guerrier', label: 'Guerrier',
    reaction: 5, skill: 0.7, vanish: 0.45, swap: 0.55,
  },
  legende: {
    key: 'legende', label: 'Légende',
    reaction: 2, skill: 1, vanish: 0.8, swap: 0.85,
  },
};

export const LEVEL_KEYS = Object.keys(LEVELS);

/** Mémoire propre à chaque bot, hors de l'état de combat. */
export function createBrain(levelKey = 'guerrier') {
  return {
    level: LEVELS[levelKey] ? levelKey : 'guerrier',
    nextThink: 0,
  };
}

/**
 * Décide, et pousse l'action dans le moteur. Retourne l'action jouée, ou
 * null si le bot temporise.
 */
export function think(state, sideIndex, brain) {
  const lvl = LEVELS[brain.level];
  if (state.tick < brain.nextThink) return null;

  const side = state.sides[sideIndex];
  const foe = state.sides[1 - sideIndex];
  const unit = activeUnit(side);
  if (unit.ko || unit.stun > 0 || side.koPause > 0) return null;

  brain.nextThink = state.tick + lvl.reaction;

  const me = fighterOf(unit);
  const them = fighterOf(activeUnit(foe));
  const foeUnit = activeUnit(foe);

  // Les niveaux ne réfléchissent pas à la même cadence. Sans compensation,
  // un bot rapide tirerait ses dés bien plus souvent et gaspillerait son ki
  // en esquives — c'est ce qui rendait « Légende » plus faible que
  // « Guerrier ». On ramène donc les probabilités à un taux par seconde.
  const rate = lvl.reaction / 5;

  // 1. Esquiver, mais seulement face à une menace réelle : l'adversaire
  //    libre d'agir et capable de payer une carte.
  const foeCanHit = foeUnit.stun === 0 && foe.koPause === 0
    && foe.hand.some((k) => foe.ki >= CARD_KINDS[k].ki);
  const hurt = unit.hp / unit.maxHp < 0.45;
  const alreadySafe = state.tick < unit.vanishUntil;

  if (!alreadySafe && side.ki >= VANISH_COST + 15) {
    // Un bot habile esquive quand il le faut ; un bot faible esquive à vide.
    const want = foeCanHit
      ? lvl.vanish * (hurt ? 0.5 : 0.3)
      : (1 - lvl.skill) * 0.06;
    if (Math.random() < want * rate) {
      const res = queueAction(state, sideIndex, { type: 'vanish' });
      if (res.ok) return { type: 'vanish' };
    }
  }

  // 2. Changer de combattant si le nôtre subit le désavantage élémentaire
  //    et qu'un coéquipier ferait nettement mieux. Le changement vide la
  //    main : il ne se décide pas à la légère.
  if (side.swapCd === 0 && Math.random() < lvl.swap * rate) {
    const current = elementMultiplier(me.element, them.element);
    if (current < 1 || unit.hp / unit.maxHp < 0.25) {
      let best = -1, bestScore = current;
      side.team.forEach((u, i) => {
        if (u.ko || i === side.active) return;
        const score = elementMultiplier(getFighter(u.fighterId).element, them.element)
          * (u.hp / u.maxHp);
        if (score > bestScore * 1.15) { bestScore = score; best = i; }
      });
      if (best >= 0) {
        const res = queueAction(state, sideIndex, { type: 'swap', slot: best });
        if (res.ok) return { type: 'swap', slot: best };
      }
    }
  }

  // 3. Sinon, jouer la meilleure carte abordable.
  const playable = side.hand
    .map((key, index) => ({ key, index, card: CARD_KINDS[key] }))
    .filter((c) => side.ki >= c.card.ki && !(c.key === 'ultime' && unit.ultUsed));

  if (playable.length === 0) return null;

  let choice;
  if (Math.random() > lvl.skill) {
    // Un bot faible joue au hasard parmi ce qu'il peut se permettre.
    choice = playable[Math.floor(Math.random() * playable.length)];
  } else {
    // Un bot avisé maximise les dégâts, mais garde du ki pour esquiver
    // quand il est en danger.
    const reserve = hurt ? VANISH_COST : 0;
    const affordable = playable.filter((c) => side.ki - c.card.ki >= reserve);
    const pool = affordable.length ? affordable : playable;
    choice = pool.reduce((a, b) => {
      const va = a.card.power * statOf(me, a.card.stat);
      const vb = b.card.power * statOf(me, b.card.stat);
      return vb > va ? b : a;
    });
  }

  const res = queueAction(state, sideIndex, { type: 'play', index: choice.index });
  return res.ok ? { type: 'play', index: choice.index, card: choice.key } : null;
}

const BOT_NAMES = [
  'Dojo Kuroba', 'Cercle d\'Ambre', 'Les Neuf Vents', 'Meute du Nord',
  'Ordre du Zénith', 'Fils de la Cendre', 'Garde Silencieuse', 'Écoles Jumelles',
];

/** Constitue un adversaire complet : nom et équipe de trois. */
export function makeOpponent(rng = Math.random, avoid = []) {
  const pool = randomTeam(TEAM_SIZE + 2, rng).filter((id) => !avoid.includes(id));
  return {
    id: 'bot',
    name: BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)],
    team: pool.slice(0, TEAM_SIZE),
    isBot: true,
  };
}
