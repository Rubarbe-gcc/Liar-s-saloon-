/**
 * RAID — les cinq écoles de magie.
 *
 * Toute la théorie du jeu tient dans une roue fermée : chaque école en perce
 * une et se fait percer par une autre. Aucune n'est la bonne — tout dépend de
 * ce que le boss a comme résistances. C'est ce qui fait qu'un groupe se
 * compose, au lieu d'empiler cinq fois le même personnage.
 *
 * La roue vaut dans les deux sens : elle décide des dégâts que l'on inflige
 * comme de ceux que l'on encaisse, et de la valeur des globes ramassés.
 *
 * Module ISO : ni DOM ni Node.
 */

/** Ordre du cycle : chacun perce le suivant, et craint le précédent. */
export const CYCLE = ['sacre', 'ombre', 'nature', 'givre', 'feu'];

/** Tout ce qui est décoratif tient ici, pour ne pas encombrer le moteur. */
export const ECOLES = {
  sacre:  { nom: 'Sacré',  glyphe: '✧', teinte: '#ffd45e', clair: '#fff0b8',
            trait: 'la Lumière', contre: 'la Lumière ne laisse rien dans le noir' },
  ombre:  { nom: 'Ombre',  glyphe: '☾', teinte: '#a855f7', clair: '#ddb6fe',
            trait: 'la corruption', contre: 'la corruption prend la sève' },
  nature: { nom: 'Nature', glyphe: '❦', teinte: '#3ddc84', clair: '#a8f2c8',
            trait: 'la vie sauvage', contre: 'les racines fendent la glace' },
  givre:  { nom: 'Givre',  glyphe: '❄', teinte: '#5ed0ff', clair: '#c6ecff',
            trait: 'le froid', contre: 'la glace éteint les flammes' },
  feu:    { nom: 'Feu',    glyphe: '✹', teinte: '#ff6a3d', clair: '#ffc09a',
            trait: 'la fureur', contre: 'les flammes profanent les sanctuaires' },
};

/** Le globe d'essence pure : il compte pour toutes les écoles. */
export const ESSENCE = 'essence';

/** Multiplicateurs de dégâts. Doux : la roue oriente, elle ne décide pas. */
export const AVANTAGE = 1.5;
export const DESAVANTAGE = 0.7;

/** Ce que `a` perce. */
export function domine(a) {
  const i = CYCLE.indexOf(a);
  return i < 0 ? null : CYCLE[(i + 1) % CYCLE.length];
}

/** Ce qui perce `a`. */
export function craint(a) {
  const i = CYCLE.indexOf(a);
  return i < 0 ? null : CYCLE[(i + CYCLE.length - 1) % CYCLE.length];
}

/** Multiplicateur de dégâts d'une école `a` contre une école `d`. */
export function multiplicateur(a, d) {
  if (!CYCLE.includes(a) || !CYCLE.includes(d)) return 1;
  if (domine(a) === d) return AVANTAGE;
  if (craint(a) === d) return DESAVANTAGE;
  return 1;
}

/** Étiquette courte affichable sous une cible. */
export function resume(a, d) {
  const m = multiplicateur(a, d);
  if (m > 1) return { texte: 'vulnérable', signe: '+', mult: m };
  if (m < 1) return { texte: 'résistant', signe: '−', mult: m };
  return { texte: 'neutre', signe: '=', mult: m };
}

/**
 * La roue des écoles, en SVG, pour l'écran d'aide et la fiche d'un héros.
 * Les flèches partent de celui qui perce vers celui qui est percé.
 */
export function roueSvg({ moi = null, cible = null, taille = 190 } = {}) {
  const R = 74, C = 100;
  const pos = CYCLE.map((_, i) => {
    const t = (i / CYCLE.length) * Math.PI * 2 - Math.PI / 2;
    return { x: C + R * Math.cos(t), y: C + R * Math.sin(t) };
  });

  let fleches = '';
  CYCLE.forEach((a, i) => {
    const b = (i + 1) % CYCLE.length;
    const p = pos[i], q = pos[b];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // On raccourcit la flèche pour qu'elle n'entre pas dans les pastilles.
    const m = 20 / len;
    const x1 = p.x + dx * m, y1 = p.y + dy * m;
    const x2 = q.x - dx * m, y2 = q.y - dy * m;
    const vif = moi === a && cible === CYCLE[b];
    fleches += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"`
      + ` stroke="${vif ? ECOLES[a].teinte : 'rgba(255,255,255,.22)'}" stroke-width="${vif ? 3 : 1.6}"`
      + ` marker-end="url(#pf)"/>`;
  });

  let pastilles = '';
  CYCLE.forEach((a, i) => {
    const { x, y } = pos[i];
    const actif = a === moi || a === cible;
    const r = actif ? 17 : 14;
    pastilles += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"`
      + ` fill="${ECOLES[a].teinte}" opacity="${actif ? 1 : 0.72}"`
      + ` stroke="${a === moi ? '#fff' : 'rgba(0,0,0,.45)'}" stroke-width="${a === moi ? 2.5 : 1}"/>`
      + `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle"`
      + ` font-size="15" fill="#120c06" font-family="system-ui,sans-serif">${ECOLES[a].glyphe}</text>`;
  });

  // `userSpaceOnUse` : sans lui la pointe de flèche grossirait avec le trait.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${taille}" height="${taille}"`
    + ` class="roue" role="img" aria-label="Roue des écoles de magie">`
    + `<defs><marker id="pf" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9"`
    + ` refX="7" refY="4.5" orient="auto">`
    + `<path d="M0,0 L9,4.5 L0,9 z" fill="rgba(255,255,255,.5)"/></marker></defs>`
    + fleches + pastilles + `</svg>`;
}
