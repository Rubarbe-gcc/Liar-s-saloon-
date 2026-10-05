/**
 * ÉCHO — rendu.
 *
 * Le jeu se joue à l'oreille, mais l'écran doit dire à chaque instant ce
 * qu'on attend de vous : c'est le seul moyen de ne pas rater sa prise, qui ne
 * se rejoue pas.
 */

import { SONS, getSon, FAMILLES, FAMILLE_KEYS, rendre, dureeDe } from '../../../shared/mimic/sons.js';
import { CASES, SABOTAGES, PHASE } from '../../../shared/mimic/partie.js';
import { POIDS } from '../../../shared/mimic/analyse.js';
import { bonhomme, COULEURS } from './avatars.js';
import * as audio from './audio.js';
import * as succes from '../../../shared/succes.js';

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
/* Les visages                                                         */
/* ------------------------------------------------------------------ */

/**
 * Photo ou trogne de chaque joueur, par identifiant. Elles ne transitent pas
 * avec chaque état de partie : on les apprend une fois, au vestiaire.
 */
const visages = new Map();
export function definirVisages(liste) {
  visages.clear();
  for (const j of liste) visages.set(j.id, { photo: j.photo || null, tete: j.tete || null });
}
const visageDe = (j) => ({ name: j.name, ...(visages.get(j.id) || {}) });

/** Le bonhomme d'un joueur de la vue, à sa couleur de place. */
export function bonhommeDe(v, i, o = {}) {
  const j = v.joueurs[i];
  return bonhomme(visageDe(j), { couleur: COULEURS[i % COULEURS.length], ...o });
}

/**
 * La vedette : un grand bonhomme au milieu de la scène, pour dire à qui c'est
 * le tour — de chanter, d'être réécouté, de tourner la roue.
 */
export function vedette(v, i, cls = '') {
  const el = $('vedette');
  if (v === null || i === null || i === undefined) { el.hidden = true; el.innerHTML = ''; return; }
  const html = bonhommeDe(v, i, { cls: `grand ${cls}` });
  if (el.dataset.sig !== html) { el.dataset.sig = html; el.innerHTML = html; }
  el.hidden = false;
}

/* ------------------------------------------------------------------ */
/* Le tableau                                                          */
/* ------------------------------------------------------------------ */

/**
 * @param {object} v  la vue
 * @param {{surligne?:number|null, chante?:boolean, sansMoi?:boolean}} [o]
 *   `sansMoi` : partie à plusieurs sur un seul appareil, où « vous » ne
 *   désigne personne en particulier.
 */
export function tableau(v, { surligne = null, chante = false, sansMoi = false } = {}) {
  const host = $('tableau');
  // Jusqu'à quatre, tout le monde sur une ligne ; au-delà, quatre par ligne.
  host.style.setProperty('--cols', Math.min(4, v.joueurs.length));
  host.classList.toggle('nombreux', v.joueurs.length > 4);
  const enScene = surligne ?? v.enregistreur ?? null;
  const html = v.joueurs.map((j, i) => {
    const sab = j.sabotage ? SABOTAGES[j.sabotage] : null;
    const p = j.prise;
    const moi = !sansMoi && i === v.viewer;
    const etiquette = moi && j.name !== 'Vous';
    const cls = ['jr', moi ? 'moi' : '', enScene === i ? 'actif' : ''].filter(Boolean).join(' ');
    const bh = [
      enScene === i && (chante || v.enregistreur === i) ? 'chante' : '',
      sab ? 'sabote' : '',
      v.phase === PHASE.FIN && v.vainqueur === j.id ? 'gagne' : '',
    ].filter(Boolean).join(' ');
    return `<div class="${cls}">
      ${bonhommeDe(v, i, { cls: bh, badge: sab ? sab.glyph : '' })}
      <span class="jr-nom">${esc(j.name)}${etiquette ? ' <u>vous</u>' : ''}</span>
      <span class="jr-etat">${etatJoueur(v, j, p, sab, i)}</span>
      <span class="jr-score">${j.score}</span>
    </div>`;
  }).join('');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
}

function etatJoueur(v, j, p, sab, i) {
  if (sab) return `<b class="sab">${sab.label}</b>`;
  if (v.phase === PHASE.ENREGISTREMENT) {
    if (j.aDepose) return '✓ prise';
    if (v.enregistreur === i) return '<b class="sab">🎤 en scène</b>';
    return v.enregistreur !== null && !j.isBot ? 'attend' : '…';
  }
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
    .map((j, i) => ({ j, i }))
    .filter(({ i }) => i !== v.viewer)
    .map(({ j, i }) => `<button class="cible" data-cible="${esc(j.id)}">
      ${bonhommeDe(v, i)}<b>${esc(j.name)}</b><span>${j.score} pts</span></button>`).join('');
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

/**
 * @param {object} v
 * @param {{onMenu:Function, onAgain:Function, sansMoi?:boolean}} o
 *   `sansMoi` : partie à plusieurs sur un seul appareil — on annonce le nom
 *   du vainqueur plutôt que « vous gagnez ».
 */
export function fin(v, { onMenu, onAgain, sansMoi = false }) {
  const tri = v.joueurs.map((j, i) => ({ j, i })).sort((a, b) => b.j.score - a.j.score);
  const moi = v.joueurs[v.viewer];
  if (!sansMoi && moi) {
    succes.debloquer('echo-partie');
    if (moi.score >= tri[0].j.score) succes.debloquer('echo-victoire');
  }
  const premier = tri[0].j;
  const exAequo = tri.length > 1 && tri[1].j.score === premier.score;
  const t = $('end-title');

  if (sansMoi) {
    $('end-mark').innerHTML = exAequo ? '🤝' : bonhommeDe(v, tri[0].i, { cls: 'grand gagne' });
    t.className = 'end-title';
    t.textContent = exAequo ? 'ÉGALITÉ' : `${premier.name.toUpperCase()} GAGNE`;
    $('end-sub').textContent = `${premier.score} points en ${v.manches} manches.`;
  } else {
    const gagne = premier.id === moi.id && !exAequo;
    const egal = exAequo && premier.score === moi.score;
    $('end-mark').innerHTML = gagne ? bonhommeDe(v, v.viewer, { cls: 'grand gagne' }) : (egal ? '🤝' : '🙉');
    t.className = `end-title${gagne || egal ? '' : ' lost'}`;
    t.textContent = gagne ? 'VOUS GAGNEZ' : (egal ? 'ÉGALITÉ' : 'PERDU');
    $('end-sub').textContent = gagne
      ? `${moi.score} points en ${v.manches} manches.`
      : `${premier.name} l'emporte avec ${premier.score} points.`;
  }

  $('podium').innerHTML = tri.map(({ j, i }, rang) => `<div class="pod${!sansMoi && j.id === moi.id ? ' moi' : ''}">
    <span class="pod-rang">${['🥇', '🥈', '🥉'][rang] || rang + 1}</span>
    ${bonhommeDe(v, i, { cls: rang === 0 ? 'gagne' : '' })}
    <span class="pod-nom">${esc(j.name)}</span>
    <span class="pod-score">${j.score}</span>
  </div>`).join('');

  $('b-end-menu').onclick = onMenu;
  $('b-end-again').onclick = onAgain;
  $('ov-fin').hidden = false;
  confettis();
}

/** Une pluie de confettis, pour l'écran de fin. */
function confettis() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = $('confettis');
  host.innerHTML = Array.from({ length: 46 }, (_, k) => {
    const c = COULEURS[k % COULEURS.length];
    return `<i style="--x:${Math.random() * 100}vw;--d:${(Math.random() * 1.2).toFixed(2)}s;`
      + `--r:${Math.round(Math.random() * 720 - 360)}deg;--c:${c};--t:${(2.4 + Math.random() * 1.6).toFixed(2)}s"></i>`;
  }).join('');
  host.hidden = false;
  setTimeout(() => { host.hidden = true; host.innerHTML = ''; }, 4400);
}

export function fermerFin() { $('ov-fin').hidden = true; }

/* ------------------------------------------------------------------ */
/* Le catalogue de sons                                                */
/* ------------------------------------------------------------------ */

export function catalogue() {
  // Le compte se lit dans les données. Écrit en dur dans la page, il
  // redevenait faux au premier son ajouté.
  $('sons-titre').textContent = `Les ${SONS.length} sons`;
  $('sons-grid').innerHTML = FAMILLE_KEYS.map((k) => {
    const f = FAMILLES[k];
    const cartes = SONS.filter((s) => s.famille === k).map((s) => `<button class="son-card" data-son="${s.id}" style="--fc:${f.color}">
      <span class="son-g">${s.glyph}</span>
      <b>${esc(s.nom)}</b>
      <span class="son-meta">${s.attaques} · ${dureeDe(s).toFixed(1)} s</span>
    </button>`).join('');
    return `<h3 class="son-famille" style="--fc:${f.color}">${f.glyph} ${esc(f.label)}</h3>${cartes}`;
  }).join('');
}

/** Les notes de la manche pour tout le monde, quand plusieurs se partagent l'écran. */
export function notesManche(v) {
  const tri = v.joueurs.map((j, i) => ({ j, i }))
    .sort((a, b) => (b.j.prise?.note || 0) - (a.j.prise?.note || 0));
  return `<div class="nm">${tri.map(({ j, i }, rang) => {
    const p = j.prise;
    const n = p && !p.absente ? p.note : null;
    return `<div class="nm-l${rang === 0 && n ? ' top' : ''}">
      ${bonhommeDe(v, i, { cls: rang === 0 && n ? 'gagne' : '' })}
      <b>${esc(j.name)}</b>
      <span class="nm-bar"><i style="width:${n || 0}%"></i></span>
      <span class="nm-n">${n === null ? '—' : n}</span>
    </div>`;
  }).join('')}</div>`;
}

$('sons-grid').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-son]');
  if (!b) return;
  b.classList.add('joue');
  const son = getSon(b.dataset.son);
  await audio.jouer(rendre(son, audio.SR), audio.SR);
  b.classList.remove('joue');
});
