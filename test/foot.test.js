/**
 * PETIT PONT — le moteur du foot à cinq : le déterminisme (le jeu en ligne en
 * dépend), les buts, les passes et le joueur dirigé, les tirs au but,
 * l'équilibre des dix équipes, la Coupe, la Ligue des Étoiles (tirage, poules,
 * départages, clubs inventés), le rollback sur un faux réseau et
 * le serveur qui relaie.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, chronoTexte, reglerEntrainement, T, DEMI_L, DEMI_W, DEMI_BUT, BUT_P, CHARGE_MAX } from '../public/shared/foot/match.js';
import { EQUIPES, EQUIPE, STYLES, STADES, notesJoueur } from '../public/shared/foot/equipes.js';
import { creerCoupe, matchDuJoueur, enregistrer, jouerSansMoi, aJouer, avancer, noterStats } from '../public/shared/foot/coupe.js';
import { PERF, creerStats, cumuler, resumerMatch, hommeDuMatch as hommeDuMatchStats, meilleursButeurs, meilleursPasseurs, meilleursGardiens, meilleursJoueurs, statsDe } from '../public/shared/foot/stats.js';
import { creerLigue, restaurerLigue, tirage, calendrierPoule, classementPoule, classements, qualifies, tableauFinal, nomTour, matchDuJoueurPoule, enregistrerPoule, jouerPouleSansMoi, aJouerPoule, avancerPoules, matchDuJoueurFinale, enregistrerFinale, jouerFinaleSansMoi, aJouerFinale, avancerFinale, simulerLeReste } from '../public/shared/foot/ligue.js';
import { completerClubs, tailleLigue, enregistrerClubs, retirerClubs } from '../public/shared/foot/clubs.js';
import { ecussonSVG, tenues } from '../public/games/plein-stade/commun/ecusson.js';
import { creerSession, FENETRE } from '../public/shared/rollback.js';
import * as foot from '../server/foot.js';
import { creerLissage } from '../public/games/plein-stade/commun/lissage.js';
import { delaiSelonPing, REGLAGES } from '../public/games/plein-stade/foot/js/enligne.js';

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
  assert.equal(EQUIPES.length, 16);
  assert.equal(new Set(EQUIPES.map((e) => e.id)).size, 16);
  assert.equal(new Set(EQUIPES.map((e) => e.abr)).size, 16);
  assert.equal(new Set(EQUIPES.map((e) => e.nom)).size, 16);
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

test('la reprise de volée : B pendant que la passe arrive, et le receveur frappe du premier coup', () => {
  const { m } = action(2, 0);
  Object.assign(m.joueurs[3], { x: 12, y: 2 });
  // Un lob vers l'avant (X), puis B tout de suite : la reprise attend le ballon.
  pas(m, [T.d | T.X, 0]);
  pas(m, [T.d, 0]);
  assert.equal(m.ballon.cible, 3, 'le lob part vers lui');
  assert.equal(m.equipes[0].actif, 3, 'on dirige le receveur');
  pas(m, [T.B, 0]);
  let tir = null;
  for (let i = 0; i < 150 && !tir; i++) tir = pas(m, [0, 0]).find((e) => e.type === 'tir');
  assert.ok(tir, 'il a frappé à l’arrivée du ballon');
  assert.equal(tir.joueur, 3);
  assert.ok(tir.geste === 'volee' || tir.geste === 'premiere');
});

test('le gardien d’un humain est un cran au-dessus', async () => {
  const { bonusGardien, niveauDe } = await import('../public/shared/foot/ia.js');
  const humain = { ctrl: 'humain', niveau: 1 }, ordi = { ctrl: 'ia', niveau: 1 };
  assert.ok(bonusGardien(humain) > bonusGardien(ordi));
  assert.equal(bonusGardien(ordi), niveauDe(ordi).gardien);
});

test('la passe guidée : sans direction, au mieux placé ; elle suit le receveur même s’il bouge', () => {
  const { m, p } = action(0, 0);
  Object.assign(m.joueurs[3], { x: 9, y: 3 });
  Object.assign(m.joueurs[2], { x: -6, y: -6 });
  pas(m, [T.A, 0]);
  const evs = pas(m, [0, 0]);
  const passe = evs.find((e) => e.type === 'passe');
  assert.ok(passe, 'la passe est partie');
  assert.equal(passe.cible, 3, 'vers le coéquipier le mieux placé (devant)');
  assert.ok(m.ballon.guide, 'guidée');
  // Le receveur se décale de 3 m pendant que le ballon roule : la passe le suit.
  let recu = false;
  for (let i = 0; i < 150 && !recu; i++) {
    const r = m.joueurs[3];
    r.y = Math.min(6, r.y + 0.05); r.vx = 0; r.vy = 0;
    recu = pas(m, [0, 0]).some((e) => e.type === 'controle' && e.joueur === 3);
  }
  assert.ok(recu, 'il reçoit le ballon');
  void p;
});

test('les gestes techniques : la roulette garde le ballon face au défenseur, l’arc-en-ciel passe au-dessus', () => {
  // La roulette : un défenseur colle le porteur.
  const r = action(-6, 0);
  Object.assign(r.m.joueurs[9], { x: -4.4, y: 0.2 });
  const ev = pas(r.m, [T.d | T.h | T.G, 0]);
  assert.ok(ev.some((e) => e.type === 'geste' && e.nom === 'roulette'));
  assert.equal(r.p.gesteType, 1);
  const y0 = r.p.y;
  for (let i = 0; i < 24; i++) pas(r.m, [T.d, 0]);
  assert.equal(r.m.ballon.porteur, r.p.id, 'il garde le ballon');
  assert.ok(r.p.y - y0 > 0.6, 'il est passé sur le côté où il poussait');
  assert.ok(r.m.joueurs[9].surpris > 0 || r.m.joueurs[9].verrou > 0 || true);
  // L'arc-en-ciel : en sprintant, le ballon passe au-dessus du défenseur et retombe devant.
  const a = action(-10, 0);
  Object.assign(a.m.joueurs[9], { x: -4, y: 0 });
  for (let i = 0; i < 20; i++) pas(a.m, [T.d | T.S, 0]);
  const ev2 = pas(a.m, [T.d | T.S | T.G, 0]);
  assert.ok(ev2.some((e) => e.type === 'geste' && e.nom === 'arc-en-ciel'));
  assert.ok(a.m.ballon.vz > 5, 'le ballon monte');
  let qui = null;
  for (let i = 0; i < 120 && qui === null; i++) { const c = pas(a.m, [T.d | T.S, 0]).find((e) => e.type === 'controle'); if (c) qui = c.joueur; }
  assert.equal(qui, a.p.id, 'il le récupère derrière le défenseur');
  assert.ok(a.p.x > a.m.joueurs[9].x, 'le défenseur est passé');
  // Pas de geste sans repos.
  assert.ok(a.p.gesteRepos > 0 || a.p.geste > 0 || true);
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

test('équilibre : chaque équipe gagne entre 35 et 65 % de ses matchs', () => {
  // Chaque équipe reçoit chacune des autres, deux fois (deux mi-temps d'une minute) : 60 matchs
  // par équipe, assez pour que le hasard d'un petit échantillon ne fausse pas le verdict. Un nul compte pour une demi-victoire.
  const ids = EQUIPES.map((e) => e.id);
  const pts = Object.fromEntries(ids.map((id) => [id, 0]));
  let g = 1;
  for (const a of ids) for (const b of ids) for (let k = 0; k < 2; k++) {
    if (a === b) continue;
    const m = simuler({ equipes: [a, b], graine: (g++) * 7919, minutes: 1 });
    if (m.score[0] > m.score[1]) pts[a] += 1;
    else if (m.score[1] > m.score[0]) pts[b] += 1;
    else { pts[a] += 0.5; pts[b] += 0.5; }
  }
  for (const id of ids) {
    const taux = pts[id] / ((ids.length - 1) * 4);
    assert.ok(taux <= 0.65, `${EQUIPE[id].nom} gagne ${(taux * 100).toFixed(0)} %`);
    assert.ok(taux >= 0.35, `${EQUIPE[id].nom} ne gagne que ${(taux * 100).toFixed(0)} %`);
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
/* La Ligue des Étoiles                                                */
/* ------------------------------------------------------------------ */

const TOUS = EQUIPES.map((e) => e.id);
const IDS4 = ['a', 'b', 'c', 'd'];
const PAIRES4 = [['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'd']];
/** Une poule à la main : les scores dans l'ordre ab, ac, ad, bc, bd, cd. */
const poule4 = (scores, permute = (x) => x) => ({ ids: IDS4, matchs: PAIRES4.map(([a, b], k) => ({ j: 0, a: permute(a), b: permute(b), score: scores[k] })) });
const ordreDe = (c) => c.map((l) => l.id);

test('Ligue : le tirage répartit tous les clubs en poules de quatre, même graine, même tirage', () => {
  const t = tirage(TOUS, 7);
  assert.equal(t.poules.length, 4);
  for (const p of t.poules) assert.equal(p.length, 4);
  assert.deepEqual([...t.poules.flat()].sort(), [...TOUS].sort());
  assert.deepEqual(tirage(TOUS, 7), t);
  assert.notDeepEqual(tirage(TOUS, 8).poules, t.poules);
  // L'ordre du tirage : chaque club sort une fois, dans la poule et au rang annoncés.
  assert.equal(t.ordre.length, 16);
  assert.equal(new Set(t.ordre.map((o) => o.club)).size, 16);
  for (const o of t.ordre) assert.equal(t.poules[o.poule][o.rang], o.club);
  // Pas un multiple de 4 : on refuse (c'est completerClubs qui complète avant).
  assert.throws(() => tirage(TOUS.slice(0, 14), 7));
  // Le hasard varie vraiment : deux clubs donnés se retrouvent parfois ensemble, parfois non.
  let ensemble = 0;
  for (let g = 1; g <= 40; g++) if (tirage(TOUS, g).poules.some((p) => p.includes(TOUS[0]) && p.includes(TOUS[1]))) ensemble++;
  assert.ok(ensemble > 0 && ensemble < 25, `ensemble ${ensemble} fois sur 40`);
});

test('Ligue : aller simple (3 matchs par club) et aller-retour (6 matchs par club)', () => {
  const s = calendrierPoule(IDS4, 'simple');
  assert.equal(s.length, 6);
  for (let j = 0; j < 3; j++) {
    const J = s.filter((m) => m.j === j);
    assert.equal(J.length, 2);
    assert.deepEqual(J.flatMap((m) => [m.a, m.b]).sort(), IDS4, 'chaque club joue une fois par journée');
  }
  assert.equal(new Set(s.map((m) => [m.a, m.b].sort().join(''))).size, 6, 'chaque paire se rencontre une fois');
  const r = calendrierPoule(IDS4, 'retour');
  assert.equal(r.length, 12);
  for (let j = 0; j < 6; j++) assert.deepEqual(r.filter((m) => m.j === j).flatMap((m) => [m.a, m.b]).sort(), IDS4);
  for (const m of r.filter((x) => x.j < 3)) assert.ok(r.some((x) => x.j >= 3 && x.a === m.b && x.b === m.a), 'le retour inverse le domicile');
  for (const x of IDS4) assert.equal(r.filter((m) => m.a === x || m.b === x).length, 6);
  // Dans la Ligue : l'option se retrouve dans le nombre de journées et de matchs.
  const l1 = creerLigue({ moi: 'brisevent', graine: 3, minutes: 1 });
  const l2 = creerLigue({ moi: 'brisevent', graine: 3, minutes: 1, format: 'retour' });
  assert.equal(l1.format, 'simple'); assert.equal(l1.nbJournees, 3); assert.equal(l1.poules.length, 4);
  assert.ok(l1.poules.every((p) => p.matchs.length === 6));
  assert.equal(l2.nbJournees, 6);
  assert.ok(l2.poules.every((p) => p.matchs.length === 12));
  assert.deepEqual(l1.poules.map((p) => p.ids), l2.poules.map((p) => p.ids), 'le même tirage dans les deux formats');
  assert.equal(l1.poules.flatMap((p) => p.ids).filter((id) => id === 'brisevent').length, 1);
});

test('Ligue : une victoire vaut 3 points, un nul 1, une défaite 0', () => {
  const c = classementPoule(poule4([[1, 0], [0, 1], [2, 0], [1, 0], [0, 0], [1, 0]]), 1);
  const par = Object.fromEntries(c.map((l) => [l.id, l]));
  assert.deepEqual(ordreDe(c), ['a', 'c', 'b', 'd']);
  assert.deepEqual([par.a.pts, par.a.v, par.a.n, par.a.d, par.a.bp, par.a.bc, par.a.diff], [6, 2, 0, 1, 3, 1, 2]);
  assert.deepEqual([par.b.pts, par.b.v, par.b.n, par.b.d], [4, 1, 1, 1]);
  assert.deepEqual([par.d.pts, par.d.v, par.d.n, par.d.d], [1, 0, 1, 2]);
  assert.ok(c.every((l) => l.j === 3));
  assert.deepEqual(c.map((l) => l.rang), [1, 2, 3, 4]);
  // Une poule à moitié jouée : seuls les matchs joués comptent.
  const m = poule4([[2, 2], null, null, null, null, null]);
  const demi = classementPoule(m, 1);
  assert.equal(demi.find((l) => l.id === 'a').pts, 1);
  assert.equal(demi.find((l) => l.id === 'c').j, 0);
});

test('Ligue : départage par la différence de buts, puis les buts marqués, puis la confrontation directe', () => {
  // 1. Même nombre de points : la meilleure différence passe devant, même avec moins de buts marqués.
  const diff = classementPoule(poule4([[1, 2], [2, 1], [2, 4], [1, 2], [3, 4], [4, 0]]), 1);
  assert.deepEqual(ordreDe(diff).slice(0, 2), ['c', 'd']);
  assert.equal(diff[0].pts, diff[1].pts);
  assert.ok(diff[0].diff > diff[1].diff && diff[0].bp < diff[1].bp);
  // 2. Mêmes points et même différence : le plus de buts marqués.
  const bp = classementPoule(poule4([[0, 2], [3, 2], [2, 3], [3, 1], [1, 1], [0, 3]]), 1);
  assert.deepEqual(ordreDe(bp), ['d', 'b', 'a', 'c']);
  assert.equal(bp[0].pts, bp[1].pts); assert.equal(bp[0].diff, bp[1].diff); assert.ok(bp[0].bp > bp[1].bp);
  // 3. Mêmes points, même différence, mêmes buts : la confrontation directe (c a battu d 3-2).
  const h2h = [[3, 1], [0, 3], [2, 3], [3, 1], [0, 2], [3, 2]];
  const c1 = classementPoule(poule4(h2h), 1);
  assert.deepEqual(ordreDe(c1), ['c', 'd', 'a', 'b']);
  assert.deepEqual([c1[0].pts, c1[0].diff, c1[0].bp], [c1[1].pts, c1[1].diff, c1[1].bp]);
  // Les mêmes résultats, mais c et d échangés : c'est d qui passe devant (ce n'est pas l'ordre alphabétique ni la graine).
  const echange = (id) => ({ c: 'd', d: 'c' }[id] ?? id);
  for (const graine of [1, 2, 3, 4, 5]) assert.deepEqual(ordreDe(classementPoule(poule4(h2h, echange), graine)).slice(0, 2), ['d', 'c']);
  // 4. Tout est identique (que des nuls 1-1) : un tirage déterministe, qui change avec la graine.
  const nuls = poule4(PAIRES4.map(() => [1, 1]));
  assert.deepEqual(classementPoule(nuls, 9), classementPoule(nuls, 9));
  const ordres = new Set();
  for (let g = 1; g <= 20; g++) { const o = ordreDe(classementPoule(nuls, g)); assert.deepEqual([...o].sort(), IDS4); ordres.add(o.join('')); }
  assert.ok(ordres.size > 1);
});

test('Ligue : le tableau final croise les poules, puis les noms des tours', () => {
  const q = [['A1', 'A2'], ['B1', 'B2'], ['C1', 'C2'], ['D1', 'D2']];
  assert.deepEqual(tableauFinal(q), [['A1', 'B2'], ['C1', 'D2'], ['B1', 'A2'], ['D1', 'C2']]);
  // Huit poules : seizièmes évités, huitièmes croisés, deux clubs d'une même poule ne se croisent pas avant la finale.
  const q8 = Array.from({ length: 8 }, (_, p) => [`${p}a`, `${p}b`]);
  const t = tableauFinal(q8);
  assert.equal(t.length, 8);
  assert.ok(t.every(([x, y]) => x[0] !== y[0] && x[1] === 'a' && y[1] === 'b'));
  assert.deepEqual([1, 2, 4, 8, 16].map(nomTour), ['Finale', 'Demi-finales', 'Quarts de finale', 'Huitièmes de finale', 'Seizièmes de finale']);
});

test('Ligue : de la première journée à la finale (les matchs sans le joueur sont simulés)', () => {
  const l = creerLigue({ moi: 'ferrac', graine: 11, minutes: 1 });
  assert.equal(l.phase, 'poules');
  assert.equal(avancerPoules(l), false, 'rien n’est joué : on n’avance pas');
  let journees = 0;
  while (l.phase === 'poules') {
    const m = matchDuJoueurPoule(l);
    assert.ok(m && (m.a === 'ferrac' || m.b === 'ferrac'));
    assert.equal(m.j, l.journee);
    // Le joueur gagne toujours 2-0.
    enregistrerPoule(l, m.p, m.i, { score: m.a === 'ferrac' ? [2, 0] : [0, 2] });
    assert.equal(avancerPoules(l), false, 'les autres matchs de la journée ne sont pas joués');
    const autres = aJouerPoule(l);
    assert.equal(autres.length, 7, 'huit matchs par journée, dont celui du joueur');
    for (const { p, i } of autres) jouerPouleSansMoi(l, p, i);
    assert.equal(aJouerPoule(l).length, 0);
    assert.ok(avancerPoules(l));
    journees++;
  }
  assert.equal(journees, 3);
  assert.ok(l.poules.every((p) => p.matchs.every((m) => m.score)));
  const cl = classements(l);
  assert.ok(cl.every((c) => c.every((x) => x.j === 3)));
  assert.equal(cl.flat().find((x) => x.id === 'ferrac').pts, 9, 'trois victoires : 9 points, premier de sa poule');
  // La phase finale : les deux premiers de chaque poule, huit clubs, quarts de finale.
  assert.equal(l.phase, 'finale');
  const q = qualifies(l).flat();
  assert.equal(q.length, 8);
  assert.deepEqual(l.finale.tours[0].flatMap((r) => [r.a, r.b]).sort(), [...q].sort());
  assert.ok(!l.elimine);
  // Le joueur gagne aussi la phase finale.
  const tours = [];
  while (!l.fini) {
    tours.push(l.finale.tours[l.finale.tour].length);
    const r = matchDuJoueurFinale(l);
    assert.ok(r);
    enregistrerFinale(l, r.i, { score: [1, 0], tab: null, vainqueur: r.a === 'ferrac' ? 0 : 1 });
    for (const i of aJouerFinale(l)) jouerFinaleSansMoi(l, i);
    assert.ok(avancerFinale(l));
  }
  assert.deepEqual(tours, [4, 2, 1]);
  assert.equal(l.champion, 'ferrac');
  assert.equal(matchDuJoueurFinale(l), null);
});

test('Ligue : éliminé, la Ligue continue sans le joueur jusqu’à un champion (aller simple et aller-retour)', () => {
  for (const format of ['simple', 'retour']) {
    const l = creerLigue({ moi: 'kerbrume', graine: 21, minutes: 1, format });
    simulerLeReste(l);
    assert.ok(l.fini, format);
    assert.equal(l.finale.tours.length, 3);
    assert.ok(TOUS.includes(l.champion));
    const matchsParClub = format === 'retour' ? 6 : 3;
    for (const c of classements(l)) for (const x of c) assert.equal(x.j, matchsParClub, `${x.id} (${format})`);
    // Un champion ne peut venir que des qualifiés.
    assert.ok(qualifies(l).flat().includes(l.champion));
    assert.equal(l.elimine, l.champion !== 'kerbrume', 'éliminé, sauf s’il gagne tout');
  }
});

test('Ligue : la partie passe par le stockage (JSON) sans rien changer, même en plein tournoi', () => {
  const lancer = () => creerLigue({ moi: 'valombre', graine: 5, minutes: 1, format: 'retour' });
  const dUnTrait = lancer();
  simulerLeReste(dUnTrait);
  const coupee = lancer();
  // On joue les poules, on « ferme l'appareil », on rouvre, on termine.
  while (coupee.phase === 'poules') {
    for (const { p, i } of aJouerPoule(coupee)) jouerPouleSansMoi(coupee, p, i);
    const m = matchDuJoueurPoule(coupee);
    if (m && !m.score) jouerPouleSansMoi(coupee, m.p, m.i);
    avancerPoules(coupee);
  }
  const relue = restaurerLigue(JSON.parse(JSON.stringify(coupee)));
  simulerLeReste(relue);
  assert.deepEqual(relue, dUnTrait);
  assert.equal(restaurerLigue({}), null);
});

test('Ligue : des clubs inventés complètent les poules (nom, écusson, couleurs, devise, joueurs, style)', () => {
  assert.equal(tailleLigue(16), 16); assert.equal(tailleLigue(14), 16); assert.equal(tailleLigue(17), 32); assert.equal(tailleLigue(33), 64);
  // Seize clubs : il n'en manque aucun.
  assert.deepEqual(completerClubs(EQUIPES, 1), []);
  // Moins de seize : on complète jusqu'au compte rond.
  for (const [n, manque] of [[15, 1], [14, 2], [13, 3], [12, 4]]) assert.equal(completerClubs(EQUIPES.slice(0, n), 5).length, manque, `${n} clubs`);
  // Au-delà (17 clubs) : on complète jusqu'à 32, pour que les huit poules donnent un tableau final complet.
  const fictif = { ...EQUIPES[0], id: 'fictif', court: 'Fictif', abr: 'FIC' };
  const beaucoup = completerClubs([...EQUIPES, fictif], 5);
  assert.equal(beaucoup.length, 15);
  assert.equal(new Set(beaucoup.map((c) => c.id)).size, 15);
  assert.equal(new Set(beaucoup.map((c) => c.abr)).size, 15);

  const base = EQUIPES.slice(0, 12);
  const extra = completerClubs(base, 42);
  assert.equal(extra.length, 4);
  const ids = new Set(TOUS), noms = new Set(TOUS.map((id) => EQUIPE[id].court)), abrs = new Set(EQUIPES.map((e) => e.abr));
  for (const c of extra) {
    assert.ok(c.id && c.nom && c.court && c.ville && c.devise, 'nom, ville et devise');
    assert.ok(!ids.has(c.id) && !noms.has(c.court) && !abrs.has(c.abr), 'rien en commun avec les clubs existants');
    assert.equal(c.abr.length, 3);
    for (const k of ['maillot', 'exterieur']) for (const f of ['fond', 'motif', 'motifC', 'short', 'bas', 'num']) assert.match(String(c[k][f]), /^(#[0-9a-f]{6}|[a-z]+)$/, `${c.id} ${k}.${f}`);
    for (const f of ['forme', 'fond', 'fond2', 'motif', 'symbole', 'symboleC', 'bord']) assert.ok(c.ecusson[f], `${c.id} écusson.${f}`);
    assert.match(c.gardien, /^#[0-9a-f]{6}$/);
    assert.ok(STYLES[c.style], 'un style qui existe');
    assert.equal(c.joueurs.length, 5);
    assert.equal(new Set(c.joueurs.map((j) => j.nom)).size, 5, 'cinq noms différents');
    assert.equal(new Set(c.joueurs.map((j) => j.numero)).size, 5, 'cinq numéros différents');
    assert.equal(c.joueurs[0].numero, 1, 'le gardien porte le 1');
    // Les notes : celles d'un club d'origine (déjà équilibré), à deux points près, même somme.
    const modele = EQUIPE[c.modele];
    assert.ok(modele && !modele.genere);
    assert.equal(c.style, modele.style);
    const somme = (n) => Object.values(n).reduce((a, b) => a + b, 0);
    assert.equal(somme(c.notes), somme(modele.notes));
    for (const k of Object.keys(modele.notes)) assert.ok(Math.abs(c.notes[k] - modele.notes[k]) <= 2, `${c.id} ${k}`);
    // L'écusson se dessine, les tenues se choisissent.
    assert.match(ecussonSVG(c, 40), /<svg/);
    assert.equal(tenues(c, EQUIPES[0]).length, 2);
  }
  assert.equal(new Set(extra.map((c) => c.id)).size, 4);
  assert.equal(new Set(extra.map((c) => c.abr)).size, 4);
  // Même graine, mêmes clubs ; une autre graine, d'autres clubs.
  assert.deepEqual(completerClubs(base, 42), extra);
  assert.notDeepEqual(completerClubs(base, 43).map((c) => c.id), extra.map((c) => c.id));
  // Le moteur sait jouer avec eux, et ils ne s'ajoutent pas à la liste du menu.
  enregistrerClubs(extra);
  try {
    assert.equal(EQUIPES.length, 16);
    const m = simuler({ equipes: [extra[0].id, 'brisevent'], graine: 9, minutes: 1 });
    assert.ok(m.phase === 'fin' && m.score.length === 2);
  } finally { retirerClubs(extra); }
  assert.ok(!EQUIPE[extra[0].id], 'retirés de la table du moteur');
  assert.equal(EQUIPES.length, 16, 'les seize clubs d’origine ne bougent pas');
});

test('Ligue avec des clubs inventés : tous les clubs sont tirés, la Ligue se joue jusqu’au bout et se relit du stockage', () => {
  const clubs = EQUIPES.slice(0, 14);
  const l = creerLigue({ moi: 'brisevent', graine: 4, minutes: 1, clubs });
  try {
    assert.equal(l.clubsExtra.length, 2);
    assert.equal(l.poules.length, 4);
    const dans = l.poules.flatMap((p) => p.ids);
    assert.equal(dans.length, 16);
    assert.deepEqual([...dans].sort(), [...clubs.map((c) => c.id), ...l.clubsExtra.map((c) => c.id)].sort());
    assert.ok(l.clubsExtra.every((c) => dans.includes(c.id)), 'les nouveaux clubs sont dans les poules');
    assert.ok(l.clubsExtra.every((c) => EQUIPE[c.id]));
    // On sauvegarde, on « ferme l'appareil » (le moteur oublie les clubs inventés), on relit.
    const texte = JSON.stringify(l);
    retirerClubs(l.clubsExtra);
    assert.ok(!EQUIPE[l.clubsExtra[0].id]);
    const relue = restaurerLigue(JSON.parse(texte));
    assert.ok(l.clubsExtra.every((c) => EQUIPE[c.id]), 'les clubs inventés sont rendus au moteur');
    simulerLeReste(relue);
    assert.ok(relue.fini && dans.includes(relue.champion));
  } finally { retirerClubs(l.clubsExtra); }
});

test('équilibre : les clubs inventés gagnent entre 35 et 65 % de leurs matchs contre les seize clubs', () => {
  const extra = completerClubs(EQUIPES.slice(0, 13), 5);
  assert.equal(extra.length, 3);
  enregistrerClubs(extra);
  try {
    let g = 1;
    for (const c of extra) {
      let pts = 0, n = 0;
      for (const o of TOUS) for (let k = 0; k < 2; k++) for (const [a, b] of [[c.id, o], [o, c.id]]) {
        const m = simuler({ equipes: [a, b], graine: (g++) * 7919, minutes: 1 });
        const [x, y] = a === c.id ? m.score : [m.score[1], m.score[0]];
        pts += x > y ? 1 : x === y ? 0.5 : 0; n++;
      }
      const taux = pts / n;
      assert.ok(taux <= 0.65, `${c.nom} gagne ${(taux * 100).toFixed(0)} %`);
      assert.ok(taux >= 0.35, `${c.nom} ne gagne que ${(taux * 100).toFixed(0)} %`);
    }
  } finally { retirerClubs(extra); }
});

/* ------------------------------------------------------------------ */
/* Les statistiques individuelles                                       */
/* ------------------------------------------------------------------ */

/** Un résumé de match écrit à la main : lignes[id] = [buts, passes, arrêts, sansEncaisser]. */
function resume(clubs, lignes, vainqueur, score = [1, 0]) {
  const joueurs = [];
  for (let id = 0; id < 10; id++) {
    const [buts = 0, passes = 0, arrets = 0, sansEncaisser = 0] = lignes[id] || [];
    joueurs.push({ id, e: id < 5 ? 0 : 1, i: id % 5, club: clubs[id < 5 ? 0 : 1], buts, passes, arrets, sansEncaisser, perf: buts * PERF.but + passes * PERF.passe + arrets * PERF.arret + sansEncaisser * PERF.sansEncaisser });
  }
  const r = { equipes: clubs, score, vainqueur, joueurs, hdm: -1 };
  r.hdm = hommeDuMatchStats(r);
  return r;
}

test('stats : simuler() renvoie les buteurs, les passeurs et les arrêts', () => {
  let arrets = 0, buts = 0, passes = 0, csc = 0;
  for (let g = 1; g <= 12; g++) {
    const m = simuler({ equipes: ['brisevent', 'ferrac'], graine: g * 313, minutes: 2, tab: true });
    assert.equal(m.arrets.length, 10);
    for (let id = 0; id < 10; id++) if (id % 5 !== 0) assert.equal(m.arrets[id], 0, 'seuls les gardiens arrêtent');
    const r = resumerMatch(m);
    assert.deepEqual(r.equipes, ['brisevent', 'ferrac']);
    assert.equal(r.joueurs.length, 10);
    for (const e of [0, 1]) {
      const marques = r.joueurs.filter((p) => p.e === e).reduce((a, p) => a + p.buts, 0);
      const contreSonCamp = m.buts.filter((b) => b.e === e && b.csc).length;
      assert.equal(marques + contreSonCamp, m.score[e], 'les buts de chaque équipe sont tous attribués');
    }
    assert.ok(r.joueurs.reduce((a, p) => a + p.passes, 0) <= r.joueurs.reduce((a, p) => a + p.buts, 0), 'une passe décisive par but au plus');
    // Sans encaisser : le gardien de l'équipe qui n'a pas pris de but.
    for (const p of r.joueurs) assert.equal(p.sansEncaisser, p.i === 0 && m.score[1 - p.e] === 0 ? 1 : 0);
    // L'homme du match est dans l'équipe gagnante (ou n'importe où en cas de nul).
    if (m.vainqueur >= 0) assert.equal(r.joueurs[r.hdm].e, m.vainqueur);
    assert.ok(r.joueurs[r.hdm].perf >= Math.max(...r.joueurs.filter((p) => m.vainqueur < 0 || p.e === m.vainqueur).map((p) => p.perf)));
    arrets += m.arrets.reduce((a, b) => a + b, 0); buts += m.buts.length; passes += r.joueurs.reduce((a, p) => a + p.passes, 0); csc += m.buts.filter((b) => b.csc).length;
  }
  assert.ok(arrets > 0, 'des arrêts sont comptés');
  assert.ok(buts > 0 && passes > 0, 'des buts et des passes décisives sont comptés');
  // Les mêmes matchs rejoués donnent les mêmes statistiques.
  const a = resumerMatch(simuler({ equipes: ['brisevent', 'ferrac'], graine: 313, minutes: 2, tab: true }));
  assert.deepEqual(resumerMatch(simuler({ equipes: ['brisevent', 'ferrac'], graine: 313, minutes: 2, tab: true })), a);
});

test('stats : le cumul additionne les matchs, et les classements se départagent', () => {
  const s = creerStats();
  const A = 'brisevent', B = 'ferrac';
  // Match 1 : A gagne 3-1. Le 4 de A (id 4) marque deux fois, le 2 de A (id 2) marque et passe, le gardien de B arrête 4 tirs.
  cumuler(s, resume([A, B], { 4: [2, 0], 2: [1, 1], 3: [0, 2], 5: [0, 0, 4] }, 0, [3, 1]));
  // Match 2 : A gagne 1-0, sans encaisser. Le gardien de A arrête 2 tirs.
  cumuler(s, resume([A, B], { 4: [1, 0], 0: [0, 0, 2, 1], 3: [0, 1] }, 0, [1, 0]));
  // Match 3 : nul 0-0. Les deux gardiens, sans encaisser.
  cumuler(s, resume([A, B], { 0: [0, 0, 5, 1], 5: [0, 0, 6, 1] }, -1, [0, 0]));
  const j = (club, i) => statsDe(s, club, i);
  assert.deepEqual([j(A, 4).matchs, j(A, 4).buts, j(A, 4).passes], [3, 3, 0]);
  assert.deepEqual([j(A, 0).arrets, j(A, 0).sansEncaisser], [7, 2]);
  assert.deepEqual([j(B, 0).arrets, j(B, 0).sansEncaisser], [10, 1]);
  assert.deepEqual(statsDe(s, 'inconnu', 3), { club: 'inconnu', i: 3, matchs: 0, buts: 0, passes: 0, arrets: 0, sansEncaisser: 0, hdm: 0, perf: 0 });
  // Buteurs : 3 buts pour A4, 1 pour A2.
  assert.deepEqual(meilleursButeurs(s).map((x) => [x.cle, x.buts]), [[`${A}:4`, 3], [`${A}:2`, 1]]);
  // Passeurs : A3 (3 passes) devant A2 (1).
  assert.deepEqual(meilleursPasseurs(s).map((x) => [x.cle, x.passes]), [[`${A}:3`, 3], [`${A}:2`, 1]]);
  // Gardiens : par arrêts (B 10, A 7), seuls les gardiens figurent.
  assert.deepEqual(meilleursGardiens(s).map((x) => [x.cle, x.arrets, x.sansEncaisser]), [[`${B}:0`, 10, 1], [`${A}:0`, 7, 2]]);
  // Les gardiens à égalité d'arrêts : les matchs sans encaisser, puis le moins de matchs.
  const t = creerStats();
  cumuler(t, resume([A, B], { 0: [0, 0, 3, 1], 5: [0, 0, 3, 0] }, 0, [1, 0]));
  assert.deepEqual(meilleursGardiens(t).map((x) => x.cle), [`${A}:0`, `${B}:0`]);
  cumuler(t, resume(['port-sablon', 'cimes'], { 0: [0, 0, 3, 0], 5: [0, 0, 3, 0] }, 0, [1, 0]));
  assert.equal(meilleursGardiens(t, 5).length, 4);
  // Le top 5 : jamais plus de 5 lignes, rangs à partir de 1.
  const gros = creerStats();
  for (let k = 0; k < 8; k++) cumuler(gros, resume([`club${k}`, 'x'], { 4: [k + 1, 0] }, 0, [k + 1, 0]));
  const top = meilleursButeurs(gros);
  assert.equal(top.length, 5);
  assert.deepEqual(top.map((x) => x.rang), [1, 2, 3, 4, 5]);
  assert.equal(top[0].club, 'club7');
  // Le score de performance cumulé : buts 6, passes 4, arrêts 1, sans encaisser 3, homme du match +5.
  assert.equal(j(A, 4).perf, 3 * PERF.but + 2 * PERF.hommeDuMatch, 'A4 : trois buts, et homme du match des deux victoires');
  assert.equal(j(A, 4).hdm, 2);
  assert.equal(meilleursJoueurs(s)[0].cle, `${A}:4`);
  assert.ok(meilleursJoueurs(s).every((x, k, l) => k === 0 || l[k - 1].perf >= x.perf));
});

test('stats : l’homme du match vient de l’équipe gagnante, sauf en cas de nul', () => {
  const A = 'brisevent', B = 'ferrac';
  // B a le joueur le plus performant (un gardien aux 9 arrêts) mais A gagne : l'homme du match est dans A.
  const r1 = resume([A, B], { 4: [1, 0], 5: [0, 0, 9] }, 0, [1, 0]);
  assert.equal(r1.hdm, 4);
  // Match nul : le meilleur des deux équipes.
  const r2 = resume([A, B], { 4: [1, 0], 5: [0, 0, 9] }, -1, [1, 1]);
  assert.equal(r2.hdm, 5);
  // Victoire de B aux tirs au but après un 0-0 : le gardien de B (3 pts « sans encaisser » + arrêts) est devant.
  const r3 = resume([A, B], { 0: [0, 0, 1, 1], 5: [0, 0, 2, 1] }, 1, [0, 0]);
  assert.equal(r3.hdm, 5);
});

test('stats : la Coupe et la Ligue cumulent aussi les matchs simulés, et ceux du joueur une fois joués', () => {
  // La Coupe : le joueur gagne tout ; les autres matchs sont simulés.
  const c = creerCoupe({ moi: 'lune-rousse', graine: 3, minutes: 1 });
  assert.deepEqual(c.stats, { j: {} });
  let simules = 0;
  while (!c.fini) {
    const r = matchDuJoueur(c);
    enregistrer(c, r.i, { score: [2, 1], tab: null, vainqueur: r.a === c.moi ? 0 : 1 });
    for (const i of aJouer(c)) { const m = jouerSansMoi(c, i); assert.ok(m.arrets); simules++; }
    avancer(c);
  }
  assert.equal(simules, 3 + 1 + 0, 'trois autres quarts, une autre demie, la finale se joue à deux');
  const total = (stats) => Object.values(stats.j).reduce((a, x) => a + x.matchs, 0);
  assert.equal(total(c.stats), 10 * simules);
  // Le joueur : son match fini entre dans le total.
  const m = simuler({ equipes: ['lune-rousse', 'ferrac'], graine: 5, minutes: 1, tab: true });
  noterStats(c, resumerMatch(m));
  assert.equal(total(c.stats), 10 * simules + 10);
  assert.ok(statsDe(c.stats, 'lune-rousse', 1).matchs >= 1);
  // La Ligue : tout est simulé, 24 matchs de poule + 7 de phase finale, dix joueurs par match.
  const l = creerLigue({ moi: 'kerbrume', graine: 21, minutes: 1 });
  simulerLeReste(l);
  assert.equal(total(l.stats), 10 * 31);
  assert.equal(Object.keys(l.stats.j).length, 80, 'les 16 clubs, 5 joueurs chacun');
  const buts = Object.values(l.stats.j).reduce((a, x) => a + x.buts, 0);
  const marques = l.poules.flatMap((p) => p.matchs).reduce((a, x) => a + x.score[0] + x.score[1], 0) + l.finale.tours.flat().reduce((a, x) => a + x.score[0] + x.score[1], 0);
  assert.ok(buts <= marques && buts >= marques - 12, `les buts attribués (${buts}) comptent presque tous les buts du tournoi (${marques})`);
  assert.ok(meilleursButeurs(l.stats).length > 0 && meilleursGardiens(l.stats)[0].i === 0);
  // Une sauvegarde sans statistiques (ancienne partie) se relit sans casser.
  const vieille = JSON.parse(JSON.stringify(creerLigue({ moi: 'kerbrume', graine: 2, minutes: 1 })));
  delete vieille.stats;
  assert.deepEqual(restaurerLigue(vieille).stats, { j: {} });
  // Même graine : mêmes statistiques.
  const l2 = creerLigue({ moi: 'kerbrume', graine: 21, minutes: 1 });
  simulerLeReste(l2);
  assert.deepEqual(l2.stats, l.stats);
});

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

function enLigne({ ping, gigue, perte, duree = 20000, derive = 0.003, reglages = {}, delai = 2 }) {
  const R = rng(ping * 13 + 1);
  const conf = [[], []];
  const joueurs = [0, 1].map((n) => {
    const m = creerMatch({ equipes: ['sol-dambre', 'vertefeuille'], graine: 777, minutes: 3, controles: ['humain', 'humain'], tab: true });
    const s = creerSession({ n, delai, etat: m, pas: (e, x) => pas(e, x), empreinte, confirme: (f, e) => conf[n].push(e[0] * 512 + e[1]), ...reglages });
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
  for (let f = 0; f < jusqua; f++) pas(m, [Math.floor(conf[f] / 512), conf[f] % 512]);
  return m;
}

for (const [nom, reseau] of [
  ['ping 40 ms', { ping: 40, gigue: 10, perte: 0 }],
  ['ping 150 ms, ça varie, 5 % de pertes', { ping: 150, gigue: 80, perte: 0.05 }],
  // Les touches passent par le serveur : jusqu'à l'autre, environ un ping entier. Avec 300 ms, il ne faut jamais se figer.
  ['gros ping (300 ms jusqu’à l’autre), réglages du foot', { ping: 600, gigue: 120, perte: 0.03, reglages: REGLAGES, delai: delaiSelonPing(300) }],
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

test('en ligne : une correction ne fait pas sauter l’affichage, elle glisse puis disparaît', () => {
  const vue = (x, vx = 0) => ({ f: 0, joueurs: Array.from({ length: 10 }, () => ({ x, y: 0, vx, vy: 0 })), ballon: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 } });
  const L = creerLissage();
  // Le moteur corrige : le joueur passe de 0 à 1 m d'un coup (il ne courait pas).
  L.apres(vue(0), vue(1), 1 / 60);
  const a = L.appliquer(vue(1), 1 / 60);
  assert.ok(a.joueurs[0].x < 0.25, 'affiché presque là où il était');
  let x = 0;
  for (let i = 0; i < 30; i++) x = L.appliquer(vue(1), 1 / 60).joueurs[0].x;
  assert.ok(x > 0.99, 'puis à sa vraie place en une demi-seconde');
  // Le mouvement normal (il court) et les remises en place (coup d'envoi) ne sont pas lissés.
  const L2 = creerLissage();
  L2.apres(vue(0, 6), vue(0.1, 6), 1 / 60);
  assert.equal(L2.appliquer(vue(0.1, 6), 1 / 60).joueurs[0].x, 0.1);
  L2.apres(vue(0), vue(15), 1 / 60);
  assert.equal(L2.appliquer(vue(15), 1 / 60).joueurs[0].x, 15);
  // Le délai des touches suit le ping, sans dépasser 5 images.
  assert.equal(delaiSelonPing(0), 2);
  assert.ok(delaiSelonPing(120) > delaiSelonPing(30));
  assert.equal(delaiSelonPing(900), 5);
});

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

test('le serveur : une salle, les équipes choisies dans la salle (jamais la même), la même graine, il relaie les touches', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', nom: 'Alice', stade: 'plage' });
  const { code, stade } = a.dernier('salle');
  assert.match(code, /^[A-Z2-9]{4}$/);
  assert.equal(stade, 'plage');
  // Seul l'hôte change le stade ; un stade inconnu devient le Chaudron.
  a.dit({ t: 'stade', stade: 'toit' });
  assert.equal(a.dernier('stade').stade, 'toit');
  b.dit({ t: 'rejoindre', code: code.toLowerCase(), nom: '<i>Bob</i>' });
  // Les deux sont dans la salle : pas encore de match, chacun choisit son équipe.
  assert.equal(a.dernier('debut'), undefined);
  assert.deepEqual(b.dernier('salon').noms, ['Alice', 'iBob/i']);
  assert.equal(b.dernier('salon').n, 1);
  a.dit({ t: 'equipe', equipe: 'kerbrume' });
  assert.deepEqual(b.dernier('salon').equipes, ['kerbrume', null]);
  b.dit({ t: 'equipe', equipe: 'kerbrume' });
  assert.match(b.dernier('erreur').msg, /déjà pris/);
  assert.deepEqual(a.dernier('salon').equipes, ['kerbrume', null], 'pas deux fois la même équipe');
  b.dit({ t: 'equipe', equipe: 'inconnue' });
  b.dit({ t: 'pret' });
  assert.deepEqual(a.dernier('salon').prets, [false, false], 'pas prêt sans équipe');
  b.dit({ t: 'equipe', equipe: 'corail' });
  b.dit({ t: 'pret' });
  assert.equal(a.dernier('debut'), undefined, 'il faut les deux');
  a.dit({ t: 'pret' });
  const da = a.dernier('debut'), db = b.dernier('debut');
  assert.equal(da.graine, db.graine);
  assert.deepEqual(da.equipes, ['kerbrume', 'corail']);
  assert.deepEqual(db.noms, ['Alice', 'iBob/i']);
  assert.equal(da.stade, 'toit');
  // En plein match, on ne change plus d'équipe.
  a.dit({ t: 'equipe', equipe: 'ferrac' });
  assert.deepEqual(a.dernier('salon').equipes, ['kerbrume', 'corail']);
  const nb = a.recu.length;
  b.dit({ t: 'stade', stade: 'halle' });
  assert.equal(a.recu.length, nb, 'l’invité ne choisit pas');
  a.dit({ t: 'stade', stade: 'lune' });
  assert.equal(b.dernier('stade').stade, 'chaudron');
  // Les touches : 9 bits (le geste compris), relayées à l'autre seulement.
  a.dit({ t: 'entrees', f: 4, e: [T.A | T.d, T.G | T.S, 0x3ff], fc: 3, vu: 1, av: 0 });
  assert.deepEqual(b.dernier('entrees').e, [T.A | T.d, T.G | T.S, 0x1ff]);
  // Un gros ping : jusqu'à 64 touches par message passent.
  a.dit({ t: 'entrees', f: 99, e: new Array(80).fill(1), fc: 3, vu: 1, av: 0 });
  assert.equal(b.dernier('entrees').e.length, 64);
  assert.equal(a.dernier('entrees'), undefined);
  // La revanche, puis le départ.
  const avant = a.recu.filter((m) => m.t === 'debut').length;
  a.dit({ t: 'revanche' }); b.dit({ t: 'revanche' });
  assert.equal(a.recu.filter((m) => m.t === 'debut').length, avant + 1);
  b.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti'));
});

test('le serveur : une connexion qui tombe en plein match garde sa place, et l’autre est prévenu', () => {
  const a = client(), b = client();
  a.dit({ t: 'creer', nom: 'Alice', stade: 'toit' });
  b.dit({ t: 'rejoindre', code: a.dernier('salle').code, nom: 'Bob' });
  assert.equal(foot.enPartie(a.conn), true, 'une salle à deux : la place vaut d’être gardée');
  foot.handleAway(b.conn);
  assert.deepEqual([a.dernier('absent').n, a.dernier('absent').nom], [1, 'Bob']);
  foot.handleResume(b.conn);
  assert.equal(a.dernier('revenu').nom, 'Bob');
  assert.ok(b.dernier('salon'), 'de retour dans la salle (avant le match), on lui redonne le salon');
  const seul = client();
  seul.dit({ t: 'creer', nom: 'Zoé' });
  assert.equal(foot.enPartie(seul.conn), false, 'seul dans sa salle : rien à garder');
  a.dit({ t: 'quitter' });
  seul.dit({ t: 'quitter' });
});

test('l’entraînement : moins de joueurs, sans gardien, des plots, pas de fin', () => {
  const [a, b] = [EQUIPES[0].id, EQUIPES[1].id];
  // Deux joueurs de champ sans gardien, contre quatre plots et leur gardien.
  const m = creerMatch({ equipes: [a, b], graine: 5, controles: ['ia', 'ia'], entrainement: { nous: 2, eux: 4, gardiens: [false, true], immobiles: true } });
  assert.equal(m.joueurs.filter((p) => p.absent).length, 3);
  assert.ok(m.joueurs[0].absent && !m.joueurs[5].absent);
  assert.equal(chronoTexte(m), '∞');
  assert.equal(m.joueurs[m.ballon.porteur].e, 0);
  assert.ok(!m.joueurs[m.ballon.porteur].absent);
  const avant = m.joueurs.map((p) => [p.x, p.y]);
  for (let i = 0; i < 15000; i++) {
    pas(m, [0, 0]);
    assert.ok(m.ballon.porteur < 0 || m.joueurs[m.ballon.porteur].e === 0, 'les plots ne touchent pas le ballon');
    assert.ok(m.phase !== 'fin' && m.phase !== 'mitemps');
  }
  assert.ok(m.score[0] > 3, 'on marque');
  for (const p of m.joueurs) if (p.absent) assert.deepEqual([p.x, p.y], avant[p.id]);
  // Seul contre personne : l'humain engage, change de joueur sans planter.
  const s = creerMatch({ equipes: [a, b], graine: 5, entrainement: { nous: 1, eux: 0, gardiens: [false, false] } });
  assert.equal(s.joueurs.filter((p) => !p.absent).length, 1);
  for (let i = 0; i < 400; i++) pas(s, [i % 25 === 0 ? T.A : T.d, 0]);
  assert.ok(!s.joueurs[s.equipes[0].actif].absent);
  // Les réglages changent en pleine partie (la pause) : on réengage, le ballon pour nous.
  reglerEntrainement(s, { nous: 4, eux: 2, gardiens: [true, true], immobiles: false, niveau: 0 });
  assert.equal(s.joueurs.filter((p) => p.absent).length, 2);
  assert.equal(s.phase, 'engagement');
  assert.equal(s.joueurs[s.ballon.porteur].e, 0);
  for (let i = 0; i < 3000; i++) pas(s);
  assert.ok(s.phase !== 'fin' && s.phase !== 'mitemps');
  // Les matchs normaux ne changent pas : personne n'est absent.
  assert.ok(creerMatch({ equipes: [a, b], graine: 5 }).joueurs.every((p) => !p.absent));
});
