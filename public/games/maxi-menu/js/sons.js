/**
 * MAXI MENU — les bruitages, synthétisés en Web Audio (aucun fichier).
 */

let ctx = null, sortie = null, bruit = null;
let actif = true;
try { actif = localStorage.getItem('maximenu.son') !== 'non'; } catch { /* rien */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    sortie = ctx.createGain();
    sortie.gain.value = 0.3;
    sortie.connect(ctx.destination);
    const n = ctx.sampleRate;
    bruit = ctx.createBuffer(1, n, n);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const sonActif = () => actif;
export function basculerSon() {
  actif = !actif;
  try { localStorage.setItem('maximenu.son', actif ? 'oui' : 'non'); } catch { /* rien */ }
  if (actif) jouer('clic');
  return actif;
}

function ton(f, dur, { type = 'sine', vol = 0.15, vers = null, t0 = 0 } = {}) {
  const t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (vers) o.frequency.exponentialRampToValueAtTime(vers, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sortie);
  o.start(t); o.stop(t + dur + 0.05);
}

function souffle(dur, { vol = 0.2, f = 1500, vers = null, t0 = 0, type = 'bandpass' } = {}) {
  const t = ctx.currentTime + t0, s = ctx.createBufferSource(), fi = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = bruit;
  fi.type = type; fi.frequency.setValueAtTime(f, t);
  if (vers) fi.frequency.exponentialRampToValueAtTime(vers, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fi).connect(g).connect(sortie);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const SONS = {
  clic: () => ton(880, 0.05, { type: 'square', vol: 0.05 }),
  dechirer: () => { souffle(0.45, { vol: 0.35, f: 600, vers: 4000 }); ton(200, 0.2, { type: 'triangle', vol: 0.08, vers: 400 }); },
  carte: () => { souffle(0.08, { vol: 0.15, f: 3000, type: 'highpass' }); ton(520, 0.08, { type: 'triangle', vol: 0.06 }); },
  commune: () => ton(660, 0.15, { type: 'triangle', vol: 0.08 }),
  rare: () => [660, 880].forEach((f, i) => ton(f, 0.2, { type: 'triangle', vol: 0.1, t0: i * 0.07 })),
  epique: () => [523, 784, 1047].forEach((f, i) => ton(f, 0.3, { type: 'triangle', vol: 0.12, t0: i * 0.08 })),
  legendaire: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => ton(f, 0.45, { type: 'triangle', vol: 0.13, t0: i * 0.09 })); souffle(0.8, { vol: 0.1, f: 5000, type: 'highpass', t0: 0.3 }); },
  mythique: () => { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => ton(f, 0.6, { type: 'sawtooth', vol: 0.07, t0: i * 0.08 })); ton(98, 1.2, { type: 'sine', vol: 0.2 }); souffle(1.2, { vol: 0.14, f: 6000, type: 'highpass', t0: 0.4 }); },
  pieces: () => [1320, 1760, 2093].forEach((f, i) => ton(f, 0.12, { type: 'triangle', vol: 0.06, t0: i * 0.06 })),
  achat: () => { ton(440, 0.1, { type: 'square', vol: 0.05 }); ton(880, 0.15, { type: 'square', vol: 0.05, t0: 0.08 }); },
  refus: () => ton(160, 0.2, { type: 'square', vol: 0.06 }),
};

export function jouer(nom) {
  if (!actif || !SONS[nom] || !ac()) return;
  try { SONS[nom](); } catch { /* un son raté ne casse rien */ }
}
export const debloquer = () => { if (actif) ac(); };
