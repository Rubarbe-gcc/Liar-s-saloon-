/** Tape-Taupes : +1 par taupe, −2 par lapin. 12 secondes. */
import { el, decompte, minuterie, son, envol, aleatoire } from './outils.js';

export function demarrer(zone, { fin }) {
  let vivant = true;
  let joue = false;
  let points = 0;
  const champ = el('div', 'champ', `<div class="champ-score">0</div>
    <div class="trous">${Array.from({ length: 9 }, (_, k) => `<div class="trou" data-k="${k}"><span class="bete-trou"></span></div>`).join('')}</div>`);
  zone.appendChild(champ);
  const trous = [...champ.querySelectorAll('.trou')];
  const affiche = champ.querySelector('.champ-score');
  const occupe = new Map();     // k → { sorte, minuteur }

  const sortir = () => {
    if (!joue || !vivant) return;
    const libres = trous.map((_, k) => k).filter((k) => !occupe.has(k));
    if (libres.length) {
      const k = libres[Math.floor(Math.random() * libres.length)];
      const sorte = Math.random() < 0.2 ? 'lapin' : 'taupe';
      const t = trous[k];
      t.querySelector('.bete-trou').textContent = sorte === 'lapin' ? '🐰' : '🐹';
      t.classList.add('sort');
      const minuteur = setTimeout(() => rentrer(k), aleatoire(650, 1050));
      occupe.set(k, { sorte, minuteur });
    }
    setTimeout(sortir, aleatoire(260, 520));
  };
  const rentrer = (k) => {
    const o = occupe.get(k);
    if (o) clearTimeout(o.minuteur);
    occupe.delete(k);
    trous[k].classList.remove('sort', 'touche');
  };

  champ.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.trou');
    if (!t || !joue) return;
    e.preventDefault();
    const k = Number(t.dataset.k);
    const o = occupe.get(k);
    if (!o) return;
    const gain = o.sorte === 'lapin' ? -2 : 1;
    points = Math.max(0, points + gain);
    affiche.textContent = points;
    const r = t.getBoundingClientRect();
    const z = zone.getBoundingClientRect();
    envol(zone, r.left - z.left + r.width / 2, r.top - z.top, gain > 0 ? '+1' : '−2', gain > 0 ? 'bon' : 'mauvais');
    if (gain > 0) son.bon(); else son.mauvais();
    t.classList.add('touche');
    occupe.delete(k);
    clearTimeout(o.minuteur);
    setTimeout(() => t.classList.remove('sort', 'touche'), 180);
  });

  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    joue = true;
    sortir();
    minuterie(zone, 12, () => { joue = false; if (vivant) { vivant = false; fin(points); } });
  })();
  return () => { vivant = false; joue = false; };
}
