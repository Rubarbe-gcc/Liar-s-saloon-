/**
 * ÉCHO — les imitateurs de l'ordinateur.
 *
 * Un bot ne reçoit pas une note décidée d'avance : il produit une vraie prise
 * — le son de référence, déformé selon son niveau — qui passe ensuite par le
 * même barème que la vôtre. Deux conséquences qui valent la peine :
 *
 *   · on ENTEND sa prise à la restitution, comme celle d'un joueur humain,
 *     ce qui est la moitié du plaisir du jeu ;
 *   · sa note ne peut pas être plus généreuse que le barème, puisque c'est le
 *     barème qui la calcule. Un bot qui « triche » se verrait tout de suite.
 *
 * Module ISO : il ne rend que des échantillons.
 */

import { rendre, dureeDe } from './sons.js';

/**
 * Les trois niveaux, calibrés pour laisser de la place à une voix humaine.
 *
 * Avertissement honnête : ces chiffres sont réglés contre des prises
 * synthétiques, faute de pouvoir tester au micro depuis l'environnement où ce
 * jeu a été écrit. Ils visent 57 / 71 / 83 de moyenne, ce qui devrait rendre
 * le virtuose battable sans être complaisant — mais c'est la première partie
 * jouée à la voix qui tranchera.
 *
 * Ils ont été relevés quand le barème a appris à pardonner les petits
 * flottements de tempo et les sauts d'octave : cette tolérance est faite pour
 * les voix humaines, pas pour offrir dix points de plus aux bots.
 */
export const NIVEAUX = {
  pouet: {
    key: 'pouet', label: 'Pouet', blurb: 'Il essaie. C\'est déjà ça.',
    demitons: 8.0, tempo: 0.52, attaques: 0.8, souffle: 0.18,
  },
  correct: {
    key: 'correct', label: 'Correct', blurb: 'Il tient la note, la plupart du temps.',
    demitons: 4.0, tempo: 0.36, attaques: 0.5, souffle: 0.1,
  },
  virtuose: {
    key: 'virtuose', label: 'Virtuose', blurb: 'Il a l\'oreille. Agaçant.',
    demitons: 1.8, tempo: 0.17, attaques: 0.25, souffle: 0.05,
  },
};

export const NIVEAU_KEYS = Object.keys(NIVEAUX);

/**
 * Déforme la description d'un son selon le niveau.
 *
 * On déforme la DESCRIPTION, pas le signal : transposer un enregistrement
 * après coup produit un artefact qui s'entend, tandis qu'une note chantée un
 * peu faux reste une note chantée.
 */
export function deformer(son, niveau, rng) {
  const n = NIVEAUX[niveau] || NIVEAUX.correct;
  const demitonBiais = (rng() * 2 - 1) * n.demitons;   // le bot chante dans son registre

  let segments = son.segments.map((seg) => {
    // Erreur de justesse : un biais constant, plus un flottement par note.
    const erreur = demitonBiais + (rng() * 2 - 1) * n.demitons * 0.6;
    const facteur = Math.pow(2, erreur / 12);
    const hz = Array.isArray(seg.hz)
      ? [seg.hz[0] * facteur, seg.hz[1] * facteur]
      : seg.hz * facteur;

    // Erreur de tempo : chaque durée s'étire ou se contracte.
    const etire = 1 + (rng() * 2 - 1) * n.tempo;
    return {
      ...seg,
      hz,
      duree: Math.max(0.05, seg.duree * etire),
      apres: seg.apres ? Math.max(0.01, seg.apres * etire) : seg.apres,
      bruit: Math.min(1, (seg.bruit || 0) + n.souffle),
    };
  });

  // Erreur de compte : il oublie une attaque, ou en ajoute une.
  if (segments.length > 1 && rng() < n.attaques) {
    if (rng() < 0.5) {
      segments.splice(Math.floor(rng() * segments.length), 1);
    } else {
      const i = Math.floor(rng() * segments.length);
      segments.splice(i, 0, { ...segments[i] });
    }
  }

  return { ...son, segments };
}

/**
 * Prise d'un bot : les échantillons de son imitation.
 *
 * @returns {{samples: Float32Array, duree: number}}
 */
export function prise(son, niveau, sampleRate, rng) {
  const deforme = deformer(son, niveau, rng);
  const graine = Math.floor(rng() * 2 ** 30);
  return {
    samples: rendre(deforme, sampleRate, graine),
    duree: dureeDe(deforme),
  };
}

/** Noms des adversaires. */
export const NOMS = [
  'Gargouille', 'Pipelette', 'Sifflard', 'Roucoule', 'Grésillon',
  'Bêlant', 'Trompette', 'Crécelle', 'Glouglou', 'Ronflex',
];

/** Leurs têtes : un bot n'a pas de photo, il a une trogne. */
export const TETES = ['🤖', '👾', '🦜', '🐸', '🐷', '🦊', '🐵', '🐙', '🦆', '🐮'];

/** Constitue `n` adversaires distincts. */
export function adversaires(n, niveau, rng = Math.random) {
  const pool = [...NOMS];
  const tetes = [...TETES];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const nom = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const tete = tetes.splice(Math.floor(rng() * tetes.length), 1)[0];
    out.push({ id: `bot${i}`, name: nom, isBot: true, niveau, tete });
  }
  return out;
}
