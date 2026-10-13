/**
 * LE VELOURS NOIR — les sons, tous fabriqués à la volée (Web Audio) :
 * jetons, cartes, bille, gains, et le murmure de la salle. Et la voix du
 * croupier, par la synthèse vocale du navigateur quand elle existe.
 */

const CLE_SON = 'velours.son';
const CLE_VOIX = 'velours.voix';
const lireB = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const ecrireB = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* ignore */ } };

let son = lireB(CLE_SON, true);
let voix = lireB(CLE_VOIX, true);
let ctx = null, sortie = null, bruit = null, salle = null;

export const sonActif = () => son;
export const voixActive = () => voix;
export function basculerSon() { son = !son; ecrireB(CLE_SON, son); if (!son) arreterSalle(); else if (salleVoulue) demarrerSalle(); return son; }
export function basculerVoix() { voix = !voix; ecrireB(CLE_VOIX, voix); if (!voix) window.speechSynthesis?.cancel?.(); return voix; }

function monter() {
  if (ctx) return ctx.state === 'suspended' ? (ctx.resume(), ctx) : ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  sortie = ctx.createGain();
  sortie.gain.value = 0.8;
  sortie.connect(ctx.destination);
  const n = ctx.sampleRate;
  bruit = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
addEventListener('pointerdown', () => { if (son) { monter(); if (salleVoulue) demarrerSalle(); } }, { capture: true });

const pret = () => son && monter() && ctx.state !== 'closed';

function ton(f, t, dur, { type = 'sine', vol = 0.2, glisse = 0, attaque = 0.004 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glisse), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sortie);
  o.start(t); o.stop(t + dur + 0.02);
}
function souffle(t, dur, { type = 'bandpass', f = 2000, q = 1, vol = 0.3, fFin = 0 } = {}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = bruit;
  s.loop = true;
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (fFin) fl.frequency.exponentialRampToValueAtTime(fFin, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(sortie);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

/** Un jeton qui tinte sur un autre. */
export function jeton(retard = 0, fort = 1) {
  if (!pret()) return;
  const t = ctx.currentTime + retard;
  const f = 2600 + Math.random() * 900;
  ton(f, t, 0.05, { type: 'triangle', vol: 0.12 * fort });
  ton(f * 1.48, t + 0.004, 0.035, { type: 'sine', vol: 0.07 * fort });
  souffle(t, 0.03, { type: 'highpass', f: 5000, vol: 0.12 * fort });
}
/** Une pile de jetons qui s'écroule ou qu'on pousse. */
export function jetons(n = 6, duree = 0.35) {
  for (let k = 0; k < n; k++) jeton((k / n) * duree + Math.random() * 0.03, 0.6 + Math.random() * 0.5);
}
/** Une carte qui glisse sur le feutre. */
export function carte(retard = 0) {
  if (!pret()) return;
  const t = ctx.currentTime + retard;
  souffle(t, 0.13, { type: 'bandpass', f: 3200, q: 0.8, vol: 0.22, fFin: 1400 });
  souffle(t + 0.11, 0.025, { type: 'highpass', f: 2500, vol: 0.15 });
}
/** Une carte qu'on retourne d'un coup sec. */
export function retourne() {
  if (!pret()) return;
  const t = ctx.currentTime;
  souffle(t, 0.05, { type: 'bandpass', f: 1800, q: 1.4, vol: 0.3 });
  ton(380, t, 0.04, { type: 'triangle', vol: 0.05 });
}
/** Le mélange du sabot. */
export function melange() {
  if (!pret()) return;
  const t = ctx.currentTime;
  for (let k = 0; k < 26; k++) souffle(t + k * 0.028 + Math.random() * 0.01, 0.03, { type: 'bandpass', f: 2600 + Math.random() * 1500, q: 1.2, vol: 0.12 });
  souffle(t + 0.8, 0.12, { type: 'lowpass', f: 900, vol: 0.25 });
}
/** Un petit clic d'interface. */
export function clic() {
  if (!pret()) return;
  ton(1200, ctx.currentTime, 0.04, { type: 'triangle', vol: 0.05 });
}
/** Un gain : quelques notes qui montent, plus brillantes si le gain est gros. */
export function gain(gros = false) {
  if (!pret()) return;
  const t = ctx.currentTime;
  const notes = gros ? [523, 659, 784, 1047, 1319, 1568] : [659, 784, 1047];
  notes.forEach((f, k) => ton(f, t + k * 0.075, gros ? 0.6 : 0.35, { type: 'triangle', vol: 0.12 }));
  if (gros) { notes.forEach((f, k) => ton(f * 2, t + 0.5 + k * 0.05, 0.4, { type: 'sine', vol: 0.05 })); jetons(18, 1.2); }
}
export function perte() {
  if (!pret()) return;
  const t = ctx.currentTime;
  ton(220, t, 0.35, { type: 'triangle', vol: 0.12, glisse: 0.7 });
  ton(165, t + 0.12, 0.45, { type: 'triangle', vol: 0.1, glisse: 0.7 });
}
/** Un coup sourd : un « tapis », un blackjack du croupier. */
export function coup() {
  if (!pret()) return;
  const t = ctx.currentTime;
  ton(110, t, 0.4, { type: 'sine', vol: 0.4, glisse: 0.5, attaque: 0.002 });
  souffle(t, 0.15, { type: 'lowpass', f: 500, vol: 0.3 });
}

/**
 * La bille qui roule dans la roue : un roulement qui ralentit, des
 * rebonds sur les losanges, puis le « clac » dans la case.
 * @param {number} duree en secondes
 */
export function bille(duree) {
  if (!pret()) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = bruit; s.loop = true;
  fl.type = 'bandpass'; fl.Q.value = 6;
  fl.frequency.setValueAtTime(5200, t);
  fl.frequency.exponentialRampToValueAtTime(1600, t + duree * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.3);
  g.gain.setValueAtTime(0.16, t + duree * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree * 0.82);
  s.connect(fl).connect(g).connect(sortie);
  s.start(t); s.stop(t + duree);
  // les rebonds, de plus en plus espacés
  let r = duree * 0.58;
  for (let k = 0; k < 7; k++) {
    const q = t + r;
    ton(1800 + Math.random() * 1600, q, 0.04, { type: 'square', vol: 0.06 - k * 0.006 });
    souffle(q, 0.03, { type: 'highpass', f: 3000, vol: 0.15 - k * 0.015 });
    r += 0.12 + k * 0.05;
  }
  ton(900, t + duree * 0.98, 0.08, { type: 'triangle', vol: 0.12 });
  souffle(t + duree * 0.98, 0.05, { type: 'bandpass', f: 2200, vol: 0.25 });
}

/* ------------------------------------------------------------------ */
/* Le murmure de la salle                                              */
/* ------------------------------------------------------------------ */

let salleVoulue = false;
let clinks = null;

export function ambiance(oui) {
  salleVoulue = oui;
  if (oui) demarrerSalle(); else arreterSalle();
}

function demarrerSalle() {
  if (salle || !son || !ctx || ctx.state !== 'running') return;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), fl2 = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = bruit; s.loop = true;
  fl.type = 'bandpass'; fl.frequency.value = 520; fl.Q.value = 0.9;
  fl2.type = 'lowpass'; fl2.frequency.value = 1100;
  g.gain.value = 0.0001;
  g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
  // la foule respire : un balancement lent du volume
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 0.13; lg.gain.value = 0.018;
  lfo.connect(lg).connect(g.gain);
  s.connect(fl).connect(fl2).connect(g).connect(sortie);
  s.start(); lfo.start();
  salle = { s, g, lfo };
  // de temps en temps, des jetons à une autre table
  clinks = setInterval(() => {
    if (!son || document.hidden) return;
    if (Math.random() < 0.5) for (let k = 0; k < 3 + Math.random() * 5; k++) jeton(k * 0.05 + Math.random() * 0.03, 0.18);
  }, 2600);
}

function arreterSalle() {
  clearInterval(clinks); clinks = null;
  if (!salle) return;
  const { s, g, lfo } = salle;
  salle = null;
  try {
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    s.stop(ctx.currentTime + 1.2); lfo.stop(ctx.currentTime + 1.2);
  } catch { /* déjà arrêté */ }
}

/* ------------------------------------------------------------------ */
/* La voix du croupier                                                 */
/* ------------------------------------------------------------------ */

let voixFr = null;
function choisirVoix() {
  const vs = window.speechSynthesis?.getVoices?.() || [];
  voixFr = vs.find((v) => /^fr(-|_)FR/i.test(v.lang)) || vs.find((v) => /^fr/i.test(v.lang)) || null;
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  choisirVoix();
  speechSynthesis.addEventListener?.('voiceschanged', choisirVoix);
}

/** Le croupier parle (si la voix est permise et qu'une voix française existe). */
export function dire(texte, { hauteur = 1, vitesse = 1.02 } = {}) {
  if (!son || !voix || !window.speechSynthesis || !voixFr) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.voice = voixFr; u.lang = voixFr.lang; u.pitch = hauteur; u.rate = vitesse; u.volume = 0.9;
    speechSynthesis.speak(u);
  } catch { /* pas de voix */ }
}

/* ------------------------------------------------------------------ */
/* Les machines à sous                                                 */
/* ------------------------------------------------------------------ */

/** Le levier qu'on tire : un grincement, puis le déclic. */
export function levier() {
  if (!pret()) return;
  const t = ctx.currentTime;
  ton(140, t, 0.25, { type: 'sawtooth', vol: 0.05, glisse: 0.6 });
  souffle(t + 0.18, 0.06, { type: 'bandpass', f: 1200, q: 2, vol: 0.3 });
  ton(90, t + 0.2, 0.15, { type: 'square', vol: 0.06 });
}

/** Les rouleaux qui défilent : un cliquetis régulier pendant `duree` secondes. */
export function rouleaux(duree) {
  if (!pret()) return;
  const t = ctx.currentTime;
  for (let k = 0; k < duree / 0.055; k++) souffle(t + k * 0.055, 0.025, { type: 'bandpass', f: 2400 + (k % 3) * 300, q: 3, vol: 0.06 });
}

/** Un rouleau qui s'arrête : un « clonk » mécanique. */
export function arret(k = 0) {
  if (!pret()) return;
  const t = ctx.currentTime;
  ton(180 - k * 12, t, 0.12, { type: 'triangle', vol: 0.18, glisse: 0.6 });
  souffle(t, 0.05, { type: 'lowpass', f: 900, vol: 0.25 });
}

/** Le roulement de tambour du suspense. */
export function tambour(duree) {
  if (!pret()) return;
  const t = ctx.currentTime;
  for (let k = 0; k < duree / 0.06; k++) souffle(t + k * 0.06, 0.05, { type: 'bandpass', f: 220, q: 1.2, vol: 0.12 + (k / (duree / 0.06)) * 0.15 });
}

/** La sirène du jackpot. */
export function sirene() {
  if (!pret()) return;
  const t = ctx.currentTime;
  for (let k = 0; k < 4; k++) {
    ton(600, t + k * 0.5, 0.25, { type: 'square', vol: 0.06, glisse: 1.6 });
    ton(960, t + k * 0.5 + 0.25, 0.25, { type: 'square', vol: 0.06, glisse: 0.62 });
  }
  gain(true);
}
