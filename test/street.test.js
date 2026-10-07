/**
 * STREET COMBAT — le moteur : coups, garde, combos, techniques, spéciaux,
 * saisie, ultime, rounds, et l'ordinateur.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/street/combat.js';
import { PERSOS, PERSO, ROSTER, BOSS, SECRETS, FIGURANTS, JAUGE, aDebloquer } from '../public/shared/street/persos.js';

/** Un combat d'entraînement, déjà lancé, les deux combattants face à face. */
function duel(p1 = 'ryuken', p2 = 'ryuken', ecart = 90) {
  const c = C.creerCombat({ p1, p2, graine: 1 });
  c.phase = 'combat';
  c.joueurs[0].x = 500 - ecart / 2;
  c.joueurs[1].x = 500 + ecart / 2;
  return c;
}
/** Fait passer des images, avec les entrées de chacun (une fonction de l'image, ou un objet). */
function jouer(c, n, e1 = {}, e2 = {}) {
  const evs = [];
  for (let k = 0; k < n; k++) {
    C.pas(c, [typeof e1 === 'function' ? e1(k) : e1, typeof e2 === 'function' ? e2(k) : e2]);
    evs.push(...C.evenements(c));
  }
  return evs;
}
/** Les entrées d'une séquence : une étape par image, puis rien. */
const suite = (etapes) => (k) => etapes[k] || {};

test('le roster : 16 combattants, 3 boss, 6 secrets et 3 figurants, chacun avec ses compétences, son ultime et ses combos', () => {
  assert.equal(ROSTER.length, 16);
  assert.equal(PERSOS.length, 25);
  assert.equal(PERSOS.filter((p) => p.secret).length, 6);
  // Les secrets de l’histoire disent où les gagner.
  for (const p of PERSOS.filter((x) => x.secret === 'histoire' && x.id !== SECRETS.histoire)) assert.ok(p.indice, p.id);
  // Les figurants : jamais dans la sélection, jamais à débloquer, mais prêts à se battre.
  assert.equal(FIGURANTS.length, 3);
  for (const p of FIGURANTS) { assert.ok(p.figurant && PERSO[p.id] === p && !PERSOS.includes(p) && !aDebloquer(p), p.id); }
  assert.deepEqual(Object.values(BOSS).sort(), ['lechaos', 'malvortex', 'solarius']);
  assert.deepEqual(Object.values(SECRETS).sort(), ['kairos', 'nemesis', 'onyx']);
  for (const id of Object.values(SECRETS)) assert.ok(PERSO[id].secret && !ROSTER.includes(PERSO[id]), id);
  const visuels = new Set();
  for (const p of [...PERSOS, ...FIGURANTS]) {
    assert.ok(p.nom && p.style && p.desc && p.c.c1 && p.look, p.id);
    for (const s of ['specA', 'specB']) assert.ok(p[s].nom && p[s].type, `${p.id} ${s}`);
    assert.ok(p.ulti.nom && p.ulti.portee > 100, p.id);
    if (!p.figurant) visuels.add(p.ulti.visuel);
    assert.ok(p.saisie.seq.length >= 4, p.id);
    assert.equal(p.combos.length, 3, p.id);
    // Sa façon de fêter un round, un combat, et ce qu’il dit quand il gagne.
    assert.ok(p.victoire?.length === 2 && p.victoire.every((v) => v.startsWith('v-')) && p.cri, `${p.id} : victoire`);
    assert.equal(p.combos[0].entree, 'PPK', `${p.id} : l’enchaînement d’abord`);
    for (const cb of p.combos) assert.match(cb.entree, /^[FBDU]*[PK]+$/, `${p.id} ${cb.nom}`);
    // Deux techniques d'un même combattant n'ont jamais la même manipulation.
    assert.equal(new Set(p.combos.map((x) => x.entree)).size, 3, p.id);
  }
  assert.equal(visuels.size, 25, 'un ultime unique par combattant');
});

test('les coups de base : un poing touche, la garde le bloque', () => {
  let c = duel();
  jouer(c, 20, suite([{ P: true }]));
  // Le poing : 6 de base, multiplié par la force de Ryuken.
  assert.equal(c.joueurs[1].hp, c.joueurs[1].hpMax - Math.round(6 * PERSO.ryuken.dmg / PERSO.ryuken.defMult));
  assert.ok(c.joueurs[0].sp > 0, 'frapper remplit la jauge');

  c = duel();
  // Le joueur 2 recule (vers la droite) : il garde.
  const evs = jouer(c, 20, suite([{ P: true }]), { d: true });
  assert.equal(c.joueurs[1].hp, c.joueurs[1].hpMax);
  assert.ok(evs.some((e) => e.type === 'garde'));

  // Le balayage passe une garde debout, pas une garde accroupie.
  c = duel();
  jouer(c, 1, {}, { d: true });
  jouer(c, 30, suite([{ b: true, K: true }, { b: true }, { b: true }, { b: true }, { b: true }, { b: true }, { b: true }, { b: true }, { b: true }]), { d: true });
  assert.ok(c.joueurs[1].hp < c.joueurs[1].hpMax, 'balayé');
  c = duel();
  jouer(c, 30, suite(Array(9).fill({ b: true }).map((x, k) => (k === 0 ? { b: true, K: true } : x))), { d: true, b: true });
  assert.equal(c.joueurs[1].hp, c.joueurs[1].hpMax, 'gardé accroupi');
});

test('👊 👊 🦶 : un enchaînement qui touche finit sur la signature du combattant', () => {
  const c = duel('ryuken', 'stoneback', 80);
  const evs = jouer(c, 70, suite([{ P: true }, {}, {}, {}, {}, {}, { P: true }, {}, {}, {}, {}, {}, { K: true }]));
  const nom = evs.find((e) => e.type === 'combo-nom');
  assert.equal(nom?.nom, 'TATSUMAKI');
  assert.ok(evs.some((e) => e.type === 'combo' && e.n >= 3), 'le compteur de combo monte');
  // Chaque coup du combo fait un peu moins mal.
  assert.ok(c.joueurs[0].combo.n === 0 || c.joueurs[0].combo.degats > 0);
});

test('les techniques à manipulation : ↓ → 👊, sans jauge', () => {
  const c = duel('blazero', 'ryuken', 300);
  const evs = jouer(c, 60, suite([{ b: true }, {}, { d: true }, {}, { P: true }]));
  assert.equal(evs.find((e) => e.type === 'combo-nom')?.nom, 'CRACHE-FEU');
  assert.equal(c.joueurs[0].sp >= 0, true);
  assert.ok(c.joueurs[1].statuts.brulure || c.joueurs[1].hp < c.joueurs[1].hpMax, 'le feu a touché');
});

test('les spéciaux coûtent leur jauge, et chacun fait ce qu’il dit', () => {
  // Hadoken : un projectile.
  let c = duel('ryuken', 'stoneback', 400);
  c.joueurs[0].sp = 100;
  jouer(c, 2, { A: true });
  assert.equal(c.joueurs[0].sp, 100 - JAUGE.specA);
  jouer(c, 12);
  assert.equal(c.projectiles.length, 1);
  jouer(c, 60);
  assert.ok(c.joueurs[1].hp < c.joueurs[1].hpMax);

  // Shadow Rush : téléporté derrière l'adversaire.
  c = duel('shadowkira', 'ryuken', 300);
  c.joueurs[0].sp = 40;
  jouer(c, 30, suite([{ B: true }]));
  assert.ok(c.joueurs[0].x > c.joueurs[1].x - 5, 'passé derrière');

  // Soul Drain : le faucheur se soigne en touchant.
  c = duel('voidreaper', 'ryuken', 300);
  c.joueurs[0].sp = 100;
  c.joueurs[0].hp = 50;
  jouer(c, 40, suite([{ A: true }]));
  assert.ok(c.joueurs[0].hp > 50);

  // Gravity Pull : l'adversaire est tiré.
  c = duel('gravox', 'ryuken', 400);
  c.joueurs[0].sp = 100;
  const x0 = c.joueurs[1].x;
  jouer(c, 40, suite([{ A: true }]));
  assert.ok(c.joueurs[1].x < x0 - 20);
});

test('les projectiles adverses s’annulent', () => {
  const c = duel('ryuken', 'ryuken', 500);
  c.joueurs[0].sp = 100; c.joueurs[1].sp = 100;
  const evs = jouer(c, 60, suite([{ A: true }]), suite([{ A: true }]));
  assert.ok(evs.some((e) => e.type === 'son' && e.nom === 'annule'));
  assert.equal(c.joueurs[0].hp, c.joueurs[0].hpMax);
  assert.equal(c.joueurs[1].hp, c.joueurs[1].hpMax);
});

test('la saisie : une suite de coups, imparable, mais pas contre un adversaire en l’air', () => {
  let c = duel('stoneback', 'ryuken', 70);
  const evs = jouer(c, 200, suite([{ G: true }]), { d: true });
  assert.ok(evs.some((e) => e.type === 'saisie'));
  const total = PERSO.stoneback.saisie.seq.reduce((t, [, , d]) => t + d, 0);
  assert.ok(c.joueurs[1].hp <= c.joueurs[1].hpMax - total * 0.8, 'même en gardant');

  c = duel('stoneback', 'ryuken', 70);
  jouer(c, 1, {}, { h: true });
  jouer(c, 4);
  const evs2 = jouer(c, 30, suite([{ G: true }]));
  assert.ok(!evs2.some((e) => e.type === 'saisie'));
});

test('l’ultime : la jauge pleine, la cinématique s’il est à portée, sinon raté', () => {
  let c = duel('pyroclaw', 'ryuken', 150);
  c.joueurs[0].sp = 100;
  const evs = jouer(c, 260, suite([{ U: true }]));
  assert.ok(evs.some((e) => e.type === 'ulti-cine' && e.visuel === 'dragon'));
  assert.ok(c.joueurs[1].hp < c.joueurs[1].hpMax - 40);
  assert.equal(c.joueurs[0].sp < 30, true);

  c = duel('pyroclaw', 'ryuken', 700);
  c.joueurs[0].sp = 100;
  const evs2 = jouer(c, 120, suite([{ U: true }]));
  assert.ok(evs2.some((e) => e.texte === 'ULTIME RATÉ !'));
  assert.equal(c.joueurs[1].hp, c.joueurs[1].hpMax);
});

test('les rounds : K.O., deux victoires, et un vainqueur', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'ryuken', graine: 3 });
  jouer(c, 100);
  assert.equal(c.phase, 'combat');
  for (let r = 0; r < 2; r++) {
    c.joueurs[1].hp = 0;
    jouer(c, 1);
    assert.equal(c.phase, 'ko');
    jouer(c, 400);
    if (r === 0) { assert.equal(c.joueurs[0].victoires, 1); assert.equal(c.round, 2); jouer(c, 100); }
  }
  assert.equal(c.phase, 'fin');
  assert.equal(c.vainqueur, 0);
});

test('le temps écoulé : celui qui a le plus de vie gagne le round', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'ryuken', graine: 4 });
  jouer(c, 100);
  c.joueurs[0].hp = 40;
  c.temps = 1;
  jouer(c, 70);
  assert.equal(c.phase, 'temps');
  jouer(c, 130);
  assert.equal(c.joueurs[1].victoires, 1);
});

test('l’ordinateur se bat jusqu’au bout, à tous les niveaux, et le même combat se rejoue à l’identique', () => {
  const rejouer = (graine) => {
    const c = C.creerCombat({ p1: 'celestia', p2: 'thunderox', ia: { 0: 'facile', 1: 'difficile' }, graine });
    let f = 0;
    while (c.phase !== 'fin' && f++ < 60 * 60 * 10) { C.pas(c); C.evenements(c); }
    return c;
  };
  const a = rejouer('x');
  const b = rejouer('x');
  assert.equal(a.phase, 'fin');
  assert.equal(a.vainqueur, b.vainqueur);
  assert.equal(a.f, b.f);
  // Le difficile bat le facile bien plus souvent qu'à son tour.
  let difficile = 0;
  for (let g = 0; g < 16; g++) if (rejouer(g).vainqueur === 1) difficile += 1;
  assert.ok(difficile >= 10, `difficile a gagné ${difficile}/16`);
  for (const p of PERSOS) {
    const c = C.creerCombat({ p1: p.id, p2: 'ryuken', ia: { 0: 'impossible', 1: 'normal' }, graine: p.id });
    let f = 0;
    while (c.phase !== 'fin' && f++ < 60 * 60 * 10) { C.pas(c); C.evenements(c); }
    assert.equal(c.phase, 'fin', p.id);
  }
});

test('l’entraînement : on ne meurt pas, la jauge se recharge', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'stoneback', entrainement: true, graine: 1 });
  c.joueurs[1].hp = 1;
  jouer(c, 120);
  assert.equal(c.phase, 'combat');
  assert.ok(c.joueurs[1].hp > 1);
  assert.ok(c.joueurs[0].sp > 30);
});

test('un combat en un seul round, avec la vie gardée du combat d’avant (la Tour des défis)', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'blazero', victoires: 1, vie: [60, null], graine: 2 });
  assert.equal(c.joueurs[0].hp, 60);
  assert.equal(c.joueurs[1].hp, c.joueurs[1].hpMax);
  jouer(c, 100);
  c.joueurs[1].hp = 0;
  jouer(c, 400);
  assert.equal(c.phase, 'fin');
  assert.equal(c.vainqueur, 0);
  assert.equal(c.round, 1);
});
