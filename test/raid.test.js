/**
 * RAID — le moteur, sous contrat.
 *
 * Tout ce qui décide d'une partie vit dans `public/shared/raid/` et ne
 * touche ni au DOM ni à Node : ces tests peuvent donc l'exercer directement,
 * et l'écran ne sait rien que le moteur n'ait dit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CYCLE, ECOLES, domine, craint, multiplicateur, roueSvg, AVANTAGE, DESAVANTAGE, ESSENCE,
} from '../public/shared/raid/ecoles.js';
import {
  COLONNES, LIGNES, CASES, LONGUEUR_MAX, creerPlateau, voisines, voisinage, cheminValide,
  valeurGlobe, manaDuChemin, recolter, meilleurChemin, MANA_DOUBLE, MANA_SIMPLE,
} from '../public/shared/raid/globes.js';
import {
  HEROS, PAR_ID, ROLES, EFFETS, TALENTS, budgetOf, groupeParDefaut, groupeAuHasard, parEcole,
} from '../public/shared/raid/heros.js';
import {
  MODELES, MODELES_PAR_ID, BOSS_FINAL, TRAITS, SILHOUETTES, instancier, attaqueDe, tirerModele, parRang,
} from '../public/shared/raid/ennemis.js';
import {
  creerCombat, choisir, tracer, attaquer, modesDisponibles, estimerDegats, utiliserObjet,
  vue, estFini, statsDe, synergies, vieMaximale, PHASE, SEUIL_SPECIAL, SEUIL_ULTIME, MANA_MAX,
  rotationDe, multDe,
} from '../public/shared/raid/combat.js';
import {
  creerDonjon, composerRencontre, resoudre, choisirButin, BUTIN, AILES,
  RENCONTRES_PAR_AILE, DIFFICULTES, avancement,
} from '../public/shared/raid/donjon.js';
import { spriteSvg, poses, palettePour, GRID } from '../public/shared/raid/sprites.js';
import { jouerCombatAuto, conseilChemin, conseilCoup, conseilOrdre, pasAuto } from '../public/shared/raid/auto.js';
import { makeRng } from '../public/shared/hasard.js';

/* ------------------------------------------------------------------ */
/* Outils de test                                                      */
/* ------------------------------------------------------------------ */

const rngT = (seed = 42) => makeRng(seed);

/** Un combat contre un unique ennemi taillé sur mesure. */
function combatTest(opts = {}) {
  const ennemi = instancier(MODELES_PAR_ID.gnoll, 1, opts.ecole || 'jade', rngT(3));
  Object.assign(ennemi, opts.ennemi || {});
  return creerCombat({
    equipe: opts.equipe || groupeParDefaut(),
    ennemis: [ennemi],
    seed: opts.seed ?? 77,
    ...opts.combat,
  });
}

/** Joue exactement un tour avec un automate sobre ; renvoie les événements. */
function jouerUnTour(etat, { mode = 'normale' } = {}) {
  const depart = etat.tour;
  const ev = [];
  while (etat.tour === depart && etat.phase === PHASE.CHOIX && etat.ordreRestant.length) {
    const idx = etat.ordreRestant[0];
    choisir(etat, idx);
    const chemin = meilleurChemin(etat.plateau, etat.equipe[idx].ecole).chemin;
    ev.push(...tracer(etat, chemin).evenements);
    const dispo = modesDisponibles(etat).filter((m) => m.ouvert).map((m) => m.mode);
    const choisi = dispo.includes(mode) ? mode : 'normale';
    ev.push(...(attaquer(etat, { mode: choisi, cible: 0 }).evenements || []));
    if (estFini(etat)) break;
  }
  return ev;
}

/* ================================================================== */
/* Écoles                                                          */
/* ================================================================== */

test('le cycle des écoles est fermé et sans point faible', () => {
  assert.equal(CYCLE.length, 5);
  for (const a of CYCLE) {
    assert.ok(ECOLES[a], `${a} doit avoir une fiche`);
    assert.notEqual(domine(a), a);
    assert.equal(craint(domine(a)), a, 'dominer, c\'est être craint');
  }
  // Chaque école domine et est dominée exactement une fois.
  const dominees = CYCLE.map(domine);
  assert.equal(new Set(dominees).size, CYCLE.length);
});

test('les multiplicateurs suivent le cycle', () => {
  const a = CYCLE[0];
  assert.equal(multiplicateur(a, domine(a)), AVANTAGE);
  assert.equal(multiplicateur(a, craint(a)), DESAVANTAGE);
  assert.equal(multiplicateur(a, a), 1);
  assert.equal(multiplicateur(a, 'inconnu'), 1, 'un ennemi sans école ne casse rien');
});

test('la roue se dessine et met le duel en avant', () => {
  const svg = roueSvg();
  for (const a of CYCLE) assert.ok(svg.includes(ECOLES[a].teinte), `${a} doit apparaître`);
  const duel = roueSvg({ moi: CYCLE[0], cible: domine(CYCLE[0]) });
  assert.ok(duel.includes('stroke-width="3"'), 'la flèche du duel est épaissie');
});

/* ================================================================== */
/* Champ d'essence                                                      */
/* ================================================================== */

test('le plateau est plein et ne contient que des globes connues', () => {
  const p = creerPlateau(rngT(1));
  assert.equal(p.length, CASES);
  assert.equal(CASES, COLONNES * LIGNES);
  for (const o of p) assert.ok(CYCLE.includes(o) || o === ESSENCE, `globe inconnue : ${o}`);
});

test('un chemin ne passe que par des cases voisines, jamais deux fois', () => {
  assert.ok(voisines(0, 1));
  assert.ok(voisines(0, COLONNES + 1), 'les diagonales comptent');
  assert.ok(!voisines(0, 2));
  assert.ok(!voisines(COLONNES - 1, COLONNES), 'le bord droit ne touche pas le bord gauche');
  assert.ok(!voisines(3, 3));

  assert.ok(cheminValide([0, 1, 2]));
  assert.ok(!cheminValide([0, 2]), 'il faut être voisin');
  assert.ok(!cheminValide([0, 1, 0]), 'on ne repasse pas');
  assert.ok(!cheminValide([]), 'un chemin vide ne vaut rien');
  assert.ok(!cheminValide([0, -1]));
  assert.ok(!cheminValide([CASES]));
});

test('le chemin est borné en longueur', () => {
  // Un serpent qui balaie la grille : valide jusqu'à la borne, refusé au-delà.
  const serpent = [];
  for (let l = 0; l < LIGNES; l++) {
    const ligne = [...Array(COLONNES).keys()].map((c) => l * COLONNES + c);
    serpent.push(...(l % 2 ? ligne.reverse() : ligne));
  }
  assert.ok(cheminValide(serpent.slice(0, LONGUEUR_MAX)));
  assert.ok(!cheminValide(serpent.slice(0, LONGUEUR_MAX + 1)));
});

test('les globes de son école comptent double, la prismatique aussi', () => {
  assert.equal(valeurGlobe('azur', 'azur'), MANA_DOUBLE);
  assert.equal(valeurGlobe('azur', 'jade'), MANA_SIMPLE);
  assert.equal(valeurGlobe(ESSENCE, 'jade'), MANA_DOUBLE);

  const plateau = new Array(CASES).fill('jade');
  plateau[0] = 'azur'; plateau[1] = ESSENCE; plateau[2] = 'jade';
  const d = manaDuChemin(plateau, [0, 1, 2], 'azur');
  assert.deepEqual(
    { total: d.total, doubles: d.doubles, simples: d.simples, essences: d.essences },
    { total: 2 + 2 + 1, doubles: 1, simples: 1, essences: 1 },
  );
  assert.equal(manaDuChemin(plateau, [0, 2], 'azur').total, 0, 'un chemin invalide ne rapporte rien');
});

test('la récolte tasse les colonnes et complète par le haut', () => {
  const rng = rngT(9);
  const plateau = creerPlateau(rng);
  const chemin = [0, 1, COLONNES + 1];           // deux cases en haut, une en dessous
  const gardees = plateau.filter((_, i) => !chemin.includes(i));
  const r = recolter(plateau, chemin, rng);

  assert.equal(r.plateau.length, CASES);
  assert.ok(r.plateau.every(Boolean), 'aucun trou ne subsiste');
  assert.equal(r.neuves.length, chemin.length, 'autant de neuves que de ramassées');
  // Les survivantes restent dans leur colonne, dans le même ordre.
  for (let col = 0; col < COLONNES; col++) {
    const avant = [];
    for (let l = 0; l < LIGNES; l++) {
      const i = l * COLONNES + col;
      if (!chemin.includes(i)) avant.push(plateau[i]);
    }
    const apres = [];
    for (let l = 0; l < LIGNES; l++) apres.push(r.plateau[l * COLONNES + col]);
    assert.deepEqual(apres.slice(LIGNES - avant.length), avant, `colonne ${col}`);
  }
  assert.equal(gardees.length, CASES - chemin.length);
});

test('le meilleur chemin est un chemin jouable, et il est bon', () => {
  const rng = rngT(5);
  for (let i = 0; i < 12; i++) {
    const plateau = creerPlateau(rng);
    const m = meilleurChemin(plateau, 'azur');
    assert.ok(cheminValide(m.chemin), 'le conseil doit être jouable');
    assert.equal(manaDuChemin(plateau, m.chemin, 'azur').total, m.mana);
    // Un chemin au hasard de même longueur ne doit pas faire mieux.
    const hasard = [0, 1, 2, 3, 4, 5, COLONNES + 5, COLONNES + 4, COLONNES + 3].slice(0, m.chemin.length);
    assert.ok(m.mana >= manaDuChemin(plateau, hasard, 'azur').total);
  }
});

test('le voisinage ne déborde jamais de la grille', () => {
  for (let i = 0; i < CASES; i++) {
    for (const v of voisinage(i)) {
      assert.ok(v >= 0 && v < CASES);
      assert.ok(voisines(i, v));
    }
  }
  assert.equal(voisinage(0).length, 3, 'un coin a trois voisins');
});

/* ================================================================== */
/* Garnison                                                           */
/* ================================================================== */

test('le roster est complète et cohérente', () => {
  assert.equal(HEROS.length, 15);
  assert.equal(new Set(HEROS.map((x) => x.id)).size, 15, 'pas de doublon');
  for (const a of CYCLE) assert.equal(parEcole(a).length, 3, `trois héros ${a}`);
  for (const x of HEROS) {
    assert.ok(ROLES[x.role], `${x.id} : rôle inconnu`);
    assert.ok(CYCLE.includes(x.ecole), `${x.id} : école inconnue`);
    assert.ok(TALENTS[x.talent.type], `${x.id} : talent inconnu`);
    assert.ok(x.liens.length >= 2, `${x.id} doit pouvoir résonner`);
    assert.ok(x.ultime.mult > x.special.mult, `${x.id} : l'ultime doit dépasser la spéciale`);
    for (const coup of [x.special, x.ultime]) {
      if (coup.effet) assert.ok(EFFETS[coup.effet.type], `${x.id} : effet inconnu`);
    }
    assert.ok(x.meneur.texte, `${x.id} : le meneur doit s'expliquer`);
  }
});

test('les héros d’un même rôle valent le même prix', () => {
  for (const role of Object.keys(ROLES)) {
    const prix = HEROS.filter((x) => x.role === role).map(budgetOf);
    const ecart = Math.max(...prix) - Math.min(...prix);
    assert.ok(ecart <= 40, `${role} : écart de ${ecart}, trop large`);
  }
});

test('chaque rôle tient sa promesse', () => {
  const moyenne = (l, f) => l.reduce((s, x) => s + f(x), 0) / l.length;
  const assaut = HEROS.filter((x) => x.role === 'dps');
  const colosse = HEROS.filter((x) => x.role === 'tank');
  const soutien = HEROS.filter((x) => x.role === 'soigneur');

  assert.ok(moyenne(assaut, (x) => x.atk) > moyenne(colosse, (x) => x.atk) * 1.2, 'l’assaut frappe plus fort');
  assert.ok(moyenne(colosse, (x) => x.pv) > moyenne(assaut, (x) => x.pv) * 1.4, 'le colosse porte l’équipe');
  assert.ok(moyenne(colosse, (x) => x.def) > moyenne(assaut, (x) => x.def) * 1.4);
  // Le soutien se paie en effets : ses multiplicateurs sont les plus bas.
  assert.ok(moyenne(soutien, (x) => x.special.mult) < moyenne(assaut, (x) => x.special.mult));
  for (const x of soutien) assert.ok(x.special.effet && x.ultime.effet, `${x.id} doit soutenir`);
});

test('une équipe au hasard est jouable', () => {
  const rng = rngT(4);
  for (let i = 0; i < 20; i++) {
    const eq = groupeAuHasard(rng);
    assert.equal(eq.length, 6);
    assert.equal(new Set(eq.map((x) => x.id)).size, 6, 'jamais deux fois le même héros');
  }
  assert.equal(groupeParDefaut().length, 6);
});

/* ================================================================== */
/* Bestiaire                                                          */
/* ================================================================== */

test('le bestiaire est cohérent', () => {
  assert.equal(new Set(MODELES.map((m) => m.id)).size, MODELES.length);
  for (const m of MODELES) {
    assert.ok(SILHOUETTES.includes(m.silhouette), `${m.id} : silhouette inconnue`);
    for (const t of m.traits) assert.ok(TRAITS[t], `${m.id} : trait inconnu`);
    assert.ok(m.charge.tours >= 2 && m.charge.mult > 1, `${m.id} : charge incohérente`);
  }
  for (const rang of ['trash', 'elite', 'boss']) assert.ok(parRang(rang).length >= 2, rang);
});

test('un ennemi grossit avec le palier', () => {
  const rng = rngT(2);
  const bas = instancier(MODELES_PAR_ID.gnoll, 1, 'jade', rng);
  const haut = instancier(MODELES_PAR_ID.gnoll, 5, 'jade', rng);
  assert.ok(haut.pvMax > bas.pvMax * 2, 'la vie doit vraiment monter');
  assert.ok(haut.atk > bas.atk, 'l’attaque aussi');
  assert.ok(haut.pvMax / bas.pvMax > haut.atk / bas.atk, 'mais moins vite que la vie');
  assert.equal(bas.pv, bas.pvMax);
});

test('rage et entrave pèsent sur l’attaque ennemie', () => {
  const e = instancier(MODELES_PAR_ID.vorgath, 1, 'jade', rngT(6));
  const calme = attaqueDe(e);
  e.enrage = true;
  assert.ok(attaqueDe(e) > calme, 'la rage fait mal');
  e.entrave = { valeur: 0.5, tours: 2 };
  assert.ok(attaqueDe(e) < calme, 'une entrave forte passe devant la rage');
});

test('le tirage évite ce qu’on vient de voir', () => {
  const rng = rngT(8);
  const eviter = parRang('trash').slice(0, 3).map((m) => m.id);
  for (let i = 0; i < 20; i++) assert.ok(!eviter.includes(tirerModele('trash', rng, eviter).id));
});

/* ================================================================== */
/* Combat                                                             */
/* ================================================================== */

test('un combat se monte avec six héros et au moins un adversaire', () => {
  assert.throws(() => creerCombat({ equipe: HEROS.slice(0, 3), ennemis: [1] }), /six/);
  assert.throws(() => creerCombat({ equipe: groupeParDefaut(), ennemis: [] }), /adversaire/);
  const etat = combatTest();
  assert.equal(etat.tour, 1);
  assert.equal(etat.phase, PHASE.CHOIX);
  assert.deepEqual(etat.rotation, rotationDe(etat, 0));
});

test('la barre de vie est celle des six, meneur compris', () => {
  const equipe = groupeParDefaut();
  const somme = equipe.reduce((s, x) => s + x.pv, 0);
  const max = vieMaximale(equipe);
  assert.ok(max > somme, 'le meneur doit gonfler la barre');
  const sansMeneur = vieMaximale([{ ...equipe[0], meneur: null }, ...equipe.slice(1)]);
  assert.ok(max > sansMeneur);
});

test('le mana ne franchit pas ses seuils sans être gagné', () => {
  const etat = combatTest();
  const idx = etat.ordreRestant[0];
  choisir(etat, idx);
  etat.mana[idx] = 0;
  etat.phase = PHASE.ACTION;
  assert.equal(attaquer(etat, { mode: 'special' }).ok, false);
  assert.equal(attaquer(etat, { mode: 'ultime' }).ok, false);
  etat.mana[idx] = SEUIL_SPECIAL;
  assert.equal(modesDisponibles(etat, idx).find((m) => m.mode === 'special').ouvert, true);
  assert.equal(modesDisponibles(etat, idx).find((m) => m.mode === 'ultime').ouvert, false);
  etat.mana[idx] = SEUIL_ULTIME;
  assert.equal(modesDisponibles(etat, idx).find((m) => m.mode === 'ultime').ouvert, true);
});

test('le mana au-delà du seuil renforce le sort, jusqu’au plafond', () => {
  const x = PAR_ID.braz;
  assert.equal(multDe(x, 'normale', 24), 1);
  assert.ok(multDe(x, 'special', SEUIL_SPECIAL + 6) > multDe(x, 'special', SEUIL_SPECIAL));
  assert.equal(multDe(x, 'special', MANA_MAX + 20), multDe(x, 'special', MANA_MAX), 'le plafond plafonne');
});

test('tracer un chemin verse le mana et renouvelle le plateau', () => {
  const etat = combatTest();
  const idx = etat.ordreRestant[0];
  choisir(etat, idx);
  const avant = [...etat.plateau];
  const chemin = meilleurChemin(etat.plateau, etat.equipe[idx].ecole).chemin;
  const r = tracer(etat, chemin);
  assert.ok(r.ok);
  assert.equal(etat.mana[idx], Math.min(MANA_MAX, r.detail.total + 0 + (etat.equipe[idx].talent.type === 'flux' ? etat.equipe[idx].talent.valeur : 0)));
  assert.notDeepEqual(etat.plateau, avant, 'le plateau doit bouger');
  assert.equal(etat.phase, PHASE.ACTION);
  assert.equal(tracer(etat, chemin).ok, false, 'on ne trace pas deux fois');
});

test('l’avantage d’école fait vraiment plus mal', () => {
  const equipe = groupeParDefaut();
  const idx = 1;                                   // Ignar, vermeil
  const fort = combatTest({ ecole: domine(equipe[idx].ecole) });
  const faible = combatTest({ ecole: craint(equipe[idx].ecole) });
  const a = estimerDegats(fort, idx, 'special', fort.ennemis[0]).degats;
  const b = estimerDegats(faible, idx, 'special', faible.ennemis[0]).degats;
  assert.ok(a > b * 1.8, `avantage ${a} contre désavantage ${b}`);
});

test('les synergies récompensent une rotation cohérente', () => {
  const liens = ['fureur', 'assaut'];
  const clone = (id, extra = {}) => ({ ...PAR_ID.braz, id, liens, ...extra });
  const soudee = creerCombat({
    equipe: [clone('a'), clone('b'), clone('c'), clone('d'), clone('e'), clone('f')],
    ennemis: [instancier(MODELES_PAR_ID.gnoll, 1, 'jade', rngT(1))], seed: 5,
  });
  const eparse = creerCombat({
    equipe: [clone('a', { liens: ['x1', 'y1'] }), clone('b', { liens: ['x2', 'y2'] }),
             clone('c', { liens: ['x3', 'y3'] }), clone('d'), clone('e'), clone('f')],
    ennemis: [instancier(MODELES_PAR_ID.gnoll, 1, 'jade', rngT(1))], seed: 5,
  });
  assert.equal(synergies(soudee, 0).length, 2);
  assert.equal(synergies(eparse, 0).length, 0);
  assert.ok(statsDe(soudee, 0).atk > statsDe(eparse, 0).atk, 'les liens doivent payer');
});

test('la fenêtre ennemie s’ouvre au moment annoncé', () => {
  for (const seed of [3, 12, 44, 98, 501]) {
    const etat = combatTest({ seed, ennemi: { pvMax: 9e6, pv: 9e6 } });
    const attendu = etat.fenetre;
    let coups = 0, agis = 0;
    while (etat.phase === PHASE.CHOIX && agis < attendu) {
      const idx = etat.ordreRestant[0];
      choisir(etat, idx);
      tracer(etat, meilleurChemin(etat.plateau, etat.equipe[idx].ecole).chemin);
      const ev = attaquer(etat, { mode: 'normale', cible: 0 }).evenements;
      agis++;
      coups += ev.filter((e) => e.type === 'coupEnnemi').length;
      if (agis < attendu) assert.equal(coups, 0, `seed ${seed} : l’ennemi a frappé trop tôt`);
    }
    assert.ok(coups >= 1, `seed ${seed} : l’ennemi devait frapper au ${attendu}ᵉ`);
  }
});

test('une garde posée avant la fenêtre amortit le coup', () => {
  const mesurer = (garde) => {
    const etat = combatTest({ seed: 21, ennemi: { pvMax: 9e6, pv: 9e6 } });
    etat.fenetre = 1;
    etat.vise = etat.rotation[0];
    etat.garde = garde;
    const ev = [];
    choisir(etat, etat.rotation[0]);
    tracer(etat, meilleurChemin(etat.plateau, etat.equipe[etat.rotation[0]].ecole).chemin);
    ev.push(...attaquer(etat, { mode: 'normale', cible: 0 }).evenements);
    return ev.filter((e) => e.type === 'coupEnnemi').reduce((s, e) => s + e.degats, 0);
  };
  const nu = mesurer(0);
  const garde = mesurer(0.4);
  assert.ok(garde < nu * 0.7, `garde ${garde} contre ${nu}`);
});

test('les effets des spéciales font ce qu’ils annoncent', () => {
  // Soin : la barre remonte, sans dépasser le plafond.
  const etat = combatTest({ ennemi: { pvMax: 9e6, pv: 9e6 } });
  etat.vie.actuel = Math.round(etat.vie.max * 0.4);
  const idx = etat.rotation.find((i) => etat.equipe[i].special.effet?.type === 'soin')
    ?? etat.rotation[0];
  etat.equipe[idx] = { ...etat.equipe[idx], special: { nom: 'Test', mult: 2, effet: { type: 'soin', valeur: 0.2 } } };
  choisir(etat, idx);
  tracer(etat, meilleurChemin(etat.plateau, etat.equipe[idx].ecole).chemin);
  etat.mana[idx] = SEUIL_SPECIAL;
  const ev = attaquer(etat, { mode: 'special', cible: 0 }).evenements;
  const soin = ev.find((e) => e.type === 'soin');
  assert.ok(soin && soin.montant > 0);
  assert.ok(etat.vie.actuel <= etat.vie.max);

  // Brasier : l'ennemi perd de la vie au début des deux tours suivants.
  const b = combatTest({ ennemi: { pvMax: 9e6, pv: 9e6 } });
  const j = b.rotation[0];
  b.equipe[j] = { ...b.equipe[j], ultime: { nom: 'Test', mult: 3, effet: { type: 'brasier', valeur: 0.5 } } };
  choisir(b, j);
  tracer(b, meilleurChemin(b.plateau, b.equipe[j].ecole).chemin);
  b.mana[j] = SEUIL_ULTIME;
  attaquer(b, { mode: 'ultime', cible: 0 });
  assert.ok(b.ennemis[0].brasier.tours > 0, 'le brasier doit être posé');
  const avant = b.ennemis[0].pv;
  while (b.tour < 3 && !estFini(b)) jouerUnTour(b);
  assert.ok(b.ennemis[0].pv < avant, 'le brasier doit mordre');
});

test('l’ultime consomme le mana, la frappe normale le garde', () => {
  const etat = combatTest({ ennemi: { pvMax: 9e6, pv: 9e6 } });
  const idx = etat.rotation[0];
  choisir(etat, idx);
  tracer(etat, meilleurChemin(etat.plateau, etat.equipe[idx].ecole).chemin);
  const mana = etat.mana[idx];
  attaquer(etat, { mode: 'normale', cible: 0 });
  assert.equal(etat.mana[idx], mana, 'une frappe normale ne coûte rien');

  const b = combatTest({ ennemi: { pvMax: 9e6, pv: 9e6 } });
  const j = b.rotation[0];
  choisir(b, j);
  tracer(b, meilleurChemin(b.plateau, b.equipe[j].ecole).chemin);
  b.mana[j] = SEUIL_ULTIME;
  attaquer(b, { mode: 'ultime', cible: 0 });
  assert.equal(b.mana[j], 0, 'l’ultime vide la jauge');
});

test('la rotation alterne et le mana repart de zéro à chaque tour', () => {
  const etat = combatTest({ ennemi: { pvMax: 9e6, pv: 9e6 } });
  assert.deepEqual(etat.rotation, [0, 1, 2]);
  jouerUnTour(etat);
  assert.deepEqual(etat.rotation, [3, 4, 5], 'les trois autres entrent en scène');
  for (const i of [0, 1, 2]) assert.equal(etat.mana[i], 0, 'le mana ne se met pas en réserve');
  jouerUnTour(etat);
  assert.deepEqual(etat.rotation, [0, 1, 2]);
});

test('la victoire et la défaite s’arrêtent net', () => {
  const gagne = combatTest({ ennemi: { pv: 1, pvMax: 1 } });
  const idx = gagne.rotation[0];
  choisir(gagne, idx);
  tracer(gagne, meilleurChemin(gagne.plateau, gagne.equipe[idx].ecole).chemin);
  const ev = attaquer(gagne, { mode: 'normale', cible: 0 }).evenements;
  assert.equal(gagne.phase, PHASE.VICTOIRE);
  assert.ok(ev.some((e) => e.type === 'victoire'));
  assert.equal(choisir(gagne, gagne.rotation[1]).ok, false, 'plus rien après la fin');

  const perdu = combatTest();
  perdu.vie.actuel = 1;
  perdu.fenetre = 1;
  perdu.ennemis[0].atk = 9e6;
  perdu.ennemis[0].pvMax = 9e6; perdu.ennemis[0].pv = 9e6;
  const k = perdu.rotation[0];
  choisir(perdu, k);
  tracer(perdu, meilleurChemin(perdu.plateau, perdu.equipe[k].ecole).chemin);
  attaquer(perdu, { mode: 'normale', cible: 0 });
  assert.equal(perdu.phase, PHASE.DEFAITE);
});

test('la potion soigne, et ne se dépense pas deux fois', () => {
  const etat = combatTest({ combat: { objets: 1 } });
  etat.vie.actuel = 10;
  assert.equal(utiliserObjet(etat).ok, true);
  assert.ok(etat.vie.actuel > 10);
  assert.equal(etat.objets, 0);
  assert.equal(utiliserObjet(etat).ok, false);
});

test('la vue dit tout ce qu’il faut et rien de plus', () => {
  const etat = combatTest();
  const v = vue(etat);
  assert.equal(JSON.stringify(v).includes('function'), false);
  assert.ok(!('rng' in v) && !('seed' in v));
  assert.equal(v.equipe.length, 6);
  assert.equal(v.ennemis[0].pvMax, etat.ennemis[0].pvMax);
  assert.ok(v.rotation.includes(v.vise), 'la cible annoncée est en scène');
  v.rotation.push(99);
  assert.equal(etat.rotation.length, 3, 'la vue est une copie');
});

/* ================================================================== */
/* Donjon                                                         */
/* ================================================================== */

test('un donjon enchaîne quinze rencontres et finit sur le Dragon Cendré', () => {
  const exp = creerDonjon({ groupe: groupeParDefaut(), seed: 12 });
  let n = 0, derniere = null;
  for (;;) {
    derniere = composerRencontre(exp);
    n++;
    const r = resoudre(exp, { victoire: true, vie: exp.vie, objets: exp.objets });
    if (r.suite === 'butin') choisirButin(exp, r.choix[0].id);
    if (r.suite === 'victoire') break;
    assert.ok(n < 50, 'le donjon doit se terminer');
  }
  assert.equal(n, AILES.length * RENCONTRES_PAR_AILE);
  assert.equal(derniere.ennemis[0].nom, MODELES_PAR_ID[BOSS_FINAL].nom);
  assert.ok(derniere.finale);
  assert.ok(exp.victoire && exp.termine);
});

test('un wipe arrête le donjon sur place', () => {
  const exp = creerDonjon({ groupe: groupeParDefaut(), seed: 3 });
  composerRencontre(exp);
  const r = resoudre(exp, { victoire: false, vie: 0, objets: 0 });
  assert.equal(r.suite, 'wipe');
  assert.equal(exp.termine, true);
  assert.equal(exp.victoire, false);
});

test('le butin s’applique sans soigner par accident', () => {
  const exp = creerDonjon({ groupe: groupeParDefaut(), seed: 4 });
  exp.vie = Math.round(exp.vieMax * 0.5);
  exp.choixButin = [BUTIN.find((x) => x.id === 'heaume')];
  assert.equal(choisirButin(exp, 'heaume').ok, true);
  assert.equal(exp.butin.atk, 0.12);
  assert.equal(choisirButin(exp, 'heaume').ok, false, 'une pièce déjà attribuée ne revient pas');

  // « +12 % de vie » conserve la part manquante, et rend ce qu'il promet.
  const b = creerDonjon({ groupe: groupeParDefaut(), seed: 4 });
  b.vie = Math.round(b.vieMax * 0.5);
  b.choixButin = [BUTIN.find((x) => x.id === 'talisman')];
  const maxAvant = b.vieMax;
  choisirButin(b, 'talisman');
  assert.ok(b.vieMax > maxAvant);
  assert.ok(b.vie / b.vieMax > 0.5, 'le rendu doit se voir');
  assert.ok(b.vie <= b.vieMax);
});

test('les trois difficultés sont bien ordonnées', () => {
  const parts = Object.values(DIFFICULTES).map((d) => d.part);
  assert.deepEqual(parts, [...parts].sort((a, b) => a - b), 'normal, héroïque, mythique');
  assert.ok(DIFFICULTES.normal.objets > DIFFICULTES.mythique.objets);

  const dur = creerDonjon({ groupe: groupeParDefaut(), difficulte: 'mythique', seed: 7 });
  const doux = creerDonjon({ groupe: groupeParDefaut(), difficulte: 'normal', seed: 7 });
  assert.ok(composerRencontre(dur).ennemis[0].pvMax > composerRencontre(doux).ennemis[0].pvMax);
});

test('l’avancement progresse de zéro à un', () => {
  const exp = creerDonjon({ groupe: groupeParDefaut(), seed: 2 });
  assert.equal(avancement(exp), 0);
  exp.aile = AILES.length - 1; exp.rencontre = RENCONTRES_PAR_AILE - 1;
  assert.ok(avancement(exp) > 0.9 && avancement(exp) <= 1);
});

/* ================================================================== */
/* Pixel art                                                          */
/* ================================================================== */

test('chaque héros et chaque silhouette se dessinent', () => {
  for (const x of HEROS) {
    for (const [nom, svg] of Object.entries(poses(x))) {
      assert.ok(svg.startsWith('<svg') && svg.includes('<rect'), `${x.id}/${nom}`);
    }
  }
  const rng = rngT(11);
  for (const m of MODELES) {
    const e = instancier(m, 1, 'azur', rng);
    assert.ok(spriteSvg(e, 'frappe').includes('<rect'), m.id);
  }
});

test('deux héros de la même école ne sont pas jumeaux', () => {
  const [a, b] = parEcole('feu');
  assert.notEqual(spriteSvg(a), spriteSvg(b));
  const pa = palettePour({ id: a.id, ecole: 'feu' });
  const pb = palettePour({ id: b.id, ecole: 'feu' });
  assert.notDeepEqual(pa, pb);
  assert.notDeepEqual(
    palettePour({ id: a.id, ecole: 'feu' }),
    palettePour({ id: a.id, ecole: 'givre' }),
    'l’école doit se voir',
  );
  assert.deepEqual(pa, palettePour({ id: a.id, ecole: 'feu' }), 'et rester stable');
});

test('un ennemi se distingue d’un héros de même école', () => {
  const heros = palettePour({ id: 'braz', ecole: 'feu' });
  const bete = palettePour({ id: 'braz', ecole: 'feu', ennemi: true });
  assert.notEqual(heros[5], bete[5]);
  assert.notEqual(heros[7], bete[7], 'l’œil de la bête doit luire');
});

test('les grilles font seize sur seize', () => {
  const sujets = [...HEROS, ...MODELES.map((m) => instancier(m, 1, 'jade', rngT(1)))];
  for (const s of sujets) {
    for (const pose of ['repos', 'frappe']) {
      const svg = spriteSvg(s, pose);
      const ys = [...svg.matchAll(/y="(\d+)"/g)].map((m) => +m[1]);
      const xs = [...svg.matchAll(/x="(\d+)" y/g)].map((m) => +m[1]);
      assert.ok(Math.max(...ys) < GRID, `${s.id || s.nom}/${pose} : déborde en bas`);
      assert.ok(Math.max(...xs) < GRID, `${s.id || s.nom}/${pose} : déborde à droite`);
    }
  }
});

/* ================================================================== */
/* Équilibrage                                                        */
/* ================================================================== */

/**
 * Ces trois tests-là ne vérifient pas une règle mais un réglage : une
 * donjon doit être gagnable sans être acquise. Ils font jouer le
 * conseiller — un joueur appliqué, pas un joueur parfait — d'un bout à
 * l'autre, et n'admettent que des bornes larges : un réglage qui glisse d'un
 * point ne doit pas faire rougir la suite, un réglage qui casse le jeu, si.
 */

/** Un donjon complète, menée par le conseiller. */
function donjonAuto(difficulte, seed) {
  const exp = creerDonjon({ groupe: groupeParDefaut(), difficulte, seed });
  let combats = 0, tours = 0;
  for (;;) {
    const r = composerRencontre(exp);
    const etat = creerCombat({
      equipe: exp.equipe, ennemis: r.ennemis, butin: exp.butin,
      vie: exp.vie, objets: exp.objets, seed: (seed * 31 + combats * 7) | 0,
    });
    etat.vie.max = exp.vieMax;
    etat.vie.actuel = Math.min(exp.vie, exp.vieMax);
    jouerCombatAuto(etat);
    combats++;
    tours += etat.tour;
    const suite = resoudre(exp, {
      victoire: etat.phase === PHASE.VICTOIRE, vie: etat.vie.actuel, objets: etat.objets,
    });
    if (suite.suite === 'wipe') return { victoire: false, combats, tours, aile: exp.aile };
    if (suite.suite === 'victoire') return { victoire: true, combats, tours, aile: exp.aile };
    if (suite.suite === 'butin') choisirButin(exp, suite.choix[0].id);
  }
}

test('un donjon en Normal se termine', () => {
  const runs = [11, 202, 3003].map((s) => donjonAuto('normal', s));
  assert.ok(runs.every((r) => r.victoire), 'le premier palier ne doit pas être un mur');
  assert.ok(runs.every((r) => r.combats === AILES.length * RENCONTRES_PAR_AILE));
});

test('aucun combat ne s’éternise', () => {
  const runs = [11, 202, 3003].map((s) => donjonAuto('normal', s));
  for (const r of runs) {
    const parCombat = r.tours / r.combats;
    assert.ok(parCombat >= 1.5, `${parCombat.toFixed(1)} tours par combat : trop expéditif`);
    assert.ok(parCombat <= 9, `${parCombat.toFixed(1)} tours par combat : trop long`);
  }
});

test('le mode Mythique reste une épreuve', () => {
  const doux = [5, 55].map((s) => donjonAuto('normal', s));
  const dur = [5, 55].map((s) => donjonAuto('mythique', s));
  const avance = (r) => r.aile + (r.victoire ? 1 : 0);
  assert.ok(
    dur.reduce((s, r) => s + avance(r), 0) < doux.reduce((s, r) => s + avance(r), 0),
    'le palier le plus dur doit arrêter plus tôt',
  );
});
