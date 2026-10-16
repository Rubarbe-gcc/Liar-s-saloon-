/**
 * PETIT PONT — les écussons et les maillots, dessinés par le code.
 *
 * Un écusson : une forme (bouclier, rond, losange, blason, hexagone), un
 * motif (rayures, demi, chevron, croix, bande, cerceaux) et un symbole (éclair,
 * soleil, enclume, étoile, montagne, vague, lune, mouette, feuille, couronne).
 * En SVG pour les menus, en image pour la 3D (le rond central, les panneaux).
 */

const FORMES = {
  bouclier: 'M10 8 H90 V58 C90 88 70 104 50 114 C30 104 10 88 10 58 Z',
  rond: 'M50 14 A46 46 0 1 1 49.9 14 Z',
  losange: 'M50 4 L96 60 L50 116 L4 60 Z',
  blason: 'M8 10 Q50 0 92 10 L88 70 Q80 100 50 114 Q20 100 12 70 Z',
  hexagone: 'M50 4 L94 28 V92 L50 116 L6 92 V28 Z',
};

function motif(nom, c) {
  switch (nom) {
    case 'rayures': return [18, 42, 66].map((x) => `<rect x="${x}" y="0" width="12" height="120" fill="${c}"/>`).join('');
    case 'cerceaux': return [22, 50, 78].map((y) => `<rect x="0" y="${y}" width="100" height="12" fill="${c}"/>`).join('');
    case 'demi': return `<rect x="50" y="0" width="50" height="120" fill="${c}"/>`;
    case 'chevron': return `<path d="M0 38 L50 70 L100 38 V56 L50 88 L0 56 Z" fill="${c}"/>`;
    case 'croix': return `<rect x="42" y="0" width="16" height="120" fill="${c}"/><rect x="0" y="50" width="100" height="16" fill="${c}"/>`;
    case 'bande': return `<path d="M0 30 L100 80 V104 L0 54 Z" fill="${c}"/>`;
    default: return '';
  }
}

function etoile(cx, cy, r1, r2, n = 5) {
  let d = '';
  for (let k = 0; k < n * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n;
    const r = k % 2 ? r2 : r1;
    d += `${k ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
  }
  return d + 'Z';
}

function symbole(nom, c, fond) {
  const contour = `stroke="${fond}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`;
  switch (nom) {
    case 'eclair': return `<path d="M58 26 L36 64 H50 L42 94 L68 52 H54 L62 26 Z" fill="${c}" ${contour}/>`;
    case 'soleil': {
      let r = '';
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        r += `<path d="M${(50 + Math.cos(a - 0.12) * 17).toFixed(1)} ${(60 + Math.sin(a - 0.12) * 17).toFixed(1)} L${(50 + Math.cos(a) * 30).toFixed(1)} ${(60 + Math.sin(a) * 30).toFixed(1)} L${(50 + Math.cos(a + 0.12) * 17).toFixed(1)} ${(60 + Math.sin(a + 0.12) * 17).toFixed(1)} Z" fill="${c}"/>`;
      }
      return `${r}<circle cx="50" cy="60" r="14" fill="${c}" ${contour}/>`;
    }
    case 'enclume': return `<path d="M22 48 H74 Q82 48 84 42 Q84 56 72 58 L64 62 V70 H70 V80 H30 V70 H38 V62 L30 58 Q22 56 22 48 Z" fill="${c}" ${contour}/><rect x="44" y="28" width="12" height="14" rx="2" fill="${c}" transform="rotate(-25 50 35)"/>`;
    case 'etoile': return `<path d="${etoile(50, 60, 30, 13)}" fill="${c}" ${contour}/>`;
    case 'montagne': return `<path d="M18 86 L42 46 L52 62 L62 48 L84 86 Z" fill="${c}" ${contour}/><path d="M42 46 L49 58 L44 56 L38 60 Z M62 48 L68 58 L63 57 L58 60 Z" fill="#ffffff"/>`;
    case 'vague': return `<path d="M18 70 Q26 46 44 52 Q56 56 52 66 Q48 58 40 62 Q36 70 46 74 Q62 78 70 62 Q76 52 84 56 V84 H18 Z" fill="${c}" ${contour}/>`;
    case 'lune': return `<path d="M60 30 A30 30 0 1 0 72 82 A24 24 0 1 1 60 30 Z" fill="${c}" ${contour}/>`;
    case 'mouette': return `<path d="M16 54 Q32 40 50 60 Q68 40 84 54 Q68 50 52 70 L50 74 L48 70 Q32 50 16 54 Z" fill="${c}" ${contour}/>`;
    case 'feuille': return `<path d="M50 26 Q80 50 52 94 Q20 54 50 26 Z" fill="${c}" ${contour}/><path d="M50 34 Q54 62 52 90" stroke="${fond}" stroke-width="2.5" fill="none"/>`;
    case 'flamme': return `<path d="M50 24 C62 42 74 50 68 70 C65 83 57 90 50 90 C39 90 30 81 31 68 C32 57 41 53 43 42 C47 51 52 53 54 48 C57 41 53 33 50 24 Z" fill="${c}" ${contour}/><path d="M50 58 C55 66 60 70 57 79 C55 84 52 86 50 86 C46 86 42 82 43 76 C44 71 48 69 50 58 Z" fill="${fond}" opacity=".55"/>`;
    case 'ancre': return `<circle cx="50" cy="31" r="7" fill="none" stroke="${c}" stroke-width="5"/><path d="M46 38 H54 V80 Q66 78 71 66 L64 68 L74 56 L79 71 L73 69 Q67 88 50 90 Q33 88 27 69 L21 71 L26 56 L36 68 L29 66 Q34 78 46 80 Z M38 46 H62 V53 H38 Z" fill="${c}" ${contour}/>`;
    case 'roue': {
      let d = '';
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8;
        const r = k % 2 ? 22 : 30;
        const a1 = a - Math.PI / 16, a2 = a + Math.PI / 16;
        d += `${k ? 'L' : 'M'}${(50 + Math.cos(a1) * r).toFixed(1)} ${(60 + Math.sin(a1) * r).toFixed(1)} L${(50 + Math.cos(a2) * r).toFixed(1)} ${(60 + Math.sin(a2) * r).toFixed(1)} `;
      }
      return `<path d="${d}Z" fill="${c}" ${contour}/><circle cx="50" cy="60" r="9" fill="${fond}"/>`;
    }
    case 'tour': return `<path d="M30 90 V48 H36 V38 H44 V46 H47 V38 H53 V46 H56 V38 H64 V48 H70 V90 H57 V76 Q50 66 43 76 V90 Z" fill="${c}" ${contour}/><rect x="46" y="54" width="8" height="10" rx="4" fill="${fond}"/>`;
    case 'aile': return `<path d="M20 70 Q26 42 60 34 Q78 31 84 40 Q71 42 63 47 Q78 47 82 54 Q67 56 59 60 Q71 62 73 69 Q56 72 45 78 Q31 83 20 70 Z" fill="${c}" ${contour}/>`;
    case 'fleche': return `<path d="M26 86 L58 54 L50 52 L76 30 L72 58 L66 50 L34 92 Z" fill="${c}" ${contour}/>`;
    case 'couronne': return `<path d="M24 80 V46 L37 60 L50 38 L63 60 L76 46 V80 Z" fill="${c}" ${contour}/><circle cx="24" cy="44" r="4" fill="${c}"/><circle cx="50" cy="36" r="4" fill="${c}"/><circle cx="76" cy="44" r="4" fill="${c}"/>`;
    default: return '';
  }
}

let n = 0;
/** L'écusson d'une équipe, en SVG (`taille` : sa hauteur en pixels). */
export function ecussonSVG(eq, taille = 48) {
  const e = eq.ecusson;
  const id = `ec${(n += 1)}`;
  const forme = FORMES[e.forme] || FORMES.bouclier;
  return `<svg class="ecusson" viewBox="0 0 100 120" width="${Math.round((taille * 100) / 120)}" height="${taille}" aria-hidden="true">`
    + `<defs><clipPath id="${id}"><path d="${forme}"/></clipPath></defs>`
    + `<path d="${forme}" fill="${e.fond}"/>`
    + `<g clip-path="url(#${id})">${motif(e.motif, e.fond2)}<path d="M0 0 H100 V40 Q50 56 0 40 Z" fill="#ffffff" opacity=".12"/></g>`
    + symbole(e.symbole, e.symboleC, e.fond)
    + `<path d="${forme}" fill="none" stroke="${e.bord}" stroke-width="5"/>`
    + `</svg>`;
}

/** L'écusson en image (pour une texture 3D). */
export function ecussonImage(eq, taille = 256) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ecussonSVG(eq, taille).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  });
}

/* ------------------------------------------------------------------ */
/* Les tenues                                                          */
/* ------------------------------------------------------------------ */

function rgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/** À quel point deux couleurs se ressemblent (0 : pareilles). */
export function ecart(a, b) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 * 0.3 + (g1 - g2) ** 2 * 0.59 + (b1 - b2) ** 2 * 0.11);
}

/** Les tenues des deux équipes : la seconde se change si les deux maillots se confondent. */
export function tenues(eqA, eqB) {
  const a = eqA.maillot;
  let b = eqB.maillot;
  if (ecart(a.fond, b.fond) < 70 || ecart(a.short, b.short) + ecart(a.fond, b.fond) < 120) b = eqB.exterieur;
  if (ecart(a.fond, b.fond) < 70) b = eqB.maillot;
  return [a, b];
}

/** Une couleur plus claire ou plus sombre (f de -1 à 1). */
export function nuance(h, f) {
  const c = rgb(h).map((v) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
