/**
 * REMPART — les tours et les ennemis.
 *
 * Unités : la case (1 unité = une case de la carte) et la seconde.
 * Tout est en données : le moteur (`partie.js`) ne connaît que ces champs.
 */

/**
 * Les tours. Chaque tour a trois niveaux ; `cout` est le prix pour atteindre
 * ce niveau (construire = niveau 1). `air` / `sol` : ce qu'elle peut viser.
 * Au niveau 4, on choisit une des deux `branches` (spécialisations).
 */
/**
 * Réglage global des dégâts des tours (dégâts directs, brûlure, mines, aura,
 * éclair, carreaux…). Les valeurs écrites plus bas sont multipliées par ce
 * facteur au chargement (arrondi à 1 décimale, au moins 1).
 */
export const FACTEUR_DEGATS = 0.8;

/** Réglage global des PV de tous les ennemis et boss (appliqué au chargement). */
export const FACTEUR_PV = 2;

/** Réglage global de l'or rapporté par chaque ennemi détruit (appliqué au chargement). */
export const FACTEUR_OR_ENNEMIS = 1;

/** Réglage global de l'or de départ de chaque lieu (appliqué au début de la partie). */
export const FACTEUR_OR_DEPART = 0.9;

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
    branches: [
      { id: 'mitrailleuse', nom: 'Mitrailleuse', couleur: '#ffcf3c', desc: 'Trois canons qui crachent sans s’arrêter.', cout: 280, degats: 13, cadence: 5.6, portee: 3.4, canons: 3 },
      { id: 'elite', nom: 'Tireur d’élite', couleur: '#ff5a3c', desc: 'Un seul tir, de très loin, qui fait très mal.', cout: 260, degats: 100, cadence: 1.1, portee: 5.4 },
    ],
  },
  mortier: {
    nom: 'Mortier', icone: '💣', couleur: '#d2553a',
    role: 'Dégâts de zone',
    desc: 'Un obus qui éclate au sol et touche tout un groupe. Ne vise pas les volants.',
    air: false, sol: true, projectile: 'obus', indirect: true,
    niveaux: [
      { cout: 90, degats: 27, cadence: 0.55, portee: 3.4, rayon: 1.0 },
      { cout: 105, degats: 46, cadence: 0.62, portee: 3.8, rayon: 1.2 },
      { cout: 170, degats: 72, cadence: 0.7, portee: 4.2, rayon: 1.5, special: 'Grand souffle' },
    ],
    branches: [
      { id: 'bombarde', nom: 'Bombarde', couleur: '#ff7a2a', desc: 'Des obus énormes, un souffle immense.', cout: 300, degats: 150, cadence: 0.6, portee: 4.6, rayon: 1.9 },
      { id: 'sismique', nom: 'Sismique', couleur: '#c8a46a', desc: 'Chaque obus fait trembler le sol et sonne les Rouilleux.', cout: 270, degats: 85, cadence: 0.8, portee: 4.2, rayon: 1.6, etourdit: 0.7 },
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
    branches: [
      { id: 'blizzard', nom: 'Blizzard', couleur: '#bff4ff', desc: 'Une tempête de neige permanente : tout ce qui passe autour est ralenti.', cout: 260, degats: 12, cadence: 0, portee: 3.0, ralenti: 0.55, duree: 0.4, aura: true },
      { id: 'glace', nom: 'Cœur de glace', couleur: '#3aa8ff', desc: 'Des éclats qui figent net les Rouilleux un instant.', cout: 270, degats: 40, cadence: 1.4, portee: 3.4, ralenti: 0.65, duree: 2.5, zone: 1.3, etourdit: 0.8 },
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
    branches: [
      { id: 'baliste', nom: 'Baliste', couleur: '#d9a8ff', desc: 'Un carreau qui traverse toute une file de Rouilleux.', cout: 290, degats: 180, cadence: 0.8, portee: 4.8, brise: 3, traverse: true },
      { id: 'briseur', nom: 'Briseur', couleur: '#7a3cff', desc: 'Un coup monstrueux qui arrache l’armure.', cout: 300, degats: 330, cadence: 0.7, portee: 4.4, brise: 8 },
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
    branches: [
      { id: 'tempete', nom: 'Tempête', couleur: '#fff6a8', desc: 'Un éclair qui saute dix fois, et plus loin.', cout: 290, degats: 42, cadence: 1.3, portee: 3.8, chaine: 10, saut: 2.6 },
      { id: 'surcharge', nom: 'Surcharge', couleur: '#ffb020', desc: 'Toute la foudre sur une seule cible, qui reste sonnée.', cout: 280, degats: 230, cadence: 0.8, portee: 3.6, chaine: 1, etourdit: 0.6 },
    ],
  },
  braise: {
    nom: 'Braise', icone: '🔥', couleur: '#ff6a1a',
    role: 'Brûlure',
    desc: 'Un jet de flammes à courte portée. Le feu continue de brûler et passe sous les armures.',
    air: false, sol: true, projectile: 'flamme',
    niveaux: [
      { cout: 90, degats: 8, cadence: 1.5, portee: 2.0, rayon: 0.7, brulure: 10, duree: 2 },
      { cout: 100, degats: 12, cadence: 1.6, portee: 2.2, rayon: 0.8, brulure: 18, duree: 2.5 },
      { cout: 160, degats: 18, cadence: 1.8, portee: 2.4, rayon: 1.0, brulure: 30, duree: 3, special: 'Feu tenace' },
    ],
    branches: [
      { id: 'fournaise', nom: 'Fournaise', couleur: '#ff3a1a', desc: 'Un feu si chaud qu’il fond le métal.', cout: 270, degats: 25, cadence: 1.8, portee: 2.5, rayon: 1.0, brulure: 75, duree: 3.5 },
      { id: 'dragon', nom: 'Souffle de dragon', couleur: '#ffb347', desc: 'Un souffle long et large, qui brûle aussi les volants.', cout: 260, degats: 30, cadence: 2.0, portee: 3.2, rayon: 1.6, brulure: 35, duree: 3, air: true },
    ],
  },
  phare: {
    nom: 'Phare', icone: '🗼', couleur: '#fff0b0',
    role: 'Soutien',
    desc: 'Ne tire pas. Sa lumière renforce les tours voisines et révèle les Furtifs.',
    air: false, sol: false, soutien: true,
    niveaux: [
      { cout: 110, portee: 3.0, bonus: 0.15 },
      { cout: 130, portee: 3.4, bonus: 0.25 },
      { cout: 190, portee: 3.8, bonus: 0.35, bonusCadence: 0.1, special: 'Lumière vive' },
    ],
    branches: [
      { id: 'fanal', nom: 'Fanal de guerre', couleur: '#ff9a3c', desc: 'Les tours voisines frappent bien plus fort et plus vite.', cout: 260, portee: 4.2, bonus: 0.5, bonusCadence: 0.2 },
      { id: 'marchand', nom: 'Phare marchand', couleur: '#ffd84d', desc: 'Chaque Rouilleux détruit dans sa lumière rapporte 2 pièces de plus.', cout: 240, portee: 4.0, bonus: 0.3, orBonus: 2 },
    ],
  },
  harpon: {
    nom: 'Harpon', icone: '🪝', couleur: '#4ac8a8',
    role: 'Anti-aérien',
    desc: 'Un harpon lourd qui ne vise que les volants, et les ralentit en les accrochant.',
    air: true, sol: false, projectile: 'harpon',
    niveaux: [
      { cout: 80, degats: 40, cadence: 0.9, portee: 3.6, ralenti: 0.3, duree: 1.2 },
      { cout: 95, degats: 70, cadence: 1.0, portee: 4.0, ralenti: 0.35, duree: 1.5 },
      { cout: 150, degats: 110, cadence: 1.1, portee: 4.4, ralenti: 0.4, duree: 1.8, special: 'Pointe d’acier' },
    ],
    branches: [
      { id: 'filet', nom: 'Lance-filet', couleur: '#8af0c8', desc: 'Un filet qui cloue sur place tous les volants autour de la cible.', cout: 270, degats: 80, cadence: 1.0, portee: 4.4, zone: 1.4, ralenti: 0.5, duree: 2, etourdit: 1.2 },
      { id: 'baleinier', nom: 'Baleinier', couleur: '#2a9a8a', desc: 'Un harpon géant qui transperce les blindés du ciel.', cout: 280, degats: 320, cadence: 0.9, portee: 5.0, perce: true },
    ],
  },
  piegeur: {
    nom: 'Piégeur', icone: '💥', couleur: '#c8b030',
    role: 'Mines',
    desc: 'Sème des mines sur le chemin, à sa portée. Elles sautent quand un Rouilleux marche dessus, même un Furtif.',
    air: false, sol: true, projectile: 'mine',
    niveaux: [
      { cout: 85, degats: 45, cadence: 0.5, portee: 2.4, rayon: 0.8, mines: 3 },
      { cout: 95, degats: 75, cadence: 0.6, portee: 2.7, rayon: 0.9, mines: 4 },
      { cout: 150, degats: 120, cadence: 0.7, portee: 3.0, rayon: 1.1, mines: 5, special: 'Grosses mines' },
    ],
    branches: [
      { id: 'champ', nom: 'Champ de mines', couleur: '#ffe14d', desc: 'Des mines partout, posées très vite.', cout: 260, degats: 130, cadence: 1.4, portee: 3.2, rayon: 1.1, mines: 10 },
      { id: 'charge', nom: 'Charge d’ambre', couleur: '#ff9a1a', desc: 'Des mines énormes qui sonnent tout autour.', cout: 280, degats: 320, cadence: 0.6, portee: 3.2, rayon: 1.6, mines: 4, etourdit: 1 },
    ],
  },
  aimant: {
    nom: 'Aimant', icone: '🧲', couleur: '#e04a4a',
    role: 'Repousse',
    desc: 'Une impulsion magnétique qui repousse les Rouilleux en arrière sur le chemin. Les boss résistent.',
    air: false, sol: true, projectile: 'impulsion',
    niveaux: [
      { cout: 100, degats: 6, cadence: 0.3, portee: 2.3, recul: 0.7 },
      { cout: 110, degats: 10, cadence: 0.35, portee: 2.6, recul: 1.0 },
      { cout: 170, degats: 16, cadence: 0.4, portee: 2.9, recul: 1.3, special: 'Grande poussée' },
    ],
    branches: [
      { id: 'electro', nom: 'Électro-aimant', couleur: '#5ab8ff', desc: 'Il attire aussi les volants au sol : pendant 3 s, toutes les tours peuvent les viser.', cout: 260, degats: 22, cadence: 0.4, portee: 3.2, recul: 1.0, cloue: 3, air: true },
      { id: 'repulseur', nom: 'Répulseur', couleur: '#ff6a6a', desc: 'Une poussée énorme qui renvoie les Rouilleux loin en arrière.', cout: 280, degats: 30, cadence: 0.45, portee: 3.2, recul: 2.4 },
    ],
  },
  garnison: {
    nom: 'Garnison', icone: '🛡️', couleur: '#9aa8c8',
    role: 'Bloque',
    desc: 'Des gardes qui se postent sur le chemin, arrêtent les Rouilleux et se battent au corps à corps. Ils reviennent s’ils tombent.',
    air: false, sol: true, projectile: 'gardes', continu: true,
    niveaux: [
      { cout: 90, degats: 10, portee: 2.5, gardes: 2, pvGarde: 140, renfort: 9 },
      { cout: 100, degats: 15, portee: 2.8, gardes: 3, pvGarde: 200, renfort: 8 },
      { cout: 160, degats: 24, portee: 3.1, gardes: 3, pvGarde: 320, renfort: 7, special: 'Armures de fer' },
    ],
    branches: [
      { id: 'chevaliers', nom: 'Chevaliers', couleur: '#c8d8ff', desc: 'Trois chevaliers en armure lourde, presque impossibles à faire tomber.', cout: 270, degats: 32, portee: 3.1, gardes: 3, pvGarde: 700, renfort: 7 },
      { id: 'lanciers', nom: 'Lanciers', couleur: '#ffd27a', desc: 'Quatre lanciers qui frappent fort et reviennent vite.', cout: 260, degats: 50, portee: 3.1, gardes: 4, pvGarde: 300, renfort: 5 },
    ],
  },
  rayon: {
    nom: 'Rayon d’Ambre', icone: '🔆', couleur: '#ffc83a',
    role: 'Faisceau',
    desc: 'Un faisceau continu qui chauffe : plus il reste sur la même cible, plus il fait mal. Idéal contre les boss.',
    air: true, sol: true, projectile: 'rayon', continu: true,
    niveaux: [
      { cout: 120, degats: 14, portee: 2.8, rampe: 0.5, max: 2.5 },
      { cout: 130, degats: 22, portee: 3.1, rampe: 0.6, max: 3 },
      { cout: 200, degats: 34, portee: 3.4, rampe: 0.7, max: 3.5, special: 'Cristal pur' },
    ],
    branches: [
      { id: 'prisme', nom: 'Prisme', couleur: '#ff8af0', desc: 'Le faisceau se divise sur trois cibles à la fois.', cout: 280, degats: 30, portee: 3.6, rampe: 0.6, max: 3, cibles: 3 },
      { id: 'soleil', nom: 'Soleil captif', couleur: '#fff2a8', desc: 'Un faisceau qui chauffe jusqu’à sept fois sa force.', cout: 300, degats: 45, portee: 3.8, rampe: 1.0, max: 7 },
    ],
  },
};

// Application du facteur de dégâts, niveaux 1 à 3 et spécialisations.
for (const t of Object.values(TOURS)) {
  for (const s of [...t.niveaux, ...t.branches]) {
    for (const k of ['degats', 'brulure']) {
      if (s[k] != null) s[k] = Math.max(1, Math.round(s[k] * FACTEUR_DEGATS * 10) / 10);
    }
  }
}

export const ORDRE_TOURS = ['rafale', 'mortier', 'givre', 'perce', 'foudre', 'braise', 'phare', 'harpon', 'piegeur', 'aimant', 'garnison', 'rayon'];

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
  furtif: {
    nom: 'Furtif', desc: 'Invisible pour les tours, sauf dans la lumière d’un Phare. Les explosions et les flammes le touchent quand même.',
    pv: 50, vitesse: 1.5, armure: 0, or: 9, vies: 1, taille: 0.42, furtif: true,
  },
  fouisseur: {
    nom: 'Fouisseur', desc: 'Il s’enfouit sous terre par moments : rien ne peut le toucher tant qu’il est dessous.',
    pv: 110, vitesse: 1.15, armure: 2, or: 10, vies: 1, taille: 0.5,
    fouit: { toutes: 4, duree: 1.6, vitesse: 1.6 },
  },
  pavois: {
    nom: 'Pavois', desc: 'Il couvre ses voisins d’un bouclier d’énergie qui encaisse les coups.',
    pv: 140, vitesse: 1.0, armure: 3, or: 14, vies: 2, taille: 0.55,
    bouclier: { pv: 30, rayon: 1.5, toutes: 6 },
  },
  bondisseur: {
    nom: 'Bondisseur', desc: 'De temps en temps, il fait un grand bond en avant.',
    pv: 70, vitesse: 1.3, armure: 1, or: 9, vies: 1, taille: 0.45,
    saut: { toutes: 3.5, distance: 2.2 },
  },
  dirigeable: {
    nom: 'Dirigeable', desc: 'Un ballon blindé qui vole lentement. Quand il éclate, il lâche trois Bourdons.',
    pv: 260, vitesse: 0.8, armure: 4, or: 18, vies: 2, taille: 0.7, vole: true,
    division: { type: 'bourdon', n: 3 },
  },
  mue: {
    nom: 'Mue', desc: 'Sa carapace se reforme : si on cesse de la frapper, elle regagne très vite ses PV.',
    pv: 150, vitesse: 1.05, armure: 2, or: 13, vies: 1, taille: 0.5,
    regen: 0.07,
  },
  hydre: {
    nom: 'L’Hydre de Fer', desc: 'Un serpent de métal. Quand elle tombe, deux Têtes en sortent et continuent la route.',
    pv: 2400, vitesse: 0.55, armure: 5, or: 150, vies: 8, taille: 1.1,
    boss: true, resisteRalenti: 0.5, division: { type: 'tete', n: 2 },
  },
  tete: {
    nom: 'Tête d’Hydre', desc: 'Une tête de l’Hydre, encore pleine de rage.',
    pv: 650, vitesse: 0.9, armure: 4, or: 40, vies: 3, taille: 0.75,
    boss: true, enfant: true, resisteRalenti: 0.5,
  },
  seigneur: {
    nom: 'Le Seigneur Rouille', desc: 'Le maître de la Fosse. Il appelle des Furtifs, se répare quand on le laisse, et enrage quand il faiblit.',
    pv: 5200, vitesse: 0.45, armure: 10, or: 400, vies: 15, taille: 1.4,
    boss: true, resisteRalenti: 0.6, regen: 0.004,
    ponte: { type: 'furtif', n: 3, toutes: 7 }, rage: { seuil: 0.5, vitesse: 1.5, armure: 4 },
  },
  cliquet: {
    nom: 'Cliquet', desc: 'Un petit rouage sur pattes, le plus rapide des Rouilleux. Il file sous les tours lentes.',
    pv: 18, vitesse: 3.6, armure: 0, or: 3, vies: 1, taille: 0.3,
  },
  bastion: {
    nom: 'Bastion', desc: 'Une forteresse qui marche : une armure énorme et un bouclier. Il faut du Perce-Acier, de la foudre ou des flammes.',
    pv: 260, vitesse: 0.7, armure: 12, or: 22, vies: 2, taille: 0.7, bouclierInitial: 80,
  },
  reparateur: {
    nom: 'Réparateur', desc: 'Un petit mécano qui répare sans arrêt les Rouilleux autour de lui. Sonnez-le pour l’interrompre, ou abattez-le en premier.',
    pv: 45, vitesse: 1.4, armure: 0, or: 10, vies: 1, taille: 0.38,
    repare: { pv: 10, rayon: 1.8 },
  },
  scarabee: {
    nom: 'Scarabée de laiton', desc: 'Un scarabée volant à carapace de laiton. Seules les tours qui visent le ciel l’atteignent, et son armure use les petits tirs.',
    pv: 120, vitesse: 1.5, armure: 4, or: 12, vies: 1, taille: 0.5, vole: true,
  },
  colosse: {
    nom: 'Le Colosse de Rouille', desc: 'Le plus grand des Rouilleux. Blessé, il lâche des Cliquets ; à bout de forces, il enrage.',
    pv: 4200, vitesse: 0.35, armure: 9, or: 300, vies: 12, taille: 1.5,
    boss: true, resisteRalenti: 0.6,
    ponte: { type: 'cliquet', n: 4, toutes: 5, seuil: 0.75 }, rage: { seuil: 0.4, vitesse: 1.6, armure: 3 },
  },
  brouilleur: {
    nom: 'Brouilleur', desc: 'Une antenne sur pattes : par moments, il brouille les tours autour de lui, qui cessent de tirer.',
    pv: 80, vitesse: 1.2, armure: 1, or: 12, vies: 1, taille: 0.48,
    brouille: { rayon: 2.2, toutes: 6, duree: 2.5 },
  },
  galopin: {
    nom: 'Galopin', desc: 'Plus il est blessé, plus il court vite. Achevez-le d’un coup.',
    pv: 60, vitesse: 1.4, armure: 0, or: 8, vies: 1, taille: 0.4, affole: 1.5,
  },
  givrin: {
    nom: 'Givrin', desc: 'Couvert de givre : rien ne le ralentit, rien ne le sonne.',
    pv: 130, vitesse: 1.1, armure: 3, or: 12, vies: 1, taille: 0.52, insensible: true,
  },
  ruche: {
    nom: 'Ruche volante', desc: 'Une ruche de fer qui vole lentement et lâche des Rôdeurs sur le chemin.',
    pv: 240, vitesse: 0.7, armure: 2, or: 20, vies: 2, taille: 0.7, vole: true,
    ponte: { type: 'rodeur', n: 2, toutes: 5 },
  },
  golem: {
    nom: 'Le Golem d’Obsidienne', desc: 'Toutes les 10 secondes, il se couvre d’obsidienne : plus rien ne le blesse pendant 3 secondes. Il brouille aussi les tours qu’il frôle.',
    pv: 4600, vitesse: 0.4, armure: 8, or: 300, vies: 12, taille: 1.4,
    boss: true, resisteRalenti: 0.6, carapace: { toutes: 10, duree: 3 }, brouille: { rayon: 2.5, toutes: 8, duree: 3 },
  },
};

// Application du facteur de PV, ennemis et boss.
for (const e of Object.values(ENNEMIS)) {
  e.pv = Math.round(e.pv * FACTEUR_PV);
  e.or = Math.round(e.or * FACTEUR_OR_ENNEMIS);
}

export const ORDRE_ENNEMIS = ['rodeur', 'filou', 'cuirasse', 'bourdon', 'grappe', 'grappillon', 'tisseur', 'furtif', 'fouisseur', 'pavois', 'bondisseur', 'dirigeable', 'mue', 'broyeur', 'nuee', 'hydre', 'tete', 'seigneur', 'cliquet', 'bastion', 'reparateur', 'scarabee', 'colosse', 'brouilleur', 'galopin', 'givrin', 'ruche', 'golem'];

/** Hauteur de vol (en cases). */
export const ALTITUDE = 1.6;
