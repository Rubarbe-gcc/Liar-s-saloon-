/**
 * ÉCHO — rendu.
 *
 * Le jeu se joue à l'oreille, mais l'écran doit dire à chaque instant ce
 * qu'on attend de vous : c'est le seul moyen de ne pas rater sa prise, qui ne
 * se rejoue pas.
 */

import { SONS, getSon, FAMILLES, rendre, dureeDe } from '../../../shared/mimic/sons.js';
import { CASES, SABOTAGES, PHASE, DUREE_PRISE } from '../../../shared/mimic/partie.js';
import { POIDS } from '../../../shared/mimic/analyse.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Écrans                                                              */
/* ------------------------------------------------------------------ */

export function montrer(id) {
  document.querySelectorAll('.screen').forEach((s) =>
    s.classList.toggle('is-active', s.id === `s-${id}`));
}

let toastTimer = null;
export function toast(texte, ms = 2000) {
  const t = $('toast');
  t.textContent = texte;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ------------------------------------------------------------------ */
/* La consigne                                                         */
/* ------------------------------------------------------------------ */

export function consigne(son) {
  const f = FAMILLES[son.famille];
  $('consigne').style.setProperty('--fc', f.color);
  $('cons-glyph').textContent = son.glyph;
  $('cons-nom').textContent = son.nom;
  $('cons-indice').textContent = son.indice;
  // Le nombre d'attaques est une information du barème, pas une intuition :
  // on l'affiche, puisque c'est sur lui qu'on sera noté.
  $('cons-att').innerHTML = `<b>${son.attaques}</b> `
    + `${son.attaques > 1 ? 'débuts de son' : 'début de son'} · ${f.glyph} ${f.label}`;
}

/* ------------------------------------------------------------------ */
/* La scène                                                            */
/* ------------------------------------------------------------------ */

export function phase(v, texte) {
  $('j-manche').textContent = `Manche ${v.manche} / ${v.manches}`;
  $('j-phase').textContent = texte;
}

export function scene(texte, cls = '') {
  const el = $('scene-txt');
  el.className = `scene-txt ${cls}`;
  el.textContent = texte;
}

/** Barres d'onde, animées pendant l'écoute et l'enregistrement. */
export function onde(actif, couleur = 'var(--vif)') {
  const o = $('onde');
  if (!o.dataset.pret) {
    o.innerHTML = Array.from({ length: 13 }, (_, i) =>
      `<i style="--d:${(i * 0.07).toFixed(2)}s"></i>`).join('');
    o.dataset.pret = '1';
  }
  o.style.setProperty('--oc', couleur);
  o.classList.toggle('bat', !!actif);
}

/** Compte à rebours plein écran. Rend une promesse qui tient jusqu'à zéro. */
export async function compteARebours(n) {
  const el = $('compte');
  el.hidden = false;
  for (let i = n; i > 0; i--) {
    el.textContent = String(i);
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    await sleep(700);
  }
  el.textContent = '!';
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  await sleep(320);
  el.hidden = true;
}

export function vumetre(actif) {
  $('vu').hidden = !actif;
  if (!actif) $('vu-barre').style.width = '0%';
}

export function niveau(v) {
  // Racine carrée : l'oreille est logarithmique, une barre linéaire semble
  // toujours à plat.
  const pct = Math.min(100, Math.sqrt(Math.min(1, v * 6)) * 100);
  $('vu-barre').style.width = `${pct}%`;
  $('vu-barre').classList.toggle('fort', pct > 88);
}

/* ------------------------------------------------------------------ */
/* Le tableau                                                          */
/* ------------------------------------------------------------------ */

export function tableau(v, { surligne = null } = {}) {
  const host = $('tableau');
  const html = v.joueurs.map((j, i) => {
    const sab = j.sabotage ? SABOTAGES[j.sabotage] : null;
    const p = j.prise;
    const cls = ['jr', i === v.viewer ? 'moi' : '', surligne === i ? 'actif' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}">
      <span class="jr-nom">${esc(j.name)}${i === v.viewer ? ' <u>vous</u>' : ''}</span>
      <span class="jr-etat">${etatJoueur(v, j, p, sab)}</span>
      <span class="jr-score">${j.score}</span>
    </div>`;
  }).join('');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
}

function etatJoueur(v, j, p, sab) {
  if (sab) return `<b class="sab">${sab.glyph} ${sab.label}</b>`;
  if (v.phase === PHASE.ENREGISTREMENT) return j.aDepose ? '✓ prise déposée' : '…';
  if (p) {
    if (p.absente) return '<i class="rate">pas de prise</i>';
    return `<b class="note">+${p.note}</b>`;
  }
  if (v.phase === PHASE.ROUE) return j.aTourne ? 'a joué la roue' : '…';
  return '';
}

/* ------------------------------------------------------------------ */
/* Les commandes                                                       */
/* ------------------------------------------------------------------ */

let onAction = () => {};
export function bindActions(fn) { onAction = fn; }

/** @param {Array<{id:string,label:string,cls?:string,off?:boolean}>} boutons */
export function actions(boutons) {
  const host = $('actions');
  host.innerHTML = boutons.map((b) =>
    `<button class="btn ${b.cls || 'btn-go'}${b.off ? ' off' : ''}" data-act="${b.id}"
      ${b.off ? 'disabled' : ''}>${esc(b.label)}</button>`).join('');
}

$('actions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && !b.disabled) onAction(b.dataset.act);
});

/* ------------------------------------------------------------------ */
/* Les notes                                                           */
/* ------------------------------------------------------------------ */

/** Détail d'une note, dimension par dimension. */
export function detailNote(p) {
  if (!p || p.absente) return '<p class="pick-sub">Aucune prise déposée.</p>';
  const ligne = (label, val, poids) => {
    if (val === null) {
      return `<div class="dim"><b>${label}</b><span class="dim-na">sans objet</span></div>`;
    }
    return `<div class="dim">
      <b>${label}</b>
      <span class="dim-bar"><i style="width:${val}%"></i></span>
      <span class="dim-val">${val}</span>
      <u>${poids} %</u>
    </div>`;
  };
  return `<div class="dims">
    ${ligne('Mélodie', p.melodie, POIDS.melodie)}
    ${ligne('Rythme', p.rythme, POIDS.rythme)}
    ${ligne('Attaques', p.attaques, POIDS.attaques)}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* La roue                                                             */
/* ------------------------------------------------------------------ */

/** Anime la roue et s'arrête sur `resultat`. */
export async function tournerRoue(resultat) {
  const scene = $('roue-scene');
  const n = CASES.length;
  const i = CASES.findIndex((c) => c.key === resultat.key);

  scene.innerHTML = `<div class="roue-fenetre"><div class="roue-bande" id="roue-bande">`
    + Array.from({ length: 4 }, () => CASES.map((c) =>
      `<span class="roue-case" style="--cc:${c.color}">${c.glyph}<b>${esc(c.label)}</b></span>`
    ).join('')).join('')
    + `</div></div><div class="roue-fleche">▼</div>`;

  const bande = $('roue-bande');
  const large = 118;          // doit correspondre au CSS
  const cible = (n * 2 + i) * large;
  bande.style.transition = 'none';
  bande.style.transform = 'translateX(0)';
  void bande.offsetWidth;
  bande.style.transition = 'transform 2.4s cubic-bezier(.16,.9,.24,1)';
  bande.style.transform = `translateX(calc(50% - ${cible + large / 2}px))`;
  await sleep(2600);
}

export function ouvrirRoue(titre, texte) {
  $('roue-titre').textContent = titre;
  $('roue-dit').textContent = texte || '';
  $('cible-list').hidden = true;
  $('ov-roue').hidden = false;
}

export function fermerRoue() { $('ov-roue').hidden = true; }

export function roueActions(boutons) {
  $('roue-actions').innerHTML = boutons.map((b) =>
    `<button class="btn ${b.cls || 'btn-go'}" data-act="${b.id}">${esc(b.label)}</button>`).join('');
}

$('roue-actions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b) onAction(b.dataset.act);
});

/** Choix de la victime d'un sabotage. */
export function choisirCible(v, sabotage) {
  const s = SABOTAGES[sabotage];
  $('roue-dit').textContent = `${s.glyph} ${s.label} — sur qui ?`;
  const list = $('cible-list');
  list.hidden = false;
  list.innerHTML = v.joueurs
    .filter((_, i) => i !== v.viewer)
    .map((j) => `<button class="cible" data-cible="${esc(j.id)}">
      <b>${esc(j.name)}</b><span>${j.score} pts</span></button>`).join('');
  $('roue-actions').innerHTML = '';
}

$('cible-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cible]');
  if (!b) return;
  // La liste se referme AVANT de transmettre : sans cela elle reste à
  // l'écran, et l'on peut désigner une seconde victime alors que le
  // sabotage est déjà parti.
  $('cible-list').hidden = true;
  onAction(`cible:${b.dataset.cible}`);
});

/* ------------------------------------------------------------------ */
/* Fin                                                                 */
/* ------------------------------------------------------------------ */

export function fin(v, { onMenu, onAgain }) {
  const tri = [...v.joueurs].sort((a, b) => b.score - a.score);
  const moi = v.joueurs[v.viewer];
  const gagne = tri[0] && tri[0].id === moi.id;

  $('end-mark').textContent = gagne ? '🏆' : (tri[0].score === moi.score ? '🤝' : '🙉');
  const t = $('end-title');
  t.className = `end-title${gagne ? '' : ' lost'}`;
  t.textContent = gagne ? 'VOUS GAGNEZ' : (tri[0].score === moi.score ? 'ÉGALITÉ' : 'PERDU');
  $('end-sub').textContent = gagne
    ? `${moi.score} points en ${v.manches} manches.`
    : `${esc(tri[0].name)} l'emporte avec ${tri[0].score} points.`;

  $('podium').innerHTML = tri.map((j, i) => `<div class="pod${j.id === moi.id ? ' moi' : ''}">
    <span class="pod-rang">${i + 1}</span>
    <span class="pod-nom">${esc(j.name)}</span>
    <span class="pod-score">${j.score}</span>
  </div>`).join('');

  $('b-end-menu').onclick = onMenu;
  $('b-end-again').onclick = onAgain;
  $('ov-fin').hidden = false;
}

export function fermerFin() { $('ov-fin').hidden = true; }

/* ------------------------------------------------------------------ */
/* Le catalogue de sons                                                */
/* ------------------------------------------------------------------ */

export function catalogue() {
  $('sons-grid').innerHTML = SONS.map((s) => {
    const f = FAMILLES[s.famille];
    return `<button class="son-card" data-son="${s.id}" style="--fc:${f.color}">
      <span class="son-g">${s.glyph}</span>
      <b>${esc(s.nom)}</b>
      <span class="son-fam">${f.glyph} ${f.label}</span>
      <span class="son-meta">${s.attaques} · ${dureeDe(s).toFixed(1)} s</span>
    </button>`;
  }).join('');
}

$('sons-grid').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-son]');
  if (!b) return;
  b.classList.add('joue');
  const son = getSon(b.dataset.son);
  await audio.jouer(rendre(son, audio.SR), audio.SR);
  b.classList.remove('joue');
});
