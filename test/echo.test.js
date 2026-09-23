/**
 * ÉCHO — tests du barème, de la banque de sons et du moteur de partie.
 *
 * Le barème est la pièce qu'on conteste dans un jeu pareil : il est donc
 * éprouvé sur des signaux fabriqués dont on connaît la réponse attendue,
 * plutôt que sur l'impression qu'il « a l'air de marcher ».
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as A from '../public/shared/mimic/analyse.js';
import * as S from '../public/shared/mimic/sons.js';
import * as P from '../public/shared/mimic/partie.js';
import * as B from '../public/shared/mimic/bots.js';

const SR = 16000;

/** Fabrique un signal a partir d'une suite de notes. */
function chanter(notes, { transposer = 0, bruit = 0 } = {}) {
  const total = notes.reduce((a, n) => a + n.duree + (n.silence || 0), 0);
  const x = new Float32Array(Math.round(total * SR));
  let t = 0, phase = 0;
  for (const n of notes) {
    const hz = n.hz * Math.pow(2, transposer / 12);
    const len = Math.round(n.duree * SR);
    const i0 = Math.round(t * SR);
    for (let i = 0; i < len; i++) {
      phase += (2 * Math.PI * hz) / SR;
      const e = Math.min(1, i / (0.01 * SR)) * Math.min(1, (len - i) / (0.02 * SR));
      x[i0 + i] = 0.5 * e * (Math.sin(phase) + 0.3 * Math.sin(2 * phase));
    }
    t += n.duree + (n.silence || 0);
  }
  if (bruit) {
    let a = 987654321;
    for (let i = 0; i < x.length; i++) {
      a = (a * 1103515245 + 12345) & 0x7fffffff;
      x[i] += ((a / 0x7fffffff) - 0.5) * bruit;
    }
  }
  return x;
}

const AIR = [
  { hz: 330, duree: 0.30, silence: 0.08 },
  { hz: 392, duree: 0.30, silence: 0.08 },
  { hz: 494, duree: 0.45, silence: 0.08 },
];
const refAir = () => A.analyser(chanter(AIR), SR);
const note = (x) => A.noter(refAir(), A.analyser(x, SR));

/* ================================================================== */
/* Le bareme                                                          */
/* ================================================================== */

test('une imitation identique vaut cent', () => {
  const r = note(chanter(AIR));
  assert.equal(r.total, 100, JSON.stringify(r));
});

test('le registre vocal ne compte pas : la hauteur est relative', () => {
  // C'est la promesse centrale du jeu. Une voix de basse et une voix
  // d'enfant qui suivent le meme dessin doivent obtenir la meme note.
  for (const demi of [-12, -7, -5, 5, 7, 12]) {
    const r = note(chanter(AIR, { transposer: demi }));
    assert.ok(r.melodie >= 90,
      `transpose de ${demi} demi-tons : melodie ${r.melodie}, ce qui punit le registre`);
    assert.ok(r.total >= 92, `transpose de ${demi} : total ${r.total}`);
  }
});

test('chanter faux coute des points, proportionnellement', () => {
  const juste = note(chanter(AIR)).melodie;
  const unPeu = note(chanter([
    { hz: 330, duree: 0.30, silence: 0.08 },
    { hz: 415, duree: 0.30, silence: 0.08 },   // un demi-ton trop haut
    { hz: 494, duree: 0.45, silence: 0.08 },
  ])).melodie;
  const renverse = note(chanter([...AIR].reverse())).melodie;

  assert.ok(juste > unPeu, `juste ${juste} devrait battre approximatif ${unPeu}`);
  assert.ok(unPeu > renverse, `approximatif ${unPeu} devrait battre renverse ${renverse}`);
  assert.ok(renverse < 40, `un air renverse ne doit pas valoir ${renverse}`);
});

test('un rythme faux coute surtout au rythme', () => {
  // Memes notes, meme ordre, mais des durees tout autres.
  //
  // La melodie se compare sur un contour ramene a une duree commune : bousculer
  // le rythme deplace donc aussi les hauteurs sur la grille, et la melodie en
  // patit un peu. C'est assume — un air chante avec le mauvais rythme n'est
  // pas le meme air — mais c'est le RYTHME qui doit s'effondrer, pas elle.
  const juste = note(chanter(AIR));
  const r = note(chanter([
    { hz: 330, duree: 0.50, silence: 0.02 },
    { hz: 392, duree: 0.10, silence: 0.40 },
    { hz: 494, duree: 0.12, silence: 0.08 },
  ]));
  assert.ok(r.rythme < 45, `le rythme devrait s'effondrer, il vaut ${r.rythme}`);
  assert.ok(juste.rythme - r.rythme > juste.melodie - r.melodie,
    `le rythme doit perdre plus que la melodie : rythme ${juste.rythme}->${r.rythme}, `
    + `melodie ${juste.melodie}->${r.melodie}`);
});

test('un aboiement ne vaut pas trois aboiements', () => {
  const uneSeule = note(chanter([{ hz: 392, duree: 1.2 }]));
  assert.equal(uneSeule.detail.nPrise, 1);
  assert.equal(uneSeule.detail.nRef, 3);
  assert.ok(uneSeule.attaques < 50, `attaques ${uneSeule.attaques} pour 1 sur 3 attendues`);

  const cinq = note(chanter(Array.from({ length: 5 }, () => (
    { hz: 400, duree: 0.14, silence: 0.08 }))));
  assert.ok(cinq.attaques < 100, 'cinq attaques pour trois attendues doit couter');
});

test('le silence et le bruit ne rapportent rien', () => {
  const silence = note(new Float32Array(Math.round(1.2 * SR)));
  assert.equal(silence.total, 0);

  const bruit = new Float32Array(Math.round(1.2 * SR));
  let a = 12345;
  for (let i = 0; i < bruit.length; i++) {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    bruit[i] = (a / 0x7fffffff) - 0.5;
  }
  assert.ok(note(bruit).total < 25, 'du bruit blanc ne doit pas etre note comme une imitation');
});

test('un souffle de micro ne fait pas perdre la note', () => {
  const r = note(chanter(AIR, { bruit: 0.06 }));
  assert.ok(r.total >= 85, `un micro un peu bruite tombe a ${r.total}`);
});

test('les poids des trois dimensions font cent', () => {
  const somme = A.POIDS.melodie + A.POIDS.rythme + A.POIDS.attaques;
  assert.equal(somme, 100, `les poids font ${somme}`);
});

/* ================================================================== */
/* La banque de sons                                                  */
/* ================================================================== */

test('chaque son est complet et coherent', () => {
  assert.ok(S.SONS.length >= 20, 'il faut de quoi varier les manches sans se repeter');
  const ids = S.SONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants dupliques');

  for (const s of S.SONS) {
    assert.ok(S.FAMILLES[s.famille], `${s.id} : famille inconnue`);
    assert.ok(s.nom && s.glyph && s.indice, `${s.id} : fiche incomplete`);
    assert.ok(s.segments.length > 0, `${s.id} : aucun segment`);
    const d = S.dureeDe(s);
    assert.ok(d > 0.3 && d < 2.5, `${s.id} : duree de ${d.toFixed(2)} s`);
  }
});

test('chaque famille est representee plusieurs fois', () => {
  for (const f of S.FAMILLE_KEYS) {
    const n = S.SONS.filter((s) => s.famille === f).length;
    assert.ok(n >= 3, `famille ${f} : ${n} son(s)`);
  }
});

test('le nombre d\'attaques annonce est celui que le bareme comptera', () => {
  // C'est le contrat central de la banque : l'indice affiche « trois
  // aboiements » et le joueur en fait trois, donc le detecteur doit en
  // trouver trois. Sans ce test, un indice pourrait sanctionner qui a raison.
  for (const s of S.SONS) {
    const a = A.analyser(S.rendre(s, SR), SR);
    assert.equal(a.attaques.length, s.attaques,
      `${s.id} : annonce ${s.attaques} attaques, le bareme en compte ${a.attaques.length}`);
  }
});

test('le rendu est reproductible a graine egale', () => {
  for (const s of S.SONS.slice(0, 4)) {
    const a = S.rendre(s, SR, 99);
    const b = S.rendre(s, SR, 99);
    assert.deepEqual(Array.from(a.slice(0, 500)), Array.from(b.slice(0, 500)),
      `${s.id} : deux rendus identiques attendus`);
  }
});

test('un son se note cent contre lui-meme', () => {
  for (const s of S.SONS) {
    const x = S.rendre(s, SR, 7);
    const r = A.noter(A.analyser(x, SR), A.analyser(x, SR));
    assert.ok(r.total >= 99, `${s.id} : ${r.total} contre lui-meme`);
  }
});

test('chaque famille peut sortir, et chaque son avec elle', () => {
  // Le tirage parcourait les familles dans l'ordre de declaration : des qu'il
  // y en a eu plus que de manches, la derniere n'etait plus jamais tiree et
  // dix sons devenaient invisibles. L'ordre est desormais melange.
  const vues = {};
  const parSon = {};
  const rng = P.makeRng(1);
  for (let k = 0; k < 1500; k++) {
    for (const id of S.tirage(4, rng)) {
      const f = S.getSon(id).famille;
      vues[f] = (vues[f] || 0) + 1;
      parSon[id] = (parSon[id] || 0) + 1;
    }
  }
  const total = Object.values(vues).reduce((a, b) => a + b, 0);
  for (const f of S.FAMILLE_KEYS) {
    const part = (vues[f] || 0) / total;
    assert.ok(part > 0.1,
      `la famille ${f} ne represente que ${(part * 100).toFixed(1)} % des tirages`);
  }
  const jamais = S.SONS.filter((x) => !parSon[x.id]).map((x) => x.id);
  assert.equal(jamais.length, 0, `sons jamais tires : ${jamais.join(', ')}`);
});

test('un son sans hauteur redistribue son poids au lieu d\'offrir des points', () => {
  // Un scratch de vinyle n'a pas de melodie. La noter serait arbitraire :
  // son poids passe au rythme et aux attaques, et l'on ne donne rien pour rien.
  const sansHauteur = S.SONS.filter((x) => {
    const a = A.analyser(S.rendre(x, SR), SR);
    return a.hauteurs.filter((h) => h !== null).length === 0;
  });
  assert.ok(sansHauteur.length >= 1, 'il faut au moins un son non melodique pour tester ce chemin');

  for (const son of sansHauteur) {
    const ref = A.analyser(S.rendre(son, SR), SR);
    const parfaite = A.noter(ref, ref);
    assert.equal(parfaite.melodie, null, `${son.id} : la melodie doit etre neutralisee`);
    assert.equal(parfaite.total, 100, `${son.id} : une imitation exacte vaut cent`);

    // Et le silence ne doit pas profiter de la neutralisation.
    const muet = A.noter(ref, A.analyser(new Float32Array(SR), SR));
    assert.ok(muet.total < 20, `${son.id} : le silence vaut ${muet.total}`);
  }
});

test('le vibrato fait bouger la hauteur, sans la deplacer en moyenne', () => {
  const base = { hz: 440, duree: 0.8, forme: 'sinus', bruit: 0, vol: 0.8 };
  const plat = S.rendre({ segments: [base] }, SR, 1);
  const tremble = S.rendre({ segments: [{ ...base, vibrato: { hz: 6, demitons: 2 } }] }, SR, 1);

  const hauteurs = (x) => A.analyser(x, SR).hauteurs.filter((h) => h !== null);
  const ecartType = (a) => {
    const m = a.reduce((p, c) => p + c, 0) / a.length;
    return { m, sd: Math.sqrt(a.reduce((p, c) => p + (c - m) ** 2, 0) / a.length) };
  };
  const p1 = ecartType(hauteurs(plat));
  const p2 = ecartType(hauteurs(tremble));

  assert.ok(p2.sd > p1.sd * 3,
    `le vibrato doit faire trembler : ecart-type ${p1.sd.toFixed(1)} sans, ${p2.sd.toFixed(1)} avec`);
  assert.ok(Math.abs(p2.m - p1.m) < 25,
    `le vibrato ne doit pas transposer : ${p1.m.toFixed(0)} Hz contre ${p2.m.toFixed(0)} Hz`);
});

test('le tirage varie les familles et ne repete jamais un son', () => {
  const rng = P.makeRng(5);
  for (let k = 0; k < 20; k++) {
    const t = S.tirage(4, rng);
    assert.equal(t.length, 4);
    assert.equal(new Set(t).size, 4, `son repete : ${t.join(', ')}`);
    const familles = new Set(t.map((id) => S.getSon(id).famille));
    assert.ok(familles.size >= 3, `tirage trop monotone : ${[...familles].join(', ')}`);
  }
});

/* ================================================================== */
/* Les imitateurs                                                     */
/* ================================================================== */

test('les niveaux de bot sont ordonnes, et passent par le vrai bareme', () => {
  const moyenne = (niveau) => {
    const rng = P.makeRng(42);
    let somme = 0;
    const n = 180;
    for (let k = 0; k < n; k++) {
      const son = S.SONS[k % S.SONS.length];
      const ref = A.analyser(S.rendre(son, SR), SR);
      somme += A.noter(ref, A.analyser(B.prise(son, niveau, SR, rng).samples, SR)).total;
    }
    return somme / n;
  };
  const pouet = moyenne('pouet');
  const correct = moyenne('correct');
  const virtuose = moyenne('virtuose');

  assert.ok(correct > pouet + 5, `correct ${correct.toFixed(1)} vs pouet ${pouet.toFixed(1)}`);
  assert.ok(virtuose > correct + 5, `virtuose ${virtuose.toFixed(1)} vs correct ${correct.toFixed(1)}`);
  // Le meilleur ne doit pas etre hors d'atteinte d'une vraie voix.
  assert.ok(virtuose < 90, `virtuose a ${virtuose.toFixed(1)} : trop fort pour etre battu`);
});

test('un bot produit un vrai signal, de duree plausible', () => {
  const rng = P.makeRng(3);
  for (const s of S.SONS.slice(0, 6)) {
    const p = B.prise(s, 'correct', SR, rng);
    assert.ok(p.samples.length > SR * 0.2, `${s.id} : prise trop courte`);
    let max = 0;
    for (const v of p.samples) max = Math.max(max, Math.abs(v));
    assert.ok(max > 0.05, `${s.id} : prise muette`);
    assert.ok(max <= 1, `${s.id} : prise saturee`);
  }
});

/* ================================================================== */
/* Le moteur de partie                                                */
/* ================================================================== */

const duo = (seed = 1) => P.creerPartie(
  [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', isBot: true }], { seed });

/** Joue une manche entiere avec des notes imposees. */
function manche(e, notes) {
  P.lancerEnregistrement(e);
  for (const [id, n] of Object.entries(notes)) {
    P.deposerPrise(e, id, { total: n, melodie: n, rythme: n, attaques: n });
  }
  P.lancerRestitution(e);
  while (P.restitutionSuivante(e));
  return P.encaisserNotes(e);
}

test('une partie compte le bon nombre de manches, sans en sauter', () => {
  const e = duo(3);
  const vues = [];
  let garde = 0;
  while (e.phase !== P.PHASE.FIN && garde++ < 30) {
    vues.push(e.manche);
    const r = manche(e, { a: 60, b: 50 });
    if (r.roue) for (const j of e.joueurs) P.passerRoue(e, j.id);
    P.finirOuContinuer(e);
  }
  assert.deepEqual(vues, [1, 2, 3, 4],
    `manches traversees : ${vues.join(', ')} — aucune ne doit manquer ni se repeter`);
  assert.equal(e.phase, P.PHASE.FIN);
});

test('la roue n\'apparait qu\'a partir de la manche prevue', () => {
  const e = duo(4);
  for (let m = 1; m <= 4; m++) {
    const r = manche(e, { a: 40, b: 40 });
    assert.equal(r.roue, m >= P.MANCHE_ROUE,
      `manche ${m} : roue ${r.roue}, attendu ${m >= P.MANCHE_ROUE}`);
    if (r.roue) for (const j of e.joueurs) P.passerRoue(e, j.id);
    if (e.phase !== P.PHASE.FIN) P.finirOuContinuer(e);
  }
});

test('les notes s\'ajoutent au score, et une prise absente vaut zero', () => {
  const e = duo(5);
  P.lancerEnregistrement(e);
  P.deposerPrise(e, 'a', { total: 77, melodie: 70, rythme: 80, attaques: 90 });
  // « b » ne depose rien.
  P.lancerRestitution(e);
  while (P.restitutionSuivante(e));
  P.encaisserNotes(e);
  assert.equal(P.joueurDe(e, 'a').score, 77);
  assert.equal(P.joueurDe(e, 'b').score, 0);
  assert.equal(P.joueurDe(e, 'b').prises[0].absente, true);
});

test('une prise ne se depose qu\'une fois', () => {
  const e = duo(6);
  P.lancerEnregistrement(e);
  assert.equal(P.deposerPrise(e, 'a', { total: 50 }).ok, true);
  const r = P.deposerPrise(e, 'a', { total: 100 });
  assert.equal(r.ok, false);
  assert.equal(P.joueurDe(e, 'a').prises[0].note, 50, 'la seconde prise n\'existe pas');
});

test('la note deposee reste dans les bornes', () => {
  const e = duo(7);
  P.lancerEnregistrement(e);
  P.deposerPrise(e, 'a', { total: 4000, melodie: -30, rythme: 50, attaques: 50 });
  assert.equal(P.joueurDe(e, 'a').prises[0].note, 100);
});

test('un sabotage ne touche jamais les points', () => {
  const e = duo(8);
  manche(e, { a: 50, b: 50 });                 // manche 1
  P.finirOuContinuer(e);
  const r = manche(e, { a: 60, b: 60 });       // manche 2 : la roue s'ouvre
  assert.equal(r.roue, true);

  const avantA = P.joueurDe(e, 'a').score;
  const avantB = P.joueurDe(e, 'b').score;
  P.joueurDe(e, 'a').sabotageEnMain = 'canard';
  const v = P.viser(e, 'a', 'b');
  assert.equal(v.ok, true);
  assert.equal(P.joueurDe(e, 'b').sabotage, 'canard');
  assert.equal(P.joueurDe(e, 'a').score, avantA, 'saboter ne rapporte pas de points');
  assert.equal(P.joueurDe(e, 'b').score, avantB, 'etre sabote n\'en coute pas');
});

test('on ne se sabote pas soi-meme', () => {
  const e = duo(9);
  P.joueurDe(e, 'a').sabotageEnMain = 'echo';
  assert.equal(P.viser(e, 'a', 'a').ok, false);
  assert.equal(P.viser(e, 'a', 'personne').ok, false);
});

test('le sabotage ne dure qu\'une restitution', () => {
  const e = duo(10);
  manche(e, { a: 50, b: 50 });
  P.finirOuContinuer(e);
  P.joueurDe(e, 'b').sabotage = 'hache';
  manche(e, { a: 50, b: 50 });
  assert.equal(P.joueurDe(e, 'b').sabotage, null, 'le sabotage doit etre consomme');
});

test('la roue ne se tourne qu\'une fois par manche', () => {
  const e = duo(11);
  manche(e, { a: 50, b: 50 });
  P.finirOuContinuer(e);
  manche(e, { a: 50, b: 50 });
  assert.equal(e.phase, P.PHASE.ROUE);
  assert.equal(P.tournerRoue(e, 'a').ok, true);
  assert.equal(P.tournerRoue(e, 'a').ok, false);
  assert.equal(P.passerRoue(e, 'a').ok, false);
});

test('les cases de la roue sont completes et toutes atteignables', () => {
  const vues = new Set();
  const rng = P.makeRng(1);
  for (let i = 0; i < 4000; i++) vues.add(P.tirerCase(rng).key);
  for (const c of P.CASES) {
    assert.ok(c.label && c.glyph && c.color && c.blurb, `${c.key} : fiche incomplete`);
    assert.ok(c.poids > 0, `${c.key} : poids nul, case inatteignable`);
    assert.ok(vues.has(c.key), `${c.key} : jamais tiree en 4000 tours`);
    if (c.sabotage) assert.ok(P.SABOTAGES[c.sabotage], `${c.key} : sabotage inconnu`);
  }
});

test('la vue ne devoile pas les manches a venir', () => {
  const e = duo(12);
  const vue = P.viewFor(e, 'a');
  const brut = JSON.stringify(vue);
  // Le son de la manche en cours est public ; les suivants ne le sont pas.
  for (const id of e.programme.slice(1)) {
    assert.ok(!brut.includes(`"${id}"`),
      `le son ${id} d'une manche future ne doit pas transiter`);
  }
});

test('une partie se joue de bout en bout avec de vraies prises de bots', () => {
  const rng = P.makeRng(77);
  const bots = B.adversaires(2, 'correct', rng);
  const e = P.creerPartie([{ id: 'moi', name: 'Vous' }, ...bots], { seed: 21 });

  let garde = 0;
  while (e.phase !== P.PHASE.FIN && garde++ < 20) {
    const son = P.sonDeLaManche(e);
    const ref = A.analyser(S.rendre(son, SR), SR);
    P.lancerEnregistrement(e);
    // Le joueur imite parfaitement ; les bots font ce qu'ils peuvent.
    P.deposerPrise(e, 'moi', A.noter(ref, ref));
    for (const b of bots) {
      P.deposerPrise(e, b.id, A.noter(ref, A.analyser(B.prise(son, 'correct', SR, rng).samples, SR)));
    }
    P.lancerRestitution(e);
    while (P.restitutionSuivante(e));
    const r = P.encaisserNotes(e);
    if (r.roue) for (const j of e.joueurs) P.passerRoue(e, j.id);
    P.finirOuContinuer(e);
  }
  assert.equal(e.phase, P.PHASE.FIN);
  assert.equal(e.vainqueur, 'moi', 'une imitation parfaite doit gagner');
  assert.equal(P.joueurDe(e, 'moi').score, 400, 'quatre manches a cent');
});

/* ================================================================== */
/* Salon en ligne                                                     */
/* ================================================================== */

test('une partie en ligne se joue a deux contre le vrai serveur', async (t) => {
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  const ouverts = [];
  t.after(() => {
    for (const c of ouverts) c.close();
    server.closeAllConnections?.();
    return new Promise((res) => server.close(res));
  });

  /** Client minimal au-dessus du WebSocket natif de Node. */
  class C {
    constructor(url) {
      this.ws = new WebSocket(url);
      this.inbox = []; this.waiters = [];
      this.ws.addEventListener('message', (e) => {
        const m = JSON.parse(e.data);
        this.inbox.push(m);
        for (let i = this.waiters.length - 1; i >= 0; i--) {
          if (this.waiters[i].match(m)) this.waiters.splice(i, 1)[0].resolve(m);
        }
      });
    }
    ready() {
      return new Promise((res, rej) => {
        if (this.ws.readyState === 1) return res();
        this.ws.addEventListener('open', () => res(), { once: true });
        this.ws.addEventListener('error', rej, { once: true });
      });
    }
    /** Tout message porte `g` : c'est ce qui route vers le bon jeu. */
    send(o) { this.ws.send(JSON.stringify({ g: 'echo', ...o })); }
    wait(match, ms = 20000) {
      const f = this.inbox.find(match);
      if (f) return Promise.resolve(f);
      return new Promise((resolve, reject) => {
        const w = { match, resolve };
        this.waiters.push(w);
        setTimeout(() => {
          const i = this.waiters.indexOf(w);
          if (i >= 0) { this.waiters.splice(i, 1); reject(new Error('delai depasse')); }
        }, ms);
      });
    }
    close() { try { this.ws.close(); } catch { /* deja fermee */ } }
  }

  const url = `ws://127.0.0.1:${port}/api/ws`;
  const hote = new C(url), invite = new C(url);
  ouverts.push(hote, invite);
  await Promise.all([hote.ready(), invite.ready()]);

  hote.send({ t: 'hello', name: 'Hote' });
  await hote.wait((m) => m.t === 'e:bonjour');
  invite.send({ t: 'hello', name: 'Invite' });
  await invite.wait((m) => m.t === 'e:bonjour');

  hote.send({ t: 'create', name: 'Hote' });
  const salon = await hote.wait((m) => m.t === 'e:salon');
  assert.equal(salon.code.length, 4);

  invite.send({ t: 'join', code: salon.code, name: 'Invite' });
  await invite.wait((m) => m.t === 'e:salon' && m.joueurs.length === 2);

  // Un salon d'un seul ne part pas.
  const seul = new C(url);
  ouverts.push(seul);
  await seul.ready();
  seul.send({ t: 'create', name: 'Solitaire' });
  await seul.wait((m) => m.t === 'e:salon');
  seul.send({ t: 'start' });
  await seul.wait((m) => m.t === 'e:erreur');

  hote.send({ t: 'start' });
  await Promise.all([
    hote.wait((m) => m.t === 'e:debut'),
    invite.wait((m) => m.t === 'e:debut'),
  ]);

  // Le son de la manche arrive avec l'etat.
  const premier = await hote.wait((m) => m.t === 'e:etat' && m.vue.phase === 'ecoute');
  assert.ok(S.getSon(premier.sonId || premier.vue.sonId), 'un son doit etre annonce');
  assert.equal(premier.vue.manche, 1);

  // Puis vient la phase d'enregistrement.
  await hote.wait((m) => m.t === 'e:etat' && m.vue.phase === 'enregistrement');

  // Les deux deposent leur prise, avec un peu d'audio.
  const bidon = Buffer.from(new Uint8Array(400).fill(64)).toString('base64');
  hote.send({ t: 'prise', note: { total: 80, melodie: 80, rythme: 80, attaques: 80 }, audio: bidon });
  invite.send({ t: 'prise', note: { total: 40, melodie: 40, rythme: 40, attaques: 40 }, audio: bidon });

  // La restitution relaie l'audio de chacun.
  const resti = await invite.wait((m) => m.t === 'e:etat' && m.restitution);
  assert.ok(typeof resti.restitution.audio === 'string', 'la prise doit etre relayee');
  assert.equal(resti.restitution.index, 0);

  // Les notes tombent, et le score suit.
  const notes = await hote.wait((m) => m.t === 'e:etat' && m.vue.phase === 'notes', 30000);
  const scores = Object.fromEntries(notes.vue.joueurs.map((j) => [j.name, j.prise.note]));
  assert.equal(scores.Hote, 80);
  assert.equal(scores.Invite, 40);

  // Un client ne peut pas s'inventer une note hors bornes.
  // `wait` balaie tout l'historique : sans preciser la manche, on retrouverait
  // le message d'enregistrement de la manche 1 et l'on deposerait trop tot.
  await hote.wait((m) => m.t === 'e:etat' && m.vue.phase === 'ecoute' && m.vue.manche === 2, 30000);
  await hote.wait(
    (m) => m.t === 'e:etat' && m.vue.phase === 'enregistrement' && m.vue.manche === 2, 30000);
  hote.send({ t: 'prise', note: { total: 9999, melodie: 9999, rythme: 0, attaques: 0 }, audio: null });
  invite.send({ t: 'prise', note: { total: 10, melodie: 10, rythme: 10, attaques: 10 }, audio: null });
  const notes2 = await hote.wait(
    (m) => m.t === 'e:etat' && m.vue.phase === 'notes' && m.vue.manche === 2, 30000);
  const triche = notes2.vue.joueurs.find((j) => j.name === 'Hote');
  assert.equal(triche.prise.note, 100, 'la note doit etre ramenee dans les bornes');

  hote.close(); invite.close(); seul.close();
});

test('le routeur distingue les trois jeux', async (t) => {
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise((res) => server.close(res));
  });

  const ouvrir = (payload, ms = 1200) => new Promise((resolve, reject) => {
    const recu = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws`);
    ws.addEventListener('open', () => ws.send(JSON.stringify(payload)));
    ws.addEventListener('message', (e) => recu.push(JSON.parse(e.data)));
    ws.addEventListener('error', reject);
    setTimeout(() => { ws.close(); resolve(recu.map((m) => m.t)); }, ms);
  });

  const echo = await ouvrir({ g: 'echo', t: 'hello', name: 'E' });
  assert.ok(echo.includes('e:bonjour'), `attendu « e:bonjour », recu ${JSON.stringify(echo)}`);
  assert.ok(!echo.some((t2) => t2.startsWith('z:')), 'aucun message de Zenith ne doit passer ici');

  const zenith = await ouvrir({ g: 'zenith', t: 'hello', name: 'Z' });
  assert.ok(zenith.includes('z:welcome'), `attendu « z:welcome », recu ${JSON.stringify(zenith)}`);
  assert.ok(!zenith.some((t2) => t2.startsWith('e:')), 'aucun message d\'Echo ne doit passer ici');
});

/* ================================================================== */
/* Transport audio                                                    */
/* ================================================================== */

test('la compression conserve le signal, et le divise par quatre', async () => {
  // C'est ce qui transite en ligne : une prise abimee ici s'entendrait chez
  // tout le monde, et fausserait la restitution.
  const audio = await import('../public/games/echo/js/audio.js');
  const n = 16000;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin(i / 18) * 0.55 + Math.sin(i / 3) * 0.12;

  const octets = audio.comprimer(x);
  assert.equal(octets.length, n, 'un octet par echantillon');
  assert.ok(octets instanceof Uint8Array);

  const retour = audio.decomprimer(octets);
  assert.equal(retour.length, n);
  let carre = 0, pire = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(retour[i] - x[i]);
    carre += d * d; pire = Math.max(pire, d);
  }
  const eff = Math.sqrt(carre / n);
  assert.ok(eff < 0.02, `erreur efficace de ${eff.toFixed(4)} : trop degrade`);
  assert.ok(pire < 0.06, `pire ecart de ${pire.toFixed(4)}`);
});

test('une prise comprimee se note comme la prise d\'origine', () => {
  // Le lo-fi du transport ne doit pas changer le classement.
  return import('../public/games/echo/js/audio.js').then((audio) => {
    for (const son of S.SONS.slice(0, 8)) {
      const ref = A.analyser(S.rendre(son, SR), SR);
      const rng = P.makeRng(9);
      const prise = B.prise(son, 'correct', SR, rng).samples;
      const avant = A.noter(ref, A.analyser(prise, SR)).total;
      const apres = A.noter(ref, A.analyser(audio.decomprimer(audio.comprimer(prise)), SR)).total;
      assert.ok(Math.abs(avant - apres) <= 6,
        `${son.id} : ${avant} avant transport, ${apres} apres`);
    }
  });
});

test('le base64 fait l\'aller-retour sans perte', async () => {
  const audio = await import('../public/games/echo/js/audio.js');
  // `btoa` et `atob` n'existent pas partout : on verifie qu'ils sont la.
  if (typeof btoa !== 'function') return;
  const octets = new Uint8Array(5000);
  for (let i = 0; i < octets.length; i++) octets[i] = (i * 37) & 255;
  const retour = audio.depuisBase64(audio.enBase64(octets));
  assert.deepEqual(Array.from(retour), Array.from(octets));
});

test('les sabotages deforment sans detruire ni saturer', async () => {
  const audio = await import('../public/games/echo/js/audio.js');
  const n = 16000;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin(i / 20) * 0.4;

  for (const key of Object.keys(P.SABOTAGES)) {
    const y = audio.saboter(x, key);
    assert.equal(y.length, n, `${key} : la duree doit etre conservee`);
    let max = 0, energie = 0, differe = 0;
    for (let i = 0; i < n; i++) {
      max = Math.max(max, Math.abs(y[i]));
      energie += y[i] * y[i];
      if (Math.abs(y[i] - x[i]) > 1e-6) differe++;
    }
    assert.ok(max <= 1.001, `${key} : signal sature a ${max.toFixed(2)}`);
    assert.ok(Math.sqrt(energie / n) > 0.01, `${key} : le sabotage rend le silence`);
    assert.ok(differe > n * 0.1, `${key} : ne change presque rien au signal`);
  }

  // Sans sabotage, le signal ressort intact.
  assert.equal(audio.saboter(x, null), x);
});

test('un sabotage ne change pas la note, seulement ce qu\'on entend', async () => {
  const audio = await import('../public/games/echo/js/audio.js');
  const son = S.getSon('sirene');
  const ref = A.analyser(S.rendre(son, SR), SR);
  const rng = P.makeRng(4);
  const prise = B.prise(son, 'correct', SR, rng).samples;
  const propre = A.noter(ref, A.analyser(prise, SR)).total;

  // Le moteur note le signal propre ; la deformation n'intervient qu'a la
  // restitution. On verifie que les deux chemins sont bien distincts.
  for (const key of Object.keys(P.SABOTAGES)) {
    const deforme = audio.saboter(prise, key);
    const noteDeformee = A.noter(ref, A.analyser(deforme, SR)).total;
    // Le sabotage abime VRAIMENT le son : c'est precisement pour cela qu'il
    // ne doit jamais passer par le bareme.
    assert.ok(noteDeformee <= propre,
      `${key} : la deformation ne devrait jamais ameliorer la note`);
  }
  assert.ok(propre > 0, 'la prise propre doit valoir quelque chose');
});

test('le reechantillonnage garde la duree et le contenu', async () => {
  const audio = await import('../public/games/echo/js/audio.js');
  const de = 48000, vers = 16000, secondes = 0.5;
  const x = new Float32Array(de * secondes);
  for (let i = 0; i < x.length; i++) x[i] = Math.sin((2 * Math.PI * 220 * i) / de);
  const y = audio.reechantillonner(x, de, vers);
  assert.ok(Math.abs(y.length - vers * secondes) <= 2,
    `duree changee : ${y.length} au lieu de ${vers * secondes}`);
  // La hauteur doit survivre a la conversion.
  const h = A.analyser(y, vers).hauteurs.filter((v) => v !== null);
  const med = h.sort((a, b) => a - b)[Math.floor(h.length / 2)];
  assert.ok(Math.abs(med - 220) < 6, `hauteur devenue ${med.toFixed(1)} Hz au lieu de 220`);
});
