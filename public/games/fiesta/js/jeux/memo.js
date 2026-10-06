/** Mémo Couleurs : regarder la suite, la rejouer ; elle s'allonge à chaque réussite. */
import { el, attendre, son } from './outils.js';

const COULEURS = ['rouge', 'bleu', 'vert', 'jaune'];

export function demarrer(zone, { fin }) {
  let vivant = true;
  const cadre = el('div', 'memo', `
    <div class="memo-info">Regardez bien…</div>
    <div class="memo-pads">${COULEURS.map((c, k) => `<button class="pad ${c}" data-k="${k}"></button>`).join('')}</div>`);
  zone.appendChild(cadre);
  const info = cadre.querySelector('.memo-info');
  const pads = [...cadre.querySelectorAll('.pad')];
  const suite = [];
  let attente = null;     // ce que le joueur doit refaire
  let pos = 0;
  let reussies = 0;

  const allumer = async (k, ms = 380) => {
    pads[k].classList.add('allume');
    son.couleur(k);
    await attendre(ms);
    pads[k].classList.remove('allume');
  };

  const terminer = () => {
    if (!vivant) return;
    vivant = false;
    info.textContent = `Suite de ${reussies} couleur${reussies > 1 ? 's' : ''} !`;
    setTimeout(() => fin(reussies), 1100);
  };

  const manche = async () => {
    if (!vivant) return;
    suite.push(Math.floor(Math.random() * 4));
    if (suite.length === 1) suite.push(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4));
    info.textContent = 'Regardez bien…';
    cadre.classList.add('montre');
    await attendre(500);
    // Plus la suite est longue, plus elle défile vite.
    const ms = Math.max(200, 420 - suite.length * 18);
    for (const k of suite) { if (!vivant) return; await allumer(k, ms); await attendre(ms / 3); }
    cadre.classList.remove('montre');
    info.textContent = 'À vous !';
    attente = [...suite];
    pos = 0;
  };

  cadre.addEventListener('pointerdown', async (e) => {
    const b = e.target.closest('.pad');
    if (!b || !attente || !vivant) return;
    e.preventDefault();
    const k = Number(b.dataset.k);
    allumer(k, 200);
    if (k !== attente[pos]) { attente = null; son.mauvais(); cadre.classList.add('rate'); terminer(); return; }
    pos++;
    if (pos === attente.length) {
      attente = null;
      reussies = suite.length;
      info.textContent = 'Bravo !';
      son.bon();
      await attendre(600);
      if (reussies >= 20) { terminer(); return; }
      manche();
    }
  });

  manche();
  return () => { vivant = false; };
}
