/**
 * PARE-FEU — la carte, le déterminisme, les ordres, chaque programme et
 * chaque défense, la capture d'un Noyau, le 2 contre 2, une partie de
 * l'ordinateur qui va au bout, la salle en ligne, et l'équilibre de
 * l'ordinateur (on peut le sauter avec --test-skip-pattern="quilibr").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { creerCarte } from '../public/shared/parefeu/carte.js';
import { creerPartie, pas, commande, verifier, vuePour, empreinte, simuler, maxDe } from '../public/shared/parefeu/partie.js';
import { frontiere, source, voit, allies } from '../public/shared/parefeu/regles.js';
import { PROGRAMMES, DEFENSES, BRECHE, DT, DUREE_MAX, NIVEAUX, PARFAIT, TECHS, AMELIORATIONS, EVENEMENTS, LISTE_TECHS } from '../public/shared/parefeu/donnees.js';
import * as serveur from '../server/parefeu.js';

/** Avance de `s` secondes. */
function avancer(E, s) { for (let i = 0; i < Math.round(s / DT); i++) pas(E); }

/** Une partie à deux humains (personne ne joue tout seul). */
const duel = () => creerPartie({ joueurs: [{ nom: 'A' }, { nom: 'B' }], graine: 7, evenements: false });

/** Donne au joueur j un nœud voisin de la cible, pour pouvoir l'attaquer. */
function noeudDe(E, j, type) { return E.noeuds.find((n) => n.proprio === j && n.type === type && !n.eteint); }

/** Un serveur de B que A peut attaquer : on donne à A le relais devant B. */
function preparerAttaque(E) {
  let best = null;
  for (const sB of E.noeuds) {
    if (sB.proprio !== 1 || sB.type !== 'serveur') continue;
    for (const v of sB.liens) {
      const r = E.noeuds[v];
      if (r.proprio >= 0) continue;
      const d = Math.hypot(r.x - sB.x, r.y - sB.y);
      if (!best || d < best.d) best = { d, cible: sB.id, depuis: v };
    }
  }
  E.noeuds[best.depuis].proprio = 0;
  E.joueurs[0].res = 150;
  return best;
}

test('la carte : de 2 à 4 joueurs, des liens dans les deux sens, tout est relié', () => {
  for (const n of [2, 3, 4]) {
    const C = creerCarte(n);
    assert.equal(C.noeuds.length, n * 4 + n + n + 1);
    for (const nd of C.noeuds) for (const v of nd.liens) assert.ok(C.noeuds[v].liens.includes(nd.id), `lien ${nd.id}-${v}`);
    const vus = new Set([0]);
    const file = [0];
    while (file.length) for (const v of C.noeuds[file.pop()].liens) if (!vus.has(v)) { vus.add(v); file.push(v); }
    assert.equal(vus.size, C.noeuds.length, 'réseau connexe');
    // Le Noyau ne touche que ses propres serveurs.
    for (const k of C.bases) for (const v of C.noeuds[k].liens) assert.equal(C.noeuds[v].base, C.noeuds[k].base);
    for (const nd of C.noeuds) assert.ok(Math.hypot(nd.x - 500, nd.y - 500) < 470, 'dans le cadre');
  }
  assert.throws(() => creerCarte(5));
});

test('déterminisme : même graine, même partie', () => {
  const o = { joueurs: [{ ia: 'normal' }, { ia: 'difficile' }, { ia: 'facile' }], graine: 42 };
  const a = creerPartie(o), b = creerPartie(o);
  for (let i = 0; i < 2400; i++) { pas(a); pas(b); }
  assert.equal(empreinte(a), empreinte(b));
  const c = creerPartie({ ...o, graine: 43 });
  for (let i = 0; i < 2400; i++) pas(c);
  assert.notEqual(empreinte(a), empreinte(c));
  // L'état passe par JSON sans rien perdre.
  const d = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 400; i++) { pas(a); pas(d); }
  assert.equal(empreinte(a), empreinte(d));
});

test('les ordres : portée, cycles, recharge, défenses chez soi seulement', () => {
  const E = duel();
  const coeurB = E.joueurs[1].noyau;
  assert.equal(verifier(E, 0, { t: 'ver', cible: coeurB }).ok, false, 'le Noyau adverse est hors de portée');
  assert.equal(verifier(E, 0, { t: 'parefeu', cible: coeurB }).ok, false, 'pas de défense chez l’autre');
  assert.equal(verifier(E, 0, { t: 'inconnu', cible: 0 }).ok, false);
  const f = frontiere(E, 0);
  assert.ok(f.length >= 2 && f.every((n) => E.noeuds[n].proprio < 0), 'au départ, on vise les relais neutres');
  const cible = f[0];
  E.joueurs[0].res = 5;
  assert.match(verifier(E, 0, { t: 'ver', cible }).raison, /cycles/);
  E.joueurs[0].res = 100;
  assert.ok(commande(E, 0, { t: 'ver', cible }).ok);
  pas(E);
  assert.equal(E.progs.length, 1);
  assert.equal(E.joueurs[0].res < 100, true);
  assert.match(verifier(E, 0, { t: 'ver', cible }).raison, /recharge/);
  assert.equal(verifier(E, 0, { t: 'sonde', cible }).ok, false, 'rien à sonder sur un neutre');
  assert.ok(verifier(E, 0, { t: 'parefeu', cible: E.joueurs[0].noyau }).ok);
});

test('ver et capture : un nœud sans PV change de main', () => {
  const E = duel();
  const cible = frontiere(E, 0)[0];
  E.noeuds[cible].pv = 4;
  E.noeuds[cible].touche = 1e9; // pas de réparation pendant le test
  E.joueurs[0].res = 100;
  commande(E, 0, { t: 'ver', cible });
  let capture = null;
  for (let i = 0; i < 100 && !capture; i++) { pas(E); capture = E.evts.find((e) => e.k === 'capture'); }
  assert.ok(capture);
  assert.equal(E.noeuds[cible].proprio, 0);
  assert.ok(E.noeuds[cible].pv > 0 && E.noeuds[cible].pv < E.noeuds[cible].max);
});

test('pare-feu : il arrête un ver ; le cheval de Troie passe une fois', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  const nd = E.noeuds[cible];
  nd.pf = 2;
  const pv = nd.pv;
  commande(E, 0, { t: 'ver', cible });
  avancer(E, 2);
  assert.equal(nd.pf, 1);
  assert.equal(nd.pv, pv, 'bloqué, aucun dégât');
  commande(E, 0, { t: 'cheval', cible });
  avancer(E, 3);
  assert.equal(nd.pf, 1, 'le cheval ne consomme pas de charge');
  assert.ok(nd.pv < pv - PROGRAMMES.cheval.degats + 1);
});

test('saturation : les défenses s’éteignent, les dégâts montent ; le correctif la lève', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  const nd = E.noeuds[cible];
  commande(E, 0, { t: 'saturation', cible });
  avancer(E, 2);
  assert.ok(nd.sature > E.temps);
  nd.pf = 3;
  const pv = nd.pv;
  E.joueurs[0].cd = {};
  commande(E, 0, { t: 'ver', cible });
  avancer(E, 1.2);
  assert.equal(nd.pf, 3, 'le pare-feu saturé ne filtre rien');
  assert.ok(Math.abs(pv - nd.pv - PROGRAMMES.ver.degats * 1.25) < 0.01);
  E.joueurs[1].res = 100;
  assert.ok(commande(E, 1, { t: 'correctif', cible }).ok);
  pas(E);
  assert.ok(nd.sature <= E.temps);
});

test('rançongiciel : il vole des cycles ; la sonde révèle les défenses', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  E.joueurs[1].res = 100;
  const avant = E.joueurs[0].res;
  commande(E, 0, { t: 'rancon', cible });
  let vol = null;
  for (let i = 0; i < 80 && !vol; i++) { pas(E); vol = E.evts.find((e) => e.k === 'vol'); }
  assert.ok(vol && vol.v >= 30 && vol.v <= PROGRAMMES.rancon.volMax);
  assert.ok(E.joueurs[0].res > avant - PROGRAMMES.rancon.cout + 25);

  E.noeuds[cible].pf = 4;
  assert.equal(voit(E, 0, cible), false);
  assert.equal(vuePour(E, 0).noeuds[cible].pf, -1, 'caché');
  assert.equal(vuePour(E, 1).noeuds[cible].pf, 4, 'le propriétaire voit tout');
  commande(E, 0, { t: 'sonde', cible });
  avancer(E, 1);
  assert.equal(E.noeuds[cible].pf, 4, 'la sonde ignore le pare-feu');
  assert.equal(voit(E, 0, cible), true);
  assert.equal(vuePour(E, 0).noeuds[cible].pf, 4);
  avancer(E, PROGRAMMES.sonde.duree + 1);
  assert.equal(voit(E, 0, cible), false, 'la révélation s’éteint');
});

test('antivirus : il détruit les programmes qui approchent', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  E.joueurs[1].res = 100;
  commande(E, 1, { t: 'antivirus', cible });
  pas(E);
  const pv = E.noeuds[cible].pv;
  commande(E, 0, { t: 'ver', cible });
  let zap = false;
  for (let i = 0; i < 60; i++) { pas(E); zap ||= E.evts.some((e) => e.k === 'zap'); }
  assert.ok(zap);
  assert.equal(E.noeuds[cible].pv, pv);
  assert.equal(E.progs.length, 0);
});

test('leurre : il attire les programmes visant ses voisins et les avale', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  const voisin = E.noeuds[cible].liens.find((v) => E.noeuds[v].proprio === 1);
  E.joueurs[1].res = 100;
  commande(E, 1, { t: 'leurre', cible: voisin });
  pas(E);
  const pv = E.noeuds[cible].pv, pv2 = E.noeuds[voisin].pv;
  commande(E, 0, { t: 'cheval', cible });
  let devie = false, avale = false;
  for (let i = 0; i < 120; i++) { pas(E); devie ||= E.evts.some((e) => e.k === 'devie'); avale ||= E.evts.some((e) => e.k === 'absorbe'); }
  assert.ok(devie && avale);
  assert.equal(E.noeuds[cible].pv, pv);
  assert.equal(E.noeuds[voisin].pv, pv2);
  assert.equal(E.noeuds[voisin].leurreReste, DEFENSES.leurre.absorbe - 1);
});

test('chiffrement : moitié des dégâts ; brèche : des dégâts selon le score', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  const nd = E.noeuds[cible];
  E.joueurs[1].res = 100;
  commande(E, 1, { t: 'chiffrement', cible });
  pas(E);
  let pv = nd.pv;
  commande(E, 0, { t: 'ver', cible });
  avancer(E, 1.2);
  assert.ok(Math.abs(pv - nd.pv - PROGRAMMES.ver.degats / 2) < 0.01);
  nd.chiffre = 0;
  pv = nd.pv;
  commande(E, 0, { t: 'breche', cible, score: 3 });
  pas(E);
  assert.ok(Math.abs(pv - nd.pv - (BRECHE.degats * 3) / 5) < 0.01);
  assert.ok(nd.sature <= E.temps, 'pas parfait, pas de saturation');
  E.joueurs[0].cd = {};
  commande(E, 0, { t: 'breche', cible, score: 9 });
  pas(E);
  assert.ok(nd.sature > E.temps, 'parfait : le nœud sature');
});

test('mini-défi parfait : l’action vaut plus ; chaque action a un défi d’autant plus long qu’elle est forte', () => {
  const E = duel();
  const { cible } = preparerAttaque(E);
  const nd = E.noeuds[cible];
  const pv = nd.pv;
  commande(E, 0, { t: 'ver', cible, parfait: true });
  avancer(E, 1.2);
  assert.ok(Math.abs(pv - nd.pv - PROGRAMMES.ver.degats * PARFAIT) < 0.01);
  E.joueurs[1].res = 100;
  commande(E, 1, { t: 'parefeu', cible, parfait: true });
  pas(E);
  assert.equal(nd.pf, DEFENSES.parefeu.charges + 1);
  for (const A of [...Object.values(PROGRAMMES), ...Object.values(DEFENSES)]) assert.ok(A.defi >= 2 && A.defi <= 5, A.nom);
  assert.ok(PROGRAMMES.ver.defi < PROGRAMMES.saturation.defi && DEFENSES.correctif.defi < DEFENSES.antivirus.defi);
});

test('le Laboratoire : trois niveaux par technologie, payés en cycles, et leurs effets', () => {
  const E = duel();
  assert.ok(LISTE_TECHS.length >= 15);
  assert.ok(LISTE_TECHS.some((k) => TECHS[k].cote === 'att') && LISTE_TECHS.some((k) => TECHS[k].cote === 'def'));
  E.joueurs[0].res = 1000;
  for (let n = 0; n < 3; n++) { assert.ok(commande(E, 0, { t: 'tech', k: 'ver' }).ok); pas(E); }
  assert.equal(E.joueurs[0].tech.ver, 3);
  assert.match(verifier(E, 0, { t: 'tech', k: 'ver' }).raison, /maximum/);
  assert.ok(E.joueurs[0].res < 1000 - TECHS.ver.couts.reduce((a, b) => a + b, 0) + 10);
  const { cible } = preparerAttaque(E);
  const nd = E.noeuds[cible];
  const pv = nd.pv;
  commande(E, 0, { t: 'ver', cible });
  avancer(E, 1.2);
  assert.ok(Math.abs(pv - nd.pv - (PROGRAMMES.ver.degats + 6)) < 0.01, 'ver mutant : +6');
  // Recharge et vitesse
  E.joueurs[0].res = 1000;
  commande(E, 0, { t: 'tech', k: 'recharge' }); pas(E);
  E.joueurs[0].cd = {};
  commande(E, 0, { t: 'cheval', cible }); pas(E);
  assert.ok(Math.abs(E.joueurs[0].cd.cheval - E.temps + DT - PROGRAMMES.cheval.recharge * 0.88) < 0.06);
  // Défense : pare-feu renforcé et chiffrement quantique
  E.joueurs[1].res = 1000;
  commande(E, 1, { t: 'tech', k: 'parefeu' }); pas(E);
  nd.pf = 0;
  commande(E, 1, { t: 'parefeu', cible }); pas(E);
  assert.equal(nd.pf, DEFENSES.parefeu.charges + 1);
  // Économie : l'overclock
  const r0 = E.joueurs[1].revenu;
  commande(E, 1, { t: 'tech', k: 'overclock' }); pas(E); pas(E);
  assert.ok(Math.abs(E.joueurs[1].revenu - r0 * 1.1) < 0.01);
});

test('améliorer un nœud : blindage, rendement, tourelle, bouclier ; tout est perdu à la prise', () => {
  const E = duel();
  E.joueurs[1].res = 1000;
  const { cible } = preparerAttaque(E);
  const nd = E.noeuds[cible];
  assert.equal(verifier(E, 0, { t: 'up', k: 'blindage', cible }).ok, false, 'pas chez les autres');
  const max0 = nd.max;
  commande(E, 1, { t: 'up', k: 'blindage', cible }); pas(E);
  assert.equal(nd.max, Math.round(max0 * 1.35));
  const r0 = E.joueurs[1].revenu;
  commande(E, 1, { t: 'up', k: 'rendement', cible }); pas(E); pas(E);
  assert.ok(Math.abs(E.joueurs[1].revenu - r0 - 0.8) < 0.01);
  commande(E, 1, { t: 'up', k: 'tourelle', cible }); pas(E);
  const pv = nd.pv;
  commande(E, 0, { t: 'ver', cible });
  let tir = false;
  for (let i = 0; i < 40; i++) { pas(E); tir ||= E.evts.some((e) => e.k === 'tourelle'); }
  assert.ok(tir && nd.pv === pv, 'la tourelle abat le ver');
  commande(E, 1, { t: 'up', k: 'bouclier', cible }); pas(E);
  nd.pf = 0;
  avancer(E, 15);
  assert.ok(nd.pf >= 1, 'le bouclier recharge le pare-feu');
  for (const k of Object.keys(AMELIORATIONS)) assert.equal(AMELIORATIONS[k].couts.length, 3);
  nd.pv = 1; nd.pf = 0; nd.up.tourelle = 0;
  E.joueurs[0].cd = {};
  E.joueurs[0].res = 100;
  commande(E, 0, { t: 'cheval', cible });
  avancer(E, 3);
  assert.equal(nd.proprio, 0);
  assert.deepEqual(Object.values(nd.up), [0, 0, 0, 0, 0]);
  assert.equal(nd.max, maxDe(nd));
});

test('les événements : ils arrivent, durent, et changent la partie', () => {
  const E = creerPartie({ joueurs: [{ nom: 'A' }, { nom: 'B' }], graine: 2 });
  assert.ok(E.evProchain >= 40 && E.evProchain <= 60);
  avancer(E, E.evProchain + 0.1);
  assert.ok(E.ev && EVENEMENTS[E.ev.k], 'un événement a commencé');
  const fin = E.ev.fin;
  avancer(E, fin - E.temps + 0.1);
  assert.equal(E.ev, null);
  assert.ok(E.evProchain > E.temps + 30);
  const forcer = (k) => { E.ev = { k, debut: E.temps, fin: E.temps + EVENEMENTS[k].duree }; };
  // Marché noir : 40 % de moins.
  forcer('soldes');
  E.joueurs[0].res = Math.ceil(PROGRAMMES.cheval.cout * 0.6);
  const cible = frontiere(E, 0)[0];
  assert.ok(verifier(E, 0, { t: 'cheval', cible }).ok);
  // Panne : le pare-feu ne filtre plus.
  const D = creerPartie({ joueurs: [{ nom: 'A' }, { nom: 'B' }], graine: 3, evenements: false });
  const { cible: c2 } = preparerAttaque(D);
  D.noeuds[c2].pf = 3;
  D.ev = { k: 'panne', debut: 0, fin: 99 };
  commande(D, 0, { t: 'ver', cible: c2 });
  avancer(D, 1.2);
  assert.equal(D.noeuds[c2].pf, 3);
  assert.ok(D.noeuds[c2].pv < D.noeuds[c2].max);
  // Fuite : on voit tout.
  D.ev = { k: 'fuite', debut: 0, fin: 99 };
  assert.ok(voit(D, 0, c2));
  // La cache : le premier qui prend le nœud empoche la prime.
  const C = creerPartie({ joueurs: [{ nom: 'A' }, { nom: 'B' }], graine: 4, evenements: false });
  const n = frontiere(C, 0)[0];
  C.ev = { k: 'cache', debut: 0, fin: 99, n };
  C.noeuds[n].pv = 1;
  C.noeuds[n].touche = 1e9;
  C.joueurs[0].res = 50;
  commande(C, 0, { t: 'ver', cible: n });
  let tresor = null;
  for (let i = 0; i < 80 && !tresor; i++) { pas(C); tresor = C.evts.find((e) => e.k === 'tresor'); }
  assert.ok(tresor);
  assert.ok(C.joueurs[0].res > 50 - PROGRAMMES.ver.cout + EVENEMENTS.cache.prime - 1);
  assert.equal(C.ev, null);
  // Sans événements : rien n'arrive.
  const S = simuler({ joueurs: [{ ia: 'normal' }, { ia: 'normal' }], graine: 9, evenements: false }, 120);
  assert.equal(S.ev, null);
});

test('prendre un Noyau élimine son joueur et finit le duel', () => {
  const E = duel();
  const coeur = E.noeuds[E.joueurs[1].noyau];
  const s = E.noeuds[coeur.liens[0]];
  s.proprio = 0;
  coeur.pv = 3;
  E.joueurs[0].res = 100;
  const avant = E.joueurs[0].res;
  commande(E, 0, { t: 'ver', cible: coeur.id });
  avancer(E, 2);
  assert.equal(E.joueurs[1].vivant, false);
  assert.ok(E.fini);
  assert.equal(E.gagnant, 0);
  assert.ok(coeur.eteint && coeur.proprio === 0);
  assert.ok(E.joueurs[0].res > avant, 'la prime du Noyau');
  assert.ok(E.noeuds.every((n) => n.proprio !== 1), 'les nœuds du vaincu sont rendus');
});

test('2 contre 2 : alliés, défense chez l’allié, l’équipe tombe avec ses deux Noyaux', () => {
  const E = creerPartie({ mode: '2v2', joueurs: [{ nom: 'A' }, { nom: 'B' }, { nom: 'C' }, { nom: 'D' }], graine: 3 });
  assert.ok(allies(E, 0, 1) && allies(E, 2, 3) && !allies(E, 0, 2));
  E.joueurs[0].res = 100;
  assert.ok(verifier(E, 0, { t: 'parefeu', cible: E.joueurs[1].noyau }).ok, 'renforcer son allié');
  assert.equal(verifier(E, 0, { t: 'ver', cible: E.joueurs[1].noyau }).ok, false);
  const tuer = (vainqueur, victime) => {
    const coeur = E.noeuds[E.joueurs[victime].noyau];
    E.noeuds[coeur.liens[0]].proprio = vainqueur;
    coeur.pv = 1;
    E.joueurs[vainqueur].res = 100;
    E.joueurs[vainqueur].cd = {};
    assert.ok(commande(E, vainqueur, { t: 'ver', cible: coeur.id }).ok);
    avancer(E, 2);
    assert.equal(E.joueurs[victime].vivant, false);
  };
  tuer(0, 2);
  assert.equal(E.fini, false, 'son allié tient encore');
  tuer(1, 3);
  assert.ok(E.fini);
  assert.equal(E.gagnant, 0);
});

test('l’ordinateur : une partie à quatre va au bout, à tous les niveaux', () => {
  for (const ia of Object.keys(NIVEAUX)) {
    const E = simuler({ joueurs: [{ ia }, { ia }, { ia }, { ia }], graine: 11 });
    assert.ok(E.fini, ia);
    assert.ok(E.temps <= DUREE_MAX);
    assert.ok(E.joueurs.reduce((s, J) => s + J.stats.lances, 0) > 50);
    if (ia !== 'facile') assert.ok(E.joueurs.reduce((s, J) => s + J.stats.ameliorations, 0) > 0, 'l’ordinateur s’améliore');
  }
  const E = simuler({ mode: '2v2', joueurs: [{ ia: 'normal' }, { ia: 'normal' }, { ia: 'normal' }, { ia: 'normal' }], graine: 5 });
  assert.ok(E.fini && (E.gagnant === 0 || E.gagnant === 1));
});

test('la prédiction : les programmes avancent mais n’arrivent pas', () => {
  const E = duel();
  const cible = frontiere(E, 0)[0];
  commande(E, 0, { t: 'ver', cible });
  pas(E);
  const pv = E.noeuds[cible].pv;
  for (let i = 0; i < 100; i++) pas(E, { prediction: true });
  assert.equal(E.progs.length, 1);
  assert.ok(E.progs[0].t < 1);
  assert.equal(E.noeuds[cible].pv, pv);
  assert.equal(source(E, 0, cible) >= 0, true);
});

/* ------------------------------ en ligne ------------------------------ */

function fausseConnexion(id) {
  const recus = [];
  return { id, recus, send: (m) => recus.push(m), close() {}, dernier: (t) => [...recus].reverse().find((m) => m.t === t) };
}

test('en ligne : salle, bots, partie, ordres, coupure et retour', () => {
  serveur.reglerManuel(true);
  const a = fausseConnexion('pf-a'), b = fausseConnexion('pf-b');
  serveur.handleOpen(a); serveur.handleOpen(b);
  serveur.handleMessage(a, { t: 'create', name: 'Alice' });
  const code = a.dernier('pf:salon').code;
  assert.match(code, /^[A-Z0-9]{4}$/);
  serveur.handleMessage(b, { t: 'join', code, name: 'Bob' });
  serveur.handleMessage(b, { t: 'bot', delta: 1 });
  assert.match(b.dernier('pf:erreur').msg, /hôte/);
  serveur.handleMessage(a, { t: 'mode', mode: '2v2' });
  serveur.handleMessage(a, { t: 'start' });
  const s = serveur._salles.get(code);
  assert.equal(s.places.length, 4, 'le 2 contre 2 se complète avec des bots');
  assert.equal(a.dernier('pf:debut').moi, 0);
  assert.equal(b.dernier('pf:debut').moi, 1);
  assert.ok(serveur.enPartie(a));

  for (let i = 0; i < 6; i++) s.avancer();
  const etat = b.dernier('pf:etat');
  assert.ok(etat && etat.e.noeuds.length === 25);
  assert.equal(etat.e.file.length, 0);
  // Les défenses de l'équipe adverse sont cachées.
  s.E.noeuds[s.E.joueurs[2].noyau].pf = 3;
  for (let i = 0; i < 3; i++) s.avancer();
  assert.equal(b.dernier('pf:etat').e.noeuds[s.E.joueurs[2].noyau].pf, -1);
  assert.equal(b.dernier('pf:etat').e.noeuds[s.E.joueurs[0].noyau].pf, 0, 'celles de l’allié se voient');

  const cible = frontiere(s.E, 0)[0];
  s.E.joueurs[0].res = 100;
  serveur.handleMessage(a, { t: 'cmd', c: { t: 'ver', cible, parfait: true } });
  s.avancer();
  assert.ok(s.E.progs.some((p) => p.j === 0 && p.fort), 'l’ordre parfait arrive au moteur');

  // Coupure : le pilote automatique, puis le retour.
  serveur.handleAway(b);
  assert.equal(s.E.joueurs[1].ia, 'normal');
  serveur.handleResume(b);
  assert.equal(s.E.joueurs[1].ia, null);
  assert.equal(b.dernier('pf:debut').reprise, true);

  // Départ en pleine partie : l'ordinateur prend la place.
  serveur.handleMessage(b, { t: 'leave' });
  assert.equal(s.places[1].bot, true);
  assert.equal(s.E.joueurs[1].ia, 'normal');

  // La partie va au bout, l'hôte relance.
  while (!s.E.fini) s.avancer();
  assert.equal(a.dernier('pf:etat').e.fini, true);
  serveur.handleMessage(a, { t: 'rejouer' });
  assert.ok(s.E && !s.E.fini);
  assert.equal(s.places.filter((p) => !p.bot).length, 1);
  serveur.handleClose(a);
  assert.equal(serveur._salles.has(code), false);
  serveur.reglerManuel(false);
});

/* ------------------------------ équilibre ------------------------------ */

test('équilibre de l’ordinateur : places justes, niveaux bien rangés', () => {
  const N = 120;
  for (const n of [2, 4]) {
    const v = Array(n).fill(0);
    for (let g = 0; g < N; g++) {
      const E = simuler({ joueurs: Array.from({ length: n }, () => ({ ia: 'normal' })), graine: 900 + g });
      if (E.gagnant >= 0) v[E.gagnant]++;
    }
    for (const x of v) assert.ok(x / N > 0.5 / n && x / N < 1.6 / n, `places à ${n} : ${v}`);
  }
  let eq0 = 0;
  for (let g = 0; g < 60; g++) if (simuler({ mode: '2v2', joueurs: [{ ia: 'normal' }, { ia: 'normal' }, { ia: 'normal' }, { ia: 'normal' }], graine: 300 + g }).gagnant === 0) eq0++;
  assert.ok(eq0 >= 18 && eq0 <= 42, `2 contre 2 : ${eq0}/60`);
  const duelNiv = (fort, faible) => {
    let w = 0;
    for (let g = 0; g < 60; g++) {
      const j = g % 2 ? [{ ia: fort }, { ia: faible }] : [{ ia: faible }, { ia: fort }];
      const E = simuler({ joueurs: j, graine: 500 + g });
      if (E.joueurs[E.gagnant]?.ia === fort) w++;
    }
    return w / 60;
  };
  assert.ok(duelNiv('normal', 'facile') >= 0.65, 'normal bat facile');
  assert.ok(duelNiv('difficile', 'normal') >= 0.62, 'difficile bat normal');
});
