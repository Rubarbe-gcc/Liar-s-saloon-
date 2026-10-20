/**
 * CROCHET — les mini-cinématiques de la boxe :
 *   l'avant-combat : le survol de la salle, l'affiche, chaque boxeur présenté
 *     dans son coin (gros plan et carte), puis la cloche ;
 *   la fin : le vainqueur, le bras levé au centre du ring, son adversaire
 *     dans son coin ; pour le Tournoi, la ceinture au-dessus de sa tête.
 * Le moteur des étapes et l'habillage sont communs (commun/cinematique.js).
 */

import { htmlAffiche, htmlCarte, htmlTitre } from '../../commun/cinematique.js';
import { CATEGORIES, STYLES, noteGenerale } from '../../../../shared/boxe/boxeurs.js';

/** Le badge d'un boxeur : ses initiales sur un rond aux couleurs de ses gants. */
export function badgeSVG(b, taille = 48) {
  const init = b.nom.split(' ').map((m) => m[0]).join('').slice(0, 2).toUpperCase();
  return `<svg viewBox="0 0 100 100" width="${taille}" height="${taille}" role="img" aria-label="${b.nom}"><circle cx="50" cy="50" r="46" fill="${b.couleurs.gants}" stroke="${b.couleurs.liseré}" stroke-width="7"/><circle cx="50" cy="50" r="34" fill="${b.couleurs.short}" opacity=".85"/><text x="50" y="62" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="34" fill="#ffffff" stroke="#000" stroke-width="2" paint-order="stroke">${init}</text></svg>`;
}

const vueBoxeur = (x, y, dx, dy = 0) => ({ x, y, vx: 0, vy: 0, dx, dy, coup: null, garde: null, esquive: 0, sonne: 0, etourdi: false, sol: false });

function carte(P, e, extra = {}) {
  const b = P.boxeurs[e];
  return htmlCarte({
    numero: '', nom: b.nom, poste: `« ${b.surnom} » · ${CATEGORIES[b.categorie]}`, note: noteGenerale(b), vedette: false,
    couleur: b.couleurs.gants, ecusson: badgeSVG(b, 42), cote: e === 0 ? 'g' : 'd', detail: `${STYLES[b.style].nom} · ${b.ville}`, ...extra,
  });
}

/** L'avant-combat. */
export function intro(P) {
  const R = P.rendu;
  const vue = { phase: 'intro', boxeurs: [vueBoxeur(-2.4, 2.2, 1, -1), vueBoxeur(2.4, -2.2, -1, 1)], humeurs: [null, null] };
  const [a, b] = P.boxeurs;
  return [
    { duree: 2.8, vue: () => vue, maj: (t) => { const ang = -0.9 + t * 0.4; R.cadrer([Math.sin(ang) * 11, -Math.cos(ang) * 11, 6 - t * 0.5], [0, 0, 1.2], t < 0.05); } },
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => api.afficher(htmlAffiche({ ecusson: badgeSVG(a, 120), nom: a.nom.split(' ').slice(-1)[0], couleur: a.couleurs.gants }, { ecusson: badgeSVG(b, 120), nom: b.nom.split(' ').slice(-1)[0], couleur: b.couleurs.gants }, 'Trois rounds')),
      maj: (t) => R.cadrer([0, -7 + t * 0.6, 2.6], [0, 0, 1.4], t < 0.05),
    },
    ...[0, 1].map((e) => ({
      duree: 2,
      vue: () => vue,
      debut: (api) => { api.afficher(carte(P, e, { titre: e === 0 ? 'Dans le coin rouge' : 'Dans le coin bleu' })); P.com?.dire(`Dans le coin ${e === 0 ? 'rouge' : 'bleu'} : <b>${P.boxeurs[e].nom}</b>, « ${P.boxeurs[e].surnom} » !`, { emotion: 0.6 }); },
      maj: (t) => { const p = vue.boxeurs[e]; R.cadrer([p.x * 0.55 + (t - 1) * 0.2, p.y - 2.6, 1.9], [p.x, p.y, 1.65], t < 0.03); },
    })),
    { duree: 0.9, vue: () => vue, debut: (api) => api.afficher(htmlTitre('Ding !')), maj: (t) => R.cadrer([0, -6.5, 3.2], [0, 0, 1.3], t < 0.03) },
  ];
}

/** La fin : le vainqueur, le bras levé ; avec ceinture, il la brandit. */
export function victoire(P, v, { ceinture = false } = {}) {
  const R = P.rendu, b = P.boxeurs[v];
  const boxeurs = [0, 1].map((e) => (e === v ? vueBoxeur(0, 0, 0, -1) : vueBoxeur(e === 0 ? -2.4 : 2.4, e === 0 ? 2.2 : -2.2, e === 0 ? 1 : -1)));
  const humeurs = [0, 1].map((e) => (e === v ? (ceinture ? 'trophee' : 'joie') : 'decu'));
  const vue = { phase: 'fin', boxeurs, humeurs };
  const issue = { ko: 'par K.-O.', arret: 'par arrêt de l’arbitre', points: 'aux points' }[P.m.issue];
  const couleurs = [b.couleurs.gants, b.couleurs.short, b.couleurs.liseré, '#ffd23f', '#ffffff'];
  let prochain = 0;
  return [{
    duree: ceinture ? 7 : 4.5,
    vue: () => vue,
    debut: (api) => {
      api.afficher(htmlTitre(ceinture ? 'Champion !' : 'Vainqueur', `${b.nom} ${issue}`));
      prochain = 0;
    },
    maj: (t, dt) => {
      const ang = -0.6 + t * 0.2;
      R.cadrer([Math.sin(ang) * 4.2, -Math.cos(ang) * 4.2, 1.9], [0, 0, 1.6], t < 0.03);
      if (ceinture) {
        R.trophee({ x: 0, y: 0.05, h: 2.45 + Math.abs(Math.sin(t * 3)) * 0.05, echelle: 1 });
        prochain -= dt;
        if (prochain <= 0) { R.feuArtifice(couleurs); prochain = 0.5 + Math.random() * 0.4; }
      }
    },
  }];
}
