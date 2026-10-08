/**
 * STREET COMBAT — le tutoriel se termine (un robot le fait, avec de vraies
 * touches), et les défis de combos se déclenchent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/street/combat.js';
import { PERSO, PERSOS } from '../public/shared/street/persos.js';
import { ETAPES, creerTuto, avancerTuto, defisDe, defisReussis } from '../public/games/street-combat/js/tutoriel.js';

/** Ce que ferait un joueur pour chaque étape : les touches, image par image. */
function robot(etape, f, c) {
  const moi = c.joueurs[0];
  const lui = c.joueurs[1];
  const pres = Math.abs(lui.x - moi.x) < 85;
  const tous = (k) => (f % 2 === 0 ? { [k]: true } : {});
  switch (etape) {
    case 0: return { d: true };
    case 1: return tous('h');
    case 2: return { b: true };
    // Un seul coup suffit : on ne martèle pas.
    case 3: return pres ? (f % 40 === 0 ? { P: true } : {}) : { d: true };
    case 4: return pres ? (f % 40 === 0 ? { K: true } : {}) : { d: true };
    case 5: { const pas = f % 30; return pres ? (pas === 0 || pas === 8 ? { P: true } : pas === 16 ? { K: true } : {}) : { d: true }; }
    case 6: return { g: true };
    case 7: return tous('B');
    case 8: return Math.abs(lui.x - moi.x) < 70 ? tous('G') : { d: true };
    case 9: return pres ? tous('U') : { d: true };
    default: return {};
  }
}

test('le tutoriel : chaque étape se réussit, jusqu’au bout', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'soldat', entrainement: true, graine: 3 });
  const T = creerTuto();
  let f = 0;
  let etape = 0;
  const parEtape = [];
  let debutEtape = 0;
  while (!T.fini && f < 60 * 120) {
    C.pas(c, [robot(T.i, f, c), {}]);
    const r = avancerTuto(T, c, C.evenements(c));
    if (r === 'suivante' || r === 'fini') { parEtape.push(f - debutEtape); debutEtape = f; etape += 1; }
    f += 1;
  }
  assert.ok(T.fini, `bloqué à l’étape ${T.i + 1} : ${ETAPES[T.i]?.titre}`);
  assert.equal(etape, ETAPES.length);
  for (const [i, n] of parEtape.entries()) assert.ok(n < 60 * 20, `l’étape ${ETAPES[i].titre} a pris ${n} images`);
});

test('les défis de combos : cinq par combattant, déclenchés par les bons événements', () => {
  for (const p of PERSOS) {
    const d = defisDe(p);
    assert.equal(d.length, 5, p.id);
    assert.ok(d.every((x) => x.texte && typeof x.evt === 'function'), p.id);
  }
  const p = PERSO.ryuken;
  const evs = [{ type: 'combo-nom', joueur: 0, nom: p.combos[1].nom }, { type: 'combo', joueur: 0, n: 5 }, { type: 'combo', joueur: 1, n: 9 }];
  assert.deepEqual(defisReussis(p, [], evs), [1, 3], 'le combo de 5 coups vaut le défi « 4 coups », pas celui de 6 ; ceux de l’adversaire ne comptent pas');
  assert.deepEqual(defisReussis(p, [1], evs), [3], 'un défi déjà réussi ne compte pas deux fois');
});

test('les défis se réussissent pour de vrai : l’enchaînement 👊 👊 🦶 contre le mannequin', () => {
  const c = C.creerCombat({ p1: 'ryuken', p2: 'soldat', entrainement: true, graine: 4 });
  c.joueurs[0].x = 440; c.joueurs[1].x = 520;
  const p = PERSO.ryuken;
  let faits = [];
  for (let f = 0; f < 60 * 10 && !faits.includes(0); f++) {
    const pas = f % 30;
    C.pas(c, [pas === 0 || pas === 8 ? { P: true } : pas === 16 ? { K: true } : {}, {}]);
    faits = [...faits, ...defisReussis(p, faits, C.evenements(c))];
  }
  assert.ok(faits.includes(0));
});
