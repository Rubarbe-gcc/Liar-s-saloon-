/**
 * PETIT PONT — les commandes : clavier, manette, écran tactile.
 *
 * Tout finit en un nombre de 8 bits (shared/foot/terrain.js, T), le même que
 * celui que lit le moteur et qui part sur le réseau :
 *   directions g, d, h, b ; S sprint ; A passe / changer ; B tir / tacle ; X lob / pressing.
 *
 * Clavier : flèches ou ZQSD/WASD ; J (ou C) passe, K (ou X) tir, L (ou V) lob, Maj sprint.
 * Manette : stick gauche ou croix ; A passe, B tir, X lob, gâchettes sprint, LB changer.
 * Tactile : un joystick à gauche (là où le doigt se pose), quatre boutons à droite.
 */

import { T } from '../../../shared/foot/terrain.js';

const touches = new Set();
const CLAVIER = {
  ArrowLeft: T.g, KeyA: T.g, KeyQ: T.g,
  ArrowRight: T.d, KeyD: T.d,
  ArrowUp: T.h, KeyW: T.h, KeyZ: T.h,
  ArrowDown: T.b, KeyS: T.b,
  ShiftLeft: T.S, ShiftRight: T.S,
  KeyO: T.A, KeyJ: T.A, KeyC: T.A, Space: T.A,
  KeyK: T.B, KeyX: T.B,
  KeyL: T.X, KeyV: T.X,
};

let actif = false;
let surPause = null;
export function ecouterClavier(pause) {
  surPause = pause;
  if (actif) return;
  actif = true;
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { surPause?.(); return; }
    if (CLAVIER[e.code] === undefined) return;
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    touches.add(e.code);
    if (jeuEnCours()) e.preventDefault();
  });
  addEventListener('keyup', (e) => touches.delete(e.code));
  addEventListener('blur', () => touches.clear());
}
let jeuEnCours = () => false;
export function siJeuEnCours(f) { jeuEnCours = f; }

/* ---------------- Le tactile ---------------- */
const tactile = { mx: 0, my: 0, boutons: 0, id: null, ox: 0, oy: 0 };
let elJoy = null, elBouton = null;

/** Branche les commandes tactiles : la zone du joystick et les boutons [data-t]. */
export function brancherTactile(zone, boutons) {
  elJoy = zone.querySelector('.joy');
  elBouton = zone.querySelector('.joy-bouton');
  zone.addEventListener('pointerdown', (e) => {
    if (tactile.id !== null) return;
    tactile.id = e.pointerId;
    const r = zone.getBoundingClientRect();
    tactile.ox = e.clientX; tactile.oy = e.clientY;
    if (elJoy) { elJoy.style.left = `${e.clientX - r.left}px`; elJoy.style.top = `${e.clientY - r.top}px`; elJoy.classList.add('actif'); }
    zone.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== tactile.id) return;
    const dx = e.clientX - tactile.ox, dy = e.clientY - tactile.oy;
    const d = Math.hypot(dx, dy), max = 46;
    const k = d > max ? max / d : 1;
    if (elBouton) elBouton.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    tactile.mx = d > 12 ? dx / Math.max(d, max) : 0;
    tactile.my = d > 12 ? -dy / Math.max(d, max) : 0;
  });
  const fin = (e) => {
    if (e.pointerId !== tactile.id) return;
    tactile.id = null; tactile.mx = 0; tactile.my = 0;
    if (elBouton) elBouton.style.transform = '';
    elJoy?.classList.remove('actif');
  };
  zone.addEventListener('pointerup', fin);
  zone.addEventListener('pointercancel', fin);
  for (const b of boutons) {
    const bit = T[b.dataset.t];
    const lacher = () => { tactile.boutons &= ~bit; b.classList.remove('appuye'); };
    b.addEventListener('pointerdown', (e) => { tactile.boutons |= bit; b.classList.add('appuye'); b.setPointerCapture(e.pointerId); e.preventDefault(); navigator.vibrate?.(8); });
    b.addEventListener('pointerup', lacher);
    b.addEventListener('pointercancel', lacher);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

/* ---------------- La manette ---------------- */
let pauseManette = false;
function manette() {
  let m = 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const btn = (i) => !!p.buttons[i]?.pressed;
    if (ax < -0.35 || btn(14)) m |= T.g;
    if (ax > 0.35 || btn(15)) m |= T.d;
    if (ay < -0.35 || btn(12)) m |= T.h;
    if (ay > 0.35 || btn(13)) m |= T.b;
    if (btn(0)) m |= T.A;
    if (btn(1)) m |= T.B;
    if (btn(2) || btn(3)) m |= T.X;
    if (btn(5) || btn(6) || btn(7)) m |= T.S;
    if (btn(4)) m |= T.A;
    const start = btn(9);
    if (start && !pauseManette) surPause?.();
    pauseManette = start;
  }
  return m;
}

/** Les touches du joueur, maintenant. */
export function lire() {
  let m = 0;
  for (const c of touches) m |= CLAVIER[c] || 0;
  // Le joystick tactile : huit directions (comme le clavier ; c'est aussi ce qui part en ligne).
  if (tactile.mx || tactile.my) {
    const a = Math.atan2(tactile.my, tactile.mx);
    const s = Math.round(a / (Math.PI / 4));
    const dirs = [T.d, T.d | T.h, T.h, T.h | T.g, T.g, T.g | T.b, T.b, T.b | T.d];
    m |= dirs[(s + 8) % 8];
  }
  m |= tactile.boutons;
  m |= manette();
  // Gauche et droite à la fois : rien.
  if ((m & T.g) && (m & T.d)) m &= ~(T.g | T.d);
  if ((m & T.h) && (m & T.b)) m &= ~(T.h | T.b);
  return m;
}

export const aUneManette = () => [...(navigator.getGamepads?.() || [])].some(Boolean);
export const estTactile = () => matchMedia('(pointer: coarse)').matches;
