/** Pluie de Fruits : le panier attrape les fruits, évite les bombes. 15 secondes. */
import { el, decompte, minuterie, son, choisir, envol } from './outils.js';

const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍒', '🍉', '🍍'];

export function demarrer(zone, { fin }) {
  let vivant = true;
  let joue = false;
  let points = 0;
  const terrain = el('div', 'verger', '<div class="verger-score">0</div><div class="panier">🧺</div>');
  zone.appendChild(terrain);
  const panier = terrain.querySelector('.panier');
  const affiche = terrain.querySelector('.verger-score');
  let x = 0.5;                  // position du panier, de 0 à 1
  const objets = [];
  let dernier = performance.now();
  let prochain = 0;
  let duree = 0;

  const placer = () => { panier.style.left = `${x * 100}%`; };
  placer();
  const suivre = (e) => {
    const r = terrain.getBoundingClientRect();
    x = Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width));
    placer();
  };
  terrain.addEventListener('pointermove', suivre);
  terrain.addEventListener('pointerdown', (e) => { e.preventDefault(); suivre(e); });
  const clavier = (e) => {
    if (e.key === 'ArrowLeft') { x = Math.max(0.05, x - 0.08); placer(); }
    if (e.key === 'ArrowRight') { x = Math.min(0.95, x + 0.08); placer(); }
  };
  addEventListener('keydown', clavier);

  const lancer = () => {
    const t = Math.random();
    const sorte = t < 0.18 ? 'bombe' : t < 0.24 ? 'etoile' : 'fruit';
    const o = el('div', `objet ${sorte}`, sorte === 'bombe' ? '💣' : sorte === 'etoile' ? '🌟' : choisir(FRUITS));
    terrain.appendChild(o);
    objets.push({ o, sorte, x: 0.06 + Math.random() * 0.88, y: -0.08, v: 0.32 + Math.random() * 0.25 + duree * 0.012 });
  };

  const boucle = (t) => {
    if (!vivant) return;
    const dt = Math.min(0.05, (t - dernier) / 1000);
    dernier = t;
    if (joue) {
      duree += dt;
      prochain -= dt;
      if (prochain <= 0) { lancer(); prochain = Math.max(0.28, 0.75 - duree * 0.03); }
    }
    const r = terrain.getBoundingClientRect();
    for (let k = objets.length - 1; k >= 0; k--) {
      const b = objets[k];
      b.y += b.v * dt;
      b.o.style.left = `${b.x * 100}%`;
      b.o.style.top = `${b.y * 100}%`;
      // Le panier est en bas : il attrape ce qui passe à sa hauteur, à portée.
      if (joue && b.y > 0.84 && b.y < 0.95 && Math.abs(b.x - x) < 0.1) {
        const gain = b.sorte === 'bombe' ? -3 : b.sorte === 'etoile' ? 3 : 1;
        points = Math.max(0, points + gain);
        affiche.textContent = points;
        envol(terrain, b.x * r.width, 0.8 * r.height, gain > 0 ? `+${gain}` : `${gain}`, gain > 0 ? 'bon' : 'mauvais');
        if (gain > 0) son.bon(); else son.boum();
        panier.classList.remove('attrape'); void panier.offsetWidth; panier.classList.add('attrape');
        b.o.remove(); objets.splice(k, 1);
      } else if (b.y > 1.05) { b.o.remove(); objets.splice(k, 1); }
    }
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);

  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    joue = true;
    minuterie(zone, 15, () => { joue = false; if (vivant) { vivant = false; fin(points); } });
  })();
  return () => { vivant = false; removeEventListener('keydown', clavier); };
}
