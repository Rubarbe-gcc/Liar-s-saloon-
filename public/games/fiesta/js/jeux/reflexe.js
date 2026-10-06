/** Duel au Soleil : attendre le « FEU ! », puis tirer. Trois manches, la moyenne compte. */
import { el, attendre, aleatoire, son } from './outils.js';

const MANCHES = 3;
const PENALITE = 1000;

export function demarrer(zone, { fin }) {
  let vivant = true;
  const scene = el('div', 'duel', `
    <div class="duel-ciel"><span class="soleil">☀️</span></div>
    <div class="duel-cowboys"><span>🤠</span><span class="ennemi">🤠</span></div>
    <div class="duel-texte">Prêt ?</div>
    <div class="duel-manches"></div>`);
  zone.appendChild(scene);
  const texte = scene.querySelector('.duel-texte');
  const manches = scene.querySelector('.duel-manches');
  const temps = [];
  let etat = 'attente';   // attente | feu | fini
  let t0 = 0;
  let resoudre = null;

  scene.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (etat === 'attente' && resoudre) {
      son.mauvais();
      texte.textContent = 'Trop tôt ! +1 seconde';
      scene.classList.add('rate');
      const r = resoudre; resoudre = null; r(PENALITE);
    } else if (etat === 'feu' && resoudre) {
      son.boum();
      const ms = Math.round(performance.now() - t0);
      texte.textContent = `${ms} ms !`;
      scene.classList.add('tire');
      const r = resoudre; resoudre = null; r(ms);
    }
  });

  (async () => {
    for (let k = 0; k < MANCHES && vivant; k++) {
      scene.classList.remove('feu', 'rate', 'tire');
      etat = 'attente';
      texte.textContent = 'Attendez…';
      const ms = await new Promise((ok) => {
        resoudre = ok;
        setTimeout(() => {
          // Une manche déjà réglée (tir trop tôt) ne doit pas crier « FEU ! » dans la suivante.
          if (resoudre !== ok || !vivant) return;
          etat = 'feu';
          t0 = performance.now();
          scene.classList.add('feu');
          texte.textContent = 'FEU !';
          son.top();
          // Personne ne tire : la manche compte comme une seconde.
          setTimeout(() => { if (resoudre === ok) { resoudre = null; ok(PENALITE); } }, 1500);
        }, aleatoire(1400, 3800));
      });
      etat = 'fini';
      temps.push(ms);
      manches.innerHTML = temps.map((t) => `<span>${t >= PENALITE ? '❌' : `${t} ms`}</span>`).join('');
      await attendre(1100);
    }
    if (vivant) fin(Math.round(temps.reduce((s, t) => s + t, 0) / temps.length));
  })();
  return () => { vivant = false; resoudre = null; };
}
