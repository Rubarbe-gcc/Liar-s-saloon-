/**
 * LE VELOURS NOIR — la roue d'emojis : le serveur ne relaie que les emojis
 * prévus, pas plus d'un toutes les 3 s ; les habitués réagissent selon la
 * situation, pareil sur tous les écrans, sans jamais trahir une main en cours.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as V from '../server/velours.js';
import * as RX from '../public/shared/casino/reactions.js';

V.reglerVitesse(0.002);

let id = 0;
function joueur() {
  const recu = [];
  const conn = { id: `rx${++id}`, send: (m) => recu.push(m), close() {} };
  V.handleOpen(conn);
  return { recu, dit: (m) => V.handleMessage(conn, m), tous: (t) => recu.filter((m) => m.t === t), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('le serveur relaie une réaction à toute la table, avec la place', () => {
  const a = joueur();
  const b = joueur();
  a.dit({ t: 'creer', jeu: 'roulette', nom: 'A' });
  const { code } = a.dernier('entre');
  b.dit({ t: 'rejoindre', code, nom: 'B' });
  b.dit({ t: 'reaction', e: '🔥' });
  assert.deepEqual(a.dernier('reaction'), { g: 'velours', t: 'reaction', jeu: 'roulette', s: 1, e: '🔥' });
  assert.equal(b.dernier('reaction').s, 1);
  a.dit({ t: 'quitter' }); b.dit({ t: 'quitter' });
});

test('seulement les emojis de la roue, et une réaction toutes les 3 s au plus', () => {
  const a = joueur();
  const b = joueur();
  a.dit({ t: 'creer', jeu: 'blackjack', nom: 'A' });
  b.dit({ t: 'rejoindre', code: a.dernier('entre').code, nom: 'B' });
  b.dit({ t: 'reaction', e: '<script>' });
  b.dit({ t: 'reaction', e: '💩' });
  b.dit({ t: 'reaction', e: 42 });
  assert.equal(a.tous('reaction').length, 0);
  b.dit({ t: 'reaction', e: '👏' });
  b.dit({ t: 'reaction', e: '😎' });
  assert.deepEqual(a.tous('reaction').map((m) => m.e), ['👏'], 'la deuxième, trop tôt, est ignorée');
  a.dit({ t: 'reaction', e: '😎' });
  assert.equal(b.dernier('reaction').s, 0, 'chaque joueur a son propre délai');
  a.dit({ t: 'quitter' }); b.dit({ t: 'quitter' });
});

test('hors d’une table, une réaction ne part nulle part', () => {
  const a = joueur();
  a.dit({ t: 'reaction', e: '🔥' });
  assert.equal(a.tous('reaction').length, 0);
});

test('la catégorie d’une main d’après son nom', () => {
  assert.equal(RX.categorie('Quinte flush royale'), 8);
  assert.equal(RX.categorie('Quinte au roi'), 4);
  assert.equal(RX.categorie('Full aux as par les rois'), 6);
  assert.equal(RX.categorie('Deux paires, rois et dames'), 2);
  assert.equal(RX.categorie('Paire de dix'), 1);
  assert.equal(RX.categorie('Hauteur as'), 0);
  assert.equal(RX.categorie(undefined), 0);
});

const pot = (gagnants, parts, nom, autres = {}) => ({ gagnants, parts, montant: Object.values(parts).reduce((a, v) => a + v, 0), nom, ...autres });

test('un habitué qui ramasse un gros pot, ou qui perd tout, réagit (avec un délai humain)', () => {
  // sur beaucoup de mains, le flambeur réagit presque toujours à un gros pot
  let gros = 0, ruine = 0;
  for (let k = 0; k < 200; k++) {
    const r1 = RX.reactionsMain({ bots: { 1: 'flambeur' }, pots: [pot([1], { 1: 400 + k }, 'Brelan de six')], jetons: [500, 900, 0], engages: [0, 1], grosse: 10 });
    if (r1.length) { assert.ok(['🤑', '😎', '🔥'].includes(r1[0].e)); assert.ok(r1[0].delai >= 500 && r1[0].delai <= 2000); if (r1[0].e === '🤑') gros++; }
    const r2 = RX.reactionsMain({ bots: { 2: 'requin' }, pots: [pot([0], { 0: 300 + k }, 'Paire de rois')], jetons: [900, 500, 0], engages: [0, 2], grosse: 10 });
    if (r2.length) { ruine++; assert.equal(r2[0].e, '😡'); }
  }
  assert.ok(gros > 150, `gros pot : ${gros}/200`);
  assert.ok(ruine > 90, `ruine : ${ruine}/200`);
});

test('bad beat 😱, et 👏 pour une très belle main d’un autre', () => {
  let peur = 0, bravo = 0;
  for (let k = 0; k < 200; k++) {
    const r = RX.reactionsMain({
      bots: { 1: 'touriste', 2: 'prudent' },
      pots: [pot([0], { 0: 100 + k }, 'Full aux as par les rois')],
      mains: [{ i: 0, nom: 'Full aux as par les rois' }, { i: 1, nom: 'Couleur au roi' }],
      jetons: [800, 300, 400], engages: [0, 1, 2], grosse: 10,
    });
    for (const x of r) {
      if (x.i === 1) { assert.ok(['😱', '👏'].includes(x.e)); if (x.e === '😱') peur++; }
      if (x.i === 2) { assert.equal(x.e, '👏'); bravo++; }
    }
  }
  assert.ok(peur > 100 && bravo > 40, `bad beat ${peur}, bravo ${bravo}`);
});

test('pas de réaction pour qui n’a pas joué la main, ni deux fois dans la même main', () => {
  const r = RX.reactionsMain({ bots: { 1: 'flambeur', 2: 'flambeur' }, pots: [pot([1], { 1: 1000 }, 'Carré de dames')], jetons: [0, 2000, 0], engages: [0, 1], grosse: 10, deja: new Set([1]) });
  assert.deepEqual(r, []);
});

test('les mêmes événements donnent les mêmes réactions (tous les écrans voient la même chose)', () => {
  const o = () => ({ bots: { 1: 'bluffeur', 3: 'touriste' }, pots: [pot([1], { 1: 640 }, 'Couleur au valet')], mains: [{ i: 1, nom: 'Couleur au valet' }, { i: 3, nom: 'Quinte au dix' }], jetons: [500, 1200, 0, 300], engages: [0, 1, 3], grosse: 20 });
  assert.deepEqual(RX.reactionsMain(o()), RX.reactionsMain(o()));
  assert.deepEqual(RX.reactionTapis({ i: 0, mise: 800, bots: { 2: 'requin', 4: 'touriste' }, couches: [2, 4] }), RX.reactionTapis({ i: 0, mise: 800, bots: { 2: 'requin', 4: 'touriste' }, couches: [2, 4] }));
});

test('un tapis : seuls les habitués déjà couchés peuvent réagir', () => {
  let vu = 0;
  for (let mise = 100; mise < 600; mise++) {
    assert.equal(RX.reactionTapis({ i: 0, mise, bots: { 1: 'requin', 2: 'flambeur' }, couches: [] }), null, 'personne de couché');
    const r = RX.reactionTapis({ i: 0, mise, bots: { 1: 'requin', 2: 'flambeur' }, couches: [2] });
    if (r) { vu++; assert.equal(r.i, 2); assert.ok(['😱', '🤞'].includes(r.e)); }
  }
  assert.ok(vu > 120 && vu < 280, `réactions au tapis : ${vu}/500`);
});
