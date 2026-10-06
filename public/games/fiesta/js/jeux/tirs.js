/**
 * Tirs au But (1 contre tous), comme dans Mario Party : en direct.
 *
 * Les tireurs frappent d'abord, trois tirs chacun : un coin, puis la
 * puissance. Plus c'est fort, plus le ballon va vite ; trop fort, c'est
 * au-dessus, trop mou, le gardien le cueille.
 *
 * Puis le gardien (le joueur seul) affronte chaque tir en direct : le tireur
 * s'élance, frappe, le ballon file vers son coin — il faut plonger du bon
 * côté avant qu'il n'entre. Tout le monde voit l'arrêt ou le but sur le
 * moment : sur le même téléphone, en regardant ; en ligne, en direct (le
 * gardien raconte chaque tir, voir `direct`).
 */
import { el, attendre, son } from './outils.js';
import { coder, chiffre, lireTir, VOL_BALLON, TIRS_PAR_TIREUR } from '../../../../shared/fiesta/minijeux.js';

const COINS = ['à gauche', 'au milieu', 'à droite'];
const FLECHES = ['⬅️', '⬆️', '➡️'];
const PUISSANCES = ['placé', 'appuyé', 'boulet de canon'];
const VISER_MS = 6000;
const ELAN_MS = 900;

/**
 * @param {{ fin, ctx, joueurs, scores?: Array<number|null>, direct?: (e) => void }} o
 *   scores : les tirs des autres (pour le gardien) ; direct : raconter chaque tir aux autres (en ligne).
 */
export function demarrer(zone, { fin, ctx, joueurs, scores = [], direct = null }) {
  let vivant = true;
  const gardien = joueurs[ctx?.solo]?.avatar || '🧤';
  const scene = el('div', 'stade', `
    <div class="stade-info"></div>
    <div class="cage">
      ${COINS.map((c, k) => `<button class="coin" data-coin="${k}" type="button" aria-label="${c}">${FLECHES[k]}</button>`).join('')}
      <span class="gardien">${gardien}</span>
      <span class="ballon">⚽</span>
      <span class="tireur"></span>
    </div>
    <div class="stade-tableau"></div>
    <div class="stade-bas"></div>`);
  zone.appendChild(scene);
  const info = scene.querySelector('.stade-info');
  const bas = scene.querySelector('.stade-bas');
  const tableau = scene.querySelector('.stade-tableau');
  const garde = scene.querySelector('.gardien');
  const ballon = scene.querySelector('.ballon');
  const tireurEl = scene.querySelector('.tireur');

  /** Un coin touché (ou une flèche du clavier). Résout avec le coin, ou null au bout de \`ms\`. */
  const attendreCoin = (ms) => new Promise((ok) => {
    let fait = false;
    const finir = (k) => {
      if (fait) return;
      fait = true;
      scene.removeEventListener('pointerdown', touche);
      removeEventListener('keydown', clavier);
      clearTimeout(t);
      ok(k);
    };
    const touche = (e) => {
      const c = e.target.closest('.coin');
      if (c) { e.preventDefault(); finir(Number(c.dataset.coin)); return; }
      // Le gardien peut aussi toucher n'importe où dans la cage : la position décide du coin.
      const cage = scene.querySelector('.cage').getBoundingClientRect();
      if (ctx?.role === 'solo' && e.clientY > cage.top - 40) {
        e.preventDefault();
        finir(Math.max(0, Math.min(2, Math.floor(((e.clientX - cage.left) / cage.width) * 3))));
      }
    };
    const clavier = (e) => { const k = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2 }[e.key]; if (k !== undefined) { e.preventDefault(); finir(k); } };
    scene.addEventListener('pointerdown', touche);
    addEventListener('keydown', clavier);
    const t = ms ? setTimeout(() => finir(null), ms) : 0;
  });

  /** Une barre qui se vide en \`ms\`. */
  const barre = (ms) => {
    const b = el('div', 'stade-temps', '<i></i>');
    bas.replaceChildren(b);
    const i = b.querySelector('i');
    void i.offsetWidth;
    i.style.transition = `width ${ms}ms linear`;
    i.style.width = '0%';
  };

  /** La frappe : la jauge monte et descend, on tape au bon moment. Rend la puissance (0 à 1). */
  const frapper = () => new Promise((ok) => {
    bas.innerHTML = `<div class="puissance"><i class="p-mou"></i><i class="p-place"></i><i class="p-appuye"></i><i class="p-canon"></i><i class="p-fort"></i><b></b></div>
      <p>Frappez ! (touchez l’écran)</p>`;
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

  /** Le ballon part : vers un coin (en \`ms\`), au-dessus, ou mollement dans les gants. */
  const envoyerBallon = (coin, ms, sorte = '') => {
    ballon.style.transition = 'none';
    ballon.className = 'ballon pret';
    void ballon.offsetWidth;
    ballon.style.transition = `left ${ms}ms linear, bottom ${ms}ms linear, transform ${ms}ms linear`;
    ballon.className = `ballon part c${coin}${sorte ? ` ${sorte}` : ''}`;
  };
  const replacer = () => {
    ballon.style.transition = 'none';
    ballon.className = 'ballon';
    garde.className = 'gardien';
    scene.classList.remove('but', 'arret');
  };

  /** Le tableau des tirs : ✅ but, 🧤 arrêt, ❌ raté. */
  const marque = [];
  const majTableau = () => { tableau.textContent = marque.join(' '); };

  (async () => {
    await attendre(300);

    /* -------------------- le gardien, en direct -------------------- */
    if (ctx?.role === 'solo') {
      const arrets = [];
      const tireurs = ctx.autres || [];
      scene.classList.add('en-garde');
      for (let s = 0; s < tireurs.length && vivant; s++) {
        const t = tireurs[s];
        const j = joueurs[t] || { avatar: '⚽', nom: '' };
        for (let k = 0; k < TIRS_PAR_TIREUR && vivant; k++) {
          replacer();
          const tir = lireTir(chiffre(scores[t] ?? 0, 10, k));
          tireurEl.textContent = j.avatar;
          tireurEl.className = 'tireur elan';
          info.innerHTML = `<span class="qui-tire">${j.avatar}</span> ${j.nom ? `${j.nom} ` : ''}prend son élan… <small>tir ${k + 1}/${TIRS_PAR_TIREUR}</small>`;
          bas.innerHTML = '<p>Touchez le côté où plonger !</p>';
          son.tic();
          const vol = tir ? VOL_BALLON[tir.puissance] : 500;
          // Le gardien plonge quand il veut — avant la frappe, c'est un pari. Le premier toucher compte.
          let choix = null;
          const plongeon = attendreCoin(ELAN_MS + vol + 60).then((c) => {
            if (c === null || !vivant) return;
            choix = { c, t: performance.now() };
            garde.className = `gardien plonge c${c}`;
            son.tape();
          });
          await attendre(ELAN_MS);
          if (!vivant) return;
          tireurEl.className = 'tireur frappe';
          son.boum();
          const depart = performance.now();
          let resultat;
          if (!tir) {
            // Raté : au-dessus, ou trop mou.
            envoyerBallon(1, vol, 'rate');
            await plongeon;
            resultat = 'rate';
            arrets.push(1);
            info.innerHTML = 'Raté ! Le ballon passe au-dessus 😅';
            marque.push('❌');
          } else {
            envoyerBallon(tir.coin, vol);
            await plongeon;
            if (!vivant) return;
            const arrete = !!choix && choix.c === tir.coin && choix.t - depart <= vol;
            if (arrete) {
              ballon.className = `ballon part c${tir.coin} capte`;
              scene.classList.add('arret');
              info.innerHTML = 'ARRÊT ! 🧤';
              son.bon();
              marque.push('🧤');
            } else {
              scene.classList.add('but');
              info.innerHTML = `BUT ! ⚽ <small>${PUISSANCES[tir.puissance]}, ${COINS[tir.coin]}</small>`;
              son.mauvais();
              marque.push('✅');
            }
            resultat = arrete ? 'arret' : 'but';
            arrets.push(arrete ? 1 : 0);
          }
          majTableau();
          bas.replaceChildren();
          direct?.({ tireur: t, k, coin: tir ? tir.coin : null, resultat });
          await attendre(1100);
        }
      }
      if (vivant) fin(coder(arrets, 2));
      return;
    }

    /* -------------------- un tireur : trois tirs -------------------- */
    const tirs = [];
    for (let k = 0; k < TIRS_PAR_TIREUR && vivant; k++) {
      replacer();
      info.innerHTML = `Tir ${k + 1}/${TIRS_PAR_TIREUR} — <b>Visez un coin !</b>`;
      scene.classList.add('vise');
      barre(VISER_MS);
      let c = await attendreCoin(VISER_MS);
      scene.classList.remove('vise');
      if (!vivant) return;
      if (c === null) c = Math.floor(Math.random() * 3);
      info.innerHTML = `Tir ${k + 1}/${TIRS_PAR_TIREUR} — ${FLECHES[c]} <b>Frappez !</b>`;
      const force = await frapper();
      if (!vivant) return;
      bas.replaceChildren();
      son.boum();
      if (force > 0.88) {
        tirs.push(0);
        envoyerBallon(c, 450, 'rate');
        info.innerHTML = 'Au-dessus ! 😱';
        son.mauvais();
        marque.push('❌');
      } else if (force < 0.15) {
        tirs.push(0);
        envoyerBallon(c, 900, 'mou');
        info.innerHTML = 'Trop mou… le gardien le cueille 🧤';
        son.mauvais();
        marque.push('❌');
      } else {
        const puissance = force < 0.5 ? 0 : force < 0.72 ? 1 : 2;
        tirs.push(1 + c * 3 + puissance);
        envoyerBallon(c, VOL_BALLON[puissance]);
        info.innerHTML = `Tir ${PUISSANCES[puissance]} ${COINS[c]} ! <small>Le gardien l’attend…</small>`;
        marque.push(['⚽', '⚽💨', '⚽🔥'][puissance]);
      }
      majTableau();
      await attendre(1100);
    }
    if (vivant) fin(coder(tirs, 10));
  })();
  return () => { vivant = false; };
}
