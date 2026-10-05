/**
 * BALTROU — les cartes à consommer (planètes et tarots), les tags et les mises.
 *
 * Module ISO, des données et des effets purs. Les effets reçoivent la partie
 * `p`, les cartes visées et un petit contexte `x` ({ R, choisir, creerJoker,
 * creerConso, place }) fourni par partie.js.
 */

import { MAIN, COULEURS } from './cartes.js';

/* ------------------------------------------------------------------ */
/* Les planètes : chacune fait monter une main d'un niveau             */
/* ------------------------------------------------------------------ */

export const PLANETES = {
  haute: { nom: 'Pluton', glyphe: '♇', couleur: '#b9a37a' },
  paire: { nom: 'Mercure', glyphe: '☿', couleur: '#9fb7c9' },
  'deux-paires': { nom: 'Uranus', glyphe: '♅', couleur: '#6fd6e0' },
  brelan: { nom: 'Vénus', glyphe: '♀', couleur: '#f0b45a' },
  suite: { nom: 'Saturne', glyphe: '♄', couleur: '#e3c77a' },
  couleur: { nom: 'Jupiter', glyphe: '♃', couleur: '#e58f5b' },
  full: { nom: 'La Terre', glyphe: '♁', couleur: '#4fa3e8' },
  carre: { nom: 'Mars', glyphe: '♂', couleur: '#e05a4a' },
  'quinte-flush': { nom: 'Neptune', glyphe: '♆', couleur: '#5b6cf0' },
  royale: { nom: 'Planète X', glyphe: '✷', couleur: '#d36bff' },
};
export const textePlanete = (main) => `${MAIN[main].nom} monte d’un niveau.`;

/* ------------------------------------------------------------------ */
/* Les tarots : à utiliser sur les cartes de votre main                */
/* ------------------------------------------------------------------ */

/** Les cartes qu'un tarot peut toucher : pas le Poisson, ni la WILDCARD. */
export const touchable = (c) => !!c && !c.special;

const ameliore = (enh) => (p, cartes) => { for (const c of cartes) c.enh = enh; return `${cartes.length} carte(s) améliorée(s).`; };
const scelle = (sceau) => (p, cartes) => { for (const c of cartes) c.sceau = sceau; return 'Sceau posé.'; };
const couleur = (s) => (p, cartes) => { for (const c of cartes) c.s = s; return `${cartes.length} carte(s) deviennent des ${COULEURS[s].noms}.`; };

const T = (id, num, nom, glyphe, texte, cible, effet) => ({ id, num, nom, glyphe, texte, cible, effet });

export const TAROTS = [
  T('mat', '0', 'Le Mat', '🤡', 'Recrée le dernier tarot ou la dernière planète utilisés (sauf Le Mat).', null, (p, c, x) => {
    if (!p.dernierConso || p.dernierConso === 'tarot:mat') return { refus: 'Rien à recréer.' };
    if (!x.place()) return { refus: 'Plus de place pour un consommable.' };
    x.creerConso(p.dernierConso);
    return 'Copie créée.';
  }),
  T('bateleur', 'I', 'Le Bateleur', '🎩', 'Pose un Sceau bleu sur 1 carte.', [1, 1], scelle('bleu')),
  T('papesse', 'II', 'La Papesse', '📿', 'Crée jusqu’à 2 planètes au hasard.', null, (p, c, x) => {
    let n = 0;
    while (n < 2 && x.place()) { x.creerConso(`planete:${x.choisir(Object.keys(PLANETES))}`); n++; }
    return n ? `${n} planète(s) créée(s).` : { refus: 'Plus de place pour un consommable.' };
  }),
  T('imperatrice', 'III', 'L’Impératrice', '👸', 'Change jusqu’à 2 cartes en cartes Mult (+4 Mult).', [1, 2], ameliore('mult')),
  T('empereur', 'IV', 'L’Empereur', '🤴', 'Crée jusqu’à 2 tarots au hasard.', null, (p, c, x) => {
    let n = 0;
    const pool = TAROTS.filter((t) => t.id !== 'empereur').map((t) => t.id);
    while (n < 2 && x.place()) { x.creerConso(`tarot:${x.choisir(pool)}`); n++; }
    return n ? `${n} tarot(s) créé(s).` : { refus: 'Plus de place pour un consommable.' };
  }),
  T('pape', 'V', 'Le Pape', '⛪', 'Change jusqu’à 2 cartes en cartes Bonus (+30 chips).', [1, 2], ameliore('bonus')),
  T('amoureux', 'VI', 'L’Amoureux', '💘', 'Pose un Sceau rouge sur 1 carte : elle comptera deux fois.', [1, 1], scelle('rouge')),
  T('chariot', 'VII', 'Le Chariot', '🛞', 'Change 1 carte en carte d’Acier.', [1, 1], ameliore('acier')),
  T('justice', 'VIII', 'La Justice', '⚖️', 'Change 1 carte en carte de Verre.', [1, 1], ameliore('verre')),
  T('ermite', 'IX', 'L’Ermite', '🏮', 'Double votre argent (20 $ au plus).', null, (p) => {
    const gain = Math.min(20, p.argent);
    p.argent += gain;
    return `+${gain} $`;
  }),
  T('roue', 'X', 'La Roue de Fortune', '🎡', '1 chance sur 4 : un de vos Jokers devient Holo ou Polychrome.', null, (p, c, x) => {
    const sans = p.jokers.filter((j) => !j.edition);
    if (!sans.length) return { refus: 'Aucun Joker à transformer.' };
    if (x.R() >= 0.25) return 'Rien… la roue tourne.';
    const j = x.choisir(sans);
    j.edition = x.R() < 0.5 ? 'holo' : 'poly';
    return `Un Joker devient ${j.edition === 'holo' ? 'Holo' : 'Polychrome'} !`;
  }),
  T('force', 'XI', 'La Force', '🦁', 'Jusqu’à 2 cartes montent d’un rang (l’As redevient 2).', [1, 2], (p, cartes) => {
    for (const c of cartes) c.r = c.r >= 14 ? 2 : c.r + 1;
    return 'Les cartes montent d’un rang.';
  }),
  T('pendu', 'XII', 'Le Pendu', '🪢', 'Détruit jusqu’à 2 cartes : votre paquet s’affine.', [1, 2], (p, cartes, x) => {
    for (const c of cartes) x.detruire(c.uid);
    return `${cartes.length} carte(s) détruite(s).`;
  }),
  T('mort', 'XIII', 'L’Arcane sans nom', '💀', 'Choisissez 2 cartes : celle de gauche devient une copie de celle de droite.', [2, 2], (p, cartes) => {
    const [g, d] = cartes;
    Object.assign(g, { r: d.r, s: d.s, enh: d.enh, sceau: d.sceau });
    return 'Copie faite.';
  }),
  T('temperance', 'XIV', 'Tempérance', '🏺', 'Gagnez la valeur de revente de vos Jokers (50 $ au plus).', null, (p, c, x) => {
    const gain = Math.min(50, x.valeurJokers());
    p.argent += gain;
    return `+${gain} $`;
  }),
  T('diable', 'XV', 'Le Diable', '😈', 'Pose un Sceau d’or sur 1 carte (+3 $ quand elle compte).', [1, 1], scelle('or')),
  T('maison-dieu', 'XVI', 'La Maison-Dieu', '🗼', 'Change 1 carte en carte de Pierre (+50 chips).', [1, 1], ameliore('pierre')),
  T('etoile', 'XVII', 'L’Étoile', '⭐', 'Jusqu’à 3 cartes deviennent des Carreaux.', [1, 3], couleur('D')),
  T('lune', 'XVIII', 'La Lune', '🌙', 'Jusqu’à 3 cartes deviennent des Trèfles.', [1, 3], couleur('C')),
  T('soleil', 'XIX', 'Le Soleil', '☀️', 'Jusqu’à 3 cartes deviennent des Cœurs.', [1, 3], couleur('H')),
  T('jugement', 'XX', 'Le Jugement', '📯', 'Crée un Joker au hasard (s’il reste une place).', null, (p, c, x) => {
    const j = x.creerJoker();
    return j ? 'Un Joker apparaît !' : { refus: 'Plus de place pour un Joker.' };
  }),
  T('monde', 'XXI', 'Le Monde', '🌍', 'Jusqu’à 3 cartes deviennent des Piques.', [1, 3], couleur('S')),
];
export const TAROT = Object.fromEntries(TAROTS.map((t) => [t.id, t]));

/** Ce qu'est un consommable, d'après son identifiant : 'elixir', 'planete:paire', 'tarot:pape'. */
export function infoConso(id) {
  if (id.startsWith('planete:')) {
    const m = id.slice(8);
    const pl = PLANETES[m];
    return { sorte: 'planete', main: m, nom: pl.nom, glyphe: pl.glyphe, couleur: pl.couleur, texte: textePlanete(m), cible: null };
  }
  if (id.startsWith('tarot:')) {
    const t = TAROT[id.slice(6)];
    return { sorte: 'tarot', nom: t.nom, glyphe: t.glyphe, num: t.num, texte: t.texte, cible: t.cible, tarot: t };
  }
  return { sorte: 'elixir', nom: 'Élixir de Maîtrise', glyphe: '🧪', texte: 'Fait monter d’un niveau votre main la plus faible.', cible: null };
}

/* ------------------------------------------------------------------ */
/* Les tags : ce qu'on gagne en passant une blind                      */
/* ------------------------------------------------------------------ */

export const TAGS = {
  argent: { nom: 'Tag Investissement', glyphe: '💵', texte: '+10 $ tout de suite.' },
  economie: { nom: 'Tag Économie', glyphe: '🏦', texte: 'Double votre argent (40 $ au plus).' },
  rare: { nom: 'Tag Rare', glyphe: '💎', texte: 'Un Joker rare gratuit dans la prochaine boutique.' },
  edition: { nom: 'Tag Polychrome', glyphe: '🌈', texte: 'Un Joker Polychrome gratuit dans la prochaine boutique.' },
  celeste: { nom: 'Tag Céleste', glyphe: '🪐', texte: 'Un Pack Céleste gratuit dans la prochaine boutique.' },
  arcane: { nom: 'Tag Arcane', glyphe: '🔮', texte: 'Un Pack Arcane gratuit dans la prochaine boutique.' },
  coupon: { nom: 'Tag Coupon', glyphe: '🎟️', texte: 'Tout ce que propose la prochaine boutique est gratuit (avant de rafraîchir).' },
  jongleur: { nom: 'Tag Jongleur', glyphe: '🤹', texte: '+3 cartes en main pendant la prochaine manche.' },
};
/** Les tags qui agissent tout de suite. Les autres attendent la boutique, ou la manche. */
export const TAGS_IMMEDIATS = ['argent', 'economie'];

/* ------------------------------------------------------------------ */
/* Les mises : la difficulté, à débloquer une à une                    */
/* ------------------------------------------------------------------ */

export const MISES = [
  { id: 'blanche', nom: 'Mise Blanche', couleur: '#f3ecdf', texte: 'Les règles de base.' },
  { id: 'rouge', nom: 'Mise Rouge', couleur: '#ff4b4b', texte: 'La petite blind ne rapporte rien.' },
  { id: 'verte', nom: 'Mise Verte', couleur: '#3ecf6e', texte: 'Et les objectifs grimpent de 25 %.' },
  { id: 'noire', nom: 'Mise Noire', couleur: '#5b5470', texte: 'Et une défausse de moins par manche.' },
  { id: 'doree', nom: 'Mise Dorée', couleur: '#ffc83d', texte: 'Et les objectifs grimpent de 50 % en tout.' },
];
/** Le multiplicateur des objectifs selon la mise. */
export const multObjectif = (mise) => (mise >= 4 ? 1.5 : mise >= 2 ? 1.25 : 1);
