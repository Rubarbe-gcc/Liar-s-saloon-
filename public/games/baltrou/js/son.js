/**
 * BALTROU — le son : la musique (composée, voir musique.js) et les bruitages
 * du jeu d'origine.
 *
 * Un thème pour la table, un pour la boutique, et un par boss. La musique
 * démarre au premier geste (les navigateurs l'exigent), se tait quand
 * l'onglet est caché, et le choix « muet » est retenu.
 */

import { creerOrchestre } from './musique.js';

const DOSSIER = '/games/baltrou/sons/';
const BRUITS = { jouer: 'sfx_play', defausse: 'sfx_discard', caisse: 'sfx_cash', gagne: 'sfx_win', perdu: 'sfx_lose' };
const CLE = 'baltrou.muet';

let muet = false;
try { muet = localStorage.getItem(CLE) === '1'; } catch { /* ignore */ }

const orchestre = creerOrchestre();
orchestre.couper(muet);

export const estMuet = () => muet;

/** La musique du moment : 'tapis', 'boutique', ou le thème d'un boss ('boss_limace'…). */
export function musique(nom) {
  orchestre.jouer(nom);
}

const reserve = {};
export function bruit(nom, volume = 0.6) {
  if (muet || !BRUITS[nom]) return;
  try {
    reserve[nom] = reserve[nom] || new Audio(`${DOSSIER}${BRUITS[nom]}.wav`);
    const a = reserve[nom].cloneNode();
    a.volume = volume;
    a.play().catch(() => {});
  } catch { /* pas de son */ }
}

/** Coupe ou remet le son. Renvoie vrai si c'est muet. */
export function basculer() {
  muet = !muet;
  try { localStorage.setItem(CLE, muet ? '1' : '0'); } catch { /* ignore */ }
  orchestre.couper(muet);
  return muet;
}
