import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARTES } from '../public/shared/maximenu/cartes.js';
import * as M from '../public/shared/maximenu/marche.js';
import * as J from '../public/shared/maximenu/jeu.js';
import * as marche from '../server/marche.js';
import * as troc from '../server/maximenu.js';

const de = r => CARTES.filter(c => c.rarete === r);
const [c1, c2, c3] = de('commune'), [r1] = de('rare'), [e1] = de('epique'), [l1] = de('legendaire');

test('équité : valeurs proches seulement', () => {
  assert.equal(M.equite({ [c1.id]: 1 }, { [c2.id]: 2 }).ok, true);          // 10 contre 20 : écart toléré
  assert.equal(M.equite({ [r1.id]: 1 }, { [c1.id]: 3 }).ok, true);          // 30 contre 30
  assert.equal(M.equite({ [e1.id]: 1 }, { [c1.id]: 1 }).ok, false);         // 120 contre 10
  assert.equal(M.equite({ [l1.id]: 1 }, { [e1.id]: 3 }).ok, true);          // 400 contre 360
  assert.equal(M.equite({ [l1.id]: 1 }, {}).ok, false);                     // pas de cadeau
  const e = M.equite({ [l1.id]: 1 }, { [e1.id]: 1 });
  assert.equal(e.ok, false); assert.ok(e.manque > 0);
  assert.equal(M.equite({ [l1.id]: 1 }, { [e1.id]: 1, [r1.id]: Math.ceil(e.manque / 30) }).ok, true);
});

test('lots nettoyés et échange appliqué', () => {
  assert.equal(M.nettoyerLot({ inconnue: 1 }), null);
  assert.equal(M.nettoyerLot({ [c1.id]: 13 }), null);
  assert.deepEqual(M.nettoyerLot({ [c1.id]: 2 }), { [c1.id]: 2 });
  const s = J.creerEtat(0); s.collection[c1.id] = 2;
  assert.equal(M.echanger(s, { [c1.id]: 3 }, { [c2.id]: 1 }, 1).ok, false);
  const r = M.echanger(s, { [c1.id]: 2 }, { [c2.id]: 1 }, 1);
  assert.equal(r.ok, true); assert.equal(s.collection[c1.id], undefined); assert.equal(s.collection[c2.id], 1); assert.deepEqual(r.nouvelles, [c2.id]);
});

test('marché : vendre, acheter une seule fois, toucher ses frites', async () => {
  marche.vider();
  const A = 'a'.repeat(30), Bs = 'b'.repeat(30);
  assert.equal((await marche.traiter({ methode: 'POST', corps: { a: 'vendre', secret: A, carte: e1.id, prix: 10000 } })).statut, 400);
  const v = await marche.traiter({ methode: 'POST', corps: { a: 'vendre', secret: A, nom: 'Ana', carte: e1.id, prix: 150 } });
  assert.equal(v.statut, 200);
  const liste = await marche.traiter({ methode: 'GET' });
  assert.equal(liste.json.annonces.length, 1);
  const id = v.json.annonce.id;
  assert.equal((await marche.traiter({ methode: 'POST', corps: { a: 'acheter', secret: A, id } })).statut, 400); // pas sa propre annonce
  const achat = await marche.traiter({ methode: 'POST', corps: { a: 'acheter', secret: Bs, nom: 'Bob', id } });
  assert.equal(achat.statut, 200); assert.equal(achat.json.carte, e1.id);
  assert.equal((await marche.traiter({ methode: 'POST', corps: { a: 'acheter', secret: 'c'.repeat(30), id } })).statut, 404);
  const compte = await marche.traiter({ methode: 'POST', corps: { a: 'compte', secret: A } });
  assert.equal(compte.json.gains, 150); assert.equal(compte.json.ventes.length, 1);
  assert.equal((await marche.traiter({ methode: 'POST', corps: { a: 'compte', secret: A } })).json.gains, 0);
});

test('marché : retrait, annonce expirée rendue', async () => {
  marche.vider();
  const A = 'd'.repeat(30);
  const v = await marche.traiter({ methode: 'POST', corps: { a: 'vendre', secret: A, carte: r1.id, prix: 30 }, maintenant: 0 });
  const r = await marche.traiter({ methode: 'POST', corps: { a: 'retirer', secret: A, id: v.json.annonce.id } });
  assert.equal(r.json.carte, r1.id);
  await marche.traiter({ methode: 'POST', corps: { a: 'vendre', secret: A, carte: c3.id, prix: 10 }, maintenant: 0 });
  const c = await marche.traiter({ methode: 'POST', corps: { a: 'compte', secret: A }, maintenant: M.DUREE_ANNONCE + 1 });
  assert.deepEqual(c.json.retours, [c3.id]);
});

test('échange en direct : conclu seulement si équitable et validé des deux côtés', () => {
  troc.vider();
  const boite = () => { const recu = []; return { id: Math.random().toString(36), recu, send: m => recu.push(m) }; };
  const a = boite(), b = boite();
  troc.handleOpen(a); troc.handleOpen(b);
  troc.handleMessage(a, { t: 'creer', nom: 'Ana' });
  const code = a.recu.find(m => m.t === 'salle').code;
  troc.handleMessage(b, { t: 'rejoindre', code, nom: 'Bob' });
  troc.handleMessage(a, { t: 'offre', lot: { [l1.id]: 1 } });
  troc.handleMessage(b, { t: 'offre', lot: { [c1.id]: 1 } });
  troc.handleMessage(a, { t: 'valider' });
  assert.equal(a.recu.at(-1).t, 'erreur');
  troc.handleMessage(b, { t: 'offre', lot: { [e1.id]: 3 } });
  troc.handleMessage(a, { t: 'valider' }); troc.handleMessage(b, { t: 'valider' });
  const ca = a.recu.find(m => m.t === 'conclu'), cb = b.recu.find(m => m.t === 'conclu');
  assert.deepEqual(ca.recoit, { [e1.id]: 3 }); assert.deepEqual(cb.recoit, { [l1.id]: 1 });
});
