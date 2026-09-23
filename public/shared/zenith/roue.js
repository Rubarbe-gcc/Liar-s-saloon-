/**
 * ZÉNITH — la roue des éléments.
 *
 * Le cycle « qui bat qui » est la première chose qu'un joueur doit savoir, et
 * la dernière qu'il retient d'une phrase lue dans un écran de règles. On le
 * dessine donc, en permanence et à côté du combat, plutôt que de l'écrire.
 *
 * Module ISO : il ne produit qu'une chaîne SVG, sans toucher au document.
 */

import { ELEMENTS, ELEMENT_KEYS, elementMultiplier } from './fighters.js';

/** Les éléments dans l'ordre du cycle, en partant de la braise. */
export function ordreCycle() {
  const out = [ELEMENT_KEYS[0]];
  for (let i = 1; i < ELEMENT_KEYS.length; i++) out.push(ELEMENTS[out[i - 1]].beats);
  return out;
}

const R = 38;          // rayon du cercle des sommets
const C = 50;          // centre
/** Un pentagone pointe en haut : on part de −90°. */
const angle = (i, n) => (-90 + (360 / n) * i) * Math.PI / 180;
const pos = (i, n, r = R) => ({ x: C + r * Math.cos(angle(i, n)), y: C + r * Math.sin(angle(i, n)) });

/**
 * Roue du cycle élémentaire.
 *
 * @param {object} [o]
 * @param {string} [o.moi]   élément à mettre en avant, côté joueur
 * @param {string} [o.cible] élément adverse ; la flèche qui les relie est
 *                           alors soulignée, ce qui montre le rapport de
 *                           force plutôt que de le faire déduire
 * @param {boolean} [o.labels] écrire le nom des éléments sous les pastilles
 */
export function roueSvg({ moi = null, cible = null, labels = false } = {}) {
  const cycle = ordreCycle();
  const n = cycle.length;
  const idx = Object.fromEntries(cycle.map((k, i) => [k, i]));

  // Flèches : chaque élément pointe vers celui qu'il domine.
  const fleches = cycle.map((k, i) => {
    const j = idx[ELEMENTS[k].beats];
    const a = pos(i, n, R - 11);
    const b = pos(j, n, R - 11);
    const vif = moi && cible && ((k === moi && ELEMENTS[k].beats === cible)
      || (k === cible && ELEMENTS[k].beats === moi));
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}"
      x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"
      stroke="${vif ? ELEMENTS[k].color : 'rgba(255,255,255,.16)'}"
      stroke-width="${vif ? 2.4 : 1.1}" marker-end="url(#rp-${vif ? 'vif' : 'pale'})"/>`;
  }).join('');

  const sommets = cycle.map((k, i) => {
    const p = pos(i, n);
    const el = ELEMENTS[k];
    const estMoi = k === moi;
    const estCible = k === cible;
    const eteint = (moi || cible) && !estMoi && !estCible;
    return `<g opacity="${eteint ? 0.58 : 1}">
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11.5"
        fill="${el.color}22" stroke="${el.color}"
        stroke-width="${estMoi || estCible ? 2.4 : 1.2}"/>
      <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle"
        font-size="11">${el.glyph}</text>
      ${labels ? `<text x="${p.x.toFixed(1)}" y="${(p.y + 22).toFixed(1)}" text-anchor="middle"
        font-size="6.5" fill="${el.color}" letter-spacing=".05em">${el.label.toUpperCase()}</text>` : ''}
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 100 ${labels ? 108 : 100}" class="roue" aria-hidden="true">
    <defs>
      <marker id="rp-pale" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5"
        markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="rgba(255,255,255,.22)"/>
      </marker>
      <marker id="rp-vif" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6"
        markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0 L8 4 L0 8 z" fill="currentColor"/>
      </marker>
    </defs>
    ${fleches}${sommets}
  </svg>`;
}

/** Phrase qui dit le rapport de force, pour les lecteurs d'écran. */
export function resumeMatchup(moi, cible) {
  const m = elementMultiplier(moi, cible);
  const a = ELEMENTS[moi], b = ELEMENTS[cible];
  if (m > 1) return `${a.label} domine ${b.label} : dégâts augmentés.`;
  if (m < 1) return `${a.label} est dominé par ${b.label} : dégâts réduits.`;
  return `${a.label} contre ${b.label} : aucun avantage.`;
}
