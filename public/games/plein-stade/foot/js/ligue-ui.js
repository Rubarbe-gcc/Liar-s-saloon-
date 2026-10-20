/**
 * PETIT PONT — la Ligue des Étoiles, côté affichage : le tirage au sort animé,
 * le classement de chaque poule, le tableau final, et les matchs du joueur.
 *
 * Les règles (tirage, calendrier, points, départages, phase finale) sont dans
 * shared/foot/ligue.js ; ici on ne fait que les montrer et lancer les matchs.
 * La partie est gardée sur l'appareil entre deux matchs.
 *
 * main.js donne ce qu'il sait faire (changer d'écran, choisir une équipe,
 * lancer un match) ; ce module ne touche ni à la 3D ni au moteur du match.
 */

import { EQUIPE } from '../../../../shared/foot/equipes.js';
import { NIVEAUX } from '../../../../shared/foot/ia.js';
import {
  creerLigue, restaurerLigue, classements, matchDuJoueurPoule, enregistrerPoule, jouerPouleSansMoi, aJouerPoule, avancerPoules,
  FORMATS, nomDuTour, nomTour, estLaFinale, matchDuJoueurFinale, enregistrerFinale, jouerFinaleSansMoi, aJouerFinale, avancerFinale,
  simulerLeReste, stadeDeLaJournee, stadeDuTourFinale, noterStats,
} from '../../../../shared/foot/ligue.js';
import { ecussonSVG } from '../../commun/ecusson.js';

const CLE_LIGUE = 'petitpont.ligue';
const rang = (n) => (n === 1 ? '1er' : `${n}e`);
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const sansAnimation = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {object} ctx  ce que main.js prête : { $, aller, son, conf, ouvrirEquipes, lancerMatch }
 */
export function creerEcransLigue(ctx) {
  const { $, aller, son, conf, ouvrirEquipes, lancerMatch, montrerStats } = ctx;
  let ligue = null;
  let vue = 'poules';
  let minuteur = 0;

  try { ligue = restaurerLigue(JSON.parse(localStorage.getItem(CLE_LIGUE) || 'null')); } catch { ligue = null; }
  const garder = () => { try { if (ligue) localStorage.setItem(CLE_LIGUE, JSON.stringify(ligue)); else localStorage.removeItem(CLE_LIGUE); } catch { /* ignore */ } };

  /** Ce que dit la carte du menu. */
  function info() {
    const el = $('ligue-info');
    if (!el) return;
    const l = ligue;
    if (!l || l.fini) { el.textContent = 'Tous les clubs, des poules, puis la finale'; return; }
    if (l.phase === 'poules') el.textContent = `En cours : journée ${l.journee + 1} sur ${l.nbJournees} avec ${EQUIPE[l.moi].court}`;
    else if (l.elimine) el.textContent = `${EQUIPE[l.moi].court} est éliminé`;
    else el.textContent = `En cours : ${nomDuTour(l).toLowerCase()} avec ${EQUIPE[l.moi].court}`;
  }

  /** Le bouton du menu : reprendre la Ligue en cours, ou en commencer une (équipe, format, durée, stade). */
  function ouvrir() {
    if (ligue) { if (!ligue.tirageVu) ouvrirTirage(); else { vue = ligue.phase === 'finale' ? 'finale' : 'poules'; rendre(); aller('ligue'); } return; }
    ouvrirEquipes('ligue', () => {
      ligue = creerLigue({ moi: conf.moi, graine: Math.floor(Math.random() * 2 ** 31), niveau: conf.niveau, minutes: conf.minutes, stade: conf.stade, format: conf.format || 'simple' });
      garder();
      ouvrirTirage();
    });
  }

  /* ---------------- Le tirage au sort ---------------- */

  const slotHtml = (id, eq, moi) => (id
    ? `<div class="slot neuf${moi ? ' toi' : ''}">${ecussonSVG(eq, 22)}<span>${eq.court}</span></div>`
    : '<div class="slot vide"><i></i><span>?</span></div>');

  function ouvrirTirage() {
    const l = ligue;
    clearTimeout(minuteur);
    $('tirage-poules').innerHTML = l.poules.map((p) => `<div class="poule" data-p="${l.poules.indexOf(p)}"><h4>Poule ${p.nom}</h4><div class="slots">${p.ids.map(() => slotHtml(null)).join('')}</div></div>`).join('');
    $('tirage-boule').innerHTML = '';
    $('tirage-info').textContent = `${l.ordreTirage.length} clubs, ${pluriel(l.poules.length, 'poule')} de quatre. C’est parti pour le tirage !`;
    $('tirage-passer').classList.remove('cache');
    $('tirage-suite').classList.add('cache');
    aller('tirage');
    let k = 0;
    const attente = Math.max(220, Math.min(800, 9000 / l.ordreTirage.length));
    const poser = (o, avecBoule) => {
      const eq = EQUIPE[o.club];
      const carte = $('tirage-poules').querySelector(`.poule[data-p="${o.poule}"] .slots`).children[o.rang];
      carte.outerHTML = slotHtml(o.club, eq, o.club === l.moi);
      if (avecBoule) {
        $('tirage-boule').innerHTML = `<div class="tire" style="--c1:${eq.maillot.fond}">${ecussonSVG(eq, 64)}<span><b>${eq.nom}</b><small>Poule ${l.poules[o.poule].nom}</small></span></div>`;
        $('tirage-info').textContent = o.club === l.moi ? `${eq.court}, c’est toi ! Poule ${l.poules[o.poule].nom}.` : `${eq.court} rejoint la poule ${l.poules[o.poule].nom}.`;
      }
    };
    const fini = () => {
      $('tirage-passer').classList.add('cache');
      $('tirage-suite').classList.remove('cache');
      const p = l.poules.find((x) => x.ids.includes(l.moi));
      $('tirage-info').textContent = `Tirage terminé. ${EQUIPE[l.moi].court} est dans la poule ${p.nom}.`;
      $('tirage-boule').innerHTML = '';
      l.tirageVu = true;
      garder();
    };
    const suivant = () => {
      if (k >= l.ordreTirage.length) { fini(); return; }
      poser(l.ordreTirage[k++], true);
      son.bip();
      minuteur = setTimeout(suivant, attente);
    };
    if (sansAnimation()) { while (k < l.ordreTirage.length) poser(l.ordreTirage[k++], false); fini(); } else minuteur = setTimeout(suivant, 500);
    $('tirage-passer').onclick = () => {
      clearTimeout(minuteur);
      while (k < l.ordreTirage.length) poser(l.ordreTirage[k++], false);
      fini();
    };
  }

  /* ---------------- Les poules et le tableau ---------------- */

  const ligneClassement = (l, x) => {
    const eq = EQUIPE[x.id];
    return `<tr class="${x.rang <= 2 ? 'qualifie' : ''}${x.id === l.moi ? ' toi' : ''}"><td>${x.rang}</td><td class="club"><span>${ecussonSVG(eq, 20)}<b>${eq.court}</b></span></td><td>${x.j}</td><td>${x.v}</td><td>${x.n}</td><td>${x.d}</td><td>${x.diff > 0 ? '+' : ''}${x.diff}</td><td class="pts">${x.pts}</td></tr>`;
  };

  function htmlMatchs(l, poule) {
    const jouees = poule.matchs.filter((m) => m.score);
    if (!jouees.length) return '';
    return `<details><summary>Les matchs (${jouees.length})</summary>${jouees.map((m) => `<div class="mj${m.a === l.moi || m.b === l.moi ? ' toi' : ''}"><span>${EQUIPE[m.a].abr}</span><b>${m.score[0]} - ${m.score[1]}</b><span>${EQUIPE[m.b].abr}</span></div>`).join('')}</details>`;
  }

  function htmlPoules(l) {
    const cl = classements(l);
    // La poule du joueur d'abord.
    const ordre = l.poules.map((_, p) => p).sort((a, b) => (l.poules[b].ids.includes(l.moi) ? 1 : 0) - (l.poules[a].ids.includes(l.moi) ? 1 : 0) || a - b);
    return `<div class="poules-grille">${ordre.map((p) => `<div class="poule${l.poules[p].ids.includes(l.moi) ? ' toi' : ''}"><h4>Poule ${l.poules[p].nom}</h4>
      <table><thead><tr><th></th><th></th><th>J</th><th>V</th><th>N</th><th>D</th><th>+/-</th><th>Pts</th></tr></thead><tbody>${cl[p].map((x) => ligneClassement(l, x)).join('')}</tbody></table>
      ${htmlMatchs(l, l.poules[p])}</div>`).join('')}</div>`;
  }

  function ligneTableau(l, id, score, perd) {
    if (!id) return '<div class="ligne"><span></span><span>?</span><b></b></div>';
    const eq = EQUIPE[id];
    return `<div class="ligne${perd ? ' perd' : ''}${id === l.moi ? ' toi' : ''}">${ecussonSVG(eq, 20)}<span>${eq.court}</span><b>${score ?? ''}</b></div>`;
  }

  function htmlTableau(l) {
    const k = l.finale;
    const colonnes = [...k.tours.map((t) => t.length)];
    while (colonnes[colonnes.length - 1] > 1) colonnes.push(colonnes[colonnes.length - 1] / 2);
    let html = '';
    colonnes.forEach((n, t) => {
      const tour = k.tours[t] || new Array(n).fill(null).map(() => ({}));
      html += `<div class="tour"><h4>${nomTour(n)}</h4>${tour.map((r) => {
        const fini = !!r.v;
        const sa = fini ? `${r.score[0]}${r.tab ? ` (${r.tab[0]})` : ''}` : '', sb = fini ? `${r.score[1]}${r.tab ? ` (${r.tab[1]})` : ''}` : '';
        const joueur = r.a === l.moi || r.b === l.moi;
        return `<div class="rencontre${joueur ? ' joueur' : ''}">${ligneTableau(l, r.a, sa, fini && r.v !== r.a)}${ligneTableau(l, r.b, sb, fini && r.v !== r.b)}</div>`;
      }).join('')}</div>`;
    });
    html += `<div class="tour"><h4>Vainqueur</h4><div class="coupe-trophee">⭐</div>${l.champion ? `<div class="rencontre${l.champion === l.moi ? ' joueur' : ''}">${ligneTableau(l, l.champion, '')}</div>` : ''}</div>`;
    return `<div class="tableau" style="grid-template-columns:repeat(${colonnes.length + 1},minmax(140px,1fr))">${html}</div>`;
  }

  function texteInfo(l) {
    const eq = EQUIPE[l.moi];
    if (l.fini) return l.champion === l.moi ? `${eq.nom} remporte la Ligue des Étoiles !` : `${EQUIPE[l.champion].nom} remporte la Ligue des Étoiles.`;
    if (l.phase === 'poules') {
      const m = matchDuJoueurPoule(l);
      const adv = m && (m.a === l.moi ? m.b : m.a);
      return `${l.format === 'retour' ? 'Aller-retour' : 'Aller simple'} · Journée ${l.journee + 1} sur ${l.nbJournees} · ${eq.court} contre ${EQUIPE[adv].court} · ${NIVEAUX[l.niveau].nom}`;
    }
    if (l.elimine) return `${eq.court} est éliminé. La Ligue continue sans toi.`;
    const m = matchDuJoueurFinale(l);
    const adv = m && (m.a === l.moi ? m.b : m.a);
    return `${nomDuTour(l)} · ${eq.court} contre ${EQUIPE[adv].court} · ${NIVEAUX[l.niveau].nom}`;
  }

  function rendre() {
    const l = ligue;
    if (!l) return;
    if (vue === 'finale' && !l.finale) vue = 'poules';
    $('ligue-info-haut').textContent = texteInfo(l);
    // Les onglets : les poules, et le tableau final quand il existe.
    const onglets = $('ligue-onglets');
    onglets.innerHTML = '';
    const onglet = (nom, txt) => { const b = document.createElement('button'); b.textContent = txt; b.className = vue === nom ? 'oui' : ''; b.addEventListener('click', () => { vue = nom; rendre(); }); onglets.appendChild(b); };
    onglet('poules', 'Les poules');
    if (l.finale) onglet('finale', 'Le tableau final');
    onglets.classList.toggle('cache', !l.finale);
    $('ligue-corps').innerHTML = vue === 'finale' ? htmlTableau(l) : htmlPoules(l);

    const act = $('ligue-actions');
    act.innerHTML = '';
    const bouton = (txt, cls, f) => { const el = document.createElement('button'); el.className = `btn ${cls}`; el.innerHTML = txt; el.addEventListener('click', f); act.appendChild(el); };
    bouton('<b>Statistiques</b>', 'bleu', () => montrerStats(l.stats, l.moi, () => { rendre(); aller('ligue'); }));
    if (l.phase === 'poules') {
      const m = matchDuJoueurPoule(l);
      if (m && !m.score) bouton(`<b>Jouer la journée ${l.journee + 1}</b><small>contre ${EQUIPE[m.a === l.moi ? m.b : m.a].nom}</small>`, 'vert grand', jouer);
    } else {
      const m = matchDuJoueurFinale(l);
      const lib = { 1: 'la finale', 2: 'la demie', 4: 'le quart', 8: 'le huitième' }[l.finale.tours[l.finale.tour].length] || 'le match';
      if (m) bouton(`<b>Jouer ${lib}</b><small>contre ${EQUIPE[m.a === l.moi ? m.b : m.a].nom}</small>`, 'vert grand', jouer);
    }
    if (l.elimine && !l.fini) bouton('<b>Voir la suite</b>', 'bleu', () => { simulerLeReste(l); garder(); vue = 'finale'; rendre(); });
    if (l.fini || l.elimine) bouton('<b>Nouvelle Ligue</b>', l.fini ? 'vert' : '', () => { ligue = null; garder(); vue = 'poules'; ouvrir(); });
    else bouton('Abandonner la Ligue', 'fin', () => { if (confirm('Abandonner cette Ligue ?')) { ligue = null; garder(); info(); aller('competitions'); } });
    info();
  }

  /* ---------------- Les matchs du joueur ---------------- */

  /** Les autres matchs de la journée (ou du tour) se jouent ; puis on passe à la suite. */
  function finirEtape() {
    const l = ligue;
    if (l.phase === 'poules') {
      for (const { p, i } of aJouerPoule(l)) jouerPouleSansMoi(l, p, i);
      avancerPoules(l);
      if (l.phase === 'finale') vue = 'finale';
    } else {
      for (const i of aJouerFinale(l)) jouerFinaleSansMoi(l, i);
      avancerFinale(l);
    }
    garder();
  }

  function jouer() {
    const l = ligue;
    if (l.phase === 'poules') jouerPoule(l); else jouerFinale(l);
  }

  function jouerPoule(l) {
    const m = matchDuJoueurPoule(l);
    if (!m || m.score) return;
    const moiA = m.a === l.moi;
    const adv = moiA ? m.b : m.a;
    const poule = l.poules[m.p];
    const noter = (res) => {
      // Le match est joué « moi contre lui » : on le remet dans le sens du calendrier.
      enregistrerPoule(l, m.p, m.i, { score: moiA ? res.score : [res.score[1], res.score[0]] });
      noterStats(l, res.resume);
      finirEtape();
    };
    lancerMatch({
      equipes: [l.moi, adv], controles: ['humain', 'ia'], niveaux: [1, l.niveau], minutes: l.minutes, stade: stadeDeLaJournee(l), mode: 'ligue', tab: false, finale: false,
      apres: (res, bouton) => {
        noter(res);
        const ligne = classements(l).flat().find((x) => x.id === l.moi);
        const p = l.poules.find((x) => x.ids.includes(l.moi));
        $('fin-attente').textContent = l.phase === 'finale'
          ? (l.elimine ? `Poules terminées : ${EQUIPE[l.moi].court} termine ${rang(ligne.rang)} de la poule ${p.nom} et ne passe pas.` : `Poules terminées : ${EQUIPE[l.moi].court} est qualifié pour la phase finale !`)
          : `Poule ${poule.nom} : ${rang(ligne.rang)} avec ${pluriel(ligne.pts, 'point')}.`;
        bouton(l.phase === 'finale' ? 'Le tableau final' : 'Le classement', 'vert grand', () => { vue = l.phase === 'finale' ? 'finale' : 'poules'; rendre(); aller('ligue'); });
        bouton('Menu', '', () => { info(); aller('menu'); });
      },
      // Abandonner un match de poule : défaite par forfait.
      abandon: () => { noter({ score: [0, 3] }); rendre(); aller('ligue'); },
    });
  }

  function jouerFinale(l) {
    const r = matchDuJoueurFinale(l);
    if (!r) return;
    const moiA = r.a === l.moi;
    const adv = moiA ? r.b : r.a;
    const laFinale = estLaFinale(l);
    const stade = stadeDuTourFinale(l);
    const noter = (res) => {
      const sw = (x) => (x && !moiA ? [x[1], x[0]] : x);
      enregistrerFinale(l, r.i, { score: sw(res.score), tab: sw(res.tab), vainqueur: moiA ? res.vainqueur : 1 - res.vainqueur });
      noterStats(l, res.resume);
      finirEtape();
    };
    lancerMatch({
      equipes: [l.moi, adv], controles: ['humain', 'ia'], niveaux: [1, l.niveau], minutes: l.minutes, stade, mode: 'ligue', tab: true, finale: laFinale,
      apres: (res, bouton) => {
        noter(res);
        const gagne = res.vainqueur === 0;
        $('fin-titre').textContent = gagne ? (l.fini ? 'Champion !' : 'Qualifié !') : 'Éliminé';
        bouton('Le tableau final', 'vert grand', () => { vue = 'finale'; rendre(); aller('ligue'); });
        bouton('Menu', '', () => { info(); aller('menu'); });
      },
      abandon: () => { noter({ score: [0, 3], tab: null, vainqueur: 1 }); vue = 'finale'; rendre(); aller('ligue'); },
    });
  }

  /** Les boutons « retour » et « voir les poules » des deux écrans. */
  function brancher() {
    $('ligue-retour').addEventListener('click', () => { info(); aller('competitions'); });
    $('tirage-retour').addEventListener('click', () => { clearTimeout(minuteur); if (ligue && !ligue.tirageVu) { ligue.tirageVu = true; garder(); } info(); aller('competitions'); });
    $('tirage-suite').addEventListener('click', () => { son.bip(); vue = 'poules'; rendre(); aller('ligue'); });
  }
  brancher();

  return { ouvrir, info };
}
