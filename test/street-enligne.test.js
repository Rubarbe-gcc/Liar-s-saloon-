/**
 * STREET COMBAT — le combat en ligne : le serveur réunit et relaie ; les deux
 * appareils, avec les mêmes entrées, jouent exactement le même combat.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as street from '../server/street.js';
import * as C from '../public/shared/street/combat.js';
import { coder, decoder, empreinte, preparer, entreesDuPas, LS, DELAI } from '../public/games/street-combat/js/enligne.js';

let id = 0;
function joueur() {
  const recu = [];
  const conn = { id: `c${++id}`, send: (m) => recu.push(m), close() {} };
  street.handleOpen(conn);
  return { conn, recu, dit: (m) => street.handleMessage(conn, m), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('une salle : créer, rejoindre, la même graine pour les deux', () => {
  const a = joueur();
  const b = joueur();
  a.dit({ t: 'creer', perso: 'blazero', nom: 'Alice' });
  const { code } = a.dernier('salle');
  assert.match(code, /^[A-Z2-9]{4}$/);
  b.dit({ t: 'rejoindre', code: code.toLowerCase(), perso: 'lunara', nom: 'Bob' });
  const da = a.dernier('debut');
  const db = b.dernier('debut');
  assert.equal(da.n, 0);
  assert.equal(db.n, 1);
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.persos, ['blazero', 'lunara']);
  assert.deepEqual(db.noms, ['Alice', 'Bob']);
  // Une salle pleine, ou inconnue.
  const c = joueur();
  c.dit({ t: 'rejoindre', code, perso: 'ryuken' });
  assert.match(c.dernier('erreur').msg, /pleine/);
  c.dit({ t: 'rejoindre', code: 'ZZZZ', perso: 'ryuken' });
  assert.match(c.dernier('erreur').msg, /Aucune salle/);
  a.dit({ t: 'quitter' });
});

test('les entrées passent de l’un à l’autre ; la revanche ; le départ', () => {
  const a = joueur();
  const b = joueur();
  a.dit({ t: 'creer', perso: 'heros-pirate', nom: '<b>Al</b>' });
  b.dit({ t: 'rejoindre', code: a.dernier('salle').code, perso: 'maitre' });
  assert.deepEqual(a.dernier('debut').persos, ['ryuken', 'ryuken'], 'un combattant inconnu ou un figurant : Ryu-Ken');
  assert.equal(a.dernier('debut').noms[0], 'bAl/b', 'pas de balises dans les noms');
  a.dit({ t: 'entrees', f: 7, e: 0b10001 });
  assert.deepEqual(b.dernier('entrees'), { g: 'street', t: 'entrees', f: 7, e: 0b10001 });
  assert.equal(a.dernier('entrees'), undefined, 'on ne reçoit pas ses propres entrées');
  // La revanche : il faut les deux.
  const avant = a.recu.filter((m) => m.t === 'debut').length;
  a.dit({ t: 'revanche' });
  assert.equal(b.dernier('revanche').n, 0);
  assert.equal(a.recu.filter((m) => m.t === 'debut').length, avant);
  b.dit({ t: 'revanche' });
  assert.equal(a.dernier('debut').manche, 2);
  // L'un part : l'autre est prévenu.
  street.handleClose(b.conn);
  assert.ok(a.dernier('parti'));
});

test('dix touches en un nombre, et retour', () => {
  const e = { g: true, d: false, h: true, b: false, P: true, K: false, G: false, A: true, B: false, U: true };
  assert.deepEqual(decoder(coder(e)), e);
  assert.equal(coder({}), 0);
});

test('le lockstep : avec les mêmes entrées, deux appareils jouent exactement le même combat', () => {
  // Deux « appareils » : deux combats, même graine ; on leur donne les mêmes entrées, image par image.
  const graine = 12345;
  const a = C.creerCombat({ p1: 'ryuken', p2: 'blazero', graine });
  const b = C.creerCombat({ p1: 'ryuken', p2: 'blazero', graine });
  let h = 7;
  const hasard = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h; };
  for (let f = 0; f < 60 * 25; f++) {
    const e = [decoder(hasard() & 0x3ff), decoder(hasard() & 0x3ff)];
    C.pas(a, e); C.pas(b, e);
    C.evenements(a); C.evenements(b);
  }
  assert.equal(empreinte(a), empreinte(b));
  assert.ok(a.joueurs.some((j) => j.hp < j.hpMax), 'il s’est vraiment passé quelque chose');
});

test('le lockstep : on attend les entrées de l’adversaire avant d’avancer', () => {
  preparer(1);
  // Les DELAI premières images se jouent tout de suite.
  for (let f = 0; f < DELAI; f++) assert.ok(entreesDuPas(() => ({ P: true })));
  // Puis il faut celles de l'adversaire.
  assert.equal(entreesDuPas(() => ({})), null);
  LS.distantes.set(DELAI, coder({ K: true }));
  const e = entreesDuPas(() => ({}));
  assert.ok(e[0].K, 'je suis le joueur 2 : l’adversaire est le joueur 1');
  assert.ok(e[1].P, 'mes entrées, envoyées DELAI images plus tôt');
});
