/**
 * RAID — le lecteur de cinématiques.
 *
 * Une cinématique est une suite de scènes plein écran : une image, un titre,
 * et un texte qui s'écrit lettre à lettre. Un toucher finit la phrase, le
 * suivant passe à la scène d'après ; « Passer » saute tout.
 */

const txt = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const VITESSE = 22;   // millisecondes par lettre

/**
 * Joue une suite de scènes. La promesse se résout quand la dernière scène est
 * passée (ou que le joueur a tout sauté).
 * @param {{art:string, couleur?:string, titre?:string, texte:string}[]} scenes
 * @param {{sfx?:object}} [o]
 */
export function jouerCinematique(scenes, { sfx = null } = {}) {
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

    let i = -1, lettres = 0, minuterie = null, complet = '';

    const terminer = () => {
      clearInterval(minuterie);
      voile.classList.add('part');
      setTimeout(() => { voile.remove(); fini(); }, 260);
    };

    const finirPhrase = () => {
      clearInterval(minuterie);
      minuterie = null;
      texte.textContent = complet;
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
      minuterie = setInterval(() => {
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
