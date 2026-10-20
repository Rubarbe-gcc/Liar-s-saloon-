/**
 * CROCHET — le moteur de la boxe : les seize boxeurs, le déterminisme, un
 * combat qui va au bout, les coups (touché, bloqué, esquivé, dans le vide), le
 * tapis et le compte, les juges, les niveaux de l'ordinateur et l'équilibre des
 * boxeurs (on peut le sauter avec --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerCombat, pas, empreinte, simuler, chronoTexte, effortRelever, reglerEntrainement, T, COUPS, SANTE_MAX } from '../public/shared/boxe/combat.js';
import { creerTournoi, matchDuJoueur, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS as TOURS_BOXE } from '../public/shared/boxe/tournoi.js';
import { creerSession, FENETRE } from '../public/shared/rollback.js';
import * as serveur from '../server/boxe.js';
import { delaiSelonPing, REGLAGES } from '../public/games/plein-stade/boxe/js/enligne.js';
import { BOXEURS, BOXEUR, STYLES, CATEGORIES, noteGenerale } from '../public/shared/boxe/boxeurs.js';

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
      if (R() < 0.7) m |= [T.g, T.d, T.h, T.b, T.g | T.h, T.d | T.b][Math.floor(R() * 6)];
      if (R() < 0.4) m |= [T.A, T.B, T.X, T.G, T.S][Math.floor(R() * 5)];
    }
    return m;
  };
}

/** Un combat en plein round, les deux boxeurs placés à la main (les autres réglages : ceux du moteur). */
function face(ecart = 1, controles = ['humain', 'humain']) {
  const m = creerCombat({ boxeurs: ['vasseur', 'delmas'], graine: 3, controles });
  m.phase = 'combat';
  Object.assign(m.boxeurs[0], { x: -ecart / 2, y: 0, dx: 1, dy: 0 });
  Object.assign(m.boxeurs[1], { x: ecart / 2, y: 0, dx: -1, dy: 0 });
  // Pas de défense passive dans ces essais : le défenseur ne bouge pas la tête.
  m.boxeurs[1].n.defense = 0;
  return m;
}
/** Joue n images avec ces touches, rend les événements. */
function jouer(m, n, a = 0, b = 0) {
  const evs = [];
  for (let i = 0; i < n; i++) evs.push(...pas(m, [typeof a === 'function' ? a(i) : a, typeof b === 'function' ? b(i) : b]));
  return evs;
}

test('les seize boxeurs : inventés, complets, quatre par catégorie', () => {
  assert.equal(BOXEURS.length, 16);
  assert.equal(new Set(BOXEURS.map((x) => x.id)).size, 16);
  for (const cat of Object.keys(CATEGORIES)) assert.equal(BOXEURS.filter((x) => x.categorie === cat).length, 4);
  for (const x of BOXEURS) {
    assert.ok(STYLES[x.style], x.nom);
    assert.ok(x.surnom && x.ville && x.devise && x.couleurs.short && x.couleurs.gants);
    for (const k of ['puissance', 'vitesse', 'endurance', 'defense', 'menton']) assert.ok(x.notes[k] >= 40 && x.notes[k] <= 99, `${x.nom} ${k}`);
    assert.ok(noteGenerale(x) > 60);
  }
});

test('déterministe : même graine, mêmes touches → même combat', () => {
  const une = () => {
    const m = creerCombat({ boxeurs: ['barneche', 'malbrouck'], graine: 99, minutes: 1, controles: ['humain', 'ia'] });
    const h = joueurHumain(7);
    const traces = [];
    for (let i = 0; i < 6000; i++) { pas(m, [h(), 0]); if (i % 300 === 0) traces.push(empreinte(m)); }
    return traces;
  };
  assert.deepEqual(une(), une());
  const a = simuler({ boxeurs: ['morvan', 'ebrard'], graine: 5, minutes: 1 });
  const b = simuler({ boxeurs: ['morvan', 'ebrard'], graine: 5, minutes: 1 });
  assert.equal(empreinte(a), empreinte(b));
  assert.notEqual(empreinte(a), empreinte(simuler({ boxeurs: ['morvan', 'ebrard'], graine: 6, minutes: 1 })));
});

test('un combat va au bout : K.-O., arrêt ou décision des juges', () => {
  const issues = new Set();
  for (let g = 1; g <= 24; g++) {
    const m = simuler({ boxeurs: [BOXEURS[g % 16].id, BOXEURS[(g * 5 + 3) % 16].id], graine: g * 31, minutes: 1 });
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    issues.add(m.issue);
    if (m.issue === 'points') {
      assert.equal(m.round, 3);
      assert.ok(m.cartes.every((c) => c.length === 3));
      assert.ok(['unanime', 'majorite', 'partagee', 'arbitre'].includes(m.decision.type));
    }
  }
  assert.ok(issues.has('points'));
  // Avec un humain qui appuie au hasard, aussi.
  const m = creerCombat({ boxeurs: ['sarrette', 'castera'], graine: 2, minutes: 1, controles: ['humain', 'ia'] });
  const h = joueurHumain(3);
  for (let i = 0; i < 60000 && m.phase !== 'fin'; i++) pas(m, [h(), 0]);
  assert.equal(m.phase, 'fin');
  assert.match(chronoTexte(creerCombat({ boxeurs: ['sarrette', 'castera'], minutes: 2 })), /^2:00$/);
});

test('les coups : touché, bloqué par la bonne garde, esquivé, dans le vide', () => {
  // Touché : un crochet à bonne distance.
  let m = face(1);
  let evs = jouer(m, 30, (i) => (i === 0 ? T.B : 0));
  assert.ok(evs.some((e) => e.type === 'touche' && e.coup === 'crochet' && e.cible === 1));
  assert.ok(m.boxeurs[1].sante < SANTE_MAX);
  // Bloqué : il tient la garde haute.
  m = face(1);
  evs = jouer(m, 30, (i) => (i === 0 ? T.B : 0), T.G);
  assert.ok(evs.some((e) => e.type === 'bloque' && e.boxeur === 1));
  // La garde haute ne protège pas le corps : un crochet au corps (en tenant b) passe.
  m = face(1);
  evs = jouer(m, 30, (i) => (i === 0 ? T.B | T.b : T.b), T.G);
  assert.ok(evs.some((e) => e.type === 'touche' && e.corps));
  // Esquivé : il esquive pendant que le crochet se prépare, puis il peut punir (contre).
  m = face(1);
  evs = jouer(m, 30, (i) => (i === 0 ? T.B : 0), (i) => (i === 5 ? T.S | T.h : 0));
  assert.ok(evs.some((e) => e.type === 'esquive-reussie' && e.boxeur === 1));
  assert.ok(m.boxeurs[0].ouvert > 0);
  // Dans le vide : trop loin.
  m = face(2.5);
  evs = jouer(m, 30, (i) => (i === 0 ? T.A : 0));
  assert.ok(evs.some((e) => e.type === 'vide'));
  // Un uppercut porte moins loin qu'un jab.
  assert.ok(COUPS.upper.portee < COUPS.jab.portee);
});

test('le tapis : le compte, se relever en tapant, ou le K.-O. à 10', () => {
  // L'humain au tapis : il tape vite, il se relève.
  let m = face(1);
  m.boxeurs[1].sante = 1;
  let evs = jouer(m, 30, (i) => (i === 0 ? T.B : 0));
  assert.ok(evs.some((e) => e.type === 'kd' && e.boxeur === 1));
  assert.equal(m.phase, 'compte');
  const besoin = effortRelever(m.boxeurs[1]);
  evs = jouer(m, 400, 0, (i) => (i % 2 === 0 && i < besoin * 2 + 2 ? T.A : 0));
  assert.ok(evs.some((e) => e.type === 'debout' && e.boxeur === 1));
  assert.equal(m.phase, 'combat');
  assert.ok(m.boxeurs[1].santeMax < SANTE_MAX, 'chaque chute laisse des traces');
  // Il ne tape pas : K.-O.
  m = face(1);
  m.boxeurs[1].sante = 1;
  evs = jouer(m, 30 + 11 * 60, (i) => (i === 0 ? T.B : 0));
  assert.ok(evs.some((e) => e.type === 'compte' && e.n === 10));
  assert.equal(m.phase, 'fin');
  assert.equal(m.issue, 'ko');
  assert.equal(m.vainqueur, 0);
});

test('les juges : 10-9 au meilleur, un point de moins par chute', () => {
  const m = face(1);
  m.duree = 600;
  // Le boxeur 0 touche plusieurs fois, l'autre ne fait rien.
  jouer(m, 590, (i) => (i % 40 === 0 ? T.A : 0));
  m.rd.kd = [0, 1];
  jouer(m, 20);
  assert.equal(m.phase, 'repos');
  for (const c of m.cartes) assert.deepEqual(c[0], [10, 8]);
});

test('les niveaux : le Difficile bat nettement le Facile', () => {
  let v = 0;
  for (let g = 0; g < 10; g++) {
    const id = BOXEURS[g].id;
    if (simuler({ boxeurs: [id, id], graine: g * 97 + 5, minutes: 1, niveaux: [2, 0] }).vainqueur === 0) v += 1;
  }
  assert.ok(v >= 8, `${v} victoires sur 10`);
});

test('l’ordinateur met K.-O. un sac de frappe', () => {
  for (const id of ['malbrouck', 'ardouin', 'castera']) {
    const m = creerCombat({ boxeurs: [id, 'delmas'], graine: 4, minutes: 3, controles: ['ia', 'aucun'] });
    while (m.phase !== 'fin' && m.f < 100000) pas(m);
    assert.equal(m.vainqueur, 0, BOXEUR[id].nom);
    assert.ok(m.stats.kd[0] >= 1, `${BOXEUR[id].nom} : au moins une chute`);
  }
});

test('le tournoi : huit boxeurs, trois tours, une ceinture', () => {
  const c = creerTournoi({ moi: 'ardouin', graine: 42, minutes: 1 });
  const ids = c.tours[0].flatMap((r) => [r.a, r.b]);
  assert.equal(new Set(ids).size, 8);
  assert.ok(ids.includes('ardouin'));
  for (let t = 0; t < 3; t++) {
    const r = matchDuJoueur(c);
    assert.ok(r, `${TOURS_BOXE[t]} : le joueur a un combat`);
    enregistrer(c, r.i, { issue: 'ko', round: 2, vainqueur: r.a === c.moi ? 0 : 1 });
    for (const i of aJouer(c)) { const m = jouerSansMoi(c, i); assert.equal(m.phase, 'fin'); assert.ok(c.tours[t][i].v); }
    assert.ok(avancer(c));
  }
  assert.equal(c.fini, true);
  assert.equal(c.champion, 'ardouin');
  // Les statistiques des combats sans lui : les coups portés s'additionnent.
  assert.ok(classement(c.stats, 'touches').length > 0);
  // Éliminé, le tournoi va au bout sans lui.
  const d = creerTournoi({ moi: 'delmas', graine: 7, minutes: 1 });
  const r = matchDuJoueur(d);
  enregistrer(d, r.i, { issue: 'points', round: 3, vainqueur: r.a === 'delmas' ? 1 : 0 });
  assert.equal(d.elimine, true);
  while (!d.fini) { for (const i of aJouer(d)) jouerSansMoi(d, i); avancer(d); }
  assert.ok(d.champion && d.champion !== 'delmas');
  const s = { j: {} };
  noterStats({ stats: s }, resumer(simuler({ boxeurs: ['morvan', 'kerlouan'], graine: 3, minutes: 1 })));
  assert.equal(Object.keys(s.j).length, 2);
});

test('l’entraînement : un sac, un sparring qui ne frappe jamais, pas de fin', () => {
  const m = creerCombat({ boxeurs: ['rocaillon', 'vasseur'], graine: 2, controles: ['ia', 'ia'], entrainement: { adversaire: 'sparring' } });
  assert.equal(chronoTexte(m), '∞');
  for (let i = 0; i < 12000; i++) pas(m);
  assert.notEqual(m.phase, 'fin');
  assert.equal(m.stats.lances[1], 0, 'le sparring ne frappe jamais');
  assert.ok(m.stats.touches[0] > 0);
  // Le sac : il encaisse, tombe, se relève à 3, comme neuf ; jamais d'arrêt.
  reglerEntrainement(m, { adversaire: 'sac' });
  assert.equal(m.coins[1].ctrl, 'aucun');
  const evs = [];
  for (let i = 0; i < 40000; i++) evs.push(...pas(m));
  assert.ok(evs.some((e) => e.type === 'kd'));
  assert.ok(evs.filter((e) => e.type === 'debout').every((e) => e.compte === 3));
  assert.notEqual(m.phase, 'fin');
  assert.equal(m.stats.lances[1], 0);
  // Un vrai adversaire, au niveau choisi.
  reglerEntrainement(m, { adversaire: 'combat', niveau: 2 });
  assert.ok(m.coins[1].ctrl === 'ia' && !m.coins[1].sparring && m.coins[1].niveau === 2);
  for (let i = 0; i < 6000; i++) pas(m);
  assert.ok(m.stats.lances[1] > 0);
});

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

function enLigne({ ping, gigue, perte, duree = 20000, derive = 0.003, reglages = {}, delai = 2 }) {
  const R = rng(ping * 13 + 1);
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const m = creerCombat({ boxeurs: ['lantenac', 'sarrette'], graine: 777, minutes: 2, controles: ['humain', 'humain'] });
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
  const m = creerCombat({ boxeurs: ['lantenac', 'sarrette'], graine: 777, minutes: 2, controles: ['humain', 'humain'] });
  for (let f = 0; f < jusqua; f++) pas(m, [Math.floor(conf[f] / 1024), conf[f] % 1024]);
  return m;
}

for (const [nom, reseau] of [
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 150 ms, ça varie, 5 % de pertes', { ping: 150, gigue: 80, perte: 0.05 }],
  ['gros ping (300 ms jusqu’à l’autre), réglages de la boxe', { ping: 600, gigue: 120, perte: 0.03, reglages: REGLAGES, delai: delaiSelonPing(300) }],
]) {
  test(`en ligne (${nom}) : le même combat des deux côtés, sans se figer`, () => {
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
  const conn = { id: `x${++idClient}`, send: (m) => recu.push(m), close() {} };
  serveur.handleOpen(conn);
  return { conn, recu, dit: (m) => serveur.handleMessage(conn, m), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('le serveur : une salle, les boxeurs choisis dans la salle (jamais le même), la même graine, il relaie les touches', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', nom: 'Alice' });
  const { code } = a.dernier('salle');
  assert.equal(a.dernier('salle').g, 'boxe');
  b.dit({ t: 'rejoindre', code, nom: 'Bob' });
  a.dit({ t: 'equipe', equipe: 'morvan' });
  b.dit({ t: 'equipe', equipe: 'morvan' });
  assert.match(b.dernier('erreur').msg, /déjà pris/);
  b.dit({ t: 'equipe', equipe: 'lumen' });
  b.dit({ t: 'pret' });
  assert.deepEqual(a.dernier('salon').prets, [false, false], 'un club de basket n’est pas un boxeur');
  b.dit({ t: 'equipe', equipe: 'abergel' });
  b.dit({ t: 'pret' });
  a.dit({ t: 'pret' });
  const da = a.dernier('debut'), db = b.dernier('debut');
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.equipes, ['morvan', 'abergel']);
  a.dit({ t: 'entrees', f: 4, e: [T.A | T.d, T.G | T.b], fc: 3, vu: 1, av: 0 });
  assert.deepEqual(b.dernier('entrees').e, [T.A | T.d, T.G | T.b]);
  assert.equal(serveur.enPartie(a.conn), true);
  serveur.handleAway(b.conn);
  assert.ok(a.dernier('absent'));
  serveur.handleResume(b.conn);
  assert.ok(a.dernier('revenu'));
  b.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti'));
});

test('équilibre : chaque boxeur gagne entre 35 et 65 % de ses combats', () => {
  // Chacun rencontre chacun des autres quatre fois de chaque côté (rounds de deux minutes, la durée la plus jouée) : 120 combats par boxeur.
  const ids = BOXEURS.map((x) => x.id);
  const v = Object.fromEntries(ids.map((id) => [id, 0]));
  let g = 1;
  for (const a of ids) for (const b of ids) for (let k = 0; k < 4; k++) {
    if (a === b) continue;
    const m = simuler({ boxeurs: [a, b], graine: (g++) * 7919, minutes: 2 });
    v[m.vainqueur === 0 ? a : b] += 1;
  }
  for (const id of ids) {
    const t = v[id] / ((ids.length - 1) * 8);
    assert.ok(t <= 0.65, `${BOXEUR[id].nom} gagne ${(t * 100).toFixed(0)} %`);
    assert.ok(t >= 0.35, `${BOXEUR[id].nom} ne gagne que ${(t * 100).toFixed(0)} %`);
  }
});
