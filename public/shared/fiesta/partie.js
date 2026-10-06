/**
 * FIESTA — la partie : le plateau, les mini-jeux, les dés.
 *
 * Module ISO. Toute la partie tient dans un objet JSON, hasard compris (la
 * graine avance dans `p.alea`) : elle se range et se reprend.
 *
 * Un tour :
 *   minijeu   → tout le monde joue le même mini-jeu (les humains l'un après
 *               l'autre, sur le même appareil ; l'ordinateur, lui, est tiré) ;
 *   resultats → le classement donne les dés : le premier en lance deux, les
 *               suivants un seul, avec un bonus qui baisse avec le rang ;
 *   des       → chacun, dans l'ordre du classement, lance et avance ; les
 *               cases spéciales s'en mêlent ;
 *   … jusqu'à ce que quelqu'un atteigne l'arrivée.
 */

import { MINIJEUX, MINIJEU, scoreOrdinateur } from './minijeux.js';

export const JOUEURS_MAX = 4;
export const NIVEAUX = ['facile', 'normal', 'expert'];
export const LONGUEURS = { courte: 30, normale: 45, longue: 60 };

/** Les cases du plateau. */
export const CASES = {
  depart: { nom: 'Départ', glyphe: '🏁', texte: '' },
  arrivee: { nom: 'Arrivée', glyphe: '🏆', texte: 'Le premier ici gagne !' },
  normale: { nom: 'Case', glyphe: '', texte: '' },
  etoile: { nom: 'Étoile', glyphe: '⭐', texte: 'Avancez de 3 cases.' },
  tornade: { nom: 'Tornade', glyphe: '🌀', texte: 'Reculez de 3 cases.' },
  fusee: { nom: 'Fusée', glyphe: '🚀', texte: 'Avancez de 6 cases !' },
  echange: { nom: 'Échange', glyphe: '🔀', texte: 'Échangez votre place avec le joueur en tête.' },
  trou: { nom: 'Trou', glyphe: '🕳️', texte: 'Coincé ! Vous ne bougerez pas au prochain tour.' },
  de: { nom: 'Dé bonus', glyphe: '🎲', texte: 'Relancez un dé et avancez d’autant.' },
  cadeau: { nom: 'Cadeau piégé', glyphe: '🎁', texte: 'Tous les autres reculent de 2 cases.' },
};
/** Combien de chaque case spéciale, pour 45 cases (proportionnel à la longueur). */
const MELANGE = { fusee: 2, echange: 2, cadeau: 2, trou: 3, de: 3, etoile: 5, tornade: 5 };

export const COULEURS = ['#ff4d6d', '#3fa9ff', '#3ecf6e', '#ffc83d'];
export const AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐧', '🐵', '🦁', '🐨', '🐷', '🐲', '🤖', '👽', '🦖', '🐝'];
export const NOMS_ORDI = ['Robotto', 'Pixel', 'Bip-Bop', 'Turbo', 'Gizmo', 'Néon'];

/* ------------------------------------------------------------------ */
/* Le hasard, rangé dans la partie                                     */
/* ------------------------------------------------------------------ */

export function graineDe(texte) {
  let h = 2166136261;
  for (const c of String(texte)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function hasard(p) {
  p.alea = (p.alea + 0x6d2b79f5) >>> 0;
  let t = p.alea;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entier = (p, n) => Math.floor(hasard(p) * n);
const de6 = (p) => 1 + entier(p, 6);
function melanger(p, l) {
  for (let i = l.length - 1; i > 0; i--) { const j = entier(p, i + 1); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

/** Le plateau : départ, arrivée, et des cases spéciales jamais trop près du départ ni collées. */
export function construirePlateau(p, longueur) {
  const cases = Array(longueur).fill('normale');
  cases[0] = 'depart';
  cases[longueur - 1] = 'arrivee';
  const lot = [];
  for (const [type, n] of Object.entries(MELANGE)) {
    for (let k = 0; k < Math.max(1, Math.round((n * longueur) / 45)); k++) lot.push(type);
  }
  const places = melanger(p, Array.from({ length: longueur - 5 }, (_, i) => i + 3));
  for (const type of lot) {
    // Jamais deux cases pareilles côte à côte (les plus rares se placent d'abord).
    const i = places.findIndex((x) => cases[x] === 'normale' && cases[x - 1] !== type && cases[x + 1] !== type
      // Une fusée ou une étoile juste avant l'arrivée gâcherait la fin.
      && !(['fusee', 'etoile'].includes(type) && x > longueur - 8));
    if (i < 0) continue;
    cases[places[i]] = type;
    places.splice(i, 1);
  }
  return cases;
}

/**
 * @param {{ joueurs: Array<{nom:string, avatar:string, humain:boolean}>, niveau?: string, longueur?: string, graine?: string|number }} o
 */
export function creerPartie({ joueurs, niveau = 'normal', longueur = 'normale', graine = Date.now() } = {}) {
  if (!joueurs || joueurs.length < 2 || joueurs.length > JOUEURS_MAX) throw new Error('de 2 à 4 joueurs');
  const p = {
    v: 1, alea: graineDe(graine), niveau: NIVEAUX.includes(niveau) ? niveau : 'normal',
    longueur: LONGUEURS[longueur] ? longueur : 'normale',
    joueurs: joueurs.map((j, i) => ({
      i, nom: String(j.nom || `Joueur ${i + 1}`).slice(0, 12), avatar: j.avatar || AVATARS[i], couleur: COULEURS[i],
      humain: !!j.humain, pos: 0, bloque: false, victoires: 0,
    })),
    cases: [], tour: 0, phase: 'minijeu', minijeu: null, recents: [], scores: [], ordreHumains: [],
    classement: [], des: [], aJouer: [], journal: [], vainqueur: null,
  };
  p.cases = construirePlateau(p, LONGUEURS[p.longueur]);
  nouveauTour(p);
  return p;
}

const refus = (raison) => ({ ok: false, raison });
export const fin = (p) => p.cases.length - 1;

/* ------------------------------------------------------------------ */
/* Le mini-jeu                                                         */
/* ------------------------------------------------------------------ */

/** Un mini-jeu qu'on n'a pas joué récemment. */
function choisirMinijeu(p) {
  const dispo = MINIJEUX.filter((m) => !p.recents.includes(m.id));
  const m = dispo[entier(p, dispo.length)];
  p.recents = [...p.recents, m.id].slice(-4);
  return m.id;
}

function nouveauTour(p) {
  p.tour += 1;
  p.phase = 'minijeu';
  p.minijeu = choisirMinijeu(p);
  p.scores = p.joueurs.map(() => null);
  // L'ordinateur a déjà « joué » : son score attend d'être révélé.
  for (const j of p.joueurs) if (!j.humain) p.scores[j.i] = scoreOrdinateur(p.minijeu, p.niveau, () => hasard(p));
  p.classement = [];
  p.des = [];
  p.aJouer = [];
  // Que des ordinateurs à la table : le mini-jeu se classe tout seul.
  if (!humainSuivant(p)) classer(p);
}

/** Le prochain humain qui doit jouer le mini-jeu, ou null. */
export const humainSuivant = (p) => p.joueurs.find((j) => j.humain && p.scores[j.i] === null) || null;

/** Un humain vient de finir le mini-jeu. */
export function score(p, i, valeur) {
  if (p.phase !== 'minijeu') return refus('phase');
  const j = p.joueurs[i];
  if (!j || !j.humain || p.scores[i] !== null) return refus('joueur');
  if (!Number.isFinite(valeur)) return refus('score');
  p.scores[i] = valeur;
  if (!humainSuivant(p)) classer(p);
  return { ok: true };
}

/**
 * Le classement du mini-jeu, et les dés qu'il rapporte. Les ex æquo partagent
 * le même rang (et les mêmes dés).
 */
function classer(p) {
  const sens = MINIJEU[p.minijeu].sens;
  const ordre = p.joueurs.map((j) => j.i).sort((a, b) => (sens === 'haut' ? p.scores[b] - p.scores[a] : p.scores[a] - p.scores[b]));
  const n = p.joueurs.length;
  let rang = 0;
  p.classement = ordre.map((i, k) => {
    if (k > 0 && p.scores[i] !== p.scores[ordre[k - 1]]) rang = k;
    return { i, rang, score: p.scores[i] };
  });
  // Les dés : le premier en lance deux ; les autres, un dé et un bonus qui baisse avec le rang.
  p.des = p.classement.map(({ i, rang: r }) => ({ i, des: r === 0 ? 2 : 1, bonus: r === 0 ? 0 : Math.max(0, n - 1 - r) }));
  for (const c of p.classement) if (c.rang === 0) p.joueurs[c.i].victoires += 1;
  p.aJouer = p.classement.map((c) => c.i);
  p.phase = 'resultats';
}

export function versLesDes(p) {
  if (p.phase !== 'resultats') return refus('phase');
  p.phase = 'des';
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Les dés, le déplacement, les cases                                  */
/* ------------------------------------------------------------------ */

export const quiLance = (p) => (p.phase === 'des' ? p.aJouer[0] ?? null : null);
export const desDe = (p, i) => p.des.find((d) => d.i === i);

/**
 * Le joueur dont c'est le tour lance ses dés et avance. Renvoie tout ce que
 * l'écran doit montrer : les dés, le chemin case par case, l'effet de la case.
 */
export function lancer(p) {
  if (p.phase !== 'des') return refus('phase');
  const i = p.aJouer.shift();
  const j = p.joueurs[i];
  const d = desDe(p, i);
  const tirage = Array.from({ length: d.des }, () => de6(p));
  const total = tirage.reduce((s, x) => s + x, 0) + d.bonus;
  const r = { i, tirage, bonus: d.bonus, total, chemin: [], effet: null, bloque: false, autres: [] };

  if (j.bloque) {
    j.bloque = false;
    r.bloque = true;
    r.total = 0;
  } else {
    avancer(p, j, total, r.chemin);
    if (j.pos < fin(p)) appliquerCase(p, j, r);
  }
  p.journal.push(r);
  if (p.journal.length > 30) p.journal.shift();

  const gagnant = p.joueurs.find((x) => x.pos >= fin(p));
  if (gagnant) {
    p.vainqueur = gagnant.i;
    p.phase = 'fin';
  } else if (!p.aJouer.length) {
    nouveauTour(p);
  }
  return { ok: true, resultat: r };
}

function avancer(p, j, n, chemin) {
  const pas = n >= 0 ? 1 : -1;
  for (let k = 0; k < Math.abs(n); k++) {
    const suivant = Math.max(0, Math.min(fin(p), j.pos + pas));
    if (suivant === j.pos) break;
    j.pos = suivant;
    chemin.push(j.pos);
  }
}

function appliquerCase(p, j, r) {
  const type = p.cases[j.pos];
  if (!CASES[type] || type === 'normale' || type === 'depart') return;
  r.effet = { type, case: j.pos, chemin: [] };
  switch (type) {
    case 'etoile': avancer(p, j, 3, r.effet.chemin); break;
    case 'tornade': avancer(p, j, -3, r.effet.chemin); break;
    case 'fusee': avancer(p, j, 6, r.effet.chemin); break;
    case 'trou': j.bloque = true; break;
    case 'de': {
      const x = de6(p);
      r.effet.de = x;
      avancer(p, j, x, r.effet.chemin);
      break;
    }
    case 'echange': {
      const tete = [...p.joueurs].filter((x) => x !== j).sort((a, b) => b.pos - a.pos)[0];
      if (tete && tete.pos > j.pos) {
        r.effet.avec = tete.i;
        [tete.pos, j.pos] = [j.pos, tete.pos];
        r.effet.chemin.push(j.pos);
        r.autres.push({ i: tete.i, pos: tete.pos });
      } else r.effet.rien = true;
      break;
    }
    case 'cadeau':
      for (const x of p.joueurs) {
        if (x === j) continue;
        x.pos = Math.max(0, x.pos - 2);
        r.autres.push({ i: x.i, pos: x.pos });
      }
      break;
    default: break;
  }
}

/** Le classement de la course : position, puis victoires en mini-jeu. */
export function podium(p) {
  return [...p.joueurs].sort((a, b) => (b.pos - a.pos) || (b.victoires - a.victoires));
}
