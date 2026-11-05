/**
 * LÉGENDES — les portraits, dessinés par le code (SVG) : un buste de style anime (le visage, les grands
 * yeux, la coiffure, la tenue), l'aura de son élément derrière lui ; les formes « éveil » et « divin »
 * ont l'aura qui flambe et les yeux qui brillent. Les ennemis ont leur propre silhouette (des monstres).
 */

import { ELEMENTS, RARETES } from '../../../shared/legendes/persos.js';

let n = 0;
const uid = () => `p${++n}`;

/** Les coiffures, dessinées au-dessus de la tête (le centre de la tête en 100, 92 ; rayon 34). */
const COIFFURES = {
  pics: (c) => `<path d="M58 96 L44 62 L66 74 L60 38 L82 62 L92 24 L104 58 L122 30 L120 64 L146 44 L134 76 L156 70 L142 98 L132 72 L68 72 Z" fill="${c}"/>`,
  meches: (c) => `<path d="M62 100 L58 70 Q70 48 100 46 Q132 48 142 72 L140 100 L132 78 L124 92 L118 72 L106 88 L100 70 L90 88 L84 72 L74 92 L70 76 Z" fill="${c}"/>`,
  long: (c) => `<path d="M60 150 Q48 96 64 66 Q82 46 100 46 Q120 46 136 66 Q152 96 140 150 L128 150 Q134 110 130 84 Q114 74 100 74 Q84 74 70 84 Q66 110 72 150 Z" fill="${c}"/><path d="M66 82 Q84 56 118 60 Q130 68 134 84 Q112 70 86 78 Z" fill="${c}"/>`,
  queue: (c) => `<path d="M64 94 Q60 60 100 50 Q140 60 136 94 L128 76 Q100 66 72 76 Z" fill="${c}"/><path d="M128 64 Q160 60 162 96 Q160 120 150 132 Q152 100 136 80 Z" fill="${c}"/>`,
  court: (c) => `<path d="M64 90 Q60 58 100 52 Q140 58 136 90 L130 74 Q100 64 70 74 Z" fill="${c}"/>`,
  crete: (c) => `<path d="M88 64 L84 22 L100 40 L106 14 L114 42 L126 26 L118 66 Z" fill="${c}"/><path d="M68 84 Q70 66 100 62 Q130 66 132 84 Q100 74 68 84 Z" fill="${c}"/>`,
  chauve: () => '',
};

/**
 * Le portrait d'un personnage. o : { taille, cadre (la carte, avec sa rareté), anime (l'aura qui bouge) }
 */
export function portrait(x, o = {}) {
  const t = o.taille || 120, id = uid();
  const c = x.couleurs, el = ELEMENTS[x.element];
  const divin = x.forme === 'divin', eveil = x.forme === 'eveil';
  const yeux = divin ? el.couleur : x.coiffure === 'chauve' ? '#3a2a1a' : c.cheveux === '#1b1b1f' ? '#3a3a6a' : c.cheveux;
  const aura = `<g class="${o.anime ? 'aura-anime' : ''}" opacity="${divin ? 1 : eveil ? 0.85 : 0.6}">
    <path d="M100 8 L114 48 L150 20 L140 62 L186 54 L156 92 L196 118 L150 122 L172 170 L128 146 L100 192 L72 146 L28 170 L50 122 L4 118 L44 92 L14 54 L60 62 L50 20 L86 48 Z" fill="url(#${id}a)"/></g>`;
  const corps = `<path d="M30 200 Q36 150 70 140 L90 132 L110 132 L130 140 Q164 150 170 200 Z" fill="${c.tenue}"/>
    <path d="M86 132 L100 160 L114 132 Z" fill="${c.peau}"/>
    <path d="M70 140 L86 132 L100 160 L76 150 Z M130 140 L114 132 L100 160 L124 150 Z" fill="rgba(0,0,0,.18)"/>`;
  const cou = `<rect x="88" y="112" width="24" height="24" fill="${c.peau}"/><rect x="88" y="112" width="24" height="8" fill="rgba(0,0,0,.15)"/>`;
  const tete = `<path d="M66 88 Q66 56 100 54 Q134 56 134 88 Q134 112 116 124 Q100 132 84 124 Q66 112 66 88 Z" fill="${c.peau}"/>`;
  const regard = (sx) => `<g transform="translate(${100 + sx * 15} 92)">
      <path d="M-10 -2 Q0 -9 10 -2 L10 4 Q0 10 -10 4 Z" fill="#fff"/>
      <ellipse cx="${-sx * 1.5}" cy="1" rx="5.2" ry="6.4" fill="${yeux}"/>
      <ellipse cx="${-sx * 1.5}" cy="1.5" rx="2.6" ry="3.6" fill="#0a0a12"/>
      <circle cx="${-sx * 1.5 + 1.8}" cy="-1.6" r="1.7" fill="#fff"/>
      <path d="M-11 -3 Q0 -11 11 -3" stroke="#1b1b1f" stroke-width="2.6" fill="none"/>
      <path d="M${-12 * sx} -12 L${8 * sx} ${divin ? -10 : -14}" stroke="${x.coiffure === 'chauve' ? '#3a2a1a' : c.cheveux}" stroke-width="3.4" stroke-linecap="round"/>
    </g>`;
  const brille = divin ? `<g opacity=".9"><circle cx="85" cy="93" r="9" fill="${el.couleur}" opacity=".35"/><circle cx="115" cy="93" r="9" fill="${el.couleur}" opacity=".35"/></g>` : '';
  const bouche = `<path d="M92 114 Q100 ${divin || eveil ? 117 : 119} 108 114" stroke="#5a2a2a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const nez = '<path d="M100 100 L97 108 L101 108" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none"/>';
  const cheveux = (COIFFURES[x.coiffure] || COIFFURES.court)(c.cheveux);
  const fond = `<defs>
      <radialGradient id="${id}f" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${el.couleur}" stop-opacity=".55"/><stop offset="1" stop-color="#0a0a14"/></radialGradient>
      <radialGradient id="${id}a" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="${c.aura}" stop-opacity=".9"/><stop offset="1" stop-color="${c.aura}" stop-opacity="0"/></radialGradient>
    </defs>${o.fond === false ? '' : `<rect width="200" height="200" fill="url(#${id}f)"/>`}`;
  const svg = `<svg viewBox="0 0 200 200" width="${t}" height="${t}" role="img" aria-label="${x.nom}">${fond}${aura}${corps}${cou}${x.coiffure === 'long' ? cheveux : ''}${tete}${regard(-1)}${regard(1)}${brille}${nez}${bouche}${x.coiffure !== 'long' ? cheveux : ''}</svg>`;
  if (!o.cadre) return svg;
  const R = RARETES[x.rarete];
  return `<div class="carte rar-${x.rarete}${o.classe ? ` ${o.classe}` : ''}" style="--rar:${R.couleur};--el:${el.couleur}"${o.data ? ` data-id="${x.id}"` : ''}>
    ${svg}<span class="rar">${x.rarete}</span><span class="el">${el.glyphe}</span>${o.eveil !== undefined ? `<span class="etoiles">${'★'.repeat(o.eveil)}</span>` : ''}${o.nom !== false ? `<span class="nom">${x.nom}</span>` : ''}</div>`;
}

/** Un ennemi : une silhouette de monstre (des cornes, des yeux qui luisent), aux couleurs de son élément. */
export function ennemi(e, taille = 160) {
  const id = uid(), el = ELEMENTS[e.element];
  const k = [...e.nom].reduce((t, ch) => t + ch.charCodeAt(0), 0);
  const cornes = k % 3 === 0 ? '<path d="M64 70 L44 20 L80 58 Z M136 70 L156 20 L120 58 Z" fill="#2a2a32"/>' : k % 3 === 1 ? '<path d="M70 60 L60 10 L90 50 Z M130 60 L140 10 L110 50 Z M100 50 L100 6 L110 46 Z" fill="#3a3a44"/>' : '<path d="M60 76 Q40 40 70 30 Q66 54 80 64 Z M140 76 Q160 40 130 30 Q134 54 120 64 Z" fill="#2a2a32"/>';
  return `<svg viewBox="0 0 200 200" width="${taille}" height="${taille}" role="img" aria-label="${e.nom}">
    <defs><radialGradient id="${id}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${el.couleur}" stop-opacity=".7"/><stop offset="1" stop-color="${el.couleur}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="100" cy="100" r="96" fill="url(#${id})"/>
    ${cornes}
    <path d="M40 196 Q30 120 60 84 Q80 60 100 60 Q120 60 140 84 Q170 120 160 196 Z" fill="#1c1c24" stroke="${el.couleur}" stroke-width="3"/>
    <path d="M70 110 L90 100 L88 112 Z M130 110 L110 100 L112 112 Z" fill="${el.couleur}"/>
    <path d="M70 110 L90 100 L88 112 Z M130 110 L110 100 L112 112 Z" fill="#fff" opacity=".6" transform="translate(2 1) scale(.98)"/>
    <path d="M78 140 L86 132 L94 142 L100 132 L106 142 L114 132 L122 140 L114 152 L86 152 Z" fill="#eee" opacity=".85"/>
    ${e.boss ? `<circle cx="100" cy="100" r="92" fill="none" stroke="${el.couleur}" stroke-width="2" stroke-dasharray="6 8" opacity=".7"/>` : ''}
  </svg>`;
}
