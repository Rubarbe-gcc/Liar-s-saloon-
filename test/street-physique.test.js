/**
 * STREET COMBAT — la physique tient : des combats entre ordinateurs, et
 * personne ne sort de l'arène, ne passe sous le sol, ne reste coincé dans
 * un combo sans fin, ni ne se retrouve dans l'autre au coin d'un mur.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/street/combat.js';
import { PERSOS } from '../public/shared/street/persos.js';

const { ARENE } = C;

test('des combats entre ordinateurs : la physique ne déraille jamais', () => {
  const pb = [];
  for (let i = 0; i < 36; i++) {
    const a = PERSOS[i % PERSOS.length].id;
    const b = PERSOS[(i * 7 + 3) % PERSOS.length].id;
    const c = C.creerCombat({ p1: a, p2: b, ia: { 0: 'difficile', 1: ['normal', 'difficile', 'impossible'][i % 3] }, graine: i, murs: i % 2 === 0 });
    const depuis = [0, 0];
    for (let f = 0; f < 60 * 300 && c.phase !== 'fin'; f++) {
      C.pas(c);
      C.evenements(c);
      for (const j of c.joueurs) {
        if (j.x < ARENE.BORD || j.x > ARENE.L - ARENE.BORD) pb.push(`${a}/${b} : ${j.id} hors de l’arène (x=${j.x.toFixed(1)})`);
        if (j.y > ARENE.SOL + 0.5) pb.push(`${a}/${b} : ${j.id} sous le sol`);
        depuis[j.n] = j.etat === 'touche' ? depuis[j.n] + 1 : 0;
        if (depuis[j.n] === 60 * 5) pb.push(`${a}/${b} : ${j.id} étourdi 5 s d’affilée`);
      }
      const [p, q] = c.joueurs;
      if (c.phase === 'combat' && !c.cine && !c.transition && p.sol && q.sol && !p.cache && !q.cache && Math.abs(p.x - q.x) < 20) pb.push(`${a}/${b} : l’un dans l’autre (f${f})`);
      if (pb.length > 5) break;
    }
  }
  assert.deepEqual(pb, []);
});

test('une saisie contre le mur : le saisi ne rentre pas dans le mur, c’est l’attaquant qui recule', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'blazero', graine: 2 });
  c.phase = 'combat';
  const [moi, lui] = c.joueurs;
  moi.x = ARENE.L - ARENE.BORD - 30; lui.x = ARENE.L - ARENE.BORD;
  for (let f = 0; f < 120; f++) {
    C.pas(c, [f < 4 ? { G: true } : {}, {}]);
    C.evenements(c);
    assert.ok(lui.x <= ARENE.L - ARENE.BORD && moi.x <= ARENE.L - ARENE.BORD, `image ${f}`);
  }
});
