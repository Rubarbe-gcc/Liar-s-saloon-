/**
 * PARE-FEU — les sons, tous synthétisés (WebAudio), et une nappe de fond
 * qui se tend avec la surchauffe.
 */

let ctx = null;
let maitre = null;
let actif = localStorage.getItem('parefeu.son') !== '0';
let nappe = null;
const derniers = new Map();

function audio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      maitre = ctx.createGain();
      maitre.gain.value = 0.5;
      maitre.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const estActif = () => actif;
export function basculer() {
  actif = !actif;
  localStorage.setItem('parefeu.son', actif ? '1' : '0');
  if (!actif) arreterNappe();
  return actif;
}
/** À appeler sur un geste de l'utilisateur (les navigateurs l'exigent). */
export function debloquer() { if (actif) audio(); }

function bip(freq, duree, { type = 'square', vol = 0.15, glisse = 0, delai = 0, filtre = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delai;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glisse), t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  let sortie = g;
  if (filtre) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filtre;
    g.connect(f); sortie = f;
  }
  o.connect(g);
  sortie.connect(maitre);
  o.start(t); o.stop(t + duree + 0.05);
}

function bruit(duree, { vol = 0.2, filtre = 2000, delai = 0, passeHaut = 0 } = {}) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delai;
  const n = Math.floor(c.sampleRate * duree);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = passeHaut ? 'highpass' : 'lowpass';
  f.frequency.value = passeHaut || filtre;
  const g = c.createGain();
  g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(maitre);
  s.start(t);
}

const SONS = {
  clic: () => bip(1400, 0.04, { vol: 0.06 }),
  lance: () => { bip(520, 0.08, { glisse: 2.2, vol: 0.07 }); },
  cheval: () => { bip(300, 0.15, { type: 'sawtooth', glisse: 1.8, vol: 0.08, filtre: 1800 }); },
  saturation: () => { bruit(0.25, { vol: 0.12, filtre: 900 }); bip(160, 0.25, { type: 'sawtooth', vol: 0.08 }); },
  rancon: () => { bip(880, 0.06, { vol: 0.07 }); bip(1320, 0.08, { vol: 0.07, delai: 0.06 }); },
  sonde: () => { bip(1800, 0.25, { type: 'sine', glisse: 0.5, vol: 0.08 }); },
  defense: () => { bip(660, 0.08, { type: 'triangle', vol: 0.1 }); bip(990, 0.12, { type: 'triangle', vol: 0.09, delai: 0.07 }); },
  correctif: () => { [523, 659, 784].forEach((f, i) => bip(f, 0.12, { type: 'sine', vol: 0.09, delai: i * 0.05 })); },
  bloque: () => { bip(220, 0.12, { type: 'square', vol: 0.07, filtre: 1200 }); bruit(0.06, { vol: 0.08, passeHaut: 3000 }); },
  impact: () => { bruit(0.08, { vol: 0.1, filtre: 1500 }); },
  touche: () => { bip(140, 0.12, { type: 'sawtooth', glisse: 0.6, vol: 0.09, filtre: 900 }); },
  zap: () => { bip(2400, 0.09, { type: 'sawtooth', glisse: 0.25, vol: 0.06 }); },
  capture: () => { [440, 554, 659, 880].forEach((f, i) => bip(f, 0.14, { type: 'square', vol: 0.07, delai: i * 0.06, filtre: 3000 })); },
  perte: () => { [440, 349, 262, 196].forEach((f, i) => bip(f, 0.18, { type: 'sawtooth', vol: 0.08, delai: i * 0.08, filtre: 1600 })); },
  noyau: () => { bruit(1.4, { vol: 0.35, filtre: 600 }); bip(90, 1.2, { type: 'sine', glisse: 0.3, vol: 0.3 }); bip(45, 1.4, { type: 'square', vol: 0.08, filtre: 300 }); },
  alarme: () => { bip(880, 0.12, { type: 'square', vol: 0.05 }); bip(660, 0.12, { type: 'square', vol: 0.05, delai: 0.14 }); },
  vol: () => { for (let i = 0; i < 5; i++) bip(1200 + i * 220, 0.05, { vol: 0.05, delai: i * 0.04 }); },
  refus: () => bip(120, 0.1, { type: 'square', vol: 0.06 }),
  fleche: () => bip(980, 0.05, { type: 'square', vol: 0.07 }),
  rate: () => bip(110, 0.15, { type: 'sawtooth', vol: 0.08 }),
  breche: () => { bruit(0.4, { vol: 0.2, filtre: 2500 }); [330, 440, 660, 990].forEach((f, i) => bip(f, 0.1, { vol: 0.07, delai: i * 0.04 })); },
  victoire: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => bip(f, 0.2, { type: 'square', vol: 0.08, delai: i * 0.12, filtre: 3500 })); },
  defaite: () => { [392, 330, 262, 196, 131].forEach((f, i) => bip(f, 0.3, { type: 'sawtooth', vol: 0.08, delai: i * 0.15, filtre: 1200 })); },
};

/** Joue un son (pas plus d'une fois par `ecart` secondes pour le même). */
export function jouer(nom, ecart = 0.04) {
  if (!actif || !SONS[nom]) return;
  const t = performance.now() / 1000;
  if (t - (derniers.get(nom) || 0) < ecart) return;
  derniers.set(nom, t);
  SONS[nom]();
}

/** La nappe de fond : deux oscillateurs graves et un battement. */
export function lancerNappe() {
  if (!actif || nappe) return;
  const c = audio();
  if (!c) return;
  const g = c.createGain();
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 2);
  const f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 420;
  const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
  const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.4;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.15;
  const lg = c.createGain(); lg.gain.value = 180;
  lfo.connect(lg); lg.connect(f.frequency);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(maitre);
  o1.start(); o2.start(); lfo.start();
  nappe = { g, o1, o2, lfo, f };
}
export function tension(mult) {
  if (!nappe) return;
  nappe.lfo.frequency.value = 0.15 * mult * mult;
  nappe.f.frequency.value = 420 + (mult - 1) * 300;
}
export function arreterNappe() {
  if (!nappe || !ctx) return;
  const n = nappe;
  nappe = null;
  n.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
  setTimeout(() => { try { n.o1.stop(); n.o2.stop(); n.lfo.stop(); } catch { /* déjà arrêtés */ } }, 800);
}
