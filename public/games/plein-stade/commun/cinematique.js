/**
 * PLEIN STADE — les mini-cinématiques, communes à tous les sports : une suite
 * d'étapes (chacune sa durée, ce qu'elle montre et comment elle bouge la
 * caméra), et ce qui s'affiche par-dessus la 3D (l'affiche du match, la carte
 * d'un joueur, un panneau de statistiques, un grand titre).
 *
 * On peut toujours passer une cinématique (une touche, un clic, un appui),
 * sauf en ligne, où elle dure le même temps chez les deux joueurs.
 */

/**
 * @param {HTMLElement} hote  où poser l'habillage (par-dessus la 3D)
 */
export function creerCinematique(hote) {
  const el = document.createElement('div');
  el.className = 'cinema cache';
  el.innerHTML = '<div class="cine-bandes"><i></i><i></i></div><div class="cine-contenu"></div><div class="cine-passer"></div>';
  hote.appendChild(el);
  const contenu = el.querySelector('.cine-contenu');
  const passerEl = el.querySelector('.cine-passer');
  let etapes = [], k = 0, t = 0, fin = null, passable = true, demandePasser = false;

  const passer = () => { if (passable && etapes.length) demandePasser = true; };
  const ecoute = (e) => {
    if (!etapes.length) return;
    if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta', 'F3'].includes(e.key)) return;
    passer();
  };
  addEventListener('keydown', ecoute);
  el.addEventListener('pointerdown', ecoute);

  function entrer(i) {
    k = i; t = 0;
    contenu.innerHTML = '';
    etapes[k]?.debut?.(api);
  }

  const api = {
    get actif() { return etapes.length > 0; },
    /** La vue du match à montrer pendant l'étape (ou null : la vraie). */
    vue() { return etapes[k]?.vue?.(t) ?? null; },
    /**
     * Lance une suite d'étapes : [{ duree, debut(api), maj(t, dt, api), vue(t) }].
     * o : { passable, fin() }
     */
    lancer(liste, o = {}) {
      etapes = liste; passable = o.passable !== false; fin = o.fin || null; demandePasser = false;
      el.classList.remove('cache');
      passerEl.textContent = passable ? 'Appuie pour passer ›' : '';
      entrer(0);
    },
    /** Une image : rend vrai tant que la cinématique dure. */
    maj(dt) {
      if (!etapes.length) return false;
      if (demandePasser) { api.arreter(true); return false; }
      t += dt;
      etapes[k].maj?.(t, dt, api);
      if (t >= etapes[k].duree) {
        if (k + 1 < etapes.length) entrer(k + 1);
        else { api.arreter(true); return false; }
      }
      return true;
    },
    passer,
    arreter(appelerFin = false) {
      if (!etapes.length) return;
      etapes = [];
      contenu.innerHTML = '';
      el.classList.add('cache');
      const f = fin; fin = null;
      if (appelerFin) f?.();
    },
    /** Ce qui s'affiche. */
    afficher(html) { contenu.innerHTML = html; },
    ajouter(html) { contenu.insertAdjacentHTML('beforeend', html); },
  };
  return api;
}

/** L'affiche du match : les deux écussons face à face. */
export const htmlAffiche = (a, b, sousTitre = '') => `<div class="cine-affiche">
  <div class="cote g" style="--c:${a.couleur}">${a.ecusson}<b>${a.nom}</b></div>
  <div class="vs">VS<small>${sousTitre}</small></div>
  <div class="cote d" style="--c:${b.couleur}">${b.ecusson}<b>${b.nom}</b></div></div>`;

/** La carte d'un joueur (présentation, homme du match). */
export const htmlCarte = ({ numero, nom, poste, note, vedette, couleur, ecusson, cote = 'g', titre = '', detail = '' }) => `<div class="cine-carte ${cote}${vedette ? ' vedette' : ''}" style="--c:${couleur}">
  ${titre ? `<p class="titre">${titre}</p>` : ''}
  <div class="haut"><span class="note">${note}</span><span class="ec">${ecusson}</span></div>
  <b class="num">${numero}</b><b class="nom">${nom}</b><span class="poste">${poste}</span>
  ${vedette ? '<span class="etoile">★ La vedette</span>' : ''}${detail ? `<span class="detail">${detail}</span>` : ''}</div>`;

/** Un grand titre au milieu (« Coup d'envoi ! », « Champion ! »). */
export const htmlTitre = (txt, sous = '') => `<div class="cine-titre">${txt}${sous ? `<small>${sous}</small>` : ''}</div>`;

/** Un panneau de statistiques : [[libellé, gauche, droite], …]. */
export const htmlPanneau = (titre, score, lignes, bas = '') => `<div class="cine-panneau"><p class="titre">${titre}</p><div class="score">${score}</div>
  ${lignes.map(([l, a, b]) => `<div class="ligne"><span>${a}</span><i>${l}</i><span>${b}</span></div>`).join('')}${bas ? `<p class="bas">${bas}</p>` : ''}</div>`;
