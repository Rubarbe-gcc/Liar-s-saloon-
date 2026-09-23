/**
 * PRISME — le bestiaire.
 *
 * Les adversaires ne sont pas des héros retournés : ils ont une seule barre de
 * vie, frappent une fois par tour et arment lentement une attaque chargée que
 * l'on voit venir. Tout l'intérêt du tour par tour tient là — savoir quel tour
 * va faire mal, et décider qui sera devant à ce moment-là.
 *
 * Les statistiques écrites ici valent au palier 1. `instancier` les étire pour
 * les paliers suivants : un seul jeu de chiffres à équilibrer, au lieu de
 * cinquante.
 *
 * Module ISO : ni DOM ni Node.
 */

import { entier, piocher } from '../hasard.js';

/** Traits d'ennemis. Le moteur les lit, l'écran les affiche en pastilles. */
export const TRAITS = {
  blinde:    { nom: 'Blindé',    texte: 'Défense élevée : les attaques normales glissent.' },
  vif:       { nom: 'Vif',       texte: 'Frappe parfois deux fois dans le tour.' },
  venimeux:  { nom: 'Venimeux',  texte: 'Ses coups laissent un venin qui ronge la vie d’équipe.' },
  colereux:  { nom: 'Coléreux',  texte: 'Gagne en attaque à mesure qu’il perd de la vie.' },
  rugueux:   { nom: 'Rugueux',   texte: 'Renvoie une part des dégâts qu’il subit.' },
  vorace:    { nom: 'Vorace',    texte: 'Se soigne d’une part des dégâts infligés.' },
  furieux:   { nom: 'Furieux',   texte: 'Sous la moitié de sa vie, entre en rage définitive.' },
};

/**
 * Silhouettes disponibles côté pixel art (`sprites.js`). Elles ne changent
 * rien aux règles : elles évitent seulement que tout le bestiaire se ressemble.
 */
export const SILHOUETTES = ['rampant', 'carapace', 'colosse', 'spectre'];

const e = (o) => o;

export const MODELES = [
  /* ------------------------------ communs ------------------------------ */
  e({ id: 'glapissant', nom: 'Glapissant', silhouette: 'rampant', rang: 'commun',
      pv: 28000, atk: 3200, def: 1400, traits: ['vif'],
      charge: { nom: 'Morsure en meute', tours: 3, mult: 1.7 } }),
  e({ id: 'carapacon', nom: 'Carapaçon', silhouette: 'carapace', rang: 'commun',
      pv: 34000, atk: 2900, def: 3200, traits: ['blinde'],
      charge: { nom: 'Roulé-boulé', tours: 4, mult: 1.9 } }),
  e({ id: 'bave', nom: 'Bave-de-Lune', silhouette: 'spectre', rang: 'commun',
      pv: 26000, atk: 3300, def: 1200, traits: ['venimeux'],
      charge: { nom: 'Crachat acide', tours: 3, mult: 1.6 } }),
  e({ id: 'pilier', nom: 'Pilier Errant', silhouette: 'colosse', rang: 'commun',
      pv: 37000, atk: 3000, def: 2600, traits: ['rugueux'],
      charge: { nom: 'Écrasement', tours: 4, mult: 2.0 } }),

  /* ------------------------------- élites ------------------------------ */
  e({ id: 'hurleur', nom: 'Hurleur', silhouette: 'rampant', rang: 'elite',
      pv: 44000, atk: 4200, def: 2000, traits: ['colereux', 'vif'],
      charge: { nom: 'Cri de rupture', tours: 3, mult: 2.1 } }),
  e({ id: 'chasseresse', nom: 'Chasseresse Pâle', silhouette: 'spectre', rang: 'elite',
      pv: 40000, atk: 4400, def: 2200, traits: ['vorace'],
      charge: { nom: 'Fauche blême', tours: 3, mult: 2.2 } }),
  e({ id: 'bastion', nom: 'Bastion Rouillé', silhouette: 'carapace', rang: 'elite',
      pv: 52000, atk: 3600, def: 4200, traits: ['blinde', 'rugueux'],
      charge: { nom: 'Herse de fer', tours: 4, mult: 2.3 } }),

  /* -------------------------------- boss ------------------------------- */
  e({ id: 'gardien', nom: 'Gardien du Seuil', silhouette: 'colosse', rang: 'boss',
      pv: 70000, atk: 4300, def: 3400, traits: ['furieux', 'blinde'],
      charge: { nom: 'Verdict', tours: 3, mult: 2.5 } }),
  e({ id: 'archonte', nom: 'Archonte Fêlé', silhouette: 'spectre', rang: 'boss',
      pv: 66000, atk: 4700, def: 3000, traits: ['furieux', 'venimeux'],
      charge: { nom: 'Fêlure du monde', tours: 3, mult: 2.7 } }),
  e({ id: 'prisme', nom: 'Le Prisme Noir', silhouette: 'colosse', rang: 'boss',
      pv: 82000, atk: 5000, def: 3800, traits: ['furieux', 'colereux', 'rugueux'],
      charge: { nom: 'Décomposition', tours: 2, mult: 2.6 } }),
];

export const MODELES_PAR_ID = Object.fromEntries(MODELES.map((m) => [m.id, m]));
export const parRang = (r) => MODELES.filter((m) => m.rang === r);

/**
 * Croissance par palier. Les dégâts montent plus lentement que la vie : sans
 * cela, la fin d'expédition se jouerait à une attaque près, ce qui n'est pas
 * une difficulté mais un couperet.
 */
export const CROISSANCE = { pv: 0.5, atk: 0.36, def: 0.34 };

/** Part de rage prise par un ennemi « furieux » sous la moitié de sa vie. */
export const RAGE = 0.35;

/** Fabrique un ennemi jouable à partir d'un modèle et d'un palier. */
export function instancier(modele, palier = 1, affinite = 'vermeil', rng = Math.random) {
  const k = (part) => 1 + part * (palier - 1);
  const grain = 0.94 + rng() * 0.12;  // deux rencontres identiques ne le sont jamais tout à fait
  const pv = Math.round(modele.pv * k(CROISSANCE.pv) * grain);
  return {
    modeleId: modele.id,
    nom: modele.nom,
    silhouette: modele.silhouette,
    rang: modele.rang,
    affinite,
    pvMax: pv,
    pv,
    atk: Math.round(modele.atk * k(CROISSANCE.atk) * grain),
    def: Math.round(modele.def * k(CROISSANCE.def) * grain),
    traits: [...modele.traits],
    charge: { ...modele.charge, reste: modele.charge.tours },
    enrage: false,
    entrave: null,   // { valeur, tours } posé par un effet allié
    brasier: null,   // { degats, tours }
  };
}

/** Attaque effective, rage et entraves comprises. */
export function attaqueDe(ennemi) {
  let atk = ennemi.atk;
  if (ennemi.enrage) atk *= 1 + RAGE;
  if (ennemi.traits.includes('colereux')) {
    const manque = 1 - ennemi.pv / ennemi.pvMax;
    atk *= 1 + 0.3 * manque;
  }
  if (ennemi.entrave && ennemi.entrave.tours > 0) atk *= 1 - ennemi.entrave.valeur;
  return Math.round(atk);
}

/** Tirage d'un ennemi de rang donné, sans reprendre celui qu'on vient de voir. */
export function tirerModele(rang, rng, eviter = []) {
  const pool = parRang(rang).filter((m) => !eviter.includes(m.id));
  const liste = pool.length ? pool : parRang(rang);
  return liste[entier(rng, liste.length)];
}

export { piocher };
