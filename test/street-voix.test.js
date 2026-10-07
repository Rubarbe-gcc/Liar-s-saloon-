/**
 * STREET COMBAT — les voix : chacun la sienne, et le ton suit le texte.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PERSOS, FIGURANTS } from '../public/shared/street/persos.js';
import { construireHeros, defautHeros } from '../public/shared/street/heros.js';
import { VOIX, voixDe, genreDe, intonations, reglage, choisirVoix, hauteurNaturelle } from '../public/games/street-combat/js/voix.js';

test('chaque combattant a sa voix, le narrateur et l’annonceur aussi', () => {
  for (const p of [...PERSOS, ...FIGURANTS]) {
    const v = VOIX[p.id];
    assert.ok(v && ['h', 'f'].includes(v.genre) && v.hauteur > 0 && v.vitesse > 0, p.id);
  }
  assert.ok(VOIX.narrateur && VOIX.annonceur);
  for (const id of ['shadowkira', 'serpenta', 'lunara', 'celestia', 'sablia', 'eclipse']) assert.equal(genreDe({ id }), 'f', id);
  // Les plus terribles parlent le plus grave.
  assert.ok(VOIX.lechaos.hauteur < VOIX.ryuken.hauteur && VOIX.malvortex.hauteur < VOIX.celestia.hauteur);
});

test('l’intonation : cri, exclamation, question, suspens, chuchotement', () => {
  const m = intonations('Hé… je respire encore. LE TONNERRE A PARLÉ ! (Elle a hésité.) Tu viens ? « Cent un K.O. » 🏆');
  const [suspens, normal, cri, chuchote, question] = m;
  assert.ok(suspens.suspens && !normal.suspens);
  assert.ok(cri.cri && cri.exclamation && cri.texte === cri.texte.toLowerCase(), 'un cri ne s’épelle pas lettre à lettre');
  assert.ok(chuchote.chuchote && !chuchote.texte.includes('('));
  assert.ok(question.question);
  assert.ok(m.every((x) => !/[«»🏆]/u.test(x.texte)), 'ni guillemets ni emojis à voix haute');
  const voix = { hauteur: 1, vitesse: 1 };
  const base = reglage(normal, voix);
  assert.ok(reglage(cri, voix).hauteur > base.hauteur && reglage(cri, voix).vitesse > base.vitesse);
  assert.ok(reglage(suspens, voix).vitesse < base.vitesse);
  assert.ok(reglage(chuchote, voix).volume < base.volume);
  assert.ok(reglage(normal, voix, { corrompu: true }).hauteur < base.hauteur, 'corrompu : plus grave');
});

test('le héros créé : homme ou femme, une voix grave ou aiguë, masculine ou féminine', () => {
  const h = construireHeros(defautHeros());
  assert.equal(h.genre, 'h');
  assert.equal(voixDe(h), h.voix);
  assert.equal(h.voix.genre, 'h');
  const f = construireHeros({ ...defautHeros(), genre: 'f' });
  assert.equal(f.genre, 'f');
  assert.equal(f.voix.genre, 'f', 'une femme a d’abord une voix féminine');
  // On peut tout de même lui donner une voix masculine, ou l'inverse.
  assert.equal(construireHeros({ genre: 'f', voixTimbre: 0.1 }).voix.genre, 'h');
  assert.equal(construireHeros({ genre: 'h', voixTimbre: 0.9 }).voix.genre, 'f');
  // Grave ou aiguë.
  assert.ok(construireHeros({ voixHauteur: 1.6 }).voix.hauteur > construireHeros({ voixHauteur: 0.5 }).voix.hauteur);
  assert.ok(construireHeros({ voixHauteur: 99 }).voix.hauteur <= 2.1);
});

test('pas de voix robotique : les voix naturelles d’abord, une hauteur proche du naturel', () => {
  const voix = [
    { name: 'Microsoft Paul - French (France)', lang: 'fr-FR' },
    { name: 'Microsoft Hortense - French (France)', lang: 'fr-FR' },
    { name: 'Google français', lang: 'fr-FR', localService: false },
    { name: 'Microsoft Henri Online (Natural) - French (France)', lang: 'fr-FR' },
  ];
  assert.match(choisirVoix('h', voix).voix.name, /Henri Online/);
  assert.match(choisirVoix('f', voix).voix.name, /Google/);
  // Sans voix naturelle d'homme, la voix naturelle de femme, un peu plus grave, plutôt qu'une voix robotique.
  const r = choisirVoix('h', voix.slice(0, 3));
  assert.match(r.voix.name, /Google/);
  assert.ok(r.correction < 1 && r.correction > 0.75);
  for (const p of [...PERSOS, ...FIGURANTS]) {
    const h = hauteurNaturelle(VOIX[p.id].hauteur);
    assert.ok(h >= 0.72 && h <= 1.32, `${p.id} : hauteur ${h}`);
  }
});
