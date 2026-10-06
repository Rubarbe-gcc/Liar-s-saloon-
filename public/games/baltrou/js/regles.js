/**
 * BALTROU — les règles, et le Saint Livre (toutes les cartes du jeu).
 * Construits depuis les données : ils ne peuvent pas mentir.
 */

import { MAINS, AMELIORATIONS, SCEAUX } from '../../../shared/baltrou/cartes.js';
import { LISTE_JOKERS, RARETES, OBJETS, VOUCHERS } from '../../../shared/baltrou/jokers.js';
import { BOSS, DECKS, MAINS_BASE, DEFAUSSES_BASE, PLACES_JOKERS, NEGATIFS_MAX } from '../../../shared/baltrou/partie.js';
import { jokerHtml, carteHtml, consoHtml, esc } from './rendu.js';
import { PLANETES, TAROTS, TAGS, MISES } from '../../../shared/baltrou/arcanes.js';
import { MAIN } from '../../../shared/baltrou/cartes.js';

const planetesHtml = () => `<div class="grille">${Object.entries(PLANETES).map(([m, pl]) => `<div class="fiche">${consoHtml(`planete:${m}`)}
  <div><b>${pl.nom}</b><small>${MAIN[m].nom} monte d’un niveau.</small></div></div>`).join('')}</div>`;
const tarotsHtml = () => `<div class="grille">${TAROTS.map((t) => `<div class="fiche">${consoHtml(`tarot:${t.id}`)}
  <div><b>${t.num} · ${esc(t.nom)}</b><small>${esc(t.texte)}</small></div></div>`).join('')}</div>`;

export function reglesHtml() {
  return `
  <p>Formez des <b>mains de poker</b> avec jusqu’à 5 cartes. Chaque main rapporte
    <b style="color:#6aa8ff">Chips</b> × <b style="color:#ff7a7a">Mult</b> points. Atteignez l’objectif de la blind avant
    d’être à court de mains (${MAINS_BASE} par manche, et ${DEFAUSSES_BASE} défausses pour changer de cartes).</p>
  <p>Trois blinds par <b>ante</b> : la petite, la grande, et un <b>boss</b> avec un effet qui vous complique la vie.
    Entre deux manches, la <b>boutique</b> : Jokers, améliorations de cartes, packs. Après chaque boss, un <b>bon</b> gratuit.</p>
  <p>Chaque main jouée <b>monte de niveau</b> : plus vous jouez une main, plus elle rapporte.</p>

  <h3>Les mains</h3>
  <table>${MAINS.map((m) => `<tr><td>${m.nom}</td><td>${m.chips} × ${m.mult}</td></tr>`).join('')}</table>

  <h3>Les cartes spéciales du paquet</h3>
  <div class="grille">
    <div class="fiche"><div class="mini">${carteHtml({ special: 'poisson' })}</div><div><b>Poisson Dégueulasse</b>
      <small>Toujours dans le paquet, joué de force. 85 % : ×4. 15 % : plus aucune défausse.</small></div></div>
    <div class="fiche"><div class="mini">${carteHtml({ special: 'wild' })}</div><div><b>WILDCARD</b>
      <small>Devient la meilleure carte possible. ×6,7 chips et Mult. 3 % de muter en TROLL.</small></div></div>
    <div class="fiche"><div class="mini">${carteHtml({ special: 'troll' })}</div><div><b>TROLL</b>
      <small>50 % : ×3 Mult. 50 % : −50 à −900 chips. Indéfaussable.</small></div></div>
  </div>

  <h3>Améliorations et sceaux</h3>
  <div class="grille">
    ${Object.entries(AMELIORATIONS).map(([k, a]) => `<div class="fiche"><div class="mini">${carteHtml({ r: 13, s: 'H', enh: k })}</div>
      <div><b>${a.nom}</b><small>${a.texte}</small></div></div>`).join('')}
    ${Object.entries(SCEAUX).map(([k, a]) => `<div class="fiche"><div class="mini">${carteHtml({ r: 7, s: 'S', sceau: k })}</div>
      <div><b>${a.nom}</b><small>${a.texte}</small></div></div>`).join('')}
  </div>

  <h3>Choisir sa blind, et la passer</h3>
  <p>Avant chaque manche, les trois blinds de l’ante s’affichent, boss compris : on sait ce qui attend. On peut
    <b>passer</b> la petite ou la grande blind : pas de récompense, mais un <b>tag</b>.</p>
  <div class="grille">${Object.values(TAGS).map((t) => `<div class="fiche"><span style="font-size:1.6rem">${t.glyphe}</span>
    <div><b>${esc(t.nom)}</b><small>${esc(t.texte)}</small></div></div>`).join('')}</div>

  <h3>Planètes et tarots</h3>
  <p>Des cartes à consommer (2 au plus), achetées en boutique ou trouvées dans les packs Céleste et Arcane.
    Une <b>planète</b> fait monter sa main d’un niveau. Un <b>tarot</b> transforme les cartes de votre main :
    sélectionnez-les, touchez le tarot, puis « Utiliser ».</p>
  ${planetesHtml()}
  ${tarotsHtml()}

  <h3>Les mises</h3>
  <p>Gagnez une partie Classique pour débloquer la mise suivante. Chaque mise ajoute sa difficulté à celles d’avant.</p>
  <div class="grille">${MISES.map((m) => `<div class="fiche"><span style="width:18px;height:18px;border-radius:50%;flex:none;background:${m.couleur};box-shadow:0 0 8px ${m.couleur}"></span>
    <div><b>${m.nom}</b><small>${m.texte}</small></div></div>`).join('')}</div>

  <h3>Les boss</h3>
  <div class="grille">${Object.values(BOSS).map((b) => `<div class="fiche"><span style="font-size:1.8rem">${b.glyphe}</span>
    <div><b>${b.nom}</b><small>${b.texte}</small></div></div>`).join('')}</div>

  <h3>Les Jokers</h3>
  <p>${PLACES_JOKERS} places au départ (plus avec BOB ou une Poche Extra). Ils agissent de gauche à droite : l’ordre compte.
    Les Jokers <b style="color:#ff3fc8">Négatifs</b> ont leur propre rangée (${NEGATIFS_MAX} au plus) : très forts, avec un vrai
    défaut, et ils ne se revendent pas. Environ 6 % des Jokers sortent <b>Holo</b> (+10 chips) ou <b>Polychrome</b> (×1,15 Mult).
    Le Saint Livre, en boutique, les décrit tous.</p>

  <h3>Les decks</h3>
  <div class="grille">${Object.values(DECKS).map((d) => `<div class="fiche"><span style="font-size:1.6rem">${d.glyphe}</span>
    <div><b>${d.nom}</b><small>${d.texte}</small></div></div>`).join('')}</div>

  <h3>L’argent</h3>
  <p>Chaque manche gagnée rapporte sa récompense, des <b>intérêts</b> (1 $ par tranche de 5 $ que vous gardez,
    <b>5 $ au plus</b> — 10 $ puis 20 $ avec les bons Intérêt), un petit bonus qui grandit à chaque victoire
    (+2 $ par manche déjà gagnée), et un bonus de boss.</p>
  <p>Les Jokers <b>mythiques</b> sont rares, et on n’en tient qu’<b>un à la fois</b> : tant que vous en avez un,
    la boutique n’en propose plus.</p>`;
}

/** Le Saint Livre : l'effet de chaque carte du jeu. */
export function livreHtml() {
  const groupes = [['commun', 'Jokers communs'], ['rare', 'Jokers rares'], ['legendaire', 'Jokers légendaires'],
    ['mythique', 'Jokers MYTHIQUES'], ['negatif', 'Jokers négatifs (hors place)']];
  return groupes.map(([r, titre]) => `<h3 style="color:${RARETES[r].couleur}">${titre}</h3>
    <div class="grille">${LISTE_JOKERS.filter((j) => j.rarete === r).map((j) => `<div class="fiche">${jokerHtml(j)}
      <div><b>${esc(j.nom)}</b><small>${esc(j.texte)} · $${j.prix}</small></div></div>`).join('')}</div>`).join('')
  + `<h3>Les objets de la boutique</h3>
    <div class="grille">${Object.values(OBJETS).map((o) => `<div class="fiche"><span style="font-size:1.6rem">${o.glyphe}</span>
      <div><b>${esc(o.nom)}</b><small>${esc(o.texte)} · $${o.prix}</small></div></div>`).join('')}</div>
    <h3>Les planètes</h3>${planetesHtml()}
    <h3>Les tarots</h3>${tarotsHtml()}
    <h3>Les bons (offerts après un boss)</h3>
    <div class="grille">${VOUCHERS.map((v) => `<div class="fiche"><span style="font-size:1.6rem">🎟️</span>
      <div><b>${esc(v.nom)}</b><small>${esc(v.texte)}</small></div></div>`).join('')}</div>`;
}
