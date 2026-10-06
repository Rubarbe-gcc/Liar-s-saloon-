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
 *
 * Un mini-jeu `interactif` (le cache-cache du Fantôme) se joue manche par
 * manche, les uns après les autres : la partie le mène (voir partie.agir et
 * cachecache.js), et chacun n'y reçoit qu'un score final.
 */

import { seuilFantome } from './cachecache.js';

const M = (id, nom, glyphe, regle, sens, unite, cpu, style = 'chacun') => ({ id, nom, glyphe, regle, sens, unite, cpu, style });

/** Les choix d'un joueur, un chiffre chacun, dans la base voulue. */
export const coder = (choix, base) => choix.reduce((t, x, k) => t + x * base ** k, 0);
export const chiffre = (v, base, k) => Math.floor(v / base ** k) % base;

export const TIRS_PAR_TIREUR = 3;
const RATE_TIR = { facile: 0.3, normal: 0.15, expert: 0.07 };
const ARRET_ORDI = { facile: 0.45, normal: 0.6, expert: 0.72 };
/** Un tir lu par le gardien : raté, ou le coin (0 à 2) et la puissance (0 à 2). */
export function lireTir(chiffreTir) {
  if (!chiffreTir) return null;
  return { coin: Math.floor((chiffreTir - 1) / 3), puissance: (chiffreTir - 1) % 3 };
}
/** Le temps (ms) que met le ballon à entrer, selon la puissance : c'est le temps du gardien pour plonger. */
export const VOL_BALLON = [760, 580, 430];
/** Les tireurs gagnent s'ils marquent au moins un tir sur trois. */
export const butsPourGagner = (tirs) => Math.ceil(tirs / 3);

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
    ...M('tirs', 'Tirs au But', '⚽', 'Les tireurs frappent d’abord, trois tirs chacun. Puis le gardien affronte chaque tir en direct : il voit le ballon partir et doit plonger du bon côté avant qu’il n’entre ! Les tireurs gagnent s’ils marquent au moins un tir sur trois.', 'haut', 'buts', null, 'seul'),
    roles: {
      solo: 'Vous êtes le gardien 🧤 : regardez partir chaque tir, et plongez du bon côté avant que le ballon n’entre !',
      autres: 'Vous êtes tireur ⚽ : choisissez un coin, puis frappez. Plus c’est fort, plus le ballon va vite… mais trop fort, c’est au-dessus !',
    },
    unites: { solo: 'arrêts', autres: 'buts' },
    /** Le gardien joue en dernier, en direct, contre les tirs des autres. */
    soloEnDernier: true,
    /**
     * Tireur : un chiffre par tir (base 10) — 0 raté, sinon 1 + coin × 3 + puissance (0 à 2).
     * Gardien : un chiffre par tir (base 2) — 1 arrêté.
     */
    cpuJouer(niveau, R, ctx) {
      if (ctx.role === 'solo') {
        const arret = ARRET_ORDI[niveau] ?? ARRET_ORDI.normal;
        return coder(Array.from({ length: ctx.autres.length * TIRS_PAR_TIREUR }, () => (R() < arret ? 1 : 0)), 2);
      }
      const rate = RATE_TIR[niveau] ?? RATE_TIR.normal;
      return coder(Array.from({ length: TIRS_PAR_TIREUR }, () => {
        if (R() < rate) return 0;
        const r = R();
        return 1 + Math.floor(R() * 3) * 3 + (r < 0.4 ? 0 : r < 0.8 ? 1 : 2);
      }), 10);
    },
    resoudre(solo, autres, val) {
      const valeurs = {};
      const tirs = autres.length * TIRS_PAR_TIREUR;
      let buts = 0;
      autres.forEach((t, s) => {
        let b = 0;
        for (let k = 0; k < TIRS_PAR_TIREUR; k++) {
          if (chiffre(val(t), 10, k) > 0 && !chiffre(val(solo), 2, s * TIRS_PAR_TIREUR + k)) b += 1;
        }
        valeurs[t] = b;
        buts += b;
      });
      valeurs[solo] = tirs - buts;
      const seuil = butsPourGagner(tirs);
      return {
        valeurs, equipes: [tirs - buts, buts],
        gagnante: buts >= seuil ? 1 : 0,
        texte: `${buts} but${buts > 1 ? 's' : ''} sur ${tirs} tirs (il en fallait ${seuil})`,
      };
    },
  },
  {
    ...M('fantome', 'Le Fantôme', '👻', 'Un cache-cache dans le manoir hanté ! Chaque manche, les joueurs se cachent ; le fantôme regarde les ombres bouger, puis ouvre une porte. Une pièce fouillée est condamnée. Le fantôme gagne s’il attrape tout le monde.', 'haut', 'attrapés', null, 'seul'),
    interactif: true,
    roles: {
      solo: 'Vous êtes le fantôme 👻 : regardez bien les ombres bouger, puis ouvrez la porte où quelqu’un se cache. Attrapez tout le monde !',
      autres: 'Vous vous cachez 🙈 : à chaque manche, choisissez une pièce. Une pièce fouillée est condamnée : plus personne n’y va !',
    },
    unites: { solo: 'attrapés', autres: 'manches tenues' },
    /** Le fantôme : combien il en a attrapé ; les autres : combien de manches ils ont tenu. */
    resoudre(solo, autres, val) {
      const pris = val(solo);
      const valeurs = { [solo]: pris };
      for (const a of autres) valeurs[a] = val(a);
      const seuil = seuilFantome(autres.length);
      return {
        valeurs, equipes: [pris, autres.reduce((t, a) => t + val(a), 0)],
        gagnante: pris >= seuil ? 0 : 1,
        texte: pris >= seuil ? 'Tout le monde attrapé !' : `${pris} attrapé${pris > 1 ? 's' : ''} sur ${autres.length}`,
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
