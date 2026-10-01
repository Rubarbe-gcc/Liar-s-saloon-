/**
 * RAID — les règles, écrites depuis le moteur.
 *
 * Chaque nombre affiché ici est lu dans les constantes du moteur : si un
 * réglage bouge, la page bouge avec lui. Une règle fausse dans un écran
 * d'aide coûte plus cher qu'une règle absente.
 */

import { CYCLE, ECOLES, roueSvg, domine, AVANTAGE, DESAVANTAGE } from '../../../shared/raid/ecoles.js';
import { NIVEAU_MAX, NIVEAU_ULTIME, COUT } from '../../../shared/raid/personnages.js';
import { ACTES, TYPES } from '../../../shared/raid/carte.js';
import { OBJETS, MULT_CRIT } from '../../../shared/raid/bataille.js';
import { TAILLE_GROUPE, NIVEAUX_DON, CHANCE_DEPART, SOLO } from '../../../shared/raid/aventure.js';
import { TRAITS_RPG, pc } from './textes.js';

const bloc = (titre, corps) => `<div class="regle-bloc"><h3>${titre}</h3>${corps}</div>`;

export function rendreRegles() {
  const ecoles = CYCLE.map((a) => `${ECOLES[a].glyphe} ${ECOLES[a].nom} bat ${ECOLES[domine(a)].nom}`).join(' · ');
  return bloc('L’aventure', `
    <p>Vous choisissez <b>un seul héros</b>. Il part seul au pied du donjon et doit gravir
    <b>${ACTES.length} actes</b> jusqu’au Dragon Cendré.</p>
    <p>En chemin, des aventuriers proposent de vous suivre : le groupe monte jusqu’à
    <b>${TAILLE_GROUPE} personnages</b>. Après chaque boss des trois premiers actes, une recrue se présente
    toujours. Les monstres s’adaptent à la taille du groupe.</p>
    <p>Seul, un tank ou un soigneur frappe plus fort (<b>+${pc(SOLO.tank)}</b> et <b>+${pc(SOLO.soigneur)}</b>
    de dégâts) : sans cela, il userait les monstres bien après qu’ils l’ont usé.</p>`)
    + bloc('La carte', `
    <p>Chaque acte est une carte à chemins. Vous choisissez la salle suivante parmi celles que votre chemin relie :</p>
    <ul>${Object.values(TYPES).map((t) => `<li>${t.glyphe} <b>${t.nom}</b> — ${t.texte}</li>`).join('')}</ul>
    <p>Le dernier palier avant le boss est toujours un feu de camp. Entre deux actes, le groupe récupère une
    bonne partie de sa vie, et tout son mana.</p>`)
    + bloc('Le combat', `
    <p>Chaque manche, tout le monde agit une fois, <b>du plus rapide au plus lent</b> (la vitesse, VIT).
    Au tour d’un de vos personnages, vous choisissez :</p>
    <ul>
      <li><b>Attaque</b> : un coup simple, qui rend 2 PM.</li>
      <li><b>Sort</b> (${COUT.special} PM) : plus fort, ou utile au groupe (soin, bouclier…).</li>
      <li><b>Ultime</b> (${COUT.ultime} PM) : le grand sort, appris au niveau ${NIVEAU_ULTIME}.</li>
      <li><b>Défendre</b> : moitié des dégâts jusqu’à son prochain tour, et +4 PM.</li>
      <li><b>Objets</b> : ${Object.values(OBJETS).map((o) => `${o.glyphe} ${o.nom} (${o.texte.toLowerCase()})`).join(', ')}.</li>
    </ul>
    <p>Les ennemis préparent une <b>attaque chargée</b> : elle est annoncée sur leur carte quelques tours
    avant. Celle des élites et des boss frappe tout le groupe — c’est le moment de se défendre ou de poser
    un bouclier. Les monstres visent plus volontiers les tanks.</p>
    <p>Touchez un ennemi pour lire ses capacités : ${Object.values(TRAITS_RPG).map((t) => t.glyphe).join(' ')}.</p>
    <p>Un coup critique fait ×${MULT_CRIT} ; la chance et certains bijoux les rendent plus fréquents.
    Le bouton <b>Auto</b> laisse le groupe se battre seul.</p>`)
    + bloc('Les écoles', `
    <p>Chaque héros et chaque monstre appartient à une école. Frapper l’école qu’on domine fait
    ×${AVANTAGE} (▲), frapper celle qui vous domine ×${DESAVANTAGE} (▼).</p>
    <p>${ecoles}.</p>
    <div class="roue">${roueSvg()}</div>`)
    + bloc('Progression', `
    <p>Chaque victoire donne de l’expérience à <b>tout le groupe</b> — les tombés se relèvent à peine.
    Les niveaux montent jusqu’à ${NIVEAU_MAX} : plus de vie, d’attaque, d’armure et de mana.</p>
    <p>Aux niveaux ${NIVEAUX_DON.join(', ')} du héros, vous choisissez un <b>don</b> pour tout le groupe.</p>
    <p>L’<b>équipement</b> (arme, armure, bijou) se trouve sur les monstres, dans les coffres et chez le
    marchand. Sa force suit l’acte et sa rareté : commun, <span style="color:#5ea9ff">rare</span>,
    <span style="color:#c77dff">épique</span>. Gérez-le depuis l’écran du groupe.</p>
    <p>La <b>chance</b> (${CHANCE_DEPART} au départ) fait réussir les choix risqués, tomber de meilleures
    pièces et rend les critiques plus fréquents.</p>`)
    + bloc('Les choix', `
    <p>Les salles « ❓ » posent des questions. Certaines réponses rendent plus fort, d’autres coûtent de la
    vie, et certaines pèsent sur <b>les boss</b> : un boss affaibli par vos ruses, ou un Dragon renforcé par
    un pacte que vous avez accepté. Tout est écrit avant de choisir.</p>`)
    + bloc('La défaite', `
    <p>Si tout le groupe tombe, vous revenez au <b>dernier feu de camp</b> (ou au début de l’acte). La moitié
    de l’expérience gagnée depuis reste acquise ; l’or et le butin sont perdus.</p>
    <p>Un boss qui vous a battus garde ses blessures : il perd 10 % de sa vie à chaque défaite, jusqu’à 40 %.
    On ne bute jamais sans fin sur le même mur.</p>
    <p>La partie est enregistrée à chaque étape : vous pouvez fermer le jeu et reprendre plus tard.</p>`);
}
