/**
 * LÉGENDES — les personnages (tous inventés : des héros de shōnen, aucun personnage existant).
 *
 * Comme dans les grands gachas de combat, chaque personnage a :
 *   une rareté (R, SR, SSR, LR) et un élément (cinq, qui se battent en cycle) ;
 *   plusieurs CATÉGORIES (le chef d'équipe renforce une catégorie : on monte son équipe autour) ;
 *   des LIENS (deux combattants côte à côte qui partagent un lien se renforcent) ;
 *   un RÔLE (frappeur, mur, esquiveur, critique, pivot, soutien) d'où vient son PASSIF : une ligne pour un R,
 *     jusqu'à huit pour un LR (passifs.js) ;
 *   sa compétence de CHEF, sa SUPER ATTAQUE (sa puissance, son effet, le style de sa cinématique) ;
 *   ses couleurs et sa coiffure (pour son portrait).
 *
 * `sortie` : l'indice du portail en rotation qui le fait arriver (calendrier.js). `fete` : il n'arrive
 * qu'avec une célébration.
 */

import { creerPassif, creerChef, creerSuper } from './passifs.js';

/** Les éléments : chacun bat le suivant (×1,5) et craint le précédent. */
export const ELEMENTS = {
  flamme: { nom: 'Flamme', glyphe: '🔥', couleur: '#ff5a36' },
  tempete: { nom: 'Tempête', glyphe: '🌪️', couleur: '#36d39a' },
  roc: { nom: 'Roc', glyphe: '⛰️', couleur: '#c8913a' },
  eclair: { nom: 'Éclair', glyphe: '⚡', couleur: '#ffd23f' },
  maree: { nom: 'Marée', glyphe: '🌊', couleur: '#3a8dff' },
};
export const CYCLE = ['flamme', 'tempete', 'roc', 'eclair', 'maree'];
/** Le multiplicateur d'un attaquant d'élément a sur un défenseur d'élément b. */
export function avantage(a, b) {
  const i = CYCLE.indexOf(a), j = CYCLE.indexOf(b);
  if (i < 0 || j < 0) return 1;
  if ((i + 1) % 5 === j) return 1.5;
  if ((j + 1) % 5 === i) return 0.75;
  return 1;
}

/** Les catégories (le chef en renforce une ou deux). */
export const CATEGORIES = {
  aube: 'Héros de l’Aube', ombre: 'Lames de l’Ombre', neant: 'Onze du Néant', rivaux: 'Rivaux éternels',
  maitres: 'Vieux Maîtres', lune: 'Clan de la Lune', arcade: 'Champions de l’Arcade', fete: 'Esprits des Fêtes',
  transfo: 'Transformations', divin: 'Puissance divine', duo: 'Duos légendaires', solitaire: 'Loups solitaires',
  combattantes: 'Combattantes', genies: 'Génies du combat', sangchaud: 'Sang chaud', glace: 'Cœurs de glace',
  ninjas: 'Ninjas', sportifs: 'Sportifs', allies: 'Ennemis devenus alliés', heritiers: 'Héritiers d’une légende',
};
/** Ancien nom (les premières versions parlaient de « familles »). */
export const FAMILLES = CATEGORIES;

/** Les liens : actifs quand un voisin de rotation partage le même lien. */
export const LIENS = {
  rivalite: { nom: 'Rivalité', atq: 0.15, texte: 'ATQ +15 %' },
  instinct: { nom: 'Instinct de combat', atq: 0.1, ki: 1, texte: 'Ki +1, ATQ +10 %' },
  amis: { nom: 'Amis d’enfance', atq: 0.1, def: 0.1, texte: 'ATQ et DÉF +10 %' },
  maitre: { nom: 'Maître et disciple', ki: 2, texte: 'Ki +2' },
  ombres: { nom: 'Pacte des ombres', atq: 0.2, texte: 'ATQ +20 %' },
  equipe: { nom: 'Esprit d’équipe', ki: 1, def: 0.15, texte: 'Ki +1, DÉF +15 %' },
  feu: { nom: 'Cœur ardent', atq: 0.15, ki: 1, texte: 'Ki +1, ATQ +15 %' },
  froid: { nom: 'Sang-froid', def: 0.2, texte: 'DÉF +20 %' },
  legende: { nom: 'Légende vivante', atq: 0.2, ki: 2, texte: 'Ki +2, ATQ +20 %' },
  fete: { nom: 'Esprit de fête', atq: 0.1, ki: 1, texte: 'Ki +1, ATQ +10 %' },
};

export const RARETES = {
  N: { nom: 'N', couleur: '#6a7a6a', pv: 2100, atq: 1700, def: 600, eveilMax: 1 },
  R: { nom: 'R', couleur: '#8aa0b4', pv: 3200, atq: 2600, def: 900, eveilMax: 2 },
  SR: { nom: 'SR', couleur: '#d7a23a', pv: 5200, atq: 4300, def: 1500, eveilMax: 3 },
  SSR: { nom: 'SSR', couleur: '#ffd23f', pv: 8400, atq: 7200, def: 2600, eveilMax: 4 },
  UR: { nom: 'UR', couleur: '#ff7a3a', pv: 10400, atq: 9000, def: 3200, eveilMax: 5 },
  LR: { nom: 'LR', couleur: '#ff4dd8', pv: 12500, atq: 10800, def: 3900, eveilMax: 5 },
};

/** Les styles de cinématique de super attaque. */
export const STYLES_SUPER = ['rayon', 'combo', 'lame', 'tir', 'explosion', 'ombre', 'meteore', 'glace'];
/** Les rôles (ce qui façonne le passif). */
export const ROLES = {
  frappeur: 'Frappeur', mur: 'Mur', esquiveur: 'Esquiveur', critique: 'Critique', pivot: 'Pivot', soutien: 'Soutien',
};

/**
 * p(id, nom, titre, rarete, element, categories, role, liens, [super, style, puissance (1 à 5)], couleurs
 *   [peau, cheveux, tenue, aura], coiffure, o { sortie, fete, forme, chef: [catégories] })
 */
const p = (id, nom, titre, rarete, element, categories, role, liens, sup, c, coiffure, o = {}) => {
  const x = { id, nom, titre, rarete, element, familles: categories, categories, role, liens, couleurs: { peau: c[0], cheveux: c[1], tenue: c[2], aura: c[3] }, coiffure, ...o };
  x.super = creerSuper(x, sup[0], sup[1], sup[2]);
  x.passif = creerPassif(x);
  x.chef = creerChef(x, o.chef);
  return x;
};

const BASE = [
  /* ---------------- N : on les trouve en combattant (le butin des étapes) ---------------- */
  p('garde_n', 'Toma', 'Garde du village', 'N', 'roc', ['arcade', 'heritiers'], 'mur', ['equipe', 'amis'], ['Coup de Hampe', 'combo', 1], ['#e0ac69', '#5a3a1a', '#6b6b4a', '#c8913a'], 'court'),
  p('eclaireuse_n', 'Lys', 'Éclaireuse', 'N', 'tempete', ['ninjas', 'combattantes'], 'esquiveur', ['amis', 'ombres'], ['Flèche Rapide', 'tir', 1], ['#ffe0bd', '#8a5a2a', '#3a5a3a', '#36d39a'], 'queue'),
  p('forgeron_n', 'Bolt', 'Apprenti forgeron', 'N', 'flamme', ['arcade', 'sangchaud'], 'frappeur', ['feu', 'equipe'], ['Marteau Brûlant', 'explosion', 1], ['#c68642', '#1b1b1f', '#7a4a2a', '#ff7a1a'], 'chauve'),
  p('mousse_n', 'Pip', 'Mousse du port', 'N', 'maree', ['lune', 'sportifs'], 'soutien', ['amis', 'froid'], ['Seau d’Eau', 'rayon', 1], ['#f1c27d', '#3a2a1a', '#3a8dff', '#7ac8ff'], 'meches'),
  p('coursier_n', 'Zap', 'Coursier de l’orage', 'N', 'eclair', ['sportifs', 'solitaire'], 'pivot', ['instinct', 'equipe'], ['Sprint Électrique', 'combo', 1], ['#e0ac69', '#ffd23f', '#4a3a8a', '#ffd23f'], 'meches'),
  p('moine_n', 'Oden', 'Jeune moine', 'N', 'roc', ['maitres', 'heritiers'], 'critique', ['maitre', 'equipe'], ['Paume Simple', 'explosion', 1], ['#ffe0bd', '#1b1b1f', '#d8a03a', '#c8913a'], 'chauve'),

  /* ---------------- R : les premiers compagnons ---------------- */
  p('kael_r', 'Kael', 'Apprenti de l’Aube', 'R', 'flamme', ['aube', 'sangchaud', 'heritiers'], 'frappeur', ['rivalite', 'feu', 'amis'], ['Poing Braise', 'combo', 1], ['#f1c27d', '#1b1b1f', '#ff7a1a', '#ffb347'], 'pics'),
  p('mira_r', 'Mira', 'Kunoichi novice', 'R', 'tempete', ['ombre', 'ninjas', 'combattantes'], 'esquiveur', ['ombres', 'amis'], ['Shuriken du Vent', 'tir', 1], ['#ffe0bd', '#2b2b6b', '#3a3a4a', '#36d39a'], 'queue'),
  p('bram_r', 'Bram', 'Gardien du gué', 'R', 'roc', ['arcade', 'solitaire'], 'mur', ['froid', 'equipe'], ['Rempart de Pierre', 'explosion', 1], ['#c68642', '#5a3a1a', '#6b8a3a', '#c8913a'], 'court'),
  p('lio_r', 'Lio', 'Ailier du Néant', 'R', 'eclair', ['neant', 'sportifs'], 'pivot', ['equipe', 'instinct'], ['Frappe Éclair', 'tir', 1], ['#f1c27d', '#ffd23f', '#1b1b1f', '#ffd23f'], 'meches'),
  p('nami_r', 'Nami', 'Pêcheuse de perles', 'R', 'maree', ['lune', 'combattantes'], 'soutien', ['amis', 'froid'], ['Vague Douce', 'rayon', 1], ['#8d5524', '#1b1b1f', '#3a8dff', '#7ac8ff'], 'long'),
  p('tobi_r', 'Tobi', 'Boxeur de quartier', 'R', 'flamme', ['arcade', 'sangchaud', 'sportifs'], 'critique', ['feu', 'instinct'], ['Crochet Rouge', 'combo', 1], ['#e0ac69', '#7a3a1a', '#c8302c', '#ff5a36'], 'court'),
  p('suzu_r', 'Suzu', 'Disciple du temple', 'R', 'roc', ['maitres', 'heritiers'], 'soutien', ['maitre', 'equipe'], ['Paume de Montagne', 'explosion', 1], ['#ffe0bd', '#1b1b1f', '#d8a03a', '#c8913a'], 'chauve'),
  p('fen_r', 'Fen', 'Rôdeur des toits', 'R', 'tempete', ['ombre', 'ninjas', 'solitaire'], 'esquiveur', ['ombres', 'instinct'], ['Coup de Faux', 'lame', 1], ['#f1c27d', '#6b6b6b', '#2a3a2a', '#36d39a'], 'meches'),

  /* ---------------- SR ---------------- */
  p('kael_sr', 'Kael', 'Éveil de la Braise', 'SR', 'flamme', ['aube', 'sangchaud', 'heritiers'], 'frappeur', ['rivalite', 'feu', 'amis'], ['Vague Ardente', 'rayon', 2], ['#f1c27d', '#ff9a1a', '#ff7a1a', '#ffb347'], 'pics'),
  p('ryo_sr', 'Ryo', 'Le Rival Froid', 'SR', 'maree', ['rivaux', 'aube', 'glace', 'solitaire'], 'critique', ['rivalite', 'froid'], ['Lame de Givre', 'lame', 2], ['#ffe0bd', '#3a5aff', '#14142a', '#7ac8ff'], 'pics'),
  p('mira_sr', 'Mira', 'Danse des Feuilles', 'SR', 'tempete', ['ombre', 'ninjas', 'combattantes'], 'esquiveur', ['ombres', 'amis'], ['Mille Feuilles', 'combo', 2], ['#ffe0bd', '#2b2b6b', '#2a2a3a', '#36d39a'], 'queue'),
  p('goran_sr', 'Goran', 'Le Colosse', 'SR', 'roc', ['rivaux', 'allies', 'sangchaud'], 'mur', ['rivalite', 'equipe'], ['Séisme', 'explosion', 2], ['#c68642', '#1b1b1f', '#4a3a2a', '#c8913a'], 'chauve'),
  p('hiro_sr', 'Hiro', 'Numéro 9 du Néant', 'SR', 'eclair', ['neant', 'rivaux', 'sportifs', 'genies'], 'frappeur', ['rivalite', 'instinct', 'equipe'], ['Tir de l’Égo', 'tir', 2], ['#f1c27d', '#1b1b1f', '#1b1b1f', '#ffd23f'], 'meches'),
  p('sel_sr', 'Sel', 'Prêtresse des Marées', 'SR', 'maree', ['lune', 'combattantes'], 'soutien', ['amis', 'froid', 'maitre'], ['Prière d’Écume', 'rayon', 2], ['#8d5524', '#e8e8f0', '#3a8dff', '#7ac8ff'], 'long'),
  p('ivo_sr', 'Ivo', 'Gant d’Or', 'SR', 'flamme', ['arcade', 'rivaux', 'sportifs', 'sangchaud'], 'critique', ['feu', 'rivalite'], ['Uppercut Volcan', 'combo', 2], ['#e0ac69', '#3a1a0a', '#c8302c', '#ff5a36'], 'court'),
  p('noa_sr', 'Noa', 'Fille de l’Orage', 'SR', 'eclair', ['lune', 'combattantes', 'genies'], 'pivot', ['amis', 'instinct'], ['Lance de Foudre', 'rayon', 2], ['#ffe0bd', '#e8e8f0', '#4a3a8a', '#ffd23f'], 'long'),
  p('vash_sr', 'Vash', 'Lame Errante', 'SR', 'tempete', ['ombre', 'rivaux', 'solitaire'], 'critique', ['ombres', 'rivalite'], ['Tranche-Brume', 'lame', 2], ['#f1c27d', '#8a1a1a', '#1b1b1f', '#36d39a'], 'long'),
  p('maitre_ko_sr', 'Ko', 'Vieux Maître', 'SR', 'roc', ['maitres', 'genies'], 'soutien', ['maitre', 'legende'], ['Souffle Ancien', 'rayon', 2], ['#e0ac69', '#e8e8f0', '#d8a03a', '#c8913a'], 'chauve'),

  /* ---------------- SSR (le portail permanent) ---------------- */
  p('kael_ssr', 'Kael', 'Cœur de Soleil', 'SSR', 'flamme', ['aube', 'sangchaud', 'heritiers', 'transfo'], 'frappeur', ['rivalite', 'feu', 'amis', 'legende'], ['Rayon du Soleil Levant', 'rayon', 3], ['#f1c27d', '#ffd23f', '#ff7a1a', '#ffd23f'], 'pics', { forme: 'eveil' }),
  p('ryo_ssr', 'Ryo', 'Zéro Absolu', 'SSR', 'maree', ['rivaux', 'aube', 'glace', 'transfo'], 'critique', ['rivalite', 'froid', 'legende'], ['Prison de Glace Éternelle', 'glace', 3], ['#ffe0bd', '#9ad8ff', '#14142a', '#9ad8ff'], 'pics', { forme: 'eveil' }),
  p('mira_ssr', 'Mira', 'Reine des Ombres', 'SSR', 'tempete', ['ombre', 'ninjas', 'combattantes'], 'esquiveur', ['ombres', 'amis', 'instinct'], ['Danse des Cent Ombres', 'ombre', 3], ['#ffe0bd', '#4a3a9a', '#1b1b2a', '#b06bff'], 'queue'),
  p('hiro_ssr', 'Hiro', 'L’Égoïste Ultime', 'SSR', 'eclair', ['neant', 'rivaux', 'sportifs', 'genies'], 'frappeur', ['rivalite', 'instinct', 'equipe'], ['Tir Prédateur', 'tir', 3], ['#f1c27d', '#1b1b1f', '#14142a', '#ffd23f'], 'meches'),
  p('goran_ssr', 'Goran', 'Montagne Vivante', 'SSR', 'roc', ['rivaux', 'allies', 'sangchaud'], 'mur', ['rivalite', 'equipe', 'froid'], ['Écrasement Titanesque', 'explosion', 3], ['#c68642', '#1b1b1f', '#3a2a1a', '#ff9a3a'], 'chauve'),
  p('sel_ssr', 'Sel', 'Voix de l’Océan', 'SSR', 'maree', ['lune', 'combattantes', 'divin'], 'soutien', ['amis', 'froid', 'maitre'], ['Raz-de-Marée Sacré', 'rayon', 3], ['#8d5524', '#e8e8f0', '#1a5aff', '#7ac8ff'], 'long'),
  p('ivo_ssr', 'Ivo', 'Poing Champion', 'SSR', 'flamme', ['arcade', 'rivaux', 'sportifs', 'sangchaud'], 'critique', ['feu', 'rivalite', 'instinct'], ['Rafale du Champion', 'combo', 3], ['#e0ac69', '#3a1a0a', '#ffd23f', '#ff5a36'], 'court'),
  p('ombrelune_ssr', 'Ombrelune', 'Gardienne d’Ambre', 'SSR', 'roc', ['arcade', 'lune', 'combattantes'], 'mur', ['equipe', 'froid', 'amis'], ['Bouclier d’Ambre', 'explosion', 3], ['#ffe0bd', '#ffb347', '#3d6b3a', '#ffd27a'], 'long'),

  /* ---------------- Les vedettes des portails en rotation (sortie : l'indice du portail) ---------------- */
  p('kael_lr', 'Kael', 'Dieu de l’Aube', 'LR', 'flamme', ['aube', 'divin', 'transfo', 'heritiers', 'sangchaud'], 'frappeur', ['rivalite', 'feu', 'legende', 'amis'], ['Aube Infinie', 'meteore', 5], ['#f1c27d', '#ff4d2a', '#ffd23f', '#ff4d2a'], 'pics', { sortie: 0, forme: 'divin', chef: ['aube', 'divin'] }),
  p('noa_ssr', 'Noa', 'Tempête Blanche', 'SSR', 'eclair', ['lune', 'combattantes', 'genies', 'transfo'], 'pivot', ['amis', 'instinct', 'legende'], ['Ciel Fendu', 'rayon', 4], ['#ffe0bd', '#ffffff', '#4a3a8a', '#ffd23f'], 'long', { sortie: 0 }),
  p('vash_lr', 'Vash', 'Le Dernier Samouraï des Brumes', 'LR', 'tempete', ['ombre', 'rivaux', 'solitaire', 'divin'], 'critique', ['ombres', 'rivalite', 'legende'], ['Mille Lames du Néant', 'lame', 5], ['#f1c27d', '#c81a1a', '#1b1b1f', '#36d39a'], 'long', { sortie: 1, chef: ['ombre', 'solitaire'] }),
  p('kira_ssr', 'Kira', 'Ninja du Croissant', 'SSR', 'maree', ['ombre', 'lune', 'ninjas', 'combattantes'], 'esquiveur', ['ombres', 'froid', 'amis'], ['Lune Tranchante', 'ombre', 4], ['#ffe0bd', '#1b1b3a', '#1b2a4a', '#9ad8ff'], 'meches', { sortie: 1 }),
  p('hiro_lr', 'Hiro', 'Monstre du Néant', 'LR', 'eclair', ['neant', 'rivaux', 'sportifs', 'genies', 'transfo'], 'pivot', ['rivalite', 'instinct', 'legende', 'equipe'], ['But de l’Apocalypse', 'tir', 5], ['#f1c27d', '#1b1b1f', '#7a1aff', '#b06bff'], 'meches', { sortie: 2, forme: 'divin', chef: ['neant', 'sportifs'] }),
  p('rin_ssr', 'Rin', 'Le Génie Glacé', 'SSR', 'maree', ['neant', 'rivaux', 'glace', 'genies', 'sportifs'], 'critique', ['rivalite', 'froid', 'equipe'], ['Tir Destructeur', 'tir', 4], ['#ffe0bd', '#1b3a3a', '#14142a', '#36d3c8'], 'meches', { sortie: 2 }),
  p('ko_lr', 'Ko', 'Le Maître des Mille Vies', 'LR', 'roc', ['maitres', 'divin', 'genies', 'heritiers'], 'soutien', ['maitre', 'legende', 'equipe'], ['Paume Originelle', 'explosion', 5], ['#e0ac69', '#ffffff', '#d8a03a', '#ffd27a'], 'chauve', { sortie: 3, forme: 'divin', chef: ['maitres', 'heritiers'] }),
  p('aiko_ssr', 'Aiko', 'Fleur de Foudre', 'SSR', 'eclair', ['lune', 'aube', 'combattantes', 'duo'], 'pivot', ['amis', 'feu', 'instinct'], ['Pétales d’Éclair', 'combo', 4], ['#ffe0bd', '#ff8ad8', '#3a1a4a', '#ff8ad8'], 'queue', { sortie: 3 }),
  p('ryo_lr', 'Ryo', 'Hiver Éternel', 'LR', 'maree', ['rivaux', 'aube', 'glace', 'divin', 'transfo'], 'mur', ['rivalite', 'froid', 'legende'], ['Ère Glaciaire', 'glace', 5], ['#ffe0bd', '#e8f8ff', '#0a0a2a', '#9ad8ff'], 'pics', { sortie: 4, forme: 'divin', chef: ['rivaux', 'glace'] }),
  p('drax_ssr', 'Drax', 'Le Démon Rouge', 'SSR', 'flamme', ['rivaux', 'allies', 'sangchaud', 'solitaire'], 'frappeur', ['rivalite', 'feu', 'ombres'], ['Enfer Pourpre', 'explosion', 4], ['#c86a5a', '#1b1b1f', '#4a0a0a', '#ff2a2a'], 'crete', { sortie: 4 }),
  p('mira_lr', 'Mira', 'L’Ombre Absolue', 'LR', 'tempete', ['ombre', 'ninjas', 'combattantes', 'divin'], 'esquiveur', ['ombres', 'amis', 'legende'], ['Éclipse des Mille Ombres', 'ombre', 5], ['#ffe0bd', '#2a1a6a', '#0a0a1a', '#b06bff'], 'queue', { sortie: 5, forme: 'divin', chef: ['ombre', 'combattantes'] }),
  p('taro_ssr', 'Taro', 'Gardien de But Titan', 'SSR', 'roc', ['neant', 'sportifs', 'allies'], 'mur', ['equipe', 'froid'], ['Main du Colosse', 'explosion', 4], ['#8d5524', '#1b1b1f', '#ff7a1a', '#c8913a'], 'court', { sortie: 5 }),

  /* ---------------- D'autres héros du portail permanent ---------------- */
  p('riku_r', 'Riku', 'Ailier pressé', 'R', 'eclair', ['neant', 'sportifs'], 'pivot', ['equipe', 'instinct'], ['Course Folle', 'combo', 1], ['#f1c27d', '#3a6aff', '#1b3a8a', '#ffd23f'], 'meches'),
  p('riku_sr', 'Riku', 'Le Sprinteur', 'SR', 'eclair', ['neant', 'sportifs', 'rivaux'], 'pivot', ['equipe', 'instinct', 'rivalite'], ['Éclair du Couloir', 'tir', 2], ['#f1c27d', '#3a6aff', '#1b3a8a', '#ffd23f'], 'meches'),
  p('riku_ssr', 'Riku', 'Foudre du Néant', 'SSR', 'eclair', ['neant', 'sportifs', 'rivaux', 'genies'], 'pivot', ['equipe', 'instinct', 'rivalite'], ['Tir Fulgurant', 'tir', 3], ['#f1c27d', '#6a9aff', '#14142a', '#ffd23f'], 'meches'),
  p('yume_r', 'Yume', 'Rêveuse', 'R', 'maree', ['lune', 'combattantes'], 'soutien', ['amis', 'froid'], ['Bulle de Rêve', 'rayon', 1], ['#ffe0bd', '#b06bff', '#3a2a6a', '#b06bff'], 'long'),
  p('yume_sr', 'Yume', 'Tisseuse de Songes', 'SR', 'maree', ['lune', 'combattantes', 'genies'], 'soutien', ['amis', 'froid', 'maitre'], ['Songe Bleu', 'rayon', 2], ['#ffe0bd', '#b06bff', '#3a2a6a', '#b06bff'], 'long'),
  p('yume_ssr', 'Yume', 'Gardienne des Rêves', 'SSR', 'maree', ['lune', 'combattantes', 'genies', 'divin'], 'soutien', ['amis', 'froid', 'maitre'], ['Océan des Songes', 'glace', 3], ['#ffe0bd', '#d8b0ff', '#2a1a5a', '#b06bff'], 'long'),
  p('gaku_r', 'Gaku', 'Novice du dojo', 'R', 'roc', ['maitres', 'heritiers'], 'mur', ['maitre', 'equipe'], ['Coup de Bâton', 'combo', 1], ['#e0ac69', '#1b1b1f', '#7a4a2a', '#c8913a'], 'court'),
  p('sora_r', 'Sora', 'Garçon du ciel', 'R', 'tempete', ['aube', 'heritiers'], 'frappeur', ['amis', 'feu'], ['Rafale', 'rayon', 1], ['#f1c27d', '#8ad8ff', '#3a8a5a', '#36d39a'], 'pics'),
  p('sora_sr', 'Sora', 'Aile du Matin', 'SR', 'tempete', ['aube', 'heritiers', 'sangchaud'], 'frappeur', ['amis', 'feu', 'rivalite'], ['Vent Ascendant', 'rayon', 2], ['#f1c27d', '#8ad8ff', '#3a8a5a', '#36d39a'], 'pics'),
  p('sora_ssr', 'Sora', 'Tempête de l’Aube', 'SSR', 'tempete', ['aube', 'heritiers', 'sangchaud', 'transfo'], 'frappeur', ['amis', 'feu', 'rivalite'], ['Cyclone Solaire', 'rayon', 3], ['#f1c27d', '#c8f0ff', '#2a6a4a', '#36d39a'], 'pics', { forme: 'eveil' }),
  p('tetsu_sr', 'Tetsu', 'Mâchoire d’Acier', 'SR', 'roc', ['rivaux', 'allies', 'arcade'], 'mur', ['rivalite', 'equipe'], ['Coup de Tête', 'combo', 2], ['#c68642', '#6b6b6b', '#3a3a4a', '#c8913a'], 'chauve'),
  p('tetsu_ssr', 'Tetsu', 'Poing d’Acier', 'SSR', 'roc', ['rivaux', 'allies', 'arcade', 'sangchaud'], 'mur', ['rivalite', 'equipe', 'froid'], ['Poing de la Forge', 'explosion', 3], ['#c68642', '#9a9a9a', '#2a2a3a', '#ff9a3a'], 'chauve'),
  p('hana_sr', 'Hana', 'Pétale Brûlant', 'SR', 'flamme', ['combattantes', 'lune'], 'critique', ['feu', 'amis'], ['Lame de Pétales', 'lame', 2], ['#ffe0bd', '#ff4d6d', '#5a0a1a', '#ff8a8a'], 'queue'),
  p('hana_ssr', 'Hana', 'Pétale de Feu', 'SSR', 'flamme', ['combattantes', 'lune', 'sangchaud'], 'critique', ['feu', 'amis', 'ombres'], ['Tempête de Pétales', 'lame', 3], ['#ffe0bd', '#ff2a4a', '#4a0a14', '#ff8a8a'], 'queue'),
  p('zan_ssr', 'Zan', 'Le Rônin', 'SSR', 'tempete', ['ombre', 'solitaire', 'rivaux'], 'critique', ['ombres', 'rivalite'], ['Coupe du Vent Gris', 'lame', 3], ['#e0ac69', '#2a2a2a', '#3a3a3a', '#36d39a'], 'long'),
  p('oboro_ssr', 'Oboro', 'Ninja des Brumes', 'SSR', 'maree', ['ninjas', 'ombre', 'solitaire'], 'esquiveur', ['ombres', 'froid'], ['Voile de Brume', 'ombre', 3], ['#ffe0bd', '#6a6a8a', '#1a2a3a', '#9ad8ff'], 'meches'),

  /* ---------------- Les vedettes des six mois suivants (un portail toutes les deux semaines) ---------------- */
  p('sora_lr', 'Sora', 'L’Héritier du Ciel', 'LR', 'tempete', ['aube', 'heritiers', 'divin', 'transfo'], 'frappeur', ['amis', 'feu', 'legende'], ['Ciel Infini', 'meteore', 5], ['#f1c27d', '#ffffff', '#2a6a4a', '#36d39a'], 'pics', { sortie: 6, forme: 'divin', chef: ['aube', 'heritiers'] }),
  p('nyx_ssr', 'Nyx', 'La Nuit Vivante', 'SSR', 'eclair', ['ombre', 'combattantes', 'solitaire'], 'esquiveur', ['ombres', 'froid'], ['Minuit Électrique', 'ombre', 4], ['#d8c8f0', '#1b1b3a', '#0a0a1a', '#b06bff'], 'long', { sortie: 6 }),
  p('zan_lr', 'Zan', 'Mille Coupes', 'LR', 'tempete', ['ombre', 'solitaire', 'rivaux', 'divin'], 'critique', ['ombres', 'rivalite', 'legende'], ['Mille Coupes du Vent', 'lame', 5], ['#e0ac69', '#e8e8e8', '#1a1a1a', '#36d39a'], 'long', { sortie: 7, forme: 'divin', chef: ['ombre', 'solitaire'] }),
  p('pyro_ssr', 'Pyro', 'Le Lanceur de Feu', 'SSR', 'flamme', ['sportifs', 'sangchaud', 'arcade'], 'frappeur', ['feu', 'equipe'], ['Balle de Feu', 'tir', 4], ['#c68642', '#ff7a1a', '#4a1a0a', '#ff5a36'], 'crete', { sortie: 7 }),
  p('yume_lr', 'Yume', 'Reine des Songes', 'LR', 'maree', ['lune', 'combattantes', 'genies', 'divin'], 'soutien', ['amis', 'froid', 'legende'], ['Éveil des Rêves', 'glace', 5], ['#ffe0bd', '#f0d8ff', '#1a0a4a', '#d8b0ff'], 'long', { sortie: 8, forme: 'divin', chef: ['lune', 'combattantes'] }),
  p('brak_ssr', 'Brak', 'Le Golem Vivant', 'SSR', 'roc', ['allies', 'solitaire'], 'mur', ['equipe', 'froid'], ['Poing de Montagne', 'explosion', 4], ['#8a7a6a', '#3a3a3a', '#5a4a3a', '#c8913a'], 'chauve', { sortie: 8 }),
  p('tetsu_lr', 'Tetsu', 'Titan d’Acier', 'LR', 'roc', ['rivaux', 'allies', 'arcade', 'divin'], 'mur', ['rivalite', 'equipe', 'legende'], ['Forge Titanesque', 'explosion', 5], ['#c68642', '#e8e8e8', '#1a1a2a', '#ff9a3a'], 'chauve', { sortie: 9, forme: 'divin', chef: ['rivaux', 'arcade'] }),
  p('lyra_ssr', 'Lyra', 'Chant du Vent', 'SSR', 'tempete', ['lune', 'combattantes', 'genies'], 'soutien', ['amis', 'maitre'], ['Mélodie des Cimes', 'rayon', 4], ['#ffe0bd', '#8affd8', '#1a4a3a', '#36d39a'], 'long', { sortie: 9 }),
  p('riku_lr', 'Riku', 'L’Éclair Absolu', 'LR', 'eclair', ['neant', 'sportifs', 'rivaux', 'divin'], 'pivot', ['equipe', 'instinct', 'legende'], ['Frappe de l’Orage Divin', 'tir', 5], ['#f1c27d', '#e8f0ff', '#0a0a2a', '#ffd23f'], 'meches', { sortie: 10, forme: 'divin', chef: ['neant', 'rivaux'] }),
  p('kage_ssr', 'Kage', 'L’Ombre du Lac', 'SSR', 'maree', ['ninjas', 'ombre'], 'critique', ['ombres', 'froid'], ['Lame du Lac', 'lame', 4], ['#e0ac69', '#1b1b1f', '#0a1a2a', '#3a8dff'], 'meches', { sortie: 10 }),
  p('hana_lr', 'Hana', 'Floraison Écarlate', 'LR', 'flamme', ['combattantes', 'lune', 'divin', 'transfo'], 'critique', ['feu', 'amis', 'legende'], ['Mille Pétales Ardents', 'meteore', 5], ['#ffe0bd', '#ffd8e8', '#3a0a14', '#ff4d6d'], 'queue', { sortie: 11, forme: 'divin', chef: ['combattantes', 'lune'] }),
  p('ren_ssr', 'Ren', 'Le Stratège', 'SSR', 'eclair', ['genies', 'maitres', 'allies'], 'soutien', ['maitre', 'instinct'], ['Plan Parfait', 'rayon', 4], ['#f1c27d', '#3a3a6a', '#1a1a3a', '#ffd23f'], 'court', { sortie: 11 }),

  /* ---------------- Les célébrations (ils ne se tirent que pendant leur fête) ---------------- */
  p('kael_anniv', 'Kael & Ryo', 'Le Duo de l’Aube Glacée', 'LR', 'flamme', ['aube', 'rivaux', 'fete', 'duo', 'divin'], 'pivot', ['rivalite', 'legende', 'fete', 'feu'], ['Double Aube Glacée', 'meteore', 5], ['#f1c27d', '#ffd23f', '#ffffff', '#ffd23f'], 'pics', { fete: ['lancement', 'anniversaire'], partie: 1, forme: 'divin', chef: ['aube', 'rivaux'] }),
  p('citrouille', 'Morvane', 'La Reine Citrouille', 'LR', 'flamme', ['fete', 'ombre', 'combattantes'], 'critique', ['fete', 'ombres'], ['Nuit des Mille Lanternes', 'ombre', 5], ['#e8d8f0', '#ff7a1a', '#2a0a3a', '#ff7a1a'], 'long', { fete: 'halloween', forme: 'divin', chef: ['fete', 'ombre'] }),
  p('givre', 'Givre', 'L’Esprit de Noël', 'LR', 'maree', ['fete', 'lune', 'glace', 'combattantes'], 'soutien', ['fete', 'froid', 'amis'], ['Tempête de Flocons', 'glace', 5], ['#ffe0bd', '#ffffff', '#c81a2a', '#e8f8ff'], 'long', { fete: 'noel', forme: 'divin', chef: ['fete', 'glace'] }),
  p('aurore', 'Aurore', 'Feu d’Artifice du Nouvel An', 'SSR', 'eclair', ['fete', 'aube', 'combattantes'], 'pivot', ['fete', 'feu'], ['Grand Bouquet Final', 'meteore', 4], ['#ffe0bd', '#ffd23f', '#14142a', '#ff4dd8'], 'queue', { fete: 'nouvelan' }),
  p('cupi', 'Cupi', 'Flèche du Cœur', 'SSR', 'tempete', ['fete', 'duo'], 'esquiveur', ['fete', 'amis'], ['Pluie de Cœurs', 'tir', 4], ['#ffe0bd', '#ff8ad8', '#ff4d6d', '#ff8ad8'], 'meches', { fete: 'valentin' }),
  p('soleil_ete', 'Sol', 'Roi de la Plage', 'SSR', 'maree', ['fete', 'neant', 'sportifs'], 'frappeur', ['fete', 'equipe'], ['Volée de l’Été', 'tir', 4], ['#c68642', '#ffd23f', '#3a8dff', '#ffd23f'], 'court', { fete: 'ete', partie: 1 }),
  p('jumelles_lr', 'Mira & Kira', 'Les Ombres Jumelles', 'LR', 'tempete', ['ombre', 'ninjas', 'combattantes', 'duo', 'fete'], 'esquiveur', ['ombres', 'amis', 'fete', 'legende'], ['Double Éclipse', 'ombre', 5], ['#ffe0bd', '#3a2a8a', '#0a0a1a', '#b06bff'], 'queue', { fete: 'anniversaire', partie: 2, forme: 'divin', chef: ['ombre', 'duo'] }),
  p('neant_duo_lr', 'Hiro & Rin', 'Le Duo du Néant', 'LR', 'eclair', ['neant', 'rivaux', 'sportifs', 'duo', 'fete'], 'frappeur', ['rivalite', 'equipe', 'fete', 'legende'], ['Tir à Deux Têtes', 'tir', 5], ['#f1c27d', '#1b3a3a', '#7a1aff', '#ffd23f'], 'meches', { fete: 'anniversaire', partie: 3, forme: 'divin', chef: ['neant', 'duo'] }),
  p('noa_ete_lr', 'Noa', 'Reine des Vagues', 'LR', 'maree', ['lune', 'combattantes', 'fete', 'transfo'], 'soutien', ['amis', 'froid', 'fete'], ['Vague Céleste', 'rayon', 5], ['#ffe0bd', '#e8f8ff', '#1a5aff', '#7ac8ff'], 'long', { fete: 'ete', partie: 2, forme: 'divin', chef: ['lune', 'fete'] }),
  p('drax_ete_lr', 'Drax', 'Soleil Noir', 'LR', 'flamme', ['rivaux', 'allies', 'sangchaud', 'fete'], 'critique', ['feu', 'rivalite', 'fete'], ['Éclipse Solaire', 'explosion', 5], ['#c86a5a', '#1b1b1f', '#ff7a1a', '#ff2a2a'], 'crete', { fete: 'ete', partie: 3, forme: 'divin', chef: ['rivaux', 'fete'] }),
];
/** L'ordre des raretés. */
export const ORDRE = ['N', 'R', 'SR', 'SSR', 'UR', 'LR'];

/**
 * Les LIGNÉES (comme dans les grands gachas) : les versions d'un même personnage, de la plus faible à la plus
 * forte, qu'on parcourt par les éveils. Les personnages de base d'un même nom forment une lignée (Kael R → SR →
 * SSR → UR) ; une vedette ou un personnage de fête a la sienne ; chaque LR a la sienne : sa forme SSR (celle qu'on
 * tire), puis UR, puis LR. On ne tire jamais un UR ni un LR : on tire la forme la plus basse de la lignée.
 */
export const ligneeDe = (x) => x.lignee || (x.sortie !== undefined || x.fete ? x.id : x.nom);
const BASES_LR = BASE.filter((x) => x.rarete === 'LR').map((x) => {
  x.lignee = x.id;
  const b = { ...x, id: `${x.id}_ssr`, rarete: 'SSR', lignee: x.id, forme: 'eveil', versLR: x.id };
  b.super = creerSuper(b, x.super.nom, x.super.style, Math.max(1, x.super.puissance - 1));
  b.passif = creerPassif(b);
  b.chef = creerChef(b, x.chef.cats);
  return b;
});
/**
 * Les UR : chaque SSR peut s'éveiller en UR (l'éveil par médailles, eveils.js) : la même personne, plus forte
 * (son passif s'allonge, sa super gagne en puissance). Ils ne se tirent jamais.
 */
const UR = [...BASE.filter((x) => x.rarete === 'SSR'), ...BASES_LR].map((x) => {
  const u = { ...x, id: `${x.id}_ur`, rarete: 'UR', base: x.id, lignee: ligneeDe(x), forme: 'eveil', dokkan: true, titre: `${x.titre} · Éveillé` };
  u.super = creerSuper(u, x.super.nom, x.super.style, Math.min(5, x.super.puissance + 1));
  u.passif = creerPassif(u);
  u.chef = creerChef(u, x.chef.cats);
  return u;
});
export const PERSOS = [...BASE, ...BASES_LR, ...UR];
export const PERSO = Object.fromEntries(PERSOS.map((x) => [x.id, x]));
/** Les lignées : { clé: [ids, de la plus faible à la plus forte] }. */
export const LIGNEES = {};
for (const x of PERSOS) (LIGNEES[ligneeDe(x)] ||= []).push(x.id);
for (const l of Object.values(LIGNEES)) l.sort((a, b) => ORDRE.indexOf(PERSO[a].rarete) - ORDRE.indexOf(PERSO[b].rarete));
/** La lignée peut-elle aller jusqu'au LR ? (on la tire alors en SSR, avec une animation spéciale) */
export const peutDevenirLR = (id) => LIGNEES[ligneeDe(PERSO[id])].some((y) => PERSO[y].rarete === 'LR');
/** Le LR d'une lignée (ou null). */
export const formeLR = (id) => LIGNEES[ligneeDe(PERSO[id])].find((y) => PERSO[y].rarete === 'LR') || null;
/** La forme qu'on tire d'une lignée : sa SSR si elle va jusqu'au LR, sinon sa plus basse (hors N). */
const entree = (l) => (l.some((y) => PERSO[y].rarete === 'LR') ? l.find((y) => PERSO[y].rarete === 'SSR') : l.find((y) => PERSO[y].rarete !== 'N'));
/** Les personnages qu'on peut tirer : la forme d'entrée de chaque lignée (jamais un N, un UR ni un LR). */
export const TIRABLE = (x) => !x.dokkan && x.rarete !== 'N' && x.rarete !== 'LR' && entree(LIGNEES[ligneeDe(x)]) === x.id;

/** Le niveau maximum de chaque rareté. */
export const NIV_MAX = { N: 20, R: 40, SR: 60, SSR: 80, UR: 100, LR: 120 };

/**
 * Les statistiques d'un personnage : ses doublons (0 à eveilMax, +8 % chacun) et son niveau (sans niveau :
 * le maximum ; au niveau 1, environ la moitié).
 */
export function stats(id, eveil = 0, niv = null) {
  const x = PERSO[id], R = RARETES[x.rarete];
  const max = NIV_MAX[x.rarete];
  const n = niv === null || niv === undefined ? max : Math.max(1, Math.min(max, niv));
  const k = (1 + 0.08 * eveil) * (0.5 + 0.5 * ((n - 1) / Math.max(1, max - 1)));
  const bonus = x.forme === 'divin' ? 1.08 : x.forme === 'eveil' ? 1.03 : 1;
  return { pv: Math.round(R.pv * k * bonus), atq: Math.round(R.atq * k * bonus), def: Math.round(R.def * k * bonus) };
}
