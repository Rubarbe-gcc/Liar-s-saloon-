/**
 * Tests : regles du jeu, comportement des bots, et partie en ligne complete
 * jouee contre le vrai serveur (poignee de main WebSocket comprise).
 *
 *   node --test test/        ou        npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as E from '../public/shared/engine.js';
import * as AI from '../public/shared/ai.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seats3 = () => ([
  { id: 'a', name: 'Alice', avatar: '🌹' },
  { id: 'b', name: 'Bob', avatar: '🎩' },
  { id: 'c', name: 'Cass', avatar: '🃏' },
]);

/* ================================================================== */
/* Le paquet                                                          */
/* ================================================================== */

test('le paquet contient 20 cartes : 6/6/6 + 2 jokers', () => {
  const deck = E.buildDeck();
  assert.equal(deck.length, E.DECK_SIZE);
  for (const c of ['K', 'Q', 'A']) {
    assert.equal(deck.filter((x) => x === c).length, 6, `${c} doit apparaitre 6 fois`);
  }
  assert.equal(deck.filter((x) => x === 'J').length, 2);
});

test('le joker vaut n\'importe quelle carte demandee', () => {
  assert.ok(E.isValidCard('J', 'K'));
  assert.ok(E.isValidCard('J', 'Q'));
  assert.ok(E.isValidCard('K', 'K'));
  assert.ok(!E.isValidCard('K', 'Q'));
});

/* ================================================================== */
/* Distribution                                                       */
/* ================================================================== */

test('chaque joueur vivant recoit cinq cartes', () => {
  const s = E.createGame(seats3(), { seed: 1 });
  assert.equal(s.players.length, 3);
  for (const p of s.players) assert.equal(p.hand.length, E.HAND_SIZE);
  assert.ok(['K', 'Q', 'A'].includes(s.tableCard));
  assert.equal(s.phase, E.PHASE.PLAYING);
});

test('une graine identique redonne exactement la meme donne', () => {
  const a = E.createGame(seats3(), { seed: 7777 });
  const b = E.createGame(seats3(), { seed: 7777 });
  assert.deepEqual(a.players.map((p) => p.hand), b.players.map((p) => p.hand));
  assert.equal(a.tableCard, b.tableCard);
});

/* ================================================================== */
/* Poser des cartes                                                   */
/* ================================================================== */

test('on ne peut poser qu\'entre une et trois cartes, et seulement a son tour', () => {
  const s = E.createGame(seats3(), { seed: 2 });
  const me = E.currentPlayer(s);
  const other = s.players.find((p) => p.id !== me.id);

  assert.equal(E.playCards(s, other.id, [0]).error, 'not-your-turn');
  assert.equal(E.playCards(s, me.id, []).error, 'count');
  assert.equal(E.playCards(s, me.id, [0, 1, 2, 3]).error, 'count');
  assert.equal(E.playCards(s, me.id, [99]).error, 'range');

  const before = me.hand.length;
  assert.ok(E.playCards(s, me.id, [0, 1]).ok);
  assert.equal(me.hand.length, before - 2);
  assert.equal(s.pile, 2);
});

test('poser fait passer la main au joueur suivant qui a des cartes', () => {
  const s = E.createGame(seats3(), { seed: 3 });
  const first = E.currentPlayer(s);
  E.playCards(s, first.id, [0]);
  const next = E.currentPlayer(s);
  assert.notEqual(next.id, first.id);
  assert.ok(next.hand.length > 0);
});

test('des index dupliques ne consomment qu\'une carte', () => {
  const s = E.createGame(seats3(), { seed: 11 });
  const me = E.currentPlayer(s);
  const before = me.hand.length;
  assert.ok(E.playCards(s, me.id, [1, 1, 1]).ok);
  assert.equal(me.hand.length, before - 1);
  assert.equal(s.lastPlay.count, 1);
});

/* ================================================================== */
/* Accusation                                                         */
/* ================================================================== */

test('demasquer un menteur envoie le menteur a la roulette', () => {
  const s = E.createGame(seats3(), { seed: 4 });
  s.tableCard = 'K';
  const liar = E.currentPlayer(s);
  liar.hand = ['Q', 'Q', 'Q', 'Q', 'Q'];   // aucune carte valide
  E.playCards(s, liar.id, [0]);

  const accuser = E.currentPlayer(s);
  const res = E.challenge(s, accuser.id);
  assert.ok(res.ok);

  const chal = res.events.find((e) => e.type === 'challenge');
  assert.equal(chal.honest, false);
  assert.equal(chal.loserId, liar.id, 'le menteur doit tirer');
  assert.ok(res.events.some((e) => e.type === 'shot' && e.playerId === liar.id));
});

test('accuser a tort retourne l\'arme contre l\'accusateur', () => {
  const s = E.createGame(seats3(), { seed: 5 });
  s.tableCard = 'K';
  const honest = E.currentPlayer(s);
  honest.hand = ['K', 'K', 'J', 'Q', 'Q'];
  E.playCards(s, honest.id, [0, 1, 2]);      // deux rois et un joker : legitime

  const accuser = E.currentPlayer(s);
  const res = E.challenge(s, accuser.id);
  const chal = res.events.find((e) => e.type === 'challenge');
  assert.equal(chal.honest, true);
  assert.equal(chal.loserId, accuser.id);
});

test('on ne peut ni accuser dans le vide ni s\'accuser soi-meme', () => {
  const s = E.createGame(seats3(), { seed: 6 });
  const first = E.currentPlayer(s);
  assert.equal(E.challenge(s, first.id).error, 'nothing-to-challenge');

  E.playCards(s, first.id, [0]);
  assert.equal(E.challenge(s, first.id).error, 'not-your-turn');
});

test('une accusation ouvre toujours un entracte', () => {
  const s = E.createGame(seats3(), { seed: 8 });
  const first = E.currentPlayer(s);
  E.playCards(s, first.id, [0]);
  E.challenge(s, E.currentPlayer(s).id);
  assert.equal(s.phase, E.PHASE.INTERMISSION);
  assert.equal(s.resolution.kind, 'challenge');
});

/* ================================================================== */
/* Le revolver                                                        */
/* ================================================================== */

test('le barillet ne se recharge pas : six tirs tuent a coup sur', () => {
  for (let chamber = 0; chamber < 6; chamber++) {
    const s = E.createGame(seats3(), { seed: 100 + chamber });
    s.tableCard = 'K';
    const victim = s.players[0];
    victim.bulletChamber = chamber;

    let pulls = 0;
    while (victim.alive && pulls < 10) {
      // On force une accusation perdante contre la victime.
      s.phase = E.PHASE.PLAYING;
      s.turn = victim.seat;
      victim.hand = ['Q', 'Q', 'Q'];
      E.playCards(s, victim.id, [0]);
      E.challenge(s, E.currentPlayer(s).id);
      pulls++;
    }
    assert.equal(pulls, chamber + 1,
      `la balle en chambre ${chamber} doit partir au tir ${chamber + 1}`);
    assert.equal(victim.alive, false);
  }
});

test('les chances de survie affichees suivent les chambres restantes', () => {
  const s = E.createGame(seats3(), { seed: 9 });
  const p = s.players[0];
  const expected = [83, 80, 75, 67, 50, 0];
  for (let i = 0; i < 6; i++) {
    p.shotsFired = i;
    assert.equal(E.survivalOdds(p), expected[i], `apres ${i} tir(s)`);
  }
});

test('un joueur elimine perd sa main et sort du tour', () => {
  const s = E.createGame(seats3(), { seed: 10 });
  s.tableCard = 'K';
  const victim = s.players[0];
  victim.bulletChamber = 0;
  s.turn = victim.seat;
  victim.hand = ['Q', 'Q'];
  E.playCards(s, victim.id, [0]);
  E.challenge(s, E.currentPlayer(s).id);

  assert.equal(victim.alive, false);
  assert.equal(victim.hand.length, 0);
  assert.equal(E.alivePlayers(s).length, 2);
});

/* ================================================================== */
/* Fin de manche et de partie                                         */
/* ================================================================== */

test('la manche s\'arrete sans victime quand plus personne ne peut surencherir', () => {
  const s = E.createGame([
    { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
  ], { seed: 12 });
  s.players[1].hand = [];          // B n'a plus rien
  s.turn = s.players[0].seat;
  const res = E.playCards(s, 'a', [0]);
  assert.ok(res.events.some((e) => e.type === 'roundEnd' && e.reason === 'peace'));
  assert.equal(s.phase, E.PHASE.INTERMISSION);
});

test('la nouvelle manche redistribue cinq cartes aux seuls survivants', () => {
  const s = E.createGame(seats3(), { seed: 13 });
  s.players[2].alive = false;
  s.phase = E.PHASE.INTERMISSION;
  s.resolution = { kind: 'peace' };
  E.startRound(s);

  assert.equal(s.players[0].hand.length, 5);
  assert.equal(s.players[1].hand.length, 5);
  assert.equal(s.players[2].hand.length, 0);
  assert.equal(s.pile, 0);
  assert.equal(s.lastPlay, null);
});

test('le dernier debout remporte la partie', () => {
  const s = E.createGame(seats3(), { seed: 14 });
  s.players[1].alive = false;
  s.players[2].alive = false;
  s.phase = E.PHASE.INTERMISSION;
  const events = E.startRound(s);
  assert.equal(s.phase, E.PHASE.GAME_OVER);
  assert.equal(s.winnerId, s.players[0].id);
  assert.ok(events.some((e) => e.type === 'gameOver'));
});

test('une deconnexion libere le siege sans bloquer la table', () => {
  const s = E.createGame(seats3(), { seed: 15 });
  const leaver = E.currentPlayer(s);
  E.eliminate(s, leaver.id, 'quit');
  assert.equal(leaver.alive, false);
  assert.equal(E.currentPlayer(s).id !== leaver.id, true);
  assert.equal(s.phase, E.PHASE.PLAYING);
});

/* ================================================================== */
/* Confidentialite de la vue                                          */
/* ================================================================== */

test('la vue ne divulgue jamais la main des autres joueurs', () => {
  const s = E.createGame(seats3(), { seed: 16 });
  const v = E.viewFor(s, 'a');
  for (const p of v.players) {
    if (p.id === 'a') assert.equal(p.hand.length, 5);
    else {
      assert.equal(p.hand, null, `la main de ${p.id} ne doit pas fuiter`);
      assert.equal(p.handCount, 5);
    }
  }
  // Ni la position de la balle, ni la graine.
  assert.equal(JSON.stringify(v).includes('bulletChamber'), false);
});

test('la vue ne revele pas les cartes de la derniere pose', () => {
  const s = E.createGame(seats3(), { seed: 17 });
  const first = E.currentPlayer(s);
  E.playCards(s, first.id, [0, 1]);
  const v = E.viewFor(s, 'a');
  assert.equal(v.lastPlay.count, 2);
  assert.equal(v.lastPlay.cards, undefined, 'les cartes posees restent cachees');
});

/* ================================================================== */
/* Bots                                                               */
/* ================================================================== */

test('les bots ne proposent que des coups acceptes par le moteur', () => {
  for (let g = 0; g < 400; g++) {
    const s = E.createGame(AI.makeBots(3), { seed: g });
    const level = ['facile', 'normal', 'brutal'][g % 3];
    let steps = 0;

    while (s.phase !== E.PHASE.GAME_OVER && steps++ < 1500) {
      if (s.phase === E.PHASE.INTERMISSION) { E.startRound(s); continue; }
      const cur = E.currentPlayer(s);
      const move = AI.decide(s, cur.id, level);
      const res = move.type === 'challenge'
        ? E.challenge(s, cur.id)
        : E.playCards(s, cur.id, move.indices);
      assert.ok(res.ok, `coup refuse (${res.error}) partie ${g}`);
    }
    assert.equal(s.phase, E.PHASE.GAME_OVER, `partie ${g} non terminee`);
    assert.equal(E.alivePlayers(s).length, 1);
  }
});

test('les invariants du jeu tiennent sur une longue serie', () => {
  for (let g = 0; g < 300; g++) {
    const s = E.createGame(AI.makeBots(2 + (g % 3)), { seed: g * 31 });
    let steps = 0;
    while (s.phase !== E.PHASE.GAME_OVER && steps++ < 2000) {
      if (s.phase === E.PHASE.INTERMISSION) { E.startRound(s); continue; }
      const cur = E.currentPlayer(s);
      assert.ok(cur.alive && cur.hand.length > 0, 'tour donne a un joueur inapte');

      const move = AI.decide(s, cur.id, 'normal');
      if (move.type === 'challenge') E.challenge(s, cur.id);
      else E.playCards(s, cur.id, move.indices);

      const total = s.players.reduce((a, p) => a + p.hand.length, 0) + s.pile;
      assert.ok(total <= E.DECK_SIZE, 'plus de 20 cartes en circulation');
      for (const p of s.players) {
        assert.ok(p.hand.length <= E.HAND_SIZE);
        assert.ok(p.shotsFired <= E.CHAMBERS);
        if (!p.alive) assert.equal(p.hand.length, 0);
      }
    }
  }
});

test('les bots pretent les meilleures chances au bluff manifeste', () => {
  // Un joueur annonce 3 cartes alors que le bot detient deja toutes les
  // cartes valides : le soupcon doit etre quasi systematique.
  let calls = 0;
  const TRIES = 200;
  for (let i = 0; i < TRIES; i++) {
    const s = E.createGame(seats3(), { seed: 500 + i });
    s.tableCard = 'K';
    s.players[0].hand = ['Q', 'Q', 'A', 'A', 'A'];
    s.players[1].hand = ['Q', 'A', 'Q', 'A', 'Q'];
    s.players[2].hand = ['K', 'K', 'K', 'K', 'K'];
    s.players[2].profile = 'calculateur';
    s.turn = 0;
    E.playCards(s, 'a', [0, 1, 2]);
    s.turn = 2;
    if (AI.decide(s, 'c', 'brutal').type === 'challenge') calls++;
  }
  assert.ok(calls / TRIES > 0.7,
    `un bot impitoyable devrait accuser souvent ici (obtenu ${(calls / TRIES * 100).toFixed(0)}%)`);
});

/* ================================================================== */
/* Partie en ligne de bout en bout                                    */
/* ================================================================== */

/** Petit client de test au-dessus du WebSocket natif de Node. */
class Client {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.inbox = [];
    this.waiters = [];
    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      this.inbox.push(msg);
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        if (this.waiters[i].match(msg)) this.waiters.splice(i, 1)[0].resolve(msg);
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
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  /** Attend un message satisfaisant `match`, en regardant d'abord l'historique. */
  wait(match, ms = 8000) {
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
  close() { try { this.ws.close(); } catch { /* deja ferme */ } }
}

test('une partie en ligne se joue de bout en bout contre le vrai serveur', async (t) => {
  const port = 3000 + Math.floor(Math.random() * 4000);
  const srv = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => srv.kill('SIGKILL'));

  // Attend que le serveur annonce son ecoute.
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('le serveur ne demarre pas')), 8000);
    srv.stdout.on('data', (d) => {
      if (d.toString().includes(String(port))) { clearTimeout(to); res(); }
    });
    srv.stderr.on('data', (d) => process.stderr.write(`[serveur] ${d}`));
  });

  const base = `http://127.0.0.1:${port}`;

  await t.test('le site statique repond', async () => {
    const hub = await fetch(`${base}/`);
    assert.equal(hub.status, 200);
    assert.match(await hub.text(), /Insert Coin/);

    const game = await fetch(`${base}/games/liars-saloon/`);
    assert.equal(game.status, 200);
    assert.match(await game.text(), /Liar's Saloon/);

    const engine = await fetch(`${base}/shared/engine.js`);
    assert.equal(engine.status, 200);
    assert.match(engine.headers.get('content-type'), /javascript/);
  });

  await t.test('les pages chargent leurs feuilles de style sans barre oblique finale', async () => {
    // Les chemins d'assets doivent etre racine-absolus : une URL sans barre
    // oblique finale ferait sinon remonter les chemins relatifs d'un dossier,
    // et la page s'afficherait entierement sans style.
    const pages = {
      '/games/liars-saloon': '/games/liars-saloon/',
      '/': '/',
    };
    for (const [bare, withSlash] of Object.entries(pages)) {
      for (const url of [bare, withSlash]) {
        const html = await (await fetch(`${base}${url}`)).text();
        const refs = [...html.matchAll(/(?:href|src)="([^"]+\.(?:css|js))"/g)].map((m) => m[1]);
        assert.ok(refs.length > 0, `${url} ne reference aucun asset`);

        for (const ref of refs) {
          assert.ok(ref.startsWith('/'),
            `${url} reference « ${ref} » en relatif : la page casserait sans barre oblique finale`);
          const res = await fetch(`${base}${ref}`);
          assert.equal(res.status, 200, `${ref} introuvable (depuis ${url})`);
        }
      }
    }
  });

  await t.test('les ressources d\'installation sur mobile sont servies', async () => {
    // Sans manifeste, sans icones ou sans service worker, le site reste une
    // page web : il ne peut plus etre ajoute a l'ecran d'accueil ni jouer
    // hors connexion.
    const manifests = {
      '/manifest.webmanifest': '/',
      '/games/liars-saloon/manifest.webmanifest': '/games/liars-saloon/',
    };

    for (const [path, expectedStart] of Object.entries(manifests)) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, `${path} introuvable`);

      const m = JSON.parse(await res.text());
      assert.equal(m.start_url, expectedStart);
      assert.equal(m.display, 'standalone', `${path} doit s'ouvrir en plein ecran`);
      assert.ok(m.name && m.short_name, `${path} doit porter un nom`);

      const sizes = m.icons.map((i) => i.sizes);
      assert.ok(sizes.includes('192x192'), `${path} : icone 192 manquante`);
      assert.ok(sizes.includes('512x512'), `${path} : icone 512 manquante`);
      assert.ok(m.icons.some((i) => i.purpose === 'maskable'),
        `${path} : icone « maskable » manquante, Android recadrerait mal`);

      // Chaque icone declaree doit exister et etre bien un PNG.
      for (const icon of m.icons) {
        const r = await fetch(`${base}${icon.src}`);
        assert.equal(r.status, 200, `icone ${icon.src} introuvable`);
        const head = Buffer.from(await r.arrayBuffer()).subarray(0, 8);
        assert.deepEqual([...head], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
          `${icon.src} n'est pas un PNG`);
      }
    }

    // L'icone d'accueil iOS, qui ne figure dans aucun manifeste.
    for (const apple of ['/icons/apple-touch-icon.png', '/games/liars-saloon/icons/apple-touch-icon.png']) {
      assert.equal((await fetch(`${base}${apple}`)).status, 200, `${apple} introuvable`);
    }

    // Le service worker doit etre servi comme du JavaScript, sinon le
    // navigateur refuse de l'enregistrer.
    const sw = await fetch(`${base}/sw.js`);
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get('content-type'), /javascript/);
    const code = await sw.text();
    assert.match(code, /addEventListener\('fetch'/, 'le service worker n\'intercepte rien');
    assert.ok(code.includes("'/shared/engine.js'"),
      'le moteur de jeu doit etre precache, sinon rien ne tourne hors connexion');
  });

  await t.test('les pages declarent de quoi s\'installer sur un telephone', async () => {
    for (const page of ['/', '/games/liars-saloon/']) {
      const html = await (await fetch(`${base}${page}`)).text();
      assert.match(html, /<link rel="manifest"/, `${page} ne declare pas de manifeste`);
      assert.match(html, /apple-touch-icon/, `${page} n'a pas d'icone iOS`);
      assert.match(html, /viewport-fit=cover/, `${page} ignore les encoches`);
      assert.match(html, /apple-mobile-web-app-capable/, `${page} ne s'ouvrira pas en plein ecran sur iOS`);
    }
  });

  await t.test('la traversee de repertoire est refusee', async () => {
    for (const bad of ['/../package.json', '/..%2fpackage.json', '/games/../../package.json']) {
      const r = await fetch(`${base}${bad}`, { redirect: 'manual' });
      assert.ok(r.status === 404 || r.status === 400,
        `${bad} devrait etre refuse (recu ${r.status})`);
    }
  });

  await t.test('deux joueurs jouent une partie complete', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/api/ws`;
    const host = new Client(wsUrl);
    const guest = new Client(wsUrl);
    await Promise.all([host.ready(), guest.ready()]);

    const hostId = (await host.wait((m) => m.t === 'welcome')).id;
    await guest.wait((m) => m.t === 'welcome');

    host.send({ t: 'create', name: 'Hôte', avatar: '🎩' });
    const room = await host.wait((m) => m.t === 'room');
    assert.equal(room.code.length, 4);
    assert.equal(room.hostId, hostId);

    guest.send({ t: 'join', code: room.code, name: 'Invité', avatar: '🌹' });
    const full = await guest.wait((m) => m.t === 'room' && m.players.length === 2);
    assert.deepEqual(full.players.map((p) => p.name), ['Hôte', 'Invité']);

    // Un invite ne peut pas lancer la partie.
    guest.send({ t: 'start' });
    await guest.wait((m) => m.t === 'error');

    host.send({ t: 'start' });
    await Promise.all([
      host.wait((m) => m.t === 'begin'),
      guest.wait((m) => m.t === 'begin'),
    ]);

    const seen = { host: await host.wait((m) => m.t === 'state') };
    assert.equal(seen.host.view.players.length, 2);
    const mine = seen.host.view.players.find((p) => p.id === hostId);
    assert.equal(mine.hand.length, 5);
    const theirs = seen.host.view.players.find((p) => p.id !== hostId);
    assert.equal(theirs.hand, null, 'la main adverse ne doit pas etre transmise');

    // Joue jusqu'a la fin en posant toujours la premiere carte, avec une
    // accusation des que c'est permis : la partie doit se conclure.
    const clients = { [hostId]: host };
    const guestId = full.players.find((p) => p.id !== hostId).id;
    clients[guestId] = guest;

    let view = seen.host.view;
    let guard = 0;
    while (view.phase !== 'gameOver' && guard++ < 400) {
      if (view.phase !== 'playing') {
        view = (await host.wait((m) => m.t === 'state'
          && m.view.round > view.round || (m.t === 'state' && m.view.phase === 'gameOver'), 9000)).view;
        continue;
      }
      const actor = clients[view.turnId];
      if (!actor) break;

      const canChallenge = view.lastPlay && view.lastPlay.playerId !== view.turnId;
      if (canChallenge && guard % 3 === 0) actor.send({ t: 'challenge' });
      else actor.send({ t: 'play', indices: [0] });

      const next = await host.wait((m) => m.t === 'state' && m.view !== view, 9000);
      view = next.view;
      host.inbox.length = 0;   // evite que l'historique ne grossisse sans fin
      guest.inbox.length = 0;
      host.inbox.push(next);
    }

    assert.ok(guard < 400, 'la partie en ligne doit se terminer');
    assert.equal(view.phase, 'gameOver');
    assert.ok(view.winnerId, 'un vainqueur doit etre designe');

    host.close();
    guest.close();
  });

  await t.test('un code inconnu est rejete proprement', async () => {
    const c = new Client(`ws://127.0.0.1:${port}/api/ws`);
    await c.ready();
    await c.wait((m) => m.t === 'welcome');
    c.send({ t: 'join', code: 'ZZZZ', name: 'Perdu' });
    const err = await c.wait((m) => m.t === 'error');
    assert.match(err.msg, /Aucune table/);
    c.close();
  });

  await t.test('les noms sont nettoyes avant diffusion', async () => {
    const c = new Client(`ws://127.0.0.1:${port}/api/ws`);
    await c.ready();
    await c.wait((m) => m.t === 'welcome');
    c.send({ t: 'create', name: '<script>alert(1)</script>', avatar: '💣' });
    const room = await c.wait((m) => m.t === 'room');
    const name = room.players[0].name;
    assert.ok(!name.includes('<') && !name.includes('>'), `nom non nettoye : ${name}`);
    assert.ok(name.length <= 16);
    c.close();
  });
});
