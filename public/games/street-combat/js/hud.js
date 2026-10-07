/**
 * STREET COMBAT — le bandeau du combat : vies (avec la traîne rouge des
 * coups reçus), jauges en trois segments, chrono, rounds gagnés, compteur
 * de combo, et le nom du coup qu'on vient de lancer.
 */

import { PERSO, JAUGE } from '../../../shared/street/persos.js';
import { rgba, teinte, dessinerPortrait } from './dessin.js';
import { texteContour } from './effets.js';

const L = 1000;
const portraits = new Map();

function portrait(id) {
  if (portraits.has(id)) return portraits.get(id);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 120;
  dessinerPortrait(cv.getContext('2d'), PERSO[id], 120, { t: 12 });
  portraits.set(id, cv);
  return cv;
}

/** L'état propre au bandeau (la traîne des vies). */
export const creerHud = () => ({ trainee: [null, null] });

export function dessinerHud(g, c, fx, hud, t) {
  c.joueurs.forEach((j, k) => barre(g, c, j, k, hud, t));
  // Le chrono.
  g.save();
  const temps = c.temps === Infinity ? '∞' : String(Math.max(0, c.temps));
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath(); g.moveTo(L / 2 - 46, 6); g.lineTo(L / 2 + 46, 6); g.lineTo(L / 2 + 36, 66); g.lineTo(L / 2 - 36, 66); g.closePath(); g.fill();
  const urgent = c.temps !== Infinity && c.temps <= 10 && t % 30 < 15;
  texteContour(g, temps, L / 2, 34, 40, urgent ? '#ff3a3a' : '#ffffff', '#000');
  g.font = '800 11px system-ui'; g.fillStyle = '#b9a8d6'; g.textAlign = 'center';
  g.fillText(c.entrainement ? 'ENTRAÎNEMENT' : `ROUND ${c.round}`, L / 2, 60);
  g.restore();
  // Les combos et les noms de coups.
  for (let k = 0; k < 2; k++) {
    const cb = fx.combos[k];
    if (cb && cb.n >= 2) {
      const x = k === 0 ? 40 : L - 40;
      const a = Math.min(1, cb.vie / 20);
      g.save();
      g.globalAlpha = a;
      const s = 1 + Math.max(0, cb.vie - 82) / 16;
      g.translate(x, 190); g.scale(s, s);
      texteContour(g, `${cb.n}`, 0, 0, 54, '#ffd23f', '#5a1a00', k === 0 ? 'left' : 'right', true);
      texteContour(g, 'HITS', k === 0 ? 2 : -2, 36, 22, '#ffffff', '#000', k === 0 ? 'left' : 'right', true);
      g.font = '800 13px system-ui'; g.fillStyle = '#ff9aaa'; g.textAlign = k === 0 ? 'left' : 'right';
      g.fillText(`${cb.degats} dégâts`, k === 0 ? 2 : -2, 58);
      g.restore();
    }
    const nom = fx.noms[k];
    if (nom) {
      const age = nom.max - nom.vie;
      const glisse = Math.min(1, age / 8);
      const a = Math.min(1, nom.vie / 12);
      g.save();
      g.globalAlpha = a;
      const x = k === 0 ? -200 + glisse * 228 : L + 200 - glisse * 228;
      texteContour(g, nom.texte, x, 116, nom.sorte === 'combo-nom' ? 20 : 26, nom.c, '#000', k === 0 ? 'left' : 'right', true);
      g.restore();
    }
  }
}

function barre(g, c, j, k, hud, t) {
  const p = PERSO[j.id];
  const droite = k === 1;
  const largeur = 360;
  const x0 = droite ? L - 66 - largeur : 66;
  const sens = droite ? -1 : 1;
  const frac = Math.max(0, j.hp / j.hpMax);
  // La traîne : elle rattrape la vie, lentement.
  if (hud.trainee[k] === null || hud.trainee[k] < frac) hud.trainee[k] = frac;
  else hud.trainee[k] = Math.max(frac, hud.trainee[k] - 0.006);

  g.save();
  // Le portrait.
  const px = droite ? L - 62 : 6;
  g.fillStyle = '#000'; g.fillRect(px - 2, 6, 60, 60);
  g.drawImage(portrait(j.id), px, 8, 56, 56);
  g.strokeStyle = p.c.c1; g.lineWidth = 2; g.strokeRect(px - 1, 7, 58, 58);

  // La vie (en biais, comme dans les salles d'arcade).
  const y = 14;
  const h = 22;
  const cadre = (w, couleur) => {
    g.beginPath();
    if (droite) { g.moveTo(x0 + largeur, y); g.lineTo(x0 + largeur - w, y); g.lineTo(x0 + largeur - w - 8, y + h); g.lineTo(x0 + largeur, y + h); }
    else { g.moveTo(x0, y); g.lineTo(x0 + w, y); g.lineTo(x0 + w + 8, y + h); g.lineTo(x0, y + h); }
    g.closePath();
    g.fillStyle = couleur; g.fill();
  };
  cadre(largeur, 'rgba(0,0,0,0.6)');
  cadre(largeur * hud.trainee[k], '#d0102a');
  const vie = g.createLinearGradient(0, y, 0, y + h);
  const couleur = frac > 0.5 ? ['#c8ff7a', '#2ab84a'] : frac > 0.25 ? ['#ffe680', '#e09b16'] : ['#ff9a9a', '#d0102a'];
  vie.addColorStop(0, couleur[0]); vie.addColorStop(1, couleur[1]);
  cadre(largeur * frac, vie);
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
  g.strokeRect(x0, y, largeur, h);

  // Le nom, les rounds gagnés.
  g.font = '900 15px Impact, "Arial Black", sans-serif';
  g.textAlign = droite ? 'right' : 'left';
  g.fillStyle = '#ffffff';
  g.fillText(p.nom, droite ? x0 + largeur : x0, y + h + 17);
  for (let i = 0; i < 2; i++) {
    const cx = droite ? x0 + 12 + i * 22 : x0 + largeur - 12 - i * 22;
    g.beginPath(); g.arc(cx, y + h + 12, 7, 0, Math.PI * 2);
    g.fillStyle = i < j.victoires ? '#ffd23f' : 'rgba(255,255,255,0.15)';
    g.fill();
    if (i < j.victoires) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
  }

  // La jauge : trois segments (Spécial B, Spécial A, Ultime).
  const jy = 524;
  const jl = 300;
  const jx = droite ? L - 20 - jl : 20;
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(jx - 3, jy - 3, jl + 6, 20);
  const plein = j.sp >= 100;
  const remplir = (de, a, coul) => {
    const v = Math.max(0, Math.min(j.sp, a) - de) / (a - de);
    if (v <= 0) return;
    const w = (jl * (a - de) / 100) * v;
    const x = droite ? jx + jl - (jl * de) / 100 - w : jx + (jl * de) / 100;
    g.fillStyle = coul; g.fillRect(x, jy, w, 14);
  };
  remplir(0, JAUGE.specB, teinte(p.c.c1, -0.1));
  remplir(JAUGE.specB, JAUGE.specA, '#36b4ff');
  remplir(JAUGE.specA, 100, plein ? `hsl(${(t * 6) % 360},100%,60%)` : '#ffc83d');
  for (const s of [JAUGE.specB, JAUGE.specA]) {
    const x = droite ? jx + jl - (jl * s) / 100 : jx + (jl * s) / 100;
    g.fillStyle = '#000'; g.fillRect(x - 1, jy, 2, 14);
  }
  if (plein) { g.save(); g.shadowColor = '#ffd23f'; g.shadowBlur = 16; g.strokeStyle = '#ffd23f'; g.lineWidth = 2; g.strokeRect(jx - 2, jy - 2, jl + 4, 18); g.restore(); }
  g.font = '900 12px system-ui';
  g.textAlign = droite ? 'right' : 'left';
  const etiq = plein ? 'ULTIME PRÊT !' : j.sp >= JAUGE.specA ? 'SPÉCIAL A + B' : j.sp >= JAUGE.specB ? 'SPÉCIAL B' : '';
  g.fillStyle = plein ? '#ffd23f' : '#ffffff';
  if (etiq) g.fillText(etiq, droite ? jx + jl : jx, jy - 7);
  // Les statuts.
  const st = Object.keys(j.statuts);
  st.forEach((s, i) => {
    g.font = '15px system-ui';
    g.fillText({ brulure: '🔥', poison: '☠️', gel: '❄️', lenteur: '🌀' }[s] || '', (droite ? x0 + largeur - 70 : x0 + 70) + sens * i * 20, y + h + 17);
  });
  g.restore();
  void rgba;
}
