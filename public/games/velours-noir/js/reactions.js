/**
 * LE VELOURS NOIR — la roue d'emojis.
 *
 * Un bouton 😊 dans la barre de chaque table ouvre une roue en 3D : on la
 * fait tourner du doigt (ou aux flèches), on touche un emoji, et il
 * s'envole au-dessus de sa place, pour toute la table. Chaque écran se
 * branche avec `brancher(ecran, { ancre, envoyer })` et montre ce que les
 * autres envoient avec `montrer(emoji, element)`.
 */

import * as R from '../../../shared/casino/reactions.js';
import * as fx from './effets.js';
import * as sfx from './sfx.js';

const CLE = 'velours.reactions';
const PAS = 360 / R.EMOJIS.length;

let actives = (() => { try { return localStorage.getItem(CLE) !== '0'; } catch { return true; } })();
export const reactionsActives = () => actives;

const branches = new Map();     // écran → { ancre, envoyer, bouton }
let roue = null, anneau = null, ouverteSur = null;
let angle = 0, derniere = 0;

/* ---------- l'emoji qui s'envole ---------- */
let calque = null;
function lecalque() {
  if (!calque || !calque.isConnected) {
    calque = document.createElement('div');
    calque.className = 'calque-reactions';
    document.body.appendChild(calque);
  }
  return calque;
}

/** Un emoji qui jaillit au-dessus d'un élément, tourne en 3D et s'efface. */
export function montrer(e, ancre, { delai = 0 } = {}) {
  if (!actives || !R.valide(e)) return;
  if (delai) { setTimeout(() => montrer(e, typeof ancre === 'function' ? ancre() : ancre), delai); return; }
  const cible = typeof ancre === 'function' ? ancre() : ancre;
  if (!cible?.isConnected) return;
  const r = cible.getBoundingClientRect();
  if (!r.width && !r.height) return;
  const el = document.createElement('span');
  el.className = 'reaction-vol';
  el.textContent = e;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  lecalque().appendChild(el);
  sfx.clic();
  const anim = fx.reduit()
    ? el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1500 })
    : el.animate([
      { transform: 'translate(-50%, 0) scale(.2) rotateY(0deg)', opacity: 0 },
      { transform: 'translate(-50%, -38px) scale(1.5) rotateY(200deg)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -52px) scale(1.15) rotateY(360deg)', opacity: 1, offset: 0.45 },
      { transform: 'translate(-50%, -60px) scale(1.2) rotateY(360deg)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%, -96px) scale(.9) rotateY(380deg)', opacity: 0 },
    ], { duration: 1600, easing: 'cubic-bezier(.2,.8,.3,1)' });
  fx.fini(anim).then(() => el.remove());
}

/* ---------- la roue ---------- */
function construire() {
  roue = document.createElement('div');
  roue.className = 'roue-emoji';
  roue.hidden = true;
  roue.innerHTML = `
    <div class="re-scene" role="dialog" aria-label="Réagir">
      <div class="re-anneau">${R.EMOJIS.map((e, k) => `<button class="re-e" style="--k:${k}" data-e="${e}" aria-label="Réagir ${e}">${e}</button>`).join('')}</div>
      <div class="re-socle" aria-hidden="true"></div>
    </div>
    <p class="re-aide">Glissez pour faire tourner la roue · touchez un emoji</p>`;
  document.body.appendChild(roue);
  anneau = roue.querySelector('.re-anneau');

  roue.addEventListener('click', (ev) => {
    if (glisse) return;
    const b = ev.target.closest('.re-e');
    if (b) choisir(b.dataset.e);
    else if (!ev.target.closest('.re-scene')) fermer();
  });
  // la faire tourner du doigt
  let depart = null, a0 = 0, glisse = false;
  const scene = roue.querySelector('.re-scene');
  scene.addEventListener('pointerdown', (ev) => { depart = ev.clientX; a0 = angle; glisse = false; });
  addEventListener('pointermove', (ev) => {
    if (depart === null) return;
    const dx = ev.clientX - depart;
    if (Math.abs(dx) > 6) glisse = true;
    if (glisse) tourner(a0 + dx * 0.6, false);
  });
  addEventListener('pointerup', () => {
    if (depart === null) return;
    depart = null;
    if (glisse) { tourner(Math.round(angle / PAS) * PAS); sfx.clic(); }
    setTimeout(() => { glisse = false; }, 0);
  });
  addEventListener('keydown', (ev) => {
    if (roue.hidden) return;
    if (ev.key === 'Escape') fermer();
    else if (ev.key === 'ArrowLeft') { tourner(angle + PAS); sfx.clic(); }
    else if (ev.key === 'ArrowRight') { tourner(angle - PAS); sfx.clic(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); choisir(R.EMOJIS[devant()]); }
    else return;
    ev.stopPropagation();
  }, true);
}

/** L'emoji tourné vers soi. */
const devant = () => ((Math.round(-angle / PAS) % R.EMOJIS.length) + R.EMOJIS.length) % R.EMOJIS.length;

function tourner(a, anime = true) {
  angle = a;
  anneau.classList.toggle('net', !anime);
  anneau.style.setProperty('--a', `${a}deg`);
  const k = devant();
  anneau.querySelectorAll('.re-e').forEach((b, n) => b.classList.toggle('devant', n === k));
}

function ouvrir(ecran) {
  if (!roue) construire();
  if (Date.now() - derniere < R.ESPACEMENT_MS) return;
  ouverteSur = ecran;
  roue.hidden = false;
  sfx.clic();
  // elle arrive en tournant, puis se pose avec un petit rebond
  tourner(angle - 360, false);
  void anneau.offsetWidth;
  requestAnimationFrame(() => tourner(angle + 360));
  if (!fx.reduit()) roue.querySelector('.re-scene').animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
  roue.querySelector('.re-e.devant')?.focus({ preventScroll: true });
}

function fermer() {
  if (!roue || roue.hidden) return;
  roue.hidden = true;
  ouverteSur = null;
}

function choisir(e) {
  const b = branches.get(ouverteSur);
  fermer();
  if (!b || !R.valide(e)) return;
  derniere = Date.now();
  montrer(e, b.ancre());
  b.envoyer?.(e);
  // le bouton se repose le temps que la table voie la réaction
  b.bouton.disabled = true;
  setTimeout(() => { b.bouton.disabled = false; }, R.ESPACEMENT_MS);
}

/**
 * Ajoute le bouton 😊 à la barre d'un écran.
 * @param {string} ecran   l'id de l'écran
 * @param {{ ancre: () => Element, envoyer?: (e:string) => void }} o
 */
export function brancher(ecran, { ancre, envoyer }) {
  const barre = document.querySelector(`#${ecran} .barre`);
  if (!barre) return;
  const bouton = document.createElement('button');
  bouton.className = 'btn petit b-reaction';
  bouton.textContent = '😊';
  bouton.setAttribute('aria-label', 'Réagir avec un emoji');
  bouton.hidden = !actives;
  bouton.addEventListener('click', () => ouvrir(ecran));
  barre.insertBefore(bouton, barre.querySelector('.b-boutique'));
  branches.set(ecran, { ancre, envoyer, bouton });
}

/* ---------- le réglage ---------- */
const reglage = document.getElementById('r-reactions');
if (reglage) {
  reglage.checked = actives;
  reglage.addEventListener('change', () => {
    actives = reglage.checked;
    try { localStorage.setItem(CLE, actives ? '1' : '0'); } catch { /* ignore */ }
    for (const b of branches.values()) b.bouton.hidden = !actives;
    if (!actives) fermer();
  });
}
