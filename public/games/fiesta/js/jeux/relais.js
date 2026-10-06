/**
 * Course de Relais (2 contre 2) : gauche, droite, gauche, droite… 30 mètres
 * le plus vite possible. Deux fois le même pied, on trébuche. Les temps des
 * deux coéquipiers s'additionnent.
 */
import { el, decompte, son } from './outils.js';

const METRES = 30;
const CHUTE = 500;
const LIMITE = 15000;

export function demarrer(zone, { fin, ctx, joueurs, moi }) {
  let vivant = true;
  let pret = false;
  let pas = 0;
  let dernierPied = null;
  let tombeJusqua = 0;
  let t0 = 0;
  const coureur = joueurs[moi]?.avatar || '🏃';
  const partenaire = (ctx?.equipe || []).filter((i) => i !== moi).map((i) => joueurs[i]?.avatar)[0] || '🏃';

  const scene = el('div', 'relais', `
    <div class="relais-temps">0,00 s</div>
    <div class="relais-piste">
      <span class="relais-coureur">${coureur}</span>
      <span class="relais-arrivee"><span class="temoin">🪄</span>${partenaire}</span>
    </div>
    <div class="relais-metres">0 / ${METRES} m</div>
    <div class="relais-pieds">
      <button class="pied" data-pied="g" type="button" disabled>👣<small>Gauche</small></button>
      <button class="pied" data-pied="d" type="button" disabled>👣<small>Droite</small></button>
    </div>`);
  zone.appendChild(scene);
  const temps = scene.querySelector('.relais-temps');
  const metres = scene.querySelector('.relais-metres');
  const bonhomme = scene.querySelector('.relais-coureur');
  const pieds = [...scene.querySelectorAll('.pied')];

  let fini = false;
  const terminer = (ms) => {
    if (fini) return;
    fini = true;
    pret = false;
    clearInterval(horloge);
    removeEventListener('keydown', clavier);
    pieds.forEach((b) => { b.disabled = true; });
    if (vivant) fin(Math.round(ms));
  };

  const horloge = setInterval(() => {
    if (!t0 || fini) return;
    const ms = performance.now() - t0;
    temps.textContent = `${(ms / 1000).toFixed(2).replace('.', ',')} s`;
    // Trop long : on arrête là, chaque mètre manquant coûte cher.
    if (ms >= LIMITE) terminer(LIMITE + (METRES - pas) * 400);
  }, 30);

  const poser = (pied) => {
    if (!pret || fini) return;
    const now = performance.now();
    if (now < tombeJusqua) return;
    const b = pieds.find((x) => x.dataset.pied === pied);
    b.classList.remove('appui'); void b.offsetWidth; b.classList.add('appui');
    if (pied === dernierPied) {
      tombeJusqua = now + CHUTE;
      dernierPied = null;
      son.mauvais();
      scene.classList.remove('trebuche'); void scene.offsetWidth; scene.classList.add('trebuche');
      return;
    }
    dernierPied = pied;
    pas += 1;
    son.pas();
    bonhomme.style.left = `${4 + (pas / METRES) * 80}%`;
    metres.textContent = `${pas} / ${METRES} m`;
    if (pas >= METRES) { son.fanfare(); terminer(now - t0); }
  };
  scene.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.pied');
    if (!b) return;
    e.preventDefault();
    poser(b.dataset.pied);
  });
  const clavier = (e) => {
    if (['ArrowLeft', 'f', 'F', 'q', 'Q'].includes(e.key)) { e.preventDefault(); poser('g'); }
    if (['ArrowRight', 'j', 'J', 'd', 'D'].includes(e.key)) { e.preventDefault(); poser('d'); }
  };
  addEventListener('keydown', clavier);

  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    pret = true;
    pieds.forEach((b) => { b.disabled = false; });
    t0 = performance.now();
  })();
  return () => { vivant = false; clearInterval(horloge); removeEventListener('keydown', clavier); };
}
