/**
 * FIESTA — le catalogue des mini-jeux.
 *
 * Module ISO : ce que chaque mini-jeu mesure, dans quel sens (plus haut ou
 * plus bas, c'est mieux), et le niveau des joueurs de l'ordinateur. Le jeu
 * lui-même (ce qu'on voit et touche) vit dans public/games/fiesta/js/jeux/.
 *
 * Les scores des ordinateurs sont tirés entre deux bornes, selon leur niveau :
 * un Facile se trompe et traîne, un Expert joue comme un bon joueur humain.
 *
 * Trois styles de mini-jeux :
 *   chacun → chacun pour soi ;
 *   duo    → 2 contre 2 : les points des deux coéquipiers s'additionnent ;
 *   seul   → 1 contre tous : le joueur seul a son propre rôle (le gardien,
 *            le fantôme), les autres le leur. Chacun fait ses choix de son
 *            côté (sur le même téléphone l'un après l'autre, ou en ligne en
 *            même temps) ; `resoudre` les confronte à la fin. Les choix
 *            tiennent dans un seul nombre (un chiffre par choix, voir
 *            `coder`), comme n'importe quel score.
 */

const M = (id, nom, glyphe, regle, sens, unite, cpu, style = 'chacun') => ({ id, nom, glyphe, regle, sens, unite, cpu, style });

/** Les choix d'un joueur, un chiffre chacun, dans la base voulue. */
export const coder = (choix, base) => choix.reduce((t, x, k) => t + x * base ** k, 0);
export const chiffre = (v, base, k) => Math.floor(v / base ** k) % base;

export const TIRS_PAR_TIREUR = 3;
export const MANCHES_FANTOME = 3;
/** Autant de pièces que de chasseurs, plus deux : trouver le fantôme n'est jamais gagné d'avance. */
export const piecesFantome = (chasseurs) => chasseurs + 2;
const RATE_TIR = { facile: 0.3, normal: 0.15, expert: 0.07 };

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

  /* ---- 2 contre 2 ---- */
  M('corde', 'Tir à la Corde', '🪢', 'Tirez quand le curseur passe dans le vert ! Pile au centre, c’est le grand coup. Dans le rouge, vous glissez. Les forces des deux coéquipiers s’additionnent. 10 secondes.', 'haut', 'de force',
    { facile: [12, 22], normal: [19, 30], expert: [27, 38] }, 'duo'),
  M('relais', 'Course de Relais', '🏃', 'Gauche, droite, gauche, droite… le plus vite possible sur 30 mètres ! Deux fois le même pied et vous trébuchez. Les temps des deux coéquipiers s’additionnent.', 'bas', 'ms',
    { facile: [6800, 9500], normal: [5200, 7000], expert: [4200, 5600] }, 'duo'),

  /* ---- 1 contre tous ---- */
  {
    ...M('tirs', 'Tirs au But', '⚽', 'Un gardien contre tous les tireurs, trois tirs chacun. Les tireurs gagnent s’ils marquent plus de la moitié des tirs !', 'haut', 'buts', null, 'seul'),
    roles: {
      solo: 'Vous êtes le gardien 🧤 : pour chaque tir, devinez le coin et plongez !',
      autres: 'Vous êtes tireur ⚽ : choisissez un coin, puis frappez au bon moment. Trop fort, c’est au-dessus !',
    },
    unites: { solo: 'arrêts', autres: 'buts' },
    /** Gardien : un plongeon par tir (0, 1, 2). Tireur : un tir par essai (0, 1, 2, ou 3 = raté). */
    cpuJouer(niveau, R, ctx) {
      if (ctx.role === 'solo') return coder(Array.from({ length: ctx.autres.length * TIRS_PAR_TIREUR }, () => Math.floor(R() * 3)), 3);
      const rate = RATE_TIR[niveau] ?? RATE_TIR.normal;
      return coder(Array.from({ length: TIRS_PAR_TIREUR }, () => (R() < rate ? 3 : Math.floor(R() * 3))), 4);
    },
    resoudre(solo, autres, val) {
      const valeurs = {};
      const tirs = autres.length * TIRS_PAR_TIREUR;
      let buts = 0;
      autres.forEach((t, s) => {
        let b = 0;
        for (let k = 0; k < TIRS_PAR_TIREUR; k++) {
          const tir = chiffre(val(t), 4, k);
          if (tir < 3 && tir !== chiffre(val(solo), 3, s * TIRS_PAR_TIREUR + k)) b += 1;
        }
        valeurs[t] = b;
        buts += b;
      });
      valeurs[solo] = tirs - buts;
      return {
        valeurs, equipes: [tirs - buts, buts],
        gagnante: buts * 2 > tirs ? 1 : buts * 2 < tirs ? 0 : -1,
        texte: `${buts} but${buts > 1 ? 's' : ''} sur ${tirs} tirs`,
      };
    },
  },
  {
    ...M('fantome', 'Le Fantôme', '👻', 'Un fantôme se cache dans le manoir, les autres le cherchent. Trois manches : trouvé deux fois, le fantôme a perdu !', 'haut', 'trouvailles', null, 'seul'),
    roles: {
      solo: 'Vous êtes le fantôme 👻 : à chaque manche, choisissez une cachette. Ne vous faites pas prendre deux fois !',
      autres: 'Vous êtes chasseur 🔦 : à chaque manche, fouillez une pièce. Il suffit qu’un chasseur tombe sur le fantôme !',
    },
    unites: { solo: 'manches cachées', autres: 'trouvailles' },
    cpuJouer(niveau, R, ctx) {
      const n = piecesFantome(ctx.autres.length);
      return coder(Array.from({ length: MANCHES_FANTOME }, () => Math.floor(R() * n)), n);
    },
    resoudre(solo, autres, val) {
      const n = piecesFantome(autres.length);
      const valeurs = Object.fromEntries(autres.map((c) => [c, 0]));
      let trouve = 0;
      for (let m = 0; m < MANCHES_FANTOME; m++) {
        const cachette = chiffre(val(solo), n, m);
        const qui = autres.filter((c) => chiffre(val(c), n, m) === cachette);
        for (const c of qui) valeurs[c] += 1;
        if (qui.length) trouve += 1;
      }
      valeurs[solo] = MANCHES_FANTOME - trouve;
      return {
        valeurs, equipes: [MANCHES_FANTOME - trouve, trouve],
        gagnante: trouve >= 2 ? 1 : 0,
        texte: trouve ? `Trouvé ${trouve} fois sur ${MANCHES_FANTOME}` : 'Jamais trouvé !',
      };
    },
  },
];

export const STYLES = ['chacun', 'duo', 'seul'];

export const MINIJEU = Object.fromEntries(MINIJEUX.map((m) => [m.id, m]));

/** Le meilleur de deux scores, selon le sens du mini-jeu. */
export const meilleur = (id, a, b) => (MINIJEU[id].sens === 'haut' ? Math.max(a, b) : Math.min(a, b));

/** L'unité d'un score : en 1 contre tous, elle dépend du rôle. */
export const uniteDe = (id, role = null) => (MINIJEU[id].unites && role ? MINIJEU[id].unites[role] : MINIJEU[id].unite);

/**
 * Un score de l'ordinateur, tiré entre ses bornes (plutôt vers le milieu) ;
 * en 1 contre tous, ses choix pour son rôle (`ctx`, voir partie.contexte).
 */
export function scoreOrdinateur(id, niveau, R, ctx = null) {
  if (MINIJEU[id].cpuJouer) return MINIJEU[id].cpuJouer(niveau, R, ctx);
  const [a, b] = MINIJEU[id].cpu[niveau] || MINIJEU[id].cpu.normal;
  const t = (R() + R()) / 2;
  return Math.round(a + (b - a) * t);
}
