/**
 * Le Fantôme (1 contre tous) : un cache-cache dans le manoir hanté.
 *
 * Une action à la fois (la partie mène les manches, voir
 * shared/fiesta/cachecache.js) :
 *   un joueur caché choisit sa pièce parmi celles qui restent ouvertes ;
 *   le fantôme regarde les ombres courir de pièce en pièce, jusqu'à la
 *   coupure de courant, puis ouvre une porte.
 * À l'entraînement, le module joue tout le cache-cache contre l'ordinateur.
 */
import { el, attendre, son } from './outils.js';
import * as CC from '../../../../shared/fiesta/cachecache.js';

const CHOIX_MS = 10000;
const PAS_OMBRE = 650;

/** Le manoir : les pièces ouvertes, les pièces condamnées. */
function manoirHtml(st) {
  return Array.from({ length: st.pieces }, (_, k) => {
    const [g, nom] = CC.PIECES[k];
    const ferme = !st.ouvertes.includes(k);
    return `<button class="piece${ferme ? ' condamnee' : ''}" data-piece="${k}" type="button" ${ferme ? 'disabled' : ''}>
      <span class="g">${ferme ? '🚫' : g}</span><small>${nom}</small><span class="marque"></span></button>`;
  }).join('');
}

/** Le moment où une porte s'ouvre : qui s'y cachait ? */
export function revelationHtml(rev, joueurs) {
  const [g, nom] = CC.PIECES[rev.piece];
  const pris = rev.trouves.map((i) => joueurs[i]).filter(Boolean);
  return `<div class="porte-ouverte"><span class="g">${g}</span><b>${nom}</b>
    <div class="dedans">${pris.length ? pris.map((j) => `<span class="pris">${j.avatar}</span>`).join('') : '<span class="vide">💨</span>'}</div></div>
    <p class="verdict-porte">${pris.length ? `😱 ${pris.map((j) => j.nom).join(' et ')} ${pris.length > 1 ? 'sont attrapés' : 'est attrapé'} !` : 'Personne ! La pièce est condamnée.'}</p>`;
}

export function demarrer(zone, { fin, ctx, joueurs, etat = null }) {
  let vivant = true;
  const scene = el('div', 'manoir', `
    <div class="manoir-info"></div>
    <div class="manoir-pieces"></div>
    <div class="ombres"></div>
    <div class="manoir-bas"><div class="stade-temps"><i></i></div><div class="manoir-pris"></div></div>`);
  zone.appendChild(scene);
  const info = scene.querySelector('.manoir-info');
  const grille = scene.querySelector('.manoir-pieces');
  const ombres = scene.querySelector('.ombres');
  const barre = scene.querySelector('.stade-temps i');
  const prisEl = scene.querySelector('.manoir-pris');

  const dessiner = (st) => {
    grille.innerHTML = manoirHtml(st);
    const pris = st.cacheurs.filter((i) => !st.libres.includes(i)).map((i) => joueurs[i]?.avatar || '🙈');
    prisEl.textContent = pris.length ? `Attrapés : ${pris.join(' ')}` : '';
  };

  /** Choisir une pièce ouverte (au bout du temps, une au hasard). */
  const choisir = (st) => new Promise((ok) => {
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
      barre.style.width = getComputedStyle(barre).width;
      barre.style.transition = 'none';
      scene.removeEventListener('pointerdown', touche);
      ok(k);
    };
    const touche = (e) => { const p = e.target.closest('.piece'); if (p && !p.disabled) { e.preventDefault(); finir(Number(p.dataset.piece)); } };
    scene.addEventListener('pointerdown', touche);
    const t = setTimeout(() => finir(CC.cachetteAuHasard(st, Math.random)), CHOIX_MS);
  });

  /** Le centre d'une pièce, en pixels dans la scène. */
  const centre = (k) => {
    const b = grille.querySelector(`[data-piece="${k}"]`).getBoundingClientRect();
    const r = scene.getBoundingClientRect();
    return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
  };

  /** Les ombres courent de pièce en pièce, puis le courant saute. */
  const montrerOmbres = async (st) => {
    const chemins = Object.values(st.chemins || {});
    const r = scene.getBoundingClientRect();
    ombres.innerHTML = chemins.map(() => '<span class="ombre">👤</span>').join('');
    const els = [...ombres.children];
    els.forEach((o, k) => { o.style.left = `${r.width * (0.3 + 0.4 * (k / Math.max(1, els.length - 1)))}px`; o.style.top = `${r.height - 30}px`; });
    info.innerHTML = '👀 Les joueurs se cachent… <b>regardez bien les ombres !</b>';
    await attendre(400);
    for (let pas = 0; pas < 3 && vivant; pas++) {
      els.forEach((o, k) => {
        const c = centre(chemins[k][pas]);
        // Deux ombres dans la même pièce ne se cachent pas l'une l'autre.
        o.style.left = `${c.x + (k - (els.length - 1) / 2) * 14}px`;
        o.style.top = `${c.y}px`;
      });
      son.pas();
      await attendre(PAS_OMBRE);
    }
    if (!vivant) return;
    scene.classList.add('noir');
    info.innerHTML = '💡 Coupure de courant !';
    son.mauvais();
    await attendre(900);
    ombres.innerHTML = '';
    scene.classList.remove('noir');
  };

  /** Une action : se cacher, ou (le fantôme) regarder les ombres puis ouvrir une porte. */
  const agir = async (st, role) => {
    dessiner(st);
    if (role === 'solo') {
      await montrerOmbres(st);
      if (!vivant) return null;
      info.innerHTML = `Manche ${st.manche}/${st.manches} — <b>Ouvrez une porte ! 🚪</b>`;
    } else {
      info.innerHTML = `Manche ${st.manche}/${st.manches} — <b>Cachez-vous ! 🙈</b>`;
    }
    son.tic();
    const k = await choisir(st);
    if (!vivant) return null;
    const p = grille.querySelector(`[data-piece="${k}"]`);
    p.classList.add('choisie');
    p.querySelector('.marque').textContent = role === 'solo' ? '👻' : '🙈';
    son.top();
    info.innerHTML = role === 'solo' ? `Vous ouvrez : ${CC.PIECES[k][1]}…` : `Caché dans : ${CC.PIECES[k][1]}… chut !`;
    await attendre(700);
    return k;
  };

  (async () => {
    await attendre(200);
    if (etat) {
      // En partie : une seule action, la partie fait le reste.
      const k = await agir(etat, ctx?.role);
      if (vivant && k !== null) fin(k);
      return;
    }
    // À l'entraînement : tout le cache-cache, contre l'ordinateur.
    const st = CC.nouveau(ctx.autres);
    const R = Math.random;
    while (vivant && st.etape !== 'fini') {
      // Une fois attrapé, on regarde le fantôme finir.
      if (ctx.role === 'autres' && st.libres.includes(0)) {
        const k = await agir(st, 'autres');
        if (!vivant) return;
        CC.cacher(st, 0, k);
      }
      for (const i of CC.reste(st)) CC.cacher(st, i, CC.cachetteAuHasard(st, R));
      CC.versRecherche(st, R);
      const porte = ctx.role === 'solo' ? await agir(st, 'solo') : CC.porteOrdi(st, 'normal', R);
      if (!vivant) return;
      CC.chercher(st, porte);
      grille.innerHTML = `<div class="revele-inline">${revelationHtml(st.revelations.at(-1), joueurs)}</div>`;
      info.innerHTML = '';
      son[st.revelations.at(-1).trouves.length ? 'boum' : 'tic']();
      await attendre(2200);
    }
    if (!vivant) return;
    const pris = CC.attrapes(st);
    const gagneFantome = pris >= CC.seuilFantome(st.cacheurs.length);
    if (ctx.role === 'solo') {
      fin(pris, { texte: `${pris} attrapé${pris > 1 ? 's' : ''} sur ${st.cacheurs.length}`, gagne: gagneFantome });
    } else {
      fin(CC.manchesTenues(st, 0), { texte: gagneFantome ? 'Le fantôme a attrapé tout le monde' : 'Le fantôme n’a pas attrapé tout le monde', gagne: !gagneFantome });
    }
  })();
  return () => { vivant = false; };
}
