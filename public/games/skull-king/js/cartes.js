/**
 * SKULL KING — le dessin des cartes.
 *
 * Aucune image : chaque carte est un petit SVG, dessiné ici. Les couleurs
 * ont leur emblème (coffre, perroquet, carte au trésor, pavillon noir), les
 * cartes spéciales leur portrait.
 */

import { COULEURS } from '../../../shared/skullking/moteur.js';

const svg = (corps, cls = 'art') => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${corps}</svg>`;

/* ------------------------------------------------------------------ */
/* Les emblèmes des couleurs                                          */
/* ------------------------------------------------------------------ */

const crane = (os = '#f3ead2', creux = '#1b1720') => `
  <path d="M50 20C33 20 24 32 24 45c0 8 4 14 11 17v9c0 2 2 4 4 4h22c2 0 4-2 4-4v-9c7-3 11-9 11-17 0-13-9-25-26-25z" fill="${os}"/>
  <ellipse cx="39" cy="46" rx="7.5" ry="8.5" fill="${creux}"/><ellipse cx="61" cy="46" rx="7.5" ry="8.5" fill="${creux}"/>
  <path d="M50 55l-4.5 8h9z" fill="${creux}"/>
  <path d="M41 67v8M47 67v8M53 67v8M59 67v8" stroke="${creux}" stroke-width="2.2" stroke-linecap="round"/>`;

export const EMBLEMES = {
  /* Un coffre débordant de pièces. */
  Y: `<circle cx="34" cy="26" r="7" fill="#fff4bf"/><circle cx="50" cy="20" r="7" fill="#fff4bf"/><circle cx="66" cy="27" r="7" fill="#fff4bf"/>
    <circle cx="42" cy="30" r="6" fill="#ffe27a"/><circle cx="58" cy="29" r="6" fill="#ffe27a"/>
    <path d="M16 46c0-11 10-18 34-18s34 7 34 18z" fill="currentColor"/>
    <rect x="16" y="46" width="68" height="36" rx="4" fill="currentColor"/>
    <path d="M16 46h68v6H16z" fill="#000" opacity=".25"/>
    <rect x="28" y="28" width="7" height="54" fill="#000" opacity=".22"/><rect x="65" y="28" width="7" height="54" fill="#000" opacity=".22"/>
    <rect x="43" y="42" width="14" height="17" rx="3" fill="#fff4bf"/><circle cx="50" cy="49" r="2.6" fill="#5a3a06"/><path d="M50 50v5" stroke="#5a3a06" stroke-width="2"/>`,
  /* Un perroquet de profil. */
  G: `<path d="M64 74l8 20 4-3-6-18zM58 76l2 21 5-1-2-20z" fill="currentColor" opacity=".8"/>
    <path d="M56 28c18 4 24 26 14 46-3 6-10 8-16 4-12-8-15-30-8-44z" fill="currentColor"/>
    <path d="M60 44c11 5 12 22 4 32-1-12-3-22-4-32z" fill="#000" opacity=".25"/>
    <circle cx="49" cy="30" r="15" fill="currentColor"/>
    <path d="M36 25c-9 1-11 14-3 17-1-6 1-11 6-11z" fill="#ffd25e"/><path d="M36 25c3-2 7-2 9 1l-6 5z" fill="#e8a52a"/>
    <circle cx="50" cy="27" r="5" fill="#fff"/><circle cx="49" cy="27" r="2.6" fill="#111"/>
    <path d="M44 16c2-6 8-9 14-7-5 1-8 4-9 8z" fill="#ff5a4a"/>`,
  /* Une carte au trésor roulée, son chemin et sa croix. */
  P: `<path d="M22 24h52c5 0 7 3 7 6v44c0 4-3 6-7 6H28c-5 0-8-3-8-7V30c0-3 1-6 2-6z" fill="#f1e3c2"/>
    <path d="M22 24c-5 0-7 3-7 6s2 6 7 6" fill="#d9c597"/><path d="M81 74c4 0 6 3 6 5s-2 5-6 5H30" fill="#d9c597"/>
    <path d="M30 70c6-6 4-14 13-16s8-12 16-14 9-6 9-6" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/>
    <path d="M62 30l10 10M72 30L62 40" stroke="#b3261e" stroke-width="4" stroke-linecap="round"/>
    <circle cx="30" cy="70" r="3.5" fill="currentColor"/>
    <path d="M30 34l3 6-3 6-3-6z M24 40h12" stroke="currentColor" stroke-width="1.6" fill="currentColor" opacity=".7"/>`,
  /* Le pavillon noir : crâne et tibias. */
  B: `<g stroke="#f3ead2" stroke-width="8" stroke-linecap="round"><path d="M22 66L78 88M78 66L22 88"/></g>
    <g fill="#f3ead2"><circle cx="18" cy="62" r="5"/><circle cx="24" cy="70" r="5"/><circle cx="82" cy="62" r="5"/><circle cx="76" cy="70" r="5"/>
    <circle cx="18" cy="92" r="5"/><circle cx="26" cy="86" r="5"/><circle cx="82" cy="92" r="5"/><circle cx="74" cy="86" r="5"/></g>
    <g transform="translate(0 -8)">${crane()}</g>`,
};

/* ------------------------------------------------------------------ */
/* Les portraits des cartes spéciales                                 */
/* ------------------------------------------------------------------ */

/** Les cinq pirates : peau, barbe, chapeau, et un détail chacun. */
const PIRATES = [
  { peau: '#e9b48a', barbe: '#8d8d93', chapeau: '#1d1b22', galon: '#e8b54a', bandeau: true },
  { peau: '#f0c29b', barbe: null, chapeau: '#8e1f24', galon: '#f6d36b', cheveux: '#b3261e', boucle: true },
  { peau: '#c98c62', barbe: '#2a1a12', chapeau: '#2b3b2c', galon: '#c9a24a', bandeau: false, cicatrice: true },
  { peau: '#8a5a3c', barbe: null, chapeau: '#1d2840', galon: '#e8b54a', cheveux: '#151018', bandeau: true, boucle: true },
  { peau: '#f2c7a0', barbe: '#d98a2b', chapeau: '#3b2416', galon: '#e8b54a', tresses: true },
];

function pirate(i) {
  const p = PIRATES[(i - 1) % PIRATES.length];
  return `
    ${p.cheveux ? `<path d="M26 40c-4 18 0 38 8 46h32c8-8 12-28 8-46z" fill="${p.cheveux}"/>` : ''}
    <path d="M24 100c2-16 12-24 26-24s24 8 26 24z" fill="#5a1d1d"/><path d="M42 76l8 12 8-12" fill="#f1e3c2"/>
    <ellipse cx="50" cy="52" rx="20" ry="23" fill="${p.peau}"/>
    ${p.barbe ? `<path d="M30 54c0 22 10 34 20 34s20-12 20-34c-5 8-12 10-20 10s-15-2-20-10z" fill="${p.barbe}"/>
      ${p.tresses ? `<path d="M44 84l-2 10M56 84l2 10" stroke="${p.barbe}" stroke-width="4" stroke-linecap="round"/>` : ''}` : ''}
    <path d="M42 66c5 3 11 3 16 0" stroke="#5a2a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="41" cy="50" r="3" fill="#1b1720"/>
    ${p.bandeau ? `<path d="M28 42l44-6" stroke="#111" stroke-width="2"/><ellipse cx="60" cy="49" rx="7" ry="6" fill="#111"/>`
      : '<circle cx="59" cy="50" r="3" fill="#1b1720"/>'}
    ${p.cicatrice ? '<path d="M62 40l-6 18" stroke="#8a3b2a" stroke-width="2"/>' : ''}
    ${p.boucle ? '<circle cx="30" cy="60" r="3.5" fill="none" stroke="#f6d36b" stroke-width="2"/>' : ''}
    <path d="M14 34c10 4 22-14 36-14s26 18 36 14c-4 8-14 12-36 12S18 42 14 34z" fill="${p.chapeau}"/>
    <path d="M28 30c4-12 12-20 22-20s18 8 22 20c-8 4-14 5-22 5s-14-1-22-5z" fill="${p.chapeau}"/>
    <path d="M16 35c10 4 22-12 34-12s24 16 34 12" stroke="${p.galon}" stroke-width="2" fill="none"/>
    <g transform="translate(50 22) scale(.16)">${crane('#f3ead2', p.chapeau).replace(/translate\([^)]*\)/, '')}</g>`;
}

const ART = {
  sk: () => `
    <path d="M24 100c2-14 12-22 26-22s24 8 26 22z" fill="#5a0f14"/><path d="M30 100l8-18h24l8 18" fill="#e8b54a" opacity=".35"/>
    <g transform="translate(0 6)">${crane('#f6ecd0', '#2a0a0e')}</g>
    <circle cx="39" cy="52" r="2.6" fill="#ff4a3a"/><circle cx="61" cy="52" r="2.6" fill="#ff4a3a"/>
    <path d="M24 30l6-20 10 12 10-16 10 16 10-12 6 20z" fill="#e8b54a"/>
    <path d="M24 30h52v6H24z" fill="#c38d22"/>
    <circle cx="50" cy="20" r="3.5" fill="#b3261e"/><circle cx="32" cy="24" r="2.5" fill="#2f7fd6"/><circle cx="68" cy="24" r="2.5" fill="#2fa35a"/>`,
  sir: () => `
    <path d="M30 26c-8 14-10 34-2 50 6-6 8-20 10-30z" fill="#e05a7a"/><path d="M70 26c8 14 10 34 2 50-6-6-8-20-10-30z" fill="#e05a7a"/>
    <path d="M38 64c-6 12-2 22 8 26-6 4-12 6-18 4 4 6 14 8 22 4 10 4 18 0 20-8-8 2-12 0-14-6 8-6 8-14 6-20z" fill="#1f9e9a"/>
    <path d="M42 70c4 2 10 2 14 0M41 78c5 2 11 2 16 0" stroke="#7fe0d6" stroke-width="1.6" fill="none"/>
    <ellipse cx="50" cy="40" rx="15" ry="17" fill="#f2c7a0"/>
    <path d="M34 36c0-14 8-20 16-20s16 6 16 20c-4-8-8-10-16-10s-12 2-16 10z" fill="#e05a7a"/>
    <path d="M42 40c2 2 4 2 6 0M52 40c2 2 4 2 6 0" stroke="#3a2030" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M46 49c2 2 6 2 8 0" stroke="#b3261e" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M38 58c3 0 6 4 6 6h-10c0-2 2-6 4-6zM62 58c-3 0-6 4-6 6h10c0-2-2-6-4-6z" fill="#f6d36b"/>
    <circle cx="20" cy="22" r="2" fill="#bff3ff"/><circle cx="80" cy="34" r="2.6" fill="#bff3ff"/><circle cx="76" cy="18" r="1.6" fill="#bff3ff"/>`,
  tig: () => `
    <path d="M24 30l-6-14 18 6zM76 30l6-14-18 6z" fill="#e57a1e"/><path d="M24 28l-2-8 8 3zM76 28l2-8-8 3z" fill="#2a1a12"/>
    <ellipse cx="50" cy="54" rx="32" ry="30" fill="#f08a24"/>
    <path d="M50 26v10M40 28l2 9M60 28l-2 9M20 50l10 2M20 60l10-1M80 50l-10 2M80 60l-10-1" stroke="#2a1a12" stroke-width="3.4" stroke-linecap="round"/>
    <ellipse cx="50" cy="68" rx="18" ry="14" fill="#fff1dc"/>
    <path d="M34 48c4-4 10-4 12 0-4 3-8 3-12 0zM54 48c2-4 8-4 12 0-4 3-8 3-12 0z" fill="#f6d36b"/>
    <path d="M38 48h4M58 48h4" stroke="#111" stroke-width="2.4"/>
    <path d="M45 60h10l-5 6z" fill="#c2405a"/><path d="M50 66v4M50 70c-3 3-6 3-8 1M50 70c3 3 6 3 8 1" stroke="#2a1a12" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M36 66l-10-2M36 70l-10 2M64 66l10-2M64 70l10 2" stroke="#fff" stroke-width="1.2" opacity=".8"/>`,
  kra: () => `
    <g fill="none" stroke="#8b3fbf" stroke-width="8" stroke-linecap="round">
      <path d="M36 60c-12 8-22 4-26 16 0 8 8 10 12 6"/><path d="M42 66c-6 12-6 22 2 28"/>
      <path d="M58 66c6 12 6 22-2 28"/><path d="M64 60c12 8 22 4 26 16 0 8-8 10-12 6"/>
      <path d="M30 52c-14 0-20-8-22-18"/><path d="M70 52c14 0 20-8 22-18"/></g>
    <g fill="#d9a7f5"><circle cx="16" cy="76" r="1.8"/><circle cx="84" cy="76" r="1.8"/><circle cx="44" cy="86" r="1.8"/><circle cx="56" cy="86" r="1.8"/></g>
    <path d="M50 12c-18 0-26 14-26 30 0 12 8 22 26 22s26-10 26-22c0-16-8-30-26-30z" fill="#6a2a99"/>
    <path d="M38 22c4-4 10-5 14-4" stroke="#b77be0" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="44" rx="7" ry="8" fill="#ffe27a"/><ellipse cx="60" cy="44" rx="7" ry="8" fill="#ffe27a"/>
    <rect x="38.5" y="38" width="3" height="12" rx="1.5" fill="#111"/><rect x="58.5" y="38" width="3" height="12" rx="1.5" fill="#111"/>`,
  wha: () => `
    <path d="M50 16c-4 6-10 6-12 2M50 16c4 6 10 6 12 2M50 26V16" stroke="#dff3ff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M12 62c0-18 18-30 40-30 20 0 32 12 34 26l8-10c4 2 4 10 0 16l-8 2c-4 12-18 20-36 20-22 0-38-10-38-24z" fill="#f2f8fc"/>
    <path d="M14 66c10 10 26 14 40 14 14 0 24-4 32-12-6 10-18 16-34 16-18 0-32-6-38-18z" fill="#c9dbe6"/>
    <circle cx="30" cy="56" r="3" fill="#1b2a38"/>
    <path d="M18 68c6 2 12 2 18 0" stroke="#8aa6b8" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M40 74l4 6M48 76l2 6M56 76l0 6" stroke="#9db6c6" stroke-width="2" stroke-linecap="round"/>
    <path d="M6 92c10-4 16 4 26 0s16 4 26 0 16 4 26 0 10 2 12 2" stroke="#8fd3ff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  esc: () => `
    <path d="M30 14v80" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="12" r="4" fill="#e8b54a"/>
    <path d="M32 18c14-6 22 6 36 0s14 2 18 0v34c-4 2-6-6-18 0s-22-6-36 0z" fill="#fbf6ea"/>
    <path d="M32 18c14-6 22 6 36 0s14 2 18 0v6c-4 2-6-4-18 2s-22-6-36 0z" fill="#000" opacity=".06"/>
    <path d="M50 30c6 0 8 6 4 10-4 2-6-2-4-4" stroke="#c9b48a" stroke-width="2" fill="none"/>
    <path d="M22 94h16" stroke="#7a5230" stroke-width="4" stroke-linecap="round"/>`,
};

/* Les cartes du mode custom. */
Object.assign(ART, {
  /* Une bouteille de rhum, bouchon et étiquette. */
  rhum: () => `
    <path d="M42 8h16v8H42z" fill="#8a5a2c"/><path d="M44 16h12v14c0 4 12 10 12 24v36c0 4-3 6-6 6H38c-3 0-6-2-6-6V54c0-14 12-20 12-24z" fill="#3a7a3c"/>
    <path d="M44 16h12v14c0 4 12 10 12 24v36c0 4-3 6-6 6H38c-3 0-6-2-6-6V54c0-14 12-20 12-24z" fill="#fff" opacity=".08"/>
    <path d="M38 34c-4 6-4 14-4 20" stroke="#bff0c0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <rect x="34" y="56" width="32" height="24" rx="3" fill="#f1e3c2"/>
    <path d="M40 64h20M40 70h14" stroke="#8a5a2c" stroke-width="2.4" stroke-linecap="round"/>
    <text x="50" y="62.5" font-size="6.5" font-weight="900" text-anchor="middle" fill="#b3261e" font-family="Georgia,serif">RHUM</text>`,
  /* Un coffre noirci d'où s'échappe une fumée verte. */
  maudit: () => `
    <path d="M30 30c-6-8 2-14-2-22M50 26c-4-8 4-12 0-20M70 30c-6-8 2-14-2-22" stroke="#7dff9a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M16 50c0-11 10-18 34-18s34 7 34 18z" fill="#2a2030"/>
    <rect x="16" y="50" width="68" height="34" rx="4" fill="#2a2030"/>
    <path d="M16 50h68v6H16z" fill="#7dff9a" opacity=".35"/>
    <g transform="translate(29 50) scale(.42)" fill="#cfe8d0"><path d="M50 20C33 20 24 32 24 45c0 8 4 14 11 17v9c0 2 2 4 4 4h22c2 0 4-2 4-4v-9c7-3 11-9 11-17 0-13-9-25-26-25z"/></g>
    <circle cx="44" cy="69" r="3" fill="#1b1720"/><circle cx="56" cy="69" r="3" fill="#1b1720"/>
    <circle cx="44" cy="69" r="1.2" fill="#7dff9a"/><circle cx="56" cy="69" r="1.2" fill="#7dff9a"/>`,
  /* Un corsaire au bicorne, longue-vue à la main. */
  cors: () => `
    <path d="M24 100c2-16 12-24 26-24s24 8 26 24z" fill="#1d4a6e"/><path d="M44 76h12v24H44z" fill="#e8b54a" opacity=".5"/>
    <ellipse cx="50" cy="52" rx="19" ry="22" fill="#e9b48a"/>
    <path d="M34 60c4 10 10 14 16 14s12-4 16-14c-6 4-10 4-16 4s-10 0-16-4z" fill="#5a3a20"/>
    <circle cx="42" cy="50" r="2.8" fill="#1b1720"/><circle cx="58" cy="50" r="2.8" fill="#1b1720"/>
    <path d="M10 36c16-14 64-14 80 0-10 2-20-2-40-2s-30 4-40 2z" fill="#1b2a3a"/>
    <path d="M26 32c6-16 42-16 48 0z" fill="#1b2a3a"/><circle cx="50" cy="24" r="3" fill="#e8b54a"/>
    <rect x="66" y="66" width="28" height="7" rx="3" transform="rotate(-30 66 66)" fill="#c9a24a"/>
    <text x="50" y="96" font-size="11" font-weight="900" text-anchor="middle" fill="#f6d36b" font-family="Georgia,serif">15</text>`,
  /* Un canon qui fait feu. */
  canon: () => `
    <circle cx="80" cy="30" r="10" fill="#ffb347" opacity=".85"/><circle cx="86" cy="22" r="6" fill="#ffe08a"/>
    <circle cx="74" cy="20" r="5" fill="#d0d0d0" opacity=".7"/><circle cx="90" cy="36" r="5" fill="#d0d0d0" opacity=".6"/>
    <path d="M16 70L66 34l8 10-48 38z" fill="#3a3a44"/><path d="M62 30l12 16 6-4-12-16z" fill="#2a2a32"/>
    <path d="M20 66l40-28" stroke="#6a6a78" stroke-width="2" opacity=".7"/>
    <circle cx="34" cy="78" r="13" fill="#7a4c2a"/><circle cx="34" cy="78" r="5" fill="#3b2416"/>
    <path d="M34 65v26M21 78h26" stroke="#3b2416" stroke-width="2.4"/>
    <circle cx="14" cy="90" r="5" fill="#26232b"/><circle cx="24" cy="92" r="5" fill="#26232b"/><circle cx="19" cy="84" r="5" fill="#26232b"/>`,
  /* Un navire fantôme sous la lune. */
  holl: () => `
    <circle cx="70" cy="22" r="10" fill="#e6fff4" opacity=".8"/>
    <path d="M50 14v56" stroke="#bfe8dc" stroke-width="3"/><path d="M30 26v44" stroke="#bfe8dc" stroke-width="2.5"/>
    <path d="M52 18c14 4 20 14 18 28-6-4-12-4-18-2z" fill="#d9fff1" opacity=".75"/>
    <path d="M52 48c12 2 16 8 16 16H52z" fill="#d9fff1" opacity=".6"/>
    <path d="M32 30c10 2 14 10 14 20-4-2-10-2-14 0z" fill="#d9fff1" opacity=".65"/>
    <path d="M12 70h76l-10 16H24z" fill="#bfe8dc" opacity=".85"/>
    <path d="M20 76h60" stroke="#7fbfae" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="M6 94c10-4 16 4 26 0s16 4 26 0 16 4 26 0 10 2 12 2" stroke="#9ff0d8" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`,
  /* Une ancre et sa chaîne. */
  ancre: () => `
    <circle cx="50" cy="16" r="7" fill="none" stroke="#c9d6e0" stroke-width="4"/>
    <path d="M50 23v62" stroke="#c9d6e0" stroke-width="7" stroke-linecap="round"/>
    <path d="M36 34h28" stroke="#c9d6e0" stroke-width="6" stroke-linecap="round"/>
    <path d="M18 62c2 18 16 26 32 26s30-8 32-26" stroke="#c9d6e0" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M12 66l6-12 8 10zM88 66l-6-12-8 10z" fill="#c9d6e0"/>
    <path d="M57 16c10 0 14 6 20 4s10-8 16-6" stroke="#8a9aa6" stroke-width="3" fill="none" stroke-dasharray="3 3"/>`,
});

/* ------------------------------------------------------------------ */
/* La carte entière                                                   */
/* ------------------------------------------------------------------ */

const TITRES = {
  pir: 'Pirate', esc: 'Fuite', sir: 'Sirène', sk: 'Skull King', tig: 'Tigresse', kra: 'Kraken', wha: 'Baleine',
  rhum: 'Rhum', maudit: 'Trésor maudit', cors: 'Corsaire', canon: 'Canon', holl: 'Hollandais', ancre: 'Ancre',
};
const CUSTOM = ['rhum', 'maudit', 'cors', 'canon', 'holl', 'ancre'];

/** Le HTML d'une carte. `as` : ce que la Tigresse est devenue. */
export function carteHtml(c, { as = null, attrs = '', cls = '' } = {}) {
  if (c.t === 'n') {
    const col = COULEURS[c.s];
    return `<div class="carte num s-${c.s} ${cls}" style="--teinte:${col.teinte}" ${attrs}
      aria-label="${c.n} ${col.nom}">
      <span class="coin h">${c.n}</span><span class="coin b">${c.n}</span>
      ${svg(EMBLEMES[c.s])}
      ${c.n === 14 ? `<span class="quatorze">+${c.s === 'B' ? 20 : 10}</span>` : ''}
    </div>`;
  }
  const num = c.t === 'pir' ? +c.id.slice(3) : 0;
  const nom = CUSTOM.includes(c.t) ? TITRES[c.t] : c.nom || TITRES[c.t];
  const devenu = c.t === 'tig' && as ? `<span class="devenu">${as === 'pir' ? '🏴‍☠️ Pirate' : '🏳️ Fuite'}</span>` : '';
  return `<div class="carte sp t-${c.t}${CUSTOM.includes(c.t) ? ' custom' : ''} ${cls}" ${attrs} aria-label="${nom}">
    ${svg(c.t === 'pir' ? pirate(num) : ART[c.t]())}
    <span class="titre">${c.t === 'pir' || c.t === 'sir' ? `<small>${TITRES[c.t]}</small>` : ''}${nom}</span>
    ${devenu}
  </div>`;
}

/** Le dos d'une carte. */
export function dosHtml(cls = '') {
  return `<div class="carte dos ${cls}">${svg(`<g transform="translate(14 14) scale(.72)">${EMBLEMES.B}</g>`)}</div>`;
}

/** Un petit emblème seul (pour les icônes des couleurs). */
export const emblemeSvg = (s) => svg(EMBLEMES[s], 'emb');
export const craneSvg = () => svg(`<g transform="translate(0 6)">${crane()}</g>`, 'emb');
export const portraitSkSvg = () => svg(ART.sk(), 'emb');
