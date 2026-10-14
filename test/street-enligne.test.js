/**
 * STREET COMBAT — le combat en ligne : le serveur réunit et relaie ; les deux
 * appareils, avec les mêmes entrées, jouent exactement le même combat.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as street from '../server/street.js';
import * as C from '../public/shared/street/combat.js';
import { coder, decoder, empreinte, delaiSelonPing } from '../public/games/street-combat/js/enligne.js';

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
  a.dit({ t: 'entrees', f: 7, e: [0b1, 0b10001], fc: 5, vu: 3, av: 2 });
  assert.deepEqual(b.dernier('entrees'), { g: 'street', t: 'entrees', f: 7, e: [0b1, 0b10001], fc: 5, vu: 3, av: 2 });
  // L'ancien format (une seule touche) passe encore ; les nombres sont nettoyés.
  a.dit({ t: 'entrees', f: 8, e: 0xffff, fc: 'x' });
  assert.deepEqual(b.dernier('entrees'), { g: 'street', t: 'entrees', f: 8, e: [0x3ff], fc: 0, vu: -1, av: 0 });
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

test('l’arène : l’hôte la choisit, les deux la reçoivent, « au hasard » par défaut', () => {
  const a = joueur();
  const b = joueur();
  a.dit({ t: 'creer', perso: 'ryuken', nom: 'A', arene: 'volcan' });
  assert.equal(a.dernier('salle').arene, 'volcan');
  // En attendant son adversaire, l'hôte change d'avis.
  a.dit({ t: 'arene', arene: 'dojo' });
  assert.equal(a.dernier('arene').arene, 'dojo');
  b.dit({ t: 'rejoindre', code: a.dernier('salle').code, perso: 'blazero' });
  assert.equal(a.dernier('debut').arene, 'dojo');
  assert.equal(b.dernier('debut').arene, 'dojo');
  // Celui qui a rejoint ne choisit pas.
  b.dit({ t: 'arene', arene: 'volcan' });
  assert.equal(b.dernier('arene'), undefined);
  // Pour la revanche, l'hôte peut en changer ; une arène au nom bizarre devient « au hasard ».
  a.dit({ t: 'arene', arene: '<script>' });
  assert.equal(b.dernier('arene').arene, 'hasard');
  a.dit({ t: 'arene', arene: 'neige' });
  a.dit({ t: 'revanche' }); b.dit({ t: 'revanche' });
  assert.equal(b.dernier('debut').arene, 'neige');
  const c = joueur();
  c.dit({ t: 'creer', perso: 'ryuken', nom: 'C' });
  assert.equal(c.dernier('salle').arene, 'hasard');
});

test('le recalage : seul l’hôte envoie son état, et pas un état démesuré', () => {
  const a = joueur();
  const b = joueur();
  a.dit({ t: 'creer', perso: 'ryuken', nom: 'A' });
  b.dit({ t: 'rejoindre', code: a.dernier('salle').code, perso: 'blazero' });
  a.dit({ t: 'etat', f: 120, etat: { f: 120, joueurs: [] } });
  assert.deepEqual(b.dernier('etat').etat, { f: 120, joueurs: [] });
  b.dit({ t: 'etat', f: 120, etat: { f: 120 } });
  assert.equal(a.dernier('etat'), undefined, 'l’invité n’impose pas son état');
  a.dit({ t: 'etat', f: 240, etat: { gros: 'x'.repeat(70000) } });
  assert.equal(b.dernier('etat').f, 120, 'trop gros : ignoré');
});

test('le ping : une sonde revient ; le délai des touches suit le ping', () => {
  const a = joueur();
  a.dit({ t: 'sonde', id: 42 });
  assert.equal(a.dernier('sonde').id, 42);
  assert.equal(delaiSelonPing(0), 2, 'sans mesure : 2 images');
  assert.equal(delaiSelonPing(20), 1);
  assert.equal(delaiSelonPing(70), 2);
  assert.equal(delaiSelonPing(400), 3, 'jamais plus de 3 images');
});
