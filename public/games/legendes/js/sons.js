/**
 * LÉGENDES — les sons, fabriqués à la volée (Web Audio) : le portail, les tintements des sphères (plus aigus
 * pour les raretés hautes), l'éclat, la révélation, les coups, les super attaques, la victoire.
 */

let ctx = null;
let muet = false;
try { muet = localStorage.getItem('legendes.muet') === '1'; } catch { /* ignore */ }
export const estMuet = () => muet;
export function basculer() { muet = !muet; try { localStorage.setItem('legendes.muet', muet ? '1' : '0'); } catch { /* ignore */ } return muet; }

function audio() {
  if (muet) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const reveiller = () => audio();

function ton(f, duree, { type = 'sine', vol = 0.15, glisse = 0, delai = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delai;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + glisse), t + duree);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + duree + 0.02);
}
function bruit(duree, { vol = 0.2, freq = 800, delai = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delai;
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * duree), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}

export const bip = () => ton(880, 0.06, { type: 'square', vol: 0.05 });
export const portail = () => { ton(110, 2.2, { type: 'sawtooth', vol: 0.06, glisse: 220 }); ton(220, 2.2, { vol: 0.05, glisse: 440 }); };
export const tinte = (k) => ton(660 * 2 ** (k / 3), 0.4, { vol: 0.08 + k * 0.03 });
export function eclat(rar) {
  bruit(1, { vol: 0.25, freq: 4000 });
  const notes = rar === 'LR' ? [523, 659, 784, 1047, 1319] : rar === 'SSR' ? [523, 659, 784, 1047] : [523, 659, 784];
  notes.forEach((f, i) => ton(f, 0.6, { type: 'triangle', vol: 0.12, delai: i * 0.08 }));
}
export const revele = (rar) => { const base = rar === 'LR' ? 784 : rar === 'SSR' ? 659 : 523; [1, 1.25, 1.5, 2].forEach((k, i) => ton(base * k, 0.5, { type: 'triangle', vol: 0.1, delai: i * 0.07 })); };
export const coup = () => { bruit(0.12, { vol: 0.3, freq: 1500 }); ton(140, 0.12, { type: 'triangle', vol: 0.2, glisse: -60 }); };
export const lame = () => bruit(0.18, { vol: 0.22, freq: 6000 });
export const sphere = () => ton(990, 0.12, { vol: 0.07, glisse: 400 });
export function superDebut(ultime) { ton(80, ultime ? 1.6 : 1.1, { type: 'sawtooth', vol: 0.12, glisse: 400 }); bruit(ultime ? 1.4 : 1, { vol: 0.12, freq: 1200 }); }
export const impact = (fort) => { bruit(0.6, { vol: fort ? 0.5 : 0.35, freq: 900 }); ton(60, 0.5, { type: 'sine', vol: 0.4, glisse: -30 }); };
export const blesse = () => { bruit(0.15, { vol: 0.18, freq: 700 }); ton(200, 0.15, { type: 'square', vol: 0.06, glisse: -100 }); };
export const victoire = () => [523, 659, 784, 1047, 1319].forEach((f, i) => ton(f, 0.5, { type: 'triangle', vol: 0.12, delai: i * 0.11 }));
export const defaite = () => [392, 330, 262].forEach((f, i) => ton(f, 0.6, { type: 'triangle', vol: 0.1, delai: i * 0.2 }));
export const alerte = () => { for (let k = 0; k < 3; k++) ton(440, 0.18, { type: 'square', vol: 0.07, delai: k * 0.3 }); ton(70, 1.2, { type: 'sawtooth', vol: 0.1, glisse: 60 }); };
