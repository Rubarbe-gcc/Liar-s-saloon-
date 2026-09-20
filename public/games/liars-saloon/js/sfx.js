/**
 * Bruitages synthetises a la volee (Web Audio).
 *
 * Aucun fichier audio n'est charge : tout est genere, ce qui evite des
 * requetes reseau et garde le jeu jouable hors-ligne.
 */

let ctx = null;
let master = null;
let enabled = true;

try {
  enabled = localStorage.getItem('saloon.sound') !== 'off';
} catch { /* stockage indisponible : on garde le son actif */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  // Les navigateurs suspendent le contexte tant qu'il n'y a pas eu de geste.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function isEnabled() { return enabled; }

export function setEnabled(on) {
  enabled = on;
  try { localStorage.setItem('saloon.sound', on ? 'on' : 'off'); } catch { /* ignore */ }
  if (on) { ac(); blip(660, 0.08, 'sine', 0.2); }
}

export function toggle() { setEnabled(!enabled); return enabled; }

/** Reveille le contexte audio au premier geste de l'utilisateur. */
export function unlock() { if (enabled) ac(); }

/* ------------------------------------------------------------------ */
/* Briques de synthese                                                 */
/* ------------------------------------------------------------------ */

function env(node, t0, attack, hold, release, peak) {
  const g = node.gain;
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + attack);
  g.setValueAtTime(peak, t0 + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}

function blip(freq, dur = 0.1, type = 'sine', vol = 0.3, slideTo = null) {
  const c = ac(); if (!c || !enabled) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  env(gain, t0, 0.008, dur * 0.3, dur * 0.7, vol);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.06);
}

/** Bruit blanc filtre — base des sons percussifs et du coup de feu. */
function noise(dur, filterType, freq, vol, q = 1, sweepTo = null) {
  const c = ac(); if (!c || !enabled) return null;
  const t0 = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.setValueAtTime(freq, t0);
  filt.Q.value = q;
  if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);

  const gain = c.createGain();
  env(gain, t0, 0.005, dur * 0.12, dur * 0.88, vol);
  src.connect(filt).connect(gain).connect(master);
  src.start(t0);
  return src;
}

/* ------------------------------------------------------------------ */
/* Sons du jeu                                                         */
/* ------------------------------------------------------------------ */

export const sfx = {
  /** Survol / clic d'interface. */
  tick() { blip(1180, 0.045, 'square', 0.055); },
  click() { blip(760, 0.07, 'triangle', 0.13); },

  /** Selection d'une carte dans la main. */
  pick() { blip(880, 0.06, 'triangle', 0.13, 1320); },
  unpick() { blip(660, 0.06, 'triangle', 0.1, 440); },

  /** Cartes jetees sur le tapis. */
  toss(n = 1) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => noise(0.13, 'bandpass', 2600, 0.2, 0.9, 900), i * 85);
    }
  },

  /** Distribution en debut de manche. */
  deal(n = 5) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => noise(0.1, 'highpass', 1800, 0.14), i * 70);
    }
  },

  /** Retournement d'une carte lors de la revelation. */
  flip() { noise(0.16, 'bandpass', 1700, 0.22, 1.4, 700); },

  /** Accusation. */
  accuse() {
    blip(320, 0.14, 'sawtooth', 0.2, 170);
    setTimeout(() => blip(240, 0.2, 'sawtooth', 0.16, 120), 70);
  },

  /** Barillet qui tourne : une serie de cliquetis qui ralentit. */
  spin() {
    let t = 0;
    for (let i = 0; i < 16; i++) {
      setTimeout(() => noise(0.035, 'bandpass', 3200 - i * 90, 0.17, 3), t);
      t += 40 + i * 9;
    }
  },

  /** Chien arme. */
  cock() {
    noise(0.05, 'bandpass', 2400, 0.22, 4);
    setTimeout(() => noise(0.05, 'bandpass', 1900, 0.18, 4), 80);
  },

  /** Percuteur sur chambre vide — le soulagement. */
  clickEmpty() {
    noise(0.06, 'bandpass', 1500, 0.3, 6);
    setTimeout(() => blip(180, 0.1, 'sine', 0.1, 120), 40);
  },

  /** Detonation : claquement, corps grave, longue queue de reverberation. */
  bang() {
    const c = ac(); if (!c || !enabled) return;
    noise(0.14, 'lowpass', 9000, 0.85, 0.6, 400);
    noise(0.85, 'lowpass', 900, 0.45, 0.7, 90);
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(28, t0 + 0.5);
    env(gain, t0, 0.004, 0.05, 0.5, 0.55);
    osc.connect(gain).connect(master);
    osc.start(t0); osc.stop(t0 + 0.7);
  },

  /** Battements de coeur pendant le suspense. */
  heartbeat(beats = 3) {
    for (let i = 0; i < beats; i++) {
      const at = i * 620;
      setTimeout(() => blip(58, 0.16, 'sine', 0.42, 34), at);
      setTimeout(() => blip(50, 0.13, 'sine', 0.3, 30), at + 185);
    }
  },

  /** Nouvelle manche. */
  round() { blip(523, 0.1, 'sine', 0.16); setTimeout(() => blip(784, 0.16, 'sine', 0.16), 95); },

  /** Elimination d'un joueur. */
  knell() { blip(120, 0.7, 'sine', 0.3, 60); },

  /** Fanfare de victoire. */
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.24), i * 130));
    setTimeout(() => blip(1568, 0.6, 'sine', 0.18), 560);
  },

  /** Defaite. */
  lose() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.36, 'sine', 0.2), i * 190));
  },

  /** Notification (arrivee d'un joueur dans le salon). */
  join() { blip(880, 0.08, 'sine', 0.14, 1174); },
  leave() { blip(660, 0.12, 'sine', 0.12, 330); },

  /** Alerte de fin de temps. */
  urgent() { blip(1400, 0.06, 'square', 0.1); },
};
