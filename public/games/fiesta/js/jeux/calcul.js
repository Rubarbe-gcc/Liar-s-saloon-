/** Calcul Éclair : le plus de bonnes réponses en 15 secondes ; une erreur coûte un point. */
import { el, decompte, minuterie, son, entre, choisir } from './outils.js';

function question() {
  const op = choisir(['+', '+', '−', '×']);
  let a, b, r;
  if (op === '+') { a = entre(2, 30); b = entre(2, 30); r = a + b; }
  else if (op === '−') { a = entre(10, 40); b = entre(1, a); r = a - b; }
  else { a = entre(2, 9); b = entre(2, 9); r = a * b; }
  const choix = new Set([r]);
  while (choix.size < 4) {
    const faux = r + choisir([-10, -2, -1, 1, 2, 10, 3, -3]);
    if (faux >= 0) choix.add(faux);
  }
  return { texte: `${a} ${op} ${b}`, r, choix: [...choix].sort(() => Math.random() - 0.5) };
}

export function demarrer(zone, { fin }) {
  let vivant = true;
  let joue = false;
  let points = 0;
  const cadre = el('div', 'calcul', `<div class="calcul-score">0</div><div class="calcul-q">?</div><div class="calcul-choix"></div>`);
  zone.appendChild(cadre);
  const q = cadre.querySelector('.calcul-q');
  const choix = cadre.querySelector('.calcul-choix');
  const score = cadre.querySelector('.calcul-score');
  let actuelle = null;

  const suivante = () => {
    actuelle = question();
    q.textContent = `${actuelle.texte} = ?`;
    choix.innerHTML = actuelle.choix.map((c) => `<button data-v="${c}">${c}</button>`).join('');
  };
  choix.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b || !joue) return;
    e.preventDefault();
    const juste = Number(b.dataset.v) === actuelle.r;
    points = Math.max(0, points + (juste ? 1 : -1));
    score.textContent = points;
    cadre.classList.remove('juste', 'faux'); void cadre.offsetWidth;
    cadre.classList.add(juste ? 'juste' : 'faux');
    if (juste) son.bon(); else son.mauvais();
    suivante();
  });

  (async () => {
    await decompte(zone, () => vivant);
    if (!vivant) return;
    joue = true;
    suivante();
    minuterie(zone, 15, () => { joue = false; if (vivant) { vivant = false; fin(points); } });
  })();
  return () => { vivant = false; };
}
