/**
 * DOUBLE PAS — le moteur du basket à trois : le déterminisme, un match qui va
 * au bout (panier en or compris), les points (2 et 3), l'ordinateur qui marque,
 * les commandes de l'humain, et l'équilibre des seize clubs (long : on peut
 * le sauter avec --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, chronoTexte, reglerEntrainement, T, PANIER_X, ANNEAU_Z, CHARGE_IDEALE } from '../public/shared/basket/match.js';
import { estTrois, TROIS_R, TROIS_COIN } from '../public/shared/basket/terrain.js';
import { EQUIPES, EQUIPE, STYLES, notesEquipe } from '../public/shared/basket/equipes.js';
import { ecussonSVG } from '../public/games/plein-stade/commun/ecusson.js';
import { creerSession, FENETRE } from '../public/shared/rollback.js';
import { calendrier as calendrierChamp, creerChampionnat, matchDuJoueur as matchChamp, enregistrer as enregistrerChamp, aJouer as aJouerChamp, jouerSansMoi as jouerSansMoiChamp, avancer as avancerChamp, classement as classementChamp, simulerLeReste as simulerLeResteChamp } from '../public/shared/basket/championnat.js';
import * as serveur from '../server/basket.js';
import { delaiSelonPing, REGLAGES } from '../public/games/plein-stade/basket/js/enligne.js';
import { creerTournoi, matchDuJoueur, salleDuTour, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../public/shared/basket/tournoi.js';

/** Un petit hasard reproductible (pour les touches des faux joueurs). */
function rng(graine) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s = (s ^ (s >>> 13)) >>> 0; return s / 4294967296; };
}
/** Un joueur qui appuie comme un humain : il tient ses touches quelques images, puis change. */
function joueurHumain(graine) {
  const R = rng(graine);
  let m = 0, reste = 0;
  return () => {
    if (reste-- <= 0) {
      reste = 4 + Math.floor(R() * 20);
      m = 0;
      if (R() < 0.8) m |= [T.g, T.d, T.h, T.b, T.g | T.h, T.d | T.b][Math.floor(R() * 6)];
      if (R() < 0.3) m |= T.S;
      if (R() < 0.3) m |= [T.A, T.B, T.X, T.G, T.R][Math.floor(R() * 5)];
    }
    return m;
  };
}

test('les seize clubs : inventés, complets, des styles connus', () => {
  assert.equal(EQUIPES.length, 16);
  const ids = new Set(), abrs = new Set();
  for (const eq of EQUIPES) {
    ids.add(eq.id); abrs.add(eq.abr);
    assert.ok(STYLES[eq.style], `${eq.nom} : style ${eq.style}`);
    assert.equal(eq.joueurs.length, 3);
    assert.ok(eq.devise && eq.ville && eq.maillot && eq.exterieur && eq.ecusson);
    for (const j of eq.joueurs) for (const k of ['vitesse', 'tir', 'passe', 'defense', 'saut']) assert.ok(j.notes[k] >= 30 && j.notes[k] <= 99, `${j.nom} ${k}`);
    assert.ok(ecussonSVG(eq, 48).startsWith('<svg'));
    assert.ok(notesEquipe(eq).tir > 0);
  }
  assert.equal(ids.size, 16);
  assert.equal(abrs.size, 16);
});

test('la ligne à 3 points : l’arc et les coins', () => {
  assert.equal(estTrois(PANIER_X - TROIS_R - 0.1, 0, PANIER_X), true);
  assert.equal(estTrois(PANIER_X - TROIS_R + 0.1, 0, PANIER_X), false);
  assert.equal(estTrois(PANIER_X - 1, TROIS_COIN + 0.05, PANIER_X), true);
  assert.equal(estTrois(PANIER_X - 1, TROIS_COIN - 0.3, PANIER_X), false);
  assert.equal(estTrois(-PANIER_X + 2, 0, -PANIER_X), false);
});

test('déterministe : même graine, mêmes touches → même match', () => {
  const jouer = () => {
    const m = creerMatch({ equipes: ['valrose', 'montbrume'], graine: 1234, minutes: 1, controles: ['humain', 'ia'] });
    const h = joueurHumain(99);
    const traces = [];
    for (let i = 0; i < 5000; i++) { pas(m, [h(), 0]); if (i % 250 === 0) traces.push(empreinte(m)); }
    return { traces, score: [...m.score], f: m.f };
  };
  assert.deepEqual(jouer(), jouer());
  const a = simuler({ equipes: ['fort-granit', 'mielville'], graine: 77, minutes: 1 });
  const b = simuler({ equipes: ['fort-granit', 'mielville'], graine: 77, minutes: 1 });
  assert.equal(empreinte(a), empreinte(b));
  assert.deepEqual(a.score, b.score);
  const c = simuler({ equipes: ['fort-granit', 'mielville'], graine: 78, minutes: 1 });
  assert.notEqual(empreinte(a), empreinte(c));
});

test('un match va au bout, sans planter, avec un vainqueur', () => {
  for (let g = 1; g <= 6; g++) {
    const m = simuler({ equipes: [EQUIPES[g].id, EQUIPES[15 - g].id], graine: g * 13, minutes: 2 });
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    assert.notEqual(m.score[0], m.score[1]);
    for (const p of m.joueurs) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  }
  // Avec un humain qui appuie au hasard, aussi.
  const m = creerMatch({ equipes: ['saint-aurel', 'lumen'], graine: 5, minutes: 1, controles: ['humain', 'ia'] });
  const h = joueurHumain(3);
  for (let i = 0; i < 60000 && m.phase !== 'fin'; i++) pas(m, [h(), 0]);
  assert.equal(m.phase, 'fin');
});

test('le panier en or : à égalité, le premier qui marque gagne', () => {
  const m = creerMatch({ equipes: ['ventenac', 'haute-plaine'], graine: 9, minutes: 1, controles: ['ia', 'ia'] });
  // On saute à la fin de la deuxième période, à égalité.
  while (m.phase !== 'pause') pas(m);
  while (m.periode === 1) pas(m);
  m.score = [10, 10];
  m.chrono = m.duree - 1;
  const evs = [];
  while (m.phase !== 'fin' && m.f < 200000) evs.push(...pas(m));
  assert.ok(evs.some((e) => e.type === 'enor'));
  assert.equal(m.phase, 'fin');
  const dernier = m.paniers[m.paniers.length - 1];
  assert.equal(dernier.enOr, true);
  assert.equal(m.vainqueur, dernier.e);
  assert.equal(m.paniers.filter((p) => p.enOr).length, 1);
});

test('les points comptent juste : 2, 3, et la bonne équipe', () => {
  // Un ballon qui tombe dans l'arceau que l'équipe 0 attaque, sur un tir à 3 points.
  const m = creerMatch({ equipes: ['valrose', 'lumen'], graine: 3, minutes: 1, controles: ['ia', 'ia'] });
  m.phase = 'jeu';
  const b = m.ballon;
  const lacher = (e, pts) => Object.assign(b, { x: m.equipes[e].sens * PANIER_X, y: 0, z: ANNEAU_Z + 0.4, vx: 0, vy: 0, vz: -1, porteur: -1, entre: false, marque: false, tir: { e, j: e * 3, pts, passeur: -1, dunk: false, d: 7 }, rebond: { e } });
  lacher(0, 3);
  for (let i = 0; i < 30 && m.phase === 'jeu'; i++) pas(m);
  assert.deepEqual(m.score, [3, 0]);
  assert.equal(m.phase, 'panier');
  // La remise en jeu : l'équipe qui a encaissé, depuis sa ligne de fond.
  while (m.phase === 'panier') pas(m);
  assert.equal(m.joueurs[b.porteur].e, 1);
  assert.ok(Math.abs(m.joueurs[b.porteur].x) > 13.5);
  assert.equal(Math.sign(m.joueurs[b.porteur].x), m.equipes[0].sens);
  m.phase = 'jeu';
  lacher(1, 2);
  for (let i = 0; i < 30 && m.phase === 'jeu'; i++) pas(m);
  assert.deepEqual(m.score, [3, 2]);
  // Dans des matchs entiers : le score est la somme des paniers, chacun vaut 2 ou 3.
  for (let g = 1; g <= 5; g++) {
    const s = simuler({ equipes: [EQUIPES[g].id, EQUIPES[g + 5].id], graine: g * 41, minutes: 1 });
    for (const e of [0, 1]) {
      const mes = s.paniers.filter((p) => p.e === e);
      assert.ok(mes.every((p) => p.pts === 2 || p.pts === 3));
      assert.equal(mes.reduce((t, p) => t + p.pts, 0), s.score[e]);
      assert.ok(s.stats.troisReussis[e] <= mes.filter((p) => p.pts === 3).length);
      assert.ok(s.stats.reussis[e] <= s.stats.tirs[e]);
    }
  }
});

test('la remise en jeu : l’équipe qui a marqué reste dans sa moitié', () => {
  const m = creerMatch({ equipes: ['montbrume', 'lumen'], graine: 12, minutes: 1, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  // L'équipe 0 (humaine) marque.
  Object.assign(m.ballon, { x: m.equipes[0].sens * PANIER_X, y: 0, z: ANNEAU_Z + 0.4, vx: 0, vy: 0, vz: -1, porteur: -1, entre: false, marque: false, tir: { e: 0, j: 0, pts: 2, passeur: -1, dunk: false, d: 3 }, rebond: { e: 0 } });
  while (m.phase !== 'panier') pas(m);
  while (m.phase === 'panier') pas(m);
  const s1 = m.equipes[1].sens;
  // Tous les joueurs de l'équipe 0 commencent dans leur moitié (celle qu'ils défendent).
  assert.ok(m.joueurs.slice(0, 3).every((p) => p.x * s1 > 0));
  // L'humain fonce vers le porteur, en sprintant, et change de joueur : personne ne passe la ligne médiane.
  const vers = s1 > 0 ? T.g : T.d;
  for (let i = 0; i < 200 && m.ballon.remise >= 0; i++) {
    pas(m, [vers | T.S | (i % 30 === 0 ? T.G : 0), 0]);
    for (const p of m.joueurs.slice(0, 3)) assert.ok(p.x * s1 >= 0.39, `image ${i} : ${p.x.toFixed(2)}`);
  }
});

test('le tir de l’humain : on saute en appuyant, on lâche en haut du saut', () => {
  const m = creerMatch({ equipes: ['valrose', 'lumen'], graine: 21, minutes: 1, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  const p = m.joueurs[0];
  // Seul à 5 m du panier, le ballon en main.
  Object.assign(p, { x: m.equipes[0].sens * (PANIER_X - 5), y: 0 });
  for (const o of m.joueurs.slice(3)) { o.x = -m.equipes[0].sens * 10; }
  Object.assign(m.ballon, { porteur: 0, entre: false, remise: -1 });
  m.equipes[0].actif = 0;
  const evs = [];
  evs.push(...pas(m, [T.B, 0]));
  assert.equal(p.etat, 'tir');
  for (let i = 1; i < CHARGE_IDEALE; i++) evs.push(...pas(m, [T.B, 0]));
  assert.ok(p.z > 0.5);
  evs.push(...pas(m, [0, 0]));
  const tir = evs.find((e) => e.type === 'tir');
  assert.ok(tir, 'le tir est parti');
  assert.ok(tir.q > 0.9, `bon moment (q = ${tir.q})`);
  assert.equal(tir.pts, 2);
});

test('l’humain : passe, changement de joueur, vol, contre', () => {
  const m = creerMatch({ equipes: ['mielville', 'neigeval'], graine: 8, minutes: 1, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  Object.assign(m.ballon, { porteur: 0, entre: false, remise: -1 });
  m.equipes[0].actif = 0;
  const evs = pas(m, [T.A, 0]);
  assert.ok(evs.some((e) => e.type === 'passe' && e.joueur === 0 && !e.aTerre));
  // La passe à rebond (R) : le ballon touche le parquet avant d'arriver.
  const r = creerMatch({ equipes: ['mielville', 'neigeval'], graine: 8, minutes: 1, controles: ['humain', 'ia'] });
  r.phase = 'jeu';
  Object.assign(r.ballon, { porteur: 0, entre: false, remise: -1 });
  for (const o of r.joueurs.slice(3)) o.x = -12;
  r.equipes[0].actif = 0;
  const ev2 = pas(r, [T.R, 0]);
  assert.ok(ev2.some((e) => e.type === 'passe' && e.aTerre));
  const suite = [];
  for (let i = 0; i < 120 && r.ballon.porteur < 0; i++) suite.push(...pas(r, [0, 0]));
  const iSol = suite.findIndex((e) => e.type === 'sol'), iRecu = suite.findIndex((e) => e.type === 'reception');
  assert.ok(iSol >= 0 && iRecu > iSol, 'rebond, puis réception');
  assert.equal(r.joueurs[r.ballon.porteur].e, 0);
  // En défense : Espace (G) change de joueur, B saute.
  const d = creerMatch({ equipes: ['mielville', 'neigeval'], graine: 8, minutes: 1, controles: ['humain', 'ia'] });
  d.phase = 'jeu';
  Object.assign(d.ballon, { porteur: 3, entre: false, remise: -1 });
  d.equipes[0].actif = 0;
  const e1 = pas(d, [T.G, 0]);
  assert.ok(e1.some((e) => e.type === 'change'));
  assert.notEqual(d.equipes[0].actif, 0);
  pas(d, [0, 0]);
  const e2 = pas(d, [T.B, 0]);
  assert.ok(e2.some((e) => e.type === 'saut'));
});

test('l’ordinateur marque contre une équipe qui ne bouge pas', () => {
  for (const id of ['valrose', 'fort-granit', 'saint-aurel']) {
    const m = creerMatch({ equipes: [id, 'ventenac'], graine: 4, minutes: 1, controles: ['ia', 'aucun'] });
    while (m.phase !== 'fin' && m.f < 100000) pas(m);
    assert.ok(m.score[0] >= 15, `${EQUIPE[id].nom} : ${m.score[0]} points seulement`);
    assert.ok(m.score[0] > m.score[1] * 3);
  }
});

test('le tournoi : huit clubs, trois tours, un champion', () => {
  const c = creerTournoi({ moi: 'valrose', graine: 42, minutes: 1 });
  const ids = c.tours[0].flatMap((r) => [r.a, r.b]);
  assert.equal(ids.length, 8);
  assert.equal(new Set(ids).size, 8);
  assert.ok(ids.includes('valrose'));
  assert.deepEqual(creerTournoi({ moi: 'valrose', graine: 42 }).tours, creerTournoi({ moi: 'valrose', graine: 42 }).tours);
  assert.equal(salleDuTour(c), 'palais');
  // Le joueur gagne tous ses matchs : il finit champion.
  for (let t = 0; t < 3; t++) {
    const r = matchDuJoueur(c);
    assert.ok(r, `${TOURS[t]} : le joueur a un match`);
    assert.equal(aJouer(c).length, 3 - [0, 2, 3][t]);
    enregistrer(c, r.i, { score: r.a === c.moi ? [20, 18] : [18, 20], vainqueur: r.a === c.moi ? 0 : 1 });
    for (const i of aJouer(c)) {
      const m = jouerSansMoi(c, i);
      assert.equal(m.phase, 'fin');
      assert.notEqual(c.tours[t][i].score[0], c.tours[t][i].score[1]);
    }
    assert.ok(avancer(c));
  }
  assert.equal(c.fini, true);
  assert.equal(c.champion, 'valrose');
  assert.equal(salleDuTour({ ...c, tour: 2 }), 'palais');
  // Les statistiques : les points des joueurs font les scores des matchs simulés.
  const total = Object.values(c.stats.j).reduce((s, x) => s + x.pts, 0);
  const marques = c.tours.flat().filter((r) => r.a !== 'valrose' && r.b !== 'valrose').reduce((s, r) => s + r.score[0] + r.score[1], 0);
  assert.equal(total, marques);
  const top = classement(c.stats, 'pts');
  assert.ok(top.length > 0 && top[0].rang === 1 && top.every((x, k) => k === 0 || top[k - 1].pts >= x.pts));
  // Éliminé : le tournoi continue sans lui.
  const d = creerTournoi({ moi: 'lumen', graine: 7, minutes: 1 });
  const r = matchDuJoueur(d);
  enregistrer(d, r.i, { score: [10, 12], vainqueur: r.a === 'lumen' ? 1 : 0 });
  assert.equal(d.elimine, true);
  assert.equal(matchDuJoueur(d), null);
  while (!d.fini) { for (const i of aJouer(d)) jouerSansMoi(d, i); avancer(d); }
  assert.ok(d.champion && d.champion !== 'lumen');
  // Un match du joueur entre aussi dans les statistiques.
  const m = simuler({ equipes: ['lumen', 'braise'], graine: 3, minutes: 1 });
  const s = { j: {} };
  noterStats({ stats: s }, resumer(m));
  assert.equal(Object.values(s.j).filter((x) => x.club === 'lumen').reduce((t, x) => t + x.pts, 0), m.score[0]);
});

test('l’entraînement : moins de joueurs, des plots, pas de fin', () => {
  // Deux contre trois plots : les absents restent garés, les plots ne bougent ni ne touchent le ballon.
  const m = creerMatch({ equipes: ['valrose', 'lumen'], graine: 5, controles: ['ia', 'ia'], entrainement: { nous: 2, eux: 3, immobiles: true } });
  assert.equal(m.joueurs.filter((p) => p.absent).length, 1);
  assert.equal(chronoTexte(m), '∞');
  const avant = m.joueurs.map((p) => [p.x, p.y]);
  for (let i = 0; i < 15000; i++) {
    pas(m, [0, 0]);
    assert.ok(m.ballon.porteur < 0 || m.joueurs[m.ballon.porteur].e === 0);
    assert.notEqual(m.phase, 'fin');
  }
  assert.ok(m.score[0] > 10, 'on marque');
  assert.equal(m.chrono, 0);
  for (const p of m.joueurs) {
    if (p.absent) assert.deepEqual([p.x, p.y], avant[p.id]);
    if (p.e === 1) assert.ok(Math.hypot(p.x - avant[p.id][0], p.y - avant[p.id][1]) < 1.5, 'les plots restent à leur place');
  }
  // Un contre zéro : seul sur le terrain, l'humain a le ballon et peut tirer.
  const s = creerMatch({ equipes: ['valrose', 'lumen'], graine: 5, entrainement: { nous: 1, eux: 0 } });
  assert.equal(s.joueurs.filter((p) => !p.absent).length, 1);
  assert.equal(s.ballon.porteur, s.equipes[0].actif);
  for (let i = 0; i < 200; i++) pas(s, [i % 20 === 0 ? T.G : 0, 0]);
  assert.ok(!s.joueurs[s.equipes[0].actif].absent);
  // Les adversaires qui jouent : ils prennent le ballon, et après leur panier, il nous revient.
  const j = creerMatch({ equipes: ['valrose', 'lumen'], graine: 6, controles: ['ia', 'ia'], entrainement: { nous: 1, eux: 3 } });
  for (let i = 0; i < 30000 && j.score[1] === 0; i++) pas(j);
  assert.ok(j.score[1] > 0);
  while (j.phase === 'panier' || j.phase === 'jeu' && j.ballon.porteur < 0) pas(j);
  assert.equal(j.joueurs[j.ballon.porteur].e, 0);
  // Les réglages changent en pleine partie (la pause) : trois contre deux plots, l'action repart chez nous.
  reglerEntrainement(j, { nous: 3, eux: 2, immobiles: true, niveau: 2 });
  assert.equal(j.joueurs.filter((p) => p.absent).length, 1);
  assert.ok(j.equipes[1].immobile && j.equipes[1].niveau === 2);
  assert.equal(j.joueurs[j.ballon.porteur].e, 0);
  for (let i = 0; i < 3000; i++) pas(j);
  assert.notEqual(j.phase, 'fin');
});

test('les niveaux : le Difficile bat le Facile, le Normal aussi', () => {
  let d = 0, n = 0;
  for (let g = 0; g < 10; g++) {
    const id = EQUIPES[g].id;
    if (simuler({ equipes: [id, id], graine: g * 97 + 5, minutes: 1, niveaux: [2, 0] }).vainqueur === 0) d += 1;
    if (simuler({ equipes: [id, id], graine: g * 89 + 3, minutes: 1, niveaux: [1, 0] }).vainqueur === 0) n += 1;
  }
  assert.ok(d >= 9, `Difficile contre Facile : ${d} victoires sur 10`);
  assert.ok(n >= 8, `Normal contre Facile : ${n} victoires sur 10`);
});

test('le contre de l’humain : sauter devant le tireur, ça marche souvent', () => {
  let contres = 0, essais = 0;
  for (let g = 1; g <= 60; g++) {
    const m = creerMatch({ equipes: ['valrose', 'lumen'], graine: g, minutes: 1, controles: ['humain', 'ia'] });
    m.phase = 'jeu';
    const s = m.equipes[1].sens, tireur = m.joueurs[3], moi = m.joueurs[0];
    // Le tireur, à 6 m de son panier ; nous, à un mètre devant lui ; les autres loin.
    Object.assign(tireur, { x: s * (PANIER_X - 6), y: 0, etat: 'tir', charge: 0, chargeCible: CHARGE_IDEALE, vz: 3.92, z: 0 });
    Object.assign(moi, { x: s * (PANIER_X - 5), y: 0.1 });
    for (const p of m.joueurs) if (p !== tireur && p !== moi) p.x = -s * 10;
    Object.assign(m.ballon, { porteur: 3, entre: false, remise: -1 });
    m.equipes[0].actif = 0;
    const evs = [];
    for (let i = 0; i < 40 && !evs.some((e) => e.type === 'tir'); i++) evs.push(...pas(m, [i === 6 ? T.B : 0, 0]));
    if (!evs.some((e) => e.type === 'tir')) continue;
    essais += 1;
    if (evs.some((e) => e.type === 'contre' && e.joueur === 0)) contres += 1;
  }
  assert.ok(essais >= 50);
  assert.ok(contres / essais >= 0.3, `${contres} contres sur ${essais}`);
});

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

/** Deux joueurs sur un faux réseau (ping, gigue, pertes), chacun avec sa session de rollback. */
function enLigne({ ping, gigue, perte, duree = 20000, derive = 0.003, reglages = {}, delai = 2 }) {
  const R = rng(ping * 13 + 1);
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const m = creerMatch({ equipes: ['mielville', 'braise'], graine: 777, minutes: 3, controles: ['humain', 'humain'] });
    const s = creerSession({ n, delai, etat: m, pas: (e, x) => pas(e, x), empreinte, confirme: (f, e) => conf[n].push(e[0] * 1024 + e[1]), ...reglages });
    return { n, m, s, entrees: joueurHumain(500 + n), periode: (1000 / 60) * (n === 1 ? 1 - derive : 1), prochain: n * 23 };
  });
  const enRoute = [];
  let t = 0;
  const poster = (de, quoi, data) => {
    if (R() < perte) return;
    enRoute.push({ a: 1 - de, quand: t + Math.max(5, ping / 2 + (R() - 0.5) * gigue), quoi, data: JSON.parse(JSON.stringify(data)) });
  };
  for (; t < duree; t += 1) {
    for (let i = enRoute.length - 1; i >= 0; i--) {
      const x = enRoute[i];
      if (x.quand > t) continue;
      enRoute.splice(i, 1);
      const s = joueurs[x.a].s;
      if (x.quoi === 'entrees') s.recevoir(x.data);
      else if (x.quoi === 'empreinte') s.recevoirEmpreinte(x.data);
      else s.recaler(x.data);
    }
    for (const j of joueurs) {
      if (t < j.prochain) continue;
      j.prochain += j.periode;
      const r = j.s.avancer(j.entrees());
      poster(j.n, 'entrees', r.envoi);
      if (r.empreinte) poster(j.n, 'empreinte', r.empreinte);
      if (j.s.desynchro && j.n === 0) { const e = j.s.etatConfirme(); if (e) poster(0, 'etat', e); }
    }
  }
  return { A: joueurs[0].s, B: joueurs[1].s, confA: conf[0], confB: conf[1] };
}

function rejouer(conf, jusqua) {
  const m = creerMatch({ equipes: ['mielville', 'braise'], graine: 777, minutes: 3, controles: ['humain', 'humain'] });
  for (let f = 0; f < jusqua; f++) pas(m, [Math.floor(conf[f] / 1024), conf[f] % 1024]);
  return m;
}

for (const [nom, reseau] of [
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 150 ms, ça varie, 5 % de pertes', { ping: 150, gigue: 80, perte: 0.05 }],
  ['gros ping (300 ms jusqu’à l’autre), réglages du basket', { ping: 600, gigue: 120, perte: 0.03, reglages: REGLAGES, delai: delaiSelonPing(300) }],
]) {
  test(`en ligne (${nom}) : le même match des deux côtés, sans se figer`, () => {
    const { A, B, confA, confB } = enLigne(reseau);
    const n = Math.min(confA.length, confB.length);
    assert.ok(n > 900, `assez d'images confirmées (${n})`);
    assert.deepEqual(confA.slice(0, n), confB.slice(0, n));
    assert.ok(!A.desynchro && !B.desynchro, 'aucune désynchronisation');
    assert.equal(A.stats.recalages + B.stats.recalages, 0, 'jamais besoin de se recaler');
    for (const [s, conf] of [[A, confA], [B, confB]]) {
      const { f, etat } = s.etatConfirme();
      assert.equal(empreinte(etat), empreinte(rejouer(conf, f)), `état à l'image ${f}`);
    }
    assert.ok((A.stats.attentes + B.stats.attentes) / 2 < 30, 'presque jamais figé');
    assert.ok(A.stats.rejouees / Math.max(1, A.stats.retours) <= (reseau.reglages?.fenetre ?? FENETRE), 'des corrections courtes');
  });
}

let idClient = 0;
function client() {
  const recu = [];
  const conn = { id: `b${++idClient}`, send: (m) => recu.push(m), close() {} };
  serveur.handleOpen(conn);
  return { conn, recu, dit: (m) => serveur.handleMessage(conn, m), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('le serveur : une salle, les clubs choisis dans la salle (jamais le même), la même graine, il relaie les touches (10 bits)', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', nom: 'Alice', stade: 'port' });
  const { code, stade } = a.dernier('salle');
  assert.match(code, /^[A-Z2-9]{4}$/);
  assert.equal(stade, 'port');
  assert.equal(a.dernier('salle').g, 'basket');
  // Seul l'hôte change la salle ; une salle inconnue devient le Palais.
  a.dit({ t: 'stade', stade: 'gymnase' });
  assert.equal(a.dernier('stade').stade, 'gymnase');
  b.dit({ t: 'rejoindre', code: code.toLowerCase(), nom: '<i>Bob</i>' });
  assert.equal(a.dernier('debut'), undefined);
  assert.deepEqual(b.dernier('salon').noms, ['Alice', 'iBob/i']);
  a.dit({ t: 'equipe', equipe: 'lumen' });
  b.dit({ t: 'equipe', equipe: 'lumen' });
  assert.match(b.dernier('erreur').msg, /déjà pris/);
  b.dit({ t: 'equipe', equipe: 'kerbrume' });
  b.dit({ t: 'pret' });
  assert.deepEqual(a.dernier('salon').prets, [false, false], 'pas prêt sans club (un club de foot ne compte pas)');
  b.dit({ t: 'equipe', equipe: 'braise' });
  b.dit({ t: 'pret' });
  a.dit({ t: 'pret' });
  const da = a.dernier('debut'), db = b.dernier('debut');
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.equipes, ['lumen', 'braise']);
  assert.equal(da.stade, 'gymnase');
  a.dit({ t: 'stade', stade: 'chaudron' });
  assert.equal(b.dernier('stade').stade, 'palais');
  // Les touches : 10 bits (la passe à rebond comprise), relayées à l'autre seulement.
  a.dit({ t: 'entrees', f: 4, e: [T.R | T.d, T.G | T.S, 0x7ff], fc: 3, vu: 1, av: 0 });
  assert.deepEqual(b.dernier('entrees').e, [T.R | T.d, T.G | T.S, 0x3ff]);
  assert.equal(a.dernier('entrees'), undefined);
  // La coupure : la place est gardée, l'autre est prévenu.
  assert.equal(serveur.enPartie(a.conn), true);
  serveur.handleAway(b.conn);
  assert.equal(a.dernier('absent').nom, 'iBob/i');
  serveur.handleResume(b.conn);
  assert.ok(a.dernier('revenu'));
  // La revanche, puis le départ.
  const avant = a.recu.filter((m) => m.t === 'debut').length;
  a.dit({ t: 'revanche' }); b.dit({ t: 'revanche' });
  assert.equal(a.recu.filter((m) => m.t === 'debut').length, avant + 1);
  b.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti'));
});

test('le Grand Championnat : chacun contre tous, 2 points la victoire, 1 la défaite', () => {
  // Le calendrier : chaque club joue une fois par journée, et rencontre chacun des quinze autres.
  const ids = EQUIPES.map((e) => e.id);
  const cal = calendrierChamp(ids);
  assert.equal(cal.length, 15);
  for (const j of cal) {
    assert.equal(j.length, 8);
    assert.equal(new Set(j.flatMap((r) => [r.a, r.b])).size, 16);
  }
  const paires = new Set(cal.flat().map((r) => [r.a, r.b].sort().join('|')));
  assert.equal(paires.size, 120);
  // Aller-retour : chaque paire deux fois, les terrains inversés.
  const retour = calendrierChamp(ids, 'retour');
  assert.equal(retour.length, 30);
  assert.deepEqual(retour[15].map((r) => [r.b, r.a]), retour[0].map((r) => [r.a, r.b]));
  // Un championnat entier : le joueur gagne tous ses matchs, il est champion.
  const c = creerChampionnat({ moi: 'lumen', graine: 9, minutes: 1 });
  while (!c.fini) {
    const r = matchChamp(c);
    assert.ok(r, `journée ${c.journee + 1} : le joueur a un match`);
    enregistrerChamp(c, r.i, { score: r.a === 'lumen' ? [30, 20] : [20, 30] });
    for (const i of aJouerChamp(c)) jouerSansMoiChamp(c, i);
    assert.ok(avancerChamp(c));
  }
  const cl = classementChamp(c);
  assert.equal(c.champion, 'lumen');
  assert.equal(cl[0].id, 'lumen');
  assert.deepEqual([cl[0].v, cl[0].d, cl[0].pts], [15, 0, 30]);
  assert.ok(cl.every((x) => x.j === 15 && x.pts === 2 * x.v + x.d));
  assert.equal(cl.reduce((t, x) => t + x.v, 0), 120);
  assert.ok(cl.every((x, k) => k === 0 || cl[k - 1].pts > x.pts || (cl[k - 1].pts === x.pts && cl[k - 1].diff >= x.diff)));
  // Abandonné en route : tout se joue, il perd ses matchs.
  const d = creerChampionnat({ moi: 'braise', graine: 3, minutes: 1 });
  simulerLeResteChamp(d);
  assert.equal(d.fini, true);
  assert.equal(classementChamp(d).find((x) => x.id === 'braise').v, 0);
});

test('équilibre : chaque équipe gagne entre 35 et 65 % de ses matchs', () => {
  // Chaque équipe reçoit chacune des autres, quatre fois (deux périodes d'une minute) :
  // 120 matchs par équipe (moins, le hasard d'un petit échantillon fausse le verdict). Pas de nul : le panier en or départage.
  const ids = EQUIPES.map((e) => e.id);
  const v = Object.fromEntries(ids.map((id) => [id, 0]));
  let g = 1;
  for (const a of ids) for (const b of ids) for (let k = 0; k < 4; k++) {
    if (a === b) continue;
    const m = simuler({ equipes: [a, b], graine: (g++) * 7919, minutes: 1 });
    v[m.vainqueur === 0 ? a : b] += 1;
  }
  const taux = ids.map((id) => [id, v[id] / ((ids.length - 1) * 8)]);
  for (const [id, t] of taux) {
    assert.ok(t <= 0.65, `${EQUIPE[id].nom} gagne ${(t * 100).toFixed(0)} %`);
    assert.ok(t >= 0.35, `${EQUIPE[id].nom} ne gagne que ${(t * 100).toFixed(0)} %`);
  }
});
