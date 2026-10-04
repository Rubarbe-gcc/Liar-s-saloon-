/**
 * SKULL KING — bruitages synthétisés (Web Audio). Aucun fichier audio.
 */

let ctx = null, master = null, actif = true;
try { actif = localStorage.getItem('skullking.son') !== 'off'; } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const sonActif = () => actif;
export function basculer() {
  actif = !actif;
  try { localStorage.setItem('skullking.son', actif ? 'on' : 'off'); } catch { /* ignore */ }
  if (actif) { ac(); ton(660, 0.1, 'triangle', 0.2); }
  return actif;
}

function ton(freq, dur, type = 'sine', vol = 0.25, glisse = null, retard = 0) {
  const c = ac(); if (!c || !actif) return;
  const t0 = c.currentTime + retard;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(1, glisse), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function souffle(dur, type, freq, vol, retard = 0, vers = null) {
  const c = ac(); if (!c || !actif) return;
  const t0 = c.currentTime + retard;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0);
  if (vers) f.frequency.exponentialRampToValueAtTime(vers, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t0);
}

export const sfx = {
  clic: () => ton(520, 0.06, 'triangle', 0.12),
  /** Une carte claque sur le bois. */
  carte: () => { souffle(0.09, 'bandpass', 2400, 0.35, 0, 900); ton(180, 0.08, 'sine', 0.12, 90); },
  donne: () => souffle(0.06, 'highpass', 3000, 0.18),
  /** Les paris se révèlent : deux coups de tambour. */
  pari: () => { ton(110, 0.18, 'sine', 0.4, 60); ton(110, 0.18, 'sine', 0.35, 60, 0.18); souffle(0.12, 'lowpass', 400, 0.25, 0.18); },
  /** On ramasse un pli. */
  pli: () => { [784, 988, 1175].forEach((f, i) => ton(f, 0.22, 'triangle', 0.14, null, i * 0.07)); },
  pliAutre: () => ton(392, 0.16, 'triangle', 0.1),
  bonus: () => { [1047, 1319, 1568, 2093].forEach((f, i) => ton(f, 0.18, 'square', 0.06, null, i * 0.06)); },
  kraken: () => { ton(70, 0.9, 'sawtooth', 0.25, 35); souffle(0.9, 'lowpass', 300, 0.3, 0, 80); },
  baleine: () => { ton(240, 1.1, 'sine', 0.18, 140); ton(320, 0.9, 'sine', 0.1, 180, 0.2); },
  tenu: () => { [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.25, 'triangle', 0.14, null, i * 0.09)); },
  rate: () => { ton(330, 0.3, 'sawtooth', 0.1, 220); ton(247, 0.4, 'sawtooth', 0.1, 160, 0.2); },
  fin: () => { [392, 523, 659, 784, 659, 1047].forEach((f, i) => ton(f, 0.3, 'triangle', 0.15, null, i * 0.13)); },
};

export function deverrouiller() { if (actif) ac(); }
