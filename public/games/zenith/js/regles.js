/**
 * ZÉNITH — les trois pages de règles.
 *
 * Tout y est construit depuis les constantes du moteur, jamais recopié à la
 * main. Les règles annonçaient encore « 14 ki par tour » longtemps après que
 * le revenu se soit mis à dépendre de la vitesse : un texte figé ment dès
 * qu'on retouche l'équilibrage, et l'équilibrage se retouche.
 */

import {
  ELEMENTS, ELEMENT_KEYS, FIGHTERS, ROLES, ROLE_KEYS,
  roleOf, tempoOf, ADVANTAGE_BONUS, DISADVANTAGE_MALUS,
} from '../../../shared/zenith/fighters.js';
import {
  MOVES, MOVE_KEYS, STATUS, ELEMENT_STATUS,
  GUARD_REDUCTION, GUARD_KI, KI_PAR_TOUR, VITESSE_REF, KI_MAX,
  SOUTIENS_MAX, MAX_TURNS, TEAM_SIZE,
} from '../../../shared/zenith/battle.js';
import { roueSvg } from '../../../shared/zenith/roue.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pct = (x) => `${Math.round(x * 100)} %`;
const compte = (k) => FIGHTERS.filter((f) => roleOf(f).key === k).length;

/* ------------------------------------------------------------------ */

export function pageCombat() {
  const coup = (k) => {
    const m = MOVES[k];
    return `<b>${m.label}</b> ${m.ki ? `coûte ${m.ki} ki` : 'est gratuite'}`;
  };

  return `<div class="rules-grid">
    <section><h3><span>1</span> Un tour, une commande</h3><p>À chaque tour, les
      deux camps choisissent <b>en aveugle</b> : attaquer, se garder, changer de
      combattant ou lancer un soutien. Puis tout se résout d'un coup. Personne
      ne voit le choix de l'autre avant, ni sa réserve de ki.</p></section>

    <section><h3><span>2</span> L'ordre de résolution</h3><p>Les
      <b>changements</b> passent en premier, les <b>gardes</b> ensuite, puis les
      attaques et les soutiens <b>du plus rapide au plus lent</b>. C'est pourquoi
      la vitesse compte autant que la force.</p></section>

    <section><h3><span>3</span> Les quatre coups</h3><p>${coup('frappe')} et rend
      ${MOVES.frappe.kiGain} ki. ${coup('souffle')} et frappe plus fort.
      ${coup('speciale')} et inflige l'altération de son élément.
      ${coup('ultime')} et ne part qu'<b>une fois par combattant</b>.</p></section>

    <section><h3><span>4</span> Le ki</h3><p>Chaque combattant en gagne à la fin
      du tour, <b>d'autant plus qu'il est rapide</b> : environ ${KI_PAR_TOUR} à
      la vitesse de référence (${VITESSE_REF}), un peu moins s'il est lent, un peu
      plus s'il est vif. Se mettre en garde en rapporte ${GUARD_KI} de plus et
      amortit <b>${pct(1 - GUARD_REDUCTION)}</b> des dégâts du tour : c'est un
      investissement, pas une perte de temps. Le plafond est de ${KI_MAX}.</p></section>

    <section><h3><span>5</span> Le ki adverse est caché</h3><p>Vous ne voyez pas
      sa réserve. Elle se <b>déduit</b> pourtant : tout le monde part de 30, le
      revenu dépend d'une vitesse affichée, et chaque dépense passe par une
      commande que vous voyez jouer. À vous de suivre le compte.</p></section>

    <section><h3><span>6</span> Gagner</h3><p>Mettez les <b>${TEAM_SIZE}</b>
      combattants adverses à terre. Changer coûte le tour mais aucun ki : c'est
      la façon de reprendre l'avantage élémentaire. Au-delà de ${MAX_TURNS} tours,
      le combat se tranche aux points de vie restants.</p></section>
  </div>`;
}

/* ------------------------------------------------------------------ */

/** Conseil d'emploi propre à chaque rôle. */
const EMPLOI = {
  colosse: 'Envoyez-le encaisser le tour où vous redoutez un gros coup, et '
    + 'gardez vos fragiles derrière lui.',
  assaut: 'Il tient le rythme sans jamais manquer de ki, ce qui lui laisse de '
    + 'quoi placer une Spéciale au bon moment.',
  canon: 'Il lui faut du ki avant de compter. Une garde au premier tour est '
    + 'souvent son meilleur investissement.',
  polyvalent: 'Aucun mauvais tour, aucun tour décisif non plus. C\'est le '
    + 'combattant qu\'on envoie quand on ne sait pas encore ce qui arrive.',
  soigneur: 'Ne soignez pas à pleine vie : les points en trop sont perdus, et '
    + 'la charge aussi. Attendez qu\'un allié ait vraiment encaissé.',
  renfort: 'Posez-le tôt : le renfort ne paie que sur les tours qui suivent. '
    + 'Et il rend plus de ki qu\'il n\'en coûte.',
};

export function pageRoles() {
  const cartes = ROLE_KEYS.map((k) => {
    const r = ROLES[k];
    const exemples = FIGHTERS.filter((f) => roleOf(f).key === k)
      .slice(0, 3).map((f) => esc(f.name)).join(', ');
    return `<article class="rl-card" style="--rc:${r.color}">
      <header><span class="rl-g">${r.glyph}</span>
        <b>${r.label}</b><i>${compte(k)} combattants</i></header>
      <p class="rl-quoi">${esc(r.blurb)}</p>
      <p class="rl-comment">${esc(EMPLOI[k])}</p>
      <p class="rl-ex">Par exemple : ${exemples}</p>
    </article>`;
  }).join('');

  const rapides = FIGHTERS.filter((f) => tempoOf(f)?.key === 'rapide').length;
  const lents = FIGHTERS.filter((f) => tempoOf(f)?.key === 'lent').length;

  return `<p class="rules-chapo">Le rôle se <b>déduit des statistiques</b> : il
    ne dit jamais autre chose que ce que le combattant fait réellement. On le
    lit sur sa carte, sur sa fiche, et en pastille sur chaque portrait pendant
    le combat — des deux camps.</p>

  <div class="rl-cards">${cartes}</div>

  <h3 class="roles-titre">Le tempo, à part</h3>
  <p class="rules-chapo">La vitesse traverse tous les rôles — un colosse rapide
    reste un colosse — alors elle s'affiche à côté, jamais à la place :
    <span class="tempo-ex">»</span> agit avant la plupart (${rapides} combattants),
    <span class="tempo-ex">«</span> agit après (${lents}). Elle décide de l'ordre
    des coups <b>et</b> du revenu de ki.</p>

  <h3 class="roles-titre">Composer une équipe</h3>
  <p class="rules-chapo">Trois combattants, et deux questions : qui encaisse, et
    qui frappe ? Un camp tout en canons s'écroule au premier tour où le ki
    manque ; un camp tout en colosses ne tue personne. Les soutiens n'ont que
    <b>${SOUTIENS_MAX} charges pour tout le combat</b>, partagées par le camp :
    en emmener deux ne les double pas.</p>`;
}

/* ------------------------------------------------------------------ */

export function pageElements() {
  const lignes = ELEMENT_KEYS.map((k) => {
    const e = ELEMENTS[k];
    const st = STATUS[ELEMENT_STATUS[k]];
    return `<div class="el-row" style="--el:${e.color}">
      <b>${e.glyph} ${e.label}</b>
      <span class="el-bat">bat ${ELEMENTS[e.beats].glyph} ${ELEMENTS[e.beats].label}</span>
      <span class="el-st">${st.glyph} <u>${st.label}</u> — ${esc(st.blurb)}</span>
    </div>`;
  }).join('');

  return `<p class="rules-chapo">Chaque élément domine le suivant :
    <b>+${Math.round((ADVANTAGE_BONUS - 1) * 100)} %</b> de dégâts en avantage,
    <b>−${Math.round((1 - DISADVANTAGE_MALUS) * 100)} %</b> en désavantage. La roue
    reste affichée pendant le combat, dans un coin de l'arène.</p>

  <div class="roue-grande">${roueSvg({ labels: true })}</div>

  <h3 class="roles-titre">Ce que chaque élément impose</h3>
  <p class="rules-chapo">La Spéciale pose l'altération de son élément. Choisir
    son combattant, c'est donc aussi choisir ce qu'on impose à l'adversaire.</p>
  <div class="el-table">${lignes}</div>`;
}
