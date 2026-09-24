/**
 * RAID — le bestiaire du donjon.
 *
 * Les adversaires ne sont pas des héros retournés : une seule barre de vie,
 * une attaque par tour, et surtout une **incantation** qu'on voit monter —
 * le compte à rebours est affiché sous eux. Tout l'intérêt du tour par tour
 * tient là : savoir quel tour va faire mal, et décider qui sera devant.
 *
 * Les chiffres écrits ici valent au premier palier. `instancier` les étire
 * pour les suivants : un seul jeu de valeurs à équilibrer au lieu de
 * cinquante.
 *
 * Module ISO : ni DOM ni Node.
 */

import { entier, piocher } from '../hasard.js';

/** Capacités passives d'un adversaire, affichées en pastilles sous lui. */
export const TRAITS = {
  carapace: { nom: 'Carapace',  texte: 'Armure épaisse : les auto-attaques glissent dessus.' },
  frenesie: { nom: 'Frénésie',  texte: 'Frappe parfois deux fois dans le tour.' },
  poison:   { nom: 'Poison',    texte: 'Ses coups laissent un poison qui ronge la vie du raid.' },
  fureur:   { nom: 'Fureur',    texte: 'Gagne en attaque à mesure qu’il perd de la vie.' },
  epines:   { nom: 'Épines',    texte: 'Renvoie une part des dégâts qu’il encaisse.' },
  drain:    { nom: 'Drain',     texte: 'Se soigne d’une part des dégâts qu’il inflige.' },
  enrage:   { nom: 'Enrage',    texte: 'Sous la moitié de sa vie, entre en rage définitive.' },
};

/**
 * Silhouettes disponibles côté pixel art (`sprites.js`). Elles ne changent
 * rien aux règles : elles évitent que tout le bestiaire se ressemble.
 */
export const SILHOUETTES = ['bete', 'brute', 'colosse', 'spectre'];

const e = (o) => o;

export const MODELES = [
  /* ------------------------------- trash ------------------------------ */
  e({ id: 'gnoll', nom: 'Gnoll rôdeur', silhouette: 'bete', rang: 'trash',
      pv: 28000, atk: 3200, def: 1400, traits: ['frenesie'],
      charge: { nom: 'Morsure en meute', tours: 3, mult: 1.7 } }),
  e({ id: 'ogre', nom: 'Ogre de garde', silhouette: 'brute', rang: 'trash',
      pv: 34000, atk: 2900, def: 3200, traits: ['carapace'],
      charge: { nom: 'Coup de massue', tours: 4, mult: 1.9 } }),
  e({ id: 'vase', nom: 'Vase rampante', silhouette: 'spectre', rang: 'trash',
      pv: 26000, atk: 3300, def: 1200, traits: ['poison'],
      charge: { nom: 'Crachat acide', tours: 3, mult: 1.6 } }),
  e({ id: 'golem', nom: 'Golem de pierre', silhouette: 'colosse', rang: 'trash',
      pv: 37000, atk: 3000, def: 2600, traits: ['epines'],
      charge: { nom: 'Écrasement', tours: 4, mult: 2.0 } }),

  /* ------------------------------- élites ------------------------------ */
  e({ id: 'hurlefer', nom: 'Hurlefer', silhouette: 'bete', rang: 'elite',
      pv: 44000, atk: 4200, def: 2000, traits: ['fureur', 'frenesie'],
      charge: { nom: 'Hurlement brisant', tours: 3, mult: 2.1 } }),
  e({ id: 'banshie', nom: 'Banshie pâle', silhouette: 'spectre', rang: 'elite',
      pv: 40000, atk: 4400, def: 2200, traits: ['drain'],
      charge: { nom: 'Lamentation', tours: 3, mult: 2.2 } }),
  e({ id: 'sentinelle', nom: 'Sentinelle de fer', silhouette: 'brute', rang: 'elite',
      pv: 52000, atk: 3600, def: 4200, traits: ['carapace', 'epines'],
      charge: { nom: 'Herse de fer', tours: 4, mult: 2.3 } }),

  /* -------------------------------- boss ------------------------------- */
  e({ id: 'vorgath', nom: 'Vorgath le Boucher', silhouette: 'colosse', rang: 'boss',
      pv: 70000, atk: 4300, def: 3400, traits: ['enrage', 'carapace'],
      charge: { nom: 'Fendoir', tours: 3, mult: 2.5 } }),
  e({ id: 'nelizar', nom: 'Nélizar, l’Archiliche', silhouette: 'spectre', rang: 'boss',
      pv: 66000, atk: 4700, def: 3000, traits: ['enrage', 'poison'],
      charge: { nom: 'Fracture des âmes', tours: 3, mult: 2.7 } }),
  e({ id: 'sarkhavel', nom: 'Sarkhavel, le Dragon Cendré', silhouette: 'colosse', rang: 'boss',
      pv: 82000, atk: 5000, def: 3800, traits: ['enrage', 'fureur', 'epines'],
      charge: { nom: 'Souffle cendré', tours: 2, mult: 2.6 } }),
];

export const MODELES_PAR_ID = Object.fromEntries(MODELES.map((m) => [m.id, m]));
export const parRang = (r) => MODELES.filter((m) => m.rang === r);

/** Le boss de fin de donjon : celui qu'on vient chercher. */
export const BOSS_FINAL = 'sarkhavel';

/**
 * Croissance par palier. Les dégâts montent plus lentement que la vie : sans
 * cela, la dernière aile se jouerait à une attaque près, ce qui n'est pas une
 * difficulté mais un couperet.
 */
export const CROISSANCE = { pv: 0.5, atk: 0.36, def: 0.34 };

/** Part de rage prise par un adversaire enragé. */
export const RAGE = 0.35;

/** Fabrique un adversaire jouable à partir d'un modèle et d'un palier. */
export function instancier(modele, palier = 1, ecole = 'feu', rng = Math.random) {
  const k = (part) => 1 + part * (palier - 1);
  const grain = 0.94 + rng() * 0.12;  // deux rencontres identiques ne le sont jamais tout à fait
  const pv = Math.round(modele.pv * k(CROISSANCE.pv) * grain);
  return {
    modeleId: modele.id,
    nom: modele.nom,
    silhouette: modele.silhouette,
    rang: modele.rang,
    ecole,
    pvMax: pv,
    pv,
    atk: Math.round(modele.atk * k(CROISSANCE.atk) * grain),
    def: Math.round(modele.def * k(CROISSANCE.def) * grain),
    traits: [...modele.traits],
    charge: { ...modele.charge, reste: modele.charge.tours },
    enrage: false,
    entrave: null,   // { valeur, tours } posé par un affaiblissement allié
    brasier: null,   // { degats, tours } posé par un dot
  };
}

/** Attaque effective, rage et affaiblissements compris. */
export function attaqueDe(ennemi) {
  let atk = ennemi.atk;
  if (ennemi.enrage) atk *= 1 + RAGE;
  if (ennemi.traits.includes('fureur')) {
    const manque = 1 - ennemi.pv / ennemi.pvMax;
    atk *= 1 + 0.3 * manque;
  }
  if (ennemi.entrave && ennemi.entrave.tours > 0) atk *= 1 - ennemi.entrave.valeur;
  return Math.round(atk);
}

/** Tirage d'un adversaire de rang donné, sans reprendre celui qu'on quitte. */
export function tirerModele(rang, rng, eviter = []) {
  const pool = parRang(rang).filter((m) => !eviter.includes(m.id));
  const liste = pool.length ? pool : parRang(rang);
  return liste[entier(rng, liste.length)];
}

export { piocher };
