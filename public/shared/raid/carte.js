/**
 * RAID — la carte de chaque acte, et ce qu'on y rencontre.
 *
 * Chaque acte est une carte à chemins : sept étapes à gravir, trois ou quatre
 * routes qui se croisent, et le boss au sommet. À chaque étape, le joueur
 * choisit sa prochaine salle parmi celles que son chemin relie : un combat
 * pour l'expérience, un feu de camp pour souffler, un marchand, un coffre,
 * une rencontre… Le chemin est la première décision du jeu de rôle.
 *
 * Module ISO : ni DOM ni Node.
 */

import { CYCLE } from './ecoles.js';
import { MODELES, MODELES_PAR_ID, BOSS_FINAL, parRang } from './ennemis.js';
import { entier, piocher, melanger } from '../hasard.js';

export const ACTES = [
  { nom: 'Les Galeries Noyées', ecole: 'nature', texte: 'L’eau monte, et quelque chose nage dedans.' },
  { nom: 'Le Cloître Profané', ecole: 'ombre', texte: 'On y priait. On y prie encore, mais pas la même chose.' },
  { nom: 'La Forge Ardente', ecole: 'feu', texte: 'Les soufflets tournent, et personne ne les tient.' },
  { nom: 'Le Sanctuaire Gelé', ecole: 'givre', texte: 'Tout y est intact. Tout y est figé.' },
  { nom: 'Le Pic de l’Aube', ecole: 'sacre', texte: 'Au sommet, le Dragon Cendré attend son heure.' },
];

export const RANGEES = 7;
export const COLONNES = 4;

export const TYPES = {
  combat: { nom: 'Combat', glyphe: '⚔', texte: 'Des monstres. De l’expérience et de l’or.' },
  elite: { nom: 'Élite', glyphe: '💀', texte: 'Un adversaire redoutable, et un butin assuré.' },
  evenement: { nom: 'Inconnu', glyphe: '❓', texte: 'Le donjon vous pose une question.' },
  marchand: { nom: 'Marchand', glyphe: '💰', texte: 'Potions et équipement, contre de l’or.' },
  repos: { nom: 'Feu de camp', glyphe: '🔥', texte: 'Souffler, s’entraîner. La partie y est sauvegardée.' },
  tresor: { nom: 'Trésor', glyphe: '📦', texte: 'Un coffre, et ce qu’il contient.' },
  compagnon: { nom: 'Rencontre', glyphe: '🤝', texte: 'Un aventurier qui pourrait se joindre à vous.' },
  boss: { nom: 'Boss', glyphe: '👑', texte: 'Le maître de l’acte.' },
};

/**
 * Tire le type d'une salle. Les élites ne gardent pas l'entrée, le marchand
 * n'attend pas au pied de la carte, et les rencontres se font surtout tôt —
 * un groupe se construit au début d'une aventure.
 */
function tirerType(rng, rangee, acte) {
  if (rangee === 0) return 'combat';
  if (rangee === RANGEES - 1) return 'repos';
  const poids = {
    combat: 40,
    evenement: 22,
    elite: rangee >= 2 ? 11 : 0,
    marchand: rangee >= 2 ? 8 : 0,
    tresor: rangee >= 1 ? 7 : 0,
    compagnon: acte <= 3 ? 9 : 3,
    repos: rangee >= 3 ? 5 : 0,
  };
  let x = rng() * Object.values(poids).reduce((s, p) => s + p, 0);
  for (const [t, p] of Object.entries(poids)) { x -= p; if (x < 0) return t; }
  return 'combat';
}

/**
 * Génère la carte d'un acte : quelques chemins qui montent d'une rangée à
 * l'autre, en décalant d'au plus une colonne, et qui se rejoignent parfois.
 */
export function genererCarte(rng, acte = 1) {
  const noeuds = new Map();
  const cle = (r, c) => `${r}-${c}`;
  const chemins = 3 + (rng() < 0.5 ? 1 : 0);
  const departs = melanger([0, 1, 2, 3], rng);

  for (let p = 0; p < chemins; p++) {
    let col = departs[p % COLONNES];
    for (let r = 0; r < RANGEES; r++) {
      const id = cle(r, col);
      if (!noeuds.has(id)) noeuds.set(id, { id, rangee: r, col, type: null, suivants: [] });
      if (r === RANGEES - 1) {
        if (!noeuds.get(id).suivants.includes('boss')) noeuds.get(id).suivants.push('boss');
        break;
      }
      const suivant = Math.max(0, Math.min(COLONNES - 1, col + entier(rng, 3) - 1));
      const idS = cle(r + 1, suivant);
      if (!noeuds.get(id).suivants.includes(idS)) noeuds.get(id).suivants.push(idS);
      col = suivant;
    }
  }

  for (const n of noeuds.values()) n.type = tirerType(rng, n.rangee, acte);

  // Au premier acte, on croise toujours un compagnon possible : un héros seul
  // doit pouvoir se trouver des alliés.
  if (acte === 1) {
    const candidats = [...noeuds.values()].filter((n) => n.rangee === 1 || n.rangee === 2);
    if (candidats.length && !candidats.some((n) => n.type === 'compagnon')) {
      piocher(candidats, rng).type = 'compagnon';
    }
  }

  // Chaque acte a au moins un marchand : l'or doit pouvoir se dépenser.
  const milieu = [...noeuds.values()].filter((n) => n.rangee >= 2 && n.rangee <= RANGEES - 2);
  if (!milieu.some((n) => n.type === 'marchand')) {
    const libres = milieu.filter((n) => n.type !== 'compagnon');
    if (libres.length) piocher(libres, rng).type = 'marchand';
  }

  noeuds.set('boss', { id: 'boss', rangee: RANGEES, col: 1.5, type: 'boss', suivants: [] });
  return { acte, noeuds: [...noeuds.values()] };
}

export const noeud = (carte, id) => carte.noeuds.find((n) => n.id === id) || null;

/** Les salles qu'on peut atteindre depuis la position courante. */
export function accessibles(carte, position) {
  if (!position) return carte.noeuds.filter((n) => n.rangee === 0);
  const ici = noeud(carte, position);
  return ici ? ici.suivants.map((id) => noeud(carte, id)).filter(Boolean) : [];
}

/* ------------------------------------------------------------------ */
/* Ennemis à l'échelle du jeu de rôle                                  */
/* ------------------------------------------------------------------ */

/** Croissance par acte : la vie monte plus vite que les coups. */
export const CROISSANCE = { pv: 1.05, atk: 0.78, def: 0.45 };

/**
 * Un ennemi jouable, tiré d'un modèle du bestiaire. Les fiches du bestiaire
 * étaient réglées pour un raid de six héros : on les ramène à l'échelle d'un
 * groupe de quatre, puis on les étire selon l'acte.
 */
export function ennemiRpg(modele, acte, ecole, rng, { rang = modele.rang, boss = false, echelle = ECHELLE[4] } = {}) {
  const k = (part) => 1 + part * (acte - 1) + 0.15 * Math.max(0, acte - 3) ** 2;
  const grain = 0.94 + rng() * 0.12;
  const renfort = boss && modele.rang !== 'boss' ? (acte === 1 ? 1.35 : 1.7) : 1;
  const pv = Math.round((modele.pv / 640) * k(CROISSANCE.pv) * grain * renfort * echelle.pv);
  return {
    modeleId: modele.id,
    nom: modele.nom,
    silhouette: modele.silhouette,
    rang: boss ? 'boss' : rang,
    ecole,
    pvMax: pv,
    pv,
    atk: Math.round((modele.atk / 320) * k(CROISSANCE.atk) * grain * (boss ? 1.15 : 1) * echelle.atk),
    def: Math.round((modele.def / 400) * k(CROISSANCE.def) * grain),
    vit: 4 + entier(rng, 3),
    traits: [...modele.traits],
    charge: {
      nom: modele.charge.nom,
      tours: Math.max(3, modele.charge.tours),
      reste: Math.max(3, modele.charge.tours),
      mult: modele.charge.mult * 0.85,
      zone: rang !== 'trash' || boss,
    },
    enrage: false,
    entrave: null,
    brasier: null,
  };
}

/**
 * Les rencontres se règlent sur la taille du groupe : un héros seul affronte
 * des monstres moins coriaces, et moins nombreux, qu'une troupe de quatre.
 */
export const ECHELLE = {
  1: { pv: 0.56, atk: 0.8 },
  2: { pv: 0.72, atk: 0.8 },
  3: { pv: 0.87, atk: 0.9 },
  4: { pv: 1, atk: 1 },
};

/** Compose la rencontre d'une salle, pour un groupe de `taille` personnages. */
export function composer(rng, acte, type, { vus = [], taille = 4 } = {}) {
  const act = ACTES[acte - 1];
  const echelle = ECHELLE[Math.max(1, Math.min(4, taille))];
  const ecole = () => (rng() < 0.55 ? act.ecole : CYCLE[entier(rng, CYCLE.length)]);
  const tirer = (rang) => {
    const tous = parRang(rang).filter((m) => m.id !== BOSS_FINAL);
    const pool = tous.filter((m) => !vus.includes(m.id));
    const l = pool.length ? pool : tous;
    return l[entier(rng, l.length)];
  };
  const creer = (m, o = {}) => ennemiRpg(m, acte, o.ecole || ecole(), rng, { echelle, ...o });

  if (type === 'boss') {
    const modele = acte === ACTES.length ? MODELES_PAR_ID[BOSS_FINAL]
      : acte >= 3 ? tirer('boss') : tirer('elite');
    const b = creer(modele, { ecole: modele.id === BOSS_FINAL ? 'feu' : act.ecole, boss: true });
    const escorte = acte >= 2 && taille >= 2 && modele.id !== BOSS_FINAL ? [creer(tirer('trash'))] : [];
    return [b, ...escorte];
  }
  if (type === 'elite') return [creer(tirer('elite'))];

  // Une meute : de un à trois monstres, selon l'acte et la taille du groupe.
  let n = 1 + (rng() < 0.3 + 0.15 * taille ? 1 : 0) + (acte >= 3 && taille >= 3 && rng() < 0.4 ? 1 : 0);
  if (taille === 1 && acte === 1) n = 1;
  const out = [];
  for (let i = 0; i < Math.min(3, n); i++) out.push(creer(tirer('trash')));
  return out;
}

export { MODELES };
