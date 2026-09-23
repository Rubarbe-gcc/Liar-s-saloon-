/**
 * ÉCHO — moteur de partie.
 *
 * Module ISO : il fait tourner aussi bien une partie locale contre
 * l'ordinateur qu'un salon en ligne arbitré par le serveur.
 *
 * Une manche suit six étapes, toujours les mêmes :
 *   1. le son de référence joue une fois, pour tout le monde en même temps ;
 *   2. tout le monde enregistre sur le même compte à rebours ;
 *   3. il n'y a pas de seconde prise ;
 *   4. les prises sont rejouées une par une, les autres se taisent ;
 *   5. le barème note ;
 *   6. la roue tourne.
 *
 * Le sabotage ne touche QUE la restitution : la note se calcule toujours sur
 * le signal propre. C'est ce qui le rend drôle sans le rendre injuste — on
 * humilie son voisin, on ne lui vole pas ses points.
 */

import { SONS, getSon, tirage, dureeDe } from './sons.js';

export const MANCHES = 4;
export const JOUEURS_MAX = 5;

/** Durée laissée pour enregistrer, en secondes. */
export const DUREE_PRISE = 4;
/** La roue n'apparaît qu'à partir de cette manche. */
export const MANCHE_ROUE = 2;

export const PHASE = {
  ECOUTE: 'ecoute',
  ENREGISTREMENT: 'enregistrement',
  RESTITUTION: 'restitution',
  NOTES: 'notes',
  ROUE: 'roue',
  FIN: 'fin',
};

/* ------------------------------------------------------------------ */
/* La roue                                                             */
/* ------------------------------------------------------------------ */

/**
 * Les cases. `points` s'ajoute au score, `sabotage` vise une victime dont la
 * prochaine restitution sera déformée.
 */
export const CASES = [
  { key: 'jackpot', label: 'Jackpot', glyph: '💰', color: '#ffd84d', poids: 2,
    points: 40, blurb: 'Quarante points, sans rien faire.' },
  { key: 'pactole', label: 'Petit pactole', glyph: '🪙', color: '#fbbf24', poids: 4,
    points: 20, blurb: 'Vingt points pour la route.' },
  { key: 'miette', label: 'Miettes', glyph: '🫧', color: '#94a3b8', poids: 4,
    points: 8, blurb: 'Huit points. C\'est toujours ça.' },
  { key: 'sature', label: 'Saturation', glyph: '🔊', color: '#ff3d68', poids: 3,
    sabotage: 'sature', blurb: 'Sa prochaine prise sortira dans le rouge.' },
  { key: 'echo', label: 'Écho', glyph: '🌀', color: '#a78bfa', poids: 3,
    sabotage: 'echo', blurb: 'Sa prochaine prise résonnera comme dans un tunnel.' },
  { key: 'hache', label: 'Hachoir', glyph: '🔪', color: '#f472b6', poids: 3,
    sabotage: 'hache', blurb: 'Sa prochaine prise sera découpée en morceaux.' },
  { key: 'canard', label: 'Coin-coin', glyph: '🦆', color: '#4ade80', poids: 2,
    sabotage: 'canard', blurb: 'Sa voix sera remplacée par un canard. Purement et simplement.' },
  { key: 'rien', label: 'Rien du tout', glyph: '🕳️', color: '#655c8f', poids: 3,
    blurb: 'La roue ne vous doit rien.' },
];

export const SABOTAGES = {
  sature: { key: 'sature', label: 'Saturation', glyph: '🔊' },
  echo: { key: 'echo', label: 'Écho', glyph: '🌀' },
  hache: { key: 'hache', label: 'Hachoir', glyph: '🔪' },
  canard: { key: 'canard', label: 'Coin-coin', glyph: '🦆' },
};

/* ------------------------------------------------------------------ */

export function makeRng(seed = Date.now()) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tire une case au sort, selon les poids. */
export function tirerCase(rng) {
  const total = CASES.reduce((a, c) => a + c.poids, 0);
  let x = rng() * total;
  for (const c of CASES) { x -= c.poids; if (x <= 0) return c; }
  return CASES[CASES.length - 1];
}

/**
 * @param {Array<{id:string,name:string,isBot?:boolean}>} joueurs
 * @param {{seed?:number, manches?:number}} [options]
 */
export function creerPartie(joueurs, options = {}) {
  if (!joueurs.length || joueurs.length > JOUEURS_MAX) {
    throw new Error(`il faut de 1 à ${JOUEURS_MAX} joueurs`);
  }
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = makeRng(seed);
  const manches = options.manches ?? MANCHES;

  return {
    seed,
    rng,
    manches,
    manche: 1,
    phase: PHASE.ECOUTE,
    programme: tirage(manches, rng),
    joueurs: joueurs.map((j) => ({
      id: j.id,
      name: j.name,
      isBot: !!j.isBot,
      score: 0,
      prises: [],        // une par manche : { note, detail }
      sabotage: null,    // subi à la manche en cours
      aTourne: false,    // a déjà utilisé la roue cette manche
    })),
    tour: null,          // index du joueur dont la prise est rejouée
    log: [],
    effets: [],
  };
}

export const sonDeLaManche = (etat) => getSon(etat.programme[etat.manche - 1]);
export const joueurDe = (etat, id) => etat.joueurs.find((j) => j.id === id) || null;

function journal(etat, texte) {
  etat.log.push({ manche: etat.manche, texte });
  if (etat.log.length > 60) etat.log.shift();
}

/* ------------------------------------------------------------------ */
/* Déroulement                                                         */
/* ------------------------------------------------------------------ */

/** Fin de l'écoute : on passe à l'enregistrement. */
export function lancerEnregistrement(etat) {
  if (etat.phase !== PHASE.ECOUTE) return { ok: false, error: 'phase' };
  etat.phase = PHASE.ENREGISTREMENT;
  etat.effets = [];
  for (const j of etat.joueurs) j.prises[etat.manche - 1] = null;
  journal(etat, `Manche ${etat.manche} — à vous.`);
  return { ok: true };
}

/**
 * Dépose la prise d'un joueur. On ne transmet que son analyse : le barème ne
 * doit pas dépendre de ce que le client veut bien raconter, et une note
 * calculée ici est la même pour tout le monde.
 */
export function deposerPrise(etat, joueurId, note) {
  if (etat.phase !== PHASE.ENREGISTREMENT) return { ok: false, error: 'phase' };
  const j = joueurDe(etat, joueurId);
  if (!j) return { ok: false, error: 'joueur inconnu' };
  if (j.prises[etat.manche - 1]) return { ok: false, error: 'déjà déposée' };

  j.prises[etat.manche - 1] = {
    note: Math.max(0, Math.min(100, Math.round(note.total))),
    melodie: note.melodie,
    rythme: note.rythme,
    attaques: note.attaques,
  };
  return { ok: true };
}

/** Tout le monde a-t-il déposé ? */
export const prisesCompletes = (etat) =>
  etat.joueurs.every((j) => j.prises[etat.manche - 1]);

/** Passe à la restitution, prise par prise. */
export function lancerRestitution(etat) {
  if (etat.phase !== PHASE.ENREGISTREMENT) return { ok: false, error: 'phase' };
  // Une prise manquante vaut zéro : on n'attend pas indéfiniment.
  for (const j of etat.joueurs) {
    if (!j.prises[etat.manche - 1]) {
      j.prises[etat.manche - 1] = { note: 0, melodie: 0, rythme: 0, attaques: 0, absente: true };
    }
  }
  etat.phase = PHASE.RESTITUTION;
  etat.tour = 0;
  return { ok: true };
}

/** Prise suivante ; renvoie `false` quand il n'y en a plus. */
export function restitutionSuivante(etat) {
  if (etat.phase !== PHASE.RESTITUTION) return false;
  etat.tour += 1;
  if (etat.tour < etat.joueurs.length) return true;
  etat.tour = null;
  etat.phase = PHASE.NOTES;
  return false;
}

/** Ajoute les notes de la manche aux scores, et consomme les sabotages. */
export function encaisserNotes(etat) {
  if (etat.phase !== PHASE.NOTES) return { ok: false, error: 'phase' };
  for (const j of etat.joueurs) {
    const p = j.prises[etat.manche - 1];
    j.score += p ? p.note : 0;
    // Le sabotage n'a duré qu'une restitution.
    j.sabotage = null;
  }
  const meilleur = [...etat.joueurs].sort((a, b) =>
    (b.prises[etat.manche - 1]?.note || 0) - (a.prises[etat.manche - 1]?.note || 0))[0];
  if (meilleur) {
    journal(etat, `${meilleur.name} remporte la manche `
      + `(${meilleur.prises[etat.manche - 1].note} points).`);
  }

  // La phase ne devient ROUE que si la roue s'applique. Elle NE devient pas
  // FIN dans le cas contraire : cette phase-là signifie « partie terminée »,
  // et s'en servir comme fourre-tout faisait avancer la manche deux fois —
  // la deuxième manche disparaissait purement et simplement.
  if (etat.manche >= MANCHE_ROUE) {
    etat.phase = PHASE.ROUE;
    for (const j of etat.joueurs) j.aTourne = false;
  }
  return { ok: true, roue: etat.phase === PHASE.ROUE };
}

/**
 * Fait tourner la roue pour un joueur.
 *
 * On peut s'en passer : la roue donne parfois du vide, et refuser de la
 * tourner est une décision comme une autre.
 */
export function tournerRoue(etat, joueurId) {
  if (etat.phase !== PHASE.ROUE) return { ok: false, error: 'phase' };
  const j = joueurDe(etat, joueurId);
  if (!j) return { ok: false, error: 'joueur inconnu' };
  if (j.aTourne) return { ok: false, error: 'déjà tourné' };

  const c = tirerCase(etat.rng);
  j.aTourne = true;

  if (c.points) {
    j.score += c.points;
    journal(etat, `${j.name} tire ${c.label} : +${c.points} points.`);
    return { ok: true, case: c };
  }
  if (c.sabotage) {
    // La victime se choisit ensuite : c'est là tout le sel.
    j.sabotageEnMain = c.sabotage;
    journal(etat, `${j.name} tire ${c.label}. À qui ?`);
    return { ok: true, case: c, viser: true };
  }
  journal(etat, `${j.name} tire ${c.label}.`);
  return { ok: true, case: c };
}

/** Renonce à tourner. */
export function passerRoue(etat, joueurId) {
  if (etat.phase !== PHASE.ROUE) return { ok: false, error: 'phase' };
  const j = joueurDe(etat, joueurId);
  if (!j || j.aTourne) return { ok: false, error: 'déjà tourné' };
  j.aTourne = true;
  return { ok: true, case: null };
}

/** Désigne la victime d'un sabotage tiré. */
export function viser(etat, joueurId, victimeId) {
  const j = joueurDe(etat, joueurId);
  if (!j || !j.sabotageEnMain) return { ok: false, error: 'aucun sabotage en main' };
  const v = joueurDe(etat, victimeId);
  if (!v) return { ok: false, error: 'victime inconnue' };
  if (v.id === j.id) return { ok: false, error: 'pas sur soi-même' };

  v.sabotage = j.sabotageEnMain;
  const s = SABOTAGES[j.sabotageEnMain];
  journal(etat, `${j.name} inflige ${s.label} à ${v.name}.`);
  j.sabotageEnMain = null;
  return { ok: true, sabotage: s.key, victime: v.id };
}

/** Tout le monde a-t-il fini avec la roue ? */
export const roueTerminee = (etat) =>
  etat.joueurs.every((j) => j.aTourne && !j.sabotageEnMain);

/** Passe à la manche suivante, ou termine la partie. */
export function finirOuContinuer(etat) {
  if (etat.manche >= etat.manches) {
    etat.phase = PHASE.FIN;
    const classement = [...etat.joueurs].sort((a, b) => b.score - a.score);
    etat.vainqueur = classement[0] && classement[0].score > 0 ? classement[0].id : null;
    journal(etat, etat.vainqueur
      ? `${joueurDe(etat, etat.vainqueur).name} remporte la partie.`
      : 'Personne ne s\'est distingué.');
    return { ok: true, fini: true };
  }
  etat.manche += 1;
  etat.phase = PHASE.ECOUTE;
  etat.tour = null;
  return { ok: true, fini: false };
}

/** Classement courant, du meilleur au dernier. */
export const classement = (etat) =>
  [...etat.joueurs].sort((a, b) => b.score - a.score);

/* ------------------------------------------------------------------ */
/* Vue client                                                          */
/* ------------------------------------------------------------------ */

/**
 * Le son de la manche n'est pas caché : tout le monde l'entend. En revanche
 * les manches à venir le sont — les connaître d'avance permettrait de
 * s'entraîner pendant que les autres jouent.
 */
export function viewFor(etat, viewerId) {
  const moi = etat.joueurs.findIndex((j) => j.id === viewerId);
  return {
    manche: etat.manche,
    manches: etat.manches,
    phase: etat.phase,
    sonId: etat.phase === PHASE.ECOUTE || etat.phase !== PHASE.FIN
      ? etat.programme[etat.manche - 1] : null,
    tour: etat.tour,
    viewer: moi < 0 ? 0 : moi,
    vainqueur: etat.vainqueur ?? null,
    joueurs: etat.joueurs.map((j) => ({
      id: j.id,
      name: j.name,
      isBot: j.isBot,
      score: j.score,
      aDepose: !!j.prises[etat.manche - 1],
      sabotage: j.sabotage,
      aTourne: j.aTourne,
      viseEnCours: !!j.sabotageEnMain,
      prise: etat.phase === PHASE.ENREGISTREMENT ? null : (j.prises[etat.manche - 1] || null),
    })),
    log: etat.log.slice(-5),
  };
}
