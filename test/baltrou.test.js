/**
 * BALTROU — le moteur : les mains, le score, les Jokers, la boutique.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as C from '../public/shared/baltrou/cartes.js';
import * as J from '../public/shared/baltrou/jokers.js';
import * as P from '../public/shared/baltrou/partie.js';

let n = 0;
const k = (r, s, o = {}) => ({ uid: `t${++n}`, r, s, enh: null, sceau: null, special: null, ...o });

test('les mains de poker sont bien reconnues', () => {
  const cas = [
    [[k(14, 'H'), k(13, 'H'), k(12, 'H'), k(11, 'H'), k(10, 'H')], 'royale'],
    [[k(9, 'S'), k(8, 'S'), k(7, 'S'), k(6, 'S'), k(5, 'S')], 'quinte-flush'],
    [[k(9, 'S'), k(9, 'H'), k(9, 'D'), k(9, 'C'), k(2, 'S')], 'carre'],
    [[k(9, 'S'), k(9, 'H'), k(9, 'D'), k(2, 'C'), k(2, 'S')], 'full'],
    [[k(2, 'D'), k(7, 'D'), k(9, 'D'), k(11, 'D'), k(13, 'D')], 'couleur'],
    [[k(14, 'S'), k(2, 'H'), k(3, 'D'), k(4, 'C'), k(5, 'S')], 'suite'],
    [[k(6, 'S'), k(6, 'H'), k(6, 'D'), k(2, 'C')], 'brelan'],
    [[k(6, 'S'), k(6, 'H'), k(3, 'D'), k(3, 'C'), k(9, 'S')], 'deux-paires'],
    [[k(6, 'S'), k(6, 'H')], 'paire'],
    [[k(6, 'S'), k(10, 'H'), k(2, 'D')], 'haute'],
  ];
  for (const [cartes, attendu] of cas) assert.equal(C.evaluer(cartes).main, attendu, attendu);
  // Une carte haute : seule la plus forte compte.
  assert.equal(C.evaluer([k(6, 'S'), k(10, 'H')]).compte[0].r, 10);
});

test('la WILDCARD devient la meilleure carte ; la Pierre compte toujours', () => {
  const w = k(14, 'H', { special: 'wild' });
  const e = C.evaluer([k(9, 'S'), k(9, 'H'), k(9, 'D'), w]);
  assert.equal(e.main, 'carre');
  assert.ok(e.compte.includes(w));
  const pierre = k(2, 'S', { enh: 'pierre' });
  const f = C.evaluer([k(6, 'S'), k(6, 'H'), pierre]);
  assert.equal(f.main, 'paire', 'la pierre ne change pas la main');
  assert.ok(f.compte.includes(pierre), 'mais elle compte');
  assert.equal(C.chipsCarte(pierre), 50);
});

test('les niveaux de main ajoutent des chips et du Mult', () => {
  assert.deepEqual(C.baseMain('paire', 1), { chips: 10, mult: 2 });
  assert.deepEqual(C.baseMain('paire', 3), { chips: 10 + 2 * 7, mult: 3 });
});

test('une même graine rejoue la même run', () => {
  const a = P.creerPartie({ graine: 'ABC123' });
  const b = P.creerPartie({ graine: 'abc-123' });
  assert.deepEqual(a.main, b.main);
  assert.deepEqual(a.antes.map((x) => x[2].boss), b.antes.map((x) => x[2].boss));
  const c = P.creerPartie({ graine: 'ZZZ999' });
  assert.notDeepEqual(c.main.map((u) => `${c.cartes[u].r}${c.cartes[u].s}`), a.main.map((u) => `${a.cartes[u].r}${a.cartes[u].s}`));
});

test('le paquet : 52 cartes et le Poisson ; l’Épuré sans 2-3-4 ; le Chanceux avec sa WILDCARD', () => {
  assert.equal(P.creerPartie({ deck: 'classique' }).paquet.length, 53);
  const e = P.creerPartie({ deck: 'epure' });
  assert.equal(e.paquet.length, 41);
  assert.ok(e.paquet.every((u) => e.cartes[u].special || e.cartes[u].r >= 5));
  assert.ok(P.aWild(P.creerPartie({ deck: 'chanceux' })));
});

test('jouer une main : le score, les Jokers, et la main qui monte de niveau', () => {
  const p = P.creerPartie({ graine: 'JEU1' });
  P.commencer(p);
  p.jokers.push({ uid: 'j1', id: 'classique', edition: null, e: {} });
  // On fabrique une paire de Rois.
  const rois = p.paquet.filter((u) => p.cartes[u].r === 13 && !p.cartes[u].special).slice(0, 2);
  p.main = [...rois, ...p.main.filter((u) => !rois.includes(u) && !p.cartes[u].special)].slice(0, 8);
  const r = P.jouer(p, rois);
  assert.ok(r.ok);
  assert.equal(r.resultat.main, 'paire');
  assert.equal(r.resultat.points, (10 + 10 + 10) * (2 + 4));
  assert.equal(p.niveaux.paire, 2);
  assert.equal(p.mainsRestantes, 3);
  assert.equal(p.main.length, 8, 'la main se recomplète');
  assert.ok(r.resultat.etapes.some((e) => e.t === 'joker' && e.gain === '+4 Mult'));
});

test('le Poisson Dégueulasse est joué de force, et ne se défausse pas', () => {
  const p = P.creerPartie({ graine: 'POISSON' });
  P.commencer(p);
  const poisson = p.paquet.find((u) => p.cartes[u].special === 'poisson');
  p.main = [poisson, ...p.main.filter((u) => u !== poisson)].slice(0, 8);
  assert.deepEqual(P.forcees(p), [poisson]);
  assert.equal(P.defausser(p, [poisson]).raison, 'poisson');
  // Jamais plus de 5 cartes, Poisson compris.
  assert.equal(P.jouer(p, p.main.filter((u) => u !== poisson).slice(0, 5)).raison, 'trop');
  const autre = p.main.find((u) => u !== poisson);
  const r = P.jouer(p, [autre]);
  assert.ok(r.ok);
  assert.ok(r.resultat.cartes.includes(poisson), 'il part avec la main');
  assert.ok(['x4', 'maudit'].includes(r.resultat.poisson));
});

test('gagner une manche : le butin, puis la boutique, puis la blind suivante', () => {
  const p = P.creerPartie({ graine: 'BUTIN' });
  P.commencer(p);
  p.score = 299;
  P.jouer(p, [p.main.find((x) => !p.cartes[x].special)]);
  assert.equal(p.phase, 'gagne');
  assert.equal(p.gains.recompense, 2);
  assert.equal(p.gains.interet, 2, '10 $ : 2 $ d’intérêts');
  assert.equal(p.argent, 14);
  assert.ok(P.allerBoutique(p).ok);
  assert.equal(p.boutique.items.length, P.PLACES_BOUTIQUE);
  P.quitterBoutique(p);
  assert.equal(p.phase, 'intro');
  assert.equal(P.blindCourante(p).nom, 'Le Scarabée');
});

function enBoutique(graine) {
  const p = P.creerPartie({ graine });
  P.commencer(p);
  p.score = 10000;
  P.jouer(p, [p.main.find((x) => !p.cartes[x].special)]);
  P.allerBoutique(p);
  return p;
}

test('la boutique : acheter, vendre, rafraîchir, les packs et les ateliers', () => {
  const p = enBoutique('BOUTIQUE');
  p.argent = 500;
  p.boutique.gratuits = 0;
  p.boutique.items = [{ type: 'joker', id: 'sage' }, { type: 'objet', id: 'atelier-mult' }, { type: 'objet', id: 'pack-joker' }, { type: 'objet', id: 'main-plus' }];
  assert.ok(P.acheter(p, 0).ok);
  assert.equal(p.jokers[0].id, 'sage');
  assert.equal(p.argent, 492);
  assert.ok(P.acheter(p, 0).ok, 'atelier');
  assert.equal(P.acheter(p, 0).raison, 'phase', 'on choisit d’abord ses cartes');
  const cible = P.ameliorables(p)[0];
  P.choisirCarte(p, cible);
  P.auHasard(p);
  assert.equal(p.cartes[cible].enh, 'mult');
  assert.equal(P.ameliorables(p).filter((u) => p.cartes[u].enh === 'mult').length, 2);
  assert.ok(P.acheter(p, 0).ok, 'pack');
  assert.equal(p.boutique.pack.options.length, 3);
  P.choisirPack(p, 0);
  assert.equal(p.jokers.length, 2);
  assert.ok(P.acheter(p, 0).ok);
  assert.equal(p.bonusMains, 1);
  const argent = p.argent;
  const i = p.jokers.findIndex((j) => j.id === 'sage');
  assert.ok(P.vendre(p, i).ok);
  assert.equal(p.argent, argent + 4, 'le Sage se revend 4 $');
  assert.ok(P.rafraichir(p).ok);
  assert.equal(p.argent, argent + 4 - 2);
});

test('les places de Joker : 5 normales, et les négatifs à part', () => {
  const p = enBoutique('PLACES');
  p.argent = 999;
  for (let i = 0; i < 5; i++) { p.boutique.items = [{ type: 'joker', id: 'classique' }]; assert.ok(P.acheter(p, 0).ok); }
  p.boutique.items = [{ type: 'joker', id: 'classique' }];
  assert.equal(P.acheter(p, 0).raison, 'jokers');
  p.boutique.items = [{ type: 'joker', id: 'spectre' }];
  assert.ok(P.acheter(p, 0).ok, 'un négatif a sa propre place');
  assert.equal(p.negatifs.length, 1);
  assert.equal(p.jokers.length, 5);
});

test('les boss : le Mur, l’Acharné, la Limace, la Sorcière', () => {
  const p = P.creerPartie({ graine: 'BOSS' });
  const boss = (b) => { p.antes[0][0] = { nom: b, sous: '', objectif: 1e9, recompense: 1, boss: b }; P.preparerManche(p); P.commencer(p); };
  boss('mur');
  assert.equal(p.mainsRestantes, 3);
  boss('acharne');
  assert.equal(p.defaussesRestantes, 1);
  p.jokers.push({ uid: 'jj', id: 'classique', edition: null, e: {} });
  boss('limace');
  assert.equal(P.jokersActifs(p).length, 0);
  boss('crane');
  const r = P.jouer(p, [p.main.find((x) => !p.cartes[x].special)]).resultat;
  assert.ok(r.etapes.some((e) => e.t === 'boss'));
});

test('les Jokers qui accumulent gardent leur compte', () => {
  const p = P.creerPartie({ graine: 'CUMUL' });
  P.commencer(p);
  p.jokers.push({ uid: 'jv', id: 'vampire', edition: null, e: {} });
  const jouer1 = () => P.jouer(p, [p.main.find((x) => !p.cartes[x].special)]);
  jouer1(); jouer1();
  assert.equal(p.jokers[0].e.n, 2);
});

test('chaque Joker a un nom, un prix, une rareté, et un effet qui ne plante pas', () => {
  for (const j of J.LISTE_JOKERS) {
    assert.ok(j.nom && j.texte && j.prix > 0 && J.RARETES[j.rarete], j.id);
    const p = P.creerPartie({ graine: `J${j.id}` });
    P.commencer(p);
    p.jokers = [{ uid: 'x', id: j.id, edition: null, e: {} }];
    const r = P.jouer(p, p.main.filter((u) => !p.cartes[u].special).slice(0, 5 - P.forcees(p).length));
    assert.ok(r.ok, j.id);
    assert.ok(Number.isFinite(r.resultat.points) && r.resultat.points >= 0, `${j.id} : ${r.resultat.points}`);
  }
});

test('des runs entières vont jusqu’au bout sans accroc, et tiennent en JSON', () => {
  for (let s = 0; s < 25; s++) {
    const p = P.creerPartie({ graine: `RUN${s}`, deck: ['classique', 'epure', 'chanceux'][s % 3], mode: s % 2 ? 'infini' : 'classique' });
    let garde = 0;
    while (!['victoire', 'defaite'].includes(p.phase) && garde++ < 600) {
      if (p.phase === 'intro') P.commencer(p);
      else if (p.phase === 'jeu') {
        if (garde % 3 === 0 && p.ante < 6) p.score = P.blindCourante(p).objectif - 1;
        assert.ok(P.jouer(p, p.main.filter((u) => !p.cartes[u].special).slice(0, 4)).ok);
      } else if (p.phase === 'gagne') {
        P.allerBoutique(p);
        p.argent += 50;
        for (let i = 0; i < 3; i++) if (p.boutique.items.length) P.acheter(p, 0);
        if (p.boutique.voucher) P.prendreVoucher(p);
        P.quitterBoutique(p);
      }
    }
    assert.ok(['victoire', 'defaite'].includes(p.phase), `run ${s} : ${p.phase}`);
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  }
});

test('l’Élixir fait monter la main la moins développée', () => {
  const p = P.creerPartie({ graine: 'ELIXIR' });
  p.consommables.push({ uid: 'o1', id: 'elixir' });
  Object.keys(p.niveaux).forEach((m) => { p.niveaux[m] = 3; });
  p.niveaux.brelan = 1;
  const r = P.utiliserConsommable(p, 0);
  assert.equal(r.main, 'brelan');
  assert.equal(p.niveaux.brelan, 2);
  assert.equal(p.consommables.length, 0);
});

test('le mode Infini continue après l’ante 4, toujours plus dur', () => {
  const p = P.creerPartie({ mode: 'infini', graine: 'INF' });
  p.ante = 4;
  const b5 = P.blindCourante(p);
  p.ante = 6;
  assert.ok(P.blindCourante(p).objectif > b5.objectif);
  assert.ok(b5.objectif > 25000, 'plus dur que l’ante 4');
});
