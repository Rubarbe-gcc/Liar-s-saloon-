/**
 * REVERS — les mini-cinématiques du tennis :
 *   l'avant-match : le survol du stade, l'affiche, chaque joueur présenté (gros plan et carte), puis le
 *     premier service ;
 *   la fin : le vainqueur au centre du court, les bras levés, son adversaire déçu au filet ; pour la finale
 *     du Tournoi, le trophée brandi et les feux d'artifice.
 * Le moteur des étapes et l'habillage sont communs (commun/cinematique.js).
 */

import { htmlAffiche, htmlCarte, htmlTitre } from '../../commun/cinematique.js';
import { STYLES, noteGenerale } from '../../../../shared/tennis/joueurs.js';
import { LONG } from '../../../../shared/tennis/terrain.js';
import * as son from '../../commun/son.js';

/** Le badge d'un joueur : ses initiales sur un rond aux couleurs de son maillot, une balle en coin. */
export function badgeSVG(j, taille = 48) {
  const init = j.nom.split(' ').map((m) => m[0]).join('').slice(0, 2).toUpperCase();
  return `<svg viewBox="0 0 100 100" width="${taille}" height="${taille}" role="img" aria-label="${j.nom}"><circle cx="50" cy="50" r="46" fill="${j.couleurs.maillot}" stroke="${j.couleurs.bandeau === j.couleurs.maillot ? j.couleurs.raquette : j.couleurs.bandeau}" stroke-width="7"/><circle cx="50" cy="50" r="34" fill="${j.couleurs.short}" opacity=".85"/><text x="50" y="62" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="34" fill="#ffffff" stroke="#000" stroke-width="2" paint-order="stroke">${init}</text><circle cx="80" cy="80" r="12" fill="#dff34a" stroke="#1b1b1f" stroke-width="2"/></svg>`;
}

const vueJoueur = (e, x, y, regarde) => ({ e, x, y, vx: 0, vy: 0, prepa: null, anim: null, lance: false, regarde });

function carte(P, e, extra = {}) {
  const j = P.joueurs[e];
  return htmlCarte({
    numero: '', nom: j.nom, poste: `« ${j.surnom} »`, note: noteGenerale(j), vedette: false,
    couleur: j.couleurs.maillot, ecusson: badgeSVG(j, 42), cote: e === 0 ? 'g' : 'd', detail: `${STYLES[j.style].nom} · ${j.ville}`, ...extra,
  });
}

/** L'avant-match. */
export function intro(P) {
  const R = P.rendu;
  // Les deux joueurs à leur ligne de fond, qui regardent le filet.
  const vue = { phase: 'intro', joueurs: [vueJoueur(0, 0.8, -LONG - 0.4), vueJoueur(1, -0.8, LONG + 0.4)], balle: null, humeurs: [null, null] };
  const [a, b] = P.joueurs;
  return [
    { duree: 3, vue: () => vue, maj: (t) => { const ang = -1.1 + t * 0.35; R.cadrer([Math.sin(ang) * 34, -Math.cos(ang) * 34, 18 - t * 2], [0, 0, 0], t < 0.05); } },
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => api.afficher(htmlAffiche({ ecusson: badgeSVG(a, 120), nom: a.nom.split(' ').slice(-1)[0], couleur: a.couleurs.maillot }, { ecusson: badgeSVG(b, 120), nom: b.nom.split(' ').slice(-1)[0], couleur: b.couleurs.maillot }, P.m.F.nom)),
      maj: (t) => R.cadrer([7 - t, 0, 3.2], [0, 0, 0.8], t < 0.05),
    },
    ...[0, 1].map((e) => ({
      duree: 2,
      vue: () => vue,
      debut: (api) => { api.afficher(carte(P, e, { titre: e === 0 ? 'Au service de ce côté' : 'Et en face' })); P.com?.dire(`${e === 0 ? 'D’un côté' : 'De l’autre'} : <b>${P.joueurs[e].nom}</b>, « ${P.joueurs[e].surnom} » !`, { emotion: 0.6 }); },
      maj: (t) => { const p = vue.joueurs[e], s = e === 0 ? 1 : -1; R.cadrer([p.x + 1.2 - t * 0.2, p.y + s * 3, 1.8], [p.x, p.y, 1.5], t < 0.03); },
    })),
    { duree: 0.9, vue: () => vue, debut: (api) => api.afficher(htmlTitre('Jeu !')), maj: (t) => R.cadrer([0, -LONG - 9, 6], [0, 0, 0.5], t < 0.03) },
  ];
}

/** Le score final, en toutes lettres (« 6-4, 7-6 »), vu du vainqueur. */
export const scoreFinal = (m, v) => m.score.sets.map((s) => `${s[v]}-${s[1 - v]}`).join(', ');

/** La fin : le vainqueur au centre, les bras levés ; en finale du Tournoi, le trophée et les feux d'artifice. */
export function victoire(P, v, { trophee = false } = {}) {
  const R = P.rendu, j = P.joueurs[v];
  const sv = v === 0 ? 1 : -1;
  const joueurs = [0, 1].map((e) => (e === v ? vueJoueur(e, 0, -sv * 4, sv > 0 ? 0 : Math.PI) : vueJoueur(e, 1.2, (e === 0 ? -1 : 1) * 1.2, e === 0 ? 0.6 : Math.PI - 0.6)));
  const humeurs = [0, 1].map((e) => (e === v ? (trophee ? 'trophee' : 'joie') : 'decu'));
  const vue = { phase: 'fin', joueurs, balle: null, humeurs };
  const couleurs = [j.couleurs.maillot, j.couleurs.short, j.couleurs.bandeau, '#ffd23f', '#ffffff'];
  let prochain = 0;
  return [{
    duree: trophee ? 7 : 4.8,
    vue: () => vue,
    debut: (api) => {
      api.afficher(htmlTitre(trophee ? 'Champion !' : 'Jeu, set et match', `${j.nom} · ${scoreFinal(P.m, v)}`));
      son.acclamation(1);
      R.flash();
      prochain = 0;
    },
    maj: (t, dt) => {
      const p = joueurs[v], ang = -0.5 + t * 0.18;
      R.cadrer([p.x + Math.sin(ang) * 4.5, p.y - sv * Math.cos(ang) * 4.5, 2], [p.x, p.y, 1.4], t < 0.03);
      if (trophee) {
        R.trophee({ x: p.x, y: p.y - sv * 0.35, h: 2.2 + Math.abs(Math.sin(t * 3)) * 0.05 });
        prochain -= dt;
        if (prochain <= 0) { R.feuArtifice(couleurs); R.flash(); prochain = 0.5 + Math.random() * 0.4; }
      }
    },
  }];
}
