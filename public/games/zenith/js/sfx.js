/**
 * ZÉNITH — bruitages synthétisés (Web Audio). Aucun fichier audio.
 */

let ctx = null, master = null, enabled = true;
try { enabled = localStorage.getItem('zenith.sound') !== 'off'; } catch { /* ignore */ }

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

export const isEnabled = () => enabled;
export function toggle() {
  enabled = !enabled;
  try { localStorage.setItem('zenith.sound', enabled ? 'on' : 'off'); } catch { /* ignore */ }
  if (enabled) { ac(); tone(700, 0.08, 'sine', 0.18); }
  return enabled;
}
export function unlock() { if (enabled) ac(); }

function tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
  const c = ac(); if (!c || !enabled) return;
  const t0 = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.04);
}

function noise(dur, filter, freq, vol, q = 1, sweepTo = null) {
  const c = ac(); if (!c || !enabled) return;
  const t0 = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filter; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  tap() { tone(900, 0.04, 'square', 0.06); },
  click() { tone(620, 0.07, 'triangle', 0.13); },

  /** Coup physique : claquement sec. */
  punch() { noise(0.09, 'lowpass', 1600, 0.4, 1, 300); tone(150, 0.1, 'sine', 0.2, 60); },

  /** Décharge d'énergie : souffle montant. */
  blast() { noise(0.28, 'bandpass', 700, 0.3, 2, 2600); tone(320, 0.26, 'sawtooth', 0.14, 900); },

  /** Technique signature. */
  special() {
    tone(420, 0.3, 'sawtooth', 0.2, 1100);
    setTimeout(() => noise(0.3, 'lowpass', 2400, 0.4, 1, 500), 90);
  },

  /** Ultime : montée puis détonation. */
  ultimate() {
    tone(180, 0.55, 'sawtooth', 0.18, 1400);
    setTimeout(() => {
      noise(0.16, 'lowpass', 9000, 0.75, 0.6, 400);
      noise(0.8, 'lowpass', 800, 0.45, 0.7, 70);
      tone(120, 0.6, 'sine', 0.45, 26);
    }, 480);
  },

  dodge() { noise(0.2, 'highpass', 2200, 0.28, 1.5, 6000); tone(1200, 0.15, 'sine', 0.1, 2400); },
  swap() { tone(500, 0.12, 'triangle', 0.16, 900); setTimeout(() => tone(900, 0.1, 'triangle', 0.12), 80); },
  ko() { noise(0.5, 'lowpass', 500, 0.5, 0.8, 60); tone(90, 0.7, 'sine', 0.3, 30); },
  combo(n) { tone(500 + Math.min(n, 9) * 70, 0.07, 'square', 0.09); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.22), i * 120)); },
  lose() { [392, 311, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.34, 'sine', 0.18), i * 180)); },
  bell() { tone(880, 0.5, 'sine', 0.2); setTimeout(() => tone(1320, 0.6, 'sine', 0.14), 110); },
};
