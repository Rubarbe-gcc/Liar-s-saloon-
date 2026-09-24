/**
 * RAID — les règles, écrites depuis le moteur.
 *
 * Chaque nombre affiché ici est lu dans les constantes du moteur : si un
 * réglage bouge, la page bouge avec lui. Une règle fausse dans un écran
 * d'aide coûte plus cher qu'une règle absente.
 */

import {
  SEUIL_SPECIAL, SEUIL_ULTIME, MANA_MAX, SYNERGIE_ATK, PART_DOUBLE,
} from '../../../shared/raid/combat.js';
import {
  LONGUEUR_MAX, COLONNES, LIGNES, MANA_DOUBLE, MANA_SIMPLE,
} from '../../../shared/raid/globes.js';
import {
  CYCLE, ECOLES, roueSvg, domine, AVANTAGE, DESAVANTAGE,
} from '../../../shared/raid/ecoles.js';
import { ROLES, TALENTS, EFFETS, HEROS } from '../../../shared/raid/heros.js';
import { AILES, RENCONTRES_PAR_AILE, DIFFICULTES, BUTIN, RARETES } from '../../../shared/raid/donjon.js';
import { TRAITS } from '../../../shared/raid/ennemis.js';

const bloc = (titre, corps) => `<div class="regle-bloc"><h3>${titre}</h3>${corps}</div>`;
const pct = (v) => `${Math.round(v * 100)} %`;

/**
 * Les exemples chiffrés sont pris sur un personnage réel qui porte l'effet :
 * une valeur inventée ici finirait par mentir le jour où le roster bouge.
 */
function exempleTalent(type) {
  const h = HEROS.find((x) => x.talent.type === type);
  return h ? h.talent.valeur : 0.2;
}
function exempleEffet(type) {
  for (const h of HEROS) {
    for (const sort of [h.special, h.ultime]) {
      if (sort.effet?.type === type) return sort.effet.valeur;
    }
  }
  return 0.2;
}

function pageDonjon() {
  return bloc('Le donjon', `
    <p>Une partie est une descente : <code>${AILES.length}</code> ailes de
    <code>${RENCONTRES_PAR_AILE}</code> rencontres, soit
    <code>${AILES.length * RENCONTRES_PAR_AILE}</code> pulls d’affilée, du
    premier trash jusqu’au <b>Dragon Cendré</b>.</p>
    <p>Les six personnages partagent <b>une seule barre de vie</b> : celle du
    raid. Elle ne se remplit pas entre deux pulls — ce qui reste après une
    rencontre est ce avec quoi on entre dans la suivante. Un tank sert donc à
    quelque chose même les tours où il ne frappe pas : ses points de vie sont
    ceux de tout le monde.</p>
    <p>Un wipe, c’est le donjon perdu, pas seulement le combat. On ne
    recommence pas un pull : on repart de l’entrée.</p>`)
    + bloc('Butin et potions', `
    <p>Chaque boss d’aile lâche <b>une pièce à choisir parmi trois</b>. Elle
    vaut jusqu’au bout du donjon, et aucune n’est providentielle : c’est leur
    empilement sur quatre ailes qui doit suivre la montée du bestiaire.</p>
    <ul>${BUTIN.slice(0, 5).map((p) => {
      const r = RARETES[p.rarete] || RARETES.commun;
      return `<li>${p.glyphe} <b style="color:${r.teinte}">${p.nom}</b> — ${p.texte}</li>`;
    }).join('')}</ul>
    <p>Les <b>potions de soins</b> rendent 30 % de la vie du raid et se gardent
    d’un pull à l’autre. On en emporte
    ${Object.values(DIFFICULTES).map((d) => d.objets).join(', ')} selon la
    difficulté — au-delà, il faut trouver une sacoche dans le butin.</p>`)
    + bloc('Trois difficultés', `
    <ul>${Object.values(DIFFICULTES).map((d) =>
      `<li><b>${d.nom}</b> — ${d.texte} Boss à <code>${pct(d.part)}</code>,
       ${d.objets} potion${d.objets > 1 ? 's' : ''}.</li>`).join('')}</ul>`);
}

function pageGlobes() {
  return bloc('Le champ d’essence', `
    <p>Avant de lancer quoi que ce soit, un personnage trace un chemin sur la
    nappe de <code>${COLONNES} × ${LIGNES}</code> globes et récolte le mana
    qu’il ramasse en route. On passe d’un globe à un globe <b>voisin</b> —
    diagonales comprises — sans jamais repasser au même endroit, et sur
    <code>${LONGUEUR_MAX}</code> globes au maximum.</p>
    <p>Deux façons de jouer, au choix : <b>glisser</b> le doigt d’un globe à
    l’autre, ou les <b>toucher</b> un par un puis appuyer sur « Ramasser ».
    Revenir en arrière d’une case efface le dernier globe.</p>`)
    + bloc('Ce que rapporte un globe', `
    <ul>
      <li>Un globe de <b>votre école</b> : <code>${MANA_DOUBLE}</code> mana.</li>
      <li>Un globe d’<b>essence pure</b> (blanc) : <code>${MANA_DOUBLE}</code> mana, pour tout le monde.</li>
      <li>Un globe d’une <b>autre école</b> : <code>${MANA_SIMPLE}</code> mana.</li>
    </ul>
    <p>Le cercle blanc sur un globe signale ceux qui vous comptent double.</p>`)
    + bloc('Les seuils de mana', `
    <ul>
      <li><code>${SEUIL_SPECIAL}</code> mana — le <b>sort</b> est disponible.</li>
      <li><code>${SEUIL_ULTIME}</code> mana — le <b>sort ultime</b> s’ouvre.</li>
      <li><code>${MANA_MAX}</code> mana — le plafond. Chaque point au-delà du
      seuil atteint renforce encore le sort, mais rien ne s’accumule plus haut.</li>
    </ul>
    <p>La barre de mana se <b>vide en fin de tour</b> : garder son mana pour
    plus tard n’existe pas. L’<b>auto-attaque</b>, elle, ne coûte rien.</p>`);
}

function pageTour() {
  return bloc('Le déroulé d’un tour', `
    <p>Le raid compte six personnages ; <b>trois montent au front</b> à chaque
    tour, et les deux groupes alternent. En début de tour, le boss annonce deux
    choses : <b>qui a l’aggro</b>, et <b>après combien de personnages</b> il
    frappera.</p>
    <p>L’ordre de passage est donc la vraie décision. Celui qui joue avant le
    coup du boss peut poser un bouclier ; celui qui joue après frappe une cible
    déjà affaiblie, ou achève celle que le dot a rongée.</p>`)
    + bloc('L’incantation du boss', `
    <p>Chaque adversaire incante un gros sort en quelques tours — le compte à
    rebours est affiché sous lui. Quand il tombe à zéro, le coup part, et il
    fait beaucoup plus mal qu’une attaque ordinaire. C’est le tour où l’on veut
    un bouclier posé.</p>
    <ul>${Object.values(TRAITS).slice(0, 5).map((t) => `<li><b>${t.nom}</b> — ${t.texte}</li>`).join('')}</ul>`)
    + bloc('Synergies et chef de raid', `
    <p>Deux personnages du même groupe qui partagent une étiquette sont en
    <b>synergie</b> : chacun gagne <code>${pct(SYNERGIE_ATK)}</code> d’attaque
    par étiquette commune. Le symbole ⛓ sur un jeton indique combien il en a.</p>
    <p>Le <b>chef de raid</b> — le premier de la liste — applique son buff à
    tout le monde, lui compris. C’est le choix qui pèse le plus lourd avant
    d’entrer.</p>`);
}

function pageEcoles() {
  const cartes = CYCLE.map((a) => {
    const f = ECOLES[a];
    return `<li><b style="color:${f.teinte}">${f.glyphe} ${f.nom}</b> — ${f.trait}.
      Perce <b style="color:${ECOLES[domine(a)].teinte}">${ECOLES[domine(a)].nom}</b>
      <i>(${f.contre})</i>.</li>`;
  }).join('');

  return bloc('La roue des écoles', `
    ${roueSvg({ taille: 200 })}
    <p>Chaque école en perce une et se fait percer par une autre. Un sort lancé
    sur une cible vulnérable fait <code>×${AVANTAGE}</code> de dégâts ; sur une
    cible résistante, <code>×${DESAVANTAGE}</code>. La roue vaut dans les deux
    sens : elle protège aussi celui qui encaisse.</p>
    <ul>${cartes}</ul>`)
    + bloc('Les trois rôles', `
    <ul>${Object.values(ROLES).map((r) =>
      `<li><b style="color:${r.teinte}">${r.glyphe} ${r.nom}</b> — ${r.texte}</li>`).join('')}</ul>
    <p>Le glyphe du rôle apparaît sur chaque carte et sur chaque jeton : on doit
    pouvoir lire une composition d’un coup d’œil. Un raid sans tank fond, un
    raid sans soigneur ne passe pas la troisième aile.</p>`)
    + bloc('Effets et talents', `
    <p>Un sort porte presque toujours un effet, et chaque personnage a un talent
    toujours actif.</p>
    <ul>
      <li><b>Doublé</b> — deux coups à <code>${pct(PART_DOUBLE)}</code> chacun.</li>
      ${Object.entries(EFFETS).filter(([k]) => k !== 'double').slice(0, 5)
        .map(([k, e]) => `<li><b>${e.nom}</b> — ${e.texte(exempleEffet(k))}</li>`).join('')}
    </ul>
    <p>Et chaque talent, lu sur le personnage qui le porte :</p>
    <ul>${Object.entries(TALENTS).slice(0, 4)
      .map(([k, t]) => `<li><b>${t.nom}</b> — ${t.texte(exempleTalent(k))}</li>`).join('')}</ul>`);
}

export const PAGES = [
  { titre: 'Le donjon', sous: 'Cinq ailes, une seule barre de vie', rendu: pageDonjon },
  { titre: 'Le champ d’essence', sous: 'Ramasser le mana, franchir les seuils', rendu: pageGlobes },
  { titre: 'Le tour', sous: 'Groupes, aggro, incantation, synergies', rendu: pageTour },
  { titre: 'Écoles et rôles', sous: 'La roue, la trinité, les effets', rendu: pageEcoles },
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
