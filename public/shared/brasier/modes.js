/**
 * BRASIER — les parties spéciales : QUÊTE et ANOMALIE.
 *
 * Module ISO, de pures données et quelques tirages. Une partie est TOUJOURS
 * d'un seul genre — classique, quête ou anomalie, jamais deux à la fois :
 *
 *   · QUÊTE — au tour 3, chacun choisit une quête parmi trois. Chaque offre
 *     propose les trois sortes de récompense : un serviteur exclusif (qu'on
 *     ne trouve jamais en taverne), des cartes spéciales (des sorts à lancer
 *     quand on veut), ou de l'or ;
 *   · ANOMALIE — une ou deux règles spéciales s'ajoutent à la partie, pour
 *     toute la table, annoncées dès le choix des héros.
 *
 * Le moteur (partie.js) applique ; ce module décrit et tire au sort.
 */

import { entier, melanger, piocher } from '../hasard.js';
import { getServiteur } from './serviteurs.js';

/** Les genres de partie, et leur chance d'être tirés. Le reste est classique. */
export const MODES = {
  classique: { key: 'classique', label: 'Classique', glyph: '🔥' },
  quete: { key: 'quete', label: 'Quête', glyph: '📜' },
  anomalie: { key: 'anomalie', label: 'Anomalie', glyph: '🌀' },
};
export const CHANCE_QUETE = 0.2;
export const CHANCE_ANOMALIE = 0.2;

/** Le tour où les quêtes sont offertes. */
export const TOUR_QUETE = 3;

/** Un genre de partie, tiré au sort : 20 % quête, 20 % anomalie, sinon classique. */
export function tirerMode(rng) {
  const x = rng();
  if (x < CHANCE_QUETE) return 'quete';
  if (x < CHANCE_QUETE + CHANCE_ANOMALIE) return 'anomalie';
  return 'classique';
}

/* ------------------------------------------------------------------ */
/* Les quêtes                                                          */
/* ------------------------------------------------------------------ */

/**
 * `cle` : ce qui fait avancer la quête.
 *   achat, vente, rafraichir, ameliorer, cri (poser un serviteur à Cri),
 *   triple, victoire (combat gagné), or (pièces dépensées) ;
 *   tribu — un état : le plus grand nombre de serviteurs d'une même tribu
 *   présents en même temps sur le plateau.
 */
export const QUETES = [
  { id: 'marchand', nom: 'Le marchand', glyph: '🛒', cle: 'achat', n: 9, texte: 'Achetez 9 serviteurs.' },
  { id: 'brocanteur', nom: 'Le brocanteur', glyph: '♻️', cle: 'vente', n: 5, texte: 'Vendez 5 serviteurs.' },
  { id: 'fouineur', nom: 'Le fouineur', glyph: '🔍', cle: 'rafraichir', n: 6, texte: 'Rafraîchissez la taverne 6 fois.' },
  { id: 'conquerant', nom: 'Le conquérant', glyph: '⚔️', cle: 'victoire', n: 4, texte: 'Remportez 4 combats.' },
  { id: 'orfevre', nom: 'L’orfèvre', glyph: '💎', cle: 'triple', n: 2, texte: 'Réussissez 2 triples.' },
  { id: 'batisseur', nom: 'Le bâtisseur', glyph: '🏰', cle: 'ameliorer', n: 3, texte: 'Montez la taverne de 3 rangs.' },
  { id: 'herault', nom: 'Le héraut', glyph: '📯', cle: 'cri', n: 5, texte: 'Posez 5 serviteurs à Cri.' },
  { id: 'depensier', nom: 'Le dépensier', glyph: '💸', cle: 'or', n: 35, texte: 'Dépensez 35 pièces d’or.' },
  { id: 'chef-clan', nom: 'Le chef de clan', glyph: '🏳️', cle: 'tribu', n: 4,
    texte: 'Ayez 4 serviteurs d’une même tribu sur votre plateau.' },
];

const QUETE_PAR_ID = new Map(QUETES.map((q) => [q.id, q]));
export const getQuete = (id) => QUETE_PAR_ID.get(id) || null;

/** Les serviteurs qu'on ne gagne qu'en quête (définis dans serviteurs.js, marqués `exclusif`). */
export const EXCLUSIFS = ['phenix-azur', 'kraken-abyssal', 'golem-runique', 'coeur-tempete', 'reine-meute'];

/** Les cartes spéciales : des sorts, gardés à part, qu'on lance quand on veut, gratuitement. */
export const SORTS = [
  { id: 'benediction', nom: 'Bénédiction', glyph: '🙏', plateau: true, texte: 'Vos serviteurs gagnent +2/+2.' },
  { id: 'pluie-or', nom: 'Pluie d’or', glyph: '💰', texte: 'Gagnez 4 pièces d’or tout de suite.' },
  { id: 'dorure', nom: 'Dorure', glyph: '🌟', plateau: true,
    texte: 'Double l’attaque et les PV de votre serviteur le plus à gauche.' },
  { id: 'egide', nom: 'Égide', glyph: '🛡️', plateau: true,
    texte: 'Donne Bouclier sacré à trois de vos serviteurs au hasard.' },
  { id: 'grimoire', nom: 'Grimoire', glyph: '📖', texte: 'Découvrez un serviteur d’un rang au-dessus de votre taverne.' },
  { id: 'souffle-vie', nom: 'Souffle de vie', glyph: '🌱', plateau: true,
    texte: 'Donne Réincarnation à deux de vos serviteurs au hasard.' },
];
const SORT_PAR_ID = new Map(SORTS.map((s) => [s.id, s]));
export const getSort = (id) => SORT_PAR_ID.get(id) || null;

/**
 * Trois quêtes différentes, et les trois sortes de récompense réparties
 * entre elles au hasard : un choix entre un serviteur, des cartes et de l'or.
 */
export function offreQuetes(rng) {
  const quetes = melanger(QUETES.map((q) => q.id), rng).slice(0, 3);
  const sortes = melanger(['serviteur', 'cartes', 'or'], rng);
  return quetes.map((id, k) => ({ id, recompense: tirerRecompense(sortes[k], rng) }));
}

function tirerRecompense(type, rng) {
  if (type === 'serviteur') return { type, id: piocher(EXCLUSIFS, rng) };
  if (type === 'cartes') {
    const [a, b] = melanger(SORTS.map((s) => s.id), rng);
    return { type, sorts: [a, b] };
  }
  return entier(rng, 2) ? { type: 'or', parTour: 2 } : { type: 'or', tout: 12 };
}

/* ------------------------------------------------------------------ */
/* Les anomalies                                                       */
/* ------------------------------------------------------------------ */

export const ANOMALIES = [
  { id: 'ruee-or', nom: 'Ruée vers l’or', glyph: '🪙', texte: 'Chaque tour rapporte 1 pièce d’or de plus.' },
  { id: 'taverne-bondee', nom: 'Taverne bondée', glyph: '🍻', texte: 'La taverne propose un serviteur de plus.' },
  { id: 'rangs-soldes', nom: 'Rangs soldés', glyph: '🏷️', texte: 'Monter la taverne coûte 1 pièce de moins.' },
  { id: 'sang-chaud', nom: 'Sang chaud', glyph: '🩸', texte: 'Chaque défaite coûte 3 PV de plus.' },
  { id: 'aube', nom: 'Bénédiction de l’aube', glyph: '🌅',
    texte: 'Au début de chaque combat, votre serviteur le plus à gauche gagne Bouclier sacré.' },
  { id: 'tribu-honneur', nom: 'Tribu à l’honneur', glyph: '🎖️',
    texte: 'Les serviteurs d’une tribu tirée au sort arrivent en taverne avec +1/+1.' },
  { id: 'sang-royal', nom: 'Sang royal', glyph: '👑', texte: 'Les héros commencent avec 40 PV.' },
  { id: 'heros-inspires', nom: 'Héros inspirés', glyph: '💫', texte: 'Les pouvoirs héroïques coûtent 1 pièce de moins.' },
  { id: 'coffres', nom: 'Coffres oubliés', glyph: '🎁',
    texte: 'Au tour 5, chacun découvre un serviteur d’un rang au-dessus de sa taverne.' },
];
const ANOMALIE_PAR_ID = new Map(ANOMALIES.map((a) => [a.id, a]));
export const getAnomalie = (id) => ANOMALIE_PAR_ID.get(id) || null;

/** Les tribus qui peuvent être à l'honneur. */
export const TRIBUS_HONNEUR = ['fauve', 'rouage', 'ecaille', 'demon', 'dragon', 'spectre', 'elementaire'];

/** Une anomalie le plus souvent, deux une fois sur trois. */
export function tirerAnomalies(rng) {
  const n = rng() < 1 / 3 ? 2 : 1;
  return melanger(ANOMALIES.map((a) => a.id), rng).slice(0, n);
}

/** Ce que rapporte une quête, en clair. */
export function recompenseTexte(r) {
  if (!r) return '';
  if (r.type === 'serviteur') {
    const s = getServiteur(r.id);
    return s ? `${s.glyph} ${s.nom} (${s.atk}/${s.pv}), un serviteur exclusif` : '';
  }
  if (r.type === 'cartes') return r.sorts.map((id) => { const c = getSort(id); return `${c.glyph} ${c.nom}`; }).join(' + ');
  if (r.parTour) return `🪙 +${r.parTour} pièces d’or à chaque tour`;
  return `🪙 ${r.tout} pièces d’or`;
}
