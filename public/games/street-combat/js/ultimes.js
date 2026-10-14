/**
 * STREET COMBAT — les ultimes des combattants, un par un.
 *
 * Chaque ultime raconte une petite scène en trois temps, calée sur la
 * cinématique du moteur (130 images, le coup à l'image 70) : la charge, le
 * déclenchement, l'impact. Ce que fait le combattant pendant ce temps (ses
 * poses, ses déplacements) est dans choregraphie.js ; le kit de formes
 * (flammes, éclairs, cristaux…) dans anime.js.
 *
 * Un ultime est une fonction (g, t, A, D, k) dessinée par-dessus les
 * combattants, ou { derriere, devant } quand une partie passe derrière eux
 * (le cou du dragon, le serpent qui s'enroule, une faille). A : celui qui
 * frappe (x, y à hauteur de poitrine, dir), D : l'autre ; k : ses couleurs.
 * t est le temps de la cinématique, l'arrêt sur image déjà compté.
 */

import * as K from './anime.js';
import { ARENE } from '../../../shared/street/combat.js';
import { PERSO } from '../../../shared/street/persos.js';
import { dessinerCombattant, rgba } from './dessin.js';
import { texteContour, sceau } from './effets.js';

const L = ARENE.L;
const H = ARENE.H;
const SOL = ARENE.SOL;
const TAU = Math.PI * 2;
const IMPACT = 68;
const lisse = K.lisse;

/** Le serpent de Serpenta, enroulé autour de l'adversaire : `cote` 1 la moitié devant lui, -1 derrière. */
function serpentin(g, t, D, cote) {
  const sort = K.entre(t, 6, 34);
  if (sort <= 0) return;
  const serre = K.entre(t, 34, IMPACT) + (t >= IMPACT ? 0.15 * Math.sin((t - IMPACT) / 2) : 0);
  const fin = 1 - K.entre(t, 104, 128);
  const P = { ...K.POISON, base: '#2aa04a', fonce: '#1e7a34', clair: '#7ae86a' };
  const haut = D.y - 70;
  const n = 46;
  g.save();
  g.globalAlpha *= fin;
  let tete = null;
  for (let i = n - 1; i >= 0; i--) {
    const f = i / (n - 1);
    const a = f * TAU * 2.6 + t / 11;
    const rr = (64 + 8 * Math.sin(f * 9)) * (1 - serre * 0.42) + 30 * (1 - sort);
    const x = D.x + Math.cos(a) * rr;
    const y = SOL - 14 - (SOL - 14 - haut) * (1 - f) * sort + Math.sin(a) * rr * 0.18;
    if (i === 0) tete = { x, y, a };
    if (Math.sign(Math.sin(a)) !== cote && !(cote > 0 && i === 0)) continue;
    const r = 13 + 13 * (1 - f);
    g.fillStyle = P.encre; g.beginPath(); g.arc(x, y, r + 2.5, 0, TAU); g.fill();
    g.fillStyle = i % 4 ? P.base : P.fonce; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = P.clair; g.beginPath(); g.arc(x - r * 0.2, y - r * 0.35, r * 0.4, 0, TAU); g.fill();
    if (i % 4 === 0) { g.fillStyle = '#ffde3a'; g.beginPath(); g.arc(x, y + r * 0.2, r * 0.18, 0, TAU); g.fill(); }
  }
  if (cote > 0 && tete) K.teteSerpent(g, tete.x, tete.y - 20, 34, Math.atan2(D.y - 30 - tete.y, D.x - tete.x) - 0.6, K.entre(t, IMPACT - 10, IMPACT), P, '#ffde3a', 1);
  g.restore();
}

/** L'écho doré d'un combattant (le Premier Héros) : dessiné une fois par pose, puis réutilisé. */
const ECHO = { l: 260, h: 300, x: 130, y: 280 };
const echos = new Map();
function echo(perso, pose, c) {
  const cle = perso.id + pose;
  if (echos.has(cle)) return echos.get(cle);
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = ECHO.l; cv.height = ECHO.h;
  const g = cv.getContext('2d');
  dessinerCombattant(g, perso, { x: ECHO.x, y: ECHO.y, dir: 1, pose, t: 0, p: 0.7, sansOmbre: true });
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = c; g.globalAlpha = 0.55; g.fillRect(0, 0, ECHO.l, ECHO.h);
  echos.set(cle, cv);
  return cv;
}

/** Le cœur d'un trou noir : un disque noir, cerclé de lumière. */
function couche0(g, x, y, r, P) {
  if (r <= 0) return;
  g.fillStyle = P.clair; g.beginPath(); g.arc(x, y, r + 6, 0, TAU); g.fill();
  g.fillStyle = P.coeur; g.beginPath(); g.arc(x, y, r + 2.5, 0, TAU); g.fill();
  g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

export const ULTIMES = {
  /* RYU-KEN : le Shin Hadoken. Les mains en coupe contre la hanche, le ki se rassemble (une aura de
     flammes bleues, des éclats de roche qui se soulèvent, des étincelles aspirées, des arcs), puis il
     pousse les deux paumes : un rayon à bandes, la grande boule, l'explosion bleue. */
  hadoken(g, t, A, D, k) {
    const dir = Math.sign(D.x - A.x) || A.dir || 1;
    const P = K.palette(k.faisceau);
    const hx = A.x - dir * 18, hy = A.y + 30;
    const mx = A.x + dir * 64, my = A.y + 4;
    if (t < 52) {
      const p = Math.min(1, t / 44) * (1 - K.entre(t, 46, 52));
      for (let i = 0; i < 7; i++) {
        const q = ((t * 1.4 + i * 13) % 40) / 40;
        K.eclat(g, A.x + (K.hasard(i) - 0.5) * 130, A.y + 92 - q * 100 * p, 3 + K.hasard(i * 3) * 4, t / 6 + i, K.ROCHE, (1 - q) * p);
      }
      for (let i = 0; i < 22; i++) {
        const ph = ((t * 1.8 + i * 11) % 36) / 36;
        const a = K.hasard(i + 50) * TAU;
        const r = 170 * (1 - ph * ph);
        const x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r * 0.75;
        K.losange(g, x, y, (hx - x) * 0.08, (hy - y) * 0.08, 2.4, P, ph * p);
      }
      const r = 6 + 28 * p + Math.sin(t / 1.6) * 2 * p;
      K.orbe(g, hx, hy, r, t, P, Math.min(1, p * 3));
      for (let e = 0; e < 2; e++) if ((t + e) % 3 === 0) K.foudre(g, hx, hy, hx + Math.cos(t + e * 3) * r * 2.6, hy + Math.sin(t * 1.3 + e) * r * 1.9, 2, P, Math.floor(t / 2) * 7 + e * 13, 1, 0.9 * p);
    }
    if (t >= 46 && t <= IMPACT) {
      const p = lisse((t - 46) / 22);
      const x = mx + (D.x - mx) * p;
      g.save(); g.translate(mx, my); g.scale(dir, 1);
      K.rayon(g, Math.abs(x - mx), 44, t, P);
      g.restore();
      for (let i = 0; i < 8; i++) {
        const yy = my + (K.hasard(i + t) - 0.5) * 170;
        K.losange(g, x - dir * (60 + K.hasard(i * 3 + t) * 140), yy, -dir * 9, 0, 2.2, P, 0.8);
      }
      K.orbe(g, x, my, 64, t, P);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 175, p, P, 11);
      for (let i = 0; i < 14; i++) {
        const q = (t - IMPACT) / 40;
        if (q >= 1) break;
        const a = -Math.PI * (0.1 + 0.8 * K.hasard(i + 3));
        const v = 5 + K.hasard(i * 7) * 8;
        K.eclat(g, D.x + Math.cos(a) * v * q * 40, D.y + 60 + Math.sin(a) * v * q * 40 + q * q * 260, 4 + K.hasard(i) * 5, q * 8 + i, K.ROCHE, 1 - q);
      }
    }
  },
  /* BLAZERO : Meteor Obliteration. Le ciel rougit, Blazero s'élève dans une couronne de flammes, une
     boule de feu grossit au-dessus de ses mains ; une pluie de météores s'abat, puis le géant, et
     l'arène s'embrase. */
  meteores(g, t, A, D, k) {
    const dir = Math.sign(D.x - A.x) || A.dir || 1;
    const leve = 34 * K.entre(t, 8, 30) * (1 - K.entre(t, 92, 116));
    const rouge = K.entre(t, 2, 28) * (1 - K.entre(t, 104, 128));
    const ciel = g.createLinearGradient(0, 0, 0, SOL);
    ciel.addColorStop(0, `rgba(150,12,0,${0.6 * rouge})`); ciel.addColorStop(1, 'rgba(150,12,0,0)');
    g.fillStyle = ciel; g.fillRect(0, 0, L, SOL);
    const ay = A.y - leve;
    if (t < 72) {
      const p = K.entre(t, 0, 20) * (1 - K.entre(t, 62, 72));
      // La boule de feu au-dessus de ses mains.
      const r = 10 + 34 * K.entre(t, 10, 50);
      if (t < 60) K.orbe(g, A.x + dir * 6, ay - 112, r, t, K.FEU, p);
    }
    const meteore = (x, y, vx, vy, r, graine) => {
      g.save(); g.translate(x, y); g.rotate(Math.atan2(-vx, vy));
      K.flamme(g, 0, r * 0.4, r * 5.2, r * 2.4, t, K.FEU, graine);
      K.flamme(g, 0, r * 0.3, r * 3.4, r * 1.5, t + 4, K.FEU, graine + 5, 0.9);
      g.restore();
      // La roche en fusion : une boule de feu, un bloc de roche sombre dessus, ses fissures rougeoyantes.
      K.orbe(g, x, y, r * 1.05, t, K.FEU);
      K.eclat(g, x - r * 0.12, y - r * 0.1, r * 0.72, t / 5 + graine, { ...K.ROCHE, base: '#5a2a18', clair: '#8a4a28' });
      g.strokeStyle = K.FEU.clair; g.lineWidth = Math.max(1.5, r * 0.07); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - r * 0.4, y - r * 0.05); g.lineTo(x - r * 0.05, y + r * 0.12); g.lineTo(x + r * 0.25, y - r * 0.2); g.stroke();
    };
    // La pluie : sept météores, chacun sa chute et son petit cratère de feu.
    for (let i = 0; i < 7; i++) {
      const t0 = 24 + i * 5.5, q = (t - t0) / 14;
      const cx = D.x + (K.hasard(i) - 0.5) * 240;
      const sx = cx - dir * 340, sy = -90;
      if (q > 0 && q < 1) meteore(sx + (cx - sx) * q, sy + (SOL - 14 - sy) * q, (cx - sx) / 14, (SOL - sy) / 14, 15 + K.hasard(i * 3) * 8, i * 3);
      else if (q >= 1 && q < 3) {
        const e = (q - 1) / 2;
        K.explosion(g, cx, SOL - 24, 70, e, K.FEU, i * 9);
        K.onde(g, cx, SOL - 2, 30 + e * 90, 6 * (1 - e) + 1, K.FEU, 1 - e, 0.18);
      }
    }
    // Le géant.
    if (t >= 46 && t <= IMPACT + 3) {
      const q = Math.min(1, (t - 46) / 22);
      const sx = D.x - dir * 460, sy = -260;
      meteore(sx + (D.x - sx) * q, sy + (D.y - sy) * q, (D.x - sx) / 22, (D.y - sy) / 22, 62, 77);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 50;
      K.explosion(g, D.x, D.y + 20, 260, p, K.FEU, 23);
      // L'arène s'embrase : des brasiers jaillissent autour de lui.
      const b = K.entre(t, IMPACT + 4, IMPACT + 14) * (1 - K.entre(t, 112, 130));
      for (const [dx, h] of [[-170, 150], [-80, 210], [80, 190], [180, 140]]) K.brasier(g, D.x + dx, SOL + 4, 70, h * b, t, K.FEU, dx, b, 4);
      for (let i = 0; i < 12; i++) {
        const v = ((t * 4 + i * 29) % 220) / 220;
        K.losange(g, D.x + (K.hasard(i) - 0.5) * 420, SOL - v * 260, Math.sin(t / 6 + i), -4, 2.6, K.FEU, b * (1 - v));
      }
    }
  },
  /* FROSTBYTE : Absolute Zero Glacier. La main au sol, le givre file jusqu'à l'adversaire ; un glacier
     pousse autour de lui et l'enferme ; au coup, tout vole en éclats. */
  zero(g, t, A, D, k) {
    const dir = Math.sign(D.x - A.x) || A.dir || 1;
    const P = K.GLACE;
    const fond = 1 - K.entre(t, 96, 126);
    // Le froid : un voile bleu, des flocons qui tournent autour de lui.
    g.fillStyle = `rgba(190,235,255,${0.16 * K.entre(t, 0, 20) * fond})`; g.fillRect(0, 0, L, H);
    if (t < 50) for (let i = 0; i < 14; i++) {
      const a = t / 8 + i * 0.45;
      const rr = 60 + K.hasard(i) * 70;
      K.eclat(g, A.x + Math.cos(a) * rr, A.y + 20 + Math.sin(a * 1.2) * rr * 0.6, 3 + K.hasard(i * 5) * 3, a * 3, P, K.entre(t, 0, 12) * (1 - K.entre(t, 40, 50)));
    }
    // Le givre file sur le sol.
    const front = A.x + (D.x + dir * 90 - A.x) * K.entre(t, 22, 42);
    if (t >= 22) {
      const x0 = Math.min(A.x, front), x1 = Math.max(A.x, front);
      g.save();
      g.globalAlpha = fond;
      g.fillStyle = P.encre; g.fillRect(x0, SOL - 7, x1 - x0, 12);
      g.fillStyle = P.clair; g.fillRect(x0, SOL - 5, x1 - x0, 8);
      g.fillStyle = P.coeur; g.fillRect(x0, SOL - 5, x1 - x0, 2);
      g.restore();
      for (let x = A.x + dir * 24, i = 0; (x - front) * dir < 0; x += dir * 26, i++) K.cristal(g, x, SOL - 2, (10 + K.hasard(i) * 16) * fond, 9, (K.hasard(i + 4) - 0.5) * 0.8, P);
    }
    // Le glacier : des cristaux géants qui poussent autour de lui, penchés vers lui, et le bloc de glace.
    if (t < IMPACT) {
      for (let i = 0; i < 9; i++) {
        const f = (i - 4) / 4;
        // Plus hauts sur les côtés : on le voit, figé dans son bloc, au milieu.
        const h = (50 + 170 * Math.abs(f) + K.hasard(i) * 40) * K.entre(t, 36 + i * 1.6, 54 + i * 1.6);
        K.cristal(g, D.x + f * 92, SOL + 4, h, 30 + K.hasard(i * 2) * 14, -f * 0.36, P, 0.7);
      }
      const bloc = K.entre(t, 50, 62);
      if (bloc > 0) {
        g.save();
        g.globalAlpha = 0.3 * bloc;
        g.fillStyle = P.clair;
        g.beginPath(); g.moveTo(D.x - 56, SOL); g.lineTo(D.x - 64, D.y - 70); g.lineTo(D.x - 20, D.y - 104); g.lineTo(D.x + 46, D.y - 92); g.lineTo(D.x + 62, D.y - 20); g.lineTo(D.x + 54, SOL); g.closePath(); g.fill();
        g.globalAlpha = bloc;
        g.strokeStyle = P.encre; g.lineWidth = 3; g.stroke();
        g.strokeStyle = P.coeur; g.lineWidth = 2;
        g.beginPath(); g.moveTo(D.x - 40, D.y - 80); g.lineTo(D.x - 10, D.y - 20); g.moveTo(D.x + 30, D.y - 70); g.lineTo(D.x + 44, D.y - 30); g.stroke();
        g.restore();
      }
    } else {
      // Tout vole en éclats : des morceaux de glace, de la neige.
      const q = (t - IMPACT) / 50;
      for (let i = 0; i < 34 && q < 1; i++) {
        const a = -Math.PI * K.hasard(i + 7) - 0.1;
        const v = 4 + K.hasard(i * 3) * 9;
        K.eclat(g, D.x + Math.cos(a) * v * q * 46, D.y + Math.sin(a) * v * q * 46 + q * q * 300, 5 + K.hasard(i) * 9, q * 10 + i, P, 1 - q * q);
      }
      for (let i = 0; i < 6; i++) K.fumee(g, D.x + (K.hasard(i) - 0.5) * 160, D.y + 40 - q * 60, 30 + q * 50, P, 0.7 * (1 - q), i);
    }
  },
  /* THUNDEROX : Lightning Wrath Judgement. Des nuées d'orage roulent au-dessus de l'arène, la foudre
     tombe sur son poing levé et le charge, puis il désigne l'adversaire : six éclairs, et le jugement. */
  foudre(g, t, A, D) {
    const P = K.FOUDRE;
    const orage = K.entre(t, 0, 18) * (1 - K.entre(t, 104, 128));
    for (let i = 0; i < 11; i++) K.fumee(g, (i / 10) * L + Math.sin(t / 30 + i) * 20, 30 + K.hasard(i) * 50 - (1 - orage) * 120, 70 + K.hasard(i * 3) * 40, K.NUAGE, orage, i);
    const poing = { x: A.x + (A.dir || 1) * 8, y: A.y - 130 };
    if (t > 14 && t < 48 && t % 5 < 2) K.foudre(g, poing.x + (K.hasard(t) - 0.5) * 300, 40, poing.x, poing.y, 5, P, t, 1);
    if (t > 14 && t < 50) K.orbe(g, poing.x, poing.y, 14 + 10 * K.entre(t, 14, 40), t, P);
    for (let i = 0; i < 6; i++) {
      const t0 = 44 + i * 4, q = t - t0;
      if (q < 0 || q > 5) continue;
      const x = D.x + (K.hasard(i + 7) - 0.5) * 220;
      K.foudre(g, x + 60, 30, x, SOL, 8, P, i * 11 + Math.floor(t / 2), 2);
      K.etoileImpact(g, x, SOL - 6, 50, t, P, 1 - q / 5, 8);
      if (q < 2) { g.fillStyle = 'rgba(255,248,200,0.18)'; g.fillRect(0, 0, L, H); }
    }
    if (t >= 64 && t <= IMPACT + 8) K.foudre(g, D.x + 40, 0, D.x, D.y + 40, 20, P, Math.floor(t / 2) * 3, 3);
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 44;
      K.explosion(g, D.x, D.y, 190, p, P, 31);
      if (p < 0.7) for (let e = 0; e < 5; e++) K.foudre(g, D.x, D.y, D.x + Math.cos(e * 1.3 + t * 0.2) * 220, D.y + Math.sin(e * 2.1 + t * 0.3) * 140, 4, P, t + e * 9, 1, 1 - p);
    }
  },
  /* IRONCLAD : Omega Maxima Destroyer. Il se plante au sol ; une salve de missiles part de ses épaules,
     puis son canon se charge et lâche un laser rouge qui traverse tout. */
  omega(g, t, A, D) {
    const dir = Math.sign(D.x - A.x) || 1;
    const ROUGE = K.palette('#ff3a3a');
    const missile = (x, y, an) => {
      g.save(); g.translate(x, y); g.rotate(an);
      g.save(); g.rotate(-Math.PI / 2); K.flamme(g, 0, 14, 26, 10, t, K.FEU, an * 7); g.restore();
      g.fillStyle = '#1a1c28'; g.beginPath(); g.roundRect(-16, -6.5, 30, 13, 5); g.fill();
      g.fillStyle = '#d8dce8'; g.beginPath(); g.roundRect(-14, -4.5, 26, 9, 4); g.fill();
      g.fillStyle = '#ff3a3a'; g.beginPath(); g.moveTo(12, -4.5); g.lineTo(22, 0); g.lineTo(12, 4.5); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(-10, -3, 16, 2);
      g.restore();
    };
    for (let i = 0; i < 8; i++) {
      const q = (t - 6 - i * 4) / 24;
      if (q <= 0) continue;
      const cx = D.x + (K.hasard(i) - 0.5) * 140, cy = D.y + (K.hasard(i + 5) - 0.5) * 100;
      if (q < 1) {
        const h = 160 + i * 14;
        const x = A.x + (cx - A.x) * q, y = A.y - 70 + (cy - A.y + 70) * q - Math.sin(q * Math.PI) * h;
        const x2 = A.x + (cx - A.x) * (q + 0.02), y2 = A.y - 70 + (cy - A.y + 70) * (q + 0.02) - Math.sin((q + 0.02) * Math.PI) * h;
        missile(x, y, Math.atan2(y2 - y, x2 - x));
      } else if (q < 2.2) K.explosion(g, cx, cy, 60, (q - 1) / 1.2, K.FEU, i * 5);
    }
    const mx = A.x + dir * 70, my = A.y - 2;
    if (t > 36 && t < 58) K.orbe(g, mx, my, 10 + 26 * K.entre(t, 36, 56), t, ROUGE);
    if (t >= 56 && t < 104) {
      const p = K.entre(t, 56, 62) * (1 - K.entre(t, 92, 104));
      g.save(); g.translate(mx, my); g.scale(dir, 1);
      K.rayon(g, 1100, 54 * p, t, ROUGE, Math.min(1, p * 2));
      g.restore();
      K.orbe(g, mx, my, 40 * p, t, ROUGE);
    }
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 170, (t - IMPACT) / 46, ROUGE, 13);
  },
  /* SERPENTA : Deathly Asphyxia Snake. Un serpent géant jaillit du sol derrière l'adversaire, s'enroule
     autour de lui et serre ; le venin coule ; au coup, il broie et le poison explose. */
  serpent: {
    derriere(g, t, A, D) { serpentin(g, t, D, -1); },
    devant(g, t, A, D) {
      serpentin(g, t, D, 1);
      if (t > 40) for (let i = 0; i < 6; i++) {
        const q = ((t * 1.6 + i * 17) % 40) / 40;
        const x = D.x + (K.hasard(i) - 0.5) * 120;
        K.couches(g, (s) => { g.moveTo(x, D.y - 40 + q * 120 - 9 * s); g.quadraticCurveTo(x + 6 * s, D.y - 40 + q * 120, x, D.y - 40 + q * 120 + 6 * s); g.quadraticCurveTo(x - 6 * s, D.y - 40 + q * 120, x, D.y - 40 + q * 120 - 9 * s); }, K.POISON, [1.3, 1, 0.6, 0.3], 1 - q);
      }
      if (t >= IMPACT) {
        K.explosion(g, D.x, D.y, 170, (t - IMPACT) / 46, K.POISON, 41);
        for (let i = 0; i < 12; i++) {
          const q = ((t - IMPACT) * 1.4 + i * 9) % 60 / 60;
          K.couches(g, (s) => g.arc(D.x + (K.hasard(i) - 0.5) * 240, SOL - q * 200, (5 + K.hasard(i * 3) * 6) * s, 0, TAU), K.POISON, [1.2, 1, 0.6, 0.3], 1 - q);
        }
      }
    },
  },
  /* GRAVOX : Singularity Collapse. Un trou noir s'ouvre au-dessus de l'adversaire et l'aspire, avec les
     pierres de l'arène ; au coup, il s'effondre sur lui-même et explose. */
  singularite(g, t, A, D) {
    const P = K.VIDE;
    const ouv = K.entre(t, 6, 40) * (1 - K.entre(t, IMPACT, IMPACT + 4));
    const cx = D.x, cy = D.y - 120;
    if (ouv > 0) {
      K.lueur(g, cx, cy, 260 * ouv, P.base, 0.5);
      // Le disque d'accrétion : des anneaux en couches qui tournent, écrasés.
      for (let i = 0; i < 4; i++) {
        g.save(); g.translate(cx, cy); g.rotate(-0.2); g.scale(1, 0.26);
        const r = (70 + i * 26) * ouv;
        for (const [c, w] of [[P.encre, 14 - i * 2], [i % 2 ? P.base : P.clair, 9 - i * 1.5], [P.coeur, 2]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, t / 8 + i, t / 8 + i + 4.6); g.stroke(); }
        g.restore();
      }
      // Les pierres et les traits de lumière, aspirés en spirale.
      for (let i = 0; i < 16; i++) {
        const q = ((t * 1.5 + i * 13) % 50) / 50;
        const a = K.hasard(i) * TAU + q * 4;
        const r = 360 * (1 - q);
        if (i % 2) K.eclat(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 5 + K.hasard(i * 3) * 6, t / 5 + i, K.ROCHE, ouv);
        else K.losange(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, -Math.cos(a) * 8, -Math.sin(a) * 5, 2.5, P, ouv);
      }
      couche0(g, cx, cy, 34 * ouv + Math.sin(t / 2) * 2, P);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.onde(g, cx, cy, 300 * (1 - Math.min(1, p * 3)), 8, P, Math.max(0, 1 - p * 3));
      K.explosion(g, D.x, D.y - 40, 200, p, P, 51);
    }
  },
  /* LUNARA : Full Moon Eclipse Doom. La nuit tombe, une pleine lune immense se lève ; Lunara s'élève, la
     lune s'éteint en éclipse, et des croissants de lumière tombent de son anneau. */
  eclipse(g, t, A, D) {
    const P = K.LUNE;
    const nuit = K.entre(t, 0, 24) * (1 - K.entre(t, 104, 128));
    for (let i = 0; i < 24; i++) { g.fillStyle = `rgba(255,255,255,${nuit * (0.4 + 0.6 * K.hasard(i + Math.floor(t / 6)))})`; g.fillRect(K.hasard(i) * L, K.hasard(i * 3) * 280, 2, 2); }
    const lx = L / 2, ly = 150 + (1 - K.entre(t, 0, 30)) * 160;
    K.lune(g, lx, ly, 96, P, nuit);
    const ombre = K.entre(t, 30, 56);
    if (ombre > 0) {
      g.save(); g.globalAlpha = nuit;
      g.fillStyle = '#04040e'; g.beginPath(); g.arc(lx + 200 * (1 - ombre), ly, 98, 0, TAU); g.fill();
      if (ombre >= 1) K.onde(g, lx, ly, 100, 6 + Math.sin(t / 2) * 2, { ...P, base: '#9ab8ff' }, 1);
      g.restore();
    }
    for (let i = 0; i < 9; i++) {
      const q = (t - 50 - i * 2) / 14;
      if (q < 0 || q > 1) continue;
      const a = Math.atan2(D.y - ly, D.x - lx + (i - 4) * 30);
      const x = lx + (D.x + (i - 4) * 18 - lx) * q, y = ly + (D.y - ly) * q;
      g.save(); g.translate(x, y); g.rotate(a); K.croissant(g, 0, 0, 30, { ...P, base: '#b8d0ff' }); g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 40;
      K.explosion(g, D.x, D.y, 170, p, { ...P, base: '#9ab8ff', fonce: '#4a62b8' }, 61);
      g.save(); g.translate(D.x, D.y); K.croissant(g, 0, 0, 120 + p * 200, { ...P, base: '#ffffff' }, Math.max(0, 1 - p * 1.6), 0.2); g.restore();
    }
  },
  /* PYROCLAW : Dragon King Apocalypse. Il rugit ; une tête de dragon géante se dresse derrière lui, ouvre
     la gueule et crache un torrent de feu sur l'adversaire, qui s'embrase. */
  dragon: {
    derriere(g, t, A, D) {
      const dir = Math.sign(D.x - A.x) || 1;
      const monte = K.entre(t, 8, 36) * (1 - K.entre(t, 108, 128));
      if (monte <= 0) return;
      const tx = A.x - dir * 30, ty = A.y - 40 - 120 * monte;
      // Le cou : des écailles qui montent du sol jusqu'à la tête.
      const pts = [];
      for (let i = 0; i < 14; i++) { const f = i / 13; pts.push([tx - dir * f * 120 + Math.sin(f * 5 + t / 8) * 16, ty + f * (SOL - ty + 20)]); }
      K.corpsSerpent(g, pts, 46, K.DRAGON, monte);
      const ouvre = K.entre(t, 34, 44);
      const an = dir > 0 ? Math.atan2(D.y - ty, D.x - tx) * 0.5 : Math.PI - Math.atan2(D.y - ty, tx - D.x) * 0.5;
      g.save(); if (dir < 0) { g.translate(tx, ty); g.scale(1, -1); g.translate(-tx, -ty); }
      K.teteSerpent(g, tx, ty, 56, dir > 0 ? an : -an, ouvre, K.DRAGON, '#ffe23a', monte, true);
      g.restore();
    },
    devant(g, t, A, D) {
      const dir = Math.sign(D.x - A.x) || 1;
      const tx = A.x - dir * 30 + dir * 66, ty = A.y - 160;
      if (t >= 40 && t < 100) {
        // Le souffle : un cône de feu qui s'élargit, ses bords qui ondulent, des boules de feu qui filent dedans.
        const p = K.entre(t, 40, 48) * (1 - K.entre(t, 88, 100));
        const l = Math.hypot(D.x - tx, D.y - ty) * K.entre(t, 40, 50);
        g.save(); g.translate(tx, ty); g.rotate(Math.atan2(D.y - ty, D.x - tx));
        K.couches(g, (s) => {
          g.moveTo(0, -12 * s);
          for (let x = 0; x <= l; x += 14) g.lineTo(x, -(12 + x * 0.32) * s * (1 + 0.1 * Math.sin(x / 16 - t / 1.4)));
          for (let x = l; x >= 0; x -= 14) g.lineTo(x, (12 + x * 0.32) * s * (1 + 0.1 * Math.sin(x / 16 - t / 1.4 + 2)));
          g.closePath();
        }, K.FEU, [1.15, 1, 0.66, 0.32], p);
        for (let i = 0; i < 6; i++) { const f = (t * 0.06 + i / 6) % 1; K.orbe(g, l * f, Math.sin(t / 3 + i) * 10 * f, 10 + f * 26, t + i, K.FEU, p); }
        g.restore();
      }
      if (t >= 58) {
        const b = K.entre(t, 58, 70) * (1 - K.entre(t, 112, 130));
        K.brasier(g, D.x, SOL + 4, 200, 200 * b, t, K.FEU, 7, b, 6);
      }
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 200, (t - IMPACT) / 46, K.DRAGON, 71);
    },
  },
  /* WRAITHBLADE : Thousand Ghost Blade. Il disparaît ; mille entailles fantômes zèbrent l'adversaire de
     tous les côtés ; il réapparaît derrière lui, rengaine — et tout se tranche d'un coup. */
  'mille-lames'(g, t, A, D, k) {
    const P = K.palette(k.faisceau);
    for (let i = 0; i < 30; i++) {
      const q = (t - 10 - i * 1.7) / 10;
      if (q < 0) continue;
      const a = K.hasard(i) * Math.PI;
      const l = 300;
      const cx = D.x + (K.hasard(i * 3) - 0.5) * 50, cy = D.y + (K.hasard(i * 5) - 0.5) * 70;
      const a2 = t < IMPACT ? Math.min(1, q * 3) * (1 - K.entre(q, 0.6, 1.2) * 0.75) : Math.max(0, 1 - (t - IMPACT) / 10);
      if (a2 <= 0) continue;
      const ext = Math.min(1, q * 2.5);
      g.save(); g.translate(cx, cy); g.rotate(a);
      K.couches(g, (s) => { g.moveTo(-l / 2 * ext, 0); g.lineTo(0, -3.5 * s); g.lineTo(l / 2 * ext, 0); g.lineTo(0, 3.5 * s); g.closePath(); }, P, [1.6, 1, 0.5, 0.25], a2);
      g.restore();
    }
    if (t >= IMPACT - 4 && t < IMPACT + 18) {
      const a = 1 - K.entre(t, IMPACT + 6, IMPACT + 18);
      for (const an of [0.5, -0.5]) { g.save(); g.translate(D.x, D.y); g.rotate(an); K.couches(g, (s) => { g.moveTo(-L, 0); g.lineTo(0, -9 * s); g.lineTo(L, 0); g.lineTo(0, 9 * s); g.closePath(); }, P, [1.4, 1, 0.55, 0.3], a); g.restore(); }
    }
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 150, (t - IMPACT) / 40, P, 81);
  },
  /* CELESTIA : Galaxy Meteor Supernova. L'arène plonge dans l'espace ; une galaxie tourne au-dessus de
     l'adversaire, ses étoiles se resserrent en un soleil, qui explose en supernova. */
  supernova(g, t, A, D, k) {
    const P = K.palette(k.c1);
    const espace = K.entre(t, 0, 20) * (1 - K.entre(t, 104, 128));
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${espace * (0.3 + 0.7 * K.hasard(i + Math.floor(t / 5)))})`; g.fillRect(K.hasard(i) * L, K.hasard(i * 7) * H, 2, 2); }
    const serre = K.entre(t, 20, 66);
    const cx = D.x, cy = D.y - 30;
    for (let bras = 0; bras < 3; bras++) {
      for (let i = 0; i < 14; i++) {
        const f = i / 13;
        const a = bras * (TAU / 3) + f * 2.6 + t / 14;
        const r = (60 + f * 300) * (1 - serre * 0.82);
        K.etoileImpact(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45, (7 + (1 - f) * 7) * espace, t / 8 + i, i % 3 ? P : K.OR, espace, 5);
      }
    }
    if (t > 40 && t < IMPACT + 2) K.soleil(g, cx, cy, 16 + 34 * K.entre(t, 40, 66), t, K.palette('#ffe8a0'));
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 50;
      K.explosion(g, cx, cy, 260, p, { ...P, coeur: '#ffffff' }, 91);
      K.onde(g, cx, cy, 40 + p * 520, 12 * (1 - p) + 2, K.OR, 1 - p);
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; const d = p * 380; K.etoileImpact(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 12 * (1 - p), t / 6, K.OR, 1 - p, 5); }
    }
  },
  /* STONEBACK : Tectonic Annihilation. Ses poings frappent le sol ; la terre se fend jusqu'à
     l'adversaire, des piliers de roche jaillissent l'un après l'autre et le soulèvent ; le dernier
     l'écrase dans une gerbe de rochers. */
  tectonique(g, t, A, D) {
    const dir = Math.sign(D.x - A.x) || 1;
    const P = K.ROCHE;
    const LAVE = K.FEU;
    const fend = K.entre(t, 8, 40);
    if (fend > 0) {
      const x1 = A.x + (D.x + dir * 60 - A.x) * fend;
      g.save();
      for (const [c, w] of [[LAVE.encre, 9], [LAVE.base, 5], [LAVE.coeur, 2]]) {
        g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'miter';
        g.beginPath(); g.moveTo(A.x, SOL + 2);
        for (let x = A.x, i = 0; (x - x1) * dir < 0; x += dir * 22, i++) g.lineTo(x, SOL + 2 + (K.hasard(i) - 0.5) * 8);
        g.stroke();
      }
      g.restore();
    }
    for (let i = 0; i < 6; i++) {
      const xi = A.x + dir * (60 + i * ((Math.abs(D.x - A.x) - 30) / 5));
      const h = (70 + i * 26) * K.entre(t, 20 + i * 5, 28 + i * 5) * (1 - K.entre(t, 100, 124));
      K.cristal(g, xi, SOL + 8, h, 40 + i * 4, (K.hasard(i) - 0.5) * 0.3, P);
      if (h > 4) K.fumee(g, xi, SOL - 4, 18 + i * 2, { ...K.SABLE, base: '#b8a080' }, 0.6 * K.entre(t, 20 + i * 5, 26 + i * 5) * (1 - K.entre(t, 30 + i * 5, 44 + i * 5)), i);
    }
    if (t >= 58) {
      const h = 260 * K.entre(t, 58, IMPACT) * (1 - K.entre(t, 104, 128));
      K.cristal(g, D.x, SOL + 10, h, 90, 0, P);
    }
    if (t >= IMPACT) {
      const q = (t - IMPACT) / 50;
      for (let i = 0; i < 22 && q < 1; i++) {
        const a = -Math.PI * K.hasard(i + 3);
        const v = 4 + K.hasard(i * 5) * 9;
        K.eclat(g, D.x + Math.cos(a) * v * q * 50, D.y - 60 + Math.sin(a) * v * q * 50 + q * q * 320, 7 + K.hasard(i) * 10, q * 9 + i, P, 1 - q * q);
      }
      for (let i = 0; i < 6; i++) K.fumee(g, D.x + (K.hasard(i) - 0.5) * 260, SOL - 30 - q * 70, 36 + q * 40, { ...K.SABLE, base: '#b8a080' }, 0.7 * (1 - q), i);
    }
  },
  /* STORMWING : Hurricane Omega Devastation. Il tourne sur lui-même ; un ouragan se lève sur
     l'adversaire, l'emporte, des éclairs dans ses parois ; au coup, il éclate en lames de vent. */
  ouragan(g, t, A, D) {
    const P = K.VENT;
    const force = K.entre(t, 6, 40) * (1 - K.entre(t, IMPACT + 4, IMPACT + 16));
    if (force > 0) {
      for (let i = 0; i < 18; i++) {
        const f = i / 17;
        const y = SOL - f * 430;
        const r = (40 + f * 180) * force;
        const x = D.x + Math.sin(t / 9 + f * 3) * 24;
        g.save(); g.translate(x, y); g.scale(1, 0.24);
        for (const [c, w] of [[P.encre, 12], [i % 2 ? P.base : P.clair, 8], [P.coeur, 2.5]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, t / 3 + i * 0.7, t / 3 + i * 0.7 + 3.4); g.stroke(); }
        g.restore();
      }
      for (let i = 0; i < 10; i++) {
        const q = ((t * 2 + i * 23) % 80) / 80;
        const a = t / 4 + i * 1.7;
        K.eclat(g, D.x + Math.cos(a) * (50 + q * 140) * force, SOL - q * 400, 4 + K.hasard(i) * 5, a, i % 2 ? K.ROCHE : P, force);
      }
      if (t % 9 < 2 && t > 24) K.foudre(g, D.x - 70, 80, D.x + 50, SOL - 160, 4, K.FOUDRE, t, 1, force);
    }
    if (t >= IMPACT) {
      const q = (t - IMPACT) / 30;
      for (let i = 0; i < 10 && q < 1; i++) {
        const a = (i / 10) * TAU;
        g.save(); g.translate(D.x + Math.cos(a) * q * 300, D.y + Math.sin(a) * q * 200); g.rotate(a);
        K.croissant(g, 0, 0, 40, P, 1 - q);
        g.restore();
      }
      K.explosion(g, D.x, D.y, 150, (t - IMPACT) / 40, P, 101);
    }
  },
  /* VOIDREAPER : Dimensional Oblivion Harvest. La nuit violette tombe ; une faille s'ouvre derrière
     l'adversaire, une faux spectrale géante le fauche, son âme est arrachée vers le vide, qui se referme. */
  oubli: {
    derriere(g, t, A, D) {
      const ouv = K.entre(t, 8, 34) * (1 - K.entre(t, IMPACT + 6, IMPACT + 16));
      K.faille(g, D.x + (Math.sign(D.x - A.x) || 1) * 40, D.y - 40, 320, 70 * ouv, t, K.VIDE, 3);
    },
    devant(g, t, A, D) {
      const dir = Math.sign(D.x - A.x) || 1;
      // La faux : son arc balaie l'adversaire.
      if (t >= 36 && t < IMPACT + 10) {
        const p = K.entre(t, 36, IMPACT);
        const a = -2.2 + p * 2.6;
        const cx = D.x - dir * 30, cy = D.y - 160;
        g.save(); g.translate(cx, cy); g.scale(dir, 1); g.rotate(a);
        g.strokeStyle = '#000'; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 300); g.stroke();
        g.strokeStyle = '#3a2418'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 300); g.stroke();
        K.couches(g, (s) => { g.moveTo(0, 0); g.quadraticCurveTo(200 * s, -60 * s, 260 * s, 70 * s); g.quadraticCurveTo(150 * s, 10 * s, 0, 32 * s); g.closePath(); }, K.VIDE, [1.06, 1, 0.75, 0.4], 1 - K.entre(t, IMPACT + 2, IMPACT + 10));
        g.restore();
        if (p > 0.5) K.smear(g, cx, cy + 60, 210, -0.6, 1.4, 40, K.VIDE, (1 - p) * 2);
      }
      // L'âme arrachée, vers la faille.
      if (t >= 44 && t < IMPACT + 20) for (let i = 0; i < 8; i++) {
        const q = ((t - 44) * 1.5 + i * 12) % 50 / 50;
        const x = D.x + dir * q * 40, y = D.y - 20 - q * 60 + Math.sin(q * 9 + i) * 10;
        K.couches(g, (s) => { g.arc(x, y, 9 * s, 0, TAU); g.moveTo(x - 9 * s, y); g.quadraticCurveTo(x - dir * 30 * s, y + 6, x - dir * 40 * s, y); }, { ...K.VIDE, base: '#e8d4ff' }, [1.2, 1, 0.6, 0.3], 1 - q);
      }
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 170, (t - IMPACT) / 46, K.VIDE, 111);
    },
  },
  /* AQUATHORN : Maelstrom Apocalypse Deep. L'eau monte ; un maelström tourne sous l'adversaire et
     l'aspire, des pics d'eau jaillissent ; une vague géante s'écrase sur lui. */
  maelstrom(g, t, A, D) {
    const dir = Math.sign(D.x - A.x) || 1;
    const P = K.EAU;
    const eau = K.entre(t, 0, 24) * (1 - K.entre(t, 104, 128));
    for (let i = 0; i < 5; i++) {
      g.save(); g.translate(D.x, SOL - 6); g.scale(1, 0.22);
      for (const [c, w] of [[P.encre, 12], [i % 2 ? P.base : P.clair, 8], [P.coeur, 2.5]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, (60 + i * 50) * eau, t / 5 + i, t / 5 + i + 4.2); g.stroke(); }
      g.restore();
    }
    for (let i = 0; i < 7; i++) {
      const h = (60 + K.hasard(i) * 120) * K.entre(t, 30 + i * 3, 40 + i * 3) * (1 - K.entre(t, IMPACT, IMPACT + 12));
      K.cristal(g, D.x + (i - 3) * 50, SOL + 6, h, 26, (i - 3) * 0.12, P, 0.9);
    }
    // La vague : elle monte derrière lui puis s'abat.
    if (t >= 46) {
      const q = K.entre(t, 46, IMPACT);
      const fin = 1 - K.entre(t, IMPACT + 8, IMPACT + 30);
      const x0 = D.x - dir * (420 - q * 380), h = 300 * Math.sin(Math.min(1, q * 1.2) * Math.PI * 0.6);
      g.save(); g.globalAlpha = fin;
      K.couches(g, (s) => { g.moveTo(x0 - dir * 260, SOL); g.quadraticCurveTo(x0 - dir * 120, SOL - h * s, x0 + dir * 30 * s, SOL - h * s); g.quadraticCurveTo(x0 + dir * 100 * s, SOL - h * 0.9 * s, x0 + dir * 60 * s, SOL - h * 0.5 * s); g.quadraticCurveTo(x0 + dir * 30, SOL - 30, x0 + dir * 90, SOL); g.closePath(); }, P, [1, 0.92, 0.6, 0.25]);
      for (let i = 0; i < 6; i++) K.fumee(g, x0 + dir * (20 + i * 12), SOL - h + 10 + i * 10, 14 + i * 2, { ...P, base: '#ffffff', fonce: '#c8f0ff' }, 1, i);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 190, p, P, 121);
      for (let i = 0; i < 16; i++) { const q = Math.min(1, p * 1.4); const a = -Math.PI * K.hasard(i); K.couches(g, (s) => g.arc(D.x + Math.cos(a) * q * 260, D.y + Math.sin(a) * q * 200 + q * q * 160, (5 + K.hasard(i) * 6) * s, 0, TAU), P, [1.2, 1, 0.6, 0.3], 1 - q); }
    }
  },
  /* SOLARIUS : Divine Apocalypse. Une lumière dorée envahit tout ; un halo sacré tourne au-dessus de
     l'adversaire, neuf colonnes de lumière s'abattent une à une, des plumes tombent ; puis le jugement. */
  divine(g, t, A, D) {
    const P = K.OR;
    const jour = K.entre(t, 0, 20) * (1 - K.entre(t, 104, 128));
    g.fillStyle = `rgba(255,236,170,${0.28 * jour})`; g.fillRect(0, 0, L, H);
    const hx = D.x, hy = 90;
    g.save(); g.translate(hx, hy); g.scale(1, 0.3);
    K.onde(g, 0, 0, 130 * jour, 8, P, jour);
    K.onde(g, 0, 0, 100 * jour, 4, P, jour);
    g.restore();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + t / 20; K.etoileImpact(g, hx + Math.cos(a) * 130, hy + Math.sin(a) * 39, 9 * jour, t / 9, P, jour, 4); }
    for (let i = 0; i < 9; i++) {
      const q = t - 18 - i * 5;
      if (q < 0) continue;
      const a = Math.min(1, q / 4) * (1 - K.entre(q, 6, 14) * 0.78) * (1 - K.entre(t, 100, 124));
      const x = D.x + (i - 4) * 46;
      g.save(); g.translate(x, -20); g.rotate(Math.PI / 2);
      K.rayon(g, SOL + 20, 15, t + i, P, a);
      g.restore();
      if (q < 8) K.etoileImpact(g, x, SOL - 6, 40, t, P, 1 - q / 8, 8);
    }
    for (let i = 0; i < 10; i++) {
      const q = ((t * 1.2 + i * 19) % 90) / 90;
      const x = D.x + (K.hasard(i) - 0.5) * 360 + Math.sin(q * 8 + i) * 20;
      g.save(); g.translate(x, q * SOL); g.rotate(Math.sin(q * 6 + i) * 0.6);
      K.couches(g, (s) => g.ellipse(0, 0, 12 * s, 4 * s, 0, 0, TAU), { ...P, base: '#fff6d8' }, [1.25, 1, 0.6, 0], jour);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 48;
      K.explosion(g, D.x, D.y, 220, p, P, 131);
      K.couches(g, (s) => { const l = 260 * (1 - p) * s, w = 16 * s; g.rect(D.x - w, D.y - l, w * 2, l * 2); g.rect(D.x - l * 0.7, D.y - w, l * 1.4, w * 2); }, P, [1.2, 1, 0.6, 0.3], Math.max(0, 1 - p * 1.5));
    }
  },
  /* MALVORTEX : Armageddon Abyssal. Le ciel saigne ; un œil de démon géant s'ouvre au-dessus de l'arène,
     des colonnes de feu infernal jaillissent partout, des lances tombent ; l'œil fixe sa proie et tire. */
  armageddon(g, t, A, D) {
    const P = K.ENFER;
    // L'œil.
    const ex = L / 2, ey = 165;
    const ouv = K.entre(t, 14, 34) * (1 - K.entre(t, 104, 120));
    if (ouv > 0) {
      K.lueur(g, ex, ey, 220, P.base, 0.6 * ouv);
      K.couches(g, (s) => { g.moveTo(ex - 140 * s, ey); g.quadraticCurveTo(ex, ey - 90 * ouv * s, ex + 140 * s, ey); g.quadraticCurveTo(ex, ey + 90 * ouv * s, ex - 140 * s, ey); }, { ...P, clair: '#ffe8c8', coeur: '#fff6e0' }, [1.12, 1, 0.86, 0.7]);
      const vise = K.entre(t, 40, 60);
      const px = ex + (D.x - ex) * 0.08 * vise, py = ey + 10 * vise;
      g.fillStyle = P.base; g.beginPath(); g.ellipse(px, py, 40 * ouv, 40 * ouv, 0, 0, TAU); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(px, py, 8, 36 * ouv, 0, 0, TAU); g.fill();
      g.strokeStyle = P.encre; g.lineWidth = 4; g.beginPath(); g.moveTo(ex - 140, ey); g.quadraticCurveTo(ex, ey - 90 * ouv, ex + 140, ey); g.quadraticCurveTo(ex, ey + 90 * ouv, ex - 140, ey); g.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const b = K.entre(t, 16 + i * 4, 26 + i * 4) * (1 - K.entre(t, 100, 124));
      K.brasier(g, 70 + i * 145, SOL + 4, 70, 200 * b, t, P, i * 5, b, 4);
    }
    for (let i = 0; i < 10; i++) {
      const q = (t - 30 - i * 3) / 12;
      if (q < 0 || q > 1.6) continue;
      const x = D.x + (K.hasard(i) - 0.5) * 300;
      if (q <= 1) K.lance(g, x - 40 * (1 - q), -40 + (SOL - 10 + 40) * q, Math.PI / 2 - 0.15, 90, P, 1, '#3a0a0a');
      else K.etoileImpact(g, x, SOL - 10, 36, t, P, (1.6 - q) / 0.6, 8);
    }
    if (t >= 58 && t < IMPACT + 12) {
      const a = Math.atan2(D.y - ey, D.x - ex);
      g.save(); g.translate(ex, ey); g.rotate(a);
      K.rayon(g, Math.hypot(D.x - ex, D.y - ey), 34 * K.entre(t, 58, 64), t, P);
      g.restore();
    }
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 210, (t - IMPACT) / 46, P, 141);
  },
  /* KAÏROS : Chrono-Apocalypse. Le monde se fige, couleur d'ambre ; une horloge géante apparaît, ses
     aiguilles s'emballent puis s'arrêtent net sur minuit ; mille aiguilles d'or frappent l'instant figé. */
  chrono: {
    derriere(g, t, A, D, k) {
      const fige = K.entre(t, 0, 18) * (1 - K.entre(t, 104, 128));
      const cx = L / 2, cy = 230, R = 210 * K.entre(t, 6, 30) * (1 - K.entre(t, IMPACT + 2, IMPACT + 10));
      if (R <= 2) return;
      K.lueur(g, cx, cy, R * 1.3, k.c1, 0.35 * fige);
      K.couches(g, (s) => g.arc(cx, cy, R * s, 0, TAU), { ...K.OR, clair: '#0e3a40', coeur: '#0a2a30' }, [1.06, 1, 0.94, 0.9], 0.9 * fige);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU - Math.PI / 2;
        texteContour(g, ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][i], cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8, Math.max(8, R * 0.1), '#ffd23f', '#1a1206');
      }
      const v = t < 56 ? (t * t) / 40 : 0;
      const ah = t < 56 ? v / 12 : -Math.PI / 2, am = t < 56 ? v : -Math.PI / 2;
      for (const [an, l, w] of [[ah, 0.5, 12], [am, 0.78, 7]]) {
        g.strokeStyle = '#1a1206'; g.lineWidth = w + 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * R * l, cy + Math.sin(an) * R * l); g.stroke();
        g.strokeStyle = '#ffd23f'; g.lineWidth = w;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * R * l, cy + Math.sin(an) * R * l); g.stroke();
      }
      // Les rouages qui tournent sur les côtés.
      for (const [gx, gy, gr, sens] of [[cx - R * 0.95, cy + R * 0.55, R * 0.3, 1], [cx + R, cy - R * 0.5, R * 0.24, -1]]) {
        K.couches(g, (s) => { const n = 10; for (let i = 0; i <= n * 2; i++) { const an = (i / (n * 2)) * TAU + sens * t / 14; const rr = gr * s * (i % 2 ? 0.8 : 1); g[i ? 'lineTo' : 'moveTo'](gx + Math.cos(an) * rr, gy + Math.sin(an) * rr); } g.closePath(); }, K.OR, [1.08, 1, 0.55, 0.25], fige * 0.9);
      }
    },
    devant(g, t, A, D, k) {
      const fige = K.entre(t, 0, 18) * (1 - K.entre(t, 104, 128));
      g.fillStyle = `rgba(255,190,90,${0.14 * fige})`; g.fillRect(0, 0, L, H);
      // Les aiguilles d'or qui convergent sur lui.
      for (let i = 0; i < 14; i++) {
        const q = (t - 40 - i * 1.6) / 10;
        if (q < 0 || q > 1.2) continue;
        const a = (i / 14) * TAU;
        const d = 300 * (1 - Math.min(1, q));
        K.lance(g, D.x + Math.cos(a) * d, D.y + Math.sin(a) * d * 0.6, a + Math.PI, 60, K.OR, Math.min(1, (1.2 - q) * 3), '#fff0a0');
      }
      if (t >= IMPACT) {
        const p = (t - IMPACT) / 46;
        K.explosion(g, D.x, D.y, 180, p, K.OR, 151);
        for (let i = 0; i < 12 && p < 1; i++) {
          const a = K.hasard(i) * TAU;
          K.couches(g, (s) => { const n = 8, gx = L / 2 + Math.cos(a) * p * 400, gy = 230 + Math.sin(a) * p * 300 + p * p * 200; for (let j = 0; j <= n * 2; j++) { const an = (j / (n * 2)) * TAU + t / 4; const rr = 14 * s * (j % 2 ? 0.75 : 1); g[j ? 'lineTo' : 'moveTo'](gx + Math.cos(an) * rr, gy + Math.sin(an) * rr); } g.closePath(); }, K.OR, [1.1, 1, 0.5, 0.2], 1 - p);
        }
      }
    },
  },
  /* ONYX : K.O. Légendaire. Les projecteurs s'allument, les cordes du ring apparaissent, la foule hurle ;
     il fonce, une rafale de directs, puis l'uppercut du champion — K.O. ! */
  ring(g, t, A, D, k) {
    const nuit = K.entre(t, 0, 14) * (1 - K.entre(t, 108, 128));
    // Les projecteurs : deux cônes nets.
    for (const [x, s] of [[150, 1], [850, -1]]) {
      g.save(); g.globalAlpha = 0.35 * nuit; g.fillStyle = '#fff6c8';
      g.beginPath(); g.moveTo(x - 18 * s, 0); g.lineTo(x + 18 * s, 0); g.lineTo(D.x - 40 + 110, SOL); g.lineTo(D.x - 40 - 110, SOL); g.closePath(); g.fill();
      g.restore();
      K.soleil(g, x, 6, 16, t, K.OR, nuit, 10);
    }
    // Les cordes du ring.
    for (let i = 0; i < 3; i++) {
      const y = SOL - 60 - i * 46;
      g.fillStyle = '#000'; g.fillRect(0, y - 4, L, 8);
      g.fillStyle = ['#d8102a', '#ffffff', '#1a4ad8'][i]; g.globalAlpha = nuit; g.fillRect(0, y - 2.5, L, 5); g.globalAlpha = 1;
    }
    // La foule, en ombres chinoises, qui saute ; les flashs des photographes.
    for (let i = 0; i < 26; i++) K.silhouette(g, (i / 25) * L, H + 30 - Math.abs(Math.sin(t / 3 + i)) * 10, 110 + K.hasard(i) * 30, '#06040a', nuit);
    for (let i = 0; i < 6; i++) if ((t + i * 7) % 23 < 2) K.etoileImpact(g, 60 + i * 170, 420 + (i % 2) * 30, 22, t, K.palette('#ffffff'), nuit, 4);
    // Les directs : une étoile d'impact à chaque coup.
    for (let i = 0; i < 10; i++) {
      const t0 = 22 + i * 4;
      if (t < t0 || t > t0 + 5) continue;
      K.etoileImpact(g, D.x - (A.dir || 1) * 20, D.y - 40 + (K.hasard(i) - 0.5) * 80, 40, t, K.OR, 1 - (t - t0) / 5, 8);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 44;
      K.explosion(g, D.x, D.y - 30, 170, p, K.OR, 161);
      for (let i = 0; i < 24; i++) { const q = Math.min(1, p * 1.2); const x = (K.hasard(i) * L); const y = -20 + q * (SOL + 40) * (0.6 + K.hasard(i * 3) * 0.5); g.save(); g.translate(x, y); g.rotate(t / 4 + i); g.fillStyle = ['#ffd23f', '#d8102a', '#1a4ad8', '#ffffff'][i % 4]; g.fillRect(-5, -3, 10, 6); g.restore(); }
      g.save(); g.translate(L / 2, 170); const s = 1 + Math.max(0, 1 - (t - IMPACT) / 8) * 0.8; g.scale(s, s); g.rotate(-0.06);
      texteContour(g, 'K.O. !', 0, 0, 110, '#ffd23f', '#5a0010', 'center', true);
      g.restore();
    }
  },
  /* NÉMÉSIS : Mille Reflets. Des éclats de miroir s'assemblent en sphère autour de l'adversaire ; chacun
     lance son reflet en rayon ; au coup, tout se brise en arc-en-ciel. */
  miroirs(g, t, A, D) {
    const P = K.MIROIR;
    const nuit = K.entre(t, 0, 16) * (1 - K.entre(t, 104, 128));
    const forme = K.entre(t, 6, 40);
    const casse = t >= IMPACT ? (t - IMPACT) / 40 : 0;
    const arc = ['#ff4a4a', '#ffb02a', '#ffe84a', '#4aff7a', '#4ac8ff', '#a05aff'];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + t / 50;
      const rr = (420 - 270 * forme) * (1 + casse * 2);
      const x = D.x + Math.cos(a) * rr, y = D.y - 20 + Math.sin(a) * rr * 0.62 + casse * casse * 200;
      K.cristal(g, x, y, 46, 26, a + Math.PI / 2 + casse * 6, P, nuit * (1 - Math.min(1, casse)));
      if (t > 40 && t < IMPACT && (t + i * 3) % 14 < 3) {
        g.save(); g.translate(x, y); g.rotate(Math.atan2(D.y - y, D.x - x));
        K.rayon(g, Math.hypot(D.x - x, D.y - y), 7, t, K.palette(arc[i % 6]));
        g.restore();
      }
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      arc.forEach((c, i) => K.onde(g, D.x, D.y, 30 + p * (300 + i * 26), 5 * (1 - p) + 1, K.palette(c), 1 - p));
      K.explosion(g, D.x, D.y, 160, p, P, 171);
    }
  },
  /* LE GÉNÉRAL VORN : Assaut de la Légion. Derrière lui, la légion se lève, rang après rang ; il lève
     l'épée : « CHARGEZ ! » ; une pluie de lances s'abat sur l'adversaire. */
  legion: {
    derriere(g, t, A, D, k) {
      const dir = A.dir || 1;
      const leve = K.entre(t, 0, 30) * (1 - K.entre(t, 108, 128));
      for (let rang = 2; rang >= 0; rang--) {
        const avance = K.entre(t, rang * 6, 40 + rang * 6);
        for (let i = 0; i < 10; i++) {
          const x = A.x - dir * (380 - avance * 160) + dir * i * 46 - dir * rang * 24;
          const y = SOL - rang * 12;
          const h = 120 - rang * 10;
          const yy = y + (1 - leve) * 60;
          K.silhouette(g, x, yy, h, rang ? '#1a140a' : '#0c0804', leve);
          g.globalAlpha = leve;
          g.strokeStyle = '#e8d8b0'; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(x + dir * 12, yy - h * 0.3); g.lineTo(x + dir * 22, yy - h * 1.25); g.stroke();
          g.fillStyle = k.c1; g.beginPath(); g.moveTo(x + dir * 23, yy - h * 1.38); g.lineTo(x + dir * 17, yy - h * 1.22); g.lineTo(x + dir * 28, yy - h * 1.24); g.fill();
          g.beginPath(); g.arc(x + dir * 3, yy - h * 0.86, 3, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
      }
    },
    devant(g, t, A, D, k) {
      const P = K.palette(k.c1);
      for (let i = 0; i < 18; i++) {
        const q = (t - 40 - i * 1.4) / 14;
        if (q < 0 || q > 1.5) continue;
        const x = D.x + (K.hasard(i) - 0.5) * 300;
        if (q <= 1) K.lance(g, x - 60 * (1 - q), -60 + (SOL - 8 + 60) * q, Math.PI / 2 - 0.25, 110, P);
        else K.etoileImpact(g, x, SOL - 8, 34, t, P, (1.5 - q) / 0.5, 8);
      }
      if (t > 34 && t < 64) {
        g.save(); g.translate(L / 2, 150); const s = 1 + Math.max(0, 1 - (t - 34) / 6) * 0.6; g.scale(s, s);
        texteContour(g, 'CHARGEZ !', 0, 0, 84, k.c1, '#2a1600', 'center', true);
        g.restore();
      }
      if (t >= IMPACT) {
        const p = (t - IMPACT) / 46;
        K.explosion(g, D.x, D.y, 170, p, P, 181);
        for (let i = 0; i < 6; i++) K.fumee(g, D.x + (K.hasard(i) - 0.5) * 280, SOL - 30 - p * 60, 30 + p * 40, { ...K.SABLE, base: '#a89070' }, 0.7 * (1 - p), i);
      }
    },
  },
  /* SABLIA : Sablier Infini. Une tempête de sable se lève et tourne autour de l'adversaire ; un
     sablier géant se referme sur lui, le sable coule et l'ensevelit ; le verre éclate. */
  'sablier-infini'(g, t, A, D) {
    const P = K.SABLE;
    const tempete = K.entre(t, 0, 20) * (1 - K.entre(t, 104, 128));
    g.fillStyle = `rgba(90,56,16,${0.35 * tempete})`; g.fillRect(0, 0, L, H);
    for (let i = 0; i < 10; i++) {
      const a = t / 9 + i * 0.63;
      const rr = (200 - 60 * K.entre(t, 20, 60)) * (0.6 + 0.4 * K.hasard(i));
      K.fumee(g, D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr * 0.4, 22 + K.hasard(i) * 16, P, 0.75 * tempete, i);
    }
    const f = K.entre(t, 16, 40);
    const casse = t >= IMPACT ? (t - IMPACT) / 34 : 0;
    if (f > 0 && casse < 1) {
      const h = 210, w = 100 * f;
      g.save(); g.translate(D.x, D.y + 70);
      g.globalAlpha = 1 - casse;
      // Le sable : il coule d'en haut, monte en bas.
      const coule = K.entre(t, 34, 66);
      g.fillStyle = P.base;
      g.beginPath(); g.moveTo(-w * (1 - coule), -h * (1 - coule) - 4); g.lineTo(w * (1 - coule), -h * (1 - coule) - 4); g.lineTo(0, -h * 0.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-w, 0); g.lineTo(w, 0); g.lineTo(w * (1 - coule * 0.9), -h * 0.48 * coule); g.lineTo(-w * (1 - coule * 0.9), -h * 0.48 * coule); g.closePath(); g.fill();
      if (coule > 0 && coule < 1) { g.fillStyle = P.clair; g.fillRect(-2, -h * 0.5, 4, h * 0.5); }
      // Le verre, et son cadre d'or.
      g.fillStyle = 'rgba(220,240,255,0.18)'; g.strokeStyle = '#2a1a08'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(-w, -h); g.lineTo(w, -h); g.lineTo(8, -h * 0.5); g.lineTo(w, 0); g.lineTo(-w, 0); g.lineTo(-8, -h * 0.5); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w * 0.7, -h * 0.92); g.lineTo(-w * 0.2, -h * 0.62); g.stroke();
      for (const y of [-h - 12, 0]) K.couches(g, (s) => g.rect(-w * 1.15 * s, y, w * 2.3 * s, 14), K.OR, [1.05, 1, 0.5, 0.2]);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      for (let i = 0; i < 20 && p < 1; i++) { const a = -Math.PI * K.hasard(i); const v = 4 + K.hasard(i * 3) * 8; K.eclat(g, D.x + Math.cos(a) * v * p * 50, D.y + Math.sin(a) * v * p * 50 + p * p * 260, 5 + K.hasard(i) * 7, p * 8 + i, { ...K.MIROIR, base: '#e8f4ff' }, 1 - p); }
      K.explosion(g, D.x, D.y, 190, p, P, 191);
    }
  },
  /* ÉCLIPSE : Éclipse Totale. La lune glisse devant le soleil, la nuit tombe d'un coup ; Éclipse se fond
     dans l'ombre, six lames d'orange traversent le noir ; la couronne du soleil explose. */
  'eclipse-totale'(g, t, A, D) {
    const ORANGE = K.palette('#ff9a3c');
    const sx = L / 2, sy = 140;
    K.soleil(g, sx, sy, 62, t, ORANGE, K.entre(t, 0, 12) * (1 - K.entre(t, 104, 128)));
    const p = K.entre(t, 6, 40);
    g.fillStyle = '#05000a'; g.beginPath(); g.arc(sx - 150 + p * 150, sy, 64, 0, TAU); g.fill();
    if (p >= 1 && t < 104) K.onde(g, sx, sy, 68, 6 + Math.sin(t / 2) * 2, ORANGE, 1);
    for (let i = 0; i < 6; i++) {
      const q = (t - 44 - i * 3.4) / 9;
      if (q < 0 || (q > 1.4 && t < IMPACT) || t >= IMPACT + 14) continue;
      const a = K.hasard(i) * Math.PI - Math.PI / 2;
      const ext = Math.min(1, q * 2);
      const al = t < IMPACT ? Math.max(0.35, 1 - q * 0.5) : 1 - (t - IMPACT) / 14;
      g.save(); g.translate(D.x, D.y); g.rotate(a);
      K.couches(g, (s) => { g.moveTo(-230 * ext, 0); g.lineTo(0, -6 * s); g.lineTo(230 * ext, 0); g.lineTo(0, 6 * s); g.closePath(); }, ORANGE, [1.5, 1, 0.5, 0.25], al);
      g.restore();
    }
    if (t >= IMPACT) {
      const q = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 190, q, ORANGE, 201);
      K.onde(g, sx, sy, 68 + q * 600, 10 * (1 - q) + 2, ORANGE, 1 - q);
    }
  },
  /* HÉMÉRA : L'Aube Éternelle. Le soleil se lève derrière l'arène, ses rayons s'ouvrent en éventail ;
     Héméra s'élève dans la lumière, des pétales dansent ; le premier rayon frappe l'adversaire. */
  'aube-eternelle': {
    derriere(g, t, A, D) {
      const p = K.entre(t, 0, 50) * (1 - K.entre(t, 108, 128));
      const sx = L / 2, sy = SOL - 40 + (1 - p) * 220;
      const gr = g.createLinearGradient(0, H, 0, 0);
      gr.addColorStop(0, `rgba(255,170,90,${0.5 * p})`); gr.addColorStop(1, `rgba(120,60,150,${0.3 * p})`);
      g.fillStyle = gr; g.fillRect(0, 0, L, H);
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI + ((i + 0.5) / 12) * Math.PI;
        g.save(); g.globalAlpha = 0.35 * p; g.fillStyle = i % 2 ? '#ffe0a0' : '#fff4d8';
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - 0.06) * 1000, sy + Math.sin(a - 0.06) * 1000); g.lineTo(sx + Math.cos(a + 0.06) * 1000, sy + Math.sin(a + 0.06) * 1000); g.closePath(); g.fill();
        g.restore();
      }
      K.soleil(g, sx, sy, 90, t, K.palette('#ffc070'), p, 20);
    },
    devant(g, t, A, D) {
      const p = K.entre(t, 0, 50) * (1 - K.entre(t, 108, 128));
      for (let i = 0; i < 14; i++) {
        const q = ((t * 1.1 + i * 17) % 80) / 80;
        const x = (K.hasard(i) * L) + Math.sin(q * 8 + i) * 30;
        g.save(); g.translate(x, q * SOL); g.rotate(q * 6 + i);
        K.couches(g, (s) => g.ellipse(0, 0, 9 * s, 5 * s, 0, 0, TAU), K.palette('#ffb0c8'), [1.25, 1, 0.55, 0], p);
        g.restore();
      }
      if (t >= 52 && t < IMPACT + 10) {
        const sx = L / 2, sy = SOL - 40;
        g.save(); g.translate(sx, sy - 40); g.rotate(Math.atan2(D.y - sy + 40, D.x - sx));
        K.rayon(g, Math.hypot(D.x - sx, D.y - sy + 40), 34 * K.entre(t, 52, 60) * (1 - K.entre(t, IMPACT + 2, IMPACT + 10)), t, K.OR);
        g.restore();
      }
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 210, (t - IMPACT) / 48, K.palette('#ffd090'), 211);
    },
  },
  /* LE PREMIER HÉROS : Mille Boucles. Le temps boucle : ses images d'avant apparaissent tout autour de
     l'adversaire, en or, et frappent toutes ensemble — « ENCORE. » */
  'mille-boucles'(g, t, A, D, k) {
    const sepia = K.entre(t, 0, 18) * (1 - K.entre(t, 104, 128));
    const perso = PERSO[A.id];
    const serre = K.entre(t, 14, 58);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t / 40;
      const rr = 300 - 190 * serre;
      const x = D.x + Math.cos(a) * rr;
      const dir = Math.cos(a) > 0 ? -1 : 1;
      const frappe = t > 44 && (t + i * 4) % 16 < 6;
      const img = perso && echo(perso, frappe ? 'poing' : 'garde', k.c1);
      if (img) { g.save(); g.globalAlpha = 0.6 * sepia; g.translate(x, SOL + Math.sin(a) * 18); g.scale(dir, 1); g.drawImage(img, -ECHO.x, -ECHO.y); g.restore(); }
      if (frappe) K.etoileImpact(g, D.x + dir * -20, D.y - 30 + (K.hasard(i + t) - 0.5) * 60, 28, t, K.OR, 0.8, 8);
    }
    for (let i = 0; i < 3; i++) K.onde(g, D.x, D.y, (80 + i * 40) * (1 - serre * 0.5), 3, K.OR, 0.6 * sepia);
    if (t > 60 && t < 100) {
      g.save(); g.translate(L / 2, 160); const s = 1 + Math.max(0, 1 - (t - 60) / 6) * 0.5; g.scale(s, s);
      texteContour(g, 'ENCORE.', 0, 0, 84, k.c1, '#2a2010', 'center', true);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 180, p, K.OR, 221);
      for (let i = 0; i < 4; i++) K.onde(g, D.x, D.y, 40 + p * (200 + i * 80), 6 * (1 - p) + 1, K.OR, 1 - p);
    }
  },
  /* LE CHAOS : Omega Collapse — tout finit ici. La réalité se fissure sur tout l'écran ; un trou noir
     s'ouvre sur l'adversaire, la foudre violette, tout est aspiré ; le blanc, puis l'effondrement. */
  'omega-collapse'(g, t, A, D) {
    const P = K.VIDE;
    const noir = K.entre(t, 0, 24) * (1 - K.entre(t, 104, 128));
    // Les fissures de la réalité, sur l'écran.
    const fis = K.entre(t, 10, 50);
    g.save();
    for (let i = 0; i < 7; i++) {
      const x0 = K.hasard(i) * L, y0 = K.hasard(i * 3) * H;
      const an = K.hasard(i * 5) * TAU, l = 420 * fis;
      for (const [c, w] of [[P.encre, 7], [P.clair, 3.5], ['#ffffff', 1.2]]) {
        g.strokeStyle = c; g.lineWidth = w; g.globalAlpha = noir;
        g.beginPath(); g.moveTo(x0, y0);
        for (let s = 1; s <= 6; s++) g.lineTo(x0 + Math.cos(an + (K.hasard(i + s) - 0.5) * 0.8) * l * s / 6, y0 + Math.sin(an + (K.hasard(i * 2 + s) - 0.5) * 0.8) * l * s / 6);
        g.stroke();
      }
    }
    g.restore();
    const ouv = K.entre(t, 20, 56) * (1 - K.entre(t, IMPACT, IMPACT + 3));
    if (ouv > 0) {
      for (let e = 0; e < 4; e++) if ((t + e * 2) % 6 < 3) K.foudre(g, D.x, D.y, D.x + Math.cos(e * 1.6 + t * 0.1) * 360, D.y + Math.sin(e * 2.2) * 220, 4, P, t + e * 7, 1, ouv);
      for (let i = 0; i < 14; i++) { const q = ((t * 1.6 + i * 11) % 44) / 44; const a = K.hasard(i) * TAU + q * 3; K.eclat(g, D.x + Math.cos(a) * 400 * (1 - q), D.y + Math.sin(a) * 260 * (1 - q), 5 + K.hasard(i) * 6, t / 4 + i, P, ouv); }
      couche0(g, D.x, D.y, 50 * ouv + Math.sin(t / 2) * 3, P);
    }
    if (t > 30 && t < IMPACT) {
      g.save(); g.translate(L / 2, 120);
      texteContour(g, 'TOUT FINIT ICI.', 0, 0, 60, '#ffffff', '#3a0060', 'center', true);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 50;
      if (t < IMPACT + 12) { g.fillStyle = `rgba(255,255,255,${1 - (t - IMPACT) / 12})`; g.fillRect(0, 0, L, H); }
      K.explosion(g, D.x, D.y, 240, p, P, 231);
      for (let i = 0; i < 18 && p < 1; i++) { const a = K.hasard(i + 40) * TAU; K.cristal(g, D.x + Math.cos(a) * p * 360, D.y + Math.sin(a) * p * 260, 40 * (1 - p), 14, a + Math.PI / 2, P); }
    }
  },
  /* SHADOWKIRA : Void Endmark Executor. Il se fond dans l'ombre ; des ombres noires jaillissent du sol
     et ligotent l'adversaire, une marque en croix s'allume sur lui ; Shadowkira réapparaît derrière lui,
     une seule entaille — la marque explose. */
  vide(g, t, A, D, k) {
    const P = K.OMBRE;
    const lie = K.entre(t, 14, 44) * (1 - K.entre(t, IMPACT, IMPACT + 8));
    for (let i = 0; i < 8; i++) {
      const x = D.x + (i - 3.5) * 22;
      g.save(); g.translate(x, SOL); g.rotate((i - 3.5) * 0.12);
      K.flamme(g, 0, 0, (140 + K.hasard(i) * 90) * lie, 26, t, P, i * 3.1, lie);
      g.restore();
    }
    const marque = K.entre(t, 40, 52);
    if (marque > 0 && t < IMPACT + 2) {
      for (const an of [Math.PI / 4, -Math.PI / 4]) { g.save(); g.translate(D.x, D.y - 10); g.rotate(an); K.couches(g, (s) => g.rect(-60 * marque, -7 * s, 120 * marque, 14 * s), K.palette(k.c1), [1.4, 1, 0.5, 0.2], 1); g.restore(); }
      K.lueur(g, D.x, D.y - 10, 90, k.c1, 0.6);
    }
    if (t >= 58 && t < IMPACT + 12) {
      const q = K.entre(t, 58, 64);
      const al = t < IMPACT ? 1 : 1 - (t - IMPACT) / 12;
      g.save(); g.translate(D.x, D.y - 20); g.rotate(-0.2);
      K.couches(g, (s) => { g.moveTo(-L * q, 0); g.lineTo(0, -8 * s); g.lineTo(L * q, 0); g.lineTo(0, 8 * s); g.closePath(); }, K.palette(k.c1), [1.4, 1, 0.5, 0.25], al);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 200, p, { ...P, clair: k.c1 }, 241);
      for (let i = 0; i < 8; i++) { g.save(); g.translate(D.x, SOL); g.rotate((i - 3.5) * 0.3); K.flamme(g, 0, 0, 220 * (1 - p), 30, t, P, i, 1 - p); g.restore(); }
    }
  },
  /* MAMBA ROJA : Diablo Rojo Suplex. Les cordes du ring et la foule surgissent ; il fonce, empoigne,
     s'envole au-dessus des cordes sous les flashs… et retombe de tout son poids : le ring tremble. */
  luchador(g, t, A, D, k) {
    const nuit = K.entre(t, 0, 12) * (1 - K.entre(t, 108, 128));
    // Les cordes rouges et or, les poteaux des coins.
    g.save(); g.globalAlpha = nuit;
    for (let i = 0; i < 3; i++) {
      const y = SOL - 52 - i * 44 + (t >= IMPACT && t < IMPACT + 14 ? Math.sin((t - IMPACT) * 1.6) * 6 * (1 - (t - IMPACT) / 14) : 0);
      g.fillStyle = '#000'; g.fillRect(0, y - 4, L, 8);
      g.fillStyle = i % 2 ? k.c2 : k.c1; g.fillRect(0, y - 2.5, L, 5);
    }
    for (const x of [26, L - 26]) { g.fillStyle = '#1a1018'; g.fillRect(x - 9, SOL - 176, 18, 176); g.fillStyle = k.c2; g.fillRect(x - 12, SOL - 182, 24, 12); }
    g.restore();
    // La foule en ombres chinoises qui saute, les flashs des photographes.
    for (let i = 0; i < 26; i++) K.silhouette(g, (i / 25) * L, H + 30 - Math.abs(Math.sin(t / 2.6 + i)) * 12, 110 + K.hasard(i + 40) * 30, '#06040a', nuit);
    for (let i = 0; i < 7; i++) if ((t + i * 5) % 19 < 2) K.etoileImpact(g, 50 + i * 150, 430 + (i % 2) * 30, 20, t, K.palette('#ffffff'), nuit, 4);
    // Dans les airs : un projecteur sur lui, une traînée de flammes rouges.
    if (t > 20 && t < IMPACT) {
      const dir = Math.sign(D.x - A.x) || A.dir || 1;
      const x = D.x - dir * 40;
      const h = 150 * Math.sin(Math.PI * Math.min(1, (t - 18) / 50));
      g.save(); g.globalAlpha = 0.3 * nuit; g.fillStyle = '#fff6c8';
      g.beginPath(); g.moveTo(x - 14, 0); g.lineTo(x + 14, 0); g.lineTo(x + 70, D.y - h + 120); g.lineTo(x - 70, D.y - h + 120); g.closePath(); g.fill();
      g.restore();
      // En retombant : une traînée de flammes au-dessus de lui (sans le cacher).
      if (t > 50) for (let i = 0; i < 5; i++) K.flamme(g, x - dir * 20 + (i - 2) * 14, D.y - h - 80, 50 + i * 5, 18, t, K.palette(k.c1), i, 0.75);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, SOL - 30, 180, p, K.palette(k.c1), 301);
      for (let i = 0; i < 8; i++) K.fumee(g, D.x + (K.hasard(i) - 0.5) * 320, SOL - 20 - p * 50, 30 + p * 40, K.FUMEE, 0.75 * (1 - p), i);
      // Les confettis or et rouges, et le cri.
      for (let i = 0; i < 26; i++) { const x = K.hasard(i + 9) * L; const y = -20 + Math.min(1, p * 1.2) * (SOL + 40) * (0.6 + K.hasard(i * 3) * 0.5); g.save(); g.translate(x, y); g.rotate(t / 4 + i); g.fillStyle = [k.c1, k.c2, '#ffffff'][i % 3]; g.fillRect(-5, -3, 10, 6); g.restore(); }
      g.save(); g.translate(L / 2, 160); const s = 1 + Math.max(0, 1 - (t - IMPACT) / 8) * 0.8; g.scale(s, s); g.rotate(-0.07);
      texteContour(g, '¡OLÉ !', 0, 0, 110, k.c2, '#5a0010', 'center', true);
      g.restore();
    }
  },
  /* GRAFF : Mural Masterpiece. Il dégaine ses bombes : des traînées de toutes les couleurs couvrent le mur
     derrière l'adversaire, son nom s'y écrit en lettres bulles… puis tout lui explose dessus. */
  fresque: {
    derriere(g, t, A, D, k) {
      const peint = K.entre(t, 8, 56);
      const fin = 1 - K.entre(t, 104, 128);
      const couleurs = ['#ff3ad0', '#2ae8a0', '#ffd23f', '#3ab8ff', '#ff6a3a'];
      // Les grandes traînées de peinture, qui se déroulent l'une après l'autre.
      for (let i = 0; i < 5; i++) {
        const q = K.entre(peint, i * 0.14, i * 0.14 + 0.36);
        if (q <= 0) continue;
        const y = 120 + i * 58;
        g.save(); g.globalAlpha = 0.9 * fin;
        g.strokeStyle = '#10081a'; g.lineWidth = 46; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-20, y); for (let x = 0; x <= L * q; x += 40) g.lineTo(x, y + Math.sin(x / 90 + i) * 26); g.stroke();
        g.strokeStyle = couleurs[i]; g.lineWidth = 38;
        g.beginPath(); g.moveTo(-20, y); for (let x = 0; x <= L * q; x += 40) g.lineTo(x, y + Math.sin(x / 90 + i) * 26); g.stroke();
        // Les coulures.
        g.lineWidth = 6;
        for (let c = 0; c < 6; c++) { const x = (K.hasard(i * 7 + c) * L) * q; g.beginPath(); g.moveTo(x, y + 14); g.lineTo(x, y + 14 + 50 * q * K.hasard(c + i)); g.stroke(); }
        g.restore();
      }
      // Le nom, en lettres bulles.
      const nom = K.entre(t, 36, 60);
      if (nom > 0) {
        g.save(); g.globalAlpha = fin; g.translate(L / 2, 230); g.rotate(-0.08); g.scale(0.6 + 0.4 * nom, 0.6 + 0.4 * nom);
        texteContour(g, 'GRAFF !', 0, 0, 150, '#ffd23f', '#ff3ad0', 'center', true);
        g.restore();
      }
    },
    devant(g, t, A, D, k) {
      const dir = Math.sign(D.x - A.x) || A.dir || 1;
      // Le jet des bombes, de sa main vers le mur.
      if (t > 6 && t < 60) {
        for (let i = 0; i < 16; i++) {
          const q = ((t * 2 + i * 7) % 30) / 30;
          const P = K.palette(['#ff3ad0', '#2ae8a0', '#ffd23f', '#3ab8ff'][i % 4]);
          K.couches(g, (s) => g.arc(A.x + dir * (40 + q * 260), A.y - 10 - q * (80 + K.hasard(i) * 120), (5 + q * 9) * s, 0, TAU), P, [1.2, 1, 0.5, 0], 1 - q);
        }
      }
      if (t >= IMPACT) {
        const p = (t - IMPACT) / 46;
        for (let i = 0; i < 14; i++) {
          const a = K.hasard(i + 3) * TAU, v = 0.4 + K.hasard(i * 5) * 0.8;
          const P = K.palette(['#ff3ad0', '#2ae8a0', '#ffd23f', '#3ab8ff'][i % 4]);
          K.couches(g, (s) => g.arc(D.x + Math.cos(a) * v * p * 260, D.y + Math.sin(a) * v * p * 200 + p * p * 120, (26 - p * 14) * s, 0, TAU), P, [1.12, 1, 0.55, 0.2], 1 - p * 0.6);
        }
      }
    },
  },
  /* SYLVA : Colère de la Forêt. La terre se fend, des racines géantes surgissent et l'enserrent ; un
     arbre immense pousse derrière elle ; au coup, les lianes serrent et tout fleurit d'un coup. */
  foret: {
    derriere(g, t, A, D) {
      const pousse = K.entre(t, 4, 50);
      const fin = 1 - K.entre(t, 106, 128);
      if (pousse <= 0) return;
      // L'arbre : un tronc noueux, une couronne de feuilles en couches.
      const x = A.x - (A.dir || 1) * 120;
      const h = 380 * pousse;
      const BOIS = { encre: '#1e1006', fonce: '#4a2a12', base: '#6a4020', clair: '#9a6a3a', coeur: '#c89a6a' };
      K.couches(g, (s) => { g.moveTo(x - 40 * s, SOL); g.quadraticCurveTo(x - 20 * s, SOL - h * 0.5, x - 14 * s, SOL - h); g.lineTo(x + 14 * s, SOL - h); g.quadraticCurveTo(x + 22 * s, SOL - h * 0.5, x + 40 * s, SOL); g.closePath(); }, BOIS, [1, 0.8, 0.3, 0], fin);
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.36;
        const P = K.palette(i % 2 ? '#3aa84a' : '#5ad84a');
        K.couches(g, (s) => g.arc(x + Math.cos(a) * 110 * pousse, SOL - h + Math.sin(a) * 70 * pousse + 30, 70 * pousse * s, 0, TAU), P, [1.06, 1, 0.55, 0.15], fin);
      }
    },
    devant(g, t, A, D) {
      const P = K.palette('#2e9a3a');
      const serre = K.entre(t, 24, IMPACT);
      const fin = 1 - K.entre(t, 106, 128);
      // Les racines qui sortent du sol et s'enroulent autour de lui.
      for (let i = 0; i < 6; i++) {
        const s = i % 2 ? 1 : -1;
        const sort = K.entre(t, 8 + i * 3, 30 + i * 3);
        if (sort <= 0) continue;
        const x0 = D.x + s * (90 - serre * 40) + (i - 2.5) * 10;
        const top = SOL - (SOL - D.y + 70) * sort;
        for (const [c, w] of [[P.encre, 16], [P.base, 11], [P.clair, 3]]) {
          g.strokeStyle = c; g.lineWidth = w * fin; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x0, SOL + 6); g.bezierCurveTo(x0 - s * 60, SOL - 80 * sort, D.x + s * 70 * (1 - serre), top + 60, D.x - s * 40 * (1 - serre * 0.5), top); g.stroke();
        }
      }
      // Les feuilles qui tourbillonnent.
      for (let i = 0; i < 18; i++) {
        const a = t / 9 + i * 0.7;
        const rr = 90 + K.hasard(i) * 120;
        g.save(); g.translate(D.x + Math.cos(a) * rr, D.y + Math.sin(a * 1.3) * rr * 0.5); g.rotate(a * 2);
        K.couches(g, (s) => { g.moveTo(-9 * s, 0); g.quadraticCurveTo(0, -6 * s, 9 * s, 0); g.quadraticCurveTo(0, 6 * s, -9 * s, 0); }, K.palette(i % 3 ? '#5ad84a' : '#ffe066'), [1.15, 1, 0.4, 0], fin * K.entre(t, 10, 30));
        g.restore();
      }
      if (t >= IMPACT) {
        // Tout fleurit : une gerbe de pétales roses.
        const p = (t - IMPACT) / 46;
        for (let i = 0; i < 30; i++) {
          const a = K.hasard(i + 11) * TAU, v = 0.3 + K.hasard(i * 3) * 0.9;
          const x = D.x + Math.cos(a) * v * p * 340, y = D.y + Math.sin(a) * v * p * 240 + p * p * 160;
          g.fillStyle = i % 4 ? '#ff8ad8' : '#ffe066';
          g.save(); g.translate(x, y); g.rotate(t / 5 + i); g.globalAlpha = 1 - p;
          g.beginPath(); g.ellipse(0, 0, 7, 4, 0, 0, TAU); g.fill(); g.restore();
        }
        K.explosion(g, D.x, D.y, 150, p, K.palette('#8aff5a'), 311);
      }
    },
  },
  /* ÉCHO : Final Drop. Deux enceintes géantes montent du sol, les projecteurs balaient la scène, le
     public saute ; le son monte, monte… et au drop, les basses soufflent tout. */
  enceintes(g, t, A, D, k) {
    const monte = K.entre(t, 0, 22) * (1 - K.entre(t, 108, 128));
    const P1 = K.palette(k.c1), P2 = K.palette(k.c2);
    // Les projecteurs colorés qui balaient.
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(t / 12 + i * 1.7) * 0.5;
      g.save(); g.translate(150 + i * 230, 0); g.rotate(a); g.globalAlpha = 0.22 * monte;
      g.fillStyle = i % 2 ? k.c1 : k.c2; g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.lineTo(90, SOL); g.lineTo(-90, SOL); g.closePath(); g.fill();
      g.restore();
    }
    // Les deux enceintes, leurs membranes qui battent la mesure.
    const bat = t >= IMPACT ? 1 + Math.max(0, 1 - (t - IMPACT) / 10) * 0.4 : 1 + Math.abs(Math.sin(t / 3)) * 0.08 * (t / IMPACT);
    for (const x of [90, L - 90]) {
      const y = SOL - 230 * monte;
      g.fillStyle = '#06040c'; g.beginPath(); g.roundRect(x - 74, y - 4, 148, 238, 12); g.fill();
      g.fillStyle = '#1a1626'; g.beginPath(); g.roundRect(x - 70, y, 140, 230, 10); g.fill();
      for (const [cy, r] of [[y + 60, 40], [y + 160, 54]]) {
        g.fillStyle = '#0a0812'; g.beginPath(); g.arc(x, cy, r * bat + 4, 0, TAU); g.fill();
        g.fillStyle = '#2a2638'; g.beginPath(); g.arc(x, cy, r * bat, 0, TAU); g.fill();
        g.strokeStyle = k.c1; g.lineWidth = 3; g.beginPath(); g.arc(x, cy, r * bat * 0.75, 0, TAU); g.stroke();
        g.fillStyle = '#0a0812'; g.beginPath(); g.arc(x, cy, r * 0.28, 0, TAU); g.fill();
      }
      K.lueur(g, x, y + 110, 120, k.c1, 0.3 * monte);
    }
    // L'égaliseur au sol, qui grimpe jusqu'au drop.
    for (let i = 0; i < 24; i++) {
      const h = (20 + 120 * Math.abs(Math.sin(t / 2.5 + i * 0.7)) * Math.min(1, t / IMPACT)) * monte;
      g.fillStyle = rgba(i % 2 ? k.c1 : k.c2, 0.75); g.fillRect(170 + i * 28, SOL - h, 20, h);
    }
    // Les notes qui tourbillonnent autour de l'adversaire.
    for (let i = 0; i < 10; i++) {
      const a = t / 8 + i * 0.63, rr = 140 - 70 * K.entre(t, 20, IMPACT);
      const x = D.x + Math.cos(a) * rr, y = D.y + Math.sin(a) * rr * 0.6;
      K.couches(g, (s) => g.ellipse(x, y, 9 * s, 7 * s, -0.4, 0, TAU), i % 2 ? P1 : P2, [1.2, 1, 0.5, 0], monte);
      g.fillStyle = (i % 2 ? P1 : P2).encre; g.fillRect(x + 6, y - 26, 3, 26);
    }
    if (t > 44 && t < IMPACT) {
      g.save(); g.translate(L / 2, 140); const s = 1 + Math.sin(t) * 0.04; g.scale(s, s);
      texteContour(g, t < 56 ? '3… 2… 1…' : 'DROP !', 0, 0, 80, k.c1, '#14002a', 'center', true);
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      for (let i = 0; i < 6; i++) K.onde(g, D.x, D.y, 30 + p * (220 + i * 90), 12 * (1 - p) + 2, i % 2 ? P1 : P2, 1 - p);
      K.explosion(g, D.x, D.y, 170, p, P1, 321);
    }
  },
  /* ORIGAMI : Mille Grues de Papier. Une nuée de grues de papier se plie dans l'air et tourne autour
     d'elle, puis fond sur l'adversaire en rivière ; au coup, une grue géante s'envole des confettis. */
  'mille-grues'(g, t, A, D, k) {
    const dir = Math.sign(D.x - A.x) || A.dir || 1;
    const papier = { encre: '#5a1a28', base: '#fff6e8', clair: '#ffffff', coeur: '#ffffff' };
    const rouge = { ...papier, base: k.c1 };
    const grue = (x, y, r, an, bat, P, a = 1) => {
      g.save(); g.translate(x, y); g.rotate(an); if (Math.cos(an) < 0) g.scale(1, -1);
      K.couches(g, (s) => { g.moveTo(-r * 0.9 * s, 0); g.lineTo(-r * 0.2, -r * 1.3 * bat * s); g.lineTo(r * 0.4 * s, 0); g.closePath(); }, papier, [1.1, 1, 0, 0], a);
      K.couches(g, (s) => { g.moveTo(-r * 1.4 * s, -r * 0.5); g.lineTo(-r * 0.2, r * 0.3 * s); g.lineTo(r * 1.5 * s, -r * 0.7); g.lineTo(r * 0.4, r * 0.25 * s); g.closePath(); }, P, [1.1, 1, 0.5, 0], a);
      g.restore();
    };
    const fin = 1 - K.entre(t, 104, 128);
    for (let i = 0; i < 40; i++) {
      const ph = K.hasard(i) * TAU;
      const plonge = K.entre(t, 40 + (i % 10) * 2, 64 + (i % 10) * 2);
      // D'abord une spirale autour d'elle, puis une rivière vers l'adversaire.
      const a = t / 12 + ph, rr = 90 + (i % 5) * 26;
      const sx = A.x + Math.cos(a) * rr, sy = A.y - 40 + Math.sin(a) * rr * 0.55 - (i % 7) * 10;
      const x = sx + (D.x - sx) * plonge, y = sy + (D.y - sy) * plonge + Math.sin(plonge * Math.PI) * -60;
      const an = plonge > 0 ? Math.atan2(D.y - sy, D.x - sx) : a + Math.PI / 2;
      if (t >= IMPACT + 4 && plonge >= 1) continue;
      grue(x, y, 10 + (i % 3) * 3, an, Math.sin(t / 2 + i), i % 4 ? papier : rouge, K.entre(t, i * 0.6, i * 0.6 + 8) * fin);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      for (let i = 0; i < 40; i++) {
        const a = K.hasard(i + 5) * TAU, v = 0.3 + K.hasard(i * 3) * 0.9;
        g.save(); g.translate(D.x + Math.cos(a) * v * p * 320, D.y + Math.sin(a) * v * p * 220 + p * p * 140); g.rotate(t / 3 + i);
        g.fillStyle = i % 3 ? '#fff6e8' : k.c1; g.globalAlpha = 1 - p; g.fillRect(-5, -4, 10, 8); g.restore();
      }
      // La grue géante s'envole.
      grue(D.x + dir * 40, D.y - 60 - p * 220, 70, -Math.PI / 2 + 0.3 * dir, Math.sin(t / 3), rouge, Math.min(1, (t - IMPACT) / 8) * (1 - K.entre(t, 112, 128)));
    }
  },
  /* AIMANTA : Polarité Absolue. Deux pôles géants s'allument de part et d'autre, rouge et bleu ; le champ
     arrache tout le métal de l'arène vers l'adversaire, soulevé ; au coup, les deux aimants claquent. */
  polarite(g, t, A, D, k) {
    const monte = K.entre(t, 0, 20) * (1 - K.entre(t, 106, 128));
    const serre = K.entre(t, 36, IMPACT);
    // Les deux pôles : N tombe du ciel, S sort du sol, de part et d'autre de l'adversaire (soulevé).
    const cy = D.y - 25;
    const ecart = 300 - 205 * serre;
    const haut = cy - ecart, bas = cy + ecart * 0.62;
    // Les lignes de champ entre les deux pôles.
    g.save(); g.globalAlpha = monte * 0.8;
    for (let i = 0; i < 7; i++) {
      g.strokeStyle = i % 2 ? k.c1 : k.c2; g.lineWidth = 3; g.setLineDash([16, 10]); g.lineDashOffset = t * 4;
      for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(D.x + s2 * 50, haut + 30); g.bezierCurveTo(D.x + s2 * (70 + i * 28), haut + 60, D.x + s2 * (70 + i * 28), bas - 60, D.x + s2 * 50, bas - 30); g.stroke(); }
    }
    g.setLineDash([]); g.restore();
    // Le métal arraché du sol, qui file vers lui.
    for (let i = 0; i < 18; i++) {
      const q = ((t * 1.4 + i * 9) % 40) / 40;
      const x0 = K.hasard(i) * L, x = x0 + (D.x - x0) * q * serre * 1.4, y = SOL - q * (SOL - D.y) * Math.min(1, t / 30);
      K.eclat(g, x, y, 6 + K.hasard(i + 3) * 6, t / 4 + i, { encre: '#1a1a24', fonce: '#5a5a6a', base: '#9a9aaa', clair: '#e0e0ea', coeur: '#ffffff' }, monte * (1 - q * 0.3));
    }
    // Les deux aimants géants qui se rapprochent… et claquent.
    for (const [s, c, lettre, y] of [[-1, k.c1, 'N', haut], [1, k.c2, 'S', bas]]) {
      g.save(); g.translate(D.x, y); g.rotate(s < 0 ? Math.PI : 0); g.globalAlpha = monte;
      g.strokeStyle = '#10081a'; g.lineWidth = 50; g.beginPath(); g.arc(0, -10, 54, 0, Math.PI); g.stroke();
      g.strokeStyle = c; g.lineWidth = 40; g.beginPath(); g.arc(0, -10, 54, 0, Math.PI); g.stroke();
      g.fillStyle = '#e0e4ee'; g.fillRect(-76, -40, 44, 32); g.fillRect(32, -40, 44, 32);
      g.restore();
      K.lueur(g, D.x, y, 110, c, 0.4 * monte);
      g.save(); g.globalAlpha = monte; texteContour(g, lettre, D.x + 110, y - s * 30, 54, c, '#10081a'); g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 170, p, K.palette('#c8a0ff'), 331);
      for (let i = 0; i < 12; i++) K.foudre(g, D.x, D.y, D.x + Math.cos(i) * 200 * p, D.y + Math.sin(i * 1.7) * 140 * p, 3, K.palette(i % 2 ? k.c1 : k.c2), t + i, 1, 1 - p);
    }
  },
  /* JACKPOT : Jackpot Royal. Une machine à sous géante s'allume derrière l'adversaire ; les rouleaux
     tournent, s'arrêtent un à un : 7… 7… 7 ! La machine crache une pluie de pièces et de cartes sur lui. */
  jackpot: {
    derriere(g, t, A, D, k) {
      const monte = K.entre(t, 0, 18) * (1 - K.entre(t, 106, 128));
      if (monte <= 0) return;
      const x = D.x, y = 80 + (1 - monte) * -300;
      g.save(); g.globalAlpha = monte;
      // La caisse dorée, ses ampoules qui clignotent.
      g.fillStyle = '#2a0a10'; g.beginPath(); g.roundRect(x - 190, y - 6, 380, 250, 26); g.fill();
      const caisse = g.createLinearGradient(0, y, 0, y + 240); caisse.addColorStop(0, '#ffe680'); caisse.addColorStop(1, '#b8820a');
      g.fillStyle = caisse; g.beginPath(); g.roundRect(x - 184, y, 368, 238, 22); g.fill();
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU;
        const bx = x + Math.cos(a) * 196, by = y + 118 + Math.sin(a) * 128;
        g.fillStyle = (Math.floor(t / 3) + i) % 2 ? '#ffffff' : '#d8102a'; g.beginPath(); g.arc(bx, by, 5, 0, TAU); g.fill();
      }
      // Les trois rouleaux.
      const arrets = [34, 44, 54];
      for (let r = 0; r < 3; r++) {
        const rx = x - 116 + r * 116;
        g.fillStyle = '#1a0a10'; g.fillRect(rx - 50, y + 40, 100, 140);
        g.fillStyle = '#fffaf0'; g.fillRect(rx - 46, y + 44, 92, 132);
        g.save(); g.beginPath(); g.rect(rx - 46, y + 44, 92, 132); g.clip();
        if (t < arrets[r]) {
          const sym = ['🍒', '🔔', '7', '🍋', '💎'];
          for (let s = -1; s <= 2; s++) { const off = ((t * 22) % 60); g.font = '900 52px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#b0102a'; g.fillText(sym[(Math.floor(t * 0.4) + s + r * 2 + 50) % sym.length], rx, y + 110 + s * 60 - off + 30); }
        } else {
          const rebond = Math.max(0, 1 - (t - arrets[r]) / 6) * 10;
          texteContour(g, '7', rx, y + 110 + rebond, 92, '#d8102a', '#3a0008');
        }
        g.restore();
      }
      g.restore();
    },
    devant(g, t, A, D, k) {
      if (t >= 54 && t < IMPACT + 30) {
        g.save(); g.translate(L / 2, 380); const s = 1 + Math.max(0, 1 - (t - 54) / 6) * 0.7; g.scale(s, s); g.rotate(-0.05);
        texteContour(g, 'JACKPOT !', 0, 0, 96, '#ffd23f', '#5a0010', 'center', true);
        g.restore();
      }
      if (t >= 56) {
        // La pluie de pièces d'or et de cartes, qui s'abat sur lui.
        const p = (t - 56) / 60;
        for (let i = 0; i < 40; i++) {
          const q = Math.min(1.4, p * 2 - (i % 8) * 0.05);
          if (q <= 0) continue;
          const x = D.x + (K.hasard(i) - 0.5) * 360 * (1 - Math.min(1, q) * 0.5);
          const y = 300 + q * (SOL - 300);
          g.save(); g.translate(x, Math.min(SOL - 6, y)); g.rotate(t / 3 + i);
          if (i % 4) { g.scale(Math.abs(Math.cos(t / 3 + i)), 1); g.fillStyle = '#7a4a00'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); g.fillStyle = '#fff0a0'; g.beginPath(); g.arc(-2, -2, 4, 0, TAU); g.fill(); }
          else { g.fillStyle = '#1a0a10'; g.fillRect(-10, -14, 20, 28); g.fillStyle = '#fffaf0'; g.fillRect(-8.5, -12.5, 17, 25); g.fillStyle = '#d8102a'; g.font = '900 14px sans-serif'; g.textAlign = 'center'; g.fillText('♥', 0, 5); }
          g.restore();
        }
      }
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 170, (t - IMPACT) / 46, K.OR, 341);
    },
  },
  /* DESPERADO : High Noon. Midi sonne : l'arène vire au sépia, le soleil cogne au zénith, un virevoltant
     roule entre eux. Silence… Il dégaine plus vite que l'éclair : six coups, six éclairs. */
  midi(g, t, A, D, k) {
    const dir = Math.sign(D.x - A.x) || A.dir || 1;
    const sepia = K.entre(t, 0, 16) * (1 - K.entre(t, 106, 128));
    K.soleil(g, L / 2, 70, 56, t, K.OR, sepia, 18);
    // La cloche de midi.
    if (t > 8 && t < 40) {
      g.save(); g.translate(L / 2, 190); g.globalAlpha = Math.min(1, (40 - t) / 8);
      texteContour(g, (t < 22 ? 'DONG…' : 'DONG…  DONG…'), 0, 0, 52, '#fff0c8', '#3a2408', 'center', true);
      g.restore();
    }
    // Le virevoltant qui roule entre eux.
    if (t < 60) {
      const x = -60 + (L + 120) * (t / 60);
      g.save(); g.translate(x, SOL - 26 - Math.abs(Math.sin(t / 4)) * 20); g.rotate(t / 3);
      g.strokeStyle = '#7a5a2a'; g.lineWidth = 2;
      for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(0, 0, 24, 14 + i, i * 0.7, 0, TAU); g.stroke(); }
      g.restore();
    }
    // Les yeux plissés, en gros plan (deux bandes), puis le tir.
    if (t > 40 && t < 58) {
      g.save(); g.globalAlpha = Math.min(1, (t - 40) / 4) * Math.min(1, (58 - t) / 4);
      g.fillStyle = '#1a1006'; g.fillRect(0, 150, L, 90);
      g.fillStyle = '#c89070'; g.fillRect(0, 158, L, 74);
      for (const x of [L * 0.32, L * 0.68]) { g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, 195, 60, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#3a2414'; g.beginPath(); g.arc(x + dir * 10, 195, 10, 0, TAU); g.fill(); }
      g.fillStyle = '#3a2414'; g.fillRect(L * 0.32 - 70, 168, 140, 8); g.fillRect(L * 0.68 - 70, 168, 140, 8);
      g.restore();
    }
    // Six éclairs de canon, six traits.
    for (let i = 0; i < 6; i++) {
      const t0 = 58 + i * 1.6;
      if (t < t0 || t > t0 + 5) continue;
      const q = (t - t0) / 5;
      K.etoileImpact(g, A.x + dir * 50, A.y - 6, 40, t, K.FEU, 1 - q, 6);
      g.save(); g.strokeStyle = `rgba(255,240,180,${1 - q})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(A.x + dir * 50, A.y - 6); g.lineTo(D.x, D.y - 30 + (i - 2.5) * 12); g.stroke(); g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      for (let i = 0; i < 6; i++) K.etoileImpact(g, D.x + (K.hasard(i) - 0.5) * 60, D.y - 30 + (i - 2.5) * 14, 46 * (1 - p), t + i, K.FEU, 1 - p, 8);
      // Le chapeau de l'adversaire s'envole… ou ce qu'il en reste : un petit nuage de poussière.
      for (let i = 0; i < 6; i++) K.fumee(g, D.x + (K.hasard(i) - 0.5) * 240, SOL - 20 - p * 40, 26 + p * 30, { ...K.SABLE, base: '#c8a070' }, 0.7 * (1 - p), i);
      g.save(); g.translate(L / 2, 160); const s = 1 + Math.max(0, 1 - (t - IMPACT) / 8) * 0.8; g.scale(s, s);
      texteContour(g, 'BANG !', 0, 0, 110, '#fff0a0', '#5a1a00', 'center', true);
      g.restore();
    }
  },
  /* KITSUNE : Neuf Queues Célestes. Ses neuf queues se déploient en feu bleu derrière elle, immenses ;
     des feux follets encerclent l'adversaire ; au coup, une tête de renard de flammes le dévore. */
  'neuf-queues': {
    derriere(g, t, A, D, k) {
      const deploie = K.entre(t, 4, 40) * (1 - K.entre(t, 104, 128));
      if (deploie <= 0) return;
      const P = K.palette(k.faisceau);
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.3 * deploie + Math.sin(t / 10 + i) * 0.05;
        g.save(); g.translate(A.x - (A.dir || 1) * 20, A.y + 20); g.rotate(a + Math.PI / 2);
        K.flamme(g, 0, 0, 300 * deploie, 58, t, P, i * 1.3, 0.85);
        g.restore();
      }
    },
    devant(g, t, A, D, k) {
      const dir = Math.sign(D.x - A.x) || A.dir || 1;
      const P = K.palette(k.faisceau);
      const fin = 1 - K.entre(t, 104, 128);
      // Le torii, en ombre, derrière l'adversaire.
      g.save(); g.globalAlpha = 0.5 * K.entre(t, 10, 30) * fin; g.fillStyle = '#c8102e';
      g.fillRect(D.x - 140, SOL - 260, 22, 260); g.fillRect(D.x + 118, SOL - 260, 22, 260);
      g.fillRect(D.x - 170, SOL - 270, 340, 20); g.fillRect(D.x - 150, SOL - 226, 300, 14);
      g.restore();
      // Les feux follets qui tournent, se resserrent.
      const serre = K.entre(t, 30, IMPACT);
      for (let i = 0; i < 9; i++) {
        const a = t / 7 + (i / 9) * TAU, rr = 170 - 120 * serre;
        K.orbe(g, D.x + Math.cos(a) * rr, D.y + Math.sin(a) * rr * 0.6, 14, t + i, P, K.entre(t, 10 + i * 2, 20 + i * 2) * fin);
      }
      // La tête de renard de flammes, qui fond sur lui.
      if (t > 50 && t < IMPACT + 16) {
        const q = K.entre(t, 50, IMPACT);
        const x = A.x + (D.x - A.x) * q, y = A.y - 60 + (D.y - A.y + 60) * q;
        g.save(); g.translate(x, y); g.scale(dir, 1); g.globalAlpha = 1 - K.entre(t, IMPACT + 4, IMPACT + 16);
        K.couches(g, (s) => { g.moveTo(-90 * s, -50 * s); g.lineTo(-60 * s, -110 * s); g.lineTo(-30 * s, -50 * s); g.lineTo(30 * s, -50 * s); g.lineTo(60 * s, -110 * s); g.lineTo(90 * s, -50 * s); g.quadraticCurveTo(110 * s, 20 * s, 150 * s, 40 * s); g.quadraticCurveTo(40 * s, 90 * s, -60 * s, 50 * s); g.quadraticCurveTo(-100 * s, 10 * s, -90 * s, -50 * s); }, P, [1, 0.88, 0.6, 0.3]);
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(30, -20, 14, 6, -0.3, 0, TAU); g.fill();
        g.restore();
      }
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 180, (t - IMPACT) / 46, P, 351);
    },
  },
  /* FENRIR : Lune de Sang. Le ciel rougit, une lune de sang énorme se lève ; il hurle, sa silhouette de
     loup se découpe sur la lune ; il disparaît… trois griffures géantes déchirent l'écran. */
  'lune-sang': {
    derriere(g, t, A, D, k) {
      const leve = K.entre(t, 0, 36) * (1 - K.entre(t, 108, 128));
      if (leve <= 0) return;
      const SANG = { encre: '#2a0004', fonce: '#7a0a10', base: '#c81e24', clair: '#ff6a4a', coeur: '#ffd0b0' };
      const y = SOL + 40 - 300 * leve;
      K.lueur(g, L / 2, y, 300, '#ff2a2a', 0.45 * leve);
      K.lune(g, L / 2, y, 120, SANG, leve);
      // La silhouette du loup qui hurle, sur la lune.
      if (t > 20 && t < 60) {
        // Un loup assis, le museau levé vers le ciel.
        g.save(); g.globalAlpha = Math.min(1, (t - 20) / 8) * Math.min(1, (60 - t) / 8); g.fillStyle = '#12020a'; g.translate(L / 2 - 20, y + 40); g.scale(1.3, 1.3);
        g.beginPath(); g.moveTo(-46, 64); g.quadraticCurveTo(-52, 20, -26, 0); g.lineTo(-14, -30); g.lineTo(-10, -52); g.lineTo(-4, -72); g.lineTo(2, -60);
        g.lineTo(10, -74); g.lineTo(12, -58); g.lineTo(34, -92); g.lineTo(38, -86); g.lineTo(22, -52); g.quadraticCurveTo(14, -30, 18, -6);
        g.quadraticCurveTo(30, 20, 26, 64); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(-46, 60); g.quadraticCurveTo(-80, 66, -86, 40); g.quadraticCurveTo(-70, 56, -44, 50); g.fill();
        g.restore();
      }
    },
    devant(g, t, A, D, k) {
      if (t > 22 && t < 44) {
        g.save(); g.translate(L / 2, 300); g.globalAlpha = Math.min(1, (44 - t) / 6); const s = 1 + Math.sin(t * 1.3) * 0.05; g.scale(s, s);
        texteContour(g, 'AOUUUUUH !', 0, 0, 72, '#ffd0d0', '#3a0004', 'center', true);
        g.restore();
      }
      // Trois griffures géantes, en travers de l'écran.
      for (let i = 0; i < 3; i++) {
        const t0 = 58 + i * 3;
        if (t < t0) continue;
        const q = Math.min(1, (t - t0) / 4), fin = 1 - K.entre(t, 96, 124);
        g.save(); g.translate(D.x - 200 + i * 60, D.y - 200); g.rotate(0.9);
        for (const [c, w] of [['#12020a', 26], ['#c81e24', 16], ['#ffd0b0', 4]]) {
          g.strokeStyle = c; g.lineWidth = w * fin; g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(220 * q, 30 * q, 440 * q, 0); g.stroke();
        }
        g.restore();
      }
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 170, (t - IMPACT) / 46, { encre: '#2a0004', fonce: '#7a0a10', base: '#c81e24', clair: '#ff6a4a', coeur: '#ffffff' }, 361);
    },
  },
};

/**
 * Les fonds : ce qui assombrit (ou colore) l'arène pendant un ultime, dessiné derrière les combattants
 * pour qu'ils restent bien visibles. (visuel → (t) → [r, v, b, opacité], ou un dégradé du haut vers le sol.)
 */
const tenue = (t, a, b) => K.entre(t, a, b) * (1 - K.entre(t, 104, 128));
export const FONDS = {
  foudre: (t) => [10, 8, 30, 0.45 * tenue(t, 0, 18)],
  singularite: (t) => [14, 0, 30, 0.4 * tenue(t, 0, 20)],
  eclipse: (t) => [4, 6, 30, 0.6 * tenue(t, 0, 24)],
  'mille-lames': (t) => [0, 14, 14, 0.5 * tenue(t, 0, 14)],
  supernova: (t) => [6, 4, 24, 0.62 * tenue(t, 0, 20)],
  oubli: (t) => [14, 0, 24, 0.45 * tenue(t, 0, 20)],
  maelstrom: (t) => [0, 30, 70, 0.4 * tenue(t, 0, 24)],
  armageddon: (t) => ({ haut: [60, 0, 0, 0.7 * tenue(t, 0, 22)], bas: [20, 0, 0, 0.3 * tenue(t, 0, 22)] }),
  ring: (t) => [0, 0, 0, 0.6 * tenue(t, 0, 14)],
  miroirs: (t) => [8, 10, 34, 0.5 * tenue(t, 0, 16)],
  legion: (t) => [20, 14, 6, 0.35 * tenue(t, 0, 20)],
  'eclipse-totale': (t) => [4, 0, 12, 0.82 * K.entre(t, 20, 42) * (1 - K.entre(t, 104, 128))],
  'mille-boucles': (t) => [40, 28, 10, 0.45 * tenue(t, 0, 18)],
  'omega-collapse': (t) => [0, 0, 0, 0.75 * tenue(t, 0, 24)],
  vide: (t) => [4, 0, 10, 0.6 * tenue(t, 0, 18)],
  luchador: (t) => [0, 0, 0, 0.55 * tenue(t, 0, 12)],
  fresque: (t) => [10, 4, 20, 0.5 * tenue(t, 0, 14)],
  foret: (t) => [0, 20, 6, 0.45 * tenue(t, 0, 18)],
  enceintes: (t) => [6, 0, 20, 0.7 * tenue(t, 0, 16)],
  'mille-grues': (t) => [30, 8, 14, 0.35 * tenue(t, 0, 18)],
  polarite: (t) => [10, 4, 24, 0.5 * tenue(t, 0, 18)],
  jackpot: (t) => [20, 0, 6, 0.55 * tenue(t, 0, 16)],
  midi: (t) => [120, 80, 30, 0.45 * tenue(t, 0, 16)],
  'neuf-queues': (t) => [0, 4, 24, 0.55 * tenue(t, 0, 18)],
  'lune-sang': (t) => ({ haut: [60, 0, 4, 0.75 * tenue(t, 0, 24)], bas: [20, 0, 0, 0.4 * tenue(t, 0, 24)] }),
};

/* ------------------------------------------------------------------ */
/* Les ultimes du héros (ses couleurs : celles de son énergie)           */
/* ------------------------------------------------------------------ */

/** Un poing géant, vu de côté, orienté vers +x : le dos de la main, quatre doigts repliés, le pouce. */
function poingGeant(g, x, y, r, P, a = 1) {
  g.save(); g.translate(x, y); g.globalAlpha *= a;
  K.lueur(g, 0, 0, r * 2, P.base, 0.4);
  const parts = [
    [-r, -0.7 * r, 1.12 * r, 1.4 * r, 0.42 * r],
    ...[0, 1, 2, 3].map((i) => [0.02 * r, (-0.74 + i * 0.37) * r, 0.8 * r, 0.35 * r, 0.17 * r]),
    [-0.38 * r, 0.3 * r, 0.82 * r, 0.33 * r, 0.16 * r],
  ];
  g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = P.encre; g.lineJoin = 'round';
  for (const [px, py, pw, ph, pr] of parts) {
    g.fillStyle = P.base; g.beginPath(); g.roundRect(px, py, pw, ph, pr); g.fill(); g.stroke();
    g.fillStyle = P.clair; g.beginPath(); g.roundRect(px + pw * 0.12, py + ph * 0.14, pw * 0.7, ph * 0.26, pr * 0.5); g.fill();
  }
  g.fillStyle = P.coeur; g.beginPath(); g.ellipse(-0.5 * r, -0.35 * r, 0.22 * r, 0.1 * r, -0.3, 0, TAU); g.fill();
  g.restore();
}

export const ULTIMES_HEROS = {
  /* Le poing de la fracture : toute l'énergie de l'arène se rassemble en un poing géant, qui part,
     frappe, et fend l'écran comme du verre. */
  'heros-fracture'(g, t, A, D, k) {
    const P = K.palette(k.c1);
    const dir = Math.sign(D.x - A.x) || 1;
    for (let i = 0; i < 20 && t < 54; i++) {
      const q = ((t * 1.8 + i * 13) % 40) / 40;
      const an = K.hasard(i) * TAU;
      const x = A.x + Math.cos(an) * 240 * (1 - q), y = A.y + Math.sin(an) * 160 * (1 - q);
      K.losange(g, x, y, (A.x - x) * 0.08, (A.y - y) * 0.08, 2.5, P, q);
    }
    const r = 20 + 50 * K.entre(t, 10, 50);
    if (t < 50) poingGeant(g, A.x - dir * 30, A.y - 20, r, P, K.entre(t, 6, 16));
    else if (t <= IMPACT + 2) {
      const q = K.entre(t, 50, IMPACT);
      const x = A.x - dir * 30 + (D.x - dir * 40 - A.x + dir * 30) * q;
      for (let i = 1; i < 4; i++) poingGeant(g, x - dir * i * 40, A.y - 20, r, P, 0.25);
      g.save(); g.translate(x, A.y - 20); g.scale(dir, 1); poingGeant(g, 0, 0, r, P); g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 50;
      // L'écran se fend : des fissures blanches depuis l'impact.
      g.save();
      for (let i = 0; i < 9; i++) {
        const an = (i / 9) * TAU + K.hasard(i) * 0.4;
        const l = 600 * K.entre(p, 0, 0.15);
        for (const [c, w] of [[P.encre, 7], ['#ffffff', 3]]) {
          g.strokeStyle = c; g.lineWidth = w; g.globalAlpha = 1 - K.entre(p, 0.5, 1);
          g.beginPath(); g.moveTo(D.x, D.y);
          for (let s = 1; s <= 5; s++) g.lineTo(D.x + Math.cos(an + (K.hasard(i + s) - 0.5) * 0.5) * l * s / 5, D.y + Math.sin(an + (K.hasard(i * 3 + s) - 0.5) * 0.5) * l * s / 5);
          g.stroke();
        }
      }
      g.restore();
      K.explosion(g, D.x, D.y, 200, p, P, 301);
    }
  },
  /* L'envol du phénix : un immense oiseau de feu naît de son aura, monte, puis plonge à travers
     l'adversaire. */
  'heros-phenix'(g, t, A, D, k) {
    const P = k.teinte ? K.palette(k.c1) : K.FEU;
    const dir = Math.sign(D.x - A.x) || 1;
    const nait = K.entre(t, 8, 40);
    if (nait <= 0) return;
    let x, y, an;
    if (t < 46) { x = A.x; y = A.y - 140 - 40 * nait; an = -Math.PI / 2; }
    else {
      const q = K.entre(t, 46, IMPACT + 6);
      x = A.x + (D.x + dir * 160 - A.x) * q; y = A.y - 180 + (D.y - A.y + 180) * Math.sin(q * Math.PI * 0.9);
      an = Math.atan2(D.y - y, D.x - x) * (q < 0.9 ? 1 : 0);
    }
    const env = 140 * nait;
    const bat = Math.sin(t / 3);
    g.save(); g.translate(x, y); if (dir < 0 && t >= 46) g.scale(-1, 1); if (t >= 46) g.rotate(dir < 0 ? -an + Math.PI : an);
    // Les ailes : des langues de flamme en éventail ; la longue queue ; le corps.
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(s * (0.5 + i * 0.28 + bat * 0.25) + (t < 46 ? -Math.PI / 2 : 0));
      K.flamme(g, 0, 0, env * (1.3 - i * 0.12), env * 0.32, t + i, P, i * 3 + s, nait);
      g.restore();
    }
    g.save(); g.rotate(t < 46 ? 0 : Math.PI / 2);
    for (let i = 0; i < 3; i++) K.flamme(g, (i - 1) * 10, 0, env * (1.6 - Math.abs(i - 1) * 0.4), env * 0.25, t + i * 5, P, 9 + i, nait);
    g.restore();
    K.orbe(g, 0, 0, env * 0.28, t, P, nait);
    g.restore();
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 200, (t - IMPACT) / 46, P, 311);
  },
  /* La tempête intérieure : il tourne sur lui-même, un cercle d'éclairs se referme sur l'adversaire. */
  'heros-tempete'(g, t, A, D, k) {
    const P = K.palette(k.c1);
    const serre = K.entre(t, 14, IMPACT);
    const r = 260 - 180 * serre;
    const n = 8;
    const pts = [];
    for (let i = 0; i < n; i++) { const an = (i / n) * TAU + t / 7; pts.push([D.x + Math.cos(an) * r, D.y + Math.sin(an) * r * 0.5]); }
    if (t >= 10 && t < IMPACT + 4) for (let i = 0; i < n; i++) { const [x0, y0] = pts[i]; const [x1, y1] = pts[(i + 1) % n]; K.foudre(g, x0, y0, x1, y1, 4, P, Math.floor(t / 2) * 7 + i, 0, K.entre(t, 10, 20)); }
    for (let i = 0; i < 3 && t < IMPACT + 4; i++) {
      g.save(); g.translate(D.x, D.y + 20); g.scale(1, 0.3);
      for (const [c, w] of [[P.encre, 10], [P.base, 6], [P.coeur, 2]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r * (0.7 + i * 0.15), t / 4 + i * 2, t / 4 + i * 2 + 2.6); g.stroke(); }
      g.restore();
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 190, p, P, 321);
      if (p < 0.6) for (let e = 0; e < 6; e++) K.foudre(g, D.x, D.y, D.x + Math.cos(e) * 260, D.y + Math.sin(e * 1.7) * 160, 4, P, t + e * 5, 1, 1 - p);
    }
  },
  /* Le sceau du gardien : un cercle magique sous l'adversaire, ses runes qui montent, puis la colonne
     de lumière. */
  'heros-sceau'(g, t, A, D, k) {
    const P = K.palette(k.c1);
    const grand = K.entre(t, 6, 40) * (1 - K.entre(t, IMPACT + 10, IMPACT + 30));
    if (grand > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      sceau(g, D.x, SOL, 200 * grand, k.c1, 1, t / 14);
      sceau(g, D.x, SOL, 130 * grand, '#ffffff', 0.8, -t / 10);
      g.restore();
      for (let i = 0; i < 10; i++) { const q = ((t * 1.5 + i * 19) % 60) / 60; K.etoileImpact(g, D.x + (K.hasard(i) - 0.5) * 300 * grand, SOL - q * 220, 8, t / 6 + i, P, grand * (1 - q), 4); }
    }
    if (t >= 50 && t < IMPACT + 26) {
      const c = K.entre(t, 50, 58) * (1 - K.entre(t, IMPACT + 10, IMPACT + 26));
      g.save(); g.translate(D.x, SOL + 10); g.rotate(-Math.PI / 2);
      K.rayon(g, SOL + 40, 70 * c, t, P);
      g.restore();
    }
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 190, (t - IMPACT) / 46, P, 331);
  },
  /* La comète humaine : il disparaît, et des ruées traversent l'adversaire de tous les côtés. */
  'heros-comete'(g, t, A, D, k) {
    const P = K.palette(k.c1);
    for (let i = 0; i < 12; i++) {
      const t0 = 12 + i * 4.4, q = (t - t0) / 6;
      if (q < 0 || q > 1.6) continue;
      const an = K.hasard(i + 3) * TAU;
      const d = 420;
      const x0 = D.x - Math.cos(an) * d, y0 = D.y - Math.sin(an) * d * 0.6;
      const x1 = D.x + Math.cos(an) * d, y1 = D.y + Math.sin(an) * d * 0.6;
      const f = Math.min(1, q);
      const hx = x0 + (x1 - x0) * f, hy = y0 + (y1 - y0) * f;
      g.save(); g.translate(hx, hy); g.rotate(Math.atan2(y1 - y0, x1 - x0));
      K.couches(g, (s) => { g.moveTo(20 * s, 0); g.lineTo(-240 * s, -15 * s); g.lineTo(-340, 0); g.lineTo(-240 * s, 15 * s); g.closePath(); }, P, [1.3, 1, 0.55, 0.25], Math.max(0, 1 - (q - 1) * 1.6));
      K.orbe(g, 0, 0, 22, t, P, Math.max(0, 1 - (q - 1) * 1.6));
      g.restore();
      if (q > 0.4 && q < 0.8) K.etoileImpact(g, D.x, D.y, 50, t, P, 1, 8);
    }
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 200, (t - IMPACT) / 46, P, 341);
  },
  /* L'éveil : un géant de lumière à son image se dresse derrière lui et frappe en même temps que lui. */
  'heros-eveil': {
    derriere(g, t, A, D, k) {
      const perso = PERSO[A.id];
      const leve = K.entre(t, 6, 40) * (1 - K.entre(t, 104, 126));
      if (!perso || leve <= 0) return;
      const frappe = t >= 56;
      const dir = Math.sign(D.x - A.x) || 1;
      K.lueur(g, A.x, A.y - 120, 260, k.c1, 0.5 * leve);
      dessinerCombattant(g, perso, { x: A.x - dir * 40 + (frappe ? dir * 40 * K.entre(t, 56, IMPACT) : 0), y: SOL + 30 + (1 - leve) * 300, dir, pose: frappe ? 'poing' : 'garde', t, p: frappe ? K.entre(t, 56, IMPACT) : 0, echelle: 2.5, alpha: 0.45 * leve, sansOmbre: true });
    },
    devant(g, t, A, D, k) {
      const P = K.palette(k.c1);
      if (t >= IMPACT - 2 && t < IMPACT + 10) K.etoileImpact(g, D.x, D.y - 40, 160, t * 0.1, P, 1 - (t - IMPACT + 2) / 12, 12);
      if (t >= IMPACT) K.explosion(g, D.x, D.y, 220, (t - IMPACT) / 46, P, 351);
    },
  },
  /* La lame d'horizon : il se ramasse, la main sur la garde ; un éclair — il est passé, et une seule
     entaille coupe l'écran d'un bord à l'autre. */
  'heros-horizon'(g, t, A, D, k) {
    const P = K.palette(k.c1);
    if (t < 56) {
      const p = K.entre(t, 10, 50);
      g.save(); g.translate(A.x, A.y + 10);
      K.couches(g, (s) => { g.moveTo(-90 * p, 0); g.lineTo(0, -3 * s); g.lineTo(90 * p, 0); g.lineTo(0, 3 * s); g.closePath(); }, P, [1.5, 1, 0.5, 0.25], p);
      g.restore();
      K.etoileImpact(g, A.x + (A.dir || 1) * 30, A.y + 10, 18 * p, t / 5, P, p, 4);
    }
    if (t >= 56 && t < IMPACT) {
      const q = K.entre(t, 56, 62);
      g.save(); g.translate(A.x, A.y + 20);
      K.couches(g, (s) => g.rect(0, -10 * s, (D.x - A.x + (A.dir || 1) * 100) * q, 20 * s), P, [1.2, 1, 0.5, 0.2], 1 - K.entre(t, 62, IMPACT));
      g.restore();
    }
    if (t >= IMPACT && t < IMPACT + 30) {
      const a = 1 - K.entre(t, IMPACT + 14, IMPACT + 30);
      g.save(); g.translate(0, D.y - 10); g.rotate(-0.04);
      K.couches(g, (s) => { g.moveTo(-40, 0); g.lineTo(L / 2, -9 * s); g.lineTo(L + 40, 0); g.lineTo(L / 2, 9 * s); g.closePath(); }, P, [1.5, 1, 0.55, 0.3], a);
      g.restore();
    }
    if (t >= IMPACT) K.explosion(g, D.x, D.y, 180, (t - IMPACT) / 46, P, 361);
  },
  /* Mille promesses : une étoile par allié monte du sol, elles se rassemblent en une seule au-dessus de
     l'adversaire, et tombent ensemble. */
  'heros-promesses'(g, t, A, D, k) {
    const P = K.palette(k.c1);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x0 = (i + 0.5) * (L / n), y0 = SOL - 20;
      const monte = K.entre(t, 6 + i * 2, 30 + i * 2);
      const rassemble = K.entre(t, 36, 56);
      const x = x0 + (D.x - x0) * rassemble, y = y0 - 260 * monte + (D.y - 220 - (y0 - 260)) * rassemble;
      if (t < 58) K.etoileImpact(g, x, y, 16, t / 6 + i, i % 2 ? P : K.OR, monte, 5);
    }
    if (t >= 52 && t <= IMPACT + 2) {
      const q = K.entre(t, 58, IMPACT);
      K.etoileImpact(g, D.x, D.y - 220 + 220 * q, 40 + 40 * K.entre(t, 52, 58), t / 6, K.OR, 1, 5);
    }
    if (t >= IMPACT) {
      const p = (t - IMPACT) / 46;
      K.explosion(g, D.x, D.y, 210, p, K.OR, 371);
      for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; K.etoileImpact(g, D.x + Math.cos(an) * p * 300, D.y + Math.sin(an) * p * 200, 12 * (1 - p), t / 6, P, 1 - p, 5); }
    }
  },
};
