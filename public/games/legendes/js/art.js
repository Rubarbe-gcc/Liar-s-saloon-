/**
 * LÉGENDES — les illustrations en plusieurs plans, qui bougent quand on bouge le doigt (ou le téléphone) :
 * le ciel, les rayons qui tournent, les ailes d'énergie derrière le héros (pour un LR), les éclats
 * holographiques qui flottent, le personnage, le sol, les étincelles. Plus la rareté est haute, plus il y a
 * de plans. On les voit à l'accueil (le chef), sur la fiche, et quand un LR est invoqué.
 */

import { ELEMENTS } from '../../../shared/legendes/persos.js';
import { portrait } from './portrait.js';

/** Les ailes d'énergie (derrière un LR) : deux grandes ailes de plumes de lumière. */
function ailes(c) {
  const plume = (k, s) => {
    const a = -20 - k * 13, l = 150 - k * 8;
    return `<path d="M0 0 Q ${s * 60} ${-60 - k * 8} ${s * l * Math.cos((a * Math.PI) / 180)} ${l * Math.sin((a * Math.PI) / 180)} Q ${s * 50} ${10 - k * 6} 0 0 Z" fill="url(#plumeAiles)" stroke="#fff" stroke-width="1.5" opacity="${0.9 - k * 0.07}"/>`;
  };
  return `<svg viewBox="-200 -200 400 300" class="ailes"><g filter="url(#lueurAiles)">${[1, -1].map((s) => `<g>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => plume(k, s)).join('')}</g>`).join('')}</g>
    <defs><linearGradient id="plumeAiles" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff6c8" stop-opacity=".8"/><stop offset="1" stop-color="${c}" stop-opacity=".6"/></linearGradient><filter id="lueurAiles"><feGaussianBlur stdDeviation="3" result="f"/><feMerge><feMergeNode in="f"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>`;
}

/** Une illustration. o : { taille (px de large), petit (moins de plans) } */
export function illustration(x, o = {}) {
  const el = ELEMENTS[x.element], R = x.rarete;
  const haut = R === 'LR' || R === 'UR';
  const eclats = R === 'LR' ? 12 : R === 'UR' ? 6 : 0;
  const etincelles = R === 'LR' ? 18 : R === 'UR' || R === 'SSR' ? 10 : 4;
  let h = `<div class="illus rar-${R}${o.petit ? ' petit' : ''}" style="--aura:${x.couleurs.aura};--el:${el.couleur};${o.taille ? `--t:${o.taille}px;` : ''}">`;
  h += '<div class="couche ciel-illus" data-p="2"></div>';
  h += '<div class="couche rayons-illus" data-p="4"></div>';
  if (R === 'LR') h += `<div class="couche esprit" data-p="8">${ailes(x.couleurs.aura)}</div>`;
  if (R === 'UR') h += '<div class="couche flammes" data-p="8"></div>';
  h += '<div class="couche eclats-illus" data-p="14">';
  for (let k = 0; k < eclats; k++) h += `<i style="left:${(k * 37) % 92 + 2}%;top:${(k * 53) % 80 + 5}%;--r:${(k * 47) % 360}deg;--d:${3 + (k % 4)}s;--dl:${-k * 0.7}s"></i>`;
  h += '</div>';
  h += `<div class="couche perso-illus" data-p="20">${portrait(x, { taille: 400, fond: false, anime: true })}</div>`;
  if (haut) h += '<div class="couche sol-illus" data-p="26"></div>';
  h += '<div class="couche brillances" data-p="30">';
  for (let k = 0; k < etincelles; k++) h += `<b style="left:${(k * 29) % 96}%;top:${(k * 41) % 90}%;--dl:${-(k * 0.37) % 2}s"></b>`;
  h += `</div><span class="badge-rar">${R}</span></div>`;
  return h;
}

/** Rend une illustration « réactive » : ses plans suivent le doigt, la souris ou l'inclinaison du téléphone. */
export function rendreReactif(racine) {
  const illus = racine.querySelector('.illus');
  if (!illus) return () => {};
  const couches = [...illus.querySelectorAll('.couche')];
  let px = 0, py = 0, cx = 0, cy = 0, vivant = true;
  const vers = (x, y) => { px = Math.max(-1, Math.min(1, x)); py = Math.max(-1, Math.min(1, y)); };
  const souris = (e) => { const r = illus.getBoundingClientRect(); vers(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1); };
  const incline = (e) => { if (e.gamma !== null) vers(e.gamma / 30, (e.beta - 40) / 30); };
  addEventListener('pointermove', souris);
  addEventListener('deviceorientation', incline);
  const boucle = (t) => {
    if (!vivant || !illus.isConnected) { fin(); return; }
    // Sans geste, un léger balancement.
    const bx = px || Math.sin(t / 1800) * 0.35, by = py || Math.cos(t / 2300) * 0.25;
    cx += (bx - cx) * 0.08; cy += (by - cy) * 0.08;
    for (const c of couches) { const p = +c.dataset.p; c.style.transform = `translate(${-cx * p}px, ${-cy * p * 0.6}px)`; }
    illus.style.setProperty('--incl', `${cx * 4}deg`);
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);
  function fin() { vivant = false; removeEventListener('pointermove', souris); removeEventListener('deviceorientation', incline); }
  return fin;
}
