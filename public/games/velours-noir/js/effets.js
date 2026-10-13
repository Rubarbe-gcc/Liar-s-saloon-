/**
 * LE VELOURS NOIR — le « juice » : cartes et jetons qui volent, cartes qui
 * se retournent, pluie de jetons, éclats, flash, secousse, texte flottant,
 * compteur qui défile. Tout se raccourcit quand l'appareil demande moins
 * de mouvement.
 */

import { nomRang, rouge } from '../../../shared/casino/cartes.js';

export const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const attendre = (ms) => new Promise((r) => setTimeout(r, reduit() ? Math.min(ms, 120) : ms));
const D = (ms) => (reduit() ? Math.min(ms, 80) : ms);

/**
 * La fin d'une animation, ou son délai prévu (plus un peu) si la page ne
 * dessine plus d'images (onglet en arrière-plan) : la partie ne reste jamais bloquée.
 */
export function fini(a) {
  const t = a.effect?.getTiming?.() || {};
  const total = (Number(t.delay) || 0) + (Number(t.duration) || 0) * (Number.isFinite(t.iterations) ? t.iterations : 1);
  return Promise.race([a.finished.catch(() => {}), new Promise((r) => setTimeout(r, total + 150))]);
}

export const VALEURS_JETONS = [1, 5, 25, 100, 500, 1000, 5000];
const fmt = new Intl.NumberFormat('fr-FR');
export const nombre = (n) => fmt.format(n);

/* ------------------------------------------------------------------ */
/* Les cartes                                                          */
/* ------------------------------------------------------------------ */

/** Les figures : une grande lettre (V, D, R) sous une couronne, plus lisible qu'un dessin. */
const COURONNES = { 11: '', 12: '♕', 13: '♔' };

/** Une carte en DOM ; sans `c`, on ne voit que son dos. */
export function elCarte(c, { petite = false } = {}) {
  const el = document.createElement('div');
  el.className = `carte${petite ? ' petite' : ''}`;
  el.innerHTML = '<div class="face"></div><div class="dos"></div>';
  if (c) remplir(el, c); else el.classList.add('cachee');
  return el;
}

/** Donne sa face à une carte (pour la retourner ensuite). */
export function remplir(el, c) {
  const r = nomRang(c.r);
  const coul = rouge(c.c) ? 'rouge' : 'noire';
  el.dataset.carte = `${c.r}${c.c}`;
  el.querySelector('.face').className = `face ${coul}${c.r >= 11 && c.r <= 13 ? ' figure' : ''}${c.r === 14 ? ' as' : ''}`;
  el.querySelector('.face').innerHTML =
    `<span class="coin">${r}<i>${c.c}</i></span>` +
    `<span class="milieu">${c.r >= 11 && c.r <= 13 ? `<small class="couronne">${COURONNES[c.r]}</small><b>${r}</b><small>${c.c}</small>` : c.c}</span>` +
    `<span class="coin bas">${r}<i>${c.c}</i></span>`;
}

/** Retourner une carte face visible. */
export async function retourner(el, c) {
  if (c) remplir(el, c);
  el.classList.remove('cachee');
  await attendre(320);
}

/**
 * Fait arriver un élément (déjà à sa place dans la page) depuis `depuis`
 * (un élément ou un DOMRect) : la technique FLIP.
 */
export function arriver(el, depuis, { duree = 420, tour = 0, delai = 0, echelle = 0.6 } = {}) {
  const a = depuis instanceof Element ? depuis.getBoundingClientRect() : depuis;
  const b = el.getBoundingClientRect();
  if (!a || !b.width) return Promise.resolve();
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const anim = el.animate([
    { transform: `translate(${dx}px, ${dy}px) rotate(${tour}deg) scale(${echelle})`, opacity: 0.6 },
    { transform: 'translate(0,0) rotate(0) scale(1.06)', opacity: 1, offset: 0.82 },
    { transform: 'none', opacity: 1 },
  ], { duration: D(duree), delay: D(delai), easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
  return fini(anim);
}

/** Fait partir un élément vers une cible, puis le retire. */
export function partir(el, vers, { duree = 450, delai = 0, tour = 0 } = {}) {
  const a = el.getBoundingClientRect();
  const b = vers instanceof Element ? vers.getBoundingClientRect() : vers;
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = el.animate([
    { transform: 'none', opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${tour}deg) scale(.5)`, opacity: 0 },
  ], { duration: D(duree), delay: D(delai), easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
  return fini(anim).then(() => el.remove());
}

/* ------------------------------------------------------------------ */
/* Les jetons                                                          */
/* ------------------------------------------------------------------ */

/** Décompose un montant en jetons, du plus gros au plus petit. */
export function decomposer(n, max = 12) {
  const out = [];
  for (let k = VALEURS_JETONS.length - 1; k >= 0 && out.length < max; k--) {
    const v = VALEURS_JETONS[k];
    while (n >= v && out.length < max) { out.push(v); n -= v; }
  }
  return out;
}

export function elJeton(v, { petit = false } = {}) {
  const el = document.createElement('span');
  el.className = `jeton j${v}${petit ? ' petit' : ''}`;
  el.dataset.v = v;
  el.innerHTML = `<b>${v >= 1000 ? `${v / 1000}k` : v}</b>`;
  return el;
}

/** Une pile de jetons pour un montant, avec l'étiquette du total. */
export function pile(montant, { etiquette = true, max = 9 } = {}) {
  const el = document.createElement('div');
  el.className = 'pile';
  decomposer(montant, max).reverse().forEach((v, k) => {
    const j = elJeton(v, { petit: true });
    j.style.setProperty('--k', k);
    el.appendChild(j);
  });
  if (etiquette && montant > 0) {
    const t = document.createElement('em');
    t.textContent = nombre(montant);
    el.appendChild(t);
  }
  return el;
}

let calque = null;
/** Le calque au-dessus de tout, pour ce qui vole d'un endroit à l'autre. */
function lecalque() {
  if (!calque || !calque.isConnected) {
    calque = document.createElement('div');
    calque.className = 'calque-vol';
    document.body.appendChild(calque);
  }
  return calque;
}

/**
 * Des jetons qui volent d'un endroit à un autre (mise, gain, ramassage).
 * @returns une promesse, tenue quand le dernier est arrivé
 */
export function volerJetons(montant, depuis, vers, { max = 8, duree = 520, etalement = 55 } = {}) {
  const a = depuis instanceof Element ? depuis.getBoundingClientRect() : depuis;
  const b = vers instanceof Element ? vers.getBoundingClientRect() : vers;
  if (!a || !b || montant <= 0) return Promise.resolve();
  const vs = decomposer(montant, max);
  const c = lecalque();
  const fins = vs.map((v, k) => {
    const j = elJeton(v);
    const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 16, y0 = a.top + a.height / 2 + (Math.random() - 0.5) * 10;
    const x1 = b.left + b.width / 2 + (Math.random() - 0.5) * 10, y1 = b.top + b.height / 2 - k * 2;
    j.style.left = `${x0}px`; j.style.top = `${y0}px`;
    c.appendChild(j);
    const haut = Math.min(80, Math.hypot(x1 - x0, y1 - y0) * 0.25);
    const anim = j.animate([
      { transform: 'translate(-50%,-50%) scale(.9)' },
      { transform: `translate(calc(-50% + ${(x1 - x0) / 2}px), calc(-50% + ${(y1 - y0) / 2 - haut}px)) scale(1.12)`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(1)` },
    ], { duration: D(duree), delay: D(k * etalement), easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
    return fini(anim).then(() => j.remove());
  });
  return Promise.all(fins);
}

/* ------------------------------------------------------------------ */
/* Particules : pluie de jetons, éclats, confettis                     */
/* ------------------------------------------------------------------ */

let toile = null, g = null, parts = [], boucle = 0;
const COULEURS_JETONS = ['#d23a3a', '#1f8a5a', '#1a1a1f', '#7b3fc4', '#d9b45a', '#f4ead6'];

function laToile() {
  if (!toile || !toile.isConnected) {
    toile = document.createElement('canvas');
    toile.className = 'toile-effets';
    document.body.appendChild(toile);
    g = toile.getContext('2d');
  }
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (toile.width !== innerWidth * dpr) { toile.width = innerWidth * dpr; toile.height = innerHeight * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  return g;
}

function lancerBoucle() {
  if (boucle) return;
  let t0 = performance.now();
  const pas = (t) => {
    const dt = Math.min(0.05, (t - t0) / 1000); t0 = t;
    g.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => (p.vie -= dt) > 0);
    for (const p of parts) {
      p.vy += p.grav * dt; p.vx *= 1 - p.frot * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = Math.min(1, p.vie / 0.4);
      g.save();
      g.globalAlpha = a;
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      if (p.type === 'jeton') {
        g.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
        g.fillStyle = p.c; g.beginPath(); g.arc(0, 0, p.r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#ffffffcc'; g.lineWidth = p.r * 0.28; g.setLineDash([p.r * 0.5, p.r * 0.5]);
        g.beginPath(); g.arc(0, 0, p.r * 0.82, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#ffffff40'; g.beginPath(); g.arc(0, 0, p.r * 0.5, 0, Math.PI * 2); g.fill();
      } else if (p.type === 'eclat') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = p.c;
        g.beginPath(); g.moveTo(0, -p.r); g.lineTo(p.r * 0.25, 0); g.lineTo(0, p.r); g.lineTo(-p.r * 0.25, 0); g.closePath(); g.fill();
        g.rotate(Math.PI / 2);
        g.beginPath(); g.moveTo(0, -p.r * 0.6); g.lineTo(p.r * 0.2, 0); g.lineTo(0, p.r * 0.6); g.lineTo(-p.r * 0.2, 0); g.closePath(); g.fill();
      } else {
        g.fillStyle = p.c; g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      }
      g.restore();
    }
    if (parts.length) boucle = requestAnimationFrame(pas);
    else { boucle = 0; g.clearRect(0, 0, innerWidth, innerHeight); }
  };
  boucle = requestAnimationFrame(pas);
}

const MAX_PARTS = 260;
function ajouter(p) { if (parts.length < MAX_PARTS) parts.push(p); }

/** Une pluie de jetons du haut de l'écran (gros gain). */
export function pluieDeJetons(n = 60) {
  if (reduit()) return;
  laToile();
  for (let k = 0; k < n; k++) {
    ajouter({ type: 'jeton', x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 200, grav: 520, frot: 0.2, r: 9 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, vie: 2.6 + Math.random(), c: COULEURS_JETONS[k % COULEURS_JETONS.length] });
  }
  lancerBoucle();
}

/** Des éclats dorés qui jaillissent d'un point. */
export function eclats(x, y, n = 24, couleur = '#ffd97a') {
  if (reduit()) return;
  if (x instanceof Element) { const r = x.getBoundingClientRect(); y = r.top + r.height / 2; x = r.left + r.width / 2; }
  laToile();
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 320;
    ajouter({ type: 'eclat', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, grav: 260, frot: 2.2, r: 5 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, vie: 0.6 + Math.random() * 0.6, c: couleur });
  }
  lancerBoucle();
}

/** Des confettis, du bas, en gerbe (blackjack, plein à la roulette). */
export function confettis(x, y, n = 70) {
  if (reduit()) return;
  if (x instanceof Element) { const r = x.getBoundingClientRect(); y = r.top + r.height / 2; x = r.left + r.width / 2; }
  laToile();
  const cs = ['#d9b45a', '#f3dc9a', '#b3243a', '#f4ead6', '#1f8a5a'];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 300 + Math.random() * 420;
    ajouter({ type: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 620, frot: 1.4, r: 7 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 18, vie: 1.6 + Math.random() * 0.8, c: cs[k % cs.length] });
  }
  lancerBoucle();
}

/* ------------------------------------------------------------------ */
/* Flash, secousse, texte flottant, compteur                           */
/* ------------------------------------------------------------------ */

export function flash(couleur = 'rgba(255,230,160,.35)', duree = 260) {
  if (reduit()) return;
  const f = document.createElement('div');
  f.className = 'flash';
  f.style.background = couleur;
  document.body.appendChild(f);
  fini(f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duree, easing: 'ease-out' })).then(() => f.remove());
}

export function secouer(el, force = 6, duree = 320) {
  if (reduit() || !el) return;
  const kf = [];
  for (let k = 0; k <= 8; k++) {
    const a = force * (1 - k / 8);
    kf.push({ transform: k === 8 ? 'none' : `translate(${(Math.random() - 0.5) * 2 * a}px, ${(Math.random() - 0.5) * 2 * a}px)` });
  }
  el.animate(kf, { duration: duree, easing: 'linear' });
}

/** Un texte qui monte et s'efface (« +250 », « BLACKJACK ! »). */
export function texte(t, ou, classe = '') {
  const r = ou instanceof Element ? ou.getBoundingClientRect() : ou;
  const el = document.createElement('div');
  el.className = `flottant ${classe}`;
  el.textContent = t;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top + r.height / 2}px`;
  lecalque().appendChild(el);
  el.animate([
    { transform: 'translate(-50%,-30%) scale(.5)', opacity: 0 },
    { transform: 'translate(-50%,-80%) scale(1.15)', opacity: 1, offset: 0.18 },
    { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%,-160%) scale(1)', opacity: 0 },
  ], { duration: D(1500), easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => el.remove(), () => el.remove());
  setTimeout(() => el.remove(), D(1500) + 300);
}

/** Un nombre qui défile jusqu'à sa nouvelle valeur. */
export function compter(el, vers, duree = 700) {
  const de = Number(el.dataset.n ?? vers);
  el.dataset.n = vers;
  if (de === vers || reduit()) { el.textContent = nombre(vers); return; }
  const t0 = performance.now();
  el.classList.add(vers > de ? 'monte' : 'descend');
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / duree);
    const e = 1 - (1 - k) ** 3;
    el.textContent = nombre(Math.round(de + (vers - de) * e));
    if (k < 1 && el.dataset.n == vers) requestAnimationFrame(pas);
    else el.classList.remove('monte', 'descend');
  };
  requestAnimationFrame(pas);
}

/** Un petit « pop » d'échelle. */
export function pop(el, fort = 1.18) {
  if (reduit() || !el) return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${fort})` }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}
