/**
 * STREET COMBAT — le mode Histoire : le scénario tient debout (combattants,
 * arènes, choix, drapeaux, déblocages).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES } from '../public/shared/musique.js';

import { PERSO, PERSOS, ROSTER, BOSS, SECRETS, FIGURANTS } from '../public/shared/street/persos.js';
import { ACTES, SCENES, DOUBLURE, TOUR_BOSS, TOURNOI_FINALE, TOUR_VICTOIRE, victoireTournoi, MUSIQUES, musiqueDe, ALLIES, finDe } from '../public/games/street-combat/js/histoire.js';

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
const listes = (sc) => [sc.etapes, sc.finale, sc.apres, sc.apresDefaite].filter(Boolean);

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
  // Les grands boss ont leur petit film de fin.
  for (const id of ['solarius', 'vorn', 'malvortex', 'lechaos', 'kairos']) assert.ok(SCENES.some((s) => s.combat?.adv === id && !s.combat.issue && s.finale?.length >= 10), `le film de ${id}`);
  for (const s of vagues) { assert.equal(s.combat.adv, s.combat.serie[0], s.id); for (const id of s.combat.serie) assert.ok(PERSO[id]?.figurant, `${s.id} : ${id}`); }
  assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length, 'des identifiants uniques');
  for (const sc of [...SCENES, { id: 'tour', etapes: TOUR_BOSS }, { id: 'tournoi', etapes: TOURNOI_FINALE }, { id: 'tour-fin', etapes: TOUR_VICTOIRE }, { id: 'coupe', etapes: victoireTournoi(true) }, { id: 'coupe2', etapes: victoireTournoi(false) }]) {
    if (sc.arene) assert.ok(ARENES.has(sc.arene), `${sc.id} : arène ${sc.arene}`);
    if (sc.acte !== undefined) assert.ok(ACTES[sc.acte], sc.id);
    for (const l of listes(sc)) for (const e of toutes(l)) {
      for (const k of ['entre', 'dit', 'sort', 'pose', 'devoile', 'debloque', 'croise', 'purifie', 'corrompt']) {
        if (e[k] !== undefined) assert.ok(e[k] === 'hero' || PERSO[e[k]], `${sc.id} : ${k} ${e[k]}`);
      }
      if (e.decor) assert.ok(ARENES.has(e.decor), `${sc.id} : décor ${e.decor}`);
      for (const d of e.decors || []) assert.ok(ARENES.has(d), `${sc.id} : souvenir ${d}`);
      for (const k of ['auraSur', 'retire']) for (const id of [e[k]].flat().filter(Boolean)) assert.ok(id === 'hero' || PERSO[id], `${sc.id} : ${k} ${id}`);
      if (e.dit) assert.ok(e.texte, `${sc.id} : une réplique sans texte`);
      if (e.choix) assert.ok(e.choix.length >= 2 && e.choix.every((c) => c.texte), `${sc.id} : un choix`);
    }
    if (sc.combat) {
      assert.ok(sc.combat.adv === 'hero' || PERSO[sc.combat.adv], `${sc.id} : ${sc.combat.adv}`);
      if (sc.combat.issue) assert.ok(sc.apresDefaite, `${sc.id} : et si on perd ?`);
      // On incarne quelqu’un d’autre : un vrai combattant ; un corrompu : jamais un soldat de l’Horloge.
      // (ou, dans un flashback, quelqu’un du passé)
      if (sc.combat.joueur) assert.ok(PERSO[sc.combat.joueur] && (PERSOS.includes(PERSO[sc.combat.joueur]) || sc.combat.regle?.startsWith('Flashback')), `${sc.id} : ${sc.combat.joueur}`);
      for (const v of sc.combat.variantes || []) assert.ok(v.si, `${sc.id} : une variante sans condition`);
      if (sc.combat.phase2) assert.ok(sc.combat.phase2.cine?.length, `${sc.id} : la phase 2 sans cinématique`);
      if (sc.combat.corrompu) assert.ok(!PERSO[sc.combat.adv]?.figurant && !sc.combat.serie, sc.id);
      // Affronter son propre héros : seulement en incarnant quelqu’un d’autre.
      if (sc.combat.adv === 'hero') assert.ok(sc.combat.joueur, sc.id);
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
    for (const v of sc.combat?.variantes || []) lus.push([sc.id, v.si]);
    if (sc.combat?.allieSi) lus.push([sc.id, sc.combat.allieSi]);
    for (const l of listes(sc)) for (const e of toutes(l)) {
      if (e.choix) for (const c of e.choix) { if (c.drapeau) leves.add(c.drapeau); for (const id of Object.keys(c.affinite || {})) leves.add(`aff_${id}`); }
      if (e.qte?.drapeau) leves.add(e.qte.drapeau);
      if (e.infiltration?.drapeau) leves.add(e.infiltration.drapeau);
      if (e.marque) leves.add(e.marque);
      if (e.si) lus.push([sc.id, e.si]);
    }
  }
  assert.ok(leves.size >= 5, 'au moins cinq décisions qui comptent');
  // Ceux que le jeu lève lui-même : la fin méritée, le mode Légende.
  for (const x of ['fin_vraie', 'fin_heroique', 'fin_solitaire', 'legende']) leves.add(x);
  for (const [id, si] of lus) for (const c of si.split('&')) {
    const nom = c.trim().replace(/^!/, '').replace(/\s*(>=|<=|>|<|==).*$/, '');
    assert.ok(leves.has(nom), `${id} : le drapeau ${nom} n’est jamais levé`);
  }
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
  // Après Kaïros : l'épilogue, la vraie fin, la scène après le générique, le super-boss caché.
  const ids = SCENES.map((sc) => sc.id);
  assert.ok(ids.indexOf('horloge') < ids.indexOf('epilogue') && ids.indexOf('epilogue') < ids.indexOf('vraie-fin') && ids.indexOf('vraie-fin') < ids.indexOf('post-generique'));
  assert.equal(SCENES.at(-1).id, 'coeur');
  assert.equal(SCENES.at(-1).si, 'fin_vraie', 'le super-boss : seulement après la vraie fin');
  assert.equal(SCENES.filter((sc) => sc.combat && !sc.si).at(-1).combat.adv, SECRETS.histoire, 'le dernier combat de tous : Kaïros');
});

test('la doublure : quel que soit le héros, personne ne se croise lui-même', () => {
  const acteurs = new Set();
  for (const sc of SCENES) {
    if (sc.combat && sc.combat.adv !== 'hero') acteurs.add(sc.combat.adv);
    for (const l of listes(sc)) for (const e of toutes(l)) for (const k of ['entre', 'dit']) if (e[k] && e[k] !== 'hero') acteurs.add(e[k]);
  }
  // La doublure a son rôle (le gardien) : dans ses scènes, aucun autre combattant de base, pour qu'elle ne croise jamais un héros qu'elle remplace.
  for (const sc of SCENES) {
    const ici = new Set();
    for (const l of listes(sc)) for (const e of toutes(l)) for (const k of ['entre', 'dit']) if (e[k] && e[k] !== 'hero') ici.add(e[k]);
    if (sc.combat && sc.combat.adv !== 'hero') ici.add(sc.combat.adv);
    if (ici.has(DOUBLURE)) for (const id of ici) assert.ok(id === DOUBLURE || !ROSTER.includes(PERSO[id]), `\${sc.id} : \${id} avec la doublure`);
  }
  assert.ok(ROSTER.some((p) => p.id === DOUBLURE));
  // Les boss et les secrets ne sont jamais le héros de l'histoire : ils peuvent garder leur rôle.
  for (const id of acteurs) assert.ok(PERSO[id], id);
});

test('la musique : chaque scène a la sienne, et chaque musique existe', () => {
  const existe = (n) => n === null || n === 'combat' || THEMES[`street-${n}`];
  for (const id of Object.keys(MUSIQUES)) assert.ok(SCENES.some((sc) => sc.id === id), `musique d’une scène inconnue : ${id}`);
  for (const sc of SCENES) {
    for (const quand of sc.combat ? ['avant', 'combat', 'apres'] : ['avant']) assert.ok(existe(musiqueDe(sc, quand)), `${sc.id} ${quand}`);
    for (const l of listes(sc)) for (const e of toutes(l)) if (e.musique !== undefined) assert.ok(existe(e.musique), `${sc.id} : ${e.musique}`);
  }
  // Kaïros : la musique du combat final ; les grands boss, la musique de boss.
  assert.equal(musiqueDe(SCENES.find((sc) => sc.id === 'horloge'), 'combat'), 'final');
  assert.equal(musiqueDe(SCENES.find((sc) => sc.id === 'trone'), 'combat'), 'boss');
});

test('les fins : la vraie se mérite, la solitaire se subit', () => {
  const bons = { kairos_main: true, kira_pardon: true, ryuken_raisonne: true, aff_ryuken: 4, aff_celestia: 2, aff_shadowkira: 3 };
  assert.equal(finDe(bons), 'vraie');
  assert.equal(finDe({ ...bons, ryuken_raisonne: false }), 'heroique');
  assert.equal(finDe({}), 'solitaire');
  assert.equal(finDe({ kairos_main: true }), 'heroique', 'tendre la main à Kaïros évite la solitude');
  // Les choix de l'histoire peuvent mener à la vraie fin : assez d'occasions de se rapprocher de chaque allié.
  const gains = {};
  for (const sc of SCENES) for (const l of listes(sc)) for (const e of toutes(l)) for (const c of e.choix || []) for (const [id, n] of Object.entries(c.affinite || {})) gains[id] = Math.max(gains[id] || 0, 0) + Math.max(0, n);
  assert.ok(ALLIES.filter((id) => (gains[id] || 0) >= 2).length >= 5, JSON.stringify(gains));
});

test('« Six éclats » : on voit le héros ramasser les éclats et se transformer, avant qu’il parle en corrompu', () => {
  const sc = SCENES.find((s) => s.id === 'tentation');
  const i = (f) => sc.etapes.findIndex(f);
  const entree = sc.etapes[i((e) => e.entre === 'hero')];
  assert.equal(entree.corrompu, false, 'il entre encore lui-même');
  const ramasse = i((e) => e.pose === 'hero' && e.p === 'accroupi');
  const change = i((e) => e.corrompt === 'hero');
  const tente = i((e) => e.dit === 'hero' && /tout arrêter/.test(e.texte));
  assert.ok(ramasse > 0 && change > ramasse && tente > change, 'il ramasse, il change, puis il parle');
  assert.ok(sc.combat.corrompu && sc.combat.adv === 'hero', 'et on le combat corrompu');
});
