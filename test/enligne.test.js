/**
 * Les parties en ligne : sessions et reprises (server/hub.js), et les tables
 * de SKULL KING (server/skullking.js).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as hub from '../server/hub.js';
import { DELAIS } from '../server/skullking.js';

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

/** Une fausse connexion : elle garde ce qu'elle reçoit. */
function connexion() {
  const c = {
    id: `t${++seq}`,
    recus: [],
    ferme: false,
    send(o) { if (c.ferme) return false; c.recus.push(o); return true; },
    close() { if (!c.ferme) { c.ferme = true; hub.handleClose(c); } },
    // Un départ volontaire : on quitte la table, puis la connexion se ferme.
    partir() { if (!c.ferme) hub.handleMessage(c, { g: c.g, t: 'leave' }); c.close(); },
    dernier(t) { return [...c.recus].reverse().find((m) => m.t === t); },
  };
  hub.handleOpen(c);
  return c;
}
const dire = (c, msg) => { c.g = msg.g || 'saloon'; hub.handleMessage(c, msg); };
/** Une coupure brutale : le réseau tombe, sans « leave ». */
const couper = (c) => { c.ferme = true; hub.handleClose(c); };

// Des délais courts, pour que les parties de test aillent vite.
Object.assign(DELAIS, { pari: 60, tour: 20, bot: 5, absent: 20, pli: 5, bilan: 30, poisson: 20 });

test('Skull King : une table, des bots, une partie entière jusqu’au classement', async () => {
  const a = connexion();
  dire(a, { g: 'skullking', t: 'session', sid: 'sessionAAAA1' });
  dire(a, { g: 'skullking', t: 'create', name: 'Anne' });
  const code = a.dernier('sk:salon').code;
  const b = connexion();
  dire(b, { g: 'skullking', t: 'session', sid: 'sessionBBBB1' });
  dire(b, { g: 'skullking', t: 'join', code, name: 'Bart' });
  dire(b, { g: 'skullking', t: 'bot', delta: 1 });
  assert.match(b.dernier('sk:erreur').msg, /capitaine/, 'seul l’hôte règle les bots');
  dire(a, { g: 'skullking', t: 'bot', delta: 1 });
  assert.equal(a.dernier('sk:salon').joueurs.length, 3);

  dire(a, { g: 'skullking', t: 'start' });
  assert.ok(a.dernier('sk:debut'));
  let v = a.dernier('sk:etat').vue;
  assert.equal(v.phase, 'pari');
  assert.equal(v.main.length, 1);
  // Anne donne : elle parie en dernier.
  assert.equal(v.donneurAttend, true);
  dire(a, { g: 'skullking', t: 'pari', v: 1 });
  assert.match(a.dernier('sk:erreur').msg, /dernier/);
  // Les paris des autres restent secrets tant que tout le monde n'a pas parié.
  dire(b, { g: 'skullking', t: 'pari', v: 1 });
  v = a.dernier('sk:etat').vue;
  assert.equal(v.paris[1], null);
  assert.equal(v.aParie[1], true);
  // Anne voit le total des autres, et le chiffre qui lui est interdit.
  assert.equal(v.totalAutres, v.aParie.filter(Boolean).length ? v.totalAutres : null);
  assert.ok(v.interdit === null || v.interdit === 1 - v.totalAutres);

  // On laisse l'ordinateur jouer pour tout le monde (délais écoulés).
  const fin = Date.now() + 20000;
  while (Date.now() < fin) {
    v = a.dernier('sk:etat').vue;
    if (v.phase === 'fin') break;
    if (v.phase === 'bilan') { dire(a, { g: 'skullking', t: 'pret' }); dire(b, { g: 'skullking', t: 'pret' }); }
    await attendre(10);
  }
  assert.equal(v.phase, 'fin');
  assert.equal(v.historique.length, 10);
  // Aucune main d'adversaire n'a jamais été envoyée.
  for (const m of a.recus.filter((x) => x.t === 'sk:etat')) assert.ok(!('mains' in m.vue));
  a.partir(); b.partir();
});

test('Skull King : une coupure en pleine partie, et la place est reprise', async () => {
  const a = connexion();
  dire(a, { g: 'skullking', t: 'session', sid: 'sessionAAAA2' });
  dire(a, { g: 'skullking', t: 'create', name: 'Anne' });
  const code = a.dernier('sk:salon').code;
  const b = connexion();
  dire(b, { g: 'skullking', t: 'session', sid: 'sessionBBBB2' });
  dire(b, { g: 'skullking', t: 'join', code, name: 'Bart' });
  dire(a, { g: 'skullking', t: 'start' });
  const idB = b.dernier('sk:bienvenue').id;
  const mainAvant = b.dernier('sk:etat').vue.main.map((c) => c.id);

  couper(b);
  assert.match(a.dernier('sk:notice').msg, /Bart a perdu la connexion/);
  assert.equal(a.dernier('sk:etat').vue.absents[1], true);

  // Le téléphone revient avec sa clé de session : même place, même main.
  const b2 = connexion();
  dire(b2, { g: 'skullking', t: 'session', sid: 'sessionBBBB2' });
  assert.equal(b2.dernier('session').repris, true);
  assert.equal(b2.dernier('sk:bienvenue').id, idB);
  const v = b2.dernier('sk:etat').vue;
  assert.equal(v.moi, 1);
  if (v.manche === 1 && v.phase === 'pari') assert.deepEqual(v.main.map((c) => c.id), mainAvant);
  assert.match(a.dernier('sk:notice').msg, /de retour/);
  a.partir(); b2.partir();
});

test('une partie finie, ou une attente trop longue : plus de reprise', async () => {
  hub.reglerGrace(40);
  const a = connexion();
  dire(a, { g: 'skullking', t: 'session', sid: 'sessionAAAA3' });
  dire(a, { g: 'skullking', t: 'create', name: 'Anne' });
  const code = a.dernier('sk:salon').code;
  const b = connexion();
  dire(b, { g: 'skullking', t: 'session', sid: 'sessionBBBB3' });
  dire(b, { g: 'skullking', t: 'join', code, name: 'Bart' });
  dire(a, { g: 'skullking', t: 'start' });
  couper(b);
  await attendre(80);
  // Passé le délai, un bot a pris la place pour de bon.
  assert.match(a.dernier('sk:notice').msg, /pirate de l’ordinateur prend sa place/);
  const b2 = connexion();
  dire(b2, { g: 'skullking', t: 'session', sid: 'sessionBBBB3' });
  assert.equal(b2.dernier('session').repris, false);
  hub.reglerGrace(hub.GRACE_MS);

  // Au vestiaire (partie pas commencée), une coupure libère la chaise tout de suite.
  const c = connexion();
  dire(c, { g: 'skullking', t: 'session', sid: 'sessionCCCC3' });
  dire(c, { g: 'skullking', t: 'create', name: 'Cora' });
  const code2 = c.dernier('sk:salon').code;
  const d = connexion();
  dire(d, { g: 'skullking', t: 'session', sid: 'sessionDDDD3' });
  dire(d, { g: 'skullking', t: 'join', code: code2, name: 'Dan' });
  couper(d);
  assert.equal(c.dernier('sk:salon').joueurs.length, 1);
  a.partir(); b2.partir(); c.partir();
});

test('Liar’s Saloon : la reprise rend la même identité et la même main', () => {
  const a = connexion();
  dire(a, { t: 'session', sid: 'saloonAAAA1' });
  dire(a, { t: 'create', name: 'Anne', avatar: '🤠' });
  const code = a.dernier('room').code;
  const b = connexion();
  dire(b, { t: 'session', sid: 'saloonBBBB1' });
  dire(b, { t: 'join', code, name: 'Bart', avatar: '🎩' });
  dire(a, { t: 'start' });
  const idB = b.dernier('welcome').id;
  const main = JSON.stringify(b.dernier('state').view.me?.hand ?? b.dernier('state').view.hand);

  couper(b);
  assert.match(a.dernier('notice').msg, /Bart a perdu la connexion/);
  const b2 = connexion();
  dire(b2, { t: 'session', sid: 'saloonBBBB1' });
  assert.equal(b2.dernier('session').repris, true);
  assert.equal(b2.dernier('welcome').id, idB);
  assert.ok(b2.dernier('begin'));
  assert.equal(JSON.stringify(b2.dernier('state').view.me?.hand ?? b2.dernier('state').view.hand), main);
  a.partir(); b2.partir();
});

test('une vieille connexion encore ouverte est remplacée par la nouvelle', () => {
  const a = connexion();
  dire(a, { g: 'zenith', t: 'session', sid: 'zenithAAAA1' });
  dire(a, { g: 'zenith', t: 'create', name: 'Anne' });
  const code = a.dernier('z:room').code;
  const b = connexion();
  dire(b, { g: 'zenith', t: 'session', sid: 'zenithBBBB1' });
  dire(b, { g: 'zenith', t: 'join', code, name: 'Bart' });
  dire(a, { g: 'zenith', t: 'team', team: [] });
  dire(b, { g: 'zenith', t: 'team', team: [] });
  dire(a, { g: 'zenith', t: 'start' });
  assert.ok(b.dernier('z:tick'));
  // Le téléphone a changé de réseau : l'ancienne connexion n'est pas encore tombée.
  const b2 = connexion();
  dire(b2, { g: 'zenith', t: 'session', sid: 'zenithBBBB1' });
  assert.equal(b2.dernier('session').repris, true);
  assert.equal(b.ferme, true, 'l’ancienne est congédiée');
  assert.ok(b2.dernier('z:tick'));
  assert.ok(!a.recus.some((m) => m.t === 'z:forfeit'), 'personne n’a abandonné');
  a.partir(); b2.partir();
});

test('Skull King : le capitaine choisit les cartes custom, la partie les distribue', () => {
  const a = connexion();
  dire(a, { g: 'skullking', t: 'session', sid: 'sessionCUST1' });
  dire(a, { g: 'skullking', t: 'create', name: 'Anne' });
  const code = a.dernier('sk:salon').code;
  const b = connexion();
  dire(b, { g: 'skullking', t: 'session', sid: 'sessionCUST2' });
  dire(b, { g: 'skullking', t: 'join', code, name: 'Bart' });
  dire(b, { g: 'skullking', t: 'options', extras: ['canon'] });
  assert.match(b.dernier('sk:erreur').msg, /capitaine/);
  dire(a, { g: 'skullking', t: 'options', extras: ['canon', 'rhum', 'triche'] });
  assert.deepEqual(b.dernier('sk:salon').extras, ['rhum', 'canon']);
  dire(a, { g: 'skullking', t: 'start' });
  assert.deepEqual(b.dernier('sk:etat').vue.extras, ['rhum', 'canon']);
  a.partir(); b.partir();
});

test('Liar’s Saloon : l’hôte sort le Diable, la partie le distribue', () => {
  const a = connexion();
  dire(a, { t: 'session', sid: 'saloonDIAB1' });
  dire(a, { t: 'create', name: 'Anne', avatar: '🤠' });
  const code = a.dernier('room').code;
  const b = connexion();
  dire(b, { t: 'session', sid: 'saloonDIAB2' });
  dire(b, { t: 'join', code, name: 'Bart', avatar: '🎩' });
  dire(b, { t: 'options', diable: true });
  assert.match(b.dernier('error').msg, /hôte/);
  dire(a, { t: 'options', diable: true });
  assert.equal(b.dernier('room').diable, true);
  dire(a, { t: 'start' });
  assert.equal(a.dernier('state').view.diable, true);
  a.partir(); b.partir();
});

test('Skull King : une partie custom entière en ligne, Poisson dégueulasse compris', async () => {
  const a = connexion();
  dire(a, { g: 'skullking', t: 'session', sid: 'sessionFISH1' });
  dire(a, { g: 'skullking', t: 'create', name: 'Anne' });
  dire(a, { g: 'skullking', t: 'bot', delta: 1 });
  dire(a, { g: 'skullking', t: 'bot', delta: 1 });
  dire(a, { g: 'skullking', t: 'options', extras: ['poisson', 'rhum'] });
  dire(a, { g: 'skullking', t: 'start' });
  let v;
  let poisson = false;
  const fin = Date.now() + 20000;
  while (Date.now() < fin) {
    v = a.dernier('sk:etat').vue;
    if (v.phase === 'fin') break;
    if (v.phase === 'poisson') {
      poisson = true;
      if (v.poisson.p === v.moi) dire(a, { g: 'skullking', t: 'poisson', sens: v.sensPoisson[0] });
    }
    if (v.phase === 'bilan') dire(a, { g: 'skullking', t: 'pret' });
    await attendre(5);
  }
  assert.equal(v.phase, 'fin');
  assert.equal(v.historique.length, 10);
  assert.ok(poisson || !a.recus.some((m) => m.t === 'sk:etat' && m.vue.dernier?.poisson != null), 'le poisson s’est digéré');
  a.partir();
});
