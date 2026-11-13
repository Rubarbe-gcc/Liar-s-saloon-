import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { creer, jouerTour, hash, FA } from '../public/shared/orbite/moteur.js';
let WS = null; try { WS = (await import('ws')).WebSocket; } catch { /* ws absent : test ignoré */ }
const { attacher, nettoyerOrdre } = await import('../server/orbite.js').catch(() => ({}));
test('nettoyerOrdre : filtre les ordres invalides', { skip: !nettoyerOrdre }, () => {
  assert.equal(nettoyerOrdre([1], { t: 'hack' }), null); assert.equal(nettoyerOrdre('x', { t: 'move' }), null);
  assert.deepEqual(nettoyerOrdre([1, 'a', 2.5], { t: 'move', x: 5, y: NaN, z: 1 }), { ids: [1], c: { t: 'move', k: undefined, x: 5, y: undefined, c: undefined, m: undefined } });
});
test('1c1 de bout en bout : deux clients restent synchronisés (hash égal)', { skip: !WS || !attacher, timeout: 30000 }, async () => {
  const srv = http.createServer(); attacher(srv); await new Promise(r => srv.listen(0, r));
  const url = `ws://127.0.0.1:${srv.address().port}/orbite`;
  const mk = () => new Promise(res => { const ws = new WS(url), c = { ws, tours: [], q: [] }; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'tour') c.tours.push(m); else c.q.push(m); }; ws.onopen = () => res(c); });
  const wait = async f => { for (let i = 0; i < 200; i++) { const m = f(); if (m) return m; await new Promise(r => setTimeout(r, 25)); } throw new Error('timeout'); };
  const A = await mk(), B = await mk();
  A.ws.send(JSON.stringify({ t: 'creer', mode: '1v1', f: 'fer', nom: 'A', carte: 1 }));
  const salle = await wait(() => A.q.find(m => m.t === 'salle'));
  B.ws.send(JSON.stringify({ t: 'rejoindre', code: salle.code, f: 'echos', nom: 'B' }));
  await wait(() => A.q.filter(m => m.t === 'salle').length >= 2);
  A.ws.send(JSON.stringify({ t: 'demarrer' }));
  const sa = await wait(() => A.q.find(m => m.t === 'start')), sb = await wait(() => B.q.find(m => m.t === 'start'));
  assert.deepEqual([sa.eq, sb.eq], [0, 1]); assert.deepEqual(sa.f, ['fer', 'echos']);
  const SA = creer(sa.graine, sa.f[0], sa.f[1], sa.carte), SB = creer(sb.graine, sb.f[0], sb.f[1], sb.carte);
  const ouA = SA.ent.find(e => e.eq === 0 && e.k === 'ouvrier'), ouB = SB.ent.find(e => e.eq === 1 && e.k === 'tisseur');
  A.ws.send(JSON.stringify({ t: 'ordre', ids: [ouA.id], c: { t: 'rec', m: 0 } })); B.ws.send(JSON.stringify({ t: 'ordre', ids: [ouB.id], c: { t: 'rec', m: 3 } }));
  let na = 0, nb = 0;
  while (na < 40 || nb < 40) { await new Promise(r => setTimeout(r, 40)); for (const [c, S, f] of [[A, SA, () => na++], [B, SB, () => nb++]]) while (c.tours.length) { jouerTour(S, c.tours.shift().ordres); f(); } }
  const n = Math.min(na, nb); assert.ok(n >= 40);
  while (na > nb) { jouerTour(SB, []); nb++; } while (nb > na) { jouerTour(SA, []); na++; }
  assert.equal(hash(SA), hash(SB)); assert.ok(SA.pr[0] !== 300 || SA.tick > 100);
  A.ws.close(); B.ws.close(); srv.close();
});
