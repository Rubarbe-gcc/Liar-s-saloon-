/**
 * FIESTA — le catalogue des mini-jeux.
 *
 * Module ISO : ce que chaque mini-jeu mesure, dans quel sens (plus haut ou
 * plus bas, c'est mieux), et le niveau des joueurs de l'ordinateur. Le jeu
 * lui-même (ce qu'on voit et touche) vit dans public/games/fiesta/js/jeux/.
 *
 * Les scores des ordinateurs sont tirés entre deux bornes, selon leur niveau :
 * un Facile se trompe et traîne, un Expert joue comme un bon joueur humain.
 */

const M = (id, nom, glyphe, regle, sens, unite, cpu) => ({ id, nom, glyphe, regle, sens, unite, cpu });

export const MINIJEUX = [
  M('tapotage', 'Tapotage Turbo', '👆', 'Tapez le plus vite possible sur le gros bouton pendant 8 secondes !', 'haut', 'tapes',
    { facile: [28, 46], normal: [40, 58], expert: [54, 74] }),
  M('reflexe', 'Duel au Soleil', '🤠', 'Attendez le « FEU ! » puis tirez le plus vite possible. Trois manches. Tirer trop tôt coûte cher.', 'bas', 'ms',
    { facile: [390, 560], normal: [290, 410], expert: [225, 320] }),
  M('chrono', 'Chrono à l’Aveugle', '⏱️', 'Arrêtez le chrono pile à 5,00 secondes. Il disparaît après 1,5 seconde…', 'bas', 'ms d’écart',
    { facile: [180, 750], normal: [70, 380], expert: [15, 160] }),
  M('memo', 'Mémo Couleurs', '🎨', 'Regardez la suite de couleurs, puis rejouez-la. Elle s’allonge à chaque fois.', 'haut', 'couleurs',
    { facile: [3, 6], normal: [5, 8], expert: [7, 11] }),
  M('fruits', 'Pluie de Fruits', '🍉', 'Attrapez les fruits avec le panier, évitez les bombes ! 15 secondes.', 'haut', 'points',
    { facile: [5, 14], normal: [10, 20], expert: [16, 26] }),
  M('moutons', 'Compte les Moutons', '🐑', 'Des moutons traversent l’écran : combien en avez-vous compté ? Attention aux loups, ils ne comptent pas !', 'bas', 'd’écart',
    { facile: [1, 5], normal: [0, 3], expert: [0, 1] }),
  M('taupes', 'Tape-Taupes', '🔨', 'Tapez les taupes qui sortent de leur trou. Pas les lapins ! 12 secondes.', 'haut', 'points',
    { facile: [7, 15], normal: [12, 21], expert: [18, 28] }),
  M('tour', 'Tour Infernale', '🧱', 'Le bloc se balance : posez-le bien sur la tour. Ce qui dépasse tombe. Jusqu’où monterez-vous ?', 'haut', 'étages',
    { facile: [4, 9], normal: [7, 13], expert: [11, 18] }),
  M('calcul', 'Calcul Éclair', '🧮', 'Le plus de calculs justes en 15 secondes. Une erreur fait perdre un point.', 'haut', 'bonnes réponses',
    { facile: [3, 8], normal: [6, 11], expert: [9, 15] }),
];

export const MINIJEU = Object.fromEntries(MINIJEUX.map((m) => [m.id, m]));

/** Le meilleur de deux scores, selon le sens du mini-jeu. */
export const meilleur = (id, a, b) => (MINIJEU[id].sens === 'haut' ? Math.max(a, b) : Math.min(a, b));

/** Un score de l'ordinateur, tiré entre ses bornes (plutôt vers le milieu). */
export function scoreOrdinateur(id, niveau, R) {
  const [a, b] = MINIJEU[id].cpu[niveau] || MINIJEU[id].cpu.normal;
  const t = (R() + R()) / 2;
  return Math.round(a + (b - a) * t);
}
