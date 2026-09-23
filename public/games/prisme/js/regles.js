/**
 * PRISME — les règles, écrites depuis le moteur.
 *
 * Chaque nombre affiché ici est lu dans les constantes du moteur : si un
 * réglage bouge, la page bouge avec lui. Une règle fausse dans un écran
 * d'aide coûte plus cher qu'une règle absente.
 */

import {
  SEUIL_SPECIAL, SEUIL_ULTIME, KI_MAX, RESONANCE_ATK, PART_DOUBLE,
} from '../../../shared/prisme/combat.js';
import {
  LONGUEUR_MAX, COLONNES, LIGNES, KI_DOUBLE, KI_SIMPLE,
} from '../../../shared/prisme/orbes.js';
import {
  CYCLE, AFFINITES, roueSvg, domine, AVANTAGE, DESAVANTAGE,
} from '../../../shared/prisme/affinites.js';
import { ROLES, PASSIFS, EFFETS, HEROS } from '../../../shared/prisme/heros.js';
import { SECTEURS, RENCONTRES_PAR_SECTEUR, DIFFICULTES, EVEILS } from '../../../shared/prisme/expedition.js';
import { TRAITS } from '../../../shared/prisme/ennemis.js';

const bloc = (titre, corps) => `<div class="regle-bloc"><h3>${titre}</h3>${corps}</div>`;
const pct = (v) => `${Math.round(v * 100)} %`;

/**
 * Les exemples chiffrés sont pris sur un héros réel qui porte l'effet : une
 * valeur inventée ici finirait par mentir le jour où le roster bouge.
 */
function exemplePassif(type) {
  const h = HEROS.find((x) => x.passif.type === type);
  return h ? h.passif.valeur : 0.2;
}
function exempleEffet(type) {
  for (const h of HEROS) {
    for (const coup of [h.special, h.ultime]) {
      if (coup.effet?.type === type) return coup.effet.valeur;
    }
  }
  return 0.2;
}

function pageExpedition() {
  return bloc('L’expédition', `
    <p>Une partie est une traversée : <code>${SECTEURS.length}</code> secteurs de
    <code>${RENCONTRES_PAR_SECTEUR}</code> rencontres, soit
    <code>${SECTEURS.length * RENCONTRES_PAR_SECTEUR}</code> combats d’affilée.</p>
    <p>Les six héros partagent <b>une seule barre de vie</b>. Elle ne se remplit pas
    entre deux combats : ce qui reste après une rencontre est ce avec quoi on
    entre dans la suivante. Un colosse sert donc à quelque chose même les tours
    où il ne frappe pas — ses points de vie sont ceux de tout le monde.</p>
    <p>Perdre, c’est perdre l’expédition, pas le combat. On ne rejoue pas une
    rencontre : on repart.</p>`)
    + bloc('Éveils et potions', `
    <p>À la fin de chaque secteur, un <b>éveil</b> est offert parmi trois. Il vaut
    jusqu’au bout de l’expédition, et aucun n’est spectaculaire seul : c’est
    l’empilement qui doit suivre la montée du bestiaire.</p>
    <ul>${EVEILS.slice(0, 5).map((e) => `<li>${e.glyphe} <b>${e.nom}</b> — ${e.texte}</li>`).join('')}</ul>
    <p>Les <b>potions</b> rendent 30 % de la vie d’équipe et se gardent d’un combat
    à l’autre. On en emporte ${Object.values(DIFFICULTES).map((d) => d.objets).join(', ')}
    selon la difficulté.</p>`)
    + bloc('Trois difficultés', `
    <ul>${Object.values(DIFFICULTES).map((d) =>
      `<li><b>${d.nom}</b> — ${d.texte} Adversaires à <code>${pct(d.part)}</code>,
       ${d.objets} potion${d.objets > 1 ? 's' : ''}.</li>`).join('')}</ul>`);
}

function pageOrbes() {
  return bloc('Le champ d’orbes', `
    <p>Avant de frapper, un héros trace un chemin sur la grille de
    <code>${COLONNES} × ${LIGNES}</code> orbes. On glisse d’une orbe à une orbe
    <b>voisine</b> — les diagonales comptent — sans jamais repasser deux fois au
    même endroit, et sur <code>${LONGUEUR_MAX}</code> orbes au maximum.</p>
    <p>Deux façons de jouer, au choix : <b>glisser</b> le doigt d’une orbe à
    l’autre, ou les <b>toucher</b> une par une puis appuyer sur « Ramasser ».
    Revenir en arrière d’une case efface la dernière orbe.</p>`)
    + bloc('Ce que rapporte une orbe', `
    <ul>
      <li>Une orbe de <b>votre affinité</b> : <code>${KI_DOUBLE}</code> ki.</li>
      <li>Une orbe <b>prismatique</b> (blanche) : <code>${KI_DOUBLE}</code> ki, pour tout le monde.</li>
      <li>Une orbe d’une <b>autre affinité</b> : <code>${KI_SIMPLE}</code> ki.</li>
    </ul>
    <p>Le cercle blanc sur une orbe signale celles qui vous comptent double.</p>`)
    + bloc('Les seuils de ki', `
    <ul>
      <li><code>${SEUIL_SPECIAL}</code> ki — l’<b>attaque spéciale</b> s’arme.</li>
      <li><code>${SEUIL_ULTIME}</code> ki — l’<b>attaque ultime</b> s’ouvre.</li>
      <li><code>${KI_MAX}</code> ki — le plafond. Chaque point au-delà du seuil
      atteint renforce encore le coup, mais rien ne s’accumule au-delà.</li>
    </ul>
    <p>La jauge se <b>vide à la fin du tour</b> : garder du ki pour plus tard n’existe
    pas. Une frappe normale, elle, ne coûte rien.</p>`);
}

function pageTour() {
  return bloc('Le déroulé d’un tour', `
    <p>L’équipe compte six héros ; <b>trois entrent en scène</b> à chaque tour, et
    les deux rotations alternent. Au début du tour, l’adversaire annonce deux
    choses : <b>qui</b> il vise, et <b>après combien de héros</b> il frappera.</p>
    <p>L’ordre de passage est donc la vraie décision. Le héros qui joue avant la
    fenêtre peut poser une garde ; celui qui joue après frappe une bête déjà
    entravée, ou achève celle que le brasier a rongée.</p>`)
    + bloc('L’attaque chargée', `
    <p>Chaque adversaire arme une attaque chargée en quelques tours — le compte
    à rebours est affiché sous lui. Quand il tombe à zéro, le coup part, et il
    fait beaucoup plus mal qu’une attaque ordinaire.</p>
    <ul>${Object.values(TRAITS).slice(0, 5).map((t) => `<li><b>${t.nom}</b> — ${t.texte}</li>`).join('')}</ul>`)
    + bloc('Résonances', `
    <p>Deux héros de la même rotation qui partagent une étiquette
    <b>résonnent</b> : chacun gagne <code>${pct(RESONANCE_ATK)}</code> d’attaque par
    étiquette commune. Le symbole ⛓ sur un jeton indique combien il en a.</p>
    <p>Le <b>meneur</b> — le premier héros de la liste — dope toute la garnison,
    lui compris. C’est le choix qui pèse le plus lourd avant de partir.</p>`);
}

function pageAffinites() {
  const cartes = CYCLE.map((a) => {
    const f = AFFINITES[a];
    return `<li><b style="color:${f.teinte}">${f.glyphe} ${f.nom}</b> — ${f.trait}.
      Domine <b style="color:${AFFINITES[domine(a)].teinte}">${AFFINITES[domine(a)].nom}</b>.</li>`;
  }).join('');

  return bloc('La roue des affinités', `
    ${roueSvg({ taille: 200 })}
    <p>Chaque affinité en domine une et en craint une autre. Un coup porté avec
    l’avantage fait <code>×${AVANTAGE}</code> de dégâts ; avec le désavantage,
    <code>×${DESAVANTAGE}</code>. La roue vaut dans les deux sens : elle protège
    aussi celui qui encaisse.</p>
    <ul>${cartes}</ul>`)
    + bloc('Les trois rôles', `
    <ul>${Object.values(ROLES).map((r) =>
      `<li><b style="color:${r.teinte}">${r.glyphe} ${r.nom}</b> — ${r.texte}</li>`).join('')}</ul>
    <p>Le glyphe du rôle apparaît sur chaque carte et sur chaque jeton : on doit
    pouvoir lire une rotation d’un coup d’œil.</p>`)
    + bloc('Effets et passifs', `
    <p>Une attaque spéciale porte souvent un effet, et chaque héros a un passif
    toujours actif.</p>
    <ul>
      <li><b>Doublé</b> — deux coups à <code>${pct(PART_DOUBLE)}</code> chacun.</li>
      ${Object.entries(EFFETS).filter(([k]) => k !== 'double').slice(0, 5)
        .map(([k, e]) => `<li><b>${e.nom}</b> — ${e.texte(exempleEffet(k))}</li>`).join('')}
    </ul>
    <p>Et chaque passif, lu sur le héros qui le porte :</p>
    <ul>${Object.entries(PASSIFS).slice(0, 4)
      .map(([k, p]) => `<li><b>${p.nom}</b> — ${p.texte(exemplePassif(k))}</li>`).join('')}</ul>`);
}

export const PAGES = [
  { titre: 'L’expédition', sous: 'Cinq secteurs, une seule barre de vie', rendu: pageExpedition },
  { titre: 'Le champ d’orbes', sous: 'Ramasser le ki, franchir les seuils', rendu: pageOrbes },
  { titre: 'Le tour', sous: 'Rotation, fenêtre ennemie, résonances', rendu: pageTour },
  { titre: 'Affinités et rôles', sous: 'La roue, les rôles, les effets', rendu: pageAffinites },
];

export function rendrePage(n) {
  const page = PAGES[Math.max(0, Math.min(PAGES.length - 1, n))];
  return {
    titre: page.titre,
    sous: page.sous,
    html: page.rendu() + `<div class="regle-pages">${PAGES.map((_, i) =>
      `<i class="piste-pas${i === n ? ' est-ici' : ''}"></i>`).join('')}</div>`,
  };
}
