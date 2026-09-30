/**
 * RAID — le donjon et sa progression.
 *
 * Une partie n'est pas un combat mais une descente : cinq ailes de trois
 * rencontres, une seule barre de vie qui ne se remplit pas toute seule, et
 * une pièce de butin à choisir après chaque boss d'aile. On ne recommence
 * pas un combat perdu — on recommence le donjon. C'est ce qui donne son prix
 * à une potion gardée pour plus tard.
 *
 * Entre deux combats, le raid gagne de l'expérience, monte de niveau, choisit
 * des dons, et répond aux questions que le donjon lui pose (voir
 * `aventure.js`). Tout ce qui attend une décision du joueur s'empile dans
 * `run.file`, que l'écran dépile dans l'ordre.
 *
 * Module ISO : ni DOM ni Node.
 */

import { makeRng, entier, melanger } from '../hasard.js';
import { CYCLE } from './ecoles.js';
import { instancier, tirerModele, MODELES_PAR_ID, BOSS_FINAL } from './ennemis.js';
import { vieMaximale, BUTIN_VIDE } from './combat.js';
import {
  niveauDe, xpDeRencontre, NIVEAUX_DON, DONS, EVENEMENTS, EVENEMENTS_PAR_ID,
  CHANCE_DEPART, CHANCE_MAX, reussiteDe, texteEffet,
} from './aventure.js';

export const RENCONTRES_PAR_AILE = 3;

export const AILES = [
  { nom: 'Les Galeries Noyées', ecole: 'nature', decor: 'galerie',
    texte: 'L’eau monte, et quelque chose nage dedans.' },
  { nom: 'Le Cloître Profané', ecole: 'ombre', decor: 'cloitre',
    texte: 'On y priait. On y prie encore, mais pas la même chose.' },
  { nom: 'La Forge Ardente', ecole: 'feu', decor: 'forge',
    texte: 'Les soufflets tournent, et personne ne les tient.' },
  { nom: 'Le Sanctuaire Gelé', ecole: 'givre', decor: 'sanctuaire',
    texte: 'Tout y est intact. Tout y est figé.' },
  { nom: 'Le Pic de l’Aube', ecole: 'sacre', decor: 'pic',
    texte: 'Au sommet, le Dragon Cendré attend son heure.' },
];

/**
 * Force du bestiaire par aile, en plus de sa croissance propre.
 *
 * Le raid part affaibli (niveau 1) face à des meutes plus endurantes et qui
 * frappent fort : ce sont leurs coups, plus que leur vie, qui entament la
 * barre commune — c'était elle qui restait pleine d'un bout à l'autre des
 * premières ailes. Plus loin, le raid a grandi : la dureté ne monte plus que
 * par la vie, et c'est son niveau, ses dons et ses choix qui décident.
 *
 * Réglé au conseiller sur trente donjons : Normal presque toujours bouclé,
 * Héroïque une fois sur deux, Mythique rarement ; en Héroïque, on sort de la
 * première aile avec environ 70 % de vie, contre 97 % auparavant.
 */
export const DURETE_AILE = [
  { pv: 1.5, atk: 2.2 },
  { pv: 1.45, atk: 1.9 },
  { pv: 1.2, atk: 1.3 },
  { pv: 1.25, atk: 1.3 },
  { pv: 1.35, atk: 1.25 },
];

export const DIFFICULTES = {
  normal:    { nom: 'Normal',   part: 0.85, objets: 3, texte: 'Pour apprendre les mécaniques.' },
  heroique:  { nom: 'Héroïque', part: 1.0,  objets: 2, texte: 'Le donjon tel qu’il est réglé.' },
  mythique:  { nom: 'Mythique', part: 1.1,  objets: 1, texte: 'Une erreur de placement se paie.' },
};

/* ------------------------------------------------------------------ */
/* Butin                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ce que lâche un boss d'aile. Chaque pièce est modeste : c'est son
 * empilement sur quatre ailes qui doit compenser la montée du bestiaire, pas
 * une seule trouvaille providentielle.
 */
export const BUTIN = [
  { id: 'heaume', nom: 'Heaume de bataille', glyphe: '⛑', rarete: 'rare',
    texte: '+12 % d’attaque à tout le raid', effet: { atk: 0.12 } },
  { id: 'plastron', nom: 'Plastron runique', glyphe: '🛡', rarete: 'rare',
    texte: '+14 % d’armure à tout le raid', effet: { def: 0.14 } },
  { id: 'talisman', nom: 'Talisman de vitalité', glyphe: '💠', rarete: 'rare',
    texte: '+12 % de vie maximale, et autant de rendu', effet: { pv: 0.12 }, rendu: 0.12 },
  { id: 'anneau', nom: 'Anneau de mana', glyphe: '💍', rarete: 'rare',
    texte: '+2 mana au départ de chaque tour', effet: { mana: 2 } },
  { id: 'sceptre', nom: 'Sceptre de vie', glyphe: '🔮', rarete: 'epique',
    texte: '+30 % à tous les soins', effet: { soin: 0.3 } },
  { id: 'lame', nom: 'Lame affûtée', glyphe: '🗡', rarete: 'epique',
    texte: '+9 % de dégâts sur tous les sorts', effet: { degats: 0.09 } },
  { id: 'sacoche', nom: 'Sacoche de potions', glyphe: '🧪', rarete: 'commun',
    texte: 'Une potion de plus, et 20 % de vie rendue', effet: {}, objets: 1, rendu: 0.2 },
  { id: 'repos', nom: 'Feu de camp', glyphe: '🔥', rarete: 'commun',
    texte: 'Le raid souffle : 45 % de la vie rendue', effet: {}, rendu: 0.45 },
];

export const BUTIN_PAR_ID = Object.fromEntries(BUTIN.map((x) => [x.id, x]));

/** Couleurs de rareté, dans la convention du genre. */
export const RARETES = {
  commun: { nom: 'commun', teinte: '#9fd66f' },
  rare:   { nom: 'rare',   teinte: '#5ea9ff' },
  epique: { nom: 'épique', teinte: '#c77dff' },
};

/* ------------------------------------------------------------------ */
/* Donjon                                                              */
/* ------------------------------------------------------------------ */

export function creerDonjon({ groupe, difficulte = 'heroique', seed = null } = {}) {
  if (!Array.isArray(groupe) || groupe.length !== 6) throw new Error('RAID : il faut six personnages.');
  const graine = seed ?? Math.floor(Math.random() * 2 ** 31);
  const regle = DIFFICULTES[difficulte] || DIFFICULTES.heroique;

  const run = {
    seed: graine,
    rng: makeRng(graine),
    difficulte,
    groupe,
    equipe: groupe,              // le moteur de combat parle d'équipe
    butin: { ...BUTIN_VIDE },
    acquis: [],
    aile: 0,
    rencontre: 0,
    objets: regle.objets,
    vie: 0,
    vieMax: 0,
    vus: [],
    termine: false,
    victoire: false,
    choixButin: null,
    // L'aventure
    niveau: 1,
    xp: 0,
    chance: CHANCE_DEPART,
    dons: [],
    menaces: [],          // [{ cible: 'aile'|'final', aile, pv, atk, retire, source }]
    evenementsVus: [],
    file: [],             // décisions en attente : 'don', 'butin', 'evenement'
    choixDon: null,
    donsEnAttente: 0,
    evenement: null,
    enCours: null,        // la rencontre engagée, pour savoir ce qu'elle rapporte
  };
  run.vieMax = vieMaximale(groupe, butinCombat(run));
  run.vie = run.vieMax;
  return run;
}

/**
 * Ce que le moteur de combat doit savoir du raid : son butin, son niveau et
 * sa chance. C'est la seule porte entre l'aventure et le combat.
 */
export const butinCombat = (run) => ({ ...run.butin, niveau: run.niveau, chance: run.chance });

/** Recalcule la vie maximale en gardant la part de vie, puis soigne éventuellement. */
function recalerVie(run, rendu = 0) {
  const part = run.vieMax ? run.vie / run.vieMax : 1;
  run.vieMax = vieMaximale(run.groupe, butinCombat(run));
  run.vie = Math.round(run.vieMax * part);
  if (rendu) run.vie = Math.max(1, Math.min(run.vieMax, run.vie + Math.round(run.vieMax * rendu)));
}

/** Numéro de rencontre affichable : « aile 2 · pull 3 ». */
export const etiquette = (run) =>
  `Aile ${run.aile + 1} · pull ${run.rencontre + 1}/${RENCONTRES_PAR_AILE}`;

export const aileCourante = (run) => AILES[Math.min(run.aile, AILES.length - 1)];

/**
 * Compose la rencontre suivante. Le rang monte à l'intérieur de l'aile, et la
 * dernière rencontre du donjon est toujours le Dragon Cendré : une descente
 * doit avoir une fin reconnaissable.
 */
export function composerRencontre(run) {
  const aile = aileCourante(run);
  const palier = run.aile + 1;
  const regle = DIFFICULTES[run.difficulte] || DIFFICULTES.heroique;
  const derniereAile = run.aile === AILES.length - 1;
  const derniere = run.rencontre === RENCONTRES_PAR_AILE - 1;

  let modeles;
  if (derniere && derniereAile) {
    modeles = [MODELES_PAR_ID[BOSS_FINAL]];
  } else if (derniere) {
    modeles = [tirerModele(run.aile >= 2 ? 'boss' : 'elite', run.rng, run.vus)];
  } else if (run.rencontre === 1) {
    modeles = run.aile >= 1
      ? [tirerModele('elite', run.rng, run.vus)]
      : [tirerModele('trash', run.rng, run.vus), tirerModele('trash', run.rng, run.vus)];
  } else {
    modeles = [tirerModele('trash', run.rng, run.vus)];
    if (run.aile >= 2) modeles.push(tirerModele('trash', run.rng, [modeles[0].id]));
  }

  run.vus = modeles.map((m) => m.id);

  // Écoles : celle de l'aile domine, mais jamais au point que le joueur n'ait
  // qu'une seule réponse à préparer.
  const durete = DURETE_AILE[Math.min(run.aile, DURETE_AILE.length - 1)];
  const menaces = derniere ? menacesDuBoss(run, derniereAile) : { pv: 0, atk: 0, retire: 0, sources: [] };
  const ennemis = modeles.map((m, i) => {
    const ecole = run.rng() < 0.55 ? aile.ecole : CYCLE[entier(run.rng, CYCLE.length)];
    const e = instancier(m, palier, ecole, run.rng);
    e.pvMax = Math.round(e.pvMax * regle.part * durete.pv * (1 + menaces.pv));
    e.pv = e.pvMax;
    e.atk = Math.round(e.atk * regle.part * durete.atk * (1 + menaces.atk));
    e.def = Math.round(e.def * regle.part);
    for (let k = 0; k < menaces.retire; k++) retirerTrait(e);
    e.place = i;
    return e;
  });

  run.enCours = { boss: derniere, rangs: ennemis.map((e) => e.rang) };

  return {
    menaces: menaces.sources,
    ennemis,
    palier,
    aile,
    boss: derniere,
    finale: derniere && derniereAile,
    titre: derniere ? (derniereAile ? 'Boss de fin' : 'Boss d’aile') : 'Pull',
  };
}

/**
 * Enregistre l'issue d'un combat et fait avancer le donjon. Renvoie ce que
 * l'écran doit montrer ensuite : la suite, un choix de butin, ou la fin.
 */
export function resoudre(run, { victoire, vie, objets }) {
  run.vie = Math.max(0, Math.round(vie));
  run.objets = objets;

  if (!victoire) {
    run.termine = true;
    run.victoire = false;
    return { suite: 'wipe' };
  }

  // L'expérience, et ce qu'elle ouvre.
  const enCours = run.enCours || { boss: run.rencontre === RENCONTRES_PAR_AILE - 1, rangs: ['trash'] };
  const xp = gagnerXp(run, xpDeRencontre({ boss: enCours.boss, ennemis: enCours.rangs.map((rang) => ({ rang })) }));
  if (run.butin.recup) recalerVie(run, run.butin.recup);
  run.enCours = null;

  run.rencontre++;
  if (run.rencontre < RENCONTRES_PAR_AILE) {
    // Un événement après la première meute de chaque aile, parfois après la seconde.
    if (run.rencontre === 1 || run.rng() < 0.45) proposerEvenement(run);
    return { suite: prochaineEtape(run), xp };
  }

  run.rencontre = 0;
  run.aile++;
  // Les menaces d'une aile ne survivent pas à son boss.
  run.menaces = run.menaces.filter((m) => m.cible === 'final');
  if (run.aile >= AILES.length) {
    run.termine = true;
    run.victoire = true;
    run.file = [];
    return { suite: 'victoire', xp };
  }

  run.choixButin = proposerButin(run);
  run.file.push('butin');
  return { suite: prochaineEtape(run), choix: run.choixButin, xp };
}

/** La prochaine décision attendue, ou la suite du donjon. */
export const prochaineEtape = (run) =>
  run.file[0] || (run.termine ? (run.victoire ? 'victoire' : 'wipe') : 'combat');

function defiler(run, quoi) {
  const i = run.file.indexOf(quoi);
  if (i >= 0) run.file.splice(i, 1);
}

/* ------------------------------------------------------------------ */
/* Expérience et dons                                                  */
/* ------------------------------------------------------------------ */

/** Ajoute de l'expérience ; chaque niveau renforce, certains ouvrent un don. */
export function gagnerXp(run, gain) {
  const niveauAvant = run.niveau;
  run.xp += gain;
  run.niveau = niveauDe(run.xp);
  if (run.niveau !== niveauAvant) recalerVie(run);
  const dons = NIVEAUX_DON.filter((n) => n > niveauAvant && n <= run.niveau).length;
  for (let k = 0; k < dons; k++) {
    if (run.file.includes('don')) { run.donsEnAttente++; continue; }
    run.choixDon = proposerDons(run);
    run.file.unshift('don');
  }
  return { gain, niveauAvant, niveauApres: run.niveau, xp: run.xp, dons };
}

export function proposerDons(run, combien = 3) {
  const pot = DONS.filter((d) => !run.dons.includes(d.id));
  return melanger([...pot], run.rng).slice(0, combien);
}

/** Applique un effet de l'aventure au raid : dons comme événements passent ici. */
export function appliquerEffet(run, e, source = '') {
  for (const [k, v] of Object.entries(e.butin || {})) run.butin[k] = (run.butin[k] || 0) + v;
  if (e.chance) run.chance = Math.max(0, Math.min(CHANCE_MAX, run.chance + e.chance));
  if (e.objets) run.objets = Math.max(0, run.objets + e.objets);
  if (e.boss) {
    run.menaces.push({
      cible: e.boss.cible, aile: run.aile, pv: e.boss.pv || 0, atk: e.boss.atk || 0,
      retire: e.boss.retire ? 1 : 0, source,
    });
  }
  if (e.sauter && run.rencontre < RENCONTRES_PAR_AILE - 1) run.rencontre++;
  let piece = null;
  if (e.piece) {
    piece = proposerButin(run, 1)[0];
    for (const [k, v] of Object.entries(piece.effet)) run.butin[k] = (run.butin[k] || 0) + v;
    if (piece.objets) run.objets += piece.objets;
    run.acquis.push(piece.id);
  }
  // La vie en dernier : un bonus de vie maximale doit compter avant le soin.
  recalerVie(run, (e.vie || 0) + ((piece && piece.rendu) || 0));
  if (e.xp) gagnerXp(run, e.xp);
  return { piece };
}

export function choisirDon(run, id) {
  const don = (run.choixDon || []).find((d) => d.id === id);
  if (!don) return { ok: false, raison: 'inconnu' };
  run.dons.push(don.id);
  run.choixDon = null;
  defiler(run, 'don');
  appliquerEffet(run, don.effet, don.nom);
  if (run.donsEnAttente > 0 && !run.file.includes('don')) {
    run.donsEnAttente--;
    run.choixDon = proposerDons(run);
    run.file.unshift('don');
  }
  return { ok: true, don };
}

/* ------------------------------------------------------------------ */
/* Événements                                                          */
/* ------------------------------------------------------------------ */

function evenementPossible(run, ev) {
  if (run.evenementsVus.includes(ev.id)) return false;
  if (ev.ailes && (run.aile < ev.ailes[0] || run.aile > ev.ailes[1])) return false;
  // Le raccourci n'a de sens que tant qu'une meute sépare encore du boss.
  if (ev.seulement === 'debut' && run.rencontre !== 1) return false;
  return true;
}

export function proposerEvenement(run) {
  const pot = EVENEMENTS.filter((ev) => evenementPossible(run, ev));
  if (!pot.length) return null;
  const ev = pot[entier(run.rng, pot.length)];
  run.evenementsVus.push(ev.id);
  run.evenement = ev.id;
  run.file.push('evenement');
  return ev;
}

/** Un choix est-il payable ? Une potion qu'on n'a pas ne se jette pas. */
export const choixPossible = (run, c) => !c.exige || !c.exige.objets || run.objets >= c.exige.objets;

/** L'événement en attente, tel que l'écran doit le présenter. */
export function evenementCourant(run) {
  const ev = run.evenement && EVENEMENTS_PAR_ID[run.evenement];
  if (!ev) return null;
  return {
    ...ev,
    choix: ev.choix.map((c) => ({
      ...c,
      possible: choixPossible(run, c),
      chance: c.risque ? reussiteDe(c.risque.base, run.chance) : null,
      annonce: c.risque
        ? `réussite : ${texteEffet(c.risque.succes)} · échec : ${texteEffet(c.risque.echec)}`
        : texteEffet(c.effet),
    })),
  };
}

export function choisirEvenement(run, choixId) {
  const ev = run.evenement && EVENEMENTS_PAR_ID[run.evenement];
  const c = ev && ev.choix.find((x) => x.id === choixId);
  if (!c) return { ok: false, raison: 'inconnu' };
  if (!choixPossible(run, c)) return { ok: false, raison: 'exige' };

  let effet = c.effet || {};
  let dit = c.dit || '';
  let reussi = null;
  if (c.risque) {
    reussi = run.rng() < reussiteDe(c.risque.base, run.chance);
    effet = reussi ? c.risque.succes : c.risque.echec;
    dit = reussi ? c.risque.ditSucces : c.risque.ditEchec;
  }
  run.evenement = null;
  defiler(run, 'evenement');
  const { piece } = appliquerEffet(run, effet, ev.titre);
  return { ok: true, reussi, dit, effet: texteEffet(effet), piece };
}

/** Ce que les choix du raid ont fait au boss à venir. */
export function menacesDuBoss(run, finale = false) {
  const concernees = run.menaces.filter((m) =>
    (m.cible === 'aile' && m.aile === run.aile) || (m.cible === 'final' && finale));
  return {
    pv: concernees.reduce((s, m) => s + m.pv, 0),
    atk: concernees.reduce((s, m) => s + m.atk, 0),
    retire: concernees.reduce((s, m) => s + m.retire, 0),
    sources: concernees,
  };
}

/** Les atouts d'un boss, du plus redoutable au moins gênant : on retire le premier. */
const ORDRE_TRAITS = ['enrage', 'fureur', 'frenesie', 'drain', 'poison', 'epines', 'carapace'];
function retirerTrait(e) {
  const t = ORDRE_TRAITS.find((x) => e.traits.includes(x)) || e.traits[0];
  if (t) e.traits = e.traits.filter((x) => x !== t);
}

/**
 * Conseil pour l'automate et la démonstration : le choix qui rapporte le plus
 * en moyenne, la vie comptant d'autant plus qu'elle manque.
 */
export function conseilEvenement(run) {
  const ev = evenementCourant(run);
  if (!ev) return null;
  const manque = 1 - run.vie / run.vieMax;
  const valeur = (e) => {
    let v = 0;
    if (e.vie) v += e.vie * (e.vie > 0 ? 60 + 140 * manque : 120);
    if (e.xp) v += e.xp * 0.25;
    if (e.chance) v += e.chance * 1.5;
    if (e.objets) v += e.objets * 12;
    for (const [k, x] of Object.entries(e.butin || {})) v += (k === 'mana' ? x * 0.1 : x) * 150;
    if (e.piece) v += 15;
    if (e.boss) v -= ((e.boss.pv || 0) + (e.boss.atk || 0)) * 120 - (e.boss.retire ? 12 : 0);
    if (e.sauter) v -= 6;
    return v;
  };
  let meilleur = null;
  for (const c of ev.choix.filter((x) => x.possible)) {
    const v = c.risque
      ? c.chance * valeur(c.risque.succes) + (1 - c.chance) * valeur(c.risque.echec)
      : valeur(c.effet);
    if (!meilleur || v > meilleur.v) meilleur = { id: c.id, v };
  }
  return meilleur && meilleur.id;
}

/** Trois pièces au hasard ; les consommables peuvent retomber, pas le reste. */
export function proposerButin(run, combien = 3) {
  const pot = BUTIN.filter((x) => x.id === 'repos' || x.id === 'sacoche' || !run.acquis.includes(x.id));
  // La chance attire les pièces épiques : un tirage pondéré, sans remise.
  const poids = (x) => (x.rarete === 'epique' ? 1 + (run.chance || 0) / 10 : 1);
  const reste = melanger([...pot], run.rng);
  const liste = [];
  while (liste.length < combien && reste.length) {
    const total = reste.reduce((s, x) => s + poids(x), 0);
    let t = run.rng() * total;
    const i = reste.findIndex((x) => (t -= poids(x)) < 0);
    liste.push(reste.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return liste.length ? liste : [BUTIN_PAR_ID.repos];
}

export function choisirButin(run, id) {
  const piece = (run.choixButin || []).find((x) => x.id === id);
  if (!piece) return { ok: false, raison: 'inconnu' };

  for (const [cle, valeur] of Object.entries(piece.effet)) {
    run.butin[cle] = (run.butin[cle] || 0) + valeur;
  }
  if (piece.objets) run.objets += piece.objets;
  run.acquis.push(piece.id);

  // La vie maximale bouge avec le butin : on conserve la part manquante
  // plutôt que le nombre brut, sinon « +12 % de vie » soignerait à l'envers.
  recalerVie(run, piece.rendu || 0);

  run.choixButin = null;
  defiler(run, 'butin');
  return { ok: true, piece };
}

/** Avancement en pour-cent, pour la barre de progression. */
export function avancement(run) {
  const total = AILES.length * RENCONTRES_PAR_AILE;
  return Math.min(1, (run.aile * RENCONTRES_PAR_AILE + run.rencontre) / total);
}
