/**
 * RAFFUT — les mini-cinématiques du rugby, comme à la télé :
 *   l'avant-match : le survol du stade, l'affiche, les deux équipes alignées,
 *     la présentation des deux vedettes (gros plan et carte), puis le coup d'envoi ;
 *   la mi-temps : le score et les statistiques ;
 *   la fin : le joueur du match, son petit trophée dans les mains, la presse autour ;
 *   le Tournoi gagné : le capitaine soulève le trophée.
 * Le moteur des étapes et l'habillage sont communs (commun/cinematique.js).
 */

import { htmlAffiche, htmlCarte, htmlTitre, htmlPanneau } from '../../commun/cinematique.js';
import { ecussonSVG } from '../../commun/ecusson.js';
import { POSTES, NOM_POSTE, noteJoueur } from '../../../../shared/rugby/equipes.js';

const N = 7;
const joueurVue = (x, y, dy = -1) => ({ x, y, z: 0, vx: 0, vy: 0, dx: 0, dy, etat: 'normal' });
const ballonVue = (x = 0, y = 0, z = 0.14) => ({ x, y, z, vx: 0, vy: 0, vz: 0, porteur: -1, pied: null });

/** Les deux équipes alignées face à la caméra, de part et d'autre du milieu. */
function alignement() {
  const joueurs = [];
  for (let e = 0; e < 2; e++) for (let i = 0; i < N; i++) joueurs.push(joueurVue((e === 0 ? -1 : 1) * (1.6 + (N - 1 - i) * 1.25), -3));
  return { phase: 'intro', joueurs, ballon: ballonVue(0, -2.4), actifs: [-1, -1], humeurs: new Array(2 * N).fill('presente'), heros: -1 };
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
      maj: (t) => { const ang = -0.9 + t * 0.45; R.cadrer([Math.sin(ang) * 34, -Math.cos(ang) * 34, 16 - t * 1.5], [0, 0, 1], t < 0.05); },
    },
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => api.afficher(htmlAffiche({ ecusson: ecussonSVG(a, 120), nom: a.court, couleur: P.kits[0].fond }, { ecusson: ecussonSVG(b, 120), nom: b.court, couleur: P.kits[1].fond }, P.lieu || '')),
      maj: (t) => R.cadrer([0, -15 + t, 3.2], [0, -3, 1.4], t < 0.05),
    },
  ];
  // Les deux vedettes.
  for (let e = 0; e < 2; e++) {
    const i = Math.max(0, P.eqs[e].joueurs.findIndex((j) => j.vedette));
    const id = e * N + i;
    const p = vue.joueurs[id];
    etapes.push({
      duree: 1.6,
      vue: () => vue,
      debut: (api) => {
        api.afficher(carte(P, id));
        P.com?.dire(`Attention à <b>${P.eqs[e].joueurs[i].nom}</b>, la vedette de ${P.eqs[e].court} !`, { emotion: 0.5 });
      },
      maj: (t) => R.cadrer([p.x + (t - 0.8) * 0.3, p.y - 4.6, 2.15], [p.x, p.y, 1.55], t < 0.03),
    });
  }
  etapes.push({
    duree: 1,
    vue: () => vue,
    debut: (api) => { api.afficher(htmlTitre('Coup d’envoi !')); P.com?.dire('L’arbitre siffle… c’est parti !', { important: true, emotion: 0.6 }); },
    maj: (t) => R.cadrer([0, -26, 12], [0, 0, 1], t < 0.03),
  });
  return etapes;
}

function statsMatch(P) {
  const st = P.m.stats;
  const tp = st.possession[0] + st.possession[1] || 1;
  return [
    ['Essais', st.essais[0], st.essais[1]],
    ['Possession', `${Math.round((st.possession[0] / tp) * 100)} %`, `${Math.round((st.possession[1] / tp) * 100)} %`],
    ['Plaquages', st.plaquages[0], st.plaquages[1]],
    ['Mètres gagnés', Math.round(st.metres[0]), Math.round(st.metres[1])],
  ];
}

/** Le meilleur joueur du match jusqu'ici (points, essais, plaquages, passes décisives, franchissements, mètres). */
export function meilleurJoueur(m, dans = -1) {
  let best = -1, bv = -1;
  m.perso.forEach((s, i) => {
    if (dans >= 0 && m.joueurs[i].e !== dans) return;
    const v = s.pts * 1.2 + s.essais * 3 + s.plaquages * 1.2 + s.passes * 3 + s.franchis * 1.5 + s.metres * 0.04;
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
    maj: (t) => { const ang = 0.6 + t * 0.12; R.cadrer([Math.sin(ang) * 38, -Math.cos(ang) * 38, 18], [0, 0, 1], t < 0.03); },
  }];
}

/** Ce que le meilleur joueur a fait, en quelques mots. */
export function detailJoueur(s) {
  const pl = (n, mot) => (n ? `${n} ${mot}${n > 1 ? 's' : ''}` : '');
  return [pl(s.essais, 'essai'), pl(s.pts, 'point'), pl(s.plaquages, 'plaquage'), pl(s.passes, 'passe décisive'), pl(s.franchis, 'plaquage cassé'), s.metres >= 10 ? `${Math.round(s.metres)} m` : '']
    .filter(Boolean).slice(0, 3).join(' · ');
}

/** Le Tournoi gagné : le capitaine (la vedette) soulève le trophée, ses coéquipiers autour, la fête. */
export function trophee(P, e) {
  const R = P.rendu, eq = P.eqs[e], kit = P.kits[e];
  const capitaine = Math.max(0, eq.joueurs.findIndex((j) => j.vedette));
  const joueurs = [];
  const humeurs = new Array(2 * N).fill('decu');
  const places = [[-1.3, 0.9], [1.3, 0.9], [-2.4, 1.8], [2.4, 1.8], [-0.7, 2.2], [0.7, 2.2]];
  let k = 0;
  for (let ee = 0; ee < 2; ee++) {
    for (let i = 0; i < N; i++) {
      const id = ee * N + i;
      if (ee !== e) { joueurs.push(joueurVue(-14 + i * 1.4, 9, 1)); continue; }
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
        P.com?.dire(`${eq.nom} remporte le Tournoi ! Quelle finale !`, { important: true, emotion: 1, apres: 'Ils sont allés le chercher, ce trophée.' });
        prochainFeu = 0;
      },
      maj: (t, dt) => {
        const leve = Math.min(1, t / 0.8);
        R.trophee({ x: 0, y: 0.05, h: 1.3 + leve * 1.3 + Math.abs(Math.sin(t * 3)) * 0.06 * leve, echelle: 1.3 });
        prochainFeu -= dt;
        if (prochainFeu <= 0) { R.feuArtifice(couleurs); prochainFeu = 0.45 + Math.random() * 0.4; }
        const ang = -0.7 + t * 0.22;
        R.cadrer([Math.sin(ang) * 7.5, -Math.cos(ang) * 7.5, 2.6 + t * 0.12], [0, 0.6, 2], t < 0.03);
      },
    },
  ];
}

/** La fin : le joueur du match (de l'équipe gagnante), son trophée, la presse. */
export function hommeDuMatch(P) {
  const m = P.m;
  const id = meilleurJoueur(m, m.vainqueur);
  if (id < 0) return [];
  const R = P.rendu, pl = m.joueurs[id], eq = P.eqs[pl.e];
  const detail = detailJoueur(m.perso[id]);
  const joueurs = m.joueurs.map((q) => (q.id === id ? joueurVue(0, 0, -1) : joueurVue(-40 + q.id * 1.2, 40, 1)));
  const humeurs = new Array(2 * N).fill('presente');
  humeurs[id] = 'exhibe';
  const vue = { phase: 'fin', joueurs, ballon: ballonVue(50, 50), actifs: [-1, -1], humeurs, heros: -1 };
  return [
    {
      duree: 2.2,
      vue: () => vue,
      debut: (api) => {
        R.presse({ x: 0, y: 0, rayon: 2.3, regard: -Math.PI / 2, reporters: 6 });
        R.tropheeMain(id);
        api.afficher(htmlTitre('Joueur du match', eq.court));
        P.com?.dire(`Les flashs crépitent : voici le joueur du match, <b>${eq.joueurs[pl.i].nom}</b> !`, { important: true, emotion: 0.6, apres: 'Il a tout donné sur la pelouse.' });
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
