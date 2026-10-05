/**
 * BALTROU — les cartes, les mains de poker, et le calcul du score.
 *
 * Module ISO : des données et des fonctions pures, partagées par l'écran et
 * les tests. Le hasard passe toujours par un `R()` fourni par la partie, pour
 * qu'une même graine rejoue la même run.
 *
 * Une carte : { uid, r, s, enh, sceau, special }
 *   r        rang, de 2 à 14 (l'As) ;
 *   s        couleur : H cœur, D carreau, S pique, C trèfle ;
 *   enh      amélioration : bonus, mult, verre, acier, pierre (ou null) ;
 *   sceau    or, rouge, bleu, violet (ou null) ;
 *   special  null, 'poisson' (le Poisson Dégueulasse), 'wild', 'troll'.
 */

export const COULEURS = {
  H: { nom: 'Cœur', sym: '♥', rouge: true },
  D: { nom: 'Carreau', sym: '♦', rouge: true },
  S: { nom: 'Pique', sym: '♠', rouge: false },
  C: { nom: 'Trèfle', sym: '♣', rouge: false },
};
export const ORDRE_COULEURS = ['S', 'H', 'C', 'D'];

/** Ce qu'affiche le coin d'une carte : V, D, R pour les figures, A pour l'As. */
export const AFFICHE = { 11: 'V', 12: 'D', 13: 'R', 14: 'A' };
export const afficheRang = (r) => AFFICHE[r] || String(r);
export const NOM_RANG = { 11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As' };

/** Les chips qu'une carte apporte : sa valeur, 10 pour une figure, 11 pour l'As. */
export const chipsRang = (r) => (r === 14 ? 11 : r >= 11 ? 10 : r);

/** Les mains, de la plus faible à la plus forte : chips et multiplicateur de base. */
export const MAINS = [
  { id: 'haute', nom: 'Carte Haute', chips: 5, mult: 1 },
  { id: 'paire', nom: 'Paire', chips: 10, mult: 2 },
  { id: 'deux-paires', nom: 'Deux Paires', chips: 20, mult: 2 },
  { id: 'brelan', nom: 'Brelan', chips: 30, mult: 3 },
  { id: 'suite', nom: 'Suite', chips: 30, mult: 4 },
  { id: 'couleur', nom: 'Couleur', chips: 35, mult: 4 },
  { id: 'full', nom: 'Full', chips: 40, mult: 4 },
  { id: 'carre', nom: 'Carré', chips: 60, mult: 7 },
  { id: 'quinte-flush', nom: 'Quinte Flush', chips: 100, mult: 8 },
  { id: 'royale', nom: 'Quinte Flush Royale', chips: 200, mult: 10 },
];
MAINS.forEach((m, i) => { m.ordre = i + 1; });
export const MAIN = Object.fromEntries(MAINS.map((m) => [m.id, m]));

/** Chips et Mult d'une main à son niveau : chaque niveau en ajoute un peu. */
export function baseMain(id, niveau = 1) {
  const m = MAIN[id];
  return {
    chips: m.chips + (niveau - 1) * (Math.floor(m.chips / 3) + 4),
    mult: m.mult + (niveau - 1) * 0.5,
  };
}

export const AMELIORATIONS = {
  bonus: { nom: 'Bonus', texte: '+30 chips' },
  mult: { nom: 'Mult', texte: '+4 Mult' },
  verre: { nom: 'Verre', texte: '×1,5 Mult — 1 chance sur 4 de se briser en comptant' },
  acier: { nom: 'Acier', texte: '×1,5 Mult si elle reste en main (non jouée)' },
  pierre: { nom: 'Pierre', texte: '+50 chips, compte dans n’importe quelle main' },
};

export const SCEAUX = {
  or: { nom: 'Sceau d’or', texte: '+3 $ quand elle compte' },
  rouge: { nom: 'Sceau rouge', texte: 'Compte deux fois' },
  bleu: { nom: 'Sceau bleu', texte: 'Fait monter de niveau la main jouée' },
  violet: { nom: 'Sceau violet', texte: 'Améliore une autre carte du paquet au hasard' },
};

/** Les chips d'une carte, amélioration comprise. */
export function chipsCarte(c) {
  if (c.enh === 'pierre') return 50;
  return chipsRang(c.r) + (c.enh === 'bonus' ? 30 : 0);
}

export const estWild = (c) => c.special === 'wild' || c.special === 'troll';

/** Le nom d'une carte, pour le détail du score. */
export function nomCarte(c) {
  if (c.special === 'wild') return 'WILDCARD';
  if (c.special === 'troll') return 'TROLL';
  if (c.special === 'poisson') return 'Poisson';
  if (c.enh === 'pierre') return 'Pierre';
  return `${afficheRang(c.r)}${COULEURS[c.s].sym}`;
}

/* ------------------------------------------------------------------ */
/* Évaluer une main                                                    */
/* ------------------------------------------------------------------ */

function evaluerSimple(cartes) {
  if (!cartes.length) return { main: 'haute', compte: [] };
  const tri = [...cartes].sort((a, b) => b.r - a.r);
  const rangs = tri.map((c) => c.r);
  const parRang = new Map();
  for (const c of tri) { if (!parRang.has(c.r)) parRang.set(c.r, []); parRang.get(c.r).push(c); }
  const groupes = [...parRang.values()].sort((a, b) => (b.length - a.length) || (b[0].r - a[0].r));
  const freq = groupes.map((g) => g.length).join(',');
  const tous = groupes.flat();

  const couleur = cartes.length === 5 && new Set(cartes.map((c) => c.s)).size === 1;
  let suite = false;
  let cartesSuite = [];
  if (cartes.length === 5) {
    const u = [...new Set(rangs)].sort((a, b) => b - a);
    if (u.length === 5) {
      if (u[0] - u[4] === 4) { suite = true; cartesSuite = tri; }
      else if (u.join(',') === '14,5,4,3,2') {
        suite = true;
        cartesSuite = [...cartes].sort((a, b) => (b.r === 14 ? 1 : b.r) - (a.r === 14 ? 1 : a.r));
      }
    }
  }
  if (suite && couleur) {
    const royale = cartesSuite.every((c) => c.r >= 10);
    return { main: royale ? 'royale' : 'quinte-flush', compte: cartesSuite };
  }
  if (freq === '4,1' || freq === '4') return { main: 'carre', compte: tous };
  if (freq === '3,2') return { main: 'full', compte: tous };
  if (couleur) return { main: 'couleur', compte: tri };
  if (suite) return { main: 'suite', compte: cartesSuite };
  if (groupes[0].length === 3) return { main: 'brelan', compte: tous };
  if (freq === '2,2,1' || freq === '2,2') return { main: 'deux-paires', compte: tous };
  if (groupes[0].length === 2) return { main: 'paire', compte: tous };
  return { main: 'haute', compte: [tri[0]] };
}

/**
 * La meilleure main que forment ces cartes, et celles qui comptent. Une
 * WILDCARD devient la carte qui fait la meilleure main ; une carte de Pierre
 * ne joue aucun rôle dans la main, mais compte toujours.
 */
export function evaluer(cartes) {
  const pierres = cartes.filter((c) => c.enh === 'pierre' && !estWild(c));
  const wilds = cartes.filter(estWild);
  const normales = cartes.filter((c) => !estWild(c) && c.enh !== 'pierre');
  let meilleur = evaluerSimple(normales);
  if (wilds.length) {
    for (let r = 2; r <= 14; r++) {
      for (const s of ORDRE_COULEURS) {
        const faux = { r, s, faux: true };
        const e = evaluerSimple([...normales, faux]);
        if (MAIN[e.main].ordre > MAIN[meilleur.main].ordre) {
          meilleur = { main: e.main, compte: e.compte.map((c) => (c === faux ? wilds[0] : c)) };
        }
      }
    }
    if (!meilleur.compte.includes(wilds[0])) meilleur = { ...meilleur, compte: [...meilleur.compte, wilds[0]] };
  }
  if (!normales.length && !wilds.length && pierres.length) meilleur = { main: 'haute', compte: [] };
  return { main: meilleur.main, compte: [...meilleur.compte, ...pierres] };
}
