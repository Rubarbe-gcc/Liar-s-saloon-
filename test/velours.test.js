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
import * as CPT from '../public/shared/casino/compte.js';
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
  const b = BJ.creerBlackjack({ rng: makeRng(1) });
  BJ.asseoir(b, 0, { nom: 'Moi' });
  BJ.miser(b, 0, 10);
  // donne truquée (le sabot se tire par la fin) : le joueur reçoit A + R, le croupier 9 + 7
  b.sabot.splice(b.sabot.length - 4, 4, ...c('7c Rh 9d As'));
  BJ.distribuer(b);
  assert.equal(b.phase, 'fin');
  const r = BJ.prendre(b).find((e) => e.type === 'resultat');
  assert.deepEqual([r.res, r.retour], ['blackjack', 25]);
});

/** Joue des donnes au hasard ; la caisse de chaque place suit les événements. */
function jouerDonnes(places, donnes, graine) {
  const rng = makeRng(graine);
  const b = BJ.creerBlackjack({ rng, places });
  const caisse = new Array(places).fill(100000);
  for (let s = 0; s < places; s++) BJ.asseoir(b, s, { nom: `J${s}` });
  const appliquer = () => {
    for (const e of BJ.prendre(b)) {
      if (e.type === 'donne') for (const [s, m] of Object.entries(e.mises)) caisse[s] -= m;
      if (e.type === 'double' || e.type === 'separe') caisse[e.s] -= e.ajout;
      if (e.type === 'assurance-prise') caisse[e.s] -= e.montant;
      if (e.type === 'assurance-reglee' || e.type === 'resultat') caisse[e.s] += e.retour;
      if (e.type === 'fin') return e;
    }
    return null;
  };
  for (let k = 0; k < donnes; k++) {
    const avant = [...caisse];
    for (let s = 0; s < places; s++) BJ.miser(b, s, rng() < 0.8 ? 10 + s : 0);
    if (!BJ.distribuer(b)) continue;
    let fin = appliquer();
    let garde = 0;
    while (!fin) {
      if (b.phase === 'assurance') { for (let s = 0; s < places; s++) BJ.assurer(b, s, rng() < 0.5); }
      else {
        const s = b.tour.s;
        const a = BJ.actions(b, s);
        const v = BJ.valeur(b.sieges[s].mains[b.tour.m].cartes).total;
        if (rng() < 0.03) BJ.lever(b, s);
        else if (a.separer && rng() < 0.5) BJ.separer(b, s);
        else if (a.doubler && v >= 9 && v <= 11) BJ.doubler(b, s);
        else if (v < 17) BJ.carte(b, s);
        else BJ.rester(b, s);
      }
      fin = appliquer();
      assert.ok(++garde < 200);
    }
    assert.equal(b.phase, 'fin');
    for (let s = 0; s < places; s++) assert.equal(caisse[s] - avant[s], fin.nets[s] ?? 0, `donne ${k}, place ${s}`);
    for (let s = 0; s < places; s++) if (!b.sieges[s]) BJ.asseoir(b, s, { nom: `J${s}` });
  }
}

test('le blackjack seul : mille donnes, la caisse suit les résultats', () => jouerDonnes(1, 1000, 3));
test('le blackjack à cinq : chacun sa main, la même table, des départs en pleine donne', () => jouerDonnes(5, 500, 9));

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

test('le compte : de 1 à 4 événements par jour, le salaire le 1er, le loyer le 5, l’anniversaire', () => {
  const c = CPT.propre({ rib: 'FR76 TEST', anniv: '03-14' });
  assert.equal(c.solde, CPT.DEPART);
  let j = '2026-03-01';
  for (let d = 0; d < 31; d++) {
    const ops = CPT.jouerJour(c, j);
    const fixes = ['salaire', 'loyer', 'anniv', 'frais', ...CPT.prelevements(c).map((f) => f.k)];
    const hasard = ops.filter((o) => !fixes.includes(o.k));
    assert.ok(hasard.length >= 1 && hasard.length <= 4, `${j} : ${hasard.length} événements`);
    if (j.endsWith('-01')) assert.ok(ops.some((o) => o.k === 'salaire'));
    if (j.endsWith('-05')) assert.ok(ops.some((o) => o.k === 'loyer' && o.m === -CPT.LOYER));
    assert.equal(ops.some((o) => o.k === 'anniv'), j === '2026-03-14');
    j = CPT.lendemain(j);
  }
  assert.equal(c.solde, CPT.DEPART + c.ops.reduce((s, o) => s + o.m, 0));
  // le même compte, le même jour : les mêmes événements (deux appareils sont d'accord)
  const a = CPT.propre({ rib: 'FR76 X' }), b = CPT.propre({ rib: 'FR76 X' });
  assert.deepEqual(CPT.jouerJour(a, '2026-10-13'), CPT.jouerJour(b, '2026-10-13'));
});

test('le compte : les jours manqués sont rattrapés (sept au plus), un compte neuf commence aujourd’hui', () => {
  const c = CPT.propre({ rib: 'FR76 R' });
  assert.deepEqual(CPT.rattraper(c, '2026-10-13').map((x) => x.jour), ['2026-10-13']);
  assert.deepEqual(CPT.rattraper(c, '2026-10-13'), [], 'rien de plus le même jour');
  assert.equal(CPT.rattraper(c, '2026-10-16').length, 3);
  const jours = CPT.rattraper(c, '2026-11-30');
  assert.equal(jours.length, CPT.RATTRAPAGE);
  assert.equal(jours.at(-1).jour, '2026-11-30');
  assert.equal(c.dernier, '2026-11-30');
});

test('le compte : découvert, frais, carte refusée, encaisser', () => {
  const c = CPT.propre({ rib: 'FR76 D', solde: 1000 });
  assert.ok(CPT.payer(c, 30000, 'Jetons'));
  assert.equal(c.solde, -29000);
  assert.ok(!CPT.payer(c, 2000, 'Jetons'), 'au-delà du découvert autorisé, refusé');
  assert.equal(c.solde, -29000);
  const ops = CPT.jouerJour(c, '2026-10-20');
  assert.equal(ops[0].k, 'frais');
  assert.equal(ops[0].m, -CPT.FRAIS_DECOUVERT);
  assert.ok(CPT.encaisser(c, 500, 'Jetons encaissés'));
  // un appareil neuf a ouvert un autre compte : on garde l'ancien
  const neuf = CPT.propre({ rib: 'FR76 NEUF', maj: Date.now() + 1000 });
  assert.equal(CPT.fusionner(c, neuf).rib, 'FR76 D');
  assert.equal(CPT.euros(-123456), '-1 234,56 €'.replace(' ', ' '));
});

test('le compte reste logique : abonnements une fois par mois, pas de doublon dans la journée, chaque imprévu à son rythme', () => {
  let c = CPT.propre({ rib: 'FR76 LOGIQUE' });
  const vus = {}, derniers = {};
  let j = '2026-01-01';
  for (let d = 0; d < 400; d++) {
    const ops = CPT.jouerJour(c, j);
    const ks = ops.map((o) => o.k);
    assert.equal(new Set(ks).size, ks.length, `${j} : deux fois le même événement`);
    for (const o of ops) {
      const cle = `${o.k}|${j.slice(0, 7)}`;
      vus[cle] = (vus[cle] || 0) + 1;
      const e = CPT.EVENEMENTS.find((x) => x.id === o.k);
      if (e && derniers[o.k]) assert.ok((new Date(j) - new Date(derniers[o.k])) / 864e5 >= e.pause, `${o.k} revenu trop vite (${derniers[o.k]} → ${j})`);
      if (e?.mois) assert.ok(e.mois.includes(Number(j.slice(5, 7))), `${o.k} hors saison`);
      derniers[o.k] = j;
    }
    c = CPT.propre(JSON.parse(JSON.stringify(c)));   // comme une sauvegarde rechargée
    j = CPT.lendemain(j);
  }
  for (const k of ['salaire', 'loyer', 'internet', 'electricite', 'assurance', 'mobile', 'streaming', 'musique', 'sport']) {
    for (const [cle, n] of Object.entries(vus)) if (cle.startsWith(`${k}|`)) assert.equal(n, 1, `${cle} : ${n} fois dans le mois`);
  }
  assert.ok(Object.keys(vus).filter((x) => x.startsWith('heritage|')).length <= 1, 'un seul héritage');
  // les jours de la semaine : pas de « pizza du vendredi » un mardi
  for (const o of c.ops) if (/vendredi/.test(o.l)) assert.equal(new Date(`${o.d}T12:00`).getDay(), 5, o.l);
});
