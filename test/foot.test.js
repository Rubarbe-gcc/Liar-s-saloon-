/**
 * PETIT PONT — le moteur du foot à cinq : le déterminisme (le jeu en ligne en
 * dépend), les buts, les passes et le joueur dirigé, les tirs au but,
 * l'équilibre des dix équipes, la Coupe, le rollback sur un faux réseau et
 * le serveur qui relaie.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, T, DEMI_L, DEMI_W, DEMI_BUT, BUT_P, CHARGE_MAX } from '../public/shared/foot/match.js';
import { EQUIPES, EQUIPE, STYLES, STADES, notesJoueur } from '../public/shared/foot/equipes.js';
import { creerCoupe, matchDuJoueur, enregistrer, jouerSansMoi, aJouer, avancer } from '../public/shared/foot/coupe.js';
import { creerSession, FENETRE } from '../public/shared/rollback.js';
import * as foot from '../server/foot.js';

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
      if (R() < 0.25) m |= [T.A, T.B, T.X][Math.floor(R() * 3)];
    }
    return m;
  };
}
const jouerImages = (m, n, a, b) => { for (let i = 0; i < n; i++) pas(m, [a(), b()]); };

/* ------------------------------------------------------------------ */

test('les dix équipes : complètes, toutes différentes, des notes sensées', () => {
  assert.equal(EQUIPES.length, 10);
  assert.equal(new Set(EQUIPES.map((e) => e.id)).size, 10);
  assert.equal(new Set(EQUIPES.map((e) => e.abr)).size, 10);
  assert.equal(new Set(EQUIPES.map((e) => e.nom)).size, 10);
  for (const e of EQUIPES) {
    assert.equal(e.joueurs.length, 5, e.id);
    assert.ok(STYLES[e.style], `${e.id} : style ${e.style}`);
    for (const k of ['vitesse', 'tir', 'passe', 'defense', 'gardien']) assert.ok(e.notes[k] >= 60 && e.notes[k] <= 95, `${e.id}.${k}`);
    for (let i = 0; i < 5; i++) for (const v of Object.values(notesJoueur(e, i))) assert.ok(v >= 30 && v <= 99);
    for (const c of [e.maillot.fond, e.exterieur.fond, e.gardien, e.ecusson.fond]) assert.match(c, /^#[0-9a-f]{6}$/i);
  }
  assert.equal(STADES.length, 4);
});

test('un match se joue jusqu’au bout, le ballon reste entre les bandes', () => {
  const m = creerMatch({ equipes: ['ferrac', 'corail'], graine: 11, minutes: 1.5, controles: ['ia', 'ia'] });
  let sorti = 0;
  while (m.phase !== 'fin' && m.f < 20000) {
    pas(m, [0, 0]);
    const b = m.ballon;
    if (Math.abs(b.y) > DEMI_W + 0.01 || Math.abs(b.x) > DEMI_L + BUT_P + 0.01 || b.z < -0.01) sorti += 1;
    if (Math.abs(b.x) > DEMI_L + 0.01 && Math.abs(b.y) > DEMI_BUT + 0.01) sorti += 1;
    for (const p of m.joueurs) if (Math.abs(p.x) > DEMI_L || Math.abs(p.y) > DEMI_W) sorti += 1;
  }
  assert.equal(m.phase, 'fin');
  assert.equal(sorti, 0, 'personne ne sort du terrain');
  assert.equal(m.mi, 2, 'deux mi-temps');
  assert.equal(m.buts.length, m.score[0] + m.score[1]);
  assert.ok(m.stats.passes[0] + m.stats.passes[1] > 20, 'on se passe le ballon');
  assert.ok(m.stats.tirs[0] + m.stats.tirs[1] > 3, 'on tire');
});

test('déterministe : même graine, mêmes touches, même match (même après une copie de l’état)', () => {
  const fab = () => creerMatch({ equipes: ['valombre', 'kerbrume'], graine: 99, minutes: 1, controles: ['humain', 'humain'] });
  const A = fab(), B = fab();
  const a1 = joueurHumain(1), b1 = joueurHumain(2), a2 = joueurHumain(1), b2 = joueurHumain(2);
  jouerImages(A, 900, a1, b1);
  jouerImages(B, 900, a2, b2);
  assert.equal(empreinte(A), empreinte(B));
  assert.deepEqual(A, B);
  // Une copie (comme le rollback en fait) continue exactement pareil.
  const C = structuredClone(A);
  const a3 = joueurHumain(3), b3 = joueurHumain(4), a4 = joueurHumain(3), b4 = joueurHumain(4);
  jouerImages(A, 1500, a3, b3);
  jouerImages(C, 1500, a4, b4);
  assert.deepEqual(A, C);
  // Une autre graine : un autre match.
  const D = creerMatch({ equipes: ['valombre', 'kerbrume'], graine: 100, minutes: 1, controles: ['humain', 'humain'] });
  jouerImages(D, 900, joueurHumain(1), joueurHumain(2));
  assert.notEqual(empreinte(D), empreinte(B));
});

/** Un match arrêté sur une action : le joueur dirigé de l'équipe 0 a le ballon en (x, y). */
function action(x, y, { gardienLoin = false } = {}) {
  const m = creerMatch({ equipes: ['brisevent', 'ferrac'], graine: 5, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  const p = m.joueurs[4];
  Object.assign(p, { x, y, dx: 1, dy: 0, vx: 0, vy: 0 });
  // Les adversaires (et notre propre équipe) restent loin de l'action.
  for (const q of m.joueurs) if (q !== p) Object.assign(q, { x: q.e === 0 ? -15 : -12, y: (q.i - 2) * 3 });
  if (gardienLoin) Object.assign(m.joueurs[5], { x: DEMI_L - 5.9, y: -4 });
  else Object.assign(m.joueurs[5], { x: DEMI_L - 0.6, y: 0 });
  Object.assign(m.ballon, { x: x + 0.4, y, z: 0, porteur: p.id, dernier: p.id });
  m.equipes[0].actif = p.id;
  return { m, p };
}

test('un tir cadré, sans gardien devant : but ; puis l’équipe qui a encaissé engage', () => {
  const { m, p } = action(13, 0, { gardienLoin: true });
  // Le gardien est figé hors de sa ligne (on l'empêche de revenir).
  const g = m.joueurs[5];
  pas(m, [T.B, 0]);
  for (let i = 0; i < 20; i++) pas(m, [T.B, 0]);
  const evs = [];
  for (let i = 0; i < 90 && m.phase === 'jeu'; i++) { Object.assign(g, { x: DEMI_L - 5.9, y: -4, vx: 0, vy: 0 }); evs.push(...pas(m, [0, 0])); }
  assert.ok(evs.some((e) => e.type === 'tir'), 'il a tiré');
  assert.equal(m.phase, 'but');
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.buts[0].j, p.id, 'le buteur');
  assert.equal(m.buts[0].e, 0);
  // Après la fête, coup d'envoi pour l'équipe qui a encaissé.
  for (let i = 0; i < 600 && m.phase === 'but'; i++) pas(m, [0, 0]);
  assert.equal(m.phase, 'engagement');
  assert.equal(m.ballon.porteur, 9, 'l’attaquant adverse a le ballon au centre');
  assert.ok(Math.abs(m.ballon.x) < 0.01 && Math.abs(m.ballon.y) < 0.01);
});

test('la frappe se charge : plus on tient, plus elle part fort', () => {
  const vitesse = (n) => {
    const { m } = action(0, 0);
    pas(m, [T.B, 0]);
    for (let i = 1; i < n; i++) pas(m, [T.B, 0]);
    pas(m, [0, 0]);
    const b = m.ballon;
    return Math.hypot(b.vx, b.vy);
  };
  const faible = vitesse(6), forte = vitesse(CHARGE_MAX);
  assert.ok(forte > faible + 6, `${faible.toFixed(1)} → ${forte.toFixed(1)} m/s`);
});

test('une passe part vers le coéquipier visé, et le joueur dirigé devient le receveur', () => {
  const { m, p } = action(0, 0);
  // Un coéquipier en haut, un autre en bas : on pousse vers le haut (h).
  Object.assign(m.joueurs[3], { x: 2, y: 6 });
  Object.assign(m.joueurs[2], { x: 2, y: -6 });
  // Appuyer charge la passe ; elle part quand on lâche.
  assert.ok(!pas(m, [T.h | T.A, 0]).some((e) => e.type === 'passe'), 'pas encore partie');
  const evs = pas(m, [T.h, 0]);
  const passe = evs.find((e) => e.type === 'passe');
  assert.ok(passe, 'la passe est partie');
  assert.equal(passe.joueur, p.id);
  assert.equal(passe.cible, 3);
  assert.equal(m.equipes[0].actif, 3, 'on dirige le receveur');
  assert.ok(m.ballon.vy > 0, 'vers le haut');
  // Le ballon arrive (le receveur va à sa rencontre tout seul).
  let recu = false;
  for (let i = 0; i < 120 && !recu; i++) recu = pas(m, [0, 0]).some((e) => e.type === 'controle' && e.joueur === 3);
  assert.ok(recu, 'il contrôle le ballon');
});

test('la passe se charge aussi : tenue longtemps, elle part plus vite', () => {
  const vitesse = (n) => {
    const { m } = action(0, 0);
    Object.assign(m.joueurs[3], { x: 8, y: 0 });
    for (let i = 0; i < n; i++) pas(m, [T.d | T.A, 0]);
    pas(m, [0, 0]);
    return Math.hypot(m.ballon.vx, m.ballon.vy);
  };
  const douce = vitesse(1), forte = vitesse(30);
  assert.ok(douce > 0 && forte > douce * 1.3, `${douce.toFixed(1)} → ${forte.toFixed(1)} m/s`);
});

test('en défense : B fait un tacle glissé, A change de joueur', () => {
  const m = creerMatch({ equipes: ['brisevent', 'ferrac'], graine: 5, controles: ['humain', 'ia'] });
  m.phase = 'jeu';
  // L'adversaire a le ballon.
  const a = m.joueurs[9];
  Object.assign(a, { x: 0, y: 0 });
  Object.assign(m.ballon, { x: 0.4, y: 0, porteur: 9 });
  m.equipes[0].actif = 1;
  const avant = m.equipes[0].actif;
  const evs = pas(m, [T.A, 0]);
  assert.ok(evs.some((e) => e.type === 'changer'));
  assert.notEqual(m.equipes[0].actif, avant);
  const p = m.joueurs[m.equipes[0].actif];
  pas(m, [0, 0]);
  pas(m, [T.B | T.d, 0]);
  assert.equal(p.etat, 'tacle');
});

test('tirs au but : en cas d’égalité, il y a toujours un vainqueur', () => {
  let vus = 0;
  for (let g = 1; g <= 6; g++) {
    const m = creerMatch({ equipes: ['cimes', 'corail'], graine: g, minutes: 0.05, controles: ['ia', 'ia'], tab: true });
    let tab = false;
    while (m.phase !== 'fin' && m.f < 30000) { pas(m, [0, 0]); tab ||= m.phase === 'tab'; }
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    if (tab) {
      vus += 1;
      const [x, y] = m.tab.buts.map((r) => r.filter(Boolean).length);
      assert.notEqual(x, y, 'les tirs au but départagent');
      assert.equal(m.vainqueur, x > y ? 0 : 1);
    }
  }
  assert.ok(vus >= 1, 'au moins un match est allé aux tirs au but');
});

test('équilibre : aucune équipe ne gagne plus de 65 % de ses matchs', () => {
  // Chaque équipe reçoit chacune des autres (deux mi-temps de 2 min) ; un nul compte pour une demi-victoire.
  const ids = EQUIPES.map((e) => e.id);
  const pts = Object.fromEntries(ids.map((id) => [id, 0]));
  let g = 1;
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const m = simuler({ equipes: [a, b], graine: (g++) * 7919, minutes: 2 });
    if (m.score[0] > m.score[1]) pts[a] += 1;
    else if (m.score[1] > m.score[0]) pts[b] += 1;
    else { pts[a] += 0.5; pts[b] += 0.5; }
  }
  for (const id of ids) {
    const taux = pts[id] / 18;
    assert.ok(taux <= 0.65, `${EQUIPE[id].nom} gagne ${(taux * 100).toFixed(0)} %`);
    assert.ok(taux >= 0.2, `${EQUIPE[id].nom} ne gagne que ${(taux * 100).toFixed(0)} %`);
  }
});

test('la Coupe : quarts, demies, finale, un champion', () => {
  const c = creerCoupe({ moi: 'lune-rousse', graine: 3, minutes: 1 });
  assert.equal(c.tours[0].length, 4);
  assert.equal(new Set(c.tours[0].flatMap((r) => [r.a, r.b])).size, 8);
  assert.ok(c.tours[0].some((r) => r.a === 'lune-rousse' || r.b === 'lune-rousse'));
  // Le joueur gagne tout.
  while (!c.fini) {
    const r = matchDuJoueur(c);
    assert.ok(r);
    enregistrer(c, r.i, { score: [2, 1], tab: null, vainqueur: r.a === c.moi ? 0 : 1 });
    for (const i of aJouer(c)) jouerSansMoi(c, i);
    assert.ok(avancer(c));
  }
  assert.equal(c.champion, 'lune-rousse');
  assert.equal(c.tours.length, 3);
  // Un autre : éliminé d'entrée, la Coupe continue sans lui.
  const d = creerCoupe({ moi: 'ferrac', graine: 8, minutes: 1 });
  const r = matchDuJoueur(d);
  enregistrer(d, r.i, { score: [0, 0], tab: [3, 4], vainqueur: r.a === 'ferrac' ? 1 : 0 });
  assert.ok(d.elimine);
  while (!d.fini) { for (const i of aJouer(d)) jouerSansMoi(d, i); avancer(d); }
  assert.ok(d.champion && d.champion !== 'ferrac');
  assert.equal(matchDuJoueur(d), null);
});

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

function enLigne({ ping, gigue, perte, duree = 20000, derive = 0.003 }) {
  const R = rng(ping * 13 + 1);
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const m = creerMatch({ equipes: ['sol-dambre', 'vertefeuille'], graine: 777, minutes: 3, controles: ['humain', 'humain'], tab: true });
    const s = creerSession({ n, delai: 2, etat: m, pas: (e, x) => pas(e, x), empreinte, confirme: (f, e) => conf[n].push(e[0] * 256 + e[1]) });
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
  const m = creerMatch({ equipes: ['sol-dambre', 'vertefeuille'], graine: 777, minutes: 3, controles: ['humain', 'humain'], tab: true });
  for (let f = 0; f < jusqua; f++) pas(m, [Math.floor(conf[f] / 256), conf[f] % 256]);
  return m;
}

for (const [nom, reseau] of [
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 150 ms, ça varie, 5 % de pertes', { ping: 150, gigue: 80, perte: 0.05 }],
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
    assert.ok(A.stats.rejouees / Math.max(1, A.stats.retours) <= FENETRE, 'des corrections courtes');
  });
}

/* ------------------------------------------------------------------ */
/* Le serveur                                                          */
/* ------------------------------------------------------------------ */

let id = 0;
function client() {
  const recu = [];
  const conn = { id: `f${++id}`, send: (m) => recu.push(m), close() {} };
  foot.handleOpen(conn);
  return { conn, recu, dit: (m) => foot.handleMessage(conn, m), dernier: (t) => [...recu].reverse().find((m) => m.t === t) };
}

test('le serveur : une salle, la même graine, l’hôte choisit le stade, il relaie les touches', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', equipe: 'kerbrume', nom: 'Alice', stade: 'plage' });
  const { code, stade } = a.dernier('salle');
  assert.match(code, /^[A-Z2-9]{4}$/);
  assert.equal(stade, 'plage');
  // Seul l'hôte change le stade ; un stade inconnu devient le Chaudron.
  a.dit({ t: 'stade', stade: 'toit' });
  assert.equal(a.dernier('stade').stade, 'toit');
  b.dit({ t: 'rejoindre', code: code.toLowerCase(), equipe: 'inconnue', nom: '<i>Bob</i>' });
  const da = a.dernier('debut'), db = b.dernier('debut');
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.equipes, ['kerbrume', 'brisevent'], 'une équipe inconnue : la première');
  assert.deepEqual(db.noms, ['Alice', 'iBob/i']);
  assert.equal(da.stade, 'toit');
  const nb = a.recu.length;
  b.dit({ t: 'stade', stade: 'halle' });
  assert.equal(a.recu.length, nb, 'l’invité ne choisit pas');
  a.dit({ t: 'stade', stade: 'lune' });
  assert.equal(b.dernier('stade').stade, 'chaudron');
  // Les touches : 8 bits, relayées à l'autre seulement.
  a.dit({ t: 'entrees', f: 4, e: [T.A | T.d, 0x1ff], fc: 3, vu: 1, av: 0 });
  assert.deepEqual(b.dernier('entrees').e, [T.A | T.d, 0xff]);
  assert.equal(a.dernier('entrees'), undefined);
  // La revanche, puis le départ.
  const avant = a.recu.filter((m) => m.t === 'debut').length;
  a.dit({ t: 'revanche' }); b.dit({ t: 'revanche' });
  assert.equal(a.recu.filter((m) => m.t === 'debut').length, avant + 1);
  b.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti'));
});
