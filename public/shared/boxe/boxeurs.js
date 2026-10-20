/**
 * CROCHET — les seize boxeurs (tous inventés : noms, surnoms, villes, couleurs).
 *
 * Quatre catégories (plumes, légers, moyens, lourds), quatre boxeurs chacune.
 * Chacun : ses notes (puissance, vitesse, endurance, défense, menton), un style
 * lu par l'ordinateur (ia.js), ses couleurs (short, gants, liseré) et sa taille.
 * Les notes sont réglées pour que chacun gagne entre 35 et 65 % de ses
 * combats contre tous les autres (test/boxe.test.js).
 *
 * Module partagé, sans DOM.
 */

/**
 * Les styles, lus par l'ordinateur :
 *   cogneur     : il avance et cherche le gros crochet
 *   technicien  : le jab, la distance, des enchaînements propres
 *   contreur    : il attend que l'autre se découvre, esquive et punit
 *   corps       : il travaille au corps, pour vider l'adversaire
 *   mobile      : il tourne, pique au jab et repart
 *   bagarreur   : il frappe beaucoup, se protège peu
 */
export const STYLES = {
  cogneur: { nom: 'Cogneur', distance: 0.95, envie: 0.75, jab: 0.25, crochet: 0.5, upper: 0.25, corps: 0.2, garde: 0.55, esquive: 0.15, contre: 0.3, tourne: 0.2 },
  technicien: { nom: 'Technicien', distance: 1.15, envie: 0.54, jab: 0.55, crochet: 0.3, upper: 0.15, corps: 0.25, garde: 0.7, esquive: 0.25, contre: 0.45, tourne: 0.4 },
  contreur: { nom: 'Contreur', distance: 1.2, envie: 0.44, jab: 0.4, crochet: 0.4, upper: 0.2, corps: 0.2, garde: 0.6, esquive: 0.55, contre: 0.9, tourne: 0.5 },
  corps: { nom: 'Travail au corps', distance: 0.92, envie: 0.65, jab: 0.3, crochet: 0.45, upper: 0.25, corps: 0.6, garde: 0.6, esquive: 0.15, contre: 0.35, tourne: 0.2 },
  mobile: { nom: 'Mobile', distance: 1.32, envie: 0.58, jab: 0.7, crochet: 0.2, upper: 0.1, corps: 0.15, garde: 0.5, esquive: 0.45, contre: 0.4, tourne: 0.85 },
  bagarreur: { nom: 'Bagarreur', distance: 1, envie: 0.9, jab: 0.35, crochet: 0.4, upper: 0.25, corps: 0.3, garde: 0.3, esquive: 0.1, contre: 0.2, tourne: 0.15 },
};

export const CATEGORIES = { plume: 'Poids plume', leger: 'Poids léger', moyen: 'Poids moyen', lourd: 'Poids lourd' };

/** Un boxeur : [puissance, vitesse, endurance, défense, menton], ses couleurs [short, gants, liseré]. */
const b = (id, nom, surnom, ville, categorie, style, [puissance, vitesse, endurance, defense, menton], [short, gants, liseré], devise) => ({
  id, nom, surnom, ville, categorie, style, notes: { puissance, vitesse, endurance, defense, menton }, couleurs: { short, gants, liseré }, devise,
  taille: { plume: 0.95, leger: 1, moyen: 1.04, lourd: 1.09 }[categorie],
});

export const BOXEURS = [
  b('barneche', 'Tito Barnèche', 'Le Colibri', 'Port-Céleste', 'plume', 'mobile', [65, 94, 84, 80, 72], ['#38b6ff', '#ffffff', '#0b2a4a'], 'Tu ne peux pas frapper ce que tu ne vois pas.'),
  b('ferrandou', 'Malik Ferrandou', 'Mitraillette', 'Mielville', 'plume', 'bagarreur', [64, 88, 86, 64, 78], ['#ffd23f', '#1d1d1d', '#1d1d1d'], 'Cent coups par round, au minimum.'),
  b('ardouin', 'Nils Ardouin', 'L’Horloger', 'Valrose', 'plume', 'technicien', [62, 86, 80, 80, 66], ['#ff5fa2', '#ffffff', '#7a1d48'], 'Chaque coup à sa place, chaque seconde aussi.'),
  b('ribeyrolles', 'Paco Ribeyrolles', 'Petit Tonnerre', 'Braise-sur-Mont', 'plume', 'cogneur', [74, 82, 76, 66, 76], ['#e0362c', '#ff9a1a', '#1f1f1f'], 'Petit, mais ça gronde.'),
  b('morvan', 'Sacha Morvan', 'Le Fantôme', 'Montbrume', 'leger', 'contreur', [72, 84, 80, 88, 76], ['#4b2e83', '#c9b8ff', '#c9b8ff'], 'Frappe-moi. Si tu me trouves.'),
  b('lantenac', 'Diego Lantenac', 'Coup-de-Fouet', 'Bellerive', 'leger', 'technicien', [70, 82, 80, 78, 70], ['#2fd7a8', '#0b3b40', '#0b3b40'], 'Le jab ouvre toutes les portes.'),
  b('ebrard', 'Wassim Ebrard', 'Le Marteau', 'Fort-Granit', 'leger', 'corps', [78, 76, 86, 72, 76], ['#5a5f6b', '#ffb000', '#ffb000'], 'D’abord le corps. La tête suivra.'),
  b('castera', 'Yohan Castéra', 'Feu Follet', 'Lumen', 'leger', 'mobile', [70, 90, 84, 80, 70], ['#2a2a5a', '#ffe066', '#ffe066'], 'Je danse, tu t’épuises.'),
  b('rocaillon', 'Bastien Rocaillon', 'La Forge', 'Terre-Rouge', 'moyen', 'cogneur', [79, 70, 74, 66, 76], ['#b5492a', '#f3d6a0', '#5a2412'], 'Un seul crochet suffit.'),
  b('delmas', 'Kofi Delmas', 'Le Mur', 'Neigeval', 'moyen', 'contreur', [74, 72, 80, 90, 78], ['#e8f4ff', '#2a5d8f', '#2a5d8f'], 'Rien ne passe. Tout revient.'),
  b('sarrette', 'Lenny Sarrette', 'Bulldozer', 'L’Anse-Noire', 'moyen', 'bagarreur', [78, 74, 84, 58, 78], ['#151515', '#c23b3b', '#e6e6e6'], 'Je recule pas. Jamais.'),
  b('vasseur', 'Aurélien Vasseur', 'Le Professeur', 'Haute-Plaine', 'moyen', 'technicien', [72, 75, 80, 80, 72], ['#8a5a2b', '#f0e0c0', '#4a2e12'], 'La boxe, ça se révise.'),
  b('malbrouck', 'Gédéon Malbrouck', 'La Montagne', 'Grand-Récif', 'lourd', 'cogneur', [81, 54, 66, 60, 76], ['#0f6e6e', '#9ff0e0', '#083a3a'], 'Quand je tombe, c’est la terre qui tremble.'),
  b('kerlouan', 'Ivan Kerlouan', 'L’Ours', 'Ventenac', 'lourd', 'corps', [88, 60, 80, 70, 86], ['#3c8d3c', '#ffffff', '#1d4a1d'], 'Je serre, tu souffles.'),
  b('brancourt', 'Théo Brancourt', 'Le Gentleman', 'Saint-Aurel', 'lourd', 'contreur', [86, 68, 80, 86, 84], ['#7a1f2b', '#f2c14e', '#f2c14e'], 'Après vous, je vous en prie.'),
  b('abergel', 'Moussa Abergel', 'Le Séisme', 'Cendrecourt', 'lourd', 'bagarreur', [82, 62, 78, 60, 80], ['#ff7a1a', '#3a1200', '#3a1200'], 'Le premier coup, c’est toujours moi.'),
];

export const BOXEUR = Object.fromEntries(BOXEURS.map((x) => [x.id, x]));

/** La note générale d'un boxeur (pour l'affichage). */
export const noteGenerale = (x) => { const n = x.notes; return Math.round((n.puissance + n.vitesse + n.endurance + n.defense + n.menton) / 5); };
