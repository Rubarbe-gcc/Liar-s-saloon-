/**
 * FIESTA — le moteur : le plateau, le classement des mini-jeux, les dés, les cases.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as P from '../public/shared/fiesta/partie.js';
import * as M from '../public/shared/fiesta/minijeux.js';

const joueurs = (n, humains = 1) => Array.from({ length: n }, (_, k) => ({ nom: `J${k}`, humain: k < humains }));

/** Joue une partie entière, les humains avec un score tiré comme un ordinateur. */
function jouerTout(p, R = Math.random) {
  let garde = 0;
  while (p.phase !== 'fin' && garde++ < 600) {
    if (p.phase === 'minijeu') { const h = P.humainSuivant(p); assert.ok(P.score(p, h.i, M.scoreOrdinateur(p.minijeu, 'normal', R)).ok); }
    else if (p.phase === 'resultats') P.versLesDes(p);
    else if (p.phase === 'des') assert.ok(P.lancer(p).ok);
  }
  return p;
}

test('le catalogue des mini-jeux est complet', () => {
  assert.equal(M.MINIJEUX.length, 9);
  for (const m of M.MINIJEUX) {
    assert.ok(m.nom && m.glyphe && m.regle && m.unite, m.id);
    assert.ok(['haut', 'bas'].includes(m.sens), m.id);
    for (const n of P.NIVEAUX) {
      const [a, b] = m.cpu[n];
      assert.ok(a <= b, `${m.id} ${n}`);
    }
    // Un expert fait mieux qu'un débutant.
    const moy = (n) => (m.cpu[n][0] + m.cpu[n][1]) / 2;
    assert.ok(m.sens === 'haut' ? moy('expert') > moy('facile') : moy('expert') < moy('facile'), m.id);
  }
});

test('le plateau : départ, arrivée, et toutes les sortes de cases spéciales', () => {
  for (const longueur of Object.keys(P.LONGUEURS)) {
    const p = P.creerPartie({ joueurs: joueurs(4), longueur, graine: 7 });
    assert.equal(p.cases.length, P.LONGUEURS[longueur]);
    assert.equal(p.cases[0], 'depart');
    assert.equal(p.cases.at(-1), 'arrivee');
    for (const t of ['etoile', 'tornade', 'fusee', 'echange', 'trou', 'de', 'cadeau']) assert.ok(p.cases.includes(t), `${longueur} : ${t}`);
    // Jamais deux cases spéciales identiques côte à côte.
    for (let i = 1; i < p.cases.length; i++) {
      if (p.cases[i] !== 'normale') assert.notEqual(p.cases[i], p.cases[i - 1], `${longueur} case ${i}`);
    }
  }
});

test('un tour : les ordinateurs ont joué, les humains jouent, le classement donne les dés', () => {
  const p = P.creerPartie({ joueurs: joueurs(4, 2), graine: 3 });
  assert.equal(p.phase, 'minijeu');
  assert.ok(p.scores[2] !== null && p.scores[3] !== null, 'les ordinateurs ont déjà leur score');
  assert.equal(P.humainSuivant(p).i, 0);
  const fort = M.MINIJEU[p.minijeu].sens === 'haut' ? 9999 : 0;
  const faible = M.MINIJEU[p.minijeu].sens === 'haut' ? 0 : 9999;
  P.score(p, 0, fort);
  assert.equal(P.humainSuivant(p).i, 1);
  P.score(p, 1, faible);
  assert.equal(p.phase, 'resultats');
  assert.equal(p.classement[0].i, 0);
  assert.deepEqual(P.desDe(p, 0), { i: 0, des: 2, bonus: 0 });
  assert.equal(P.desDe(p, 1).des, 1);
  assert.equal(P.desDe(p, 1).bonus, 0, 'le dernier n’a pas de bonus');
  assert.equal(P.score(p, 0, 5).raison, 'phase');
});

test('les ex æquo partagent leur rang et leurs dés', () => {
  const p = P.creerPartie({ joueurs: joueurs(3, 3), graine: 5 });
  for (const j of p.joueurs) P.score(p, j.i, 10);
  assert.ok(p.classement.every((c) => c.rang === 0));
  assert.ok(p.des.every((d) => d.des === 2));
});

test('lancer : on avance du total, dans l’ordre du classement', () => {
  const p = P.creerPartie({ joueurs: joueurs(2, 2), graine: 11 });
  p.cases = p.cases.map((c, i) => (i === 0 ? 'depart' : i === p.cases.length - 1 ? 'arrivee' : 'normale'));
  P.score(p, 0, M.MINIJEU[p.minijeu].sens === 'haut' ? 50 : 1);
  P.score(p, 1, M.MINIJEU[p.minijeu].sens === 'haut' ? 1 : 50);
  P.versLesDes(p);
  assert.equal(P.quiLance(p), 0);
  const r = P.lancer(p).resultat;
  assert.equal(r.tirage.length, 2);
  assert.equal(p.joueurs[0].pos, r.total);
  assert.equal(r.chemin.length, r.total);
  assert.equal(P.quiLance(p), 1);
  P.lancer(p);
  assert.equal(p.phase, 'minijeu', 'tout le monde a lancé : nouveau tour');
  assert.equal(p.tour, 2);
});

test('les cases spéciales font ce qu’elles disent', () => {
  const base = () => {
    const p = P.creerPartie({ joueurs: joueurs(2, 2), graine: 1 });
    p.cases = p.cases.map((c, i) => (i === 0 ? 'depart' : i === p.cases.length - 1 ? 'arrivee' : 'normale'));
    return p;
  };
  const tomberSur = (type, depuis = 0, autres = 0) => {
    const p = base();
    // On force le dé : le joueur 0 part de `depuis` et tombe pile sur la case 10.
    p.cases[10] = type;
    p.joueurs[0].pos = depuis;
    p.joueurs[1].pos = autres;
    p.phase = 'des';
    p.des = [{ i: 0, des: 0, bonus: 10 - depuis }, { i: 1, des: 0, bonus: 0 }];
    p.aJouer = [0, 1];
    const r = P.lancer(p).resultat;
    return { p, r };
  };
  assert.equal(tomberSur('etoile').p.joueurs[0].pos, 13);
  assert.equal(tomberSur('tornade').p.joueurs[0].pos, 7);
  assert.equal(tomberSur('fusee').p.joueurs[0].pos, 16);
  const trou = tomberSur('trou').p;
  assert.equal(trou.joueurs[0].bloque, true);
  const ech = tomberSur('echange', 0, 25).p;
  assert.equal(ech.joueurs[0].pos, 25);
  assert.equal(ech.joueurs[1].pos, 10);
  const cad = tomberSur('cadeau', 0, 20).p;
  assert.equal(cad.joueurs[1].pos, 18);
  const de = tomberSur('de');
  assert.equal(de.p.joueurs[0].pos, 10 + de.r.effet.de);
});

test('coincé dans un trou : on passe un tour sans bouger', () => {
  const p = P.creerPartie({ joueurs: joueurs(2, 2), graine: 2 });
  p.joueurs[0].bloque = true;
  p.joueurs[0].pos = 5;
  p.phase = 'des';
  p.des = [{ i: 0, des: 2, bonus: 0 }, { i: 1, des: 1, bonus: 0 }];
  p.aJouer = [0, 1];
  const r = P.lancer(p).resultat;
  assert.equal(r.bloque, true);
  assert.equal(p.joueurs[0].pos, 5);
  assert.equal(p.joueurs[0].bloque, false);
});

test('des parties entières vont jusqu’au bout, et tiennent en JSON', () => {
  for (let s = 0; s < 40; s++) {
    const p = jouerTout(P.creerPartie({ joueurs: joueurs(2 + (s % 3), 1 + (s % 2)), graine: s, longueur: ['courte', 'normale', 'longue'][s % 3] }));
    assert.equal(p.phase, 'fin');
    assert.ok(p.joueurs[p.vainqueur].pos >= P.fin(p));
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  }
});

test('une partie sans humain se joue toute seule', () => {
  const p = P.creerPartie({ joueurs: joueurs(3, 0), graine: 9 });
  assert.equal(p.phase, 'resultats');
});

test('une même graine rejoue le même plateau et les mêmes mini-jeux', () => {
  const a = P.creerPartie({ joueurs: joueurs(3), graine: 'FETE' });
  const b = P.creerPartie({ joueurs: joueurs(3), graine: 'FETE' });
  assert.deepEqual(a.cases, b.cases);
  assert.equal(a.minijeu, b.minijeu);
});
