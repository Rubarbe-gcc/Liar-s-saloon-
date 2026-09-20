/**
 * Rendu de la table et mise en scene des evenements.
 *
 * L'interface est pilotee par deux entrees seulement :
 *   - `render(view)`       : dessine l'etat courant ;
 *   - `playEvents(evts,v)` : rejoue une sequence d'evenements, puis rend `v`.
 *
 * Les deux modes de jeu produisent exactement les memes structures, si bien
 * que ce module ignore totalement s'il affiche une partie locale ou distante.
 */

import { CARD_LABEL, CARD_LABEL_ONE, CHAMBERS } from '../../../shared/engine.js';
import { PROFILES } from '../../../shared/ai.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 140) : ms));

/* ------------------------------------------------------------------ */
/* Cartes                                                              */
/* ------------------------------------------------------------------ */

const SUIT = { K: '♠', Q: '♥', A: '♦', J: '✦' };
const RED = new Set(['Q', 'A']);

/** Construit l'element DOM d'une carte. `down` la presente face cachee. */
export function cardEl(code, { down = false, both = false } = {}) {
  const el = document.createElement('div');
  el.className = 'card' + (down ? ' is-down' : '');
  el.dataset.code = code;

  if (!down || both) {
    const front = document.createElement('div');
    front.className = 'card-face card-front'
      + (RED.has(code) ? ' is-red' : '')
      + (code === 'J' ? ' is-joker' : '');
    front.innerHTML =
      `<span class="card-pip tl">${code === 'J' ? 'J' : code}<br>${SUIT[code]}</span>` +
      `<span class="card-glyph">${code === 'J' ? '★' : code}</span>` +
      `<span class="card-pip br">${code === 'J' ? 'J' : code}<br>${SUIT[code]}</span>`;
    el.appendChild(front);
  }
  if (down || both) {
    const back = document.createElement('div');
    back.className = 'card-face card-back';
    el.appendChild(back);
  }
  return el;
}

/* ------------------------------------------------------------------ */
/* Etat du module                                                      */
/* ------------------------------------------------------------------ */

let view = null;          // derniere vue rendue
let picked = [];          // index des cartes selectionnees, dans l'ordre
let onAction = () => {};  // callback vers le controleur
let locked = false;       // vrai pendant les animations
let timerId = null;
// Manche dont la main a deja ete distribuee : evite de rejouer l'animation
// de donne a chaque rafraichissement provoque par un coup adverse.
let dealtRound = -1;

export function bindActions(fn) { onAction = fn; }
export function currentView() { return view; }
export function selection() { return [...picked]; }

const nameOf = (id) => {
  const p = view && view.players.find((x) => x.id === id);
  return p ? p.name : '?';
};
const playerOf = (id) => (view ? view.players.find((x) => x.id === id) : null);

/* ------------------------------------------------------------------ */
/* Rendu principal                                                     */
/* ------------------------------------------------------------------ */

export function render(v) {
  view = v;
  renderOpponents();
  renderFelt();
  renderMe();
  renderTicker();
  renderActions();
}

function renderOpponents() {
  const host = $('opponents');
  const foes = view.players.filter((p) => p.id !== view.viewerId);
  host.innerHTML = '';

  for (const p of foes) {
    const el = document.createElement('div');
    el.className = 'foe';
    el.dataset.pid = p.id;
    if (!p.alive) el.classList.add('is-dead');
    else if (view.turnId === p.id && view.phase === 'playing') el.classList.add('is-turn');
    if (p.alive && !p.connected) el.classList.add('is-gone');

    const profile = p.profile && PROFILES[p.profile];
    const subtitle = profile ? profile.label : (p.connected ? 'en ligne' : 'déconnecté');

    el.innerHTML =
      `<div class="foe-av">${p.avatar}</div>` +
      `<div class="foe-name" title="${escapeAttr(p.name)}">${escapeHtml(p.name)}</div>` +
      `<div class="foe-profile">${escapeHtml(subtitle)}</div>` +
      `<div class="foe-hand">${handChips(p)}</div>` +
      `<div class="cylinder">${chambers(p)}</div>`;
    host.appendChild(el);
  }
}

function handChips(p) {
  if (!p.alive) return '<span class="foe-hand-empty">éliminé</span>';
  if (p.handCount === 0) return '<span class="foe-hand-empty">main vide</span>';
  return '<i class="foe-chip"></i>'.repeat(p.handCount);
}

/** Barillet : chambres usees a gauche, chambres encore possibles a droite. */
function chambers(p) {
  let html = '';
  for (let i = 0; i < CHAMBERS; i++) {
    if (!p.alive && i === p.shotsFired) html += '<i class="cham is-fatal"></i>';
    else if (i < p.shotsFired) html += '<i class="cham is-spent"></i>';
    else html += `<i class="cham is-live${p.chambersLeft === 1 && p.alive ? ' is-hot' : ''}"></i>`;
  }
  return html;
}

function renderFelt() {
  const demand = $('demand-card');
  if (demand.textContent !== CARD_LABEL[view.tableCard]) {
    demand.textContent = CARD_LABEL[view.tableCard];
  }

  // Pile de dos de cartes, plafonnee pour rester lisible.
  const pile = $('pile');
  const shown = Math.min(view.pile, 8);
  if (pile.childElementCount !== shown) {
    pile.innerHTML = shown === 0 ? '<div class="pile-empty"></div>' : '';
    for (let i = 0; i < shown; i++) {
      const c = document.createElement('div');
      c.className = 'pile-card';
      c.style.transform = `rotate(${(i * 37) % 24 - 12}deg) translate(${(i % 3) - 1}px,${-i * 1.5}px)`;
      c.style.animationDelay = `${i * 30}ms`;
      pile.appendChild(c);
    }
  }

  const claim = $('claim');
  if (view.lastPlay) {
    claim.hidden = false;
    claim.innerHTML = `${escapeHtml(nameOf(view.lastPlay.playerId))} annonce `
      + `<b>${view.lastPlay.count} × ${CARD_LABEL_ONE[view.tableCard]}</b>`;
  } else {
    claim.hidden = true;
  }
}

function renderMe() {
  const me = playerOf(view.viewerId);
  if (!me) return;

  $('me-av').textContent = me.avatar;
  $('me-name').textContent = me.name;
  $('me-cylinder').innerHTML = chambers(me);
  $('me-cylinder').title = me.alive
    ? `${me.chambersLeft} chambre(s) — ${me.odds}% de survie au prochain tir`
    : 'Éliminé';

  const hand = $('hand');
  hand.innerHTML = '';
  picked = picked.filter((i) => i < (me.hand ? me.hand.length : 0));

  if (!me.alive) {
    hand.innerHTML = '<div class="hand-empty">Vous observez la fin de la partie.</div>';
    return;
  }
  if (!me.hand || me.hand.length === 0) {
    hand.innerHTML = '<div class="hand-empty">Main vide — vous passez cette manche.</div>';
    return;
  }

  const n = me.hand.length;
  const fresh = dealtRound !== view.round;
  dealtRound = view.round;

  me.hand.forEach((code, i) => {
    const el = cardEl(code);
    // Leger eventail : la main s'incurve autour du centre.
    el.style.setProperty('--tilt', `${(i - (n - 1) / 2) * 3.4}deg`);
    if (fresh) el.style.animationDelay = `${i * 55}ms`;
    else el.style.animation = 'none';
    el.dataset.index = String(i);
    if (picked.includes(i)) {
      el.classList.add('is-picked');
      const badge = document.createElement('span');
      badge.className = 'pick-no';
      badge.textContent = String(picked.indexOf(i) + 1);
      el.appendChild(badge);
    }
    el.addEventListener('click', () => togglePick(i));
    hand.appendChild(el);
  });

  hand.classList.toggle('is-locked', locked || view.turnId !== view.viewerId || view.phase !== 'playing');
}

function togglePick(i) {
  if (locked || view.phase !== 'playing' || view.turnId !== view.viewerId) return;
  const at = picked.indexOf(i);
  if (at >= 0) { picked.splice(at, 1); sfx.unpick(); }
  else {
    if (picked.length >= 3) { flashToast('Trois cartes au maximum.'); return; }
    picked.push(i); sfx.pick();
  }
  renderMe();
  renderActions();
}

function renderTicker() {
  const t = $('ticker');
  const last = view.log && view.log.length ? view.log[view.log.length - 1].text : '';
  if (t.dataset.last === last) return;
  t.dataset.last = last;
  t.innerHTML = `<span>${escapeHtml(last)}</span>`;
}

function renderActions() {
  const me = playerOf(view.viewerId);
  const myTurn = me && me.alive && view.turnId === view.viewerId && view.phase === 'playing';

  const play = $('btn-play');
  const liar = $('btn-liar');

  play.disabled = locked || !myTurn || picked.length === 0;
  $('play-count').textContent = picked.length ? `(${picked.length})` : '';

  const canChallenge = !!view.lastPlay && view.lastPlay.playerId !== view.viewerId;
  liar.disabled = locked || !myTurn || !canChallenge;

  $('hud-round').textContent = `Manche ${view.round}`;

  if (myTurn && !locked) startTimer(); else stopTimer();
}

/* ------------------------------------------------------------------ */
/* Minuteur de tour                                                    */
/* ------------------------------------------------------------------ */

function startTimer() {
  stopTimer();
  if (!view.turnDeadline) return;
  const box = $('timer');
  const arc = $('timer-arc');
  const num = $('timer-n');
  box.hidden = false;

  const tick = () => {
    const left = Math.max(0, view.turnDeadline - Date.now());
    const secs = Math.ceil(left / 1000);
    const frac = Math.max(0, Math.min(1, left / view.turnMs));
    num.textContent = String(secs);
    arc.style.strokeDashoffset = String(100.5 * (1 - frac));
    const urgent = secs <= 5;
    box.classList.toggle('is-urgent', urgent);
    if (urgent && secs > 0 && num.dataset.beeped !== String(secs)) {
      num.dataset.beeped = String(secs);
      sfx.urgent();
    }
    if (left <= 0) stopTimer();
  };
  tick();
  timerId = setInterval(tick, 250);
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  $('timer').hidden = true;
  $('timer').classList.remove('is-urgent');
}

/* ------------------------------------------------------------------ */
/* Sequence d'evenements                                               */
/* ------------------------------------------------------------------ */

/**
 * Rejoue une sequence d'evenements puis affiche l'etat final.
 * @param {Array} events
 * @param {Object} finalView
 */
export async function playEvents(events, finalView) {
  locked = true;
  if (view) { renderActions(); $('hand').classList.add('is-locked'); }

  for (const ev of events) {
    try { await playEvent(ev); }
    catch (err) { console.error('animation', ev.type, err); }
  }

  locked = false;
  render(finalView);
}

async function playEvent(ev) {
  switch (ev.type) {
    case 'newRound':   return animNewRound(ev);
    case 'turn':       return animTurn(ev);
    case 'play':       return animPlay(ev);
    case 'timeout':    return animTimeout(ev);
    case 'challenge':  return animChallenge(ev);
    case 'shot':       return animShot(ev);
    case 'roundEnd':   return animRoundEnd(ev);
    case 'left':       return animLeft(ev);
    case 'gameOver':   return animGameOver(ev);
    default:           return undefined;
  }
}

async function animNewRound(ev) {
  await banner(`Manche ${ev.round}`, 'La table demande', CARD_LABEL[ev.tableCard], 900);
  const demand = $('demand-card');
  demand.textContent = CARD_LABEL[ev.tableCard];
  demand.classList.remove('is-new');
  void demand.offsetWidth; // force le redemarrage de l'animation
  demand.classList.add('is-new');
  $('pile').innerHTML = '<div class="pile-empty"></div>';
  $('claim').hidden = true;
  sfx.deal(5);
  await sleep(260);
}

async function animTurn(ev) {
  document.querySelectorAll('.foe').forEach((el) => {
    el.classList.toggle('is-turn', el.dataset.pid === ev.playerId);
  });
  await sleep(120);
}

async function animPlay(ev) {
  const foe = document.querySelector(`.foe[data-pid="${cssEscape(ev.playerId)}"]`);
  if (foe) {
    bubble(foe, `${ev.count} × ${CARD_LABEL_ONE[ev.tableCard]}`);
    // Retire visuellement les cartes posees de l'eventail adverse.
    const chips = foe.querySelectorAll('.foe-chip');
    for (let i = 0; i < ev.count && chips.length - 1 - i >= 0; i++) {
      chips[chips.length - 1 - i].style.transition = 'opacity .25s, transform .25s';
      chips[chips.length - 1 - i].style.opacity = '0';
      chips[chips.length - 1 - i].style.transform = 'translateY(-22px) scale(.7)';
    }
  }
  sfx.toss(ev.count);
  addToPile(ev.count);

  const claim = $('claim');
  claim.hidden = false;
  claim.innerHTML = `${escapeHtml(nameOf(ev.playerId))} annonce `
    + `<b>${ev.count} × ${CARD_LABEL_ONE[ev.tableCard]}</b>`;

  await sleep(ev.playerId === (view && view.viewerId) ? 340 : 620);
}

function addToPile(n) {
  const pile = $('pile');
  pile.querySelector('.pile-empty')?.remove();
  const base = pile.childElementCount;
  for (let i = 0; i < n && base + i < 8; i++) {
    const c = document.createElement('div');
    c.className = 'pile-card';
    const k = base + i;
    c.style.transform = `rotate(${(k * 37) % 24 - 12}deg) translate(${(k % 3) - 1}px,${-k * 1.5}px)`;
    c.style.animationDelay = `${i * 60}ms`;
    pile.appendChild(c);
  }
}

async function animTimeout(ev) {
  flashToast(`${nameOf(ev.playerId)} a laissé filer le temps.`);
  await sleep(320);
}

async function animLeft(ev) {
  sfx.leave();
  flashToast(`${nameOf(ev.playerId)} quitte la table.`);
  await sleep(480);
}

/** Retournement de la derniere pose, une carte apres l'autre. */
async function animChallenge(ev) {
  const foe = document.querySelector(`.foe[data-pid="${cssEscape(ev.accuserId)}"]`);
  if (foe) bubble(foe, 'MENTEUR !', true);
  sfx.accuse();
  await sleep(560);

  const ov = $('ov-reveal');
  const head = $('reveal-head');
  const box = $('reveal-cards');
  const verdict = $('reveal-verdict');

  head.innerHTML = `<b>${escapeHtml(nameOf(ev.accuserId))}</b> accuse `
    + `<b>${escapeHtml(nameOf(ev.accusedId))}</b> — annonce : `
    + `<b>${ev.cards.length} × ${CARD_LABEL_ONE[ev.tableCard]}</b>`;
  box.innerHTML = '';
  verdict.className = 'reveal-verdict';
  verdict.textContent = '';

  const els = ev.cards.map((code) => {
    const el = cardEl(code, { both: true });
    el.classList.add('is-down');
    box.appendChild(el);
    return el;
  });

  ov.hidden = false;
  await sleep(520);

  for (let i = 0; i < els.length; i++) {
    const code = ev.cards[i];
    const ok = code === ev.tableCard || code === 'J';
    els[i].classList.remove('is-down');
    els[i].classList.add('flipping');
    sfx.flip();
    await sleep(330);
    els[i].classList.add(ok ? 'verdict-ok' : 'verdict-bad');
    await sleep(240);
  }

  await sleep(260);
  verdict.classList.add('show', ev.honest ? 'is-truth' : 'is-lie');
  verdict.textContent = ev.honest
    ? 'La pose était honnête.'
    : 'Mensonge démasqué !';
  await sleep(1500);

  ov.hidden = true;
}

/** Mise en scene de la roulette russe. */
async function animShot(ev) {
  const p = playerOf(ev.playerId);
  const ov = $('ov-roulette');
  const cyl = $('rl-cyl');
  const hammer = $('rl-hammer');
  const result = $('rl-result');

  // Chambres avant le tir : celles deja essayees sont neutralisees.
  const spent = ev.died ? ev.chamber : ev.chamber;
  $('rl-chambers').innerHTML = chamberHoles(spent);
  $('rl-who').innerHTML = `<b>${escapeHtml(nameOf(ev.playerId))}</b><br>porte le canon à sa tempe`;
  const left = ev.died ? CHAMBERS - spent : ev.chambersLeft + 1;
  $('rl-odds').innerHTML = `1 chance sur <b>${left}</b> que la chambre soit chargée`;
  result.className = 'rl-result';
  result.textContent = '';
  hammer.classList.remove('is-cocked');

  ov.hidden = false;
  await sleep(400);

  cyl.classList.remove('is-spinning');
  void cyl.offsetWidth;
  cyl.classList.add('is-spinning');
  sfx.spin();
  await sleep(1500);

  sfx.cock();
  hammer.classList.add('is-cocked');
  sfx.heartbeat(2);
  await sleep(1250);

  if (ev.died) {
    sfx.bang();
    muzzleFlash();
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 520);
    result.classList.add('show', 'is-bang');
    result.textContent = 'BANG.';
    $('rl-chambers').innerHTML = chamberHoles(spent, spent);
    await sleep(1500);
    sfx.knell();
    await sleep(700);
  } else {
    sfx.clickEmpty();
    result.classList.add('show', 'is-click');
    result.textContent = 'Clic.';
    $('rl-chambers').innerHTML = chamberHoles(spent + 1);
    await sleep(1400);
  }

  ov.hidden = true;
  if (p) flashToast(ev.died
    ? `${p.name} est éliminé.`
    : `${p.name} s'en sort — ${ev.chambersLeft} chambre(s) restante(s).`);
  await sleep(260);
}

/** Genere les six chambres du barillet en SVG. */
function chamberHoles(spent, fatal = -1) {
  let out = '';
  for (let i = 0; i < CHAMBERS; i++) {
    const angle = (i / CHAMBERS) * Math.PI * 2 - Math.PI / 2;
    const cx = 100 + Math.cos(angle) * 54;
    const cy = 100 + Math.sin(angle) * 54;
    const cls = i === fatal ? 'rl-hole armed' : (i < spent ? 'rl-hole spent' : 'rl-hole');
    out += `<circle class="${cls}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="17"/>`;
  }
  return out;
}

function muzzleFlash() {
  const f = document.createElement('div');
  f.className = 'muzzle';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 430);
}

async function animRoundEnd(ev) {
  if (ev.reason === 'peace') {
    await banner('Manche blanche', 'Plus personne ne peut surenchérir', 'On redistribue', 1100);
  }
}

async function animGameOver() {
  await sleep(260);
}

/* ------------------------------------------------------------------ */
/* Banniere, bulles, toast                                             */
/* ------------------------------------------------------------------ */

export async function banner(title, kicker = '', sub = '', hold = 1100, blood = false) {
  const ov = $('ov-banner');
  $('banner-kicker').textContent = kicker;
  const t = $('banner-title');
  t.textContent = title;
  t.className = 'banner-title' + (blood ? ' is-blood' : '');
  $('banner-sub').textContent = sub;
  ov.hidden = false;
  sfx.round();
  await sleep(hold);
  ov.hidden = true;
}

function bubble(host, text, liar = false) {
  host.querySelector('.foe-say')?.remove();
  const b = document.createElement('div');
  b.className = 'foe-say' + (liar ? ' is-liar' : '');
  b.textContent = text;
  host.appendChild(b);
  setTimeout(() => b.remove(), liar ? 1400 : 1900);
}

let toastTimer = null;
export function flashToast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ------------------------------------------------------------------ */
/* Ecran de fin                                                        */
/* ------------------------------------------------------------------ */

export function showEnd(v, { onMenu, onAgain, againLabel = 'Rejouer' }) {
  const me = v.players.find((p) => p.id === v.viewerId);
  const winner = v.players.find((p) => p.id === v.winnerId);
  const iWon = winner && me && winner.id === me.id;

  $('end-crown').textContent = iWon ? '👑' : (winner ? '🥃' : '🕯️');
  const title = $('end-title');
  title.className = 'end-title' + (iWon ? '' : ' is-loss');
  title.textContent = iWon ? 'Dernier survivant' : (winner ? `${winner.name} rafle la mise` : 'Le saloon est vide');
  $('end-sub').textContent = iWon
    ? 'Vous quittez le saloon les poches pleines et le barillet tiède.'
    : (winner ? 'La maison remercie les perdants pour leur contribution.' : 'Personne ne ramasse la mise.');

  const rows = [...v.players].sort((a, b) => Number(b.alive) - Number(a.alive) || a.seat - b.seat);
  $('end-stats').innerHTML = rows.map((p) => {
    const cls = p.id === v.winnerId ? 'is-winner' : (p.alive ? '' : 'is-out');
    const s = p.stats || {};
    const detail = `${s.bluffs || 0} bluff${(s.bluffs || 0) > 1 ? 's' : ''} · `
      + `${s.callsWon || 0}/${s.callsMade || 0} accusation${(s.callsMade || 0) > 1 ? 's' : ''} · `
      + `${s.triggers || 0} tir${(s.triggers || 0) > 1 ? 's' : ''}`;
    return `<tr class="${cls}"><td>${p.avatar}</td>`
      + `<td>${escapeHtml(p.name)}${p.id === v.viewerId ? ' <i style="opacity:.5">(vous)</i>' : ''}</td>`
      + `<td>${detail}</td></tr>`;
  }).join('');

  $('btn-end-again').textContent = againLabel;
  $('btn-end-menu').onclick = onMenu;
  $('btn-end-again').onclick = onAgain;
  $('ov-end').hidden = false;

  if (iWon) { sfx.win(); confetti(); } else sfx.lose();
}

export function hideEnd() { $('ov-end').hidden = true; }

function confetti() {
  if (reduced) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  const colors = ['#ffd98a', '#e8b75c', '#9c7328', '#f3e9d2', '#b3252b'];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('i');
    c.className = 'conf';
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${2.2 + Math.random() * 2.4}s`;
    c.style.animationDelay = `${Math.random() * 1.1}s`;
    c.style.setProperty('--spin', `${(Math.random() * 1200 - 600).toFixed(0)}deg`);
    host.appendChild(c);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 6200);
}

/* ------------------------------------------------------------------ */
/* Nettoyage & utilitaires                                             */
/* ------------------------------------------------------------------ */

export function resetTable() {
  stopTimer();
  picked = [];
  locked = false;
  view = null;
  dealtRound = -1;
  ['ov-reveal', 'ov-roulette', 'ov-end', 'ov-banner'].forEach((id) => { $(id).hidden = true; });
  $('opponents').innerHTML = '';
  $('hand').innerHTML = '';
  $('pile').innerHTML = '<div class="pile-empty"></div>';
  $('claim').hidden = true;
  $('ticker').innerHTML = '';
  $('ticker').dataset.last = '';
}

export function clearSelection() { picked = []; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const escapeAttr = escapeHtml;

/** CSS.escape n'existe pas partout : repli minimal pour nos identifiants. */
function cssEscape(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/[^\w-]/g, '\\$&');
}

/* Boutons d'action de la table */
$('btn-play').addEventListener('click', () => {
  if ($('btn-play').disabled) return;
  const idx = [...picked];
  clearSelection();
  onAction({ type: 'play', indices: idx });
});
$('btn-liar').addEventListener('click', () => {
  if ($('btn-liar').disabled) return;
  clearSelection();
  onAction({ type: 'challenge' });
});
