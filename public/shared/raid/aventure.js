/**
 * RAID — l'aventure.
 *
 * Un héros seul entre dans le donjon. Il gravit cinq actes, choisit sa route
 * salle après salle, se trouve des compagnons, gagne des niveaux, de l'or et
 * de l'équipement — et répond aux questions que le donjon lui pose. Tout ce
 * qui compte tient dans un seul objet, sans fonction ni référence circulaire :
 * il se sauvegarde tel quel, générateur de hasard compris.
 *
 * Chaque salle ouvre une ÉTAPE (`av.etape`) que l'écran présente, et que les
 * fonctions de ce module referment : combat, récompense, don, événement,
 * marchand, feu de camp, trésor, rencontre.
 *
 * Module ISO : ni DOM ni Node.
 */

import { HEROS, PAR_ID } from './heros.js';
import {
  creerPersonnage, gagnerXp, statsDe, borner, DEPARTS, NIVEAU_MAX,
} from './personnages.js';
import { pieceAuHasard, valeurPiece, texteBonus } from './equipement.js';
import { genererCarte, accessibles, noeud, composer, ACTES, TYPES } from './carte.js';
import { OBJETS, creerBataille } from './bataille.js';

export const TAILLE_GROUPE = 4;
export const CHANCE_DEPART = 5;
export const CHANCE_MAX = 40;
export const NIVEAUX_DON = [3, 5, 7, 9];

/* ------------------------------------------------------------------ */
/* Hasard sauvegardable                                                */
/* ------------------------------------------------------------------ */

/** Un tirage mulberry32 dont l'état vit dans l'aventure : il se sauvegarde. */
export function rng(av) {
  return () => {
    av.alea = (av.alea + 0x6d2b79f5) >>> 0;
    let t = av.alea;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const entier = (av, n) => Math.floor(rng(av)() * n);
const piocher = (av, l) => l[entier(av, l.length)];
function melanger(av, l) {
  const r = rng(av);
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export function creerAventure({ heros = DEPARTS[0], seed = null } = {}) {
  if (!PAR_ID[heros]) throw new Error(`héros inconnu : ${heros}`);
  const av = {
    version: 2,
    alea: (seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0,
    acte: 1,
    carte: null,
    position: null,
    visites: [],
    groupe: [creerPersonnage(heros, 1)],
    or: 35,
    inventaire: { potion: 2, elixir: 1, phenix: 0 },
    sac: [],
    chance: CHANCE_DEPART,
    dons: [],
    benedictions: {},
    menaces: [],
    evenementsVus: [],
    etape: null,
    donsEnAttente: 0,
    bossVaincu: false,
    recrueOfferte: false,
    blessures: 0,
    reprise: null,
    termine: false,
    victoire: false,
    stats: { combats: 0, ors: 0, morts: 0 },
  };
  av.carte = genererCarte(rng(av), 1);
  sauvegarder(av);
  return av;
}

export const heros = (av) => av.groupe[0];
export const acteCourant = (av) => ACTES[av.acte - 1];
export const sallesAccessibles = (av) => accessibles(av.carte, av.position);

/** Bonus du groupe, dans le vocabulaire des statistiques. */
export const bonusDe = (av) => ({ ...av.benedictions });

/**
 * Seul contre tous : un tank ou un soigneur qui part sans personne frappe
 * plus fort tant qu'il reste seul — sans quoi il userait les monstres bien
 * après qu'eux l'ont usé.
 */
export const SOLO = { tank: 0.5, soigneur: 0.6, dps: 0 };
export const bonusSolo = (av) => (av.groupe.length === 1 ? SOLO[heros(av).role] || 0 : 0);

/** Les bonus qui valent en combat : ceux du groupe, plus la rage du solitaire. */
export function bonusCombat(av) {
  const b = bonusDe(av);
  const solo = bonusSolo(av);
  if (solo) b.degats = (b.degats || 0) + solo;
  return b;
}

/** Ce qu'il faut au moteur de combat. */
export function bataillePour(av) {
  if (!av.etape || av.etape.type !== 'combat') throw new Error('pas de combat en cours');
  return creerBataille({
    groupe: av.groupe,
    ennemis: JSON.parse(JSON.stringify(av.etape.ennemis)),
    bonus: bonusCombat(av),
    inventaire: av.inventaire,
    chance: av.chance,
    rng: rng(av),
  });
}

/* ------------------------------------------------------------------ */
/* La carte                                                            */
/* ------------------------------------------------------------------ */

/** Entre dans une salle voisine. */
export function entrer(av, id) {
  if (av.etape || av.termine) return { ok: false, raison: 'étape en cours' };
  const n = sallesAccessibles(av).find((x) => x.id === id);
  if (!n) return { ok: false, raison: 'inaccessible' };
  av.position = id;
  av.visites.push(id);

  switch (n.type) {
    case 'combat':
    case 'elite':
    case 'boss':
      av.etape = { type: 'combat', salle: n.type, ennemis: rencontre(av, n.type) };
      break;
    case 'evenement':
      ouvrirEvenement(av);
      break;
    case 'marchand':
      av.etape = { type: 'marchand', stock: stockMarchand(av) };
      break;
    case 'repos':
      av.etape = { type: 'repos' };
      sauvegarder(av);
      break;
    case 'tresor':
      av.etape = { type: 'tresor', or: 18 + 12 * av.acte + entier(av, 12), piece: piece(av, { plancher: 'rare' }) };
      break;
    case 'compagnon': {
      const offres = offresCompagnons(av);
      if (offres.length) av.etape = { type: 'compagnon', offres };
      else ouvrirEvenement(av);
      break;
    }
    default:
      return { ok: false, raison: 'salle inconnue' };
  }
  return { ok: true, etape: av.etape };
}

const piece = (av, o = {}) => pieceAuHasard(rng(av), av.acte, { chance: av.chance, ...o });

function rencontre(av, type) {
  const ennemis = composer(rng(av), av.acte, type, { taille: av.groupe.length });
  if (type === 'boss') {
    const m = menacesDuBoss(av);
    const b = ennemis[0];
    b.pvMax = Math.round(b.pvMax * (1 + m.pv) * (1 - blessuresBoss(av)));
    b.pv = b.pvMax;
    b.atk = Math.round(b.atk * (1 + m.atk));
    for (let k = 0; k < m.retire; k++) retirerTrait(b);
  }
  return ennemis;
}

/* ------------------------------------------------------------------ */
/* Combat et récompenses                                               */
/* ------------------------------------------------------------------ */

export const xpDe = (e, acte) =>
  Math.round((e.rang === 'boss' ? 50 : e.rang === 'elite' ? 26 : 10) * (1 + 0.35 * (acte - 1)));
export const orDe = (e, acte) =>
  Math.round((e.rang === 'boss' ? 60 : e.rang === 'elite' ? 26 : 9) * (1 + 0.3 * (acte - 1)));

/**
 * Le combat est fini. Une victoire rapporte de l'expérience à tout le groupe
 * — tombés compris, qui se relèvent à peine — de l'or, et parfois une pièce
 * d'équipement. Une défaite ramène au dernier feu de camp.
 */
export function conclureCombat(av, victoire) {
  if (!av.etape || av.etape.type !== 'combat') return { ok: false };
  const { ennemis, salle } = av.etape;
  av.stats.combats++;
  if (!victoire) {
    av.stats.morts++;
    if (salle === 'boss') av.blessures++;
    av.etape = { type: 'defaite' };
    return { ok: true, defaite: true };
  }

  const bonus = bonusDe(av);
  for (const p of av.groupe) {
    const s = statsDe(p, bonus);
    if (p.pv <= 0) p.pv = Math.max(1, Math.round(s.pvMax * 0.15));
    if (bonus.recup) p.pv = Math.min(s.pvMax, p.pv + Math.round(s.pvMax * bonus.recup));
  }

  const gainXp = ennemis.reduce((s, e) => s + xpDe(e, av.acte), 0);
  const or = ennemis.reduce((s, e) => s + orDe(e, av.acte), 0) + entier(av, 6);
  av.or += or;
  av.stats.ors += or;

  const niveauHeros = heros(av).niveau;
  const xp = av.groupe.map((p) => ({ id: p.id, nom: p.nom, gain: gainXp, ...gagnerXp(p, gainXp, bonus) }));
  const dons = NIVEAUX_DON.filter((n) => n > niveauHeros && n <= heros(av).niveau).length;
  av.donsEnAttente += dons;

  let pieces = [];
  if (salle === 'boss') pieces = [0, 1, 2].map(() => piece(av, { plancher: 'rare' }));
  else if (salle === 'elite') pieces = [0, 1].map(() => piece(av, { plancher: 'rare' }));
  else if (rng(av)() < 0.35) pieces = [piece(av)];

  av.etape = { type: 'recompense', salle, xp, or, pieces };
  return { ok: true, etape: av.etape };
}

/** Prend une pièce de la récompense (ou aucune), puis passe à la suite. */
export function prendreRecompense(av, uid = null) {
  if (!av.etape || av.etape.type !== 'recompense') return { ok: false };
  const p = uid && av.etape.pieces.find((x) => x.uid === uid);
  if (p) av.sac.push(p);
  if (av.etape.salle === 'boss') av.bossVaincu = true;
  av.etape = null;
  suite(av);
  return { ok: true, piece: p || null };
}

/**
 * Ce qui suit une étape refermée : les dons en attente d'abord. Après un
 * boss, un aventurier qui a vu le combat propose de se joindre au groupe
 * (jusqu'au troisième acte), puis l'acte suivant commence.
 */
function suite(av) {
  if (av.donsEnAttente > 0) {
    av.etape = { type: 'don', choix: proposerDons(av) };
    return;
  }
  if (!av.bossVaincu) return;
  if (!av.recrueOfferte && av.acte <= 3 && av.groupe.length < TAILLE_GROUPE) {
    av.recrueOfferte = true;
    const offres = offresCompagnons(av);
    if (offres.length) {
      av.etape = { type: 'compagnon', offres, apresBoss: true };
      return;
    }
  }
  av.bossVaincu = false;
  av.recrueOfferte = false;
  passerActe(av);
}

export function passerActe(av) {
  if (av.acte >= ACTES.length) {
    av.termine = true;
    av.victoire = true;
    av.etape = { type: 'victoire' };
    return;
  }
  av.acte++;
  av.carte = genererCarte(rng(av), av.acte);
  av.position = null;
  av.visites = [];
  av.blessures = 0;
  av.menaces = av.menaces.filter((m) => m.cible === 'final');
  // Entre deux actes, le groupe se refait une santé.
  const bonus = bonusDe(av);
  for (const p of av.groupe) {
    const s = statsDe(p, bonus);
    p.pv = Math.max(p.pv, Math.round(s.pvMax * 0.6));
    p.pm = s.pmMax;
  }
  sauvegarder(av);
}

/* ------------------------------------------------------------------ */
/* Sauvegarde et reprise                                               */
/* ------------------------------------------------------------------ */

/** Retient l'aventure telle qu'elle est : c'est là qu'on reviendra après une défaite. */
export function sauvegarder(av) {
  const { reprise, ...copie } = av;
  av.reprise = JSON.stringify(copie);
}

/**
 * Après une défaite, on revient au dernier feu de camp (ou au début de
 * l'acte). La moitié de l'expérience gagnée depuis reste acquise : on
 * apprend aussi en tombant, et on ne bute pas sans fin sur le même mur.
 */
export function reprendre(av) {
  if (!av.reprise) return { ok: false };
  const xp = Object.fromEntries(av.groupe.map((p) => [p.id, p.xp]));
  const { morts, combats } = av.stats;
  const { blessures } = av;
  const r = JSON.parse(av.reprise);
  for (const k of Object.keys(av)) if (k !== 'reprise') delete av[k];
  Object.assign(av, r);
  av.stats.morts = morts;
  av.stats.combats = combats;
  av.blessures = blessures;
  // Le sort ne rejoue pas la même partition.
  av.alea = (av.alea ^ Math.imul(morts + 1, 0x9e3779b9)) >>> 0;
  const avant = heros(av).niveau;
  const bonus = bonusDe(av);
  for (const p of av.groupe) {
    const gain = Math.floor(((xp[p.id] ?? p.xp) - p.xp) / 2);
    if (gain > 0) gagnerXp(p, gain, bonus);
  }
  av.donsEnAttente += NIVEAUX_DON.filter((n) => n > avant && n <= heros(av).niveau).length;
  if (!av.etape) suite(av);
  sauvegarder(av);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Dons                                                                */
/* ------------------------------------------------------------------ */

export const DONS = [
  { id: 'ferveur', nom: 'Ferveur', glyphe: '🔥', effet: { butin: { atk: 0.1 } } },
  { id: 'robustesse', nom: 'Robustesse', glyphe: '❤️', effet: { butin: { pv: 0.12 }, vie: 0.12 } },
  { id: 'rempart', nom: 'Rempart', glyphe: '🛡', effet: { butin: { def: 0.14 } } },
  { id: 'arcanes', nom: 'Arcanes profondes', glyphe: '🔷', effet: { butin: { pm: 5 } } },
  { id: 'benediction', nom: 'Bénédiction', glyphe: '✨', effet: { butin: { soin: 0.25, potion: 0.1 } } },
  { id: 'etoile', nom: 'Bonne étoile', glyphe: '🍀', effet: { chance: 8 } },
  { id: 'precision', nom: 'Précision mortelle', glyphe: '🎯', effet: { chance: 3, butin: { critique: 0.4 } } },
  { id: 'tueur', nom: 'Tueur de boss', glyphe: '👑', effet: { butin: { boss: 0.15 } } },
  { id: 'souffle', nom: 'Second souffle', glyphe: '🌬', effet: { butin: { recup: 0.1 } } },
  { id: 'herboriste', nom: 'Herboriste', glyphe: '🌿', effet: { objets: 2, butin: { potion: 0.1 } } },
];
export const DONS_PAR_ID = Object.fromEntries(DONS.map((d) => [d.id, d]));

export function proposerDons(av, combien = 3) {
  return melanger(av, DONS.filter((d) => !av.dons.includes(d.id))).slice(0, combien);
}

export function choisirDon(av, id) {
  if (!av.etape || av.etape.type !== 'don') return { ok: false };
  const d = av.etape.choix.find((x) => x.id === id);
  if (!d) return { ok: false, raison: 'inconnu' };
  av.dons.push(d.id);
  appliquer(av, d.effet, d.nom);
  av.donsEnAttente--;
  av.etape = null;
  suite(av);
  return { ok: true, don: d };
}

/* ------------------------------------------------------------------ */
/* Effets                                                              */
/* ------------------------------------------------------------------ */

/**
 * Le vocabulaire des effets, commun aux dons et aux événements :
 *   vie     part de sa vie maximale rendue à chacun (négatif : perdue, jamais mortelle)
 *   xp      expérience pour chacun
 *   chance  points de chance
 *   objets  potions ; `elixirs` élixirs ; `or` pièces d'or
 *   butin   bénédictions du groupe, en parts (atk, def, pv, soin…) ou en points (pm)
 *   boss    { cible: 'acte' | 'final', pv, atk, retire } sur un boss à venir
 *   piece   une pièce d'équipement
 */
export function appliquer(av, e, source = '') {
  for (const [k, v] of Object.entries(e.butin || {})) av.benedictions[k] = (av.benedictions[k] || 0) + v;
  if (e.chance) av.chance = Math.max(0, Math.min(CHANCE_MAX, av.chance + e.chance));
  if (e.objets) av.inventaire.potion = Math.max(0, av.inventaire.potion + e.objets);
  if (e.elixirs) av.inventaire.elixir = Math.max(0, av.inventaire.elixir + e.elixirs);
  if (e.or) av.or = Math.max(0, av.or + e.or);
  if (e.boss) {
    av.menaces.push({
      cible: e.boss.cible, acte: av.acte, pv: e.boss.pv || 0, atk: e.boss.atk || 0,
      retire: e.boss.retire ? 1 : 0, source,
    });
  }
  let obtenu = null;
  if (e.piece) { obtenu = piece(av); av.sac.push(obtenu); }
  const bonus = bonusDe(av);
  for (const p of av.groupe) {
    borner(p, bonus);
    if (e.vie && p.pv > 0) {
      const s = statsDe(p, bonus);
      p.pv = Math.max(1, Math.min(s.pvMax, p.pv + Math.round(s.pvMax * e.vie)));
    }
  }
  if (e.xp) {
    const avant = heros(av).niveau;
    for (const p of av.groupe) gagnerXp(p, e.xp, bonus);
    av.donsEnAttente += NIVEAUX_DON.filter((n) => n > avant && n <= heros(av).niveau).length;
  }
  return { piece: obtenu };
}

const pc = (v) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`;
const NOMS_BONUS = {
  atk: 'd’attaque', def: 'd’armure', pv: 'de vie max', degats: 'de dégâts', soin: 'aux soins',
  boss: 'de dégâts sur les boss', critique: 'de dégâts critiques', potion: 'aux potions',
  recup: 'de vie après chaque victoire',
};

/** Les effets en clair : c'est ce que le joueur lit avant de décider. */
export function texteEffet(e) {
  const out = [];
  if (e.vie) out.push(`${pc(e.vie)} de vie`);
  if (e.xp) out.push(`+${e.xp} XP`);
  if (e.chance) out.push(`${e.chance > 0 ? '+' : '−'}${Math.abs(e.chance)} chance`);
  if (e.or) out.push(`${e.or > 0 ? '+' : '−'}${Math.abs(e.or)} or`);
  if (e.objets) out.push(`${e.objets > 0 ? '+' : '−'}${Math.abs(e.objets)} potion${Math.abs(e.objets) > 1 ? 's' : ''}`);
  if (e.elixirs) out.push(`${e.elixirs > 0 ? '+' : '−'}${Math.abs(e.elixirs)} élixir${Math.abs(e.elixirs) > 1 ? 's' : ''}`);
  for (const [k, v] of Object.entries(e.butin || {})) {
    out.push(k === 'pm' ? `+${v} PM max` : `${pc(v)} ${NOMS_BONUS[k] || k}`);
  }
  if (e.piece) out.push('une pièce d’équipement');
  if (e.boss) {
    const qui = e.boss.cible === 'final' ? 'le Dragon' : 'le boss de l’acte';
    if (e.boss.pv) out.push(`${qui} : ${pc(e.boss.pv)} de vie`);
    if (e.boss.atk) out.push(`${qui} : ${pc(e.boss.atk)} d’attaque`);
    if (e.boss.retire) out.push(`${qui} perd une capacité`);
  }
  return out.join(' · ') || 'aucun effet';
}

export const texteDon = (d) => texteEffet(d.effet);

/* ------------------------------------------------------------------ */
/* Événements                                                          */
/* ------------------------------------------------------------------ */

export const reussiteDe = (base, chance = 0) => Math.min(0.95, base + chance / 100);

export const EVENEMENTS = [
  { id: 'autel', titre: 'L’autel oublié', glyphe: '🕯',
    texte: 'Un autel couvert de cendres. Les offrandes y sont encore fraîches — et elles ne viennent pas de vous.',
    choix: [
      { id: 'prier', label: 'Prier', effet: { vie: 0.3 }, dit: 'Une chaleur calme vous traverse.' },
      { id: 'profaner', label: 'Profaner l’autel', effet: { butin: { degats: 0.1 }, boss: { cible: 'final', pv: 0.1 } },
        dit: 'Le pouvoir de l’autel passe dans vos armes. Tout en haut, quelque chose se réveille en colère.' },
      { id: 'passer', label: 'Passer son chemin', effet: {}, dit: 'Mieux vaut ne pas s’en mêler.' },
    ] },
  { id: 'prisonnier', titre: 'Le prisonnier enchaîné', glyphe: '⛓',
    texte: 'Un éclaireur enchaîné au mur. Il jure connaître la faiblesse du maître de ces lieux.',
    choix: [
      { id: 'liberer', label: 'Le libérer', effet: { vie: -0.1, chance: 2, boss: { cible: 'acte', retire: true } },
        dit: 'Les gardes tombent, l’éclaireur parle. Le boss de l’acte perd l’un de ses atouts.' },
      { id: 'depouiller', label: 'Le dépouiller', effet: { or: 30, chance: -3 },
        dit: 'Sa bourse est lourde. Personne ne vous regarde, mais la chance, si.' },
      { id: 'ignorer', label: 'L’ignorer', effet: {}, dit: 'Ses cris vous suivent un moment.' },
    ] },
  { id: 'fontaine', titre: 'La fontaine trouble', glyphe: '⛲',
    texte: 'L’eau brille d’une lueur qui n’est pas celle des torches. Elle pourrait guérir. Ou pas.',
    choix: [
      { id: 'boire', label: 'Boire', risque: { base: 0.5, succes: { vie: 0.5, chance: 3 }, echec: { vie: -0.2 },
        ditSucces: 'L’eau est pure : le groupe se relève, plus confiant.',
        ditEchec: 'L’eau est croupie. Tout le monde la paie en crampes.' } },
      { id: 'fioles', label: 'Remplir les fioles', effet: { objets: 1 }, dit: 'Une potion de plus dans la sacoche.' },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'On ne boit pas ce qu’on ne connaît pas.' },
    ] },
  { id: 'coffre', titre: 'Le coffre piégé', glyphe: '🧰',
    texte: 'Un coffre ferré, et sur le couvercle, les traces de ceux qui ont essayé avant vous.',
    choix: [
      { id: 'forcer', label: 'Le forcer', risque: { base: 0.5, succes: { piece: true, or: 20 }, echec: { vie: -0.25 },
        ditSucces: 'Le mécanisme cède : de l’or, et une pièce d’équipement.',
        ditEchec: 'Des lames jaillissent. Le groupe saigne.' } },
      { id: 'laisser', label: 'Le laisser', effet: { chance: 1 }, dit: 'La prudence a sa récompense.' },
    ] },
  { id: 'marchand-ombre', titre: 'Le marchand de l’ombre', glyphe: '🧙',
    texte: '« Tout s’échange, ici. Même ce que vous n’êtes pas prêts à perdre. »',
    choix: [
      { id: 'potion', label: 'Une potion contre de la force', exige: { objets: 1 },
        effet: { objets: -1, butin: { atk: 0.07 } }, dit: 'Il empoche la fiole. Vos bras se font plus lourds de puissance.' },
      { id: 'sang', label: 'Du sang contre du mana', effet: { vie: -0.15, butin: { pm: 4 } },
        dit: 'Une entaille, une fiole de sang, et le mana coule plus vite.' },
      { id: 'refuser', label: 'Refuser', effet: {}, dit: 'Il sourit, comme s’il savait qu’on se reverrait.' },
    ] },
  { id: 'mentor', titre: 'Le vieux maître d’armes', glyphe: '🧓',
    texte: 'Un vétéran assis sur une caisse. « Je peux vous apprendre deux ou trois choses. Contre un peu d’or. »',
    choix: [
      { id: 'lecon', label: 'Prendre la leçon (40 or)', exige: { or: 40 }, effet: { or: -40, xp: 45 },
        dit: 'Trois heures plus tard, vous tenez vos armes autrement.' },
      { id: 'defier', label: 'Le défier', risque: { base: 0.45, succes: { xp: 60, chance: 2 }, echec: { vie: -0.2, xp: 15 },
        ditSucces: 'Vous le désarmez. Il rit, et vous apprend ses bottes secrètes.',
        ditEchec: 'Il vous met à terre en trois coups. Vous en retenez quand même quelque chose.' } },
      { id: 'saluer', label: 'Le saluer et repartir', effet: {}, dit: 'Il vous regarde partir, songeur.' },
    ] },
  { id: 'sanctuaire', titre: 'Le sanctuaire des anciens', glyphe: '🏛',
    texte: 'Les noms d’aventuriers tombés ici sont gravés sur les murs. L’endroit invite à s’arrêter.',
    choix: [
      { id: 'mediter', label: 'Étudier leurs erreurs', effet: { xp: 35 }, dit: 'Leurs erreurs deviennent vos leçons.' },
      { id: 'reposer', label: 'Se reposer', effet: { vie: 0.4 }, dit: 'Le groupe dort d’un sommeil sans rêves.' },
    ] },
  { id: 'nid', titre: 'L’antre du boss', glyphe: '👁',
    texte: 'Par une fissure, vous apercevez le maître de l’acte. Il ne vous a pas encore vus.',
    choix: [
      { id: 'espionner', label: 'L’espionner', risque: { base: 0.55,
        succes: { boss: { cible: 'acte', pv: -0.15 } }, echec: { boss: { cible: 'acte', atk: 0.1 } },
        ditSucces: 'Vous repérez sa vieille blessure : il commencera le combat affaibli.',
        ditEchec: 'Un caillou roule. Il vous a vus, et il s’y prépare.' } },
      { id: 'pieger', label: 'Piéger son antre', effet: { vie: -0.1, boss: { cible: 'acte', pv: -0.08 } },
        dit: 'Poser les pièges coûte, mais il y laissera des plumes.' },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'Chaque chose en son temps.' },
    ] },
  { id: 'pacte', titre: 'La voix du Dragon', glyphe: '🐉', actes: [3, 5],
    texte: 'Une voix résonne dans vos têtes : « Je peux vous rendre forts. Assez pour venir me voir. »',
    choix: [
      { id: 'accepter', label: 'Accepter le pacte', effet: { butin: { atk: 0.18 }, boss: { cible: 'final', atk: 0.2 } },
        dit: 'Une force brûlante vous envahit. Le Dragon aussi s’en nourrit.' },
      { id: 'refuser', label: 'Refuser', effet: { chance: 4 }, dit: 'La voix se tait. Vous vous sentez étrangement protégés.' },
    ] },
  { id: 'forgeron', titre: 'Le forgeron errant', glyphe: '⚒',
    texte: 'Un nain a posé son enclume au milieu du couloir. « Une retouche ? C’est offert. »',
    choix: [
      { id: 'aiguiser', label: 'Aiguiser les armes', effet: { butin: { degats: 0.06 } }, dit: 'Les lames chantent.' },
      { id: 'renforcer', label: 'Renforcer les armures', effet: { butin: { def: 0.1 } }, dit: 'Les plaques tiennent mieux.' },
    ] },
  { id: 'puits', titre: 'Le puits aux souhaits', glyphe: '🪙',
    texte: 'Un puits sans fond. On dit que ceux qui y sacrifient quelque chose de précieux sont exaucés.',
    choix: [
      { id: 'jeter', label: 'Y jeter 25 pièces d’or', exige: { or: 25 }, risque: { base: 0.5,
        succes: { or: -25, chance: 7, vie: 0.2 }, echec: { or: -25, chance: 2 },
        ditSucces: 'Un écho lumineux remonte : le souhait est exaucé.',
        ditEchec: 'Rien ne se passe. Presque rien.' } },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'Garder son or est aussi un souhait.' },
    ] },
  { id: 'rescapes', titre: 'Les rescapés', glyphe: '🧍',
    texte: 'Deux survivants d’une expédition précédente, blessés, cachés dans une alcôve.',
    choix: [
      { id: 'escorter', label: 'Les escorter', effet: { vie: -0.12, xp: 30, chance: 3 },
        dit: 'Les protéger coûte, mais leurs récits valent de l’or.' },
      { id: 'soigner', label: 'Leur donner une potion', exige: { objets: 1 }, effet: { objets: -1, or: 25, chance: 5 },
        dit: 'Ils vous donnent ce qu’ils ont. Leur gratitude vous porte chance.' },
      { id: 'laisser', label: 'Les laisser', effet: { chance: -2 }, dit: 'Le silence qui suit pèse un peu.' },
    ] },
];
export const EVENEMENTS_PAR_ID = Object.fromEntries(EVENEMENTS.map((e) => [e.id, e]));

function ouvrirEvenement(av) {
  let pot = EVENEMENTS.filter((ev) => !av.evenementsVus.includes(ev.id)
    && (!ev.actes || (av.acte >= ev.actes[0] && av.acte <= ev.actes[1])));
  if (!pot.length) {
    av.evenementsVus = [];
    pot = EVENEMENTS.filter((ev) => !ev.actes || (av.acte >= ev.actes[0] && av.acte <= ev.actes[1]));
  }
  const ev = piocher(av, pot);
  av.evenementsVus.push(ev.id);
  av.etape = { type: 'evenement', id: ev.id };
}

export const choixPossible = (av, c) => !c.exige
  || ((!c.exige.objets || av.inventaire.potion >= c.exige.objets) && (!c.exige.or || av.or >= c.exige.or));

/** L'événement en cours, tel que l'écran doit le présenter. */
export function evenementCourant(av) {
  const ev = av.etape && av.etape.type === 'evenement' && EVENEMENTS_PAR_ID[av.etape.id];
  if (!ev) return null;
  return {
    ...ev,
    choix: ev.choix.map((c) => ({
      ...c,
      possible: choixPossible(av, c),
      chance: c.risque ? reussiteDe(c.risque.base, av.chance) : null,
      annonce: c.risque
        ? `réussite : ${texteEffet(c.risque.succes)} · échec : ${texteEffet(c.risque.echec)}`
        : texteEffet(c.effet),
    })),
  };
}

export function choisirEvenement(av, choixId) {
  const ev = av.etape && av.etape.type === 'evenement' && EVENEMENTS_PAR_ID[av.etape.id];
  const c = ev && ev.choix.find((x) => x.id === choixId);
  if (!c) return { ok: false, raison: 'inconnu' };
  if (!choixPossible(av, c)) return { ok: false, raison: 'exige' };
  let effet = c.effet || {};
  let dit = c.dit;
  let reussi = null;
  if (c.risque) {
    reussi = rng(av)() < reussiteDe(c.risque.base, av.chance);
    effet = reussi ? c.risque.succes : c.risque.echec;
    dit = reussi ? c.risque.ditSucces : c.risque.ditEchec;
  }
  const { piece: obtenu } = appliquer(av, effet, ev.titre);
  av.etape = { type: 'resultat', titre: ev.titre, glyphe: ev.glyphe, dit, effet: texteEffet(effet), reussi, piece: obtenu };
  return { ok: true, etape: av.etape };
}

/** Referme une étape sans décision (résultat lu, marchand quitté, rencontre déclinée). */
export function terminerEtape(av) {
  if (!av.etape || !['resultat', 'marchand', 'compagnon'].includes(av.etape.type)) return { ok: false };
  av.etape = null;
  suite(av);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Menaces                                                             */
/* ------------------------------------------------------------------ */

export function menacesDuBoss(av) {
  const finale = av.acte === ACTES.length;
  const l = av.menaces.filter((m) => (m.cible === 'acte' && m.acte === av.acte) || (m.cible === 'final' && finale));
  return {
    pv: l.reduce((s, m) => s + m.pv, 0),
    atk: l.reduce((s, m) => s + m.atk, 0),
    retire: l.reduce((s, m) => s + m.retire, 0),
    sources: l,
  };
}

/**
 * Chaque défaite contre le boss de l'acte le laisse blessé pour la suite :
 * on ne bute jamais sans fin sur le même mur.
 */
export const blessuresBoss = (av) => Math.min(0.4, 0.1 * (av.blessures || 0));

const ORDRE_TRAITS = ['enrage', 'fureur', 'frenesie', 'drain', 'poison', 'epines', 'carapace'];
function retirerTrait(e) {
  const t = ORDRE_TRAITS.find((x) => e.traits.includes(x)) || e.traits[0];
  if (t) e.traits = e.traits.filter((x) => x !== t);
}

/* ------------------------------------------------------------------ */
/* Marchand, feu de camp, trésor, rencontre                            */
/* ------------------------------------------------------------------ */

export const PRIX_OBJETS = (acte) => ({ potion: 18 + 5 * acte, elixir: 16 + 4 * acte, phenix: 50 + 10 * acte });

function stockMarchand(av) {
  return [0, 1, 2, 3].map(() => piece(av));
}

/** Acheter : une pièce du stock (par uid) ou un objet (par son nom). */
export function acheter(av, quoi) {
  if (!av.etape || av.etape.type !== 'marchand') return { ok: false };
  if (OBJETS[quoi]) {
    const prix = PRIX_OBJETS(av.acte)[quoi];
    if (av.or < prix) return { ok: false, raison: 'or' };
    av.or -= prix;
    av.inventaire[quoi]++;
    return { ok: true };
  }
  const i = av.etape.stock.findIndex((x) => x.uid === quoi);
  if (i < 0) return { ok: false, raison: 'introuvable' };
  const it = av.etape.stock[i];
  if (av.or < it.prix) return { ok: false, raison: 'or' };
  av.or -= it.prix;
  av.sac.push(it);
  av.etape.stock.splice(i, 1);
  return { ok: true, piece: it };
}

export const prixRevente = (it) => Math.round(it.prix * 0.4);

/** Vendre une pièce du sac, chez le marchand seulement. */
export function vendre(av, uid) {
  if (!av.etape || av.etape.type !== 'marchand') return { ok: false };
  const i = av.sac.findIndex((x) => x.uid === uid);
  if (i < 0) return { ok: false };
  av.or += prixRevente(av.sac[i]);
  av.sac.splice(i, 1);
  return { ok: true };
}

/**
 * Le feu de camp : se reposer (vie, mana, et les tombés se relèvent), ou
 * s'entraîner (de l'expérience pour tout le monde).
 */
export function faireRepos(av, choix) {
  if (!av.etape || av.etape.type !== 'repos') return { ok: false };
  const bonus = bonusDe(av);
  let texte;
  if (choix === 'entrainement') {
    const gain = 20 + 12 * av.acte;
    appliquer(av, { xp: gain });
    texte = `Le groupe s’entraîne : +${gain} XP pour chacun.`;
  } else {
    for (const p of av.groupe) {
      const s = statsDe(p, bonus);
      p.pv = Math.min(s.pvMax, Math.max(p.pv, 0) + Math.round(s.pvMax * 0.45));
      p.pm = s.pmMax;
    }
    texte = 'Le groupe se repose : +45 % de vie, mana au maximum, les tombés se relèvent.';
  }
  av.etape = { type: 'resultat', titre: 'Feu de camp', glyphe: '🔥', dit: texte, effet: '', reussi: null };
  return { ok: true };
}

export function prendreTresor(av) {
  if (!av.etape || av.etape.type !== 'tresor') return { ok: false };
  const { or, piece: p } = av.etape;
  av.or += or;
  av.sac.push(p);
  av.etape = { type: 'resultat', titre: 'Trésor', glyphe: '📦', dit: `Le coffre s’ouvre : ${or} pièces d’or.`,
    effet: '', reussi: null, piece: p };
  return { ok: true };
}

function offresCompagnons(av) {
  if (av.groupe.length >= TAILLE_GROUPE) return [];
  const dedans = av.groupe.map((p) => p.id);
  const roles = av.groupe.map((p) => p.role);
  // Deux rôles différents, ceux qui manquent d'abord — et un groupe sans
  // personne pour frapper se voit proposer quelqu'un qui frappe.
  const ordre = ['dps', 'soigneur', 'tank'];
  ordre.sort((a, b) => roles.includes(a) - roles.includes(b));
  const libres = melanger(av, HEROS.filter((h) => !dedans.includes(h.id)));
  const offres = [];
  for (const r of ordre) {
    const h = libres.find((x) => x.role === r);
    if (h) offres.push(h.id);
    if (offres.length === 2) break;
  }
  return offres;
}

/** Niveau d'arrivée d'un compagnon : un de moins que le héros. */
export const niveauRecrue = (av) => Math.max(1, heros(av).niveau - 1);

export function recruter(av, id) {
  if (!av.etape || av.etape.type !== 'compagnon' || !av.etape.offres.includes(id)) return { ok: false };
  if (av.groupe.length >= TAILLE_GROUPE) return { ok: false, raison: 'complet' };
  const p = creerPersonnage(id, niveauRecrue(av));
  av.groupe.push(p);
  av.etape = { type: 'resultat', titre: 'Un compagnon', glyphe: '🤝',
    dit: `${p.nom}, ${p.titre.toLowerCase()}, rejoint le groupe au niveau ${p.niveau}.`, effet: '', reussi: null };
  return { ok: true, perso: p };
}

/* ------------------------------------------------------------------ */
/* Équipement et objets hors combat                                    */
/* ------------------------------------------------------------------ */

export function equiper(av, idx, uid) {
  const p = av.groupe[idx];
  const i = av.sac.findIndex((x) => x.uid === uid);
  if (!p || i < 0) return { ok: false };
  const it = av.sac[i];
  const ancien = p.equip[it.emplacement];
  av.sac.splice(i, 1);
  if (ancien) av.sac.push(ancien);
  p.equip[it.emplacement] = it;
  borner(p, bonusDe(av));
  return { ok: true };
}

export function desequiper(av, idx, emplacement) {
  const p = av.groupe[idx];
  if (!p || !p.equip[emplacement]) return { ok: false };
  av.sac.push(p.equip[emplacement]);
  p.equip[emplacement] = null;
  borner(p, bonusDe(av));
  return { ok: true };
}

/** Potion, élixir ou plume de phénix, sur la carte. */
export function utiliser(av, objet, idx) {
  const p = av.groupe[idx];
  if (!p || !OBJETS[objet] || av.inventaire[objet] <= 0) return { ok: false };
  const s = statsDe(p, bonusDe(av));
  if (objet === 'phenix') {
    if (p.pv > 0) return { ok: false, raison: 'debout' };
    p.pv = Math.round(s.pvMax * 0.4);
  } else if (p.pv <= 0) {
    return { ok: false, raison: 'tombe' };
  } else if (objet === 'potion') {
    if (p.pv >= s.pvMax) return { ok: false, raison: 'plein' };
    p.pv = Math.min(s.pvMax, p.pv + Math.round(s.pvMax * (0.4 + (av.benedictions.potion || 0))));
  } else {
    if (p.pm >= s.pmMax) return { ok: false, raison: 'plein' };
    p.pm = Math.min(s.pmMax, p.pm + Math.round(s.pmMax * 0.5));
  }
  av.inventaire[objet]--;
  return { ok: true };
}

/** Le meilleur porteur d'une pièce : celui qu'elle améliore le plus. */
export function conseilEquipement(av, it) {
  let meilleur = null;
  av.groupe.forEach((p, idx) => {
    const gain = valeurPiece(it) - valeurPiece(p.equip[it.emplacement]);
    if (!meilleur || gain > meilleur.gain) meilleur = { idx, gain };
  });
  return meilleur && meilleur.gain > 0 ? meilleur.idx : null;
}

export { TYPES, ACTES, noeud, NIVEAU_MAX, texteBonus, OBJETS };
