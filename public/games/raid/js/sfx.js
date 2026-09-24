/**
 * RAID — bruitages synthétisés (Web Audio). Aucun fichier audio :
 * tout est fabriqué à la volée, donc rien à télécharger et rien qui manque
 * hors connexion.
 */

let ctx = null, master = null, actif = true;
try { actif = localStorage.getItem('raid.son') !== 'off'; } catch { /* premier passage */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const estActif = () => actif;
export function basculer() {
  actif = !actif;
  try { localStorage.setItem('raid.son', actif ? 'on' : 'off'); } catch { /* ignore */ }
  if (actif) { ac(); note(780, 0.09, 'sine', 0.18); }
  return actif;
}
export function debloquer() { if (actif) ac(); }

function note(freq, duree, forme = 'sine', vol = 0.22, vers = null, retard = 0) {
  const c = ac(); if (!c || !actif) return;
  const t0 = c.currentTime + retard;
  const o = c.createOscillator(), g = c.createGain();
  o.type = forme;
  o.frequency.setValueAtTime(freq, t0);
  if (vers) o.frequency.exponentialRampToValueAtTime(Math.max(1, vers), t0 + duree);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + duree + 0.05);
}

function souffle(duree, filtre, freq, vol, q = 1, vers = null, retard = 0) {
  const c = ac(); if (!c || !actif) return;
  const t0 = c.currentTime + retard;
  const len = Math.max(1, Math.floor(c.sampleRate * duree));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filtre; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (vers) f.frequency.exponentialRampToValueAtTime(vers, t0 + duree);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  tap() { note(880, 0.04, 'square', 0.05); },
  clic() { note(600, 0.07, 'triangle', 0.12); },

  /** Une globe ramassée : la note monte avec la longueur du chemin. */
  globe(n) { note(420 + Math.min(n, 12) * 55, 0.06, 'triangle', 0.1); },

  /** Le mana se verse dans la jauge. */
  mana() { note(520, 0.22, 'sine', 0.14, 1250); },

  /** Seuil franchi : la spéciale s'arme. */
  arme() { note(660, 0.16, 'square', 0.12, 990); note(990, 0.2, 'sine', 0.1, 1320, 0.09); },

  frappe() { souffle(0.09, 'lowpass', 1700, 0.34, 1, 320); note(160, 0.1, 'sine', 0.2, 62); },

  special() {
    note(420, 0.3, 'sawtooth', 0.18, 1150);
    souffle(0.3, 'lowpass', 2400, 0.36, 1, 520, 0.09);
  },

  ultime() {
    note(170, 0.6, 'sawtooth', 0.17, 1500);
    souffle(0.18, 'lowpass', 9000, 0.7, 0.6, 420, 0.5);
    note(115, 0.65, 'sine', 0.42, 26, 0.5);
    souffle(0.85, 'lowpass', 760, 0.4, 0.7, 70, 0.52);
  },

  subi() { souffle(0.22, 'lowpass', 900, 0.42, 0.8, 120); note(120, 0.24, 'square', 0.16, 48); },
  charge() { note(220, 0.5, 'sawtooth', 0.16, 880); souffle(0.5, 'bandpass', 500, 0.2, 3, 2400); },
  soin() { [660, 880, 1170].forEach((f, i) => note(f, 0.26, 'sine', 0.13, null, i * 0.07)); },
  garde() { note(300, 0.2, 'triangle', 0.16, 520); },
  ko() { souffle(0.5, 'lowpass', 520, 0.45, 0.8, 60); note(92, 0.7, 'sine', 0.28, 30); },
  rage() { note(90, 0.5, 'sawtooth', 0.3, 200); souffle(0.5, 'bandpass', 300, 0.3, 2, 900); },
  victoire() { [523, 659, 784, 1046].forEach((f, i) => note(f, 0.3, 'triangle', 0.2, null, i * 0.12)); },
  defaite() { [392, 311, 262, 196].forEach((f, i) => note(f, 0.36, 'sine', 0.17, null, i * 0.18)); },
  butin() { [784, 1046, 1318].forEach((f, i) => note(f, 0.4, 'sine', 0.16, null, i * 0.1)); },
};
