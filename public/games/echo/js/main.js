/**
 * ÉCHO — navigation et branchement des deux modes.
 */

import { NIVEAUX, NIVEAU_KEYS } from '../../../shared/mimic/bots.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as regles from './regles.js';
import * as solo from './offline.js';
import * as net from './online.js';

const $ = (id) => document.getElementById(id);

const prefs = { name: '', nb: 2, niveau: 'correct' };
let mode = null;

function loadPrefs() {
  try {
    const raw = localStorage.getItem('echo.prefs');
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch { /* premier passage */ }
  if (!NIVEAUX[prefs.niveau]) prefs.niveau = 'correct';
  prefs.nb = Math.max(1, Math.min(4, Number(prefs.nb) || 2));
}
function savePrefs() {
  try { localStorage.setItem('echo.prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
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

function renderNiveaux() {
  $('opt-niveau').innerHTML = NIVEAU_KEYS.map((k) => {
    const n = NIVEAUX[k];
    return `<button class="chip${prefs.niveau === k ? ' is-on' : ''}" data-val="${k}"
      role="radio" aria-checked="${prefs.niveau === k}" title="${ui.esc(n.blurb)}">${n.label}</button>`;
  }).join('');
}

function setChips(groupe, val) {
  $(groupe).querySelectorAll('.chip').forEach((c) => {
    const on = c.dataset.val === String(val);
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-checked', String(on));
  });
}

function ouvrirSolo() {
  mode = 'solo';
  renderNiveaux();
  setChips('opt-nb', prefs.nb);
  ui.montrer('setup');
}

function lancerSolo() {
  solo.demarrer({
    nb: prefs.nb,
    niveau: prefs.niveau,
    onExit: retourMenu,
    onAgain: lancerSolo,
  });
}

function retourMenu() {
  solo.arreter();
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
  net.connecter({ name: prefs.name || 'Voix' });
  ui.montrer('online');
}

net.ecouter('statut', (s) => {
  const el = $('net-status');
  const dit = {
    connexion: ['Connexion…', ''],
    connecte: ['Connecté.', 'ok'],
    perdu: ['Connexion perdue. Nouvelle tentative…', 'err'],
    injoignable: ['Serveur injoignable. Le mode solo, lui, marche sans réseau.', 'err'],
  }[s] || ['', ''];
  el.textContent = dit[0];
  el.className = `pick-sub${dit[1] ? ` ${dit[1]}` : ''}`;
});

net.ecouter('salon', (r) => {
  $('net-gate').hidden = true;
  $('net-room').hidden = false;
  $('room-code').textContent = r.code;
  const moi = net.moi();
  $('net-players').innerHTML = r.joueurs.map((j) => `<div class="np">
    <b>${ui.esc(j.name)}</b>${j.id === r.hostId ? '<span class="np-hote">hôte</span>' : ''}
    ${j.id === moi ? '<span class="np-moi">vous</span>' : ''}</div>`).join('');
  $('b-launch').hidden = r.hostId !== moi;
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
    savePrefs(); setChips('opt-nb', prefs.nb);
  });

  $('opt-niveau').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    prefs.niveau = c.dataset.val;
    savePrefs(); renderNiveaux();
  });

  $('b-start').addEventListener('click', lancerSolo);
  $('b-quit').addEventListener('click', retourMenu);

  $('in-name').addEventListener('input', (e) => {
    prefs.name = e.target.value.trim().slice(0, 14);
    savePrefs();
  });
  $('b-create').addEventListener('click', () => net.creer(prefs.name || 'Voix'));
  $('b-join').addEventListener('click', () => {
    const code = $('in-code').value.trim().toUpperCase();
    if (code.length < 4) return ui.toast('Il faut les quatre lettres du code.');
    net.rejoindre(code, prefs.name || 'Voix');
  });
  $('b-leave').addEventListener('click', () => { net.quitterSalon(); });
  $('b-launch').addEventListener('click', () => net.lancer());
  $('room-code').addEventListener('click', copierCode);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const id of ['ov-roue', 'ov-sons', 'ov-rules']) {
      if (!$(id).hidden && id !== 'ov-roue') { $(id).hidden = true; return; }
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
