/**
 * STREET COMBAT — les replays.
 *
 * Module ISO. Le moteur est déterministe : un combat, ce sont ses réglages
 * (combattants, graine, rounds…) et les entrées des deux joueurs, image par
 * image. Rejouer ces entrées refait exactement le même combat. On garde
 * donc les réglages, les entrées (dix touches → un nombre ; les suites
 * d'images identiques sont regroupées) et les appels à l'allié.
 */

const TOUCHES = ['g', 'd', 'h', 'b', 'P', 'K', 'G', 'A', 'B', 'U'];
export const coder = (e) => TOUCHES.reduce((n, k, i) => (e && e[k] ? n | (1 << i) : n), 0);
export const decoder = (n) => Object.fromEntries(TOUCHES.map((k, i) => [k, !!(n & (1 << i))]));

/** Un enregistrement qui commence. `reglages` : de quoi recréer le combat (creerCombat) et le dessiner. */
export function enregistrer(reglages) {
  return { v: 1, reglages, runs: [], allies: [], n: 0 };
}

/** Les entrées d'une image. */
export function noter(r, entrees) {
  const a = coder(entrees?.[0]);
  const b = coder(entrees?.[1]);
  const der = r.runs[r.runs.length - 1];
  if (der && der[1] === a && der[2] === b) der[0] += 1;
  else r.runs.push([1, a, b]);
  r.n += 1;
}

/** L'allié appelé, juste avant l'image suivante. */
export function noterAllie(r, joueur, allie, degats) {
  r.allies.push([r.n, joueur, allie, degats]);
}

/** Le lecteur : les entrées de chaque image, dans l'ordre, et les alliés à appeler avant. */
export function lecteur(rep) {
  let run = 0;
  let dans = 0;
  let f = 0;
  return {
    get image() { return f; },
    fini: () => f >= rep.n,
    /** Les alliés à appeler avant l'image courante. */
    allies: () => rep.allies.filter((x) => x[0] === f),
    /** Les entrées de l'image courante ; on passe à la suivante. */
    suivantes() {
      const r = rep.runs[run];
      if (!r) return null;
      const e = [decoder(r[1]), decoder(r[2])];
      dans += 1;
      if (dans >= r[0]) { run += 1; dans = 0; }
      f += 1;
      return e;
    },
  };
}

/* ------------------------------------------------------------------ */
/* La liste des replays (gardée sur l'appareil)                         */
/* ------------------------------------------------------------------ */

/** Les plus récents gardés ; les favoris, eux, restent (jusqu'à MAX_FAVORIS). */
export const MAX_RECENTS = 8;
export const MAX_FAVORIS = 15;

/** Ajoute un replay à la liste ; les plus anciens non favoris s'en vont. */
export function ajouter(liste, rep) {
  const l = [rep, ...liste];
  const favoris = l.filter((x) => x.favori).slice(0, MAX_FAVORIS);
  const recents = l.filter((x) => !x.favori).slice(0, MAX_RECENTS);
  return [...favoris, ...recents].sort((a, b) => b.date - a.date);
}

/** Garder (ou ne plus garder) un replay. */
export function basculerFavori(liste, id) {
  const n = liste.filter((x) => x.favori).length;
  return liste.map((x) => (x.id === id ? { ...x, favori: !x.favori && n < MAX_FAVORIS ? true : false } : x));
}
