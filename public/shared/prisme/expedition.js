/**
 * PRISME — l'expédition.
 *
 * Une partie n'est pas un combat mais une traversée : cinq secteurs de trois
 * rencontres, une seule barre de vie qui ne se remplit pas toute seule, et un
 * éveil à choisir entre deux secteurs. On ne recommence pas un combat perdu —
 * on recommence l'expédition. C'est ce qui donne du poids à une potion gardée
 * pour plus tard.
 *
 * Module ISO : ni DOM ni Node.
 */

import { makeRng, entier, melanger } from '../hasard.js';
import { CYCLE } from './affinites.js';
import { instancier, tirerModele, MODELES_PAR_ID } from './ennemis.js';
import { vieMaximale, EVEILS_VIDES } from './combat.js';

export const RENCONTRES_PAR_SECTEUR = 3;

export const SECTEURS = [
  { nom: 'Les Marches Basses', affinite: 'jade',    decor: 'lande',   texte: 'Là où la lumière se pose encore.' },
  { nom: 'La Verrière Brisée', affinite: 'azur',    decor: 'verre',   texte: 'Mille éclats, mille reflets qui mordent.' },
  { nom: 'Les Fours Éteints',  affinite: 'vermeil', decor: 'forge',   texte: 'La chaleur est partie, la colère est restée.' },
  { nom: 'Le Cloître Ambré',   affinite: 'ambre',   decor: 'cloitre', texte: 'Des rouages qui tournent sans personne.' },
  { nom: 'Le Cœur Pourpre',    affinite: 'pourpre', decor: 'abysse',  texte: 'Au fond du prisme, quelque chose regarde.' },
];

export const DIFFICULTES = {
  apprenti:  { nom: 'Apprenti',  part: 0.85, objets: 3, texte: 'Pour découvrir le champ d’orbes.' },
  guerrier:  { nom: 'Guerrier',  part: 1.0,  objets: 2, texte: 'L’expédition telle qu’elle est réglée.' },
  ascension: { nom: 'Ascension', part: 1.1, objets: 1, texte: 'Une erreur de rotation se paie.' },
};

/* ------------------------------------------------------------------ */
/* Éveils                                                              */
/* ------------------------------------------------------------------ */

/**
 * Récompenses de fin de secteur. Chacune est modeste : c'est leur empilement
 * sur quatre secteurs qui doit compenser la montée en puissance du bestiaire,
 * pas une seule carte providentielle.
 */
export const EVEILS = [
  { id: 'poing',   nom: 'Poing de lumière', glyphe: '✊', texte: '+12 % d’attaque à toute l’équipe', effet: { atk: 0.12 } },
  { id: 'egide',   nom: 'Égide',            glyphe: '🛡', texte: '+14 % de défense à toute l’équipe', effet: { def: 0.14 } },
  { id: 'souffle', nom: 'Souffle long',     glyphe: '🫁', texte: '+12 % de vie maximale, et autant de rendu', effet: { pv: 0.12 }, rendu: 0.12 },
  { id: 'veine',   nom: 'Veine de ki',      glyphe: '⚡', texte: '+2 ki au départ de chaque tour', effet: { ki: 2 } },
  { id: 'baume',   nom: 'Baume',            glyphe: '✚', texte: '+30 % à tous les soins', effet: { soin: 0.3 } },
  { id: 'tranchant', nom: 'Tranchant',      glyphe: '🗡', texte: '+9 % de dégâts sur toutes les attaques', effet: { degats: 0.09 } },
  { id: 'fiole',   nom: 'Fiole supplémentaire', glyphe: '🧪', texte: 'Une potion de plus, et 20 % de vie rendue', effet: {}, objets: 1, rendu: 0.2 },
  { id: 'repos',   nom: 'Halte',            glyphe: '🔥', texte: 'Rend 45 % de la vie d’équipe', effet: {}, rendu: 0.45 },
];

export const EVEILS_PAR_ID = Object.fromEntries(EVEILS.map((x) => [x.id, x]));

/* ------------------------------------------------------------------ */
/* Expédition                                                          */
/* ------------------------------------------------------------------ */

export function creerExpedition({ equipe, difficulte = 'guerrier', seed = null } = {}) {
  if (!Array.isArray(equipe) || equipe.length !== 6) throw new Error('PRISME : il faut six héros.');
  const graine = seed ?? Math.floor(Math.random() * 2 ** 31);
  const regle = DIFFICULTES[difficulte] || DIFFICULTES.guerrier;

  const exp = {
    seed: graine,
    rng: makeRng(graine),
    difficulte,
    equipe,
    eveils: { ...EVEILS_VIDES },
    acquis: [],
    secteur: 0,
    rencontre: 0,
    objets: regle.objets,
    vie: 0,
    vieMax: 0,
    vus: [],
    termine: false,
    victoire: false,
    choixEveil: null,
  };
  exp.vieMax = vieMaximale(equipe, exp.eveils);
  exp.vie = exp.vieMax;
  return exp;
}

/** Numéro de rencontre affichable : « secteur 2 · combat 3 ». */
export const etiquette = (exp) =>
  `Secteur ${exp.secteur + 1} · combat ${exp.rencontre + 1}/${RENCONTRES_PAR_SECTEUR}`;

export const secteurCourant = (exp) => SECTEURS[Math.min(exp.secteur, SECTEURS.length - 1)];

/**
 * Compose la rencontre suivante. Le rang monte à l'intérieur du secteur, et
 * l'ultime rencontre du dernier secteur est toujours Le Prisme Noir : une
 * expédition doit avoir une fin reconnaissable.
 */
export function composerRencontre(exp) {
  const sect = secteurCourant(exp);
  const palier = exp.secteur + 1;
  const regle = DIFFICULTES[exp.difficulte] || DIFFICULTES.guerrier;
  const dernierSecteur = exp.secteur === SECTEURS.length - 1;
  const derniere = exp.rencontre === RENCONTRES_PAR_SECTEUR - 1;

  let modeles;
  if (derniere && dernierSecteur) {
    modeles = [MODELES_PAR_ID.prisme];
  } else if (derniere) {
    modeles = [tirerModele(exp.secteur >= 2 ? 'boss' : 'elite', exp.rng, exp.vus)];
  } else if (exp.rencontre === 1) {
    modeles = exp.secteur >= 1
      ? [tirerModele('elite', exp.rng, exp.vus)]
      : [tirerModele('commun', exp.rng, exp.vus), tirerModele('commun', exp.rng, exp.vus)];
  } else {
    modeles = [tirerModele('commun', exp.rng, exp.vus)];
    if (exp.secteur >= 2) modeles.push(tirerModele('commun', exp.rng, [modeles[0].id]));
  }

  exp.vus = modeles.map((m) => m.id);

  // Affinités : celle du secteur domine, mais jamais au point que le joueur
  // n'ait qu'une seule réponse à préparer.
  const ennemis = modeles.map((m, i) => {
    const aff = exp.rng() < 0.55 ? sect.affinite : CYCLE[entier(exp.rng, CYCLE.length)];
    const e = instancier(m, palier, aff, exp.rng);
    e.pvMax = Math.round(e.pvMax * regle.part);
    e.pv = e.pvMax;
    e.atk = Math.round(e.atk * regle.part);
    e.def = Math.round(e.def * regle.part);
    e.place = i;
    return e;
  });

  return {
    ennemis,
    palier,
    secteur: sect,
    boss: derniere,
    finale: derniere && dernierSecteur,
    titre: derniere ? (dernierSecteur ? 'Affrontement final' : 'Gardien du secteur') : 'Rencontre',
  };
}

/**
 * Enregistre l'issue d'un combat et fait avancer l'expédition. Renvoie ce que
 * l'écran doit montrer ensuite : la suite, un choix d'éveil, ou la fin.
 */
export function resoudre(exp, { victoire, vie, objets }) {
  exp.vie = Math.max(0, Math.round(vie));
  exp.objets = objets;

  if (!victoire) {
    exp.termine = true;
    exp.victoire = false;
    return { suite: 'defaite' };
  }

  exp.rencontre++;
  if (exp.rencontre < RENCONTRES_PAR_SECTEUR) return { suite: 'combat' };

  exp.rencontre = 0;
  exp.secteur++;
  if (exp.secteur >= SECTEURS.length) {
    exp.termine = true;
    exp.victoire = true;
    return { suite: 'victoire' };
  }

  exp.choixEveil = proposerEveils(exp);
  return { suite: 'eveil', choix: exp.choixEveil };
}

/** Trois éveils au hasard, jamais deux fois le même acquis non cumulable. */
export function proposerEveils(exp, combien = 3) {
  const pot = EVEILS.filter((x) => x.id === 'repos' || x.id === 'fiole' || !exp.acquis.includes(x.id));
  const liste = melanger([...pot], exp.rng).slice(0, combien);
  return liste.length ? liste : [EVEILS_PAR_ID.repos];
}

export function choisirEveil(exp, id) {
  const eveil = (exp.choixEveil || []).find((x) => x.id === id);
  if (!eveil) return { ok: false, raison: 'inconnu' };

  for (const [cle, valeur] of Object.entries(eveil.effet)) {
    exp.eveils[cle] = (exp.eveils[cle] || 0) + valeur;
  }
  if (eveil.objets) exp.objets += eveil.objets;
  exp.acquis.push(eveil.id);

  // La vie maximale bouge avec les éveils : on conserve la part manquante
  // plutôt que le nombre brut, sinon « +12 % de vie » soignerait à l'envers.
  const part = exp.vieMax ? exp.vie / exp.vieMax : 1;
  exp.vieMax = vieMaximale(exp.equipe, exp.eveils);
  exp.vie = Math.round(exp.vieMax * part);
  if (eveil.rendu) exp.vie = Math.min(exp.vieMax, exp.vie + Math.round(exp.vieMax * eveil.rendu));

  exp.choixEveil = null;
  return { ok: true, eveil };
}

/** Avancement en pour-cent, pour la barre de progression. */
export function avancement(exp) {
  const total = SECTEURS.length * RENCONTRES_PAR_SECTEUR;
  return Math.min(1, (exp.secteur * RENCONTRES_PAR_SECTEUR + exp.rencontre) / total);
}
