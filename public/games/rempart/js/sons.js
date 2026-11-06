/**
 * REMPART — les bruitages, synthétisés en Web Audio (aucun fichier).
 * Chaque son a un petit délai minimal entre deux lectures, pour que trente
 * tours qui tirent ensemble ne fassent pas un mur de bruit.
 */

import { THEMES, installerMusique } from '../../../shared/musique.js';

let ctx = null, sortie = null, bruit = null;
const reglages = { son: true, musique: true };
try { Object.assign(reglages, JSON.parse(localStorage.getItem('rempart.son') || '{}')); } catch { /* rien */ }
let muet = false; // la démo du menu ne fait pas de bruit
const dernier = {};

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sortie = ctx.createGain();
    sortie.gain.value = 0.32;
    const comp = ctx.createDynamicsCompressor();
    sortie.connect(comp).connect(ctx.destination);
    const n = ctx.sampleRate;
    bruit = ctx.createBuffer(1, n, n);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const reglage = k => reglages[k];
export function basculer(k) {
  reglages[k] = !reglages[k];
  try { localStorage.setItem('rempart.son', JSON.stringify(reglages)); } catch { /* rien */ }
  if (k === 'son' && reglages.son) jouer('clic');
  return reglages[k];
}
export const debloquer = () => { if (reglages.son || reglages.musique) ac(); };
export const rendreMuet = m => { muet = m; };

function ton(f, dur, { type = 'sine', vol = 0.2, vers = null, t0 = 0, attaque = 0.005, filtre = 0 } = {}) {
  const t = ctx.currentTime + t0;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (vers) o.frequency.exponentialRampToValueAtTime(vers, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = o;
  if (filtre) { const fi = ctx.createBiquadFilter(); fi.type = 'lowpass'; fi.frequency.value = filtre; o.connect(fi); n = fi; }
  n.connect(g).connect(sortie);
  o.start(t); o.stop(t + dur + 0.05);
}

function souffle(dur, { vol = 0.2, f = 1200, q = 0.8, type = 'lowpass', vers = null, t0 = 0 } = {}) {
  const t = ctx.currentTime + t0;
  const s = ctx.createBufferSource(), fi = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = bruit;
  fi.type = type; fi.frequency.setValueAtTime(f, t); fi.Q.value = q;
  if (vers) fi.frequency.exponentialRampToValueAtTime(vers, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fi).connect(g).connect(sortie);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const SONS = {
  clic: () => ton(900, 0.05, { type: 'square', vol: 0.06 }),
  rafale: () => { souffle(0.05, { vol: 0.12, f: 3000, type: 'highpass' }); ton(520 + Math.random() * 80, 0.05, { type: 'square', vol: 0.04, vers: 300 }); },
  mortier: () => { ton(140, 0.25, { vol: 0.3, vers: 45 }); souffle(0.18, { vol: 0.15, f: 500 }); },
  explosion: () => { souffle(0.6, { vol: 0.35, f: 900, vers: 120 }); ton(70, 0.4, { vol: 0.3, vers: 30 }); },
  givre: () => { ton(1700, 0.25, { vol: 0.05, vers: 2400 }); ton(2550, 0.2, { vol: 0.03, t0: 0.03 }); },
  gel: () => { souffle(0.25, { vol: 0.08, f: 5000, type: 'highpass' }); ton(3000, 0.15, { vol: 0.025 }); },
  perce: () => { ton(900, 0.18, { type: 'sawtooth', vol: 0.06, vers: 160, filtre: 2500 }); souffle(0.12, { vol: 0.1, f: 2000, type: 'bandpass', q: 2 }); },
  impactLourd: () => ton(180, 0.12, { type: 'square', vol: 0.06, vers: 90, filtre: 900 }),
  foudre: () => { souffle(0.22, { vol: 0.2, f: 2500, type: 'bandpass', q: 0.7 }); ton(120, 0.2, { type: 'sawtooth', vol: 0.06, vers: 60, filtre: 1600 }); },
  flamme: () => { souffle(0.35, { vol: 0.16, f: 700, vers: 1800, q: 0.5 }); souffle(0.25, { vol: 0.06, f: 3000, type: 'highpass' }); },
  bouclier: () => { ton(880, 0.35, { type: 'sine', vol: 0.04, vers: 1320 }); ton(1320, 0.3, { type: 'sine', vol: 0.03, t0: 0.05 }); },
  fouit: () => { souffle(0.4, { vol: 0.12, f: 300, vers: 120 }); ton(90, 0.3, { type: 'triangle', vol: 0.06, vers: 50 }); },
  ting: () => ton(1400, 0.05, { type: 'triangle', vol: 0.03 }),
  mort: () => { ton(320 + Math.random() * 120, 0.12, { type: 'triangle', vol: 0.08, vers: 90 }); souffle(0.1, { vol: 0.06, f: 1500 }); },
  piece: () => { ton(1320, 0.08, { type: 'triangle', vol: 0.05 }); ton(1760, 0.12, { type: 'triangle', vol: 0.05, t0: 0.05 }); },
  division: () => { ton(500, 0.15, { type: 'sine', vol: 0.1, vers: 900 }); souffle(0.12, { vol: 0.08, f: 800 }); },
  soin: () => ton(660, 0.3, { type: 'sine', vol: 0.03, vers: 990 }),
  fuite: () => { ton(220, 0.3, { type: 'square', vol: 0.08, filtre: 800 }); ton(165, 0.4, { type: 'square', vol: 0.08, t0: 0.18, filtre: 800 }); },
  construit: () => { souffle(0.08, { vol: 0.15, f: 700 }); ton(440, 0.1, { type: 'triangle', vol: 0.08, t0: 0.06 }); ton(660, 0.18, { type: 'triangle', vol: 0.08, t0: 0.14 }); },
  ameliore: () => [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.2, { type: 'triangle', vol: 0.07, t0: i * 0.07 })),
  vendu: () => [880, 660, 440].forEach((f, i) => ton(f, 0.12, { type: 'triangle', vol: 0.06, t0: i * 0.06 })),
  refus: () => ton(150, 0.15, { type: 'square', vol: 0.06, filtre: 600 }),
  vague: () => { ton(196, 0.5, { type: 'sawtooth', vol: 0.08, filtre: 900, attaque: 0.05 }); ton(294, 0.7, { type: 'sawtooth', vol: 0.08, filtre: 1100, t0: 0.35, attaque: 0.05 }); },
  boss: () => { ton(55, 1.6, { type: 'sawtooth', vol: 0.16, vers: 40, filtre: 400, attaque: 0.2 }); souffle(1.4, { vol: 0.12, f: 300, vers: 80 }); },
  bossMort: () => { souffle(1.4, { vol: 0.4, f: 1200, vers: 60 }); ton(60, 1.2, { vol: 0.35, vers: 25 }); [392, 523, 659].forEach((f, i) => ton(f, 0.5, { type: 'triangle', vol: 0.06, t0: 0.4 + i * 0.1 })); },
  victoire: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => ton(f, i > 4 ? 0.6 : 0.22, { type: 'triangle', vol: 0.09, t0: i * 0.13 })),
  defaite: () => [392, 349, 311, 233].forEach((f, i) => ton(f, 0.6, { type: 'sawtooth', vol: 0.06, t0: i * 0.3, filtre: 900 })),
  etoile: () => { ton(1047, 0.3, { type: 'triangle', vol: 0.08 }); ton(1568, 0.4, { type: 'sine', vol: 0.05, t0: 0.05 }); },
};

/** Délai minimal entre deux lectures du même son (en secondes). */
const ECART = { flamme: 0.12, bouclier: 0.3, fouit: 0.2, rafale: 0.06, mortier: 0.1, explosion: 0.08, givre: 0.08, gel: 0.1, perce: 0.08, foudre: 0.08, ting: 0.05, mort: 0.04, piece: 0.07, soin: 0.3, impactLourd: 0.07 };

export function jouer(nom) {
  if (!reglages.son || muet || !SONS[nom] || !ac()) return;
  const now = ctx.currentTime;
  if (now - (dernier[nom] ?? -9) < (ECART[nom] ?? 0.03)) return;
  dernier[nom] = now;
  try { SONS[nom](); } catch { /* un son raté ne casse pas la partie */ }
}

/* La musique : une ballade de vallée, et un thème plus sombre quand un boss est là. */
const _ = null;
THEMES.rempart = {
  bpm: 92, pas: 8, ton: 196, volume: 0.06,
  onde: 'triangle', tenue: 1.8, filtre: 1800, nappe: 0.4,
  accords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-8, -5, -1], [-5, -1, 2]],
  basse: [0, _, 2, _, 1, _, 2, _],
  batterie: 'k...h.k.',
  melodie: [
    [7, _, 9, _, 11, _, 12, _], [9, _, 7, _, 4, _, _, _], [5, _, 4, _, 2, _, 0, _], [2, _, _, 4, 7, _, _, _],
    [12, _, 11, _, 9, _, 7, _], [9, _, 12, _, 16, _, 14, _], [12, _, 11, _, 9, _, 11, _], [7, _, _, _, _, _, _, _],
  ],
};
THEMES['rempart-boss'] = {
  bpm: 132, pas: 8, ton: 146.83, volume: 0.065,
  onde: 'sawtooth', tenue: 1.2, filtre: 1500, nappe: 0.45,
  accords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7], [1, 5, 8], [-4, 0, 3], [-5, -1, 2]],
  basse: [0, 0, 2, 0, 0, 2, 0, 1],
  batterie: 'k.s.kks.',
  melodie: [
    [12, _, 15, _, 14, _, 12, _], [10, _, 12, _, _, _, 7, _], [8, _, 7, _, 8, _, 10, _], [7, _, _, _, _, _, _, _],
    [12, _, 15, _, 17, _, 19, _], [20, _, 19, _, 17, _, 15, _], [15, _, 14, _, 12, _, 10, _], [11, _, _, _, 7, _, _, _],
  ],
};

/** `theme()` rend 'rempart', 'rempart-boss' ou null. */
export function installer(theme) {
  installerMusique('rempart', { actif: () => reglages.musique, theme });
}
