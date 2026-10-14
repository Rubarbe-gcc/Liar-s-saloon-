/**
 * STREET COMBAT — les ultimes : chaque combattant (et chaque ultime du
 * héros) a sa cinématique, et elle se dessine du début à la fin sans
 * erreur (un rayon négatif fait planter le canevas d'un navigateur).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PERSOS } from '../public/shared/street/persos.js';
import { TECHNIQUES } from '../public/shared/street/heros.js';
import { ULTIMES, ULTIMES_HEROS, FONDS } from '../public/games/street-combat/js/ultimes.js';

/** Un faux canevas : il accepte tout, mais refuse un rayon négatif, comme un vrai. */
function fauxCanevas() {
  const etat = {};
  return new Proxy(etat, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'arc') return (x, y, r) => { if (!(r >= 0)) throw new Error(`arc : rayon ${r}`); };
      if (k === 'ellipse') return (x, y, rx, ry) => { if (!(rx >= 0 && ry >= 0)) throw new Error(`ellipse : rayons ${rx}, ${ry}`); };
      if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1 });
      return () => {};
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}

const A = { id: 'ryuken', x: 390, y: 380, dir: 1 };
const D = { x: 570, y: 380 };
const k = { c1: '#3296ff', c2: '#0050c8', faisceau: '#3296ff', aura: '#50a0ff' };

function jouer(u) {
  const g = fauxCanevas();
  for (let t = 0; t <= 124; t++) {
    if (typeof u === 'function') u(g, t, A, D, k);
    else { u.derriere?.(g, t, A, D, k); u.devant?.(g, t, A, D, k); }
  }
}

test('chaque combattant a son ultime, et il se dessine sans erreur', () => {
  for (const p of PERSOS) {
    const u = ULTIMES[p.ulti.visuel];
    assert.ok(u, `${p.id} : pas de cinématique « ${p.ulti.visuel} »`);
    assert.doesNotThrow(() => jouer(u), `${p.id}`);
  }
});

test('chaque ultime du héros a sa cinématique, et elle se dessine sans erreur', () => {
  for (const [id, x] of Object.entries(TECHNIQUES.u)) {
    const u = ULTIMES_HEROS[x.visuel];
    assert.ok(u, `${id} : pas de cinématique « ${x.visuel} »`);
    assert.doesNotThrow(() => jouer(u), id);
  }
});

test('les fonds des ultimes restent des couleurs valides', () => {
  for (const [v, f] of Object.entries(FONDS)) for (let t = 0; t <= 130; t += 5) {
    const c = f(t);
    for (const rgba of Array.isArray(c) ? [c] : [c.haut, c.bas]) assert.ok(rgba.length === 4 && rgba[3] >= 0 && rgba[3] <= 1, `${v} à ${t}`);
  }
});
