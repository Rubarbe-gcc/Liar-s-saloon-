/**
 * FIESTA — le moteur : le plateau, le classement des mini-jeux, les dés, les cases.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as P from '../public/shared/fiesta/partie.js';
import * as M from '../public/shared/fiesta/minijeux.js';
import * as CC from '../public/shared/fiesta/cachecache.js';

const joueurs = (n, humains = 1) => Array.from({ length: n }, (_, k) => ({ nom: `J${k}`, humain: k < humains }));

/** Joue une partie entière, les humains avec un score tiré comme un ordinateur. */
function jouerTout(p, R = Math.random) {
  let garde = 0;
  while (p.phase !== 'fin' && garde++ < 600) {
    if (p.phase === 'minijeu') {
      const h = P.humainSuivant(p);
      // Le cache-cache se joue manche par manche : l'ordinateur agit pour l'humain.
      if (p.jeu) assert.ok(P.scoreAuto(p, h.i).ok);
      else assert.ok(P.score(p, h.i, M.scoreOrdinateur(p.minijeu, 'normal', R, P.contexte(p, h.i))).ok);
    }
    else if (p.phase === 'resultats') P.versLesDes(p);
    else if (p.phase === 'des') assert.ok(P.lancer(p).ok);
  }
  return p;
}

test('le catalogue des mini-jeux est complet', () => {
  const parStyle = (st) => M.MINIJEUX.filter((m) => m.style === st).length;
  assert.equal(parStyle('chacun'), 9);
  assert.equal(parStyle('duo'), 2);
  assert.equal(parStyle('seul'), 2);
  for (const m of M.MINIJEUX) {
    assert.ok(m.nom && m.glyphe && m.regle && m.unite, m.id);
    assert.ok(['haut', 'bas'].includes(m.sens), m.id);
    if (m.style === 'seul') {
      // Un contre tous : un rôle et une unité pour chaque camp, des choix pour l'ordinateur, et de quoi les confronter.
      assert.ok(m.roles.solo && m.roles.autres && m.unites.solo && m.unites.autres && (m.cpuJouer || m.interactif) && m.resoudre, m.id);
      continue;
    }
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

test('2 contre 2 : les points des coéquipiers s’additionnent, chaque gagnant lance deux dés', () => {
  const p = tourAuFormat('duo');
  const [A, B] = P.formatDe(p).equipes;
  const [fort, faible] = fortFaible(p);
  // L'équipe A a un très bon et un très mauvais joueur, mais le meilleur total.
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

test('chaque tour joue un mini-jeu de son style', () => {
  for (let g = 0; g < 200; g++) {
    const p = P.creerPartie({ joueurs: joueurs(4), graine: g });
    const f = P.formatDe(p);
    assert.equal(M.MINIJEU[p.minijeu].style, f.type, `graine ${g}`);
    for (const j of p.joueurs) {
      const c = P.contexte(p, j.i);
      if (f.type === 'seul') assert.equal(c.role, j.i === f.equipes[0][0] ? 'solo' : 'autres');
      if (f.type === 'duo') assert.ok(c.equipe.includes(j.i));
    }
  }
  // « Chacun pour soi » seulement : jamais un mini-jeu d'équipe.
  for (let g = 0; g < 50; g++) assert.equal(M.MINIJEU[P.creerPartie({ joueurs: joueurs(4), graine: g, modes: 'chacun' }).minijeu].style, 'chacun');
});

/** Un tour à 1 contre tous sur le mini-jeu voulu, avec 4 humains. */
function tourSeul(id) {
  for (let g = 0; g < 2000; g++) {
    const p = P.creerPartie({ joueurs: joueurs(4, 4), graine: g });
    if (p.minijeu === id) return p;
  }
  throw new Error(id);
}

test('Tirs au But : le gardien joue en dernier, et qui arrête tout gagne deux dés et un bonus', () => {
  const p = tourSeul('tirs');
  const [[gardien], tireurs] = P.formatDe(p).equipes;
  assert.equal(P.humainSuivant(p).i, tireurs[0], 'les tireurs d’abord');
  assert.equal(P.attendLesAutres(p, gardien), true);
  // Chaque tireur frappe à gauche, à pleine puissance : 1 + 0×3 + 2.
  for (const t of tireurs) P.score(p, t, M.coder([3, 3, 3], 10));
  assert.equal(P.attendLesAutres(p, gardien), false);
  assert.equal(P.humainSuivant(p).i, gardien, 'puis le gardien');
  P.score(p, gardien, M.coder(Array(9).fill(1), 2));
  assert.equal(p.phase, 'resultats');
  assert.equal(p.equipes[0].gagne, true);
  assert.equal(p.equipes[0].score, 9, '9 arrêts');
  assert.deepEqual(P.desDe(p, gardien), { i: gardien, des: 2, bonus: 3 });
  for (const t of tireurs) assert.deepEqual(P.desDe(p, t), { i: t, des: 1, bonus: 0 });
  assert.deepEqual(M.lireTir(3), { coin: 0, puissance: 2 });
  assert.equal(M.lireTir(0), null);
});

test('Tirs au But : un tir sur trois au fond, et les tireurs gagnent', () => {
  const p = tourSeul('tirs');
  const [[gardien], tireurs] = P.formatDe(p).equipes;
  // Le premier tireur rate tout (0) ; les autres cadrent tout.
  tireurs.forEach((t, k) => P.score(p, t, M.coder(k === 0 ? [0, 0, 0] : [5, 5, 5], 10)));
  // Le gardien arrête les tirs ratés (peu importe) et un tir sur deux des autres.
  P.score(p, gardien, M.coder([1, 1, 1, 1, 0, 1, 0, 1, 0], 2));
  assert.equal(p.resolution.texte, '3 buts sur 9 tirs (il en fallait 3)');
  assert.equal(p.equipes[1].gagne, true);
  assert.equal(p.classement.find((c) => c.i === tireurs[0]).score, 0);
  for (const t of tireurs) assert.equal(P.desDe(p, t).des, 2);
  assert.equal(P.desDe(p, gardien).des, 1);
});

test('Le Fantôme : un cache-cache manche par manche, et une pièce fouillée est condamnée', () => {
  const p = tourSeul('fantome');
  const [[fantome], caches] = P.formatDe(p).equipes;
  const st = p.jeu;
  assert.equal(st.pieces, 4, 'trois joueurs cachés : quatre pièces');
  assert.equal(st.manches, 3);
  // Les joueurs cachés d'abord ; le fantôme attend.
  assert.equal(P.doitAgir(p, fantome), false);
  assert.equal(P.score(p, caches[0], 5).raison, 'interactif');
  assert.ok(P.agir(p, caches[0], 0).ok);
  assert.equal(P.agir(p, caches[0], 1).raison, 'joueur', 'on ne se cache qu’une fois par manche');
  assert.ok(P.agir(p, caches[1], 0).ok);
  assert.ok(P.agir(p, caches[2], 2).ok);
  // Tout le monde est caché : les ombres bougent, au fantôme d'ouvrir une porte.
  assert.equal(st.etape, 'cherche');
  assert.equal(Object.keys(st.chemins).length, 3);
  assert.equal(P.humainSuivant(p).i, fantome);
  assert.ok(P.agir(p, fantome, 0).ok);
  assert.deepEqual(st.revelations[0].trouves.sort(), [caches[0], caches[1]].sort(), 'deux joueurs attrapés dans la chambre');
  assert.deepEqual(st.ouvertes, [1, 2, 3], 'la chambre est condamnée');
  assert.equal(st.manche, 2);
  // Plus le droit d'aller dans la pièce fouillée.
  assert.equal(P.agir(p, caches[2], 0).raison, 'piece');
  assert.equal(P.doitAgir(p, caches[0]), false, 'un joueur attrapé ne joue plus');
  assert.ok(P.agir(p, caches[2], 3).ok);
  assert.ok(P.agir(p, fantome, 1).ok);
  assert.deepEqual(st.revelations[1].trouves, [], 'personne dans la cuisine');
  assert.ok(P.agir(p, caches[2], 3).ok);
  assert.ok(P.agir(p, fantome, 3).ok);
  // Tout le monde est attrapé : le fantôme gagne, deux dés et un bonus.
  assert.equal(p.phase, 'resultats');
  assert.equal(p.equipes[0].gagne, true);
  assert.equal(p.resolution.texte, 'Tout le monde attrapé !');
  assert.equal(p.classement.find((c) => c.i === caches[2]).score, 2, 'il a tenu deux manches');
  assert.deepEqual(P.desDe(p, fantome), { i: fantome, des: 2, bonus: 3 });
});

test('Le Fantôme : un joueur qui tient jusqu’au bout fait gagner les autres', () => {
  const p = tourSeul('fantome');
  const [[fantome], caches] = P.formatDe(p).equipes;
  for (let m = 0; m < 3; m++) {
    for (const c of caches) if (P.doitAgir(p, c)) assert.ok(P.agir(p, c, p.jeu.ouvertes.at(-1)).ok);
    // Le fantôme ouvre toujours la première pièce encore ouverte ; tout le monde est dans la dernière.
    assert.ok(P.agir(p, fantome, p.jeu.ouvertes[0]).ok);
  }
  assert.equal(p.phase, 'resultats');
  assert.equal(p.equipes[1].gagne, true);
  assert.equal(p.resolution.texte, '0 attrapé sur 3');
  for (const c of caches) assert.equal(P.desDe(p, c).des, 2);
});

test('Le Fantôme : l’ordinateur suit les ombres, et le jeu reste équilibré', () => {
  for (const n of [2, 3]) {
    let gagne = 0;
    for (let k = 0; k < 3000; k++) {
      const st = CC.nouveau(Array.from({ length: n }, (_, i) => i + 1));
      while (st.etape !== 'fini') {
        for (const i of CC.reste(st)) CC.cacher(st, i, CC.cachetteAuHasard(st, Math.random));
        CC.versRecherche(st, Math.random);
        CC.chercher(st, CC.porteOrdi(st, 'normal', Math.random));
      }
      if (CC.attrapes(st) >= CC.seuilFantome(n)) gagne += 1;
    }
    assert.ok(gagne / 3000 > 0.4 && gagne / 3000 < 0.7, `${n} cachés : le fantôme gagne ${gagne / 30} %`);
  }
});

test('1 contre tous : les choix de l’ordinateur sont valables, et la partie va au bout', () => {
  const R = () => Math.random();
  for (const id of ['tirs']) {
    const m = M.MINIJEU[id];
    for (let k = 0; k < 200; k++) {
      const autres = [1, 2, 3].slice(0, 2 + (k % 2));
      const v = { 0: m.cpuJouer('normal', R, { role: 'solo', solo: 0, autres }) };
      for (const a of autres) v[a] = m.cpuJouer('expert', R, { role: 'autres', solo: 0, autres });
      const r = m.resoudre(0, autres, (i) => v[i]);
      assert.ok([0, 1, -1].includes(r.gagnante));
      assert.ok(Object.values(r.valeurs).every((x) => Number.isInteger(x) && x >= 0));
    }
  }
  // Des parties à 4 ordinateurs : tous les styles passent, jusqu'au bout.
  const vus = new Set();
  for (let g = 0; g < 30; g++) {
    const p = P.creerPartie({ joueurs: joueurs(4, 0), graine: g });
    let garde = 0;
    while (p.phase !== 'fin' && garde++ < 600) {
      vus.add(p.minijeu);
      if (p.phase === 'resultats') P.versLesDes(p);
      else if (p.phase === 'des') P.lancer(p);
    }
    assert.equal(p.phase, 'fin');
  }
  for (const id of ['corde', 'relais', 'tirs', 'fantome']) assert.ok(vus.has(id), id);
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
