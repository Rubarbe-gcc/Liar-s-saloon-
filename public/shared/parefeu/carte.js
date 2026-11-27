/**
 * PARE-FEU — la carte du réseau.
 *
 * Chaque joueur a sa base : un Noyau et trois serveurs tournés vers le centre.
 * Le Noyau ne touche que ses propres serveurs : pour l'atteindre, il faut
 * d'abord prendre un serveur. Entre les bases, des relais neutres (un avant-
 * poste devant chaque base, un relais entre deux bases voisines) et, au
 * centre, le Nexus, qui rapporte gros.
 *
 * Les angles sont en degrés, l'axe y vers le bas : 90° est en bas de l'écran.
 * En 2 contre 2, les joueurs 0 et 1 sont voisins (en bas), 2 et 3 en haut.
 */

export const CENTRE = 500;
const R_BASE = 340;
const R_SERVEUR = 105;
const R_AVANT = 135;
const R_MILIEU = { 2: 235, 3: 285, 4: 300 };

export const ANGLES = { 2: [90, 270], 3: [90, 210, 330], 4: [135, 45, 315, 225] };

const rad = (d) => (d * Math.PI) / 180;
const pt = (r, a, cx = CENTRE, cy = CENTRE) => ({ x: Math.round(cx + r * Math.cos(rad(a))), y: Math.round(cy + r * Math.sin(rad(a))) });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Les nœuds (sans état de partie) et les liens d'une carte à n joueurs. */
export function creerCarte(n) {
  if (!ANGLES[n]) throw new Error(`PARE-FEU se joue de 2 à 4 (${n})`);
  const angles = ANGLES[n];
  const noeuds = [];
  const liens = [];
  const ajouter = (type, p, base = -1) => { noeuds.push({ id: noeuds.length, type, x: p.x, y: p.y, base, liens: [] }); return noeuds.length - 1; };
  const lier = (a, b) => {
    if (a === b || noeuds[a].liens.includes(b)) return;
    noeuds[a].liens.push(b);
    noeuds[b].liens.push(a);
    liens.push([Math.min(a, b), Math.max(a, b)]);
  };

  const bases = angles.map((a, j) => {
    const c = pt(R_BASE, a);
    const noyau = ajouter('noyau', c, j);
    const serveurs = [-62, 0, 62].map((d) => ajouter('serveur', pt(R_SERVEUR, a + 180 + d, c.x, c.y), j));
    for (const s of serveurs) lier(noyau, s);
    lier(serveurs[0], serveurs[1]);
    lier(serveurs[1], serveurs[2]);
    return { noyau, serveurs };
  });

  const avants = angles.map((a) => ajouter('relais', pt(R_AVANT, a)));
  angles.forEach((_, j) => lier(avants[j], bases[j].serveurs[1]));

  const nexus = ajouter('nexus', { x: CENTRE, y: CENTRE });
  for (const a of avants) lier(nexus, a);

  // Un relais entre chaque paire de bases voisines (en tournant).
  const ordre = angles.map((a, j) => ({ a, j })).sort((p, q) => p.a - q.a);
  for (let k = 0; k < ordre.length; k++) {
    const p = ordre[k], q = ordre[(k + 1) % ordre.length];
    let fin = q.a;
    if (fin <= p.a) fin += 360;
    const m = ajouter('relais', pt(R_MILIEU[n], (p.a + fin) / 2));
    for (const j of [p.j, q.j]) {
      const plusPres = bases[j].serveurs.reduce((best, s) => (dist(noeuds[s], noeuds[m]) < dist(noeuds[best], noeuds[m]) ? s : best));
      lier(m, plusPres);
      lier(m, avants[j]);
    }
  }

  for (const nd of noeuds) nd.liens.sort((a, b) => a - b);
  liens.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { noeuds, liens, bases: bases.map((b) => b.noyau), angles };
}

export const longueur = (noeuds, a, b) => Math.hypot(noeuds[a].x - noeuds[b].x, noeuds[a].y - noeuds[b].y);
