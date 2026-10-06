/**
 * FIESTA — les outils communs des mini-jeux.
 *
 * Un mini-jeu est un module qui exporte `demarrer(zone, { fin })` : il
 * dessine dans `zone`, appelle `fin(score)` une seule fois, et renvoie une
 * fonction qui l'arrête net (si on quitte la partie en plein milieu).
 */

export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
export const aleatoire = (a, b) => a + Math.random() * (b - a);
export const entre = (a, b) => Math.floor(aleatoire(a, b + 1));
export const choisir = (l) => l[Math.floor(Math.random() * l.length)];

export function el(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/* ------------------------------------------------------------------ */
/* Les petits sons, faits main (Web Audio)                             */
/* ------------------------------------------------------------------ */

let ctx = null;
let muet = false;
try { muet = localStorage.getItem('fiesta.muet') === '1'; } catch { /* ignore */ }
export const estMuet = () => muet;
export function basculerSon() {
  muet = !muet;
  try { localStorage.setItem('fiesta.muet', muet ? '1' : '0'); } catch { /* ignore */ }
  return muet;
}

function note(freq, duree = 0.12, type = 'square', vol = 0.12, glisse = 0) {
  if (muet) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glisse) o.frequency.exponentialRampToValueAtTime(freq * glisse, t + duree);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + duree + 0.02);
  } catch { /* pas de son */ }
}

export const son = {
  tic: () => note(880, 0.05, 'square', 0.06),
  top: () => note(1320, 0.16, 'square', 0.1),
  bon: () => { note(660, 0.08, 'triangle', 0.16); setTimeout(() => note(990, 0.12, 'triangle', 0.16), 70); },
  mauvais: () => note(180, 0.25, 'sawtooth', 0.1, 0.6),
  boum: () => note(120, 0.35, 'sawtooth', 0.14, 0.4),
  tape: () => note(520 + Math.random() * 80, 0.04, 'square', 0.05),
  de: () => note(300 + Math.random() * 300, 0.03, 'square', 0.05),
  pas: () => note(740, 0.05, 'triangle', 0.1),
  fanfare: () => [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => note(f, 0.22, 'triangle', 0.16), k * 120)),
  couleur: (k) => note([330, 440, 554, 659][k] || 440, 0.28, 'triangle', 0.18),
};

/* ------------------------------------------------------------------ */
/* Le compte à rebours, la barre de temps                              */
/* ------------------------------------------------------------------ */

/** 3, 2, 1, PARTEZ ! Résout quand c'est parti. */
export async function decompte(zone, vivant = () => true) {
  const d = el('div', 'decompte');
  zone.appendChild(d);
  for (const t of ['3', '2', '1']) {
    if (!vivant()) break;
    d.textContent = t;
    d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop');
    son.tic();
    await attendre(650);
  }
  d.textContent = 'PARTEZ !';
  d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop');
  son.top();
  setTimeout(() => d.remove(), 600);
}

/**
 * Une barre de temps. `fini()` est appelé quand elle est vide. L'horloge
 * décide (pas l'image) : un onglet qui ne dessine plus ne bloque pas le jeu.
 */
export function minuterie(zone, secondes, fini) {
  const b = el('div', 'minuterie', '<i></i><span></span>');
  zone.appendChild(b);
  const t0 = performance.now();
  const total = secondes * 1000;
  let arrete = false;
  const maj = () => {
    const reste = Math.max(0, total - (performance.now() - t0));
    b.querySelector('i').style.width = `${(100 * reste) / total}%`;
    b.querySelector('span').textContent = (reste / 1000).toFixed(1);
    b.classList.toggle('urgent', reste < 3000);
  };
  const id = setInterval(() => {
    if (arrete) return;
    maj();
    if (performance.now() - t0 >= total) { arrete = true; clearInterval(id); fini(); }
  }, 50);
  maj();
  return { arreter: () => { arrete = true; clearInterval(id); }, ecoule: () => performance.now() - t0 };
}

/** Un petit nombre qui s'envole d'un point (+1, −2…). */
export function envol(zone, x, y, texte, cls = '') {
  const v = el('div', `petit-envol ${cls}`, texte);
  v.style.left = `${x}px`;
  v.style.top = `${y}px`;
  zone.appendChild(v);
  setTimeout(() => v.remove(), 800);
}
