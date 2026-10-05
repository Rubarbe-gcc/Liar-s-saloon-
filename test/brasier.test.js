/**
 * BRASIER — tests des serviteurs, de l'économie, du combat, des bots et du
 * serveur.
 *
 * Le combat se joue seul et personne ne le voit en entier : chaque règle y est
 * donc éprouvée sur un plateau fabriqué dont on connaît l'issue.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as S from '../public/shared/brasier/serviteurs.js';

// Les tables en ligne tirent leur genre au hasard (Quête, Anomalie…) : ici, on
// veut des parties classiques, aux règles de base, pour vérifier l'or et les PV.
process.env.BRASIER_MODE = 'classique';
import * as H from '../public/shared/brasier/heros.js';
import * as C from '../public/shared/brasier/combat.js';
import * as P from '../public/shared/brasier/partie.js';
import * as B from '../public/shared/brasier/bots.js';
import { makeRng } from '../public/shared/hasard.js';

let n = 0;
const srv = (id, o = {}) => ({ ...S.creer(id, `t${++n}`, !!o.dore), ...o, mots: o.mots || [...(S.getServiteur(id).mots || [])] });
const combat = (a, b, seed = 1) => C.simulerCombat([a, b], { rng: makeRng(seed) });
const evs = (r, t) => r.events.filter((e) => e.t === t);

/** Une partie de huit bots, jouée jusqu'au bout. */
function partieDeBots(seed, surTour = () => {}) {
  const e = P.creerPartie(B.NOMS_BOTS.slice(0, 8).map((nom, i) => ({ id: `b${i}`, name: nom, isBot: true })), { seed });
  for (const j of e.joueurs) B.choisirHerosBot(e, j.id);
  P.commencer(e);
  while (e.phase !== P.PHASE.FIN) {
    for (const j of P.vivants(e)) B.jouerBot(e, j.id);
    surTour(e);
    P.terminerRecrutement(e);
    surTour(e);
    P.finirCombats(e);
  }
  return e;
}

/** Tous les exemplaires, en réserve ou en main, doivent faire le compte exact. */
function verifierReserve(e) {
  const compte = { ...e.reserve };
  const ajouter = (u) => { if (!S.getServiteur(u.id).jeton) compte[u.id] += u.dore ? 3 : 1; };
  for (const j of e.joueurs) {
    j.plateau.forEach(ajouter); j.main.forEach(ajouter); j.boutique.forEach(ajouter); j.decouvertes.flat().forEach(ajouter);
  }
  for (const s of S.RECRUTABLES) {
    assert.equal(compte[s.id], S.COPIES[s.tier], `${s.id} : ${compte[s.id]} exemplaires au lieu de ${S.COPIES[s.tier]}`);
  }
}

/* ================================================================== */
/* Les serviteurs                                                     */
/* ================================================================== */

test('le catalogue est complet et coherent', () => {
  const ids = S.SERVITEURS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants dupliques');
  for (const s of S.SERVITEURS) {
    assert.ok(s.nom && s.glyph, `${s.id} : fiche incomplete`);
    assert.ok(S.TRIBUS[s.tribu], `${s.id} : tribu inconnue`);
    assert.ok(s.tier >= 1 && s.tier <= 6, `${s.id} : rang ${s.tier}`);
    assert.ok(s.atk >= 0 && s.pv > 0, `${s.id} : statistiques`);
    for (const m of s.mots || []) assert.ok(S.MOTS[m], `${s.id} : mot-cle inconnu ${m}`);
    for (const moment of ['cri', 'fin', 'debut', 'rale']) {
      const e = s[moment];
      if (!e) continue;
      if (e.type === 'invoque') assert.ok(S.getServiteur(e.id), `${s.id} : invoque un inconnu`);
      if (e.tribu) assert.ok(S.TRIBUS[e.tribu], `${s.id} : tribu visee inconnue`);
      assert.ok(S.texte(s.id).length > 10, `${s.id} : effet sans texte`);
    }
  }
  for (let r = 1; r <= 6; r++) {
    assert.ok(S.RECRUTABLES.filter((s) => s.tier === r).length >= 3, `rang ${r} trop maigre`);
  }
});

test('une version doree double ses effets', () => {
  const u = srv('fauve-alpha', { dore: true });
  assert.deepEqual(S.effetDe(u, 'cri'), { type: 'buff', cible: 'tribu', tribu: 'fauve', atk: 4, pv: 4 });
  assert.match(S.texte('fauve-alpha', true), /\+4\/\+4/);
});

test('la chimere appartient a toutes les tribus', () => {
  for (const t of ['fauve', 'rouage', 'ecaille', 'demon', 'dragon', 'spectre']) {
    assert.ok(S.deTribu('chimere-parfaite', t), `chimere hors de la tribu ${t}`);
  }
});

test('chaque heros a un pouvoir decrit, et les passifs n\'ont pas de cout', () => {
  assert.ok(H.HEROS.length >= 8);
  for (const h of H.HEROS) {
    assert.ok(h.nom && h.glyph && h.pouvoir.texte, `${h.id} : fiche incomplete`);
    if (h.pouvoir.passif) assert.equal(h.pouvoir.cout, null);
    else assert.ok(h.pouvoir.cout >= 0);
  }
});

/* ================================================================== */
/* Le combat                                                          */
/* ================================================================== */

test('le camp le plus nombreux frappe en premier', () => {
  const r = combat([srv('chat-braise'), srv('chat-braise')], [srv('diablotin-farceur')]);
  assert.equal(evs(r, 'premier')[0].camp, 0);
  const r2 = combat([srv('diablotin-farceur')], [srv('chat-braise'), srv('chat-braise')]);
  assert.equal(evs(r2, 'premier')[0].camp, 1);
});

test('la provocation attire tous les coups', () => {
  for (let s = 1; s < 30; s++) {
    const provoc = srv('sentinelle-cuivre', { mots: ['provocation'] });
    const r = combat([srv('apprenti-forgeron', { atk: 1, pv: 50 })], [srv('chat-braise', { atk: 0, pv: 99 }), provoc], s);
    const premiere = evs(r, 'attaque').find((e) => r.events[0].camps[0].some((u) => u.uid === e.a));
    assert.equal(premiere.c, provoc.uid, 'la premiere attaque doit viser la provocation');
  }
});

test('le bouclier sacre annule exactement un coup', () => {
  const r = combat([srv('chat-braise', { atk: 5, pv: 1 })], [srv('eclaireur-ressort', { atk: 0, pv: 2 })]);
  assert.equal(evs(r, 'bouclier').length, 1);
  const coups = evs(r, 'coup').filter((e) => e.uid === r.events[0].camps[1][0].uid);
  assert.equal(coups.length, 1, 'le second coup doit porter');
  assert.equal(r.gagnant, 0);
});

test('le venin tue ce qu\'il blesse, mais pas a travers un bouclier', () => {
  const r = combat([srv('mord-venin', { atk: 1, pv: 100 })], [srv('apprenti-forgeron', { atk: 0, pv: 80 })]);
  assert.equal(r.gagnant, 0);
  assert.equal(evs(r, 'attaque').length, 1, 'un seul coup de venin suffit');

  const r2 = combat([srv('mord-venin', { atk: 1, pv: 100 })], [srv('apprenti-forgeron', { atk: 0, pv: 80, mots: ['bouclier'] })]);
  assert.equal(evs(r2, 'bouclier').length, 1);
  assert.equal(evs(r2, 'attaque').length, 2, 'le bouclier absorbe le premier coup de venin');
});

test('la reincarnation ramene le serviteur une fois, avec 1 PV', () => {
  const r = combat([srv('squelette-ricanant')], [srv('apprenti-forgeron', { atk: 5, pv: 100 })]);
  const retours = evs(r, 'invoque').filter((e) => e.reincarne);
  assert.equal(retours.length, 1);
  assert.equal(retours[0].u.pv, 1);
  assert.ok(!retours[0].u.mots.includes('reincarnation'), 'il ne revient qu\'une fois');
  assert.equal(r.gagnant, 1);
});

test('la furie attaque deux fois', () => {
  const r = combat([srv('dresseur-braises', { atk: 1, pv: 100 })], [srv('apprenti-forgeron', { atk: 0, pv: 100 })]);
  const a = r.events[0].camps[0][0].uid;
  const suite = evs(r, 'attaque').slice(0, 2);
  assert.ok(suite.every((e) => e.a === a), 'les deux premieres attaques sont les siennes');
});

test('le balayage touche les voisins de la cible', () => {
  const cibles = [srv('apprenti-forgeron', { atk: 0, pv: 20 }), srv('apprenti-forgeron', { atk: 0, pv: 20, mots: ['provocation'] }),
    srv('apprenti-forgeron', { atk: 0, pv: 20 })];
  const r = combat([srv('hydre-gouffres', { atk: 3, pv: 50 })], cibles);
  const premier = evs(r, 'attaque')[0];
  const touches = new Set(r.events.slice(r.events.indexOf(premier) + 1).filter((e) => e.t === 'coup').slice(0, 3).map((e) => e.uid));
  for (const c of cibles) assert.ok(touches.has(c.uid), 'les trois doivent etre touches');
});

test('un rale invoque a la place du mort', () => {
  const r = combat([srv('mere-ourse', { atk: 0, pv: 1 })], [srv('apprenti-forgeron', { atk: 1, pv: 100 })]);
  const oursons = evs(r, 'invoque').filter((e) => e.u.id === 'ourson' && e.camp === 0);
  assert.equal(oursons.length, 2);
  assert.equal(oursons[0].pos, 0);
});

test('le plateau ne depasse jamais sept, meme en invoquant', () => {
  const plein = Array.from({ length: 7 }, () => srv('titan-engrenages', { atk: 0, pv: 1, mots: [] }));
  const r = combat(plein, [srv('hydre-gouffres', { atk: 1, pv: 999, mots: ['balayage'] })]);
  let taille = 7;
  for (const e of r.events) {
    if (e.t === 'mort' && r.events[0].camps[0].concat(evs(r, 'invoque').map((x) => x.u)).some((u) => u.uid === e.uid)) taille--;
    if (e.t === 'invoque' && e.camp === 0) taille++;
    assert.ok(taille <= 7, 'huit serviteurs sur un plateau');
  }
});

test('une meme graine rejoue le combat a l\'identique', () => {
  const a = [srv('chef-maree'), srv('goule-affamee'), srv('mord-venin')];
  const b = [srv('mere-ourse'), srv('souffle-braise'), srv('squelette-ricanant')];
  assert.deepEqual(combat(a, b, 42).events, combat(a, b, 42).events);
});

test('deux plateaux sans attaque font match nul, sans boucler', () => {
  const r = combat([srv('apprenti-forgeron', { atk: 0 })], [srv('apprenti-forgeron', { atk: 0 })]);
  assert.equal(r.gagnant, null);
  const r2 = combat([], []);
  assert.equal(r2.gagnant, null);
});

test('le debut de combat part avant le premier coup', () => {
  const r = combat([srv('souffle-braise')], [srv('apprenti-forgeron', { atk: 1, pv: 10 })]);
  const iCoup = r.events.findIndex((e) => e.t === 'coup');
  const iAttaque = r.events.findIndex((e) => e.t === 'attaque');
  assert.ok(iCoup < iAttaque, 'les 2 degats du souffle-braise tombent avant toute attaque');
});

/* ================================================================== */
/* L'economie                                                         */
/* ================================================================== */

const duo = (seed = 1, heros = 'zora') => {
  const e = P.creerPartie([{ id: 'a', name: 'A' }, { id: 'b', name: 'B', isBot: true }], { seed });
  for (const j of e.joueurs) { j.offre = [heros, ...j.offre.slice(1)]; P.choisirHeros(e, j.id, heros); }
  P.commencer(e);
  return e;
};

test('l\'or suit les tours : trois au premier, un de plus ensuite, dix au plus', () => {
  const e = duo(2);
  const vus = [];
  for (let t = 0; t < 10; t++) {
    vus.push(P.joueurDe(e, 'a').or);
    P.terminerRecrutement(e);
    P.finirCombats(e);
    if (e.phase === P.PHASE.FIN) break;
  }
  assert.deepEqual(vus.slice(0, 9), [3, 4, 5, 6, 7, 8, 9, 10, 10]);
});

test('la taverne coute 5 au premier tour, un de moins a chaque tour, puis le rang suivant', () => {
  const e = duo(3);
  const a = P.joueurDe(e, 'a');
  assert.equal(a.coutRang, 5);
  P.terminerRecrutement(e); P.finirCombats(e);
  assert.equal(a.coutRang, 4);
  assert.equal(P.agir(e, 'a', { type: 'ameliorer' }).ok, true);
  assert.equal(a.taverne, 2);
  assert.equal(a.coutRang, P.COUT_RANG[3]);
  assert.equal(a.boutique.length, P.TAILLE_TAVERNE[1], 'la taverne ne grandit qu\'au prochain rafraichissement');
});

test('acheter coute trois, vendre rend un et remet la carte en reserve', () => {
  const e = duo(4);
  const a = P.joueurDe(e, 'a');
  const id = a.boutique[0].id;
  const avant = e.reserve[id];
  assert.equal(P.agir(e, 'a', { type: 'acheter', i: 0 }).ok, true);
  assert.equal(a.or, 0);
  assert.equal(a.main.length, 1, 'un achat va dans la main');
  assert.equal(a.plateau.length, 0);
  assert.equal(P.agir(e, 'a', { type: 'acheter', i: 0 }).error, 'or');
  assert.equal(P.agir(e, 'a', { type: 'jouer', i: 0 }).ok, true);
  const iPlateau = a.plateau.findIndex((u) => u.id === id);
  assert.ok(iPlateau >= 0, 'jouer le pose sur le plateau');
  assert.equal(P.agir(e, 'a', { type: 'vendre', i: iPlateau }).ok, true);
  assert.equal(a.or, 1);
  assert.equal(e.reserve[id], avant + 1);
  verifierReserve(e);
});

test('le plateau refuse un huitieme serviteur, la main un onzieme', () => {
  const e = duo(5);
  const a = P.joueurDe(e, 'a');
  a.plateau = Array.from({ length: 7 }, () => S.creer('chaton', `x${++n}`));
  a.or = 10;
  // Plateau plein : on achète quand même, dans la main…
  assert.equal(P.agir(e, 'a', { type: 'acheter', i: 0 }).ok, true);
  // … mais on ne pose pas.
  assert.equal(P.agir(e, 'a', { type: 'jouer', i: 0 }).error, 'plein');
  a.main = Array.from({ length: P.MAIN_MAX }, () => S.creer('chaton', `m${++n}`));
  assert.equal(P.agir(e, 'a', { type: 'acheter', i: 0 }).error, 'main');
});

test('on pose une carte de sa main ou l’on veut, et la vendre depuis la main rend un', () => {
  const e = duo(15);
  const a = P.joueurDe(e, 'a');
  for (const u of a.boutique) e.reserve[u.id]++;
  a.boutique = [];
  const [x, y, z] = ['diablotin-farceur', 'diablotin-farceur', 'diablotin-farceur'].map(() => S.creer('chaton', `q${++n}`));
  a.plateau = [x, y];
  a.main = [z];
  assert.equal(P.agir(e, 'a', { type: 'jouer', i: 0, vers: 1 }).ok, true);
  assert.deepEqual(a.plateau.map((u) => u.uid), [x.uid, z.uid, y.uid]);
  a.main = [a.plateau.pop()];
  a.or = 0;
  assert.equal(P.agir(e, 'a', { type: 'vendreMain', i: 0 }).ok, true);
  assert.equal(a.or, 1);
  assert.equal(a.main.length, 0);
});

test('geler garde la taverne d\'un tour sur l\'autre, rafraichir la change', () => {
  const e = duo(6);
  const a = P.joueurDe(e, 'a');
  P.agir(e, 'a', { type: 'geler' });
  const gelee = a.boutique.map((u) => u.uid);
  P.terminerRecrutement(e); P.finirCombats(e);
  assert.deepEqual(a.boutique.map((u) => u.uid), gelee);
  assert.equal(a.gel, false, 'le gel ne dure qu\'un tour');
  P.agir(e, 'a', { type: 'rafraichir' });
  assert.notDeepEqual(a.boutique.map((u) => u.uid), gelee);
  verifierReserve(e);
});

test('trois exemplaires font un dore — main et plateau confondus — et le poser offre une decouverte', () => {
  const e = duo(7);
  const a = P.joueurDe(e, 'a');
  // Trois copies prises dans la reserve, comme si on les avait achetees ; la
  // taverne d'origine y retourne, pour que le compte reste juste.
  for (const u of a.boutique) e.reserve[u.id]++;
  const trois = [0, 1, 2].map(() => { e.reserve['diablotin-farceur']--; return S.creer('diablotin-farceur', `p${++n}`); });
  trois[0].atk += 3;                 // un exemplaire deja renforce
  a.plateau = [trois[0]];            // un sur le plateau…
  a.main = [trois[1]];               // … un dans la main…
  a.boutique = [trois[2]];           // … le troisième en taverne
  a.or = 3;
  assert.equal(P.agir(e, 'a', { type: 'acheter', i: 0 }).ok, true);
  assert.equal(a.plateau.length, 0, 'les trois exemplaires ont fusionné');
  assert.equal(a.main.length, 1, 'le doré arrive dans la main');
  const dore = a.main[0];
  assert.equal(dore.dore, true);
  assert.equal(dore.atk, 2 * 1 + 3, 'le dore garde les renforts des trois');
  assert.ok(dore.mots.includes('provocation'));
  assert.equal(a.decouvertes.length, 0, 'la récompense attend qu’on pose le doré');
  verifierReserve(e);
  assert.equal(P.agir(e, 'a', { type: 'jouer', i: 0 }).ok, true);
  assert.equal(a.decouvertes.length, 1);
  assert.ok(a.decouvertes[0].every((u) => S.getServiteur(u.id).tier === 2), 'decouverte du rang 2');
  verifierReserve(e);
  assert.equal(P.agir(e, 'a', { type: 'decouvrir', i: 1 }).ok, true);
  assert.equal(a.main.length, 1, 'la découverte va dans la main');
  verifierReserve(e);
});

test('les degats suivent le rang du vainqueur et ses etoiles, sous plafond', () => {
  const e = duo(8);
  const [a, b] = e.joueurs;
  a.plateau = [S.creer('prince-brasiers', 'g1')];
  a.taverne = 6;
  b.plateau = [];
  P.terminerRecrutement(e);
  assert.equal(b.pv, H.PV_HEROS - P.plafondDegats(1), 'le premier tour est plafonne');
  const c = e.combats[0];
  assert.equal(c.degats, P.plafondDegats(1));
});

test('le pouvoir heroique se paie, une fois par tour', () => {
  const e = duo(9, 'valeria');
  const a = P.joueurDe(e, 'a');
  assert.equal(P.agir(e, 'a', { type: 'pouvoir' }).ok, true);
  assert.equal(a.or, 2);
  assert.equal(P.agir(e, 'a', { type: 'pouvoir' }).error, 'déjà utilisé');
  P.terminerRecrutement(e); P.finirCombats(e);
  assert.equal(a.or, 4 + 2, 'Valeria rapporte deux pieces au tour suivant');
});

test('un pouvoir passif ne se declenche pas a la main', () => {
  const e = duo(10, 'mirelle');
  assert.equal(P.agir(e, 'a', { type: 'pouvoir' }).error, 'passif');
  const a = P.joueurDe(e, 'a');
  assert.equal(P.agir(e, 'a', { type: 'rafraichir' }).ok, true);
  assert.equal(a.or, 3, 'le premier rafraichissement de Mirelle est gratuit');
  P.agir(e, 'a', { type: 'rafraichir' });
  assert.equal(a.or, 2);
});

test('la vue ne montre jamais la taverne ni le plateau des autres', () => {
  const e = duo(11);
  P.agir(e, 'b', { type: 'acheter', i: 0 });
  const v = P.viewFor(e, 'a');
  const brut = JSON.stringify(v);
  for (const u of [...P.joueurDe(e, 'b').boutique, ...P.joueurDe(e, 'b').plateau]) {
    assert.ok(!brut.includes(u.uid), `le serviteur ${u.uid} de B transite chez A`);
  }
  assert.ok(!('reserve' in v) && !brut.includes('"rng"'));
});

/* ================================================================== */
/* Les bots, et des parties entieres                                  */
/* ================================================================== */

test('huit bots jouent une partie jusqu\'au bout, sans jamais tricher sur la reserve', () => {
  const tours = [];
  for (let s = 1; s <= 6; s++) {
    const e = partieDeBots(s, verifierReserve);
    tours.push(e.tour);
    const places = e.joueurs.map((j) => j.place).sort((x, y) => x - y);
    assert.deepEqual(places, [1, 2, 3, 4, 5, 6, 7, 8], `places : ${places}`);
    assert.ok(e.vainqueur);
  }
  assert.ok(Math.max(...tours) < 30, `parties interminables : ${tours}`);
  assert.ok(Math.min(...tours) >= 6, `parties expediees : ${tours}`);
});

test('les bots construisent : taverne montee et plateau rempli au milieu de partie', () => {
  let rangs = 0, plateaux = 0, k = 0;
  partieDeBots(3, (e) => {
    if (e.tour === 8 && e.phase === P.PHASE.RECRUTEMENT) {
      for (const j of P.vivants(e)) { rangs += j.taverne; plateaux += j.plateau.length; k++; }
    }
  });
  assert.ok(rangs / k >= 3, `rang moyen ${rangs / k} au tour 8`);
  assert.ok(plateaux / k >= 5, `plateau moyen ${plateaux / k} au tour 8`);
});

test('aucun heros ne domine les parties de bots', () => {
  const victoires = {};
  for (let s = 100; s < 160; s++) {
    const e = partieDeBots(s);
    const h = P.joueurDe(e, e.vainqueur).heros;
    victoires[h] = (victoires[h] || 0) + 1;
  }
  for (const [h, v] of Object.entries(victoires)) {
    assert.ok(v <= 60 * 0.3, `${h} gagne ${v} parties sur 60`);
  }
});

/* ================================================================== */
/* En ligne                                                           */
/* ================================================================== */

class Client {
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
  send(o) { this.ws.send(JSON.stringify({ g: 'brasier', ...o })); }
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

test('en ligne : les chaises vides prennent des bots, on recrute, on se bat, un depart laisse un bot', async (t) => {
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const url = `ws://127.0.0.1:${server.address().port}/api/ws`;
  const ouverts = [];
  t.after(() => {
    for (const c of ouverts) c.close();
    server.closeAllConnections?.();
    return new Promise((res) => server.close(res));
  });

  const hote = new Client(url), invite = new Client(url);
  ouverts.push(hote, invite);
  await Promise.all([hote.ready(), invite.ready()]);
  hote.send({ t: 'hello', name: 'Hote' });
  const { id: idHote } = await hote.wait((m) => m.t === 'b:bonjour');
  invite.send({ t: 'hello', name: 'Invite' });
  const { id: idInvite } = await invite.wait((m) => m.t === 'b:bonjour');

  hote.send({ t: 'create', name: 'Hote' });
  const salon = await hote.wait((m) => m.t === 'b:salon');
  invite.send({ t: 'join', code: salon.code, name: 'Invite' });
  await hote.wait((m) => m.t === 'b:salon' && m.joueurs.length === 2);

  invite.send({ t: 'start' });
  await invite.wait((m) => m.t === 'b:erreur');

  hote.send({ t: 'start' });
  const choix = await hote.wait((m) => m.t === 'b:etat' && m.vue.phase === 'heros');
  assert.equal(choix.vue.joueurs.length, 8, 'huit chaises, bots compris');
  assert.equal(choix.vue.joueurs.filter((j) => j.isBot).length, 6);
  assert.equal(choix.vue.moi.offre.length, 3);

  hote.send({ t: 'heros', id: choix.vue.moi.offre[0] });
  const choixInvite = await invite.wait((m) => m.t === 'b:etat' && m.vue.phase === 'heros');
  invite.send({ t: 'heros', id: choixInvite.vue.moi.offre[1] });

  const recrut = await hote.wait((m) => m.t === 'b:etat' && m.vue.phase === 'recrutement');
  assert.equal(recrut.vue.tour, 1);
  assert.equal(recrut.vue.moi.or, 3);
  assert.equal(recrut.vue.moi.heros, choix.vue.moi.offre[0]);
  assert.ok(recrut.reste > 20000, 'le chrono du recrutement est annonce');

  // Un achat, puis un refus : plus d'or.
  hote.send({ t: 'action', a: { type: 'acheter', i: 0 } });
  await hote.wait((m) => m.t === 'b:etat' && m.vue.moi.main.length === 1);
  hote.send({ t: 'action', a: { type: 'jouer', i: 0 } });
  // Un cri peut invoquer un compagnon : le plateau compte un ou deux serviteurs.
  const apresAchat = await hote.wait((m) => m.t === 'b:etat' && m.vue.moi.plateau.length >= 1);
  const taille = apresAchat.vue.moi.plateau.length;
  hote.send({ t: 'action', a: { type: 'acheter', i: 0 } });
  const refus = await hote.wait((m) => m.t === 'b:refus');
  assert.equal(refus.raison, 'or');
  // Une action inconnue n'atteint meme pas le moteur.
  hote.send({ t: 'action', a: { type: 'tricher' } });

  // Tout le monde pret : le combat part sans attendre le chrono.
  hote.send({ t: 'action', a: { type: 'pret' } });
  invite.send({ t: 'action', a: { type: 'pret' } });
  const combat = await hote.wait((m) => m.t === 'b:etat' && m.vue.phase === 'combat');
  assert.ok(combat.vue.combat, 'le combat de l\'hote lui est envoye');
  assert.equal(combat.vue.combat.events[0].t, 'debut');
  const monCamp = combat.vue.combat.events[0].camps[combat.vue.combat.camp];
  assert.equal(monCamp.length, taille, 'son plateau part au combat');

  // L'invite s'en va : un bot prend sa chaise, la partie continue a huit.
  invite.send({ t: 'leave' });
  const apres = await hote.wait((m) => m.t === 'b:etat' && m.vue.joueurs.find((j) => j.id === idInvite)?.isBot, 30000);
  assert.equal(apres.vue.joueurs.length, 8);
  assert.equal(apres.vue.joueurs.find((j) => j.id === idHote).isBot, false);

  const tour2 = await hote.wait((m) => m.t === 'b:etat' && m.vue.phase === 'recrutement' && m.vue.tour === 2, 30000);
  assert.equal(tour2.vue.moi.or, 4);
});

test('une coupure de connexion ne fait pas perdre sa place', async (t) => {
  // L'hebergement coupe les connexions au bout de cinq minutes : une partie
  // en dure quinze. Sans jeton, chaque reconnexion faisait du joueur un
  // inconnu, la table le remplacait par un bot — ou disparaissait.
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const url = `ws://127.0.0.1:${server.address().port}/api/ws`;
  const ouverts = [];
  t.after(() => {
    for (const c of ouverts) c.close();
    server.closeAllConnections?.();
    return new Promise((res) => server.close(res));
  });

  const jeton = `test-${Math.random().toString(36).slice(2, 12)}`;
  const a = new Client(url), b = new Client(url);
  ouverts.push(a, b);
  await Promise.all([a.ready(), b.ready()]);
  a.send({ t: 'hello', name: 'Alice', jeton });
  const salut = await a.wait((m) => m.t === 'b:hello');
  assert.equal(salut.id, jeton, 'le jeton devient l\'identite du joueur');
  assert.equal(salut.repris, false);
  b.send({ t: 'hello', name: 'Bob', jeton: `test-${Math.random().toString(36).slice(2, 12)}` });
  await b.wait((m) => m.t === 'b:hello');

  a.send({ t: 'create', name: 'Alice' });
  const salon = await a.wait((m) => m.t === 'b:salon');
  b.send({ t: 'join', code: salon.code, name: 'Bob' });
  await a.wait((m) => m.t === 'b:salon' && m.joueurs.length === 2);
  a.send({ t: 'start' });
  const choix = await a.wait((m) => m.t === 'b:etat' && m.vue.phase === 'heros');
  a.send({ t: 'heros', id: choix.vue.moi.offre[0] });
  const choixB = await b.wait((m) => m.t === 'b:etat' && m.vue.phase === 'heros');
  b.send({ t: 'heros', id: choixB.vue.moi.offre[0] });
  const recrut = await a.wait((m) => m.t === 'b:etat' && m.vue.phase === 'recrutement');
  a.send({ t: 'action', a: { type: 'acheter', i: 0 } });
  await a.wait((m) => m.t === 'b:etat' && m.vue.moi.main.length === 1);
  a.send({ t: 'action', a: { type: 'jouer', i: 0 } });
  // Un cri peut invoquer un compagnon : on retient la taille, pas un chiffre.
  const achat = await a.wait((m) => m.t === 'b:etat' && m.vue.moi.plateau.length >= 1);
  const taille = achat.vue.moi.plateau.length;

  // La connexion d'Alice tombe : un bot tient sa place, la table survit.
  a.close();
  const absente = await b.wait((m) => m.t === 'b:etat' && m.vue.joueurs.find((j) => j.id === jeton)?.isBot);
  assert.equal(absente.vue.joueurs.length, 8);

  // Alice revient avec son jeton : même place, même plateau, plus de bot.
  const a2 = new Client(url);
  ouverts.push(a2);
  await a2.ready();
  a2.send({ t: 'hello', name: 'Alice', jeton });
  const retour = await a2.wait((m) => m.t === 'b:hello');
  assert.equal(retour.repris, true);
  await a2.wait((m) => m.t === 'b:debut' && m.reprise);
  const vue = await a2.wait((m) => m.t === 'b:etat');
  assert.equal(vue.vue.moi.id, jeton);
  assert.equal(vue.vue.moi.plateau.length, taille, 'son plateau l\'attendait');
  assert.equal(vue.vue.moi.heros, recrut.vue.moi.heros);
  assert.equal(vue.vue.joueurs.find((j) => j.id === jeton).isBot, false);

  // Et ses actions reprennent.
  a2.send({ t: 'action', a: { type: 'vendre', i: 0 } });
  await a2.wait((m) => m.t === 'b:etat' && m.vue.moi.plateau.length === taille - 1);

  // Un jeton inconnu ne reprend rien.
  const c = new Client(url);
  ouverts.push(c);
  await c.ready();
  c.send({ t: 'hello', name: 'Carl', jeton: 'jeton-inconnu-123' });
  assert.equal((await c.wait((m) => m.t === 'b:hello')).repris, false);
});

test('le routeur envoie les messages du brasier a son serveur', async (t) => {
  const { default: server } = await import('../api/ws.js');
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  t.after(() => { server.closeAllConnections?.(); return new Promise((res) => server.close(res)); });
  const c = new Client(`ws://127.0.0.1:${server.address().port}/api/ws`);
  await c.ready();
  c.send({ t: 'hello', name: 'X' });
  await c.wait((m) => m.t === 'b:bonjour', 3000);
  c.close();
});

/* ================================================================== */
/* Des bots qui jouent comme des gens                                 */
/* ================================================================== */

test('chaque bot a son caractère, et tous ne sont pas des as', () => {
  const c = B.NOMS_BOTS.map((nom) => B.caractere({ name: nom }));
  for (const x of c) {
    assert.ok(x.habilete >= 0.55 && x.habilete <= 0.93);
    assert.ok(x.tempo >= 2 && x.tempo <= 3);
  }
  assert.ok(c.some((x) => x.habilete < 0.7), 'il y a des brouillons');
  assert.ok(c.some((x) => x.habilete > 0.8), 'et des fins');
});

test('un bot loin devant le meilleur humain lève le pied', () => {
  const e = P.creerPartie([
    { id: 'h', name: 'Humain' },
    ...B.NOMS_BOTS.slice(0, 3).map((name, k) => ({ id: `b${k}`, name, isBot: true })),
  ], { seed: 21 });
  for (const j of e.joueurs) B.choisirHerosBot(e, j.id);
  P.commencer(e);
  e.tour = 9;
  const h = P.joueurDe(e, 'h');
  const bot = P.joueurDe(e, 'b0');
  h.plateau = [S.creer('chaton', 'hc1')];
  bot.plateau = Array.from({ length: 7 }, (_, k) => ({ ...S.creer('diablotin-farceur', `bb${k}`), atk: 8, pv: 8 }));
  assert.equal(B.enAvance(e, bot), true);
  assert.equal(B.enAvance(e, h), false);
  // Il ne monte pas sa taverne, et n'achète qu'une carte au plus.
  bot.or = 10;
  bot.taverne = 3;
  bot.coutRang = 1;
  const rang = bot.taverne;
  B.jouerBot(e, 'b0');
  assert.equal(bot.taverne, rang);
  // Une carte au plus (3), et son pouvoir héroïque s'il y pense.
  const p = H.getHeros(bot.heros).pouvoir;
  assert.ok(bot.or >= 10 - 3 - (p.passif ? 0 : p.cout), `or restant : ${bot.or}`);
  // Sans humain à la table, personne à ménager.
  h.isBot = true;
  assert.equal(B.enAvance(e, bot), false);
});

test('les bots se servent de leur main : ils posent ce qu’ils achètent', () => {
  let plateaux = 0, mains = 0, k = 0;
  partieDeBots(9, (e) => {
    if (e.tour === 7 && e.phase === P.PHASE.COMBAT) {
      for (const j of P.vivants(e)) { plateaux += j.plateau.length; mains += j.main.length; k++; }
    }
  });
  assert.ok(plateaux / k >= 5, `plateau moyen ${plateaux / k}`);
  assert.ok(mains / k <= 3, `main moyenne ${mains / k}`);
});

/* ================================================================== */
/* Élémentaires, nouveaux héros, parties Quête et Anomalie            */
/* ================================================================== */

import * as M from '../public/shared/brasier/modes.js';

/** Une table de deux joueurs, héros imposés, au premier recrutement. */
function table(o = {}, heros = ['zora', 'zora']) {
  const e = P.creerPartie([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { seed: 7, ...o });
  e.joueurs.forEach((j, k) => { j.offre = [heros[k]]; P.choisirHeros(e, j.id, heros[k]); });
  P.commencer(e);
  return e;
}
/** Avance d'un tour complet (recrutement, combat). */
function tourSuivant(e) { P.terminerRecrutement(e); P.finirCombats(e); }

test('les Élémentaires grandissent quand on pose un autre Élémentaire', () => {
  const e = table();
  const j = e.joueurs[0];
  j.main = [srv('flammeche-errante'), srv('brise-mutine'), srv('apprenti-forgeron')];
  P.agir(e, 'a', { type: 'jouer', i: 0 });
  const f = j.plateau[0];
  P.agir(e, 'a', { type: 'jouer', i: 0 });          // la brise : un Élémentaire
  assert.equal(f.atk, 2); assert.equal(f.pv, 3);
  P.agir(e, 'a', { type: 'jouer', i: 0 });          // l'apprenti : pas un Élémentaire
  assert.ok(f.pv === 3, 'un neutre ne la nourrit pas');
});

test('la Brise mutine renforce les serviteurs de la taverne', () => {
  const e = table();
  const j = e.joueurs[0];
  const avant = j.boutique.map((u) => u.atk + u.pv);
  j.main = [srv('brise-mutine')];
  P.agir(e, 'a', { type: 'jouer', i: 0 });
  j.boutique.forEach((u, k) => assert.equal(u.atk + u.pv, avant[k] + 2));
  assert.match(S.texte('brise-mutine'), /taverne/);
  assert.match(S.texte('flammeche-errante'), /posez un autre Élémentaire/);
});

test('les exclusifs de quête ne sont jamais en taverne ni dans la réserve', () => {
  for (const id of M.EXCLUSIFS) {
    assert.ok(S.getServiteur(id).exclusif, id);
    assert.ok(!S.RECRUTABLES.some((s) => s.id === id));
    assert.ok(S.horsReserve(id));
  }
});

test('les deux nouveaux héros : Aëlis souffle sur la taverne, Thadéus nourrit sa gauche de sa main', () => {
  let e = table({}, ['aelis', 'thadeus']);
  const a = e.joueurs[0];
  const avant = a.boutique.map((u) => u.atk);
  assert.ok(P.agir(e, 'a', { type: 'pouvoir' }).ok);
  a.boutique.forEach((u, k) => assert.equal(u.atk, avant[k] + 1));
  const t = e.joueurs[1];
  t.plateau = [srv('apprenti-forgeron')];
  t.main = [srv('chat-braise'), srv('chat-braise'), srv('braisillon'), srv('braisillon')];
  P.terminerRecrutement(e);
  assert.equal(t.plateau[0].atk, 2 + 3, '+1/+1 par carte en main, trois au plus');
});

test('une partie n’a qu’un seul genre : classique, quête ou anomalie', () => {
  const vus = { classique: 0, quete: 0, anomalie: 0 };
  for (let seed = 1; seed <= 400; seed++) {
    const e = P.creerPartie([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { seed, mode: 'hasard' });
    vus[e.mode]++;
    if (e.mode === 'anomalie') assert.ok(e.anomalies.length >= 1 && e.anomalies.length <= 2);
    else assert.equal(e.anomalies.length, 0, 'jamais d’anomalie hors d’une partie Anomalie');
  }
  assert.ok(vus.quete > 50 && vus.quete < 120, `quêtes : ${vus.quete}`);
  assert.ok(vus.anomalie > 50 && vus.anomalie < 120, `anomalies : ${vus.anomalie}`);
  assert.equal(P.creerPartie([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]).mode, 'classique');
});

test('partie Quête : trois quêtes au tour 3, une de chaque récompense, et la récompense tombe', () => {
  const e = table({ mode: 'quete' });
  assert.equal(e.joueurs[0].offreQuete, null);
  tourSuivant(e); tourSuivant(e);
  assert.equal(e.tour, M.TOUR_QUETE);
  const j = e.joueurs[0];
  assert.equal(j.offreQuete.length, 3);
  assert.deepEqual(j.offreQuete.map((o) => o.recompense.type).sort(), ['cartes', 'or', 'serviteur']);
  // On force une quête d'achat, récompensée d'un exclusif.
  j.offreQuete = [{ id: 'marchand', recompense: { type: 'serviteur', id: 'phenix-azur' } }];
  assert.ok(P.agir(e, 'a', { type: 'quete', i: 0 }).ok);
  assert.equal(P.viewFor(e, 'a').moi.quete.id, 'marchand');
  for (let k = 0; k < M.getQuete('marchand').n; k++) {
    j.or = 10; j.main = [];
    if (!j.boutique.length) P.agir(e, 'a', { type: 'rafraichir' });
    assert.ok(P.agir(e, 'a', { type: 'acheter', i: 0 }).ok);
  }
  assert.ok(j.quete.faite);
  assert.ok(j.main.some((u) => u.id === 'phenix-azur'), 'le phénix arrive dans la main');
  // Le non-choix se règle d'office à la fin du recrutement.
  const b = e.joueurs[1];
  assert.ok(b.offreQuete);
  P.terminerRecrutement(e);
  assert.ok(b.quete && !b.offreQuete);
});

test('les cartes spéciales se lancent gratuitement', () => {
  const e = table({ mode: 'quete' });
  const j = e.joueurs[0];
  j.plateau = [srv('apprenti-forgeron')];
  j.sorts = [{ uid: 's1', id: 'pluie-or' }, { uid: 's2', id: 'dorure' }, { uid: 's3', id: 'egide' }];
  const or = j.or;
  assert.ok(P.agir(e, 'a', { type: 'lancer', i: 0 }).ok);
  assert.equal(j.or, or + 4);
  assert.ok(P.agir(e, 'a', { type: 'lancer', i: 0 }).ok);
  assert.equal(j.plateau[0].atk, 4); assert.equal(j.plateau[0].pv, 4);
  j.plateau = [];
  assert.equal(P.agir(e, 'a', { type: 'lancer', i: 0 }).ok, false, 'pas de plateau, pas d’égide');
  assert.equal(j.sorts.length, 1);
});

test('les anomalies changent les règles pour toute la table', () => {
  let e = table({ mode: 'anomalie', anomalies: ['sang-royal', 'taverne-bondee'] });
  assert.equal(e.joueurs[0].pv, 40);
  assert.equal(e.joueurs[0].boutique.length, P.TAILLE_TAVERNE[1] + 1);
  e = table({ mode: 'anomalie', anomalies: ['rangs-soldes', 'ruee-or'] });
  assert.equal(e.joueurs[0].or, 4, 'une pièce de plus');
  assert.equal(P.viewFor(e, 'a').moi.coutRang, P.COUT_RANG[2] - 1);
  e = table({ mode: 'anomalie', anomalies: ['heros-inspires'] }, ['hildra', 'hildra']);
  assert.equal(P.coutPouvoir(e, e.joueurs[0]), 2);
  e = table({ mode: 'anomalie', anomalies: ['tribu-honneur'] });
  assert.ok(M.TRIBUS_HONNEUR.includes(e.tribuHonneur));
  const v = P.viewFor(e, 'a');
  assert.equal(v.mode, 'anomalie');
  assert.deepEqual(v.anomalies, ['tribu-honneur']);
});

test('huit bots finissent des parties Quête et Anomalie sans tricher sur la réserve', () => {
  for (const [seed, mode] of [[11, 'quete'], [12, 'anomalie'], [13, 'quete'], [14, 'anomalie']]) {
    const e = P.creerPartie(B.NOMS_BOTS.slice(0, 8).map((nom, i) => ({ id: `b${i}`, name: nom, isBot: true })), { seed, mode });
    for (const j of e.joueurs) B.choisirHerosBot(e, j.id);
    P.commencer(e);
    while (e.phase !== P.PHASE.FIN) {
      for (const j of P.vivants(e)) B.jouerBot(e, j.id);
      verifierReserve(e);
      P.terminerRecrutement(e);
      P.finirCombats(e);
    }
    assert.ok(e.vainqueur);
    if (mode === 'quete') assert.ok(e.joueurs.every((j) => j.quete), 'chacun a eu sa quête');
  }
});
