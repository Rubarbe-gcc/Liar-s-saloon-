/** Tapotage Turbo : le plus de tapes en 8 secondes. */
import { el, decompte, minuterie, son } from './outils.js';

export function demarrer(zone, { fin }) {
  let vivant = true;
  let n = 0;
  let pret = false;
  const compteur = el('div', 'gros-compteur', '0');
  const bouton = el('button', 'gros-bouton', '<span>TAPE !</span>');
  bouton.disabled = true;
  zone.append(compteur, bouton);
  bouton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!pret) return;
    n++;
    compteur.textContent = n;
    son.tape();
    bouton.classList.remove('frappe'); void bouton.offsetWidth; bouton.classList.add('frappe');
  });
  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    pret = true;
    bouton.disabled = false;
    minuterie(zone, 8, () => { pret = false; bouton.disabled = true; if (vivant) fin(n); });
  })();
  return () => { vivant = false; };
}
