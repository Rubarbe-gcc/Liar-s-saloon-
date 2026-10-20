/**
 * DOUBLE PAS — le moteur du basket à trois : le déterminisme, un match qui va
 * au bout (panier en or compris), les points (2 et 3), l'ordinateur qui marque,
 * les commandes de l'humain, et l'équilibre des seize clubs (long : on peut
 * le sauter avec --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, T, PANIER_X, ANNEAU_Z, CHARGE_IDEALE } from '../public/shared/basket/match.js';
import { estTrois, TROIS_R, TROIS_COIN } from '../public/shared/basket/terrain.js';
import { EQUIPES, EQUIPE, STYLES, notesEquipe } from '../public/shared/basket/equipes.js';
import { ecussonSVG } from '../public/games/plein-stade/commun/ecusson.js';

/** Un petit hasard reproductible (pour les touches des faux joueurs). */
function rng(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}
/** Un joueur qui appuie comme un humain : il tient ses touches quelques images, puis change. */
function joueurHumain(graine) {
  const R = rng(graine);
  let m = 0, reste = 0;
  return () => {
    if (reste-- <= 0) {
      reste = 4 + Math.floor(R() * 20);
      m = 0;
      if (R() < 0.8) m |= [T.g, T.d, T.h, T.b, T.g | T.h, T.d | T.b][Math.floor(R() * 6)];
      if (R() < 0.3) m |= T.S;
      if (R() < 0.3) m |= [T.A, T.B, T.X, T.G][Math.floor(R() * 4)];
    }
    return m;
  };
}

test('les seize clubs : inventés, complets, des styles connus', () => {
  assert.equal(EQUIPES.length, 16);
  const ids = new Set(), abrs = new Set();
  for (const eq of EQUIPES) {
    ids.add(eq.id); abrs.add(eq.abr);
    assert.ok(STYLES[eq.style], `${eq.nom} : style ${eq.style}`);
    assert.equal(eq.joueurs.length, 3);
    assert.ok(eq.devise && eq.ville && eq.maillot && eq.exterieur && eq.ecusson);
    for (const j of eq.joueurs) for (const k of ['vitesse', 'tir', 'passe', 'defense', 'saut']) assert.ok(j.notes[k] >= 30 && j.notes[k] <= 99, `${j.nom} ${k}`);
    assert.ok(ecussonSVG(eq, 48).startsWith('<svg'));
    assert.ok(notesEquipe(eq).tir > 0);
  }
  assert.equal(ids.size, 16);
  assert.equal(abrs.size, 16);
});

test('la ligne à 3 points : l’arc et les coins', () => {
  assert.equal(estTrois(PANIER_X - TROIS_R - 0.1, 0, PANIER_X), true);
  assert.equal(estTrois(PANIER_X - TROIS_R + 0.1, 0, PANIER_X), false);
  assert.equal(estTrois(PANIER_X - 1, TROIS_COIN + 0.05, PANIER_X), true);
  assert.equal(estTrois(PANIER_X - 1, TROIS_COIN - 0.3, PANIER_X), false);
  assert.equal(estTrois(-PANIER_X + 2, 0, -PANIER_X), false);
});

test('déterministe : même graine, mêmes touches → même match', () => {
  const jouer = () => {
    const m = creerMatch({ equipes: ['valrose', 'montbrume'], graine: 1234, minutes: 1, controles: ['humain', 'ia'] });
    const h = joueurHumain(99);
    const traces = [];
    for (let i = 0; i < 5000; i++) { pas(m, [h(), 0]); if (i % 250 === 0) traces.push(empreinte(m)); }
    return { traces, score: [...m.score], f: m.f };
  };
  assert.deepEqual(jouer(), jouer());
  const a = simuler({ equipes: ['fort-granit', 'mielville'], graine: 77, minutes: 1 });
  const b = simuler({ equipes: ['fort-granit', 'mielville'], graine: 77, minutes: 1 });
  assert.equal(empreinte(a), empreinte(b));
  assert.deepEqual(a.score, b.score);
  const c = simuler({ equipes: ['fort-granit', 'mielville'], graine: 78, minutes: 1 });
  assert.notEqual(empreinte(a), empreinte(c));
});

test('un match va au bout, sans planter, avec un vainqueur', () => {
  for (let g = 1; g <= 6; g++) {
    const m = simuler({ equipes: [EQUIPES[g].id, EQUIPES[15 - g].id], graine: g * 13, minutes: 2 });
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    assert.notEqual(m.score[0], m.score[1]);
    for (const p of m.joueurs) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  }
  // Avec un humain qui appuie au hasard, aussi.
  const m = creerMatch({ equipes: ['saint-aurel', 'lumen'], graine: 5, minutes: 1, controles: ['humain', 'ia'] });
  const h = joueurHumain(3);
  for (let i = 0; i < 60000 && m.phase !== 'fin'; i++) pas(m, [h(), 0]);
  assert.equal(m.phase, 'fin');
});

test('le panier en or : à égalité, le premier qui marque gagne', () => {
  const m = creerMatch({ equipes: ['ventenac', 'haute-plaine'], graine: 9, minutes: 1, controles: ['ia', 'ia'] });
  // On saute à la fin de la deuxième période, à égalité.
  while (m.phase !== 'pause') pas(m);
  while (m.periode === 1) pas(m);
  m.score = [10, 10];
  m.chrono = m.duree - 1;
  const evs = [];
  while (m.phase !== 'fin' && m.f < 200000) evs.push(...pas(m));
  assert.ok(evs.some((e) => e.type === 'enor'));
  assert.equal(m.phase, 'fin');
  const dernier = m.paniers[m.paniers.length - 1];
  assert.equal(dernier.enOr, true);
  assert.equal(m.vainqueur, dernier.e);
  assert.equal(m.paniers.filter((p) => p.enOr).length, 1);
});

test('les points comptent juste : 2, 3, et la bonne équipe', () => {
  // Un ballon qui tombe dans l'arceau que l'équipe 0 attaque, sur un tir à 3 points.
  const m = creerMatch({ equipes: ['valrose', 'lumen'], graine: 3, minutes: 1, controles: ['ia', 'ia'] });
  m.phase = 'jeu';
  const b = m.ballon;
  const lacher = (e, pts) => Object.assign(b, { x: m.equipes[e].sens * PANIER_X, y: 0, z: ANNEAU_Z + 0.4, vx: 0, vy: 0, vz: -1, porteur: -1, entre: false, marque: false, tir: { e, j: e * 3, pts, passeur: -1, dunk: false, d: 7 }, rebond: { e } });
  lacher(0, 3);
  for (let i = 0; i < 30 && m.phase === 'jeu'; i++) pas(m);
  assert.deepEqual(m.score, [3, 0]);
  assert.equal(m.phase, 'panier');
  // La remise en jeu : l'équipe qui a encaissé, depuis sa ligne de fond.
  while (m.phase === 'panier') pas(m);
  assert.equal(m.joueurs[b.porteur].e, 1);
  assert.ok(Math.abs(m.joueurs[b.porteur].x) > 13.5);
  assert.equal(Math.sign(m.joueurs[b.porteur].x), m.equipes[0].sens);
  m.phase = 'jeu';
  lacher(1, 2);
  for (let i = 0; i < 30 && m.phase === 'jeu'; i++) pas(m);
  assert.deepEqual(m.score, [3, 2]);
  // Dans des matchs entiers : le score est la somme des paniers, chacun vaut 2 ou 3.
  for (let g = 1; g <= 5; g++) {
    const s = simuler({ equipes: [EQUIPES[g].id, EQUIPES[g + 5].id], graine: g * 41, minutes: 1 });
    for (const e of [0, 1]) {
      const mes = s.paniers.filter((p) => p.e === e);
      assert.ok(mes.every((p) => p.pts === 2 || p.pts === 3));
      assert.equal(mes.reduce((t, p) => t + p.pts, 0), s.score[e]);
      assert.ok(s.stats.troisReussis[e] <= mes.filter((p) => p.pts === 3).length);
      assert.ok(s.stats.reussis[e] <= s.stats.tirs[e]);
    }
  }
});

test('le tir de l’humain : on saute en appuyant, on lâche en haut du saut', () => {
  const m = creerMatch({ equipes: ['valrose', 'lumen'], graine: 21, minutes: 1, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  const p = m.joueurs[0];
  // Seul à 5 m du panier, le ballon en main.
  Object.assign(p, { x: m.equipes[0].sens * (PANIER_X - 5), y: 0 });
  for (const o of m.joueurs.slice(3)) { o.x = -m.equipes[0].sens * 10; }
  Object.assign(m.ballon, { porteur: 0, entre: false, remise: -1 });
  m.equipes[0].actif = 0;
  const evs = [];
  evs.push(...pas(m, [T.B, 0]));
  assert.equal(p.etat, 'tir');
  for (let i = 1; i < CHARGE_IDEALE; i++) evs.push(...pas(m, [T.B, 0]));
  assert.ok(p.z > 0.5);
  evs.push(...pas(m, [0, 0]));
  const tir = evs.find((e) => e.type === 'tir');
  assert.ok(tir, 'le tir est parti');
  assert.ok(tir.q > 0.9, `bon moment (q = ${tir.q})`);
  assert.equal(tir.pts, 2);
});

test('l’humain : passe, changement de joueur, vol, contre', () => {
  const m = creerMatch({ equipes: ['mielville', 'neigeval'], graine: 8, minutes: 1, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  Object.assign(m.ballon, { porteur: 0, entre: false, remise: -1 });
  m.equipes[0].actif = 0;
  const evs = pas(m, [T.A, 0]);
  assert.ok(evs.some((e) => e.type === 'passe' && e.joueur === 0));
  // En défense : Espace (G) change de joueur, B saute.
  const d = creerMatch({ equipes: ['mielville', 'neigeval'], graine: 8, minutes: 1, controles: ['humain', 'ia'] });
  d.phase = 'jeu';
  Object.assign(d.ballon, { porteur: 3, entre: false, remise: -1 });
  d.equipes[0].actif = 0;
  const e1 = pas(d, [T.G, 0]);
  assert.ok(e1.some((e) => e.type === 'change'));
  assert.notEqual(d.equipes[0].actif, 0);
  pas(d, [0, 0]);
  const e2 = pas(d, [T.B, 0]);
  assert.ok(e2.some((e) => e.type === 'saut'));
});

test('l’ordinateur marque contre une équipe qui ne bouge pas', () => {
  for (const id of ['valrose', 'fort-granit', 'saint-aurel']) {
    const m = creerMatch({ equipes: [id, 'ventenac'], graine: 4, minutes: 1, controles: ['ia', 'aucun'] });
    while (m.phase !== 'fin' && m.f < 100000) pas(m);
    assert.ok(m.score[0] >= 15, `${EQUIPE[id].nom} : ${m.score[0]} points seulement`);
    assert.ok(m.score[0] > m.score[1] * 3);
  }
});

test('équilibre : chaque équipe gagne entre 35 et 65 % de ses matchs', () => {
  // Chaque équipe reçoit chacune des autres, quatre fois (deux périodes d'une minute) :
  // 120 matchs par équipe (moins, le hasard d'un petit échantillon fausse le verdict). Pas de nul : le panier en or départage.
  const ids = EQUIPES.map((e) => e.id);
  const v = Object.fromEntries(ids.map((id) => [id, 0]));
  let g = 1;
  for (const a of ids) for (const b of ids) for (let k = 0; k < 4; k++) {
    if (a === b) continue;
    const m = simuler({ equipes: [a, b], graine: (g++) * 7919, minutes: 1 });
    v[m.vainqueur === 0 ? a : b] += 1;
  }
  const taux = ids.map((id) => [id, v[id] / ((ids.length - 1) * 8)]);
  for (const [id, t] of taux) {
    assert.ok(t <= 0.65, `${EQUIPE[id].nom} gagne ${(t * 100).toFixed(0)} %`);
    assert.ok(t >= 0.35, `${EQUIPE[id].nom} ne gagne que ${(t * 100).toFixed(0)} %`);
  }
});
