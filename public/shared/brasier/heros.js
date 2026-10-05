/**
 * BRASIER — les héros.
 *
 * Chaque héros a un pouvoir : actif (payant, une fois par tour) ou passif
 * (toujours en marche). Le pouvoir s'exécute dans le moteur de partie, qui
 * seul sait tirer au sort ; ce module ne fait que décrire.
 */

export const PV_HEROS = 30;

export const HEROS = [
  { id: 'zora', nom: 'Zora, tisseuse d\'ombres', glyph: '🕷️', couleur: '#8b5cf6',
    pouvoir: { type: 'renfortProvoc', cout: 1,
      texte: 'Donne +1/+1 et Provocation à un de vos serviteurs au hasard.' } },
  { id: 'ignis', nom: 'Ignis le pyromancien', glyph: '🔥', couleur: '#f97316',
    pouvoir: { type: 'attaqueDroite', cout: 1,
      texte: 'Votre serviteur le plus à droite gagne +2 ATQ.' } },
  { id: 'valeria', nom: 'Valéria du crépuscule', glyph: '🗡️', couleur: '#e11d48',
    pouvoir: { type: 'placement', cout: 1,
      texte: 'Gagnez 2 pièces d\'or au prochain tour.' } },
  { id: 'boris', nom: 'Boris le forgeron', glyph: '🔨', couleur: '#94a3b8',
    pouvoir: { type: 'forgeRouages', cout: 2,
      texte: 'Vos Rouages gagnent +2 ATQ.' } },
  { id: 'nekros', nom: 'Nekros l\'invocateur', glyph: '🪦', couleur: '#65a30d',
    pouvoir: { type: 'reincarneGauche', cout: 1,
      texte: 'Donne Réincarnation à votre serviteur le plus à gauche.' } },
  { id: 'aurelia', nom: 'Aurélia la lumineuse', glyph: '☀️', couleur: '#facc15',
    pouvoir: { type: 'bouclierGauche', cout: 2,
      texte: 'Donne Bouclier sacré à votre serviteur le plus à gauche.' } },
  { id: 'ronce', nom: 'Ronce la dresseuse', glyph: '🌿', couleur: '#22c55e',
    pouvoir: { type: 'invoqueChaton', cout: 2,
      texte: 'Invoque un Chaton 1/1.' } },
  { id: 'hildra', nom: 'Hildra l\'aubergiste', glyph: '🍺', couleur: '#d97706',
    pouvoir: { type: 'decouverte', cout: 3,
      texte: 'Découvrez un serviteur de votre rang de taverne.' } },
  { id: 'mirelle', nom: 'Mirelle la marchande', glyph: '🪙', couleur: '#eab308',
    pouvoir: { type: 'rafraichiGratuit', cout: null, passif: true,
      texte: 'Votre premier rafraîchissement de chaque tour est gratuit.' } },
  { id: 'aelis', nom: 'Aëlis la sylphe', glyph: '🌬️', couleur: '#38bdf8',
    pouvoir: { type: 'souffleTaverne', cout: 1,
      texte: 'Les serviteurs de votre taverne gagnent +1/+1.' } },
  { id: 'thadeus', nom: 'Thadéus le collectionneur', glyph: '🧳', couleur: '#a16207',
    pouvoir: { type: 'collection', cout: null, passif: true,
      texte: 'Fin du tour : votre serviteur le plus à gauche gagne +1/+1 par carte gardée en main (3 au plus).' } },
  { id: 'gorak', nom: 'Gorak le colosse', glyph: '🗿', couleur: '#78716c',
    pouvoir: { type: 'colosse', cout: null, passif: true,
      texte: 'Au début de chaque combat, votre serviteur le plus à gauche gagne +2/+2.' } },
];

const PAR_ID = new Map(HEROS.map((h) => [h.id, h]));
export const getHeros = (id) => PAR_ID.get(id) || null;
