/**
 * STREET COMBAT — le rollback, sur un faux réseau : deux joueurs, chacun son
 * horloge (l'une un peu plus rapide), un ping de 40 à 250 ms qui varie, des
 * messages perdus. Les deux doivent jouer exactement le même combat, sans se
 * figer, avec un nombre raisonnable d'images rejouées ; et l'état final doit
 * être celui qu'on obtient en rejouant simplement les touches confirmées.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerCombat, pas, evenements } from '../public/shared/street/combat.js';
import { creerSession, FENETRE } from '../public/shared/street/rollback.js';

const TOUCHES = ['g', 'd', 'h', 'b', 'P', 'K', 'G', 'A', 'B', 'U'];
const decoder = (m) => Object.fromEntries(TOUCHES.map((k, i) => [k, !!(m & (1 << i))]));
const empreinte = (c) => JSON.stringify([c.f, c.alea, c.joueurs.map((j) => [j.hp, Math.round(j.x * 100), Math.round(j.y * 100), j.sp, j.etat, j.victoires]), c.projectiles.length, c.round, c.phase]);

/** Un petit hasard reproductible. */
function rng(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

/** Un joueur qui appuie comme un humain : il tient ses touches quelques images, puis change. */
function joueurHumain(graine) {
  const R = rng(graine);
  let m = 0, reste = 0;
  return () => {
    if (reste-- <= 0) {
      reste = 3 + Math.floor(R() * 14);
      m = 0;
      if (R() < 0.6) m |= 1 << (R() < 0.5 ? 0 : 1);
      if (R() < 0.12) m |= 1 << 2;
      if (R() < 0.35) m |= 1 << (4 + Math.floor(R() * 3));
      if (R() < 0.05) m |= 1 << (7 + Math.floor(R() * 3));
    }
    return m;
  };
}

/**
 * Un combat en ligne simulé.
 * @returns {{ A, B, confA, confB, frameMax }}
 */
function simuler({ ping, gigue, perte, derive = 0.003, decalage = 37, duree = 30000, graine = 7, delais = [2, 2] }) {
  const R = rng(graine * 101);
  const persos = { p1: 'ryuken', p2: 'blazero', graine: 4242, victoires: 99 };
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const c = creerCombat(persos);
    c.phase = 'combat';
    const s = creerSession({
      n, delai: delais[n], etat: c,
      pas: (etat, [a, b]) => { pas(etat, [decoder(a), decoder(b)]); return evenements(etat); },
      empreinte,
      confirme: (f, e) => conf[n].push(e[0] * 1024 + e[1]),
    });
    return { n, c, s, entrees: joueurHumain(1000 + n * 77), periode: (1000 / 60) * (n === 1 ? 1 - derive : 1), prochain: n === 1 ? decalage : 0, boite: [] };
  });
  const enRoute = [];
  const poster = (de, quoi, data) => {
    if (R() < perte) return;
    const latence = ping / 2 + (R() - 0.5) * gigue;
    enRoute.push({ a: 1 - de, quand: t + Math.max(5, latence), quoi, data: JSON.parse(JSON.stringify(data)) });
  };
  let t = 0;
  for (; t < duree; t += 1) {
    for (let i = enRoute.length - 1; i >= 0; i--) {
      const m = enRoute[i];
      if (m.quand > t) continue;
      enRoute.splice(i, 1);
      const s = joueurs[m.a].s;
      if (m.quoi === 'entrees') s.recevoir(m.data);
      else if (m.quoi === 'empreinte') s.recevoirEmpreinte(m.data);
      else if (m.quoi === 'etat') s.recaler(m.data);
    }
    for (const j of joueurs) {
      if (t < j.prochain) continue;
      j.prochain += j.periode;
      const r = j.s.avancer(j.entrees());
      poster(j.n, 'entrees', r.envoi);
      if (r.empreinte) poster(j.n, 'empreinte', r.empreinte);
      if (j.s.desynchro && j.n === 0) { const e = j.s.etatConfirme(); if (e) poster(0, 'etat', e); }
    }
  }
  return { A: joueurs[0].s, B: joueurs[1].s, confA: conf[0], confB: conf[1], cA: joueurs[0].c, cB: joueurs[1].c };
}

/** L'état qu'on obtient en rejouant simplement les touches confirmées. */
function rejouer(conf, jusqua) {
  const c = creerCombat({ p1: 'ryuken', p2: 'blazero', graine: 4242, victoires: 99 });
  c.phase = 'combat';
  for (let f = 0; f < jusqua; f++) { const v = conf[f]; pas(c, [decoder(Math.floor(v / 1024)), decoder(v % 1024)]); evenements(c); }
  return c;
}

for (const [nom, reseau] of [
  ['sans retard', { ping: 0, gigue: 0, perte: 0 }],
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 120 ms, ça varie, 5 % de pertes', { ping: 120, gigue: 60, perte: 0.05 }],
  ['ping 250 ms, ça varie beaucoup, 5 % de pertes', { ping: 250, gigue: 120, perte: 0.05, delais: [3, 3] }],
]) {
  test(`en ligne (${nom}) : le même combat des deux côtés, sans se figer`, () => {
    const { A, B, confA, confB } = simuler(reseau);
    const n = Math.min(confA.length, confB.length);
    assert.ok(n > 1400, `assez d'images confirmées (${n})`);
    // Les deux ont confirmé exactement les mêmes touches.
    assert.deepEqual(confA.slice(0, n), confB.slice(0, n));
    assert.ok(!A.desynchro && !B.desynchro, 'aucune désynchronisation');
    // Et leur état est celui qu'on obtient en rejouant ces touches.
    for (const s of [A, B]) {
      const { f, etat } = s.etatConfirme();
      assert.equal(empreinte(etat), empreinte(rejouer(s === A ? confA : confB, f)), `état à l'image ${f}`);
    }
    // Presque jamais figé : un vrai joueur ne le sentirait pas.
    const fig = (A.stats.attentes + B.stats.attentes) / 2;
    if (process.env.MESURE) console.log(nom, JSON.stringify(A.stats), JSON.stringify(B.stats));
    assert.ok(fig < 30, `images figées : ${fig}`);
    if (reseau.ping === 0) assert.ok(A.stats.retours + B.stats.retours <= 5, 'sans retard, presque aucune correction');
    else assert.ok(A.stats.rejouees / Math.max(1, A.stats.retours) <= FENETRE, 'des corrections courtes');
  });
}

test('un écran qui a divergé se recale sur celui de l’hôte', () => {
  const persos = { p1: 'ryuken', p2: 'blazero', graine: 4242, victoires: 99 };
  const fab = (n) => { const c = creerCombat(persos); c.phase = 'combat'; return { c, s: creerSession({ n, delai: 2, etat: c, pas: (e, [a, b]) => { pas(e, [decoder(a), decoder(b)]); return evenements(e); }, empreinte }) }; };
  const A = fab(0), B = fab(1);
  const jA = joueurHumain(5), jB = joueurHumain(6);
  for (let i = 0; i < 400; i++) {
    const ra = A.s.avancer(jA()), rb = B.s.avancer(jB());
    B.s.recevoir(ra.envoi); A.s.recevoir(rb.envoi);
    if (ra.empreinte) B.s.recevoirEmpreinte(ra.empreinte);
    if (rb.empreinte) A.s.recevoirEmpreinte(rb.empreinte);
    // À l'image 150, l'écran de B se trompe (comme un vrai bug) : B perd 7 points de vie de trop.
    if (i === 150) B.c.joueurs[1].hp -= 7;
    if (A.s.desynchro) { const e = A.s.etatConfirme(); assert.ok(B.s.recaler(JSON.parse(JSON.stringify(e)))); A.s.recaler(e); }
  }
  assert.ok(B.s.stats.recalages >= 1, 'B s’est recalé');
  assert.equal(A.c.joueurs[1].hp, B.c.joueurs[1].hp);
  assert.equal(empreinte(A.c), empreinte(B.c));
});

test('les sons et impacts d’une image rejouée ne repassent pas deux fois', () => {
  const persos = { p1: 'ryuken', p2: 'blazero', graine: 1, victoires: 99 };
  const c = creerCombat(persos); c.phase = 'combat';
  c.joueurs[0].x = 400; c.joueurs[1].x = 470;
  const s = creerSession({ n: 0, delai: 1, etat: c, pas: (e, [a, b]) => { pas(e, [decoder(a), decoder(b)]); return evenements(e); } });
  const vus = [];
  const P = 1 << 4;
  // L'adversaire ne fait rien (prédit) ; nous frappons : des impacts.
  for (let i = 0; i < 30; i++) vus.push(...s.avancer(i % 12 === 0 ? P : 0).evs);
  const avant = vus.filter((e) => e.type === 'impact').length;
  // Ses vraies touches arrivent : elles confirment la prédiction (rien) → aucun nouvel impact.
  s.recevoir({ f: 29, e: new Array(30).fill(0) });
  const apres = s.avancer(0).evs.filter((e) => e.type === 'impact').length;
  assert.ok(avant > 0, 'il y a eu des impacts');
  assert.equal(apres, 0);
});
