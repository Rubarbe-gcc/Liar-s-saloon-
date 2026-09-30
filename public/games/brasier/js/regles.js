/**
 * BRASIER — les règles, construites depuis les données.
 *
 * Coûts, plafonds, cartes et pouvoirs se lisent dans le moteur : écrits à la
 * main, ils redeviendraient faux à la première retouche d'équilibrage.
 */

import { RECRUTABLES, MOTS, texte, TRIBUS } from '../../../shared/brasier/serviteurs.js';
import { HEROS, PV_HEROS } from '../../../shared/brasier/heros.js';
import {
  COUT_SERVITEUR, PRIX_VENTE, COUT_RAFRAICHIR, COUT_RANG, TAILLE_TAVERNE, OR_MAX,
  PLATEAU_MAX, JOUEURS, plafondDegats,
} from '../../../shared/brasier/partie.js';
import { medaillon, portrait, esc } from './ui.js';

export function pagePartie() {
  const rangs = Object.entries(COUT_RANG).map(([r, c]) => `rang ${r} : ${c}`).join(', ');
  return `<p>${JOUEURS} champions, ${PV_HEROS} PV chacun. On recrute, on se bat, on saigne —
    le dernier debout remporte le Brasier. Les chaises vides sont prises par des bots, qui
    jouent avec les mêmes règles et la même réserve que vous.</p>
  <div class="regle-grille">
    <section><h4>1 · Le recrutement</h4><p>Chaque tour apporte de l'or : 3 au premier, un de plus
      à chaque tour, jusqu'à ${OR_MAX}. Un serviteur coûte ${COUT_SERVITEUR} pièces et se revend
      ${PRIX_VENTE}. Rafraîchir la taverne coûte ${COUT_RAFRAICHIR}. Le plateau tient ${PLATEAU_MAX}
      serviteurs.</p></section>
    <section><h4>2 · La taverne</h4><p>Monter d'un rang ouvre des serviteurs plus puissants et
      élargit l'offre (de ${TAILLE_TAVERNE[1]} à ${TAILLE_TAVERNE[6]} serviteurs). Coûts de base —
      ${rangs} — et chaque tour passé sans monter en retire une pièce. ❄️ gèle l'offre pour le
      tour suivant.</p></section>
    <section><h4>3 · Les triples</h4><p>Trois exemplaires du même serviteur fusionnent en une
      version <b>dorée</b> : statistiques et effets doublés, et une <b>découverte</b> d'un rang
      au-dessus de votre taverne. La réserve est commune à la table : ce que les autres
      achètent, vous ne le trouverez plus.</p></section>
    <section><h4>4 · Le combat</h4><p>Tout se joue seul. Le camp qui a le plus de serviteurs
      frappe en premier ; chacun attaque à son tour, de gauche à droite — l'ordre de votre
      plateau compte. Le perdant perd autant de PV que le rang de taverne du vainqueur plus
      les étoiles de ses survivants, plafonné à ${plafondDegats(1)} jusqu'au tour 3,
      ${plafondDegats(4)} jusqu'au tour 7, puis ${plafondDegats(8)}.</p></section>
    <section><h4>5 · Les appariements</h4><p>On évite de retrouver le même adversaire deux tours
      de suite. En nombre impair, quelqu'un affronte le fantôme du dernier éliminé : ce combat
      peut vous coûter des PV, mais le fantôme, lui, ne saigne plus.</p></section>
  </div>
  <h3>Sur l'écran</h3>
  <p>Glissez un serviteur de la taverne au plateau pour l'acheter, du plateau à la taverne
    pour le vendre, ou d'une place à l'autre du plateau pour changer l'ordre d'attaque.
    Au toucher, ses boutons apparaissent sur lui : Acheter, Vendre, ◀ ▶.
    ⚡ début de combat · ⏳ fin de tour · 💀 râle · 🩸 se nourrit des morts.</p>`;
}

export function pageMots() {
  return `<div class="regle-grille">${Object.values(MOTS).map((m) =>
    `<section><h4>${m.glyph} ${m.label}</h4><p>${m.texte}</p></section>`).join('')}
    <section><h4>Cri</h4><p>S'applique au moment de l'achat.</p></section>
    <section><h4>Fin du tour</h4><p>S'applique quand le recrutement se termine, avant le combat.</p></section>
    <section><h4>Début de combat</h4><p>S'applique avant le premier coup.</p></section>
    <section><h4>Râle</h4><p>S'applique à la mort du serviteur, en combat.</p></section>
  </div>`;
}

export function pageCartes() {
  let out = '';
  for (let r = 1; r <= 6; r++) {
    out += `<h3>${'★'.repeat(r)} Rang ${r}</h3><div class="liste-cartes">${RECRUTABLES
      .filter((s) => s.tier === r)
      .map((s) => `<div class="ligne-carte">
        ${medaillon({ uid: `r-${s.id}`, id: s.id, atk: s.atk, pv: s.pv, mots: [...(s.mots || [])], dore: false })}
        <div><b>${esc(s.nom)}</b> <span class="fiche-meta">${TRIBUS[s.tribu].glyph} ${TRIBUS[s.tribu].label}</span>
        <p>${texte(s.id) || (s.mots || []).map((m) => MOTS[m].label).join(', ') || '—'}</p></div>
      </div>`).join('')}</div>`;
  }
  return out;
}

export function pageHeros() {
  return `<div class="liste-cartes">${HEROS.map((h) => `<div class="ligne-carte">
    ${portrait(h.id)}
    <div><b>${esc(h.nom)}</b>
    <p>${h.pouvoir.passif ? "<b>Passif</b> — " : `<b>${h.pouvoir.cout} 🪙</b> — `}${esc(h.pouvoir.texte)}</p></div>
  </div>`).join('')}</div>`;
}
