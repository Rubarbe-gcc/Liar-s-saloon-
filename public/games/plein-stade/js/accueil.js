/**
 * PLEIN STADE — l'accueil de l'appli : le choix du sport.
 *
 * Chaque sport est un jeu à part (son dossier, son moteur dans shared/) ;
 * ils partagent ce qui se ressemble (games/plein-stade/commun/ : les
 * écussons, les commandes, les sons, les joueurs en 3D, le lissage en ligne).
 * Ici, on dit seulement où l'on en est dans chaque sport.
 */

import * as succes from '../../../shared/succes.js';

// La clé « petitpont » est celle du foot depuis le début : on la garde (succès et visites).
succes.visiter('petitpont');

function lire(cle) {
  try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch { return null; }
}

const TOURS = ['quarts', 'demies', 'finale'];
const coupe = lire('petitpont.coupe');
if (coupe && coupe.tours && !coupe.fini && !coupe.elimine) document.getElementById('info-foot').textContent = `Une Coupe en cours (${TOURS[coupe.tour] || ''})`;
const tournoi = lire('doublepas.tournoi');
if (tournoi && tournoi.tours && !tournoi.fini && !tournoi.elimine) document.getElementById('info-basket').textContent = `Un tournoi en cours (${TOURS[tournoi.tour] || ''})`;
