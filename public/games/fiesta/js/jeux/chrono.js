/** Chrono à l'Aveugle : arrêter le chrono pile à 5,00 s — il se cache après 1,5 s. */
import { el, decompte, son } from './outils.js';

const CIBLE = 5000;

export function demarrer(zone, { fin }) {
  let vivant = true;
  let t0 = 0;
  let parti = false;
  let fini = false;
  const cadre = el('div', 'chrono-cadre', `
    <div class="chrono-cible">Objectif : <b>5,00 s</b></div>
    <div class="chrono-ecran">0,00</div>
    <button class="gros-bouton stop" disabled><span>STOP</span></button>`);
  zone.appendChild(cadre);
  const ecran = cadre.querySelector('.chrono-ecran');
  const bouton = cadre.querySelector('button');

  const arreter = () => {
    if (!parti || fini) return;
    fini = true;
    const t = Math.round(performance.now() - t0);
    const ecart = Math.abs(t - CIBLE);
    ecran.textContent = (t / 1000).toFixed(2).replace('.', ',');
    ecran.classList.add('revele');
    cadre.querySelector('.chrono-cible').innerHTML = ecart < 100 ? `<b>Incroyable !</b> ${ecart} ms d’écart` : `${ecart} ms d’écart`;
    if (ecart < 150) son.bon(); else son.tic();
    bouton.disabled = true;
    setTimeout(() => { if (vivant) fin(ecart); }, 1300);
  };
  bouton.addEventListener('pointerdown', (e) => { e.preventDefault(); arreter(); });

  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    t0 = performance.now();
    parti = true;
    bouton.disabled = false;
    const tic = setInterval(() => {
      if (!vivant || fini) { clearInterval(tic); return; }
      const t = performance.now() - t0;
      ecran.textContent = t < 1500 ? (t / 1000).toFixed(2).replace('.', ',') : '?,??';
      ecran.classList.toggle('cache', t >= 1500);
      if (t > 10000) { clearInterval(tic); arreter(); }
    }, 30);
  })();
  return () => { vivant = false; };
}
