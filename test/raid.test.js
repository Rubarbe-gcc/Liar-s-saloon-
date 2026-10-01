/**
 * RAID — le jeu de rôle, sous contrat.
 *
 * Tout ce qui décide d'une partie vit dans `public/shared/raid/` et ne
 * touche ni au DOM ni à Node : ces tests peuvent donc l'exercer directement,
 * et l'écran ne sait rien que le moteur n'ait dit.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CYCLE, ECOLES, domine, craint, multiplicateur, roueSvg, AVANTAGE, DESAVANTAGE,
} from '../public/shared/raid/ecoles.js';
import { HEROS, PAR_ID, ROLES, EFFETS, parEcole, LEGENDES } from '../public/shared/raid/heros.js';
import { MODELES, MODELES_PAR_ID, TRAITS, SILHOUETTES, parRang, BOSS_FINAL } from '../public/shared/raid/ennemis.js';
import {
  creerPersonnage, statsDe, statsBase, gagnerXp, niveauDe, SEUILS_XP, NIVEAU_MAX, NIVEAU_ULTIME,
  sortsDe, DEPARTS, progressionNiveau,
} from '../public/shared/raid/personnages.js';
import {
  forger, MODELES as PIECES, pieceAuHasard, tirerRarete, texteBonus, RARETES, ORDRE_RARETES, TROPHEES,
  forgerTrophee, valeurPiece,
} from '../public/shared/raid/equipement.js';
import {
  genererCarte, accessibles, composer, ennemiRpg, ACTES, RANGEES, ECHELLE,
} from '../public/shared/raid/carte.js';
import {
  creerBataille, demarrer, actif, actionsDe, agir, estimer, vivants, critiqueDe, provocateur,
} from '../public/shared/raid/bataille.js';
import * as A from '../public/shared/raid/aventure.js';
import { jouerCombat, jouerAventure, choisirAction } from '../public/shared/raid/ia.js';
import { spriteSvg, poses, palettePour, GRID } from '../public/shared/raid/sprites.js';
import { makeRng } from '../public/shared/hasard.js';
import * as T from '../public/shared/raid/talents.js';
import { versCode, depuisCode } from '../public/games/raid/js/transfert.js';
import * as sauvegarde from '../server/sauvegarde.js';
import { EVEILS, texteEveil, eveilDe, COUT_EVEIL } from '../public/shared/raid/eveils.js';
import { RELIQUES, bonusReliques, QUETES } from '../public/shared/raid/reliques.js';

const rngT = (seed = 42) => makeRng(seed);
const gnoll = (acte = 1, o = {}) => ennemiRpg(MODELES_PAR_ID.gnoll, acte, o.ecole || 'nature', rngT(3), o);

/** Une bataille sur mesure. */
function batailleTest({ ids = ['brandel', 'kaelis'], niveau = 3, ennemis = [gnoll()], inventaire, seed = 7 } = {}) {
  const groupe = ids.map((id) => creerPersonnage(id, niveau));
  const b = creerBataille({
    groupe, ennemis, inventaire: inventaire || { potion: 1, elixir: 1, phenix: 1 }, rng: rngT(seed),
  });
  return { b, groupe };
}

/** Avance l'aventure jusqu'à une étape du type voulu. */
function jusqua(av, type, max = 500) {
  for (let i = 0; i < max; i++) {
    if (av.etape && av.etape.type === type) return true;
    if (!av.etape) {
      const n = A.sallesAccessibles(av).find((x) => x.type === type) || A.sallesAccessibles(av)[0];
      A.entrer(av, n.id);
      continue;
    }
    // On résout ce qui se présente sans se soucier du reste.
    const e = av.etape;
    if (e.type === 'combat') A.conclureCombat(av, true);
    else if (e.type === 'recompense') A.prendreRecompense(av);
    else if (e.type === 'don') A.choisirDon(av, e.choix[0].id);
    else if (e.type === 'evenement') A.choisirEvenement(av, A.evenementCourant(av).choix.find((c) => c.possible).id);
    else if (e.type === 'repos') A.faireRepos(av, 'repos');
    else if (e.type === 'tresor') A.prendreTresor(av);
    else A.terminerEtape(av);
  }
  return false;
}

/* ================================================================== */
/* Écoles, roster, bestiaire                                          */
/* ================================================================== */

test('le cycle des écoles est fermé et sans point faible', () => {
  assert.equal(CYCLE.length, 5);
  for (const a of CYCLE) {
    assert.ok(ECOLES[a]);
    assert.equal(craint(domine(a)), a);
  }
  assert.equal(new Set(CYCLE.map(domine)).size, CYCLE.length);
  const a = CYCLE[0];
  assert.equal(multiplicateur(a, domine(a)), AVANTAGE);
  assert.equal(multiplicateur(a, craint(a)), DESAVANTAGE);
  assert.equal(multiplicateur(a, a), 1);
  assert.ok(roueSvg().includes('<svg'));
});

test('le roster est complet et cohérent', () => {
  assert.equal(HEROS.length, 15);
  for (const a of CYCLE) assert.equal(parEcole(a).length, 3);
  for (const x of HEROS) {
    assert.ok(ROLES[x.role]);
    for (const coup of [x.special, x.ultime]) if (coup.effet) assert.ok(EFFETS[coup.effet.type], x.id);
  }
  for (const id of DEPARTS) assert.ok(PAR_ID[id], id);
  assert.equal(new Set(DEPARTS.map((id) => PAR_ID[id].role)).size, 3, 'les trois rôles au départ');
});

test('le bestiaire est cohérent', () => {
  for (const m of MODELES) {
    assert.ok(SILHOUETTES.includes(m.silhouette), m.id);
    for (const t of m.traits) assert.ok(TRAITS[t], `${m.id} : ${t}`);
  }
  for (const rang of ['trash', 'elite', 'boss']) assert.ok(parRang(rang).length >= 2, rang);
});

/* ================================================================== */
/* Personnages                                                        */
/* ================================================================== */

test('les niveaux suivent l’expérience', () => {
  assert.equal(niveauDe(0), 1);
  assert.equal(niveauDe(SEUILS_XP[2]), 2);
  assert.equal(niveauDe(SEUILS_XP[2] - 1), 1);
  assert.equal(niveauDe(1e9), NIVEAU_MAX);
  assert.equal(progressionNiveau(1e9), 1);
  for (let n = 2; n <= NIVEAU_MAX; n++) assert.ok(SEUILS_XP[n] > SEUILS_XP[n - 1]);
});

test('un personnage commence modeste et grandit vraiment', () => {
  for (const id of DEPARTS) {
    const bas = statsBase(creerPersonnage(id, 1));
    const haut = statsBase(creerPersonnage(id, NIVEAU_MAX));
    assert.ok(haut.pvMax > bas.pvMax * 2.2, `${id} : vie`);
    assert.ok(haut.atk > bas.atk * 2.5, `${id} : attaque`);
  }
  const tank = statsBase(creerPersonnage('brandel'));
  const dps = statsBase(creerPersonnage('kaelis'));
  assert.ok(tank.pvMax > dps.pvMax && tank.def > dps.def && dps.atk > tank.atk && dps.vit > tank.vit);
});

test('monter de niveau rend la vie gagnée, pas plus', () => {
  const p = creerPersonnage('kaelis', 1);
  p.pv = 10;
  const r = gagnerXp(p, SEUILS_XP[3]);
  assert.equal(r.apres, 3);
  assert.ok(r.apprend, 'l’ultime s’apprend au niveau 3');
  assert.ok(p.pv > 10 && p.pv < statsDe(p).pvMax);
  const tombe = creerPersonnage('mei', 1);
  tombe.pv = 0;
  gagnerXp(tombe, 500);
  assert.equal(tombe.pv, 0, 'un tombé ne se relève pas en montant de niveau');
});

test('l’équipement et les bénédictions s’ajoutent aux statistiques', () => {
  const p = creerPersonnage('mordrec', 2);
  const nu = statsDe(p);
  p.equip.arme = forger(PIECES.find((m) => m.base === 'Épée'), 1, 'rare', rngT());
  const arme = statsDe(p);
  assert.equal(arme.atk, nu.atk + p.equip.arme.atk);
  assert.ok(statsDe(p, { atk: 0.2 }).atk > arme.atk);
  assert.ok(statsDe(p, { pm: 5 }).pmMax === arme.pmMax + 5);
});

test('les sorts se paient et les soutiens visent le groupe', () => {
  for (const x of HEROS) {
    const s = sortsDe(x);
    assert.ok(s.ultime.cout > s.special.cout, x.id);
    assert.ok(s.ultime.mult > s.special.mult, x.id);
  }
  assert.ok(sortsDe(PAR_ID.mei).special.soutien);
  assert.ok(!sortsDe(PAR_ID.mordrec).special.soutien);
});

/* ================================================================== */
/* Équipement                                                         */
/* ================================================================== */

test('les pièces suivent l’acte et la rareté', () => {
  const m = PIECES.find((x) => x.base === 'Épée');
  const a1 = forger(m, 1, 'commun', rngT());
  const a5 = forger(m, 5, 'commun', rngT());
  const ep = forger(m, 1, 'epique', rngT());
  assert.ok(a5.atk > a1.atk && ep.atk > a1.atk);
  assert.ok(a5.prix > a1.prix && ep.prix > a1.prix);
  const dague = forger(PIECES.find((x) => x.base === 'Dague'), 5, 'epique', rngT());
  assert.equal(dague.vit, 1, 'la vitesse ne grandit pas');
  assert.ok(texteBonus(dague).includes('VIT'));
  assert.equal(tirerRarete(() => 0.99, 0, 'rare'), 'rare', 'le plancher tient');
  assert.equal(pieceAuHasard(rngT(), 2, { emplacement: 'bijou' }).emplacement, 'bijou');
});

test('la chance fait pencher la rareté', () => {
  const compte = (chance) => {
    const r = rngT(5);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (tirerRarete(r, chance) !== 'commun') n++;
    return n;
  };
  assert.ok(compte(30) > compte(0) * 1.4);
});

/* ================================================================== */
/* Carte                                                              */
/* ================================================================== */

test('chaque carte mène du pied au boss par des chemins continus', () => {
  for (let s = 0; s < 30; s++) {
    for (let acte = 1; acte <= ACTES.length; acte++) {
      const c = genererCarte(rngT(s), acte);
      assert.ok(accessibles(c, null).length >= 1);
      assert.ok(c.noeuds.filter((n) => n.rangee === 0).every((n) => n.type === 'combat'));
      assert.ok(c.noeuds.filter((n) => n.rangee === RANGEES - 1).every((n) => n.type === 'repos'));
      for (const n of c.noeuds) {
        if (n.type === 'boss') continue;
        assert.ok(n.suivants.length >= 1, 'pas de cul-de-sac');
        for (const id of n.suivants) {
          const v = c.noeuds.find((x) => x.id === id);
          assert.equal(v.rangee, n.rangee + 1);
          if (v.type !== 'boss') assert.ok(Math.abs(v.col - n.col) <= 1);
        }
      }
      if (acte === 1) assert.ok(c.noeuds.some((n) => n.type === 'compagnon' && n.rangee <= 2));
    }
  }
});

test('les ennemis se règlent sur l’acte et sur la taille du groupe', () => {
  const bas = gnoll(1);
  const haut = gnoll(5);
  assert.ok(haut.pvMax > bas.pvMax * 3 && haut.atk > bas.atk * 2);
  const seul = gnoll(2, { echelle: ECHELLE[1] });
  const quatre = gnoll(2, { echelle: ECHELLE[4] });
  assert.ok(seul.pvMax < quatre.pvMax && seul.atk < quatre.atk);
  for (let s = 0; s < 20; s++) {
    assert.equal(composer(rngT(s), 1, 'combat', { taille: 1 }).length, 1, 'seul, un monstre à la fois');
    assert.equal(composer(rngT(s), 1, 'boss', { taille: 1 }).length, 1);
    assert.equal(composer(rngT(s), 5, 'boss')[0].modeleId, 'sarkhavel', 'le Dragon garde le chapitre 5');
    assert.equal(composer(rngT(s), ACTES.length, 'boss')[0].modeleId, BOSS_FINAL);
    assert.equal(composer(rngT(s), ACTES.length, 'boss').length, 1, 'le dernier boss est seul');
  }
});

/* ================================================================== */
/* Bataille                                                           */
/* ================================================================== */

test('le plus rapide joue d’abord, et les ennemis jouent seuls', () => {
  const { b } = batailleTest({ ids: ['brandel', 'kaelis'] });
  demarrer(b);
  const h = actif(b);
  assert.ok(h, 'un héros a la main');
  assert.equal(b.manche, 1);
  assert.equal(h.id, 'kaelis', 'la vitesse décide');
});

test('l’ultime reste verrouillé avant le niveau 3', () => {
  const { b } = batailleTest({ ids: ['kaelis'], niveau: 1 });
  demarrer(b);
  const u = actionsDe(b).find((a) => a.type === 'ultime');
  assert.equal(u.possible, false);
  assert.ok(u.verrou);
  assert.equal(agir(b, { type: 'ultime', cible: 0 }).ok, false);
});

test('attaquer remplit le mana, le sort le dépense', () => {
  const { b } = batailleTest({ ids: ['kaelis'], ennemis: [gnoll(1, { echelle: { pv: 20, atk: 0.01 } })] });
  demarrer(b);
  const h = actif(b);
  h.pm = 10;
  agir(b, { type: 'attaque', cible: 0 });
  assert.equal(h.pm, 12);
  while (actif(b) !== h) agir(b, { type: 'defendre' });
  agir(b, { type: 'special', cible: 0 });
  assert.equal(h.pm, 4);
});

test('l’école, l’armure et la défense pèsent sur les dégâts', () => {
  const { b } = batailleTest({ ids: ['pix'] });
  const h = b.heros[0];
  const e = b.ennemis[0];
  e.ecole = domine(h.ecole);
  const fort = estimer(b, h, e, 1).degats;
  e.ecole = craint(h.ecole);
  const faible = estimer(b, h, e, 1).degats;
  assert.ok(fort > faible * 1.8);
  e.ecole = h.ecole;
  const nu = estimer(b, e, h, 1).degats;
  h.defense = true;
  assert.ok(estimer(b, e, h, 1).degats < nu * 0.6, 'se défendre divise les coups');
});

test('un soin ne dépasse pas la vie maximale, un bouclier protège tout le groupe', () => {
  const { b } = batailleTest({ ids: ['mei', 'brandel'], niveau: 3 });
  demarrer(b);
  while (actif(b).id !== 'mei') agir(b, { type: 'defendre' });
  const mei = actif(b);
  for (const h of b.heros) h.pv = Math.round(h.pvMax * 0.5);
  mei.pm = 30;
  agir(b, { type: 'special' });
  for (const h of b.heros) assert.ok(h.pv > h.pvMax * 0.5 && h.pv <= h.pvMax);
  const { b: b2 } = batailleTest({ ids: ['brandel'] });
  demarrer(b2);
  actif(b2).pm = 30;
  const e = b2.ennemis[0];
  const avant = estimer(b2, e, b2.heros[0], 1).degats;
  agir(b2, { type: 'special' });
  assert.ok(b2.bouclier || b2.fini);
  if (b2.bouclier) assert.ok(estimer(b2, e, b2.heros[0], 1).degats < avant);
});

test('les objets se consomment, et la plume ne relève que les tombés', () => {
  const inventaire = { potion: 1, elixir: 0, phenix: 1 };
  const { b } = batailleTest({ ids: ['brandel', 'kaelis'], inventaire });
  demarrer(b);
  const autre = b.heros.find((x) => x !== actif(b));
  assert.equal(agir(b, { type: 'phenix', cible: autre.idx }).ok, false, 'personne n’est tombé');
  autre.pv = 0;
  const h = actif(b);
  assert.ok(agir(b, { type: 'phenix', cible: autre.idx }).ok);
  assert.ok(autre.pv > 0);
  assert.equal(inventaire.phenix, 0, 'l’inventaire est partagé avec l’aventure');
  assert.ok(h);
});

test('une bataille se termine et rend vie et mana aux personnages', () => {
  const { b, groupe } = batailleTest({ ids: ['kaelis', 'brandel'], niveau: 4 });
  jouerCombat(b);
  assert.ok(b.fini);
  assert.ok(b.victoire);
  for (let i = 0; i < groupe.length; i++) assert.equal(groupe[i].pv, Math.round(b.heros[i].pv));
  assert.equal(actif(b), null);
});

test('la charge annoncée frappe tout le groupe quand elle vient d’une élite', () => {
  const e = ennemiRpg(MODELES_PAR_ID.hurlefer, 2, 'feu', rngT(1));
  e.charge.reste = 1;
  const { b } = batailleTest({ ids: ['brandel', 'kaelis', 'mei'], ennemis: [e] });
  for (const h of b.heros) h.vit = 0;
  const ev = demarrer(b);
  const touches = ev.filter((x) => x.t === 'degats' && x.camp === 'h').map((x) => x.idx);
  assert.equal(new Set(touches).size, 3);
});

test('les coups critiques dépendent de la chance', () => {
  const { b } = batailleTest();
  const h = b.heros[0];
  const sans = critiqueDe(b, h);
  b.chance = 30;
  assert.ok(critiqueDe(b, h) > sans);
  b.chance = 1000;
  assert.ok(critiqueDe(b, h) <= 0.5);
});

test('le joueur automatique propose toujours une action valide', () => {
  for (let s = 0; s < 15; s++) {
    const { b } = batailleTest({ ids: ['mei', 'brandel', 'pix'], seed: s, ennemis: [gnoll(2), gnoll(2)] });
    demarrer(b);
    for (let i = 0; i < 300 && !b.fini; i++) assert.ok(agir(b, choisirAction(b)).ok);
    assert.ok(b.fini);
  }
});

/* ================================================================== */
/* Aventure                                                           */
/* ================================================================== */

test('l’aventure commence seul, au pied du premier acte', () => {
  const av = A.creerAventure({ heros: 'pix', seed: 1 });
  assert.equal(av.groupe.length, 1);
  assert.equal(av.groupe[0].niveau, 1);
  assert.equal(av.acte, 1);
  assert.ok(A.sallesAccessibles(av).length >= 1);
  assert.ok(av.reprise, 'le départ est un point de sauvegarde');
  assert.throws(() => A.creerAventure({ heros: 'personne' }));
});

test('l’aventure se sauvegarde telle quelle et rejoue le même hasard', () => {
  const av = A.creerAventure({ heros: 'kaelis', seed: 9 });
  const copie = JSON.parse(JSON.stringify(av));
  jusqua(av, 'recompense');
  jusqua(copie, 'recompense');
  assert.deepEqual(copie.etape, av.etape);
});

test('on ne va que dans une salle reliée', () => {
  const av = A.creerAventure({ seed: 3 });
  assert.equal(A.entrer(av, 'boss').ok, false);
  const n = A.sallesAccessibles(av)[0];
  assert.ok(A.entrer(av, n.id).ok);
  assert.equal(av.etape.type, 'combat');
  assert.equal(A.entrer(av, n.id).ok, false, 'une étape à la fois');
});

test('une victoire rapporte expérience, or, et parfois une pièce', () => {
  const av = A.creerAventure({ heros: 'mordrec', seed: 4 });
  A.entrer(av, A.sallesAccessibles(av)[0].id);
  const or = av.or;
  const b = jouerCombat(A.bataillePour(av));
  assert.ok(b.victoire);
  A.conclureCombat(av, true);
  assert.equal(av.etape.type, 'recompense');
  assert.ok(av.or > or);
  assert.ok(av.groupe[0].xp > 0);
  const piece = av.etape.pieces[0];
  A.prendreRecompense(av, piece ? piece.uid : null);
  assert.equal(av.sac.length, piece ? 1 : 0);
  assert.equal(av.etape, null);
});

test('une défaite ramène au dernier point de sauvegarde, avec la moitié de l’expérience', () => {
  const av = A.creerAventure({ heros: 'brandel', seed: 5 });
  assert.ok(jusqua(av, 'repos'));
  const xp = av.groupe[0].xp;
  const or = av.or;
  A.faireRepos(av, 'repos');
  A.terminerEtape(av);
  A.appliquer(av, { xp: 40, or: 100 });
  av.etape = { type: 'combat', salle: 'boss', ennemis: [] };
  A.conclureCombat(av, false);
  assert.equal(av.etape.type, 'defaite');
  A.reprendre(av);
  assert.equal(av.etape.type, 'repos', 'retour au feu de camp');
  assert.equal(av.or, or, 'l’or gagné depuis est perdu');
  assert.equal(av.groupe[0].xp, xp + 20, 'la moitié de l’expérience reste');
  assert.equal(av.stats.morts, 1);
  assert.equal(A.blessuresBoss(av), 0.1, 'le boss garde la trace du combat');
});

test('les paliers de niveau ouvrent des dons, choisis un par un', () => {
  const av = A.creerAventure({ heros: 'kaelis', seed: 6 });
  A.appliquer(av, { xp: SEUILS_XP[5] });
  assert.equal(av.donsEnAttente, 2);
  A.entrer(av, A.sallesAccessibles(av)[0].id);
  A.conclureCombat(av, true);
  A.prendreRecompense(av);
  assert.equal(av.etape.type, 'don');
  const d = av.etape.choix[0];
  const chance = av.chance;
  A.choisirDon(av, d.id);
  assert.ok(av.dons.includes(d.id));
  assert.equal(av.etape.type, 'don', 'le second don suit');
  assert.ok(!av.etape.choix.some((x) => x.id === d.id), 'pas deux fois le même');
  A.choisirDon(av, av.etape.choix[0].id);
  assert.equal(av.etape, null);
  assert.ok(av.chance >= chance);
});

test('chaque événement propose de vrais choix, écrits depuis leurs effets', () => {
  const av = A.creerAventure({ seed: 2 });
  for (const ev of A.EVENEMENTS) {
    assert.ok(ev.choix.length >= 2, ev.id);
    av.etape = { type: 'evenement', id: ev.id };
    const vue = A.evenementCourant(av);
    for (const c of vue.choix) {
      assert.ok(c.annonce, `${ev.id}/${c.id}`);
      if (c.risque) assert.ok(c.chance > 0 && c.chance < 1);
    }
  }
});

test('un choix qu’on ne peut pas payer est refusé', () => {
  const av = A.creerAventure({ seed: 2 });
  av.or = 0;
  av.etape = { type: 'evenement', id: 'mentor' };
  assert.equal(A.choisirEvenement(av, 'lecon').ok, false);
  av.or = 100;
  assert.ok(A.choisirEvenement(av, 'lecon').ok);
  assert.equal(av.or, 60);
  assert.equal(av.etape.type, 'resultat');
});

test('les choix pèsent sur les boss', () => {
  const av = A.creerAventure({ seed: 2 });
  av.etape = { type: 'evenement', id: 'prisonnier' };
  A.choisirEvenement(av, 'liberer');
  assert.equal(A.menacesDuBoss(av).retire, 1);
  A.appliquer(av, { boss: { cible: 'final', atk: 0.2 } });
  assert.equal(A.menacesDuBoss(av).atk, 0, 'le Dragon est loin');
  av.acte = ACTES.length;
  assert.equal(A.menacesDuBoss(av).atk, 0.2);
});

test('les pertes de vie des événements ne tuent jamais', () => {
  const av = A.creerAventure({ seed: 2 });
  av.groupe[0].pv = 3;
  A.appliquer(av, { vie: -0.5 });
  assert.equal(av.groupe[0].pv, 1);
});

test('le marchand vend et rachète', () => {
  const av = A.creerAventure({ seed: 8 });
  av.or = 500;
  av.etape = { type: 'marchand', stock: [pieceAuHasard(rngT(), 1)] };
  const it = av.etape.stock[0];
  assert.ok(A.acheter(av, it.uid).ok);
  assert.equal(av.or, 500 - it.prix);
  assert.ok(A.acheter(av, 'potion').ok);
  assert.equal(av.inventaire.potion, 3);
  assert.ok(A.vendre(av, it.uid).ok);
  assert.equal(av.or, 500 - it.prix - A.PRIX_OBJETS(1).potion + A.prixRevente(it));
  av.or = 0;
  assert.equal(A.acheter(av, 'phenix').ok, false);
});

test('équiper échange la pièce avec celle qu’on portait', () => {
  const av = A.creerAventure({ heros: 'brandel', seed: 8 });
  const a = pieceAuHasard(rngT(1), 1, { emplacement: 'arme' });
  const b = pieceAuHasard(rngT(2), 1, { emplacement: 'arme' });
  av.sac.push(a, b);
  A.equiper(av, 0, a.uid);
  A.equiper(av, 0, b.uid);
  assert.equal(av.groupe[0].equip.arme, b);
  assert.deepEqual(av.sac, [a]);
  A.desequiper(av, 0, 'arme');
  assert.equal(av.sac.length, 2);
});

test('un compagnon rejoint le groupe, sans dépasser quatre', () => {
  const av = A.creerAventure({ heros: 'mordrec', seed: 10 });
  assert.ok(jusqua(av, 'compagnon'));
  const id = av.etape.offres[0];
  assert.notEqual(PAR_ID[id].role, 'dps', 'on propose d’abord ce qui manque');
  A.recruter(av, id);
  assert.equal(av.groupe.length, 2);
  for (const x of ['brandel', 'mei', 'pix']) av.groupe.push(creerPersonnage(x));
  av.etape = { type: 'compagnon', offres: ['kaelis'] };
  assert.equal(A.recruter(av, 'kaelis').ok, false);
});

test('après le boss, un compagnon se propose, puis l’acte suivant commence', () => {
  const av = A.creerAventure({ heros: 'pix', seed: 12 });
  for (let i = 0; i < 400 && av.acte === 1; i++) {
    if (av.etape && av.etape.type === 'compagnon') { A.terminerEtape(av); continue; }
    jusqua(av, 'boss', 1);
    if (av.etape && av.etape.type === 'combat' && av.etape.salle === 'boss') {
      A.conclureCombat(av, true);
      A.prendreRecompense(av);
      while (av.etape && av.etape.type === 'don') A.choisirDon(av, av.etape.choix[0].id);
      assert.equal(av.etape.type, 'compagnon');
      assert.ok(av.etape.apresBoss);
      A.recruter(av, av.etape.offres[0]);
      A.terminerEtape(av);
    }
  }
  assert.equal(av.acte, 2);
  assert.equal(av.position, null);
  assert.ok(av.groupe.length >= 2);
});

test('les objets s’utilisent aussi sur la carte', () => {
  const av = A.creerAventure({ heros: 'brandel', seed: 1 });
  const p = av.groupe[0];
  assert.equal(A.utiliser(av, 'potion', 0).ok, false, 'déjà en pleine forme');
  p.pv = 5;
  assert.ok(A.utiliser(av, 'potion', 0).ok);
  assert.ok(p.pv > 5);
  p.pv = 0;
  assert.equal(A.utiliser(av, 'potion', 0).ok, false);
  av.inventaire.phenix = 1;
  assert.ok(A.utiliser(av, 'phenix', 0).ok);
  assert.ok(p.pv > 0);
});

/* ================================================================== */
/* Pixel art                                                          */
/* ================================================================== */

test('chaque héros et chaque ennemi se dessinent sur seize sur seize', () => {
  const sujets = [...HEROS, ...MODELES.map((m) => ennemiRpg(m, 1, 'feu', rngT(1)))];
  for (const s of sujets) {
    for (const pose of ['repos', 'frappe']) {
      const svg = spriteSvg(s, pose);
      assert.ok(svg.startsWith('<svg') && svg.includes('<rect'));
      const ys = [...svg.matchAll(/y="(\d+)"/g)].map((m) => +m[1]);
      assert.ok(Math.max(...ys) < GRID);
    }
  }
  for (const x of HEROS) assert.ok(Object.keys(poses(x)).length >= 2);
  const [a, b] = parEcole('feu');
  assert.notDeepEqual(palettePour({ id: a.id, ecole: 'feu' }), palettePour({ id: b.id, ecole: 'feu' }));
});

/* ================================================================== */
/* Équilibrage                                                        */
/* ================================================================== */

/**
 * Ces tests-là ne vérifient pas une règle mais un réglage : l'aventure doit
 * être gagnable sans être acquise. Le joueur automatique — appliqué, pas
 * génial — la joue d'un bout à l'autre ; les bornes sont larges exprès.
 */
test('l’aventure se termine, pour chaque héros de départ', () => {
  for (const heros of DEPARTS) {
    const av = jouerAventure(A.creerAventure({ heros, seed: 101 }));
    assert.ok(av.victoire, `${heros} : ${av.acte}e acte, ${av.stats.morts} défaites`);
    assert.ok(av.groupe.length >= 3, `${heros} : le groupe s’est construit`);
    assert.ok(av.groupe[0].niveau >= 9, `${heros} : le héros a grandi`);
  }
});

test('le début de l’aventure coûte vraiment de la vie', () => {
  for (const heros of DEPARTS) {
    let vie = 0;
    const n = 8;
    for (let s = 0; s < n; s++) {
      const av = A.creerAventure({ heros, seed: s });
      A.entrer(av, A.sallesAccessibles(av)[0].id);
      const b = jouerCombat(A.bataillePour(av));
      vie += b.victoire ? b.heros[0].pv / b.heros[0].pvMax : 0;
    }
    assert.ok(vie / n < 0.93, `${heros} finit son premier combat à ${Math.round((100 * vie) / n)} %`);
    assert.ok(vie / n > 0.3, `${heros} ne doit pas mourir au premier combat`);
  }
});

test('seul, un tank ou un soigneur frappe plus fort', () => {
  const av = A.creerAventure({ heros: 'mei', seed: 1 });
  assert.ok(A.bonusCombat(av).degats > 0);
  av.groupe.push(creerPersonnage('kaelis'));
  assert.ok(!A.bonusCombat(av).degats);
  assert.equal(A.bonusSolo(A.creerAventure({ heros: 'kaelis' })), 0);
});

test('aucun combat ne s’éternise', () => {
  const av = A.creerAventure({ heros: 'mei', seed: 77 });
  let pire = 0;
  for (let i = 0; i < 3000 && !av.termine; i++) {
    if (av.etape && av.etape.type === 'combat') {
      const b = jouerCombat(A.bataillePour(av));
      pire = Math.max(pire, b.manche);
      A.conclureCombat(av, b.victoire);
      continue;
    }
    if (av.etape && av.etape.type === 'defaite') { A.reprendre(av); continue; }
    jouerAventure(av, { maxEtapes: 1 });
  }
  assert.ok(pire < 30, `${pire} manches`);
});

/* ================================================================== */
/* Difficultés et zones                                               */
/* ================================================================== */

test('les difficultés sont ordonnées et se voient sur les ennemis', () => {
  const force = (difficulte) => {
    const av = A.creerAventure({ heros: 'kaelis', seed: 3, difficulte });
    A.entrer(av, A.sallesAccessibles(av)[0].id);
    return av.etape.ennemis[0];
  };
  const [f, n, d, h] = ['facile', 'normal', 'difficile', 'hardcore'].map(force);
  assert.ok(f.pvMax < n.pvMax && n.pvMax < d.pvMax);
  assert.ok(f.atk <= n.atk && n.atk <= d.atk && d.atk <= h.atk);
  assert.ok(A.DIFFICULTES.hardcore.atk > A.DIFFICULTES.difficile.atk, 'le Hardcore frappe un peu plus fort');
  assert.ok(A.DIFFICULTES.hardcore.atk < A.DIFFICULTES.difficile.atk * 1.1, 'mais à peine');
  for (const k of Object.keys(A.DIFFICULTES)) assert.ok(A.texteDifficulte(k).length > 20);
  assert.throws(() => A.creerAventure({ difficulte: 'impossible' }));
});

test('en Hardcore, une défaite met fin à l’aventure', () => {
  const av = A.creerAventure({ heros: 'pix', seed: 3, difficulte: 'hardcore' });
  A.entrer(av, A.sallesAccessibles(av)[0].id);
  const r = A.conclureCombat(av, false);
  assert.ok(r.definitive);
  assert.ok(av.termine && !av.victoire);
  assert.equal(A.reprendre(av).ok, false, 'pas de feu de camp où revenir');
  const normal = A.creerAventure({ heros: 'pix', seed: 3 });
  A.entrer(normal, A.sallesAccessibles(normal)[0].id);
  A.conclureCombat(normal, false);
  assert.ok(!normal.termine);
  assert.ok(A.reprendre(normal).ok);
});

test('on peut rôder dans une zone ouverte, et y revenir après chaque chasse', () => {
  const av = A.creerAventure({ heros: 'mordrec', seed: 21 });
  av.acte = 3;
  assert.ok(A.roder(av).ok);
  assert.equal(A.choisirZone(av, 4).ok, false, 'pas une zone à venir');
  assert.ok(A.choisirZone(av, 1).ok);
  let embuscades = 0, marchands = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const r = A.chasser(av);
    if (r.marchand) {
      marchands++;
      assert.ok(av.etape.ambulant);
      A.terminerEtape(av);
      assert.equal(av.etape.type, 'balade', 'le marchand parti, on est toujours dans la zone');
      continue;
    }
    assert.equal(av.etape.type, 'combat');
    if (r.embuscade) {
      embuscades++;
      assert.equal(av.etape.salle, 'embuscade');
      assert.equal(av.etape.acte, 3, 'l’embuscade vient de l’acte en cours');
      assert.equal(av.etape.ennemis[0].rang, 'elite');
    } else {
      assert.equal(av.etape.acte, 1);
    }
    A.conclureCombat(av, true);
    A.prendreRecompense(av);
    while (av.etape.type === 'don') A.choisirDon(av, av.etape.choix[0].id);
    if (av.etape.type === 'marchand') { marchands++; A.terminerEtape(av); }
    assert.equal(av.etape.type, 'balade', 'retour dans la zone');
    assert.equal(av.etape.acte, 1);
  }
  assert.ok(embuscades / N > 0.15 && embuscades / N < 0.3, `${embuscades} embuscades sur ${N}`);
  assert.ok(marchands > N * 0.12, 'les marchands ambulants passent');
  A.terminerEtape(av);
  assert.equal(av.etape, null);
  assert.equal(av.balade, null);
});

test('une zone passée rapporte moins que la zone en cours', () => {
  const e = ennemiRpg(MODELES_PAR_ID.gnoll, 1, 'feu', rngT(1));
  assert.ok(A.xpDe(e, 1) < A.xpDe(e, 4));
  assert.ok(A.orDe(e, 1) < A.orDe(e, 4));
});

test('l’or trouve à se dépenser : un marchand par acte, et des ambulants', () => {
  for (let seed = 0; seed < 40; seed++) {
    for (let acte = 1; acte <= ACTES.length; acte++) {
      assert.ok(genererCarte(rngT(seed), acte).noeuds.some((n) => n.type === 'marchand'), `acte ${acte}, graine ${seed}`);
    }
  }
  let vus = 0;
  for (let seed = 0; seed < 60; seed++) {
    const av = A.creerAventure({ heros: 'mordrec', seed });
    A.entrer(av, A.sallesAccessibles(av)[0].id);
    A.conclureCombat(av, true);
    A.prendreRecompense(av);
    if (av.etape && av.etape.type === 'marchand') {
      vus++;
      assert.ok(av.etape.ambulant && av.etape.stock.length === 3);
      A.terminerEtape(av);
      assert.equal(av.etape, null);
    }
  }
  assert.ok(vus >= 3 && vus <= 20, `${vus} marchands ambulants sur 60 victoires`);
});

/* ================================================================== */
/* Talents, reliques, quêtes, nouveaux monstres                       */
/* ================================================================== */

test('un point de talent par niveau, et des paliers qui se méritent', () => {
  const p = creerPersonnage('kaelis', 1);
  assert.equal(T.pointsLibres(p), 0);
  assert.equal(T.apprendre(p, 'affutage').ok, false, 'pas de point au niveau 1');
  gagnerXp(p, SEUILS_XP[5]);
  assert.equal(T.pointsLibres(p), 4);
  assert.equal(T.apprendre(p, 'oeil').ok, false, 'le palier 2 est fermé');
  assert.equal(T.apprendre(p, 'peau').ok, false, 'pas un talent de son rôle');
  assert.ok(T.apprendre(p, 'affutage').ok);
  assert.ok(T.apprendre(p, 'affutage').ok);
  assert.ok(T.apprendre(p, 'oeil').ok, 'deux points ouvrent le palier suivant');
  assert.ok(T.apprendre(p, 'affutage').ok);
  assert.equal(T.rangDe(p, 'affutage'), T.RANG_MAX);
  assert.equal(T.pointsLibres(p), 0);
  assert.equal(T.apprendre(p, 'oeil').ok, false, 'plus de point');
  for (const role of Object.keys(T.ARBRES)) {
    assert.equal(T.ARBRES[role].length, 2);
    for (const b of T.ARBRES[role]) for (const tal of b.talents) assert.ok(T.texteTalent(tal).length > 5, tal.id);
  }
});

test('les talents se lisent dans les statistiques et dans le combat', () => {
  const nu = creerPersonnage('brandel', 6);
  const p = creerPersonnage('brandel', 6);
  p.talents = { peau: 3, bastion: 2 };
  assert.ok(statsDe(p).pvMax > statsDe(nu).pvMax * 1.15);
  assert.ok(statsDe(p).def > statsDe(nu).def);

  const dps = creerPersonnage('kaelis', 6);
  dps.talents = { celerite: 3, soif: 2, concentration: 1 };
  assert.equal(statsDe(dps).vit, statsDe(creerPersonnage('kaelis', 6)).vit + 3);
  const b = creerBataille({ groupe: [dps], ennemis: [gnoll(1, { echelle: { pv: 30, atk: 0.01 } })], inventaire: {}, rng: rngT(2) });
  demarrer(b);
  const h = actif(b);
  h.pv = 10; h.pm = 0;
  agir(b, { type: 'attaque', cible: 0 });
  assert.ok(h.pv > 10, 'la soif de sang soigne');
  assert.ok(h.pm >= 3, 'attaque (+2) puis concentration (+1) au tour suivant');
});

test('les reliques pèsent sur le groupe et sur le combat', () => {
  assert.equal(new Set(RELIQUES.map((r) => r.id)).size, RELIQUES.length);
  assert.equal(bonusReliques(['griffe', 'heaume']).degats, 0.12);
  const av = A.creerAventure({ heros: 'pix', seed: 4 });
  const pvAvant = statsDe(av.groupe[0], A.bonusDe(av)).pvMax;
  assert.equal(A.gagnerRelique(av, 'heaume').id, 'heaume');
  assert.equal(A.gagnerRelique(av, 'heaume'), null, 'pas deux fois la même');
  assert.ok(statsDe(av.groupe[0], A.bonusDe(av)).pvMax > pvAvant);
  const chance = av.chance;
  A.gagnerRelique(av, 'trefle');
  assert.equal(av.chance, chance + 8);

  // Cœur de phénix : le premier héros qui tombe se relève, une seule fois.
  const groupe = [creerPersonnage('pix', 1)];
  const b = creerBataille({ groupe, ennemis: [gnoll(5)], bonus: { phenix: 1, egide: 0.25 }, inventaire: {}, rng: rngT(3) });
  assert.ok(b.bouclier, 'l’Égide protège dès le départ');
  const ev = demarrer(b);
  for (let i = 0; i < 40 && !b.fini; i++) ev.push(...agir(b, { type: 'defendre' }).evenements);
  assert.equal(ev.filter((x) => x.t === 'releve' && x.relique).length, 1);
  assert.ok(b.fini && !b.victoire);
});

test('un boss lâche une relique, et chaque chapitre a le sien', () => {
  const av = A.creerAventure({ heros: 'mordrec', seed: 30 });
  av.acte = 3;
  av.etape = { type: 'combat', salle: 'boss', ennemis: composer(rngT(1), 3, 'boss') };
  const premier = av.etape.ennemis[0].modeleId;
  A.conclureCombat(av, true);
  assert.ok(av.etape.relique, 'la relique est annoncée');
  assert.equal(av.reliques.length, 1);
  assert.deepEqual(av.bossVus, [premier]);
  assert.notEqual(composer(rngT(1), 4, 'boss')[0].modeleId, premier, 'chaque chapitre a son propre maître');
});

test('les boutiques vendent des reliques, et la Bourse fait baisser les prix', () => {
  const av = A.creerAventure({ seed: 8 });
  av.or = 1000;
  av.etape = { type: 'marchand', stock: [], relique: { id: 'griffe', prix: A.PRIX_RELIQUE(1) } };
  const plein = A.prixObjets(av).potion;
  assert.ok(A.acheter(av, 'relique').ok);
  assert.ok(av.reliques.includes('griffe'));
  assert.equal(av.or, 1000 - A.PRIX_RELIQUE(1));
  assert.equal(A.acheter(av, 'relique').ok, false, 'la vitrine est vide');
  A.gagnerRelique(av, 'bourse');
  assert.ok(A.prixObjets(av).potion < plein);
});

test('une quête s’accepte, avance et paie', () => {
  for (const q of QUETES) assert.ok(q.texte(q.but(1)).length > 5 && A.texteEffet(q.recompense(1)) !== 'aucun effet', q.id);
  const av = A.creerAventure({ heros: 'kaelis', seed: 12 });
  assert.equal(av.offresQuetes.length, 2);
  av.offresQuetes = [
    { id: 'battue', acte: 1, but: 2, progres: 0, recompense: { or: 80 } },
    { id: 'prime', acte: 1, but: 1, progres: 0, recompense: { relique: true } },
  ];
  assert.ok(A.ouvrirQuetes(av).ok);
  assert.equal(A.accepterQuete(av, 'inconnue').ok, false);
  assert.ok(A.accepterQuete(av, 'battue').ok);
  assert.equal(A.accepterQuete(av, 'prime').ok, false, 'une seule à la fois');
  A.terminerEtape(av);
  assert.equal(av.etape, null);

  for (let i = 0; i < 2; i++) {
    av.etape = { type: 'combat', salle: 'combat', ennemis: [gnoll()] };
    A.conclureCombat(av, true);
    if (i === 0) assert.equal(av.quete.progres, 1);
    const butin = av.or;
    A.prendreRecompense(av);
    while (av.etape && av.etape.type === 'don') A.choisirDon(av, av.etape.choix[0].id);
    if (i === 1) {
      assert.equal(av.etape.type, 'resultat');
      assert.ok(av.etape.titre.includes('Quête accomplie'));
      assert.equal(av.or, butin + 80);
      assert.equal(av.quete, null);
    } else if (av.etape) A.terminerEtape(av);
  }
});

test('les nouveaux monstres ont leurs capacités : régénération et gel', () => {
  for (const id of ['araignee', 'squelette', 'cultiste', 'troll', 'follet', 'minotaure', 'tisseuse', 'ysolde', 'kharn']) {
    assert.ok(MODELES_PAR_ID[id], id);
  }
  assert.ok(parRang('boss').length >= 5 && parRang('elite').length >= 5 && parRang('trash').length >= 9);

  const troll = ennemiRpg(MODELES_PAR_ID.troll, 3, 'givre', rngT(1));
  troll.pv = Math.round(troll.pvMax / 2);
  const { b } = batailleTest({ ids: ['brandel'], ennemis: [troll] });
  const ev = demarrer(b);
  ev.push(...agir(b, { type: 'defendre' }).evenements);
  assert.ok(ev.some((x) => x.t === 'soin' && x.camp === 'e' && x.n > 0), 'le troll se régénère');

  const follet = ennemiRpg(MODELES_PAR_ID.follet, 1, 'givre', rngT(1));
  const { b: b2 } = batailleTest({ ids: ['brandel'], ennemis: [follet] });
  const ev2 = demarrer(b2);
  ev2.push(...agir(b2, { type: 'defendre' }).evenements);
  assert.ok(ev2.some((x) => x.t === 'pm' && x.n < 0), 'le gel fait perdre du mana');
});

/* ================================================================== */
/* Héros légendaires et départs                                       */
/* ================================================================== */

test('six légendaires, deux par rôle, plus forts que la guilde', () => {
  assert.equal(LEGENDES.length, 6);
  assert.deepEqual(LEGENDES.map((h) => h.role).sort(), ['dps', 'dps', 'soigneur', 'soigneur', 'tank', 'tank']);
  assert.equal(HEROS.length, 15, 'ils ne font pas partie de la guilde');
  for (const h of LEGENDES) {
    assert.ok(PAR_ID[h.id] && h.legendaire);
    for (const coup of [h.special, h.ultime]) assert.ok(EFFETS[coup.effet.type], `${h.id} : ${coup.effet.type}`);
    const ordinaire = HEROS.find((x) => x.role === h.role);
    const a = statsBase(creerPersonnage(h.id, 8));
    const b = statsBase(creerPersonnage(ordinaire.id, 8));
    assert.ok(a.pvMax > b.pvMax && a.atk > b.atk, h.id);
    assert.ok(spriteSvg(h).startsWith('<svg'));
  }
});

test('la provocation force tous les ennemis à frapper le tank, même en attaque chargée', () => {
  const boss = ennemiRpg(MODELES_PAR_ID.vorgath, 3, 'feu', rngT(1), { boss: true });
  boss.charge.reste = 1;
  const groupe = ['aldric', 'kaelis', 'mei'].map((id) => creerPersonnage(id, 8));
  const b = creerBataille({ groupe, ennemis: [boss, gnoll(3)], inventaire: {}, rng: rngT(4) });
  for (const e of b.ennemis) e.vit = -5;       // les héros d'abord
  b.heros[0].vit = 99;
  demarrer(b);
  assert.equal(actif(b).id, 'aldric');
  const ev = agir(b, { type: 'special' }).evenements;
  assert.ok(provocateur(b) === b.heros[0]);
  while (!b.fini && b.manche === 1) ev.push(...agir(b, { type: 'defendre' }).evenements);
  const touches = ev.filter((x) => x.t === 'degats' && x.camp === 'h' && !x.dot);
  assert.ok(touches.length >= 2, 'les deux ennemis ont frappé');
  assert.ok(touches.every((x) => x.idx === 0), 'tous les coups vont sur le tank, y compris la charge de zone');
  assert.ok(estimer(b, boss, b.heros[0], 1).degats > 0);
});

test('le légendaire qui frappe balaie tous les ennemis, celui qui soigne relève les morts', () => {
  const groupe = ['noctis', 'selene', 'brandel'].map((id) => creerPersonnage(id, 8));
  const b = creerBataille({ groupe, ennemis: [gnoll(3), gnoll(3), gnoll(3)], inventaire: {}, rng: rngT(6) });
  for (const e of b.ennemis) e.vit = -5;
  demarrer(b);
  while (actif(b).id !== 'noctis') agir(b, { type: 'defendre' });
  actif(b).pm = 40;
  const ev = agir(b, { type: 'ultime', cible: 0 }).evenements;
  assert.equal(new Set(ev.filter((x) => x.t === 'degats' && x.camp === 'e').map((x) => x.idx)).size, 3);

  while (!b.fini && actif(b).id !== 'selene') agir(b, { type: 'defendre' });
  if (b.fini) return;
  const tombe = b.heros.find((x) => x.id === 'brandel');
  tombe.pv = 0;
  actif(b).pm = 40;
  const ev2 = agir(b, { type: 'ultime' }).evenements;
  assert.ok(ev2.some((x) => x.t === 'releve' && x.idx === tombe.idx));
  assert.ok(tombe.pv > 0);
});

test('les légendaires n’apparaissent qu’à partir de l’acte 3, et peuvent prendre une place', () => {
  const offres = (acte, taille, n = 200) => {
    let vus = 0;
    for (let seed = 0; seed < n; seed++) {
      const av = A.creerAventure({ heros: 'kaelis', seed });
      av.acte = acte;
      for (const id of ['brandel', 'mei', 'pix'].slice(0, taille - 1)) av.groupe.push(creerPersonnage(id, 5));
      av.position = null;
      av.carte.noeuds.find((x) => x.rangee === 0).type = 'compagnon';
      A.entrer(av, av.carte.noeuds.find((x) => x.rangee === 0).id);
      if (av.etape.type === 'compagnon' && av.etape.offres.some((id) => PAR_ID[id].legendaire)) vus++;
    }
    return vus / n;
  };
  assert.equal(offres(2, 2), 0, 'pas avant l’acte 3');
  const part = offres(3, 2);
  assert.ok(part > 0.25 && part < 0.55, `${Math.round(part * 100)} % de rencontres légendaires`);
  assert.ok(offres(4, 4) > 0.25, 'même groupe complet');

  const av = A.creerAventure({ heros: 'kaelis', seed: 1 });
  for (const id of ['brandel', 'mei', 'pix']) av.groupe.push(creerPersonnage(id, 5));
  av.groupe[2].equip.arme = pieceAuHasard(rngT(1), 1, { emplacement: 'arme' });
  av.etape = { type: 'compagnon', offres: ['aldric'] };
  assert.equal(A.recruter(av, 'aldric').ok, false, 'il faut dire qui part');
  assert.equal(A.recruter(av, 'aldric', 0).ok, false, 'jamais le héros');
  assert.ok(A.recruter(av, 'aldric', 2).ok);
  assert.deepEqual(av.groupe.map((p) => p.id), ['kaelis', 'brandel', 'aldric', 'pix']);
  assert.equal(av.sac.length, 1, 'l’équipement du partant revient au sac');
});

test('un compagnon peut partir en voyage et revenir éveillé', () => {
  const av = A.creerAventure({ heros: 'kaelis', seed: 3 });
  av.acte = 2;
  av.or = 100;
  av.groupe.push(creerPersonnage('brandel', 4), creerPersonnage('mei', 4));
  av.etape = { type: 'depart', idx: 1, histoire: 'lettre' };
  const vue = A.departCourant(av);
  assert.equal(vue.perso.id, 'brandel');
  assert.equal(vue.choix.length, 3);
  const avant = statsDe(av.groupe[1]);
  assert.ok(A.choisirDepart(av, 'viatique').ok);
  assert.equal(av.or, 100 - A.PRIX_VIATIQUE);
  assert.deepEqual(av.groupe.map((p) => p.id), ['kaelis', 'mei']);
  assert.equal(A.effectif(av), 3, 'sa place reste la sienne');
  A.terminerEtape(av);

  let revenu = false;
  for (let i = 0; i < 40 && !revenu; i++) {
    if (!av.etape) { A.entrer(av, A.sallesAccessibles(av)[0].id); continue; }
    const e = av.etape;
    if (e.type === 'resultat' && e.titre.includes('de retour')) { revenu = true; break; }
    if (e.type === 'combat') A.conclureCombat(av, true);
    else if (e.type === 'recompense') A.prendreRecompense(av);
    else if (e.type === 'don') A.choisirDon(av, e.choix[0].id);
    else if (e.type === 'evenement') A.choisirEvenement(av, A.evenementCourant(av).choix.find((c) => c.possible).id);
    else if (e.type === 'repos') A.faireRepos(av, 'repos');
    else if (e.type === 'tresor') A.prendreTresor(av);
    else if (e.type === 'depart') A.choisirDepart(av, 'retenir');
    else A.terminerEtape(av);
  }
  assert.ok(revenu, 'le compagnon revient');
  const b = av.groupe.find((p) => p.id === 'brandel');
  assert.ok(b && b.eveil);
  assert.ok(b.niveau >= 5);
  assert.ok(statsDe(b).pvMax > avant.pvMax * 1.1);
  assert.equal(av.absents.length, 0);
});

test('un compagnon parti sans rien peut ne jamais revenir, et le retenir coûte de la chance', () => {
  let adieux = 0;
  const N = 300;
  for (let seed = 0; seed < N; seed++) {
    const av = A.creerAventure({ heros: 'pix', seed });
    av.acte = 2;
    av.groupe.push(creerPersonnage('brandel', 3));
    av.etape = { type: 'depart', idx: 1, histoire: 'dette' };
    if (A.choisirDepart(av, 'partir').adieu) adieux++;
  }
  assert.ok(adieux / N > 0.15 && adieux / N < 0.35, `${adieux} adieux sur ${N}`);

  const av = A.creerAventure({ heros: 'pix', seed: 1 });
  av.groupe.push(creerPersonnage('brandel', 3));
  av.groupe[1].equip.arme = pieceAuHasard(rngT(1), 1, { emplacement: 'arme' });
  av.absents = [{ perso: av.groupe.pop(), reste: 0, adieu: true, histoire: 'serment' }];
  av.etape = { type: 'resultat', titre: 't', glyphe: '', dit: '', effet: '' };
  A.terminerEtape(av);
  assert.ok(av.etape.titre.includes('ne reviendra pas'));
  assert.equal(av.groupe.length, 1);
  assert.equal(av.sac.length, 1);

  const reste = A.creerAventure({ heros: 'pix', seed: 2 });
  reste.groupe.push(creerPersonnage('brandel', 3));
  reste.etape = { type: 'depart', idx: 1, histoire: 'maitre' };
  const chance = reste.chance;
  A.choisirDepart(reste, 'retenir');
  assert.equal(reste.groupe.length, 2);
  assert.equal(reste.chance, chance - 2);
  for (const h of A.HISTOIRES) assert.ok(h.texte('X') && h.retour('X') && h.adieu('X'), h.id);
});

test('le dernier boss a son propre réglage, et ne lâche rien : sa mort finit l’aventure', () => {
  const dragon = (acteFinal) => {
    const av = A.creerAventure({ heros: 'kaelis', seed: 9 });
    for (const id of ['brandel', 'mei', 'pix']) av.groupe.push(creerPersonnage(id, 10));
    av.acte = ACTES.length;
    av.carte = genererCarte(rngT(2), ACTES.length);
    const chemin = [];
    let n = av.carte.noeuds.find((x) => x.rangee === 0);
    while (n) { chemin.push(n.id); n = av.carte.noeuds.find((x) => x.id === n.suivants[0]); }
    av.visites = chemin.slice(0, -1);
    av.position = chemin[chemin.length - 2];
    if (!acteFinal) av.acte = ACTES.length - 1;
    A.entrer(av, 'boss');
    return av;
  };
  const av = dragon(true);
  assert.equal(av.etape.salle, 'boss');
  const b = av.etape.ennemis[0];
  assert.equal(b.modeleId, BOSS_FINAL);
  const nu = composer(A.rng({ alea: 1 }), ACTES.length, 'boss', { taille: 4 })[0];
  assert.ok(b.atk < nu.atk, 'il frappe moins fort que sa fiche : à ce chapitre, la courbe est déjà raide');
  const or = av.or, xp = av.groupe[0].xp;
  const r = A.conclureCombat(av, true);
  assert.ok(r.fin);
  assert.equal(av.etape.type, 'victoire', 'pas d’écran de butin');
  assert.ok(av.termine && av.victoire);
  assert.equal(av.or, or);
  assert.equal(av.groupe[0].xp, xp);
  assert.equal(av.reliques.length, 0);
});

/* ================================================================== */
/* Dix chapitres                                                      */
/* ================================================================== */

test('dix chapitres, dix maîtres différents, et des niveaux jusqu’à vingt', () => {
  assert.equal(ACTES.length, 10);
  const boss = ACTES.map((a) => a.boss);
  assert.equal(new Set(boss).size, 10);
  for (const id of boss) assert.equal(MODELES_PAR_ID[id].rang, 'boss', id);
  assert.equal(boss[4], 'sarkhavel');
  assert.equal(boss[9], BOSS_FINAL);
  assert.equal(NIVEAU_MAX, 20);
  assert.equal(SEUILS_XP.length, NIVEAU_MAX + 1);
  let fort = 0;
  for (let c = 1; c <= 10; c++) {
    const b = composer(rngT(1), c, 'boss')[0];
    assert.ok(b.pvMax > fort, `le boss du chapitre ${c} est plus solide que le précédent`);
    fort = b.pvMax * 0.8;
  }
});

test('on peut reprendre l’histoire à un chapitre avancé, avec de quoi le tenir', () => {
  assert.throws(() => A.creerAventure({ chapitre: 11 }));
  const av = A.creerAventure({ heros: 'pix', seed: 7, chapitre: 6 });
  assert.equal(av.acte, 6);
  assert.equal(av.groupe[0].niveau, A.niveauDuChapitre(6));
  assert.ok(av.sac.length >= 6 && av.reliques.length === 2 && av.or > 300);
  // Les dons que le niveau a déjà ouverts, puis trois compagnons à choisir.
  let dons = 0, recrues = 0;
  for (let i = 0; i < 30 && av.etape; i++) {
    const e = av.etape;
    if (e.type === 'don') { dons++; A.choisirDon(av, e.choix[0].id); }
    else if (e.type === 'compagnon') { assert.ok(e.depart); recrues++; A.recruter(av, e.offres[0]); }
    else A.terminerEtape(av);
  }
  assert.equal(dons, A.NIVEAUX_DON.filter((n) => n <= av.groupe[0].niveau).length);
  assert.equal(recrues, 3);
  assert.equal(av.groupe.length, 4);
  assert.equal(av.etape, null);
  assert.ok(A.sallesAccessibles(av).length >= 1);
});

/* ================================================================== */
/* Compétences d'éveil                                                */
/* ================================================================== */

test('chaque personnage a sa propre compétence d’éveil', () => {
  const tous = [...HEROS, ...LEGENDES];
  assert.equal(Object.keys(EVEILS).length, tous.length);
  for (const h of tous) {
    const sp = EVEILS[h.id];
    assert.ok(sp, `${h.id} n’a pas de compétence d’éveil`);
    assert.ok(sp.degats || (sp.puis && sp.puis.length), h.id);
    assert.ok(texteEveil(sp).length > 15, h.id);
    if (h.role === 'dps') assert.ok(sp.degats, `${h.id} : un DPS éveillé frappe`);
  }
  assert.equal(new Set(Object.values(EVEILS).map((s) => s.nom)).size, tous.length, 'pas deux fois le même nom');
  assert.equal(new Set(Object.values(EVEILS).map((s) => JSON.stringify([s.degats, s.puis]))).size, tous.length, 'pas deux fois le même effet');
});

test('la compétence d’éveil n’existe qu’après l’éveil, et fait ce qu’elle annonce', () => {
  const p = creerPersonnage('pix', 8);
  assert.equal(eveilDe(p), null);
  const b0 = creerBataille({ groupe: [p], ennemis: [gnoll(3)], inventaire: {}, rng: rngT(1) });
  demarrer(b0);
  assert.ok(!actionsDe(b0).some((a) => a.type === 'eveil'));

  // Pix éveillé : frappe tous les ennemis et les étourdit.
  p.eveil = true;
  const b = creerBataille({ groupe: [p], ennemis: [gnoll(3), gnoll(3), gnoll(3)], inventaire: {}, rng: rngT(2) });
  for (const e of b.ennemis) { e.vit = -5; e.pvMax = e.pv = 9999; }
  demarrer(b);
  const a = actionsDe(b).find((x) => x.type === 'eveil');
  assert.ok(a && a.cibles === 'groupe', 'un sort de zone ne demande pas de cible');
  actif(b).pm = 5;
  assert.equal(agir(b, { type: 'eveil' }).ok, false, 'il coûte du mana');
  actif(b).pm = 30;
  const ev = agir(b, { type: 'eveil' }).evenements;
  assert.equal(actif(b).pm >= 30 - COUT_EVEIL, true);
  assert.equal(new Set(ev.filter((x) => x.t === 'degats' && x.camp === 'e').map((x) => x.idx)).size, 3);
  assert.equal(ev.filter((x) => x.t === 'action' && x.genre === 'etourdi').length, 3, 'les trois ennemis perdent leur tour');
  assert.ok(!ev.some((x) => x.t === 'degats' && x.camp === 'h'), 'personne n’a pu frapper');
});

test('un boss ne se laisse pas étourdir, et l’éveil d’un soigneur relève les morts', () => {
  const pix = creerPersonnage('pix', 10);
  pix.eveil = true;
  const boss = ennemiRpg(MODELES_PAR_ID.vorgath, 3, 'feu', rngT(1), { boss: true });
  boss.vit = -5;
  const b = creerBataille({ groupe: [pix], ennemis: [boss], inventaire: {}, rng: rngT(2) });
  demarrer(b);
  actif(b).pm = 30;
  const ev = agir(b, { type: 'eveil' }).evenements;
  assert.ok(!ev.some((x) => x.genre === 'etourdi'));

  const groupe = ['elissende', 'brandel'].map((id) => creerPersonnage(id, 8));
  groupe[0].eveil = true;
  const b2 = creerBataille({ groupe, ennemis: [gnoll(1)], inventaire: {}, rng: rngT(3) });
  b2.ennemis[0].vit = -5;
  b2.heros[0].vit = 99;
  demarrer(b2);
  b2.heros[1].pv = 0;
  actif(b2).pm = 30;
  const ev2 = agir(b2, { type: 'eveil' }).evenements;
  assert.ok(ev2.some((x) => x.t === 'releve' && x.idx === 1));
  assert.ok(b2.heros[1].pv > 0);
});

test('au retour de voyage, le compagnon rapporte sa compétence', () => {
  const av = A.creerAventure({ heros: 'kaelis', seed: 3 });
  av.groupe.push(creerPersonnage('mei', 4));
  av.etape = { type: 'depart', idx: 1, histoire: 'lettre' };
  assert.equal(A.departCourant(av).eveil, EVEILS.mei, 'elle est annoncée avant de choisir');
  av.absents = [{ perso: av.groupe.pop(), reste: 0, adieu: false, histoire: 'lettre' }];
  av.etape = { type: 'resultat', titre: 't', glyphe: '', dit: '', effet: '' };
  A.terminerEtape(av);
  assert.equal(av.etape.eveil, 'mei');
  assert.ok(av.etape.effet.includes(EVEILS.mei.nom));
  assert.equal(eveilDe(av.groupe[1]), EVEILS.mei);
});

/* ================================================================== */
/* Changer d'appareil                                                 */
/* ================================================================== */

test('une partie voyage d’un appareil à l’autre par un code', async () => {
  const av = jouerAventure(A.creerAventure({ heros: 'pix', seed: 41 }), { maxEtapes: 60 });
  const code = await versCode(av, { max: 3, fini: false });
  assert.match(code, /^RAID[01]\.[A-Za-z0-9_-]+$/, 'du texte sans caractère gênant');
  assert.ok(code.length < JSON.stringify(av).length, 'le code est plus court que la partie');
  const r = await depuisCode(`  ${code.slice(0, 40)}\n${code.slice(40)}  `);
  assert.ok(r.ok, 'les espaces et retours à la ligne d’un copier-coller ne gênent pas');
  assert.deepEqual(r.partie, JSON.parse(JSON.stringify(av)));
  assert.deepEqual(r.progression, { max: 3, fini: false });
  // La partie relue se joue : elle n'a rien perdu en route.
  const suite = jouerAventure(r.partie, { maxEtapes: 40 });
  assert.ok(suite.stats.combats >= av.stats.combats);

  assert.equal((await depuisCode('bonjour')).ok, false);
  assert.equal((await depuisCode(code.slice(0, code.length - 30))).ok, false, 'un code tronqué est refusé');
  assert.equal((await depuisCode('RAID0.e30')).ok, false, 'un code sans partie est refusé');
});

test('les trois sorts d’un légendaire font trois choses différentes', () => {
  for (const h of LEGENDES) {
    const gestes = [h.special.effet.type, h.ultime.effet.type, JSON.stringify(EVEILS[h.id])];
    assert.equal(new Set(gestes).size, 3, h.id);
    assert.notEqual(h.special.effet.type, h.ultime.effet.type, h.id);
  }
  // Aldric : il provoque, il fracasse, il jure. Plus de bouclier en double.
  assert.equal(PAR_ID.aldric.special.effet.type, 'provoc');
  assert.equal(PAR_ID.aldric.ultime.effet.type, 'fracas');
  assert.deepEqual(EVEILS.aldric.puis.map((o) => o.type), ['serment']);
});

test('le Serment d’acier empêche de tomber, le Fracas affaiblit tout le monde', () => {
  const groupe = ['aldric', 'kaelis'].map((id) => creerPersonnage(id, 8));
  groupe[0].eveil = true;
  const gros = () => { const e = gnoll(6); e.atk = 9999; e.vit = -5; return e; };
  const b = creerBataille({ groupe, ennemis: [gros(), gros()], inventaire: {}, rng: rngT(5) });
  b.heros[0].vit = 99;
  demarrer(b);
  assert.equal(actif(b).id, 'aldric');
  actif(b).pm = 40;
  const ev = agir(b, { type: 'eveil' }).evenements;
  assert.ok(b.serment || ev.some((x) => x.quoi === 'serment'));
  while (!b.fini && b.manche === 1) ev.push(...agir(b, { type: 'defendre' }).evenements);
  assert.ok(!ev.some((x) => x.t === 'ko' && x.camp === 'h'), 'personne n’est tombé malgré des coups mortels');
  assert.ok(b.heros.every((x) => x.pv >= 1));

  const b2 = creerBataille({ groupe: [creerPersonnage('aldric', 8)], ennemis: [gnoll(3), gnoll(3)], inventaire: {}, rng: rngT(6) });
  for (const e of b2.ennemis) { e.vit = -5; e.pvMax = e.pv = 9999; }
  demarrer(b2);
  actif(b2).pm = 40;
  agir(b2, { type: 'ultime', cible: 0 });
  assert.ok(b2.ennemis.every((e) => e.entrave), 'les deux ennemis sont affaiblis');
  assert.ok(b2.ennemis.every((e) => e.pv < 9999), 'et les deux ont été frappés');

  // Ignar assomme : la cible perd son tour.
  const b3 = creerBataille({ groupe: [creerPersonnage('ignar', 8)], ennemis: [gnoll(3)], inventaire: {}, rng: rngT(7) });
  b3.ennemis[0].vit = -5; b3.ennemis[0].pvMax = b3.ennemis[0].pv = 9999;
  demarrer(b3);
  actif(b3).pm = 40;
  const ev3 = agir(b3, { type: 'special', cible: 0 }).evenements;
  assert.ok(ev3.some((x) => x.t === 'action' && x.genre === 'etourdi'));
});

test('le nom de chaque boss rappelle le nom de son chapitre', () => {
  const mots = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z]+/).filter((m) => m.length >= 4)
    // On compare les racines : « Noyées » et « Noyée », « Gelé » et « Gelée ».
    .map((m) => m.replace(/(ees|es|ee|e|s)$/, ''));
  for (const [i, a] of ACTES.entries()) {
    const boss = MODELES_PAR_ID[a.boss].nom;
    const commun = mots(a.nom).filter((m) => mots(boss).includes(m));
    assert.ok(commun.length >= 1, `chapitre ${i + 1} « ${a.nom} » et son boss « ${boss} » n’ont aucun mot en commun`);
  }
});

/* ================================================================== */
/* Raretés hautes et trophées                                         */
/* ================================================================== */

test('légendaire et mythique sont rares, plus forts, et les boss y aident', () => {
  assert.deepEqual(ORDRE_RARETES, ['commun', 'rare', 'epique', 'legendaire', 'mythique']);
  const epee = PIECES.find((m) => m.base === 'Épée');
  let avant = 0;
  for (const r of ORDRE_RARETES) {
    const it = forger(epee, 3, r, rngT(1));
    assert.ok(it.atk > avant, `${r} frappe plus fort que la rareté d’en dessous`);
    assert.ok(it.nom.length > 5);
    avant = it.atk;
  }
  const compte = (faveur) => {
    const r = rngT(9);
    const n = { legendaire: 0, mythique: 0, boss: 0 };
    for (let i = 0; i < 20000; i++) { const x = tirerRarete(r, 5, 'commun', faveur); if (x in n) n[x]++; }
    return n;
  };
  const sans = compte(0), boss = compte(3);
  assert.ok(sans.legendaire > 0 && sans.legendaire < 20000 * 0.05, 'rare, mais possible');
  assert.ok(sans.mythique < sans.legendaire);
  assert.ok(boss.legendaire > sans.legendaire * 2 && boss.mythique > sans.mythique * 2, 'un boss aide vraiment');
  assert.equal(sans.boss + boss.boss, 0, 'la rareté BOSS ne se tire jamais au sort');
});

test('chaque boss et chaque élite a son trophée, à son nom', () => {
  const sansAccent = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const a of ACTES.slice(0, -1)) assert.ok(TROPHEES[a.boss], `le boss ${a.boss} n’a pas de trophée`);
  for (const m of parRang('elite')) assert.ok(TROPHEES[m.id], `l’élite ${m.id} n’a pas de trophée`);
  for (const [id, t] of Object.entries(TROPHEES)) {
    const prenom = sansAccent(MODELES_PAR_ID[id].nom.replace(/^(La|Le) /, '').split(/[ ,]/)[0]);
    assert.ok(sansAccent(t.nom).includes(prenom), `« ${t.nom} » ne nomme pas ${prenom}`);
    const it = forgerTrophee(id, 4, rngT(2));
    assert.equal(it.rarete, 'boss');
    assert.equal(it.trophee, id);
    assert.ok(valeurPiece(it) > valeurPiece(forgerTrophee(id, 1, rngT(2))), 'il grandit avec le chapitre');
    assert.ok(texteBonus(it).length > 3);
  }
  assert.equal(forgerTrophee('gnoll', 1, rngT(1)), null, 'un monstre ordinaire n’en a pas');
  assert.ok(RARETES.boss.facteur > RARETES.legendaire.facteur);
});

test('un boss lâche toujours son trophée, une élite parfois, et jamais ailleurs', () => {
  const av = A.creerAventure({ heros: 'mordrec', seed: 30 });
  av.acte = 2;
  av.etape = { type: 'combat', salle: 'boss', ennemis: composer(rngT(1), 2, 'boss') };
  A.conclureCombat(av, true);
  assert.equal(av.etape.trophees.length, 1);
  const t = av.sac.find((x) => x.uid === av.etape.trophees[0]);
  assert.equal(t.trophee, 'vorgath');
  assert.equal(t.rarete, 'boss');
  A.prendreRecompense(av);
  assert.ok(av.sac.includes(t), 'il reste dans le sac même sans rien choisir');

  let trouves = 0;
  const N = 300;
  for (let seed = 0; seed < N; seed++) {
    const x = A.creerAventure({ heros: 'mordrec', seed });
    x.etape = { type: 'combat', salle: 'elite', ennemis: composer(rngT(seed), 1, 'elite') };
    A.conclureCombat(x, true);
    trouves += x.etape.trophees.length;
    // Chez le marchand et dans les coffres : jamais de trophée.
    x.etape = null;
    for (let i = 0; i < 6; i++) assert.notEqual(pieceAuHasard(A.rng(x), 3, { chance: 40, faveur: 3 }).rarete, 'boss');
  }
  assert.ok(trouves / N > 0.25 && trouves / N < 0.45, `${trouves} trophées d’élite sur ${N}`);

  const banal = A.creerAventure({ heros: 'mordrec', seed: 1 });
  banal.etape = { type: 'combat', salle: 'combat', ennemis: [gnoll()] };
  A.conclureCombat(banal, true);
  assert.equal(banal.etape.trophees.length, 0);
});

/* ================================================================== */
/* Une partie en cours suit les mises à jour                          */
/* ================================================================== */

test('une vieille sauvegarde reçoit les nouveautés sans rien perdre', () => {
  // Une partie telle qu'on en sauvegardait avant les talents, les quêtes,
  // les reliques, les départs, les chapitres et les difficultés.
  const neuve = jouerAventure(A.creerAventure({ heros: 'kaelis', seed: 23 }), { maxEtapes: 70 });
  const vieille = JSON.parse(JSON.stringify(neuve));
  for (const k of ['format', 'difficulte', 'reliques', 'bossVus', 'absents', 'recruesDues', 'departActe',
    'balade', 'quete', 'offresQuetes', 'cines']) delete vieille[k];
  for (const p of vieille.groupe) { delete p.talents; delete p.legendaire; }
  for (const n of vieille.carte.noeuds) if (n.type === 'marchand') n.type = 'combat';
  vieille.etape = null;
  vieille.position = null;      // au pied de la carte du chapitre
  vieille.visites = [];
  vieille.groupe[0].xp = SEUILS_XP[13];
  vieille.groupe[0].niveau = 13;
  vieille.dons = ['ferveur', 'robustesse', 'rempart', 'arcanes'];   // les quatre dons d'avant, niveaux 3 à 9
  vieille.donsEnAttente = 0;
  vieille.reprise = JSON.stringify({ ...vieille, reprise: undefined });
  const temoin = { or: vieille.or, niveaux: vieille.groupe.map((p) => p.niveau), sac: vieille.sac.length, acte: vieille.acte };

  const fait = A.mettreAJour(vieille);
  assert.ok(fait.length >= 3, 'on dit au joueur ce qui a changé');
  assert.equal(vieille.format, A.FORMAT);
  assert.deepEqual({ or: vieille.or, niveaux: vieille.groupe.map((p) => p.niveau), sac: vieille.sac.length, acte: vieille.acte }, temoin, 'rien n’est retiré');
  assert.equal(vieille.difficulte, 'normal');
  assert.equal(vieille.offresQuetes.length, 2);
  assert.ok(vieille.groupe.every((p) => p.talents && T.pointsLibres(p) === p.niveau - 1), 'les points de talent sont là');
  assert.equal(vieille.donsEnAttente, 1, 'le don du niveau 12 est rattrapé');
  // Un marchand est désormais devant, sur un chemin qu'on peut encore prendre.
  const devant = new Set();
  const pile = A.sallesAccessibles(vieille).map((n) => n.id);
  while (pile.length) { const id = pile.pop(); if (devant.has(id)) continue; devant.add(id); pile.push(...vieille.carte.noeuds.find((n) => n.id === id).suivants); }
  assert.ok(vieille.carte.noeuds.some((n) => devant.has(n.id) && n.type === 'marchand'));

  assert.deepEqual(A.mettreAJour(vieille), [], 'sans effet la deuxième fois');
  assert.deepEqual(A.mettreAJour(A.creerAventure({ seed: 1 })), [], 'une partie neuve est déjà à jour');

  // Elle se joue jusqu'au bout avec tout le reste du jeu, feu de camp d'avant la mise à jour compris.
  vieille.etape = { type: 'combat', salle: 'combat', ennemis: [gnoll()] };
  A.conclureCombat(vieille, false);
  assert.ok(A.reprendre(vieille).ok);
  assert.equal(vieille.format, A.FORMAT, 'le feu de camp ancien est mis à jour lui aussi');
  const fin = jouerAventure(vieille, { maxEtapes: 6000 });
  assert.ok(fin.acte > temoin.acte || fin.victoire, 'la partie continue vers les nouveaux chapitres');
});

test('la sauvegarde en ligne garde la plus récente, et refuse d’être écrasée par une plus vieille', async () => {
  sauvegarde.vider();
  const cle = 'ABCDEFGHJK';
  const get = (c) => sauvegarde.traiter({ methode: 'GET', cle: c });
  const put = (corps) => sauvegarde.traiter({ methode: 'PUT', corps });

  assert.equal((await get(cle)).statut, 404, 'rien sous ce code pour l’instant');
  assert.equal((await get('trop-court')).statut, 400);
  assert.equal((await put({ cle, charge: 'RAID1.pc', date: 1000 })).statut, 200);
  // Le code se tape comme on veut : minuscules, tiret.
  assert.deepEqual((await get('abcde-fghjk')).json, { charge: 'RAID1.pc', date: 1000 });

  assert.equal((await put({ cle, charge: 'RAID1.tel', date: 2000 })).statut, 200, 'le téléphone joue après');
  const retard = await put({ cle, charge: 'RAID1.vieux', date: 1500 });
  assert.equal(retard.statut, 409, 'un appareil en retard n’écrase rien');
  assert.equal(retard.json.charge, 'RAID1.tel', 'et reçoit la partie à jour');
  assert.equal((await get(cle)).json.charge, 'RAID1.tel');

  assert.equal((await put({ cle, charge: 'x'.repeat(sauvegarde.CHARGE_MAX + 1), date: 3000 })).statut, 400);
  assert.equal((await put({ cle: 'non', charge: 'a', date: 1 })).statut, 400);
  assert.equal((await sauvegarde.traiter({ methode: 'DELETE', cle })).statut, 405);

  // Sur Vercel sans base de données, le service dit qu'il n'est pas disponible.
  process.env.VERCEL = '1';
  try { assert.equal((await get(cle)).statut, 503); } finally { delete process.env.VERCEL; }
});

test('aucun personnage n’a deux sorts qui font la même chose', () => {
  for (const h of [...HEROS, ...LEGENDES]) {
    const a = h.special.effet ? h.special.effet.type : 'coup';
    const b = h.ultime.effet ? h.ultime.effet.type : 'coup';
    assert.notEqual(a, b, `${h.id} : ${h.special.nom} et ${h.ultime.nom} ont le même effet (${a})`);
  }
});
