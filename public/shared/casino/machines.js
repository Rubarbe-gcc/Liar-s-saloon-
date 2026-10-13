/**
 * LE VELOURS NOIR — les machines à sous.
 *
 * Module ISO. Trois machines : chacune a ses rouleaux (des bandes de
 * symboles, plus ou moins fréquents), ses lignes de gain et sa table des
 * gains. Un tirage arrête chaque rouleau au hasard ; la grille visible
 * (trois rangées) est lue le long des lignes jouées. Les tables sont
 * réglées pour rendre environ 95 % des mises sur la durée (vérifié par
 * les tests sur un grand nombre de tirages).
 */

/* ------------------------------------------------------------------ */
/* Les lignes de gain (rangée 0 en haut, 1 au milieu, 2 en bas)        */
/* ------------------------------------------------------------------ */

export const LIGNES_5 = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
];

/** Une bande de rouleau à partir des quantités de chaque symbole, bien mélangée (toujours la même). */
function bande(quantites, graine = 1) {
  const b = [];
  for (const [s, n] of Object.entries(quantites)) for (let k = 0; k < n; k++) b.push(s);
  // mélange déterministe, pour que les mêmes symboles ne se suivent pas en paquets
  let x = graine * 9301 + 49297;
  for (let i = b.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/* ------------------------------------------------------------------ */
/* Les machines                                                        */
/* ------------------------------------------------------------------ */

export const MACHINES = {
  fruit: {
    id: 'fruit', nom: 'Le Fruit d’Or', sous: 'La classique : trois rouleaux, une ligne.',
    rouleaux: 3, lignes: [[1, 1, 1]], lignesMax: 1, mises: [1, 2, 5, 10, 25],
    symboles: { cerise: '🍒', citron: '🍋', orange: '🍊', prune: '🍇', cloche: '🔔', bar: 'BAR', sept: '7' },
    bandes: [1, 2, 3].map((g) => bande({ cerise: 6, citron: 7, orange: 6, prune: 5, cloche: 4, bar: 3, sept: 1 }, g)),
    // gains × mise pour trois symboles alignés ; les cerises paient aussi dès le premier rouleau
    gains: { sept: { 3: 750 }, bar: { 3: 80 }, cloche: { 3: 40 }, prune: { 3: 20 }, orange: { 3: 16 }, citron: { 3: 8 }, cerise: { 1: 2, 2: 5, 3: 10 } },
    gauche: true, volatilite: 'moyenne', musique: 'machine-fruit', couleurs: ['#d21f3c', '#5a0a14', '#1e0408'],
  },
  royal: {
    id: 'royal', nom: 'Velours Royal', sous: 'Cinq rouleaux, neuf lignes. L’étoile remplace tout.',
    rouleaux: 5, lignes: LIGNES_5, lignesMax: 9, mises: [1, 2, 5, 10],
    symboles: { rose: '🌹', cocktail: '🍸', chapeau: '🎩', bague: '💍', diamant: '💎', couronne: '👑', etoile: '⭐' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ rose: 8, cocktail: 7, chapeau: 6, bague: 4, diamant: 3, couronne: 1, etoile: g === 1 || g === 5 ? 0 : 1 }, g + 10)),
    gains: { rose: { 3: 5, 4: 12, 5: 50 }, cocktail: { 3: 8, 4: 20, 5: 75 }, chapeau: { 3: 10, 4: 30, 5: 125 }, bague: { 3: 20, 4: 60, 5: 250 }, diamant: { 3: 30, 4: 125, 5: 600 }, couronne: { 3: 60, 4: 400, 5: 2500 } },
    joker: 'etoile', volatilite: 'moyenne', musique: 'machine-royal', couleurs: ['#b38bff', '#2a1e5a', '#0c0820'],
  },
  jackpot: {
    id: 'jackpot', nom: 'Le Jackpot du Velours', sous: 'Cinq lignes, et cinq sacs d’or sur une ligne remportent le jackpot.',
    rouleaux: 5, lignes: LIGNES_5.slice(0, 5), lignesMax: 5, lignesFixes: true, mises: [1, 2, 5, 10, 20],
    symboles: { trefle: '🍀', de: '🎲', piece: '🪙', billet: '💵', sept: '7', sac: '💰' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ trefle: 9, de: 8, piece: 6, billet: 4, sept: 2, sac: 1 }, g + 20)),
    gains: { trefle: { 3: 6, 4: 16, 5: 50 }, de: { 3: 8, 4: 20, 5: 80 }, piece: { 3: 12, 4: 40, 5: 160 }, billet: { 3: 25, 4: 100, 5: 400 }, sept: { 3: 80, 4: 400, 5: 2000 }, sac: { 3: 50, 4: 300 } },
    jackpot: { symbole: 'sac', depart: 10000, part: 0.03 },
    volatilite: 'explosive', musique: 'machine-jackpot', couleurs: ['#f3dc9a', '#6b4c12', '#1a1204'],
  },
  pharaons: {
    id: 'pharaons', nom: 'Trésor des Pharaons', sous: 'Neuf lignes sous les pyramides. Le scarabée remplace tout.',
    rouleaux: 5, lignes: LIGNES_5, lignesMax: 9, mises: [1, 2, 5, 10], volatilite: 'moyenne',
    symboles: { vase: '🏺', cobra: '🐍', chat: '🐈‍⬛', oeil: '👁️', pyramide: '🔺', scarabee: '🪲' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ vase: 9, cobra: 7, chat: 5, oeil: 3, pyramide: 2, scarabee: g === 1 ? 0 : 1 }, g + 30)),
    gains: { vase: { 3: 3, 4: 9, 5: 30 }, cobra: { 3: 5, 4: 14, 5: 50 }, chat: { 3: 9, 4: 30, 5: 115 }, oeil: { 3: 17, 4: 70, 5: 350 }, pyramide: { 3: 35, 4: 175, 5: 1150 } },
    joker: 'scarabee', musique: 'machine-pharaons', couleurs: ['#c9a227', '#5a3a0a', '#1e1404'],
  },
  pirates: {
    id: 'pirates', nom: 'Pirates des Caraïbes', sous: 'Cinq lignes, des coffres rares et énormes. Explosive.',
    rouleaux: 5, lignes: LIGNES_5.slice(0, 5), lignesMax: 5, mises: [1, 5, 10, 25], volatilite: 'explosive',
    symboles: { ancre: '⚓', perroquet: '🦜', carte: '🗺️', rhum: '🍾', crane: '☠️', pavillon: '🏴‍☠️' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ ancre: 10, perroquet: 8, carte: 5, rhum: 3, crane: 1, pavillon: g === 3 ? 1 : 0 }, g + 40)),
    gains: { ancre: { 3: 3, 4: 8, 5: 25 }, perroquet: { 3: 4, 4: 14, 5: 55 }, carte: { 3: 10, 4: 40, 5: 200 }, rhum: { 3: 25, 4: 135, 5: 1050 }, crane: { 3: 135, 4: 1350, 5: 13500 } },
    joker: 'pavillon', musique: 'machine-pirates', couleurs: ['#1f6f8b', '#0e3240', '#06141a'],
  },
  vegas: {
    id: 'vegas', nom: 'Nuit à Las Vegas', sous: 'Neuf lignes de néons. L’étoile filante remplace tout.',
    rouleaux: 5, lignes: LIGNES_5, lignesMax: 9, mises: [1, 2, 5, 10, 25], volatilite: 'moyenne',
    symboles: { de: '🎲', carte: '🃏', cocktail: '🍹', danseuse: '💃', diamant: '💎', etoile: '🌟' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ de: 8, carte: 7, cocktail: 6, danseuse: 4, diamant: 2, etoile: g === 1 || g === 5 ? 0 : 1 }, g + 50)),
    gains: { de: { 3: 4, 4: 9, 5: 35 }, carte: { 3: 6, 4: 14, 5: 55 }, cocktail: { 3: 7, 4: 25, 5: 100 }, danseuse: { 3: 20, 4: 75, 5: 350 }, diamant: { 3: 45, 4: 250, 5: 1450 } },
    joker: 'etoile', musique: 'machine-vegas', couleurs: ['#ff3ea5', '#3a0a5a', '#12041e'],
  },
  dragon: {
    id: 'dragon', nom: 'Le Dragon de Jade', sous: 'Neuf lignes paisibles, des gains réguliers. Calme.',
    rouleaux: 5, lignes: LIGNES_5, lignesMax: 9, mises: [1, 2, 5, 10], volatilite: 'calme',
    symboles: { bambou: '🎋', lanterne: '🏮', enveloppe: '🧧', lotus: '🪷', dragon: '🐉', mahjong: '🀄' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ bambou: 7, lanterne: 6, enveloppe: 5, lotus: 4, dragon: 2, mahjong: g === 1 ? 0 : 2 }, g + 60)),
    gains: { bambou: { 3: 3, 4: 8, 5: 25 }, lanterne: { 3: 5, 4: 13, 5: 40 }, enveloppe: { 3: 7, 4: 20, 5: 65 }, lotus: { 3: 10, 4: 35, 5: 125 }, dragon: { 3: 25, 4: 100, 5: 500 } },
    joker: 'mahjong', musique: 'machine-dragon', couleurs: ['#2fa36b', '#0e3a24', '#04140c'],
  },
  ruee: {
    id: 'ruee', nom: 'Ruée vers l’Or', sous: 'Trois rouleaux, cinq lignes, des pépites rarissimes. Explosive.',
    rouleaux: 3, lignes: [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]], lignesMax: 5, mises: [1, 2, 5, 10, 25, 50], volatilite: 'explosive',
    symboles: { cactus: '🌵', cheval: '🐎', cowboy: '🤠', pioche: '⛏️', pepite: '🥇' },
    bandes: [1, 2, 3].map((g) => bande({ cactus: 9, cheval: 7, cowboy: 5, pioche: 3, pepite: 1 }, g + 70)),
    gains: { cactus: { 3: 4 }, cheval: { 3: 10 }, cowboy: { 3: 25 }, pioche: { 3: 90 }, pepite: { 3: 3000 } },
    musique: 'machine-ruee', couleurs: ['#c96f2a', '#5a2a0a', '#1e0e04'],
  },
  galaxie: {
    id: 'galaxie', nom: 'Galaxie 777', sous: 'Mise forte, neuf lignes, trois 7 qui font décoller. Explosive.',
    rouleaux: 5, lignes: LIGNES_5, lignesMax: 9, mises: [5, 10, 25, 50], volatilite: 'explosive',
    symboles: { lune: '🌙', comete: '☄️', planete: '🪐', alien: '👽', fusee: '🚀', sept: '7', nebuleuse: '🌌' },
    bandes: [1, 2, 3, 4, 5].map((g) => bande({ lune: 9, comete: 7, planete: 5, alien: 3, fusee: 2, sept: 1, nebuleuse: g === 3 ? 1 : 0 }, g + 80)),
    gains: { lune: { 3: 4, 4: 12, 5: 35 }, comete: { 3: 6, 4: 17, 5: 65 }, planete: { 3: 12, 4: 45, 5: 170 }, alien: { 3: 30, 4: 135, 5: 650 }, fusee: { 3: 65, 4: 450, 5: 3500 }, sept: { 3: 250, 4: 2500, 5: 24000 } },
    joker: 'nebuleuse', musique: 'machine-galaxie', couleurs: ['#5a6bff', '#141a5a', '#04061e'],
  },
  petite: {
    id: 'petite', nom: 'La Petite Mise', sous: 'Des bonbons, de petites mises, des gains très souvent. Calme.',
    rouleaux: 3, lignes: [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]], lignesMax: 5, mises: [1, 2, 3, 4, 5], volatilite: 'calme',
    symboles: { bonbon: '🍬', sucette: '🍭', donut: '🍩', cupcake: '🧁', ballon: '🎈' },
    bandes: [1, 2, 3].map((g) => bande({ bonbon: 6, sucette: 5, donut: 4, cupcake: 3, ballon: 2 }, g + 90)),
    gains: { bonbon: { 3: 9 }, sucette: { 3: 15 }, donut: { 3: 25 }, cupcake: { 3: 45 }, ballon: { 3: 120 } },
    musique: 'machine-petite', couleurs: ['#ff8fc7', '#5a1a3a', '#1e0612'],
  },
};

/* ------------------------------------------------------------------ */
/* Le tirage                                                           */
/* ------------------------------------------------------------------ */

/** Les arrêts des rouleaux (au hasard) et la grille visible : grille[rouleau][rangée]. */
export function tirer(m, rng) {
  const arrets = m.bandes.map((b) => Math.floor(rng() * b.length));
  return { arrets, grille: grilleDe(m, arrets) };
}

export function grilleDe(m, arrets) {
  return m.bandes.map((b, r) => [0, 1, 2].map((k) => b[(arrets[r] + k - 1 + b.length) % b.length]));
}

/**
 * Les gains d'une grille.
 * @param {number} mise    la mise par ligne
 * @param {number} lignes  le nombre de lignes jouées
 * @returns {{ gains: { ligne, symbole, n, montant, cases: [r, rangée][] }[], total, jackpot }}
 */
export function evaluer(m, grille, mise, lignes = m.lignesMax) {
  const gains = [];
  let jackpot = false;
  m.lignes.slice(0, lignes).forEach((ligne, l) => {
    const syms = ligne.map((rang, r) => grille[r][rang]);
    if (m.gauche) {
      // la machine classique : trois pareils, ou des cerises depuis la gauche
      if (syms.every((s) => s === syms[0]) && m.gains[syms[0]][3]) {
        gains.push({ ligne: l, symbole: syms[0], n: 3, montant: m.gains[syms[0]][3] * mise, cases: ligne.map((rg, r) => [r, rg]) });
        return;
      }
      let n = 0;
      while (n < 3 && syms[n] === 'cerise') n++;
      if (n && m.gains.cerise[n]) gains.push({ ligne: l, symbole: 'cerise', n, montant: m.gains.cerise[n] * mise, cases: ligne.slice(0, n).map((rg, r) => [r, rg]) });
      return;
    }
    // de gauche à droite : le premier symbole (l'étoile remplace tout, sauf le sac d'or)
    const premier = syms.find((s) => s !== m.joker) || syms[0];
    let n = 0;
    while (n < syms.length && (syms[n] === premier || (syms[n] === m.joker && premier !== m.jackpot?.symbole))) n++;
    if (m.jackpot && premier === m.jackpot.symbole && n === 5) {
      jackpot = true;
      gains.push({ ligne: l, symbole: premier, n, montant: 0, jackpot: true, cases: ligne.map((rg, r) => [r, rg]) });
      return;
    }
    const table = m.gains[premier];
    if (table && table[n]) gains.push({ ligne: l, symbole: premier, n, montant: table[n] * mise, cases: ligne.slice(0, n).map((rg, r) => [r, rg]) });
  });
  return { gains, total: gains.reduce((s, g) => s + g.montant, 0), jackpot };
}

/** La mise totale d'un tour. */
export const miseTotale = (m, mise, lignes) => mise * (m.lignesFixes ? m.lignesMax : lignes);

/**
 * Le dernier rouleau doit-il faire durer le suspense ? Vrai si, sur une
 * ligne, les rouleaux d'avant promettent déjà un gros gain.
 */
export function suspense(m, grille, lignes = m.lignesMax) {
  const n = m.rouleaux;
  return m.lignes.slice(0, lignes).some((ligne) => {
    const syms = ligne.slice(0, n - 1).map((rang, r) => grille[r][rang]);
    const premier = syms.find((s) => s !== m.joker) || syms[0];
    const ok = syms.every((s) => s === premier || s === m.joker);
    const haut = ['sept', 'bar', 'couronne', 'diamant', 'sac', 'billet'].includes(premier);
    return ok && haut;
  });
}

/** Ce qu'un gain représente, rapporté à la mise : 'big' (×15), 'mega' (×50), ou rien. */
export const palier = (gain, mise) => (gain >= mise * 50 ? 'mega' : gain >= mise * 15 ? 'big' : null);
