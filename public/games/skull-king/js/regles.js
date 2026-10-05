/**
 * SKULL KING — les règles, illustrées avec les vraies cartes du jeu.
 *
 *   reglesHtml()        la page complète, depuis le menu ;
 *   aideHtml(onglet, extras)  l'aide-mémoire qu'on ouvre en pleine partie :
 *                       qui bat qui, les cartes spéciales, les cartes custom
 *                       de la partie, les points.
 */

import { paquet, CUSTOM, TOUTES_CUSTOM } from '../../../shared/skullking/moteur.js';
import { carteHtml } from './cartes.js';

const C = Object.fromEntries(paquet(TOUTES_CUSTOM).map((c) => [c.id, c]));
const k = (id, as) => carteHtml(C[id], { as });
const ligne = (id, texte, as) => `<div class="ligne-carte">${k(id, as)}<div>${texte}</div></div>`;
/** L'identifiant d'une carte custom dans le paquet (rhum1, cors1, canon…). */
const idCustom = (t) => (CUSTOM[t].nb > 1 ? `${t}1` : t);

const SPECIALES = `
  ${ligne('esc1', '<b>Fuite</b> — ne prend jamais rien. Si tout le monde fuit, le premier joueur ramasse le pli.')}
  ${ligne('pir1', '<b>Pirate</b> — bat toutes les cartes numérotées et les sirènes. Entre pirates, le premier joué l’emporte.')}
  ${ligne('tig', '<b>Tigresse</b> — au moment de la jouer, on choisit : pirate ou fuite.', null)}
  ${ligne('sk', '<b>Skull King</b> — bat les pirates et tout le reste… sauf une sirène.')}
  ${ligne('sir1', '<b>Sirène</b> — bat les cartes numérotées, perd contre les pirates, mais <b>séduit le Skull King</b>.')}
  ${ligne('kra', '<b>Kraken</b> — engloutit le pli : personne ne le gagne. Celui qui l’aurait remporté ouvre le suivant.')}
  ${ligne('wha', '<b>Baleine blanche</b> — les personnages perdent leurs pouvoirs : le plus gros chiffre gagne, quelle que soit sa couleur. Sans chiffre, le pli part au fond.')}
  <p>Si le Kraken et la Baleine tombent dans le même pli, c’est le dernier joué qui compte.</p>`;

const POINTS = `
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
  <p>Dans le jeu, les bonus ne comptent que si le pari est réussi (règle officielle). Les malus du mode
  custom, eux, comptent toujours.</p>`;

const customHtml = (extras) => extras.map((t) =>
  ligne(idCustom(t), `<b>${CUSTOM[t].nom}</b> <small class="nb">×${CUSTOM[t].nb}</small> — ${CUSTOM[t].regle}`)).join('');

export function reglesHtml() {
  return `
  <p>Dix manches. À la manche 1, chacun reçoit une carte ; à la manche 10, dix. Avant de jouer, chacun
  <b>annonce combien de plis il va remporter</b>. Tout l’art est de tomber pile.</p>
  <p><b>Le dernier pari.</b> Le donneur parie en dernier, en connaissant le total des autres. Ce total, une
  fois son pari ajouté, <b>ne peut pas être égal au nombre de cartes de la manche</b> : il faut être au-dessus
  ou en dessous. S’il tombait pile, le donneur doit changer son pari.</p>

  <h3>Le pli</h3>
  <p>Le premier joueur pose une carte, les autres suivent chacun leur tour. <b>Il faut suivre la couleur
  demandée</b> si on en a ; sinon on joue ce qu’on veut. Les cartes spéciales se jouent toujours, même
  quand on a la couleur.</p>
  <div class="rangee">${k('Y5')}${k('G9')}${k('P12')}${k('B3')}</div>
  <p>Coffre, Perroquet et Carte au trésor sont des couleurs ordinaires. Le <b>Pavillon noir</b> est
  l’atout : n’importe quel noir bat les trois autres couleurs.</p>

  <h3>Les cartes spéciales</h3>
  ${SPECIALES}

  <h3>Les points</h3>
  ${POINTS}

  <h3>✦ Le mode custom</h3>
  <p>Des cartes en plus, inventées pour la maison. On choisit lesquelles mettre dans le paquet avant la
  partie (seul, ou par le capitaine de la table en ligne). Elles portent une petite étoile ✦.</p>
  ${customHtml(TOUTES_CUSTOM)}
  <p>Pendant la partie, le bouton <b>📖</b> en haut de la table rouvre tout cela.</p>`;
}

/* ------------------------------------------------------------------ */
/* L'aide-mémoire de la table                                         */
/* ------------------------------------------------------------------ */

export const ONGLETS_AIDE = [
  { id: 'qui', nom: '⚔️ Qui bat qui' },
  { id: 'speciales', nom: '🃏 Spéciales' },
  { id: 'custom', nom: '✦ Custom', custom: true },
  { id: 'points', nom: '🏆 Points' },
];

/** Une marche de l'échelle : des cartes, et ce qu'elles valent. */
const marche = (rang, cartes, texte) => `<div class="marche"><span class="rang">${rang}</span>
  <span class="marche-cartes">${cartes.map((c) => k(...[].concat(c))).join('')}</span><span class="marche-txt">${texte}</span></div>`;

function quiBatQui(extras) {
  const canon = extras.includes('canon');
  const cors = extras.includes('cors');
  return `
  <p class="aide-intro">Du plus fort au plus faible. Une carte bat toutes celles qui sont en dessous.</p>
  <div class="echelle">
    ${canon ? marche('✦', ['canon'], '<b>Canon</b>, s’il est posé en tout dernier : il bat tout.') : ''}
    ${marche(1, ['sk'], '<b>Skull King</b> — bat les pirates (+30 chacun) et tout le reste.')}
    ${marche(2, ['pir1', ['tig', 'pir']], '<b>Pirates</b> (et la Tigresse jouée en pirate) — entre eux, le premier posé gagne.')}
    ${marche(3, ['sir1'], '<b>Sirènes</b> — entre elles, la première posée gagne.')}
    ${marche(4, ['B14', 'B1'], '<b>Atout noir</b> — le plus gros gagne.')}
    ${cors ? marche('✦', ['cors1'], '<b>Corsaire</b> — un 15 de la couleur demandée.') : ''}
    ${marche(5, ['Y14', 'Y2'], '<b>Couleur demandée</b> — le plus gros gagne.')}
    ${marche(6, ['G13', 'P9'], '<b>Autres couleurs</b> — ne gagnent jamais.')}
    ${marche(7, ['esc1', ['tig', 'esc']], '<b>Fuites</b> — si tout le monde fuit, le premier posé gagne.')}
  </div>
  <div class="exceptions">
    <h3>Les exceptions</h3>
    <p>🧜‍♀️ <b>La Sirène bat le Skull King</b> (+40), même si des pirates sont là.</p>
    <p>🐙 <b>Kraken</b> : personne ne gagne le pli ; celui qui l’aurait gagné ouvre le suivant.</p>
    <p>🐋 <b>Baleine</b> : plus de personnages ; le plus gros chiffre gagne, toutes couleurs confondues.</p>
    ${extras.includes('holl') ? '<p>👻 <b>Hollandais volant</b> : sans personnage dans le pli, c’est le plus <b>petit</b> chiffre qui gagne.</p>' : ''}
    <p>Plusieurs monstres dans un pli : le dernier posé décide.</p>
    <p>On doit suivre la couleur demandée si on en a ; les cartes spéciales se jouent toujours.</p>
  </div>`;
}

export function aideHtml(onglet = 'qui', extras = []) {
  const onglets = ONGLETS_AIDE.filter((o) => !o.custom || extras.length);
  const actif = onglets.some((o) => o.id === onglet) ? onglet : 'qui';
  let corps;
  if (actif === 'qui') corps = quiBatQui(extras);
  else if (actif === 'speciales') corps = SPECIALES;
  else if (actif === 'custom') corps = `<p class="aide-intro">Les cartes custom de cette partie :</p>${customHtml(extras)}`;
  else corps = POINTS;
  return `<div class="onglets-aide" role="tablist">${onglets.map((o) =>
    `<button class="${o.id === actif ? 'is-on' : ''}" data-aide="${o.id}" role="tab">${o.nom}</button>`).join('')}</div>
    <div class="regles aide-corps">${corps}</div>`;
}
