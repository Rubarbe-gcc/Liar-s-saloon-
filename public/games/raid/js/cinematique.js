/**
 * RAID — le lecteur de cinématiques.
 *
 * Une cinématique est une suite de scènes plein écran : une image, un titre,
 * et un texte qui s'écrit lettre à lettre. Un toucher finit la phrase, le
 * suivant passe à la scène d'après ; « Passer » saute tout.
 */

const txt = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

import { creerScene } from './trois/scene3d.js';

const VITESSE = 22;   // millisecondes par lettre
const PAR_MOT = 120;  // millisecondes par mot, quand le Conteur parle

/**
 * Derrière le texte, le Conteur en gros plan, à sa table, entre deux bougies ;
 * `masque` : celui du boss qu'il va jouer (il le met en parlant). Null sans 3D.
 */
function conteurEnGrand(hote, masque) {
  const S = creerScene(hote, {
    table: { largeur: 30, profondeur: 14, y: 4.2, z: 0 },
    bougies: [[-2.6, -1.2, 0.9, 4.2], [2.8, -0.6, 0.6, 4.2]],
    conteur: { z: -6.2, y: -0.6, echelle: 1, mains: { ecart: 1.9, y: 4.2, z: -3.4 } },
    forceBougies: 9,
    expo: 1.5,
  });
  if (!S) return null;
  S.camera.position.set(0, 7.3, 7.2);
  S.camera.lookAt(0, 5.9, -5);
  S.conteur.masque(masque || null);
  // Le masque monte de la table jusqu'au visage.
  const m = masque ? S.conteur.groupe.children[S.conteur.groupe.children.length - 1] : null;
  const haut = m ? m.position.clone() : null;
  if (m) m.position.set(0, 4.6, 2.6);
  let parle = 0;
  S.animer((dt, t) => {
    if (m && t > 0.6) m.position.lerp(haut, Math.min(1, dt * 2.5));
    parle = Math.max(0, parle - dt * 4);
    S.conteur.lueur(2.5 + parle * 6);
  });
  S.dimensionner();
  S.relancer();
  return { parler() { parle = 1; }, detruire: S.detruire };
}

/**
 * Joue une suite de scènes. La promesse se résout quand la dernière scène est
 * passée (ou que le joueur a tout sauté).
 * @param {{art:string, couleur?:string, titre?:string, texte:string}[]} scenes
 * @param {{sfx?:object}} [o]
 */
export function jouerCinematique(scenes, { sfx = null, masque = null } = {}) {
  return new Promise((fini) => {
    if (!scenes || !scenes.length) { fini(); return; }
    const voile = document.createElement('div');
    voile.className = 'cine';
    voile.innerHTML = `<button class="cine-passer">Passer ›</button>
      <div class="cine-scene">
        <div class="cine-art"></div>
        <h2 class="cine-titre"></h2>
        <p class="cine-texte"></p>
      </div>
      <div class="cine-suite">Toucher pour continuer</div>`;
    document.body.appendChild(voile);
    const art = voile.querySelector('.cine-art');
    const titre = voile.querySelector('.cine-titre');
    const texte = voile.querySelector('.cine-texte');
    const suite = voile.querySelector('.cine-suite');
    // En 3D : le Conteur, derrière ; il dit le texte mot à mot.
    const fond = document.createElement('div');
    fond.className = 'cine-fond3d';
    voile.prepend(fond);
    const conteur = conteurEnGrand(fond, masque);
    if (conteur) voile.classList.add('en3d'); else fond.remove();

    let i = -1, lettres = 0, minuterie = null, complet = '';

    const terminer = () => {
      clearInterval(minuterie);
      setTimeout(() => conteur?.detruire(), 300);
      voile.classList.add('part');
      setTimeout(() => { voile.remove(); fini(); }, 260);
    };

    const mots = (n) => complet.split(' ').slice(0, n).map((w, k) => `<span class="mot" style="--r:${((k * 37) % 7) - 3}">${txt(w)}</span>`).join(' ');
    const finirPhrase = () => {
      clearInterval(minuterie);
      minuterie = null;
      if (conteur) texte.innerHTML = mots(Infinity); else texte.textContent = complet;
      suite.classList.add('visible');
    };

    const scene = () => {
      i++;
      if (i >= scenes.length) return terminer();
      const s = scenes[i];
      voile.style.setProperty('--aff', s.couleur || '#e8c060');
      art.innerHTML = s.art || '';
      titre.innerHTML = s.titre ? txt(s.titre) : '';
      titre.hidden = !s.titre;
      voile.querySelector('.cine-scene').classList.remove('entre');
      void voile.offsetWidth;
      voile.querySelector('.cine-scene').classList.add('entre');
      complet = s.texte;
      lettres = 0;
      texte.textContent = '';
      suite.classList.remove('visible');
      suite.textContent = i === scenes.length - 1 ? 'Toucher pour commencer' : 'Toucher pour continuer';
      if (sfx) sfx.tap();
      if (conteur) {
        // Le Conteur parle : un mot à la fois, qui tremble en arrivant, et sa voix grave.
        const total = complet.split(' ').length;
        texte.innerHTML = '';
        minuterie = setInterval(() => {
          lettres += 1;
          texte.innerHTML = mots(lettres);
          conteur.parler();
          if (sfx?.voix) sfx.voix();
          if (lettres >= total) finirPhrase();
        }, PAR_MOT);
      } else minuterie = setInterval(() => {
        lettres += 1;
        texte.textContent = complet.slice(0, lettres);
        if (lettres >= complet.length) finirPhrase();
      }, VITESSE);
    };

    voile.addEventListener('click', (ev) => {
      if (ev.target.closest('.cine-passer')) return terminer();
      if (minuterie) finirPhrase(); else scene();
    });
    scene();
  });
}
