/**
 * ZÉNITH — rendu du combat.
 *
 * Le combat étant temps réel, l'interface ne rejoue pas une séquence
 * d'évènements comme dans un jeu au tour par tour : elle redessine l'état à
 * chaque tick, et superpose les effets ponctuels (dégâts, esquives, KO) que
 * le moteur a produits pendant ce tick.
 */

import { ELEMENTS, getFighter, CARD_KINDS } from '../../../shared/zenith/fighters.js';
import { cardName, VANISH_COST, KI_MAX } from '../../../shared/zenith/battle.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let onAction = () => {};
export function bindActions(fn) { onAction = fn; }

let lastView = null;
let lastHp = {};        // pour détecter les variations et animer

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/* Fragments partagés                                                  */
/* ------------------------------------------------------------------ */

/** Carte de combattant, utilisée par la sélection et le codex. */
export function fighterCard(f, { picked = false } = {}) {
  const el = ELEMENTS[f.element];
  return `<button class="card-f${picked ? ' picked' : ''}" data-fid="${f.id}"
      style="--el:${el.color}" title="${esc(f.name)} — ${esc(f.title)}">
    <span class="card-f-av">${f.avatar}</span>
    <span class="card-f-name">${esc(f.name)}</span>
    <span class="card-f-el">${el.glyph}</span>
    <span class="card-f-stats"><i>${f.hp}</i>·<i>${f.strike}</i>·<i>${f.blast}</i></span>
  </button>`;
}

export function codexCard(f) {
  const el = ELEMENTS[f.element];
  const stat = (v, l) => `<span class="cx-stat"><b>${v}</b><i>${l}</i></span>`;
  return `<div class="cx" style="--el:${el.color}">
    <div class="cx-top">
      <span class="cx-av">${f.avatar}</span>
      <span class="cx-id">
        <span class="cx-name">${esc(f.name)} ${el.glyph}</span>
        <span class="cx-title">${esc(f.title)}</span>
      </span>
    </div>
    <div class="cx-stats">
      ${stat(f.hp, 'pv')}${stat(f.strike, 'force')}${stat(f.blast, 'souffle')}
      ${stat(f.armor, 'garde')}${stat(f.speed, 'vit')}
    </div>
    <div class="cx-moves">
      <b>✦ ${esc(f.special.name)}</b> — ${esc(f.special.blurb)}<br>
      <b>☄️ ${esc(f.ultimate.name)}</b> — ${esc(f.ultimate.blurb)}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Rendu du combat                                                     */
/* ------------------------------------------------------------------ */

export function resetFight() {
  lastView = null;
  lastHp = {};
  $('clash').innerHTML = '';
  $('combo').hidden = true;
  $('announce').hidden = true;
  $('hand').innerHTML = '';
  ['foe-avatar', 'me-avatar'].forEach((id) => {
    $(id).className = `avatar ${id === 'foe-avatar' ? 'foe-av' : 'me-av'}`;
  });
}

/**
 * Redessine tout l'état. Appelée à chaque tick : elle doit rester bon marché,
 * d'où les comparaisons avant écriture dans le DOM.
 */
export function render(view) {
  const me = view.sides[view.viewerSide];
  const foe = view.sides[1 - view.viewerSide];

  renderSide(foe, 'foe', false);
  renderSide(me, 'me', true);
  renderHand(view, me);
  renderCombo(me);

  lastView = view;
}

function renderSide(side, prefix, mine) {
  const unit = side.team[side.active];
  const f = getFighter(unit.fighterId);
  const el = ELEMENTS[f.element];

  // Portraits de l'équipe
  const host = $(`${prefix}-portraits`);
  const want = side.team.map((u, i) => {
    const uf = getFighter(u.fighterId);
    const ue = ELEMENTS[uf.element];
    const cls = ['pt', i === side.active ? 'active' : '', u.ko ? 'dead' : '',
      mine && side.swapCd > 0 && i !== side.active && !u.ko ? 'locked' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}" style="--el:${ue.color}" data-slot="${i}"
        title="${esc(uf.name)} — ${ue.label}">${uf.avatar}
        <span class="mini"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></span>
      </div>`;
  }).join('');
  if (host.dataset.sig !== want) { host.dataset.sig = want; host.innerHTML = want; }

  // Nom et barres
  const nameEl = $(`${prefix}-name`);
  const label = `${f.avatar} ${esc(f.name)} <small>${el.glyph} ${el.label}</small>`;
  if (nameEl.innerHTML !== label) nameEl.innerHTML = label;

  const pct = (unit.hp / unit.maxHp) * 100;
  const bar = $(`${prefix}-hp`);
  bar.style.width = `${pct}%`;
  bar.classList.toggle('low', pct <= 30);
  $(`${prefix}-hp-ghost`).style.width = `${pct}%`;

  // Avatar : état d'esquive, KO
  const av = $(`${prefix}-avatar`);
  if (av.textContent !== f.avatar) av.textContent = f.avatar;
  av.classList.toggle('ghost', !!unit.vanishing);
  av.classList.toggle('gone', unit.ko);

  if (mine) {
    $('me-ki').style.width = `${(side.ki / KI_MAX) * 100}%`;
    $('me-ki-n').textContent = String(Math.round(side.ki));
    const dodge = $('b-dodge');
    const busy = unit.stun > 0 || unit.ko || side.koPause > 0;
    dodge.disabled = side.ki < VANISH_COST || busy || unit.vanishing;
    dodge.classList.toggle('ready', !dodge.disabled);
  }
}

function renderHand(view, side) {
  const host = $('hand');
  const unit = side.team[side.active];
  const busy = unit.stun > 0 || unit.ko || side.koPause > 0;
  const hand = side.hand || [];

  const sig = hand.join(',') + `|${Math.floor(side.ki / 5)}|${busy}|${unit.ultUsed}`;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig;

  let html = '';
  for (let i = 0; i < 4; i++) {
    const key = hand[i];
    if (!key) { html += '<div class="acard slot-empty-card"></div>'; continue; }
    const card = CARD_KINDS[key];
    const unusable = side.ki < card.ki || busy || (key === 'ultime' && unit.ultUsed);
    const colors = { frappe: '#ff8a5c', souffle: '#5eead4', speciale: '#a78bfa', ultime: '#ffd84d' };
    html += `<button class="acard${unusable ? ' off' : ''}${key === 'ultime' ? ' ult' : ''}"
        style="--c:${colors[key]}" data-card="${i}">
      <span class="acard-g">${card.glyph}</span>
      <span class="acard-l">${esc(cardLabel(unit, key))}</span>
      <span class="acard-k">${card.ki} ki</span>
    </button>`;
  }
  host.innerHTML = html;
}

/** Libellé court : les spéciales portent le nom de la technique. */
function cardLabel(unit, key) {
  if (key === 'frappe' || key === 'souffle') return CARD_KINDS[key].label;
  const f = getFighter(unit.fighterId);
  const name = key === 'ultime' ? f.ultimate.name : f.special.name;
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

function renderCombo(side) {
  const el = $('combo');
  if (side.combo >= 2) {
    el.hidden = false;
    el.innerHTML = `${side.combo}<small> ENCHAÎNÉS</small>`;
  } else {
    el.hidden = true;
  }
}

/* ------------------------------------------------------------------ */
/* Effets ponctuels                                                    */
/* ------------------------------------------------------------------ */

/** Joue les effets produits par le moteur pendant le dernier tick. */
export function playEffects(effects, view) {
  for (const e of effects) {
    const mine = e.side === view.viewerSide;
    switch (e.type) {
      case 'hit': hit(e, mine); break;
      case 'vanish': dodged(!mine); break;
      case 'vanish-start': sfx.dodge(); break;
      case 'swap': sfx.swap(); break;
      case 'ko': knockout(e, !mine); break;
      case 'enter': announce(`${getFighter(e.fighter).name.toUpperCase()} !`, '#a78bfa'); break;
      default: break;
    }
  }
}

function hit(e, mine) {
  const attacker = mine ? $('me-avatar') : $('foe-avatar');
  const victim = mine ? $('foe-avatar') : $('me-avatar');

  attacker.classList.remove('strike');
  void attacker.offsetWidth;
  attacker.classList.add('strike');

  victim.classList.remove('hurt');
  void victim.offsetWidth;
  victim.classList.add('hurt');

  // Nombre de dégâts, ancré sur la victime et coloré selon l'élément.
  const at = mine ? 'at-foe' : 'at-me';
  const cls = e.elem > 1 ? 'crit' : (e.elem < 1 ? 'weak' : '');
  spawn(`<div class="fx fx-num ${cls} ${at}">${e.amount}</div>`, 1000);
  spawn(`<div class="shock ${at}"></div>`, 460);

  // Le nom de la technique, lui, reste au centre : c'est une annonce.
  if (e.card === 'speciale' || e.card === 'ultime') {
    spawn(`<div class="fx fx-name">${esc(e.name)}</div>`, 980);
  }
  if (e.card === 'ultime') {
    sfx.ultimate();
    flash();
    shake();
  } else if (e.card === 'speciale') sfx.special();
  else if (e.card === 'souffle') sfx.blast();
  else sfx.punch();

  if (e.combo >= 2) sfx.combo(e.combo);
}

function dodged(mine) {
  spawn(`<div class="fx fx-dodge ${mine ? 'at-me' : 'at-foe'}">${mine ? 'ESQUIVE !' : 'ESQUIVÉ'}</div>`, 1000);
  sfx.dodge();
}

function knockout(e, mine) {
  sfx.ko();
  shake();
  announce(mine ? 'K.O. !' : 'À TERRE', mine ? '#ffd84d' : '#ff3d68');
}

function spawn(html, ms) {
  const host = $('clash');
  const box = document.createElement('div');
  box.innerHTML = html;
  const node = box.firstElementChild;
  // Léger décalage aléatoire pour que deux coups rapprochés ne se superposent pas.
  node.style.marginLeft = `${(Math.random() * 60 - 30).toFixed(0)}px`;
  node.style.marginTop = `${(Math.random() * 40 - 20).toFixed(0)}px`;
  host.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

export function announce(text, color = '#ffd84d') {
  const el = $('announce');
  el.textContent = text;
  el.style.color = color;
  el.style.textShadow = `0 0 26px ${color}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 1100);
}

function flash() {
  if (reduced) return;
  const f = document.createElement('div');
  f.className = 'flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 360);
}

function shake() {
  if (reduced) return;
  document.body.classList.remove('shake-all');
  void document.body.offsetWidth;
  document.body.classList.add('shake-all');
  setTimeout(() => document.body.classList.remove('shake-all'), 420);
}

/* ------------------------------------------------------------------ */
/* Fin de combat                                                       */
/* ------------------------------------------------------------------ */

export function showEnd(view, { onMenu, onAgain, againLabel = 'Revanche' }) {
  const won = view.winner === view.viewerSide;
  const me = view.sides[view.viewerSide];
  const foe = view.sides[1 - view.viewerSide];

  $('end-mark').textContent = won ? '🏆' : '💀';
  const t = $('end-title');
  t.className = `end-title${won ? '' : ' lost'}`;
  t.textContent = won ? 'VICTOIRE' : 'DÉFAITE';
  $('end-sub').textContent = won
    ? 'Vous avez tenu jusqu\'au bout.'
    : `${foe.name} reste debout.`;

  const row = (l, a, b) => `<tr><td>${l}</td><td>${a} · ${b}</td></tr>`;
  $('end-stats').innerHTML =
    row('Coups portés', me.stats.hits, foe.stats.hits)
    + row('Dégâts infligés', me.stats.dealt, foe.stats.dealt)
    + row('Spéciales', me.stats.specials, foe.stats.specials)
    + row('Ultimes', me.stats.ultimates, foe.stats.ultimates)
    + row('Esquives', me.stats.vanishes, foe.stats.vanishes)
    + `<tr><td colspan="2" style="text-align:center;color:var(--faint);font-size:.7rem;padding-top:10px">vous · adversaire</td></tr>`;

  $('b-end-again').textContent = againLabel;
  $('b-end-menu').onclick = onMenu;
  $('b-end-again').onclick = onAgain;
  $('ov-end').hidden = false;

  if (won) sfx.win(); else sfx.lose();
}

export function hideEnd() { $('ov-end').hidden = true; }

let toastTimer = null;
export function toast(text, ms = 1900) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ------------------------------------------------------------------ */
/* Entrées                                                             */
/* ------------------------------------------------------------------ */

$('hand').addEventListener('click', (e) => {
  const b = e.target.closest('.acard[data-card]');
  if (!b || b.classList.contains('off')) return;
  onAction({ type: 'play', index: Number(b.dataset.card) });
});

$('b-dodge').addEventListener('click', () => {
  if ($('b-dodge').disabled) return;
  onAction({ type: 'vanish' });
});

$('me-portraits').addEventListener('click', (e) => {
  const p = e.target.closest('.pt[data-slot]');
  if (!p || p.classList.contains('active') || p.classList.contains('dead')) return;
  onAction({ type: 'swap', slot: Number(p.dataset.slot) });
});
