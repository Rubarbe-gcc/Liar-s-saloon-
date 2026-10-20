/**
 * DOUBLE PAS — les mini-cinématiques du basket, comme à la télé :
 *   l'avant-match : le survol de la salle, l'affiche, la présentation des six
 *     joueurs (gros plan et carte), puis l'entre-deux ;
 *   la pause entre les périodes : le score et les statistiques ;
 *   la fin : le meilleur joueur, son petit trophée dans les mains, la presse autour.
 * Le moteur des étapes et l'habillage sont communs (commun/cinematique.js).
 */

import { htmlAffiche, htmlCarte, htmlTitre, htmlPanneau } from '../../commun/cinematique.js';
import { ecussonSVG } from '../../commun/ecusson.js';
import { POSTES, NOM_POSTE, noteJoueur } from '../../../../shared/basket/equipes.js';

const joueurVue = (x, y, dy = -1) => ({ x, y, z: 0, vx: 0, vy: 0, dx: 0, dy, etat: 'normal' });
const ballonVue = (x = 0, y = 0, z = 0.12) => ({ x, y, z, vx: 0, vy: 0, vz: 0, porteur: -1 });

/** Les deux équipes alignées face à la caméra, de part et d'autre du rond central. */
function alignement() {
  const joueurs = [];
  for (let e = 0; e < 2; e++) for (let i = 0; i < 3; i++) joueurs.push(joueurVue((e === 0 ? -1 : 1) * (1.5 + (2 - i) * 1.5), -2.2));
  return { phase: 'intro', joueurs, ballon: ballonVue(0, 0.4), actifs: [-1, -1], humeurs: new Array(6).fill('presente'), heros: -1 };
}

function carte(P, id, extra = {}) {
  const p = P.m.joueurs[id], eq = P.eqs[p.e], j = eq.joueurs[p.i];
  return htmlCarte({
    numero: j.numero, nom: j.nom, poste: NOM_POSTE[POSTES[p.i]], note: noteJoueur(eq, p.i), vedette: !!j.vedette,
    couleur: P.kits[p.e].fond, ecusson: ecussonSVG(eq, 42), cote: p.e === 0 ? 'g' : 'd', ...extra,
  });
}

/** L'avant-match. */
export function intro(P) {
  const R = P.rendu;
  const vue = alignement();
  const [a, b] = P.eqs;
  const etapes = [
    {
      duree: 3,
      vue: () => vue,
      maj: (t) => { const ang = -0.9 + t * 0.45; R.cadrer([Math.sin(ang) * 20, -Math.cos(ang) * 20, 10 - t], [0, 0, 1], t < 0.05); },
    },
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => api.afficher(htmlAffiche({ ecusson: ecussonSVG(a, 120), nom: a.court, couleur: P.kits[0].fond }, { ecusson: ecussonSVG(b, 120), nom: b.court, couleur: P.kits[1].fond }, P.lieu || '')),
      maj: (t) => R.cadrer([0, -10 + t, 2.6], [0, -2.2, 1.5], t < 0.05),
    },
  ];
  for (let id = 0; id < 6; id++) {
    const p = vue.joueurs[id];
    etapes.push({
      duree: 0.85,
      vue: () => vue,
      debut: (api) => {
        api.afficher(carte(P, id));
        const pl = P.m.joueurs[id], j = P.eqs[pl.e].joueurs[pl.i];
        if (j.vedette) P.com?.dire(`Attention à <b>${j.nom}</b>, la vedette de ${P.eqs[pl.e].court} !`, { emotion: 0.5 });
      },
      maj: (t) => R.cadrer([p.x + (t - 0.4) * 0.3, p.y - 4.4, 2.15], [p.x, p.y, 1.55], t < 0.03),
    });
  }
  etapes.push({
    duree: 1,
    vue: () => vue,
    debut: (api) => { api.afficher(htmlTitre('Entre-deux !')); P.com?.dire('L’arbitre lance le ballon… c’est parti !', { important: true, emotion: 0.6 }); },
    maj: (t) => R.cadrer([0, -15, 8], [0, 0, 1], t < 0.03),
  });
  return etapes;
}

function statsMatch(P) {
  const st = P.m.stats;
  const pc = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');
  return [
    ['Adresse', pc(st.reussis[0], st.tirs[0]), pc(st.reussis[1], st.tirs[1])],
    ['À 3 points', `${st.troisReussis[0]}/${st.trois[0]}`, `${st.troisReussis[1]}/${st.trois[1]}`],
    ['Rebonds', st.rebonds[0], st.rebonds[1]],
    ['Ballons volés', st.vols[0], st.vols[1]],
  ];
}

/** Le meilleur joueur du match jusqu'ici (points, rebonds, passes, vols, contres). */
export function meilleurJoueur(m, dans = -1) {
  let best = -1, bv = -1;
  m.perso.forEach((s, i) => {
    if (dans >= 0 && m.joueurs[i].e !== dans) return;
    const v = s.pts + s.rebonds * 1.2 + s.passes * 1.5 + s.vols * 2 + s.contres * 2;
    if (v > bv) { bv = v; best = i; }
  });
  return best;
}

/** La pause entre les deux périodes. */
export function miTemps(P) {
  const R = P.rendu, m = P.m;
  const best = meilleurJoueur(m);
  const nomBest = best >= 0 ? P.eqs[m.joueurs[best].e].joueurs[m.joueurs[best].i].nom : '';
  return [{
    duree: 6,
    debut: (api) => api.afficher(htmlPanneau('Fin de la 1re période', `${P.eqs[0].abr} ${m.score[0]} - ${m.score[1]} ${P.eqs[1].abr}`, statsMatch(P), nomBest ? `Le meilleur jusqu’ici : ${nomBest}` : '')),
    maj: (t) => { const ang = 0.6 + t * 0.12; R.cadrer([Math.sin(ang) * 22, -Math.cos(ang) * 22, 11], [0, 0, 1], t < 0.03); },
  }];
}

/** Ce que le meilleur joueur a fait, en quelques mots. */
export function detailJoueur(s) {
  const pl = (n, mot) => (n ? `${n} ${mot}${n > 1 ? 's' : ''}` : '');
  return [pl(s.pts, 'point'), pl(s.rebonds, 'rebond'), pl(s.passes, 'passe décisive'), pl(s.vols, 'ballon volé'), pl(s.contres, 'contre')].filter(Boolean).slice(0, 3).join(' · ');
}

/** La fin : le meilleur joueur de l'équipe gagnante, son trophée, la presse. */
export function hommeDuMatch(P) {
  const m = P.m;
  const id = meilleurJoueur(m, m.vainqueur);
  if (id < 0) return [];
  const R = P.rendu, pl = m.joueurs[id], eq = P.eqs[pl.e];
  const detail = detailJoueur(m.perso[id]);
  const joueurs = m.joueurs.map((q) => (q.id === id ? joueurVue(0, 0, -1) : joueurVue(-30 + q.id * 1.2, 30, 1)));
  const humeurs = new Array(6).fill('presente');
  humeurs[id] = 'exhibe';
  const vue = { phase: 'fin', joueurs, ballon: ballonVue(40, 40), actifs: [-1, -1], humeurs, heros: -1 };
  return [
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => {
        R.presse({ x: 0, y: 0, rayon: 2.3, regard: -Math.PI / 2, reporters: 6 });
        R.tropheeMain(id);
        api.afficher(htmlTitre('Joueur du match', eq.court));
        P.com?.dire(`Les flashs crépitent : voici le joueur du match, <b>${eq.joueurs[pl.i].nom}</b> !`, { important: true, emotion: 0.6, apres: 'Aucune discussion possible : c’est mérité.' });
      },
      maj: (t) => R.cadrer([0.5 - t * 0.25, -6.2 + t * 0.5, 2.05], [0, 0, 1.3], t < 0.03),
    },
    {
      duree: 3.6,
      vue: () => vue,
      debut: (api) => api.afficher(carte(P, id, { titre: 'Joueur du match', detail })),
      maj: (t) => R.cadrer([1 - t * 0.2, -4 + t * 0.25, 1.75], [0.1, 0, 1.4], t < 0.03),
    },
  ];
}
