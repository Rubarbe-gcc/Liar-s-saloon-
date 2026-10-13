/**
 * LE VELOURS NOIR — les tables en ligne : créer, lister, rejoindre ; une donne
 * de blackjack à deux ; une roulette partagée ; le poker avec ses habitués
 * qui cèdent la place aux vrais joueurs ; partir, se déconnecter, revenir.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as V from '../server/velours.js';

V.reglerVitesse(0.002);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
/** Attend qu'une condition soit vraie (le serveur avance avec des minuteurs très courts). */
async function quand(f, max = 4000) {
  const t0 = Date.now();
  while (!f()) {
    if (Date.now() - t0 > max) throw new Error('trop long');
    await attendre(5);
  }
}

let id = 0;
function joueur(nom) {
  const recu = [];
  const conn = { id: `v${++id}`, send: (m) => recu.push(m), close() {} };
  V.handleOpen(conn);
  const j = {
    conn, recu, nom,
    dit: (m) => V.handleMessage(conn, m),
    dernier: (t) => [...recu].reverse().find((m) => m.t === t),
    tous: (t) => recu.filter((m) => m.t === t),
    evts: () => recu.filter((m) => m.t === 'evts').flatMap((m) => m.evts),
    couper: () => V.handleClose(conn),
  };
  return j;
}

test('créer une table publique, la voir dans la liste, la rejoindre', async () => {
  const a = joueur('Alice');
  const b = joueur('Bob');
  a.dit({ t: 'creer', jeu: 'blackjack', nom: 'Alice', avatar: '🦊', publique: true, jeton: 'jetonAlice1' });
  const { code } = a.dernier('entre');
  assert.match(code, /^[A-Z2-9]{4}$/);
  b.dit({ t: 'tables', jeu: 'blackjack' });
  assert.ok(b.dernier('tables').liste.some((x) => x.code === code && x.hote === 'Alice'));
  b.dit({ t: 'rejoindre', code: code.toLowerCase(), nom: '<i>Bob</i>' });
  assert.equal(b.dernier('etat').moi, 1);
  assert.deepEqual(a.dernier('membres').liste.map((m) => m.nom), ['Alice', 'iBob/i']);
  b.dit({ t: 'rejoindre', code: 'ZZZZ' });
  assert.match(b.dernier('erreur').msg, /Aucune table/);
  a.dit({ t: 'quitter' }); b.dit({ t: 'quitter' });
  assert.ok(!V._salles.has(code), 'une table vide disparaît');
});

test('le blackjack à deux : chacun mise, la même donne pour tous, chacun joue sa main', async () => {
  const a = joueur('A');
  const b = joueur('B');
  a.dit({ t: 'creer', jeu: 'blackjack', nom: 'A' });
  b.dit({ t: 'rejoindre', code: a.dernier('entre').code, nom: 'B' });
  a.dit({ t: 'miser', mise: 20 });
  b.dit({ t: 'miser', mise: 50 });
  assert.equal(b.dernier('mise').mise, 50);
  a.dit({ t: 'pret' }); b.dit({ t: 'pret' });
  await quand(() => a.evts().some((e) => e.type === 'donne'));
  assert.deepEqual(a.evts().find((e) => e.type === 'donne').mises, { 0: 20, 1: 50 });
  // chacun reste quand c'est son tour ; l'assurance est refusée
  await quand(() => {
    for (const j of [a, b]) {
      const e = j.evts();
      const q = [...e].reverse().find((x) => x.type === 'a-qui' || x.type === 'assurance' || x.type === 'fin');
      if (q?.type === 'assurance') j.dit({ t: 'assurance', oui: false });
      if (q?.type === 'a-qui' && q.s === (j === a ? 0 : 1)) j.dit({ t: 'action', a: 'rester' });
    }
    return a.evts().some((e) => e.type === 'fin');
  });
  const fin = a.evts().find((e) => e.type === 'fin');
  const res = a.evts().filter((e) => e.type === 'resultat');
  assert.deepEqual(new Set(res.map((r) => r.s)), new Set([0, 1]));
  assert.deepEqual(b.evts().filter((e) => e.type === 'resultat'), res, 'les deux voient la même chose');
  assert.equal(fin.nets[1], res.filter((r) => r.s === 1).reduce((s, r) => s + r.retour - r.mise, 0));
  await quand(() => a.dernier('tour'));
  a.dit({ t: 'quitter' }); b.dit({ t: 'quitter' });
});

test('la roulette partagée : les mises des autres se voient, le même numéro pour tous', async () => {
  const a = joueur('A');
  const b = joueur('B');
  a.dit({ t: 'creer', jeu: 'roulette', nom: 'A', publique: false });
  const { code } = a.dernier('entre');
  a.dit({ t: 'tables' });
  assert.ok(!a.dernier('tables').liste.some((x) => x.code === code), 'une table privée n’est pas listée');
  b.dit({ t: 'rejoindre', code, nom: 'B' });
  a.dit({ t: 'paris', paris: { p17: 10, rouge: 5, faux: 3, noir: -2 } });
  assert.deepEqual(b.dernier('paris'), { g: 'velours', t: 'paris', s: 0, paris: { p17: 10, rouge: 5 } });
  a.dit({ t: 'pret' }); b.dit({ t: 'pret' });
  await quand(() => a.dernier('lance') && b.dernier('lance'));
  assert.equal(a.dernier('lance').numero, b.dernier('lance').numero);
  a.dit({ t: 'paris', paris: { p1: 5 } });
  assert.deepEqual(a.tous('paris').length, 1, 'plus de mise une fois la bille lancée');
  a.dit({ t: 'quitter' }); b.dit({ t: 'quitter' });
});

test('le poker : des habitués autour du joueur, les cartes des autres restent cachées', async () => {
  const a = joueur('A');
  a.dit({ t: 'creer', jeu: 'poker', nom: 'A', cave: 400, petite: 5, jeton: 'jetonPokerA' });
  const code = a.dernier('entre').code;
  await quand(() => a.dernier('etat')?.moi >= 0);
  const moi = a.dernier('etat').moi;
  const e = a.dernier('etat');
  assert.equal(e.joueurs.filter((j) => j.humain).length, 1);
  assert.equal(e.joueurs[moi].jetons, 400);
  // le joueur suit ou passe à chaque fois ; trois mains
  await quand(() => {
    const o = a.dernier('options');
    if (o && !o.vu) { o.vu = true; a.dit({ t: 'agir', a: { type: o.parole ? 'parole' : 'suivre' } }); }
    return a.tous('piles').length >= 3;
  }, 15000);
  const donnes = a.evts().filter((x) => x.type === 'donne');
  assert.ok(donnes.filter((d) => d.i === moi).every((d) => d.carte));
  assert.ok(donnes.filter((d) => d.i !== moi).every((d) => d.carte === null));

  // un vrai joueur arrive : il prend la place d'un habitué à la main suivante
  const b = joueur('B');
  b.dit({ t: 'rejoindre', code, nom: 'B', cave: 300 });
  assert.equal(b.dernier('etat').attente, true);
  await quand(() => {
    for (const j of [a, b]) {
      const o = j.dernier('options');
      if (o && !o.vu) { o.vu = true; j.dit({ t: 'agir', a: { type: o.parole ? 'parole' : 'coucher' } }); }
    }
    return b.dernier('etat')?.moi >= 0;
  }, 15000);
  const eb = b.dernier('etat');
  assert.equal(eb.joueurs.filter((j) => j.humain).length, 2);
  assert.equal(eb.joueurs[eb.moi].nom, 'B');

  // B se déconnecte, la table joue pour lui ; il revient avec son jeton de place
  const jetonB = b.dernier('entre').jeton;
  b.couper();
  const b2 = joueur('B');
  b2.dit({ t: 'revenir', code, jeton: jetonB });
  assert.equal(b2.dernier('entre').repris, true);
  assert.equal(b2.dernier('etat').joueurs[b2.dernier('etat').moi].nom, 'B');
  b2.dit({ t: 'revenir', code, jeton: 'inconnu123' });
  assert.ok(b2.dernier('perdu'));

  // A quitte la table : ses jetons lui reviennent
  a.dit({ t: 'quitter' });
  assert.ok(a.dernier('parti').jetons >= 0);
  b2.dit({ t: 'quitter' });
  await attendre(50);
  assert.ok(!V._salles.has(code));
});

test('seul à une table : pas de compte à rebours, la partie part dès qu’on est prêt', async () => {
  const a = joueur('Solo');
  a.dit({ t: 'creer', jeu: 'blackjack', nom: 'Solo' });
  a.dit({ t: 'miser', mise: 10 });
  assert.ok(!a.tous('compte').some((m) => m.reste > 0), 'pas de compte à rebours quand on est seul');
  a.dit({ t: 'pret' });
  await quand(() => a.evts().some((e) => e.type === 'donne'));
  a.dit({ t: 'quitter' });

  const r = joueur('Solo');
  r.dit({ t: 'creer', jeu: 'roulette', nom: 'Solo' });
  assert.ok(!r.tous('compte').some((m) => m.reste > 0));
  r.dit({ t: 'paris', paris: { rouge: 5 } });
  r.dit({ t: 'pret' });
  await quand(() => r.dernier('lance'));
  r.dit({ t: 'quitter' });
});

test('le poker n’a pas de limite de temps : la table attend la décision du joueur', async () => {
  const a = joueur('Patient');
  a.dit({ t: 'creer', jeu: 'poker', nom: 'Patient', cave: 400 });
  await quand(() => a.dernier('options'), 15000);
  const moi = a.dernier('etat').moi;
  await attendre(400);   // l'équivalent de plusieurs minutes à vitesse normale
  assert.ok(!a.evts().some((e) => e.type === 'action' && e.i === moi), 'personne ne joue à sa place');
  a.dit({ t: 'agir', a: { type: 'coucher' } });
  await quand(() => a.evts().some((e) => e.type === 'action' && e.i === moi));
  a.dit({ t: 'quitter' });
});

test('les tournois : affiche pour tous, inscription, désinscription remboursée, annulé sans inscrit', async () => {
  V.arreterTournois();
  const a = joueur('A');
  const b = joueur('B');
  a.dit({ t: 'bonjour' }); b.dit({ t: 'bonjour' });
  const tn = V.annoncerTournoi('mardi');
  assert.equal(a.dernier('tournoi-annonce').tournoi.prix, 500);
  assert.deepEqual(a.dernier('tournoi-annonce').tournoi.parts, [250, 150, 100]);
  a.dit({ t: 'tournoi-inscrire', id: tn.id, nom: 'A' });
  assert.ok(a.dernier('tournoi-inscrit'));
  assert.equal(b.dernier('tournoi-maj').tournoi.inscrits, 1);
  a.dit({ t: 'tournoi-desinscrire', id: tn.id });
  assert.equal(a.dernier('tournoi-rembourse').montant, 100);
  V.demarrerTournoi(tn);
  assert.ok(a.dernier('tournoi-annule'), 'personne d’inscrit : le tournoi est annulé');
  V.arreterTournois();
});

/** Joue pour un joueur de tournoi jusqu'à sa fin : `style` 'tapis' ou 'prudent'. */
function jouerTournoi(j, style) {
  const o = j.dernier('options');
  if (o && !o.vu) {
    o.vu = true;
    j.dit({ t: 'agir', a: { type: style === 'tapis' ? 'tapis' : o.parole ? 'parole' : 'coucher' } });
  }
  return !!j.dernier('tournoi-fin');
}

test('un tournoi à une table : deux vrais joueurs, trois habitués, les prix aux trois premiers', async () => {
  V.arreterTournois();
  const a = joueur('A');
  const b = joueur('B');
  a.dit({ t: 'bonjour' }); b.dit({ t: 'bonjour' });
  const tn = V.annoncerTournoi('mardi');
  a.dit({ t: 'tournoi-inscrire', id: tn.id, nom: 'Alice', jeton: 'jetonTournoiA' });
  b.dit({ t: 'tournoi-inscrire', id: tn.id, nom: 'Bob', jeton: 'jetonTournoiB' });
  V.demarrerTournoi(tn);
  const e = a.dernier('etat');
  assert.equal(e.joueurs.length, 5);
  assert.equal(e.joueurs.filter((x) => x.humain).length, 2, 'les places vides vont aux habitués');
  assert.ok(e.joueurs.every((x) => x.jetons === V.TAPIS_TOURNOI));
  assert.equal(e.tournoi.petite, V.BLINDES[0]);
  await quand(() => jouerTournoi(a, 'tapis') & jouerTournoi(b, 'tapis') && a.dernier('tournoi-fin') && b.dernier('tournoi-fin'), 30000);
  const fa = a.dernier('tournoi-fin'), fb = b.dernier('tournoi-fin');
  assert.notEqual(fa.place, fb.place);
  for (const f of [fa, fb]) assert.equal(f.prix, V.prixDe(tn, f.place));
  assert.ok(a.recu.some((m) => m.t === 'tournoi-info'));
  await quand(() => !V.tournoiEnCours());
  V.arreterTournois();
});

test('un tournoi à deux tables : les blindes montent, les tables fusionnent en table finale', async () => {
  V.arreterTournois();
  const a = joueur('A');
  a.dit({ t: 'bonjour' });
  const tn = V.annoncerTournoi('coupe');
  a.dit({ t: 'tournoi-inscrire', id: tn.id, nom: 'Prudente', jeton: 'jetonTournoiP' });
  V.demarrerTournoi(tn);
  assert.equal(tn.tables.length, 2);
  await quand(() => jouerTournoi(a, 'prudent'), 60000);
  const fin = a.dernier('tournoi-fin');
  assert.ok(fin.place >= 1 && fin.place <= 10);
  const niveaux = a.recu.filter((m) => m.t === 'tournoi-info').map((m) => m.tournoi.petite);
  assert.ok(Math.max(...niveaux) > V.BLINDES[0], 'les blindes ont monté');
  if (fin.place <= 5) assert.ok(a.dernier('tournoi-finale'), 'arrivée à la table finale');
  await quand(() => !V.tournoiEnCours(), 20000);
  V.arreterTournois();
});

test('le modérateur : code vérifié par le serveur, jeton lié au compte, essais limités', () => {
  V.arreterTournois();
  const a = joueur('Mod');
  a.dit({ t: 'moderateur', code: 'faux', profil: 'MONPROFIL1' });
  assert.equal(a.dernier('moderateur').ok, false);
  a.dit({ t: 'moderateur', code: 'moderateur', profil: 'MONPROFIL1' });   // le code de développement
  const r = a.dernier('moderateur');
  assert.equal(r.ok, true);
  assert.ok(V.jetonValideModerateur(r.jeton, 'MONPROFIL1'));
  assert.ok(!V.jetonValideModerateur(r.jeton, 'AUTREPROF2'), 'le jeton ne vaut rien sur un autre compte');
  assert.ok(!V.jetonValideModerateur(r.jeton.replace(/.$/, (x) => (x === 'A' ? 'B' : 'A')), 'MONPROFIL1'), 'un jeton retouché ne vaut rien');
  assert.ok(!V.jetonValideModerateur(`${Date.now() - 1000}.${r.jeton.split('.')[1]}`, 'MONPROFIL1'), 'un jeton périmé ne vaut rien');
  const b = joueur('Autre');
  b.dit({ t: 'moderateur', jeton: r.jeton, profil: 'AUTREPROF2' });
  assert.equal(b.dernier('moderateur').ok, false);
  b.dit({ t: 'moderateur', jeton: r.jeton, profil: 'MONPROFIL1' });
  assert.equal(b.dernier('moderateur').ok, true);
  b.dit({ t: 'tournoi-demo', type: 'nuit' });
  assert.equal(V.tournoiEnCours().nom, 'Nuit des Flambeurs');
  V.arreterTournois();
  // le compte du modérateur réglé sur le serveur : un autre profil est refusé, même avec le bon code
  process.env.MODERATEUR_PROFIL = 'MONPROFIL1';
  try {
    const x = joueur('Intrus');
    x.dit({ t: 'moderateur', code: 'moderateur', profil: 'INTRUS9999' });
    assert.equal(x.dernier('moderateur').ok, false);
    x.dit({ t: 'moderateur', code: 'moderateur', profil: 'monprofil1' });
    assert.equal(x.dernier('moderateur').ok, true);
  } finally { delete process.env.MODERATEUR_PROFIL; }
  const c = joueur('Curieux');
  for (let k = 0; k < 6; k++) c.dit({ t: 'moderateur', code: `essai${k}`, profil: 'CURIEUX123' });
  assert.match(c.dernier('moderateur').msg, /Trop d’essais/);
});
