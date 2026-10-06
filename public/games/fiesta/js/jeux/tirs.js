/**
 * Tirs au But (1 contre tous). Le joueur seul est le gardien : pour chaque
 * tir, il devine le coin et plonge. Les autres tirent trois fois : un coin,
 * puis la frappe au bon moment (trop fort, c'est au-dessus ; trop mou, le
 * gardien cueille le ballon). Chacun choisit de son côté : les tirs et les
 * plongeons se rencontrent aux résultats.
 */
import { el, attendre, son } from './outils.js';
import { coder, TIRS_PAR_TIREUR } from '../../../../shared/fiesta/minijeux.js';

const COINS = ['à gauche', 'au milieu', 'à droite'];
const FLECHES = ['⬅️', '⬆️', '➡️'];
const CHOIX_MS = 3000;

export function demarrer(zone, { fin, ctx, joueurs }) {
  let vivant = true;
  const gardien = joueurs[ctx?.solo]?.avatar || '🧤';
  const scene = el('div', 'stade', `
    <div class="stade-info"></div>
    <div class="cage">
      ${COINS.map((c, k) => `<button class="coin" data-coin="${k}" type="button" aria-label="Viser ${c}">${FLECHES[k]}</button>`).join('')}
      <span class="gardien">${gardien}</span>
      <span class="ballon">⚽</span>
    </div>
    <div class="stade-bas"></div>`);
  zone.appendChild(scene);
  const info = scene.querySelector('.stade-info');
  const bas = scene.querySelector('.stade-bas');
  const garde = scene.querySelector('.gardien');
  const ballon = scene.querySelector('.ballon');

  /** Attend un toucher sur un coin (ou une flèche du clavier) ; au bout du temps, un coin au hasard. */
  const choisirCoin = (ms) => new Promise((ok) => {
    scene.classList.add('vise');
    const barre = el('div', 'stade-temps', '<i></i>');
    bas.replaceChildren(barre);
    const i = barre.querySelector('i');
    void i.offsetWidth;
    i.style.transition = `width ${ms}ms linear`;
    i.style.width = '0%';
    let fait = false;
    const finir = (k) => {
      if (fait) return;
      fait = true;
      scene.classList.remove('vise');
      scene.removeEventListener('pointerdown', touche);
      removeEventListener('keydown', clavier);
      clearTimeout(t);
      ok(k);
    };
    const touche = (e) => { const c = e.target.closest('.coin'); if (c) { e.preventDefault(); finir(Number(c.dataset.coin)); } };
    const clavier = (e) => { const k = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2 }[e.key]; if (k !== undefined) { e.preventDefault(); finir(k); } };
    scene.addEventListener('pointerdown', touche);
    addEventListener('keydown', clavier);
    const t = setTimeout(() => finir(Math.floor(Math.random() * 3)), ms);
  });

  /** La frappe : la jauge monte et descend, on tape au bon moment. Rend la puissance (0 à 1). */
  const frapper = () => new Promise((ok) => {
    bas.innerHTML = '<div class="puissance"><i class="p-mou"></i><i class="p-bon"></i><i class="p-fort"></i><b></b></div><p>Frappez ! (touchez l’écran)</p>';
    const b = bas.querySelector('b');
    const t0 = performance.now();
    const niveau = () => { const x = ((performance.now() - t0) / 900) % 2; return x < 1 ? x : 2 - x; };
    const anim = setInterval(() => { b.style.left = `${niveau() * 100}%`; }, 16);
    const depuis = Date.now();
    const finir = (e) => {
      if (Date.now() - depuis < 200) return;
      e?.preventDefault?.();
      clearInterval(anim);
      scene.removeEventListener('pointerdown', finir);
      removeEventListener('keydown', clavier);
      clearTimeout(t);
      ok(niveau());
    };
    const clavier = (e) => { if (e.key === ' ' || e.key === 'Enter') finir(e); };
    scene.addEventListener('pointerdown', finir);
    addEventListener('keydown', clavier);
    // Personne ne frappe : un tir mou.
    const t = setTimeout(() => finir(), 6000);
  });

  const tirer = (coin, ok) => {
    ballon.className = `ballon part c${coin}${ok ? '' : ' rate'}`;
  };

  (async () => {
    await attendre(300);
    if (ctx?.role === 'solo') {
      // Le gardien : un plongeon par tir, tireur par tireur.
      const plongeons = [];
      const tireurs = ctx.autres || [];
      for (const t of tireurs) {
        for (let k = 0; k < TIRS_PAR_TIREUR && vivant; k++) {
          const j = joueurs[t] || { avatar: '⚽', nom: '' };
          info.innerHTML = `<span class="qui-tire">${j.avatar}</span> prend son élan… <small>tir ${k + 1}/${TIRS_PAR_TIREUR}</small><br><b>Plongez !</b>`;
          ballon.className = 'ballon';
          garde.className = 'gardien';
          son.tic();
          const c = await choisirCoin(CHOIX_MS);
          if (!vivant) return;
          plongeons.push(c);
          garde.className = `gardien plonge c${c}`;
          son.boum();
          info.innerHTML = `Plongeon ${COINS[c]} ! <small>Verdict aux résultats…</small>`;
          bas.replaceChildren();
          await attendre(650);
        }
      }
      if (vivant) fin(coder(plongeons, 3));
      return;
    }
    // Un tireur : trois tirs.
    const tirs = [];
    for (let k = 0; k < TIRS_PAR_TIREUR && vivant; k++) {
      ballon.className = 'ballon';
      garde.className = 'gardien';
      info.innerHTML = `Tir ${k + 1}/${TIRS_PAR_TIREUR} — <b>Visez un coin !</b>`;
      const c = await choisirCoin(CHOIX_MS * 2);
      if (!vivant) return;
      info.innerHTML = `Tir ${k + 1}/${TIRS_PAR_TIREUR} — ${FLECHES[c]} <b>Frappez !</b>`;
      const force = await frapper();
      if (!vivant) return;
      bas.replaceChildren();
      son.boum();
      if (force > 0.85) {
        tirs.push(3);
        tirer(c, false);
        info.innerHTML = 'Au-dessus ! 😱';
        son.mauvais();
      } else if (force < 0.18) {
        tirs.push(3);
        tirer(c, false);
        info.innerHTML = 'Trop mou… le gardien le cueille 🧤';
        son.mauvais();
      } else {
        tirs.push(c);
        tirer(c, true);
        info.innerHTML = `Tir cadré ${COINS[c]} ! <small>Le gardien a-t-il deviné ?</small>`;
      }
      await attendre(1000);
    }
    if (vivant) fin(coder(tirs, 4));
  })();
  return () => { vivant = false; };
}
