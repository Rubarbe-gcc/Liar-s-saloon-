/**
 * PLEIN STADE — les bruitages et l'ambiance du stade, faits par le code (Web Audio).
 *
 * Pas de bruit blanc qui grésille : la rumeur du public est un bruit « brun »
 * (grave, doux) qui ondule lentement ; les « oooh » et la clameur d'un but
 * sont un chœur de voix (des dizaines de petites voix désaccordées, filtrées
 * comme une voyelle : « ou », « a »). Le ballon frappé, la bande, le poteau,
 * le sifflet : des sons courts, sans souffle.
 *
 * Deux réglages, gardés sur l'appareil : le son (coupé ou non) et l'ambiance
 * du public (forte, normale, douce, coupée).
 */

let ctx = null, maitre = null, brun = null;
let foule = null;
let muet = false;
let ambiance = 'normale';
try { muet = localStorage.getItem('petitpont.muet') === '1'; } catch { /* ignore */ }
try { ambiance = localStorage.getItem('pleinstade.public') || 'normale'; } catch { /* ignore */ }

/** Le volume de l'ambiance du public, selon le réglage. */
const VOLUME_PUBLIC = { forte: 1.3, normale: 1, douce: 0.5, coupee: 0 };
export const AMBIANCES = [['forte', 'Public : fort'], ['normale', 'Public : normal'], ['douce', 'Public : doux'], ['coupee', 'Public : coupé']];
export const ambiancePublic = () => ambiance;
export function reglerPublic(v) {
  ambiance = VOLUME_PUBLIC[v] !== undefined ? v : 'normale';
  try { localStorage.setItem('pleinstade.public', ambiance); } catch { /* ignore */ }
}

export const estMuet = () => muet;
export function basculerSon() {
  muet = !muet;
  try { localStorage.setItem('petitpont.muet', muet ? '1' : '0'); } catch { /* ignore */ }
  if (maitre) maitre.gain.value = muet ? 0 : 0.7;
  return muet;
}

function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    maitre = ctx.createGain();
    maitre.gain.value = muet ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    maitre.connect(comp).connect(ctx.destination);
    // Le bruit brun : on additionne du hasard (une marche aléatoire) ; pas d'aigus, pas de grésillement.
    const n = ctx.sampleRate * 4;
    brun = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = brun.getChannelData(0);
    let v = 0;
    for (let i = 0; i < n; i++) { v = (v + (Math.random() * 2 - 1) * 0.02) * 0.998; d[i] = v * 3.2; }
    // Les deux bouts se raccordent en douceur (la boucle ne claque pas).
    for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] = d[i] * k + d[n - 2000 + i] * (1 - k); }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
/** À appeler sur un geste du joueur (les navigateurs l'exigent pour le son). */
export const reveiller = () => audio();

function enveloppe(g, t, attaque, tenue, chute, vol) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attaque);
  g.gain.setValueAtTime(vol, t + attaque + tenue);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attaque + tenue + chute);
}

function ton(freq, duree, { type = 'sine', vol = 0.2, glisse = 0, retard = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + retard;
  const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glisse), t + duree);
  const g = a.createGain();
  enveloppe(g, t, 0.006, 0, duree, vol);
  o.connect(g).connect(maitre);
  o.start(t); o.stop(t + duree + 0.05);
}

/** Un souffle grave et court (bruit brun filtré) : un frottement, un « pof ». */
function sourd(duree, { freq = 400, vol = 0.2, retard = 0, glisse = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + retard;
  const s = a.createBufferSource(); s.buffer = brun;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = 0.7;
  if (glisse) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + glisse), t + duree);
  const g = a.createGain();
  enveloppe(g, t, 0.01, duree * 0.3, duree * 0.7, vol);
  s.connect(f).connect(g).connect(maitre);
  s.start(t, Math.random() * 3); s.stop(t + duree + 0.05);
}

/**
 * Un chœur de voix : `n` petites voix désaccordées (autour de `hauteur` Hz) qui disent
 * une voyelle (les deux formants f1, f2), avec une enveloppe et un glissé de hauteur.
 */
function choeur({ n = 18, hauteur = 210, f1 = 700, f2 = 1150, attaque = 0.25, tenue = 0.8, chute = 1.2, vol = 0.22, glisse = 0, retard = 0 }) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + retard;
  const sortie = a.createGain();
  enveloppe(sortie, t, attaque, tenue, chute, vol);
  const b1 = a.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = f1; b1.Q.value = 5;
  const b2 = a.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = f2; b2.Q.value = 7;
  const g2 = a.createGain(); g2.gain.value = 0.6;
  const doux = a.createBiquadFilter(); doux.type = 'lowpass'; doux.frequency.value = 2400;
  b1.connect(doux); b2.connect(g2).connect(doux);
  doux.connect(sortie).connect(maitre);
  const fin = t + attaque + tenue + chute + 0.1;
  for (let k = 0; k < n; k++) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    const f0 = hauteur * (0.62 + Math.random() * 0.9);
    o.frequency.setValueAtTime(f0, t);
    if (glisse) o.frequency.linearRampToValueAtTime(Math.max(50, f0 * (1 + glisse)), t + attaque + tenue + chute);
    // Chaque voix tremble un peu, à sa façon (vibrato).
    const lfo = a.createOscillator(); lfo.frequency.value = 4 + Math.random() * 3;
    const lg = a.createGain(); lg.gain.value = f0 * 0.012;
    lfo.connect(lg).connect(o.frequency);
    const gv = a.createGain(); gv.gain.value = (0.4 + Math.random() * 0.6) / n;
    o.connect(gv); gv.connect(b1); gv.connect(b2);
    const decale = Math.random() * 0.12;
    o.start(t + decale); lfo.start(t + decale); o.stop(fin); lfo.stop(fin);
  }
}

/** Un coup de pied dans le ballon : un « pom » grave et net (plus fort pour une frappe). */
export function frappe(force = 0.5) {
  ton(120 + force * 50, 0.1 + force * 0.06, { type: 'sine', vol: 0.3 + force * 0.3, glisse: -80 });
  ton(320, 0.03, { type: 'triangle', vol: 0.06 + force * 0.08, glisse: -150 });
}
export const controle = () => ton(170, 0.06, { vol: 0.12, glisse: -60 });
export const bande = (f = 6) => { ton(85, 0.16, { type: 'triangle', vol: Math.min(0.3, f * 0.025), glisse: -25 }); sourd(0.12, { freq: 260, vol: Math.min(0.25, f * 0.02) }); };
export const poteau = () => { for (const [f, v] of [[1180, 0.16], [1770, 0.09], [2630, 0.05]]) ton(f, 1.1, { type: 'sine', vol: v }); frappe(0.6); };
export const filet = () => sourd(0.4, { freq: 900, vol: 0.2, glisse: -650 });
export const tacle = () => sourd(0.3, { freq: 500, vol: 0.22, glisse: -280 });
export const arret = () => { ton(105, 0.14, { type: 'triangle', vol: 0.3, glisse: -40 }); sourd(0.1, { freq: 350, vol: 0.14 }); };
export const bip = (aigu = false) => ton(aigu ? 880 : 660, 0.06, { type: 'square', vol: 0.05 });

/** Le sifflet : n coups (le dernier long pour une fin). */
export function sifflet(n = 1, long = false) {
  const a = audio(); if (!a) return;
  for (let k = 0; k < n; k++) {
    const d = long && k === n - 1 ? 0.8 : 0.22;
    const t = a.currentTime + k * 0.32;
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2900, t);
    const lfo = a.createOscillator(); lfo.frequency.value = 36;
    const lg = a.createGain(); lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + d - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(maitre);
    o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  }
}

/**
 * La rumeur du public, en continu ; `niveau` de 0 (calme) à 1 (délire). Un bruit brun
 * (grave) qui ondule lentement : on l'entend respirer, pas grésiller.
 */
export function public_(niveau) {
  const a = audio(); if (!a) return;
  if (!foule) {
    const s = a.createBufferSource(); s.buffer = brun; s.loop = true;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; f.Q.value = 0.5;
    const g = a.createGain(); g.gain.value = 0;
    // Deux ondulations lentes, désaccordées : la foule respire.
    const houle = a.createGain(); houle.gain.value = 1;
    for (const [freq, prof] of [[0.17, 0.22], [0.41, 0.12]]) {
      const lfo = a.createOscillator(); lfo.frequency.value = freq;
      const lg = a.createGain(); lg.gain.value = prof;
      lfo.connect(lg).connect(houle.gain);
      lfo.start();
    }
    s.connect(f).connect(houle).connect(g).connect(maitre);
    s.start();
    foule = { f, g };
  }
  const t = a.currentTime;
  const vol = VOLUME_PUBLIC[ambiance] ?? 1;
  foule.g.gain.setTargetAtTime((0.05 + niveau * 0.2) * vol, t, 0.3);
  foule.f.frequency.setTargetAtTime(320 + niveau * 520, t, 0.4);
}
export function couperPublic() { if (foule && ctx) foule.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); }

const volPublic = () => VOLUME_PUBLIC[ambiance] ?? 1;

/** Le but : la clameur du stade (« aaah ! »), qui enfle puis retombe lentement. */
export function but() {
  const v = volPublic();
  if (v > 0) {
    choeur({ n: 26, hauteur: 230, f1: 760, f2: 1220, attaque: 0.35, tenue: 1.6, chute: 1.8, vol: 0.34 * v, glisse: 0.08 });
    choeur({ n: 14, hauteur: 330, f1: 880, f2: 1500, attaque: 0.5, tenue: 1.2, chute: 1.6, vol: 0.14 * v, glisse: 0.05, retard: 0.15 });
    sourd(3.2, { freq: 700, vol: 0.18 * v, glisse: -300 });
  }
  ton(196, 0.45, { type: 'triangle', vol: 0.06, retard: 0.2 });
  ton(247, 0.45, { type: 'triangle', vol: 0.05, retard: 0.2 });
}
/** Le « oooh » d'une occasion manquée : la voix du public qui descend. */
export function occasion() {
  const v = volPublic(); if (!v) return;
  choeur({ n: 20, hauteur: 200, f1: 360, f2: 820, attaque: 0.2, tenue: 0.5, chute: 0.9, vol: 0.22 * v, glisse: -0.22 });
}
/** Le public qui salue (fin de mi-temps, beau geste) : un « ouais » rond, sans claquements. */
export function acclamation(force = 0.6) {
  const v = volPublic(); if (!v) return;
  choeur({ n: 16, hauteur: 220, f1: 640, f2: 1050, attaque: 0.3, tenue: 0.6 * force, chute: 1, vol: 0.18 * v * force, glisse: 0.04 });
}
