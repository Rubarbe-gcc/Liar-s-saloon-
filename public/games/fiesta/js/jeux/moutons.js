/** Compte les Moutons : combien de moutons sont passés ? Les loups ne comptent pas. */
import { el, attendre, entre, son } from './outils.js';

export function demarrer(zone, { fin }) {
  let vivant = true;
  const pre = el('div', 'pre', '<div class="pre-ciel">☁️ ☁️</div><div class="pre-texte">Comptez les 🐑 !</div>');
  zone.appendChild(pre);
  const moutons = entre(9, 17);
  const loups = entre(3, 7);

  (async () => {
    await attendre(1200);
    pre.querySelector('.pre-texte').remove();
    // Chacun traverse sur une ligne, à son heure et à sa vitesse : on ne peut pas tout voir d'un coup.
    const bestiole = [...Array(moutons).fill('🐑'), ...Array(loups).fill('🐺')].sort(() => Math.random() - 0.5);
    const duree = 6500;
    bestiole.forEach((g, k) => {
      const b = el('div', `bete${g === '🐺' ? ' loup' : ''}`, g);
      b.style.top = `${18 + Math.random() * 62}%`;
      const vitesse = 1.4 + Math.random() * 1.4;
      b.style.animationDuration = `${vitesse}s`;
      b.style.animationDelay = `${(k / bestiole.length) * (duree / 1000 - vitesse)}s`;
      if (Math.random() < 0.3) b.classList.add('saute');
      pre.appendChild(b);
    });
    await attendre(duree + 300);
    if (!vivant) return;
    pre.innerHTML = '';
    let reponse = 10;
    const q = el('div', 'question', `<div class="q-titre">Combien de 🐑 ?</div>
      <div class="q-choix"><button data-d="-1">−</button><b>10</b><button data-d="1">+</button></div>
      <button class="gros-bouton petit-bouton" data-ok>Valider</button>`);
    pre.appendChild(q);
    const b = q.querySelector('b');
    q.addEventListener('click', (e) => {
      const d = e.target.closest('[data-d]');
      if (d) { reponse = Math.max(0, Math.min(40, reponse + Number(d.dataset.d))); b.textContent = reponse; son.tic(); return; }
      if (e.target.closest('[data-ok]') && vivant) {
        vivant = false;
        const ecart = Math.abs(reponse - moutons);
        q.innerHTML = `<div class="q-titre">Il y en avait <b>${moutons}</b> !</div><div class="q-resultat">${ecart === 0 ? 'Parfait ! 🎯' : `${ecart} d’écart`}</div>`;
        if (ecart === 0) son.bon(); else son.mauvais();
        setTimeout(() => fin(ecart), 1500);
      }
    });
  })();
  return () => { vivant = false; };
}
