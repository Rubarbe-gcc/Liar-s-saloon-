/**
 * STREET COMBAT — la sauvegarde en ligne : deux appareils se mettent
 * d'accord sans rien perdre, et une remise à zéro tient.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fusionner, lireTout, ecrireTout, propre, CLES } from '../public/shared/street/nuage.js';
import * as sauvegarde from '../server/sauvegarde.js';

/** Un faux localStorage. */
function stockage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('deux appareils : tout ce qui est gagné s’additionne, le meilleur record reste', () => {
  const pc = { debloques: ['solarius'], croises: ['vorn'], codex: ['ryuken'], records: { victoires: 10, combo: 7 }, defis: { ryuken: [0, 1] }, maj: 100 };
  const tel = { debloques: ['malvortex'], croises: ['vorn', 'onyx'], codex: ['blazero'], records: { victoires: 4, combo: 12 }, defis: { ryuken: [2], blazero: [0] }, maj: 200 };
  const t = fusionner(pc, tel);
  assert.deepEqual(t.debloques.sort(), ['malvortex', 'solarius']);
  assert.deepEqual(t.croises.sort(), ['onyx', 'vorn']);
  assert.deepEqual(t.records, { victoires: 10, combo: 12 });
  assert.deepEqual(t.defis.ryuken, [0, 1, 2]);
  assert.deepEqual(t.defis.blazero, [0]);
  assert.equal(t.maj, 200);
  assert.deepEqual(fusionner(tel, pc), t, 'dans un sens ou dans l’autre');
});

test('les sauvegardes de l’histoire : chaque emplacement garde la partie jouée le plus récemment', () => {
  const a = { sauvegardes: [{ scene: 10, maj: 50 }, null, { scene: 3, maj: 900 }], maj: 900 };
  const b = { sauvegardes: [{ scene: 12, maj: 80 }, { scene: 1, maj: 10 }, { scene: 30, maj: 100 }], maj: 100 };
  const t = fusionner(a, b);
  assert.equal(t.sauvegardes[0].scene, 12);
  assert.equal(t.sauvegardes[1].scene, 1);
  assert.equal(t.sauvegardes[2].scene, 3, 'la plus récente, même si elle est moins avancée');
});

test('Réinitialiser efface aussi ce que l’autre appareil avait gagné avant', () => {
  const ancien = { debloques: ['solarius', 'kairos'], sauvegardes: [{ scene: 40, maj: 100 }], maj: 100 };
  const remis = { debloques: [], maj: 500, remise: 500 };
  const t = fusionner(ancien, remis);
  assert.deepEqual(t.debloques, [], 'rien ne revient');
  assert.equal(t.sauvegardes[0], null);
  // Mais ce qu'on gagne après la remise à zéro, on le garde.
  const apres = { debloques: ['solarius'], maj: 800, remise: 500 };
  assert.deepEqual(fusionner(apres, { ...ancien }).debloques, ['solarius']);
  assert.deepEqual(fusionner(fusionner(ancien, remis), apres).debloques, ['solarius']);
});

test('lire et écrire le stockage ; une sauvegarde abîmée ne casse rien', () => {
  const st = stockage({ [CLES.debloques]: '["solarius"]', [CLES.records]: '{"victoires":3}', [CLES.sauvegardes]: '[null,{"scene":2,"maj":5}]', 'street.nuage.maj': '42' });
  const d = lireTout(st);
  assert.deepEqual(d.debloques, ['solarius']);
  assert.equal(d.sauvegardes[1].scene, 2);
  assert.equal(d.maj, 42);
  const st2 = stockage();
  ecrireTout(st2, d);
  assert.deepEqual(lireTout(st2), d);
  assert.deepEqual(propre('n’importe quoi').debloques, []);
  assert.deepEqual(propre({ debloques: [1, 'a', null] }).debloques, ['a']);
});

test('le serveur range la progression de STREET COMBAT dans son propre espace', async () => {
  sauvegarde.vider();
  const cle = 'ABCDEFGHJK';
  assert.equal((await sauvegarde.traiter({ methode: 'PUT', corps: { cle, espace: 'street', charge: '{"debloques":["solarius"]}', date: 5 } })).statut, 200);
  const r = await sauvegarde.traiter({ methode: 'GET', cle, espace: 'street' });
  assert.equal(r.statut, 200);
  assert.equal(JSON.parse(r.json.charge).debloques[0], 'solarius');
  assert.equal((await sauvegarde.traiter({ methode: 'GET', cle, espace: 'profil' })).statut, 404, 'le profil est ailleurs');
});
