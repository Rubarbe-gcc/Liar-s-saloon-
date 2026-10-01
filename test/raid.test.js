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
import { HEROS, PAR_ID, ROLES, EFFETS, parEcole } from '../public/shared/raid/heros.js';
import { MODELES, MODELES_PAR_ID, TRAITS, SILHOUETTES, parRang, BOSS_FINAL } from '../public/shared/raid/ennemis.js';
import {
  creerPersonnage, statsDe, statsBase, gagnerXp, niveauDe, SEUILS_XP, NIVEAU_MAX, NIVEAU_ULTIME,
  sortsDe, DEPARTS, progressionNiveau,
} from '../public/shared/raid/personnages.js';
import { forger, MODELES as PIECES, pieceAuHasard, tirerRarete, texteBonus } from '../public/shared/raid/equipement.js';
import {
  genererCarte, accessibles, composer, ennemiRpg, ACTES, RANGEES, ECHELLE,
} from '../public/shared/raid/carte.js';
import {
  creerBataille, demarrer, actif, actionsDe, agir, estimer, vivants, critiqueDe,
} from '../public/shared/raid/bataille.js';
import * as A from '../public/shared/raid/aventure.js';
import { jouerCombat, jouerAventure, choisirAction } from '../public/shared/raid/ia.js';
import { spriteSvg, poses, palettePour, GRID } from '../public/shared/raid/sprites.js';
import { makeRng } from '../public/shared/hasard.js';

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
    const b = composer(rngT(s), 3, 'boss');
    assert.notEqual(b[0].modeleId, BOSS_FINAL, 'le Dragon attend l’acte 5');
    assert.equal(composer(rngT(s), 5, 'boss')[0].modeleId, BOSS_FINAL);
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
  av.acte = 5;
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
    assert.ok(vie / n < 0.85, `${heros} finit son premier combat à ${Math.round((100 * vie) / n)} %`);
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
