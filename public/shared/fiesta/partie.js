/**
 * FIESTA — la partie : le plateau, les mini-jeux, les dés.
 *
 * Module ISO. Toute la partie tient dans un objet JSON, hasard compris (la
 * graine avance dans `p.alea`) : elle se range et se reprend.
 *
 * Un tour :
 *   minijeu   → tout le monde joue le même mini-jeu (les humains l'un après
 *               l'autre, sur le même appareil ; l'ordinateur, lui, est tiré).
 *               Certains mini-jeux se jouent chacun pour soi, d'autres à
 *               2 contre 2, d'autres à un contre tous (voir minijeux.js) ;
 *   resultats → le classement donne les dés : le premier en lance deux, les
 *               suivants un seul, avec un bonus qui baisse avec le rang (en
 *               équipe : deux dés pour chaque gagnant, un pour les autres) ;
 *   des       → chacun, dans l'ordre du classement, lance et avance — un
 *               humain arrête ses dés lui-même ; les cases spéciales s'en
 *               mêlent ;
 *   … jusqu'à ce que quelqu'un atteigne l'arrivée.
 */

import { MINIJEUX, MINIJEU, scoreOrdinateur } from './minijeux.js';
import * as CC from './cachecache.js';

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

/** Les styles de mini-jeux (voir minijeux.js). */
export const FORMATS = {
  chacun: { nom: 'Chacun pour soi', glyphe: '🎯' },
  duo: { nom: '2 contre 2', glyphe: '🤝' },
  seul: { nom: '1 contre tous', glyphe: '⚔️' },
};
/** `tous` : les trois styles de mini-jeux se mêlent ; `chacun` : seulement les mini-jeux chacun pour soi. */
export const MODES = ['tous', 'chacun'];

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
 * @param {{ joueurs: Array<{nom:string, avatar:string, humain:boolean}>, niveau?: string, longueur?: string, modes?: string, graine?: string|number }} o
 */
export function creerPartie({ joueurs, niveau = 'normal', longueur = 'normale', modes = 'tous', graine = Date.now() } = {}) {
  if (!joueurs || joueurs.length < 2 || joueurs.length > JOUEURS_MAX) throw new Error('de 2 à 4 joueurs');
  const p = {
    v: 1, alea: graineDe(graine), niveau: NIVEAUX.includes(niveau) ? niveau : 'normal',
    longueur: LONGUEURS[longueur] ? longueur : 'normale',
    modes: MODES.includes(modes) ? modes : 'tous',
    joueurs: joueurs.map((j, i) => ({
      i, nom: String(j.nom || `Joueur ${i + 1}`).slice(0, 12), avatar: j.avatar || AVATARS[i], couleur: COULEURS[i],
      humain: !!j.humain, pos: 0, bloque: false, victoires: 0,
    })),
    cases: [], tour: 0, phase: 'minijeu', minijeu: null, format: null, dernierSeul: null, recents: [], scores: [], ordreHumains: [],
    classement: [], equipes: null, resolution: null, jeu: null, des: [], aJouer: [], journal: [], vainqueur: null,
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

/** Un mini-jeu du style voulu, qu'on n'a pas joué récemment. */
function choisirMinijeu(p, style) {
  const duStyle = MINIJEUX.filter((m) => m.style === style);
  const frais = duStyle.filter((m) => !p.recents.includes(m.id));
  const dispo = frais.length ? frais : duStyle;
  const m = dispo[entier(p, dispo.length)];
  p.recents = [...p.recents, m.id].slice(-4);
  return m.id;
}

/** Le format du tour (une vieille partie sans format joue chacun pour soi). */
export const formatDe = (p) => p.format || { type: 'chacun', equipes: null };

/** Le nom du format, avec le bon compte (« 1 contre 3 », « 1 contre 2 »). */
export function nomFormat(p) {
  const f = formatDe(p);
  return f.type === 'seul' ? `1 contre ${p.joueurs.length - 1}` : FORMATS[f.type].nom;
}

/**
 * Le style du mini-jeu du tour, tiré au sort : à quatre, la moitié des tours
 * se jouent chacun pour soi, un quart à 2 contre 2, un quart à 1 contre 3 ;
 * à trois, un tour sur trois environ à 1 contre 2 ; à deux, toujours en duel.
 */
function choisirStyle(p) {
  const n = p.joueurs.length;
  const r = hasard(p);
  if (p.modes !== 'chacun' && n === 4) return r < 0.5 ? 'chacun' : r < 0.75 ? 'duo' : 'seul';
  if (p.modes !== 'chacun' && n === 3) return r < 0.65 ? 'chacun' : 'seul';
  return 'chacun';
}

/** Les camps du tour. Le joueur seul n'est jamais deux fois de suite le même. */
function formerEquipes(p, type) {
  const tous = p.joueurs.map((j) => j.i);
  if (type === 'duo') {
    const [a, b, c, d] = melanger(p, tous);
    return { type, equipes: [[a, b], [c, d]] };
  }
  if (type === 'seul') {
    const candidats = tous.filter((i) => i !== p.dernierSeul);
    const solo = candidats[entier(p, candidats.length)];
    p.dernierSeul = solo;
    return { type, equipes: [[solo], tous.filter((i) => i !== solo)] };
  }
  return { type, equipes: null };
}

function nouveauTour(p) {
  p.tour += 1;
  p.phase = 'minijeu';
  const style = choisirStyle(p);
  p.minijeu = choisirMinijeu(p, style);
  p.format = formerEquipes(p, style);
  p.equipes = null;
  p.resolution = null;
  p.scores = p.joueurs.map(() => null);
  p.classement = [];
  p.des = [];
  p.aJouer = [];
  p.jeu = null;
  // Un mini-jeu qui se joue manche par manche : la partie le mène.
  if (MINIJEU[p.minijeu].interactif) {
    p.jeu = CC.nouveau(p.format.equipes[1]);
    jouerOrdis(p);
    return;
  }
  // L'ordinateur a déjà « joué » : son score attend d'être révélé.
  for (const j of p.joueurs) if (!j.humain) p.scores[j.i] = scoreOrdinateur(p.minijeu, p.niveau, () => hasard(p), contexte(p, j.i));
  // Que des ordinateurs à la table : le mini-jeu se classe tout seul.
  if (!humainSuivant(p)) classer(p);
}

/* ------------------------------------------------------------------ */
/* Le mini-jeu interactif : le cache-cache du Fantôme                  */
/* ------------------------------------------------------------------ */

const fantomeDe = (p) => formatDe(p).equipes[0][0];

/** Ce joueur doit-il agir maintenant (se cacher, ou ouvrir une porte) ? */
export function doitAgir(p, i) {
  const st = p.jeu;
  if (p.phase !== 'minijeu' || !st) return false;
  if (st.etape === 'cache') return st.libres.includes(i) && st.choix[i] === undefined;
  if (st.etape === 'cherche') return i === fantomeDe(p);
  return false;
}

/** L'ordinateur joue ce qu'il a à jouer, jusqu'à ce qu'un humain doive agir (ou la fin). */
export function jouerOrdis(p) {
  const st = p.jeu;
  if (!st || p.phase !== 'minijeu') return;
  const R = () => hasard(p);
  for (let garde = 0; garde < 60 && st.etape !== 'fini'; garde++) {
    if (st.etape === 'cache') {
      for (const i of CC.reste(st)) if (!p.joueurs[i].humain) CC.cacher(st, i, CC.cachetteAuHasard(st, R));
      if (CC.reste(st).length) return;
      CC.versRecherche(st, R);
    } else {
      if (p.joueurs[fantomeDe(p)].humain) return;
      CC.chercher(st, CC.porteOrdi(st, p.niveau, R));
    }
  }
  if (st.etape === 'fini') {
    const f = fantomeDe(p);
    p.scores = p.joueurs.map((j) => (j.i === f ? CC.attrapes(st) : CC.manchesTenues(st, j.i)));
    classer(p);
  }
}

/** Un humain agit : il se cache dans une pièce, ou (le fantôme) ouvre une porte. */
export function agir(p, i, piece) {
  if (!doitAgir(p, i)) return refus('joueur');
  const st = p.jeu;
  const r = st.etape === 'cache' ? CC.cacher(st, i, piece) : CC.chercher(st, piece);
  if (!r.ok) return r;
  jouerOrdis(p);
  return { ok: true };
}

/** L'ordinateur agit à la place d'un joueur (parti, absent, trop lent). */
function agirOrdi(p, i) {
  const st = p.jeu;
  const R = () => hasard(p);
  return agir(p, i, st.etape === 'cache' ? CC.cachetteAuHasard(st, R) : CC.porteOrdi(st, 'facile', R));
}

/** Le temps est écoulé : l'ordinateur joue tout ce qui reste, jusqu'à la fin du cache-cache. */
export function finirJeu(p) {
  for (let garde = 0; garde < 60 && p.phase === 'minijeu' && p.jeu; garde++) {
    const qui = p.joueurs.find((j) => doitAgir(p, j.i));
    if (!qui) break;
    agirOrdi(p, qui.i);
  }
}

/**
 * Le rôle d'un joueur dans le mini-jeu du tour : `chacun`, `equipe` (avec
 * son coéquipier), ou, en 1 contre tous, `solo` ou `autres` (avec la liste
 * des autres, dans l'ordre où le joueur seul les affronte).
 */
export function contexte(p, i) {
  const f = formatDe(p);
  if (f.type === 'chacun') return { role: 'chacun' };
  const [A, B] = f.equipes;
  if (f.type === 'duo') return { role: 'equipe', equipe: A.includes(i) ? A : B };
  return { role: A[0] === i ? 'solo' : 'autres', solo: A[0], autres: B };
}

/**
 * Le prochain humain qui doit jouer le mini-jeu, ou null. Dans un mini-jeu
 * où le joueur seul affronte en direct ce que les autres ont fait (le
 * gardien des tirs au but), il passe en dernier.
 */
export function humainSuivant(p) {
  if (p.jeu) return p.joueurs.find((j) => j.humain && doitAgir(p, j.i)) || null;
  const libres = p.joueurs.filter((j) => j.humain && p.scores[j.i] === null);
  const f = formatDe(p);
  if (libres.length > 1 && f.type === 'seul' && MINIJEU[p.minijeu]?.soloEnDernier) return libres.find((j) => j.i !== f.equipes[0][0]);
  return libres[0] || null;
}

/** Ce joueur seul attend que les autres aient joué (vrai seulement pour le gardien des tirs au but). */
export function attendLesAutres(p, i) {
  const f = formatDe(p);
  if (f.type !== 'seul' || !MINIJEU[p.minijeu]?.soloEnDernier || f.equipes[0][0] !== i) return false;
  return f.equipes[1].some((x) => p.scores[x] === null);
}

/** Un humain vient de finir le mini-jeu. */
export function score(p, i, valeur) {
  if (p.phase !== 'minijeu') return refus('phase');
  if (p.jeu) return refus('interactif');
  const j = p.joueurs[i];
  if (!j || !j.humain || p.scores[i] !== null) return refus('joueur');
  if (!Number.isFinite(valeur)) return refus('score');
  p.scores[i] = valeur;
  if (!humainSuivant(p)) classer(p);
  return { ok: true };
}

/**
 * L'ordinateur joue le mini-jeu à la place d'un joueur : parti, coupé du
 * réseau, ou trop lent (en ligne).
 */
export function scoreAuto(p, i, niveau = 'facile') {
  if (p.phase !== 'minijeu') return refus('phase');
  if (p.jeu) return doitAgir(p, i) ? agirOrdi(p, i) : refus('joueur');
  if (!p.joueurs[i] || p.scores[i] !== null) return refus('joueur');
  p.scores[i] = scoreOrdinateur(p.minijeu, niveau, () => hasard(p), contexte(p, i));
  if (!humainSuivant(p)) classer(p);
  return { ok: true };
}

/**
 * Le classement du mini-jeu, et les dés qu'il rapporte. Les ex æquo partagent
 * le même rang (et les mêmes dés).
 */
function classer(p) {
  if (formatDe(p).type !== 'chacun') { classerEquipes(p); return; }
  p.equipes = null;
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

/**
 * En équipe. À 2 contre 2, les points des coéquipiers s'additionnent ; à un
 * contre tous, le mini-jeu confronte les choix de chacun (`resoudre`). Les
 * gagnants lancent deux dés chacun, les perdants un seul. Le joueur seul qui
 * bat tous les autres gagne en plus un bonus (un par adversaire). Égalité :
 * tout le monde a gagné.
 */
function classerEquipes(p) {
  const f = formatDe(p);
  const m = MINIJEU[p.minijeu];
  // La valeur de chacun, telle qu'on l'affiche (buts, arrêts… ou le score lui-même).
  let valeur = (i) => p.scores[i];
  let totaux;
  let gagnante;
  if (m.resoudre) {
    const r = m.resoudre(f.equipes[0][0], f.equipes[1], (i) => p.scores[i]);
    valeur = (i) => r.valeurs[i];
    totaux = r.equipes;
    gagnante = r.gagnante;
    p.resolution = { texte: r.texte };
  } else {
    const mieux = (a, b) => (m.sens === 'haut' ? a > b : a < b);
    totaux = f.equipes.map((membres) => membres.reduce((t, i) => t + p.scores[i], 0));
    gagnante = mieux(totaux[0], totaux[1]) ? 0 : mieux(totaux[1], totaux[0]) ? 1 : -1;
  }
  const meilleurDabord = m.resoudre || m.sens === 'haut' ? (a, b) => valeur(b) - valeur(a) : (a, b) => valeur(a) - valeur(b);
  const eqs = f.equipes.map((membres, k) => ({ membres: [...membres].sort(meilleurDabord), score: totaux[k] }));
  const [A, B] = eqs;
  eqs.forEach((e, k) => { e.gagne = gagnante === -1 || gagnante === k; e.egalite = gagnante === -1; });
  p.equipes = eqs;
  const ordre = gagnante === 1 ? [B, A] : [A, B];
  p.classement = ordre.flatMap((e) => e.membres.map((i) => ({ i, rang: e.gagne ? 0 : 1, score: valeur(i), equipe: eqs.indexOf(e) })));
  const soloGagne = f.type === 'seul' && gagnante === 0;
  p.des = p.classement.map(({ i, rang }) => ({
    i, des: rang === 0 ? 2 : 1, bonus: soloGagne && i === f.equipes[0][0] ? p.joueurs.length - 1 : 0,
  }));
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
 *
 * `tirage` : les faces sur lesquelles un humain a arrêté ses dés (sinon, les
 * dés sont tirés ici).
 */
export function lancer(p, tirage = null) {
  if (p.phase !== 'des') return refus('phase');
  const i = p.aJouer[0];
  const j = p.joueurs[i];
  const d = desDe(p, i);
  const valide = (t) => Array.isArray(t) && t.length === d.des && t.every((x) => Number.isInteger(x) && x >= 1 && x <= 6);
  if (tirage != null && !j.bloque && !valide(tirage)) return refus('tirage');
  p.aJouer.shift();
  if (tirage == null || j.bloque) tirage = Array.from({ length: d.des }, () => de6(p));
  else tirage = [...tirage];
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
