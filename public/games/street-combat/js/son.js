/**
 * STREET COMBAT — les bruitages, faits main (Web Audio) : coups secs,
 * impacts sourds, souffles, explosions. Aucun fichier à charger.
 */

let ctx = null;
let maitre = null;
let bruitBlanc = null;
let muet = false;
try { muet = localStorage.getItem('street.muet') === '1'; } catch { /* ignore */ }

export const estMuet = () => muet;
export function basculerSon() {
  muet = !muet;
  try { localStorage.setItem('street.muet', muet ? '1' : '0'); } catch { /* ignore */ }
  return muet;
}

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    maitre = ctx.createGain();
    maitre.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    maitre.connect(comp).connect(ctx.destination);
    const n = ctx.sampleRate;
    bruitBlanc = ctx.createBuffer(1, n, n);
    const d = bruitBlanc.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function ton(f, duree, type = 'square', vol = 0.15, glisse = 0, retard = 0) {
  const a = audio();
  const t = a.currentTime + retard;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glisse), t + duree);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(maitre);
  o.start(t);
  o.stop(t + duree + 0.02);
}

function bruit(duree, vol = 0.3, filtre = 1200, type = 'lowpass', glisse = 0, retard = 0) {
  const a = audio();
  const t = a.currentTime + retard;
  const s = a.createBufferSource();
  s.buffer = bruitBlanc;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filtre, t);
  if (glisse) f.frequency.exponentialRampToValueAtTime(Math.max(40, filtre * glisse), t + duree);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  s.connect(f).connect(g).connect(maitre);
  s.start(t, Math.random() * 0.5);
  s.stop(t + duree + 0.02);
}

const SONS = {
  fouet: () => bruit(0.08, 0.12, 3000, 'bandpass', 0.4),
  'fouet-lourd': () => bruit(0.12, 0.16, 1800, 'bandpass', 0.4),
  impact: () => { bruit(0.1, 0.4, 900); ton(140, 0.08, 'square', 0.12, 0.5); },
  'impact-lourd': () => { bruit(0.18, 0.55, 700, 'lowpass', 0.3); ton(90, 0.16, 'sawtooth', 0.18, 0.4); },
  garde: () => { ton(900, 0.05, 'square', 0.07); bruit(0.05, 0.15, 4000, 'highpass'); },
  saut: () => ton(380, 0.08, 'sine', 0.06, 1.6),
  atterrit: () => bruit(0.06, 0.12, 400),
  chute: () => { bruit(0.25, 0.4, 300, 'lowpass', 0.4); ton(70, 0.2, 'sine', 0.2, 0.6); },
  specB: () => { ton(220, 0.25, 'sawtooth', 0.12, 2.2); bruit(0.25, 0.2, 1500, 'bandpass', 2); },
  specA: () => { ton(160, 0.4, 'sawtooth', 0.14, 3); ton(320, 0.4, 'square', 0.06, 3); bruit(0.4, 0.2, 800, 'bandpass', 3); },
  combo: () => { ton(520, 0.06, 'square', 0.08); ton(780, 0.08, 'square', 0.08, 1, 0.05); },
  saisie: () => { bruit(0.1, 0.3, 600); ton(200, 0.12, 'square', 0.1, 0.6); },
  contre: () => { ton(1200, 0.1, 'square', 0.1, 0.5); ton(1800, 0.15, 'sine', 0.08, 0.5, 0.05); },
  annule: () => { bruit(0.3, 0.4, 2000, 'bandpass', 0.2); ton(600, 0.2, 'sine', 0.1, 0.3); },
  rate: () => ton(300, 0.15, 'sine', 0.06, 0.6),
  ulti: () => { ton(55, 1.2, 'sawtooth', 0.2, 4); ton(110, 1.2, 'square', 0.08, 4); bruit(1.2, 0.3, 300, 'lowpass', 8); },
  boum: () => { bruit(0.9, 0.8, 900, 'lowpass', 0.08); ton(50, 0.8, 'sine', 0.35, 0.4); },
  ko: () => { ton(110, 1, 'sawtooth', 0.18, 0.25); bruit(1, 0.45, 600, 'lowpass', 0.1); },
  tic: () => ton(880, 0.04, 'square', 0.05),
  choix: () => { ton(660, 0.05, 'square', 0.06); ton(990, 0.07, 'square', 0.06, 1, 0.04); },
  valide: () => { ton(523, 0.08, 'square', 0.08); ton(784, 0.12, 'square', 0.08, 1, 0.07); ton(1046, 0.18, 'square', 0.08, 1, 0.14); },
  annonce: () => { ton(196, 0.3, 'sawtooth', 0.1); ton(294, 0.35, 'sawtooth', 0.08, 1, 0.08); },
  victoire: () => [523, 659, 784, 1046, 1318].forEach((f, k) => ton(f, 0.25, 'triangle', 0.12, 1, k * 0.11)),
};

export function jouer(nom) {
  if (muet || !SONS[nom]) return;
  try { SONS[nom](); } catch { /* pas de son */ }
}
