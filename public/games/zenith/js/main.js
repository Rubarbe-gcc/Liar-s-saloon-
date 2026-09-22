/**
 * ZÉNITH — navigation, sélection d'équipe et branchement des deux modes.
 */

import { FIGHTERS, getFighter, ELEMENTS, randomTeam } from '../../../shared/zenith/fighters.js';
import { TEAM_SIZE } from '../../../shared/zenith/battle.js';
import { LEVELS } from '../../../shared/zenith/ai.js';
import * as ui from './ui.js';
import * as solo from './offline.js';
import * as net from './online.js';
import { sfx, toggle as toggleSound, isEnabled as soundOn, unlock } from './sfx.js';

const $ = (id) => document.getElementById(id);

const prefs = { name: '', level: 'guerrier', team: [] };
let mode = null;      // 'solo' | 'online'
let current = 'menu';

/* ------------------------------------------------------------------ */
/* Préférences                                                         */
/* ------------------------------------------------------------------ */

function loadPrefs() {
  try {
    const raw = localStorage.getItem('zenith.prefs');
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch { /* premier passage */ }
  if (!LEVELS[prefs.level]) prefs.level = 'guerrier';
  // Une préférence d'équipe peut référencer un combattant retiré depuis.
  prefs.team = (prefs.team || []).filter((id) => getFighter(id)).slice(0, TEAM_SIZE);
}
function savePrefs() {
  try { localStorage.setItem('zenith.prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Écrans                                                              */
/* ------------------------------------------------------------------ */

function show(id) {
  current = id;
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === `s-${id}`));
}

function goMenu() {
  solo.stop();
  if (mode === 'online') { net.leaveRoom(); net.disconnect(); }
  mode = null;
  ui.hideEnd();
  show('menu');
}

/* ------------------------------------------------------------------ */
/* Sélection d'équipe                                                  */
/* ------------------------------------------------------------------ */

function renderRoster() {
  $('roster').innerHTML = FIGHTERS
    .map((f) => ui.fighterCard(f, { picked: prefs.team.includes(f.id) }))
    .join('');
}

function renderSquad() {
  const host = $('squad');
  let html = '';
  for (let i = 0; i < TEAM_SIZE; i++) {
    const id = prefs.team[i];
    if (!id) { html += '<div class="slot"><span class="slot-empty">emplacement libre</span></div>'; continue; }
    const f = getFighter(id);
    const el = ELEMENTS[f.element];
    html += `<div class="slot filled" style="--el:${el.color}">
      <button class="x" data-drop="${i}" title="Retirer">✕</button>
      <span class="slot-av">${f.avatar}</span>
      <span class="slot-name">${ui.esc(f.name)}</span>
      <span class="slot-el">${el.glyph} ${el.label}</span>
    </div>`;
  }
  host.innerHTML = html;

  const done = prefs.team.length === TEAM_SIZE;
  $('b-fight').disabled = !done;
  const reste = TEAM_SIZE - prefs.team.length;
  $('pick-sub').textContent = done
    ? 'Équipe prête.'
    : (reste === 1 ? 'Encore un combattant.' : `Encore ${reste} combattants.`);
  $('pick-sub').className = `pick-sub${done ? ' ok' : ''}`;

  // En ligne, l'équipe est transmise dès qu'elle est complète.
  if (mode === 'online' && done) net.setTeam(prefs.team);
}

function pick(id) {
  if (prefs.team.includes(id) || prefs.team.length >= TEAM_SIZE) return;
  prefs.team.push(id);
  savePrefs(); sfx.tap(); renderSquad(); renderRoster();
}

function drop(i) {
  prefs.team.splice(i, 1);
  savePrefs(); sfx.tap(); renderSquad(); renderRoster();
}

/* ------------------------------------------------------------------ */
/* Modes                                                               */
/* ------------------------------------------------------------------ */

function openSolo() {
  mode = 'solo';
  unlock();
  renderSquad(); renderRoster();
  setChips('opt-level', prefs.level);
  $('b-fight').textContent = 'Au combat';
  show('team');
}

function launchSolo() {
  if (prefs.team.length !== TEAM_SIZE) return;
  sfx.bell();
  show('fight');
  solo.start({
    team: [...prefs.team],
    level: prefs.level,
    onExit: goMenu,
    onDone: launchSolo,
  });
}

function openOnline() {
  mode = 'online';
  unlock();
  gate(true);
  $('in-name').value = prefs.name;
  net.connect({ name: prefs.name || 'Challenger' });
  show('online');
}

function gate(open) {
  $('net-gate').hidden = !open;
  $('net-room').hidden = open;
}

function netStatus(text, cls = '') {
  const el = $('net-status');
  el.textContent = text;
  el.className = `pick-sub${cls ? ` ${cls}` : ''}`;
}

net.listen('status', (s, detail) => {
  if (s === 'connecting') netStatus('Connexion…');
  else if (s === 'online') netStatus('Connecté.', 'ok');
  else if (s === 'offline') netStatus('Connexion perdue. Nouvelle tentative…', 'err');
  else if (s === 'unreachable') netStatus('Serveur injoignable. Le mode solo, lui, fonctionne sans réseau.', 'err');
});

net.listen('room', (r) => {
  gate(false);
  $('room-code').textContent = r.code;

  const isHost = r.hostId === net.me();
  $('net-players').innerHTML = r.players.map((p) => `<li class="${p.id === net.me() ? 'you' : ''}">
      <span>${p.ready ? '✅' : '⏳'}</span><span>${ui.esc(p.name)}</span>
      ${p.id === r.hostId ? '<span class="tag">hôte</span>' : ''}
    </li>`).join('')
    + (r.players.length < r.max ? '<li class="empty"><span>🪑</span><span>en attente d\'un adversaire</span></li>' : '');

  const bothReady = r.players.length === r.max && r.players.every((p) => p.ready);
  $('b-launch').disabled = !isHost || !bothReady;
  $('net-note').textContent = r.players.length < r.max
    ? 'Partagez le code pour qu\'un adversaire vous rejoigne.'
    : (bothReady
      ? (isHost ? 'Tout le monde est prêt : lancez le combat.' : 'En attente de l\'hôte…')
      : 'Chacun doit composer son équipe.');

  // L'écran de sélection sert aussi de vestiaire en ligne.
  if (current === 'online' && !prefs.team.length) { /* l'utilisateur choisira */ }
  if (current === 'fight') { /* combat en cours : on ne bouge pas */ }
});

net.listen('begin', () => { sfx.bell(); ui.hideEnd(); show('fight'); });
net.listen('left', () => { gate(true); netStatus('Connecté.', 'ok'); show('online'); });
net.listen('error', (m) => ui.toast(m, 2800));
net.listen('over', (view) => {
  setTimeout(() => ui.showEnd(view, {
    onMenu: () => { ui.hideEnd(); goMenu(); },
    onAgain: () => { ui.hideEnd(); net.backToLobby(); show('online'); },
    againLabel: 'Retour au vestiaire',
  }), 1200);
});

/* ------------------------------------------------------------------ */
/* Liaisons                                                            */
/* ------------------------------------------------------------------ */

function setChips(group, value) {
  $(group).querySelectorAll('.chip').forEach((c) => {
    const on = c.dataset.val === value;
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function bind() {
  document.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => {
    sfx.click();
    const to = el.dataset.go;
    if (to === 'menu') return goMenu();
    if (to === 'solo') return openSolo();
    if (to === 'online') return openOnline();
    if (to === 'roster') { $('codex').innerHTML = FIGHTERS.map(ui.codexCard).join(''); $('ov-roster').hidden = false; return; }
    if (to === 'rules') { $('ov-rules').hidden = false; return; }
    return show(to);
  }));

  document.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', () => { $(el.dataset.close).hidden = true; }));

  $('roster').addEventListener('click', (e) => {
    const b = e.target.closest('.card-f[data-fid]');
    if (b) pick(b.dataset.fid);
  });
  $('squad').addEventListener('click', (e) => {
    const b = e.target.closest('[data-drop]');
    if (b) drop(Number(b.dataset.drop));
  });

  $('b-random').addEventListener('click', () => {
    prefs.team = randomTeam(TEAM_SIZE);
    savePrefs(); sfx.swap(); renderSquad(); renderRoster();
  });

  $('opt-level').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    prefs.level = c.dataset.val;
    setChips('opt-level', prefs.level);
    savePrefs(); sfx.tap();
  });

  $('b-fight').addEventListener('click', () => {
    if (mode === 'online') { net.setTeam(prefs.team); show('online'); return; }
    launchSolo();
  });

  $('b-sound').addEventListener('click', () => {
    const on = toggleSound();
    $('b-sound').innerHTML = `<span class="bi">${on ? '🔊' : '🔇'}</span> Son`;
  });

  // Réseau
  $('in-name').addEventListener('input', () => { prefs.name = $('in-name').value; savePrefs(); });
  $('b-create').addEventListener('click', () => {
    sfx.click();
    net.createRoom({ name: $('in-name').value.trim() || 'Challenger' });
  });
  const join = () => {
    const code = $('in-code').value.trim().toUpperCase();
    if (code.length < 4) return ui.toast('Un code fait quatre caractères.');
    sfx.click();
    net.joinRoom(code, { name: $('in-name').value.trim() || 'Challenger' });
  };
  $('b-join').addEventListener('click', join);
  $('in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  $('in-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  $('b-leave').addEventListener('click', () => { sfx.click(); net.leaveRoom(); gate(true); });
  $('b-launch').addEventListener('click', () => { sfx.click(); net.startMatch(); });
  $('room-code').addEventListener('click', copyCode);

  // Le vestiaire renvoie vers la sélection d'équipe.
  $('net-players').addEventListener('click', () => {
    if (mode !== 'online') return;
    renderSquad(); renderRoster();
    $('b-fight').textContent = 'Valider l\'équipe';
    show('team');
  });

  $('b-quit').addEventListener('click', () => {
    if (confirm('Abandonner le combat ?')) goMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      for (const id of ['ov-swap', 'ov-roster', 'ov-rules']) {
        if (!$(id).hidden) { $(id).hidden = true; return; }
      }
    }
    if (current !== 'fight') return;
    // Raccourcis : 1-4 pour les quatre coups, G pour la garde, C pour changer.
    if (e.key >= '1' && e.key <= '4') {
      const b = document.querySelectorAll('.cmd-move')[Number(e.key) - 1];
      if (b && !b.classList.contains('off')) b.click();
    }
    const touche = e.key.toLowerCase();
    if (touche === 'g') { e.preventDefault(); $('b-guard').click(); }
    if (touche === 'c') { e.preventDefault(); $('b-swap').click(); }
  });

  document.addEventListener('pointerdown', unlock, { once: true });
}

async function copyCode() {
  const code = $('room-code').textContent.trim();
  if (!code || code === '····') return;
  const url = `${location.origin}${location.pathname}?code=${code}`;
  try {
    await navigator.clipboard.writeText(url);
    ui.toast('Invitation copiée.');
  } catch {
    ui.toast(`Code : ${code}`);
  }
  sfx.tap();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[pwa] service worker non enregistré :', err));
  });
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

loadPrefs();
bind();
registerServiceWorker();
$('b-sound').innerHTML = `<span class="bi">${soundOn() ? '🔊' : '🔇'}</span> Son`;

const invite = new URLSearchParams(location.search).get('code');
if (invite) {
  $('in-code').value = invite.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  openOnline();
  ui.toast('Entrez votre nom, puis rejoignez l\'arène.', 3200);
}
