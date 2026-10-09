/**
 * STREET COMBAT — les murs qu'on brise : trois chocs, le mur cède, et le
 * combat passe dans la zone voisine (l'adversaire à terre).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/street/combat.js';

/** Ryu-Ken coince le mannequin contre le mur de droite, et frappe. */
function coincer(c, images) {
  const evs = [];
  for (let f = 0; f < images; f++) {
    const [moi, lui] = c.joueurs;
    const pres = Math.abs(lui.x - moi.x) < 100;
    const pas = f % 24;
    C.pas(c, [pres ? (pas === 0 ? { K: true } : pas === 12 ? { P: true } : {}) : { d: true }, {}]);
    evs.push(...C.evenements(c));
  }
  return evs;
}

test('les murs : trois chocs, le mur cède, on passe dans la zone suivante', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'stoneback', graine: 7, murs: true });
  c.phase = 'combat';
  c.joueurs[0].x = 820; c.joueurs[1].x = 900;
  const evs = coincer(c, 60 * 40);
  const chocs = evs.filter((e) => e.type === 'mur');
  const brise = evs.find((e) => e.type === 'mur-brise');
  assert.ok(chocs.length >= C.MUR_PV - 1, `des chocs contre le mur (${chocs.length})`);
  assert.ok(brise, 'le mur a cédé');
  assert.equal(brise.cote, 1, 'le mur de droite');
  assert.equal(brise.joueur, 1);
  assert.ok(evs.some((e) => e.type === 'zone-suivante' && e.etage >= 1));
  assert.ok(c.etage >= 1, 'on a changé de zone');
});

test('la transition fige le combat, puis place la victime à terre au bon endroit', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'stoneback', graine: 7, murs: true });
  c.phase = 'combat';
  c.murs = [1, 1];
  const [moi, lui] = c.joueurs;
  lui.x = C.ARENE.L - C.ARENE.BORD - 2; lui.etat = 'touche'; lui.vx = 9; lui.stun = 20;
  moi.x = 820;
  C.pas(c, [{}, {}]);
  assert.ok(C.evenements(c).some((e) => e.type === 'mur-brise'));
  assert.equal(c.transition, C.MUR_TRANSITION);
  const temps = c.temps;
  for (let f = 0; f < C.MUR_TRANSITION / 2; f++) C.pas(c, [{ P: true }, {}]);
  assert.equal(c.etage, 1);
  assert.equal(c.temps, temps, 'le chrono ne tourne pas pendant la transition');
  assert.ok(lui.x > 500 && moi.x < 500, 'passé par la droite : il tombe à droite, l’autre l’attend à gauche');
  assert.equal(lui.etat, 'vol');
  for (let f = 0; f < C.MUR_TRANSITION; f++) C.pas(c, [{}, {}]);
  assert.equal(c.transition, 0);
  assert.ok(lui.sol, 'il a touché le sol de la nouvelle zone');
});

test('sans l’option, pas de mur : on reste coincé, rien ne casse', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'stoneback', graine: 7 });
  c.phase = 'combat';
  c.joueurs[0].x = 820; c.joueurs[1].x = 900;
  const evs = coincer(c, 60 * 20);
  assert.ok(!evs.some((e) => e.type === 'mur' || e.type === 'mur-brise'));
  assert.equal(c.etage, undefined);
});
