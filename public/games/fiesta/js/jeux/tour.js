/**
 * Tour Infernale : le bloc va et vient au-dessus de la tour ; on le lâche.
 * Ce qui dépasse tombe, le bloc suivant est plus petit. Rater, c'est fini.
 */
import { el, son, attendre } from './outils.js';

const HAUTEUR = 7;        // hauteur d'un étage, en % du terrain
const VISIBLES = 9;       // étages visibles à l'écran

export function demarrer(zone, { fin }) {
  let vivant = true;
  const terrain = el('div', 'chantier', '<div class="chantier-score">0</div><div class="pile"></div><div class="aide-tour">Touchez pour lâcher le bloc</div>');
  zone.appendChild(terrain);
  const pile = terrain.querySelector('.pile');
  const affiche = terrain.querySelector('.chantier-score');
  const etages = [{ g: 30, l: 40 }];   // en % : position gauche et largeur
  let bloc = null;
  let x = 0;
  let sens = 1;
  let vitesse = 38;        // % par seconde
  let dernier = performance.now();
  let pose = 0;
  let fini = false;

  const couleur = (n) => `hsl(${(n * 37) % 360} 75% 58%)`;
  const dessiner = () => {
    pile.innerHTML = '';
    const debut = Math.max(0, etages.length - VISIBLES + 1);
    etages.slice(debut).forEach((e, k) => {
      const b = el('div', 'etage');
      b.style.left = `${e.g}%`; b.style.width = `${e.l}%`;
      b.style.bottom = `${k * HAUTEUR}%`; b.style.background = couleur(debut + k);
      pile.appendChild(b);
    });
    bloc = el('div', 'etage mobile');
    bloc.style.width = `${etages[etages.length - 1].l}%`;
    bloc.style.bottom = `${(etages.length - debut) * HAUTEUR}%`;
    bloc.style.background = couleur(etages.length);
    pile.appendChild(bloc);
  };
  dessiner();

  const boucle = (t) => {
    if (!vivant || fini) return;
    const dt = Math.min(0.05, (t - dernier) / 1000);
    dernier = t;
    const l = etages[etages.length - 1].l;
    x += sens * vitesse * dt;
    if (x <= 0) { x = 0; sens = 1; }
    if (x + l >= 100) { x = 100 - l; sens = -1; }
    bloc.style.left = `${x}%`;
    requestAnimationFrame(boucle);
  };
  requestAnimationFrame(boucle);

  const lacher = async () => {
    if (fini || !vivant) return;
    const dessous = etages[etages.length - 1];
    const g = Math.max(x, dessous.g);
    const d = Math.min(x + dessous.l, dessous.g + dessous.l);
    if (d - g <= 0.5) {
      fini = true;
      son.boum();
      bloc.classList.add('tombe');
      await attendre(900);
      if (vivant) { vivant = false; fin(pose); }
      return;
    }
    // Un lâcher presque parfait se recale, et ne rétrécit pas la tour.
    const parfait = Math.abs(x - dessous.g) < 1.2;
    etages.push(parfait ? { g: dessous.g, l: dessous.l } : { g, l: d - g });
    pose++;
    affiche.textContent = pose;
    if (parfait) son.bon(); else son.pas();
    vitesse = Math.min(95, vitesse + 3.5);
    x = Math.random() < 0.5 ? 0 : 100 - (d - g);
    sens = x === 0 ? 1 : -1;
    dessiner();
    if (pose >= 25) { fini = true; await attendre(500); if (vivant) { vivant = false; fin(pose); } }
  };
  terrain.addEventListener('pointerdown', (e) => { e.preventDefault(); terrain.querySelector('.aide-tour')?.remove(); lacher(); });
  const clavier = (e) => { if (e.key === ' ' || e.key === 'Enter') lacher(); };
  addEventListener('keydown', clavier);
  return () => { vivant = false; removeEventListener('keydown', clavier); };
}
