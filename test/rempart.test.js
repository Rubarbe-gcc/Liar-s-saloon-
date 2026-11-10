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

test('équilibre : un joueur raisonnable gagne chaque niveau, un joueur paresseux perd, et ce n’est pas trop facile', () => {
  let faciles = 0; // lieux où le bon joueur finit avec 3 étoiles
  for (const n of NIVEAUX) {
    for (const graine of [1, 2]) {
      const bon = jouer(n.id, {}, graine);
      assert.equal(bon.phase, 'victoire', `${n.nom} (graine ${graine}) : le bon joueur perd à la vague ${bon.vague}`);
      assert.ok(P.etoiles(bon) >= 1);
      if (graine === 1 && P.etoiles(bon) === 3) faciles++;
    }
    const paresseux = jouer(n.id, { maxTours: 4, ameliore: false });
    assert.equal(paresseux.phase, 'defaite', `${n.nom} : quatre tours sans amélioration suffisent`);
    // Dès la Passe des Géants, une seule sorte de tour ne suffit plus.
    if (n.id < 4) continue;
    const rafales = jouer(n.id, { types: ['rafale'], maxTours: 5 });
    assert.ok(P.etoiles(rafales) <= 2, `${n.nom} : cinq Rafales suffisent`);
  }
  // Pas trop facile : le bon joueur ne prend pas 3 étoiles partout.
  assert.ok(faciles <= 3, `${faciles} lieux sur ${NIVEAUX.length} finis avec 3 étoiles par le bon joueur : trop facile`);
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

test('le Piégeur sème des mines qui sautent sous les pas', () => {
  const p = bac(10);
  p.file.push({ t: 1e9, type: 'rodeur', depart: 0, vague: 0 }); // la partie ne doit pas finir à vide
  const t = P.construire(p, p.carte.emplacements[0].id, 'piegeur').tour;
  for (let i = 0; i < 30 * 8; i++) P.pas(p);
  assert.equal(p.mines.length, TOURS.piegeur.niveaux[0].mines, 'il pose ses mines, puis s’arrête');
  const m = p.mines[0];
  p.file = [];
  const e = ajouter(p, 'cuirasse', 1);
  e.pv = e.pvMax = 1e6;
  for (let i = 0; i < 30 * 30 && p.mines.includes(m); i++) P.pas(p);
  assert.ok(!p.mines.includes(m), 'la mine a sauté');
  assert.ok(e.pv < e.pvMax);
  P.vendre(p, t.id);
  assert.equal(p.mines.length, 0, 'vendre la tour retire ses mines');
});

test('le Harpon ne vise que les volants', () => {
  const p = bac(10);
  const sol = ajouter(p, 'rodeur', 3);
  sol.pv = sol.pvMax = 1e6;
  P.pas(p);
  const t = P.construire(p, pres(p, sol).id, 'harpon').tour;
  for (let i = 0; i < 60; i++) { sol.d = 3; P.pas(p); }
  assert.equal(t.tirs, 0);
});

test('le Bondisseur bondit, la Mue se répare, l’Hydre laisse deux Têtes', () => {
  const p = bac();
  const b = ajouter(p, 'bondisseur', 2);
  const m = ajouter(p, 'mue', 2);
  b.sautT = 0.01;
  const d0 = b.d;
  for (let i = 0; i < 15; i++) P.pas(p);
  assert.ok(b.d - d0 > ENNEMIS.bondisseur.saut.distance * 0.9);
  m.pv = m.pvMax / 2;
  for (let i = 0; i < 60; i++) P.pas(p);
  assert.ok(m.pv > m.pvMax * 0.55, 'la Mue a regagné des PV');
  const h = ajouter(p, 'hydre', 3);
  h.pv = 1;
  const t = P.construire(p, pres(p, h).id, 'rafale').tour;
  t.mode = 'fort';
  for (let i = 0; i < 60 && !h.mort; i++) P.pas(p);
  assert.equal(p.ennemis.filter(e => e.type === 'tete').length, 2);
});

test('le Seigneur Rouille enrage sous la moitié de ses PV et appelle des Furtifs', () => {
  const p = bac();
  const s = ajouter(p, 'seigneur', 3);
  const armure = s.armure;
  s.pv = s.pvMax * 0.4;
  P.pas(p);
  assert.ok(s.enrage);
  assert.equal(s.armure, armure + ENNEMIS.seigneur.rage.armure);
  for (let i = 0; i < 30 * (ENNEMIS.seigneur.ponte.toutes + 0.5); i++) P.pas(p);
  assert.ok(p.ennemis.filter(e => e.type === 'furtif').length >= ENNEMIS.seigneur.ponte.n);
});

test('les dégâts des tours passent par FACTEUR_DEGATS', async () => {
  const { FACTEUR_DEGATS } = await import('../public/shared/rempart/donnees.js');
  assert.equal(FACTEUR_DEGATS, 0.8);
  assert.equal(TOURS.rafale.niveaux[0].degats, 7.2);
  for (const t of Object.values(TOURS)) for (const s of [...t.niveaux, ...t.branches]) if (s.degats != null) assert.ok(s.degats >= 1);
});

test('le Bastion arrive avec un bouclier, le Réparateur soigne sauf s’il est sonné', () => {
  const p = bac();
  const b = ajouter(p, 'bastion', 4);
  assert.ok(b.bouclier > 0);
  const rep = ajouter(p, 'reparateur', 4.2);
  const r = ajouter(p, 'rodeur', 4.4);
  P.pas(p);
  r.pv = r.pvMax / 2;
  let pv = r.pv;
  for (let i = 0; i < 10; i++) P.pas(p);
  assert.ok(r.pv > pv, 'soigné en continu');
  rep.etourdiT = 2;
  pv = r.pv;
  for (let i = 0; i < 10; i++) P.pas(p);
  assert.equal(r.pv, pv, 'sonné, il ne soigne plus');
});

test('le Colosse de Rouille ne lâche des Cliquets qu’une fois blessé', () => {
  const p = bac();
  const c = ajouter(p, 'colosse', 3);
  for (let i = 0; i < 30 * 8; i++) P.pas(p);
  assert.equal(p.ennemis.filter(e => e.type === 'cliquet').length, 0);
  c.pv = c.pvMax * 0.7;
  for (let i = 0; i < 30 * 6; i++) P.pas(p);
  assert.ok(p.ennemis.filter(e => e.type === 'cliquet').length >= ENNEMIS.colosse.ponte.n);
  c.pv = c.pvMax * 0.3;
  P.pas(p);
  assert.ok(c.enrage);
});

test('la campagne garde un troisième départ (Q) au Cimetière des Machines', () => {
  const c = P.analyserCarte(NIVEAUX.find(n => n.id === 16).carte);
  assert.equal(c.chemins.length, 3);
});

test('l’Aimant repousse, la Garnison bloque, le Rayon chauffe', () => {
  // Aimant : le Rôdeur recule sur le chemin.
  let p = bac(14);
  const r = ajouter(p, 'rodeur', 8);
  P.pas(p);
  const t = P.construire(p, pres(p, r).id, 'aimant').tour;
  t.recharge = 0;
  const d0 = r.d;
  P.pas(p);
  assert.ok(r.d < d0 - 0.3, `recul ${d0} → ${r.d}`);
  // Garnison : un garde arrête le Rôdeur.
  p = bac(14);
  const e = ajouter(p, 'cuirasse', 0.5);
  e.pv = e.pvMax = 1e6;
  const g = P.construire(p, p.carte.emplacements[0].id, 'garnison').tour;
  let arrete = false;
  for (let i = 0; i < 30 * 40 && !arrete; i++) { P.pas(p); arrete = !!e.bloquePar; }
  assert.ok(arrete, 'le Cuirassé est arrêté par un garde');
  const d1 = e.d;
  for (let i = 0; i < 10; i++) P.pas(p);
  assert.equal(e.d, d1, 'il ne bouge plus');
  assert.ok(g.gardes.length >= 2);
  // Rayon : les dégâts montent en restant sur la même cible.
  p = bac(14);
  const c = ajouter(p, 'bastion', 6);
  c.pv = c.pvMax = 1e6; c.bouclier = 0;
  P.pas(p);
  const ry = P.construire(p, pres(p, c).id, 'rayon').tour;
  const mesure = () => { const a = c.pv; for (let i = 0; i < 15; i++) { c.d = 6; P.pas(p); } return a - c.pv; };
  const debut = mesure();
  for (let i = 0; i < 60; i++) { c.d = 6; P.pas(p); }
  assert.ok(mesure() > debut * 1.5, 'le rayon a chauffé');
  assert.ok(ry.chauffe > 0.5);
});

test('le Brouilleur coupe les tours, le Givrin ne ralentit pas, la Ruche lâche des Rôdeurs, le Golem se couvre', () => {
  let p = bac(14);
  const b = ajouter(p, 'brouilleur', 6);
  P.pas(p);
  const t = P.construire(p, pres(p, b).id, 'rafale').tour;
  b.brouilleT = 0.01;
  b.x = t.x; b.z = t.z; // juste à côté de la tour
  P.pas(p);
  assert.ok(t.brouilleT > 0, 'la tour est brouillée');
  const tirs = t.tirs;
  for (let i = 0; i < 30; i++) { b.d = 6; P.pas(p); }
  assert.equal(t.tirs, tirs, 'brouillée, elle ne tire plus');
  // Givrin
  p = bac(14);
  const gv = ajouter(p, 'givrin', 3);
  P.pas(p);
  gv.ralenti = 0; gv.etourdiT = 0;
  const tg = P.construire(p, pres(p, gv).id, 'givre').tour;
  for (let i = 0; i < 60; i++) P.pas(p);
  assert.ok(tg.tirs > 0);
  assert.equal(gv.ralenti, 0);
  // Ruche
  p = bac(17);
  const ru = ajouter(p, 'ruche', 3);
  for (let i = 0; i < 30 * (ENNEMIS.ruche.ponte.toutes + 0.5); i++) P.pas(p);
  assert.ok(p.ennemis.some(e => e.type === 'rodeur' && !e.def.vole));
  void ru;
  // Golem
  p = bac(18);
  const go = ajouter(p, 'golem', 3);
  go.carapaceCycle = 0.01;
  P.pas(p);
  assert.ok(go.carapaceT > 0);
  const pv = go.pv;
  go.bruleT = 1; go.brule = 1000;
  P.pas(p);
  assert.equal(go.pv, pv, 'sous l’obsidienne, rien ne le blesse');
});

test('aux Gorges de Cuivre, les montagnes cachent la vue (sauf au Mortier et pour les volants)', () => {
  const p = P.creerPartie(11);
  assert.equal(p.carte.murs, true);
  const c = p.carte;
  // Depuis l'emplacement (6,3), on voit le chemin juste au-dessus, pas celui qui est derrière une paroi.
  assert.equal(c.voitDe(6.5, 3.5, 6.5, 2.5), true);
  assert.equal(c.voitDe(6.5, 3.5, 1.5, 2.5), false);
  // Une Rafale ne vise pas un Rouilleux caché ; un Mortier, si.
  const q = bac(11);
  q.carte.murs = true;
  const e = ajouter(q, 'cuirasse', 28.5); // sur le chemin du bas, en (6, 5), derrière la paroi (6, 4)
  e.pv = e.pvMax = 1e6;
  const emp = q.carte.emplacements.find(m => m.c === 6 && m.r === 3);
  const t = P.construire(q, emp.id, 'rafale').tour;
  for (let i = 0; i < 10; i++) { e.d = 28.5; P.pas(q); }
  assert.equal(t.tirs, 0, 'caché derrière la paroi');
  P.vendre(q, t.id);
  const m = P.construire(q, emp.id, 'mortier').tour;
  for (let i = 0; i < 10; i++) { e.d = 28.5; P.pas(q); }
  assert.ok(m.tirs > 0, 'le Mortier tire par-dessus');
});

test('mode sans fin : des vagues sans fin, de plus en plus fortes, un boss toutes les 10', () => {
  const p = P.creerPartie(4, { graine: 5, sansFin: true });
  assert.equal(p.totalVagues, Infinity);
  assert.equal(p.def.tours.length, ORDRE_TOURS.length, 'toutes les tours');
  assert.deepEqual(P.vagueSansFin(p, 3), P.vagueSansFin(P.creerPartie(4, { graine: 5, sansFin: true }), 3), 'même graine, même vague');
  assert.ok(P.vagueSansFin(p, 9).some(g => ENNEMIS[g.type].boss), 'boss à la vague 10');
  assert.ok(!P.vagueSansFin(p, 8).some(g => ENNEMIS[g.type].boss));
  // L'ordinateur tient un moment, puis tombe : la partie finit toujours.
  const ia = creerIA(p);
  for (let i = 0; i < 30 * 60 * 120 && p.phase !== 'defaite'; i++) { jouerIA(p, ia); P.pas(p); p.evts.length = 0; }
  assert.equal(p.phase, 'defaite');
  assert.ok(p.vague > 10, `il tient au moins 10 vagues (${p.vague})`);
});
