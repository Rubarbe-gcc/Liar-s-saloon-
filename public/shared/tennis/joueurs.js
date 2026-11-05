/**
 * REVERS — les seize joueurs (tous inventés) : leur style, leurs notes, leurs couleurs.
 *
 * Les notes (de 50 à 99) : service, coupDroit, revers, volee, vitesse.
 */

/** Les styles de jeu : ce que l'ordinateur aime faire avec ce joueur. */
export const STYLES = {
  fond: { nom: 'Fond de court', filet: 0.06, amortie: 0.05, lob: 0.05, slice: 0.12 },
  attaquant: { nom: 'Service-volée', filet: 0.32, amortie: 0.05, lob: 0.03, slice: 0.18 },
  contreur: { nom: 'Contreur', filet: 0.04, amortie: 0.06, lob: 0.12, slice: 0.2 },
  puissance: { nom: 'Gros frappeur', filet: 0.12, amortie: 0.03, lob: 0.03, slice: 0.06 },
  lifteur: { nom: 'Lifteur', filet: 0.05, amortie: 0.08, lob: 0.08, slice: 0.05 },
  artiste: { nom: 'Artiste', filet: 0.16, amortie: 0.16, lob: 0.1, slice: 0.22 },
};

/** Les surfaces : la terre ralentit et fait rebondir haut, le gazon file et rebondit bas. */
export const SURFACES = {
  dur: { nom: 'Dur', vitesse: 1, rebondK: 1, rebondH: 1 },
  terre: { nom: 'Terre battue', vitesse: 0.92, rebondK: 0.9, rebondH: 1.12 },
  gazon: { nom: 'Gazon', vitesse: 1.05, rebondK: 1.08, rebondH: 0.82 },
};

const j = (id, nom, surnom, ville, style, n, couleurs, taille = 1) => ({ id, nom, surnom, ville, style, notes: n, couleurs, taille });
const N = (service, coupDroit, revers, volee, vitesse) => ({ service, coupDroit, revers, volee, vitesse });
const C = (maillot, short, bandeau, raquette) => ({ maillot, short, bandeau, raquette });

export const JOUEURS = [
  j('valmont', 'Aurèle Valmont', 'Le Métronome', 'Port-Sablon', 'fond', N(80, 88, 86, 70, 84), C('#1f6fd1', '#f4f4f4', '#f4f4f4', '#d12e2e'), 1.02),
  j('karsten', 'Ingo Karsten', 'Le Canon', 'Valombre', 'puissance', N(94, 88, 77, 72, 72), C('#141414', '#141414', '#e8c22c', '#e8c22c'), 1.06),
  j('ferraz', 'Tiago Ferraz', 'Le Taureau', 'Sol-d’Ambre', 'lifteur', N(78, 93, 80, 68, 86), C('#c43c28', '#f4f4f4', '#f4f4f4', '#1d1d1d'), 1.01),
  j('okonkwo', 'Ada Okonkwo', 'La Flèche', 'Brisevent', 'attaquant', N(86, 77, 78, 88, 84), C('#f4f4f4', '#1b3d7a', '#1b3d7a', '#2bb3a0'), 1),
  j('nakase', 'Ren Nakase', 'Le Mur', 'Lune-Rousse', 'contreur', N(70, 82, 88, 74, 94), C('#7a3fc4', '#141414', '#f4f4f4', '#f4f4f4'), 0.96),
  j('delorme', 'Céleste Delorme', 'La Fée', 'Plume-Haute', 'artiste', N(76, 84, 90, 88, 80), C('#f0a6c8', '#f4f4f4', '#f0a6c8', '#7a3fc4'), 0.97),
  j('brannigan', 'Rory Brannigan', 'Le Bûcheron', 'Kerbrume', 'puissance', N(92, 87, 76, 70, 71), C('#2e8a3e', '#f4f4f4', '#2e8a3e', '#141414'), 1.08),
  j('mirza', 'Leyla Mirza', 'Le Scalpel', 'Corail-sur-Mer', 'fond', N(74, 84, 86, 72, 88), C('#18a3b8', '#f4f4f4', '#f4f4f4', '#18a3b8'), 0.98),
  j('vasko', 'Petar Vasko', 'L’Ours', 'Fournaise', 'puissance', N(88, 82, 76, 74, 72), C('#8a1f1f', '#141414', '#f4f4f4', '#f4f4f4'), 1.07),
  j('lindgren', 'Saga Lindgren', 'La Comète', 'Cimes', 'attaquant', N(84, 76, 78, 86, 82), C('#4fb3ff', '#f4f4f4', '#f4f4f4', '#141414'), 1),
  j('abebe', 'Mekonnen Abebe', 'Le Vent', 'Vif-Argent', 'contreur', N(76, 83, 83, 70, 92), C('#e88a1f', '#141414', '#141414', '#e88a1f'), 0.98),
  j('rosier', 'Margaux Rosier', 'La Patience', 'Rouages', 'lifteur', N(72, 86, 80, 66, 82), C('#d94a7a', '#f4f4f4', '#141414', '#d94a7a'), 0.96),
  j('quintana', 'Mateo Quintana', 'Le Magicien', 'Port-Ancre', 'artiste', N(78, 80, 84, 86, 78), C('#f2d33a', '#1b3d7a', '#1b3d7a', '#1b3d7a'), 0.99),
  j('haldor', 'Bjørn Haldor', 'Le Géant', 'Tour-Blanche', 'attaquant', N(92, 72, 70, 84, 64), C('#f4f4f4', '#f4f4f4', '#c43c28', '#c43c28'), 1.1),
  j('sauvage', 'Inès Sauvage', 'La Tornade', 'Ferrac', 'lifteur', N(76, 84, 82, 72, 84), C('#5b2a86', '#f4f4f4', '#f2d33a', '#f2d33a'), 0.97),
  j('obi', 'Kelechi Obi', 'Le Roc', 'Vertefeuille', 'fond', N(78, 83, 81, 70, 82), C('#1d7a4a', '#141414', '#f4f4f4', '#f4f4f4'), 1.03),
];
export const JOUEUR = Object.fromEntries(JOUEURS.map((x) => [x.id, x]));
export const noteGenerale = (x) => { const n = x.notes; return Math.round((n.service + n.coupDroit + n.revers + n.volee + n.vitesse) / 5); };
