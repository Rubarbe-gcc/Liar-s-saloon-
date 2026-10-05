/**
 * BALTROU — les Jokers, les objets de la boutique et les bons (vouchers).
 *
 * Module ISO. Un Joker possédé est une petite fiche { uid, id, edition, e } ;
 * `e` garde ce qu'il a accumulé (des charges, un niveau…). Son effet vit ici,
 * dans `JOKERS[id].effet(x)`, qui modifie `x.chips` et `x.mult` :
 *
 *   x = { chips, mult, main, ordre, compte, argent, mainsRestantes,
 *         jokers, j, R, note(texte) }
 *
 * Les crochets (manche, gagne, boutique) agissent sur la partie elle-même.
 */

import { MAIN } from './cartes.js';

const J = (id, nom, prix, rarete, texte, effet, crochets = {}) => ({ id, nom, prix, rarete, texte, effet, ...crochets });
const suiteOuMieux = (m) => m === 'suite' || m === 'quinte-flush' || m === 'royale';

export const RARETES = {
  commun: { nom: 'Commun', couleur: '#9d93b8' },
  rare: { nom: 'Rare', couleur: '#5b8cff' },
  legendaire: { nom: 'Légendaire', couleur: '#ffc83d' },
  mystique: { nom: 'Mystique', couleur: '#b44dff' },
  mythique: { nom: 'MYTHIQUE', couleur: '#ff3fc8' },
  negatif: { nom: 'Négatif', couleur: '#c82aa0' },
};

export const LISTE_JOKERS = [
  /* ------------------------------ Communs ------------------------------ */
  J('classique', 'Le Classique', 6, 'commun', '+4 Mult', (x) => { x.mult += 4; }),
  J('glouton', 'Le Glouton', 5, 'commun', '+3 chips par carte qui compte', (x) => { x.chips += 3 * x.compte.length; }),
  J('matheux', 'Le Matheux', 7, 'commun', '+2 Mult par paire dans la main', (x) => {
    if (x.main === 'paire' || x.main === 'full') x.mult += 2;
    if (x.main === 'deux-paires') x.mult += 4;
  }),
  J('chance', 'La Chance', 6, 'commun', '1 chance sur 2 : ×2 Mult', (x) => { if (x.R() < 0.5) { x.mult *= 2; x.note('×2 !'); } else x.note('raté'); }),
  J('maudit', 'Le Maudit', 4, 'commun', '+8 Mult, −10 chips', (x) => { x.chips = Math.max(0, x.chips - 10); x.mult += 8; }),
  J('defauts', 'Collec. Défauts', 6, 'commun', '+8 Mult', (x) => { x.mult += 8; }),
  J('rentier', 'Le Rentier', 7, 'commun', '+5 chips', (x) => { x.chips += 5; }),
  J('corrompu', 'Le Corrompu', 5, 'commun', '+12 chips', (x) => { x.chips += 12; }),

  /* ------------------------------- Rares ------------------------------- */
  J('parrain', 'Le Parrain', 10, 'rare', '×2 Mult sur un Carré ou mieux', (x) => { if (x.ordre >= MAIN.carre.ordre) x.mult *= 2; }),
  J('tricheur', 'Le Tricheur', 8, 'rare', '+20 chips sur une Couleur ou mieux', (x) => { if (x.ordre >= MAIN.couleur.ordre) x.chips += 20; }),
  J('collectionneur', 'Le Collectionneur', 9, 'rare', '+5 chips par carte améliorée qui compte',
    (x) => { x.chips += 5 * x.compte.filter((c) => c.enh).length; }),
  J('sage', 'Le Sage', 8, 'rare', '+1 Mult par carte qui compte', (x) => { x.mult += x.compte.length; }),
  J('cameleon', 'Le Caméléon', 9, 'rare', 'Copie l’effet du Joker à sa droite (+3 Mult s’il est seul)', (x) => {
    const i = x.jokers.indexOf(x.j);
    const autres = x.jokers.filter((k) => k !== x.j && !['cameleon', 'miroir-brise'].includes(k.id));
    const voisin = x.jokers[i + 1] && !['cameleon', 'miroir-brise'].includes(x.jokers[i + 1].id) ? x.jokers[i + 1] : autres[0];
    if (!voisin) { x.mult += 3; return; }
    x.note(`copie ${JOKERS[voisin.id].nom}`);
    JOKERS[voisin.id].effet({ ...x, j: voisin, note: () => {} }, true);
  }),
  J('banquier', 'Le Banquier', 10, 'rare', '+1 Mult par tranche de 100 $', (x) => { x.mult += Math.floor(x.argent / 100); }),
  J('escroc', 'L’Escroc', 7, 'rare', '+50 chips — vous coûte 2 $ après chaque manche gagnée',
    (x) => { x.chips += 50; }, { gagne: (j, p) => { p.argent = Math.max(0, p.argent - 2); } }),
  J('miroir-brise', 'Miroir Brisé', 11, 'rare', '+20 chips +2 Mult — 1 chance sur 4 : l’inverse', (x) => {
    if (x.R() < 0.25) { x.chips = Math.max(0, x.chips - 20); x.mult = Math.max(1, x.mult - 2); x.note('inversé !'); }
    else { x.chips += 20; x.mult += 2; }
  }),
  J('anarchiste', 'L’Anarchiste', 8, 'rare', '+15 chips sur une Suite', (x) => { if (suiteOuMieux(x.main)) x.chips += 15; }),
  J('magicien', 'Le Magicien', 9, 'rare', '+5 à +20 Mult au hasard', (x) => { x.mult += [5, 10, 15, 20][Math.floor(x.R() * 4)]; }),
  J('demon-comptable', 'Démon Comptable', 11, 'rare', '+2 Mult par tranche de 50 $', (x) => { x.mult += 2 * Math.floor(x.argent / 50); }),
  J('pyromane', 'Le Pyromane', 8, 'rare', '+60 chips — 7 fois sur 10, +5 Mult', (x) => { x.chips += 60; if (x.R() < 0.7) x.mult += 5; }),
  J('de20', 'Dé à 20 faces', 10, 'rare', 'Lance un d20 : 15 ou plus, ×le dé ; sinon +le dé en Mult', (x) => {
    const d = 1 + Math.floor(x.R() * 20);
    if (d >= 15) x.mult *= d; else x.mult += d;
    x.note(`🎲 ${d}`);
  }),
  J('slots', 'Machine à Sous', 9, 'rare', 'Trois symboles : jackpot ×5 Mult, deux 7 ×2', (x) => {
    const s = [0, 1, 2].map(() => ['7', 'BAR', '🍒', '🔔'][Math.floor(x.R() * 4)]);
    if (s[0] === s[1] && s[1] === s[2]) x.mult *= 5;
    else if (s.filter((v) => v === '7').length === 2) x.mult *= 2;
    x.note(s.join(' '));
  }),
  J('chaos', 'Chaos Absolu', 10, 'rare', 'Un bonus au hasard à chaque main', (x) => {
    const [c, m] = [[10, 0], [0, 5], [30, 0], [0, 3], [-10, 8]][Math.floor(x.R() * 5)];
    x.chips = Math.max(0, x.chips + c); x.mult += m;
  }),
  J('pirate', 'Le Pirate', 8, 'rare', '+10 chips', (x) => { x.chips += 10; }),
  J('investisseur', 'L’Investisseur', 8, 'rare', '+2 Mult par niveau — monte d’un niveau à chaque manche gagnée',
    (x) => { x.mult += 2 * (x.j.e.niveau || 1); }, { gagne: (j) => { j.e.niveau = (j.e.niveau || 1) + 1; } }),
  J('berserker', 'Le Berserker', 10, 'rare', '+3 Mult par main déjà jouée dans la manche', (x) => { x.mult += 3 * Math.max(0, 4 - x.mainsRestantes); }),
  J('archiviste', 'L’Archiviste', 10, 'rare', '+1 Mult de plus à chaque main jouée (cumulé)', (x, copie) => {
    const n = (x.j.e.n || 0) + (copie ? 0 : 1); if (!copie) x.j.e.n = n; x.mult += n;
  }),
  J('stratege', 'Le Stratège', 11, 'rare', '+2 Mult par sorte de main différente jouée dans la run', (x, copie) => {
    const vues = new Set(x.j.e.vues || []); vues.add(x.main); if (!copie) x.j.e.vues = [...vues]; x.mult += 2 * vues.size;
  }),

  /* ---------------------------- Légendaires ---------------------------- */
  J('doubleur', 'Le Doubleur', 12, 'legendaire', '×2 chips sur une Suite', (x) => { if (suiteOuMieux(x.main)) x.chips *= 2; }),
  J('voyageur', 'Voyageur Temporel', 14, 'legendaire', 'À partir de la 2ᵉ main : +10 chips +2 Mult', (x, copie) => {
    if (x.j.e.deja) { x.chips += 10; x.mult += 2; }
    if (!copie) x.j.e.deja = true;
  }),
  J('vampire', 'Le Vampire', 12, 'legendaire', '+8 chips de plus à chaque main jouée (cumulé)', (x, copie) => {
    const n = (x.j.e.n || 0) + (copie ? 0 : 1); if (!copie) x.j.e.n = n; x.chips += 8 * n;
  }),
  J('pacte', 'Le Pacte', 13, 'legendaire', '×3 Mult — mais une main de moins par manche',
    (x) => { x.mult *= 3; }, { manche: (j, p) => { p.mainsRestantes = Math.max(1, p.mainsRestantes - 1); } }),
  J('executeur', 'L’Exécuteur', 11, 'legendaire', '+3 Mult par carte de 10 ou plus qui compte',
    (x) => { x.mult += 3 * x.compte.filter((c) => !c.special && c.enh !== 'pierre' && c.r >= 10).length; }),
  J('trou-noir', 'Le Trou Noir', 15, 'legendaire', '+25 chips +5 Mult', (x) => { x.chips += 25; x.mult += 5; }),
  J('infini', 'L’Infini', 16, 'legendaire', '+1 Mult permanent par main jouée dans la run', (x, copie) => {
    const n = (x.j.e.n || 0) + (copie ? 0 : 1); if (!copie) x.j.e.n = n; x.mult += n;
  }),
  J('chef', 'Chef d’Orchestre', 12, 'legendaire', '+5 Mult', (x) => { x.mult += 5; }),
  J('roi-chaos', 'Roi du Chaos', 20, 'legendaire', '+100 chips +10 Mult', (x) => { x.chips += 100; x.mult += 10; }),
  J('temps', 'Le Temps', 18, 'legendaire', 'Rajoute la moitié des meilleurs chips déjà vus', (x, copie) => {
    const best = x.j.e.best || 0;
    if (!copie) x.j.e.best = Math.max(best, x.chips);
    x.chips += Math.floor(best / 2);
  }),
  J('destin', 'Le Destin', 17, 'legendaire', '+15 Mult', (x) => { x.mult += 15; }),
  J('dieu-poker', 'Dieu du Poker', 22, 'legendaire', '+20 Mult par figure (V, D, R) qui compte',
    (x) => { x.mult += 20 * x.compte.filter((c) => !c.special && c.enh !== 'pierre' && c.r >= 11 && c.r <= 13).length; }),

  /* ----------------------------- MYTHIQUES ----------------------------- */
  J('dieu-hasard', 'Dieu du Hasard', 150, 'mythique', '×15 Mult — 5 % : tout divisé par 10', (x) => {
    if (x.R() < 0.05) { x.chips = Math.floor(x.chips / 10); x.mult = Math.max(1, x.mult / 10); x.note('les dieux reprennent'); }
    else x.mult *= 15;
  }),
  J('couronne', 'Couronne de l’Infini', 180, 'mythique', '+40 chips +20 Mult — 3 % : Mult ramené à 1', (x) => {
    if (x.R() < 0.03) { x.mult = 1; x.note('éteinte'); } else { x.chips += 40; x.mult += 20; }
  }),
  J('pacte-interdit', 'Pacte Interdit', 165, 'mythique', '×3 chips et ×3 Mult — 5 % : −50 chips', (x) => {
    if (x.R() < 0.05) { x.chips = Math.max(0, x.chips - 50); x.note('le prix'); } else { x.chips *= 3; x.mult *= 3; }
  }),
  J('miracle', 'Miracle', 160, 'mythique', '+200 chips ×10 Mult — 5 % : la main ne vaut plus rien', (x) => {
    if (x.R() < 0.05) { x.chips = Math.max(5, x.chips - MAIN[x.main].chips); x.mult = 1; x.note('raté'); }
    else { x.chips += 200; x.mult *= 10; }
  }),
  J('trou-noir-m', 'Trou Noir Mythique', 180, 'mythique', '×5 Mult — 4 % : avale aussi la moitié des chips', (x) => {
    if (x.R() < 0.04) { x.chips = Math.floor(x.chips / 2); x.note('avalé'); }
    x.mult *= 5;
  }),
  J('surcharge', 'Surcharge', 210, 'mythique', '×500 Mult sur la 1ʳᵉ main de chaque manche — 5 % : main annulée', (x, copie) => {
    if (x.j.e.servi) return;
    if (!copie) x.j.e.servi = true;
    if (x.R() < 0.05) { x.chips = 0; x.mult = 1; x.note('court-circuit'); } else x.mult *= 500;
  }, { manche: (j) => { j.e.servi = false; } }),
  J('jackpot', 'Jackpot Cosmique', 240, 'mythique', '×777 Mult — 30 % : tout à zéro', (x) => {
    if (x.R() < 0.3) { x.chips = 0; x.mult = 0; x.note('la machine gagne'); } else x.mult *= 777;
  }),
  J('oeil', 'Œil du Destin', 180, 'mythique', '×50 Mult — 2 % : chips ÷3 et Mult ÷2', (x) => {
    if (x.R() < 0.02) { x.chips = Math.floor(x.chips / 3); x.mult /= 2; x.note('trompé'); } else x.mult *= 50;
  }),
  J('bug', 'Le Bug', 135, 'mythique', '×10 Mult — 5 % : Mult ramené à 1', (x) => {
    if (x.R() < 0.05) { x.mult = 1; x.note('corrigé…'); } else x.mult *= 10;
  }),
  J('main-divine', 'Main Divine', 200, 'mythique', '×50 Mult par As qui compte — 5 % : rien', (x) => {
    const as = x.compte.filter((c) => !c.special && c.enh !== 'pierre' && c.r === 14).length;
    if (!as) return;
    if (x.R() < 0.05) { x.note('raté'); return; }
    x.mult *= 50 * as;
  }),
  J('roulette-multivers', 'Roulette Multivers', 300, 'mythique', '40 % : ×1000 Mult — 1 % : tout à zéro', (x) => {
    const t = x.R();
    if (t < 0.01) { x.chips = 0; x.mult = 0; x.note('GG'); } else if (t < 0.4) x.mult *= 1000; else x.note('rien');
  }),

  /* ------------------- Négatifs : hors des places normales ------------------- */
  J('spectre', 'Le Spectre', 14, 'negatif', '+15 Mult — vous coûte 5 $ à chaque boutique',
    (x) => { x.mult += 15; }, { boutique: (j, p) => { p.argent = Math.max(0, p.argent - 5); } }),
  J('ombre', 'L’Ombre', 13, 'negatif', '+60 chips — une défausse de moins par manche',
    (x) => { x.chips += 60; }, { manche: (j, p) => { p.defaussesRestantes = Math.max(0, p.defaussesRestantes - 1); } }),
  J('possede', 'Le Possédé', 16, 'negatif', '×2 Mult — 1 chance sur 5 : score de la main à zéro', (x) => {
    if (x.R() < 0.2) { x.chips = 0; x.mult = 0; x.note('possédé !'); } else x.mult *= 2;
  }),
];

export const JOKERS = Object.fromEntries(LISTE_JOKERS.map((j) => [j.id, j]));
export const estNegatif = (id) => JOKERS[id]?.rarete === 'negatif';

export const EDITIONS = {
  holo: { nom: 'Holo', texte: '+10 chips' },
  poly: { nom: 'Polychrome', texte: '×1,15 Mult' },
};

/* ------------------------------------------------------------------ */
/* Les objets de la boutique                                           */
/* ------------------------------------------------------------------ */

const O = (id, nom, prix, rarete, texte, glyphe, extra = {}) => ({ id, nom, prix, rarete, texte, glyphe, objet: true, ...extra });

export const OBJETS = {
  'main-plus': O('main-plus', 'Main +', 5, 'rare', '+1 main à chaque manche, pour toute la run.', '✋'),
  poubelle: O('poubelle', 'Poubelle', 4, 'rare', '+1 défausse à chaque manche, pour toute la run.', '🗑️'),
  elixir: O('elixir', 'Élixir de Maîtrise', 8, 'mystique', 'Consommable : fait monter d’un niveau votre main la plus faible, quand vous voulez.', '🧪', { consommable: true }),
  'atelier-bonus': O('atelier-bonus', 'Atelier : Bonus', 6, 'rare', 'Améliore 2 cartes de votre paquet : +30 chips.', '🔨', { amelioration: 'bonus', n: 2 }),
  'atelier-mult': O('atelier-mult', 'Atelier : Mult', 6, 'rare', 'Améliore 2 cartes de votre paquet : +4 Mult.', '🔨', { amelioration: 'mult', n: 2 }),
  'atelier-verre': O('atelier-verre', 'Atelier : Verre', 6, 'rare', 'Améliore 2 cartes : ×1,5 Mult, mais le verre peut se briser.', '🔨', { amelioration: 'verre', n: 2 }),
  'atelier-acier': O('atelier-acier', 'Atelier : Acier', 6, 'rare', 'Améliore 2 cartes : ×1,5 Mult tant qu’elles restent en main.', '🔨', { amelioration: 'acier', n: 2 }),
  'atelier-pierre': O('atelier-pierre', 'Atelier : Pierre', 6, 'rare', 'Change 2 cartes en Pierre : +50 chips dans n’importe quelle main.', '🔨', { amelioration: 'pierre', n: 2 }),
  'sceau-or': O('sceau-or', 'Sceau d’or', 7, 'rare', 'Sur 1 carte : +3 $ chaque fois qu’elle compte.', '🟡', { sceau: 'or', n: 1 }),
  'sceau-rouge': O('sceau-rouge', 'Sceau rouge', 7, 'rare', 'Sur 1 carte : elle compte deux fois.', '🔴', { sceau: 'rouge', n: 1 }),
  'sceau-bleu': O('sceau-bleu', 'Sceau bleu', 7, 'rare', 'Sur 1 carte : la main jouée monte de niveau.', '🔵', { sceau: 'bleu', n: 1 }),
  'sceau-violet': O('sceau-violet', 'Sceau violet', 7, 'rare', 'Sur 1 carte : améliore une autre carte du paquet au hasard.', '🟣', { sceau: 'violet', n: 1 }),
  'pack-joker': O('pack-joker', 'Pack Joker', 10, 'legendaire', '3 Jokers au choix : vous en gardez un.', '🎁'),
  'pack-carte': O('pack-carte', 'Pack Carte', 9, 'legendaire', '3 améliorations de carte au choix : vous en gardez une.', '🃏'),
  bob: O('bob', 'BOB le tavernier', 12, 'legendaire', '+1 place de Joker, et 3 rafraîchissements gratuits à chaque boutique.', '🍺'),
  roulette: O('roulette', 'La Roulette', 15, 'mystique', 'Glisse une WILDCARD dans votre paquet : ×6,7 chips et Mult ! (3 % de muter en TROLL…)', '🎡'),
  'saint-livre': O('saint-livre', 'Le Saint Livre', 2, 'mystique', 'Consultez à tout moment l’effet de toutes les cartes du jeu.', '📖'),
};

/** Les bons, offerts gratuitement après chaque boss. Le palier + suit le palier 1. */
export const VOUCHERS = [
  { id: 'grand-sac', nom: 'Grand Sac', texte: '+1 carte en main, pour toute la run.' },
  { id: 'bon-marchand', nom: 'Bon Marchand', texte: 'Rafraîchir la boutique coûte moins cher.' },
  { id: 'interet', nom: 'Intérêt +', texte: 'Plus d’intérêts sur votre argent en fin de manche.' },
  { id: 'poche', nom: 'Poche Extra', texte: '+1 place de Joker, pour toute la run.' },
  { id: 'grand-sac+', nom: 'Grand Sac +', texte: 'Encore +1 carte en main.', requiert: 'grand-sac' },
  { id: 'bon-marchand+', nom: 'Bon Marchand +', texte: 'Rafraîchir la boutique devient gratuit.', requiert: 'bon-marchand' },
  { id: 'interet+', nom: 'Intérêt ++', texte: 'Encore plus d’intérêts.', requiert: 'interet' },
  { id: 'poche+', nom: 'Poche Extra +', texte: 'Encore +1 place de Joker.', requiert: 'poche' },
];
export const VOUCHER = Object.fromEntries(VOUCHERS.map((v) => [v.id, v]));
