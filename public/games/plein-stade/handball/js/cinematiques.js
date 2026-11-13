/**
 * ROUCOULETTE — les mini-cinématiques du handball, comme à la télé :
 *   l'avant-match : le survol de la salle, l'affiche, les deux équipes alignées,
 *     la présentation des gardiens et des vedettes, puis l'engagement ;
 *   la mi-temps : le score et les statistiques ;
 *   la fin : le meilleur joueur, son petit trophée dans les mains, la presse autour ;
 *   le Tournoi gagné : le capitaine soulève le trophée.
 * Le moteur des étapes et l'habillage sont communs (commun/cinematique.js).
 */

import { htmlAffiche, htmlCarte, htmlTitre, htmlPanneau } from '../../commun/cinematique.js';
import { ecussonSVG } from '../../commun/ecusson.js';
import { POSTES, NOM_POSTE, noteJoueur } from '../../../../shared/handball/equipes.js';

const N = 7;
const joueurVue = (x, y, dy = -1) => ({ x, y, z: 0, vx: 0, vy: 0, dx: 0, dy, etat: 'normal' });
const ballonVue = (x = 0, y = 0, z = 0.1) => ({ x, y, z, vx: 0, vy: 0, vz: 0, porteur: -1 });

/** Les deux équipes alignées face à la caméra, de part et d'autre du centre. */
function alignement() {
  const joueurs = [];
  for (let e = 0; e < 2; e++) for (let i = 0; i < N; i++) joueurs.push(joueurVue((e === 0 ? -1 : 1) * (1.4 + i * 1.25), -2.4));
  return { phase: 'intro', joueurs, ballon: ballonVue(0, 0.5), actifs: [-1, -1], humeurs: new Array(2 * N).fill('presente'), heros: -1 };
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
      maj: (t) => { const ang = -0.9 + t * 0.45; R.cadrer([Math.sin(ang) * 26, -Math.cos(ang) * 26, 12 - t], [0, 0, 1], t < 0.05); },
    },
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => api.afficher(htmlAffiche({ ecusson: ecussonSVG(a, 120), nom: a.court, couleur: P.kits[0].fond }, { ecusson: ecussonSVG(b, 120), nom: b.court, couleur: P.kits[1].fond }, P.lieu || '')),
      maj: (t) => R.cadrer([0, -13 + t, 2.8], [0, -2.4, 1.5], t < 0.05),
    },
  ];
  // Les gardiens, puis les vedettes.
  const montres = [];
  for (let e = 0; e < 2; e++) montres.push(e * N);
  for (let e = 0; e < 2; e++) { const i = P.eqs[e].joueurs.findIndex((j, k) => k > 0 && j.vedette); if (i > 0) montres.push(e * N + i); }
  for (const id of montres) {
    const p = vue.joueurs[id];
    etapes.push({
      duree: 1,
      vue: () => vue,
      debut: (api) => {
        api.afficher(carte(P, id));
        const pl = P.m.joueurs[id], j = P.eqs[pl.e].joueurs[pl.i];
        if (pl.i === 0) P.com?.dire(`Dans les buts de ${P.eqs[pl.e].court} : <b>${j.nom}</b>.`, { emotion: 0.4 });
        else P.com?.dire(`Attention à <b>${j.nom}</b>, la vedette de ${P.eqs[pl.e].court} !`, { emotion: 0.5 });
      },
      maj: (t) => R.cadrer([p.x + (t - 0.4) * 0.3, p.y - 4.4, 2.15], [p.x, p.y, 1.55], t < 0.03),
    });
  }
  etapes.push({
    duree: 1,
    vue: () => vue,
    debut: (api) => { api.afficher(htmlTitre('Engagement !')); P.com?.dire('L’arbitre siffle… c’est parti !', { important: true, emotion: 0.6 }); },
    maj: (t) => R.cadrer([0, -19, 9], [0, 0, 1], t < 0.03),
  });
  return etapes;
}

function statsMatch(P) {
  const st = P.m.stats;
  const pc = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');
  return [
    ['Réussite', pc(P.m.score[0], st.tirs[0]), pc(P.m.score[1], st.tirs[1])],
    ['Arrêts', st.arrets[0], st.arrets[1]],
    ['Contre-attaques', st.contreAttaques[0], st.contreAttaques[1]],
    ['Ballons récupérés', st.vols[0], st.vols[1]],
  ];
}

/** La valeur d'une ligne de statistiques (le meilleur joueur). */
export const valeurJoueur = (s) => s.buts * 2 + s.passes * 1.5 + s.arrets * 1.1 + s.vols * 1.5 + s.contres * 1.5;

/** Le meilleur joueur du match jusqu'ici. */
export function meilleurJoueur(m, dans = -1) {
  let best = -1, bv = -1;
  m.perso.forEach((s, i) => {
    if (dans >= 0 && m.joueurs[i].e !== dans) return;
    const v = valeurJoueur(s);
    if (v > bv) { bv = v; best = i; }
  });
  return best;
}

/** La mi-temps. */
export function miTemps(P) {
  const R = P.rendu, m = P.m;
  const best = meilleurJoueur(m);
  const nomBest = best >= 0 ? P.eqs[m.joueurs[best].e].joueurs[m.joueurs[best].i].nom : '';
  return [{
    duree: 6,
    debut: (api) => api.afficher(htmlPanneau('Mi-temps', `${P.eqs[0].abr} ${m.score[0]} - ${m.score[1]} ${P.eqs[1].abr}`, statsMatch(P), nomBest ? `Le meilleur jusqu’ici : ${nomBest}` : '')),
    maj: (t) => { const ang = 0.6 + t * 0.12; R.cadrer([Math.sin(ang) * 28, -Math.cos(ang) * 28, 13], [0, 0, 1], t < 0.03); },
  }];
}

/** Ce que le meilleur joueur a fait, en quelques mots. */
export function detailJoueur(s) {
  const pl = (n, mot) => (n ? `${n} ${mot}${n > 1 ? 's' : ''}` : '');
  return [pl(s.buts, 'but'), pl(s.arrets, 'arrêt'), pl(s.passes, 'passe décisive'), pl(s.vols, 'ballon récupéré'), pl(s.contres, 'contre')].filter(Boolean).slice(0, 3).join(' · ');
}

/** Le Tournoi gagné : le capitaine (la vedette) soulève le trophée, ses coéquipiers autour, la fête. */
export function trophee(P, e) {
  const R = P.rendu, eq = P.eqs[e], kit = P.kits[e];
  const capitaine = Math.max(1, eq.joueurs.findIndex((j) => j.vedette));
  const joueurs = [];
  const humeurs = new Array(2 * N).fill('decu');
  const places = [[-1.3, 0.9], [1.3, 0.9], [-2.4, 0.2], [2.4, 0.2], [-0.7, 1.9], [0.7, 1.9]];
  let k = 0;
  for (let ee = 0; ee < 2; ee++) {
    for (let i = 0; i < N; i++) {
      const id = ee * N + i;
      if (ee !== e) { joueurs.push(joueurVue(-14 + i * 1.4, 7, 1)); continue; }
      if (i === capitaine) { joueurs.push(joueurVue(0, 0)); humeurs[id] = 'trophee'; continue; }
      const [x, y] = places[k++];
      joueurs.push(joueurVue(x, y));
      humeurs[id] = 'joie';
    }
  }
  const vue = { phase: 'fin', joueurs, ballon: ballonVue(40, 40), actifs: [-1, -1], humeurs, heros: -1 };
  const couleurs = [kit.fond, kit.motifC, kit.short, '#ffb347', '#ffffff'];
  let prochainFeu = 0;
  return [
    {
      duree: 1.6,
      vue: () => vue,
      debut: (api) => { R.presse(null); R.tropheeMain(null); R.trophee({ x: 0, y: -0.25, h: 1.25, echelle: 1.3 }); api.afficher(''); P.com?.dire(`Le capitaine de ${eq.court} s’avance vers le trophée…`, { important: true, emotion: 0.6 }); },
      maj: (t) => R.cadrer([2.5 - t, -5.5, 1.8], [0, 0, 1.6], t < 0.03),
    },
    {
      duree: 7.5,
      vue: () => vue,
      debut: (api) => {
        api.afficher(htmlTitre('Champions !', eq.nom));
        R.confettis(0, e);
        P.com?.dire(`${eq.nom} remporte le Tournoi ! Quelle finale !`, { important: true, emotion: 1, apres: 'Ils l’ont mérité, ce trophée.' });
        prochainFeu = 0;
      },
      maj: (t, dt) => {
        const leve = Math.min(1, t / 0.8);
        R.trophee({ x: 0, y: 0.05, h: 1.3 + leve * 1.3 + Math.abs(Math.sin(t * 3)) * 0.06 * leve, echelle: 1.3 });
        prochainFeu -= dt;
        if (prochainFeu <= 0) { R.feuArtifice(couleurs); prochainFeu = 0.45 + Math.random() * 0.4; }
        const ang = -0.7 + t * 0.22;
        R.cadrer([Math.sin(ang) * 7, -Math.cos(ang) * 7, 2.4 + t * 0.12], [0, 0, 2], t < 0.03);
      },
    },
  ];
}

/** La fin : le meilleur joueur de l'équipe gagnante, son trophée, la presse. */
export function hommeDuMatch(P) {
  const m = P.m;
  const id = meilleurJoueur(m, m.vainqueur);
  if (id < 0) return [];
  const R = P.rendu, pl = m.joueurs[id], eq = P.eqs[pl.e];
  const detail = detailJoueur(m.perso[id]);
  const joueurs = m.joueurs.map((q) => (q.id === id ? joueurVue(0, 0, -1) : joueurVue(-30 + q.id * 1.2, 30, 1)));
  const humeurs = new Array(2 * N).fill('presente');
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
