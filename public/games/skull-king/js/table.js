/**
 * SKULL KING — ce qu'on voit à la table : les sièges, le pli, la main, les
 * cartes qui volent, le bilan, le podium.
 *
 * Tout se dessine à partir d'un état « vu d'ici », où le joueur de cet écran
 * est toujours le numéro 0 : la partie solo l'est naturellement, la partie en
 * ligne fait tourner la table avant de la montrer (voir enligne.js).
 *
 *   { n, manche, manches, phase, noms, avatars, paris, plis, scores, tour,
 *     donneur, pli: [{ p, c, as }], mains: [maMain], historique,
 *     aParie?, absents?, prets? }
 */

import * as S from '../../../shared/skullking/moteur.js';
import { carteHtml, portraitSkSvg } from './cartes.js';

const $ = (id) => document.getElementById(id);
export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
export const txt = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/* Messages                                                           */
/* ------------------------------------------------------------------ */

let minuteurToast = 0;
export function toast(m, ms = 2200) {
  const t = $('toast');
  t.textContent = m;
  t.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { t.hidden = true; }, ms);
}

let minuteurAnnonce = 0;
export function annoncer(m) {
  const a = $('annonce');
  a.className = 'annonce visible';
  a.textContent = m;
  clearTimeout(minuteurAnnonce);
  minuteurAnnonce = setTimeout(() => { a.classList.remove('visible'); }, 2600);
}

export const consigne = (m) => { $('consigne').textContent = m; };

/** Ce qu'on dit au joueur quand c'est à lui. */
export function consigneTour(G) {
  const cd = S.couleurDemandee(G.pli);
  if (G.pli.length === 0) return 'À vous d’ouvrir le pli';
  if (cd && G.mains[0].some((c) => c.t === 'n' && c.s === cd)) return `À vous — suivez la couleur ${S.COULEURS[cd].nom}`;
  return 'À vous de jouer';
}

/* ------------------------------------------------------------------ */
/* Sièges, pli, main                                                  */
/* ------------------------------------------------------------------ */

export function rendreTout(G, o = {}) {
  $('no-manche').textContent = Math.min(G.manche, G.manches || S.MANCHES);
  rendreSieges(G, o);
  rendrePli(G);
  rendreMain(G, o);
}

function siegeHtml(G, p, o = {}) {
  const pari = G.paris[p];
  const visible = G.phase !== 'pari' && pari !== null;
  let etat = '';
  if (visible) etat = G.plis[p] > pari ? 'depasse' : G.plis[p] === pari ? 'tenu' : '';
  let bulle;
  if (visible) bulle = `<span class="pari-bulle ${etat}${o.revele ? ' revele' : ''}" title="Pari">${pari}</span>`;
  else if (G.phase === 'pari' && p === 0 && pari !== null) bulle = `<span class="pari-bulle" title="Votre pari">${pari}</span>`;
  else if (G.phase === 'pari' && G.aParie?.[p]) bulle = '<span class="pari-bulle cache" title="A parié">✓</span>';
  else bulle = '<span class="pari-bulle cache" title="Pari secret">?</span>';
  const pions = Array.from({ length: G.plis[p] || 0 }, () => '<i></i>').join('');
  const actif = G.phase === 'jeu' && G.tour === p;
  const absent = G.absents?.[p];
  return `<div class="siege${actif ? ' actif' : ''}${absent ? ' absent' : ''}" data-siege="${p}">
    <span class="avatar">${G.avatars?.[p] || '🏴‍☠️'}</span>
    <span class="siege-info"><span class="siege-nom">${absent ? '📡 ' : ''}${txt(G.noms[p])}</span>
      <span class="siege-stats"><b>${G.scores[p]}</b> pts <span class="plis-pions" title="Plis remportés">${pions}</span></span></span>
    ${bulle}${p === G.donneur ? '<span class="donneur" title="Donneur">donne</span>' : ''}</div>`;
}

export function rendreSieges(G, o = {}) {
  $('adversaires').innerHTML = Array.from({ length: G.n - 1 }, (_, i) => siegeHtml(G, i + 1, o)).join('');
  $('moi-siege').outerHTML = siegeHtml(G, 0, o).replace('class="siege', 'id="moi-siege" class="siege moi-siege');
}

export function rendrePli(G) {
  const pli = $('pli');
  const a = $('annonce');
  if (!G.pli.length) {
    pli.innerHTML = '';
    if (G.phase === 'jeu' && !a.classList.contains('visible')) {
      a.className = 'annonce vide-table';
      a.textContent = G.tour === 0 ? 'À vous d’ouvrir' : `${G.noms[G.tour]} ouvre le pli`;
    }
    return;
  }
  if (a.classList.contains('vide-table')) a.className = 'annonce';
  pli.innerHTML = G.pli.map((j) => `<div class="jeu"><span class="qui">${txt(G.noms[j.p])}</span>${carteHtml(j.c, { as: j.as })}</div>`).join('');
}

const ORDRE = { sk: 100, pir: 101, tig: 102, sir: 103, wha: 104, kra: 105, esc: 106 };
const rangCarte = (c) => (c.t === 'n' ? { B: 0, Y: 20, G: 40, P: 60 }[c.s] + c.n : ORDRE[c.t]);

/** La main du joueur. `o.monTour` : ses cartes jouables s'allument. */
export function rendreMain(G, o = {}) {
  const main = $('main');
  const mienne = (G.mains[0] || []).slice().sort((a, b) => rangCarte(a) - rangCarte(b));
  const monTour = !!o.monTour;
  const ok = monTour ? S.legales(G.mains[0], G.pli).map((c) => c.id) : [];
  main.classList.toggle('mon-tour', monTour);
  main.innerHTML = mienne.map((c, i) => {
    const cls = [monTour ? (ok.includes(c.id) ? 'jouable' : 'interdite') : '', o.donne ? 'arrive' : ''].join(' ');
    return carteHtml(c, { cls, attrs: `data-id="${c.id}" tabindex="${monTour ? 0 : -1}"${o.donne ? ` style="animation-delay:${i * 0.06}s"` : ''}` });
  }).join('');
  ajusterMain();
}

/** Les cartes se chevauchent juste assez pour tenir dans la largeur. */
export function ajusterMain() {
  const main = $('main');
  const cartes = main.children;
  if (!cartes.length) return;
  const cw = cartes[0].offsetWidth;
  const n = cartes.length;
  const dispo = main.clientWidth - 12;
  const chev = n > 1 ? Math.min(6, (dispo - cw) / (n - 1) - cw) : 0;
  main.style.setProperty('--chevauche', `${Math.round(chev)}px`);
}

/* ------------------------------------------------------------------ */
/* Animations                                                         */
/* ------------------------------------------------------------------ */

/** D'où part la carte du joueur p : sa main (s'il s'agit d'ici), ou son siège. */
export function origine(p, id) {
  const el = p === 0 ? document.querySelector(`#main [data-id="${id}"]`) : document.querySelector(`[data-siege="${p}"] .avatar`);
  return el ? el.getBoundingClientRect() : null;
}

/** La dernière carte du pli vole depuis `r0` jusqu'à sa place sur la table. */
export function poser(r0, depuisMain) {
  const el = $('pli').lastElementChild;
  if (!el || !r0) return;
  const r1 = el.getBoundingClientRect();
  const dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2);
  const dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2);
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${depuisMain ? 1 : 0.4}) rotate(${depuisMain ? 0 : -10}deg)`;
  el.style.opacity = depuisMain ? '1' : '0.2';
  el.getBoundingClientRect();
  el.style.transition = '';
  el.style.transform = '';
  el.style.opacity = '';
}

/**
 * Le pli est complet : on montre qui le remporte (ou ce qui l'engloutit).
 * `r` est le résultat de `resoudre`, en numéros « vus d'ici ».
 */
export function montrerVainqueur(G, r, sfx) {
  const jeux = [...$('pli').children];
  consigne('');
  if (r.effet === 'kraken') {
    jeux.forEach((e) => e.classList.add('englouti'));
    sfx.kraken();
    annoncer(`🐙 Le Kraken engloutit le pli ! ${G.noms[r.meneur]} ouvre le suivant`);
  } else if (r.gagnant === null) {
    jeux.forEach((e) => e.classList.add('englouti'));
    sfx.baleine();
    annoncer(`🐋 La Baleine renvoie tout au fond. ${G.noms[r.meneur]} ouvre le suivant`);
  } else {
    jeux[r.carte]?.classList.add('vainqueur');
    if (r.effet === 'baleine') sfx.baleine();
    if (r.gagnant === 0) sfx.pli(); else sfx.pliAutre();
    if (r.bonus) setTimeout(() => sfx.bonus(), 300);
    const qui = r.gagnant === 0 ? 'Vous remportez' : `${G.noms[r.gagnant]} remporte`;
    annoncer(`${r.effet === 'baleine' ? '🐋 ' : ''}${qui} le pli${r.bonus ? ` · +${r.bonus} (${r.details.map((d) => d.txt).join(', ')})` : ''}`);
  }
}

/** Les cartes du pli filent vers leur vainqueur (ou coulent). */
export async function ramasser(r) {
  const jeux = [...$('pli').children];
  const cible = r.gagnant !== null ? document.querySelector(`[data-siege="${r.gagnant}"]`) : null;
  const rc = cible?.getBoundingClientRect();
  jeux.forEach((e) => {
    const re = e.getBoundingClientRect();
    e.style.transform = rc
      ? `translate(${rc.left + rc.width / 2 - (re.left + re.width / 2)}px, ${rc.top + rc.height / 2 - (re.top + re.height / 2)}px) scale(.25)`
      : 'translateY(60px) scale(.6) rotate(20deg)';
    e.style.opacity = '0';
  });
  await attendre(480);
}

export function feterVainqueur(r) {
  if (r.gagnant !== null) document.querySelector(`[data-siege="${r.gagnant}"]`)?.classList.add('gagne');
}

/* ------------------------------------------------------------------ */
/* Pari, bilan, fin, livre de bord                                    */
/* ------------------------------------------------------------------ */

export function montrerPari(G) {
  const p = $('pari');
  $('pari-choix').innerHTML = Array.from({ length: G.manche + 1 }, (_, i) => `<button data-pari="${i}">${i}</button>`).join('');
  p.hidden = false;
}
export function cacherPari() { $('pari').hidden = true; }

/** Remplit la feuille de bilan de la dernière manche. */
export function remplirBilan(G) {
  const b = G.historique.at(-1);
  if (!b) return null;
  $('bilan-titre').textContent = `Fin de la manche ${G.historique.length}`;
  $('bilan').innerHTML = b.map((x, p) => {
    const ok = x.pari === x.plis;
    const detail = `Pari ${x.pari} · ${x.plis} pli${x.plis > 1 ? 's' : ''}${x.bonus ? ` · bonus ${ok ? '+' : '(perdu) '}${x.bonus}` : ''}`;
    const pret = G.prets?.[p] ? ' <span title="Prêt">✅</span>' : '';
    return `<div class="bilan-ligne ${ok ? 'ok' : 'ko'}" style="animation-delay:${p * 0.07}s">
      <div><div class="bilan-nom">${G.avatars?.[p] || ''} ${txt(G.noms[p])}${pret}</div><div class="bilan-detail">${ok ? '✓' : '✗'} ${detail}</div></div>
      <div class="bilan-pts ${x.points >= 0 ? 'plus' : 'moins'}">${x.points >= 0 ? '+' : ''}${x.points}</div>
      <div class="bilan-total">${x.total}</div></div>`;
  }).join('');
  return b;
}

/** Le podium de fin. */
export function remplirFin(G) {
  const cl = G.noms.map((nom, p) => ({ p, nom, score: G.scores[p] })).sort((a, b) => b.score - a.score);
  cl.forEach((x, i) => { x.rang = i > 0 && x.score === cl[i - 1].score ? cl[i - 1].rang : i + 1; });
  const moi = cl.find((x) => x.p === 0);
  $('fin-couronne').innerHTML = portraitSkSvg();
  $('fin-titre').textContent = moi.rang === 1 ? 'Vous êtes le Skull King !' : `${cl[0].nom} est le Skull King`;
  $('fin-sous').textContent = moi.rang === 1 ? 'L’équipage s’incline devant son capitaine.' : `Vous finissez ${moi.rang}${moi.rang === 1 ? 'er' : 'e'} avec ${moi.score} points.`;
  const medailles = ['🥇', '🥈', '🥉'];
  $('podium').innerHTML = cl.map((x) => `<div><span class="rang">${medailles[x.rang - 1] || x.rang}</span>
    <span class="nom">${G.avatars?.[x.p] || ''} ${txt(x.nom)}</span><span class="pts">${x.score}</span></div>`).join('');
}

export function tableauPartie(G) {
  const h = G.historique;
  let html = `<thead><tr><th>#</th>${G.noms.map((n) => `<th>${txt(n)}</th>`).join('')}</tr></thead><tbody>`;
  h.forEach((m, i) => {
    html += `<tr><td>${i + 1}</td>${m.map((x) => `<td><span class="pts ${x.points >= 0 ? 'plus' : 'moins'}">${x.points >= 0 ? '+' : ''}${x.points}</span>
      <span class="cum">${x.pari}/${x.plis} · ${x.total}</span></td>`).join('')}</tr>`;
  });
  if (!h.length) html += `<tr><td colspan="${G.n + 1}">Aucune manche terminée pour l’instant.</td></tr>`;
  html += `<tr class="total"><td>Σ</td>${G.scores.map((s) => `<td>${s}</td>`).join('')}</tr></tbody>`;
  return html;
}
