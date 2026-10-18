/**
 * PETIT PONT — l'écran « Statistiques » d'un tournoi (Coupe et Ligue) : le top 5
 * des buteurs, des passeurs et des gardiens, avec l'écusson du club et le nom du joueur.
 * Les classements viennent de shared/foot/stats.js ; ici on ne fait que les montrer.
 */

import { EQUIPE } from '../../../../shared/foot/equipes.js';
import { meilleursButeurs, meilleursPasseurs, meilleursGardiens } from '../../../../shared/foot/stats.js';
import { ecussonSVG } from '../../commun/ecusson.js';

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function ligne(x, moi, valeur, detail = '') {
  const eq = EQUIPE[x.club];
  return `<li class="ligne-stat${x.club === moi ? ' toi' : ''}"><span class="rg">${x.rang}</span>${ecussonSVG(eq, 26)}<span class="qui"><b>${eq.joueurs[x.i].nom}</b><small>${eq.court}</small></span><span class="val">${valeur}${detail ? `<small>${detail}</small>` : ''}</span></li>`;
}

function bloc(titre, liste, vide) {
  return `<section class="classement-stat"><h3>${titre}</h3>${liste.length ? `<ol>${liste.join('')}</ol>` : `<p class="vide">${vide}</p>`}</section>`;
}

/** Le contenu de l'écran. moi : le club du joueur (sa ligne est mise en avant). */
export function htmlStatistiques(stats, moi) {
  return `<div class="stats-grille">${[
    bloc('Meilleurs buteurs', meilleursButeurs(stats).map((x) => ligne(x, moi, pluriel(x.buts, 'but'), x.passes ? pluriel(x.passes, 'passe') : '')), 'Personne n’a encore marqué.'),
    bloc('Meilleurs passeurs', meilleursPasseurs(stats).map((x) => ligne(x, moi, pluriel(x.passes, 'passe'), x.buts ? pluriel(x.buts, 'but') : '')), 'Aucune passe décisive pour l’instant.'),
    bloc('Meilleurs gardiens', meilleursGardiens(stats).map((x) => ligne(x, moi, pluriel(x.arrets, 'arrêt'), x.sansEncaisser ? `${x.sansEncaisser} sans encaisser` : '')), 'Aucun match joué pour l’instant.'),
  ].join('')}</div>`;
}
