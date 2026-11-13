/**
 * ROUCOULETTE — le moteur du handball à sept : le déterminisme, un match qui
 * va au bout (but en or compris), la zone des 6 m, le gardien, l'ordinateur
 * qui marque, les commandes de l'humain, l'entraînement, le tournoi, et
 * l'équilibre des seize clubs (long : on peut le sauter avec
 * --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, chronoTexte, reglerEntrainement, T, DEMI_L, CHARGE_IDEALE, N } from '../public/shared/handball/match.js';
import { distBut, zoneDe, ZONE, chanceBut } from '../public/shared/handball/terrain.js';
import { EQUIPES, EQUIPE, STYLES, notesEquipe, noteGenerale } from '../public/shared/handball/equipes.js';
import { ecussonSVG } from '../public/games/plein-stade/commun/ecusson.js';
import { creerTournoi, matchDuJoueur, salleDuTour, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../public/shared/handball/tournoi.js';
import { creerSession, FENETRE } from '../public/shared/rollback.js';
import * as serveur from '../server/handball.js';
import { delaiSelonPing, REGLAGES } from '../public/games/plein-stade/handball/js/enligne.js';

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
  const ids = new Set(), abrs = new Set(), noms = new Set();
  for (const eq of EQUIPES) {
    ids.add(eq.id); abrs.add(eq.abr);
    assert.ok(STYLES[eq.style], `${eq.nom} : style ${eq.style}`);
    assert.equal(eq.joueurs.length, 7);
    assert.ok(eq.devise && eq.ville && eq.maillot && eq.exterieur && eq.ecusson);
    assert.ok(eq.joueurs[0].notes.gardien >= 60, `${eq.nom} : un vrai gardien`);
    for (const j of eq.joueurs) {
      noms.add(j.nom);
      for (const k of ['vitesse', 'tir', 'passe', 'defense', 'saut']) assert.ok(j.notes[k] >= 30 && j.notes[k] <= 99, `${j.nom} ${k}`);
    }
    assert.ok(ecussonSVG(eq, 48).startsWith('<svg'));
    assert.ok(notesEquipe(eq).tir > 0 && noteGenerale(eq) > 0);
  }
  assert.equal(ids.size, 16);
  assert.equal(abrs.size, 16);
  assert.equal(noms.size, 16 * 7, 'pas deux joueurs du même nom');
});

test('la zone des 6 m : autour des poteaux', () => {
  assert.equal(distBut(DEMI_L - 6, 0, DEMI_L), 6);
  assert.equal(distBut(DEMI_L, 1.5 + 6, DEMI_L), 6);
  assert.ok(zoneDe(DEMI_L - 5, 0) === DEMI_L);
  assert.ok(zoneDe(-DEMI_L + 3, 2) === -DEMI_L);
  assert.equal(zoneDe(0, 0), 0);
  assert.equal(zoneDe(DEMI_L - 5, 7), 0, 'de côté, à 6,5 m du poteau : dehors');
});

test('le déterminisme : même graine, mêmes touches, même match', () => {
  const jouer = () => {
    const m = creerMatch({ equipes: ['vent-d-ouest', 'roche-forte'], graine: 42, minutes: 1 });
    const h = joueurHumain(7);
    const empreintes = [];
    for (let f = 0; f < 6000; f++) { pas(m, [h(), 0]); if (f % 500 === 0) empreintes.push(empreinte(m)); }
    return { e: empreintes, score: [...m.score], f: m.f };
  };
  assert.deepEqual(jouer(), jouer());
  // Une copie de l'état repart pareil (le rollback en ligne en aura besoin).
  const m = creerMatch({ equipes: ['clairmarais', 'haute-borne'], graine: 9, minutes: 1 });
  for (let f = 0; f < 900; f++) pas(m, [0, 0]);
  const c = structuredClone(m);
  for (let f = 0; f < 900; f++) { pas(m, [T.d, 0]); pas(c, [T.d, 0]); }
  assert.equal(empreinte(m), empreinte(c));
});

test('un match entre ordinateurs va au bout, avec des buts des deux côtés', () => {
  let buts = [0, 0], tirs = 0, arrets = 0;
  for (let k = 0; k < 6; k++) {
    const m = simuler({ equipes: [EQUIPES[k].id, EQUIPES[15 - k].id], graine: 100 + k, minutes: 2 });
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    assert.notEqual(m.score[0], m.score[1]);
    buts[0] += m.score[0]; buts[1] += m.score[1];
    tirs += m.stats.tirs[0] + m.stats.tirs[1];
    arrets += m.stats.arrets[0] + m.stats.arrets[1];
    assert.equal(m.buts.length, m.score[0] + m.score[1]);
    assert.equal(m.perso.reduce((s, p) => s + p.buts, 0) <= m.score[0] + m.score[1], true);
  }
  assert.ok(buts[0] > 10 && buts[1] > 10, `des buts : ${buts}`);
  assert.ok(arrets > 5, 'les gardiens arrêtent des tirs');
  const r = (buts[0] + buts[1]) / tirs;
  assert.ok(r > 0.4 && r < 0.8, `réussite au tir : ${r.toFixed(2)}`);
});

test('le but en or : égalité à la fin, le premier but gagne', () => {
  let vu = false;
  for (let g = 1; g < 80 && !vu; g++) {
    const m = simuler({ equipes: ['haute-borne', 'pierre-noire'], graine: g, minutes: 1 });
    if (m.enOr) { vu = true; assert.equal(Math.abs(m.score[0] - m.score[1]), 1); assert.equal(m.buts[m.buts.length - 1].enOr, true); }
  }
  assert.ok(vu, 'au moins un but en or');
});

test('les joueurs de champ ne se posent jamais dans la zone ; le gardien n’en sort pas', () => {
  const m = creerMatch({ equipes: ['corail', 'braises'], graine: 3, minutes: 2, controles: ['ia', 'ia'] });
  let g = 0;
  while (m.phase !== 'fin' && g++ < 40000) {
    pas(m, [0, 0]);
    if (m.phase !== 'jeu') continue;
    for (const p of m.joueurs) {
      if (p.i === 0) assert.ok(distBut(p.x, p.y, -m.equipes[p.e].sens * DEMI_L) <= ZONE, 'gardien dans sa zone');
      else if (p.z === 0 && !p.sortie) assert.ok(!zoneDe(p.x, p.y, -0.05), `joueur ${p.id} dans la zone en (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    }
  }
});

test('l’humain : il dirige un joueur de champ, passe, tire en suspension et marque', () => {
  // Un humain simple : il fonce vers le but, saute à 9 m et lâche en haut du saut.
  let buts = 0, tirs = 0, passes = 0;
  for (let g = 1; g <= 6; g++) {
    const m = creerMatch({ equipes: ['val-d-or', 'lavandiere'], graine: g, minutes: 2, niveaux: [1, 0] });
    let tient = 0, f = 0;
    while (m.phase !== 'fin' && f++ < 60000) {
      const eq = m.equipes[0];
      const b = m.ballon;
      const p = m.joueurs[eq.actif];
      let k = 0;
      if (b.porteur >= 0 && m.joueurs[b.porteur].e === 0 && p && b.porteur === p.id) {
        if (b.remise >= 0) k = (m.f % 20 < 10) ? T.A : 0;
        else if (p.etat === 'tir') { tient += 1; k = tient < CHARGE_IDEALE ? T.B : 0; }
        else {
          tient = 0;
          const gx = eq.sens * DEMI_L;
          const d = distBut(p.x, p.y, gx);
          k |= gx > p.x ? T.d : T.g;
          if (p.y > 1) k |= T.b; else if (p.y < -1) k |= T.h;
          if (d < 9) k |= T.B;
        }
      } else if (b.porteur >= 0 && m.joueurs[b.porteur].e === 0 && m.joueurs[b.porteur].i === 0) k = m.f % 10 < 5 ? T.A : 0;
      else {
        // En défense : vers le ballon, et on tente de le voler.
        k |= b.x > (p?.x ?? 0) ? T.d : T.g;
        if (b.y > (p?.y ?? 0) + 0.3) k |= T.h; else if (b.y < (p?.y ?? 0) - 0.3) k |= T.b;
        if (m.f % 30 === 0) k |= T.A;
      }
      const evs = pas(m, [k, 0]);
      for (const ev of evs) {
        if (ev.type === 'tir' && m.joueurs[ev.joueur].e === 0) tirs++;
        if (ev.type === 'passe' && m.joueurs[ev.joueur].e === 0) passes++;
      }
      assert.ok(m.equipes[0].actif < 0 || m.joueurs[m.equipes[0].actif].i > 0, 'l’humain ne dirige jamais le gardien');
    }
    buts += m.score[0];
  }
  assert.ok(tirs > 20, `l’humain tire (${tirs})`);
  assert.ok(passes > 5, 'l’humain passe (ou son gardien lui donne le ballon)');
  assert.ok(buts > 10, `l’humain marque (${buts} buts)`);
});

test('des touches au hasard ne cassent rien', () => {
  for (let g = 1; g <= 3; g++) {
    const m = creerMatch({ equipes: [EQUIPES[g].id, EQUIPES[g + 5].id], graine: g, minutes: 1, controles: ['humain', 'humain'] });
    const a = joueurHumain(g), b = joueurHumain(g + 50);
    let f = 0;
    while (m.phase !== 'fin' && f++ < 40000) pas(m, [a(), b()]);
    for (const p of m.joueurs) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
    assert.ok(Number.isFinite(m.ballon.x) && Number.isFinite(m.ballon.z));
  }
});

test('la chance de marquer : plus près, c’est mieux ; de l’aile, moins bien', () => {
  const m = creerMatch({ equipes: ['vent-d-ouest', 'roche-forte'], graine: 1 });
  const p = m.joueurs[3];
  const gx = m.equipes[0].sens * DEMI_L;
  assert.ok(chanceBut(m, p, gx - 7, 0, 1, false) > chanceBut(m, p, gx - 11, 0, 1, false));
  assert.ok(chanceBut(m, p, gx - 7, 0, 1, false) > chanceBut(m, p, gx - 1.5, 7.5, 1, false));
});

test('l’entraînement : moins de joueurs, sans gardien, adversaires immobiles, pas de fin', () => {
  const m = creerMatch({ equipes: ['vent-d-ouest', 'roche-forte'], graine: 5, entrainement: { nous: 2, eux: 3, gardiens: [true, false], immobiles: true } });
  assert.equal(m.joueurs.filter((p) => p.e === 0 && !p.absent).length, 3);
  assert.equal(m.joueurs.filter((p) => p.e === 1 && !p.absent).length, 3);
  assert.ok(m.joueurs[N].absent, 'leur gardien est absent');
  assert.equal(m.joueurs[m.ballon.porteur].e, 0);
  assert.equal(chronoTexte(m), '∞');
  const h = joueurHumain(3);
  const avant = m.joueurs.filter((p) => p.e === 1 && !p.absent).map((p) => [p.x, p.y]);
  for (let f = 0; f < 20000; f++) pas(m, [h(), 0]);
  assert.notEqual(m.phase, 'fin');
  // Les plots ne bougent pas (sauf poussés), ils ne touchent jamais le ballon.
  m.joueurs.filter((p) => p.e === 1 && !p.absent).forEach((p, k) => assert.ok(Math.hypot(p.x - avant[k][0], p.y - avant[k][1]) < 3));
  assert.ok(m.ballon.porteur < 0 || m.joueurs[m.ballon.porteur].e === 0);
  // On change les réglages en pleine partie.
  reglerEntrainement(m, { nous: 6, eux: 0, gardiens: [false, true], immobiles: false });
  assert.equal(m.joueurs.filter((p) => p.e === 1 && !p.absent).length, 1);
  assert.ok(m.joueurs[0].absent);
  for (let f = 0; f < 3000; f++) pas(m, [h(), 0]);
});

test('le Tournoi : huit clubs, trois tours, un champion, des statistiques', () => {
  const c = creerTournoi({ moi: 'givreval', graine: 77, minutes: 2 });
  assert.equal(c.tours[0].length, 4);
  assert.ok(new Set(c.tours[0].flatMap((r) => [r.a, r.b])).has('givreval'));
  assert.equal(salleDuTour(c), c.salle);
  for (let t = 0; t < 3 && !c.fini; t++) {
    const r = matchDuJoueur(c);
    if (r) {
      const m = simuler({ equipes: [r.a, r.b], graine: 5 + t, minutes: 1 });
      enregistrer(c, r.i, { score: m.score, enOr: m.enOr, vainqueur: m.vainqueur });
      noterStats(c, resumer(m));
    }
    for (const i of aJouer(c)) jouerSansMoi(c, i);
    avancer(c);
  }
  while (!c.fini) { for (const i of aJouer(c)) jouerSansMoi(c, i); avancer(c); }
  assert.equal(c.tours.length, 3);
  assert.ok(EQUIPE[c.champion]);
  assert.equal(TOURS.length, 3);
  const buteurs = classement(c.stats, 'buts');
  assert.ok(buteurs.length > 0 && buteurs[0].buts >= buteurs[buteurs.length - 1].buts);
  assert.ok(classement(c.stats, 'arrets').every((s) => s.i === 0), 'les arrêts sont aux gardiens');
});

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

/** Deux joueurs sur un faux réseau (ping, gigue, pertes), chacun avec sa session de rollback. */
function enLigne({ ping, gigue, perte, duree = 20000, derive = 0.003, reglages = {}, delai = 2 }) {
  const R = rng(ping * 13 + 1);
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const m = creerMatch({ equipes: ['vent-d-ouest', 'roche-forte'], graine: 777, minutes: 3, controles: ['humain', 'humain'] });
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
  const m = creerMatch({ equipes: ['vent-d-ouest', 'roche-forte'], graine: 777, minutes: 3, controles: ['humain', 'humain'] });
  for (let f = 0; f < jusqua; f++) pas(m, [Math.floor(conf[f] / 1024), conf[f] % 1024]);
  return m;
}

for (const [nom, reseau] of [
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 150 ms, ça varie, 5 % de pertes', { ping: 150, gigue: 80, perte: 0.05 }],
  ['gros ping (300 ms jusqu’à l’autre), réglages du handball', { ping: 600, gigue: 120, perte: 0.03, reglages: REGLAGES, delai: delaiSelonPing(300) }],
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
  const conn = { id: `h${++idClient}`, send: (m) => recu.push(m), close() {} };
  serveur.handleOpen(conn);
  return { conn, recu, dit: (m) => serveur.handleMessage(conn, m), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('le serveur : une salle, les clubs choisis dans la salle (jamais le même), la même graine, il relaie les touches (10 bits)', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', nom: 'Alice', stade: 'plage' });
  const { code, stade } = a.dernier('salle');
  assert.match(code, /^[A-Z2-9]{4}$/);
  assert.equal(stade, 'plage');
  assert.equal(a.dernier('salle').g, 'handball');
  a.dit({ t: 'stade', stade: 'gymnase' });
  assert.equal(a.dernier('stade').stade, 'gymnase');
  b.dit({ t: 'rejoindre', code: code.toLowerCase(), nom: '<i>Bob</i>' });
  assert.equal(a.dernier('debut'), undefined);
  assert.deepEqual(b.dernier('salon').noms, ['Alice', 'iBob/i']);
  a.dit({ t: 'equipe', equipe: 'givreval' });
  b.dit({ t: 'equipe', equipe: 'givreval' });
  assert.match(b.dernier('erreur').msg, /déjà pris/);
  b.dit({ t: 'equipe', equipe: 'valrose' });
  b.dit({ t: 'pret' });
  assert.deepEqual(a.dernier('salon').prets, [false, false], 'pas prêt sans club (un club de basket ne compte pas)');
  b.dit({ t: 'equipe', equipe: 'corail' });
  b.dit({ t: 'pret' });
  a.dit({ t: 'pret' });
  const da = a.dernier('debut'), db = b.dernier('debut');
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.equipes, ['givreval', 'corail']);
  assert.equal(da.stade, 'gymnase');
  a.dit({ t: 'stade', stade: 'palais' });
  assert.equal(b.dernier('stade').stade, 'arene', 'une salle inconnue devient l’Arène');
  a.dit({ t: 'entrees', f: 4, e: [T.R | T.d, T.G | T.S, 0x7ff], fc: 3, vu: 1, av: 0 });
  assert.deepEqual(b.dernier('entrees').e, [T.R | T.d, T.G | T.S, 0x3ff]);
  assert.equal(a.dernier('entrees'), undefined);
  assert.equal(serveur.enPartie(a.conn), true);
  serveur.handleAway(b.conn);
  assert.equal(a.dernier('absent').nom, 'iBob/i');
  serveur.handleResume(b.conn);
  assert.ok(a.dernier('revenu'));
  const avant = a.recu.filter((m) => m.t === 'debut').length;
  a.dit({ t: 'revanche' }); b.dit({ t: 'revanche' });
  assert.equal(a.recu.filter((m) => m.t === 'debut').length, avant + 1);
  b.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti'));
});

test('l’équilibre : chaque club gagne entre 35 et 65 % de ses matchs', { timeout: 300000 }, () => {
  const P = 60;
  const v = {}, j = {};
  for (const e of EQUIPES) { v[e.id] = 0; j[e.id] = 0; }
  let g = 1;
  for (let r = 0; r < P / 2; r++) {
    for (let a = 0; a < 16; a++) {
      const b = (a + 1 + ((r * 5) % 15)) % 16;
      const A = EQUIPES[a].id, B = EQUIPES[b === a ? (a + 1) % 16 : b].id;
      const m = simuler({ equipes: r % 2 ? [B, A] : [A, B], graine: g++ * 7919, minutes: 1 });
      const [x, y] = [m.equipes[0].id, m.equipes[1].id];
      j[x]++; j[y]++; v[m.vainqueur === 0 ? x : y]++;
    }
  }
  for (const e of EQUIPES) {
    const t = v[e.id] / j[e.id];
    assert.ok(t >= 0.35 && t <= 0.65, `${e.nom} : ${Math.round(t * 100)} %`);
  }
});
