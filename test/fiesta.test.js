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
  const p = P.creerPartie({ joueurs: joueurs(4, 2), graine: 3, modes: 'chacun' });
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
  const p = P.creerPartie({ joueurs: joueurs(3, 3), graine: 5, modes: 'chacun' });
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

/** Une partie de 4 humains dont le tour a le format voulu. */
function tourAuFormat(type) {
  for (let g = 0; g < 200; g++) {
    const p = P.creerPartie({ joueurs: joueurs(4, 4), graine: g });
    if (P.formatDe(p).type === type) return p;
  }
  throw new Error(type);
}
const fortFaible = (p) => (M.MINIJEU[p.minijeu].sens === 'haut' ? [50, 10] : [10, 50]);

test('les formats : à quatre, les trois se mêlent ; à deux, toujours chacun pour soi', () => {
  const vus = { chacun: 0, duo: 0, seul: 0 };
  for (let g = 0; g < 300; g++) vus[P.formatDe(P.creerPartie({ joueurs: joueurs(4), graine: g })).type] += 1;
  assert.ok(vus.chacun > 100 && vus.duo > 40 && vus.seul > 40, JSON.stringify(vus));
  for (let g = 0; g < 50; g++) {
    assert.equal(P.formatDe(P.creerPartie({ joueurs: joueurs(2), graine: g })).type, 'chacun');
    assert.notEqual(P.formatDe(P.creerPartie({ joueurs: joueurs(3), graine: g })).type, 'duo');
    assert.equal(P.formatDe(P.creerPartie({ joueurs: joueurs(4), graine: g, modes: 'chacun' })).type, 'chacun');
  }
  const p = tourAuFormat('seul');
  assert.equal(P.nomFormat(p), '1 contre 3');
  assert.equal(P.formatDe(p).equipes[0].length, 1);
  assert.equal(P.formatDe(p).equipes[1].length, 3);
});

test('2 contre 2 : la moyenne de l’équipe décide, chaque gagnant lance deux dés', () => {
  const p = tourAuFormat('duo');
  const [A, B] = P.formatDe(p).equipes;
  const [fort, faible] = fortFaible(p);
  // L'équipe A a un très bon et un très mauvais joueur, mais la meilleure moyenne.
  P.score(p, A[0], fort + (fort > faible ? 20 : -5));
  P.score(p, A[1], faible);
  P.score(p, B[0], (fort + faible) / 2);
  P.score(p, B[1], (fort + faible) / 2);
  assert.equal(p.phase, 'resultats');
  assert.equal(p.equipes[0].gagne, true);
  assert.equal(p.equipes[1].gagne, false);
  for (const i of A) assert.deepEqual(P.desDe(p, i), { i, des: 2, bonus: 0 });
  for (const i of B) assert.deepEqual(P.desDe(p, i), { i, des: 1, bonus: 0 });
  assert.deepEqual(p.aJouer.slice(0, 2).sort(), [...A].sort(), 'les gagnants lancent d’abord');
  for (const i of A) assert.equal(p.joueurs[i].victoires, 1);
});

test('1 contre tous : le joueur seul qui gagne lance deux dés et un bonus', () => {
  const p = tourAuFormat('seul');
  const [[solo], autres] = P.formatDe(p).equipes;
  const [fort, faible] = fortFaible(p);
  P.score(p, solo, fort);
  for (const i of autres) P.score(p, i, faible);
  assert.equal(p.classement[0].i, solo);
  assert.deepEqual(P.desDe(p, solo), { i: solo, des: 2, bonus: 3 });
  for (const i of autres) assert.equal(P.desDe(p, i).des, 1);

  const q = tourAuFormat('seul');
  const [[s2], a2] = P.formatDe(q).equipes;
  const [f2, l2] = fortFaible(q);
  P.score(q, s2, l2);
  for (const i of a2) P.score(q, i, f2);
  assert.deepEqual(P.desDe(q, s2), { i: s2, des: 1, bonus: 0 });
  for (const i of a2) assert.deepEqual(P.desDe(q, i), { i, des: 2, bonus: 0 });
});

test('égalité entre équipes : tout le monde a gagné', () => {
  const p = tourAuFormat('duo');
  for (const j of p.joueurs) P.score(p, j.i, 7);
  assert.ok(p.equipes.every((e) => e.gagne && e.egalite));
  assert.ok(p.des.every((d) => d.des === 2 && d.bonus === 0));
});

test('le joueur seul change d’un tour à l’autre', () => {
  let p = P.creerPartie({ joueurs: joueurs(4, 0), graine: 4 });
  let avant = null;
  for (let t = 0; t < 120 && p.phase !== 'fin'; t++) {
    const f = P.formatDe(p);
    if (f.type === 'seul') { assert.notEqual(f.equipes[0][0], avant); avant = f.equipes[0][0]; }
    if (p.phase === 'resultats') P.versLesDes(p);
    while (p.phase === 'des') P.lancer(p);
  }
});

test('arrêter ses dés : le tirage du joueur est pris tel quel, s’il est valable', () => {
  const p = P.creerPartie({ joueurs: joueurs(2, 2), graine: 11, modes: 'chacun' });
  p.cases = p.cases.map((c, i) => (i === 0 ? 'depart' : i === p.cases.length - 1 ? 'arrivee' : 'normale'));
  const [fort, faible] = fortFaible(p);
  P.score(p, 0, fort);
  P.score(p, 1, faible);
  P.versLesDes(p);
  assert.equal(P.lancer(p, [7, 1]).raison, 'tirage');
  assert.equal(P.lancer(p, [6]).raison, 'tirage', 'deux dés, deux faces');
  assert.equal(P.lancer(p, [2.5, 1]).raison, 'tirage');
  assert.equal(P.quiLance(p), 0, 'un tirage refusé ne fait pas passer son tour');
  const r = P.lancer(p, [6, 6]).resultat;
  assert.deepEqual(r.tirage, [6, 6]);
  assert.equal(p.joueurs[0].pos, 12);
  const r2 = P.lancer(p, [3]).resultat;
  assert.equal(r2.total, 3 + r2.bonus);
});
