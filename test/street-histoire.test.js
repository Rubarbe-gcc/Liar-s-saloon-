/**
 * STREET COMBAT — le mode Histoire : le scénario tient debout (combattants,
 * arènes, choix, drapeaux, déblocages).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PERSO, PERSOS, ROSTER, BOSS, SECRETS, FIGURANTS } from '../public/shared/street/persos.js';
import { ACTES, SCENES, DOUBLURE, TOUR_BOSS, TOURNOI_FINALE } from '../public/games/street-combat/js/histoire.js';

const ARENES = new Set([...readFileSync(new URL('../public/games/street-combat/js/arenes.js', import.meta.url), 'utf8').matchAll(/\{ id: '(\w+)', nom:/g)].map((m) => m[1]));
const NIVEAUX = ['facile', 'normal', 'difficile', 'impossible'];

/** Toutes les étapes d'une liste, choix et conditions compris. */
function* toutes(etapes = []) {
  for (const e of etapes) {
    yield e;
    if (e.choix) for (const c of e.choix) yield* toutes(c.suite);
    if (e.si) { yield* toutes(e.alors); yield* toutes(e.sinon); }
  }
}
const listes = (sc) => [sc.etapes, sc.apres, sc.apresDefaite].filter(Boolean);

test('le scénario : dix actes, des combats, des vagues de soldats et des scènes sans combat, des lieux et des combattants qui existent', () => {
  assert.equal(ACTES.length, 10);
  assert.ok(SCENES.length >= 40, `${SCENES.length} scènes`);
  assert.ok(SCENES.filter((s) => s.combat).length >= 28);
  assert.ok(SCENES.filter((s) => !s.combat).length >= 10, 'des scènes sans combat');
  for (let a = 0; a < ACTES.length; a++) assert.ok(SCENES.filter((s) => s.acte === a).length >= 3, `l’acte ${a + 1} est trop court`);
  // Les vagues : que des soldats de l’Horloge.
  const vagues = SCENES.filter((s) => s.combat?.serie);
  assert.ok(vagues.length >= 5);
  assert.ok(SCENES.filter((s) => s.combat?.joueur).length >= 4, 'des combats où l’on incarne un autre combattant');
  assert.ok(SCENES.filter((s) => s.combat?.corrompu).length >= 10, 'des corrompus à libérer');
  for (const s of vagues) { assert.equal(s.combat.adv, s.combat.serie[0], s.id); for (const id of s.combat.serie) assert.ok(PERSO[id]?.figurant, `${s.id} : ${id}`); }
  assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length, 'des identifiants uniques');
  for (const sc of [...SCENES, { id: 'tour', etapes: TOUR_BOSS }, { id: 'tournoi', etapes: TOURNOI_FINALE }]) {
    if (sc.arene) assert.ok(ARENES.has(sc.arene), `${sc.id} : arène ${sc.arene}`);
    if (sc.acte !== undefined) assert.ok(ACTES[sc.acte], sc.id);
    for (const l of listes(sc)) for (const e of toutes(l)) {
      for (const k of ['entre', 'dit', 'sort', 'pose', 'devoile', 'debloque', 'croise']) {
        if (e[k] !== undefined) assert.ok(e[k] === 'hero' || PERSO[e[k]], `${sc.id} : ${k} ${e[k]}`);
      }
      if (e.decor) assert.ok(ARENES.has(e.decor), `${sc.id} : décor ${e.decor}`);
      if (e.dit) assert.ok(e.texte, `${sc.id} : une réplique sans texte`);
      if (e.choix) assert.ok(e.choix.length >= 2 && e.choix.every((c) => c.texte), `${sc.id} : un choix`);
    }
    if (sc.combat) {
      assert.ok(PERSO[sc.combat.adv], `${sc.id} : ${sc.combat.adv}`);
      if (sc.combat.issue) assert.ok(sc.apresDefaite, `${sc.id} : et si on perd ?`);
      // On incarne quelqu’un d’autre : un vrai combattant ; un corrompu : jamais un soldat de l’Horloge.
      if (sc.combat.joueur) assert.ok(PERSOS.includes(PERSO[sc.combat.joueur]), `${sc.id} : ${sc.combat.joueur}`);
      if (sc.combat.corrompu) assert.ok(!PERSO[sc.combat.adv].figurant && !sc.combat.serie, sc.id);
      for (const d of ['normal', 'difficile']) assert.ok(NIVEAUX.includes(sc.combat.niveau[d]), `${sc.id} : niveau ${d}`);
    }
  }
});

test('les choix : chaque condition dépend d’un drapeau qu’un choix (ou une scène) peut lever', () => {
  const leves = new Set();
  const lus = [];
  for (const sc of SCENES) {
    if (sc.si) lus.push([sc.id, sc.si]);
    if (sc.combat?.bonus) lus.push([sc.id, sc.combat.bonus.si]);
    for (const l of listes(sc)) for (const e of toutes(l)) {
      if (e.choix) for (const c of e.choix) if (c.drapeau) leves.add(c.drapeau);
      if (e.marque) leves.add(e.marque);
      if (e.si) lus.push([sc.id, e.si]);
    }
  }
  assert.ok(leves.size >= 5, 'au moins cinq décisions qui comptent');
  for (const [id, si] of lus) assert.ok(leves.has(si.replace(/^!/, '')), `${id} : le drapeau ${si} n’est jamais levé`);
  // Les deux chemins de l'acte III : un seul des deux se joue.
  const chemins = SCENES.filter((s) => s.si);
  assert.ok(chemins.some((s) => s.si.startsWith('!')) && chemins.some((s) => !s.si.startsWith('!')));
});

test('les déblocages : les boss en les battant, Vorn, Sablia, Éclipse en route, Kaïros à la fin ; Onyx et Némésis, on les croise seulement', () => {
  const debloques = [];
  const croises = [];
  for (const sc of SCENES) for (const l of listes(sc)) for (const e of toutes(l)) {
    if (e.debloque) debloques.push(e.debloque);
    if (e.croise) { croises.push(e.croise); assert.ok(e.indice, `${sc.id} : où le débloquer ?`); }
  }
  const histoire = PERSOS.filter((p) => p.secret === 'histoire').map((p) => p.id);
  assert.deepEqual(debloques.sort(), [...Object.values(BOSS), ...histoire].sort());
  for (const p of FIGURANTS) assert.ok(!debloques.includes(p.id) && !croises.includes(p.id), p.id);
  // On croise avant de débloquer : Malvortex, Vorn, Sablia.
  const ordre = (id, quoi) => SCENES.findIndex((sc) => [sc.etapes, sc.apres].filter(Boolean).some((l) => [...toutes(l)].some((e) => e[quoi] === id)));
  for (const id of ['malvortex', 'vorn', 'sablia']) assert.ok(ordre(id, 'croise') < ordre(id, 'debloque'), id);
  // Et l’inverse : Sablia, débloquée, se recombat plus tard.
  assert.ok(SCENES.findIndex((sc) => sc.combat?.adv === 'sablia' && SCENES.indexOf(sc) > ordre('sablia', 'debloque')) > 0);
  for (const id of [SECRETS.tournoi, SECRETS.tour]) assert.ok(croises.includes(id) && !debloques.includes(id), id);
  // Un boss croisé avant d'être débloqué.
  assert.ok(croises.includes(BOSS.difficile) && croises.includes('vorn'));
  // La dernière scène : l'épilogue, après Kaïros.
  assert.equal(SCENES.at(-1).id, 'epilogue');
  assert.equal(SCENES.at(-2).combat.adv, SECRETS.histoire);
});

test('la doublure : quel que soit le héros, personne ne se croise lui-même', () => {
  const acteurs = new Set();
  for (const sc of SCENES) {
    if (sc.combat) acteurs.add(sc.combat.adv);
    for (const l of listes(sc)) for (const e of toutes(l)) for (const k of ['entre', 'dit']) if (e[k] && e[k] !== 'hero') acteurs.add(e[k]);
  }
  assert.ok(!acteurs.has(DOUBLURE), 'la doublure ne joue aucun rôle à elle');
  assert.ok(ROSTER.some((p) => p.id === DOUBLURE));
  // Les boss et les secrets ne sont jamais le héros de l'histoire : ils peuvent garder leur rôle.
  for (const id of acteurs) assert.ok(PERSO[id], id);
});
