/**
 * MAXI MENU — tests des cartes et des règles (boosters, recharge, pack du jour,
 * série, recyclage, albums, boutique).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CARTES, RARETES, ENSEIGNES, ORDRE_ENSEIGNES, ORDRE_RARETES, cartesDe } from '../public/shared/maximenu/cartes.js';
import * as J from '../public/shared/maximenu/jeu.js';
import { makeRng } from '../public/shared/hasard.js';

const H = 3600 * 1000;
const T0 = Date.UTC(2026, 10, 10, 12, 0, 0);

test('les cartes : 8 enseignes de 20 cartes, 10 C / 5 R / 3 É / 1 L / 1 M, ids uniques', () => {
  assert.equal(ORDRE_ENSEIGNES.length, 8);
  assert.equal(new Set(CARTES.map(c => c.id)).size, CARTES.length);
  for (const e of ORDRE_ENSEIGNES) {
    const cs = cartesDe(e);
    assert.equal(cs.length, 20, e);
    const n = r => cs.filter(c => c.rarete === r).length;
    assert.deepEqual(ORDRE_RARETES.map(n), [10, 5, 3, 1, 1], e);
    assert.ok(ENSEIGNES[e].nom);
  }
  for (const c of CARTES) {
    assert.ok(RARETES[c.rarete], c.id);
    assert.ok(c.desc.length > 10, c.id);
    assert.ok(c.crous >= 1 && c.crous <= 5 && c.gour >= 1 && c.gour <= 5, c.id);
  }
});

test('un booster : 5 cartes, la dernière Rare ou mieux ; les taux tiennent sur un grand nombre', () => {
  const etat = J.creerEtat(T0);
  const rng = makeRng(42);
  const compte = Object.fromEntries(ORDRE_RARETES.map(r => [r, 0]));
  for (let i = 0; i < 4000; i++) {
    const cs = J.tirerBooster(etat, rng);
    assert.equal(cs.length, 5);
    assert.ok(RARETES[cs[4].rarete].rang >= 1);
    for (const c of cs.slice(0, 4)) compte[c.rarete]++;
  }
  const total = 4000 * 4;
  assert.ok(Math.abs(compte.commune / total - 0.62) < 0.02, `communes ${compte.commune / total}`);
  assert.ok(compte.mythique > 0, 'des mythiques sortent');
  assert.ok(compte.mythique / total < 0.015);
});

test('la pitié : une Légendaire au plus tard au 40e booster', () => {
  const etat = J.creerEtat(T0);
  const toujoursBas = () => 0; // le hasard le plus avare possible
  let vu = -1;
  for (let i = 1; i <= 40; i++) {
    const cs = J.tirerBooster(etat, toujoursBas);
    if (cs.some(c => RARETES[c.rarete].rang >= 3)) { vu = i; break; }
  }
  assert.equal(vu, 40);
});

test('les boosters gratuits : la réserve se vide puis se recharge toutes les 40 minutes', () => {
  const etat = J.creerEtat(T0);
  const rng = makeRng(1);
  for (let i = 0; i < 10; i++) assert.ok(J.ouvrirGratuit(etat, rng, T0).ok);
  assert.equal(J.ouvrirGratuit(etat, rng, T0).raison, 'stock');
  assert.equal(J.attenteRecharge(etat, T0), J.REGLES.recharge);
  J.recharger(etat, T0 + J.REGLES.recharge * 3 + 1);
  assert.equal(etat.stock, 3);
  J.recharger(etat, T0 + 100 * H);
  assert.equal(etat.stock, J.REGLES.stockMax);
  assert.equal(etat.prochaineRecharge, null);
});

test('le pack du jour : une fois par jour, l’enseigne du jour, une Épique au moins', () => {
  const etat = J.creerEtat(T0);
  const rng = makeRng(3);
  const r = J.ouvrirPackDuJour(etat, rng, T0);
  assert.ok(r.ok);
  assert.ok(r.tirage.every(t => t.carte.enseigne === r.enseigne));
  assert.ok(r.tirage.some(t => RARETES[t.carte.rarete].rang >= 2));
  assert.equal(J.ouvrirPackDuJour(etat, rng, T0 + H).ok, false);
  assert.ok(J.ouvrirPackDuJour(etat, rng, T0 + 24 * H).ok, 'le lendemain, un nouveau pack');
  assert.notEqual(J.enseigneDuJour(J.jourDe(T0)), J.enseigneDuJour(J.jourDe(T0) + 1));
});

test('la série : un booster prestige au 7e jour d’affilée ; un jour manqué remet à 1', () => {
  const etat = J.creerEtat(T0);
  let cadeaux = 0;
  for (let j = 0; j < 7; j++) if (J.noterVisite(etat, T0 + j * 24 * H).cadeau) cadeaux++;
  assert.equal(cadeaux, 1);
  J.noterVisite(etat, T0 + 8 * 24 * H);
  J.noterVisite(etat, T0 + 10 * 24 * H); // un jour sauté
  assert.equal(etat.serie.compte, 1);
});

test('recycler les doublons : on garde un exemplaire, on gagne des frites d’or selon la rareté', () => {
  const etat = J.creerEtat(T0);
  const c = CARTES.find(x => x.rarete === 'epique');
  etat.collection[c.id] = 4;
  const avant = etat.frites;
  assert.deepEqual(J.valeurDoublons(etat), { gain: 3 * RARETES.epique.recyclage, n: 3 });
  const r = J.recycler(etat);
  assert.equal(r.gain, 3 * RARETES.epique.recyclage);
  assert.equal(etat.collection[c.id], 1);
  assert.equal(etat.frites, avant + r.gain);
});

test('un album complet rapporte sa récompense une seule fois', () => {
  const etat = J.creerEtat(T0);
  for (const c of cartesDe('taco')) etat.collection[c.id] = 1;
  assert.ok(J.album(etat, 'taco').complet);
  const avant = etat.frites;
  assert.ok(J.recompenseAlbum(etat, 'taco').ok);
  assert.equal(etat.frites, avant + J.REGLES.albumComplet);
  assert.equal(J.recompenseAlbum(etat, 'taco').ok, false);
});

test('la boutique : il faut assez de frites d’or ; le prestige garantit une Légendaire', () => {
  const etat = J.creerEtat(T0);
  etat.frites = 100;
  assert.equal(J.acheter(etat, makeRng(1), T0, 'classique').raison, 'frites');
  etat.frites = 5000;
  const r = J.acheter(etat, makeRng(9), T0, 'prestige');
  assert.ok(r.ok);
  assert.ok(r.tirage.some(t => RARETES[t.carte.rarete].rang >= 3));
  const e = J.acheter(etat, makeRng(2), T0, 'enseigne', 'domino');
  assert.ok(e.tirage.every(t => t.carte.enseigne === 'domino'));
  assert.equal(etat.frites, 5000 - J.BOUTIQUE.prestige.prix - J.BOUTIQUE.enseigne.prix);
});

test('déterministe : même graine, même tirage', () => {
  const a = J.tirerBooster(J.creerEtat(T0), makeRng(77)).map(c => c.id);
  const b = J.tirerBooster(J.creerEtat(T0), makeRng(77)).map(c => c.id);
  assert.deepEqual(a, b);
});
