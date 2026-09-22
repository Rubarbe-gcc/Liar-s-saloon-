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
  assert.equal(att.ki, kiAvant - B.MOVES.souffle.ki + B.KI_PAR_TOUR);
});

test('la frappe est gratuite et rend du ki', () => {
  const s = duo(['kaze', 'volt', 'nox'], ['tarn', 'brume', 'gorm']);
  const att = s.sides[0].team[0];
  att.ki = 0;
  tour(s, frappe, frappe);
  assert.equal(att.ki, B.MOVES.frappe.kiGain + B.KI_PAR_TOUR);
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
  assert.equal(s.sides[0].team[0].ki, B.GUARD_KI + B.KI_PAR_TOUR);
  assert.equal(s.sides[1].team[0].ki, B.GUARD_KI + B.KI_PAR_TOUR);
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
  assert.ok(legVsRec > 0.68,
    `Legende ne gagne que ${(legVsRec * 100).toFixed(1)} % contre Recrue`);
  assert.ok(gueVsRec > 0.57,
    `Guerrier ne gagne que ${(gueVsRec * 100).toFixed(1)} % contre Recrue`);
  assert.ok(legVsRec > gueVsRec + 0.03,
    `Legende (${(legVsRec * 100).toFixed(1)} %) doit devancer Guerrier `
    + `(${(gueVsRec * 100).toFixed(1)} %) face a Recrue`);
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
