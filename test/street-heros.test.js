/**
 * STREET COMBAT — le héros qu'on crée pour l'histoire : une fiche complète,
 * que le moteur sait faire combattre, quelles que soient les options.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/street/combat.js';
import { PERSO } from '../public/shared/street/persos.js';
import { CORPS, TETES, PEAUX, ENERGIES, TENUES, CHEVEUX, ACCESSOIRES, MAX_ACCESSOIRES, ECOLES, defautHeros, herosAuHasard, construireHeros, nomPropre } from '../public/shared/street/heros.js';

test('le créateur : des choix pour tout, huit écoles complètes', () => {
  assert.ok(CORPS.length >= 3 && TETES.length >= 8 && PEAUX.length >= 5 && TENUES.length >= 6 && CHEVEUX.length >= 6 && ACCESSOIRES.length >= 6);
  assert.ok(Object.keys(ENERGIES).length >= 6);
  assert.equal(Object.keys(ECOLES).length, 8);
  for (const [id, e] of Object.entries(ECOLES)) {
    assert.ok(e.nom && e.texte && e.specA.nom && e.specB.nom && e.ulti.nom && e.saisie.seq.length >= 4, id);
    assert.equal(e.combos.length, 3, id);
    assert.equal(e.combos[0].entree, 'PPK', id);
    assert.equal(new Set(e.combos.map((c) => c.entree)).size, 3, id);
  }
});

test('construireHeros : une fiche valide, même avec des options farfelues', () => {
  const h = construireHeros({ nom: '  kaze<script>  ', corps: 'nimporte', tete: 'quoi', ecole: 'inconnue', accessoires: ['cape', 'katana', 'ailes', 'barbe', 'faux'] });
  assert.equal(h.id, 'heros');
  assert.equal(h.nom, 'KAZESCRIPT');
  assert.equal(h.look.corps, 'normal');
  assert.equal(h.look.tete, 'bandeau');
  assert.equal(h.specA.nom, ECOLES.ki.specA.nom);
  assert.ok(h.look.extras.filter((x) => x !== 'bandeau-long').length <= MAX_ACCESSOIRES);
  assert.ok(!h.look.extras.includes('faux'));
  assert.equal(nomPropre(''), 'HÉROS');
  assert.equal(nomPropre('Élodie la grande guerrière'), 'ÉLODIE LA GRAN');
  for (const k of ['c1', 'c2', 'faisceau', 'aura', 'peau', 'cheveux', 'tenue', 'ceinture']) assert.ok(h.c[k], k);
  // La carrure compte : un héros massif a plus de vie, mais va moins vite.
  const fin = construireHeros({ ...defautHeros(), corps: 'fin' });
  const massif = construireHeros({ ...defautHeros(), corps: 'massif' });
  assert.ok(massif.hpMult > fin.hpMult && massif.vitesse < fin.vitesse);
});

test('le héros créé se bat : chaque école, contre l’ordinateur, jusqu’au bout', () => {
  let n = 0;
  for (const ecole of Object.keys(ECOLES)) {
    PERSO.heros = construireHeros({ ...herosAuHasard(() => (n++ % 7) / 7), ecole });
    const c = C.creerCombat({ p1: 'heros', p2: 'ryuken', ia: { 0: 'difficile', 1: 'difficile' }, graine: ecole });
    let f = 0;
    while (c.phase !== 'fin' && f++ < 60 * 300) { C.pas(c); C.evenements(c); }
    assert.equal(c.phase, 'fin', ecole);
  }
  delete PERSO.heros;
});
