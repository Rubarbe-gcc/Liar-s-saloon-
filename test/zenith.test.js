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

test('chaque combattant tient son budget, decote des soutiens comprise', () => {
  // Le budget facture la durabilite sur les points de vie EFFECTIFS, armure
  // comprise : points de vie et armure se multiplient dans l'encaissement,
  // alors que l'ancienne formule les additionnait. A 316 points partout, la
  // durabilite reelle allait de 781 a 2122 — un facteur 2,7 qui faisait des
  // colosses un choix structurellement superieur.
  for (const f of F.FIGHTERS) {
    const ecart = F.budgetOf(f) - F.budgetCibleOf(f);
    assert.ok(Math.abs(ecart) <= 2,
      `${f.name} : ${F.budgetOf(f)} pour ${F.budgetCibleOf(f)} vise (ecart ${ecart})`);
  }
  // Un soutien paie sa capacite : il doit rester sous le budget d'un pur.
  assert.ok(F.DECOTE_SOUTIEN > 0, 'la decote de soutien doit etre reelle');
});

test('les points de vie effectifs restent dans un rapport raisonnable', () => {
  // Meme correctement facturee, une durabilite trop etalee revient a opposer
  // des combattants de categories differentes.
  const eff = F.FIGHTERS.map(F.effectiveHp);
  const rapport = Math.max(...eff) / Math.min(...eff);
  assert.ok(rapport <= 2.1,
    `durabilite trop etalee : rapport ${rapport.toFixed(2)} entre le plus et le moins resistant`);
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
/* Moteur au tour par tour                                            */
/* ================================================================== */

/** Fait jouer un tour complet avec une commande imposée de chaque côté. */
function tour(s, cmdA, cmdB) {
  const a = B.choose(s, 0, cmdA);
  const b = B.choose(s, 1, cmdB);
  const res = B.resolveTurn(s);
  return { a, b, res };
}

const frappe = { type: 'move', move: 'frappe' };

test('un combat demarre avec deux equipes completes, en attente de commandes', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  assert.equal(s.phase, B.PHASE.CHOOSE);
  assert.equal(s.turn, 1);
  assert.equal(s.sides.length, 2);
  for (const side of s.sides) {
    assert.equal(side.team.length, B.TEAM_SIZE);
    assert.equal(side.queued, null, 'aucune commande ne doit etre pre-remplie');
    for (const u of side.team) assert.equal(u.hp, u.maxHp);
  }
});

test('le tour ne se resout que lorsque les deux camps ont choisi', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  assert.equal(B.choose(s, 0, frappe).ok, true);
  assert.equal(B.pretARésoudre(s), false);
  assert.equal(B.resolveTurn(s).ok, false, 'un tour incomplet ne doit pas partir');
  assert.equal(s.turn, 1);

  assert.equal(B.choose(s, 1, frappe).ok, true);
  assert.equal(B.pretARésoudre(s), true);
  assert.equal(B.resolveTurn(s).ok, true);
  assert.equal(s.turn, 2);
});

test('un camp ne peut pas changer sa commande une fois posee', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  assert.equal(B.choose(s, 0, frappe).ok, true);
  const second = B.choose(s, 0, { type: 'guard' });
  assert.equal(second.ok, false);
  assert.equal(second.error, 'deja choisi'.replace('deja', 'déjà'));
});

test('une meme graine rejoue le combat a l\'identique', () => {
  const run = () => {
    const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm'], 4242);
    let t = 0;
    while (s.phase !== B.PHASE.OVER && t++ < 200) tour(s, frappe, frappe);
    return s.sides.map((x) => x.team.map((u) => u.hp));
  };
  assert.deepEqual(run(), run());
});

test('une attaque coute son ki, blesse la cible, et le tour en rend a tous', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const att = s.sides[0].team[0];
  const def = s.sides[1].team[0];
  att.ki = 60;
  const kiAvant = att.ki;
  const pvAvant = def.hp;

  tour(s, { type: 'move', move: 'souffle' }, { type: 'move', move: 'souffle' });

  assert.ok(def.hp < pvAvant, 'la cible doit encaisser');
  // 18 de cout, puis le revenu de fin de tour.
  assert.equal(att.ki, kiAvant - B.MOVES.souffle.ki + B.kiParTour(att));
});

test('la frappe est gratuite et rend du ki', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const att = s.sides[0].team[0];
  att.ki = 0;
  tour(s, frappe, frappe);
  assert.equal(att.ki, B.MOVES.frappe.kiGain + B.kiParTour(att));
});

test('on ne peut pas lancer un coup sans le ki', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[0].team[0].ki = 0;
  const r = B.choose(s, 0, { type: 'move', move: 'ultime' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'ki');
  const dispo = B.availableCommands(s, 0);
  assert.equal(dispo.moves.find((m) => m.key === 'ultime').utilisable, false);
  assert.equal(dispo.moves.find((m) => m.key === 'frappe').utilisable, true);
});

test('le revenu de ki par tour est verse aux deux camps', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[0].team[0].ki = 0;
  s.sides[1].team[0].ki = 0;
  tour(s, { type: 'guard' }, { type: 'guard' });
  assert.equal(s.sides[0].team[0].ki, B.GUARD_KI + B.kiParTour(s.sides[0].team[0]));
  assert.equal(s.sides[1].team[0].ki, B.GUARD_KI + B.kiParTour(s.sides[1].team[0]));
});

test('la garde amortit reellement le coup du tour', () => {
  const degats = (garde) => {
    const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm'], 7);
    s.sides[0].team[0].ki = 100;
    const def = s.sides[1].team[0];
    const avant = def.hp;
    tour(s, { type: 'move', move: 'souffle' }, garde ? { type: 'guard' } : frappe);
    return avant - def.hp;
  };
  const nu = degats(false);
  const protege = degats(true);
  assert.ok(protege < nu * 0.7,
    `la garde ne reduit que de ${(100 - protege / nu * 100).toFixed(0)} %`);
});

test('les attaques partent du plus rapide au plus lent', () => {
  // Kaze est rapide, Gorm est lent : Kaze doit frapper en premier.
  const s = duo(['kaze', 'volt', 'nox'], ['gorm', 'tarn', 'brume'], 11);
  const rapide = B.speedOf(s.sides[0].team[0]);
  const lent = B.speedOf(s.sides[1].team[0]);
  assert.ok(rapide > lent, 'le materiel de test suppose un ecart de vitesse');

  const { res } = tour(s, frappe, frappe);
  const coups = res.effects.filter((e) => e.type === 'hit');
  assert.ok(coups.length >= 1);
  assert.equal(coups[0].side, 0, 'le plus rapide doit apparaitre en premier');
});

test('la vitesse decide, pas l\'ordre des camps', () => {
  // Meme duel, camps inverses : le rapide reste premier.
  const s = duo(['gorm', 'tarn', 'brume'], ['kaze', 'volt', 'nox'], 11);
  const { res } = tour(s, frappe, frappe);
  const coups = res.effects.filter((e) => e.type === 'hit');
  assert.equal(coups[0].side, 1);
});

test('le changement passe avant les attaques du tour', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const { res } = tour(s, { type: 'swap', slot: 2 }, frappe);
  assert.equal(s.sides[0].active, 2, 'le remplacant doit etre en lice');
  const iSwap = res.effects.findIndex((e) => e.type === 'swap');
  const iHit = res.effects.findIndex((e) => e.type === 'hit');
  assert.ok(iSwap >= 0 && iHit >= 0);
  assert.ok(iSwap < iHit, 'le changement doit precede le coup encaisse');
  // Le coup adverse frappe donc le remplacant, pas celui qui est parti.
  assert.equal(s.sides[0].team[0].hp, s.sides[0].team[0].maxHp);
  assert.ok(s.sides[0].team[2].hp < s.sides[0].team[2].maxHp);
});

test('on ne change pas pour un combattant a terre ni pour soi-meme', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[0].team[1].ko = true;
  assert.equal(B.choose(s, 0, { type: 'swap', slot: 1 }).ok, false);
  assert.equal(B.choose(s, 0, { type: 'swap', slot: 0 }).ok, false);
  assert.equal(B.choose(s, 0, { type: 'swap', slot: 7 }).ok, false);
  assert.equal(B.choose(s, 0, { type: 'swap', slot: 2 }).ok, true);
});

test('l\'avantage elementaire augmente reellement les degats', () => {
  const braise = F.FIGHTERS.find((f) => f.element === 'braise');
  const orage = F.FIGHTERS.find((f) => f.element === 'orage');
  const givre = F.FIGHTERS.find((f) => f.element === 'givre');
  const fort = B.estimateDamage(braise, orage, 'souffle');
  const faible = B.estimateDamage(braise, givre, 'souffle');
  assert.ok(fort > faible, 'braise doit taper plus fort sur orage que sur givre');
});

/** Trois combattants d'un element donne, pour composer une equipe temoin. */
const equipeDe = (element) => F.FIGHTERS.filter((f) => f.element === element).slice(0, 3).map((f) => f.id);

test('la speciale pose l\'alteration de son element sur la cible', () => {
  // La seve fait exception : elle soigne le lanceur. On teste ici les quatre
  // autres elements, qui frappent bien l'adversaire.
  for (const element of ['braise', 'orage', 'abysse', 'givre']) {
    const s = duo(equipeDe(element), equipeDe('sylve'), 5);
    const att = s.sides[0].team[0];
    att.ki = 100;
    // La cible doit survivre au coup pour porter l'alteration.
    for (const u of s.sides[1].team) { u.maxHp = 9000; u.hp = 9000; }
    tour(s, { type: 'move', move: 'speciale' }, { type: 'move', move: 'frappe' });
    const cible = s.sides[1].team[s.sides[1].active];
    assert.ok(cible.status, `${element} : la speciale doit laisser une trace`);
    assert.equal(cible.status.key, B.ELEMENT_STATUS[element]);
  }
});

test('la speciale de sylve soigne le lanceur au lieu d\'affliger la cible', () => {
  const s = duo(equipeDe('sylve'), equipeDe('braise'), 5);
  const att = s.sides[0].team[0];
  att.ki = 100;
  tour(s, { type: 'move', move: 'speciale' }, { type: 'move', move: 'frappe' });
  assert.ok(att.status, 'le lanceur doit s\'entourer de seve');
  assert.equal(att.status.key, 'seve');
  assert.equal(s.sides[1].team[s.sides[1].active].status, null);
});

test('une alteration finit par s\'estomper', () => {
  const s = duo(['tarn', 'kaze', 'volt'], ['gorm', 'brume', 'nox'], 3);
  const cible = s.sides[1].team[0];
  cible.status = { key: 'brulure', tours: 2 };
  tour(s, frappe, frappe);
  assert.equal(cible.status && cible.status.tours, 1);
  tour(s, frappe, frappe);
  assert.equal(cible.status, null, 'l\'alteration doit expirer');
});

test('la paralysie ralentit celui qui la subit', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const u = s.sides[0].team[0];
  const vite = B.speedOf(u);
  u.status = { key: 'paralysie', tours: 3 };
  assert.ok(B.speedOf(u) < vite, 'la paralysie doit couter de la vitesse');
});

test('l\'ultime ne part qu\'une fois par combattant', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const u = s.sides[0].team[0];
  u.ki = 100;
  tour(s, { type: 'move', move: 'ultime' }, { type: 'guard' });
  assert.equal(u.ultUsed, true);
  u.ki = 100;
  const r = B.choose(s, 0, { type: 'move', move: 'ultime' });
  assert.equal(r.ok, false);
  assert.equal(B.availableCommands(s, 0).moves.find((m) => m.key === 'ultime').raison,
    'déjà utilisée');
});

test('un combattant a terre laisse la place au suivant', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  s.sides[1].team[0].hp = 1;
  s.sides[0].team[0].ki = 100;
  tour(s, { type: 'move', move: 'speciale' }, { type: 'guard' });
  assert.equal(s.sides[1].team[0].ko, true);
  assert.notEqual(s.sides[1].active, 0, 'un remplacant doit entrer');
  assert.equal(s.sides[1].team[s.sides[1].active].ko, false);
});

test('le combat s\'arrete quand une equipe entiere est a terre', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  for (const u of s.sides[1].team) { u.hp = 1; }
  s.sides[1].team[1].ko = true;
  s.sides[1].team[2].ko = true;
  s.sides[0].team[0].ki = 100;
  tour(s, { type: 'move', move: 'speciale' }, { type: 'guard' });
  assert.equal(s.phase, B.PHASE.OVER);
  assert.equal(s.winner, 0);
  // Plus aucune commande n'est acceptee.
  assert.equal(B.choose(s, 0, frappe).ok, false);
});

test('un combat interminable est tranche aux points de vie', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm'], 9);
  s.turn = B.MAX_TURNS;
  tour(s, { type: 'guard' }, { type: 'guard' });
  assert.equal(s.phase, B.PHASE.OVER);
  assert.ok(s.winner === 0 || s.winner === 1 || s.winner === null);
});

test('l\'abandon donne la victoire a celui qui reste', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  B.forfeit(s, 1);
  assert.equal(s.phase, B.PHASE.OVER);
  assert.equal(s.winner, 0);
  assert.ok(s.sides[1].team.every((u) => u.ko));
});

test('la vue cache la commande adverse mais annonce qu\'elle est tombee', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  B.choose(s, 1, { type: 'move', move: 'souffle' });
  const vue = B.viewFor(s, 'a');
  assert.equal(vue.viewerSide, 0);
  assert.equal(vue.sides[1].aChoisi, true, 'on doit voir que l\'adversaire a joue');
  assert.equal(vue.sides[0].aChoisi, false);
  // `commandes` decrit les options du spectateur : c'est le camp adverse qui
  // ne doit rien reveler.
  const brut = JSON.stringify(vue.sides);
  assert.ok(!brut.includes('souffle') && !brut.includes('queued'),
    'la vue ne doit jamais laisser filtrer quelle commande a ete choisie');
});

test('la vue ne transmet jamais le ki adverse', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  // Une valeur reconnaissable, pour reperer toute fuite dans la vue.
  for (const u of s.sides[1].team) u.ki = 77;
  for (const u of s.sides[0].team) u.ki = 41;

  for (const [id, moi, lui] of [['a', 0, 1], ['b', 1, 0]]) {
    const vue = B.viewFor(s, id);
    for (const u of vue.sides[moi].team) {
      assert.equal(typeof u.ki, 'number', 'son propre ki doit rester lisible');
    }
    for (const u of vue.sides[lui].team) {
      assert.equal(u.ki, null, 'le ki adverse doit etre masque');
    }
  }

  // Et rien d'autre dans la vue ne doit laisser filtrer le chiffre.
  const vue = B.viewFor(s, 'a');
  const sansLesMiens = JSON.stringify({ ...vue, sides: [null, vue.sides[1]] });
  assert.ok(!sansLesMiens.includes('77'), 'le ki adverse fuit ailleurs dans la vue');
});

test('le ki adverse reste deductible de ce qui est public', () => {
  // Le masquer demande de suivre le compte, pas de deviner : c'est ce qui
  // rend l'ordinateur — qui lit la reserve reelle — legitime.
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm'], 8);
  const adverse = s.sides[1].team[0];
  let suivi = adverse.ki;   // trente au depart, valeur publique

  // Tour 1 : l'adversaire se garde. Gain public : GUARD_KI, puis le revenu.
  B.choose(s, 0, { type: 'move', move: 'frappe' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);
  suivi = Math.min(B.KI_MAX, Math.min(B.KI_MAX, suivi + B.GUARD_KI) + B.kiParTour(adverse));
  assert.equal(Math.round(adverse.ki), Math.round(suivi));

  // Tour 2 : il lance un Souffle. Cout public, revenu public.
  B.choose(s, 0, { type: 'guard' });
  B.choose(s, 1, { type: 'move', move: 'souffle' });
  B.resolveTurn(s);
  suivi = Math.min(B.KI_MAX, Math.min(B.KI_MAX, suivi - B.MOVES.souffle.ki) + B.kiParTour(adverse));
  assert.equal(Math.round(adverse.ki), Math.round(suivi),
    'le compte doit tomber juste a partir des seules informations publiques');
});

test('la vue fournit les commandes disponibles du camp qui regarde', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const vue = B.viewFor(s, 'b');
  assert.equal(vue.viewerSide, 1);
  assert.equal(vue.commandes.moves.length, B.MOVE_KEYS.length);
  assert.equal(vue.commandes.swaps.length, B.TEAM_SIZE);
});


/* ================================================================== */
/* Adversaires                                                        */
/* ================================================================== */

/** Joue un combat entier entre deux cerveaux et renvoie le vainqueur. */
function duel(teamA, teamB, nivA, nivB, seed) {
  const s = duo(teamA, teamB, seed);
  const brains = [AI.createBrain(nivA), AI.createBrain(nivB)];
  let garde = 0;
  while (s.phase !== B.PHASE.OVER && garde++ < 400) {
    AI.think(s, 0, brains[0]);
    AI.think(s, 1, brains[1]);
    const r = B.resolveTurn(s);
    if (!r.ok) throw new Error(`tour bloque au tour ${s.turn}`);
  }
  return { winner: s.winner, tours: s.turn, phase: s.phase };
}

test('les bots ne produisent que des commandes acceptees, et les combats aboutissent', () => {
  for (let g = 0; g < 60; g++) {
    const niveau = ['recrue', 'guerrier', 'legende'][g % 3];
    const r = duel(F.randomTeam(3), F.randomTeam(3), niveau, 'guerrier', g * 17 + 1);
    assert.equal(r.phase, B.PHASE.OVER, `combat ${g} non conclu`);
  }
});

test('la difficulte est ordonnee : Legende bat Guerrier, qui bat Recrue', () => {
  // Duels en miroir : les deux camps recoivent la MEME equipe. C'est le seul
  // moyen de mesurer la qualite des decisions ; avec des equipes tirees au
  // hasard, la moitie du resultat tient au tirage et noie l'ecart de niveau
  // (75 % en miroir tombe a 64 % en equipes libres).
  const taux = (fort, faible, n = 400) => {
    let gagnes = 0;
    for (let g = 0; g < n; g++) {
      const equipe = F.randomTeam(3);
      // On alterne les cotes pour annuler tout biais de position.
      const aGauche = g % 2 === 0;
      const r = aGauche
        ? duel(equipe, equipe.slice(), fort, faible, g * 37 + 5)
        : duel(equipe, equipe.slice(), faible, fort, g * 37 + 5);
      if (r.winner === (aGauche ? 0 : 1)) gagnes++;
    }
    return gagnes / n;
  };

  const legVsRec = taux('legende', 'recrue');
  const gueVsRec = taux('guerrier', 'recrue');
  assert.ok(legVsRec > 0.64,
    `Legende ne gagne que ${(legVsRec * 100).toFixed(1)} % contre Recrue`);
  assert.ok(gueVsRec > 0.60,
    `Guerrier ne gagne que ${(gueVsRec * 100).toFixed(1)} % contre Recrue`);

  // L'ordre entre Legende et Guerrier se mesure face a face, pas a travers
  // Recrue : contre un adversaire qui joue presque au hasard, les deux
  // plafonnent aux alentours de 72 % et leur ecart disparait dans le bruit.
  // Compare directement, il vaut une dizaine de points.
  const legVsGue = taux('legende', 'guerrier', 500);
  assert.ok(legVsGue > 0.55,
    `Legende ne gagne que ${(legVsGue * 100).toFixed(1)} % contre Guerrier`);
});

test('choisir sa commande vaut nettement mieux que taper au hasard', () => {
  // Un tour par tour n'en est un que si le choix compte. On oppose un joueur
  // qui evalue ses options a un joueur qui en tire une au sort.
  const hasard = (s, i) => {
    const d = B.availableCommands(s, i);
    const options = d.moves.filter((m) => m.utilisable).map((m) => ({ type: 'move', move: m.key }));
    options.push({ type: 'guard' });
    for (const sw of d.swaps) if (sw.utilisable) options.push({ type: 'swap', slot: sw.slot });
    return options[Math.floor(s.rng() * options.length)];
  };

  let gagnes = 0;
  const n = 300;
  for (let g = 0; g < n; g++) {
    const s = duo(F.randomTeam(3), F.randomTeam(3), g * 29 + 3);
    const brain = AI.createBrain('legende');
    const cerveauAGauche = g % 2 === 0;
    let garde = 0;
    while (s.phase !== B.PHASE.OVER && garde++ < 400) {
      if (cerveauAGauche) {
        AI.think(s, 0, brain);
        B.choose(s, 1, hasard(s, 1));
      } else {
        B.choose(s, 0, hasard(s, 0));
        AI.think(s, 1, brain);
      }
      B.resolveTurn(s);
    }
    if (s.winner === (cerveauAGauche ? 0 : 1)) gagnes++;
  }
  const taux = gagnes / n;
  assert.ok(taux > 0.7,
    `choisir ne vaut que ${(taux * 100).toFixed(1)} % : le jeu se joue tout seul`);
});

/**
 * Tire une equipe de `n` combattants distincts dans `pool`, avec un tirage
 * reproductible.
 */
function tireEquipe(rng, n, pool) {
  const copie = [...pool];
  const out = [];
  for (let i = 0; i < n && copie.length; i++) {
    out.push(copie.splice(Math.floor(rng() * copie.length), 1)[0].id);
  }
  return out;
}

/** Taux de victoire de chaque combattant du `pool`, sur `n` combats. */
function tauxParCombattant(pool, n, graine = 4242) {
  const st = new Map(pool.map((f) => [f.id, { j: 0, g: 0 }]));
  const rng = B.makeRng(graine);
  for (let g = 0; g < n; g++) {
    const A = tireEquipe(rng, 3, pool), Bq = tireEquipe(rng, 3, pool);
    const s = duo(A, Bq, g * 17 + 3);
    const brains = [AI.createBrain('legende'), AI.createBrain('legende')];
    let k = 0;
    while (s.phase !== B.PHASE.OVER && k++ < 400) {
      AI.think(s, 0, brains[0]); AI.think(s, 1, brains[1]); B.resolveTurn(s);
    }
    for (const [i, eq] of [[0, A], [1, Bq]]) {
      for (const id of eq) { const e = st.get(id); e.j++; if (s.winner === i) e.g++; }
    }
  }
  return [...st].map(([id, e]) => ({ id, t: e.g / e.j, j: e.j })).sort((a, b) => b.t - a.t);
}

test('aucun combattant n\'ecrase ni ne subit le roster', () => {
  // Ce test avait disparu lors du passage au tour par tour, et son absence a
  // laisse s'installer 45 points d'ecart entre le meilleur et le pire
  // combattant : la vitesse, qui gouvernait la pioche en temps reel, ne
  // decidait plus que de l'ordre des coups, et les profils resistants y ont
  // gagne sans que rien ne le signale.
  const t = tauxParCombattant(F.FIGHTERS, 1500);
  const etendue = (t[0].t - t[t.length - 1].t) * 100;
  const detail = t.slice(0, 3).concat(t.slice(-3))
    .map((x) => `${x.id} ${(x.t * 100).toFixed(0)}%`).join(', ');
  assert.ok(etendue <= 30, `etendue de ${etendue.toFixed(1)} points : ${detail}`);
});

test('aucun element n\'est structurellement avantage', () => {
  // On clone les statistiques : seul l'element distingue encore les
  // combattants, donc tout ecart vient du cycle et de ses alterations. Le
  // premier releve donnait Braise a 62 % et Givre a 43 %, parce que la
  // brulure valait deux fois le gel.
  const parEl = new Map(F.ELEMENT_KEYS.map((e) => [e, { j: 0, g: 0 }]));
  const rng = B.makeRng(999);
  // Une equipe par element, pour que le tirage n'introduise pas de biais.
  for (let g = 0; g < 900; g++) {
    const A = tireEquipe(rng, 3, F.FIGHTERS), Bq = tireEquipe(rng, 3, F.FIGHTERS);
    const s = duo(A, Bq, g * 23 + 5);
    // Statistiques egalisees a la volee : c'est l'element qu'on isole.
    for (const side of s.sides) {
      for (const u of side.team) { u.hp = 650; u.maxHp = 650; }
    }
    const brains = [AI.createBrain('legende'), AI.createBrain('legende')];
    let k = 0;
    while (s.phase !== B.PHASE.OVER && k++ < 400) {
      AI.think(s, 0, brains[0]); AI.think(s, 1, brains[1]); B.resolveTurn(s);
    }
    for (const [i, eq] of [[0, A], [1, Bq]]) {
      for (const id of eq) {
        const e = parEl.get(F.getFighter(id).element); e.j++; if (s.winner === i) e.g++;
      }
    }
  }
  const taux = [...parEl].map(([e, v]) => ({ e, t: v.g / v.j * 100 }));
  const ecart = Math.max(...taux.map((x) => x.t)) - Math.min(...taux.map((x) => x.t));
  assert.ok(ecart <= 14,
    `ecart de ${ecart.toFixed(1)} points entre elements : `
    + taux.map((x) => `${x.e} ${x.t.toFixed(1)}`).join(' '));
});

test('les soutiens valent les combattants purs, sans les depasser', () => {
  // La decote de budget doit compenser la capacite, ni plus ni moins.
  const t = tauxParCombattant(F.FIGHTERS, 1500);
  const moyenne = (pred) => {
    const a = t.filter((x) => pred(F.getFighter(x.id)));
    return a.reduce((s, x) => s + x.t, 0) / a.length * 100;
  };
  const purs = moyenne((f) => !f.support);
  const soins = moyenne((f) => f.support && f.support.kind === 'soin');
  const renforts = moyenne((f) => f.support && f.support.kind === 'renfort');
  for (const [nom, v] of [['soigneurs', soins], ['renforts', renforts]]) {
    assert.ok(Math.abs(v - purs) <= 6,
      `${nom} a ${v.toFixed(1)} % contre ${purs.toFixed(1)} % pour les combattants purs`);
  }
});

test('jouer sa capacite de soutien rapporte vraiment', () => {
  // Une capacite qui ne change rien au resultat n'est pas une capacite. Le
  // renfort a d'abord ete mesure a exactement zero : il coutait un tour
  // entier pour un multiplicateur qui ne payait qu'ensuite.
  const soutiens = F.FIGHTERS.filter((f) => f.support);
  const joue = (autorise) => {
    let g = 0, j = 0;
    const rng = B.makeRng(321);
    for (let n = 0; n < 500; n++) {
      const A = tireEquipe(rng, 3, F.FIGHTERS), Bq = tireEquipe(rng, 3, F.FIGHTERS);
      const s = duo(A, Bq, n * 13 + 7);
      const brains = [AI.createBrain('legende'), AI.createBrain('legende')];
      let k = 0;
      while (s.phase !== B.PHASE.OVER && k++ < 400) {
        for (let i = 0; i < 2; i++) {
          AI.think(s, i, brains[i]);
          // Camp 0 bride : sa commande de soutien est remplacee par une frappe.
          if (!autorise && i === 0 && s.sides[0].queued && s.sides[0].queued.type === 'soutien') {
            s.sides[0].queued = { type: 'move', move: 'frappe' };
          }
        }
        B.resolveTurn(s);
      }
      // On ne compte que les combats ou le camp 0 avait de quoi soutenir.
      if (!A.some((id) => F.getFighter(id).support)) continue;
      j++; if (s.winner === 0) g++;
    }
    return g / j * 100;
  };
  assert.ok(soutiens.length >= 10, 'il faut assez de soutiens pour mesurer');
  const avec = joue(true), sans = joue(false);
  assert.ok(avec > sans + 1.5,
    `jouer le soutien ne rapporte que ${(avec - sans).toFixed(1)} points `
    + `(${avec.toFixed(1)} % contre ${sans.toFixed(1)} %)`);
});

test('un combat dure un nombre de tours jouable', () => {
  const longueurs = [];
  for (let g = 0; g < 120; g++) {
    const r = duel(F.randomTeam(3), F.randomTeam(3), 'guerrier', 'guerrier', g * 53 + 1);
    longueurs.push(r.tours);
  }
  longueurs.sort((a, b) => a - b);
  const mediane = longueurs[Math.floor(longueurs.length / 2)];
  assert.ok(mediane >= 10 && mediane <= 40,
    `mediane de ${mediane} tours : trop expeditif ou trop long`);
});



/* ================================================================== */
/* Soutien : soin et renfort                                          */
/* ================================================================== */

/** Une équipe dont le premier combattant porte la capacité voulue. */
function equipeAvec(kind, portee) {
  const f = F.FIGHTERS.find((x) => x.support && x.support.kind === kind
    && (!portee || x.support.portee === portee));
  assert.ok(f, `aucun combattant ${kind}/${portee ?? '*'}`);
  const autres = F.FIGHTERS.filter((x) => x.id !== f.id).slice(0, 2).map((x) => x.id);
  return [f.id, ...autres];
}

test('chaque element possede un soigneur et un renfort', () => {
  for (const el of F.ELEMENT_KEYS) {
    const pack = F.FIGHTERS.filter((f) => f.element === el && f.support);
    const genres = pack.map((f) => f.support.kind).sort();
    assert.deepEqual(genres, ['renfort', 'soin'],
      `${el} : ${JSON.stringify(pack.map((f) => f.name + '/' + f.support.kind))}`);
  }
});

test('les capacites de soutien sont completes et coherentes', () => {
  for (const f of F.FIGHTERS.filter((x) => x.support)) {
    const c = f.support;
    assert.ok(['soin', 'renfort'].includes(c.kind), `${f.name} : genre inconnu`);
    assert.ok(['allie', 'equipe'].includes(c.portee), `${f.name} : portee inconnue`);
    assert.ok(c.name && c.glyph && c.blurb, `${f.name} : capacite incomplete`);
    assert.ok(c.ki >= 0 && c.ki <= B.KI_MAX, `${f.name} : cout de ki hors bornes`);
    if (c.kind === 'soin') {
      assert.ok(c.part > 0 && c.part < 0.5, `${f.name} : soin disproportionne (${c.part})`);
      // Une portee d'equipe doit rendre moins par cible qu'un soin cible.
      if (c.portee === 'equipe') assert.ok(c.part < 0.25, `${f.name} : soin d'equipe trop fort`);
    } else {
      assert.ok(c.attaque > 1 && c.attaque <= 1.35, `${f.name} : renfort disproportionne (${c.attaque})`);
      assert.ok(c.tours >= 2 && c.tours <= 6, `${f.name} : renfort trop long`);
    }
  }
});

test('un camp ne dispose que de trois soutiens pour tout le combat', () => {
  const s = duo(equipeAvec('soin'), ['kaze', 'volt', 'nox']);
  assert.equal(s.sides[0].soutiens, B.SOUTIENS_MAX);
  assert.equal(B.SOUTIENS_MAX, 3);

  for (let i = 0; i < B.SOUTIENS_MAX; i++) {
    const u = s.sides[0].team[s.sides[0].active];
    u.ki = B.KI_MAX;
    u.hp = Math.round(u.maxHp * 0.4);   // sans blessure, le soin ne rend rien
    assert.equal(B.choose(s, 0, { type: 'soutien' }).ok, true, `soutien ${i + 1} refuse`);
    B.choose(s, 1, { type: 'guard' });
    B.resolveTurn(s);
  }
  assert.equal(s.sides[0].soutiens, 0);

  s.sides[0].team[s.sides[0].active].ki = B.KI_MAX;
  const r = B.choose(s, 0, { type: 'soutien' });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'réserve épuisée');
  assert.equal(B.availableCommands(s, 0).soutien.utilisable, false);
});

test('la reserve de soutien est par camp, pas par combattant', () => {
  // Empiler deux soigneurs ne doit pas doubler la reserve.
  const deux = F.FIGHTERS.filter((f) => f.support && f.support.kind === 'soin').slice(0, 2).map((f) => f.id);
  const s = duo([...deux, 'kaze'], ['volt', 'nox', 'gorm']);
  for (let i = 0; i < 3; i++) {
    const u = s.sides[0].team[s.sides[0].active];
    u.ki = B.KI_MAX; u.hp = Math.round(u.maxHp * 0.4);
    B.choose(s, 0, { type: 'soutien' });
    B.choose(s, 1, { type: 'guard' });
    B.resolveTurn(s);
  }
  assert.equal(s.sides[0].soutiens, 0);
  // Le second soigneur entre en lice : la reserve reste vide.
  s.sides[0].active = 1;
  s.sides[0].team[1].ki = B.KI_MAX;
  assert.equal(B.choose(s, 0, { type: 'soutien' }).ok, false);
});

test('un soin cible rend des points de vie au plus mal en point', () => {
  const s = duo(equipeAvec('soin', 'allie'), ['kaze', 'volt', 'nox']);
  const soigneur = s.sides[0].team[0];
  const blesse = s.sides[0].team[1];
  soigneur.ki = B.KI_MAX;
  soigneur.hp = soigneur.maxHp;             // intact
  blesse.hp = Math.round(blesse.maxHp * 0.3); // le plus bas
  const avant = blesse.hp;

  B.choose(s, 0, { type: 'soutien' });
  B.choose(s, 1, { type: 'guard' });
  const { effects } = B.resolveTurn(s);

  assert.ok(blesse.hp > avant, 'le plus mal en point doit etre soigne');
  assert.equal(soigneur.hp, soigneur.maxHp, 'le soigneur intact ne gagne rien');
  assert.ok(effects.some((e) => e.type === 'soin'), 'un effet de soin doit etre emis');
});

test('un soin d\'equipe touche tous les vivants, et jamais un combattant a terre', () => {
  const s = duo(equipeAvec('soin', 'equipe'), ['kaze', 'volt', 'nox']);
  const camp = s.sides[0];
  camp.team[0].ki = B.KI_MAX;
  for (const u of camp.team) u.hp = Math.round(u.maxHp * 0.5);
  camp.team[2].ko = true;
  camp.team[2].hp = 0;

  B.choose(s, 0, { type: 'soutien' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);

  assert.ok(camp.team[0].hp > camp.team[0].maxHp * 0.5);
  assert.ok(camp.team[1].hp > camp.team[1].maxHp * 0.5);
  assert.equal(camp.team[2].hp, 0, 'un combattant a terre ne se releve pas');
});

test('un soin ne depasse jamais les points de vie maximum', () => {
  const s = duo(equipeAvec('soin', 'allie'), ['kaze', 'volt', 'nox']);
  const camp = s.sides[0];
  camp.team[0].ki = B.KI_MAX;
  for (const u of camp.team) u.hp = u.maxHp - 1;
  B.choose(s, 0, { type: 'soutien' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);
  for (const u of camp.team) assert.ok(u.hp <= u.maxHp, 'sur-soin');
});

test('un renfort augmente reellement les degats, et finit par expirer', () => {
  const equipe = equipeAvec('renfort', 'allie');
  const cap = F.getFighter(equipe[0]).support;

  const degats = (avecRenfort) => {
    const s = duo(equipe, ['kaze', 'volt', 'nox'], 3);
    const u = s.sides[0].team[0];
    const cible = s.sides[1].team[0];
    u.ki = B.KI_MAX;
    if (avecRenfort) {
      B.choose(s, 0, { type: 'soutien' });
      B.choose(s, 1, { type: 'guard' });
      B.resolveTurn(s);
      assert.ok(u.boost, 'le renfort doit se poser');
    }
    u.ki = B.KI_MAX;
    const avant = cible.hp;
    B.choose(s, 0, { type: 'move', move: 'souffle' });
    B.choose(s, 1, { type: 'move', move: 'frappe' });
    B.resolveTurn(s);
    return avant - cible.hp;
  };

  const nu = degats(false);
  const renforce = degats(true);
  assert.ok(renforce > nu, `renfort sans effet : ${renforce} contre ${nu}`);
  // L'ordre de grandeur doit correspondre au multiplicateur annonce.
  assert.ok(renforce < nu * (cap.attaque + 0.15),
    `renfort disproportionne : ×${(renforce / nu).toFixed(2)} pour ×${cap.attaque} annonce`);
});

test('un renfort s\'use sur tout le camp, banc compris', () => {
  const equipe = equipeAvec('renfort', 'equipe');
  const s = duo(equipe, ['kaze', 'volt', 'nox']);
  const camp = s.sides[0];
  camp.team[0].ki = B.KI_MAX;
  B.choose(s, 0, { type: 'soutien' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);

  for (const u of camp.team) assert.ok(u.boost, 'toute l\'equipe doit etre renforcee');
  const restant = camp.team[1].boost.tours;

  B.choose(s, 0, { type: 'move', move: 'frappe' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);
  assert.equal(camp.team[1].boost.tours, restant - 1,
    'un combattant garde au banc ne doit pas conserver son renfort');
});

test('empiler des renforts reste sous plafond', () => {
  const s = duo(equipeAvec('renfort', 'allie'), ['kaze', 'volt', 'nox']);
  const u = s.sides[0].team[0];
  for (let i = 0; i < B.SOUTIENS_MAX; i++) {
    u.ki = B.KI_MAX;
    B.choose(s, 0, { type: 'soutien' });
    B.choose(s, 1, { type: 'guard' });
    B.resolveTurn(s);
  }
  assert.ok(u.boost, 'le renfort doit tenir');
  assert.ok(u.boost.attaque <= B.RENFORT_MAX,
    `cumul hors plafond : ${u.boost.attaque} > ${B.RENFORT_MAX}`);
});

test('un combattant mis a terre perd son renfort', () => {
  const s = duo(equipeAvec('renfort', 'allie'), ['kaze', 'volt', 'nox']);
  const u = s.sides[0].team[0];
  u.ki = B.KI_MAX;
  B.choose(s, 0, { type: 'soutien' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);
  assert.ok(u.boost);

  u.hp = 1;
  s.sides[1].team[0].ki = B.KI_MAX;
  B.choose(s, 0, { type: 'guard' });
  B.choose(s, 1, { type: 'move', move: 'speciale' });
  B.resolveTurn(s);
  assert.equal(u.ko, true);
  assert.equal(u.boost, null, 'le renfort doit tomber avec le combattant');
});

test('un combattant sans capacite ne peut pas jouer de soutien', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['gorm', 'tarn', 'brume']);
  const d = B.availableCommands(s, 0);
  assert.equal(d.soutien.capacite, null);
  assert.equal(d.soutien.utilisable, false);
  assert.equal(d.soutien.raison, 'pas de capacité');
  assert.equal(B.choose(s, 0, { type: 'soutien' }).ok, false);
});

test('la vue expose la reserve de soutien et le renfort en cours', () => {
  const s = duo(equipeAvec('renfort', 'allie'), ['kaze', 'volt', 'nox']);
  s.sides[0].team[0].ki = B.KI_MAX;
  B.choose(s, 0, { type: 'soutien' });
  B.choose(s, 1, { type: 'guard' });
  B.resolveTurn(s);

  const vue = B.viewFor(s, 'a');
  assert.equal(vue.sides[0].soutiens, B.SOUTIENS_MAX - 1);
  assert.ok(vue.sides[0].team[0].boost, 'le renfort doit etre visible');
  assert.ok(vue.commandes.soutien.capacite, 'la capacite doit etre decrite');
});

/* ================================================================== */
/* Roles                                                              */
/* ================================================================== */

test('chaque combattant recoit un role, et un seul', () => {
  for (const f of F.FIGHTERS) {
    const r = F.roleOf(f);
    assert.ok(r, `${f.name} : aucun role`);
    assert.ok(F.ROLES[r.key], `${f.name} : role inconnu ${r.key}`);
    assert.ok(r.label && r.glyph && r.color && r.blurb, `${r.key} : fiche incomplete`);
  }
});

test('le role se deduit des statistiques, jamais d\'une etiquette', () => {
  // Un soutien reste un soutien, quelle que soit sa carrure.
  for (const f of F.FIGHTERS.filter((x) => x.support)) {
    assert.equal(F.roleOf(f).key, f.support.kind === 'soin' ? 'soigneur' : 'renfort',
      `${f.name} : son role doit suivre sa capacite`);
  }
  // Un combattant purement offensif ne peut pas etre classe soutien.
  for (const f of F.FIGHTERS.filter((x) => !x.support)) {
    assert.ok(!['soigneur', 'renfort'].includes(F.roleOf(f).key),
      `${f.name} : classe soutien sans capacite`);
  }
  // Et la classification doit reagir aux statistiques : on fabrique deux
  // fiches extremes et on verifie qu'elles tombent du bon cote.
  const cogneur = { id: 'x', element: 'braise', hp: 600, strike: 90, blast: 30, armor: 20, speed: 70 };
  const artilleur = { id: 'y', element: 'braise', hp: 600, strike: 30, blast: 90, armor: 20, speed: 70 };
  const mur = { id: 'z', element: 'braise', hp: 1400, strike: 55, blast: 55, armor: 60, speed: 70 };
  assert.equal(F.roleOf(cogneur).key, 'assaut');
  assert.equal(F.roleOf(artilleur).key, 'canon');
  assert.equal(F.roleOf(mur).key, 'colosse');
});

test('tous les roles sont representes, sans qu\'aucun ecrase les autres', () => {
  const compte = {};
  for (const f of F.FIGHTERS) {
    const k = F.roleOf(f).key;
    compte[k] = (compte[k] || 0) + 1;
  }
  for (const k of F.ROLE_KEYS) {
    assert.ok(compte[k] >= 3, `role ${k} : ${compte[k] || 0} combattant(s), c'est trop peu`);
  }
  const effectifs = Object.values(compte);
  assert.ok(Math.max(...effectifs) <= F.FIGHTERS.length / 3,
    `un role rassemble ${Math.max(...effectifs)} combattants sur ${F.FIGHTERS.length}`);
});

test('chaque element propose plusieurs roles', () => {
  // Sans cela, choisir son element reviendrait a choisir son role, et le
  // cycle elementaire cesserait d'etre une decision separee.
  for (const el of F.ELEMENT_KEYS) {
    const roles = new Set(F.FIGHTERS.filter((f) => f.element === el).map((f) => F.roleOf(f).key));
    assert.ok(roles.size >= 4,
      `${el} n'offre que ${roles.size} roles : ${[...roles].join(', ')}`);
  }
});

test('le tempo distingue les rapides des lents, sans remplacer le role', () => {
  const rapides = F.FIGHTERS.filter((f) => F.tempoOf(f)?.key === 'rapide');
  const lents = F.FIGHTERS.filter((f) => F.tempoOf(f)?.key === 'lent');
  assert.ok(rapides.length >= 4 && lents.length >= 4,
    `tempo mal reparti : ${rapides.length} rapides, ${lents.length} lents`);
  // Le plus rapide du roster doit etre marque rapide, le plus lent lent.
  const tri = [...F.FIGHTERS].sort((a, b) => b.speed - a.speed);
  assert.equal(F.tempoOf(tri[0]).key, 'rapide');
  assert.equal(F.tempoOf(tri[tri.length - 1]).key, 'lent');
  // Le tempo traverse les roles : un colosse peut etre rapide.
  const roles = new Set(rapides.concat(lents).map((f) => F.roleOf(f).key));
  assert.ok(roles.size >= 3, 'le tempo ne doit pas se confondre avec le role');
});

/* ================================================================== */
/* Roue des elements                                                  */
/* ================================================================== */

test('la roue suit le cycle et le boucle', async () => {
  const R = await import('../public/shared/zenith/roue.js');
  const cycle = R.ordreCycle();
  assert.equal(cycle.length, F.ELEMENT_KEYS.length);
  assert.equal(new Set(cycle).size, cycle.length, 'element repete');
  for (let i = 0; i < cycle.length; i++) {
    const suivant = cycle[(i + 1) % cycle.length];
    assert.equal(F.ELEMENTS[cycle[i]].beats, suivant,
      `${cycle[i]} devrait dominer ${suivant}`);
  }
});

test('la roue produit un SVG complet et nomme chaque element', async () => {
  const R = await import('../public/shared/zenith/roue.js');
  const svg = R.roueSvg({ moi: 'braise', cible: 'orage', labels: true });
  assert.match(svg, /^<svg/);
  assert.match(svg, /<\/svg>$/);
  // Une fleche par element, et pas une de plus.
  assert.equal((svg.match(/marker-end/g) || []).length, F.ELEMENT_KEYS.length);
  for (const k of F.ELEMENT_KEYS) {
    assert.ok(svg.includes(F.ELEMENTS[k].label.toUpperCase()), `${k} absent de la roue`);
  }
});

test('la roue dit juste le rapport de force', async () => {
  const R = await import('../public/shared/zenith/roue.js');
  assert.match(R.resumeMatchup('braise', 'orage'), /domine/);
  assert.match(R.resumeMatchup('orage', 'braise'), /domin[ée]/);
  assert.match(R.resumeMatchup('braise', 'braise'), /aucun avantage/);
  // Ce que dit la roue doit correspondre au moteur, pas a une table separee.
  for (const a of F.ELEMENT_KEYS) for (const b of F.ELEMENT_KEYS) {
    const m = F.elementMultiplier(a, b);
    const dit = R.resumeMatchup(a, b);
    if (m > 1) assert.match(dit, /augmentés/, `${a}>${b}`);
    else if (m < 1) assert.match(dit, /réduits/, `${a}<${b}`);
    else assert.match(dit, /aucun avantage/, `${a}=${b}`);
  }
});


/* ================================================================== */
/* Pages de regles                                                    */
/* ================================================================== */

/** Même échappement que les pages : sinon une apostrophe fait echouer la
 *  comparaison alors que le texte est bien la. */
const escHtml = (t) => String(t).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

test('les trois pages de regles se rendent hors navigateur', async () => {
  // Les pages sont de simples fonctions de chaines : si l'une touchait au
  // document, elle ne serait testable qu'en navigateur, et ne le serait donc
  // jamais.
  const R = await import('../public/games/zenith/js/regles.js');
  for (const nom of ['pageCombat', 'pageRoles', 'pageElements']) {
    const html = R[nom]();
    assert.ok(typeof html === 'string' && html.length > 400, `${nom} : page vide`);
    // Balises ouvrantes et fermantes en nombre egal, signe d'un fragment sain.
    const ouv = (html.match(/<(div|p|section|article|h3|span|b)\b/g) || []).length;
    const fer = (html.match(/<\/(div|p|section|article|h3|span|b)>/g) || []).length;
    assert.equal(ouv, fer, `${nom} : ${ouv} balises ouvertes pour ${fer} fermees`);
  }
});

test('la page des roles les presente tous, avec des exemples reels', async () => {
  const R = await import('../public/games/zenith/js/regles.js');
  const html = R.pageRoles();
  for (const k of F.ROLE_KEYS) {
    const r = F.ROLES[k];
    assert.ok(html.includes(r.label), `${r.label} absent de la page`);
    assert.ok(html.includes(escHtml(r.blurb)), `${r.label} : description absente`);
    // L'effectif annonce doit etre le vrai.
    const n = F.FIGHTERS.filter((f) => F.roleOf(f).key === k).length;
    assert.ok(html.includes(`${n} combattants`), `${r.label} : effectif faux`);
    // Et les exemples doivent porter ce role.
    const exemples = F.FIGHTERS.filter((f) => F.roleOf(f).key === k).slice(0, 3);
    for (const f of exemples) assert.ok(html.includes(f.name), `${f.name} absent`);
  }
  assert.ok(html.includes(String(B.SOUTIENS_MAX)), 'le nombre de charges doit figurer');
});

test('les regles annoncent les chiffres du moteur, pas des chiffres figes', async () => {
  // Elles ont longtemps annonce « 14 ki par tour » alors que le revenu
  // dependait deja de la vitesse. Les construire depuis les constantes est
  // ce qui empeche l'ecart de revenir ; ce test le verifie.
  const R = await import('../public/games/zenith/js/regles.js');
  const combat = R.pageCombat();
  assert.ok(combat.includes(String(B.GUARD_KI)), 'le gain de ki de la garde doit figurer');
  assert.ok(combat.includes(String(B.MAX_TURNS)), 'la limite de tours doit figurer');
  assert.ok(combat.includes(String(B.VITESSE_REF)), 'la vitesse de reference doit figurer');
  assert.ok(combat.includes(`${Math.round((1 - B.GUARD_REDUCTION) * 100)} %`),
    'la reduction de la garde doit figurer');
  for (const k of B.MOVE_KEYS) {
    if (B.MOVES[k].ki) assert.ok(combat.includes(String(B.MOVES[k].ki)), `cout de ${k} absent`);
  }

  const elements = R.pageElements();
  assert.ok(elements.includes(`+${Math.round((F.ADVANTAGE_BONUS - 1) * 100)} %`),
    'le bonus elementaire doit figurer');
  for (const k of F.ELEMENT_KEYS) {
    assert.ok(elements.includes(F.ELEMENTS[k].label), `${k} absent`);
    const st = B.STATUS[B.ELEMENT_STATUS[k]];
    assert.ok(elements.includes(st.label), `alteration de ${k} absente`);
    assert.ok(elements.includes(escHtml(st.blurb)), `description de ${st.label} absente`);
  }
});

/* ================================================================== */
/* Arene en ligne                                                     */
/* ================================================================== */

test('un combat en ligne se joue de bout en bout contre le vrai serveur', async (t) => {
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
  ouverts.push(host, guest);
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
  assert.equal(first.view.phase, 'choose');
  assert.equal(first.view.turn, 1);

  // Un seul camp a joue : l'autre doit l'apprendre sans savoir quoi.
  host.send({ t: 'act', action: { type: 'move', move: 'frappe' } });
  const moitie = await guest.wait((m) => m.t === 'z:tick'
    && m.view.sides[1 - m.view.viewerSide].aChoisi === true);
  assert.equal(moitie.view.phase, 'choose', 'le tour ne part pas sans les deux commandes');
  assert.ok(!JSON.stringify(moitie.view.sides).includes('frappe'),
    'la commande adverse ne doit pas transiter');

  guest.send({ t: 'act', action: { type: 'move', move: 'frappe' } });
  const resolu = await host.wait((m) => m.t === 'z:tick' && m.view.turn === 2);
  assert.ok(resolu.effects.length > 0, 'le tour resolu doit transporter ses effets');

  // Le serveur refuse une commande impossible plutot que de l'appliquer.
  host.send({ t: 'act', action: { type: 'move', move: 'inexistant' } });
  await host.wait((m) => m.t === 'z:reject');

  // Puis les deux camps se frappent jusqu'a ce qu'un vainqueur sorte.
  const spam = setInterval(() => {
    host.send({ t: 'act', action: { type: 'move', move: 'frappe' } });
    guest.send({ t: 'act', action: { type: 'move', move: 'frappe' } });
    // On evite que les boites de reception ne gonflent sans fin.
    if (host.inbox.length > 400) host.inbox.splice(0, 300);
    if (guest.inbox.length > 400) guest.inbox.splice(0, 300);
  }, 25);
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
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise((res) => server.close(res));
  });

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
