/**
 * ÉCHO — navigation et branchement des trois modes.
 */

import { NIVEAUX, NIVEAU_KEYS } from '../../../shared/mimic/bots.js';
import {
  CHOIX_MANCHES, CHOIX_DUREES, MANCHES, DUREE_PRISE, JOUEURS_MAX, TOUR, nettoyerReglages,
} from '../../../shared/mimic/partie.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as regles from './regles.js';
import * as local from './offline.js';
import * as net from './online.js';
import { bonhomme, prendrePhoto, photoValide, COULEURS } from './avatars.js';

const $ = (id) => document.getElementById(id);

const prefs = {
  name: '',
  photo: null,
  nb: 2,
  niveau: 'correct',
  manches: MANCHES,
  duree: DUREE_PRISE,
  tour: TOUR.ENSEMBLE,
  soiree: [],          // [{ name, photo }]
};
let mode = null;

function loadPrefs() {
  try {
    const raw = localStorage.getItem('echo.prefs');
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch { /* premier passage */ }
  if (!NIVEAUX[prefs.niveau]) prefs.niveau = 'correct';
  prefs.nb = Math.max(1, Math.min(JOUEURS_MAX - 1, Number(prefs.nb) || 2));
  Object.assign(prefs, nettoyerReglages(prefs));
  if (!photoValide(prefs.photo)) prefs.photo = null;
  if (!Array.isArray(prefs.soiree)) prefs.soiree = [];
  prefs.soiree = prefs.soiree.slice(0, JOUEURS_MAX).map((j) => ({
    name: String(j?.name || '').slice(0, 14),
    photo: photoValide(j?.photo) ? j.photo : null,
  }));
}
function savePrefs() {
  try { localStorage.setItem('echo.prefs', JSON.stringify(prefs)); } catch { /* plein ou interdit */ }
}

/* ------------------------------------------------------------------ */
/* Règles                                                              */
/* ------------------------------------------------------------------ */

const TITRES = { manche: 'Comment ça se joue', note: 'Comment on est noté', roue: 'La roue' };
let reglesPretes = false;

function ouvrirRegles() {
  if (!reglesPretes) {
    $('rp-manche').innerHTML = regles.pageManche();
    $('rp-note').innerHTML = regles.pageNote();
    $('rp-roue').innerHTML = regles.pageRoue();
    reglesPretes = true;
  }
  pageRegles('manche');
  $('ov-rules').hidden = false;
}

function pageRegles(nom) {
  for (const t of $('rules-tabs').querySelectorAll('.rtab')) {
    const actif = t.dataset.page === nom;
    t.classList.toggle('is-on', actif);
    t.setAttribute('aria-selected', String(actif));
  }
  for (const k of Object.keys(TITRES)) $(`rp-${k}`).classList.toggle('is-on', k === nom);
  $('rules-titre').textContent = TITRES[nom];
  $('ov-rules').querySelector('.sheet').scrollTop = 0;
}

/* ------------------------------------------------------------------ */
/* Réglages                                                            */
/* ------------------------------------------------------------------ */

const chip = (val, label, on, titre = '') => `<button class="chip${on ? ' is-on' : ''}" data-val="${val}"
  role="radio" aria-checked="${on}"${titre ? ` title="${ui.esc(titre)}"` : ''}>${label}</button>`;

/** Les réglages communs aux trois modes, partout où ils apparaissent. */
const REGLAGES = {
  manches: () => CHOIX_MANCHES.map((n) => chip(n, n, prefs.manches === n)).join(''),
  duree: () => CHOIX_DUREES.map((n) => chip(n, `${n} s`, prefs.duree === n)).join(''),
  tour: () => [
    chip(TOUR.ENSEMBLE, '🎤 Tous ensemble', prefs.tour === TOUR.ENSEMBLE),
    chip(TOUR.CHACUN, '🙋 Chacun son tour', prefs.tour === TOUR.CHACUN),
  ].join(''),
};

function renderReglages() {
  document.querySelectorAll('[data-reglage]').forEach((el) => {
    el.innerHTML = REGLAGES[el.dataset.reglage]();
  });
  $('net-tour-dit').textContent = prefs.tour === TOUR.CHACUN
    ? 'Pour jouer dans la même pièce : les enregistrements se font l\'un après l\'autre, sinon chaque micro capte les voisins.'
    : 'Chacun chez soi : tout le monde enregistre en même temps, c\'est plus rapide.';
}

function renderNiveaux() {
  $('opt-niveau').innerHTML = NIVEAU_KEYS.map((k) =>
    chip(k, NIVEAUX[k].label, prefs.niveau === k, NIVEAUX[k].blurb)).join('');
  $('opt-nb').innerHTML = Array.from({ length: JOUEURS_MAX - 1 }, (_, i) =>
    chip(i + 1, i + 1, prefs.nb === i + 1)).join('');
}

function renderMaTete() {
  const moi = { name: prefs.name || 'Vous', photo: prefs.photo };
  for (const id of ['b-ma-tete', 'b-ma-tete-net']) {
    $(id).innerHTML = bonhomme(moi, { couleur: COULEURS[0] }) + '<span class="tete-cam">📸</span>';
  }
}

async function changerMaTete() {
  const p = await prendrePhoto({ titre: 'Votre tête', dejaUne: !!prefs.photo });
  if (p === undefined) return;
  prefs.photo = p;
  savePrefs();
  renderMaTete();
  if (mode === 'online') net.changerPhoto(prefs.photo);
}

/* ------------------------------------------------------------------ */
/* Contre la machine                                                   */
/* ------------------------------------------------------------------ */

function ouvrirSolo() {
  mode = 'solo';
  renderNiveaux();
  renderReglages();
  renderMaTete();
  ui.montrer('setup');
}

function lancerSolo() {
  local.demarrer({
    joueurs: [{ name: 'Vous', photo: prefs.photo }],
    nb: prefs.nb,
    niveau: prefs.niveau,
    reglages: { manches: prefs.manches, duree: prefs.duree },
    onExit: retourMenu,
    onAgain: lancerSolo,
  });
}

/* ------------------------------------------------------------------ */
/* Soirée : plusieurs joueurs, un seul appareil                        */
/* ------------------------------------------------------------------ */

function ouvrirSoiree() {
  mode = 'soiree';
  while (prefs.soiree.length < 2) prefs.soiree.push({ name: '', photo: null });
  renderReglages();
  renderSoiree();
  ui.montrer('soiree');
}

function renderSoiree() {
  const l = prefs.soiree;
  $('soiree-compte').textContent = `· ${l.length} / ${JOUEURS_MAX}`;
  $('soiree-liste').innerHTML = l.map((j, i) => `<div class="tr">
    <button class="tete-btn" data-photo="${i}" title="Photo">
      ${bonhomme({ name: j.name || String(i + 1), photo: j.photo }, { couleur: COULEURS[i % COULEURS.length] })}
      <span class="tete-cam">📸</span>
    </button>
    <input class="field" data-nom="${i}" maxlength="14" value="${ui.esc(j.name)}"
      placeholder="Joueur ${i + 1}" autocomplete="off">
    <button class="tr-x" data-retirer="${i}" title="Retirer"${l.length <= 2 ? ' disabled' : ''}>✕</button>
  </div>`).join('');
  $('b-soiree-ajout').hidden = l.length >= JOUEURS_MAX;
}

function lancerSoiree() {
  const joueurs = prefs.soiree.map((j, i) => ({
    name: (j.name || '').trim() || `Joueur ${i + 1}`,
    photo: j.photo,
  }));
  // Deux joueurs du même nom rendraient le tableau illisible.
  const vus = new Map();
  for (const j of joueurs) {
    const n = (vus.get(j.name) || 0) + 1;
    vus.set(j.name, n);
    if (n > 1) j.name = `${j.name.slice(0, 11)} ${n}`;
  }
  local.demarrer({
    joueurs,
    nb: 0,
    reglages: { manches: prefs.manches, duree: prefs.duree },
    onExit: retourMenu,
    onAgain: lancerSoiree,
  });
}

/* ------------------------------------------------------------------ */

function retourMenu() {
  local.arreter();
  if (mode === 'online') { net.quitterSalon(); net.deconnecter(); }
  mode = null;
  audio.relacherMicro();
  ui.fermerFin();
  ui.montrer('menu');
}

/* ------------------------------------------------------------------ */
/* En ligne                                                            */
/* ------------------------------------------------------------------ */

function ouvrirEnLigne() {
  mode = 'online';
  audio.contexte();
  $('net-gate').hidden = false;
  $('net-room').hidden = true;
  $('in-name').value = prefs.name;
  renderMaTete();
  renderReglages();
  net.connecter({ name: prefs.name || 'Voix', photo: prefs.photo });
  ui.montrer('online');
}

net.ecouter('statut', (s) => {
  const el = $('net-status');
  const dit = {
    connexion: ['Connexion…', ''],
    connecte: ['Connecté.', 'ok'],
    perdu: ['Connexion perdue. Nouvelle tentative…', 'err'],
    injoignable: ['Serveur injoignable. Les modes sur un seul téléphone, eux, marchent sans réseau.', 'err'],
  }[s] || ['', ''];
  el.textContent = dit[0];
  el.className = `pick-sub${dit[1] ? ` ${dit[1]}` : ''}`;
});

net.ecouter('salon', (r) => {
  $('net-gate').hidden = true;
  $('net-room').hidden = false;
  $('room-code').textContent = r.code;
  const moi = net.moi();
  const hote = r.hostId === moi;
  $('net-players').innerHTML = r.joueurs.map((j, i) => `<div class="tr tr-net">
    ${bonhomme(j, { couleur: COULEURS[i % COULEURS.length] })}
    <b>${ui.esc(j.name)}</b>
    ${j.id === r.hostId ? '<span class="np-hote">hôte</span>' : ''}
    ${j.id === moi ? '<span class="np-moi">vous</span>' : ''}
  </div>`).join('');

  // Les réglages sont ceux de l'hôte ; les autres les voient sans les toucher.
  const reg = nettoyerReglages(r.reglages);
  if (hote) {
    Object.assign(prefs, reg);
    renderReglages();
  }
  $('net-opts').hidden = !hote;
  $('net-resume').hidden = hote;
  $('net-resume').textContent = `${reg.tour === TOUR.CHACUN ? '🙋 Chacun son tour' : '🎤 Tous ensemble'}`
    + ` · ${reg.manches} manches · ${reg.duree} s pour imiter`;
  $('b-launch').hidden = !hote;
  $('b-launch').disabled = r.joueurs.length < 2;
});

net.ecouter('erreur', (m) => ui.toast(m, 3000));
net.ecouter('parti', () => { $('net-gate').hidden = false; $('net-room').hidden = true; });

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

function brancher() {
  document.querySelectorAll('[data-go]').forEach((el) =>
    el.addEventListener('click', () => {
      const to = el.dataset.go;
      audio.contexte();
      if (to === 'solo') return ouvrirSolo();
      if (to === 'soiree') return ouvrirSoiree();
      if (to === 'online') return ouvrirEnLigne();
      if (to === 'rules') return ouvrirRegles();
      if (to === 'sons') { ui.catalogue(); $('ov-sons').hidden = false; return; }
      if (to === 'menu') return retourMenu();
      return ui.montrer(to);
    }));

  document.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', () => { $(el.dataset.close).hidden = true; }));

  $('rules-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.rtab');
    if (t) pageRegles(t.dataset.page);
  });

  $('opt-nb').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    prefs.nb = Number(c.dataset.val);
    savePrefs(); renderNiveaux();
  });

  $('opt-niveau').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    prefs.niveau = c.dataset.val;
    savePrefs(); renderNiveaux();
  });

  // Tous les groupes de réglages, quel que soit l'écran.
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-reglage] .chip');
    if (!c) return;
    const cle = c.closest('[data-reglage]').dataset.reglage;
    prefs[cle] = cle === 'tour' ? c.dataset.val : Number(c.dataset.val);
    Object.assign(prefs, nettoyerReglages(prefs));
    savePrefs();
    renderReglages();
    if (mode === 'online') {
      net.reglages({ manches: prefs.manches, duree: prefs.duree, tour: prefs.tour });
    }
  });

  $('b-start').addEventListener('click', lancerSolo);
  $('b-quit').addEventListener('click', retourMenu);
  $('b-ma-tete').addEventListener('click', changerMaTete);
  $('b-ma-tete-net').addEventListener('click', changerMaTete);

  // Soirée
  $('b-soiree-ajout').addEventListener('click', () => {
    if (prefs.soiree.length >= JOUEURS_MAX) return;
    prefs.soiree.push({ name: '', photo: null });
    savePrefs(); renderSoiree();
    const champs = $('soiree-liste').querySelectorAll('[data-nom]');
    champs[champs.length - 1]?.focus();
  });
  $('soiree-liste').addEventListener('input', (e) => {
    const i = e.target.dataset.nom;
    if (i === undefined) return;
    prefs.soiree[i].name = e.target.value.slice(0, 14);
    savePrefs();
  });
  $('soiree-liste').addEventListener('click', async (e) => {
    const x = e.target.closest('[data-retirer]');
    if (x && prefs.soiree.length > 2) {
      prefs.soiree.splice(Number(x.dataset.retirer), 1);
      savePrefs(); renderSoiree();
      return;
    }
    const b = e.target.closest('[data-photo]');
    if (!b) return;
    const i = Number(b.dataset.photo);
    const j = prefs.soiree[i];
    const p = await prendrePhoto({ titre: `La tête de ${j.name || `Joueur ${i + 1}`}`, dejaUne: !!j.photo });
    if (p === undefined) return;
    j.photo = p;
    savePrefs(); renderSoiree();
  });
  $('b-soiree-go').addEventListener('click', lancerSoiree);

  // En ligne
  $('in-name').addEventListener('input', (e) => {
    prefs.name = e.target.value.trim().slice(0, 14);
    savePrefs();
    renderMaTete();
  });
  $('b-create').addEventListener('click', () => net.creer(prefs.name || 'Voix', prefs.photo,
    { manches: prefs.manches, duree: prefs.duree, tour: prefs.tour }));
  $('b-join').addEventListener('click', () => {
    const code = $('in-code').value.trim().toUpperCase();
    if (code.length < 4) return ui.toast('Il faut les quatre lettres du code.');
    net.rejoindre(code, prefs.name || 'Voix', prefs.photo);
  });
  $('b-leave').addEventListener('click', () => { net.quitterSalon(); });
  $('b-launch').addEventListener('click', () => net.lancer());
  $('room-code').addEventListener('click', copierCode);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const id of ['ov-sons', 'ov-rules']) {
      if (!$(id).hidden) { $(id).hidden = true; return; }
    }
  });
}

async function copierCode() {
  const code = $('room-code').textContent.trim();
  if (!code || code === '····') return;
  try {
    await navigator.clipboard.writeText(code);
    ui.toast('Code copié.');
  } catch { ui.toast(code); }
}

loadPrefs();
brancher();

// Le service worker n'est pas indispensable au jeu : s'il échoue, on joue
// quand même.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* tant pis */ });
  });
}
