/**
 * BRASIER — les bruits de la forge.
 *
 * Tout est synthétisé à la volée : pas un fichier à charger. Le son se coupe
 * d'un bouton, et le choix est mémorisé.
 */

let ctx = null;
let muet = false;
try { muet = localStorage.getItem('brasier.muet') === '1'; } catch { /* navigation privée */ }

export const estMuet = () => muet;
export function basculer() {
  muet = !muet;
  try { localStorage.setItem('brasier.muet', muet ? '1' : '0'); } catch { /* tant pis */ }
  return muet;
}

function c() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Une note : fréquence (ou glissando), forme, durée, volume. */
function note(hz, { forme = 'triangle', duree = 0.12, vol = 0.18, vers = null, delai = 0 } = {}) {
  if (muet) return;
  const a = c();
  if (!a) return;
  const t = a.currentTime + delai;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = forme;
  o.frequency.setValueAtTime(hz, t);
  if (vers) o.frequency.exponentialRampToValueAtTime(vers, t + duree);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + duree + 0.02);
}

/** Un souffle : bruit filtré, pour les chocs et les brisures. */
function souffle({ duree = 0.18, vol = 0.22, filtre = 900, delai = 0 } = {}) {
  if (muet) return;
  const a = c();
  if (!a) return;
  const t = a.currentTime + delai;
  const n = Math.floor(a.sampleRate * duree);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  s.buffer = buf; f.type = 'lowpass'; f.frequency.value = filtre; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(a.destination);
  s.start(t);
}

export const sfx = {
  achat: () => { note(880, { forme: 'square', vol: 0.08, duree: 0.06 }); note(1320, { forme: 'square', vol: 0.08, duree: 0.1, delai: 0.06 }); },
  vente: () => { note(1320, { forme: 'square', vol: 0.07, duree: 0.06 }); note(880, { forme: 'square', vol: 0.07, duree: 0.1, delai: 0.06 }); },
  rafraichir: () => souffle({ duree: 0.25, vol: 0.12, filtre: 2400 }),
  gel: () => note(1600, { forme: 'sine', vol: 0.1, duree: 0.3, vers: 2400 }),
  rang: () => [523, 659, 784, 1047].forEach((h, k) => note(h, { vol: 0.12, duree: 0.18, delai: k * 0.08 })),
  triple: () => [784, 988, 1175, 1568].forEach((h, k) => note(h, { forme: 'sine', vol: 0.14, duree: 0.3, delai: k * 0.07 })),
  pouvoir: () => note(300, { forme: 'sawtooth', vol: 0.08, duree: 0.35, vers: 900 }),
  refus: () => note(160, { forme: 'square', vol: 0.08, duree: 0.15 }),
  enclume: () => { note(1900, { forme: 'triangle', vol: 0.16, duree: 0.5 }); note(2400, { forme: 'sine', vol: 0.08, duree: 0.6 }); },
  attaque: () => souffle({ duree: 0.12, vol: 0.18, filtre: 700 }),
  coup: () => note(140, { forme: 'square', vol: 0.12, duree: 0.08, vers: 60 }),
  bouclier: () => note(1200, { forme: 'sine', vol: 0.14, duree: 0.25, vers: 600 }),
  mort: () => souffle({ duree: 0.35, vol: 0.2, filtre: 1600 }),
  invoque: () => note(500, { forme: 'triangle', vol: 0.1, duree: 0.2, vers: 1000 }),
  victoire: () => [523, 659, 784].forEach((h, k) => note(h, { vol: 0.14, duree: 0.35, delai: k * 0.12 })),
  defaite: () => [392, 330, 262].forEach((h, k) => note(h, { vol: 0.12, duree: 0.4, delai: k * 0.14 })),
};
