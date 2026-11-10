/**
 * MAXI MENU — les illustrations des cartes, dessinées en SVG (aucune image
 * de marque : tout est fait pour le jeu). Chaque dessin tient dans une boîte
 * de 200 × 160 ; `c1`/`c2` sont les couleurs de l'enseigne.
 */

const PAIN = '#e8a54a', PAIN2 = '#c9822a', STEAK = '#6b3a22', FROMAGE = '#ffc93a', SALADE = '#5cbf3a', TOMATE = '#e8402e';
const OMBRE = '<ellipse cx="100" cy="148" rx="62" ry="8" fill="#000" opacity=".18"/>';

const graines = (cx, cy, n = 7, r = 34) => Array.from({ length: n }, (_, i) => {
  const a = -2.6 + i * (2.2 / (n - 1));
  return `<ellipse cx="${(cx + Math.cos(a) * r * 0.75).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.35).toFixed(1)}" rx="2.6" ry="1.4" fill="#fff4d6"/>`;
}).join('');

function burger({ etages = 1, luxe = false, poulet = false } = {}) {
  let y = 118, s = OMBRE;
  s += `<path d="M48 ${y} h104 a8 8 0 0 1 -8 12 h-88 a8 8 0 0 1 -8 -12z" fill="${PAIN2}"/>`;
  for (let i = 0; i < etages; i++) {
    y -= 12;
    s += poulet
      ? `<path d="M42 ${y} q58 -10 116 0 q4 8 -4 12 h-108 q-8 -4 -4 -12z" fill="#d9952f"/><path d="M48 ${y + 2} q52 -6 104 0" stroke="#b8741f" stroke-width="2" fill="none"/>`
      : `<rect x="44" y="${y}" width="112" height="13" rx="6" fill="${STEAK}"/>`;
    s += `<path d="M46 ${y} l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8 l10 -8 l10 8 v-4 h-110z" fill="${FROMAGE}"/>`;
    if (i < etages - 1) { y -= 9; s += `<rect x="50" y="${y}" width="100" height="10" rx="4" fill="${PAIN}"/>`; }
  }
  y -= 7;
  s += `<path d="M44 ${y + 4} q14 -8 28 0 q14 -8 28 0 q14 -8 28 0 q14 -8 28 0" stroke="${SALADE}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  if (luxe) s += `<rect x="58" y="${y - 6}" width="34" height="7" rx="3" fill="${TOMATE}"/><rect x="104" y="${y - 6}" width="34" height="7" rx="3" fill="${TOMATE}"/>`;
  const haut = y - (luxe ? 8 : 2);
  s += `<path d="M44 ${haut} q56 -58 112 0z" fill="${PAIN}"/>${graines(100, haut - 16)}`;
  return s;
}

function gobelet(c1, c2, { paille = true, couvercle = true, h = 92 } = {}) {
  const top = 140 - h;
  return OMBRE + `<path d="M64 ${top} L136 ${top} L126 140 L74 140 Z" fill="${c1}"/>`
    + `<path d="M69 ${top + h * 0.35} L131 ${top + h * 0.35} L128 ${top + h * 0.6} L72 ${top + h * 0.6} Z" fill="${c2}"/>`
    + (couvercle ? `<rect x="58" y="${top - 8}" width="84" height="10" rx="4" fill="#f2f2f2"/>` : '')
    + (paille ? `<rect x="104" y="${top - 40}" width="7" height="40" rx="2" fill="${c2}" transform="rotate(12 107 ${top - 8})"/>` : '');
}

function cornet(c1, c2, contenu) {
  return OMBRE + contenu + `<path d="M62 70 L138 70 L128 142 L72 142 Z" fill="${c1}"/><path d="M62 70 q38 22 76 0" fill="${c2}" opacity=".9"/>`;
}

const frite = (x, y, h, r) => `<rect x="${x}" y="${y}" width="9" height="${h}" rx="2" fill="#ffd34a" stroke="#e8a82a" stroke-width="1.5" transform="rotate(${r} ${x + 4} ${y + h})"/>`;

function mascotte(chapeau, c1, c2) {
  let s = OMBRE + `<path d="M56 150 q44 -46 88 0z" fill="${c1}"/>`;
  s += `<circle cx="100" cy="82" r="34" fill="#f6c9a0"/>`;
  s += `<circle cx="88" cy="78" r="4" fill="#2a1a10"/><circle cx="112" cy="78" r="4" fill="#2a1a10"/>`;
  s += `<path d="M86 96 q14 12 28 0" stroke="#8a2a1a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  switch (chapeau) {
    case 'clown':
      s += `<circle cx="100" cy="88" r="7" fill="#e3262f"/><circle cx="64" cy="66" r="14" fill="${c1}"/><circle cx="136" cy="66" r="14" fill="${c1}"/><circle cx="100" cy="52" r="16" fill="${c1}"/>`;
      s += `<path d="M84 98 q16 18 32 0" stroke="#e3262f" stroke-width="7" fill="none" stroke-linecap="round"/>`; break;
    case 'roi':
      s += `<path d="M66 52 l8 -26 l14 16 l12 -22 l12 22 l14 -16 l8 26z" fill="${c2}" stroke="#a8761a" stroke-width="2"/><circle cx="100" cy="30" r="4" fill="#e8303a"/>`; break;
    case 'capitaine':
      s += `<path d="M64 56 q36 -36 72 0z" fill="#1d2b4a"/><rect x="60" y="54" width="80" height="8" rx="3" fill="#111a30"/><circle cx="100" cy="44" r="5" fill="#ffd34a"/>`;
      s += `<path d="M70 92 q30 40 60 0 q-6 22 -30 26 q-24 -4 -30 -26z" fill="#f2f2f2"/>`; break;
    case 'chef':
      s += `<rect x="72" y="36" width="56" height="20" fill="#fff"/><circle cx="78" cy="32" r="12" fill="#fff"/><circle cx="100" cy="26" r="14" fill="#fff"/><circle cx="122" cy="32" r="12" fill="#fff"/>`; break;
    case 'casque':
      s += `<path d="M62 78 q0 -46 38 -46 q38 0 38 46z" fill="${c1}"/><rect x="66" y="66" width="68" height="12" rx="5" fill="#9adcff" opacity=".85"/>`; break;
    default: // casquette
      s += `<path d="M66 60 q34 -34 68 0z" fill="${c1}"/><path d="M100 58 h46 q-4 8 -14 8 h-32z" fill="${c1}"/><circle cx="100" cy="44" r="4" fill="${c2}"/>`;
  }
  return s;
}

const DESSINS = {
  burger: () => burger(),
  'burger-double': () => burger({ etages: 2 }),
  'burger-luxe': () => burger({ etages: 2, luxe: true }),
  'burger-poulet': () => burger({ poulet: true }),
  frites: (c1, c2) => cornet(c1, c2, [frite(70, 34, 50, -12), frite(84, 26, 56, -5), frite(98, 22, 58, 2), frite(112, 28, 54, 8), frite(124, 36, 48, 14), frite(92, 40, 40, -2), frite(108, 40, 40, 5)].join('')),
  nuggets: (c1, c2) => OMBRE + `<rect x="52" y="86" width="96" height="54" rx="6" fill="${c1}"/><rect x="52" y="86" width="96" height="12" fill="${c2}"/>`
    + [[66, 76], [88, 70], [110, 74], [130, 80], [78, 88], [102, 86], [122, 90]].map(([x, y]) => `<path d="M${x - 12} ${y} q2 -12 14 -10 q12 -2 12 10 q0 12 -14 12 q-12 0 -12 -12z" fill="#d9952f" stroke="#b8741f" stroke-width="2"/>`).join(''),
  soda: (c1, c2) => gobelet(c1, c2),
  milkshake: (c1, c2) => gobelet('#fff4e8', c1, { h: 84 }) + `<path d="M60 52 q40 -34 80 0z" fill="#fff"/><circle cx="100" cy="30" r="7" fill="#e3262f"/>`,
  glace: (c1, c2) => gobelet('#ffffff', c1, { paille: false, couvercle: false, h: 70 }) + `<path d="M64 72 q4 -40 36 -36 q32 -4 36 36z" fill="#fff8ee"/><path d="M72 62 q28 -22 56 0" stroke="#7a3a1a" stroke-width="5" fill="none"/><path d="M80 48 q20 -14 40 0" stroke="#e8a54a" stroke-width="4" fill="none"/>`,
  chausson: () => OMBRE + `<path d="M46 120 q54 -90 108 0z" fill="#e2a24a" stroke="#c07a2a" stroke-width="3"/><path d="M70 110 l12 -10 m10 10 l12 -12 m10 12 l12 -10" stroke="#c07a2a" stroke-width="3"/>`,
  muffin: () => OMBRE + `<ellipse cx="100" cy="118" rx="54" ry="18" fill="${PAIN2}"/><rect x="50" y="96" width="100" height="10" rx="4" fill="#f4c96a"/><rect x="52" y="86" width="96" height="9" rx="4" fill="#e88a7a"/><ellipse cx="100" cy="76" rx="54" ry="22" fill="${PAIN}"/>`,
  boite: (c1, c2) => OMBRE + `<path d="M54 70 h92 l-6 72 h-80z" fill="${c1}"/><path d="M70 70 q30 -40 60 0" stroke="${c2}" stroke-width="8" fill="none"/><path d="M80 104 q20 16 40 0" stroke="${c2}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="84" cy="94" r="5" fill="${c2}"/><circle cx="116" cy="94" r="5" fill="${c2}"/>`,
  'mascotte-clown': (c1, c2) => mascotte('clown', c1, c2),
  'mascotte-roi': (c1, c2) => mascotte('roi', c1, c2),
  'mascotte-capitaine': (c1, c2) => mascotte('capitaine', c1, c2),
  'mascotte-chef': (c1, c2) => mascotte('chef', c1, c2),
  'mascotte-casque': (c1, c2) => mascotte('casque', c1, c2),
  'mascotte-casquette': (c1, c2) => mascotte('casquette', c1, c2),
  sauce: (c1) => OMBRE + `<rect x="74" y="56" width="52" height="86" rx="14" fill="${c1}"/><rect x="88" y="34" width="24" height="24" rx="4" fill="#f2f2f2"/><path d="M96 34 l4 -16 l4 16z" fill="#f2f2f2"/><rect x="80" y="84" width="40" height="30" rx="6" fill="#fff" opacity=".85"/><path d="M90 100 q10 -14 20 0" stroke="${c1}" stroke-width="4" fill="none"/>`,
  rondelles: () => OMBRE + [[72, 100], [100, 92], [128, 104], [88, 120], [116, 122]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="#d9952f" stroke-width="11"/>`).join(''),
  flamme: () => OMBRE + `<path d="M100 20 q40 44 30 84 q-6 36 -30 40 q-24 -4 -30 -40 q-6 -26 14 -44 q2 22 14 26 q-8 -34 2 -66z" fill="#ff7a1e"/><path d="M100 70 q20 26 14 48 q-4 18 -14 20 q-12 -2 -14 -20 q-2 -18 14 -48z" fill="#ffd34a"/><rect x="50" y="128" width="100" height="10" rx="4" fill="#444"/>`,
  couronne: (c1, c2) => OMBRE + `<path d="M46 120 l10 -64 l26 34 l18 -46 l18 46 l26 -34 l10 64z" fill="${c2}" stroke="#a8761a" stroke-width="3"/><rect x="46" y="116" width="108" height="16" rx="3" fill="${c1}"/><circle cx="100" cy="40" r="6" fill="#e8303a"/>`,
  pilon: () => OMBRE + `<path d="M60 64 q44 -30 70 10 q16 30 -14 46 q-30 14 -52 -14 q-16 -20 -4 -42z" fill="#c9822a" stroke="#a8641a" stroke-width="3"/><rect x="118" y="110" width="34" height="12" rx="6" fill="#f6ead6" transform="rotate(30 130 116)"/><circle cx="152" cy="128" r="8" fill="#f6ead6"/>`,
  ailes: () => OMBRE + `<path d="M50 110 q20 -60 60 -40 q-10 30 -60 40z" fill="#b8521e"/><path d="M90 116 q30 -66 66 -34 q-16 34 -66 34z" fill="#c9622a"/><path d="M70 130 q24 -40 54 -24 q-10 24 -54 24z" fill="#a8461a"/>`,
  puree: () => OMBRE + `<path d="M56 96 h88 l-10 44 h-68z" fill="#f2f2f2"/><ellipse cx="100" cy="94" rx="46" ry="16" fill="#f6ead6"/><ellipse cx="100" cy="90" rx="22" ry="8" fill="#7a4a22"/>`,
  mais: () => OMBRE + `<ellipse cx="100" cy="90" rx="26" ry="54" fill="#ffd34a" transform="rotate(30 100 90)"/>` + Array.from({ length: 6 }, (_, i) => `<line x1="${76 + i * 9}" y1="${50 + i * 8}" x2="${96 + i * 9}" y2="${132 - i * 4}" stroke="#e8b22a" stroke-width="2"/>`).join('') + `<path d="M130 132 q26 -8 30 12 q-24 6 -30 -12z" fill="#7ac04a"/>`,
  seau: (c1, c2) => OMBRE + [[70, 52], [90, 44], [112, 46], [130, 54], [82, 62], [118, 62]].map(([x, y]) => `<path d="M${x - 14} ${y} q14 -18 28 0 q4 14 -14 16 q-18 -2 -14 -16z" fill="#c9822a"/>`).join('')
    + `<path d="M52 64 h96 l-12 78 h-72z" fill="${c2}"/>` + [0, 1, 2, 3].map(i => `<path d="M${60 + i * 22} 64 h11 l-3 78 h-8z" fill="${c1}"/>`).join(''),
  salade: () => OMBRE + `<path d="M48 96 q52 70 104 0z" fill="#f2f2f2"/>` + [[70, 88, '#5cbf3a'], [96, 80, '#7ad04a'], [124, 88, '#5cbf3a'], [86, 94, TOMATE], [112, 92, '#ffd34a']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="16" fill="${c}"/>`).join(''),
  parchemin: () => OMBRE + `<rect x="58" y="34" width="84" height="104" fill="#f4e4b8"/><rect x="50" y="28" width="100" height="14" rx="7" fill="#d9b86a"/><rect x="50" y="130" width="100" height="14" rx="7" fill="#d9b86a"/>` + Array.from({ length: 6 }, (_, i) => `<line x1="68" y1="${56 + i * 12}" x2="${132 - (i % 2) * 18}" y2="${56 + i * 12}" stroke="#a8763a" stroke-width="3"/>`).join(''),
  coffre: (c1, c2) => OMBRE + `<rect x="48" y="78" width="104" height="62" rx="6" fill="#8a5a2a"/><path d="M48 80 q52 -50 104 0z" fill="#a8703a"/><rect x="48" y="76" width="104" height="8" fill="${c2 === '#f4efe6' ? '#d9b86a' : c2}"/><rect x="92" y="90" width="16" height="20" rx="3" fill="#ffd34a"/><circle cx="100" cy="98" r="3" fill="#2a1a10"/>`,
  sandwich: () => OMBRE + `<path d="M40 110 q60 -50 120 0z" fill="${PAIN}"/><rect x="40" y="108" width="120" height="10" fill="${SALADE}"/><rect x="40" y="116" width="120" height="8" fill="#f2a6a6"/><rect x="40" y="122" width="120" height="7" fill="${FROMAGE}"/><path d="M40 128 h120 q-6 14 -20 14 h-80 q-14 0 -20 -14z" fill="${PAIN2}"/>`,
  'sandwich-long': () => OMBRE + `<rect x="18" y="86" width="164" height="22" rx="11" fill="${PAIN}"/>` + [32, 64, 96, 128, 160].map(x => `<path d="M${x} 90 l10 12" stroke="${PAIN2}" stroke-width="3"/>`).join('')
    + `<rect x="18" y="106" width="164" height="8" fill="${SALADE}"/><rect x="18" y="112" width="164" height="8" fill="${TOMATE}"/><rect x="18" y="118" width="164" height="16" rx="8" fill="${PAIN2}"/>`,
  cookie: () => OMBRE + `<circle cx="100" cy="94" r="48" fill="#d9a05a"/>` + [[80, 76], [112, 70], [94, 100], [124, 104], [74, 108], [104, 124]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#4a2a14"/>`).join(''),
  chips: (c1, c2) => OMBRE + `<path d="M60 40 h80 l-6 102 h-68z" fill="${c1}"/><rect x="60" y="40" width="80" height="12" fill="${c2}"/><ellipse cx="100" cy="94" rx="24" ry="16" fill="#ffd34a"/>`,
  pain: () => OMBRE + `<ellipse cx="100" cy="104" rx="70" ry="30" fill="${PAIN}"/>` + [64, 88, 112, 136].map(x => `<path d="M${x - 10} 88 q10 16 20 0" stroke="${PAIN2}" stroke-width="5" fill="none"/>`).join(''),
  brownie: () => OMBRE + `<path d="M50 90 l40 -22 l60 16 v40 l-40 20 l-60 -16z" fill="#4a2a14"/><path d="M50 90 l40 -22 l60 16 l-40 20z" fill="#6a3a1a"/>`,
  pizza: (c1, c2, carte) => {
    const garni = carte?.id.includes('pepperoni') || carte?.id.includes('six') ? TOMATE : carte?.id.includes('hawai') ? '#ffd34a' : '#7a4a22';
    return OMBRE + `<circle cx="100" cy="92" r="58" fill="#e8a54a"/><circle cx="100" cy="92" r="48" fill="#ffd34a"/><circle cx="100" cy="92" r="46" fill="#ffe08a"/>`
      + [[80, 72], [118, 70], [100, 96], [74, 108], [126, 108], [98, 124], [138, 90], [62, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${garni}"/>`).join('')
      + `<path d="M100 92 L158 92 A58 58 0 0 0 142 52 Z" fill="#000" opacity=".08"/>`;
  },
  taco: () => OMBRE + `<path d="M40 120 a60 60 0 0 1 120 0z" fill="#f2c24a" stroke="#d9a02a" stroke-width="3"/><path d="M52 104 q48 -40 96 0" stroke="${SALADE}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M60 96 q40 -28 80 0" stroke="${TOMATE}" stroke-width="6" fill="none" stroke-dasharray="6 6"/>`,
  quesadilla: () => OMBRE + `<path d="M40 100 L160 100 L100 40z" fill="#f2c24a" stroke="#d9a02a" stroke-width="3"/><path d="M52 98 L148 98" stroke="${FROMAGE}" stroke-width="6"/><path d="M50 116 L150 116 L100 74z" fill="#e8b23a" stroke="#d9a02a" stroke-width="3"/>`,
  nachos: () => OMBRE + `<ellipse cx="100" cy="122" rx="62" ry="16" fill="#2a2a2a"/>` + [[70, 100, 10], [96, 88, -14], [122, 98, 20], [84, 112, -30], [112, 112, 40]].map(([x, y, r]) => `<path d="M${x - 16} ${y + 10} l16 -30 l16 30z" fill="#f2c24a" transform="rotate(${r} ${x} ${y})"/>`).join('') + `<path d="M64 98 q36 26 72 0 q-10 20 -36 22 q-26 -2 -36 -22z" fill="${FROMAGE}"/>`,
  churros: () => OMBRE + [[74, -12], [100, 0], [126, 12]].map(([x, r]) => `<rect x="${x - 9}" y="30" width="18" height="100" rx="8" fill="#d9952f" transform="rotate(${r} ${x} 130)"/><line x1="${x - 3}" y1="34" x2="${x - 3}" y2="126" stroke="#b8741f" stroke-width="2" transform="rotate(${r} ${x} 130)"/>`).join(''),
  burrito: () => OMBRE + `<rect x="44" y="70" width="112" height="60" rx="30" fill="#f2dca0" transform="rotate(-16 100 100)"/><ellipse cx="146" cy="80" rx="16" ry="26" fill="#c9622a" transform="rotate(-16 100 100)"/><path d="M60 92 q40 20 80 0" stroke="#e8c88a" stroke-width="3" fill="none" transform="rotate(-16 100 100)"/>`,
  wrap: () => OMBRE + `<path d="M70 140 L56 52 q44 -24 88 0 L130 140z" fill="#f2dca0"/><path d="M58 56 q42 -22 84 0 l-4 16 q-38 -18 -76 0z" fill="${SALADE}"/><circle cx="100" cy="58" r="10" fill="${TOMATE}"/>`,
  cloche: (c1, c2) => OMBRE + `<path d="M58 124 q0 -76 42 -80 q42 4 42 80z" fill="${c2}" stroke="#b8901a" stroke-width="3"/><rect x="50" y="120" width="100" height="12" rx="6" fill="${c2}" stroke="#b8901a" stroke-width="3"/><circle cx="100" cy="138" r="9" fill="${c1}"/><circle cx="100" cy="40" r="7" fill="${c1}"/>`,
  eclair: (c1, c2) => OMBRE + `<path d="M112 18 L62 92 h34 L80 146 L142 64 h-36z" fill="${c2 === '#ffffff' ? '#ffd34a' : c2}" stroke="${c1}" stroke-width="4" stroke-linejoin="round"/>`,
  hotdog: () => OMBRE + `<rect x="34" y="84" width="132" height="22" rx="11" fill="#b8461e"/><path d="M40 98 q60 40 120 0 v10 q-60 34 -120 0z" fill="${PAIN}"/><path d="M40 92 q60 -26 120 0 l-2 6 q-58 -20 -116 0z" fill="${PAIN}"/><path d="M44 88 q14 -8 28 0 q14 8 28 0 q14 -8 28 0 q14 8 28 0" stroke="#ffd34a" stroke-width="4" fill="none"/>`,
  cacahuetes: () => OMBRE + `<path d="M52 140 l-6 -78 h108 l-6 78z" fill="#c9a26a"/>` + [[78, 66], [100, 58], [122, 66], [90, 76], [112, 76]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="14" ry="8" fill="#d9b07a" stroke="#a8763a" stroke-width="2"/>`).join(''),
};

/** L'illustration d'une carte (SVG complet). */
export function dessinCarte(carte, couleurs) {
  const [c1, c2] = couleurs;
  const f = DESSINS[carte.dessin] || DESSINS.burger;
  return `<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${f(c1, c2, carte)}</svg>`;
}

/** L'emblème rond d'une enseigne (inventé pour le jeu). */
export function emblemeEnseigne(enseigne, taille = 40) {
  const [c1, c2] = enseigne.couleurs;
  const blanc = c2 === '#ffffff' || c2 === '#f4efe6' || c2 === '#f2e6d0' ? '#ffd34a' : c2;
  const motifs = {
    soleil: `<circle cx="50" cy="50" r="15" fill="${blanc}"/>` + Array.from({ length: 8 }, (_, i) => `<rect x="47" y="14" width="6" height="14" rx="3" fill="${blanc}" transform="rotate(${i * 45} 50 50)"/>`).join(''),
    couronne: `<path d="M24 66 l5 -32 l14 16 l7 -22 l7 22 l14 -16 l5 32z" fill="${blanc}"/>`,
    ancre: `<path d="M50 22 v52 M36 34 h28 M28 58 q22 28 44 0" stroke="${blanc}" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="50" cy="20" r="6" fill="none" stroke="${blanc}" stroke-width="5"/>`,
    rail: `<path d="M34 20 L28 80 M66 20 L72 80" stroke="${blanc}" stroke-width="6"/>` + [30, 44, 58, 72].map(y => `<line x1="28" y1="${y}" x2="72" y2="${y}" stroke="${blanc}" stroke-width="5"/>`).join(''),
    de: `<rect x="26" y="26" width="48" height="48" rx="9" fill="${blanc}"/>` + [[38, 38], [62, 38], [38, 62], [62, 62], [38, 50], [62, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${c1}"/>`).join(''),
    cloche: `<path d="M30 68 q0 -40 20 -42 q20 2 20 42z" fill="${blanc}"/><rect x="26" y="66" width="48" height="7" rx="3" fill="${blanc}"/><circle cx="50" cy="78" r="5" fill="${blanc}"/>`,
    eclair: `<path d="M56 16 L32 54 h16 L42 84 L70 44 h-17z" fill="${blanc}"/>`,
    six: `<text x="50" y="70" text-anchor="middle" font-size="56" font-weight="900" font-family="Arial Black, sans-serif" fill="${blanc}">6</text>`,
  };
  return `<svg viewBox="0 0 100 100" width="${taille}" height="${taille}" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="${c1}" stroke="${blanc}" stroke-width="4"/>${motifs[enseigne.embleme] || ''}</svg>`;
}
