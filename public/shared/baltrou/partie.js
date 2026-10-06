/**
 * BALTROU — la run : les blinds, les boss, la boutique.
 *
 * Module ISO. Toute la partie tient dans un objet JSON (`p`), hasard compris :
 * la graine avance dans `p.alea`. On peut donc la ranger telle quelle et la
 * reprendre plus tard, et une même graine rejoue la même run.
 *
 * Le déroulé :
 *   intro     → le choix de la blind : les trois blinds de l'ante sont
 *               visibles, boss compris ; on joue la blind du moment, ou on
 *               la passe (pas le boss) pour gagner un tag ;
 *   jeu       → on joue des mains et on défausse jusqu'à l'objectif ;
 *   gagne     → le butin de la manche ;
 *   boutique  → Jokers, objets, packs, bons ;
 *   … jusqu'à la victoire (mode Classique) ou la défaite.
 */

import { MAINS, MAIN, baseMain, evaluer, chipsCarte, nomCarte, estWild, AMELIORATIONS, ORDRE_COULEURS } from './cartes.js';
import { JOKERS, LISTE_JOKERS, OBJETS, VOUCHERS, VOUCHER, estNegatif } from './jokers.js';
import {
  PLANETES, TAROT, TAROTS, TAGS, TAGS_IMMEDIATS, MISES, multObjectif, infoConso, touchable,
} from './arcanes.js';

export { MISES, TAGS };

export const TAILLE_MAIN = 8;
export const MAX_SELECTION = 5;
export const MAINS_BASE = 4;
export const DEFAUSSES_BASE = 3;
export const ARGENT_DEPART = 10;
export const PLACES_JOKERS = 5;
export const NEGATIFS_MAX = 3;
export const CONSOMMABLES_MAX = 2;
export const PLACES_BOUTIQUE = 4;
export const CHANCE_TROLL = 0.03;
export const MALEDICTION_POISSON = 0.15;
/**
 * L'économie. Des intérêts sans plafond et un bonus qui grossissait de 7 $ à
 * chaque victoire faisaient pleuvoir l'argent : dès l'ante 3, on s'offrait un
 * Joker mythique, et plus aucun objectif ne tenait.
 */
export const PLAFONDS_INTERET = [5, 10, 20];      // selon les bons Intérêt + et Intérêt ++
export const BONUS_PAR_VICTOIRE = 2;
export const interetDe = (p) => Math.min(Math.floor(p.argent / 5), PLAFONDS_INTERET[Math.min(p.interetNiveau || 0, 2)]);
/** Un Joker mythique à la fois : on n'en voit plus en boutique tant qu'on en a un. */
export const aMythique = (p) => tousJokers(p).some((j) => JOKERS[j.id].rarete === 'mythique');

export const DECKS = {
  classique: { nom: 'Deck Classique', glyphe: '🂠', texte: 'Les 52 cartes, et le Poisson Dégueulasse.' },
  epure: { nom: 'Deck Épuré', glyphe: '✂️', texte: 'Sans les 2, 3 et 4 : moins de cartes, de meilleures mains.' },
  chanceux: { nom: 'Deck Chanceux', glyphe: '🍀', texte: 'Commence avec une WILDCARD (×6,7 chips et Mult) dans le paquet.' },
};

export const BOSS = {
  limace: { nom: 'La Limace', glyphe: '🐌', texte: 'Vos Jokers sont désactivés.' },
  mur: { nom: 'Le Mur', glyphe: '🧱', texte: 'Seulement 3 mains.' },
  avare: { nom: 'L’Avare', glyphe: '💰', texte: 'La boutique suivante coûte deux fois plus cher.' },
  crane: { nom: 'La Sorcière', glyphe: '🧙', texte: 'Score ×0,5.' },
  acharne: { nom: 'L’Acharné', glyphe: '😤', texte: 'Une seule défausse.' },
  silence: { nom: 'Le Silencieux', glyphe: '🤫', texte: 'Un de vos Jokers, au hasard, est désactivé.' },
  miroir: { nom: 'Le Miroir', glyphe: '🪞', texte: 'Les chips des cartes deviennent du Mult.' },
  voleur: { nom: 'Le Voleur', glyphe: '🦹', texte: 'Vole 10 % de votre argent à chaque main jouée.' },
  roi: { nom: 'LE ROI', glyphe: '👑', texte: 'Boss final : score ×0,5.' },
};
const PENALITE_BOSS = { crane: 0.5, roi: 0.5 };
const POOLS_BOSS = [['limace', 'avare', 'voleur'], ['mur', 'acharne', 'miroir'], ['crane', 'silence', 'voleur', 'miroir'], ['roi']];

/*
 * Les objectifs. À partir de l'ante 3, les Jokers commencent à se répondre et
 * les scores s'envolent : les objectifs grimpent plus vite pour suivre (une
 * main moyenne ne doit pas suffire à battre une blind).
 */
const ANTES_CLASSIQUES = [
  [['La Fourmi', 'Échauffez-vous !', 300, 2], ['Le Scarabée', 'Ça commence !', 500, 3]],
  [['Le Ciment', 'Allez-y !', 3000, 3], ['La Brique', 'Concentrez-vous !', 4000, 4]],
  [['Le Crâne', 'La vraie partie', 12000, 4], ['Le Squelette', 'Pas de pitié', 18000, 6]],
  [['Le Soldat', 'Courage !', 40000, 5], ['La Garde Royale', 'Presque là…', 70000, 7]],
];
const OBJECTIFS_BOSS = [[950, 4], [6000, 6], [25000, 9], [60000, 15]];
export const ANTES_CLASSIQUE = ANTES_CLASSIQUES.length;

/* ------------------------------------------------------------------ */
/* Le hasard, rangé dans la partie                                     */
/* ------------------------------------------------------------------ */

/** Une graine texte (« K7Q2ZP ») devient un nombre. */
export function graineDe(texte) {
  let h = 2166136261;
  for (const c of String(texte)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** Le tirage suivant, entre 0 et 1 (mulberry32 dont l'état vit dans `p.alea`). */
export function hasard(p) {
  p.alea = (p.alea + 0x6d2b79f5) >>> 0;
  let t = p.alea;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entier = (p, n) => Math.floor(hasard(p) * n);
const choisir = (p, l) => l[entier(p, l.length)];
function melanger(p, l) {
  for (let i = l.length - 1; i > 0; i--) { const j = entier(p, i + 1); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
}

const ALPHABET_GRAINE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Une graine neuve, pour l'écran (le moteur, lui, ne tire rien hors de la graine). */
export function nouvelleGraine(rnd = Math.random) {
  return Array.from({ length: 6 }, () => ALPHABET_GRAINE[Math.floor(rnd() * ALPHABET_GRAINE.length)]).join('');
}
export const nettoyerGraine = (t) => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

const nouvelUid = (p, pre) => `${pre}${++p.uid}`;

function nouvelleCarte(p, r, s, special = null) {
  const c = { uid: nouvelUid(p, 'c'), r, s, enh: null, sceau: null, special };
  p.cartes[c.uid] = c;
  p.paquet.push(c.uid);
  return c;
}

/** L'objectif selon la mise : arrondi, pour rester lisible. */
const objectifMise = (p, o) => (multObjectif(p.mise || 0) === 1 ? o : Math.round((o * multObjectif(p.mise || 0)) / 50) * 50);
/** Mise Rouge et au-delà : la petite blind ne rapporte rien. */
const recompenseMise = (p, r, i) => ((p.mise || 0) >= 1 && i === 0 ? 0 : r);
const tirerTag = (p) => choisir(p, Object.keys(TAGS));

function construireAntes(p) {
  return ANTES_CLASSIQUES.map((niveau, i) => {
    const blinds = niveau.map(([nom, sous, objectif, recompense], k) => ({
      nom, sous, objectif: objectifMise(p, objectif), recompense: recompenseMise(p, recompense, k), boss: null, tag: tirerTag(p),
    }));
    const boss = choisir(p, POOLS_BOSS[i]);
    const [objectif, recompense] = OBJECTIFS_BOSS[i];
    blinds.push({ nom: BOSS[boss].nom, sous: BOSS[boss].texte, objectif: objectifMise(p, objectif), recompense, boss });
    return blinds;
  });
}

/** Au-delà de l'ante 4, en mode Infini : la difficulté continue de grimper. */
function anteInfinie(p, n) {
  const k = n - ANTES_CLASSIQUE + 1;
  const croissance = 1.8 ** k;
  const bases = [[40000, 5], [70000, 7], [150000, 15]];
  const boss = choisir(p, Object.keys(BOSS));
  return bases.map(([o, r], i) => ({
    nom: i === 2 ? BOSS[boss].nom : `Manche ${3 * n + i + 1}`,
    sous: i === 2 ? BOSS[boss].texte : 'Mode Infini',
    objectif: objectifMise(p, Math.round(o * croissance / 100) * 100),
    recompense: recompenseMise(p, r + n, i),
    boss: i === 2 ? boss : null,
    ...(i < 2 ? { tag: tirerTag(p) } : {}),
  }));
}

/**
 * @param {{ mode?: 'classique'|'infini', deck?: 'classique'|'epure'|'chanceux', graine?: string, mise?: number }} o
 */
export function creerPartie({ mode = 'classique', deck = 'classique', graine = 'BALTROU', mise = 0 } = {}) {
  const p = {
    v: 2, mode: mode === 'infini' ? 'infini' : 'classique', deck: DECKS[deck] ? deck : 'classique',
    mise: Math.max(0, Math.min(MISES.length - 1, Math.floor(Number(mise) || 0))),
    tags: [], jongleur: 0, dernierConso: null,
    graine: nettoyerGraine(graine) || 'BALTROU', uid: 0,
    ante: 0, blindIdx: 0, antes: [], score: 0, phase: 'intro',
    argent: ARGENT_DEPART, mainsRestantes: MAINS_BASE, defaussesRestantes: DEFAUSSES_BASE,
    jokers: [], negatifs: [], maxJokers: PLACES_JOKERS,
    consommables: [], niveaux: Object.fromEntries(MAINS.map((m) => [m.id, 1])),
    vouchers: [], bonusMains: 0, bonusDefausses: 0, bonusTailleMain: 0,
    remise: false, refreshGratuit: false, interetNiveau: 0, bob: false, saintLivre: false,
    cartes: {}, paquet: [], pioche: [], main: [],
    silence: null, boutique: null, dernier: null, gains: null, message: null,
    stats: { mainsJouees: 0, defausses: 0, gainTotal: 0, meilleure: 0, meilleureNom: '', gagnees: 0, bossBattus: 0, passees: 0, tarots: 0, planetes: 0 },
  };
  p.alea = graineDe(p.graine);
  p.antes = construireAntes(p);
  for (const s of ORDRE_COULEURS) {
    for (let r = 2; r <= 14; r++) {
      if (p.deck === 'epure' && r <= 4) continue;
      nouvelleCarte(p, r, s);
    }
  }
  nouvelleCarte(p, 2, 'C', 'poisson');
  if (p.deck === 'chanceux') nouvelleCarte(p, 14, 'H', 'wild');
  preparerManche(p);
  return p;
}

/** Une sauvegarde d'une version précédente reçoit ce qui lui manque. */
export function migrer(p) {
  if (!p || p.v >= 2) return p;
  p.v = 2;
  p.mise = p.mise || 0;
  p.tags = p.tags || [];
  p.jongleur = p.jongleur || 0;
  p.dernierConso = p.dernierConso || null;
  Object.assign(p.stats, { passees: 0, tarots: 0, planetes: 0, ...p.stats });
  return p;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export function blindCourante(p) {
  while (p.ante >= p.antes.length) p.antes.push(anteInfinie(p, p.antes.length));
  return p.antes[p.ante][p.blindIdx];
}
export const carte = (p, uid) => p.cartes[uid];
export const tailleMain = (p) => TAILLE_MAIN + p.bonusTailleMain + (p.jongleur || 0);
export const tousJokers = (p) => [...p.jokers, ...p.negatifs];
export const aWild = (p) => p.paquet.some((u) => estWild(p.cartes[u]));

/** Les Jokers qui jouent vraiment cette manche (la Limace et le Silencieux s'en mêlent). */
export function jokersActifs(p) {
  const b = blindCourante(p);
  if (b.boss === 'limace') return [];
  const tous = tousJokers(p);
  if (b.boss === 'silence' && p.silence !== null) return tous.filter((_, i) => i !== p.silence);
  return tous;
}

/** Les cartes du paquet qu'un atelier ou un sceau peut toucher. */
export const ameliorables = (p) => p.paquet.filter((u) => !p.cartes[u].special);

/* ------------------------------------------------------------------ */
/* La manche                                                           */
/* ------------------------------------------------------------------ */

function piocher(p, n) {
  const out = [];
  for (let k = 0; k < n && p.pioche.length; k++) {
    const uid = p.pioche.pop();
    const c = p.cartes[uid];
    if (c.special === 'wild' && hasard(p) < CHANCE_TROLL) {
      c.special = 'troll';
      p.message = '🤪 TROLOLOLO ! La WILDCARD vient de muter en TROLL !';
    }
    out.push(uid);
  }
  p.main.push(...out);
  return out;
}

export function preparerManche(p) {
  const b = blindCourante(p);
  p.pioche = melanger(p, [...p.paquet]);
  p.main = [];
  p.score = 0;
  p.mainsRestantes = (b.boss === 'mur' ? 3 : MAINS_BASE) + p.bonusMains;
  p.defaussesRestantes = Math.max(0, (b.boss === 'acharne' ? 1 : DEFAUSSES_BASE) + p.bonusDefausses - ((p.mise || 0) >= 3 ? 1 : 0));
  // Le Tag Jongleur : trois cartes de plus en main, le temps de cette manche.
  p.jongleur = 0;
  const jo = (p.tags || []).indexOf('jongleur');
  if (jo >= 0) { p.tags.splice(jo, 1); p.jongleur = 3; }
  p.silence = b.boss === 'silence' && tousJokers(p).length ? entier(p, tousJokers(p).length) : null;
  p.dernier = null;
  p.gains = null;
  for (const j of tousJokers(p)) JOKERS[j.id].manche?.(j, p);
  piocher(p, tailleMain(p));
  p.phase = 'intro';
}

const refus = (raison) => ({ ok: false, raison });

/** La blind s'annonce ; on passe au jeu. */
export function commencer(p) {
  if (p.phase !== 'intro') return refus('phase');
  p.phase = 'jeu';
  return { ok: true };
}

/**
 * Passe la petite ou la grande blind (jamais le boss) : pas de récompense,
 * mais un tag. Renvoie le tag gagné.
 */
export function passer(p) {
  if (p.phase !== 'intro') return refus('phase');
  const b = blindCourante(p);
  if (b.boss || !b.tag) return refus('boss');
  b.passee = true;
  p.stats.passees += 1;
  const tag = b.tag;
  if (tag === 'argent') p.argent += 10;
  else if (tag === 'economie') p.argent += Math.min(40, p.argent);
  else p.tags.push(tag);
  p.blindIdx += 1;
  preparerManche(p);
  return { ok: true, tag, immediat: TAGS_IMMEDIATS.includes(tag) };
}

/** Les cartes de la main qu'il faudra jouer de force (le Poisson). */
export const forcees = (p) => p.main.filter((u) => p.cartes[u].special === 'poisson');

const nb = (v) => String(+v.toFixed(2)).replace('.', ',');

/** Ce qu'un Joker a changé, en clair : « +4 Mult », « ×3 Mult », « +50 ». */
function ecart(avant, chips, mult) {
  const out = [];
  const dc = chips - avant.chips;
  if (dc) out.push(`${dc > 0 ? '+' : '−'}${nb(Math.abs(dc))}`);
  if (mult !== avant.mult) {
    const ratio = avant.mult ? mult / avant.mult : 0;
    const delta = mult - avant.mult;
    const rond = (v) => Math.abs(v - Math.round(v * 100) / 100) < 1e-9;
    // Ajouté ou multiplié ? Le plus lisible des deux : un « +4 » plutôt qu'un « ×1,5 ».
    const multiplie = ratio > 1 && rond(ratio) && (!rond(delta) || delta > 20);
    out.push(multiplie ? `×${nb(ratio)} Mult` : `${mult > avant.mult ? '+' : '−'}${nb(Math.abs(mult - avant.mult))} Mult`);
  }
  return out.join(' ') || '—';
}

/**
 * Le score d'une main, pas à pas — chaque étape garde les chips et le Mult du
 * moment, pour que l'écran puisse rejouer le calcul.
 */
function compter(p, cartes) {
  const b = blindCourante(p);
  const { main, compte } = evaluer(cartes);
  const niveau = p.niveaux[main];
  let { chips, mult } = baseMain(main, niveau);
  const etapes = [{ t: 'main', label: `${MAIN[main].nom} · niv. ${niveau}`, chips, mult }];
  const miroir = b.boss === 'miroir';
  const R = () => hasard(p);
  let verres = 0;

  for (const c of compte) {
    if (c.special === 'wild') {
      chips = Math.floor(chips * 6.7); mult *= 6.7;
      etapes.push({ t: 'carte', uid: c.uid, label: 'WILDCARD ×6,7', chips, mult, gain: '×6,7' });
      continue;
    }
    if (c.special === 'troll') {
      if (R() < 0.5) {
        mult *= 3;
        etapes.push({ t: 'carte', uid: c.uid, label: 'TROLL (chance) ×3 Mult', chips, mult, gain: '×3' });
      } else {
        const perte = 50 + entier(p, 851);
        chips = Math.max(0, chips - perte);
        etapes.push({ t: 'carte', uid: c.uid, label: `TROLL (malchance) −${perte}`, chips, mult, gain: `−${perte}`, mauvais: true });
      }
      continue;
    }
    const fois = c.sceau === 'rouge' ? 2 : 1;
    for (let k = 0; k < fois; k++) {
      const v = chipsCarte(c);
      let gain;
      if (miroir) { mult += v / 20; gain = `+${+(v / 20).toFixed(2)} Mult`; } else { chips += v; gain = `+${v}`; }
      if (c.enh === 'mult') { mult += 4; gain += ' +4 Mult'; }
      if (c.enh === 'verre') { mult *= 1.5; gain += ' ×1,5'; }
      etapes.push({ t: 'carte', uid: c.uid, label: nomCarte(c) + (k ? ' (encore !)' : ''), chips, mult, gain });
    }
    if (c.sceau === 'or') { p.argent += 3; p.stats.gainTotal += 3; etapes.push({ t: 'carte', uid: c.uid, label: 'Sceau d’or : +3 $', chips, mult, gain: '+3 $', or: true }); }
    if (c.sceau === 'bleu') { p.niveaux[main] += 1; etapes.push({ t: 'carte', uid: c.uid, label: `${MAIN[main].nom} monte de niveau`, chips, mult, gain: 'niv. +1' }); }
    if (c.sceau === 'violet') {
      const cibles = ameliorables(p).filter((u) => u !== c.uid);
      if (cibles.length) {
        const kind = choisir(p, Object.keys(AMELIORATIONS));
        p.cartes[choisir(p, cibles)].enh = kind;
        etapes.push({ t: 'carte', uid: c.uid, label: `Une carte du paquet devient ${AMELIORATIONS[kind].nom}`, chips, mult, gain: '✨' });
      }
    }
    if (c.enh === 'verre' && R() < 0.25) {
      c.enh = null; verres++;
      etapes.push({ t: 'carte', uid: c.uid, label: `${nomCarte(c)} : le verre se brise !`, chips, mult, gain: 'CRAC', mauvais: true });
    }
  }

  const actifs = jokersActifs(p);
  for (const j of actifs) {
    const notes = [];
    const x = {
      chips, mult, main, ordre: MAIN[main].ordre, compte, argent: p.argent, mainsRestantes: p.mainsRestantes,
      jokers: actifs, j, R, note: (t) => notes.push(t),
    };
    const avant = { chips, mult };
    JOKERS[j.id].effet(x);
    chips = Math.max(0, x.chips); mult = x.mult;
    if (j.edition === 'holo') chips += 10;
    if (j.edition === 'poly') mult *= 1.15;
    etapes.push({ t: 'joker', uid: j.uid, label: JOKERS[j.id].nom + (notes.length ? ` (${notes.join(', ')})` : ''), chips, mult, gain: ecart(avant, chips, mult) });
  }

  // L'acier : ×1,5 Mult par carte d'acier restée en main.
  const joues = new Set(cartes.map((c) => c.uid));
  const aciers = p.main.filter((u) => !joues.has(u) && p.cartes[u].enh === 'acier');
  for (const u of aciers) {
    mult *= 1.5;
    etapes.push({ t: 'acier', uid: u, label: 'Acier en main ×1,5', chips, mult, gain: '×1,5' });
  }

  let points = Math.floor(chips * mult);
  const penalite = PENALITE_BOSS[b.boss];
  if (penalite) {
    points = Math.floor(points * penalite);
    etapes.push({ t: 'boss', label: `${BOSS[b.boss].nom} : score ×${String(penalite).replace('.', ',')}`, chips, mult, gain: `×${String(penalite).replace('.', ',')}`, mauvais: true });
  }
  return { main, compte, chips, mult, points, etapes, verres };
}

/** Ce que vaudrait une sélection, sans rien jouer (l'aperçu de l'écran). */
export function apercu(p, uids) {
  if (!uids.length) return null;
  const { main } = evaluer(uids.map((u) => p.cartes[u]));
  return { main, ...baseMain(main, p.niveaux[main]), niveau: p.niveaux[main] };
}

/** Joue une main. Le Poisson, s'il est en main, part avec elle de force. */
export function jouer(p, uids) {
  if (p.phase !== 'jeu') return refus('phase');
  if (p.mainsRestantes <= 0) return refus('mains');
  const sel = [...new Set(uids)].filter((u) => p.main.includes(u));
  for (const u of forcees(p)) if (!sel.includes(u)) sel.push(u);
  if (!sel.length) return refus('vide');
  if (sel.length > MAX_SELECTION) return refus('trop');

  p.message = null;
  const cartes = sel.map((u) => p.cartes[u]);
  const r = compter(p, cartes);
  let { points } = r;

  // Le Poisson Dégueulasse : ×4… ou la malédiction.
  let poisson = null;
  if (cartes.some((c) => c.special === 'poisson')) {
    if (hasard(p) < MALEDICTION_POISSON) {
      p.defaussesRestantes = 0;
      poisson = 'maudit';
      r.etapes.push({ t: 'poisson', label: 'POISSON MAUDIT : plus aucune défausse !', chips: r.chips, mult: r.mult, gain: 'MAUDIT', mauvais: true });
    } else {
      points *= 4;
      poisson = 'x4';
      r.etapes.push({ t: 'poisson', label: 'Poisson Dégueulasse ×4', chips: r.chips, mult: r.mult * 4, gain: '×4' });
    }
  }

  const b = blindCourante(p);
  let vole = 0;
  if (b.boss === 'voleur' && p.argent > 0) {
    vole = Math.max(1, Math.floor(p.argent * 0.1));
    p.argent -= vole;
  }

  p.niveaux[r.main] += 1;
  p.stats.mainsJouees += 1;
  if (points > p.stats.meilleure) { p.stats.meilleure = points; p.stats.meilleureNom = MAIN[r.main].nom; }
  p.score += points;
  p.mainsRestantes -= 1;
  p.main = p.main.filter((u) => !sel.includes(u));
  piocher(p, sel.length);

  p.dernier = {
    main: r.main, cartes: sel, compte: r.compte.map((c) => c.uid), etapes: r.etapes,
    chips: r.chips, mult: r.mult, points, poisson, vole, verres: r.verres,
  };

  if (p.score >= b.objectif) gagnerManche(p);
  else if (p.mainsRestantes <= 0) p.phase = 'defaite';
  return { ok: true, resultat: p.dernier };
}

/** Défausse des cartes. Ni le Poisson ni la WILDCARD ne se défaussent. */
export function defausser(p, uids) {
  if (p.phase !== 'jeu') return refus('phase');
  if (p.defaussesRestantes <= 0) return refus('defausses');
  const sel = [...new Set(uids)].filter((u) => p.main.includes(u));
  if (!sel.length) return refus('vide');
  if (sel.length > MAX_SELECTION) return refus('trop');
  if (sel.some((u) => p.cartes[u].special === 'poisson')) return refus('poisson');
  const ok = sel.filter((u) => !estWild(p.cartes[u]));
  if (!ok.length) return refus('wild');
  p.message = null;
  p.main = p.main.filter((u) => !ok.includes(u));
  piocher(p, ok.length);
  p.defaussesRestantes -= 1;
  p.stats.defausses += 1;
  return { ok: true, defaussees: ok };
}

/** Range la main : par valeur, ou par couleur. */
export function trierMain(p, critere = 'rang') {
  const cle = (u) => {
    const c = p.cartes[u];
    const r = c.special === 'poisson' ? 1 : estWild(c) ? 15 : c.r;
    return critere === 'couleur' ? ORDRE_COULEURS.indexOf(c.s) * 100 - r : -r;
  };
  p.main.sort((a, b) => cle(a) - cle(b));
}

/* ------------------------------------------------------------------ */
/* Fin de manche, et la boutique                                       */
/* ------------------------------------------------------------------ */

function gagnerManche(p) {
  const b = blindCourante(p);
  b.vaincue = true;
  p.jongleur = 0;
  for (const j of tousJokers(p)) JOKERS[j.id].gagne?.(j, p);
  const interet = interetDe(p);
  const victoires = p.stats.gagnees * BONUS_PAR_VICTOIRE;
  let bossBonus = 0;
  let voucher = null;
  if (b.boss) {
    p.stats.bossBattus += 1;
    bossBonus = p.stats.bossBattus * 2;
    voucher = offreVoucher(p);
  }
  p.gains = { recompense: b.recompense, interet, victoires, boss: bossBonus, voucher, avare: b.boss === 'avare' };
  const total = b.recompense + interet + victoires + bossBonus;
  p.argent += total;
  p.stats.gainTotal += total;
  p.stats.gagnees += 1;
  p.blindIdx += 1;
  if (p.blindIdx >= 3) {
    p.blindIdx = 0;
    p.ante += 1;
    if (p.mode === 'classique' && p.ante >= ANTES_CLASSIQUE) { p.phase = 'victoire'; return; }
  }
  p.phase = 'gagne';
}

function offreVoucher(p) {
  const palier2 = VOUCHERS.filter((v) => v.requiert && !p.vouchers.includes(v.id) && p.vouchers.includes(v.requiert));
  const palier1 = VOUCHERS.filter((v) => !v.requiert && !p.vouchers.includes(v.id));
  if (palier2.length && hasard(p) < 0.5) return choisir(p, palier2).id;
  if (palier1.length) return choisir(p, palier1).id;
  if (palier2.length) return choisir(p, palier2).id;
  return null;
}

/** Les poids de la boutique : les Jokers, puis les objets. */
function reserveBoutique(p) {
  const res = [];
  const mythique = aMythique(p);
  for (const j of LISTE_JOKERS) {
    const w = { commun: 12, rare: 8, legendaire: 4, mythique: 0.5, negatif: 3 }[j.rarete];
    if (j.rarete === 'mythique' && mythique) continue;
    if (j.rarete === 'negatif' && p.negatifs.length >= NEGATIFS_MAX) continue;
    res.push([w, { type: 'joker', id: j.id }]);
  }
  const objets = [
    [6, 'main-plus'], [6, 'poubelle'], [5, 'elixir'],
    [4, 'atelier-bonus'], [4, 'atelier-mult'], [3, 'atelier-verre'], [2, 'atelier-acier'], [2, 'atelier-pierre'],
    [4, 'sceau-or'], [3, 'sceau-rouge'], [3, 'sceau-bleu'], [2, 'sceau-violet'],
    [3, 'pack-joker'], [3, 'pack-carte'],
  ];
  objets.push([3, 'pack-celeste'], [3, 'pack-arcane']);
  if (!p.bob) objets.push([3, 'bob']);
  if (!aWild(p)) objets.push([2, 'roulette']);
  if (!p.saintLivre) objets.push([2, 'saint-livre']);
  for (const [w, id] of objets) res.push([w, { type: 'objet', id }]);
  // Les planètes et les tarots, comme dans un vrai jeu de cartes à collectionner.
  for (const m of Object.keys(PLANETES)) res.push([0.9, { type: 'planete', id: m }]);
  for (const t of TAROTS) res.push([0.4, { type: 'tarot', id: t.id }]);
  return res;
}

function tirer(p, reserve, n) {
  const out = [];
  const pris = new Set();
  for (let essai = 0; out.length < n && essai < 200; essai++) {
    const dispo = reserve.filter(([, e]) => !pris.has(`${e.type}:${e.id}`));
    const total = dispo.reduce((s, [w]) => s + w, 0);
    if (!total) break;
    let x = hasard(p) * total;
    for (const [w, e] of dispo) {
      x -= w;
      if (x <= 0) {
        pris.add(`${e.type}:${e.id}`);
        const item = { ...e, cote: Math.round((1000 * w) / total) / 10 };
        if (e.type === 'joker' && !estNegatif(e.id) && hasard(p) < 0.06) item.edition = hasard(p) < 0.5 ? 'holo' : 'poly';
        out.push(item);
        break;
      }
    }
  }
  return out;
}

export const PRIX_CONSO = 3;
export const prixBase = (item) => (item.type === 'joker' ? JOKERS[item.id].prix
  : item.type === 'planete' || item.type === 'tarot' ? PRIX_CONSO : OBJETS[item.id].prix);
export const prix = (p, item) => (item.gratuit ? 0 : Math.floor(prixBase(item) * (p.boutique?.prixMult || 1)));
export const prixVente = (j) => Math.floor(JOKERS[j.id].prix / 2);
export const coutRafraichir = (p) => (p.boutique?.gratuits > 0 || p.refreshGratuit ? 0 : p.remise ? 1 : 2);

/** Après le butin : on entre dans la boutique. */
export function allerBoutique(p) {
  if (p.phase !== 'gagne') return refus('phase');
  for (const j of tousJokers(p)) JOKERS[j.id].boutique?.(j, p);
  const items = tirer(p, reserveBoutique(p), PLACES_BOUTIQUE);
  // Les tags gagnés en passant des blinds prennent effet ici.
  const offerts = [];
  const restants = [];
  for (const t of p.tags || []) {
    const parRarete = (r) => LISTE_JOKERS.filter((j) => j.rarete === r).map((j) => j.id);
    if (t === 'rare') offerts.push({ type: 'joker', id: choisir(p, parRarete('rare')), gratuit: true, tag: t });
    else if (t === 'edition') offerts.push({ type: 'joker', id: choisir(p, [...parRarete('commun'), ...parRarete('rare')]), edition: 'poly', gratuit: true, tag: t });
    else if (t === 'celeste') offerts.push({ type: 'objet', id: 'pack-celeste', gratuit: true, tag: t });
    else if (t === 'arcane') offerts.push({ type: 'objet', id: 'pack-arcane', gratuit: true, tag: t });
    else if (t === 'coupon') for (const it of items) it.gratuit = true;
    else restants.push(t);
  }
  p.tags = restants;
  p.boutique = {
    items: [...offerts, ...items],
    voucher: p.gains?.voucher || null,
    prixMult: p.gains?.avare ? 2 : 1,
    gratuits: p.bob ? 3 : p.remise ? 1 : 0,
    pack: null,
    choix: null,
  };
  p.phase = 'boutique';
  return { ok: true };
}

const creerConso = (p, id) => { p.consommables.push({ uid: nouvelUid(p, 'o'), id }); };
const placeConso = (p) => p.consommables.length < CONSOMMABLES_MAX;

const ajouterJoker = (p, id, edition = null) => {
  const j = { uid: nouvelUid(p, 'j'), id, edition, e: {} };
  if (estNegatif(id)) { if (p.negatifs.length >= NEGATIFS_MAX) return null; p.negatifs.push(j); return j; }
  if (p.jokers.length >= p.maxJokers) return null;
  p.jokers.push(j);
  return j;
};
const placeLibre = (p, id) => (estNegatif(id) ? p.negatifs.length < NEGATIFS_MAX : p.jokers.length < p.maxJokers);

export function acheter(p, i) {
  const bq = p.boutique;
  if (p.phase !== 'boutique' || !bq || bq.pack || bq.choix) return refus('phase');
  const item = bq.items[i];
  if (!item) return refus('introuvable');
  const cout = prix(p, item);
  if (p.argent < cout) return refus('argent');

  if (item.type === 'joker') {
    if (!placeLibre(p, item.id)) return refus(estNegatif(item.id) ? 'negatifs' : 'jokers');
    p.argent -= cout;
    ajouterJoker(p, item.id, item.edition || null);
  } else if (item.type === 'planete' || item.type === 'tarot') {
    if (!placeConso(p)) return refus('consommables');
    p.argent -= cout;
    creerConso(p, `${item.type}:${item.id}`);
  } else {
    const o = OBJETS[item.id];
    if (o.consommable && p.consommables.length >= CONSOMMABLES_MAX) return refus('consommables');
    p.argent -= cout;
    switch (item.id) {
      case 'main-plus': p.bonusMains += 1; break;
      case 'poubelle': p.bonusDefausses += 1; break;
      case 'elixir': p.consommables.push({ uid: nouvelUid(p, 'o'), id: 'elixir' }); break;
      case 'bob': p.bob = true; p.maxJokers += 1; bq.gratuits = 3; break;
      case 'roulette': nouvelleCarte(p, 14, 'H', 'wild'); break;
      case 'saint-livre': p.saintLivre = true; break;
      case 'pack-joker': {
        const options = tirer(p, reserveBoutique(p).filter(([, e]) => e.type === 'joker'), 3);
        bq.pack = { type: 'joker', options };
        break;
      }
      case 'pack-celeste': {
        const mains = melanger(p, Object.keys(PLANETES)).slice(0, 3);
        bq.pack = { type: 'celeste', options: mains.map((m) => ({ type: 'planete', id: m })) };
        break;
      }
      case 'pack-arcane': {
        const ts = melanger(p, TAROTS.map((t) => t.id)).slice(0, 3);
        bq.pack = { type: 'arcane', options: ts.map((t) => ({ type: 'tarot', id: t })) };
        break;
      }
      case 'pack-carte': {
        const cibles = melanger(p, [...ameliorables(p)]).slice(0, 3);
        const sortes = melanger(p, Object.keys(AMELIORATIONS));
        bq.pack = { type: 'carte', options: cibles.map((uid, k) => ({ uid, enh: sortes[k % sortes.length] })) };
        break;
      }
      default:
        if (o.amelioration || o.sceau) {
          bq.choix = { id: item.id, amelioration: o.amelioration || null, sceau: o.sceau || null, reste: o.n };
        }
    }
  }
  bq.items.splice(i, 1);
  return { ok: true, item };
}

export function rafraichir(p) {
  const bq = p.boutique;
  if (p.phase !== 'boutique' || !bq || bq.pack || bq.choix) return refus('phase');
  if (bq.gratuits > 0) bq.gratuits -= 1;
  else {
    const cout = coutRafraichir(p);
    if (p.argent < cout) return refus('argent');
    p.argent -= cout;
  }
  bq.items = tirer(p, reserveBoutique(p), PLACES_BOUTIQUE);
  return { ok: true };
}

/** Vend un Joker normal, à tout moment (les Négatifs, eux, sont un choix définitif). */
export function vendre(p, i) {
  if (!['boutique', 'jeu', 'intro'].includes(p.phase) || p.boutique?.pack || p.boutique?.choix) return refus('phase');
  const j = p.jokers[i];
  if (!j) return refus('introuvable');
  p.jokers.splice(i, 1);
  p.argent += prixVente(j);
  return { ok: true };
}

/** Change l'ordre des Jokers (le Caméléon copie celui de droite). */
export function deplacerJoker(p, de, vers) {
  if (de < 0 || de >= p.jokers.length || vers < 0 || vers >= p.jokers.length) return refus('position');
  const [j] = p.jokers.splice(de, 1);
  p.jokers.splice(vers, 0, j);
  return { ok: true };
}

export function choisirPack(p, i) {
  const bq = p.boutique;
  if (!bq || !bq.pack) return refus('phase');
  const opt = bq.pack.options[i];
  if (!opt) return refus('introuvable');
  let revendu = false;
  if (bq.pack.type === 'joker') {
    if (!ajouterJoker(p, opt.id, opt.edition || null)) { p.argent += Math.floor(JOKERS[opt.id].prix / 2); revendu = true; }
  } else if (bq.pack.type === 'celeste') {
    p.niveaux[opt.id] += 1;
    p.stats.planetes += 1;
  } else if (bq.pack.type === 'arcane') {
    if (placeConso(p)) creerConso(p, `tarot:${opt.id}`);
    else { p.argent += 2; revendu = true; }
  } else {
    p.cartes[opt.uid].enh = opt.enh;
  }
  bq.pack = null;
  return { ok: true, revendu };
}

/** Un atelier ou un sceau : la carte du paquet qu'il touche. */
export function choisirCarte(p, uid) {
  const ch = p.boutique?.choix;
  if (!ch) return refus('phase');
  const c = p.cartes[uid];
  if (!c || c.special || !p.paquet.includes(uid)) return refus('carte');
  if (ch.amelioration) c.enh = ch.amelioration; else c.sceau = ch.sceau;
  ch.reste -= 1;
  if (ch.reste <= 0) p.boutique.choix = null;
  return { ok: true };
}

/** Laisse le hasard choisir : la carte d'un atelier, l'option d'un pack. */
export function auHasard(p) {
  const bq = p.boutique;
  if (!bq) return refus('phase');
  if (bq.pack) return choisirPack(p, entier(p, bq.pack.options.length));
  if (bq.choix) {
    const cibles = melanger(p, [...ameliorables(p)]);
    while (bq.choix && cibles.length) choisirCarte(p, cibles.pop());
    bq.choix = null;
    return { ok: true };
  }
  return refus('rien');
}

export function prendreVoucher(p) {
  const bq = p.boutique;
  if (!bq || !bq.voucher) return refus('introuvable');
  const id = bq.voucher;
  p.vouchers.push(id);
  if (id === 'grand-sac' || id === 'grand-sac+') p.bonusTailleMain += 1;
  if (id === 'bon-marchand') { p.remise = true; bq.gratuits = Math.max(bq.gratuits, 1); }
  if (id === 'bon-marchand+') p.refreshGratuit = true;
  if (id === 'interet' || id === 'interet+') p.interetNiveau += 1;
  if (id === 'poche' || id === 'poche+') p.maxJokers += 1;
  bq.voucher = null;
  return { ok: true, voucher: VOUCHER[id] };
}

/** On quitte la boutique : ce qui reste à choisir se tire au sort, puis la blind suivante. */
export function quitterBoutique(p) {
  if (p.phase !== 'boutique') return refus('phase');
  while (p.boutique.pack || p.boutique.choix) auHasard(p);
  p.boutique = null;
  preparerManche(p);
  return { ok: true };
}

/** Revend un consommable : 1 $. */
export function vendreConso(p, i) {
  if (!p.consommables[i]) return refus('introuvable');
  p.consommables.splice(i, 1);
  p.argent += 1;
  return { ok: true };
}

/** Retire une carte du jeu pour de bon (Le Pendu). */
function detruire(p, uid) {
  p.paquet = p.paquet.filter((u) => u !== uid);
  p.main = p.main.filter((u) => u !== uid);
  p.pioche = p.pioche.filter((u) => u !== uid);
  delete p.cartes[uid];
}

/**
 * Utilise un consommable. Une planète fait monter sa main ; l'Élixir, la main
 * la plus faible ; un tarot agit sur les cartes de la main désignées par
 * `cibles` (des uid), s'il en demande.
 */
export function utiliserConsommable(p, i, cibles = []) {
  const o = p.consommables[i];
  if (!o) return refus('introuvable');
  if (!['jeu', 'intro', 'boutique'].includes(p.phase)) return refus('phase');
  const info = infoConso(o.id);

  if (info.sorte === 'elixir') {
    const min = Math.min(...Object.values(p.niveaux));
    const m = choisir(p, MAINS.filter((x) => p.niveaux[x.id] === min));
    p.niveaux[m.id] += 1;
    p.consommables.splice(i, 1);
    return { ok: true, main: m.id, niveau: p.niveaux[m.id], message: `${MAIN[m.id].nom} passe niveau ${p.niveaux[m.id]} !` };
  }
  if (info.sorte === 'planete') {
    p.niveaux[info.main] += 1;
    p.consommables.splice(i, 1);
    p.stats.planetes += 1;
    p.dernierConso = o.id;
    return { ok: true, main: info.main, niveau: p.niveaux[info.main], message: `${info.nom} : ${MAIN[info.main].nom} passe niveau ${p.niveaux[info.main]} !` };
  }

  // Un tarot.
  const t = info.tarot;
  let cartes = [];
  if (t.cible) {
    if (p.phase !== 'jeu') return refus('tarot-jeu');
    const uids = [...new Set(cibles)].filter((u) => p.main.includes(u));
    cartes = uids.map((u) => p.cartes[u]);
    if (cartes.some((c) => !touchable(c))) return refus('tarot-special');
    if (cartes.length < t.cible[0] || cartes.length > t.cible[1]) return refus('tarot-cibles');
  }
  // Le tarot quitte l'inventaire avant d'agir : sa place se libère (La Papesse, L'Empereur).
  p.consommables.splice(i, 1);
  const x = {
    R: () => hasard(p),
    choisir: (l) => choisir(p, l),
    place: () => placeConso(p),
    creerConso: (id) => creerConso(p, id),
    creerJoker: () => {
      const pool = LISTE_JOKERS.filter((j) => !['mythique', 'negatif'].includes(j.rarete)).map((j) => j.id);
      return p.jokers.length < p.maxJokers ? ajouterJoker(p, choisir(p, pool)) : null;
    },
    detruire: (uid) => detruire(p, uid),
    valeurJokers: () => p.jokers.reduce((s2, j) => s2 + prixVente(j), 0),
  };
  const r = t.effet(p, cartes, x);
  if (r && r.refus) { p.consommables.splice(i, 0, o); return { ok: false, raison: 'tarot', message: r.refus }; }
  p.stats.tarots += 1;
  if (t.id !== 'mat') p.dernierConso = o.id;
  return { ok: true, message: `${t.nom} : ${r}`, cartes: cartes.map((c) => c.uid) };
}

/** Les succès de la run, vérifiés en fin de partie et en cours de route. */
export function succesAtteints(p) {
  const out = [];
  if (p.phase === 'victoire' && p.mode === 'classique') out.push('baltrou-champion');
  if (p.phase === 'victoire' && p.mode === 'classique' && p.stats.defausses === 0) out.push('baltrou-sans-pitie');
  if (p.mode === 'infini' && p.ante + 1 >= 10) out.push('baltrou-increvable');
  if (p.negatifs.length >= 3) out.push('baltrou-pacte-sombre');
  if (tousJokers(p).some((j) => JOKERS[j.id].rarete === 'mythique')) out.push('baltrou-elu');
  if (p.stats.meilleure >= 50000) out.push('baltrou-jackpot');
  if (p.phase === 'victoire' && p.mode === 'classique' && (p.mise || 0) >= MISES.length - 1) out.push('baltrou-mise-doree');
  if (Object.values(p.niveaux).some((n) => n >= 10)) out.push('baltrou-astronome');
  return out;
}
