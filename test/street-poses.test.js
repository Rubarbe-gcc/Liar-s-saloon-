/**
 * STREET COMBAT — les poses : un coude se plie vers l'avant, un genou vers
 * l'arrière, dans toutes les poses et à tous les instants d'un coup (sinon,
 * en 3D, le membre a l'air cassé). Et une main qui saisit reste sur sa cible.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { POSES, poseDe, squelette } from '../public/games/street-combat/js/dessin.js';
import { PERSO, PERSOS } from '../public/shared/street/persos.js';

const norm = (a) => ((a + 540) % 360) - 180;
const INSTANTS = [0, 0.05, 0.1, 0.2, 0.36, 0.42, 0.5, 0.6, 0.75, 0.9, 1, 1.3];

test('les coudes ne se plient jamais à l’envers', () => {
  for (const nom of POSES) for (const t of [0, 13, 27, 41]) for (const p of INSTANTS) {
    const q = poseDe(nom, t, p);
    for (const bras of ['av', 'ar']) {
      const [epaule, coude] = q[bras];
      // Un bras tendu loin derrière (une pose de victoire, un vol) peut se plier dans l'autre sens.
      if (norm(epaule) < -45 || norm(epaule) > 165) continue;
      assert.ok(coude >= -10 && coude <= 160, `${nom} (t=${t}, p=${p}) : coude ${bras} à ${coude.toFixed(1)}°`);
    }
  }
});

test('les genoux ne se plient jamais vers l’avant', () => {
  for (const nom of POSES) for (const t of [0, 13, 27, 41]) for (const p of INSTANTS) {
    const q = poseDe(nom, t, p);
    for (const jambe of ['ja', 'jr']) assert.ok(q[jambe][1] <= 5 && q[jambe][1] >= -165, `${nom} (t=${t}, p=${p}) : genou ${jambe} à ${q[jambe][1].toFixed(1)}°`);
  }
});

test('les membres gardent leur longueur, dans toutes les poses et toutes les carrures', () => {
  const corps = [...new Set(PERSOS.map((p) => p.look.corps))].map((c) => PERSOS.find((p) => p.look.corps === c));
  for (const perso of corps) for (const pose of POSES) {
    const sq = squelette(perso, { pose, t: 10, p: 0.5 });
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(Math.abs(d(sq.epA, sq.coudeA) - 27) < 0.01 && Math.abs(d(sq.coudeA, sq.mainA) - 27) < 0.01, `${perso.id} ${pose} : bras avant`);
    assert.ok(Math.abs(d(sq.hanche, sq.jambes.ka) - 36) < 0.01 && Math.abs(d(sq.jambes.ka, sq.jambes.fa) - 37) < 0.01, `${perso.id} ${pose} : jambe avant`);
  }
});

test('une saisie : la main se pose sur le col de l’autre, le coude plié vers le bas', () => {
  for (const cible of [{ x: 28, y: -110 }, { x: 22, y: -96 }, { x: 30, y: -118 }]) {
    const sq = squelette(PERSO.ryuken, { pose: 'saisie', saisir: cible });
    assert.ok(Math.hypot(sq.mainR.x - cible.x, sq.mainR.y - cible.y) < 0.6, `main en (${sq.mainR.x.toFixed(1)}, ${sq.mainR.y.toFixed(1)})`);
    // Le coude sous la ligne épaule → main.
    const { epR: epA, mainR: mainA, coudeR: coudeA } = sq;
    const croix = (mainA.x - epA.x) * (coudeA.y - epA.y) - (mainA.y - epA.y) * (coudeA.x - epA.x);
    assert.ok(croix > 0, 'le coude est sous le bras');
  }
  // Trop loin : le bras se tend vers elle, sans se casser.
  const sq = squelette(PERSO.ryuken, { pose: 'saisie', saisir: { x: 200, y: -120 } });
  assert.ok(Math.abs(Math.hypot(sq.mainR.x - sq.epR.x, sq.mainR.y - sq.epR.y) - 53.5) < 0.6);
});
