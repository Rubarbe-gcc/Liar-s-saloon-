/**
 * Point d'entree : navigation entre ecrans, reglages, et branchement des
 * deux controleurs de partie (hors-ligne et en ligne).
 */

import * as ui from './ui.js';
import * as offline from './offline.js';
import * as net from './online.js';
import { sfx, toggle as toggleSound, isEnabled as soundOn, unlock } from './sfx.js';

const $ = (id) => document.getElementById(id);

const AVATARS = ['🤠', '🎩', '🌹', '🪕', '🪭', '⚰️', '💄', '🐎', '🥃', '🍀', '🌵', '🃏', '🎯', '👺', '🦂', '🕯️'];

/* ------------------------------------------------------------------ */
/* Preferences persistees                                              */
/* ------------------------------------------------------------------ */

const prefs = {
  name: '',
  avatar: '🤠',
  bots: 2,
  diff: 'normal',
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem('saloon.prefs');
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch { /* premier passage, ou stockage bloque */ }
  if (!AVATARS.includes(prefs.avatar)) prefs.avatar = '🤠';
}

function savePrefs() {
  try { localStorage.setItem('saloon.prefs', JSON.stringify(prefs)); }
  catch { /* stockage indisponible : on continue sans memoriser */ }
}

/* ------------------------------------------------------------------ */
/* Ecrans                                                              */
/* ------------------------------------------------------------------ */

let current = 'menu';
let mode = null; // 'offline' | 'online'

function show(id) {
  current = id;
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.toggle('is-active', s.id === `screen-${id}`);
  });
}

function goMenu() {
  offline.stop();
  if (mode === 'online') { net.leaveRoom(); net.disconnect(); }
  mode = null;
  ui.resetTable();
  ui.hideEnd();
  show('menu');
}

/* ------------------------------------------------------------------ */
/* Ambiance : poussiere                                                */
/* ------------------------------------------------------------------ */

function spawnDust(n = 26) {
  const host = $('dust');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const m = document.createElement('i');
    m.className = 'mote';
    const size = 1 + Math.random() * 2.6;
    m.style.width = `${size}px`;
    m.style.height = `${size}px`;
    m.style.left = `${Math.random() * 100}%`;
    m.style.top = `${100 + Math.random() * 40}%`;
    m.style.opacity = String(0.15 + Math.random() * 0.45);
    m.style.animationDuration = `${16 + Math.random() * 26}s`;
    m.style.animationDelay = `${-Math.random() * 30}s`;
    m.style.setProperty('--dx', `${(Math.random() * 120 - 60).toFixed(0)}px`);
    frag.appendChild(m);
  }
  host.appendChild(frag);
}

/* ------------------------------------------------------------------ */
/* Formulaires                                                         */
/* ------------------------------------------------------------------ */

function cycleAvatar() {
  const i = AVATARS.indexOf(prefs.avatar);
  prefs.avatar = AVATARS[(i + 1) % AVATARS.length];
  $('pick-avatar').textContent = prefs.avatar;
  $('pick-avatar-net').textContent = prefs.avatar;
  savePrefs();
  sfx.pick();
}

function syncForms() {
  $('in-name').value = prefs.name;
  $('in-name-net').value = prefs.name;
  $('pick-avatar').textContent = prefs.avatar;
  $('pick-avatar-net').textContent = prefs.avatar;

  setChips('opt-bots', String(prefs.bots));
  setChips('opt-diff', prefs.diff);
  $('btn-sound').innerHTML = `<span class="btn-ic">${soundOn() ? '🔊' : '🔇'}</span> Son`;
}

function setChips(groupId, value) {
  $(groupId).querySelectorAll('.chip').forEach((c) => {
    const on = c.dataset.val === value;
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function bindChipGroup(groupId, onPick) {
  $(groupId).addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    setChips(groupId, chip.dataset.val);
    onPick(chip.dataset.val);
    sfx.click();
    savePrefs();
  });
}

function readName(inputId) {
  const v = $(inputId).value.trim().slice(0, 16);
  prefs.name = v;
  savePrefs();
  return v || 'L\'Étranger';
}

/* ------------------------------------------------------------------ */
/* Mode hors-ligne                                                     */
/* ------------------------------------------------------------------ */

async function startOffline() {
  mode = 'offline';
  unlock();
  const me = { name: readName('in-name'), avatar: prefs.avatar };
  $('hud-mode').textContent = 'hors-ligne';
  show('table');
  await offline.start({ me, bots: prefs.bots, level: prefs.diff, onExit: goMenu });
}

document.addEventListener('saloon:replay-offline', () => { startOffline(); });

/* ------------------------------------------------------------------ */
/* Mode en ligne                                                       */
/* ------------------------------------------------------------------ */

function openOnline() {
  mode = 'online';
  unlock();
  showGate(true);
  net.connect({ name: readName('in-name-net'), avatar: prefs.avatar });
  show('online');
}

function showGate(gate) {
  $('online-gate').hidden = !gate;
  $('online-room').hidden = gate;
}

function setStatus(text, cls = '') {
  const el = $('online-status');
  el.textContent = text;
  el.className = `panel-sub${cls ? ` ${cls}` : ''}`;
}

net.on('status', (state, detail) => {
  if (state === 'connecting') setStatus('Connexion au saloon…');
  else if (state === 'online') setStatus('Connecté — prêt à jouer.', 'is-live');
  else if (state === 'offline') setStatus('Connexion perdue. Nouvelle tentative…', 'is-down');
  else if (state === 'unreachable') {
    setStatus('Serveur de jeu injoignable. Le mode hors-ligne, lui, fonctionne sans réseau.', 'is-down');
  }
  else if (state === 'ended') endOnlineGame(detail);
});

net.on('room', (r) => {
  showGate(false);
  $('room-code').textContent = r.code;
  renderSeats(r);
  if (current !== 'online' && current !== 'table') show('online');
});

net.on('begin', () => {
  $('hud-mode').textContent = 'en ligne';
  ui.hideEnd();
  show('table');
});

net.on('left', () => { showGate(true); setStatus('Connecté — prêt à jouer.', 'is-live'); show('online'); });

net.on('error', (msg) => { ui.flashToast(msg, 3000); });

function renderSeats(r) {
  const host = $('seat-list');
  const isHost = r.hostId === net.me();
  host.innerHTML = '';

  r.players.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'seat-item' + (p.id === r.hostId ? ' is-host' : '');
    const tags = [];
    if (p.id === r.hostId) tags.push('<span class="seat-tag">hôte</span>');
    if (p.id === net.me()) tags.push('<span class="seat-tag is-you">vous</span>');
    li.innerHTML = `<span class="seat-av">${p.avatar}</span>`
      + `<span class="seat-name">${escapeHtml(p.name)}</span>${tags.join('')}`;
    host.appendChild(li);
  });

  for (let i = r.players.length; i < r.max; i++) {
    const li = document.createElement('li');
    li.className = 'seat-item seat-empty';
    li.innerHTML = '<span class="seat-av">🪑</span><span class="seat-name">chaise libre</span>';
    host.appendChild(li);
  }

  const enough = r.players.length >= r.min;
  $('btn-launch-room').disabled = !isHost || !enough;
  $('room-note').textContent = !enough
    ? `Il manque ${r.min - r.players.length} joueur(s) — partagez le code.`
    : (isHost ? 'Tout le monde est là : à vous de lancer.' : 'En attente de l\'hôte…');
}

function endOnlineGame(view) {
  ui.showEnd(view, {
    onMenu: () => { ui.hideEnd(); goMenu(); },
    onAgain: () => {
      ui.hideEnd();
      ui.resetTable();
      net.backToLobby();
      show('online');
    },
    againLabel: 'Retour au salon',
  });
}

/* ------------------------------------------------------------------ */
/* Branchements                                                        */
/* ------------------------------------------------------------------ */

function bind() {
  // Navigation declarative
  document.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', () => {
      sfx.click();
      const to = el.dataset.go;
      if (to === 'menu') return goMenu();
      if (to === 'rules') return openRules();
      if (to === 'offline') { unlock(); return show('offline'); }
      if (to === 'online') return openOnline();
      return show(to);
    });
  });

  $('pick-avatar').addEventListener('click', cycleAvatar);
  $('pick-avatar-net').addEventListener('click', cycleAvatar);

  bindChipGroup('opt-bots', (v) => { prefs.bots = Number(v); });
  bindChipGroup('opt-diff', (v) => { prefs.diff = v; });

  $('in-name').addEventListener('input', () => { prefs.name = $('in-name').value; savePrefs(); });
  $('in-name-net').addEventListener('input', () => { prefs.name = $('in-name-net').value; savePrefs(); });

  $('btn-start-offline').addEventListener('click', startOffline);
  $('in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') startOffline(); });

  $('btn-sound').addEventListener('click', () => {
    const on = toggleSound();
    $('btn-sound').innerHTML = `<span class="btn-ic">${on ? '🔊' : '🔇'}</span> Son`;
  });

  // Salon en ligne
  $('btn-create-room').addEventListener('click', () => {
    sfx.click();
    net.createRoom({ name: readName('in-name-net'), avatar: prefs.avatar });
  });

  const doJoin = () => {
    const code = $('in-code').value.trim().toUpperCase();
    if (code.length < 4) return ui.flashToast('Un code fait quatre caractères.');
    sfx.click();
    net.joinRoom(code, { name: readName('in-name-net'), avatar: prefs.avatar });
  };
  $('btn-join-room').addEventListener('click', doJoin);
  $('in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
  $('in-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  $('btn-leave-room').addEventListener('click', () => { sfx.click(); net.leaveRoom(); showGate(true); });
  $('btn-launch-room').addEventListener('click', () => { sfx.click(); net.startMatch(); });

  $('room-code').addEventListener('click', copyCode);

  // Table
  $('btn-quit').addEventListener('click', () => {
    if (confirm('Quitter la partie en cours ?')) goMenu();
  });
  $('btn-rules-ingame').addEventListener('click', openRules);
  $('btn-rules-close').addEventListener('click', closeRules);

  $('ov-rules').addEventListener('click', (e) => { if (e.target.id === 'ov-rules') closeRules(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('ov-rules').hidden) return closeRules();
    }
    // Raccourcis de table
    if (current !== 'table' || !$('ov-rules').hidden) return;
    if (e.key === 'Enter' && !$('btn-play').disabled) $('btn-play').click();
    if ((e.key === 'l' || e.key === 'L') && !$('btn-liar').disabled) $('btn-liar').click();
  });

  // Premier geste : debloque le contexte audio.
  document.addEventListener('pointerdown', unlock, { once: true });
}

function openRules() { $('ov-rules').hidden = false; }
function closeRules() { $('ov-rules').hidden = true; }

async function copyCode() {
  const code = $('room-code').textContent.trim();
  if (!code || code === '····') return;
  const shareUrl = `${location.origin}${location.pathname}?code=${code}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    ui.flashToast('Lien d\'invitation copié.');
  } catch {
    // clipboard indisponible (http, permission refusee) : repli manuel
    try {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      ui.flashToast('Lien d\'invitation copié.');
    } catch {
      ui.flashToast(`Code : ${code}`);
    }
  }
  sfx.click();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------------ */
/* Demarrage                                                           */
/* ------------------------------------------------------------------ */

loadPrefs();
bind();
syncForms();
spawnDust();

// Un lien d'invitation amene directement dans le salon, code pre-rempli.
const invite = new URLSearchParams(location.search).get('code');
if (invite) {
  $('in-code').value = invite.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  openOnline();
  ui.flashToast('Entrez votre nom, puis rejoignez la table.', 3200);
}
