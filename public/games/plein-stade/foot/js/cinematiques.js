/**
 * PETIT PONT — les mini-cinématiques du foot, comme à la télé :
 *   l'avant-match : le survol du stade, l'affiche, la présentation des joueurs
 *     un par un (gros plan et carte), puis le coup d'envoi ;
 *   la mi-temps : le score, les statistiques et le meilleur joueur ;
 *   la fin : l'homme du match, son petit trophée dans les mains, la presse autour (flashs, micros) ;
 *   la Coupe gagnée : le capitaine soulève le trophée, ses coéquipiers autour,
 *     confettis et feux d'artifice.
 * Le moteur des étapes et l'habillage sont communs (commun/cinematique.js) ;
 * ici, les plans et ce qu'ils montrent.
 */

import { htmlAffiche, htmlCarte, htmlTitre, htmlPanneau } from '../../commun/cinematique.js';
import { ecussonSVG } from '../../commun/ecusson.js';
import { notesJoueur, POSTES } from '../../../../shared/foot/equipes.js';
import { resumerMatch } from '../../../../shared/foot/stats.js';

const POSTE = { G: 'Gardien', D: 'Défenseur', M: 'Milieu', A: 'Attaquant' };
const noteDe = (eq, i) => {
  const n = notesJoueur(eq, i);
  return i === 0 ? Math.round((n.gardien * 2 + n.vitesse + n.passe) / 4) : Math.round((n.vitesse + n.tir + n.passe + n.defense) / 4);
};
const joueurVue = (x, y, dy = -1) => ({ x, y, vx: 0, vy: 0, dx: 0, dy, etat: 'normal', frappe: 0, charge: 0, volee: 0, geste: 0, gesteType: 0, spin: 0, roul: 0, haut: false, vyPlonge: 0 });
const ballonVue = (x = 0, y = 0) => ({ x, y, z: 0, vx: 0, vy: 0, vz: 0, porteur: -1 });

/** Les deux équipes alignées face à la caméra, de part et d'autre du rond central. */
function alignement(P) {
  const joueurs = [];
  for (let e = 0; e < 2; e++) for (let i = 0; i < 5; i++) joueurs.push(joueurVue((e === 0 ? -1 : 1) * (1.6 + (4 - i) * 1.35), -2.6));
  return { phase: 'intro', joueurs, ballon: ballonVue(0, 0.5), actifs: [-1, -1], humeurs: new Array(10).fill('presente'), heros: -1, tab: false };
}

/** La carte d'un joueur, prête pour l'habillage. */
function carte(P, id, extra = {}) {
  const p = P.m.joueurs[id], eq = P.eqs[p.e], j = eq.joueurs[p.i];
  return htmlCarte({
    numero: j.numero, nom: j.nom, poste: POSTE[POSTES[p.i]], note: noteDe(eq, p.i), vedette: !!j.vedette,
    couleur: P.kits[p.e].fond, ecusson: ecussonSVG(eq, 42), cote: p.e === 0 ? 'g' : 'd', ...extra,
  });
}

/** L'avant-match. En ligne, plus court et sans pouvoir le passer (il dure autant chez les deux joueurs). */
export function intro(P) {
  const vite = P.o.mode === 'enligne';
  const R = P.rendu;
  const vue = alignement(P);
  const [a, b] = P.eqs;
  const etapes = [
    {
      // Le survol du stade.
      duree: vite ? 2 : 3,
      vue: () => vue,
      maj: (t) => { const ang = -0.9 + t * 0.45; R.cadrer([Math.sin(ang) * 27, -Math.cos(ang) * 27, 13 - t], [0, 0, 0], t < 0.05); },
    },
    {
      // L'affiche : les deux écussons face à face.
      duree: vite ? 1.6 : 2.2,
      vue: () => vue,
      debut: (api) => api.afficher(htmlAffiche({ ecusson: ecussonSVG(a, 120), nom: a.court, couleur: P.kits[0].fond }, { ecusson: ecussonSVG(b, 120), nom: b.court, couleur: P.kits[1].fond }, P.lieu || '')),
      maj: (t) => R.cadrer([0, -11 + t, 2.6], [0, -2.6, 1.3], t < 0.05),
    },
  ];
  // La présentation des joueurs : les gardiens d'abord, puis du fond vers l'avant.
  const ordre = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const parJoueur = vite ? 0.4 : 0.72;
  for (const id of ordre) {
    const p = vue.joueurs[id];
    etapes.push({
      duree: parJoueur,
      vue: () => vue,
      debut: (api) => {
        api.afficher(carte(P, id));
        const pl = P.m.joueurs[id], j = P.eqs[pl.e].joueurs[pl.i];
        if (j.vedette && !vite) P.com?.dire(`Attention à <b>${j.nom}</b>, la vedette de ${P.eqs[pl.e].court} !`, { emotion: 0.5 });
      },
      maj: (t) => R.cadrer([p.x + (t - parJoueur / 2) * 0.3, p.y - 4.3, 1.95], [p.x, p.y, 1.3], t < 0.03),
    });
  }
  etapes.push({
    duree: vite ? 0.6 : 1,
    vue: () => vue,
    debut: (api) => { api.afficher(htmlTitre('Coup d’envoi !')); P.com?.dire('Coup d’envoi ! C’est parti !', { important: true, emotion: 0.6, clip: 'coup_envoi' }); },
    maj: (t) => R.cadrer([0, -18, 9], [0, 0, 0], t < 0.03),
  });
  return etapes;
}

/** Le meilleur joueur du match jusqu'ici (d'après ce qu'il a fait : buts, passes, arrêts…). */
export function meilleurJoueur(P) {
  const perf = P.perf || [];
  let best = -1, bv = -1;
  for (let i = 0; i < 10; i++) if ((perf[i] || 0) > bv) { bv = perf[i] || 0; best = i; }
  return best;
}

function statsMatch(P) {
  const st = P.m.stats;
  const tot = st.possession[0] + st.possession[1] || 1;
  return [
    ['Possession', `${Math.round((st.possession[0] / tot) * 100)} %`, `${Math.round((st.possession[1] / tot) * 100)} %`],
    ['Tirs', st.tirs[0], st.tirs[1]],
    ['Cadrés', st.cadres[0], st.cadres[1]],
    ['Passes', st.passes[0], st.passes[1]],
  ];
}

/** La mi-temps : une vue du stade, le score et les statistiques. */
export function miTemps(P) {
  const R = P.rendu, m = P.m;
  const best = meilleurJoueur(P);
  const nomBest = best >= 0 ? P.eqs[m.joueurs[best].e].joueurs[m.joueurs[best].i].nom : '';
  return [{
    duree: 7,
    debut: (api) => api.afficher(htmlPanneau('Mi-temps', `${P.eqs[0].abr} ${m.score[0]} - ${m.score[1]} ${P.eqs[1].abr}`, statsMatch(P), nomBest ? `Meilleur joueur : ${nomBest}` : '')),
    maj: (t) => { const ang = 0.6 + t * 0.12; R.cadrer([Math.sin(ang) * 30, -Math.cos(ang) * 30, 15], [0, 0, 0], t < 0.03); },
  }];
}

/** Ce que l'homme du match a fait, en quelques mots (pour sa carte). */
function detailHdm(ligne) {
  const buts = ligne.buts, passes = ligne.passes;
  return [
    buts ? `${buts} but${buts > 1 ? 's' : ''}` : '',
    passes ? `${passes} passe${passes > 1 ? 's' : ''} décisive${passes > 1 ? 's' : ''}` : '',
    ligne.i === 0 ? `${ligne.arrets} arrêt${ligne.arrets > 1 ? 's' : ''}` : '',
    ligne.sansEncaisser ? 'sans encaisser' : '',
  ].filter(Boolean).join(' · ');
}

/**
 * La fin du match : l'homme du match (choisi par le score de performance, dans l'équipe gagnante :
 * shared/foot/stats.js). Il tient dans ses mains un petit trophée « Homme du match », entouré de la
 * presse : photographes à genoux dont les flashs crépitent, reporters qui lui tendent leur micro.
 * Deux plans : l'ensemble (le titre), puis le gros plan avec sa carte.
 * Ce qu'il dit : le commentateur annonce selon ce qu'il a fait (gardien, buteur, passeur), le consultant répond.
 */
export function hommeDuMatch(P) {
  const resume = resumerMatch(P.m);
  const id = resume.hdm;
  if (id < 0) return [];
  const R = P.rendu, pl = P.m.joueurs[id], eq = P.eqs[pl.e];
  const ligne = resume.joueurs[id];
  const detail = detailHdm(ligne);
  // Lui, face à la caméra, au centre ; les autres hors champ.
  const joueurs = P.m.joueurs.map((q) => (q.id === id ? joueurVue(0, 0, -1) : joueurVue(-30 + q.id * 1.2, 30, 1)));
  const humeurs = new Array(10).fill('presente');
  humeurs[id] = 'exhibe';
  const vue = { phase: 'fin', joueurs, ballon: ballonVue(40, 40), actifs: [-1, -1], humeurs, heros: -1, tab: false };
  const famille = ligne.i === 0 ? 'hdm_gardien' : ligne.buts ? 'hdm_buteur' : ligne.passes ? 'hdm_passeur' : 'hdm_annonce';
  const textes = {
    hdm_gardien: 'Le gardien a été le héros de la soirée : c’est lui, l’homme du match !',
    hdm_buteur: 'Il a fait trembler les filets : voici l’homme du match !',
    hdm_passeur: 'Le chef d’orchestre de la soirée : voici l’homme du match !',
    hdm_annonce: 'Les flashs crépitent : voici l’homme du match !',
  };
  return [
    {
      // L'ensemble : la presse autour de lui, les flashs.
      duree: 2.2,
      vue: () => vue,
      debut: (api) => {
        R.presse({ x: 0, y: 0, rayon: 2.3, regard: -Math.PI / 2, reporters: 6 });
        R.tropheeMain(id);
        api.afficher(htmlTitre('Homme du match', eq.court));
        P.com?.dire(textes[famille], { important: true, emotion: 0.6, clip: famille, apresClip: 'cons_hdm', apres: 'Aucune discussion possible : c’est mérité.' });
      },
      maj: (t) => R.cadrer([0.5 - t * 0.25, -5.8 + t * 0.5, 1.85], [0, 0, 1.15], t < 0.03),
    },
    {
      // Le gros plan : sa carte, le trophée dans les mains.
      duree: 3.6,
      vue: () => vue,
      debut: (api) => api.afficher(carte(P, id, { titre: 'Homme du match', detail })),
      maj: (t) => R.cadrer([0.95 - t * 0.2, -3.7 + t * 0.25, 1.55], [0.1, 0, 1.25], t < 0.03),
    },
  ];
}

/** La Coupe gagnée : le capitaine soulève le trophée, ses coéquipiers autour, la fête. */
export function trophee(P, e) {
  const R = P.rendu, eq = P.eqs[e], kit = P.kits[e];
  const capitaine = Math.max(1, eq.joueurs.findIndex((j, i) => i > 0 && j.vedette));
  const joueurs = [];
  const humeurs = new Array(10).fill('decu');
  const places = [[-1.7, 1.1], [-0.85, 1.7], [0.85, 1.7], [1.7, 1.1]];
  let k = 0;
  for (let ee = 0; ee < 2; ee++) {
    for (let i = 0; i < 5; i++) {
      const id = ee * 5 + i;
      if (ee !== e) { joueurs.push(joueurVue(-12 + i * 1.4, 6, 1)); continue; }
      if (i === capitaine) { joueurs.push(joueurVue(0, 0)); humeurs[id] = 'trophee'; continue; }
      const [x, y] = places[k++];
      joueurs.push(joueurVue(x, y));
      humeurs[id] = 'joie';
    }
  }
  const vue = { phase: 'fin', joueurs, ballon: ballonVue(30, 30), actifs: [-1, -1], humeurs, heros: -1, tab: false };
  const couleurs = [kit.fond, kit.motifC, kit.short, '#ffd23f', '#ffffff'];
  let prochainFeu = 0;
  return [
    {
      duree: 1.6,
      vue: () => vue,
      debut: (api) => { R.presse(null); R.tropheeMain(null); R.trophee({ x: 0, y: -0.25, h: 1.15, echelle: 1.25 }); api.afficher(''); P.com?.dire(`Le capitaine de ${eq.court} s’avance vers le trophée…`, { important: true, emotion: 0.6 }); },
      maj: (t) => R.cadrer([2.5 - t, -5, 1.6], [0, 0, 1.4], t < 0.03),
    },
    {
      duree: 7.5,
      vue: () => vue,
      debut: (api) => {
        api.afficher(htmlTitre('Champions !', eq.nom));
        R.confettis(0, e);
        P.com?.dire(`${eq.nom} soulève la Coupe ! Quelle soirée, quel parcours !`, { important: true, emotion: 1, clip: 'champions', apresClip: 'cons_trophee', apres: 'Ils l’ont méritée, ce trophée.' });
        prochainFeu = 0;
      },
      maj: (t, dt) => {
        // Le trophée monte au-dessus de la tête du capitaine, puis il le brandit.
        const leve = Math.min(1, t / 0.8);
        R.trophee({ x: 0, y: 0.05, h: 1.2 + leve * 1.15 + Math.abs(Math.sin(t * 3)) * 0.06 * leve, echelle: 1.25 });
        prochainFeu -= dt;
        if (prochainFeu <= 0) { R.feuArtifice(couleurs); prochainFeu = 0.45 + Math.random() * 0.4; }
        const ang = -0.7 + t * 0.22;
        R.cadrer([Math.sin(ang) * 6.8, -Math.cos(ang) * 6.8, 2.3 + t * 0.12], [0, 0, 1.8], t < 0.03);
      },
    },
  ];
}
