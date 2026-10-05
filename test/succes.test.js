/**
 * Le profil et les succès de l'arcade (public/shared/succes.js).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Un localStorage de poche : le module s'en sert comme dans le navigateur.
const magasin = new Map();
globalThis.localStorage = {
  getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
  setItem: (k, v) => magasin.set(k, String(v)),
  removeItem: (k) => magasin.delete(k),
};

const S = await import('../public/shared/succes.js');

test('le catalogue : des identifiants uniques, un jeu connu, un texte chacun', () => {
  assert.equal(new Set(S.SUCCES.map((x) => x.id)).size, S.SUCCES.length);
  for (const x of S.SUCCES) {
    assert.ok(S.JEUX[x.jeu], x.id);
    assert.ok(x.titre && x.texte && x.glyphe, x.id);
  }
  for (const jeu of Object.keys(S.JEUX)) assert.ok(S.succesDe(jeu).length >= 2, jeu);
});

test('un succès se débloque une fois, et se garde', () => {
  magasin.clear();
  assert.equal(S.estDebloque('saloon-premiere'), false);
  assert.equal(S.debloquer('saloon-premiere'), true);
  assert.equal(S.debloquer('saloon-premiere'), false, 'pas deux fois');
  assert.equal(S.debloquer('n-existe-pas'), false);
  assert.equal(S.total().faits, 1);
  assert.ok(S.succesDe('saloon').find((x) => x.id === 'saloon-premiere').quand);
});

test('le pseudo débloque « Une identité » ; ouvrir les six jeux, « Touche-à-tout »', () => {
  magasin.clear();
  S.definirProfil({ pseudo: '  Rubarbe <b> ', avatar: '🦊' });
  assert.equal(S.pseudo(), 'Rubarbe b');
  assert.equal(S.profil().avatar, '🦊');
  assert.ok(S.estDebloque('arcade-profil'));
  for (const j of ['saloon', 'zenith', 'raid', 'brasier', 'skullking']) S.visiter(j);
  assert.equal(S.estDebloque('arcade-explorateur'), false);
  S.visiter('echo');
  assert.ok(S.estDebloque('arcade-explorateur'));
});
