/**
 * ZÉNITH — tests du roster, du moteur de combat et des adversaires.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as F from '../public/shared/zenith/fighters.js';
import * as B from '../public/shared/zenith/battle.js';
import * as AI from '../public/shared/zenith/ai.js';

const duo = (teamA, teamB, seed = 1) => B.createBattle([
  { id: 'a', name: 'A', team: teamA },
  { id: 'b', name: 'B', team: teamB },
], { seed });

/* ================================================================== */
/* Roster                                                             */
/* ================================================================== */

test('les budgets restent dans une fourchette resserree', () => {
  // Un budget strictement identique pour tous a ete abandonne : l'experience
  // montre qu'il ne produit pas une force egale. Il reste une indication, et
  // c'est le taux de victoire mesure plus bas qui fait foi.
  const budgets = F.FIGHTERS.map(F.budgetOf);
  const ecart = Math.max(...budgets) - Math.min(...budgets);
  assert.ok(ecart <= 30,
    `budgets trop disperses (${ecart}) : ${JSON.stringify(F.FIGHTERS.map((f) => [f.name, F.budgetOf(f)]))}`);
});

test('chaque element compte autant de combattants', () => {
  // Le cycle elementaire n'est equitable que si les effectifs le sont. Avec
  // quatre combattants de Braise et trois de Givre, un combattant de Braise
  // rencontrait plus d'adversaires qu'il domine que d'adversaires qui le
  // dominent : dix points de taux de victoire d'ecart, mesures.
  const parElement = {};
  for (const f of F.FIGHTERS) parElement[f.element] = (parElement[f.element] || 0) + 1;
  const effectifs = Object.values(parElement);
  assert.equal(Object.keys(parElement).length, F.ELEMENT_KEYS.length,
    'tous les elements doivent etre representes');
  assert.equal(new Set(effectifs).size, 1,
    `effectifs inegaux : ${JSON.stringify(parElement)}`);
});

test('le roster est coherent', () => {
  assert.ok(F.FIGHTERS.length >= 12, 'il faut de quoi composer des equipes variees');
  const ids = F.FIGHTERS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants dupliques');

  for (const f of F.FIGHTERS) {
    assert.ok(F.ELEMENTS[f.element], `${f.name} : element inconnu`);
    assert.ok(f.special && f.special.name, `${f.name} : pas de technique signature`);
    assert.ok(f.ultimate && f.ultimate.name, `${f.name} : pas d'ultime`);
    assert.ok(f.hp > 0 && f.strike > 0 && f.blast > 0, `${f.name} : statistique nulle`);
  }
});

test('le cycle elementaire boucle et reste equitable', () => {
  // Chaque element doit dominer exactement un autre, et etre domine par un
  // seul : sans cela, certains seraient structurellement avantages.
  const beaten = F.ELEMENT_KEYS.map((k) => F.ELEMENTS[k].beats);
  assert.equal(new Set(beaten).size, F.ELEMENT_KEYS.length, 'le cycle ne boucle pas');

  for (const k of F.ELEMENT_KEYS) {
    const wins = F.ELEMENT_KEYS.filter((o) => F.elementMultiplier(k, o) > 1).length;
    const losses = F.ELEMENT_KEYS.filter((o) => F.elementMultiplier(k, o) < 1).length;
    assert.equal(wins, 1, `${k} domine ${wins} elements`);
    assert.equal(losses, 1, `${k} est domine par ${losses} elements`);
  }
  assert.equal(F.elementMultiplier('braise', 'braise'), 1);
});

test('a investissement offensif egal, aucun profil ne domine l\'autre', () => {
  const brute = { strike: 90, blast: 30 };   // 120 points d'attaque
  const poly = { strike: 60, blast: 60 };    // 120 points d'attaque

  // Les techniques signature puisent dans les deux : elles s'equivalent.
  assert.equal(B.statOf(brute, 'mixte'), B.statOf(poly, 'mixte'));

  // Chacun garde son terrain.
  assert.ok(B.statOf(brute, 'strike') > B.statOf(poly, 'strike'),
    'la brute doit frapper plus fort au corps a corps');
  assert.ok(B.statOf(poly, 'blast') > B.statOf(brute, 'blast'),
    'le polyvalent doit mieux souffler');

  // Et surtout : les degats attendus, ponderes par la frequence de tirage
  // et la puissance de chaque carte, restent equivalents.
  const expected = (f) => 0.38 * 1.0 * B.statOf(f, 'strike')
    + 0.34 * 1.15 * B.statOf(f, 'blast')
    + 0.28 * 1.9 * B.statOf(f, 'mixte');
  const ecart = Math.abs(expected(brute) - expected(poly)) / expected(poly);
  assert.ok(ecart < 0.06,
    `ecart de degats attendus de ${(ecart * 100).toFixed(1)} % entre les deux profils`);
});

/* ================================================================== */
/* Moteur                                                             */
/* ================================================================== */

test('un combat demarre avec deux equipes completes', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  assert.equal(s.phase, B.PHASE.FIGHT);
  assert.equal(s.sides.length, 2);
  for (const side of s.sides) {
    assert.equal(side.team.length, B.TEAM_SIZE);
    assert.ok(side.hand.length > 0, 'la main de depart ne doit pas etre vide');
    for (const u of side.team) assert.equal(u.hp, u.maxHp);
  }
});

test('une meme graine rejoue le combat a l\'identique', () => {
  const run = () => {
    const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm'], 4242);
    const brains = [AI.createBrain('guerrier'), AI.createBrain('guerrier')];
    // On neutralise l'alea propre aux bots pour n'observer que le moteur.
    let t = 0;
    while (s.phase === B.PHASE.FIGHT && t++ < 500) {
      B.queueAction(s, 0, { type: 'play', index: 0 });
      B.queueAction(s, 1, { type: 'play', index: 0 });
      B.step(s);
    }
    return s.sides.map((x) => x.team.map((u) => u.hp));
  };
  assert.deepEqual(run(), run());
});

test('jouer une carte coute du ki, blesse la cible et immobilise l\'attaquant', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  // On teste avec une speciale : la frappe rend plus de ki qu'elle n'en
  // coute, ce qui masquerait la consommation.
  s.sides[0].hand = ['speciale'];
  s.sides[0].ki = 100;
  const before = s.sides[1].team[0].hp;

  assert.ok(B.queueAction(s, 0, { type: 'play', index: 0 }).ok);
  B.step(s);

  assert.ok(s.sides[1].team[0].hp < before, 'la cible doit perdre des points de vie');
  assert.ok(s.sides[0].ki < 100, 'le ki doit etre consomme');
  assert.ok(s.sides[0].team[0].stun > 0, 'l\'attaquant doit etre immobilise');
  assert.equal(s.sides[0].hand.length, 0, 'la carte doit quitter la main');
});

test('on ne peut pas jouer sans ki, ni pendant son immobilisation', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[0].hand = ['ultime'];
  s.sides[0].ki = 10;
  assert.equal(B.queueAction(s, 0, { type: 'play', index: 0 }).error, 'ki');

  s.sides[0].ki = 100;
  s.sides[0].team[0].stun = 5;
  assert.equal(B.queueAction(s, 0, { type: 'play', index: 0 }).error, 'occupé');
});

test('l\'avantage elementaire augmente reellement les degats', () => {
  // Braise domine Orage. Meme attaquant, meme carte, deux cibles dont on
  // egalise la garde pour n'observer que l'effet elementaire.
  const mk = (defId) => {
    const s = duo(['kaze', 'volt', 'nox'], [defId, 'gorm', 'tarn'], 99);
    s.rng = () => 0.5;                       // neutralise la variation
    return B.computeDamage(s, s.sides[0], s.sides[1], 'frappe');
  };
  const vsOrage = mk('volt');    // Kaze est Braise : avantage
  const vsGivre = mk('kelvin');  // Givre domine Braise : desavantage

  assert.equal(vsOrage.elem, F.ADVANTAGE_BONUS);
  assert.equal(vsGivre.elem, F.DISADVANTAGE_MALUS);
});

test('l\'esquive annule le coup suivant puis se consomme', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[1].ki = 100;
  assert.ok(B.queueAction(s, 1, { type: 'vanish' }).ok);
  B.step(s);
  assert.ok(s.sides[1].team[0].vanishUntil > s.tick, 'la fenetre doit etre ouverte');

  // On laisse l'attaquant recuperer, puis il frappe dans le vide.
  s.sides[0].team[0].stun = 0;
  s.sides[0].hand = ['frappe'];
  s.sides[0].ki = 100;
  const hp = s.sides[1].team[0].hp;
  B.queueAction(s, 0, { type: 'play', index: 0 });
  const fx = B.step(s);

  assert.equal(s.sides[1].team[0].hp, hp, 'le coup ne doit pas passer');
  assert.ok(fx.some((e) => e.type === 'vanish'), 'l\'esquive doit etre signalee');
  assert.ok(s.sides[1].team[0].vanishUntil <= s.tick, 'la fenetre doit etre consommee');
});

test('l\'ultime ne part qu\'une fois par combattant', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[0].hand = ['ultime', 'ultime'];
  s.sides[0].ki = 100;
  B.queueAction(s, 0, { type: 'play', index: 0 });
  B.step(s);
  assert.equal(s.sides[0].team[0].ultUsed, true);

  s.sides[0].team[0].stun = 0;
  s.sides[0].ki = 100;
  B.queueAction(s, 0, { type: 'play', index: 0 });
  const hp = s.sides[1].team[0].hp;
  B.step(s);
  assert.equal(s.sides[1].team[0].hp, hp, 'le second ultime ne doit rien faire');
});

test('un combattant a terre laisse la place au suivant', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[1].team[0].hp = 1;
  s.sides[0].hand = ['speciale'];
  s.sides[0].ki = 100;
  B.queueAction(s, 0, { type: 'play', index: 0 });
  B.step(s);

  assert.equal(s.sides[1].team[0].ko, true);
  assert.equal(s.phase, B.PHASE.FIGHT, 'le combat continue tant qu\'il reste du monde');
  B.advance(s, B.KO_SWAP_DELAY + 1);
  assert.notEqual(s.sides[1].active, 0, 'le suivant doit entrer en lice');
  assert.equal(s.sides[1].team[s.sides[1].active].ko, false);
});

test('le combat s\'arrete quand une equipe entiere est a terre', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[1].team[0].ko = true;
  s.sides[1].team[0].hp = 0;
  s.sides[1].team[1].ko = true;
  s.sides[1].team[1].hp = 0;
  s.sides[1].active = 2;
  s.sides[1].team[2].hp = 1;

  s.sides[0].hand = ['ultime'];
  s.sides[0].ki = 100;
  B.queueAction(s, 0, { type: 'play', index: 0 });
  const fx = B.step(s);

  assert.equal(s.phase, B.PHASE.OVER);
  assert.equal(s.winner, 0);
  assert.ok(fx.some((e) => e.type === 'victory'));
});

test('le changement vide la main et impose une recharge', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  assert.ok(B.queueAction(s, 0, { type: 'swap', slot: 1 }).ok);
  B.step(s);
  assert.equal(s.sides[0].active, 1);
  assert.equal(s.sides[0].hand.length, 0, 'la main appartient au combattant');
  assert.ok(s.sides[0].swapCd > 0);

  // On laisse le nouvel entrant reprendre ses esprits pour isoler la
  // recharge : sans cela le moteur repond « occupe » avant d'y arriver.
  s.sides[0].team[s.sides[0].active].stun = 0;
  assert.equal(B.queueAction(s, 0, { type: 'swap', slot: 2 }).error, 'recharge');
});

test('la vue ne transmet pas la main adverse', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const v = B.viewFor(s, 'a');
  assert.ok(Array.isArray(v.sides[0].hand), 'notre main doit etre visible');
  assert.equal(v.sides[1].hand, null, 'la main adverse donnerait une info de timing');
  assert.equal(typeof v.sides[1].handCount, 'number');
  assert.equal(JSON.stringify(v).includes('"seed"'), false);
});

/* ================================================================== */
/* Adversaires                                                        */
/* ================================================================== */

test('les bots ne produisent que des actions acceptees, et les combats aboutissent', () => {
  for (let g = 0; g < 200; g++) {
    const s = duo(F.randomTeam(3), F.randomTeam(3), g * 17 + 3);
    const brains = [
      AI.createBrain(AI.LEVEL_KEYS[g % 3]),
      AI.createBrain(AI.LEVEL_KEYS[(g + 1) % 3]),
    ];
    let t = 0;
    while (s.phase === B.PHASE.FIGHT && t++ < 4000) {
      AI.think(s, 0, brains[0]);
      AI.think(s, 1, brains[1]);
      B.step(s);

      for (const side of s.sides) {
        assert.ok(side.ki >= -0.001 && side.ki <= B.KI_MAX + 0.001, 'ki hors bornes');
        assert.ok(side.hand.length <= B.HAND_MAX, 'main trop grande');
        for (const u of side.team) {
          assert.ok(u.hp >= 0 && u.hp <= u.maxHp, 'pv hors bornes');
          if (u.ko) assert.equal(u.hp, 0);
        }
      }
    }
    assert.equal(s.phase, B.PHASE.OVER, `combat ${g} non termine`);
    assert.ok(s.winner === 0 || s.winner === 1);
  }
});

test('la difficulte est ordonnee : Legende bat Guerrier, qui bat Recrue', async () => {
  // Chaque duel oppose les memes equipes, seule la qualite de decision varie.
  const duel = (lvlA, lvlB, rounds = 140) => {
    let wins = 0;
    for (let g = 0; g < rounds; g++) {
      const team = F.randomTeam(3);
      const s = duo(team, [...team], g * 31 + 5);
      const brains = [AI.createBrain(lvlA), AI.createBrain(lvlB)];
      let t = 0;
      while (s.phase === B.PHASE.FIGHT && t++ < 4000) {
        AI.think(s, 0, brains[0]);
        AI.think(s, 1, brains[1]);
        B.step(s);
      }
      if (s.winner === 0) wins++;
    }
    return wins / rounds;
  };

  const legVsGuer = duel('legende', 'guerrier');
  const guerVsRec = duel('guerrier', 'recrue');

  assert.ok(legVsGuer > 0.55,
    `Legende devrait dominer Guerrier (obtenu ${(legVsGuer * 100).toFixed(0)}%)`);
  assert.ok(guerVsRec > 0.6,
    `Guerrier devrait dominer Recrue (obtenu ${(guerVsRec * 100).toFixed(0)}%)`);
});

test('aucun combattant n\'ecrase ni ne subit le roster', async () => {
  // Duels toutes rondes plutot qu'equipes aleatoires : la composition
  // d'equipe introduit un bruit qui noyait le signal. Ici chaque combattant
  // affronte tous les autres, des deux cotes, ce qui mesure sa force propre
  // avec un bruit d'environ 1,5 point.
  const SEEDS = 12;
  const wins = {}, games = {};
  for (const f of F.FIGHTERS) { wins[f.id] = 0; games[f.id] = 0; }

  for (let i = 0; i < F.FIGHTERS.length; i++) {
    for (let j = i + 1; j < F.FIGHTERS.length; j++) {
      for (let s = 0; s < SEEDS; s++) {
        const a = F.FIGHTERS[i].id, b = F.FIGHTERS[j].id;
        const [x, y] = s % 2 ? [b, a] : [a, b];   // on alterne les cotes
        const st = duo([x], [y], (i * 331 + j * 17 + s) * 7 + 3);
        const brains = [AI.createBrain('guerrier'), AI.createBrain('guerrier')];
        let t = 0;
        while (st.phase === B.PHASE.FIGHT && t++ < 4000) {
          AI.think(st, 0, brains[0]); AI.think(st, 1, brains[1]); B.step(st);
        }
        games[x]++; games[y]++;
        if (st.winner === 0) wins[x]++; else if (st.winner === 1) wins[y]++;
      }
    }
  }

  const rates = F.FIGHTERS.map((f) => ({ name: f.name, wr: wins[f.id] / games[f.id] * 100 }));
  const spread = Math.max(...rates.map((r) => r.wr)) - Math.min(...rates.map((r) => r.wr));
  assert.ok(spread < 20,
    `ecart de ${spread.toFixed(1)} points entre combattants : `
    + JSON.stringify(rates.map((r) => [r.name, +r.wr.toFixed(0)])));

  // Aucun element ne doit etre systematiquement avantage.
  const parElement = {};
  for (const f of F.FIGHTERS) (parElement[f.element] ||= []).push(wins[f.id] / games[f.id] * 100);
  const moyennes = Object.entries(parElement).map(([e, v]) => [e, v.reduce((a, b) => a + b) / v.length]);
  const ecartElement = Math.max(...moyennes.map((m) => m[1])) - Math.min(...moyennes.map((m) => m[1]));
  assert.ok(ecartElement < 9,
    `ecart de ${ecartElement.toFixed(1)} points entre elements : `
    + JSON.stringify(moyennes.map(([e, v]) => [e, +v.toFixed(0)])));
});

test('choisir sa carte vaut nettement mieux que jouer la premiere venue', () => {
  // Garde contre la derive qui rendrait le jeu purement mecanique : si jouer
  // n'importe quelle carte valait autant que choisir, il ne resterait qu'a
  // marteler l'ecran. Cette mesure est la traduction chiffree de ce reproche.
  const libre = (s) => { const u = B.activeUnit(s); return !u.ko && u.stun <= 0 && s.koPause === 0; };

  const premiere = (st, i) => {
    const s = st.sides[i];
    if (!libre(s)) return;
    for (let k = 0; k < s.hand.length; k++) {
      if (s.ki >= F.CARD_KINDS[s.hand[k]].ki) { B.queueAction(st, i, { type: 'play', index: k }); return; }
    }
  };
  const meilleure = (st, i) => {
    const s = st.sides[i], u = B.activeUnit(s);
    if (!libre(s)) return;
    let best = -1, bv = 0;
    s.hand.forEach((k, idx) => {
      const c = F.CARD_KINDS[k];
      if (s.ki < c.ki) return;
      const v = c.power * B.statOf(B.fighterOf(u), c.stat);
      if (v > bv) { bv = v; best = idx; }
    });
    if (best >= 0) B.queueAction(st, i, { type: 'play', index: best });
  };

  let gagnes = 0;
  const N = 400;
  for (let g = 0; g < N; g++) {
    const team = F.randomTeam(3);
    // Memes equipes des deux cotes : seule la facon de choisir differe.
    const st = duo(team, [...team], g * 131 + 7);
    let t = 0;
    while (st.phase === B.PHASE.FIGHT && t++ < 6000) { meilleure(st, 0); premiere(st, 1); B.step(st); }
    if (st.winner === 0) gagnes++;
  }
  const tx = gagnes / N * 100;
  assert.ok(tx > 57,
    `choisir sa carte ne vaut que ${tx.toFixed(1)} % : le jeu se reduirait a marteler`);
});

test('un combat dure un temps jouable sur telephone', () => {
  const lengths = [];
  for (let g = 0; g < 120; g++) {
    const s = duo(F.randomTeam(3), F.randomTeam(3), g * 53 + 1);
    const brains = [AI.createBrain('guerrier'), AI.createBrain('guerrier')];
    let t = 0;
    while (s.phase === B.PHASE.FIGHT && t++ < 4000) {
      AI.think(s, 0, brains[0]);
      AI.think(s, 1, brains[1]);
      B.step(s);
    }
    lengths.push(t * B.TICK_MS / 1000);
  }
  lengths.sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  assert.ok(median > 15 && median < 90,
    `duree mediane de ${median.toFixed(0)}s : trop expeditif ou trop long`);
});


/* ================================================================== */
/* Arene en ligne                                                     */
/* ================================================================== */

test('un combat en ligne se joue de bout en bout contre le vrai serveur', async (t) => {
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  t.after(() => new Promise((res) => server.close(res)));

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
    send(o) { this.ws.send(JSON.stringify({ g: 'zenith', ...o })); }
    wait(match, ms = 9000) {
      const found = this.inbox.find(match);
      if (found) return Promise.resolve(found);
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
  const host = new C(url), guest = new C(url);
  await Promise.all([host.ready(), guest.ready()]);

  host.send({ t: 'hello', name: 'Hote' });
  const hostId = (await host.wait((m) => m.t === 'z:welcome')).id;
  guest.send({ t: 'hello', name: 'Invite' });
  await guest.wait((m) => m.t === 'z:welcome');

  host.send({ t: 'create', name: 'Hote' });
  const room = await host.wait((m) => m.t === 'z:room');
  assert.equal(room.code.length, 4);

  guest.send({ t: 'join', code: room.code, name: 'Invite' });
  await guest.wait((m) => m.t === 'z:room' && m.players.length === 2);

  // Sans equipes, le combat ne doit pas partir.
  host.send({ t: 'start' });
  await host.wait((m) => m.t === 'z:error');

  host.send({ t: 'team', team: ['kaze', 'volt', 'nox'] });
  guest.send({ t: 'team', team: ['tarn', 'brume', 'gorm'] });
  await host.wait((m) => m.t === 'z:room' && m.players.every((p) => p.ready));

  host.send({ t: 'start' });
  await Promise.all([
    host.wait((m) => m.t === 'z:begin'),
    guest.wait((m) => m.t === 'z:begin'),
  ]);

  const first = await host.wait((m) => m.t === 'z:tick');
  assert.equal(first.view.sides.length, 2);
  assert.ok(Array.isArray(first.view.sides[first.view.viewerSide].hand));
  assert.equal(first.view.sides[1 - first.view.viewerSide].hand, null,
    'la main adverse donnerait une information de timing');

  // Les deux camps martelent leurs cartes jusqu'a ce qu'un vainqueur sorte.
  const spam = setInterval(() => {
    host.send({ t: 'act', action: { type: 'play', index: 0 } });
    guest.send({ t: 'act', action: { type: 'play', index: 0 } });
    // On evite que les boites de reception ne gonflent sans fin.
    if (host.inbox.length > 400) host.inbox.splice(0, 300);
    if (guest.inbox.length > 400) guest.inbox.splice(0, 300);
  }, 60);
  t.after(() => clearInterval(spam));

  const over = await host.wait((m) => m.t === 'z:tick' && m.view.phase === 'over', 60000);
  clearInterval(spam);

  assert.ok(over.view.winner === 0 || over.view.winner === 1, 'un vainqueur doit etre designe');
  const loser = over.view.sides[1 - over.view.winner];
  assert.ok(loser.team.every((u) => u.ko), 'le perdant doit avoir toute son equipe a terre');

  host.close();
  guest.close();
});

test('le routeur dirige chaque jeu vers son module', async (t) => {
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  t.after(() => new Promise((res) => server.close(res)));

  /** Ouvre une connexion, envoie un message, et collecte les reponses. */
  const open = (payload, ms = 1200) => new Promise((resolve, reject) => {
    const got = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws`);
    ws.addEventListener('open', () => ws.send(JSON.stringify(payload)));
    ws.addEventListener('message', (e) => got.push(JSON.parse(e.data)));
    ws.addEventListener('error', reject);
    setTimeout(() => { ws.close(); resolve(got.map((m) => m.t)); }, ms);
  });

  // Un client du saloon n'annonce aucun jeu : il doit recevoir son message
  // de bienvenue des l'ouverture, sans avoir rien envoye au prealable.
  const saloon = await open({ t: 'hello', name: 'S' });
  assert.ok(saloon.includes('welcome'), `attendu « welcome », recu ${JSON.stringify(saloon)}`);
  assert.ok(!saloon.some((t) => t.startsWith('z:')), 'aucun message de Zenith ne doit fuiter');

  // Un client de Zenith est d'abord rattache au jeu par defaut — c'est le
  // prix a payer pour que le saloon recoive son accueil sans delai — puis
  // bascule des son premier message. Le « welcome » initial est ignore par
  // son client ; ce qui compte est qu'il recoive bien « z:welcome ».
  const zen = await open({ g: 'zenith', t: 'hello', name: 'Z' });
  assert.ok(zen.includes('z:welcome'), `attendu « z:welcome », recu ${JSON.stringify(zen)}`);
  assert.ok(zen.includes('z:hello'), 'la bascule doit traiter le message d\'origine');
});


/* ================================================================== */
/* Personnages en pixel art                                           */
/* ================================================================== */

test('chaque combattant possede ses cinq poses, en SVG valide', async () => {
  const S = await import('../public/shared/zenith/sprites.js');
  for (const f of F.FIGHTERS) {
    for (const pose of S.POSES) {
      const svg = S.spriteSvg(f, pose);
      assert.match(svg, /^<svg /, `${f.name}/${pose} : pas un SVG`);
      assert.match(svg, /viewBox="0 0 16 16"/, `${f.name}/${pose} : grille inattendue`);
      assert.ok(svg.includes('<rect'), `${f.name}/${pose} : silhouette vide`);
      // Aucune couleur ne doit rester indefinie, sous peine de pixels noirs.
      assert.ok(!svg.includes('fill="undefined"') && !svg.includes('fill=""'),
        `${f.name}/${pose} : couleur manquante`);
    }
  }
});

test('deux combattants ne se ressemblent jamais exactement', () => {
  // Sans variation individuelle, tous les combattants d'un meme element
  // seraient rigoureusement identiques a l'ecran.
  return import('../public/shared/zenith/sprites.js').then((S) => {
    const vus = new Map();
    for (const f of F.FIGHTERS) {
      const svg = S.spriteSvg(f, 'repos');
      const jumeau = vus.get(svg);
      assert.ok(!jumeau, `${f.name} et ${jumeau} sont identiques au pixel pres`);
      vus.set(svg, f.name);
    }
    // Et la teinte doit rester reconnaissable par element.
    const parElement = {};
    for (const f of F.FIGHTERS) (parElement[f.element] ||= []).push(S.paletteFor(f)[5]);
    for (const [el, couleurs] of Object.entries(parElement)) {
      assert.equal(new Set(couleurs).size, couleurs.length,
        `${el} : deux combattants partagent exactement la meme teinte`);
    }
  });
});

test('chaque element porte une coiffe qui lui est propre', async () => {
  const S = await import('../public/shared/zenith/sprites.js');
  // Deux combattants de meme carrure mais d'elements differents doivent
  // presenter des silhouettes distinctes : c'est la coiffe qui doit les
  // separer, pas seulement la couleur.
  const parElement = {};
  for (const f of F.FIGHTERS) {
    const cle = `${S.buildOf(f)}`;
    (parElement[f.element] ||= {})[cle] = f;
  }

  const silhouettes = new Map();
  for (const [element, parCarrure] of Object.entries(parElement)) {
    for (const [carrure, f] of Object.entries(parCarrure)) {
      // On compare la forme seule, couleurs ignorees.
      const forme = S.composeGrid(f, 'repos').join('|');
      const autre = silhouettes.get(`${carrure}:${forme}`);
      assert.ok(!autre || autre === element,
        `${element} et ${autre} partagent la meme silhouette en carrure ${carrure}`);
      silhouettes.set(`${carrure}:${forme}`, element);
    }
  }
});

test('la coiffe ne masque jamais le visage', async () => {
  const S = await import('../public/shared/zenith/sprites.js');
  for (const f of F.FIGHTERS) {
    for (const pose of S.POSES) {
      if (pose === 'vaincu') continue;   // a terre, plus de tete dressee
      const grille = S.composeGrid(f, pose);
      assert.ok(grille.some((r) => r.includes('7')),
        `${f.name}/${pose} : les yeux sont recouverts par la coiffe`);
      assert.ok(grille.some((r) => r.includes('2')),
        `${f.name}/${pose} : plus aucun pixel de peau visible`);
    }
  }
});

test('la carrure decoule des statistiques', async () => {
  const S = await import('../public/shared/zenith/sprites.js');
  const carrures = {};
  for (const f of F.FIGHTERS) (carrures[S.buildOf(f)] ||= []).push(f.name);
  // Les trois carrures doivent etre utilisees, sans quoi elles ne servent a rien.
  for (const b of ['leste', 'franc', 'massif']) {
    assert.ok((carrures[b] || []).length > 0, `aucun combattant en carrure « ${b} »`);
  }
  const rapide = F.FIGHTERS.find((f) => f.speed >= 90);
  const lourd = F.FIGHTERS.find((f) => f.hp >= 1200);
  if (rapide) assert.equal(S.buildOf(rapide), 'leste');
  if (lourd) assert.equal(S.buildOf(lourd), 'massif');
});
