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

import { HEROS, PAR_ID, LEGENDES } from './heros.js';
import {
  creerPersonnage, gagnerXp, statsDe, borner, DEPARTS, NIVEAU_MAX, SEUILS_XP,
} from './personnages.js';
import {
  pieceAuHasard, valeurPiece, texteBonus, forgerTrophee, TROPHEES, CHANCE_TROPHEE_ELITE, CHANCE_TROPHEE_BOSS,
} from './equipement.js';
import { genererCarte, accessibles, noeud, composer, ACTES, TYPES, RANGEES } from './carte.js';
import { OBJETS, creerBataille } from './bataille.js';
import { EVEILS, texteEveil } from './eveils.js';
import {
  RELIQUES, RELIQUES_PAR_ID, bonusReliques, QUETES, QUETES_PAR_ID, instancierQuete, texteQuete,
} from './reliques.js';

export const TAILLE_GROUPE = 4;
export const CHANCE_DEPART = 5;
export const CHANCE_MAX = 40;
export const NIVEAUX_DON = [3, 5, 7, 9, 12, 15, 18];

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

/**
 * Les difficultés. `pv` et `atk` multiplient la vie et l'attaque de tous les
 * ennemis ; en Hardcore, ils frappent un rien plus fort qu'en Difficile, et
 * surtout une défaite met fin à l'aventure : on repart de zéro.
 */
export const DIFFICULTES = {
  facile: { nom: 'Facile', glyphe: '🌱', pv: 0.8, atk: 0.8, potions: 4 },
  normal: { nom: 'Normal', glyphe: '⚔', pv: 1, atk: 1, potions: 2 },
  difficile: { nom: 'Difficile', glyphe: '🔥', pv: 1.2, atk: 1.2, potions: 2 },
  hardcore: { nom: 'Hardcore', glyphe: '💀', pv: 1.2, atk: 1.26, potions: 2, mortDefinitive: true },
};
export const difficulteDe = (av) => DIFFICULTES[av.difficulte] || DIFFICULTES.normal;

/** Ce qu'une difficulté change, en clair. */
export function texteDifficulte(cle) {
  const d = DIFFICULTES[cle];
  const p = (v) => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`;
  const out = [];
  if (d.pv === 1 && d.atk === 1) out.push('Ennemis au réglage de référence');
  else out.push(`Ennemis : ${p(d.pv)} de vie, ${p(d.atk)} d’attaque`);
  out.push(`${d.potions} potions au départ`);
  out.push(d.mortDefinitive
    ? 'une seule vie : à la première défaite, l’aventure est perdue et repart de zéro'
    : 'une défaite ramène au dernier feu de camp');
  return `${out.join(' · ')}.`;
}

/** Chance de tomber dans une embuscade en rôdant dans une zone. */
export const CHANCE_EMBUSCADE = 0.22;
/**
 * Le marchand ambulant : il peut surgir après une victoire, ou se laisser
 * croiser quand on rôde. L'or trouve ainsi toujours à se dépenser.
 */
export const CHANCE_COLPORTEUR = 0.15;
export const CHANCE_COLPORTEUR_ZONE = 0.12;
/**
 * Les héros légendaires : à partir de ce chapitre, une rencontre a une chance
 * d'en amener un. Un groupe complet peut l'accueillir à la place d'un
 * compagnon.
 */
/**
 * Le dernier boss frappe moins fort que sa fiche : au dixième chapitre la
 * courbe est déjà raide, et le combat doit durer, pas trancher.
 */
export const DRAGON = { pv: 1, atk: 0.74 };
/** Niveau du héros quand on reprend l'histoire à un chapitre déjà débloqué. */
export const niveauDuChapitre = (chapitre) => Math.min(NIVEAU_MAX, 2 * chapitre - 1);
export const ACTE_LEGENDES = 3;
export const CHANCE_LEGENDE = 0.4;

/**
 * @param {object} o
 * @param {number} [o.chapitre]  chapitre de départ. Au-delà du premier, le
 *   héros arrive au niveau du chapitre, avec de l'or, du matériel, des
 *   reliques — et des compagnons à choisir avant de se mettre en route.
 */
/**
 * Le format de la sauvegarde. Il monte à chaque nouveauté qui demande quelque
 * chose à une partie déjà commencée ; `mettreAJour` s'occupe du rattrapage.
 */
export const FORMAT = 4;

export function creerAventure({ heros = DEPARTS[0], seed = null, difficulte = 'normal', chapitre = 1 } = {}) {
  if (!PAR_ID[heros]) throw new Error(`héros inconnu : ${heros}`);
  if (!DIFFICULTES[difficulte]) throw new Error(`difficulté inconnue : ${difficulte}`);
  if (!(Number.isInteger(chapitre) && chapitre >= 1 && chapitre <= ACTES.length)) throw new Error(`chapitre inconnu : ${chapitre}`);
  const av = {
    version: 2,
    format: FORMAT,
    difficulte,
    alea: (seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0,
    acte: chapitre,
    carte: null,
    position: null,
    visites: [],
    groupe: [creerPersonnage(heros, niveauDuChapitre(chapitre))],
    or: 35 + 70 * (chapitre - 1),
    inventaire: { potion: DIFFICULTES[difficulte].potions, elixir: 1, phenix: 0 },
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
    balade: null,
    reliques: [],
    bossVus: [],
    quete: null,
    offresQuetes: [],
    absents: [],
    departActe: 0,
    recruesDues: 0,
    cines: [],
    reprise: null,
    termine: false,
    victoire: false,
    stats: { combats: 0, ors: 0, morts: 0 },
  };
  av.carte = genererCarte(rng(av), chapitre);
  av.offresQuetes = tirerQuetes(av);
  if (chapitre > 1) equiperPourChapitre(av, chapitre);
  sauvegarder(av);
  return av;
}

/**
 * On reprend l'histoire en cours de route : de quoi tenir le chapitre. Des
 * potions, quelques pièces rares, des reliques, les dons que le niveau du
 * héros a déjà ouverts, et jusqu'à trois compagnons à recruter d'entrée.
 */
function equiperPourChapitre(av, chapitre) {
  av.inventaire.potion += 2;
  av.inventaire.elixir += 1;
  av.inventaire.phenix += 1;
  for (let i = 0; i < 6; i++) av.sac.push(piece(av, { acte: chapitre - 1, plancher: 'rare' }));
  for (let i = 0; i < Math.floor((chapitre - 1) / 2); i++) gagnerRelique(av);
  av.donsEnAttente = NIVEAUX_DON.filter((n) => n <= heros(av).niveau).length;
  av.recruesDues = Math.min(TAILLE_GROUPE - 1, chapitre - 1);
  suite(av);
}

export const heros = (av) => av.groupe[0];
export const acteCourant = (av) => ACTES[av.acte - 1];
export const sallesAccessibles = (av) => accessibles(av.carte, av.position);

/** Bonus du groupe, dans le vocabulaire des statistiques. */
export function bonusDe(av) {
  const b = { ...av.benedictions };
  for (const [k, v] of Object.entries(bonusReliques(av.reliques))) b[k] = (b[k] || 0) + v;
  return b;
}

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
  for (const a of av.absents || []) a.reste--;

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
      av.etape = { type: 'marchand', stock: stockMarchand(av), relique: vitrine(av) };
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

const piece = (av, { acte = av.acte, ...o } = {}) => pieceAuHasard(rng(av), acte, { chance: av.chance, ...o });

/** La difficulté pèse sur chaque ennemi, quel qu'il soit. */
function durcir(av, ennemis) {
  const d = difficulteDe(av);
  for (const e of ennemis) {
    e.pvMax = Math.max(1, Math.round(e.pvMax * d.pv));
    e.pv = e.pvMax;
    e.atk = Math.max(1, Math.round(e.atk * d.atk));
  }
  return ennemis;
}

function rencontre(av, type) {
  const ennemis = composer(rng(av), av.acte, type, {
    taille: av.groupe.length, vus: type === 'boss' ? (av.bossVus || []) : [],
  });
  if (type === 'boss') {
    const m = menacesDuBoss(av);
    const b = ennemis[0];
    const dernier = av.acte === ACTES.length;
    b.pvMax = Math.round(b.pvMax * (1 + m.pv) * (1 - blessuresBoss(av)) * (dernier ? DRAGON.pv : 1));
    b.pv = b.pvMax;
    b.atk = Math.round(b.atk * (1 + m.atk) * (dernier ? DRAGON.atk : 1));
    for (let k = 0; k < m.retire; k++) retirerTrait(b);
  }
  return durcir(av, ennemis);
}

/* ------------------------------------------------------------------ */
/* Rôder : retourner dans une zone pour s'aguerrir                     */
/* ------------------------------------------------------------------ */

/**
 * Depuis la carte, on peut retourner rôder dans une zone déjà ouverte (l'acte
 * en cours ou un chapitre passé) pour y chasser : de l'expérience et de l'or au
 * tarif de la zone. Mais chaque chasse a une chance de tourner à l'embuscade
 * — des monstres de l'acte en cours, menés par une élite, qui frappent les
 * premiers. Le combat s'engage alors d'office.
 */
export function roder(av) {
  if (av.etape || av.termine) return { ok: false };
  av.balade = av.acte;
  av.etape = { type: 'balade', acte: av.acte };
  return { ok: true };
}

export function choisirZone(av, acte) {
  if (!av.etape || av.etape.type !== 'balade') return { ok: false };
  if (!(acte >= 1 && acte <= av.acte)) return { ok: false, raison: 'zone fermée' };
  av.etape.acte = acte;
  av.balade = acte;
  return { ok: true };
}

/** Cherche des monstres dans la zone choisie. Renvoie `embuscade` si le sort en décide. */
export function chasser(av) {
  if (!av.etape || av.etape.type !== 'balade') return { ok: false };
  const zone = av.etape.acte;
  const taille = av.groupe.length;
  const sort = rng(av)();
  const embuscade = sort < CHANCE_EMBUSCADE;
  if (!embuscade && sort < CHANCE_EMBUSCADE + CHANCE_COLPORTEUR_ZONE) {
    av.etape = { type: 'marchand', ambulant: true, stock: stockMarchand(av, 3) };
    return { ok: true, marchand: true };
  }
  let ennemis;
  if (embuscade) {
    ennemis = composer(rng(av), av.acte, 'elite', { taille });
    if (taille >= 2) ennemis.push(...composer(rng(av), av.acte, 'combat', { taille }).slice(0, 1));
    for (const e of ennemis) e.vit += 6;      // ils frappent les premiers
  } else {
    ennemis = composer(rng(av), zone, 'combat', { taille });
  }
  av.etape = {
    type: 'combat', salle: embuscade ? 'embuscade' : 'chasse',
    acte: embuscade ? av.acte : zone, ennemis: durcir(av, ennemis),
  };
  return { ok: true, embuscade };
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
  const acte = av.etape.acte || av.acte;
  av.stats.combats++;
  if (!victoire) {
    av.stats.morts++;
    if (salle === 'boss') av.blessures++;
    // Hardcore : une seule vie. L'aventure s'arrête ici.
    const definitive = !!difficulteDe(av).mortDefinitive;
    if (definitive) av.termine = true;
    av.etape = { type: 'defaite', definitive };
    return { ok: true, defaite: true, definitive };
  }

  // Le dernier boss ne lâche rien : il n'y a plus rien à préparer. On passe
  // droit à la fin de l'aventure.
  if (salle === 'boss' && av.acte === ACTES.length) {
    av.etape = null;
    passerActe(av);
    return { ok: true, etape: av.etape, fin: true };
  }

  const bonus = bonusDe(av);
  const intact = av.groupe.every((p) => p.pv > 0);
  for (const p of av.groupe) {
    const s = statsDe(p, bonus);
    if (p.pv <= 0) p.pv = Math.max(1, Math.round(s.pvMax * 0.15));
    if (bonus.recup) p.pv = Math.min(s.pvMax, p.pv + Math.round(s.pvMax * bonus.recup));
  }

  const gainXp = Math.round(ennemis.reduce((s, e) => s + xpDe(e, acte), 0) * (1 + (bonus.xpPlus || 0)));
  const or = Math.round((ennemis.reduce((s, e) => s + orDe(e, acte), 0) + entier(av, 6)) * (1 + (bonus.orPlus || 0)));
  av.or += or;
  av.stats.ors += or;

  const niveauHeros = heros(av).niveau;
  const xp = av.groupe.map((p) => ({ id: p.id, nom: p.nom, gain: gainXp, ...gagnerXp(p, gainXp, bonus) }));
  const dons = NIVEAUX_DON.filter((n) => n > niveauHeros && n <= heros(av).niveau).length;
  av.donsEnAttente += dons;

  let pieces = [];
  if (salle === 'boss') pieces = [0, 1, 2].map(() => piece(av, { plancher: 'rare', faveur: 3 }));
  else if (salle === 'elite') pieces = [0, 1].map(() => piece(av, { plancher: 'rare', faveur: 1 }));
  else if (salle === 'embuscade') pieces = [piece(av, { plancher: 'rare', faveur: 1 })];
  else if (rng(av)() < 0.35) pieces = [piece(av, { acte })];

  // Un boss lâche toujours une relique, tant qu'il en reste à trouver.
  let relique = null;
  if (salle === 'boss') {
    const b = ennemis.find((e) => e.rang === 'boss');
    if (b) av.bossVus = [...(av.bossVus || []), b.modeleId];
    relique = gagnerRelique(av);
  }

  // Les trophées : jamais garantis. Quand le sort en décide, l'un d'eux prend
  // la place d'une des pièces à choisir. Le boss lâche le sien, quatre fois sur
  // dix. Une élite (dans sa salle ou en embuscade) le fait plus rarement :
  // le sien, ou celui d'un boss que le groupe a déjà vaincu.
  const chef = ennemis.find((e) => e.rang === 'boss') || ennemis.find((e) => e.rang === 'elite');
  if (chef && pieces.length) {
    const deBoss = chef.rang === 'boss';
    if (rng(av)() < (deBoss ? CHANCE_TROPHEE_BOSS : CHANCE_TROPHEE_ELITE)) {
      const vaincus = (av.bossVus || []).filter((id) => TROPHEES[id]);
      const qui = deBoss || !vaincus.length || rng(av)() < 0.5 ? chef.modeleId : piocher(av, vaincus);
      const t = forgerTrophee(qui, acte, rng(av));
      if (t) pieces[0] = t;
    }
  }

  avancerQuete(av, 'monstres', ennemis.length);
  avancerQuete(av, 'elites', ennemis.filter((e) => e.rang === 'elite').length);
  if (intact) avancerQuete(av, 'intacts', 1);
  if (salle === 'chasse' || salle === 'embuscade') avancerQuete(av, 'chasses', 1);

  av.etape = { type: 'recompense', salle, xp, or, pieces, relique: relique ? relique.id : null };
  return { ok: true, etape: av.etape };
}

/** Prend une pièce de la récompense (ou aucune), puis passe à la suite. */
export function prendreRecompense(av, uid = null) {
  if (!av.etape || av.etape.type !== 'recompense') return { ok: false };
  const p = uid && av.etape.pieces.find((x) => x.uid === uid);
  if (p) av.sac.push(p);
  if (av.etape.salle === 'boss') av.bossVaincu = true;
  else if (rng(av)() < CHANCE_COLPORTEUR) av.colporteur = true;
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
  // On reprend l'histoire à un chapitre avancé : les compagnons se présentent un à un.
  if (av.recruesDues > 0) {
    av.recruesDues--;
    const offres = offresCompagnons(av);
    if (offres.length) {
      av.etape = { type: 'compagnon', offres, depart: true };
      return;
    }
  }
  // Un compagnon parti en voyage revient — ou fait savoir qu'il ne reviendra pas.
  if ((av.absents || []).some((a) => a.reste <= 0)) {
    retourAbsent(av);
    return;
  }
  // Une quête vient d'être accomplie : sa récompense.
  if (av.quete && av.quete.progres >= av.quete.but) {
    recompenserQuete(av);
    return;
  }
  // Un marchand ambulant passait par là.
  if (av.colporteur) {
    av.colporteur = false;
    av.etape = { type: 'marchand', ambulant: true, stock: stockMarchand(av, 3) };
    return;
  }
  // On rôdait : retour à la zone, pour décider de continuer ou de repartir.
  if (av.balade) {
    av.etape = { type: 'balade', acte: av.balade };
    return;
  }
  if (!av.bossVaincu) return;
  if (!av.recrueOfferte && av.acte <= 3 && effectif(av) < TAILLE_GROUPE) {
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
  av.quete = null;
  av.offresQuetes = tirerQuetes(av);
  av.menaces = av.menaces.filter((m) => m.cible === 'final');
  // Entre deux chapitres, le groupe se refait une santé.
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
  if (!av.reprise || av.termine) return { ok: false };
  const xp = Object.fromEntries(av.groupe.map((p) => [p.id, p.xp]));
  const { morts, combats } = av.stats;
  const { blessures } = av;
  const r = JSON.parse(av.reprise);
  for (const k of Object.keys(av)) if (k !== 'reprise') delete av[k];
  Object.assign(av, r);
  // Le feu de camp a pu être allumé avant une mise à jour du jeu.
  mettreAJour(av);
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
/* Mise à jour d'une partie en cours                                   */
/* ------------------------------------------------------------------ */

/**
 * Met une partie commencée avec une version plus ancienne du jeu au niveau de
 * la version courante, sans rien lui retirer : on ne recommence pas une
 * aventure pour profiter d'une nouveauté.
 *
 * Tout ce qui manque est ajouté avec sa valeur de départ ; ce qui se décide
 * d'ordinaire à la création d'un chapitre (quêtes, boutique visible) est
 * rattrapé pour le chapitre en cours. Renvoie la liste, en clair, de ce qui a
 * été rattrapé — vide si la partie était déjà à jour. Sans effet la deuxième
 * fois.
 */
export function mettreAJour(av) {
  const fait = [];
  if (!av || av.format === FORMAT) return fait;

  // 1. Les champs apparus au fil des versions.
  const defauts = {
    difficulte: 'normal', reliques: [], bossVus: [], absents: [], recruesDues: 0, departActe: 0,
    balade: null, quete: null, blessures: 0, donsEnAttente: 0, dons: [], menaces: [], evenementsVus: [],
    benedictions: {}, sac: [], visites: [], bossVaincu: false, recrueOfferte: false,
  };
  for (const [k, v] of Object.entries(defauts)) if (av[k] === undefined) av[k] = Array.isArray(v) ? [] : (v && typeof v === 'object' ? {} : v);
  if (!DIFFICULTES[av.difficulte]) av.difficulte = 'normal';
  av.stats = { combats: 0, ors: 0, morts: 0, ...(av.stats || {}) };
  av.inventaire = { potion: 0, elixir: 0, phenix: 0, ...(av.inventaire || {}) };
  av.acte = Math.max(1, Math.min(ACTES.length, av.acte | 0));
  // Les cinématiques déjà passées : on ne rejoue pas l'ouverture d'une partie entamée.
  if (!Array.isArray(av.cines)) av.cines = ['intro'];

  // 2. Les personnages : talents, marque des légendaires, emplacements d'équipement.
  for (const p of [...av.groupe, ...av.absents.map((a) => a.perso)]) {
    if (!p.talents) { p.talents = {}; }
    p.legendaire = !!(PAR_ID[p.id] && PAR_ID[p.id].legendaire);
    p.equip = { arme: null, armure: null, bijou: null, ...(p.equip || {}) };
  }
  if (av.groupe.some((p) => p.niveau > 1)) fait.push('Des points de talent sont à dépenser dans l’écran du groupe.');

  // 3. Les quêtes du chapitre en cours.
  if (!Array.isArray(av.offresQuetes)) {
    av.offresQuetes = tirerQuetes(av);
    fait.push('Deux quêtes sont proposées pour ce chapitre.');
  }

  // 4. Une boutique visible sur le reste de la carte, s'il n'y en a pas devant soi.
  if (av.carte && Array.isArray(av.carte.noeuds)) {
    const devant = new Set();
    const pile = sallesAccessibles(av).map((n) => n.id);
    while (pile.length) {
      const id = pile.pop();
      if (devant.has(id)) continue;
      devant.add(id);
      const n = noeud(av.carte, id);
      if (n) pile.push(...n.suivants);
    }
    const aVenir = av.carte.noeuds.filter((n) => devant.has(n.id) && n.type !== 'boss');
    if (aVenir.length && !aVenir.some((n) => n.type === 'marchand')) {
      const libres = aVenir.filter((n) => n.rangee >= 1 && n.rangee <= RANGEES - 2 && !['compagnon', 'repos'].includes(n.type));
      if (libres.length) {
        piocher(av, libres).type = 'marchand';
        fait.push('Un marchand s’est installé plus loin sur la carte.');
      }
    }
  }

  // 5. Les dons que le niveau du héros aurait dû ouvrir (les paliers 12, 15 et 18 sont récents).
  if (av.groupe.length) {
    const dus = NIVEAUX_DON.filter((n) => n <= heros(av).niveau).length - av.dons.length - av.donsEnAttente;
    if (dus > 0) {
      av.donsEnAttente += dus;
      fait.push(`${dus} don${dus > 1 ? 's' : ''} à choisir après la prochaine étape.`);
    }
  }

  av.format = FORMAT;
  return fait;
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
  if (e.pieceEpique) out.push('une pièce d’équipement épique');
  if (e.relique) out.push('une relique');
  if (e.boss) {
    const qui = e.boss.cible === 'final' ? 'le dernier boss' : 'le boss du chapitre';
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
        dit: 'Les gardes tombent, l’éclaireur parle. Le boss du chapitre perd l’un de ses atouts.' },
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
    texte: 'Par une fissure, vous apercevez le maître du chapitre. Il ne vous a pas encore vus.',
    choix: [
      { id: 'espionner', label: 'L’espionner', risque: { base: 0.55,
        succes: { boss: { cible: 'acte', pv: -0.15 } }, echec: { boss: { cible: 'acte', atk: 0.1 } },
        ditSucces: 'Vous repérez sa vieille blessure : il commencera le combat affaibli.',
        ditEchec: 'Un caillou roule. Il vous a vus, et il s’y prépare.' } },
      { id: 'pieger', label: 'Piéger son antre', effet: { vie: -0.1, boss: { cible: 'acte', pv: -0.08 } },
        dit: 'Poser les pièges coûte, mais il y laissera des plumes.' },
      { id: 'passer', label: 'Passer', effet: {}, dit: 'Chaque chose en son temps.' },
    ] },
  { id: 'pacte', titre: 'La voix sous la montagne', glyphe: '🕳', actes: [3, 9],
    texte: 'Une voix monte du plus profond : « Je peux vous rendre forts. Assez pour descendre jusqu’à moi. »',
    choix: [
      { id: 'accepter', label: 'Accepter le pacte', effet: { butin: { atk: 0.18 }, boss: { cible: 'final', atk: 0.2 } },
        dit: 'Une force brûlante vous envahit. Celui qui parle s’en nourrit aussi.' },
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
  // Seul un compagnon qui n'a pas encore fait son voyage peut être appelé :
  // on ne s'éveille qu'une fois.
  const partants = av.groupe.map((p, idx) => ({ p, idx })).filter((x) => x.idx >= 1 && !x.p.eveil);
  if (av.acte >= ACTE_ABSENCES && partants.length && !(av.absents || []).length
      && av.departActe !== av.acte && rng(av)() < CHANCE_ABSENCE) {
    av.departActe = av.acte;
    av.etape = { type: 'depart', idx: piocher(av, partants).idx, histoire: piocher(av, HISTOIRES).id };
    return;
  }
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
  if (!av.etape || !['resultat', 'marchand', 'compagnon', 'balade', 'quetes'].includes(av.etape.type)) return { ok: false };
  if (av.etape.type === 'balade') av.balade = null;
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

const ORDRE_TRAITS = ['enrage', 'fureur', 'frenesie', 'regen', 'drain', 'gel', 'poison', 'epines', 'carapace'];
function retirerTrait(e) {
  const t = ORDRE_TRAITS.find((x) => e.traits.includes(x)) || e.traits[0];
  if (t) e.traits = e.traits.filter((x) => x !== t);
}

/* ------------------------------------------------------------------ */
/* Marchand, feu de camp, trésor, rencontre                            */
/* ------------------------------------------------------------------ */

export const PRIX_OBJETS = (acte) => ({ potion: 18 + 5 * acte, elixir: 16 + 4 * acte, phenix: 50 + 10 * acte });
export const PRIX_RELIQUE = (acte) => 110 + 45 * acte;

/** Un prix, après le rabais du groupe (la Bourse sans fond). */
export const prixPour = (av, prix) => Math.max(1, Math.round(prix * (1 - (bonusDe(av).rabais || 0))));
export const prixObjets = (av) => Object.fromEntries(
  Object.entries(PRIX_OBJETS(av.acte)).map(([k, v]) => [k, prixPour(av, v)]),
);

function stockMarchand(av, combien = 4) {
  return Array.from({ length: combien }, () => piece(av));
}

/** Acheter : une pièce du stock (par uid) ou un objet (par son nom). */
export function acheter(av, quoi) {
  if (!av.etape || av.etape.type !== 'marchand') return { ok: false };
  const payer = (prix) => {
    if (av.or < prix) return false;
    av.or -= prix;
    avancerQuete(av, 'depense', prix);
    return true;
  };
  if (OBJETS[quoi]) {
    if (!payer(prixObjets(av)[quoi])) return { ok: false, raison: 'or' };
    av.inventaire[quoi]++;
    return { ok: true };
  }
  if (quoi === 'relique') {
    const r = av.etape.relique;
    if (!r || (av.reliques || []).includes(r.id)) return { ok: false, raison: 'introuvable' };
    if (!payer(prixPour(av, r.prix))) return { ok: false, raison: 'or' };
    gagnerRelique(av, r.id);
    av.etape.relique = null;
    return { ok: true, relique: RELIQUES_PAR_ID[r.id] };
  }
  const i = av.etape.stock.findIndex((x) => x.uid === quoi);
  if (i < 0) return { ok: false, raison: 'introuvable' };
  const it = av.etape.stock[i];
  if (!payer(prixPour(av, it.prix))) return { ok: false, raison: 'or' };
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
  const dedans = av.groupe.map((p) => p.id);
  // À partir du troisième acte, un héros légendaire peut croiser la route du groupe.
  const legendes = LEGENDES.filter((h) => !dedans.includes(h.id));
  const legende = av.acte >= ACTE_LEGENDES && legendes.length && rng(av)() < CHANCE_LEGENDE
    ? piocher(av, legendes).id : null;
  // Groupe complet : seul un légendaire vaut qu'on se sépare de quelqu'un.
  if (effectif(av) >= TAILLE_GROUPE) return legende && av.groupe.length >= 2 ? [legende] : [];
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
  if (legende) offres[offres.length > 1 ? 1 : offres.length] = legende;
  return offres;
}

/** Niveau d'arrivée d'un compagnon : un de moins que le héros. */
export const niveauRecrue = (av) => Math.max(1, heros(av).niveau - 1);

/**
 * Recrute un compagnon. Si le groupe est complet, `remplace` désigne celui
 * qui cède sa place (jamais le héros) : son équipement retourne au sac.
 */
export function recruter(av, id, remplace = null) {
  if (!av.etape || av.etape.type !== 'compagnon' || !av.etape.offres.includes(id)) return { ok: false };
  const complet = effectif(av) >= TAILLE_GROUPE;
  if (complet && !(Number.isInteger(remplace) && remplace >= 1 && remplace < av.groupe.length)) {
    return { ok: false, raison: 'complet' };
  }
  const p = creerPersonnage(id, niveauRecrue(av));
  let parti = null;
  if (complet) {
    parti = av.groupe[remplace];
    for (const it of Object.values(parti.equip)) if (it) av.sac.push(it);
    av.groupe[remplace] = p;
  } else {
    av.groupe.push(p);
  }
  const legende = !!PAR_ID[id].legendaire;
  av.etape = { type: 'resultat', titre: legende ? 'Un héros légendaire' : 'Un compagnon', glyphe: legende ? '🌟' : '🤝',
    dit: `${p.nom}, ${p.titre.toLowerCase()}, rejoint le groupe au niveau ${p.niveau}.`
      + (parti ? ` ${parti.nom} reprend sa route ; son équipement est dans le sac.` : ''),
    effet: '', reussi: null };
  return { ok: true, perso: p, parti };
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

/* ------------------------------------------------------------------ */
/* Les départs : un compagnon a sa propre histoire                     */
/* ------------------------------------------------------------------ */

/** À partir de ce chapitre, un compagnon peut demander à s'absenter. */
export const ACTE_ABSENCES = 2;
export const CHANCE_ABSENCE = 0.35;
/** Combien de salles dure le voyage. */
export const DUREE_ABSENCE = 3;
/** Risque qu'un compagnon parti sans rien ne revienne jamais. */
export const RISQUE_ADIEU = 0.25;
/**
 * Ce qu'il en coûte de lui payer la route : il reviendra à coup sûr. Un
 * montant fixe, qui suit le chapitre — de quoi faire hésiter sans ruiner :
 * à peu près la moitié de ce qu'un chapitre rapporte.
 */
export const prixViatique = (av) => 20 + 30 * av.acte;

/** Le groupe, absents compris : leur place reste la leur. */
export const effectif = (av) => av.groupe.length + (av.absents || []).length;

/**
 * Les histoires. Chacune a son appel (`texte`), son retour — le compagnon
 * revient « éveillé », plus fort qu'il n'est parti — et son adieu.
 */
export const HISTOIRES = [
  { id: 'lettre', titre: 'Une lettre du pays', glyphe: '✉️',
    texte: (n) => `Un corbeau s’est posé sur l’épaule de ${n}. La lettre est courte : le village brûle, et il n’y a plus personne pour le défendre. ${n} vous regarde, sans rien demander.`,
    retour: (n) => `${n} revient, de la suie plein les cheveux et le regard changé. « Ils sont en sécurité. J’ai appris là-bas ce que je venais chercher ici. »`,
    adieu: (n) => `Un corbeau vous apporte un mot de ${n} : « Ils ont besoin de moi plus que vous. Pardonnez-moi. Finissez ce qu’on a commencé. » Dans le paquet, tout son équipement.` },
  { id: 'maitre', titre: 'Le vieux maître', glyphe: '🧓',
    texte: (n) => `Une silhouette attend au bout du couloir : celle qui a tout appris à ${n}, il y a longtemps. « Il te reste une leçon. Elle ne se donne pas ici. Viens, ou ne viens pas. »`,
    retour: (n) => `${n} vous rattrape en courant, une cicatrice neuve en travers de la joue. « La dernière leçon, c’était de gagner ce duel-là. C’est fait. »`,
    adieu: (n) => `Un apprenti essoufflé vous tend un sac. « ${n} garde l’école, maintenant. Le maître est mort cette nuit. » Tout son équipement est là, soigneusement plié.` },
  { id: 'dette', titre: 'Une vieille dette', glyphe: '⚖️',
    texte: (n) => `Trois hommes en manteau gris barrent la route. Ils ne vous veulent rien : ils viennent chercher ${n}, pour une dette qu’aucun or ne rachète. « Trois jours de service. Ou toute une vie de fuite. »`,
    retour: (n) => `${n} réapparaît au détour d’une salle, les poignets marqués, un sourire en coin. « Quitte. Et ils m’ont laissé deviner deux ou trois de leurs secrets. »`,
    adieu: (n) => `Un homme en gris dépose un paquet à vos pieds et repart sans un mot. ${n} a choisi de rester avec eux. Son équipement vous revient.` },
  { id: 'serment', titre: 'Le serment', glyphe: '🕯',
    texte: (n) => `Derrière un mur éboulé, une chapelle intacte — celle de l’ordre que ${n} a quitté. Une veillée y brûle encore. « J’ai un serment à finir. Seul. Ça ne prendra pas longtemps. »`,
    retour: (n) => `${n} vous rejoint à l’aube, les traits tirés, une lueur nouvelle au fond des yeux. « J’ai veillé. On m’a répondu. »`,
    adieu: (n) => `La chapelle est vide quand vous y repassez. Sur l’autel, l’équipement de ${n}, et trois mots tracés dans la cire : « Je reste. Priez. »` },
];
export const HISTOIRES_PAR_ID = Object.fromEntries(HISTOIRES.map((h) => [h.id, h]));

/** L'appel en cours, tel que l'écran doit le présenter. */
export function departCourant(av) {
  const e = av.etape;
  if (!e || e.type !== 'depart') return null;
  const p = av.groupe[e.idx];
  const h = HISTOIRES_PAR_ID[e.histoire];
  return {
    perso: p, titre: h.titre, glyphe: h.glyphe, texte: h.texte(p.nom), eveil: EVEILS[p.id] || null,
    choix: [
      { id: 'partir', label: `Laisser partir ${p.nom}`, possible: true,
        annonce: `Absence de ${DUREE_ABSENCE} salles. Au retour : l’éveil (+${Math.round(0.12 * 100)} % vie, attaque, armure, et un niveau)… s’il y a un retour (${Math.round(RISQUE_ADIEU * 100)} % de risque que non).` },
      { id: 'viatique', label: `Lui payer la route (${prixViatique(av)} or)`, possible: av.or >= prixViatique(av),
        annonce: `Absence de ${DUREE_ABSENCE} salles, retour assuré, avec l’éveil.` },
      { id: 'retenir', label: `Demander à ${p.nom} de rester`, possible: true,
        annonce: 'Le groupe reste entier. −2 chance : un regret, ça pèse.' },
    ],
  };
}

export function choisirDepart(av, choix) {
  const vue = departCourant(av);
  const c = vue && vue.choix.find((x) => x.id === choix);
  if (!c) return { ok: false, raison: 'inconnu' };
  if (!c.possible) return { ok: false, raison: 'or' };
  const p = vue.perso;
  const histoire = av.etape.histoire;
  if (choix === 'retenir') {
    av.chance = Math.max(0, av.chance - 2);
    av.etape = { type: 'resultat', titre: vue.titre, glyphe: vue.glyphe, reussi: null, effet: '−2 chance',
      dit: `${p.nom} hoche la tête et reprend sa place dans la file. Personne ne dit rien pendant un long moment.` };
    return { ok: true };
  }
  if (choix === 'viatique') av.or -= prixViatique(av);
  const adieu = choix === 'partir' && rng(av)() < RISQUE_ADIEU;
  av.groupe = av.groupe.filter((x) => x !== p);
  av.absents = [...(av.absents || []), { perso: p, reste: DUREE_ABSENCE, adieu, histoire }];
  av.etape = { type: 'resultat', titre: vue.titre, glyphe: vue.glyphe, reussi: null,
    effet: `${p.nom} quitte le groupe pour ${DUREE_ABSENCE} salles`,
    dit: choix === 'viatique'
      ? `${p.nom} empoche la bourse, vous serre le bras, et disparaît dans l’escalier. « Je vous retrouve plus haut. Promis. »`
      : `${p.nom} part sans se retourner. Vous continuez à ${av.groupe.length === 1 ? 'un seul' : av.groupe.length}.` };
  return { ok: true, adieu };
}

/** Le voyage est fini : le compagnon revient éveillé, ou envoie ses adieux. */
function retourAbsent(av) {
  const a = av.absents.find((x) => x.reste <= 0);
  av.absents = av.absents.filter((x) => x !== a);
  const p = a.perso;
  const h = HISTOIRES_PAR_ID[a.histoire] || HISTOIRES[0];
  if (a.adieu) {
    for (const it of Object.values(p.equip)) if (it) av.sac.push(it);
    av.or += 30;
    av.etape = { type: 'resultat', titre: `${p.nom} ne reviendra pas`, glyphe: '🕊', reussi: null,
      dit: h.adieu(p.nom), effet: 'Son équipement est dans le sac · +30 or' };
    return;
  }
  const bonus = bonusDe(av);
  p.eveil = true;
  if (p.niveau < NIVEAU_MAX) gagnerXp(p, SEUILS_XP[p.niveau + 1] - p.xp, bonus);
  const st = statsDe(p, bonus);
  p.pv = st.pvMax;
  p.pm = st.pmMax;
  av.groupe.push(p);
  av.etape = { type: 'resultat', titre: `${p.nom} est de retour`, glyphe: '✦', reussi: null,
    dit: h.retour(p.nom), effet: `Éveil : +12 % de vie, d’attaque et d’armure · niveau ${p.niveau}`
      + (EVEILS[p.id] ? ` · nouvelle compétence : ${EVEILS[p.id].nom}` : ''),
    eveil: EVEILS[p.id] ? p.id : null };
}

/* ------------------------------------------------------------------ */
/* Reliques                                                            */
/* ------------------------------------------------------------------ */

export const reliquesDe = (av) => (av.reliques || []).map((id) => RELIQUES_PAR_ID[id]).filter(Boolean);

/** Donne une relique au groupe : celle demandée, ou une au hasard parmi celles qui manquent. */
export function gagnerRelique(av, id = null) {
  const a = av.reliques || [];
  const libres = RELIQUES.filter((r) => !a.includes(r.id));
  const r = id ? libres.find((x) => x.id === id) : (libres.length ? piocher(av, libres) : null);
  if (!r) return null;
  av.reliques = [...a, r.id];
  if (r.chance) av.chance = Math.min(CHANCE_MAX, av.chance + r.chance);
  const bonus = bonusDe(av);
  for (const p of av.groupe) borner(p, bonus);
  return r;
}

/** La relique qu'un marchand met en vitrine (une boutique sur deux en a une). */
function vitrine(av) {
  const libres = RELIQUES.filter((r) => !(av.reliques || []).includes(r.id));
  if (!libres.length || rng(av)() < 0.4) return null;
  return { id: piocher(av, libres).id, prix: PRIX_RELIQUE(av.acte) };
}

/* ------------------------------------------------------------------ */
/* Quêtes                                                              */
/* ------------------------------------------------------------------ */

/** Deux quêtes à proposer pour l'acte en cours. */
function tirerQuetes(av) {
  return melanger(av, QUETES.map((q) => q.id)).slice(0, 2).map((id) => instancierQuete(id, av.acte));
}

/** Ouvre le tableau des quêtes, depuis la carte. */
export function ouvrirQuetes(av) {
  if (av.etape || av.termine) return { ok: false };
  if (!av.offresQuetes) av.offresQuetes = tirerQuetes(av);
  av.etape = { type: 'quetes' };
  return { ok: true };
}

/** Accepte une des quêtes proposées : une seule à la fois, pour l'acte en cours. */
export function accepterQuete(av, id) {
  if (!av.etape || av.etape.type !== 'quetes') return { ok: false };
  if (av.quete) return { ok: false, raison: 'une quête est déjà en cours' };
  const q = (av.offresQuetes || []).find((x) => x.id === id);
  if (!q) return { ok: false, raison: 'inconnue' };
  av.quete = { ...q, progres: 0 };
  av.offresQuetes = av.offresQuetes.filter((x) => x.id !== id);
  return { ok: true, quete: av.quete };
}

function avancerQuete(av, compte, n) {
  const q = av.quete;
  if (!q || n <= 0 || QUETES_PAR_ID[q.id].compte !== compte) return;
  q.progres = Math.min(q.but, q.progres + n);
}

/** La quête est accomplie : on donne la récompense, et on le raconte. */
function recompenserQuete(av) {
  const q = av.quete;
  const def = QUETES_PAR_ID[q.id];
  const r = q.recompense;
  av.quete = null;
  const { piece: p1 } = appliquer(av, r, def.nom);
  let obtenu = p1;
  if (r.pieceEpique) { obtenu = piece(av, { plancher: 'epique' }); av.sac.push(obtenu); }
  const relique = r.relique ? gagnerRelique(av) : null;
  // Plus de relique à trouver : de l'or à la place.
  if (r.relique && !relique) av.or += 120;
  av.etape = {
    type: 'resultat', titre: `Quête accomplie — ${def.nom}`, glyphe: def.glyphe,
    dit: 'Le commanditaire tient parole.', reussi: null, piece: obtenu,
    effet: r.relique && !relique ? '+120 or' : texteEffet(r), relique: relique ? relique.id : null,
  };
}

export { EVEILS, texteEveil };
export { TYPES, ACTES, noeud, NIVEAU_MAX, texteBonus, OBJETS, RELIQUES, RELIQUES_PAR_ID, QUETES_PAR_ID, texteQuete };
