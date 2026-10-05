/**
 * RAID — le combat, au tour par tour.
 *
 * Chaque manche, tout le monde agit une fois, du plus rapide au plus lent.
 * Quand vient le tour d'un personnage du groupe, le joueur choisit : frapper,
 * lancer un sort, déchaîner son ultime, se défendre, ou utiliser un objet.
 * Les ennemis jouent seuls — et annoncent leur attaque chargée des tours à
 * l'avance : c'est le moment de se défendre ou de poser un bouclier.
 *
 * Les écoles se percent en cycle (`ecoles.js`) : frapper là où ça fait mal
 * compte autant que frapper fort.
 *
 * Module ISO : ni DOM ni Node. Le moteur ne tire au sort que par `rng`.
 */

import { multiplicateur } from './ecoles.js';
import { statsDe, sortsPour, NIVEAU_ULTIME } from './personnages.js';
import { effetsTalents } from './talents.js';
import { eveilDe, eveilCible, COUT_EVEIL, SEUIL_EXECUTION } from './eveils.js';
import { PAR_ID } from './heros.js';
import { entier } from '../hasard.js';

/** Armure : part des dégâts arrêtée = def / (def + K_DEF). */
export const K_DEF = 40;
export const MULT_CRIT = 1.5;
/** Soins et potions. */
export const SOIN_POTION = 0.4;
export const MANA_ELIXIR = 0.5;
export const VIE_PHENIX = 0.4;
/** Ce qu'un ennemi enragé gagne en attaque. */
export const RAGE = 0.35;
/** Poids d'un tank dans le choix d'une cible ennemie : il attire les coups. */
export const POIDS_TANK = 3;
/** Ce qu'un monstre qui se régénère reprend à chaque fin de manche. */
export const REGEN = 0.04;
/** PM qu'un coup glacé fait perdre. */
export const GEL_PM = 3;
/** Ce qu'un tank qui provoque encaisse en moins, tant que la provocation dure. */
export const PROVOC_REDUC = 0.3;
/** Vie rendue par le Cœur de phénix, une fois par combat. */
export const VIE_COEUR = 0.3;

export const OBJETS = {
  potion: { nom: 'Potion de soin', glyphe: '🧪', texte: `Rend ${SOIN_POTION * 100} % de sa vie à un allié.` },
  elixir: { nom: 'Élixir de mana', glyphe: '🔷', texte: `Rend ${MANA_ELIXIR * 100} % de son mana à un allié.` },
  phenix: { nom: 'Plume de phénix', glyphe: '🪶', texte: `Relève un allié tombé avec ${VIE_PHENIX * 100} % de sa vie.` },
};

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o
 * @param {object[]} o.groupe      personnages de l'aventure (modifiés à la fin)
 * @param {object[]} o.ennemis     ennemis déjà instanciés (voir `ennemiRpg`)
 * @param {object} [o.bonus]       dons et bénédictions du groupe, en parts
 * @param {object} o.inventaire    { potion, elixir, phenix } — partagé
 * @param {number} [o.chance]      chance du groupe
 * @param {Function} o.rng
 */
export function creerBataille({ groupe, ennemis, bonus = {}, inventaire, chance = 0, rng }) {
  const heros = groupe.map((p, idx) => {
    const s = statsDe(p, bonus);
    return {
      camp: 'h', idx, ref: p, id: p.id, nom: p.nom, ecole: p.ecole, role: p.role, peuple: p.peuple,
      niveau: p.niveau,
      pv: Math.max(0, Math.min(p.pv, s.pvMax)), pvMax: s.pvMax,
      pm: Math.min(p.pm, s.pmMax), pmMax: s.pmMax,
      atk: s.atk, def: s.def, vit: s.vit, crit: s.crit,
      sorts: sortsPour(p),
      tal: effetsTalents(p),
      eveil: eveilDe(p),   // sa compétence d'éveil, s'il est revenu de voyage
      defense: false, poison: null,
    };
  });
  const etat = {
    rng, bonus, inventaire, chance,
    heros,
    ennemis: ennemis.map((e, idx) => ({ ...e, camp: 'e', idx })),
    manche: 0,
    ordre: [],
    actif: null,
    // { valeur, tours } sur tout le groupe ; l'Égide en pose un d'entrée
    bouclier: bonus.egide ? { valeur: bonus.egide, tours: 2 } : null,
    coeur: !!bonus.phenix,   // le Cœur de phénix n'a pas encore servi
    provoc: null,            // { idx, tours } : le héros que tous les ennemis doivent frapper
    serment: null,           // { tours } : aucun héros ne peut tomber sous 1 PV
    elan: null,       // { valeur, tours } sur tout le groupe
    fini: false,
    victoire: false,
  };
  return etat;
}

const vivants = (l) => l.filter((u) => u.pv > 0);
const unite = (etat, camp, idx) => (camp === 'h' ? etat.heros : etat.ennemis)[idx];
const ref = (u) => ({ camp: u.camp, idx: u.idx });

/* ------------------------------------------------------------------ */
/* Déroulé                                                             */
/* ------------------------------------------------------------------ */

function nouvelleManche(etat, ev) {
  etat.manche++;
  // Du plus rapide au plus lent ; à vitesse égale, le hasard.
  etat.ordre = [...vivants(etat.heros), ...vivants(etat.ennemis)]
    .map((u) => ({
      u,
      // Le Sablier fêlé donne l'initiative au groupe, la première manche.
      t: u.vit + etat.rng() * 0.9 + (etat.manche === 1 && u.camp === 'h' ? (etat.bonus.sablier || 0) : 0),
    }))
    .sort((a, b) => b.t - a.t)
    .map((x) => ref(x.u));
  ev.push({ t: 'manche', n: etat.manche });
}

/** Fin de manche : les effets s'usent, les brûlures et poisons mordent. */
function finDeManche(etat, ev) {
  for (const e of vivants(etat.ennemis)) {
    if (e.brasier && e.brasier.tours > 0) {
      const b = e.brasier;
      b.tours--;
      subir(etat, e, b.degats, ev, { dot: 'brasier' });
    }
    if (e.entrave && --e.entrave.tours <= 0) e.entrave = null;
    if (e.fragile && --e.fragile.tours <= 0) e.fragile = null;
    if (e.pv > 0 && e.traits.includes('regen')) soigner(e, e.pvMax * REGEN, ev);
  }
  // La régénération du groupe : un peu de vie à chaque fin de manche.
  if (etat.regen) {
    for (const h of vivants(etat.heros)) if (h.pv < h.pvMax) soigner(h, h.pvMax * etat.regen.valeur, ev);
    if (--etat.regen.tours <= 0) etat.regen = null;
  }
  for (const h of vivants(etat.heros)) {
    if (h.poison && h.poison.tours > 0) {
      const p = h.poison;
      p.tours--;
      subir(etat, h, p.degats, ev, { dot: 'poison' });
    }
  }
  if (etat.bouclier && --etat.bouclier.tours <= 0) etat.bouclier = null;
  if (etat.elan && --etat.elan.tours <= 0) etat.elan = null;
  if (etat.provoc && --etat.provoc.tours <= 0) etat.provoc = null;
  if (etat.serment && --etat.serment.tours <= 0) etat.serment = null;
  if (etat.represailles && --etat.represailles.tours <= 0) etat.represailles = null;
  if (etat.riposte && --etat.riposte.tours <= 0) etat.riposte = null;
}

function verifierFin(etat, ev) {
  if (etat.fini) return true;
  if (!vivants(etat.ennemis).length) { etat.fini = true; etat.victoire = true; }
  else if (!vivants(etat.heros).length) { etat.fini = true; etat.victoire = false; }
  if (etat.fini) {
    ev.push({ t: 'fin', victoire: etat.victoire });
    ecrireGroupe(etat);
  }
  return etat.fini;
}

/** Le combat terminé, vie et mana retournent aux personnages de l'aventure. */
function ecrireGroupe(etat) {
  for (const h of etat.heros) {
    h.ref.pv = Math.max(0, Math.round(h.pv));
    h.ref.pm = Math.max(0, Math.round(h.pm));
  }
}

/**
 * Avance jusqu'au prochain tour d'un personnage du groupe (ou la fin) :
 * les ennemis jouent d'eux-mêmes. Renvoie les événements produits.
 */
export function avancer(etat) {
  const ev = [];
  for (let garde = 0; garde < 200; garde++) {
    if (verifierFin(etat, ev)) return ev;
    if (!etat.ordre.length) {
      if (etat.manche > 0) finDeManche(etat, ev);
      if (verifierFin(etat, ev)) return ev;
      nouvelleManche(etat, ev);
    }
    const r = etat.ordre.shift();
    const u = unite(etat, r.camp, r.idx);
    if (!u || u.pv <= 0) continue;
    if (u.camp === 'e') { jouerEnnemi(etat, u, ev); continue; }
    u.defense = false;
    if (u.tal.pmTour) u.pm = Math.min(u.pmMax, u.pm + u.tal.pmTour);
    if (u.tal.soinTour && u.pv < u.pvMax) soigner(u, u.pvMax * u.tal.soinTour, ev);
    if (u.tal.aura) {
      const blesse = vivants(etat.heros).filter((x) => x.pv < x.pvMax).sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
      if (blesse) soigner(blesse, blesse.pvMax * u.tal.aura, ev);
    }
    etat.actif = r;
    ev.push({ t: 'tour', ...r });
    return ev;
  }
  return ev;
}

export const demarrer = (etat) => avancer(etat);

/** Le personnage dont c'est le tour. */
export const actif = (etat) => (etat.actif && !etat.fini ? unite(etat, 'h', etat.actif.idx) : null);

/* ------------------------------------------------------------------ */
/* Dégâts                                                              */
/* ------------------------------------------------------------------ */

/** Attaque effective d'un ennemi : rage, fureur, affaiblissement. */
export function attaqueEnnemi(e) {
  let atk = e.atk;
  if (e.enrage) atk *= 1 + RAGE;
  if (e.traits.includes('fureur')) atk *= 1 + 0.3 * (1 - e.pv / e.pvMax);
  if (e.entrave) atk *= 1 - e.entrave.valeur;
  return atk;
}

export const reduction = (def) => K_DEF / (K_DEF + Math.max(0, def));

/** Chance de coup critique d'un personnage. */
export const critiqueDe = (etat, h) => Math.min(0.5, 0.03 + (etat.chance || 0) / 200 + (h.crit || 0) / 100);

/**
 * Dégâts d'une source sur une cible, sans les appliquer. `perce` ignore une
 * part de l'armure ; `basique` distingue l'attaque simple (que la carapace
 * amortit).
 */
export function estimer(etat, src, cible, mult, { perce = 0, basique = false, alea = 1, crit = false } = {}) {
  let atk = src.camp === 'e' ? attaqueEnnemi(src) : src.atk;
  if (src.camp === 'h') {
    if (etat.elan) atk *= 1 + etat.elan.valeur;
    atk *= 1 + (etat.bonus.degats || 0);
    if (cible.rang === 'boss') atk *= 1 + (etat.bonus.boss || 0) + ((src.tal && src.tal.boss) || 0);
    if (src.tal && src.tal.achever && cible.pv / cible.pvMax < 0.5) atk *= 1 + src.tal.achever;
  }
  const elem = multiplicateur(src.ecole, cible.ecole);
  let d = atk * mult * elem * alea * reduction(cible.def * (1 - perce));
  if (cible.camp === 'e' && cible.fragile) d *= 1 + cible.fragile.valeur;
  if (basique && cible.traits && cible.traits.includes('carapace')) d *= 0.7;
  if (cible.camp === 'h') {
    if (cible.defense) d *= 0.5;
    if (etat.bouclier) d *= 1 - etat.bouclier.valeur;
    if (cible.tal && cible.tal.reduc) d *= 1 - cible.tal.reduc;
    if (etat.provoc && etat.provoc.idx === cible.idx) d *= 1 - (etat.provoc.reduc ?? PROVOC_REDUC);
  }
  if (crit) d *= MULT_CRIT + (etat.bonus.critique || 0) + ((src.tal && src.tal.critDegats) || 0);
  return { degats: Math.max(1, Math.round(d)), elem };
}

function subir(etat, cible, n, ev, extra = {}) {
  const avant = cible.pv;
  // Le Serment d'acier : tant qu'il tient, un héros debout le reste.
  const plancher = cible.camp === 'h' && etat.serment && avant > 0 ? 1 : 0;
  cible.pv = Math.max(plancher, cible.pv - n);
  ev.push({ t: 'degats', ...ref(cible), n: avant - cible.pv, pv: cible.pv, ...extra });
  if (cible.pv <= 0 && avant > 0 && cible.camp === 'h' && etat.coeur) {
    // Le Cœur de phénix : le premier héros qui tombe se relève aussitôt.
    etat.coeur = false;
    cible.pv = Math.round(cible.pvMax * VIE_COEUR);
    ev.push({ t: 'releve', ...ref(cible), pv: cible.pv, relique: 'coeur' });
  } else if (cible.pv <= 0 && avant > 0 && cible.camp === 'e' && cible.phases && cible.phase < cible.phases.length - 1) {
    changerPhase(cible, ev);
  } else if (cible.pv <= 0 && avant > 0) {
    ev.push({ t: 'ko', ...ref(cible) });
    if (cible.camp === 'h') {
      cible.poison = null;
      cible.pm = 0;
      if (etat.provoc && etat.provoc.idx === cible.idx) etat.provoc = null;
    }
  } else if (cible.camp === 'e' && cible.traits.includes('enrage') && !cible.enrage
      && cible.pv <= cible.pvMax / 2) {
    cible.enrage = true;
    ev.push({ t: 'effet', quoi: 'rage', ...ref(cible) });
  }
}

/**
 * Un boss à plusieurs phases ne tombe pas : il se relève sous une forme plus
 * forte, plus dure, avec plus de vie. Ce qui pesait sur lui (brûlure,
 * affaiblissement, étourdissement) s'efface, et sa charge repart de zéro.
 * Les nouvelles valeurs se déduisent des anciennes : tout ce qui avait déjà
 * modifié le boss (difficulté, ruses, blessures) reste en proportion.
 */
function changerPhase(e, ev) {
  const avant = e.phases[e.phase];
  const apres = e.phases[e.phase + 1];
  e.phase++;
  e.pvMax = Math.max(1, Math.round(e.pvMax * (apres.pv / avant.pv)));
  e.pv = e.pvMax;
  e.atk = Math.max(1, Math.round(e.atk * (apres.atk / avant.atk)));
  e.def = Math.round(e.def * (apres.def / avant.def));
  if (apres.traits) e.traits = [...apres.traits];
  if (apres.nom) e.nom = apres.nom;
  e.enrage = false;
  e.brasier = null;
  e.entrave = null;
  e.etourdi = false;
  e.charge.reste = e.charge.tours;
  ev.push({ t: 'phase', ...ref(e), n: e.phase + 1, sur: e.phases.length, nom: e.nom, pv: e.pv, pvMax: e.pvMax });
}

function soigner(cible, n, ev) {
  if (cible.pv <= 0) return;
  const avant = cible.pv;
  cible.pv = Math.min(cible.pvMax, cible.pv + Math.round(n));
  ev.push({ t: 'soin', ...ref(cible), n: cible.pv - avant, pv: cible.pv });
}

/** Un coup d'un héros sur un ennemi : critique, épines, drain. */
function frapper(etat, h, e, mult, ev, opts = {}) {
  const crit = !!opts.critique || etat.rng() < critiqueDe(etat, h);
  const alea = 0.9 + etat.rng() * 0.2;
  const { degats, elem } = estimer(etat, h, e, mult, { ...opts, alea, crit });
  subir(etat, e, degats, ev, { crit, elem });
  if (e.traits.includes('epines') && e.pv > 0) {
    subir(etat, h, Math.max(1, Math.round(degats * 0.07)), ev, { epines: true });
  }
  if (e.traits.includes('drain') && e.pv > 0) soigner(e, degats * 0.06, ev);
  return degats;
}

/* ------------------------------------------------------------------ */
/* Actions du joueur                                                   */
/* ------------------------------------------------------------------ */

/** Ce que le personnage actif peut faire, et sur qui. */
export function actionsDe(etat) {
  const h = actif(etat);
  if (!h) return [];
  const ultimeAppris = h.niveau >= NIVEAU_ULTIME;
  const inv = etat.inventaire;
  const sort = (cle) => {
    const s = h.sorts[cle];
    return {
      type: cle, nom: s.nom, cout: s.cout,
      possible: h.pm >= s.cout && (cle !== 'ultime' || ultimeAppris),
      verrou: cle === 'ultime' && !ultimeAppris ? `appris au niveau ${NIVEAU_ULTIME}` : null,
      cibles: s.soutien ? 'groupe' : 'ennemi',
      effet: s.effet, mult: s.mult,
    };
  };
  return [
    { type: 'attaque', nom: 'Attaque', cout: 0, possible: true, cibles: 'ennemi', mult: 1 },
    sort('special'),
    sort('ultime'),
    ...(h.eveil ? [{
      type: 'eveil', nom: h.eveil.nom, cout: COUT_EVEIL, possible: h.pm >= COUT_EVEIL, verrou: null,
      cibles: eveilCible(h.eveil) ? 'ennemi' : 'groupe', eveil: h.eveil,
    }] : []),
    { type: 'defendre', nom: 'Défendre', cout: 0, possible: true, cibles: 'aucune' },
    { type: 'potion', nom: OBJETS.potion.nom, possible: inv.potion > 0, cibles: 'allie', quantite: inv.potion },
    { type: 'elixir', nom: OBJETS.elixir.nom, possible: inv.elixir > 0, cibles: 'allie', quantite: inv.elixir },
    { type: 'phenix', nom: OBJETS.phenix.nom, possible: inv.phenix > 0 && etat.heros.some((x) => x.pv <= 0),
      cibles: 'tombe', quantite: inv.phenix },
  ];
}

/**
 * Le personnage actif agit. `cible` est un index d'ennemi pour une attaque,
 * d'allié pour un objet. Puis le combat avance jusqu'au tour suivant.
 */
export function agir(etat, { type, cible = null }) {
  const h = actif(etat);
  if (!h) return { ok: false, raison: 'pas de tour' };
  const a = actionsDe(etat).find((x) => x.type === type);
  if (!a || !a.possible) return { ok: false, raison: 'impossible' };

  const ev = [];
  if (a.cibles === 'ennemi') {
    const e = etat.ennemis[cible] && etat.ennemis[cible].pv > 0 ? etat.ennemis[cible] : vivants(etat.ennemis)[0];
    if (!e) return { ok: false, raison: 'personne' };
    if (type === 'attaque') {
      ev.push({ t: 'action', ...ref(h), nom: 'Attaque', genre: 'attaque', cible: ref(e) });
      const fait = frapper(etat, h, e, 1, ev, { basique: true });
      h.pm = Math.min(h.pmMax, h.pm + 2);   // frapper remplit un peu la jauge
      if (h.tal.vampire && h.pv > 0) soigner(h, fait * h.tal.vampire, ev);
    } else if (type === 'eveil') {
      lancerEveil(etat, h, e, ev);
    } else {
      lancerOffensif(etat, h, type, e, ev);
    }
  } else if (a.cibles === 'groupe') {
    if (type === 'eveil') lancerEveil(etat, h, null, ev);
    else lancerSoutien(etat, h, type, ev);
  } else if (type === 'defendre') {
    h.defense = true;
    h.pm = Math.min(h.pmMax, h.pm + 4);
    ev.push({ t: 'action', ...ref(h), nom: 'Défense', genre: 'defense' });
  } else {
    const allie = etat.heros[cible];
    if (!allie) return { ok: false, raison: 'cible' };
    if (type === 'phenix' ? allie.pv > 0 : allie.pv <= 0) return { ok: false, raison: 'cible' };
    utiliserObjet(etat, h, type, allie, ev);
  }

  etat.actif = null;
  ev.push(...avancer(etat));
  return { ok: true, evenements: ev };
}

function lancerOffensif(etat, h, cle, e, ev) {
  const s = h.sorts[cle];
  h.pm -= s.cout;
  ev.push({ t: 'action', ...ref(h), nom: s.nom, genre: cle === 'ultime' ? 'ultime' : 'sort', cible: ref(e) });
  const eff = s.effet || {};
  const perce = eff.type === 'perce' ? eff.valeur : 0;
  const mult = s.mult * (1 + (h.tal.sorts || 0));
  let total = 0;
  const tous = ['zone', 'fracas', 'fournaise', 'seisme'].includes(eff.type);
  const touches = tous ? vivants(etat.ennemis) : [e];
  if (tous) {
    // Le balayage frappe tous les ennemis debout, de plein fouet.
    for (const x of touches) total += frapper(etat, h, x, mult, ev);
  } else if (eff.type === 'execution') {
    total = frapper(etat, h, e, mult * (e.pv / e.pvMax < SEUIL_EXECUTION ? 2 : 1), ev);
  } else if (eff.type === 'double') {
    total += frapper(etat, h, e, mult * 0.6, ev);
    if (e.pv > 0) total += frapper(etat, h, e, mult * 0.6, ev);
  } else if (eff.type === 'critique') {
    total = frapper(etat, h, e, mult, ev, { critique: true });
  } else if (eff.type === 'chaine') {
    // La salve frappe sa cible, puis rebondit sur deux autres ennemis.
    total = frapper(etat, h, e, mult, ev);
    for (const x of vivants(etat.ennemis).filter((y) => y !== e).slice(0, 2)) total += frapper(etat, h, x, mult * 0.6, ev);
  } else if (eff.type === 'rafale') {
    // Cinq coups rapides : si la cible tombe, la rafale passe au suivant.
    let c = e;
    for (let k = 0; k < 5; k++) {
      if (!c || c.pv <= 0) c = vivants(etat.ennemis)[0];
      if (!c) break;
      total += frapper(etat, h, c, mult * 0.24, ev);
    }
  } else {
    total = frapper(etat, h, e, mult, ev, { perce });
  }
  if (eff.type === 'brasier' && e.pv > 0) {
    e.brasier = { degats: Math.max(1, Math.round(total * eff.valeur * 1.4)), tours: 3 };
    ev.push({ t: 'effet', quoi: 'brasier', ...ref(e) });
  }
  if (eff.type === 'entrave' && e.pv > 0) {
    e.entrave = { valeur: eff.valeur, tours: 2 };
    ev.push({ t: 'effet', quoi: 'entrave', ...ref(e) });
  }
  if (eff.type === 'radiance') {
    // La lumière du coup retombe en soins sur tout le groupe.
    for (const x of vivants(etat.heros)) soigner(x, total * eff.valeur * (1 + (h.tal.soins || 0)), ev);
  }
  if (eff.type === 'fragilise' && e.pv > 0) {
    e.fragile = { valeur: eff.valeur, tours: 2 };
    ev.push({ t: 'effet', quoi: 'fragile', ...ref(e) });
  }
  if (eff.type === 'vol') {
    const blesse = vivants(etat.heros).sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
    if (blesse) soigner(blesse, total * eff.valeur * 1.5, ev);
  }
  for (const x of touches) {
    if (x.pv <= 0) continue;
    if (eff.type === 'fracas') {
      x.entrave = { valeur: eff.valeur, tours: 2 };
      ev.push({ t: 'effet', quoi: 'entrave', ...ref(x) });
    }
    if (eff.type === 'fournaise') {
      x.brasier = { degats: Math.max(1, Math.round((total / touches.length) * eff.valeur * 1.4)), tours: 3 };
      ev.push({ t: 'effet', quoi: 'brasier', ...ref(x) });
    }
    if (eff.type === 'seisme' && x.rang !== 'boss' && etat.rng() < 0.4) {
      x.etourdi = true;
      ev.push({ t: 'effet', quoi: 'etourdi', ...ref(x) });
    }
    if (eff.type === 'assommer' && x.rang !== 'boss') {
      x.etourdi = true;
      ev.push({ t: 'effet', quoi: 'etourdi', ...ref(x) });
    }
  }
}

function lancerSoutien(etat, h, cle, ev) {
  const s = h.sorts[cle];
  h.pm -= s.cout;
  ev.push({ t: 'action', ...ref(h), nom: s.nom, genre: cle === 'ultime' ? 'ultime' : 'sort' });
  const eff = s.effet;
  switch (eff.type) {
    case 'soin':
      for (const x of vivants(etat.heros)) soigner(x, x.pvMax * eff.valeur * 2 * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
      break;
    case 'garde':
      etat.bouclier = { valeur: Math.min(0.6, eff.valeur * 1.1), tours: 2 };
      ev.push({ t: 'effet', quoi: 'bouclier' });
      break;
    case 'elan':
      etat.elan = { valeur: eff.valeur * 1.2, tours: 2 };
      ev.push({ t: 'effet', quoi: 'elan' });
      break;
    case 'mana':
      for (const x of vivants(etat.heros)) {
        if (x === h) continue;
        const avant = x.pm;
        x.pm = Math.min(x.pmMax, x.pm + eff.valeur * 2);
        ev.push({ t: 'pm', ...ref(x), n: x.pm - avant, pm: x.pm });
      }
      break;
    case 'provoc':
      etat.provoc = { idx: h.idx, tours: eff.valeur, reduc: Math.min(0.6, PROVOC_REDUC * (1 + (s.renfort || 0))) };
      ev.push({ t: 'effet', quoi: 'provoc', ...ref(h) });
      break;
    case 'bastion':
      etat.bouclier = { valeur: eff.valeur, tours: 3 };
      etat.provoc = { idx: h.idx, tours: 3 };
      ev.push({ t: 'effet', quoi: 'bouclier' });
      ev.push({ t: 'effet', quoi: 'provoc', ...ref(h) });
      break;
    case 'purge':
      for (const x of vivants(etat.heros)) {
        soigner(x, x.pvMax * eff.valeur * 2 * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
        x.poison = null;
      }
      ev.push({ t: 'effet', quoi: 'purge' });
      break;
    case 'renouveau':
      for (const x of vivants(etat.heros)) {
        soigner(x, x.pvMax * eff.valeur * 2 * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
        if (x === h) continue;
        const avant = x.pm;
        x.pm = Math.min(x.pmMax, x.pm + 12);
        ev.push({ t: 'pm', ...ref(x), n: Math.round(x.pm - avant), pm: x.pm });
      }
      break;
    case 'represailles':
      etat.represailles = { valeur: eff.valeur, tours: 2 };
      ev.push({ t: 'effet', quoi: 'represailles' });
      break;
    case 'regeneration':
      etat.regen = { valeur: eff.valeur * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), tours: 3 };
      ev.push({ t: 'effet', quoi: 'regen' });
      break;
    case 'contre':
      etat.provoc = { idx: h.idx, tours: 2, reduc: PROVOC_REDUC };
      etat.riposte = { idx: h.idx, valeur: eff.valeur, tours: 2 };
      ev.push({ t: 'effet', quoi: 'provoc', ...ref(h) });
      ev.push({ t: 'effet', quoi: 'riposte', ...ref(h) });
      break;
    case 'transfusion': {
      const blesse = vivants(etat.heros).sort((a, b) => a.pv / a.pvMax - b.pv / b.pvMax)[0];
      if (blesse) soigner(blesse, blesse.pvMax * eff.valeur * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
      break;
    }
    case 'souffle':
      for (const x of vivants(etat.heros)) soigner(x, x.pvMax * eff.valeur * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
      etat.elan = { valeur: Math.max(etat.elan ? etat.elan.valeur : 0, 0.22), tours: 2 };
      ev.push({ t: 'effet', quoi: 'elan' });
      break;
    case 'sanctuaire':
      etat.bouclier = { valeur: Math.min(0.6, eff.valeur), tours: 2 };
      etat.regen = { valeur: 0.05 * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), tours: 2 };
      ev.push({ t: 'effet', quoi: 'bouclier' });
      ev.push({ t: 'effet', quoi: 'regen' });
      break;
    case 'retard':
      // Le temps prêté : les attaques chargées des ennemis reculent d'un tour.
      for (const x of vivants(etat.ennemis)) x.charge.reste = Math.min(x.charge.tours + 1, x.charge.reste + 1);
      for (const x of vivants(etat.heros)) soigner(x, x.pvMax * eff.valeur * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
      ev.push({ t: 'effet', quoi: 'retard' });
      break;
    case 'resurrection':
      for (const x of etat.heros) {
        if (x.pv <= 0) {
          x.pv = Math.round(x.pvMax * eff.valeur);
          ev.push({ t: 'releve', ...ref(x), pv: x.pv });
        } else {
          soigner(x, x.pvMax * eff.valeur * 0.6, ev);
        }
      }
      break;
    default: break;
  }
}

/**
 * La compétence d'éveil : un coup (ou pas), puis une suite d'effets. Voir
 * `eveils.js` pour le vocabulaire.
 */
function lancerEveil(etat, h, e, ev) {
  const sp = h.eveil;
  h.pm -= COUT_EVEIL;
  ev.push({ t: 'action', ...ref(h), nom: sp.nom, genre: 'eveil', ...(e ? { cible: ref(e) } : {}) });
  let total = 0;
  let touches = [];
  const d = sp.degats;
  if (d) {
    touches = d.zone ? vivants(etat.ennemis) : [e];
    for (let i = 0; i < (d.coups || 1); i++) {
      for (const c of touches) {
        if (c.pv <= 0) continue;
        let mult = d.mult * (1 + (h.tal.sorts || 0));
        if (d.execution && c.pv / c.pvMax < SEUIL_EXECUTION) mult *= 2;
        total += frapper(etat, h, c, mult, ev, { perce: d.perce || 0 });
      }
    }
  }
  const visees = d ? touches.filter((c) => c.pv > 0) : vivants(etat.ennemis);
  for (const o of sp.puis || []) {
    switch (o.type) {
      case 'soin':
        for (const x of vivants(etat.heros)) soigner(x, x.pvMax * o.v * (1 + (etat.bonus.soin || 0) + (h.tal.soins || 0)), ev);
        break;
      case 'soinSoi': soigner(h, h.pvMax * o.v, ev); break;
      case 'sang': soigner(h, total * o.v, ev); break;
      case 'bouclier':
        etat.bouclier = { valeur: o.v, tours: o.tours };
        ev.push({ t: 'effet', quoi: 'bouclier' });
        break;
      case 'elan':
        etat.elan = { valeur: o.v, tours: o.tours };
        ev.push({ t: 'effet', quoi: 'elan' });
        break;
      case 'provoc':
        if (h.pv > 0) {
          etat.provoc = { idx: h.idx, tours: o.tours };
          ev.push({ t: 'effet', quoi: 'provoc', ...ref(h) });
        }
        break;
      case 'mana':
        for (const x of vivants(etat.heros)) {
          if (x === h) continue;
          const avant = x.pm;
          x.pm = Math.min(x.pmMax, x.pm + o.v);
          ev.push({ t: 'pm', ...ref(x), n: Math.round(x.pm - avant), pm: x.pm });
        }
        break;
      case 'serment':
        etat.serment = { tours: o.tours };
        ev.push({ t: 'effet', quoi: 'serment' });
        break;
      case 'purge':
        for (const x of vivants(etat.heros)) x.poison = null;
        ev.push({ t: 'effet', quoi: 'purge' });
        break;
      case 'releve':
        for (const x of etat.heros) {
          if (x.pv > 0) continue;
          x.pv = Math.round(x.pvMax * o.v);
          ev.push({ t: 'releve', ...ref(x), pv: x.pv });
        }
        break;
      case 'brasier':
        for (const c of visees) {
          c.brasier = { degats: Math.max(1, Math.round((total / Math.max(1, touches.length)) * o.part)), tours: o.tours };
          ev.push({ t: 'effet', quoi: 'brasier', ...ref(c) });
        }
        break;
      case 'entrave':
        for (const c of visees) {
          c.entrave = { valeur: o.v, tours: o.tours };
          ev.push({ t: 'effet', quoi: 'entrave', ...ref(c) });
        }
        break;
      case 'etourdi':
        for (const c of visees) {
          if (c.rang === 'boss') continue;      // un boss ne se laisse pas étourdir
          c.etourdi = true;
          ev.push({ t: 'effet', quoi: 'etourdi', ...ref(c) });
        }
        break;
      default: break;
    }
  }
}

function utiliserObjet(etat, h, type, allie, ev) {
  etat.inventaire[type]--;
  ev.push({ t: 'action', ...ref(h), nom: OBJETS[type].nom, genre: 'objet', cible: ref(allie) });
  if (type === 'potion') soigner(allie, allie.pvMax * (SOIN_POTION + (etat.bonus.potion || 0)), ev);
  if (type === 'elixir') {
    const avant = allie.pm;
    allie.pm = Math.min(allie.pmMax, allie.pm + allie.pmMax * MANA_ELIXIR);
    ev.push({ t: 'pm', ...ref(allie), n: Math.round(allie.pm - avant), pm: allie.pm });
  }
  if (type === 'phenix') {
    allie.pv = Math.round(allie.pvMax * VIE_PHENIX);
    ev.push({ t: 'releve', ...ref(allie), pv: allie.pv });
  }
}

/* ------------------------------------------------------------------ */
/* Les ennemis                                                         */
/* ------------------------------------------------------------------ */

/** Cible d'un ennemi : au hasard, mais les tanks attirent les coups. */
/** Le héros qui provoque, s'il est encore debout. */
export function provocateur(etat) {
  const h = etat.provoc ? etat.heros[etat.provoc.idx] : null;
  return h && h.pv > 0 ? h : null;
}

function cibleEnnemie(etat) {
  const prov = provocateur(etat);
  if (prov) return prov;
  const l = vivants(etat.heros);
  const poids = l.map((h) => (h.role === 'tank' ? POIDS_TANK : 1));
  let x = etat.rng() * poids.reduce((s, p) => s + p, 0);
  for (let i = 0; i < l.length; i++) { x -= poids[i]; if (x < 0) return l[i]; }
  return l[l.length - 1];
}

function coupEnnemi(etat, e, h, mult, ev) {
  const alea = 0.9 + etat.rng() * 0.2;
  const { degats, elem } = estimer(etat, e, h, mult, { alea });
  subir(etat, h, degats, ev, { elem });
  if (e.traits.includes('poison') && h.pv > 0) {
    h.poison = { degats: Math.max(1, Math.round(degats * 0.25)), tours: 2 };
  }
  if (e.traits.includes('gel') && h.pv > 0 && h.pm > 0) {
    const avant = h.pm;
    h.pm = Math.max(0, h.pm - GEL_PM);
    ev.push({ t: 'pm', ...ref(h), n: Math.round(h.pm - avant), pm: h.pm });
  }
  if (h.tal.epines && e.pv > 0) subir(etat, e, Math.max(1, Math.round(degats * h.tal.epines)), ev, { epines: true });
  // Représailles : le groupe renvoie une part de ce qu'il encaisse.
  if (etat.represailles && e.pv > 0) subir(etat, e, Math.max(1, Math.round(degats * etat.represailles.valeur)), ev, { epines: true });
  // Riposte : le héros qui l'a préparée rend coup pour coup.
  if (etat.riposte && etat.riposte.idx === h.idx && h.pv > 0 && e.pv > 0) frapper(etat, h, e, etat.riposte.valeur, ev);
  if (e.traits.includes('drain')) soigner(e, degats * 0.25, ev);
}

function jouerEnnemi(etat, e, ev) {
  ev.push({ t: 'tour', ...ref(e) });
  if (e.etourdi) {
    // Étourdi : il perd son tour, et sa charge n'avance pas.
    e.etourdi = false;
    ev.push({ t: 'action', ...ref(e), nom: 'Étourdi', genre: 'etourdi' });
    return;
  }
  const charge = e.charge.reste <= 1;
  if (charge) {
    ev.push({ t: 'action', ...ref(e), nom: e.charge.nom, genre: 'charge' });
    // Les boss et les élites frappent tout le groupe ; la meute, un seul.
    // Un héros qui provoque prend l'attaque chargée pour lui seul, même celle d'un boss.
    const prov = provocateur(etat);
    const zone = e.charge.zone && !prov;
    const cibles = zone ? vivants(etat.heros) : [prov || cibleEnnemie(etat)];
    for (const h of cibles) coupEnnemi(etat, e, h, e.charge.mult * (zone ? 0.7 : 1), ev);
    e.charge.reste = e.charge.tours;
    return;
  }
  e.charge.reste--;
  const h = cibleEnnemie(etat);
  if (!h) return;
  ev.push({ t: 'action', ...ref(e), nom: 'Attaque', genre: 'attaque', cible: ref(h) });
  coupEnnemi(etat, e, h, 1, ev);
  if (e.pv > 0 && e.traits.includes('frenesie') && etat.rng() < 0.35) {
    const h2 = cibleEnnemie(etat);
    if (h2) coupEnnemi(etat, e, h2, 0.55, ev);
  }
}

/* ------------------------------------------------------------------ */
/* Vue                                                                 */
/* ------------------------------------------------------------------ */

export function prochainsTours(etat, n = 8) {
  return etat.ordre.slice(0, n).map((r) => unite(etat, r.camp, r.idx)).filter((u) => u && u.pv > 0);
}

export { vivants, entier };
