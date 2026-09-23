/**
 * PRISME — le champ d'orbes.
 *
 * Le cœur du jeu : avant de frapper, un héros trace un chemin sur une grille
 * d'orbes de lumière et récolte le ki qu'il ramasse en route. Les orbes de sa
 * propre affinité comptent double, l'orbe prismatique vaut pour tout le monde.
 *
 * Le chemin passe d'une orbe à l'orbe voisine — les huit directions, diagonales
 * comprises — sans jamais repasser sur la même. Sa longueur est bornée : sans
 * cela, un joueur patient ramasserait la grille entière et le plafond de ki
 * n'aurait plus de sens.
 *
 * Module ISO : ni DOM ni Node.
 */

import { CYCLE, PRISMATIQUE } from './affinites.js';
import { entier } from '../hasard.js';

export const COLONNES = 6;
export const LIGNES = 5;
export const CASES = COLONNES * LIGNES;
export const LONGUEUR_MAX = 9;

/** Valeurs de ki. Une orbe d'affinité vaut le double d'une orbe étrangère. */
export const KI_SIMPLE = 1;
export const KI_DOUBLE = 2;

/** Rareté de l'orbe prismatique. Assez rare pour être un événement. */
const PART_PRISME = 0.09;

export const x = (i) => i % COLONNES;
export const y = (i) => Math.floor(i / COLONNES);

/** Une orbe au hasard, prismatique de temps en temps. */
export function orbeAuHasard(rng) {
  if (rng() < PART_PRISME) return PRISMATIQUE;
  return CYCLE[entier(rng, CYCLE.length)];
}

/** Grille pleine. */
export function creerPlateau(rng) {
  return Array.from({ length: CASES }, () => orbeAuHasard(rng));
}

/** Deux cases se touchent-elles, diagonales comprises ? */
export function voisines(i, j) {
  if (i === j) return false;
  if (i < 0 || j < 0 || i >= CASES || j >= CASES) return false;
  return Math.abs(x(i) - x(j)) <= 1 && Math.abs(y(i) - y(j)) <= 1;
}

/** Les cases qui touchent `i`. */
export function voisinage(i) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x(i) + dx, ny = y(i) + dy;
      if (nx < 0 || ny < 0 || nx >= COLONNES || ny >= LIGNES) continue;
      out.push(ny * COLONNES + nx);
    }
  }
  return out;
}

/** Un chemin tient-il debout ? (cases valides, voisines, jamais répétées) */
export function cheminValide(chemin) {
  if (!Array.isArray(chemin) || chemin.length === 0) return false;
  if (chemin.length > LONGUEUR_MAX) return false;
  const vus = new Set();
  for (let k = 0; k < chemin.length; k++) {
    const c = chemin[k];
    if (!Number.isInteger(c) || c < 0 || c >= CASES) return false;
    if (vus.has(c)) return false;
    vus.add(c);
    if (k > 0 && !voisines(chemin[k - 1], c)) return false;
  }
  return true;
}

/** Ce qu'une orbe rapporte à un héros d'affinité donnée. */
export function valeurOrbe(orbe, affinite) {
  if (orbe === PRISMATIQUE) return KI_DOUBLE;
  return orbe === affinite ? KI_DOUBLE : KI_SIMPLE;
}

/** Ki ramassé par un chemin, avec le détail pour l'affichage. */
export function kiDuChemin(plateau, chemin, affinite) {
  const detail = { total: 0, doubles: 0, simples: 0, prismes: 0, longueur: 0 };
  if (!cheminValide(chemin)) return detail;
  for (const c of chemin) {
    const orbe = plateau[c];
    if (orbe == null) continue;
    detail.longueur++;
    if (orbe === PRISMATIQUE) detail.prismes++;
    else if (orbe === affinite) detail.doubles++;
    else detail.simples++;
    detail.total += valeurOrbe(orbe, affinite);
  }
  return detail;
}

/**
 * Retire les orbes ramassées, fait tomber celles du dessus et complète par le
 * haut. La liste `chutes` décrit les déplacements pour que l'écran puisse les
 * animer plutôt que de redessiner la grille d'un coup.
 */
export function recolter(plateau, chemin, rng) {
  const pris = new Set(chemin);
  const suivant = new Array(CASES).fill(null);
  const chutes = [];
  const neuves = [];

  for (let col = 0; col < COLONNES; col++) {
    // De bas en haut : les survivantes se tassent au fond de la colonne.
    let ecrit = LIGNES - 1;
    for (let lig = LIGNES - 1; lig >= 0; lig--) {
      const i = lig * COLONNES + col;
      if (pris.has(i)) continue;
      const j = ecrit * COLONNES + col;
      suivant[j] = plateau[i];
      if (i !== j) chutes.push({ de: i, vers: j });
      ecrit--;
    }
    // Le reste de la colonne est neuf.
    for (let lig = ecrit; lig >= 0; lig--) {
      const j = lig * COLONNES + col;
      suivant[j] = orbeAuHasard(rng);
      neuves.push(j);
    }
  }

  return { plateau: suivant, chutes, neuves, ramassees: [...chemin] };
}

/**
 * Le meilleur chemin que l'on puisse tracer pour une affinité donnée.
 *
 * L'exploration exhaustive exploserait (neuf pas, huit directions) : on garde
 * donc, à chaque longueur, les `LARGEUR` chemins les plus riches. C'est une
 * recherche en faisceau — elle rate parfois l'optimum absolu, mais elle sert à
 * montrer une piste au joueur et à faire jouer l'ordinateur, pas à prouver un
 * théorème.
 */
const LARGEUR = 160;

export function meilleurChemin(plateau, affinite, longueurMax = LONGUEUR_MAX) {
  const borne = Math.min(longueurMax, LONGUEUR_MAX);
  let front = [];
  for (let i = 0; i < CASES; i++) {
    front.push({ chemin: [i], vus: 1 << 0, ki: valeurOrbe(plateau[i], affinite), set: new Set([i]) });
  }
  let meilleur = front.reduce((a, b) => (b.ki > a.ki ? b : a));

  for (let pas = 1; pas < borne; pas++) {
    const suite = [];
    for (const etat of front) {
      const tete = etat.chemin[etat.chemin.length - 1];
      for (const v of voisinage(tete)) {
        if (etat.set.has(v)) continue;
        const set = new Set(etat.set);
        set.add(v);
        suite.push({
          chemin: [...etat.chemin, v],
          set,
          ki: etat.ki + valeurOrbe(plateau[v], affinite),
        });
      }
    }
    if (!suite.length) break;
    suite.sort((a, b) => b.ki - a.ki);
    front = suite.slice(0, LARGEUR);
    if (front[0].ki > meilleur.ki) meilleur = front[0];
  }

  return { chemin: meilleur.chemin, ki: meilleur.ki };
}
