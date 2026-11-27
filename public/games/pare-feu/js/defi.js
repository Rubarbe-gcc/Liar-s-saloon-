/**
 * PARE-FEU — le mini-défi qu'il faut réussir pour lancer une action.
 *
 * Une combinaison à reproduire : un enchaînement de flèches, de lettres et de
 * chiffres, d'autant plus long que l'action est forte (`defi` + 1 symboles).
 * Au clavier : les flèches (ou ZQSD/WASD), les lettres et les chiffres ; au
 * doigt : le pavé (les 4 flèches et les 4 lettres/chiffres du défi).
 * La partie continue pendant le défi. Une erreur ne fait pas échouer, mais
 * l'action n'est plus « parfaite » ; le temps écoulé, elle est perdue.
 * La brèche est une combinaison de 5 où chaque bon symbole compte (score).
 */

const $ = (id) => document.getElementById(id);
const FLECHES = ['←', '↑', '→', '↓'];
const TOUCHES_FLECHES = { ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓', q: '←', a: '←', z: '↑', w: '↑', d: '→', s: '↓' };
// Sans Z, Q, S, D, W, A : ces lettres servent de flèches.
const LETTRES = 'BCEFGHJKLMNPRTUVXY';
const CHIFFRES = '123456789';
const hasard = (n) => Math.floor(Math.random() * n);
const melanger = (t) => { for (let i = t.length - 1; i > 0; i--) { const j = hasard(i + 1); [t[i], t[j]] = [t[j], t[i]]; } return t; };

/** Une combinaison de `n` symboles et son pavé. */
export function combinaison(n) {
  const lettres = melanger([...LETTRES]).slice(0, 2);
  const chiffres = melanger([...CHIFFRES]).slice(0, 2);
  const autres = [...lettres, ...chiffres];
  const suite = [];
  for (let i = 0; i < n; i++) {
    let s;
    do s = Math.random() < 0.45 ? FLECHES[hasard(4)] : autres[hasard(4)];
    while (i > 0 && s === suite[i - 1] && Math.random() < 0.7);
    suite.push(s);
  }
  return { suite, pave: [...FLECHES, ...melanger(autres)] };
}

/**
 * Crée le gestionnaire de défis.
 * @param {{ son: (nom:string, ecart?:number) => void }} o
 */
export function creerDefis(o) {
  let d = null;

  function rendre() {
    $('df-zone').innerHTML = `<div class="suite">${d.suite.map((c, k) => `<span class="case ${FLECHES.includes(c) ? 'fl' : /\d/.test(c) ? 'ch' : 'le'} ${k < d.i ? 'ok' : k === d.i ? 'cur' : ''}">${c}</span>`).join('')}</div>`;
    const pave = $('df-pave');
    pave.className = 'pave mixte';
    pave.innerHTML = d.pave.map((c) => `<button data-v="${c}" class="${FLECHES.includes(c) ? 'fl' : ''}">${c}</button>`).join('');
  }

  function majCases() {
    $('df-zone').querySelectorAll('.case').forEach((el, k) => {
      el.classList.toggle('ok', k < d.i);
      el.classList.toggle('cur', k === d.i);
    });
  }

  function entree(v) {
    if (!d) return;
    if (v === d.suite[d.i]) {
      d.i++;
      o.son('fleche', 0);
      if (d.i >= d.suite.length) { terminer(true); return; }
      majCases();
    } else {
      d.fautes++;
      o.son('rate', 0);
      const b = $('ov-defi').querySelector('.boite');
      b.classList.remove('secoue'); void b.offsetWidth; b.classList.add('secoue');
    }
  }

  function terminer(reussi) {
    if (!d) return;
    const x = d;
    d = null;
    $('ov-defi').hidden = true;
    x.fin({ reussi, parfait: reussi && x.fautes === 0, score: x.i });
  }

  $('df-pave').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    e.preventDefault();
    entree(b.dataset.v);
  });
  $('df-annuler').addEventListener('click', () => { if (d) { o.son('refus'); terminer(false); } });

  return {
    actif: () => !!d,

    /**
     * Ouvre un défi. o2 = { titre, n, couleur, breche?, temps?, fin(r) }.
     * r = { reussi, parfait, score }.
     */
    ouvrir(o2) {
      if (d) return false;
      const n = Math.max(2, o2.n);
      const c = combinaison(n);
      d = { ...c, i: 0, fautes: 0, fin: o2.fin, debut: performance.now(), breche: !!o2.breche, temps: o2.breche ? o2.temps : 1.2 + n * 0.8 };
      $('df-titre').textContent = o2.titre;
      $('df-consigne').textContent = o2.breche ? 'Chaque bon symbole frappe' : `Combinaison de ${n}`;
      $('ov-defi').style.setProperty('--c', o2.couleur || '#ffb02e');
      rendre();
      $('ov-defi').hidden = false;
      o.son('fleche');
      return true;
    },

    /** Une touche du clavier ; renvoie vrai si le défi l'a prise. */
    touche(k) {
      if (!d) return false;
      if (k === 'Escape') { o.son('refus'); terminer(false); return true; }
      if (k in TOUCHES_FLECHES) { entree(TOUCHES_FLECHES[k]); return true; }
      if (/^[a-z0-9]$/i.test(k)) { entree(k.toUpperCase()); return true; }
      return false;
    },

    /** À chaque image : le temps qui reste. */
    maj(t) {
      if (!d) return;
      const k = (t - d.debut) / 1000 / d.temps;
      $('df-temps').style.width = `${Math.max(0, 1 - k) * 100}%`;
      if (k >= 1) {
        if (d.breche) terminer(true);
        else { o.son('rate', 0); terminer(false); }
      }
    },

    fermer() { if (d) { d = null; $('ov-defi').hidden = true; } },
  };
}
