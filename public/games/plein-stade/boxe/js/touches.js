/**
 * CROCHET — les touches du clavier, au choix du joueur (comme le basket : basket/js/touches.js).
 *
 * Une touche par action, gardées
 * d'une fois sur l'autre. On les change dans le tableau des commandes : un
 * clic sur la touche, puis on appuie sur la nouvelle. Une touche déjà prise
 * passe à l'action qu'on vient de quitter (les deux s'échangent). Les flèches
 * font toujours bouger, en plus. Échap et P restent la pause.
 *
 * Les touches sont lues par leur place sur le clavier (e.code) : le nom
 * affiché vient de la disposition du clavier quand le navigateur la donne
 * (AZERTY : la touche KeyW s'appelle Z).
 */

import { T } from '../../../../shared/boxe/terrain.js';

const CLE = 'crochet.touches';

/** [action, libellé, bit, touche par défaut] */
export const ACTIONS = [
  ['haut', 'Monter', T.h, 'KeyW'],
  ['bas', 'Descendre (et viser le corps)', T.b, 'KeyS'],
  ['gauche', 'Gauche', T.g, 'KeyA'],
  ['droite', 'Droite', T.d, 'KeyD'],
  ['jab', 'Jab', T.A, 'KeyJ'],
  ['crochet', 'Crochet', T.B, 'KeyK'],
  ['upper', 'Uppercut', T.X, 'KeyL'],
  ['garde', 'Garde', T.G, 'Space'],
  ['esquive', 'Esquive', T.S, 'ShiftLeft'],
];
const DEFAUT = Object.fromEntries(ACTIONS.map(([a, , , c]) => [a, c]));
const RESERVEES = ['Escape', 'KeyP'];
const FLECHES = { ArrowUp: T.h, ArrowDown: T.b, ArrowLeft: T.g, ArrowRight: T.d };

let choix = { ...DEFAUT };
let noms = {};
try {
  const s = JSON.parse(localStorage.getItem(CLE) || 'null');
  if (s?.touches) for (const [a] of ACTIONS) if (typeof s.touches[a] === 'string') choix[a] = s.touches[a];
  if (s?.noms) noms = s.noms;
} catch { /* ignore */ }
const garder = () => { try { localStorage.setItem(CLE, JSON.stringify({ touches: choix, noms })); } catch { /* ignore */ } };

// La disposition du clavier (Chrome, Edge) : pour afficher Z et non W sur un clavier français.
let disposition = null;
const pret = navigator.keyboard?.getLayoutMap?.().then((m) => { disposition = m; }).catch(() => {}) ?? Promise.resolve();

const SPECIALES = {
  Space: 'Espace', ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droite',
  AltLeft: 'Alt', AltRight: 'Alt Gr', Enter: 'Entrée', Tab: 'Tab', Backspace: '⌫', CapsLock: 'Verr. maj',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
/** Le nom d'une touche, comme il est écrit dessus. */
export function nomTouche(code) {
  if (SPECIALES[code]) return SPECIALES[code];
  const d = disposition?.get(code);
  if (d) return d.toUpperCase();
  if (noms[code]) return noms[code];
  return code.replace(/^Key|^Digit|^Numpad/, '');
}

/** La table { code: bit } pour commun/saisie.js. */
export function table() {
  const t = { ...FLECHES };
  for (const [a, , bit] of ACTIONS) t[choix[a]] = bit;
  return t;
}

export const toucheDe = (a) => choix[a];

/** Donne la touche `code` à l'action `a` ; si une autre action l'avait, elle prend l'ancienne touche de `a`. */
export function changer(a, code, nom = '') {
  if (RESERVEES.includes(code)) return false;
  const autre = ACTIONS.find(([x]) => x !== a && choix[x] === code);
  if (autre) choix[autre[0]] = choix[a];
  choix[a] = code;
  if (nom && nom.length === 1) noms[code] = nom.toUpperCase();
  garder();
  return true;
}

export function parDefaut() {
  choix = { ...DEFAUT };
  garder();
}

export { pret };
