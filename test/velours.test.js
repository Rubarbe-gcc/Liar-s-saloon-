/**
 * LE VELOURS NOIR — le casino : les mains de poker, la table (pots annexes,
 * aucun jeton créé ni perdu), le blackjack, la roulette et la caisse.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../public/shared/hasard.js';
import * as P from '../public/shared/casino/poker.js';
import * as BJ from '../public/shared/casino/blackjack.js';
import * as R from '../public/shared/casino/roulette.js';
import * as K from '../public/shared/casino/banque.js';
import { sabot } from '../public/shared/casino/cartes.js';

const c = (s) => s.split(' ').map((x) => ({ r: { A: 14, R: 13, D: 12, V: 11, X: 10 }[x[0]] || Number(x[0]), c: { s: '♠', h: '♥', d: '♦', c: '♣' }[x[1]] }));

test('les mains de poker : noms et ordre', () => {
  const m = (s) => P.meilleure(c(s));
  assert.equal(m('As Rs Ds Vs Xs 2c 3d').nom, 'Quinte flush royale');
  assert.equal(m('As 2s 3s 4s 5s Rc Rd').nom, 'Quinte flush au Cinq');
  assert.equal(m('Ah Ad Ac As 2c 3d 9h').nom, 'Carré d’As');
  assert.equal(m('Rh Rd Rc 7s 7c 3d 9h').nom, 'Full aux Rois par les Sept');
  assert.equal(m('2h 8h Xh Vh 4h Rc Rd').nom, 'Couleur au Valet');
  assert.equal(m('Ah 2d 3c 4s 5h Rc 9d').nom, 'Quinte au Cinq');
  assert.equal(m('8h 8d 8c 2s 5h Rc 9d').nom, 'Brelan d’Huit');
  assert.equal(m('Rh Rd 7c 7s 5h 2c 9d').nom, 'Deux paires, Rois et Sept');
  assert.equal(m('Dh Dd 7c 3s 5h 2c 9d').nom, 'Paire de Dames');
  assert.equal(m('Rh Dd 7c 3s 5h 2c 9d').nom, 'Hauteur Roi');
  assert.ok(m('Ah Ad 7c 3s 5h 2c 9d').score < m('Rh Rd Ac Rs 5h 2c 9d').score);
  assert.ok(m('Ah Ad 7c 3s 5h 2c 9d').score > m('Rh Rd Ac Ds 5h 2c 9d').score);
  // le kicker départage
  assert.ok(m('Ah Ad Rc 3s 5h 2c 9d').score > m('Ah Ad Dc 3s 5h 2c 9d').score);
});

test('le calcul rapide de l’ordinateur donne le même rang que l’évaluation complète', () => {
  const rng = makeRng(7);
  for (let k = 0; k < 3000; k++) {
    const s = sabot(rng).slice(0, 7);
    assert.equal(P.score7(s), P.meilleure(s).score, JSON.stringify(s));
  }
});

test('les pots annexes', () => {
  const j = (i, engage, couche = false) => ({ i, engage, couche, absent: false });
  const pots = P.calculerPots([j(0, 100), j(1, 300), j(2, 300), j(3, 50, true)]);
  assert.deepEqual(pots, [{ montant: 350, eligibles: [0, 1, 2] }, { montant: 400, eligibles: [1, 2] }]);
});

test('des parties entières entre ordinateurs : pas un jeton créé ni perdu', () => {
  for (let g = 0; g < 12; g++) {
    const rng = makeRng(100 + g);
    const styles = Object.keys(P.STYLES);
    const t = P.creerTable({ rng, petite: 5, sieges: [0, 1, 2, 3, 4, 5].map((i) => ({ nom: `J${i}`, jetons: 200 + i * 50, style: styles[(i + g) % styles.length] })) });
    const total = t.joueurs.reduce((s, j) => s + j.jetons, 0);
    for (let m = 0; m < 60 && t.phase !== 'fin-partie'; m++) {
      P.nouvelleMain(t);
      let garde = 0;
      while (t.phase !== 'fin' && t.phase !== 'fin-partie') {
        P.agir(t, P.decider(t));
        assert.ok(++garde < 200, 'la main ne finit pas');
      }
      P.prendre(t);
      const somme = t.joueurs.reduce((s, j) => s + j.jetons, 0);
      assert.equal(somme, total, `partie ${g}, main ${m}`);
      assert.ok(t.joueurs.every((j) => j.jetons >= 0));
    }
  }
});

test('le blackjack : totaux, blackjack payé 3 pour 2, le croupier reste à 17', () => {
  assert.deepEqual(BJ.valeur(c('As 6h')), { total: 17, souple: true });
  assert.deepEqual(BJ.valeur(c('As 6h Xd')), { total: 17, souple: false });
  assert.equal(BJ.valeur(c('As Ah Ad')).total, 13);
  const b = BJ.creerBlackjack({ rng: makeRng(1), solde: 100 });
  // donne truquée (le sabot se tire par la fin) : le joueur reçoit A + R, le croupier 9 + 7
  b.sabot.splice(b.sabot.length - 4, 4, ...c('7c Rh 9d As'));
  BJ.distribuer(b, 10);
  assert.equal(b.phase, 'fin');
  assert.equal(b.mains[0].resultat, 'blackjack');
  assert.equal(b.solde, 100 - 10 + 25);
});

test('le blackjack : mille donnes jouées au hasard, le solde suit les résultats', () => {
  const rng = makeRng(3);
  const b = BJ.creerBlackjack({ rng, solde: 100000 });
  for (let k = 0; k < 1000; k++) {
    const avant = b.solde;
    BJ.distribuer(b, 10);
    if (b.phase === 'assurance') BJ.assurer(b, rng() < 0.5);
    let garde = 0;
    while (b.phase === 'jeu') {
      const a = BJ.actions(b);
      const v = BJ.valeur(b.mains[b.active].cartes).total;
      if (a.separer && rng() < 0.5) BJ.separer(b);
      else if (a.doubler && v >= 9 && v <= 11) BJ.doubler(b);
      else if (v < 17) BJ.carte(b);
      else BJ.rester(b);
      assert.ok(++garde < 50);
    }
    assert.equal(b.phase, 'fin');
    assert.equal(b.solde - avant, b.net);
    if (b.mains.some((m) => m.resultat !== 'brule') && b.croupier.length > 2) assert.ok(BJ.valeur(b.croupier).total >= 17);
    BJ.prendre(b);
  }
});

test('la roulette : la roue, le tapis et les paiements', () => {
  assert.equal(R.ROUE.length, 37);
  assert.equal(new Set(R.ROUE).size, 37);
  assert.equal(R.ROUGES.size, 18);
  const ids = new Set(R.ZONES.map((z) => z.id));
  assert.equal(ids.size, R.ZONES.length);
  const parType = (t) => R.ZONES.filter((z) => z.type === t).length;
  assert.equal(parType('plein'), 37);
  assert.equal(parType('cheval'), 57 + 3);
  assert.equal(parType('carre'), 22 + 1);
  assert.equal(parType('transversale'), 12 + 2);
  assert.equal(parType('sixain'), 11);
  assert.deepEqual(R.regler({ p17: 10 }, 17), { retour: 360, gagnants: ['p17'], perdants: [] });
  assert.equal(R.regler({ rouge: 10, noir: 10 }, 0).retour, 0);
  assert.equal(R.regler({ col2: 10 }, 17).retour, 30);
  assert.equal(R.regler({ 'k16': 10 }, 20).retour, 90);
  // chaque mise est à sa place : les numéros couverts touchent le point de la mise
  for (const z of R.ZONES.filter((x) => x.point)) {
    const cx = z.i + z.w / 2, cy = z.j + z.h / 2;
    for (const n of z.nums.filter((m) => m > 0)) {
      const p = R.PAR_ID[`p${n}`];
      assert.ok(cx >= p.i - 0.01 && cx <= p.i + 1.01 && (cy <= p.j + 1.01 || z.type === 'transversale' || z.type === 'sixain' || z.id === 'k0'), `${z.id} / ${n}`);
    }
  }
  assert.equal(R.annonce(17), '17, noir, impair et manque');
});

test('la caisse : bonus du jour, secours, et deux appareils qui se mettent d’accord', () => {
  const b = K.propre(null);
  assert.equal(b.solde, K.DEPART);
  const t = new Date(2026, 9, 13, 12).getTime();
  assert.equal(K.prendreBonus(b, t), K.BONUS);
  assert.equal(K.prendreBonus(b, t), 0);
  b.solde = 0;
  assert.equal(K.prendreSecours(b, t), K.SECOURS);
  assert.equal(K.prendreBonus(b, t + 86400000), K.BONUS);
  const a = { ...K.propre({ solde: 50, maj: 10, records: { solde: 9000 } }) };
  const z = { ...K.propre({ solde: 700, maj: 20, records: { solde: 800, gain: 300 } }) };
  const f = K.fusionner(a, z);
  assert.equal(f.solde, 700);
  assert.deepEqual(f.records, { solde: 9000, gain: 300 });
});
