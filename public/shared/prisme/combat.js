/**
 * PRISME — le moteur de combat.
 *
 * Un tour se déroule toujours de la même façon, et c'est là que tout se joue :
 *
 *   1. la rotation de trois héros entre en scène (l'équipe en compte six) ;
 *   2. l'ennemi annonce qui il vise et à quel moment du tour il frappera ;
 *   3. chaque héros, dans l'ordre choisi par le joueur, trace un chemin sur le
 *      champ d'orbes, récolte son ki, puis attaque — normale, spéciale à douze
 *      de ki, ultime à dix-huit ;
 *   4. la fenêtre ennemie s'ouvre au moment annoncé.
 *
 * L'ordre de passage est donc la vraie décision : le héros qui attaque avant la
 * fenêtre peut poser une garde, celui qui attaque après frappe un ennemi déjà
 * entravé. L'équipe partage une seule barre de vie : un colosse sert à quelque
 * chose même quand il ne frappe pas.
 *
 * Le moteur ne rend jamais la main sans une liste d'ÉVÉNEMENTS : l'écran les
 * rejoue un par un pour animer. Aucune animation n'est donc décidée ici — mais
 * rien n'arrive à l'écran qui ne soit passé par le moteur.
 *
 * Module ISO : ni DOM ni Node.
 */

import { makeRng, entier } from '../hasard.js';
import { multiplicateur, PRISMATIQUE } from './affinites.js';
import { creerPlateau, recolter, kiDuChemin, cheminValide, LONGUEUR_MAX } from './orbes.js';
import { attaqueDe, RAGE } from './ennemis.js';

/* ------------------------------------------------------------------ */
/* Constantes de réglage                                               */
/* ------------------------------------------------------------------ */

export const SEUIL_SPECIAL = 12;
export const SEUIL_ULTIME = 18;
export const KI_MAX = 24;

/** Ce que rapporte chaque point de ki au-delà du seuil atteint. */
export const KI_SUPPLEMENT = { special: 0.05, ultime: 0.055 };

/** Adoucisseurs de défense : `def / (def + K)` donne la part de dégâts évitée. */
export const K_DEF_ENNEMI = 7000;
export const K_DEF_HEROS = 6200;

/** Une attaque ne peut jamais être complètement absorbée. */
export const PLANCHER = 0.06;

/** Une résonance partagée entre deux héros de la rotation. */
export const RESONANCE_ATK = 0.06;
export const RESONANCE_KI = 1;

/** Deux coups d'affilée valent un peu plus qu'un seul, pas deux fois plus. */
export const PART_DOUBLE = 0.6;

export const PHASE = {
  CHOIX: 'choix',       // à qui le tour ?
  ORBES: 'orbes',       // tracer le chemin
  ACTION: 'action',     // normale, spéciale ou ultime ?
  ENNEMI: 'ennemi',     // la fenêtre ennemie s'ouvre
  VICTOIRE: 'victoire',
  DEFAITE: 'defaite',
};

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

/** Agrégat des éveils gagnés en expédition. Tout est en part (0.2 = +20 %). */
export const EVEILS_VIDES = { atk: 0, def: 0, pv: 0, ki: 0, soin: 0, degats: 0 };

/**
 * Bonus du meneur — le premier héros de l'équipe — appliqué à toute la
 * garnison, y compris à lui-même.
 */
export function bonusMeneur(meneur, heros) {
  const m = meneur?.meneur;
  if (!m) return { atk: 0, def: 0, pv: 0 };
  if (m.cible !== 'tous' && heros.affinite !== m.cible) return { atk: 0, def: 0, pv: 0 };
  return { atk: m.atk || 0, def: m.def || 0, pv: m.pv || 0 };
}

/** Points de vie d'équipe : la somme des six, meneur compris. */
export function vieMaximale(equipe, eveils = EVEILS_VIDES) {
  const meneur = equipe[0];
  return Math.round(equipe.reduce((somme, x) =>
    somme + x.pv * (1 + bonusMeneur(meneur, x).pv + (eveils.pv || 0)), 0));
}

/**
 * Prépare un combat. `ennemis` est déjà instancié (voir `ennemis.js`) : le
 * moteur ne sait rien des paliers, c'est l'expédition qui en décide.
 */
export function creerCombat({ equipe, ennemis, eveils = EVEILS_VIDES, vie = null, objets = 2, seed = null } = {}) {
  if (!Array.isArray(equipe) || equipe.length !== 6) throw new Error('PRISME : il faut six héros.');
  if (!Array.isArray(ennemis) || !ennemis.length) throw new Error('PRISME : il faut un adversaire.');

  const graine = seed ?? Math.floor(Math.random() * 2 ** 31);
  const max = vieMaximale(equipe, eveils);

  const etat = {
    seed: graine,
    rng: makeRng(graine),
    equipe,
    eveils: { ...EVEILS_VIDES, ...eveils },
    vie: vie ? { max, actuel: Math.min(vie, max) } : { max, actuel: max },
    ennemis,
    objets,
    tour: 0,
    rotationIndex: 1,       // `commencerTour` bascule : la première rotation sera 0
    rotation: [],
    ordreRestant: [],
    agi: 0,                 // nombre de héros ayant déjà joué ce tour
    fenetre: 3,
    vise: null,
    plateau: [],
    ki: [0, 0, 0, 0, 0, 0],
    prismes: [0, 0, 0, 0, 0, 0],
    actif: null,
    chemin: null,
    garde: 0,
    elan: null,             // { valeur, tours }
    phase: PHASE.CHOIX,
    journal: [],
  };

  commencerTour(etat);
  return etat;
}

/* ------------------------------------------------------------------ */
/* Statistiques effectives                                             */
/* ------------------------------------------------------------------ */

/** Étiquettes partagées entre deux héros de la rotation : +ATK et +ki. */
export function resonances(etat, idx) {
  const moi = etat.equipe[idx];
  const autres = etat.rotation.filter((i) => i !== idx).map((i) => etat.equipe[i]);
  const communes = new Set();
  for (const a of autres) {
    for (const t of moi.liens) if (a.liens.includes(t)) communes.add(t);
  }
  return [...communes];
}

/**
 * Attaque et défense d'un héros, tout compris. `contexte` porte ce qui dépend
 * du coup en cours : la cible (pour l'opportunisme) et le mode (pour l'écho).
 */
export function statsDe(etat, idx, contexte = {}) {
  const x = etat.equipe[idx];
  const meneur = etat.equipe[0];
  const bm = bonusMeneur(meneur, x);

  let atk = 1 + bm.atk + (etat.eveils.atk || 0);
  let def = 1 + bm.def + (etat.eveils.def || 0);

  const liens = resonances(etat, idx);
  atk += liens.length * RESONANCE_ATK;

  if (etat.elan && etat.elan.tours > 0) atk += etat.elan.valeur;

  const bas = etat.vie.actuel <= etat.vie.max / 2;
  const p = x.passif;
  if (p) {
    if (p.type === 'rage' && bas) atk += p.valeur;
    if (p.type === 'tenace' && bas) def += p.valeur;
    if (p.type === 'meute') {
      const meme = etat.rotation.filter((i) => i !== idx && etat.equipe[i].affinite === x.affinite).length;
      atk += meme * p.valeur;
    }
    if (p.type === 'opportuniste' && contexte.cible
        && multiplicateur(x.affinite, contexte.cible.affinite) > 1) atk += p.valeur;
    if (p.type === 'eclat') atk += (etat.prismes[idx] || 0) * p.valeur;
    if (p.type === 'echo' && contexte.mode === 'ultime') atk += p.valeur;
  }

  return { atk: Math.round(x.atk * atk), def: Math.round(x.def * def), liens };
}

/** Ki de départ d'un héros : son passif de flux, plus les éveils. */
export function kiDeDepart(etat, idx) {
  const x = etat.equipe[idx];
  let ki = etat.eveils.ki || 0;
  if (x.passif?.type === 'flux') ki += x.passif.valeur;
  return ki;
}

/* ------------------------------------------------------------------ */
/* Déroulé d'un tour                                                   */
/* ------------------------------------------------------------------ */

/** Les deux rotations possibles : les trois premiers, puis les trois derniers. */
export function rotationDe(etat, index) {
  return index === 0 ? [0, 1, 2] : [3, 4, 5];
}

export function commencerTour(etat) {
  const ev = [];
  etat.tour++;
  etat.rotationIndex = 1 - etat.rotationIndex;
  etat.rotation = rotationDe(etat, etat.rotationIndex);
  etat.ordreRestant = [...etat.rotation];
  etat.agi = 0;
  etat.garde = 0;
  etat.chemin = null;
  etat.actif = null;
  etat.plateau = creerPlateau(etat.rng);
  etat.ki = etat.ki.map((_, i) => (etat.rotation.includes(i) ? kiDeDepart(etat, i) : 0));
  etat.prismes = etat.prismes.map(() => 0);

  // L'ennemi annonce sa fenêtre et sa cible : c'est ce qui rend l'ordre de
  // passage intéressant plutôt que cosmétique.
  etat.fenetre = 1 + entier(etat.rng, 3);
  etat.vise = etat.rotation[entier(etat.rng, etat.rotation.length)];

  // Brasiers en cours : ils mordent au début du tour, pas au moment du coup.
  for (const e of etat.ennemis) {
    if (e.pv > 0 && e.brasier && e.brasier.tours > 0) {
      const d = Math.round(e.brasier.degats);
      e.pv = Math.max(0, e.pv - d);
      e.brasier.tours--;
      ev.push({ type: 'brasier', ennemi: e, degats: d });
      if (e.pv === 0) ev.push({ type: 'ennemiVaincu', ennemi: e });
    }
    if (e.entrave && e.entrave.tours > 0) e.entrave.tours--;
  }

  etat.phase = PHASE.CHOIX;
  ev.unshift({ type: 'tour', tour: etat.tour, rotation: [...etat.rotation], fenetre: etat.fenetre, vise: etat.vise });
  if (verifierFin(etat, ev)) return ev;
  return ev;
}

/** Le joueur désigne le héros qui joue maintenant. */
export function choisir(etat, idx) {
  if (etat.phase !== PHASE.CHOIX) return { ok: false, raison: 'phase' };
  if (!etat.ordreRestant.includes(idx)) return { ok: false, raison: 'indisponible' };
  etat.actif = idx;
  etat.chemin = null;
  etat.phase = PHASE.ORBES;
  return { ok: true, evenements: [{ type: 'choix', heros: idx }] };
}

/** Le joueur trace son chemin d'orbes et encaisse le ki. */
export function tracer(etat, chemin) {
  if (etat.phase !== PHASE.ORBES) return { ok: false, raison: 'phase' };
  if (!cheminValide(chemin)) return { ok: false, raison: 'chemin' };

  const idx = etat.actif;
  const x = etat.equipe[idx];
  const detail = kiDuChemin(etat.plateau, chemin, x.affinite);
  const avant = etat.ki[idx];
  etat.ki[idx] = Math.min(KI_MAX, avant + detail.total);
  etat.prismes[idx] += detail.prismes;

  const recolte = recolter(etat.plateau, chemin, etat.rng);
  etat.plateau = recolte.plateau;
  etat.chemin = [...chemin];
  etat.phase = PHASE.ACTION;

  return {
    ok: true,
    detail,
    evenements: [{ type: 'recolte', heros: idx, detail, recolte, ki: etat.ki[idx], avant }],
  };
}

/** Les attaques ouvertes au héros actif, avec ce que chacune vaut. */
export function modesDisponibles(etat, idx = etat.actif) {
  const ki = etat.ki[idx] || 0;
  const x = etat.equipe[idx];
  return [
    { mode: 'normale', nom: 'Frappe', ki: 0, ouvert: true, mult: 1 },
    { mode: 'special', nom: x.special.nom, ki: SEUIL_SPECIAL, ouvert: ki >= SEUIL_SPECIAL, mult: multDe(x, 'special', ki) },
    { mode: 'ultime', nom: x.ultime.nom, ki: SEUIL_ULTIME, ouvert: ki >= SEUIL_ULTIME, mult: multDe(x, 'ultime', ki) },
  ];
}

/** Multiplicateur d'un coup, supplément de ki compris. */
export function multDe(x, mode, ki) {
  if (mode === 'normale') return 1;
  const coup = mode === 'ultime' ? x.ultime : x.special;
  const seuil = mode === 'ultime' ? SEUIL_ULTIME : SEUIL_SPECIAL;
  const rab = Math.max(0, Math.min(KI_MAX, ki) - seuil) * KI_SUPPLEMENT[mode];
  return +(coup.mult + rab).toFixed(3);
}

/** Part de dégâts qui passe malgré la défense. */
export const passage = (def, k) => Math.max(PLANCHER, 1 - def / (def + k));

/** Dégâts d'un héros sur un ennemi, sans les appliquer : sert aussi à l'aperçu. */
export function estimerDegats(etat, idx, mode, ennemi) {
  const x = etat.equipe[idx];
  const st = statsDe(etat, idx, { cible: ennemi, mode });
  const mult = multDe(x, mode, etat.ki[idx] || 0);
  const coup = mode === 'ultime' ? x.ultime : mode === 'special' ? x.special : null;

  let perce = 0;
  if (coup?.effet?.type === 'perce') perce = coup.effet.valeur;
  const def = ennemi.def * (1 - perce);

  const type = multiplicateur(x.affinite, ennemi.affinite);
  let brut = st.atk * mult * type * passage(def, K_DEF_ENNEMI) * (1 + (etat.eveils.degats || 0));
  if (coup?.effet?.type === 'double') brut *= PART_DOUBLE * 2;
  if (ennemi.traits.includes('blinde') && mode === 'normale') brut *= 0.7;

  return { degats: Math.max(1, Math.round(brut)), type, mult, atk: st.atk, liens: st.liens };
}

/** Le héros actif frappe. C'est le seul endroit où les ennemis perdent de la vie. */
export function attaquer(etat, { mode = 'normale', cible = 0 } = {}) {
  if (etat.phase !== PHASE.ACTION) return { ok: false, raison: 'phase' };
  const idx = etat.actif;
  const x = etat.equipe[idx];
  const ki = etat.ki[idx] || 0;
  if (mode === 'special' && ki < SEUIL_SPECIAL) return { ok: false, raison: 'ki' };
  if (mode === 'ultime' && ki < SEUIL_ULTIME) return { ok: false, raison: 'ki' };

  const vivants = etat.ennemis.filter((e) => e.pv > 0);
  if (!vivants.length) return { ok: false, raison: 'personne' };
  const ennemi = etat.ennemis[cible]?.pv > 0 ? etat.ennemis[cible] : vivants[0];

  const ev = [];
  const calcul = estimerDegats(etat, idx, mode, ennemi);
  const coup = mode === 'ultime' ? x.ultime : mode === 'special' ? x.special : null;
  const nom = coup ? coup.nom : 'Frappe';
  const coups = coup?.effet?.type === 'double' ? 2 : 1;

  ennemi.pv = Math.max(0, ennemi.pv - calcul.degats);
  ev.push({
    type: 'frappe', heros: idx, mode, nom, cible: etat.ennemis.indexOf(ennemi),
    degats: calcul.degats, coups, mult: calcul.mult, typeMult: calcul.type, ki,
  });

  // Un ennemi « rugueux » rend une part de ce qu'il encaisse.
  if (ennemi.traits.includes('rugueux')) {
    const retour = Math.round(calcul.degats * 0.07);
    etat.vie.actuel = Math.max(0, etat.vie.actuel - retour);
    ev.push({ type: 'retour', degats: retour });
  }
  if (ennemi.traits.includes('vorace') && ennemi.pv > 0) {
    const rendu = Math.round(calcul.degats * 0.06);
    ennemi.pv = Math.min(ennemi.pvMax, ennemi.pv + rendu);
    ev.push({ type: 'ennemiSoin', ennemi, soin: rendu });
  }

  if (coup?.effet) appliquerEffet(etat, idx, coup.effet, ennemi, calcul.degats, ev);

  if (ennemi.pv === 0) ev.push({ type: 'ennemiVaincu', ennemi });
  else if (ennemi.traits.includes('furieux') && !ennemi.enrage && ennemi.pv <= ennemi.pvMax / 2) {
    ennemi.enrage = true;
    ev.push({ type: 'rage', ennemi, part: RAGE });
  }

  etat.ki[idx] = mode === 'normale' ? ki : 0;
  etat.ordreRestant = etat.ordreRestant.filter((i) => i !== idx);
  etat.agi++;
  etat.actif = null;
  etat.chemin = null;

  if (verifierFin(etat, ev)) return { ok: true, evenements: ev };

  // Fenêtre ennemie, puis suite du tour.
  if (etat.agi >= etat.fenetre && !etat.fenetreOuverte) {
    etat.fenetreOuverte = true;
    tourEnnemi(etat, ev);
    if (verifierFin(etat, ev)) return { ok: true, evenements: ev };
  }

  if (!etat.ordreRestant.length) {
    finDeTour(etat, ev);
    if (verifierFin(etat, ev)) return { ok: true, evenements: ev };
  } else {
    etat.phase = PHASE.CHOIX;
  }

  return { ok: true, evenements: ev };
}

/** Effets attachés aux attaques spéciales. */
function appliquerEffet(etat, idx, effet, ennemi, degats, ev) {
  switch (effet.type) {
    case 'soin': {
      const gain = Math.round(etat.vie.max * effet.valeur * (1 + (etat.eveils.soin || 0)));
      const avant = etat.vie.actuel;
      etat.vie.actuel = Math.min(etat.vie.max, etat.vie.actuel + gain);
      ev.push({ type: 'soin', montant: etat.vie.actuel - avant });
      break;
    }
    case 'vol': {
      const gain = Math.round(degats * effet.valeur);
      const avant = etat.vie.actuel;
      etat.vie.actuel = Math.min(etat.vie.max, etat.vie.actuel + gain);
      ev.push({ type: 'soin', montant: etat.vie.actuel - avant, drain: true });
      break;
    }
    case 'garde':
      etat.garde = Math.max(etat.garde, effet.valeur);
      ev.push({ type: 'garde', valeur: effet.valeur });
      break;
    case 'elan':
      etat.elan = { valeur: effet.valeur, tours: 2 };
      ev.push({ type: 'elan', valeur: effet.valeur });
      break;
    case 'entrave':
      ennemi.entrave = { valeur: effet.valeur, tours: 2 };
      ev.push({ type: 'entrave', ennemi, valeur: effet.valeur });
      break;
    case 'brasier':
      ennemi.brasier = { degats: degats * effet.valeur, tours: 2 };
      ev.push({ type: 'brasierPose', ennemi, degats: Math.round(degats * effet.valeur) });
      break;
    case 'ki':
      for (const i of etat.ordreRestant) {
        if (i === idx) continue;
        etat.ki[i] = Math.min(KI_MAX, etat.ki[i] + effet.valeur);
      }
      ev.push({ type: 'ressac', valeur: effet.valeur });
      break;
    default:
      break;  // 'perce' et 'double' sont déjà pris en compte dans le calcul
  }
}

/** La fenêtre ennemie : chaque adversaire encore debout porte son coup. */
export function tourEnnemi(etat, ev = []) {
  etat.phase = PHASE.ENNEMI;
  for (const e of etat.ennemis) {
    if (e.pv <= 0) continue;
    const charge = e.charge.reste <= 1;
    frapperEquipe(etat, e, charge, ev);
    if (etat.vie.actuel <= 0) return ev;
    // Frappe supplémentaire des ennemis vifs, hors attaque chargée.
    if (!charge && e.traits.includes('vif') && etat.rng() < 0.35) {
      frapperEquipe(etat, e, false, ev, 0.55);
      if (etat.vie.actuel <= 0) return ev;
    }
    e.charge.reste = charge ? e.charge.tours : e.charge.reste - 1;
  }
  etat.garde = 0;
  return ev;
}

/** Un coup ennemi sur la barre d'équipe, encaissé par le héros visé. */
function frapperEquipe(etat, ennemi, charge, ev, part = 1) {
  const cible = etat.vise != null && etat.rotation.includes(etat.vise)
    ? etat.vise : etat.rotation[entier(etat.rng, etat.rotation.length)];
  const x = etat.equipe[cible];
  const st = statsDe(etat, cible);

  const type = multiplicateur(ennemi.affinite, x.affinite);
  let brut = attaqueDe(ennemi) * (charge ? ennemi.charge.mult : 1) * part * type;
  brut *= passage(st.def, K_DEF_HEROS);
  brut *= 1 - etat.garde;
  if (x.passif?.type === 'rempart') brut *= 1 - x.passif.valeur;

  const degats = Math.max(1, Math.round(brut));
  etat.vie.actuel = Math.max(0, etat.vie.actuel - degats);
  ev.push({
    type: 'coupEnnemi', ennemi, cible, degats, charge,
    nom: charge ? ennemi.charge.nom : 'Attaque', typeMult: type,
  });

  if (ennemi.traits.includes('venimeux')) {
    const venin = Math.round(degats * 0.12);
    etat.vie.actuel = Math.max(0, etat.vie.actuel - venin);
    ev.push({ type: 'venin', degats: venin });
  }
  if (ennemi.traits.includes('vorace')) {
    const rendu = Math.round(degats * 0.25);
    ennemi.pv = Math.min(ennemi.pvMax, ennemi.pv + rendu);
    ev.push({ type: 'ennemiSoin', ennemi, soin: rendu });
  }
}

function finDeTour(etat, ev) {
  if (etat.elan && etat.elan.tours > 0) {
    etat.elan.tours--;
    if (etat.elan.tours <= 0) etat.elan = null;
  }
  etat.fenetreOuverte = false;
  ev.push(...commencerTour(etat));
}

/** Objet de soin : utilisable au moment de choisir un héros. */
export function utiliserObjet(etat) {
  if (etat.phase !== PHASE.CHOIX) return { ok: false, raison: 'phase' };
  if (etat.objets <= 0) return { ok: false, raison: 'vide' };
  etat.objets--;
  const gain = Math.round(etat.vie.max * 0.3 * (1 + (etat.eveils.soin || 0)));
  const avant = etat.vie.actuel;
  etat.vie.actuel = Math.min(etat.vie.max, etat.vie.actuel + gain);
  return { ok: true, evenements: [{ type: 'objet', montant: etat.vie.actuel - avant }] };
}

/** Victoire, défaite, ou rien du tout. */
export function verifierFin(etat, ev = []) {
  if (etat.vie.actuel <= 0) {
    etat.phase = PHASE.DEFAITE;
    ev.push({ type: 'defaite' });
    return true;
  }
  if (etat.ennemis.every((e) => e.pv <= 0)) {
    etat.phase = PHASE.VICTOIRE;
    ev.push({ type: 'victoire' });
    return true;
  }
  return false;
}

export const estFini = (etat) => etat.phase === PHASE.VICTOIRE || etat.phase === PHASE.DEFAITE;

/* ------------------------------------------------------------------ */
/* Vue                                                                 */
/* ------------------------------------------------------------------ */

/** Tout ce dont l'écran a besoin, et rien de ce qu'il ne doit pas savoir. */
export function vue(etat) {
  return {
    tour: etat.tour,
    phase: etat.phase,
    vie: { ...etat.vie },
    objets: etat.objets,
    rotation: [...etat.rotation],
    ordreRestant: [...etat.ordreRestant],
    actif: etat.actif,
    fenetre: etat.fenetre,
    agi: etat.agi,
    vise: etat.vise,
    elan: etat.elan ? { ...etat.elan } : null,
    garde: etat.garde,
    plateau: [...etat.plateau],
    ki: [...etat.ki],
    equipe: etat.equipe.map((x, i) => ({
      id: x.id, nom: x.nom, affinite: x.affinite, role: x.role,
      ki: etat.ki[i], liens: etat.rotation.includes(i) ? resonances(etat, i) : [],
    })),
    ennemis: etat.ennemis.map((e) => ({
      nom: e.nom, affinite: e.affinite, silhouette: e.silhouette, rang: e.rang,
      pv: e.pv, pvMax: e.pvMax, traits: [...e.traits], enrage: e.enrage,
      charge: { nom: e.charge.nom, reste: e.charge.reste, tours: e.charge.tours },
      entrave: e.entrave && e.entrave.tours > 0 ? e.entrave.valeur : 0,
      brasier: e.brasier && e.brasier.tours > 0 ? Math.round(e.brasier.degats) : 0,
    })),
  };
}

export { LONGUEUR_MAX, PRISMATIQUE };
