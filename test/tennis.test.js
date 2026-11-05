/**
 * REVERS — le moteur du tennis : les seize joueurs, le déterminisme, le comptage (égalité, avantage, jeux,
 * tie-break, sets), le service (le lancer, la frappe, la faute, la double faute), un match qui va au bout,
 * les niveaux de l'ordinateur, le tournoi, l'entraînement, le jeu en ligne et l'équilibre des joueurs (on peut
 * le sauter avec --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, donnerPoint, pointsTexte, enjeu, reglerEntrainement, T, LONG } from '../public/shared/tennis/match.js';
import { creerTournoi, matchDuJoueur, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement } from '../public/shared/tennis/tournoi.js';
import { JOUEURS, JOUEUR, STYLES, noteGenerale } from '../public/shared/tennis/joueurs.js';
import { creerSession, FENETRE } from '../public/shared/rollback.js';
import * as serveur from '../server/tennis.js';
import { delaiSelonPing, REGLAGES } from '../public/games/plein-stade/tennis/js/enligne.js';

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
      if (R() < 0.45) m |= [T.A, T.B, T.X, T.G][Math.floor(R() * 4)];
    }
    return m;
  };
}

test('les seize joueurs : inventés, complets, des styles connus', () => {
  assert.equal(JOUEURS.length, 16);
  assert.equal(new Set(JOUEURS.map((x) => x.id)).size, 16);
  for (const x of JOUEURS) {
    assert.ok(STYLES[x.style], x.nom);
    assert.ok(x.surnom && x.ville && x.couleurs.maillot && x.couleurs.raquette);
    for (const v of Object.values(x.notes)) assert.ok(v >= 50 && v <= 99, x.nom);
    assert.ok(noteGenerale(x) >= 70 && noteGenerale(x) <= 90);
  }
});

test('déterministe : même graine, mêmes touches → même match', () => {
  const jouerUn = () => {
    const m = creerMatch({ joueurs: ['valmont', 'nakase'], graine: 9, controles: ['humain', 'ia'] });
    const h = joueurHumain(3);
    const e = [];
    for (let i = 0; i < 8000; i++) { pas(m, [h(), 0]); if (i % 500 === 0) e.push(empreinte(m)); }
    return e;
  };
  assert.deepEqual(jouerUn(), jouerUn());
});

test('le comptage : 15, 30, 40, égalité, avantage, le jeu, et le service qui change', () => {
  const m = creerMatch({ joueurs: ['valmont', 'karsten'], graine: 1, format: 'normal' });
  const s0 = m.serveur;
  donnerPoint(m, 0); assert.deepEqual(pointsTexte(m), ['15', '0']);
  donnerPoint(m, 0); donnerPoint(m, 1); assert.deepEqual(pointsTexte(m), ['30', '15']);
  donnerPoint(m, 0); donnerPoint(m, 1); donnerPoint(m, 1);
  assert.deepEqual(pointsTexte(m), ['40', '40']);
  donnerPoint(m, 1); assert.deepEqual(pointsTexte(m), ['', 'AV']);
  donnerPoint(m, 0); assert.deepEqual(pointsTexte(m), ['40', '40']);
  donnerPoint(m, 0);
  const evs = donnerPoint(m, 0);
  assert.ok(evs.some((e) => e.type === 'jeu' && e.gagnant === 0));
  assert.deepEqual(m.score.jeux, [1, 0]);
  assert.notEqual(m.serveur, s0, 'l’autre sert le jeu suivant');
});

test('le set : 6 jeux avec deux d’écart, sinon le tie-break à 6-6 ; la balle de break, de set, de match', () => {
  const m = creerMatch({ joueurs: ['valmont', 'karsten'], graine: 1, format: 'normal' });
  const jeu = (g) => { for (let k = 0; k < 4; k++) donnerPoint(m, g); };
  for (let k = 0; k < 5; k++) { jeu(0); jeu(1); }
  assert.deepEqual(m.score.jeux, [5, 5]);
  jeu(0); jeu(1);
  assert.equal(m.score.tb, true, 'tie-break à 6-6');
  for (let k = 0; k < 6; k++) donnerPoint(m, 1);
  assert.deepEqual(pointsTexte(m), ['0', '6']);
  assert.deepEqual(enjeu(m), { type: 'match', e: 1 });
  const evs = donnerPoint(m, 1);
  assert.ok(evs.some((e) => e.type === 'fin' && e.vainqueur === 1));
  assert.deepEqual(m.score.sets, [[6, 7]]);
  // La balle de break : le relanceur à un point du jeu.
  const b = creerMatch({ joueurs: ['valmont', 'karsten'], graine: 1, format: 'long' });
  const r = 1 - b.serveur;
  for (let k = 0; k < 3; k++) donnerPoint(b, r);
  assert.deepEqual(enjeu(b), { type: 'break', e: r });
});

test('le service : lancer, frapper en haut ; deux fautes font une double faute', () => {
  const m = creerMatch({ joueurs: ['karsten', 'valmont'], graine: 5, controles: ['humain', 'humain'] });
  m.serveur = m.serveurJeu = 0;
  m.deuxieme = false;
  const sv = m.joueurs[0];
  // Lancer, puis frapper quand la balle redescend vers 2,55 m.
  let evs = pas(m, [T.A, 0]);
  assert.ok(evs.some((e) => e.type === 'lancer'));
  pas(m, [0, 0]);
  while (!(m.balle.vz < 0 && m.balle.z < 2.6)) pas(m, [0, 0]);
  evs = pas(m, [T.A, 0]);
  const f = evs.find((e) => e.type === 'frappe');
  assert.ok(f && f.coup === 'service' && f.qualite > 0.9 && f.vitesse > 120, JSON.stringify(f));
  assert.equal(m.phase, 'jeu');
  // Une faute : la balle tombe hors du carré (on la pousse dehors à la main).
  const n = creerMatch({ joueurs: ['karsten', 'valmont'], graine: 5, controles: ['humain', 'humain'] });
  let fautes = 0, doubles = 0;
  for (let k = 0; k < 2; k++) {
    while (n.phase !== 'service') pas(n, [0, 0]);
    const e = n.serveur;
    const bit = T.A;
    pas(n, e === 0 ? [bit, 0] : [0, bit]);
    pas(n, [0, 0]);
    while (!(n.balle.vz < 0 && n.balle.z < 2.5)) pas(n, [0, 0]);
    pas(n, e === 0 ? [bit, 0] : [0, bit]);
    n.balle.vx = 7 * Math.sign(n.balle.x || 1);
    for (let i = 0; i < 200 && n.phase === 'jeu'; i++) for (const ev of pas(n, [0, 0])) { if (ev.type === 'faute') { fautes += 1; if (ev.double) doubles += 1; } }
  }
  assert.equal(fautes, 2);
  assert.equal(doubles, 1);
  assert.equal(n.stats.doubles[n.serveurJeu], 1);
});

test('un match entre ordinateurs va au bout, avec de vrais échanges', () => {
  const raisons = {};
  let echanges = 0, points = 0;
  for (let g = 1; g <= 4; g++) {
    const m = creerMatch({ joueurs: [JOUEURS[g].id, JOUEURS[g + 5].id], graine: g, controles: ['ia', 'ia'], niveaux: [2, 2] });
    while (m.phase !== 'fin' && m.f < 200000) for (const ev of pas(m)) if (ev.type === 'point') { raisons[ev.raison] = (raisons[ev.raison] || 0) + 1; echanges += ev.echange; points += 1; }
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    assert.equal(m.score.sets.length, 1);
  }
  assert.ok(echanges / points > 3.5, `${(echanges / points).toFixed(1)} frappes par point`);
  assert.ok(raisons.gagnant > 0 && raisons.dehors > 0 && raisons.filet > 0, JSON.stringify(raisons));
});

test('les niveaux : le Fort bat nettement le Facile', () => {
  let v = 0;
  for (let g = 0; g < 8; g++) {
    const id = JOUEURS[g].id;
    if (simuler({ joueurs: [id, id], graine: g * 97 + 5, niveaux: [2, 0] }).vainqueur === 0) v += 1;
  }
  assert.ok(v >= 7, `${v} victoires sur 8`);
});

test('le tournoi : huit joueurs, trois tours, un trophée', () => {
  const c = creerTournoi({ moi: 'valmont', graine: 42 });
  const ids = c.tours[0].flatMap((r) => [r.a, r.b]);
  assert.equal(new Set(ids).size, 8);
  assert.ok(ids.includes('valmont'));
  for (let t = 0; t < 3; t++) {
    const r = matchDuJoueur(c);
    assert.ok(r);
    enregistrer(c, r.i, { sets: [[3, 1]], vainqueur: r.a === c.moi ? 0 : 1 });
    for (const i of aJouer(c)) { const m = jouerSansMoi(c, i); assert.equal(m.phase, 'fin'); assert.ok(c.tours[t][i].v); }
    assert.ok(avancer(c));
  }
  assert.equal(c.fini, true);
  assert.equal(c.champion, 'valmont');
  assert.ok(classement(c.stats, 'jeux').length > 0);
  const d = creerTournoi({ moi: 'obi', graine: 7 });
  const r = matchDuJoueur(d);
  enregistrer(d, r.i, { sets: [[1, 3]], vainqueur: r.a === 'obi' ? 1 : 0 });
  assert.equal(d.elimine, true);
  while (!d.fini) { for (const i of aJouer(d)) jouerSansMoi(d, i); avancer(d); }
  assert.ok(d.champion && d.champion !== 'obi');
  const s = { j: {} };
  noterStats({ stats: s }, resumer(simuler({ joueurs: ['mirza', 'vasko'], graine: 3 })));
  assert.equal(Object.keys(s.j).length, 2);
});

test('l’entraînement : des points sans score ni fin, le serveur choisi', () => {
  const m = creerMatch({ joueurs: ['ferraz', 'okonkwo'], graine: 2, controles: ['ia', 'ia'], entrainement: { serveur: 'lui' } });
  assert.equal(m.serveur, 1);
  let pts = 0;
  for (let i = 0; i < 30000; i++) for (const e of pas(m)) if (e.type === 'point') pts += 1;
  assert.ok(pts > 10);
  assert.notEqual(m.phase, 'fin');
  assert.deepEqual(m.score.jeux, [0, 0]);
  assert.equal(m.serveur, 1, 'toujours lui au service');
  reglerEntrainement(m, { serveur: 'moi', niveau: 0 });
  assert.equal(m.serveur, 0);
  assert.equal(m.joueurs[1].niveau, 0);
});

test('le joueur reste de son côté du filet', () => {
  const m = creerMatch({ joueurs: ['abebe', 'rosier'], graine: 4, controles: ['humain', 'humain'] });
  m.phase = 'jeu';
  for (let i = 0; i < 300; i++) pas(m, [T.h, T.h]);
  assert.ok(m.joueurs[0].y < 0 && m.joueurs[1].y > 0);
  assert.ok(m.joueurs[0].y > -1 && m.joueurs[1].y < 1, 'ils montent au filet');
  for (let i = 0; i < 400; i++) pas(m, [T.b, T.b]);
  assert.ok(m.joueurs[0].y < -LONG && m.joueurs[1].y > LONG, 'ils reculent derrière la ligne');
});

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

function enLigne({ ping, gigue, perte, duree = 20000, derive = 0.003, reglages = {}, delai = 2 }) {
  const R = rng(ping * 13 + 1);
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const m = creerMatch({ joueurs: ['delorme', 'haldor'], graine: 777, controles: ['humain', 'humain'] });
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
  const m = creerMatch({ joueurs: ['delorme', 'haldor'], graine: 777, controles: ['humain', 'humain'] });
  for (let f = 0; f < jusqua; f++) pas(m, [Math.floor(conf[f] / 1024), conf[f] % 1024]);
  return m;
}

for (const [nom, reseau] of [
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 150 ms, ça varie, 5 % de pertes', { ping: 150, gigue: 80, perte: 0.05 }],
  ['gros ping (300 ms jusqu’à l’autre), réglages du tennis', { ping: 600, gigue: 120, perte: 0.03, reglages: REGLAGES, delai: delaiSelonPing(300) }],
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
  const conn = { id: `t${++idClient}`, send: (m) => recu.push(m), close() {} };
  serveur.handleOpen(conn);
  return { conn, recu, dit: (m) => serveur.handleMessage(conn, m), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('le serveur : une salle, les joueurs choisis (jamais le même), la surface, la même graine, le retour au salon', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', nom: 'Alice', stade: 'terre-normal' });
  const { code } = a.dernier('salle');
  assert.equal(a.dernier('salle').g, 'tennis');
  assert.equal(a.dernier('salle').stade, 'terre-normal');
  b.dit({ t: 'rejoindre', code, nom: 'Bob' });
  a.dit({ t: 'equipe', equipe: 'valmont' });
  b.dit({ t: 'equipe', equipe: 'valmont' });
  assert.match(b.dernier('erreur').msg, /déjà pris/);
  b.dit({ t: 'equipe', equipe: 'morvan' });
  b.dit({ t: 'pret' });
  assert.deepEqual(a.dernier('salon').prets, [false, false], 'un boxeur n’est pas un joueur de tennis');
  b.dit({ t: 'equipe', equipe: 'nakase' });
  b.dit({ t: 'pret' });
  a.dit({ t: 'stade', stade: 'lune-n’importe' });
  assert.equal(a.dernier('stade').stade, 'dur-court');
  a.dit({ t: 'pret' });
  const da = a.dernier('debut'), db = b.dernier('debut');
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.equipes, ['valmont', 'nakase']);
  a.dit({ t: 'entrees', f: 4, e: [T.A | T.d, T.G | T.b], fc: 3, vu: 1, av: 0 });
  assert.deepEqual(b.dernier('entrees').e, [T.A | T.d, T.G | T.b]);
  const avant = a.recu.length;
  b.dit({ t: 'retour' });
  assert.ok(a.recu.slice(avant).some((m) => m.t === 'salon'), 'retour au salon pour les deux');
  b.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti'));
});

test('équilibre : chaque joueur gagne entre 30 et 70 % de ses matchs', () => {
  // Chacun rencontre chacun des autres deux fois de chaque côté (format court, niveau Fort) : 60 matchs par joueur.
  const ids = JOUEURS.map((x) => x.id);
  const v = Object.fromEntries(ids.map((id) => [id, 0]));
  let g = 1;
  for (const a of ids) for (const b of ids) for (let k = 0; k < 2; k++) {
    if (a === b) continue;
    const m = simuler({ joueurs: [a, b], graine: (g++) * 7919, niveaux: [2, 2] });
    v[m.vainqueur === 0 ? a : b] += 1;
  }
  for (const id of ids) {
    const t = v[id] / ((ids.length - 1) * 4);
    assert.ok(t <= 0.7, `${JOUEUR[id].nom} gagne ${(t * 100).toFixed(0)} %`);
    assert.ok(t >= 0.3, `${JOUEUR[id].nom} ne gagne que ${(t * 100).toFixed(0)} %`);
  }
});
