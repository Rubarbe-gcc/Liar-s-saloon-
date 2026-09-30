/**
 * ÉCHO — la courbe en direct.
 *
 * Le son de référence s'affiche comme un ruban : sa hauteur dans le temps, et
 * sous lui, son énergie — c'est-à-dire exactement les deux choses que le
 * barème compare. Pendant la prise, la voix du joueur se dessine par-dessus,
 * verte quand elle suit la ligne, orange quand elle s'en écarte.
 *
 * Deux choix, qui suivent le barème plutôt que l'intuition :
 *
 *   · la hauteur est RELATIVE. La voix est recalée sur la médiane de la
 *     référence au fur et à mesure : chanter une octave plus bas ne doit pas
 *     afficher une courbe hors du cadre, puisque la note ne le punit pas ;
 *   · le temps démarre au premier son émis, pas au « top » : le barème retire
 *     le silence du début, l'écran fait de même.
 */

import { rendre } from '../../../shared/mimic/sons.js';
import { analyserPrise } from '../../../shared/mimic/analyse.js';
import { SR } from './audio.js';

const $ = (id) => document.getElementById(id);
const DEMITONS = (hz) => 12 * Math.log2(hz / 440);

/** Au-dessus, un bloc du micro compte comme « on a commencé ». */
const SEUIL_DEPART = 0.02;
/** Écart, en demi-tons, en deçà duquel on est « dans la ligne ». */
const TOLERANCE = 2;

let cv = null;
let ctx = null;
let ref = null;        // { st: (number|null)[], pas, env: number[], pasEnv, duree, med, attaques: number[] }
let fenetre = 2;       // largeur du cadre, en secondes
let bas = -12, haut = 12;
let prise = [];        // [{ t, st|null }]
let t0 = null;         // début du chant, en secondes depuis le « top »
let maintenant = 0;    // curseur, en secondes (référence ou prise)
let mode = 'repos';    // 'lecture' | 'prise' | 'repos'
let revele = false;    // la ligne n'apparaît qu'une fois le son entendu
let anim = 0;

const mediane = (a) => {
  const v = a.filter((x) => x !== null).sort((p, q) => p - q);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

function dimensionner() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = cv.getBoundingClientRect();
  // Caché, le cadre mesure zéro : le redimensionner donnerait une image de
  // dix pixels, étirée en bouillie au réaffichage.
  if (r.width < 2 || r.height < 2) return null;
  const w = Math.max(10, Math.round(r.width * dpr));
  const h = Math.max(10, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w, h, dpr };
}

/** Prépare la courbe d'un son : à appeler au début de chaque manche. */
export function preparer(son) {
  cv = $('courbe');
  ctx = cv.getContext('2d');
  const a = analyserPrise(rendre(son, SR), SR);
  const st = a.hauteurs.map((h) => (h ? DEMITONS(h) : null));
  const med = mediane(st) ?? 0;
  const envMax = Math.max(...a.enveloppe, 1e-9);
  ref = {
    st,
    pas: a.pas,
    env: a.enveloppe.map((v) => v / envMax),
    pasEnv: a.pasEnv,
    duree: a.duree,
    med,
    attaques: a.attaques.map((i) => i * a.pasEnv),
  };
  // Le cadre laisse de la marge après le son : qui chante trop lentement doit
  // VOIR qu'il déborde.
  fenetre = Math.max(1.2, a.duree * 1.3);
  const vals = st.filter((v) => v !== null);
  const lo = vals.length ? Math.min(...vals) : med - 6;
  const hi = vals.length ? Math.max(...vals) : med + 6;
  const milieu = (lo + hi) / 2;
  const demi = Math.max(6, (hi - lo) / 2 + 3);
  bas = milieu - demi; haut = milieu + demi;

  prise = []; t0 = null; maintenant = 0; mode = 'repos'; revele = false;
  montrer(true);
  dessiner();
}

export function montrer(oui) {
  const el = $('courbe-cadre');
  if (el) el.hidden = !oui;
  if (oui) planifier();
}

/** Le son passe : la ligne se dévoile au rythme de la lecture. */
export function lecture() {
  if (!ref) return;
  mode = 'lecture';
  const debut = performance.now();
  cancelAnimationFrame(anim);
  const pas = () => {
    maintenant = (performance.now() - debut) / 1000;
    dessiner();
    if (mode === 'lecture' && maintenant < ref.duree + 0.1) anim = requestAnimationFrame(pas);
    else { mode = 'repos'; revele = true; maintenant = ref.duree; dessiner(); }
  };
  anim = requestAnimationFrame(pas);
}

/** La prise commence : la ligne entière reste visible, la voix s'y ajoute. */
export function demarrerPrise() {
  if (!ref) return;
  cancelAnimationFrame(anim);
  prise = []; t0 = null; maintenant = 0; mode = 'prise'; revele = true;
  dessiner();
}

/** Un bloc du micro : hauteur (ou null), niveau, instant depuis le « top ». */
export function ajouter(hz, rms, t) {
  if (mode !== 'prise') return;
  if (t0 === null) {
    if (rms < SEUIL_DEPART) { maintenant = 0; planifier(); return; }
    t0 = t;
  }
  const st = hz ? DEMITONS(hz) : null;
  prise.push({ t: t - t0, st: rms < SEUIL_DEPART * 0.6 ? null : st });
  maintenant = t - t0;
  planifier();
}

export function figer() {
  mode = 'repos';
  cancelAnimationFrame(anim);
  dessiner();
}

let prevu = false;
function planifier() {
  if (prevu) return;
  prevu = true;
  requestAnimationFrame(() => { prevu = false; dessiner(); });
}

/* ------------------------------------------------------------------ */
/* Dessin                                                              */
/* ------------------------------------------------------------------ */

/** Hauteur de la référence à l'instant t, ou null. */
function refA(t) {
  const i = Math.round(t / ref.pas);
  return i >= 0 && i < ref.st.length ? ref.st[i] : null;
}

function dessiner() {
  if (!cv || !ref) return;
  const taille = dimensionner();
  if (!taille) return;
  const { w, h, dpr } = taille;
  const pad = 10 * dpr;
  const zoneH = h - pad * 2 - 16 * dpr;          // la bande d'énergie en dessous
  const X = (t) => pad + (t / fenetre) * (w - pad * 2);
  const Y = (st) => pad + (1 - (st - bas) / (haut - bas)) * zoneH;
  const baseEnv = h - pad;

  ctx.clearRect(0, 0, w, h);

  // Repères horizontaux : une ligne par octave autour de la médiane.
  ctx.strokeStyle = 'rgba(255,200,255,.07)';
  ctx.lineWidth = 1 * dpr;
  for (let st = Math.ceil(bas / 6) * 6; st < haut; st += 6) {
    ctx.beginPath(); ctx.moveTo(pad, Y(st)); ctx.lineTo(w - pad, Y(st)); ctx.stroke();
  }

  // Fin du son de référence : au-delà, on déborde.
  ctx.setLineDash([4 * dpr, 5 * dpr]);
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath(); ctx.moveTo(X(ref.duree), pad); ctx.lineTo(X(ref.duree), baseEnv); ctx.stroke();
  ctx.setLineDash([]);

  const jusqua = mode === 'lecture' ? maintenant : (revele ? ref.duree : 0);

  // L'énergie de la référence : c'est le rythme, et ses pics sont les attaques.
  ctx.fillStyle = 'rgba(56,189,248,.22)';
  ctx.beginPath();
  ctx.moveTo(X(0), baseEnv);
  for (let i = 0; i < ref.env.length; i++) {
    const t = i * ref.pasEnv;
    if (t > jusqua) break;
    ctx.lineTo(X(t), baseEnv - ref.env[i] * 14 * dpr);
  }
  ctx.lineTo(X(Math.min(jusqua, ref.duree)), baseEnv);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,216,77,.85)';
  for (const t of ref.attaques) {
    if (t > jusqua) break;
    ctx.beginPath(); ctx.arc(X(t), baseEnv + 3 * dpr, 2.6 * dpr, 0, Math.PI * 2); ctx.fill();
  }

  // Le ruban de la référence.
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = mode === 'prise' ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.55)';
  ctx.lineWidth = 9 * dpr;
  trait(ref.st.map((st, i) => ({ t: i * ref.pas, st })).filter((p) => p.t <= jusqua), X, Y);

  // La voix du joueur, recalée sur la médiane de la référence.
  const voix = prise.filter((p) => p.st !== null);
  if (voix.length) {
    const decalage = mediane(voix.map((p) => p.st)) - ref.med;
    ctx.lineWidth = 3.5 * dpr;
    ctx.shadowBlur = 10 * dpr;
    let prec = null;
    for (const p of prise) {
      if (p.st === null) { prec = null; continue; }
      const st = p.st - decalage;
      if (st < bas - 6 || st > haut + 6) { prec = null; continue; }   // octave ratée : on n'affiche pas
      const cible = refA(p.t);
      const juste = cible !== null && Math.abs(st - cible) <= TOLERANCE;
      const couleur = cible === null ? '#c3aede' : (juste ? '#4ade80' : '#ff8a3d');
      if (prec) {
        ctx.strokeStyle = couleur; ctx.shadowColor = couleur;
        ctx.beginPath();
        ctx.moveTo(X(prec.t), Y(Math.max(bas, Math.min(haut, prec.st))));
        ctx.lineTo(X(p.t), Y(Math.max(bas, Math.min(haut, st))));
        ctx.stroke();
      }
      prec = { t: p.t, st };
    }
    ctx.shadowBlur = 0;
    if (prec && mode === 'prise') {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(X(prec.t), Y(Math.max(bas, Math.min(haut, prec.st))), 4.5 * dpr, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Le curseur.
  if (mode !== 'repos') {
    const x = X(Math.min(maintenant, fenetre));
    ctx.strokeStyle = mode === 'prise' ? 'rgba(244,114,182,.8)' : 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, baseEnv); ctx.stroke();
  }
}

/** Trace une ligne en sautant les trous (fenêtres non voisées). */
function trait(points, X, Y) {
  let ouvert = false;
  ctx.beginPath();
  for (const p of points) {
    if (p.st === null) { ouvert = false; continue; }
    const y = Y(Math.max(bas, Math.min(haut, p.st)));
    if (!ouvert) { ctx.moveTo(X(p.t), y); ouvert = true; } else ctx.lineTo(X(p.t), y);
  }
  ctx.stroke();
}

window.addEventListener('resize', () => { if (ref) dessiner(); });
