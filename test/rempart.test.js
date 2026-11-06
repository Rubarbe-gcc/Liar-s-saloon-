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

test('la campagne : toutes les tours et tous les ennemis ; les trois premiers lieux ont les cinq tours de base et les deux boss', () => {
  const tours = new Set(NIVEAUX.flatMap(n => n.tours));
  for (const t of ORDRE_TOURS) assert.ok(tours.has(t), t);
  const ennemis = new Set(NIVEAUX.flatMap(n => n.vagues.flat().map(g => g.type)));
  for (const [ty, def] of Object.entries(ENNEMIS)) if (!def.enfant) assert.ok(ennemis.has(ty), ty);
  const premiers = NIVEAUX.slice(0, 3);
  for (const t of ['rafale', 'mortier', 'givre', 'perce', 'foudre']) assert.ok(premiers.some(n => n.tours.includes(t)), t);
  for (const b of ['broyeur', 'nuee']) assert.ok(premiers.some(n => n.vagues.flat().some(g => g.type === b)), b);
  // Pas de Furtif avant qu'on puisse bâtir un Phare.
  for (const n of NIVEAUX) if (n.vagues.flat().some(g => ENNEMIS[g.type].furtif)) assert.ok(n.tours.includes('phare'), n.nom);
  // Chaque tour a deux spécialisations.
  for (const t of ORDRE_TOURS) assert.equal(TOURS[t].branches.length, 2, t);
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
  assert.equal(r.tour.niveau, 3);
  assert.equal(P.ameliorer(p, r.tour.id).raison, 'branche', 'au niveau 3, il faut choisir');
  const orAvant = p.or;
  assert.ok(P.ameliorer(p, r.tour.id, 1).ok);
  assert.equal(r.tour.niveau, 4);
  assert.equal(p.or, orAvant - TOURS.rafale.branches[1].cout);
  assert.equal(P.statsDe(r.tour).portee, TOURS.rafale.branches[1].portee);
  assert.equal(P.ameliorer(p, r.tour.id, 0).raison, 'max');
  p.or = 1000;
  P.vendre(p, r.tour.id);
  P.construire(p, 0, 'rafale');
  r.tour = p.tours[0];
  P.ameliorer(p, r.tour.id);
  P.ameliorer(p, r.tour.id);
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

/** Une partie vide (aucune vague prévue) où l'on pose ce qu'on veut. */
function bac(id = 6) {
  const p = P.creerPartie(id);
  p.phase = 'jeu';
  p.vague = p.totalVagues;
  p.or = 10000;
  return p;
}
const ajouter = (p, type, d = 4) => { p.file.push({ t: 0, type, depart: 0, vague: 0 }); P.pas(p); const e = p.ennemis[p.ennemis.length - 1]; e.d = d; return e; };
const pres = (p, e) => p.carte.emplacements.reduce((a, b) => (Math.hypot(a.x - e.x, a.z - e.z) <= Math.hypot(b.x - e.x, b.z - e.z) ? a : b));

test('le Furtif : invisible pour les tours, sauf dans la lumière d’un Phare', () => {
  const p = bac();
  const e = ajouter(p, 'furtif', 6);
  P.pas(p);
  const emp = pres(p, e);
  const t = P.construire(p, emp.id, 'rafale').tour;
  for (let i = 0; i < 10; i++) P.pas(p);
  assert.equal(t.tirs, 0, 'sans Phare, la Rafale ne le voit pas');
  const autre = p.carte.emplacements.filter(m => m.id !== emp.id).reduce((a, b) => (Math.hypot(a.x - e.x, a.z - e.z) <= Math.hypot(b.x - e.x, b.z - e.z) ? a : b));
  P.construire(p, autre.id, 'phare');
  for (let i = 0; i < 10; i++) P.pas(p);
  assert.ok(t.tirs > 0, 'dans la lumière, elle tire');
});

test('le Phare renforce les tours voisines', () => {
  const tirer = avecPhare => {
    const p = bac();
    const e = ajouter(p, 'cuirasse', 6);
    e.pv = e.pvMax = 1e6;
    P.pas(p);
    const emp = pres(p, e);
    const t = P.construire(p, emp.id, 'perce').tour;
    if (avecPhare) {
      const autre = p.carte.emplacements.filter(m => m.id !== emp.id).reduce((a, b) => (Math.hypot(a.x - emp.x, a.z - emp.z) <= Math.hypot(b.x - emp.x, b.z - emp.z) ? a : b));
      P.construire(p, autre.id, 'phare');
    }
    for (let i = 0; i < 60; i++) { e.d = 6; P.pas(p); }
    return t.degats / Math.max(1, t.tirs);
  };
  const sans = tirer(false), avec = tirer(true);
  assert.ok(avec > sans * 1.1, `${sans} → ${avec}`);
});

test('le Fouisseur ne prend aucun coup sous terre', () => {
  const p = bac();
  const e = ajouter(p, 'fouisseur');
  e.fouitT = 0.01;
  P.pas(p);
  assert.ok(e.sous);
  const pv = e.pv;
  e.bruleT = 1; e.brule = 1000;
  P.pas(p);
  assert.equal(e.pv, pv, 'même le feu ne l’atteint pas');
  for (let i = 0; i < 60; i++) P.pas(p);
  assert.equal(e.sous, false, 'il ressort');
});

test('le Pavois donne un bouclier qui encaisse avant les PV', () => {
  const p = bac();
  const pav = ajouter(p, 'pavois', 5);
  const voisin = ajouter(p, 'rodeur', 5.3);
  P.pas(p);
  pav.bouclierT = 0.01;
  P.pas(p);
  assert.ok(voisin.bouclier > 0);
  const pv = voisin.pv, b = voisin.bouclier;
  voisin.bruleT = P.DT * 1.5; voisin.brule = 10 / P.DT; // ~10 dégâts d'un coup
  P.pas(p);
  assert.equal(voisin.pv, pv);
  assert.ok(voisin.bouclier < b);
});

test('la Braise met le feu, et le feu passe sous l’armure', () => {
  const p = bac();
  const e = ajouter(p, 'cuirasse', 6);
  e.pv = e.pvMax = 1e6;
  P.pas(p);
  const t = P.construire(p, pres(p, e).id, 'braise').tour;
  for (let i = 0; i < 40 && !t.tirs; i++) { e.d = 6; P.pas(p); }
  assert.ok(t.tirs > 0);
  assert.ok(e.bruleT > 0 && e.brule === TOURS.braise.niveaux[0].brulure);
  const pv = e.pv;
  t.recharge = 100;
  for (let i = 0; i < 30; i++) { e.d = 6; P.pas(p); }
  assert.ok(pv - e.pv > TOURS.braise.niveaux[0].brulure * 0.9, 'une seconde de brûlure entière, malgré 6 d’armure');
});

test('spécialisations : la Baliste traverse, le Blizzard ralentit tout, la Surcharge sonne', () => {
  // Baliste : plusieurs Rouilleux alignés prennent le carreau.
  let p = bac();
  const file = [5, 5.3, 5.6].map(d => ajouter(p, 'rodeur', d));
  for (const e of file) e.pv = e.pvMax = 1e6;
  P.pas(p);
  let t = P.construire(p, pres(p, file[1]).id, 'perce').tour;
  Object.assign(t, { niveau: 4, branche: 0, recharge: 0 });
  for (let i = 0; i < 3; i++) P.pas(p);
  assert.ok(file.filter(e => e.pv < e.pvMax).length >= 2, 'au moins deux touchés d’un coup');
  // Blizzard : tout ce qui est à portée ralentit, sans tir.
  p = bac();
  const a = ajouter(p, 'rodeur', 6), b = ajouter(p, 'filou', 6.4);
  P.pas(p);
  t = P.construire(p, pres(p, a).id, 'givre').tour;
  Object.assign(t, { niveau: 4, branche: 0 });
  P.pas(p);
  assert.ok(a.ralenti > 0 && b.ralenti > 0);
  assert.equal(t.tirs, 0);
  // Surcharge : la cible reste sonnée.
  p = bac();
  const c = ajouter(p, 'cuirasse', 6);
  c.pv = c.pvMax = 1e6;
  P.pas(p);
  t = P.construire(p, pres(p, c).id, 'foudre').tour;
  Object.assign(t, { niveau: 4, branche: 1, recharge: 0 });
  for (let i = 0; i < 3; i++) { c.d = 6; P.pas(p); }
  assert.ok(c.etourdiT > 0);
  const d0 = c.d;
  P.pas(p);
  assert.equal(c.d, d0, 'sonné, il ne bouge plus');
});
