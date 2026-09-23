/**
 * PRISME — les cinq affinités.
 *
 * Le prisme décompose la lumière en cinq éclats, et chaque éclat domine le
 * suivant dans un cycle fermé : aucune affinité n'est meilleure qu'une autre,
 * tout dépend de ce qu'on a en face. C'est la même logique que la roue de
 * ZÉNITH, mais elle joue ici un rôle bien plus lourd : elle décide aussi de la
 * valeur des orbes ramassées, pas seulement des dégâts.
 *
 * Module ISO : ni DOM ni Node, il tourne dans le navigateur comme sous test.
 */

/** Ordre du cycle : chacun domine le suivant, et craint le précédent. */
export const CYCLE = ['vermeil', 'jade', 'pourpre', 'ambre', 'azur'];

/** Tout ce qui est purement décoratif tient ici, pour ne pas polluer le moteur. */
export const AFFINITES = {
  vermeil: { nom: 'Vermeil', glyphe: '◆', teinte: '#ff4d5e', clair: '#ffa8b0', trait: 'force brute' },
  jade:    { nom: 'Jade',    glyphe: '❋', teinte: '#3ddc84', clair: '#a8f2c8', trait: 'endurance' },
  pourpre: { nom: 'Pourpre', glyphe: '✦', teinte: '#a855f7', clair: '#ddb6fe', trait: 'esprit' },
  ambre:   { nom: 'Ambre',   glyphe: '✳', teinte: '#ffb020', clair: '#ffdf95', trait: 'technique' },
  azur:    { nom: 'Azur',    glyphe: '◈', teinte: '#38bdf8', clair: '#b9e8ff', trait: 'vivacité' },
};

/** L'orbe blanche : elle vaut pour toutes les affinités. */
export const PRISMATIQUE = 'prisme';

/** Multiplicateurs de dégâts. Volontairement doux : le cycle oriente, il ne décide pas. */
export const AVANTAGE = 1.5;
export const DESAVANTAGE = 0.7;

/** Ce que `a` domine. */
export function domine(a) {
  const i = CYCLE.indexOf(a);
  return i < 0 ? null : CYCLE[(i + 1) % CYCLE.length];
}

/** Ce qui domine `a`. */
export function craint(a) {
  const i = CYCLE.indexOf(a);
  return i < 0 ? null : CYCLE[(i + CYCLE.length - 1) % CYCLE.length];
}

/** Multiplicateur de dégâts d'un attaquant `a` sur un défenseur `d`. */
export function multiplicateur(a, d) {
  if (!CYCLE.includes(a) || !CYCLE.includes(d)) return 1;
  if (domine(a) === d) return AVANTAGE;
  if (craint(a) === d) return DESAVANTAGE;
  return 1;
}

/** Étiquette courte affichable sous une cible. */
export function resume(a, d) {
  const m = multiplicateur(a, d);
  if (m > 1) return { texte: 'avantage', signe: '+', mult: m };
  if (m < 1) return { texte: 'désavantage', signe: '−', mult: m };
  return { texte: 'neutre', signe: '=', mult: m };
}

/**
 * Roue des affinités, en SVG, pour l'écran des règles et la fiche d'un héros.
 * Les flèches partent de celui qui domine vers celui qui est dominé.
 *
 * `moi` et `cible` mettent en avant un duel précis ; sans eux, la roue est
 * neutre et sert d'aide-mémoire.
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
      + ` stroke="${vif ? AFFINITES[a].teinte : 'rgba(255,255,255,.22)'}" stroke-width="${vif ? 3 : 1.6}"`
      + ` marker-end="url(#pf)"/>`;
  });

  let pastilles = '';
  CYCLE.forEach((a, i) => {
    const { x, y } = pos[i];
    const actif = a === moi || a === cible;
    const r = actif ? 17 : 14;
    pastilles += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"`
      + ` fill="${AFFINITES[a].teinte}" opacity="${actif ? 1 : 0.72}"`
      + ` stroke="${a === moi ? '#fff' : 'rgba(0,0,0,.45)'}" stroke-width="${a === moi ? 2.5 : 1}"/>`
      + `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle"`
      + ` font-size="15" fill="#0a0510" font-family="system-ui,sans-serif">${AFFINITES[a].glyphe}</text>`;
  });

  // `userSpaceOnUse` : sans lui la pointe de flèche grossirait avec le trait.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${taille}" height="${taille}"`
    + ` class="roue" role="img" aria-label="Roue des affinités">`
    + `<defs><marker id="pf" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9"`
    + ` refX="7" refY="4.5" orient="auto">`
    + `<path d="M0,0 L9,4.5 L0,9 z" fill="rgba(255,255,255,.5)"/></marker></defs>`
    + fleches + pastilles + `</svg>`;
}
