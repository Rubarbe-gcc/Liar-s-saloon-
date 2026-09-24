/**
 * RAID — le conseiller.
 *
 * Le même code sert trois besoins qu'il serait absurde d'écrire trois fois :
 *   • le bouton « conseil », qui montre un bon chemin sans le jouer ;
 *   • la démonstration qui tourne toute seule derrière l'écran-titre ;
 *   • les tests d'équilibrage, qui ont besoin d'un joueur honnête pour savoir
 *     si un donjon se termine.
 *
 * Il ne triche pas : il ne lit que ce que l'écran affiche déjà.
 *
 * Module ISO : ni DOM ni Node.
 */

import { meilleurChemin } from './globes.js';
import {
  choisir, tracer, attaquer, modesDisponibles, estimerDegats, utiliserObjet, estFini, PHASE,
} from './combat.js';

/** Le meilleur chemin pour le héros actif — ou pour un héros donné. */
export function conseilChemin(etat, idx = etat.actif) {
  if (idx == null) return null;
  return meilleurChemin(etat.plateau, etat.equipe[idx].ecole);
}

/**
 * Le coup qui enlève le plus de vie, à cible égale. Une spéciale l'emporte sur
 * une frappe à dégâts équivalents : garder du mana d'un tour sur l'autre ne sert
 * à rien, la jauge se vide en fin de tour.
 */
export function conseilCoup(etat, idx = etat.actif) {
  if (idx == null) return null;
  const vivants = etat.ennemis.map((e, i) => [e, i]).filter(([e]) => e.pv > 0);
  let meilleur = null;
  for (const m of modesDisponibles(etat, idx).filter((x) => x.ouvert)) {
    for (const [e, i] of vivants) {
      const d = estimerDegats(etat, idx, m.mode, e);
      const utile = Math.min(d.degats, e.pv) + (m.mode === 'normale' ? 0 : 1);
      if (!meilleur || utile > meilleur.utile) meilleur = { utile, mode: m.mode, cible: i, degats: d.degats };
    }
  }
  return meilleur;
}

/** Le héros de la rotation qui a le plus à gagner à jouer maintenant. */
export function conseilOrdre(etat) {
  const restants = [...etat.ordreRestant];
  if (restants.length <= 1) return restants[0] ?? null;
  const note = (i) => Math.max(...etat.ennemis.filter((e) => e.pv > 0)
    .map((e) => estimerDegats(etat, i, 'special', e).degats), 0);
  return restants.sort((a, b) => note(b) - note(a))[0];
}

/** Seuil de vie sous lequel l'automate ouvre une potion. */
export const SEUIL_POTION = 0.32;

/**
 * Avance le combat d'une décision. Renvoie les événements produits, ou `null`
 * quand il n'y a plus rien à décider — de quoi piloter une démonstration au
 * rythme des animations plutôt qu'en une rafale.
 */
export function pasAuto(etat) {
  if (estFini(etat)) return null;

  if (etat.phase === PHASE.CHOIX) {
    if (etat.vie.actuel < etat.vie.max * SEUIL_POTION && etat.objets > 0) {
      return utiliserObjet(etat).evenements || [];
    }
    const idx = conseilOrdre(etat);
    if (idx == null) return null;
    return choisir(etat, idx).evenements || [];
  }

  if (etat.phase === PHASE.GLOBES) {
    const c = conseilChemin(etat);
    return c ? (tracer(etat, c.chemin).evenements || []) : null;
  }

  if (etat.phase === PHASE.ACTION) {
    const coup = conseilCoup(etat);
    if (!coup) return null;
    return attaquer(etat, { mode: coup.mode, cible: coup.cible }).evenements || [];
  }

  return null;
}

/** Joue le combat jusqu'au bout. `garde` borne les parties qui s'éternisent. */
export function jouerCombatAuto(etat, { garde = 400 } = {}) {
  let n = 0;
  while (!estFini(etat) && n++ < garde) {
    if (pasAuto(etat) === null) break;
  }
  return etat;
}
