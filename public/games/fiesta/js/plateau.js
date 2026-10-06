/**
 * FIESTA — le dessin du plateau : un chemin en serpentin, des cases, des pions.
 *
 * Les positions sont en pourcentage du cadre : le plateau se redessine à la
 * taille de l'écran (plus de colonnes à l'horizontale qu'en portrait).
 */

import { CASES } from '../../../shared/fiesta/partie.js';

const $ = (id) => document.getElementById(id);
let disposition = null;   // { cols, rangs, pos: [{x, y}] en % }

/** Les coordonnées de chaque case, en serpentin. */
function calculer(n) {
  const large = innerWidth > innerHeight * 1.1;
  const cols = large ? Math.min(12, Math.ceil(Math.sqrt(n * 2.2))) : Math.min(6, Math.ceil(Math.sqrt(n / 1.6)));
  const rangs = Math.ceil(n / cols);
  const pos = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    let c = i % cols;
    if (r % 2) c = cols - 1 - c;
    pos.push({ x: ((c + 0.5) / cols) * 100, y: ((r + 0.5) / rangs) * 100 });
  }
  return { cols, rangs, pos };
}

/** Une petite décalée pour chaque joueur, pour que les pions ne se cachent pas. */
const DECALAGES = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]];

export function dessiner(p) {
  const h = $('plateau');
  const cadre = h.parentElement;
  disposition = calculer(p.cases.length);
  const { cols, rangs, pos } = disposition;
  // Le plateau garde ses proportions et tient dans son cadre.
  const ratio = cols / rangs;
  const W = cadre.clientWidth;
  const H = cadre.clientHeight;
  const largeur = Math.min(W, H * ratio);
  h.style.width = `${largeur}px`;
  h.style.height = `${largeur / ratio}px`;
  const cellule = largeur / cols;
  h.style.setProperty('--tc', `${Math.min(46, cellule * 0.62)}px`);
  h.style.setProperty('--tp', `${Math.min(34, cellule * 0.46)}px`);
  const points = pos.map((q) => `${q.x * 10},${(q.y * 10) / ratio}`).join(' ');
  h.innerHTML = `<svg viewBox="0 0 1000 ${1000 / ratio}" preserveAspectRatio="none" aria-hidden="true">
      <polyline class="chemin" points="${points}"/><polyline class="chemin-pointille" points="${points}"/></svg>
    ${p.cases.map((t, i) => `<div class="case c-${t}" data-i="${i}" style="left:${pos[i].x}%;top:${pos[i].y}%"
      title="${CASES[t].nom}${CASES[t].texte ? ` — ${CASES[t].texte}` : ''}">${CASES[t].glyphe || ''}${i && i % 5 === 0 && t === 'normale' ? `<span class="num">${i}</span>` : ''}</div>`).join('')}
    ${p.joueurs.map((j) => `<div class="pion" data-j="${j.i}" style="--pc:${j.couleur}">${j.avatar}</div>`).join('')}`;
  for (const j of p.joueurs) placerPion(j.i, j.pos, p);
}

/** Pose un pion sur une case (avec la petite décalée qui lui est propre). */
export function placerPion(i, caseI, p) {
  const el = $('plateau').querySelector(`.pion[data-j="${i}"]`);
  if (!el || !disposition) return;
  const q = disposition.pos[Math.max(0, Math.min(caseI, disposition.pos.length - 1))];
  const autres = p ? p.joueurs.filter((j) => j.pos === caseI).length : 1;
  const [dx, dy] = autres > 1 ? DECALAGES[i] : [0, 0];
  const cw = 100 / disposition.cols;
  const ch = 100 / disposition.rangs;
  el.style.left = `${q.x + dx * cw}%`;
  el.style.top = `${q.y + dy * ch}%`;
}

export function sauterPion(i) {
  const el = $('plateau').querySelector(`.pion[data-j="${i}"]`);
  if (!el) return;
  el.classList.remove('saute'); void el.offsetWidth; el.classList.add('saute');
}

export function marquerActif(i) {
  $('plateau').querySelectorAll('.pion').forEach((el) => el.classList.toggle('actif', Number(el.dataset.j) === i));
}

export function viserCase(c) {
  const el = $('plateau').querySelector(`.case[data-i="${c}"]`);
  if (!el) return;
  el.classList.remove('vise'); void el.offsetWidth; el.classList.add('vise');
}
