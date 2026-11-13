/**
 * RAFFUT — le moteur du rugby à 7 : les seize clubs, le déterminisme, un match
 * qui va au bout (point en or compris), les règles (l'essai et sa
 * transformation, le drop, la passe en avant, la touche, le plaquage et le
 * ruck), l'entraînement, le Tournoi, et l'équilibre des seize clubs (long :
 * on peut le sauter avec --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerMatch, pas, empreinte, simuler, chronoTexte, reglerEntrainement, choisirReceveur, T, DEMI_L, DEMI_W, CHARGE_MAX, FORCE_IDEALE, N } from '../public/shared/rugby/match.js';
import { EQUIPES, EQUIPE, STYLES, POSTES, notesEquipe } from '../public/shared/rugby/equipes.js';
import { vitessePied, chute } from '../public/shared/rugby/terrain.js';
import { ecussonSVG } from '../public/games/plein-stade/commun/ecusson.js';
import { creerTournoi, matchDuJoueur, stadeDuTour, enregistrer, jouerSansMoi, aJouer, avancer, resumer, noterStats, classement, TOURS } from '../public/shared/rugby/tournoi.js';

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
/** Avance jusqu'à ce que f(m, evs) soit vrai (au plus n images). Rend les événements vus. */
function jusqua(m, f, n = 3000, touches = () => [0, 0]) {
  const vus = [];
  for (let k = 0; k < n; k++) {
    const evs = pas(m, touches(m));
    vus.push(...evs);
    if (f(m, evs)) return vus;
  }
  return vus;
}
/** Un match « à la main » : le jeu en cours, le ballon au joueur id, posé en (x, y). */
function enJeu(m, id, x, y) {
  const p = m.joueurs[id];
  Object.assign(p, { x, y, vx: 0, vy: 0, etat: 'normal' });
  Object.assign(m.ballon, { porteur: id, dernier: id, bloque: false, cible: -1, pied: null, ruck: false });
  m.phase = 'jeu'; m.envoi = null;
  m.equipes[p.e].actif = id;
  return p;
}

test('les seize clubs : inventés, complets, des styles connus', () => {
  assert.equal(EQUIPES.length, 16);
  const ids = new Set(), abrs = new Set(), noms = new Set();
  for (const eq of EQUIPES) {
    ids.add(eq.id); abrs.add(eq.abr);
    assert.ok(STYLES[eq.style], `${eq.nom} : style ${eq.style}`);
    assert.equal(eq.joueurs.length, N);
    assert.equal(eq.joueurs.filter((j) => j.vedette).length, 1, `${eq.nom} : une vedette`);
    assert.ok(eq.devise && eq.ville && eq.maillot && eq.exterieur && eq.ecusson);
    for (const j of eq.joueurs) {
      noms.add(j.nom);
      for (const k of ['vitesse', 'force', 'passe', 'pied', 'defense']) assert.ok(j.notes[k] >= 30 && j.notes[k] <= 99, `${j.nom} ${k}`);
    }
    assert.ok(ecussonSVG(eq, 48).startsWith('<svg'));
    assert.ok(notesEquipe(eq).force > 0);
  }
  assert.equal(POSTES.length, N);
  assert.equal(ids.size, 16);
  assert.equal(abrs.size, 16);
  assert.equal(noms.size, 16 * N, 'pas deux joueurs du même nom');
});

test('les coups de pied : la vitesse calculée amène le ballon au bon endroit', () => {
  const w = vitessePied(0, 0, 0.5, 20, 3, 4, 0.8);
  const b = { x: 0, y: 0, z: 0.5, vx: w.vx, vy: w.vy, vz: w.vz };
  // Au moment où il passe en x = 20, il est en y = 3 et z = 4.
  const t = 20 / w.vx;
  assert.ok(Math.abs(w.vy * t - 3) < 1e-9);
  assert.ok(Math.abs(0.5 + w.vz * t - 4.905 * t * t - 4) < 1e-6);
  const c = chute({ ...b }, 0.5);
  assert.ok(c.x > 20, 'il retombe plus loin');
});

test('le déterminisme : même graine, mêmes touches → même match', () => {
  const jouer = () => {
    const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 77, minutes: 1, controles: ['humain', 'ia'] });
    const h = joueurHumain(5);
    const traces = [];
    for (let f = 0; f < 4000; f++) { pas(m, [h(), 0]); if (f % 500 === 0) traces.push(empreinte(m)); }
    return { traces, score: [...m.score], phase: m.phase };
  };
  assert.deepEqual(jouer(), jouer());
  // Et l'état se copie (structuredClone) sans rien perdre.
  const m = creerMatch({ equipes: ['noirval', 'volterre'], graine: 3 });
  for (let f = 0; f < 900; f++) pas(m, [0, 0]);
  const c = structuredClone(m);
  for (let f = 0; f < 900; f++) { pas(m, [0, 0]); pas(c, [0, 0]); }
  assert.equal(empreinte(m), empreinte(c));
});

test('un match entre deux ordinateurs va au bout, et le score tient ses comptes', () => {
  let total = 0, essais = 0, rucks = 0, nul = 0;
  for (let g = 1; g <= 6; g++) {
    const m = simuler({ equipes: [EQUIPES[g].id, EQUIPES[g + 6].id], graine: g, minutes: 2 });
    assert.equal(m.phase, 'fin');
    assert.ok(m.vainqueur === 0 || m.vainqueur === 1);
    for (let e = 0; e < 2; e++) {
      const pts = m.points.filter((p) => p.e === e).reduce((s, p) => s + p.pts, 0);
      assert.equal(pts, m.score[e], 'les points de la liste font le score');
      assert.equal(m.stats.essais[e] * 5 + m.stats.transfos[e] * 2 + m.stats.drops[e] * 3, m.score[e]);
    }
    if (m.enOr) nul += 1;
    total += m.score[0] + m.score[1];
    essais += m.stats.essais[0] + m.stats.essais[1];
    rucks += m.stats.rucks[0] + m.stats.rucks[1];
  }
  assert.ok(essais >= 6, `des essais (${essais})`);
  assert.ok(rucks >= 30, `des rucks (${rucks})`);
  assert.ok(total > 0);
});

test('le point en or : à égalité, le premier qui marque gagne', () => {
  const m = creerMatch({ equipes: ['pre-sale', 'grand-gel'], graine: 4, minutes: 1, controles: ['ia', 'ia'] });
  // On arrive à la fin du temps, à égalité.
  jusqua(m, (mm) => mm.periode === 2 && mm.phase === 'jeu');
  m.score = [0, 0];
  m.points = [];
  m.chrono = m.duree;
  jusqua(m, (mm) => mm.enOr || mm.phase === 'fin', 20000);
  if (m.phase !== 'fin') {
    assert.equal(m.enOr, true);
    jusqua(m, (mm) => mm.phase === 'fin', 60000);
  }
  assert.equal(m.phase, 'fin');
  assert.notEqual(m.score[0], m.score[1]);
});

test('l’essai vaut 5 points ; la transformation se vise et se tape', () => {
  const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 2, entrainement: { nous: 1, eux: 0 } });
  jusqua(m, (mm) => mm.phase === 'jeu', 100);
  const vus = jusqua(m, (mm) => mm.phase === 'transfo', 800, () => [T.d | T.S, 0]);
  assert.ok(vus.some((e) => e.type === 'essai' && e.equipe === 0));
  assert.equal(m.score[0], 5);
  // La transformation : on tient B le temps qu'il faut (la force idéale), puis on lâche.
  const tenir = Math.round(FORCE_IDEALE * CHARGE_MAX);
  let k = 0;
  const fin = jusqua(m, (mm, evs) => evs.some((e) => e.type === 'transfo'), 600, () => [k++ < tenir ? T.B : 0, 0]);
  const tr = fin.find((e) => e.type === 'transfo');
  assert.ok(tr, 'la transformation est tapée');
  assert.equal(m.score[0], tr.reussi ? 7 : 5);
  // En face des poteaux, à la bonne force : elle passe.
  assert.equal(tr.reussi, true);
});

test('le drop : entre les poteaux, au-dessus de la barre, 3 points', () => {
  let reussi = 0;
  for (let g = 1; g <= 8 && !reussi; g++) {
    const m = creerMatch({ equipes: ['noirval', 'sablemer'], graine: g, controles: ['humain', 'ia'] });
    const p = enJeu(m, 4, DEMI_L - 18, 0);
    p.dx = 1; p.dy = 0;
    for (const o of m.joueurs) if (o.e === 1) { o.x = -25; o.y = -15 + o.i * 4; }
    let k = 0;
    const vus = jusqua(m, (mm) => mm.phase === 'marque' || (mm.ballon.pied && mm.ballon.pied.sol), 300, () => [k++ < 18 ? T.B : 0, 0]);
    if (vus.some((e) => e.type === 'drop')) { reussi += 1; assert.equal(m.score[0], 3); assert.equal(m.stats.drops[0], 1); }
  }
  assert.ok(reussi, 'un drop au moins');
});

test('la passe en avant : mêlée pour l’adversaire', () => {
  const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 6, controles: ['humain', 'ia'] });
  enJeu(m, 4, 0, 0);
  // Tous les coéquipiers devant lui : la seule passe possible part vers l'avant.
  for (const o of m.joueurs) if (o.e === 0 && o.id !== 4) { o.x = 5 + o.i; o.y = -6 + o.i * 2; }
  for (const o of m.joueurs) if (o.e === 1) { o.x = 25; o.y = -15 + o.i * 4; }
  const vus = jusqua(m, (mm) => mm.phase === 'melee', 200, (mm) => [mm.f < 5 ? 0 : mm.f < 7 ? T.A : 0, 0]);
  assert.ok(vus.some((e) => e.type === 'passe-avant'));
  assert.equal(m.phase, 'melee');
  assert.equal(m.melee.e, 1);
  // La mêlée se joue : le ballon sort pour une des deux équipes.
  const fin = jusqua(m, (mm) => mm.phase === 'jeu', 300);
  assert.ok(fin.some((e) => e.type === 'melee-gagnee'));
  assert.ok(m.ballon.porteur >= 0);
});

test('les passes vont vers l’arrière, du côté où l’on pousse', () => {
  const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 6, controles: ['humain', 'ia'] });
  const p = enJeu(m, 4, 0, 0);
  const pl = [[5, -3, -4], [6, -3, 4], [3, 2, -2]]; // [i, x, y] (le 3 est devant)
  for (const o of m.joueurs) if (o.e === 0 && o !== p) { o.x = -20; o.y = 15; }
  for (const [i, x, y] of pl) Object.assign(m.joueurs[i], { x, y });
  assert.equal(choisirReceveur(m, p, 1), 6, 'vers le fond : celui de y > 0');
  assert.equal(choisirReceveur(m, p, -1), 5, 'vers soi : celui de y < 0');
  assert.notEqual(choisirReceveur(m, p, 0), 3, 'jamais celui qui est devant');
});

test('la touche : le porteur qui sort donne le lancer à l’adversaire', () => {
  const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 8, controles: ['humain', 'ia'] });
  enJeu(m, 6, -5, DEMI_W - 1);
  for (const o of m.joueurs) if (o.e === 1) { o.x = 25; o.y = 0; }
  const vus = jusqua(m, (mm) => mm.phase === 'touche', 200, () => [T.h, 0]);
  assert.ok(vus.some((e) => e.type === 'touche' && e.equipe === 1));
  assert.equal(m.touche.e, 1);
  const fin = jusqua(m, (mm) => mm.phase === 'jeu', 300);
  assert.ok(fin.some((e) => e.type === 'touche-gagnee'));
  assert.ok(m.ballon.porteur >= 0);
});

test('le plaquage : le porteur au sol, puis le ruck, puis le ballon sort', () => {
  const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 9, controles: ['ia', 'humain'] });
  enJeu(m, 6, 0, 0);
  m.equipes[0].ctrl = 'humain';
  const d = m.joueurs[N + 5];
  Object.assign(d, { x: 1.1, y: 0, etat: 'normal' });
  m.equipes[1].actif = d.id;
  let vus = [];
  for (let g = 0; g < 30 && !vus.some((e) => e.type === 'plaquage'); g++) {
    vus = jusqua(m, (mm) => mm.phase !== 'jeu', 40, (mm) => [0, mm.f % 2 ? T.B : 0]);
    if (m.phase === 'jeu' && m.ballon.porteur === 6) { Object.assign(d, { x: m.joueurs[6].x + 1, y: m.joueurs[6].y, etat: 'normal', verrou: 0 }); }
  }
  assert.ok(vus.some((e) => e.type === 'plaquage'), 'un plaquage réussi');
  assert.equal(m.phase, 'ruck');
  const fin = jusqua(m, (mm) => mm.phase !== 'ruck', 200);
  assert.ok(fin.some((e) => e.type === 'sortie'));
});

test('des humains qui tapent au hasard : le match tient debout', () => {
  for (let g = 1; g <= 3; g++) {
    const m = creerMatch({ equipes: [EQUIPES[g].id, EQUIPES[15 - g].id], graine: g, minutes: 1, controles: ['humain', 'humain'] });
    const a = joueurHumain(g), b = joueurHumain(g + 50);
    for (let f = 0; f < 30000 && m.phase !== 'fin'; f++) {
      pas(m, [a(), b()]);
      for (const p of m.joueurs) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'les joueurs restent sur terre');
      assert.ok(Number.isFinite(m.ballon.x) && Number.isFinite(m.ballon.z));
    }
    assert.equal(m.phase, 'fin', 'le match finit');
    assert.match(chronoTexte(m), /^\d+:\d\d$|^OR$/);
  }
});

test('l’entraînement : moins de joueurs, des plots, pas de fin', () => {
  const m = creerMatch({ equipes: ['roc-fendu', 'sablemer'], graine: 2, entrainement: { nous: 3, eux: 2, immobiles: true } });
  assert.equal(m.joueurs.filter((p) => p.e === 0 && !p.absent).length, 3);
  assert.equal(m.joueurs.filter((p) => p.e === 1 && !p.absent).length, 2);
  assert.equal(chronoTexte(m), '∞');
  const avant = m.joueurs.filter((p) => p.e === 1 && !p.absent).map((p) => [p.x, p.y]);
  for (let f = 0; f < 3000; f++) pas(m, [0, 0]);
  assert.notEqual(m.phase, 'fin');
  m.joueurs.filter((p) => p.e === 1 && !p.absent).forEach((p, k) => assert.ok(Math.hypot(p.x - avant[k][0], p.y - avant[k][1]) < 1.5, 'les plots ne bougent pas'));
  reglerEntrainement(m, { nous: 7, eux: 0, immobiles: false });
  assert.equal(m.joueurs.filter((p) => !p.absent).length, 7);
  assert.equal(m.ballon.porteur >= 0 && m.joueurs[m.ballon.porteur].e, 0);
});

test('le Tournoi : huit clubs, trois tours, un champion', () => {
  const c = creerTournoi({ moi: 'roc-fendu', graine: 12, minutes: 1 });
  assert.equal(c.tours[0].length, 4);
  assert.equal(new Set(c.tours[0].flatMap((r) => [r.a, r.b])).size, 8);
  assert.ok(['grand', 'village', 'falaises'].includes(stadeDuTour(c)));
  while (!c.fini && !c.elimine) {
    const r = matchDuJoueur(c);
    assert.ok(r);
    // Notre match, joué par l'ordinateur pour le test.
    const m = simuler({ equipes: [r.a, r.b], graine: c.tour + 5, minutes: 1 });
    enregistrer(c, r.i, { score: m.score, enOr: m.enOr, vainqueur: m.vainqueur });
    noterStats(c, resumer(m));
    for (const i of aJouer(c)) jouerSansMoi(c, i);
    avancer(c);
  }
  while (!c.fini) { for (const i of aJouer(c)) jouerSansMoi(c, i); avancer(c); }
  assert.ok(c.champion && EQUIPE[c.champion]);
  assert.equal(c.tours.length, 3);
  assert.equal(TOURS.length, 3);
  const top = classement(c.stats, 'plaquages');
  assert.ok(top.length > 0 && top[0].rang === 1);
  assert.ok(classement(c.stats, 'eval').length > 0);
});

test('l’équilibre des seize clubs : chacun gagne entre 33 et 67 % de ses matchs (40 matchs chacun)', () => {
  const ids = EQUIPES.map((e) => e.id);
  const v = Object.fromEntries(ids.map((i) => [i, 0])), j = Object.fromEntries(ids.map((i) => [i, 0]));
  let g = 0;
  for (let k = 0; k < 20; k++) for (let a = 0; a < 16; a++) {
    const b = (a + 1 + (k % 15)) % 16;
    const m = simuler({ equipes: [ids[a], ids[b]], graine: 1000 + g++, minutes: 1 });
    j[ids[a]] += 1; j[ids[b]] += 1;
    v[m.equipes[m.vainqueur].id] += 1;
  }
  for (const i of ids) {
    const p = v[i] / j[i];
    assert.ok(p >= 0.33 && p <= 0.67, `${EQUIPE[i].nom} gagne ${Math.round(p * 100)} % de ses matchs`);
  }
});
