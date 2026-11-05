/**
 * REMPART — les tours et les ennemis.
 *
 * Unités : la case (1 unité = une case de la carte) et la seconde.
 * Tout est en données : le moteur (`partie.js`) ne connaît que ces champs.
 */

/**
 * Les tours. Chaque tour a trois niveaux ; `cout` est le prix pour atteindre
 * ce niveau (construire = niveau 1). `air` / `sol` : ce qu'elle peut viser.
 */
export const TOURS = {
  rafale: {
    nom: 'Rafale', icone: '🏹', couleur: '#ff9a3c',
    role: 'Tir rapide',
    desc: 'Tire vite, sur le sol comme dans les airs. Faible contre les blindés.',
    air: true, sol: true, projectile: 'balle',
    niveaux: [
      { cout: 60, degats: 9, cadence: 2.8, portee: 2.7 },
      { cout: 75, degats: 14, cadence: 3.2, portee: 3.0 },
      { cout: 130, degats: 12, cadence: 3.6, portee: 3.3, canons: 2, special: 'Deux canons' },
    ],
  },
  mortier: {
    nom: 'Mortier', icone: '💣', couleur: '#d2553a',
    role: 'Dégâts de zone',
    desc: 'Un obus qui éclate au sol et touche tout un groupe. Ne vise pas les volants.',
    air: false, sol: true, projectile: 'obus',
    niveaux: [
      { cout: 90, degats: 27, cadence: 0.55, portee: 3.4, rayon: 1.0 },
      { cout: 105, degats: 46, cadence: 0.62, portee: 3.8, rayon: 1.2 },
      { cout: 170, degats: 72, cadence: 0.7, portee: 4.2, rayon: 1.5, special: 'Grand souffle' },
    ],
  },
  givre: {
    nom: 'Givre', icone: '❄️', couleur: '#6fd8ff',
    role: 'Ralentissement',
    desc: 'Des éclats de glace qui ralentissent. Au niveau 3, ils gèlent tout autour.',
    air: true, sol: true, projectile: 'eclat',
    niveaux: [
      { cout: 70, degats: 5, cadence: 1.2, portee: 2.5, ralenti: 0.4, duree: 1.6 },
      { cout: 80, degats: 9, cadence: 1.4, portee: 2.8, ralenti: 0.5, duree: 2.0 },
      { cout: 125, degats: 14, cadence: 1.6, portee: 3.1, ralenti: 0.6, duree: 2.5, zone: 1.1, special: 'Gel en zone' },
    ],
  },
  perce: {
    nom: 'Perce-Acier', icone: '🗡️', couleur: '#b06cff',
    role: 'Anti-blindé',
    desc: 'Un carreau lourd qui traverse les armures. Lent, ne vise pas les volants.',
    air: false, sol: true, projectile: 'trait', perceArmure: true,
    niveaux: [
      { cout: 110, degats: 60, cadence: 0.6, portee: 3.3 },
      { cout: 130, degats: 100, cadence: 0.66, portee: 3.7 },
      { cout: 210, degats: 160, cadence: 0.75, portee: 4.1, brise: 3, special: 'Brise-armure' },
    ],
  },
  foudre: {
    nom: 'Foudre', icone: '⚡', couleur: '#ffe14d',
    role: 'Arc en chaîne',
    desc: 'Un éclair qui saute d’ennemi en ennemi, volants compris. Idéal contre les essaims.',
    air: true, sol: true, projectile: 'eclair', demiArmure: true,
    niveaux: [
      { cout: 130, degats: 18, cadence: 0.9, portee: 2.9, chaine: 3 },
      { cout: 140, degats: 27, cadence: 1.0, portee: 3.2, chaine: 4 },
      { cout: 210, degats: 38, cadence: 1.1, portee: 3.5, chaine: 6, special: 'Six sauts' },
    ],
  },
};

export const ORDRE_TOURS = ['rafale', 'mortier', 'givre', 'perce', 'foudre'];

/** Part du prix rendue à la vente. */
export const REVENTE = 0.7;

/**
 * Les ennemis : les Rouilleux, des bêtes de ferraille sorties de la Fosse.
 *   pv, vitesse (cases/s), armure (retirée à chaque coup), or (à la mort),
 *   vies (ce que coûte une fuite), vole, taille (rendu et rayon de touche).
 */
export const ENNEMIS = {
  rodeur: {
    nom: 'Rôdeur', desc: 'Le Rouilleux de base. Ni rapide ni solide.',
    pv: 42, vitesse: 1.5, armure: 0, or: 6, vies: 1, taille: 0.45,
  },
  filou: {
    nom: 'Filou', desc: 'Petit et très rapide. Passe vite sous les tours lentes.',
    pv: 26, vitesse: 2.8, armure: 0, or: 5, vies: 1, taille: 0.36,
  },
  cuirasse: {
    nom: 'Cuirassé', desc: 'Blindé : chaque coup perd de sa force. Le Perce-Acier l’ignore.',
    pv: 120, vitesse: 0.95, armure: 6, or: 12, vies: 2, taille: 0.6,
  },
  bourdon: {
    nom: 'Bourdon', desc: 'Vole tout droit vers le Cœur. Le mortier et le Perce-Acier ne l’atteignent pas.',
    pv: 36, vitesse: 1.9, armure: 0, or: 8, vies: 1, taille: 0.42, vole: true,
  },
  grappe: {
    nom: 'Grappe', desc: 'Éclate en trois Grappillons quand on la détruit.',
    pv: 90, vitesse: 1.2, armure: 0, or: 8, vies: 1, taille: 0.55,
    division: { type: 'grappillon', n: 3 },
  },
  grappillon: {
    nom: 'Grappillon', desc: 'Un morceau de Grappe, petit et vif.',
    pv: 22, vitesse: 2.0, armure: 0, or: 2, vies: 1, taille: 0.3, enfant: true,
  },
  tisseur: {
    nom: 'Tisseur', desc: 'Répare les Rouilleux autour de lui. À abattre en premier.',
    pv: 70, vitesse: 1.3, armure: 1, or: 12, vies: 1, taille: 0.5,
    soin: { pv: 7, rayon: 1.6 },
  },
  broyeur: {
    nom: 'Le Broyeur', desc: 'Un colosse blindé. Lent, mais il écrase tout ce qu’il touche.',
    pv: 2000, vitesse: 0.5, armure: 8, or: 200, vies: 8, taille: 1.2,
    boss: true, resisteRalenti: 0.5,
  },
  nuee: {
    nom: 'La Grande Nuée', desc: 'La reine volante. Elle lâche des Bourdons en chemin.',
    pv: 1400, vitesse: 0.65, armure: 2, or: 200, vies: 8, taille: 1.0, vole: true,
    boss: true, resisteRalenti: 0.5, ponte: { type: 'bourdon', n: 2, toutes: 4.5 },
  },
};

export const ORDRE_ENNEMIS = ['rodeur', 'filou', 'cuirasse', 'bourdon', 'grappe', 'grappillon', 'tisseur', 'broyeur', 'nuee'];

/** Hauteur de vol (en cases). */
export const ALTITUDE = 1.6;
