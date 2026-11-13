import test from 'node:test';
import assert from 'node:assert/strict';
import { creer, step, ia, UN } from '../public/shared/orbite/moteur.js';
const run = (graine, n) => { const s = creer(graine); for (let i = 0; i < n && s.fin < 0; i++) { ia(s, 0); ia(s, 1); step(s); } return s; };
test('déterminisme', () => {
  const f = () => { const s = run(7, 4000); return JSON.stringify([s.tick, s.pr, s.ent.map(e => [e.id, e.x, e.y, e.pv])]); };
  assert.equal(f(), f());
});
test('IA contre IA : la partie vit (récolte, bâtiments, unités)', () => {
  const s = run(3, 12000);
  assert.ok(s.ent.length > 8 && s.ent.some(e => e.k === 'caserne'));
});
test('toutes les factions : duels sans erreur', () => {
  const F = ['fer', 'bosquet', 'echos', 'cendres'];
  for (const a of F) for (const b of F) { const s = creer(5, a, b); for (let i = 0; i < 6000; i++) { ia(s, 0); ia(s, 1); step(s); } assert.ok(s.ent.length > 6, a + ' vs ' + b); }
});
test('relais, neutres et champions', () => {
  const s = creer(2);
  assert.equal(s.relais.length, 4); assert.equal(s.ent.filter(e => e.eq === 2).length, 8);
  for (let i = 0; i < 14000 && s.fin < 0; i++) { ia(s, 0); ia(s, 1); step(s); }
  assert.ok(s.relais.some(r => r.own >= 0), 'au moins un relais capturé');
  assert.ok(s.en[0] + s.en[1] > 0 || s.ent.some(e => UN[e.k] && UN[e.k].ch), 'énergie produite');
});
test('6 cartes : parties sans erreur, tout reste dans le terrain', () => {
  for (let c = 0; c < 6; c++) {
    const s = creer(c + 1, 'fer', 'echos', c, 2, 3);
    for (let i = 0; i < 5000 && s.fin < 0; i++) { ia(s, 0); ia(s, 1); step(s); }
    assert.ok(s.ent.length > 6 && s.relais.length >= 3, 'carte ' + c);
    assert.ok(s.ent.every(e => e.x >= 0 && e.x <= 48000 && e.y >= 0 && e.y <= 48000), 'bornes carte ' + c);
  }
});
import { hash, jouerTour, cmd, UPG, FA, BA as BAT } from '../public/shared/orbite/moteur.js';
test('améliorations, pouvoirs, renforts, hash', () => {
  const s = creer(4, 'fer', 'fer', 0, 2, 2, { pr: [900, 300], en: [200, 0], depart: [{ eq: 1, role: 0, n: 5 }], renfort: { eq: 1, periode: 100, role: 1, n: 1 } });
  const qg = s.ent.find(e => e.eq === 0 && BAT[e.k].qg);
  cmd(s, 0, [qg.id], { t: 'up', k: 'att' }); cmd(s, 0, [qg.id], { t: 'up', k: 'att' });
  assert.equal(s.up[0].att, 2); assert.ok(s.pr[0] < 900);
  assert.equal(s.ent.filter(e => e.eq === 1 && e.k === 'fantassin').length, 5);
  for (let i = 0; i < 200; i++) step(s);
  assert.ok(s.ent.filter(e => e.eq === 1 && e.k === 'tireur').length >= 2);
  cmd(s, 0, [qg.id], { t: 'move', x: NaN, y: 1 }); cmd(s, 0, [qg.id], { t: 'zzz' }); // ordres invalides ignorés sans erreur
});
test('lockstep : jouerTour identique pour deux clients, hash égal ; ordres invalides sans effet', () => {
  const a = creer(9, 'bosquet', 'echos', 2), b = creer(9, 'bosquet', 'echos', 2);
  const ou = a.ent.find(e => e.eq === 0 && e.k === 'semeur');
  for (let t = 0; t < 400; t++) {
    const o = t === 3 ? [{ eq: 0, ids: [ou.id], c: { t: 'rec', m: 0 } }, { eq: 1, ids: [1, 2, 3], c: { t: 'move', x: 'a', y: {} } }] : [];
    jouerTour(a, o); jouerTour(b, o);
  }
  assert.equal(hash(a), hash(b)); assert.ok(a.pr[0] >= 0);
});
import { MISSIONS, etat } from '../public/shared/orbite/campagne.js';
test('campagne : 15 missions valides', () => {
  assert.equal(MISSIONS.length, 15);
  for (const m of MISSIONS) {
    const s = creer(m.id, m.f, m.e, m.carte, 2, m.niv, m.opt);
    for (let i = 0; i < 300; i++) { ia(s, 1); step(s); }
    const r = etat(s, m); assert.ok(['cours', 'gagne', 'perdu'].includes(r.etat) && r.texte, 'mission ' + m.id);
  }
});
test('campagne : une mission de récolte est gagnable (IA joueuse)', () => {
  const m = MISSIONS[0], s = creer(1, m.f, m.e, m.carte, 2, m.niv, m.opt); let r;
  for (let i = 0; i < 20000 && s.fin < 0; i++) { ia(s, 0); ia(s, 1); step(s); r = etat(s, m); if (r.etat !== 'cours') break; }
  assert.equal(r.etat, 'gagne');
});
test('Cendres : brûlure, pas de régénération en brûlant, explosion de Braise', async () => {
  const { creer: cr, step: st, ajout: aj } = await import('../public/shared/orbite/moteur.js');
  const s = cr(3, 'cendres', 'bosquet', 0);
  const t = aj(s, 0, 'tison', 20000, 20000), r = aj(s, 1, 'rejeton', 20800, 20000);
  for (let i = 0; i < 40 && r.pv > 0; i++) st(s);
  assert.ok(r.feu > 0, 'la cible brûle');
  const pv = r.pv; r.feu = 30; t.pv = 0; aj(s, 0, 'porteur', 5000, 5000);
  st(s); assert.ok(r.pv <= pv - 12, 'Braise : 12 dégâts autour du Tison mort');
});
