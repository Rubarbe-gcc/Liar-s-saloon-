/**
 * Le Fantôme (1 contre tous). Le joueur seul est le fantôme : à chaque
 * manche, il choisit une cachette dans le manoir. Les autres sont les
 * chasseurs : à chaque manche, chacun fouille une pièce. Trouvé deux fois
 * sur trois, le fantôme a perdu. Les cachettes et les fouilles se
 * rencontrent aux résultats.
 */
import { el, attendre, son } from './outils.js';
import { coder, MANCHES_FANTOME, piecesFantome } from '../../../../shared/fiesta/minijeux.js';

const PIECES = [['🛏️', 'Chambre'], ['🍳', 'Cuisine'], ['📚', 'Bibliothèque'], ['🛁', 'Salle de bain'], ['🕯️', 'Grenier'], ['🍷', 'Cave']];
const CHOIX_MS = 6000;

export function demarrer(zone, { fin, ctx }) {
  let vivant = true;
  const fantome = ctx?.role === 'solo';
  const n = piecesFantome((ctx?.autres || [1, 2, 3]).length);
  const scene = el('div', `manoir${fantome ? ' est-fantome' : ''}`, `
    <div class="manoir-info"></div>
    <div class="manoir-pieces">${PIECES.slice(0, n).map(([g, nom], k) => `<button class="piece" data-piece="${k}" type="button">
      <span class="g">${g}</span><small>${nom}</small><span class="marque"></span></button>`).join('')}</div>
    <div class="stade-temps"><i></i></div>`);
  zone.appendChild(scene);
  const info = scene.querySelector('.manoir-info');
  const pieces = [...scene.querySelectorAll('.piece')];
  const barre = scene.querySelector('.stade-temps i');

  const choisir = () => new Promise((ok) => {
    pieces.forEach((p) => { p.disabled = false; p.classList.remove('choisie'); p.querySelector('.marque').textContent = ''; });
    barre.style.transition = 'none';
    barre.style.width = '100%';
    void barre.offsetWidth;
    barre.style.transition = `width ${CHOIX_MS}ms linear`;
    barre.style.width = '0%';
    let fait = false;
    const finir = (k) => {
      if (fait) return;
      fait = true;
      clearTimeout(t);
      // La barre s'arrête là où on a choisi.
      barre.style.width = getComputedStyle(barre).width;
      barre.style.transition = 'none';
      scene.removeEventListener('pointerdown', touche);
      pieces.forEach((p) => { p.disabled = true; });
      ok(k);
    };
    const touche = (e) => { const p = e.target.closest('.piece'); if (p && !p.disabled) { e.preventDefault(); finir(Number(p.dataset.piece)); } };
    scene.addEventListener('pointerdown', touche);
    const t = setTimeout(() => finir(Math.floor(Math.random() * n)), CHOIX_MS);
  });

  (async () => {
    await attendre(300);
    const choix = [];
    for (let m = 0; m < MANCHES_FANTOME && vivant; m++) {
      info.innerHTML = `Manche ${m + 1}/${MANCHES_FANTOME} — <b>${fantome ? 'Où vous cachez-vous ? 👻' : 'Quelle pièce fouillez-vous ? 🔦'}</b>`;
      son.tic();
      const k = await choisir();
      if (!vivant) return;
      choix.push(k);
      const p = pieces[k];
      p.classList.add('choisie');
      p.querySelector('.marque').textContent = fantome ? '👻' : '🔦';
      if (fantome) son.mauvais(); else son.top();
      info.innerHTML = fantome ? `Caché dans : ${PIECES[k][1]}… chut !` : `Vous fouillez : ${PIECES[k][1]}… verdict aux résultats !`;
      await attendre(1100);
    }
    if (vivant) fin(coder(choix, n));
  })();
  return () => { vivant = false; };
}
