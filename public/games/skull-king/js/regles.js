/**
 * SKULL KING — la page des règles, illustrée avec les vraies cartes du jeu.
 */

import { paquet } from '../../../shared/skullking/moteur.js';
import { carteHtml } from './cartes.js';

const C = Object.fromEntries(paquet().map((c) => [c.id, c]));
const k = (id, as) => carteHtml(C[id], { as });
const ligne = (id, texte, as) => `<div class="ligne-carte">${k(id, as)}<div>${texte}</div></div>`;

export function reglesHtml() {
  return `
  <p>Dix manches. À la manche 1, chacun reçoit une carte ; à la manche 10, dix. Avant de jouer, chacun
  <b>annonce combien de plis il va remporter</b>. Tout l’art est de tomber pile.</p>

  <h3>Le pli</h3>
  <p>Le premier joueur pose une carte, les autres suivent chacun leur tour. <b>Il faut suivre la couleur
  demandée</b> si on en a ; sinon on joue ce qu’on veut. Les cartes spéciales se jouent toujours, même
  quand on a la couleur.</p>
  <div class="rangee">${k('Y5')}${k('G9')}${k('P12')}${k('B3')}</div>
  <p>Coffre, Perroquet et Carte au trésor sont des couleurs ordinaires. Le <b>Pavillon noir</b> est
  l’atout : n’importe quel noir bat les trois autres couleurs.</p>

  <h3>Les cartes spéciales</h3>
  ${ligne('esc1', '<b>Fuite</b> — ne prend jamais rien. Si tout le monde fuit, le premier joueur ramasse le pli.')}
  ${ligne('pir1', '<b>Pirate</b> — bat toutes les cartes numérotées et les sirènes. Entre pirates, le premier joué l’emporte.')}
  ${ligne('tig', '<b>Tigresse</b> — au moment de la jouer, on choisit : pirate ou fuite.', null)}
  ${ligne('sk', '<b>Skull King</b> — bat les pirates et tout le reste… sauf une sirène.')}
  ${ligne('sir1', '<b>Sirène</b> — bat les cartes numérotées, perd contre les pirates, mais <b>séduit le Skull King</b>.')}
  ${ligne('kra', '<b>Kraken</b> — engloutit le pli : personne ne le gagne. Celui qui l’aurait remporté ouvre le suivant.')}
  ${ligne('wha', '<b>Baleine blanche</b> — les personnages perdent leurs pouvoirs : le plus gros chiffre gagne, quelle que soit sa couleur. Sans chiffre, le pli part au fond.')}
  <p>Si le Kraken et la Baleine tombent dans le même pli, c’est le dernier joué qui compte.</p>

  <h3>Les points</h3>
  <table>
    <tr><td>Pari réussi (1 pli ou plus)</td><td>+20 par pli</td></tr>
    <tr><td>Pari raté</td><td>−10 par pli d’écart</td></tr>
    <tr><td>Pari de zéro réussi</td><td>+10 × n° de manche</td></tr>
    <tr><td>Pari de zéro raté</td><td>−10 × n° de manche</td></tr>
  </table>

  <h3>Les bonus</h3>
  <table>
    <tr><td>Ramasser un 14 de couleur</td><td>+10</td></tr>
    <tr><td>Ramasser le 14 noir</td><td>+20</td></tr>
    <tr><td>Skull King qui prend un pirate</td><td>+30 chacun</td></tr>
    <tr><td>Pirate qui prend une sirène</td><td>+20 chacune</td></tr>
    <tr><td>Sirène qui prend le Skull King</td><td>+40</td></tr>
  </table>
  <p>Dans le jeu contre l’équipage, les bonus ne comptent que si le pari est réussi (règle officielle).
  Sur la feuille de score, c’est vous qui choisissez, dans ⚙.</p>`;
}
