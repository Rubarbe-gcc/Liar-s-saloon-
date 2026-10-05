/**
 * SKULL KING — tests du moteur : cartes, plis, points, parties entières.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as S from '../public/shared/skullking/moteur.js';
import { makeRng } from '../public/shared/hasard.js';

const carte = (id) => S.paquet().find((c) => c.id === id);
/** Un pli écrit vite : 'Y5', 'sk', 'tig:pir'… joués par les joueurs 0, 1, 2… */
const pli = (...ids) => ids.map((x, p) => {
  const [id, as] = x.split(':');
  return { p, c: carte(id), as: as || null };
});
const gagne = (...ids) => S.resoudre(pli(...ids)).gagnant;

test('le paquet compte 72 cartes, toutes différentes', () => {
  const d = S.paquet();
  assert.equal(d.length, 72);
  assert.equal(new Set(d.map((c) => c.id)).size, 72);
  assert.equal(d.filter((c) => c.t === 'n').length, 56);
  assert.equal(d.filter((c) => c.t === 'pir').length, 5);
  assert.equal(d.filter((c) => c.t === 'esc').length, 5);
  assert.equal(d.filter((c) => c.t === 'sir').length, 2);
});

test('il faut suivre la couleur demandée, mais les cartes spéciales passent toujours', () => {
  const main = ['Y3', 'G9', 'pir1', 'tig', 'B2'].map(carte);
  const ids = (l) => l.map((c) => c.id).sort();
  assert.deepEqual(ids(S.legales(main, pli('Y10'))), ['Y3', 'pir1', 'tig'].sort());
  // Pas de jaune : on joue ce qu'on veut, même l'atout.
  assert.equal(S.legales(main, pli('P10')).length, 5);
  // Une fuite en tête ne fixe rien : c'est la carte suivante qui décide.
  assert.deepEqual(ids(S.legales(main, pli('esc1', 'G2'))), ['G9', 'pir1', 'tig'].sort());
  // Un personnage en tête : plus de couleur à suivre.
  assert.equal(S.legales(main, pli('pir2', 'Y5')).length, 5);
});

test('la hiérarchie des cartes', () => {
  assert.equal(gagne('Y10', 'Y12', 'G14'), 1, 'la couleur demandée');
  assert.equal(gagne('Y10', 'B1', 'Y14'), 1, 'le moindre atout bat la couleur');
  assert.equal(gagne('B13', 'sir1', 'Y14'), 1, 'la sirène bat les chiffres');
  assert.equal(gagne('sir1', 'pir1', 'B14'), 1, 'le pirate bat la sirène');
  assert.equal(gagne('pir1', 'sk', 'pir2'), 1, 'le Skull King bat les pirates');
  assert.equal(gagne('pir1', 'sk', 'sir2'), 2, 'la sirène séduit le Skull King');
  assert.equal(gagne('pir1', 'pir2', 'Y3'), 0, 'entre pirates, le premier joué');
  assert.equal(gagne('esc1', 'esc2', 'tig:esc'), 0, 'que des fuites : le premier');
  assert.equal(gagne('esc1', 'Y2', 'esc3'), 1);
  assert.equal(gagne('Y10', 'tig:pir', 'B14'), 1, 'la Tigresse en pirate');
  assert.equal(gagne('Y10', 'tig:esc', 'Y11'), 2, 'la Tigresse en fuite');
});

test('les bonus', () => {
  let r = S.resoudre(pli('Y14', 'Y2', 'G14'));
  assert.equal(r.gagnant, 0);
  assert.equal(r.bonus, 20, 'deux 14 de couleur, quel que soit celui qui les a joués');
  r = S.resoudre(pli('Y3', 'B14', 'B2'));
  assert.equal(r.bonus, 20, 'le 14 noir vaut 20');
  r = S.resoudre(pli('pir1', 'sk', 'tig:pir'));
  assert.equal(r.gagnant, 1);
  assert.equal(r.bonus, 60, 'Skull King : 30 par pirate, la Tigresse comprise');
  r = S.resoudre(pli('sir1', 'pir1', 'sir2'));
  assert.equal(r.bonus, 40, 'pirate : 20 par sirène');
  r = S.resoudre(pli('sk', 'sir2', 'pir3'));
  assert.equal(r.gagnant, 1);
  assert.equal(r.bonus, 40, 'sirène qui prend le Skull King');
});

test('le Kraken engloutit le pli, la Baleine ne garde que les chiffres', () => {
  let r = S.resoudre(pli('Y5', 'kra', 'Y9'));
  assert.equal(r.gagnant, null);
  assert.equal(r.meneur, 2, 'celui qui l’aurait gagné ouvre le pli suivant');
  r = S.resoudre(pli('sk', 'G3', 'wha', 'Y12'));
  assert.equal(r.gagnant, 3, 'le plus gros chiffre, couleur ou pas');
  r = S.resoudre(pli('pir1', 'wha', 'sk'));
  assert.equal(r.gagnant, null);
  assert.equal(r.meneur, 1, 'sans chiffre : pli défaussé, la Baleine rejoue');
  // Les deux : le dernier joué décide.
  assert.equal(S.resoudre(pli('Y5', 'kra', 'wha', 'Y9')).gagnant, 3);
  assert.equal(S.resoudre(pli('Y5', 'wha', 'kra', 'Y9')).gagnant, null);
});

test('les points d’une manche', () => {
  assert.equal(S.points(5, 0, 0), 50);
  assert.equal(S.points(5, 0, 2), -50);
  assert.equal(S.points(5, 3, 3), 60);
  assert.equal(S.points(5, 3, 1), -20);
  assert.equal(S.points(5, 2, 2, 30), 70, 'bonus si le pari est réussi');
  assert.equal(S.points(5, 2, 3, 30), -10, 'pas de bonus sinon');
  assert.equal(S.points(5, 2, 3, 30, { bonusToujours: true }), 20);
});

test('des parties entières entre ordinateurs, sans accroc', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = makeRng(seed);
    const n = 2 + (seed % 6);
    const G = S.creerPartie({ noms: Array.from({ length: n }, (_, i) => `J${i}`), bots: Array(n).fill(true) });
    S.nouvelleManche(G, rng);
    let garde = 0;
    while (G.phase !== 'fin' && garde++ < 5000) {
      if (G.phase === 'pari') {
        S.parierBots(G, rng);
        assert.equal(G.phase, 'jeu', 'tout le monde a parié');
        assert.notEqual(G.paris.reduce((t, b) => t + b, 0), G.manche, 'le total ne tombe jamais pile');
      } else if (G.phase === 'jeu') {
        const { id, as } = S.coupBot(G, G.tour);
        const r = S.jouer(G, G.tour, id, as);
        assert.ok(r.ok, r.raison);
      } else if (G.phase === 'pli') {
        S.ramasser(G);
      } else if (G.phase === 'bilan') {
        const b = G.historique.at(-1);
        assert.ok(b.reduce((s, x) => s + x.plis, 0) <= G.manche, 'pas plus de plis que de cartes');
        S.nouvelleManche(G, rng);
      }
    }
    assert.equal(G.phase, 'fin');
    assert.equal(G.historique.length, 10);
    const total = G.historique.reduce((t, m) => t.map((s, p) => s + m[p].points), Array(n).fill(0));
    assert.deepEqual(total, G.scores);
  }
});

test('on ne triche pas : couleur, tour et Tigresse', () => {
  const G = S.creerPartie({ noms: ['A', 'B'] });
  S.nouvelleManche(G, makeRng(3));
  assert.equal(S.jouer(G, 0, G.mains[0][0].id).ok, false, 'on parie d’abord');
  S.parier(G, 1 - G.donneur, 0); S.parier(G, G.donneur, 0);
  const autre = 1 - G.tour;
  assert.equal(S.jouer(G, autre, G.mains[autre][0].id).ok, false, 'chacun son tour');
  G.mains[G.tour] = [carte('tig')];
  assert.equal(S.jouer(G, G.tour, 'tig').ok, false, 'la Tigresse veut un choix');
  assert.ok(S.jouer(G, G.tour, 'tig', 'esc').ok);
});

test('les ordinateurs parient avec bon sens et tiennent souvent leur pari', () => {
  const rng = makeRng(7);
  let reussis = 0, total = 0;
  for (let g = 0; g < 40; g++) {
    const G = S.creerPartie({ noms: ['A', 'B', 'C', 'D'], bots: [true, true, true, true] });
    S.nouvelleManche(G, rng);
    while (G.phase !== 'fin') {
      if (G.phase === 'pari') S.parierBots(G, rng);
      else if (G.phase === 'jeu') { const c = S.coupBot(G, G.tour); S.jouer(G, G.tour, c.id, c.as); }
      else if (G.phase === 'pli') S.ramasser(G);
      else { for (const x of G.historique.at(-1)) { total++; if (x.pari === x.plis) reussis++; } S.nouvelleManche(G, rng); }
    }
  }
  assert.ok(reussis / total > 0.4, `${Math.round(100 * reussis / total)} % de paris tenus`);
  // Une main de monstres annonce des plis, une main de fuites n'en annonce pas.
  assert.ok(S.pariBot(['sk', 'pir1', 'pir2', 'B14'].map(carte), 4, () => 0.5) >= 3);
  assert.equal(S.pariBot(['esc1', 'esc2', 'Y2', 'G3'].map(carte), 4, () => 0.5), 0);
});

/* ================================================================== */
/* Le mode custom                                                     */
/* ================================================================== */

const carteX = (id) => S.paquet(S.TOUTES_CUSTOM).find((c) => c.id === id);
const pliX = (...ids) => ids.map((x, p) => {
  const [id, as] = x.split(':');
  return { p, c: carteX(id), as: as || null };
});

test('le paquet custom : 8 cartes de plus, et seulement celles qu’on choisit', () => {
  assert.equal(S.paquet(S.TOUTES_CUSTOM).length, 80);
  assert.equal(S.paquet(['canon']).length, 73);
  assert.deepEqual(S.nettoyerExtras(['canon', 'n-importe-quoi', 'rhum']), ['rhum', 'canon']);
  for (const t of S.TOUTES_CUSTOM) assert.ok(S.CUSTOM[t].regle.length > 20, t);
});

test('le Canon : dernier, il bat tout ; avant, c’est une fuite', () => {
  assert.equal(S.resoudre(pliX('sk', 'pir1', 'canon')).gagnant, 2);
  assert.equal(S.resoudre(pliX('canon', 'Y3', 'Y5')).gagnant, 2);
  // Un pli incomplet : le Canon n'est pas encore le dernier.
  assert.equal(S.resoudre(pliX('Y3', 'canon'), 3).gagnant, 0);
});

test('le Corsaire vaut 15 dans la couleur demandée', () => {
  assert.equal(S.resoudre(pliX('Y14', 'cors1', 'Y12')).gagnant, 1);
  assert.equal(S.resoudre(pliX('Y14', 'cors1', 'B1')).gagnant, 2, 'l’atout le bat');
  assert.equal(S.resoudre(pliX('cors1', 'G9', 'G13')).gagnant, 0, 'ouvert en premier, il prend la couleur de la suite');
  assert.equal(S.resoudre(pliX('Y5', 'cors1', 'pir2')).gagnant, 2, 'les personnages le battent');
  // Il se joue même quand on a la couleur.
  const main = [carteX('Y2'), carteX('cors2')];
  assert.equal(S.legales(main, pliX('Y9')).length, 2);
});

test('le Hollandais volant : la plus petite carte gagne, sauf s’il y a un personnage', () => {
  let r = S.resoudre(pliX('Y12', 'holl', 'B9', 'G2'));
  assert.equal(r.gagnant, 3);
  assert.equal(r.effet, 'hollandais');
  r = S.resoudre(pliX('Y12', 'holl', 'pir1'));
  assert.equal(r.gagnant, 2, 'avec un pirate, c’est une simple fuite');
});

test('rhum, trésor maudit et ancre', () => {
  let r = S.resoudre(pliX('rhum1', 'Y5', 'Y9'));
  assert.equal(r.gagnant, 2);
  assert.deepEqual(r.extras, [{ p: 0, pts: 10, txt: 'Bouteille de rhum' }]);
  r = S.resoudre(pliX('Y5', 'maudit', 'Y9'));
  assert.deepEqual(r.extras, [{ p: 2, pts: -20, txt: 'Trésor maudit' }]);
  r = S.resoudre(pliX('Y5', 'ancre', 'Y9'));
  assert.equal(r.gagnant, 2);
  assert.equal(r.meneur, 1, 'celui qui a jeté l’ancre ouvre le pli suivant');

  // Le malus compte même si le pari est réussi ; le bonus du rhum seulement s'il l'est.
  const G = S.creerPartie({ noms: ['A', 'B', 'C'], extras: S.TOUTES_CUSTOM });
  S.nouvelleManche(G, makeRng(1));
  G.mains = [[carteX('rhum1')], [carteX('maudit')], [carteX('Y9')]];
  G.tour = 0;
  // Le donneur (joueur 0) parie en dernier.
  for (const p of [1, 2, 0]) assert.ok(S.parier(G, p, [1, 0, 1][p]).ok);
  for (let p = 0; p < 3; p++) S.jouer(G, p, G.mains[p][0].id);
  S.ramasser(G);
  const b = G.historique.at(-1);
  assert.equal(b[2].points, 20 - 20, 'C tient son pari mais ramasse le trésor maudit');
  assert.equal(b[0].points, -10, 'A a raté son pari : pas de rhum');
});

test('des parties custom entières entre ordinateurs, sans accroc', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = makeRng(seed + 100);
    const n = 2 + (seed % 6);
    const G = S.creerPartie({ noms: Array.from({ length: n }, (_, i) => `J${i}`), bots: Array(n).fill(true), extras: S.TOUTES_CUSTOM });
    S.nouvelleManche(G, rng);
    while (G.phase !== 'fin') {
      if (G.phase === 'pari') S.parierBots(G, rng);
      else if (G.phase === 'jeu') { const c = S.coupBot(G, G.tour); assert.ok(S.jouer(G, G.tour, c.id, c.as).ok); }
      else if (G.phase === 'pli') S.ramasser(G);
      else S.nouvelleManche(G, rng);
    }
    assert.equal(G.historique.length, 10);
  }
});

test('le dernier pari : le donneur parie après les autres, et le total ne tombe jamais pile', () => {
  const G = S.creerPartie({ noms: ['A', 'B', 'C'], bots: [false, false, false] });
  S.nouvelleManche(G, makeRng(4));
  S.nouvelleManche(G, makeRng(5)); // manche 2 : deux cartes chacun
  const d = S.dernierAParier(G);
  const autres = [0, 1, 2].filter((p) => p !== d);
  assert.equal(S.parier(G, d, 1).ok, false, 'le donneur attend les autres');
  S.parier(G, autres[0], 1);
  S.parier(G, autres[1], 0);
  assert.equal(S.totalAutres(G, d), 1);
  assert.equal(S.pariInterdit(G, d), 1, '1 + 1 ferait 2 plis pour 2 cartes');
  const r = S.parier(G, d, 1);
  assert.equal(r.ok, false);
  assert.match(r.raison, /ne peut pas faire 2/);
  assert.ok(S.parier(G, d, 0).ok);
  assert.equal(G.phase, 'jeu');
});

test('un donneur de l’ordinateur se décale d’un cran si son pari est interdit', () => {
  for (let seed = 1; seed < 60; seed++) {
    const G = S.creerPartie({ noms: ['A', 'B', 'C', 'D'], bots: [true, true, true, true] });
    S.nouvelleManche(G, makeRng(seed));
    S.parierBots(G, makeRng(seed + 1000));
    assert.equal(G.phase, 'jeu');
    assert.notEqual(G.paris.reduce((t, b) => t + b, 0), G.manche);
  }
});
