/**
 * ZÉNITH — l'Ascension, une tour de huit étages à gravir en solo.
 *
 * Une seule équipe, du premier étage au dernier, qui repart en pleine forme à
 * chaque étage. Chaque étage a son thème — un élément, un rôle — et ses
 * adversaires sont plus forts, plus rusés. Après chaque victoire, on choisit
 * une récompense parmi trois : l'équipe grandit avec la tour. On a trois vies :
 * une défaite en coûte une, et l'on retente l'étage face à d'autres gardiens.
 * Au sommet attend le Souverain du Zénith.
 *
 * L'état d'une ascension est un objet JSON : on peut le ranger entre deux
 * étages et reprendre plus tard.
 *
 * Module ISO : ni DOM ni Node.
 */

import { FIGHTERS, getFighter, roleOf, ELEMENTS, budgetOf } from './fighters.js';
import { TEAM_SIZE, KI_MAX } from './battle.js';

/** Les huit étages, du bas vers le haut. */
export const ETAGES = [
  { nom: 'Le Parvis', garde: 'Les aspirants', glyphe: '🚪', niveau: 'recrue', puissance: 0.82, texte: 'Des aspirants au hasard, venus tenter leur chance.' },
  { nom: 'La Forge', garde: 'Les forgerons de Braise', glyphe: '🔥', niveau: 'recrue', puissance: 0.88, element: 'braise', texte: 'Trois combattants de Braise. Le Givre les éteint.' },
  { nom: 'Les Bassins', garde: 'Les gardiens de l’Abysse', glyphe: '🔮', niveau: 'recrue', puissance: 0.93, element: 'abysse', texte: 'Les profondeurs de l’Abysse. L’Orage les foudroie.' },
  { nom: 'La Serre', garde: 'Les jardiniers de Sylve', glyphe: '🍃', niveau: 'guerrier', puissance: 0.98, element: 'sylve', texte: 'La Sylve qui repousse sans cesse. L’Abysse la ronge.' },
  { nom: 'Le Rempart', garde: 'Les colosses du Rempart', glyphe: '🛡', niveau: 'guerrier', puissance: 1.03, role: 'colosse', texte: 'Des colosses. Il faudra du temps, ou des éléments justes.' },
  { nom: 'La Tempête', garde: 'Les enfants de l’Orage', glyphe: '⚡', niveau: 'guerrier', puissance: 1.09, element: 'orage', texte: 'L’Orage gronde. La Braise le dompte.' },
  { nom: 'Le Sanctuaire', garde: 'Les veilleurs du Givre', glyphe: '❄️', niveau: 'legende', puissance: 1.15, element: 'givre', texte: 'Le Givre ne pardonne rien. La Sylve y fleurit pourtant.' },
  { nom: 'Le Zénith', garde: 'Le Souverain du Zénith', glyphe: '👑', niveau: 'legende', puissance: 1.25, boss: true, texte: 'Le Souverain du Zénith et sa garde. Personne n’est encore redescendu.' },
];
export const NB_ETAGES = ETAGES.length;

/** Les vies : autant de défaites permises avant la fin de l'ascension. */
export const VIES = 3;

/** Les récompenses : `cible` dit s'il faut désigner un combattant. */
export const RECOMPENSES = {
  benediction: { nom: 'Bénédiction', glyphe: '✨', texte: '+8 % de dégâts et d’armure pour toute l’équipe.' },
  entrainement: { nom: 'Entraînement', glyphe: '🥊', texte: '+15 % de dégâts pour un combattant, jusqu’au sommet.', cible: true },
  blindage: { nom: 'Blindage', glyphe: '🛡', texte: '+15 % d’armure pour un combattant, jusqu’au sommet.', cible: true },
  vitalite: { nom: 'Élixir de vie', glyphe: '❤️', texte: '+12 % de vie maximum pour toute l’équipe.' },
  meditation: { nom: 'Méditation', glyphe: '🧘', texte: '+15 de ki au début de chaque combat, pour toute l’équipe.' },
  recrue: { nom: 'Nouvelle recrue', glyphe: '🤝', texte: 'Un nouveau combattant, en pleine forme, prend la place de l’un des vôtres.', cible: true },
};
const CLES = Object.keys(RECOMPENSES);

const piocher = (rng, liste) => liste[Math.floor(rng() * liste.length)];
function melanger(rng, liste) {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/** Une nouvelle ascension, avec l'équipe choisie. */
export function nouvelleAscension(team) {
  return {
    etage: 1,
    equipe: team.slice(0, TEAM_SIZE).map((id) => ({ id, pv: 1, attaque: 1, armure: 1, ki: 30 })),
    vies: VIES,
    defaites: 0,
    offre: null,
    fini: false,
    victoire: false,
    adversaires: [],
  };
}

export const etageCourant = (asc) => ETAGES[Math.min(asc.etage, NB_ETAGES) - 1];

/** L'équipe du joueur, telle que le combat la prend (voir battle.createBattle). */
export function equipeCombat(asc) {
  return asc.equipe.map((m) => ({ id: m.id, pv: m.pv, attaque: m.attaque, armure: m.armure, ki: m.ki }));
}

/** Les adversaires de l'étage : le thème choisit les combattants, la puissance les renforce. */
export function adversaire(asc, rng = Math.random) {
  const e = etageCourant(asc);
  const miens = asc.equipe.map((m) => m.id);
  let pool;
  if (e.boss) {
    // Le Souverain et sa garde : les trois combattants les plus complets du roster.
    pool = [...FIGHTERS].sort((a, b) => budgetOf(b) - budgetOf(a)).slice(0, 6);
  } else if (e.element) pool = FIGHTERS.filter((f) => f.element === e.element);
  else if (e.role) pool = FIGHTERS.filter((f) => roleOf(f).key === e.role);
  else pool = FIGHTERS;
  // On évite d'affronter ses propres combattants quand on peut.
  const autres = pool.filter((f) => !miens.includes(f.id));
  const choix = melanger(rng, autres.length >= TEAM_SIZE ? autres : pool).slice(0, TEAM_SIZE);
  const p = e.puissance;
  const renfort = 1 + (p - 1) * 0.6;
  return {
    id: 'bot',
    name: e.garde,
    niveau: e.niveau,
    team: choix.map((f) => ({ id: f.id, pv: p, attaque: renfort, armure: renfort })),
    isBot: true,
  };
}

/**
 * Après un combat. Une victoire fait monter d'un étage et propose trois
 * récompenses ; une défaite coûte une vie — et la dernière met fin à
 * l'ascension.
 */
export function apresCombat(asc, gagne, rng = Math.random) {
  if (!gagne) {
    asc.vies -= 1;
    asc.defaites += 1;
    asc.offre = null;
    if (asc.vies <= 0) asc.fini = true;
    return asc;
  }
  asc.etage += 1;
  if (asc.etage > NB_ETAGES) {
    asc.fini = true;
    asc.victoire = true;
    asc.offre = null;
    return asc;
  }
  asc.offre = tirerOffre(asc, rng);
  return asc;
}

/** Trois récompenses différentes ; la recrue arrive avec trois candidats. */
export function tirerOffre(asc, rng = Math.random) {
  const cles = melanger(rng, CLES).slice(0, 3);
  const miens = asc.equipe.map((m) => m.id);
  return cles.map((cle) => (cle === 'recrue'
    ? { cle, candidats: melanger(rng, FIGHTERS.filter((f) => !miens.includes(f.id))).slice(0, 3).map((f) => f.id) }
    : { cle }));
}

/**
 * Applique la récompense choisie. `cible` : l'index du combattant visé
 * (entraînement, blindage, recrue) ; `candidat` : le combattant recruté.
 */
export function appliquer(asc, cle, { cible = 0, candidat = null } = {}) {
  if (!asc.offre || !asc.offre.some((o) => o.cle === cle)) return { ok: false, error: 'récompense non proposée' };
  const m = asc.equipe[cible];
  if (RECOMPENSES[cle].cible && !m) return { ok: false, error: 'cible' };
  switch (cle) {
    case 'benediction':
      for (const x of asc.equipe) {
        x.attaque = +(x.attaque * 1.08).toFixed(3);
        x.armure = +(x.armure * 1.08).toFixed(3);
      }
      break;
    case 'entrainement':
      m.attaque = +(m.attaque * 1.15).toFixed(3);
      break;
    case 'blindage':
      m.armure = +(m.armure * 1.15).toFixed(3);
      break;
    case 'vitalite':
      for (const x of asc.equipe) x.pv = +(x.pv * 1.12).toFixed(3);
      break;
    case 'meditation':
      for (const x of asc.equipe) x.ki = Math.min(KI_MAX, x.ki + 15);
      break;
    case 'recrue': {
      const offre = asc.offre.find((o) => o.cle === 'recrue');
      if (!candidat || !offre.candidats.includes(candidat)) return { ok: false, error: 'candidat' };
      // La recrue hérite des galons de celui qu'elle remplace : on ne perd pas ce qu'on a gagné.
      asc.equipe[cible] = { ...m, id: candidat };
      break;
    }
    default:
      return { ok: false, error: 'récompense inconnue' };
  }
  asc.offre = null;
  return { ok: true };
}

export const elementDe = (id) => ELEMENTS[getFighter(id)?.element];
