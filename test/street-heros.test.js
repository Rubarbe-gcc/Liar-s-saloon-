/**
 * STREET COMBAT — le héros qu'on crée pour l'histoire : une fiche complète,
 * que le moteur sait faire combattre, quelles que soient les options.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import * as C from '../public/shared/street/combat.js';
import { PERSO } from '../public/shared/street/persos.js';
import { CORPS, TETES, PEAUX, ENERGIES, TENUES, CHEVEUX, ACCESSOIRES, MAX_ACCESSOIRES, ECOLES, TECHNIQUES, techniquesDe, defautHeros, herosAuHasard, construireHeros, nomPropre } from '../public/shared/street/heros.js';

test('le créateur : des choix pour tout, huit écoles complètes', () => {
  assert.ok(CORPS.length >= 3 && TETES.length >= 8 && PEAUX.length >= 5 && TENUES.length >= 6 && CHEVEUX.length >= 6 && ACCESSOIRES.length >= 6);
  assert.ok(Object.keys(ENERGIES).length >= 6);
  assert.equal(Object.keys(ECOLES).length, 8);
  for (const [id, e] of Object.entries(ECOLES)) {
    assert.ok(e.nom && e.texte && e.saisie.seq.length >= 4, id);
    for (const k of ['a', 'b', 'u']) assert.ok(TECHNIQUES[k][e.techniques[k]], `${id} : technique ${k}`);
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
  assert.equal(h.specA.nom, TECHNIQUES.a[ECOLES.ki.techniques.a].nom);
  assert.equal(h.specA.texte, undefined, 'la description reste au créateur');
  assert.ok(h.look.extras.filter((x) => x !== 'bandeau-long').length <= MAX_ACCESSOIRES);
  assert.ok(!h.look.extras.includes('faux'));
  assert.equal(nomPropre(''), 'HÉROS');
  assert.equal(nomPropre('Élodie la grande guerrière'), 'ÉLODIE LA GRAN');
  for (const k of ['c1', 'c2', 'faisceau', 'aura', 'peau', 'cheveux', 'tenue', 'ceinture']) assert.ok(h.c[k], k);
  for (const e of Object.keys(ECOLES)) { const x = construireHeros({ ecole: e }); assert.ok(x.victoire.length === 2 && x.cri, e); }
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

test('les techniques du héros sont à lui seul : ni leurs noms, ni leurs formes, ni leurs cinématiques ailleurs', () => {
  const autres = Object.values(PERSO).filter((p) => p.id !== 'heros');
  const nomsAutres = new Set();
  const formes = new Set();
  const visuels = new Set();
  const voir = (x) => { if (!x) return; if (x.nom) nomsAutres.add(x.nom); if (x.forme) formes.add(x.forme); };
  for (const p of autres) {
    voir(p.specA); voir(p.specB);
    visuels.add(p.ulti?.visuel); nomsAutres.add(p.ulti?.nom); nomsAutres.add(p.saisie?.nom);
    for (const cb of p.combos || []) { nomsAutres.add(cb.nom); voir(cb.coup); }
  }
  assert.ok(![...formes].some((x) => x.startsWith('heros-')), 'les formes heros-… ne sont qu’au héros');
  for (const k of ['a', 'b', 'u']) {
    assert.equal(Object.keys(TECHNIQUES[k]).length, 8, k);
    for (const [id, x] of Object.entries(TECHNIQUES[k])) {
      assert.ok(x.nom && x.texte, id);
      assert.ok(!nomsAutres.has(x.nom), `${x.nom} : un autre combattant a déjà ce nom`);
      if (x.forme) assert.match(x.forme, /^heros-/, id);
      if (k === 'u') { assert.match(x.visuel, /^heros-/, id); assert.ok(!visuels.has(x.visuel), id); }
    }
  }
  for (const [id, e] of Object.entries(ECOLES)) {
    for (const cb of e.combos) {
      assert.ok(!nomsAutres.has(cb.nom), `${id} : « ${cb.nom} » est déjà à un autre combattant`);
      if (cb.coup.forme) assert.match(cb.coup.forme, /^heros-/, `${id} : ${cb.nom}`);
    }
  }
  // Toutes ces formes et cinématiques sont bien dessinées.
  const effets = fs.readFileSync(new URL('../public/games/street-combat/js/effets.js', import.meta.url), 'utf8');
  const toutes = [...Object.values(TECHNIQUES.a), ...Object.values(TECHNIQUES.b), ...Object.values(ECOLES).flatMap((e) => e.combos.map((c) => c.coup))];
  for (const x of toutes) if (x.forme) assert.ok(effets.includes(`case '${x.forme}'`), x.forme);
  for (const x of Object.values(TECHNIQUES.u)) assert.ok(effets.includes(`'${x.visuel}'(g, t, A, D, k)`), x.visuel);
});

test('on choisit ses techniques ; sinon, ce sont celles de l’école', () => {
  assert.deepEqual(techniquesDe({ ecole: 'lame' }), ECOLES.lame.techniques);
  assert.deepEqual(techniquesDe({ ecole: 'lame', techA: 'phenix', techB: 'inconnue', techU: 'promesses' }), { a: 'phenix', b: ECOLES.lame.techniques.b, u: 'promesses' });
  const h = construireHeros({ ecole: 'colosse', techA: 'tresse', techB: 'faille', techU: 'horizon' });
  assert.equal(h.specA.nom, TECHNIQUES.a.tresse.nom);
  assert.equal(h.specB.type, 'teleport');
  assert.equal(h.ulti.visuel, 'heros-horizon');
  const r = herosAuHasard(() => 0.99);
  assert.ok(TECHNIQUES.a[r.techA] && TECHNIQUES.b[r.techB] && TECHNIQUES.u[r.techU]);
});

test('chaque technique se joue pour de vrai : les deux spéciaux et l’ultime', () => {
  const ka = Object.keys(TECHNIQUES.a);
  const kb = Object.keys(TECHNIQUES.b);
  const ku = Object.keys(TECHNIQUES.u);
  for (let i = 0; i < 8; i++) {
    PERSO.heros = construireHeros({ ecole: 'ki', techA: ka[i], techB: kb[i], techU: ku[i] });
    const c = C.creerCombat({ p1: 'heros', p2: 'ryuken', entrainement: true, graine: i });
    const vus = new Set();
    for (const [touche, attendu] of [[{ B: true }, 'specB'], [{ A: true }, 'specA'], [{ U: true }, 'ulti']]) {
      c.joueurs[0].x = 420; c.joueurs[1].x = 540;
      c.joueurs[0].sp = 100;
      for (let f = 0; f < 240; f++) {
        C.pas(c, [f === 0 ? touche : {}, {}]);
        for (const e of C.evenements(c)) {
          if (e.joueur !== 0) continue;
          if (e.type === 'special') vus.add(e.quel);
          if (e.type === 'ulti') vus.add('ulti');
        }
      }
      assert.ok(vus.has(attendu), `${ka[i]} / ${kb[i]} / ${ku[i]} : ${attendu}`);
    }
  }
  delete PERSO.heros;
});
