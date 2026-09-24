/**
 * RAID — le champ d'essence.
 *
 * Le cœur du jeu : avant de lancer un sort, un personnage trace un chemin sur
 * une nappe de globes de mana et récolte ce qu'il ramasse en route. Les globes
 * de sa propre école comptent double, et le globe d'essence pure vaut pour
 * tout le monde.
 *
 * Le chemin passe d'un globe au globe voisin — les huit directions, diagonales
 * comprises — sans jamais repasser au même endroit. Sa longueur est bornée :
 * sans cela, un joueur patient ramasserait la nappe entière et le plafond de
 * mana n'aurait plus de sens.
 *
 * Module ISO : ni DOM ni Node.
 */

import { CYCLE, ESSENCE } from './ecoles.js';
import { entier } from '../hasard.js';

export const COLONNES = 6;
export const LIGNES = 5;
export const CASES = COLONNES * LIGNES;
export const LONGUEUR_MAX = 9;

/** Valeurs de mana. Un globe de son école vaut le double d'un globe étranger. */
export const MANA_SIMPLE = 1;
export const MANA_DOUBLE = 2;

/** Rareté du globe d'essence pure. Assez rare pour être un événement. */
const PART_ESSENCE = 0.09;

export const x = (i) => i % COLONNES;
export const y = (i) => Math.floor(i / COLONNES);

/** Un globe au hasard, d'essence pure de temps en temps. */
export function globeAuHasard(rng) {
  if (rng() < PART_ESSENCE) return ESSENCE;
  return CYCLE[entier(rng, CYCLE.length)];
}

/** Grille pleine. */
export function creerPlateau(rng) {
  return Array.from({ length: CASES }, () => globeAuHasard(rng));
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

/** Ce qu'un globe rapporte à un personnage d'une école donnée. */
export function valeurGlobe(globe, ecole) {
  if (globe === ESSENCE) return MANA_DOUBLE;
  return globe === ecole ? MANA_DOUBLE : MANA_SIMPLE;
}

/** Ki ramassé par un chemin, avec le détail pour l'affichage. */
export function manaDuChemin(plateau, chemin, ecole) {
  const detail = { total: 0, doubles: 0, simples: 0, essences: 0, longueur: 0 };
  if (!cheminValide(chemin)) return detail;
  for (const c of chemin) {
    const globe = plateau[c];
    if (globe == null) continue;
    detail.longueur++;
    if (globe === ESSENCE) detail.essences++;
    else if (globe === ecole) detail.doubles++;
    else detail.simples++;
    detail.total += valeurGlobe(globe, ecole);
  }
  return detail;
}

/**
 * Retire les globes ramassés, fait tomber ceux du dessus et complète par le
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
      suivant[j] = globeAuHasard(rng);
      neuves.push(j);
    }
  }

  return { plateau: suivant, chutes, neuves, ramassees: [...chemin] };
}

/**
 * Le meilleur chemin que l'on puisse tracer pour une école donnée.
 *
 * L'exploration exhaustive exploserait (neuf pas, huit directions) : on garde
 * donc, à chaque longueur, les `LARGEUR` chemins les plus riches. C'est une
 * recherche en faisceau — elle rate parfois l'optimum absolu, mais elle sert à
 * montrer une piste au joueur et à faire jouer l'ordinateur, pas à prouver un
 * théorème.
 */
const LARGEUR = 160;

export function meilleurChemin(plateau, ecole, longueurMax = LONGUEUR_MAX) {
  const borne = Math.min(longueurMax, LONGUEUR_MAX);
  let front = [];
  for (let i = 0; i < CASES; i++) {
    front.push({ chemin: [i], vus: 1 << 0, mana: valeurGlobe(plateau[i], ecole), set: new Set([i]) });
  }
  let meilleur = front.reduce((a, b) => (b.mana > a.mana ? b : a));

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
          mana: etat.mana + valeurGlobe(plateau[v], ecole),
        });
      }
    }
    if (!suite.length) break;
    suite.sort((a, b) => b.mana - a.mana);
    front = suite.slice(0, LARGEUR);
    if (front[0].mana > meilleur.mana) meilleur = front[0];
  }

  return { chemin: meilleur.chemin, mana: meilleur.mana };
}
