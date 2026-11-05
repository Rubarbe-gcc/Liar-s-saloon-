/**
 * REMPART — tests des cartes, du moteur et de l'équilibre de la campagne.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TOURS, ENNEMIS, ORDRE_TOURS } from '../public/shared/rempart/donnees.js';
import { NIVEAUX } from '../public/shared/rempart/niveaux.js';
import * as P from '../public/shared/rempart/partie.js';
import { creerIA, jouerIA, couverture } from '../public/shared/rempart/ia.js';

/** Joue une partie entière avec le joueur automatique. */
function jouer(id, o = {}, graine = 1) {
  const p = P.creerPartie(id, { graine });
  const ia = creerIA(p, o);
  for (let i = 0; i < 30 * 60 * 40 && p.phase !== 'victoire' && p.phase !== 'defaite'; i++) {
    jouerIA(p, ia);
    P.pas(p);
    p.evts.length = 0;
  }
  return p;
}

/** Fait avancer le temps de `s` secondes. */
const avancer = (p, s) => { for (let i = 0; i < s / P.DT; i++) P.pas(p); };

test('les cartes : 20 × 12, un Cœur, des chemins sans ambiguïté, des emplacements utiles', () => {
  for (const n of NIVEAUX) {
    const c = P.analyserCarte(n.carte);
    assert.equal(c.W, 20, n.nom);
    assert.equal(c.H, 12, n.nom);
    assert.ok(c.emplacements.length >= 10, `${n.nom} : assez d'emplacements`);
    for (const emp of c.emplacements) {
      assert.ok(!c.estChemin(emp.c, emp.r), `${n.nom} : emplacement sur le chemin`);
      assert.ok(couverture(c, emp, 3).sol > 0, `${n.nom} : emplacement (${emp.c}, ${emp.r}) inutile`);
    }
    for (const ch of c.chemins) {
      assert.ok(ch.total > 15, `${n.nom} : chemin trop court (${ch.total})`);
      const fin = ch.points[ch.points.length - 1];
      assert.deepEqual([fin.x, fin.z], [c.base.x, c.base.z]);
    }
    const departs = new Set(n.vagues.flat().map(g => g.depart));
    for (const d of departs) assert.ok(d < c.chemins.length, `${n.nom} : départ ${d} inexistant`);
    for (const ty of n.vagues.flat().map(g => g.type)) assert.ok(ENNEMIS[ty], ty);
    for (const ty of n.tours) assert.ok(TOURS[ty], ty);
  }
});

test('une carte mal dessinée est refusée', () => {
  const carte = NIVEAUX[0].carte.slice();
  carte[0] = '^^**....*...#.**^^^^'; // une case de chemin isolée
  assert.throws(() => P.analyserCarte(carte), /orpheline/);
});

test('trois premiers niveaux : toutes les tours et tous les ennemis, boss compris', () => {
  const premiers = NIVEAUX.slice(0, 3);
  const tours = new Set(premiers.flatMap(n => n.tours));
  for (const t of ORDRE_TOURS) assert.ok(tours.has(t), t);
  const ennemis = new Set(premiers.flatMap(n => n.vagues.flat().map(g => g.type)));
  for (const [ty, def] of Object.entries(ENNEMIS)) {
    if (def.enfant) continue;
    assert.ok(ennemis.has(ty), ty);
  }
});

test('construire, améliorer, vendre : l’or est juste', () => {
  const p = P.creerPartie(1);
  const or0 = p.or;
  const r = P.construire(p, 0, 'rafale');
  assert.ok(r.ok);
  assert.equal(p.or, or0 - 60);
  assert.equal(P.construire(p, 0, 'mortier').raison, 'occupe');
  assert.equal(P.construire(p, 1, 'perce').raison, 'verrouillee');
  assert.ok(P.ameliorer(p, r.tour.id).ok);
  assert.equal(r.tour.niveau, 2);
  assert.equal(p.or, or0 - 60 - 75);
  p.or = 10;
  assert.equal(P.ameliorer(p, r.tour.id).raison, 'or');
  p.or = 1000;
  P.ameliorer(p, r.tour.id);
  assert.equal(P.ameliorer(p, r.tour.id).raison, 'max');
  const avant = p.or;
  const v = P.vendre(p, r.tour.id);
  assert.equal(v.or, Math.floor((60 + 75 + 130) * 0.7));
  assert.equal(p.or, avant + v.or);
  assert.equal(p.tours.length, 0);
});

test('les vagues : rien ne bouge avant l’appel, puis compte à rebours et bonus d’appel anticipé', () => {
  const p = P.creerPartie(1);
  avancer(p, 5);
  assert.equal(p.ennemis.length, 0);
  assert.ok(P.lancerVague(p).ok);
  assert.equal(P.lancerVague(p).ok, false, 'pas deux fois pendant la sortie');
  avancer(p, 3);
  assert.ok(p.ennemis.length > 0);
  avancer(p, 10);
  assert.ok(p.compte != null && p.compte < P.PAUSE_VAGUES);
  const or = p.or, bonus = P.bonusAppel(p);
  assert.ok(bonus > 0);
  P.lancerVague(p);
  assert.equal(p.or, or + bonus);
  assert.equal(p.vague, 2);
});

test('la vague suivante part toute seule à la fin du compte', () => {
  const p = P.creerPartie(1);
  P.lancerVague(p);
  avancer(p, 12 + P.PAUSE_VAGUES + 1);
  assert.equal(p.vague, 2);
  assert.equal(p.stats.bonus, 0);
});

test('l’armure : la Rafale s’y casse les dents, le Perce-Acier passe au travers', () => {
  const p = P.creerPartie(2);
  p.phase = 'jeu';
  const mesurer = type => {
    const q = P.creerPartie(2);
    q.phase = 'jeu';
    q.or = 1000;
    // Un emplacement près du chemin, un Cuirassé qui passe devant.
    const emp = q.carte.emplacements.reduce((a, b) => (couverture(q.carte, a).sol >= couverture(q.carte, b).sol ? a : b));
    const t = P.construire(q, emp.id, type).tour;
    q.file.push({ t: 0, type: 'cuirasse', depart: 0, vague: 0 });
    q.vague = q.totalVagues; // pas d'autre vague
    for (let i = 0; i < 30 * 40 && q.ennemis.length + q.file.length; i++) P.pas(q);
    return t.degats / Math.max(1, t.tirs);
  };
  const rafale = mesurer('rafale'), perce = mesurer('perce');
  assert.ok(rafale < TOURS.rafale.niveaux[0].degats - 4, `rafale ${rafale}`);
  assert.ok(Math.abs(perce - TOURS.perce.niveaux[0].degats) < 1e-9 || perce > 40, `perce ${perce}`);
  assert.equal(p.vies, 20);
});

test('le Givre ralentit, la Grappe se divise, le Tisseur soigne', () => {
  const p = P.creerPartie(3);
  p.phase = 'jeu';
  p.vague = p.totalVagues;
  p.file.push({ t: 0, type: 'grappe', depart: 0, vague: 0 }, { t: 0, type: 'tisseur', depart: 0, vague: 0 });
  P.pas(p);
  const [grappe, tisseur] = p.ennemis;
  // Ralenti : la grappe avance moins vite.
  grappe.ralenti = 0.5; grappe.ralentiT = 1;
  const d0 = grappe.d, d1 = tisseur.d;
  avancer(p, 0.5);
  assert.ok(grappe.d - d0 < (tisseur.d - d1) * (ENNEMIS.grappe.vitesse / ENNEMIS.tisseur.vitesse) * 0.7);
  // Soin : le tisseur répare la grappe abîmée.
  grappe.pv = grappe.pvMax / 2;
  grappe.x = tisseur.x; grappe.z = tisseur.z;
  const avant = grappe.pv;
  avancer(p, 1.1);
  assert.ok(grappe.pv > avant, 'soignée');
  // Division : trois Grappillons.
  p.ennemis = p.ennemis.filter(e => e !== tisseur);
  grappe.pv = 1;
  p.tours.push({ id: 999, type: 'rafale', niveau: 1, emp: 0, x: grappe.x + 0.5, z: grappe.z, recharge: 0, cible: null, mode: 'premier', investi: 0, angle: 0, tirs: 0, degats: 0 });
  avancer(p, 0.5);
  assert.equal(p.ennemis.filter(e => e.type === 'grappillon').length, 3);
});

test('la Grande Nuée pond des Bourdons', () => {
  const p = P.creerPartie(3);
  p.phase = 'jeu';
  p.vague = p.totalVagues;
  p.file.push({ t: 0, type: 'nuee', depart: 1, vague: 0 });
  avancer(p, ENNEMIS.nuee.ponte.toutes + 0.2);
  assert.equal(p.ennemis.filter(e => e.type === 'bourdon').length, ENNEMIS.nuee.ponte.n);
});

test('les fuites coûtent des vies, jusqu’à la défaite', () => {
  const p = P.creerPartie(1);
  P.lancerVague(p);
  for (let i = 0; i < 30 * 60 * 10 && p.phase !== 'defaite'; i++) P.pas(p);
  assert.equal(p.phase, 'defaite');
  assert.equal(p.vies, 0);
  assert.equal(P.etoiles(p), 0);
});

test('déterministe : même graine, même partie', () => {
  const a = jouer(3, {}, 7), b = jouer(3, {}, 7);
  assert.equal(a.t, b.t);
  assert.equal(a.vies, b.vies);
  assert.equal(a.or, b.or);
  assert.deepEqual(a.stats, b.stats);
});

test('équilibre : un joueur raisonnable gagne chaque niveau, un joueur paresseux perd', () => {
  for (const n of NIVEAUX) {
    for (const graine of [1, 2]) {
      const bon = jouer(n.id, {}, graine);
      assert.equal(bon.phase, 'victoire', `${n.nom} (graine ${graine}) : le bon joueur perd à la vague ${bon.vague}`);
      assert.ok(P.etoiles(bon) >= 1);
    }
    const paresseux = jouer(n.id, { maxTours: 4, ameliore: false });
    assert.equal(paresseux.phase, 'defaite', `${n.nom} : quatre tours sans amélioration suffisent`);
    // Dès la Passe des Géants, une seule sorte de tour ne suffit plus.
    if (n.id < 4) continue;
    const rafales = jouer(n.id, { types: ['rafale'], maxTours: 5 });
    assert.ok(P.etoiles(rafales) <= 1, `${n.nom} : cinq Rafales suffisent`);
  }
});
