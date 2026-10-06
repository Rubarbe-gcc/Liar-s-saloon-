/**
 * FIESTA en ligne (server/fiesta.js) : une table, des mini-jeux joués chacun
 * chez soi, des dés arrêtés à la main, une coupure en pleine partie.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as hub from '../server/hub.js';
import { DELAIS } from '../server/fiesta.js';
import { MINIJEU } from '../public/shared/fiesta/minijeux.js';

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

function connexion() {
  const c = {
    id: `f${++seq}`,
    recus: [],
    ferme: false,
    send(o) { if (c.ferme) return false; c.recus.push(o); return true; },
    close() { if (!c.ferme) { c.ferme = true; hub.handleClose(c); } },
    partir() { if (!c.ferme) hub.handleMessage(c, { g: 'fiesta', t: 'leave' }); c.close(); },
    dernier(t) { return [...c.recus].reverse().find((m) => m.t === t); },
  };
  hub.handleOpen(c);
  return c;
}
const dire = (c, msg) => hub.handleMessage(c, { g: 'fiesta', ...msg });
const couper = (c) => { c.ferme = true; hub.handleClose(c); };

Object.assign(DELAIS, { minijeu: 400, absentJeu: 30, resultats: 40, lancer: 60, bot: 3, absent: 10, animation: 0 });

/** Joue pour un humain ce que la table attend de lui. */
function jouerPour(c) {
  const v = c.dernier('fi:etat')?.vue;
  if (!v || v.moi < 0) return;
  const { p, moi } = v;
  if (p.phase === 'minijeu' && !v.faits[moi]) dire(c, { t: 'score', v: MINIJEU[p.minijeu].sens === 'haut' ? 20 : 100 });
  else if (p.phase === 'resultats' && !v.prets[moi]) dire(c, { t: 'pret' });
  else if (p.phase === 'des' && p.aJouer[0] === moi) {
    const d = p.des.find((x) => x.i === moi);
    dire(c, { t: 'roule' });
    dire(c, { t: 'lancer', tirage: Array(d.des).fill(4) });
  }
}

test('FIESTA en ligne : une table, un ordi, une partie entière jusqu’au podium', async () => {
  const a = connexion();
  dire(a, { t: 'session', sid: 'fiestaAAAA01' });
  dire(a, { t: 'create', name: 'Anne', av: '🐼' });
  const code = a.dernier('fi:salon').code;
  const b = connexion();
  dire(b, { t: 'session', sid: 'fiestaBBBB01' });
  dire(b, { t: 'join', code, name: 'Bart', av: '🐼' });
  let s = b.dernier('fi:salon');
  assert.equal(s.joueurs.length, 2);
  assert.equal(s.joueurs[0].av, '🐼');
  assert.notEqual(s.joueurs[1].av, '🐼', 'deux joueurs n’ont jamais le même avatar');
  dire(b, { t: 'bot', delta: 1 });
  assert.match(b.dernier('fi:erreur').msg, /hôte/);
  dire(a, { t: 'bot', delta: 1 });
  dire(a, { t: 'options', options: { longueur: 'courte', niveau: 'expert', modes: 'tous' } });
  s = a.dernier('fi:salon');
  assert.equal(s.joueurs.length, 3);
  assert.equal(s.options.longueur, 'courte');

  dire(a, { t: 'start' });
  assert.ok(b.dernier('fi:debut'));
  let v = a.dernier('fi:etat').vue;
  assert.equal(v.p.phase, 'minijeu');
  assert.equal(v.p.cases.length, 30);
  assert.equal(v.p.alea, 0, 'le hasard de la table reste au serveur');
  assert.equal(v.faits[2], true, 'l’ordi a déjà joué…');
  assert.equal(v.p.scores[2], null, '… mais son score reste caché');

  // Bart joue : Anne ne voit pas son score avant la fin du mini-jeu.
  dire(b, { t: 'score', v: 33 });
  v = a.dernier('fi:etat').vue;
  assert.equal(v.faits[1], true);
  assert.equal(v.p.scores[1], null);
  dire(a, { t: 'score', v: 12 });
  v = a.dernier('fi:etat').vue;
  assert.equal(v.p.phase, 'resultats');
  assert.equal(v.p.scores[1], 33);

  // Les dés : un tirage faux est refusé, un vrai est pris tel quel.
  dire(a, { t: 'pret' }); dire(b, { t: 'pret' });
  v = a.dernier('fi:etat').vue;
  assert.equal(v.p.phase, 'des');
  const qui = v.p.aJouer[0];
  const lanceur = qui === 0 ? a : qui === 1 ? b : null;
  if (lanceur) {
    const n = v.p.des.find((x) => x.i === qui).des;
    dire(lanceur, { t: 'lancer', tirage: [9, 9].slice(0, n) });
    assert.ok(lanceur.dernier('fi:erreur'));
    dire(lanceur === a ? b : a, { t: 'lancer', tirage: Array(n).fill(1) });
    assert.equal(a.recus.filter((m) => m.t === 'fi:lance').length, 0, 'seul celui dont c’est le tour lance');
    dire(lanceur, { t: 'roule' });
    assert.equal((lanceur === a ? b : a).dernier('fi:roule').i, qui, 'les autres voient les dés rouler');
    dire(lanceur, { t: 'lancer', tirage: Array(n).fill(5) });
    assert.deepEqual(a.dernier('fi:lance').r.tirage, Array(n).fill(5));
  }

  const fin = Date.now() + 20000;
  while (Date.now() < fin) {
    v = a.dernier('fi:etat').vue;
    if (v.p.phase === 'fin') break;
    jouerPour(a); jouerPour(b);
    await attendre(3);
  }
  assert.equal(v.p.phase, 'fin');
  assert.ok(v.p.vainqueur !== null);
  assert.ok(v.p.tour > 1);

  // Retour au salon pour la revanche.
  dire(b, { t: 'rejouer' });
  assert.equal(a.dernier('fi:salon').enPartie, false);
  a.partir(); b.partir();
});

test('FIESTA en ligne : une coupure en pleine partie, l’ordi joue en attendant, la place est reprise', async () => {
  const a = connexion();
  dire(a, { t: 'session', sid: 'fiestaCCCC01' });
  dire(a, { t: 'create', name: 'Anne' });
  const code = a.dernier('fi:salon').code;
  const b = connexion();
  dire(b, { t: 'session', sid: 'fiestaDDDD01' });
  dire(b, { t: 'join', code, name: 'Bart' });
  dire(a, { t: 'start' });

  // Bart perd le réseau avant d'avoir joué : l'ordinateur joue pour lui.
  couper(b);
  assert.match(a.dernier('fi:notice').msg, /Bart/);
  dire(a, { t: 'score', v: 10 });
  await attendre(80);
  let v = a.dernier('fi:etat').vue;
  assert.notEqual(v.p.phase, 'minijeu', 'le mini-jeu ne l’a pas attendu');
  assert.equal(v.absents[1], true);

  // Il revient avec la même clé : même place, toute la partie.
  const b2 = connexion();
  dire(b2, { t: 'session', sid: 'fiestaDDDD01' });
  assert.equal(b2.dernier('session').repris, true);
  assert.ok(b2.dernier('fi:debut').reprise);
  const vb = b2.dernier('fi:etat').vue;
  assert.equal(vb.moi, 1);
  assert.equal(vb.absents[1], false);

  // Un départ volontaire : l'ordinateur prend la place pour de bon.
  b2.partir();
  v = a.dernier('fi:etat').vue;
  assert.equal(v.bots[1], true);
  assert.equal(v.p.joueurs[1].humain, false);
  a.partir();
});
