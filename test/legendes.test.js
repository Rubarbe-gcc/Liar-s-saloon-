/**
 * LÉGENDES — le gacha et son calendrier : les personnages, les portails selon la date (rotation, fêtes),
 * les taux, les garanties (multi, bannière, paliers, pitié), les doublons, les jetons du jour et des fêtes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PERSOS, PERSO, ELEMENTS, FAMILLES, RARETES, STYLES_SUPER, avantage, stats } from '../public/shared/legendes/persos.js';
import { LANCEMENT, ROTATION, NB_SORTIES, MAJ_PERMANENT, MAX_RETOUR, portails, fetesDu, permanents, rotationDu } from '../public/shared/legendes/calendrier.js';
import { nouvelEtat, invoquer, connexion, cadeauFete, PALIERS, PITIE, TAUX } from '../public/shared/legendes/gacha.js';

const jour = (a, m, j) => Date.UTC(a, m - 1, j) / 86400000;

test('les personnages : complets, des éléments, des familles et des styles connus', () => {
  assert.equal(new Set(PERSOS.map((x) => x.id)).size, PERSOS.length);
  for (const x of PERSOS) {
    assert.ok(ELEMENTS[x.element] && RARETES[x.rarete], x.id);
    assert.ok(x.familles.length && x.familles.every((f) => FAMILLES[f]), x.id);
    assert.ok(STYLES_SUPER.includes(x.super.style) && x.super.mult > 1, x.id);
    assert.ok(x.couleurs.peau && x.couleurs.aura && x.coiffure);
  }
  assert.equal(avantage('flamme', 'tempete'), 1.5);
  assert.equal(avantage('tempete', 'flamme'), 0.75);
  assert.equal(avantage('flamme', 'roc'), 1);
  assert.ok(stats('kael_lr', 5).atq > stats('kael_lr').atq);
});

test('le calendrier : un nouveau portail toutes les deux semaines, garanti puis à paliers ; le permanent mis à jour tous les trois mois', () => {
  const p0 = portails(LANCEMENT);
  const rot0 = p0.find((p) => p.id.startsWith('rotation'));
  assert.equal(rot0.type, 'garanti');
  assert.deepEqual(rot0.nouveaux.sort(), ['kael_lr_ssr', 'noa_ssr'], 'un LR sort en SSR');
  assert.ok(!p0[0].pool.includes('kael_lr_ssr'), 'pas encore dans le permanent');
  const rot1 = portails(LANCEMENT + ROTATION).find((p) => p.id.startsWith('rotation'));
  assert.equal(rot1.type, 'paliers');
  assert.ok(rot1.nouveaux.includes('vash_lr_ssr'));
  assert.ok(!permanents(LANCEMENT + ROTATION).some((x) => x.id === 'kael_lr_ssr'), 'pas avant la mise à jour du permanent');
  assert.ok(permanents(LANCEMENT + MAJ_PERMANENT).some((x) => x.id === 'kael_lr_ssr'), 'kael rejoint le permanent à la mise à jour');
  assert.equal(rotationDu(LANCEMENT + ROTATION - 1).k, 0);
  // Après la dernière sortie, les portails reviennent (sans nouveau personnage).
  const tard = portails(LANCEMENT + ROTATION * (NB_SORTIES + 1)).find((p) => p.id.startsWith('rotation'));
  assert.ok(tard.reprise && tard.nouveaux.length === 0 && tard.vedettes.length > 0);
});

test('les célébrations : anniversaire, Halloween, Noël, Nouvel An (à cheval sur deux années)', () => {
  assert.deepEqual(fetesDu(jour(2026, 11, 5)).map((f) => f.id), ['lancement'], 'pas d’anniversaire la première année');
  assert.deepEqual(fetesDu(jour(2027, 11, 5)).map((f) => f.id), ['anniversaire']);
  assert.deepEqual(fetesDu(jour(2027, 10, 31)).map((f) => f.id), ['halloween']);
  assert.deepEqual(fetesDu(jour(2027, 12, 24)).map((f) => f.id), ['noel']);
  assert.deepEqual(fetesDu(jour(2028, 1, 3)).map((f) => f.id), ['nouvelan']);
  assert.deepEqual(fetesDu(jour(2027, 3, 3)), []);
  const noel = portails(jour(2027, 12, 20)).find((p) => p.fete === 'noel');
  assert.equal(noel.type, 'paliers');
  assert.deepEqual(noel.nouveaux, ['givre_ssr']);
  // Un personnage de fête ne se tire jamais ailleurs.
  for (const p of portails(jour(2026, 12, 1))) assert.ok(!p.pool.includes('givre_ssr'), 'pas avant sa fête');
  assert.ok(portails(jour(2027, 3, 3))[0].pool.includes('givre_ssr'), 'au permanent après la mise à jour qui suit sa fête');
});

test('les taux : à peu près ceux annoncés, sur beaucoup de tirages', () => {
  const e = nouvelEtat(7);
  e.jetons = 1e9;
  const portail = portails(jour(2027, 3, 3))[0];
  const n = { R: 0, SR: 0, SSR: 0, LR: 0 };
  for (let k = 0; k < 4000; k++) for (const r of invoquer(e, portail, 1).resultats) n[r.rarete] += 1;
  assert.ok(Math.abs(n.LR / 4000 - TAUX.LR) < 0.008, `LR ${n.LR}`);
  assert.ok(Math.abs(n.SSR / 4000 - TAUX.SSR) < 0.015, `SSR ${n.SSR}`);
  assert.ok(Math.abs(n.SR / 4000 - TAUX.SR) < 0.03, `SR ${n.SR}`);
});

test('un multi garantit un SSR ; le portail garanti, une vedette toutes les trois multi', () => {
  const e = nouvelEtat(3);
  e.jetons = 1e6;
  const garanti = portails(LANCEMENT).find((p) => p.type === 'garanti');
  for (let k = 0; k < 40; k++) {
    const r = invoquer(e, garanti, 10);
    assert.equal(r.resultats.length, 10);
    assert.ok(r.resultats.some((x) => x.rarete === 'SSR' || x.rarete === 'LR'));
    if ((k + 1) % 3 === 0) assert.ok(r.resultats.some((x) => x.vedette), 'une vedette à chaque 3e multi');
  }
});

test('les paliers : les prix, deux SSR au 3e, le nouveau personnage au 5e', () => {
  const e = nouvelEtat(11);
  e.jetons = 25 + 40 + 50 + 50 + 50;
  const p = portails(LANCEMENT + ROTATION).find((x) => x.type === 'paliers');
  const res = [];
  for (let k = 0; k < 5; k++) res.push(invoquer(e, p, 10));
  assert.deepEqual(res.map((r) => r.prix), PALIERS.map((x) => x.prix));
  // Il ne reste que les jetons rendus par les doublons déjà éveillés au maximum.
  assert.equal(e.jetons, res.flatMap((r) => r.resultats).reduce((t, x) => t + (x.rendu || 0), 0));
  e.jetons = 0;
  assert.ok(res[2].resultats.filter((x) => ['SSR', 'LR'].includes(x.rarete)).length >= 2);
  assert.ok(res[4].resultats.some((x) => p.nouveaux.includes(x.id)), 'le nouveau au 5e palier');
  assert.equal(invoquer(e, p, 10).ok, false, 'plus de jetons');
});

test('la pitié : une vedette au plus tard au 100e tirage', () => {
  const e = nouvelEtat(5);
  e.jetons = 1e6;
  const p = portails(LANCEMENT + ROTATION).find((x) => x.type === 'paliers');
  let sans = 0, max = 0;
  for (let k = 0; k < 3000; k++) {
    const r = invoquer(e, p, 1).resultats[0];
    sans = r.vedette ? 0 : sans + 1;
    max = Math.max(max, sans);
  }
  assert.ok(max < PITIE, `${max} tirages sans vedette`);
});

test('les doublons éveillent le personnage, puis rendent des jetons ; la connexion et les cadeaux de fête', () => {
  const e = nouvelEtat(9);
  e.jetons = 1e6;
  const p = portails(jour(2027, 3, 3))[0];
  for (let k = 0; k < 200; k++) invoquer(e, p, 10);
  const r = Object.entries(e.collection).find(([id]) => PERSO[id].rarete === 'R');
  assert.equal(r[1].eveil, RARETES.R.eveilMax);
  const f = nouvelEtat(1);
  const j = jour(2027, 3, 3);
  assert.ok(connexion(f, j) > 0);
  assert.equal(connexion(f, j), 0, 'une fois par jour');
  assert.ok(connexion(f, j + 1) > connexion(nouvelEtat(1), j));
  const fete = fetesDu(jour(2026, 11, 6))[0];
  assert.equal(cadeauFete(f, fete), 500);
  assert.equal(cadeauFete(f, fete), 0);
});

import { creerCombat, jouerTour, meilleureCouleur, rotation, kiPour, cheminValide, KI_SUPER } from '../public/shared/legendes/combat.js';
import { CHAPITRES } from '../public/shared/legendes/niveaux.js';

const equipe = (ids) => ids.map((id) => ({ id, eveil: 0 }));
const jouer = (ids, ennemis, graine) => {
  const c = creerCombat({ equipe: equipe(ids), ennemis, graine });
  while (!c.fin && c.tour < 80) jouerTour(c, meilleureCouleur(c));
  return c;
};

test('le combat : déterministe, la rotation de trois, le ki de son élément compte triple, la super à 12', () => {
  const ids = ['kael_ssr', 'ryo_ssr', 'mira_ssr', 'hiro_ssr', 'sel_ssr', 'ivo_ssr'];
  const a = jouer(ids, CHAPITRES[1].etapes[4].ennemis, 4), b = jouer(ids, CHAPITRES[1].etapes[4].ennemis, 4);
  assert.deepEqual(a.journal, b.journal);
  assert.equal(a.pv, b.pv);
  const c = creerCombat({ equipe: equipe(ids), ennemis: CHAPITRES[0].etapes[0].ennemis, graine: 1 });
  assert.deepEqual(rotation(c), [0, 1, 2]);
  // Un chemin de cinq sphères de flamme : Kael (flamme) prend 2 ki par sphère, Ryo (marée) 1.
  c.spheres = new Array(25).fill('roc');
  for (const p of [0, 1, 2, 3, 4]) c.spheres[p] = 'flamme';
  const g = kiPour(c, [0, 1, 2, 3, 4]), h = kiPour(c, [0]);
  assert.equal(g[0] - h[0], 8, 'Kael : 2 ki par sphère de son élément');
  assert.equal(g[1] - h[1], 4, 'Ryo : 1 ki par sphère');
  assert.equal(cheminValide([0, 1, 2]), true);
  assert.equal(cheminValide([0, 2]), false, 'pas voisines');
  assert.equal(cheminValide([0, 1, 0]), false, 'sans repasser');
  const evs = jouerTour(c, [0, 1, 2, 3, 4]);
  assert.equal(evs.find((e) => e.qui === 0 && !e.add).type, g[0] >= KI_SUPER ? 'super' : 'attaque');
  assert.deepEqual(rotation(c), [3, 4, 5]);
});

test('la progression : des R passent le début, des SSR l’essentiel, l’Éclipse demande des LR', () => {
  const R = ['kael_r', 'mira_r', 'bram_r', 'lio_r', 'nami_r', 'tobi_r'];
  const SSR = ['kael_ssr', 'ryo_ssr', 'mira_ssr', 'hiro_ssr', 'sel_ssr', 'ivo_ssr'];
  assert.equal(jouer(R, CHAPITRES[0].etapes[0].ennemis, 1).fin, 'victoire');
  assert.equal(jouer(R, CHAPITRES[2].etapes[0].ennemis, 1).fin, 'defaite');
  for (const k of [0, 1, 2, 3, 4]) assert.equal(jouer(SSR, CHAPITRES[1].etapes[k].ennemis, 2).fin, 'victoire', `ch2 étape ${k + 1}`);
});

import { CATEGORIES, LIENS } from '../public/shared/legendes/persos.js';
import { ennemisEn, DIFFICULTES, DEFIS, ULTIME, etage } from '../public/shared/legendes/niveaux.js';

test('les passifs : plus longs avec la rareté, des catégories, des liens, un chef, une super (ultime pour un LR)', () => {
  const lignes = (r) => Math.max(...PERSOS.filter((x) => x.rarete === r).map((x) => x.passif.lignes.length));
  assert.ok(lignes('R') <= 2 && lignes('SR') <= 4 && lignes('LR') >= 6, `${lignes('R')} ${lignes('SR')} ${lignes('LR')}`);
  for (const x of PERSOS) {
    assert.ok(x.categories.length >= 2 && x.categories.every((k) => CATEGORIES[k]), x.id);
    assert.ok(x.liens.length >= 2 && x.liens.every((l) => LIENS[l]), x.id);
    assert.ok(x.chef.cats.every((k) => CATEGORIES[k]) && x.chef.taux > 0);
    assert.equal(!!x.super.ultime, x.rarete === 'LR', x.id);
  }
});

test('les boss : une super attaque, une transformation sous un seuil de PV ; l’end game est bien plus dur', () => {
  const equipeLR = ['ryo_lr', 'vash_lr', 'hiro_lr', 'ryo_ssr', 'ivo_ssr', 'goran_ssr'];
  const c = creerCombat({ equipe: equipe(equipeLR), ennemis: ULTIME.ennemis, graine: 3, ami: 'ryo_lr' });
  const evs = [];
  while (!c.fin && c.tour < 60) evs.push(...jouerTour(c, meilleureCouleur(c)));
  assert.ok(evs.some((e) => e.type === 'superEnnemi'), 'le boss lance sa super');
  assert.ok(evs.some((e) => e.type === 'transformation'), 'le boss se transforme');
  assert.ok(c.tour >= 5, `un long combat (${c.tour} tours)`);
  const SSR = ['kael_ssr', 'ryo_ssr', 'mira_ssr', 'hiro_ssr', 'sel_ssr', 'ivo_ssr'];
  assert.equal(jouer(SSR, ULTIME.ennemis, 1).fin, 'defaite', 'des SSR ne passent pas le combat ultime');
  assert.ok(ennemisEn(CHAPITRES[0].etapes[0].ennemis, DIFFICULTES[2])[0].pv > CHAPITRES[0].etapes[0].ennemis[0].pv * 5);
  assert.ok(DEFIS.every((d) => CATEGORIES[d.categorie]));
  assert.ok(etage(20).ennemis[0].pv > etage(1).ennemis[0].pv * 50 && etage(10).ennemis[0].boss);
});

import { EVEILS, CHAINES, peutEveiller, eveiller, ajouterMedailles, nouveauJoueur, endurance, depenser, gagnerExp, actMax, RECHARGE } from '../public/shared/legendes/eveils.js';
import { butin } from '../public/shared/legendes/niveaux.js';
import { recupererCadeaux } from '../public/shared/legendes/gacha.js';

test('les éveils : Kael R → SR → SSR → UR → LR avec des médailles ; un UR ne se tire jamais', () => {
  const kael = CHAINES.find((c) => c[0] === 'kael_r');
  assert.deepEqual(kael, ['kael_r', 'kael_sr', 'kael_ssr', 'kael_ssr_ur']);
  assert.deepEqual(CHAINES.find((c) => c.includes('kael_lr')), ['kael_lr_ssr', 'kael_lr_ssr_ur', 'kael_lr'], 'un LR a sa propre lignée, qui commence en SSR');
  assert.equal(PERSO.kael_ssr_ur.rarete, 'UR');
  assert.ok(PERSO.kael_ssr_ur.passif.lignes.length > PERSO.kael_ssr.passif.lignes.length);
  for (const p of portails(LANCEMENT)) assert.ok(p.pool.every((id) => !PERSO[id].dokkan && PERSO[id].rarete !== 'N'));
  const e = nouvelEtat(1);
  e.collection.kael_ssr = { eveil: 3, n: 1 };
  assert.equal(peutEveiller(e, 'kael_ssr'), false);
  ajouterMedailles(e, { m_kael: 35, legende: 2 });
  assert.equal(eveiller(e, 'kael_ssr'), 'kael_ssr_ur');
  assert.ok(!e.collection.kael_ssr && e.collection.kael_ssr_ur);
  assert.equal(e.medailles.m_kael, 0);
  assert.ok(EVEILS.length > 10);
});

test('le rang, l’endurance qui remonte avec le temps, le butin, la boîte à cadeaux', () => {
  const j = nouveauJoueur(0);
  assert.equal(endurance(j, 0), actMax(1));
  assert.ok(depenser(j, 10, 0));
  assert.equal(endurance(j, RECHARGE * 3), actMax(1) - 7);
  assert.equal(depenser(j, 999, RECHARGE * 3), false);
  assert.ok(gagnerExp(j, 500) >= 1 && j.act === actMax(j.rang));
  let k = 0;
  const R = () => ((k = (k * 9301 + 49297) % 233280) / 233280);
  const b = butin(CHAPITRES[0].etapes[4].ennemis, 1, R);
  assert.ok(b.orbes.roc > 0 && b.orbes.arc > 0 && b.exp > 50);
  const e = nouvelEtat(2);
  connexion(e, 100, { boite: true });
  assert.equal(e.jetons, 300, 'pas encore récupéré');
  const t = recupererCadeaux(e);
  assert.ok(t.jetons > 0 && e.jetons === 300 + t.jetons && e.boite.length === 0);
});

import { evenementDu } from '../public/shared/legendes/niveaux.js';

test('les grandes fêtes : un mois, trois parties (chacune son nouveau LR) ; un événement court tous les deux jours', () => {
  const nouveaux = [5, 15, 25].map((d) => portails(jour(2027, 11, d)).find((p) => p.fete === 'anniversaire'));
  assert.deepEqual(nouveaux.map((p) => p.partie), [1, 2, 3]);
  assert.deepEqual(nouveaux.map((p) => p.nouveaux), [['kael_anniv_ssr'], ['jumelles_lr_ssr'], ['neant_duo_lr_ssr']]);
  assert.ok(nouveaux[2].pool.includes('kael_anniv_ssr') && nouveaux[2].type === 'garanti', 'le final reprend toute la fête');
  assert.equal(portails(jour(2027, 7, 25)).find((p) => p.fete === 'ete').nouveaux[0], 'drax_ete_lr_ssr');
  const ids = [];
  for (let d = 0; d < 21; d++) ids.push(evenementDu(LANCEMENT + d).n);
  const durees = Object.values(ids.reduce((t, n) => ({ ...t, [n]: (t[n] || 0) + 1 }), {}));
  assert.ok(durees.slice(0, -1).every((n) => n === 2), JSON.stringify(durees));
  assert.equal(ROTATION, 14);
});

import { arbre, bonusPotentiel, peutDebloquer, debloquer, ajouterOrbes, gagnerExpPerso, NIV_MAX } from '../public/shared/legendes/potentiel.js';
import { EVENEMENTS_EVEIL, medaillesEveil } from '../public/shared/legendes/niveaux.js';
import { cheminAuto } from '../public/shared/legendes/combat.js';

test('l’arbre de potentiel : des routes selon la rareté, débloquées dans l’ordre avec des orbes ; les niveaux', () => {
  assert.equal(arbre('kael_lr').length, 3);
  assert.equal(arbre('kael_ssr').length, 2);
  assert.equal(arbre('kael_sr').length, 1);
  const e = nouvelEtat(1);
  e.collection.kael_lr = { eveil: 0, n: 1 };
  const [r1] = arbre('kael_lr');
  assert.equal(peutDebloquer(e, 'kael_lr', r1[1].id), false, 'dans l’ordre');
  ajouterOrbes(e, { flamme: 200, arc: 50 });
  for (const n of r1) assert.ok(debloquer(e, 'kael_lr', n.id), n.id);
  const b = bonusPotentiel('kael_lr', e.collection.kael_lr.pot);
  assert.ok(b.atq > 0 && b.pv > 0 && b.critique > 0);
  assert.ok(stats('kael_lr', 0, 1).atq < stats('kael_lr', 0, NIV_MAX.LR).atq * 0.6);
  const entree = { niv: 1, xp: 0 };
  assert.ok(gagnerExpPerso(entree, 'kael_lr', 5000) > 3);
});

test('les événements d’éveil : on bat le personnage pour ses médailles ; la liaison automatique des sphères', () => {
  const ev = EVENEMENTS_EVEIL.find((x) => x.chaine.includes('kael_ssr'));
  assert.equal(ev.niveaux.length, 3);
  const m = medaillesEveil(ev, 2, () => 0.5);
  assert.ok(m.m_kael >= 8);
  const c = creerCombat({ equipe: equipe(['kael_ssr', 'ryo_ssr', 'mira_ssr']), ennemis: CHAPITRES[0].etapes[0].ennemis, graine: 1 });
  for (let p = 0; p < 25; p++) {
    const ch = cheminAuto(c, p);
    assert.ok(cheminValide(ch), `chemin depuis ${p}`);
    assert.equal(Math.floor(ch[ch.length - 1] / 5) >= Math.floor(p / 5), true);
  }
  assert.equal(Math.floor(cheminAuto(c, 2).slice(-1)[0] / 5), 4, 'il descend jusqu’à la dernière rangée');
});

test('le portail du retour : d’anciens personnages reviennent, pour 50 invocations au plus', () => {
  const p = portails(LANCEMENT + ROTATION * 3).find((x) => x.retour);
  assert.ok(p && p.vedettes.length >= 2 && p.max === MAX_RETOUR);
  assert.ok(p.vedettes.every((id) => PERSO[id].sortie === undefined || PERSO[id].sortie < 3), 'des personnages déjà sortis');
  const e = nouvelEtat(4);
  e.jetons = 1e5;
  for (let k = 0; k < 5; k++) assert.ok(invoquer(e, p, 10).ok);
  const r = invoquer(e, p, 1);
  assert.equal(r.ok, false);
  assert.equal(r.limite, true);
});
