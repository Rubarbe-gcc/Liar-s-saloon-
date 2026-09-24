/**
 * RAID — le donjon et sa progression.
 *
 * Une partie n'est pas un combat mais une descente : cinq ailes de trois
 * rencontres, une seule barre de vie qui ne se remplit pas toute seule, et
 * une pièce de butin à choisir après chaque boss d'aile. On ne recommence
 * pas un combat perdu — on recommence le donjon. C'est ce qui donne son prix
 * à une potion gardée pour plus tard.
 *
 * Module ISO : ni DOM ni Node.
 */

import { makeRng, entier, melanger } from '../hasard.js';
import { CYCLE } from './ecoles.js';
import { instancier, tirerModele, MODELES_PAR_ID, BOSS_FINAL } from './ennemis.js';
import { vieMaximale, BUTIN_VIDE } from './combat.js';

export const RENCONTRES_PAR_AILE = 3;

export const AILES = [
  { nom: 'Les Galeries Noyées', ecole: 'nature', decor: 'galerie',
    texte: 'L’eau monte, et quelque chose nage dedans.' },
  { nom: 'Le Cloître Profané', ecole: 'ombre', decor: 'cloitre',
    texte: 'On y priait. On y prie encore, mais pas la même chose.' },
  { nom: 'La Forge Ardente', ecole: 'feu', decor: 'forge',
    texte: 'Les soufflets tournent, et personne ne les tient.' },
  { nom: 'Le Sanctuaire Gelé', ecole: 'givre', decor: 'sanctuaire',
    texte: 'Tout y est intact. Tout y est figé.' },
  { nom: 'Le Pic de l’Aube', ecole: 'sacre', decor: 'pic',
    texte: 'Au sommet, le Dragon Cendré attend son heure.' },
];

export const DIFFICULTES = {
  normal:    { nom: 'Normal',   part: 0.85, objets: 3, texte: 'Pour apprendre les mécaniques.' },
  heroique:  { nom: 'Héroïque', part: 1.0,  objets: 2, texte: 'Le donjon tel qu’il est réglé.' },
  mythique:  { nom: 'Mythique', part: 1.1,  objets: 1, texte: 'Une erreur de placement se paie.' },
};

/* ------------------------------------------------------------------ */
/* Butin                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ce que lâche un boss d'aile. Chaque pièce est modeste : c'est son
 * empilement sur quatre ailes qui doit compenser la montée du bestiaire, pas
 * une seule trouvaille providentielle.
 */
export const BUTIN = [
  { id: 'heaume', nom: 'Heaume de bataille', glyphe: '⛑', rarete: 'rare',
    texte: '+12 % d’attaque à tout le raid', effet: { atk: 0.12 } },
  { id: 'plastron', nom: 'Plastron runique', glyphe: '🛡', rarete: 'rare',
    texte: '+14 % d’armure à tout le raid', effet: { def: 0.14 } },
  { id: 'talisman', nom: 'Talisman de vitalité', glyphe: '💠', rarete: 'rare',
    texte: '+12 % de vie maximale, et autant de rendu', effet: { pv: 0.12 }, rendu: 0.12 },
  { id: 'anneau', nom: 'Anneau de mana', glyphe: '💍', rarete: 'rare',
    texte: '+2 mana au départ de chaque tour', effet: { mana: 2 } },
  { id: 'sceptre', nom: 'Sceptre de vie', glyphe: '🔮', rarete: 'epique',
    texte: '+30 % à tous les soins', effet: { soin: 0.3 } },
  { id: 'lame', nom: 'Lame affûtée', glyphe: '🗡', rarete: 'epique',
    texte: '+9 % de dégâts sur tous les sorts', effet: { degats: 0.09 } },
  { id: 'sacoche', nom: 'Sacoche de potions', glyphe: '🧪', rarete: 'commun',
    texte: 'Une potion de plus, et 20 % de vie rendue', effet: {}, objets: 1, rendu: 0.2 },
  { id: 'repos', nom: 'Feu de camp', glyphe: '🔥', rarete: 'commun',
    texte: 'Le raid souffle : 45 % de la vie rendue', effet: {}, rendu: 0.45 },
];

export const BUTIN_PAR_ID = Object.fromEntries(BUTIN.map((x) => [x.id, x]));

/** Couleurs de rareté, dans la convention du genre. */
export const RARETES = {
  commun: { nom: 'commun', teinte: '#9fd66f' },
  rare:   { nom: 'rare',   teinte: '#5ea9ff' },
  epique: { nom: 'épique', teinte: '#c77dff' },
};

/* ------------------------------------------------------------------ */
/* Donjon                                                              */
/* ------------------------------------------------------------------ */

export function creerDonjon({ groupe, difficulte = 'heroique', seed = null } = {}) {
  if (!Array.isArray(groupe) || groupe.length !== 6) throw new Error('RAID : il faut six personnages.');
  const graine = seed ?? Math.floor(Math.random() * 2 ** 31);
  const regle = DIFFICULTES[difficulte] || DIFFICULTES.heroique;

  const run = {
    seed: graine,
    rng: makeRng(graine),
    difficulte,
    groupe,
    equipe: groupe,              // le moteur de combat parle d'équipe
    butin: { ...BUTIN_VIDE },
    acquis: [],
    aile: 0,
    rencontre: 0,
    objets: regle.objets,
    vie: 0,
    vieMax: 0,
    vus: [],
    termine: false,
    victoire: false,
    choixButin: null,
  };
  run.vieMax = vieMaximale(groupe, run.butin);
  run.vie = run.vieMax;
  return run;
}

/** Numéro de rencontre affichable : « aile 2 · pull 3 ». */
export const etiquette = (run) =>
  `Aile ${run.aile + 1} · pull ${run.rencontre + 1}/${RENCONTRES_PAR_AILE}`;

export const aileCourante = (run) => AILES[Math.min(run.aile, AILES.length - 1)];

/**
 * Compose la rencontre suivante. Le rang monte à l'intérieur de l'aile, et la
 * dernière rencontre du donjon est toujours le Dragon Cendré : une descente
 * doit avoir une fin reconnaissable.
 */
export function composerRencontre(run) {
  const aile = aileCourante(run);
  const palier = run.aile + 1;
  const regle = DIFFICULTES[run.difficulte] || DIFFICULTES.heroique;
  const derniereAile = run.aile === AILES.length - 1;
  const derniere = run.rencontre === RENCONTRES_PAR_AILE - 1;

  let modeles;
  if (derniere && derniereAile) {
    modeles = [MODELES_PAR_ID[BOSS_FINAL]];
  } else if (derniere) {
    modeles = [tirerModele(run.aile >= 2 ? 'boss' : 'elite', run.rng, run.vus)];
  } else if (run.rencontre === 1) {
    modeles = run.aile >= 1
      ? [tirerModele('elite', run.rng, run.vus)]
      : [tirerModele('trash', run.rng, run.vus), tirerModele('trash', run.rng, run.vus)];
  } else {
    modeles = [tirerModele('trash', run.rng, run.vus)];
    if (run.aile >= 2) modeles.push(tirerModele('trash', run.rng, [modeles[0].id]));
  }

  run.vus = modeles.map((m) => m.id);

  // Écoles : celle de l'aile domine, mais jamais au point que le joueur n'ait
  // qu'une seule réponse à préparer.
  const ennemis = modeles.map((m, i) => {
    const ecole = run.rng() < 0.55 ? aile.ecole : CYCLE[entier(run.rng, CYCLE.length)];
    const e = instancier(m, palier, ecole, run.rng);
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
    aile,
    boss: derniere,
    finale: derniere && derniereAile,
    titre: derniere ? (derniereAile ? 'Boss de fin' : 'Boss d’aile') : 'Pull',
  };
}

/**
 * Enregistre l'issue d'un combat et fait avancer le donjon. Renvoie ce que
 * l'écran doit montrer ensuite : la suite, un choix de butin, ou la fin.
 */
export function resoudre(run, { victoire, vie, objets }) {
  run.vie = Math.max(0, Math.round(vie));
  run.objets = objets;

  if (!victoire) {
    run.termine = true;
    run.victoire = false;
    return { suite: 'wipe' };
  }

  run.rencontre++;
  if (run.rencontre < RENCONTRES_PAR_AILE) return { suite: 'combat' };

  run.rencontre = 0;
  run.aile++;
  if (run.aile >= AILES.length) {
    run.termine = true;
    run.victoire = true;
    return { suite: 'victoire' };
  }

  run.choixButin = proposerButin(run);
  return { suite: 'butin', choix: run.choixButin };
}

/** Trois pièces au hasard ; les consommables peuvent retomber, pas le reste. */
export function proposerButin(run, combien = 3) {
  const pot = BUTIN.filter((x) => x.id === 'repos' || x.id === 'sacoche' || !run.acquis.includes(x.id));
  const liste = melanger([...pot], run.rng).slice(0, combien);
  return liste.length ? liste : [BUTIN_PAR_ID.repos];
}

export function choisirButin(run, id) {
  const piece = (run.choixButin || []).find((x) => x.id === id);
  if (!piece) return { ok: false, raison: 'inconnu' };

  for (const [cle, valeur] of Object.entries(piece.effet)) {
    run.butin[cle] = (run.butin[cle] || 0) + valeur;
  }
  if (piece.objets) run.objets += piece.objets;
  run.acquis.push(piece.id);

  // La vie maximale bouge avec le butin : on conserve la part manquante
  // plutôt que le nombre brut, sinon « +12 % de vie » soignerait à l'envers.
  const part = run.vieMax ? run.vie / run.vieMax : 1;
  run.vieMax = vieMaximale(run.groupe, run.butin);
  run.vie = Math.round(run.vieMax * part);
  if (piece.rendu) run.vie = Math.min(run.vieMax, run.vie + Math.round(run.vieMax * piece.rendu));

  run.choixButin = null;
  return { ok: true, piece };
}

/** Avancement en pour-cent, pour la barre de progression. */
export function avancement(run) {
  const total = AILES.length * RENCONTRES_PAR_AILE;
  return Math.min(1, (run.aile * RENCONTRES_PAR_AILE + run.rencontre) / total);
}
