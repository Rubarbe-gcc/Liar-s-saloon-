/**
 * PETIT PONT — les bruitages, faits par le code (Web Audio) : le ballon
 * frappé, la bande, le poteau, le filet, le sifflet de l'arbitre, la rumeur
 * du public qui monte sur une occasion et explose sur un but.
 */

let ctx = null, maitre = null, bruit = null, foule = null, fouleGain = null, fouleFiltre = null;
let muet = false;
try { muet = localStorage.getItem('petitpont.muet') === '1'; } catch { /* ignore */ }

export const estMuet = () => muet;
export function basculerSon() {
  muet = !muet;
  try { localStorage.setItem('petitpont.muet', muet ? '1' : '0'); } catch { /* ignore */ }
  if (maitre) maitre.gain.value = muet ? 0 : 0.6;
  return muet;
}

function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    maitre = ctx.createGain();
    maitre.gain.value = muet ? 0 : 0.6;
    const comp = ctx.createDynamicsCompressor();
    maitre.connect(comp).connect(ctx.destination);
    const n = ctx.sampleRate * 2;
    bruit = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
/** À appeler sur un geste du joueur (les navigateurs l'exigent pour le son). */
export const reveiller = () => audio();

function souffle(duree, { freq = 800, q = 1, vol = 0.2, type = 'bandpass', glisse = 0, retard = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + retard;
  const s = a.createBufferSource(); s.buffer = bruit;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (glisse) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glisse), t + duree);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  s.connect(f).connect(g).connect(maitre);
  s.start(t, Math.random()); s.stop(t + duree + 0.05);
}
function ton(freq, duree, { type = 'sine', vol = 0.2, glisse = 0, retard = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + retard;
  const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glisse), t + duree);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(maitre);
  o.start(t); o.stop(t + duree + 0.05);
}

/** Un coup de pied dans le ballon (plus sourd et plus fort pour une frappe). */
export function frappe(force = 0.5) {
  ton(140 + force * 40, 0.09 + force * 0.05, { type: 'sine', vol: 0.25 + force * 0.25, glisse: -90 });
  souffle(0.05 + force * 0.04, { freq: 1800, q: 0.8, vol: 0.12 + force * 0.18 });
}
export const controle = () => { ton(180, 0.05, { vol: 0.08, glisse: -60 }); souffle(0.03, { freq: 1200, vol: 0.05 }); };
export const bande = (f = 6) => { souffle(0.12, { freq: 380, q: 1.5, vol: Math.min(0.35, f * 0.03) }); ton(90, 0.12, { type: 'triangle', vol: Math.min(0.25, f * 0.02), glisse: -30 }); };
export const poteau = () => { for (const [f, v] of [[1180, 0.18], [1770, 0.1], [2630, 0.06]]) ton(f, 1.1, { type: 'sine', vol: v }); frappe(0.6); };
export const filet = () => souffle(0.35, { freq: 2600, q: 0.6, vol: 0.18, glisse: -1500 });
export const tacle = () => { souffle(0.28, { freq: 600, q: 0.7, vol: 0.18, glisse: -300 }); };
export const arret = () => { ton(110, 0.12, { type: 'triangle', vol: 0.3, glisse: -40 }); souffle(0.08, { freq: 900, vol: 0.15 }); };

/** Le sifflet : n coups (le dernier long pour une fin). */
export function sifflet(n = 1, long = false) {
  for (let k = 0; k < n; k++) {
    const d = long && k === n - 1 ? 0.8 : 0.22;
    const r = k * 0.32;
    const a = audio(); if (!a) return;
    const t = a.currentTime + r;
    const o = a.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(2900, t);
    const lfo = a.createOscillator(); lfo.frequency.value = 38;
    const lg = a.createGain(); lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency);
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 3;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.setValueAtTime(0.09, t + d - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f).connect(g).connect(maitre);
    o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  }
}

/** La rumeur du public, en continu ; `niveau` de 0 (calme) à 1 (délire). */
export function public_(niveau) {
  const a = audio(); if (!a) return;
  if (!foule) {
    foule = a.createBufferSource(); foule.buffer = bruit; foule.loop = true;
    fouleFiltre = a.createBiquadFilter(); fouleFiltre.type = 'bandpass'; fouleFiltre.frequency.value = 520; fouleFiltre.Q.value = 0.5;
    fouleGain = a.createGain(); fouleGain.gain.value = 0;
    foule.connect(fouleFiltre).connect(fouleGain).connect(maitre);
    foule.start();
  }
  const t = a.currentTime;
  fouleGain.gain.setTargetAtTime(0.04 + niveau * 0.22, t, 0.25);
  fouleFiltre.frequency.setTargetAtTime(480 + niveau * 700, t, 0.3);
}
export function couperPublic() { if (fouleGain && ctx) fouleGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); }

/** Le but : la clameur, des cornes. */
export function but() {
  souffle(2.6, { freq: 900, q: 0.4, vol: 0.4, glisse: -300 });
  for (let k = 0; k < 3; k++) ton(233 + k * 0.5, 0.5, { type: 'sawtooth', vol: 0.05, retard: 0.15 + k * 0.55 });
}
/** Le « ohhh » d'une occasion manquée. */
export const occasion = () => souffle(1.2, { freq: 420, q: 0.8, vol: 0.22, glisse: -150 });
/** Un petit bip d'interface. */
export const bip = (aigu = false) => ton(aigu ? 880 : 660, 0.06, { type: 'square', vol: 0.05 });
