/**
 * ÉCHO — les trois pages de règles, construites depuis les constantes.
 *
 * Le barème est la partie du jeu qu'on conteste : autant qu'il soit affiché
 * tel qu'il est calculé, et non tel qu'on l'a imaginé un jour.
 */

import { POIDS } from '../../../shared/mimic/analyse.js';
import {
  CASES, SABOTAGES, MANCHES, DUREE_PRISE, MANCHE_ROUE, JOUEURS_MAX,
} from '../../../shared/mimic/partie.js';
import { SONS, FAMILLES, FAMILLE_KEYS } from '../../../shared/mimic/sons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function pageManche() {
  const familles = FAMILLE_KEYS.map((k) => {
    const f = FAMILLES[k];
    const n = SONS.filter((s) => s.famille === k).length;
    return `${f.glyph} ${f.label} (${n})`;
  }).join(' · ');

  return `<p class="rules-chapo">De 1 à ${JOUEURS_MAX} joueurs, ${MANCHES} manches,
    une dizaine de minutes. Chaque manche suit les mêmes six étapes.</p>
  <div class="rules-grid">
    <section><h3><span>1</span> Le son passe</h3><p>Une fois. Pour tout le monde
      en même temps. Son nom, son indice et le <b>nombre de débuts de son</b>
      attendus restent affichés — ce dernier n'est pas une indication, c'est
      exactement ce que le barème comptera.</p></section>

    <section><h3><span>2</span> Tout le monde enregistre</h3><p>Sur le même
      compte à rebours, pendant <b>${DUREE_PRISE} secondes</b>. Personne
      n'attend son tour, et personne ne s'entend préparer son coup.</p></section>

    <section><h3><span>3</span> Pas de seconde prise</h3><p>Ce qui sort sort.
      C'est ce qui rend la première seconde aussi importante que les
      trois autres.</p></section>

    <section><h3><span>4</span> On réécoute</h3><p>Les prises passent une par
      une. C'est le moment du jeu où l'on rit, et c'est aussi celui où les
      sabotages se révèlent.</p></section>

    <section><h3><span>5</span> Le barème note</h3><p>Sur cent, en combinant
      mélodie, rythme et attaques. Le détail est à l'onglet suivant.</p></section>

    <section><h3><span>6</span> La roue tourne</h3><p>À partir de la manche
      ${MANCHE_ROUE}. Elle donne des points, ou de quoi nuire.</p></section>
  </div>
  <h3 class="roles-titre">Les sons</h3>
  <p class="rules-chapo">${SONS.length}, répartis en ${FAMILLE_KEYS.length} familles : ${familles}.
    Aucun n'est un fichier : tous sont <b>calculés</b> au moment où ils sonnent.
    Le jeu tient donc hors ligne, et ne doit rien à personne.</p>`;
}

export function pageNote() {
  return `<p class="rules-chapo">La note sur cent combine trois dimensions.
    Aucune n'est une impression : chacune se calcule sur le signal.</p>

  <div class="rl-cards">
    <article class="rl-card" style="--rc:#a78bfa">
      <header><span class="rl-g">🎵</span><b>Mélodie</b><i>${POIDS.melodie} %</i></header>
      <p class="rl-quoi">La forme de la ligne mélodique : ce qui monte doit
        monter, ce qui descend doit descendre.</p>
      <p class="rl-comment"><b>En hauteur relative.</b> Chaque contour est
        ramené à sa propre médiane avant comparaison, si bien qu'une voix grave
        et une voix aiguë qui suivent le même dessin obtiennent la même note.
        Chanter une octave en dessous ne coûte rien.</p>
    </article>

    <article class="rl-card" style="--rc:#38bdf8">
      <header><span class="rl-g">🥁</span><b>Rythme</b><i>${POIDS.rythme} %</i></header>
      <p class="rl-quoi">La répartition de l'énergie dans le temps.</p>
      <p class="rl-comment">C'est ce qui sépare « taa-ta-ta » de « ta-ta-taa »
        à hauteur identique. Imiter au hasard rapporte zéro, pas la moitié.
        À noter : bousculer le rythme coûte aussi un peu de mélodie, puisque
        les hauteurs se comparent sur une durée ramenée au même étalon. Un air
        chanté sur le mauvais rythme n'est pas tout à fait le même air.</p>
    </article>

    <article class="rl-card" style="--rc:#4ade80">
      <header><span class="rl-g">💥</span><b>Attaques</b><i>${POIDS.attaques} %</i></header>
      <p class="rl-quoi">Le nombre de débuts de son.</p>
      <p class="rl-comment">Un aboiement ne vaut pas trois aboiements, même
        très bien imités. Le compte attendu est affiché : il n'y a rien à
        deviner, seulement à faire.</p>
    </article>
  </div>

  <h3 class="roles-titre">Ce qui n'est pas noté</h3>
  <p class="rules-chapo">Ni votre timbre, ni votre accent, ni votre registre.
    Un son de référence sans hauteur — un bruit, une percussion — voit son
    poids de mélodie réparti sur les deux autres dimensions plutôt que
    d'accorder des points gratuits.</p>`;
}

export function pageRoue() {
  const cases = CASES.map((c) => `<div class="el-row" style="--el:${c.color}">
    <b>${c.glyph} ${esc(c.label)}</b>
    <span class="el-bat">${c.points ? `+${c.points} points` : (c.sabotage ? 'sabotage' : '—')}</span>
    <span class="el-st">${esc(c.blurb)}</span>
  </div>`).join('');

  return `<p class="rules-chapo">À partir de la manche ${MANCHE_ROUE}, chacun
    peut tourner la roue — ou s'en passer. Un sabotage se <b>vise</b> : on
    choisit sa victime.</p>

  <div class="el-table">${cases}</div>

  <h3 class="roles-titre">Un sabotage ne vole pas de points</h3>
  <p class="rules-chapo">Il déforme uniquement la <b>restitution</b> : la
    victime s'entend saturée, en écho, hachée, ou carrément remplacée par un
    canard devant toute la table. Sa note, elle, a déjà été calculée sur le
    signal propre. On se moque de son voisin ; on ne le dépouille pas — ce qui
    est précisément ce qui rend la chose acceptable entre amis.</p>`;
}
