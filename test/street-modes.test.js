/**
 * STREET COMBAT — les replays (rejouer les entrées refait le même combat),
 * les tenues alternatives, le mode Arcade et la progression du héros.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/street/combat.js';
import { PERSO, PERSOS, ROSTER, BOSS } from '../public/shared/street/persos.js';
import * as R from '../public/shared/street/replay.js';
import { TENUES, idTenue, baseDe, tenueDe, tenuesOuvertes, palette, tourner, enregistrerTenues } from '../public/shared/street/tenues.js';
import { planArcade, finArcade, FINS_ARCADE, COMBATS_ARCADE } from '../public/shared/street/arcade.js';
import { niveauDe, xpPour, gainXp, RECOMPENSES, recompensesDe, nouvellesRecompenses, NIVEAU_MAX, construireHeros } from '../public/shared/street/heros.js';

/** Une empreinte de l'état du combat. */
const empreinte = (c) => JSON.stringify([c.f, c.round, c.phase, c.joueurs.map((j) => [Math.round(j.x * 100), Math.round(j.y * 100), j.hp, j.sp, j.etat, j.victoires])]);

test('un replay refait exactement le même combat (joueur contre ordinateur, allié compris, murs compris)', () => {
  const reglages = { p1: 'ryuken', p2: 'blazero', ia: { 1: 'difficile' }, graine: 4242, victoires: 2, murs: true };
  const c = C.creerCombat(reglages);
  const rep = R.enregistrer(reglages);
  let h = 99;
  const hasard = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h; };
  for (let f = 0; f < 60 * 50 && c.phase !== 'fin'; f++) {
    if (f === 600) { C.assister(c, 0, 'celestia', 18); R.noterAllie(rep, 0, 'celestia', 18); }
    const e = [R.decoder(hasard() & 0x3ff), {}];
    R.noter(rep, e);
    C.pas(c, e);
    C.evenements(c);
  }
  assert.ok(rep.runs.length < rep.n, 'les images identiques sont regroupées');
  // On rejoue.
  const d = C.creerCombat(JSON.parse(JSON.stringify(rep.reglages)));
  const lec = R.lecteur(JSON.parse(JSON.stringify(rep)));
  while (!lec.fini()) {
    for (const [, j, allie, degats] of lec.allies()) C.assister(d, j, allie, degats);
    C.pas(d, lec.suivantes());
    C.evenements(d);
  }
  assert.equal(empreinte(d), empreinte(c));
});

test('la liste des replays : les récents tournent, les favoris restent', () => {
  let l = [];
  for (let i = 0; i < 12; i++) l = R.ajouter(l, { id: `r${i}`, date: i });
  assert.equal(l.length, R.MAX_RECENTS);
  assert.equal(l[0].id, 'r11', 'le plus récent d’abord');
  l = R.basculerFavori(l, 'r5');
  for (let i = 12; i < 30; i++) l = R.ajouter(l, { id: `r${i}`, date: i });
  assert.ok(l.some((x) => x.id === 'r5' && x.favori), 'un favori ne s’en va pas');
  assert.equal(l.filter((x) => !x.favori).length, R.MAX_RECENTS);
  assert.deepEqual(R.decoder(R.coder({ g: true, U: true })), { g: true, d: false, h: false, b: false, P: false, K: false, G: false, A: false, B: false, U: true });
});

test('les tenues : trois par combattant, la même fiche sauf les couleurs, gagnées avec les étoiles', () => {
  enregistrerTenues();
  assert.equal(TENUES.length, 3);
  for (const p of PERSOS) {
    for (let k = 1; k < TENUES.length; k++) {
      const v = PERSO[idTenue(p.id, k)];
      assert.ok(v, `${p.id} ~${k}`);
      assert.equal(v.id, p.id, 'l’id reste celui du combattant');
      assert.equal(v.specA, p.specA);
      assert.equal(v.c.peau, p.c.peau, 'la peau ne change pas');
      assert.notEqual(v.c.c1, p.c.c1, `${p.id} ~${k} : d’autres couleurs`);
    }
  }
  assert.equal(baseDe('ryuken~2'), 'ryuken');
  assert.equal(tenueDe('ryuken~2'), 2);
  assert.equal(tenueDe('ryuken'), 0);
  assert.deepEqual(tenuesOuvertes(0), [0]);
  assert.deepEqual(tenuesOuvertes(3), [0, 1]);
  assert.deepEqual(tenuesOuvertes(5), [0, 1, 2]);
  assert.equal(tourner('#ff0000', 120), '#00ff00');
  assert.equal(palette(PERSO.ryuken.c, 0), PERSO.ryuken.c);
  // Une tenue se bat comme l'originale.
  const c = C.creerCombat({ p1: 'ryuken~1', p2: 'ryuken~2', ia: { 0: 'difficile', 1: 'difficile' }, graine: 3 });
  for (let f = 0; f < 60 * 300 && c.phase !== 'fin'; f++) { C.pas(c); C.evenements(c); }
  assert.equal(c.phase, 'fin');
});

test('le mode Arcade : sept combats, le rival en sixième, un boss au bout ; une fin pour chacun', () => {
  for (const p of PERSOS) {
    const f = finArcade(p.id);
    assert.ok(PERSO[f.rival] && f.rival !== p.id && f.avant && f.fin.length >= 2, p.id);
    assert.ok(FINS_ARCADE[p.id], `${p.id} a sa propre fin`);
  }
  let h = 1;
  const alea = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
  for (const p of PERSOS) for (const d of ['facile', 'normal', 'difficile']) {
    const plan = planArcade(idTenue(p.id, 1), d, alea);
    assert.equal(plan.file.length, COMBATS_ARCADE, p.id);
    assert.equal(plan.niveaux.length, COMBATS_ARCADE);
    assert.ok(!plan.file.includes(p.id), `${p.id} ne se combat pas lui-même`);
    assert.equal(new Set(plan.file).size, COMBATS_ARCADE, `${p.id} : pas deux fois le même adversaire`);
    assert.ok(Object.values(BOSS).includes(plan.file[6]), 'un boss au bout');
    assert.equal(plan.file[5], finArcade(p.id).rival, 'le rival en sixième');
    assert.ok(plan.file.slice(0, 5).every((id) => ROSTER.some((r) => r.id === id)));
  }
  assert.equal(planArcade('ryuken', 'difficile').file[6], BOSS.impossible);
});

test('la progression du héros : des niveaux, et une récompense à chacun', () => {
  assert.equal(niveauDe(0), 1);
  assert.equal(niveauDe(xpPour(5)), 5);
  assert.equal(niveauDe(xpPour(5) - 1), 4);
  assert.equal(niveauDe(1e9), NIVEAU_MAX);
  assert.ok(gainXp({ note: 'S', acte: 5 }) > gainXp({ note: 'C' }));
  assert.ok(gainXp({ gagne: false }) > 0);
  for (let n = 2; n <= NIVEAU_MAX; n++) assert.equal(RECOMPENSES.filter((r) => r.niveau === n).length, 1, `niveau ${n}`);
  assert.equal(recompensesDe(1).length, 0);
  assert.deepEqual(nouvellesRecompenses(4, 6).map((r) => r.niveau), [5, 6]);
  // Une histoire entière (une quarantaine de combats, bien notés) mène loin, mais pas au bout.
  const fin = niveauDe(40 * gainXp({ note: 'A', acte: 4 }));
  assert.ok(fin >= 12 && fin < NIVEAU_MAX, `niveau ${fin} au bout d’une histoire`);
  // Les récompenses s'appliquent au héros.
  const tete = RECOMPENSES.find((r) => r.champ === 'tete').val;
  const acc = RECOMPENSES.find((r) => r.champ === 'accessoires').val;
  const e = RECOMPENSES.find((r) => r.champ === 'energie').val;
  const hh = construireHeros({ tete, accessoires: [acc], energie: e });
  assert.equal(hh.look.tete, tete);
  assert.ok(hh.look.extras.includes(acc));
  assert.notEqual(hh.c.c1, construireHeros({}).c.c1);
});
