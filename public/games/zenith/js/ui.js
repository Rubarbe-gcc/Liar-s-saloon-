/**
 * ZÉNITH — rendu du combat au tour par tour.
 *
 * Deux entrées seulement :
 *   · `render(view)`            dessine l'état courant ;
 *   · `playEffects(effets, v)`  rejoue ce qui vient de se passer.
 *
 * Le combat étant au tour par tour, l'interface peut prendre son temps :
 * chaque effet est joué l'un après l'autre, avec une pause, plutôt que
 * superposé comme dans un jeu d'action.
 */

import {
  ELEMENTS, getFighter, elementMultiplier, roleOf, tempoOf,
} from '../../../shared/zenith/fighters.js';
import {
  MOVES, MOVE_KEYS, STATUS, moveName, estimateDamage, KI_MAX,
} from '../../../shared/zenith/battle.js';
import { spriteSvg } from '../../../shared/zenith/sprites.js';
import { roueSvg, resumeMatchup } from '../../../shared/zenith/roue.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 90) : ms));

let onCommand = () => {};
let verrou = false;          // vrai pendant la résolution d'un tour
let vue = null;

export function bindCommands(fn) { onCommand = fn; }

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/* Fragments partagés                                                  */
/* ------------------------------------------------------------------ */

/**
 * Pastille de rôle. C'est le seul repère qui dise, sans lire les chiffres,
 * ce qu'un combattant est censé faire — et donc ce qui manquait pour
 * composer une équipe autrement qu'au hasard.
 */
export function roleBadge(f, { tempo = true } = {}) {
  const r = roleOf(f);
  const t = tempo ? tempoOf(f) : null;
  return `<span class="role" style="--rc:${r.color}" title="${esc(r.blurb)}">`
    + `<i>${r.glyph}</i>${esc(r.label)}`
    + (t ? `<u title="${esc(t.blurb)}">${t.glyph}</u>` : '')
    + '</span>';
}

export function fighterCard(f, { picked = false } = {}) {
  const el = ELEMENTS[f.element];
  return `<button class="card-f${picked ? ' picked' : ''}" data-fid="${f.id}"
      style="--el:${el.color}" title="${esc(f.name)} — ${esc(f.title)}">
    <span class="card-f-av">${spriteSvg(f, 'repos')}</span>
    <span class="card-f-name">${esc(f.name)}</span>
    <span class="card-f-el">${el.glyph}</span>
    ${roleBadge(f)}
    <span class="card-f-stats"><i>${f.hp}</i>·<i>${f.strike}</i>·<i>${f.blast}</i></span>
  </button>`;
}

export function codexCard(f) {
  const el = ELEMENTS[f.element];
  const stat = (v, l) => `<span class="cx-stat"><b>${v}</b><i>${l}</i></span>`;
  return `<div class="cx" style="--el:${el.color}">
    <div class="cx-top">
      <span class="cx-av">${spriteSvg(f, 'garde')}</span>
      <span class="cx-id">
        <span class="cx-name">${esc(f.name)} ${el.glyph}</span>
        <span class="cx-title">${esc(f.title)}</span>
        ${roleBadge(f)}
      </span>
    </div>
    <div class="cx-stats">
      ${stat(f.hp, 'pv')}${stat(f.strike, 'force')}${stat(f.blast, 'souffle')}
      ${stat(f.armor, 'garde')}${stat(f.speed, 'vit')}
    </div>
    <div class="cx-moves">
      <b>✦ ${esc(f.special.name)}</b> — ${esc(f.special.blurb)}<br>
      <b>☄️ ${esc(f.ultimate.name)}</b> — ${esc(f.ultimate.blurb)}
      ${f.support ? `<br><b style="color:${roleOf(f).color}">${f.support.glyph} `
        + `${esc(f.support.name)}</b> — ${esc(f.support.blurb)}` : ''}
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

export function resetFight() {
  vue = null;
  verrou = false;
  $('clash').innerHTML = '';
  $('announce').hidden = true;
  $('cmd-moves').innerHTML = '';
  $('ticker').innerHTML = '';
  ['foe-avatar', 'me-avatar'].forEach((id) => {
    const el = $(id);
    el.className = `avatar ${id === 'foe-avatar' ? 'foe-av' : 'me-av'}`;
    el.innerHTML = '';
    delete el.dataset.pose;
    delete el.dataset.fid;
    clearTimeout(el._pose);
  });
}

export function render(v) {
  vue = v;
  const me = v.sides[v.viewerSide];
  const foe = v.sides[1 - v.viewerSide];

  renderSide(foe, 'foe', false);
  renderSide(me, 'me', true);
  renderMatchup(me, foe);
  renderMenu(v, me, foe);

  $('turn-n').textContent = `Tour ${v.turn}`;
  const etat = $('turn-state');
  if (v.phase === 'over') etat.textContent = 'Combat terminé';
  else if (verrou) etat.textContent = 'Résolution…';
  else if (me.aChoisi) etat.textContent = 'En attente de l\'adversaire';
  else etat.textContent = 'À vous de jouer';

  // Charges de soutien restantes : une ressource rare, donc affichée.
  const jauge = $('soutien-jauge');
  const aCapacite = v.commandes.soutien && v.commandes.soutien.capacite;
  const mienSoutien = me.team.some((u) => getFighter(u.fighterId).support);
  jauge.hidden = !(aCapacite || mienSoutien);
  if (!jauge.hidden) {
    jauge.innerHTML = '🔆 ' + '◆'.repeat(me.soutiens) + '◇'.repeat(Math.max(0, 3 - me.soutiens));
    jauge.title = `${me.soutiens} soutien${me.soutiens > 1 ? 's' : ''} restant`
      + `${me.soutiens > 1 ? 's' : ''} pour tout le combat.`;
  }

  const dernier = v.log && v.log.length ? v.log[v.log.length - 1].text : '';
  const t = $('ticker');
  if (t.dataset.last !== dernier) { t.dataset.last = dernier; t.innerHTML = `<span>${esc(dernier)}</span>`; }
}

function renderSide(side, prefix, mine) {
  const unit = side.team[side.active];
  const f = getFighter(unit.fighterId);
  const el = ELEMENTS[f.element];

  const host = $(`${prefix}-portraits`);
  const html = side.team.map((u, i) => {
    const uf = getFighter(u.fighterId);
    const ue = ELEMENTS[uf.element];
    const cls = ['pt', i === side.active ? 'active' : '', u.ko ? 'dead' : ''].filter(Boolean).join(' ');
    const ur = roleOf(uf);
    // Le rôle marque le portrait : pendant le combat, c'est le seul endroit
    // où l'on voit encore toute l'équipe, donc le seul où l'on peut décider
    // d'un changement sans rouvrir une fiche.
    return `<div class="${cls}" style="--el:${ue.color};--rc:${ur.color}" data-slot="${i}"
        title="${esc(uf.name)} — ${ue.label} · ${esc(ur.label)}">${spriteSvg(uf, u.ko ? 'vaincu' : 'repos')}
        <span class="pt-role">${ur.glyph}</span>
        <span class="mini"><i style="width:${(u.hp / u.maxHp) * 100}%"></i></span>
      </div>`;
  }).join('');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }

  const nameEl = $(`${prefix}-name`);
  const label = `${esc(f.name)} <small>${el.glyph} ${el.label}</small>${roleBadge(f)}`;
  if (nameEl.innerHTML !== label) nameEl.innerHTML = label;

  const pct = (unit.hp / unit.maxHp) * 100;
  const bar = $(`${prefix}-hp`);
  bar.style.width = `${pct}%`;
  bar.classList.toggle('low', pct <= 30);

  // Altération en cours, avec le nombre de tours restants.
  const st = $(`${prefix}-status`);
  const pastilles = [];
  if (unit.status) {
    const s = STATUS[unit.status.key];
    pastilles.push(`<b class="st st-${unit.status.key}" title="${esc(s.blurb)}">`
      + `${s.glyph} ${s.label} <i>${unit.status.tours}</i></b>`);
  }
  if (unit.boost) {
    pastilles.push(`<b class="st st-renfort" title="Dégâts ×${unit.boost.attaque.toFixed(2)}, `
      + `encaissement amélioré">🔆 Renfort <i>${unit.boost.tours}</i></b>`);
  }
  st.innerHTML = pastilles.join('');

  const av = $(`${prefix}-avatar`);
  setPose(av, f, unit.ko ? 'vaincu' : (unit.guard ? 'garde' : 'repos'), { base: true });
  av.classList.toggle('gone', unit.ko);

  if (mine) {
    $('me-ki').style.width = `${(unit.ki / KI_MAX) * 100}%`;
    $('me-ki-n').textContent = String(unit.ki);
  } else {
    // Le ki adverse ne transite plus : on affiche que la réserve existe,
    // pas ce qu'elle contient. À chacun de suivre le compte.
    $('foe-ki-n').textContent = 'ki ?';
    $('foe-ki-n').title = 'La réserve adverse est masquée. Elle se déduit : '
      + 'trente au départ, plus le revenu de chaque tour, moins ce qu\'on le voit dépenser.';
  }
}

function renderMatchup(me, foe) {
  const a = getFighter(me.team[me.active].fighterId);
  const b = getFighter(foe.team[foe.active].fighterId);
  const mult = elementMultiplier(a.element, b.element);
  const el = $('matchup');
  const sig = `${a.element}>${b.element}`;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  const ea = ELEMENTS[a.element], eb = ELEMENTS[b.element];
  const fleche = mult > 1 ? '▲' : (mult < 1 ? '▼' : '=');
  const mot = mult > 1 ? 'avantage' : (mult < 1 ? 'désavantage' : 'neutre');
  el.className = `matchup ${mult > 1 ? 'fort' : (mult < 1 ? 'faible' : '')}`;
  el.innerHTML = `<span>${ea.glyph}</span><b>${fleche} ${mot}</b><span>${eb.glyph}</span>`;
  el.title = resumeMatchup(a.element, b.element);

  // La roue reste affichée : c'est ce qui permet d'anticiper un changement
  // plutôt que de constater l'avantage après coup.
  $('roue-mini').innerHTML = roueSvg({ moi: a.element, cible: b.element });
}

/** Feuille de la roue, ouverte depuis le rapport de force. */
function ouvrirRoue() {
  if (!vue) return;
  const me = vue.sides[vue.viewerSide];
  const foe = vue.sides[1 - vue.viewerSide];
  const a = getFighter(me.team[me.active].fighterId);
  const b = getFighter(foe.team[foe.active].fighterId);
  $('roue-grande').innerHTML = roueSvg({ moi: a.element, cible: b.element, labels: true });
  $('roue-dit').textContent = resumeMatchup(a.element, b.element);
  $('ov-roue').hidden = false;
}

/**
 * Menu de commandes. Chaque attaque annonce les dégâts qu'elle infligera à la
 * cible actuelle : sans ce chiffre, le joueur ne peut pas arbitrer entre une
 * Frappe gratuite et un Souffle à dix-huit points de ki.
 */
function renderMenu(v, me, foe) {
  const unit = me.team[me.active];
  const foeUnit = foe.team[foe.active];
  const af = getFighter(unit.fighterId);
  const df = getFighter(foeUnit.fighterId);
  const fige = verrou || v.phase !== 'choose' || me.aChoisi || unit.ko;

  const sig = `${unit.fighterId}|${df.id}|${unit.ki}|${unit.ultUsed}|${fige}|${v.turn}`;
  const host = $('cmd-moves');
  if (host.dataset.sig !== sig) {
    host.dataset.sig = sig;
    host.innerHTML = MOVE_KEYS.map((key) => {
      const m = MOVES[key];
      const dispo = v.commandes.moves.find((x) => x.key === key) || { utilisable: false };
      const off = !dispo.utilisable || fige;
      const degats = estimateDamage(af, df, key);
      const mult = elementMultiplier(af.element, df.element);
      const cls = mult > 1 ? ' fort' : (mult < 1 ? ' faible' : '');
      const couleurs = { frappe: '#ff8a5c', souffle: '#5eead4', speciale: '#a78bfa', ultime: '#ffd84d' };
      return `<button class="cmd cmd-move${off ? ' off' : ''}${key === 'ultime' ? ' ult' : ''}"
          style="--c:${couleurs[key]}" data-move="${key}"
          title="${esc(m.blurb)}${dispo.raison ? ` — ${dispo.raison}` : ''}">
        <span class="cmd-g">${m.glyph}</span>
        <span class="cmd-l">${esc(moveName(unit, key))}</span>
        <span class="cmd-dmg${cls}">${degats}</span>
        <span class="cmd-s">${m.ki ? `${m.ki} ki` : 'gratuit'}${dispo.raison ? ` · ${dispo.raison}` : ''}</span>
      </button>`;
    }).join('');
  }

  $('b-guard').classList.toggle('off', fige);
  const peutChanger = v.commandes.swaps.some((s) => s.utilisable);
  $('b-swap').classList.toggle('off', fige || !peutChanger);
  renderSoutien(v, me, fige);
  $('cmd-wait').hidden = !(me.aChoisi && v.phase === 'choose');
}

/**
 * Bouton de soutien. Il n'apparaît que pour les combattants qui en portent
 * un, et annonce ce qu'il fera : combien de points de vie il rend, ou de
 * combien il augmente les dégâts — et surtout combien de charges il reste,
 * puisqu'il n'y en a que trois pour tout le combat.
 */
function renderSoutien(v, me, fige) {
  const b = $('b-soutien');
  const d = v.commandes.soutien;
  const cap = d && d.capacite;
  b.hidden = !cap;
  if (!cap) return;

  const unit = me.team[me.active];
  b.classList.toggle('off', fige || !d.utilisable);
  b.classList.toggle('soutien-soin', cap.kind === 'soin');
  b.dataset.kind = cap.kind;
  $('soutien-g').textContent = cap.glyph;
  $('soutien-l').textContent = cap.name;

  if (cap.kind === 'soin') {
    const cibles = cap.portee === 'equipe' ? me.team.filter((u) => !u.ko) : [
      me.team.filter((u) => !u.ko).reduce((a, c) => (a.hp / a.maxHp <= c.hp / c.maxHp ? a : c)),
    ];
    const rendu = cibles.reduce((a, u) => a + Math.min(u.maxHp - u.hp, Math.round(u.maxHp * cap.part)), 0);
    $('soutien-n').textContent = `+${Math.round(rendu)}`;
  } else {
    $('soutien-n').textContent = `×${cap.attaque.toFixed(2).replace(/0$/, '')}`;
  }

  const portee = cap.portee === 'equipe' ? 'tout le camp' : 'un allié';
  $('soutien-s').textContent = d.raison
    ? `${cap.ki} ki · ${d.raison}`
    : `${cap.ki} ki · ${portee} · ${d.restants} charge${d.restants > 1 ? 's' : ''}`;
  b.title = `${cap.blurb} Il en reste ${d.restants} pour tout le combat.`;
}

/* ------------------------------------------------------------------ */
/* Sprites                                                             */
/* ------------------------------------------------------------------ */

function setPose(el, fighter, pose, { base = false } = {}) {
  if (base) el.dataset.repos = pose;
  const sig = `${fighter.id}:${pose}`;
  if (el.dataset.pose === sig) return;
  el.dataset.pose = sig;
  el.dataset.fid = fighter.id;
  el.innerHTML = spriteSvg(fighter, pose);
}

function poseFor(el, pose, ms) {
  const f = getFighter(el.dataset.fid);
  if (!f) return;
  setPose(el, f, pose);
  clearTimeout(el._pose);
  el._pose = setTimeout(() => {
    const cur = getFighter(el.dataset.fid);
    if (cur) setPose(el, cur, el.dataset.repos || 'repos');
  }, ms);
}

/* ------------------------------------------------------------------ */
/* Résolution du tour                                                  */
/* ------------------------------------------------------------------ */

/** Rejoue les effets du tour, l'un après l'autre, puis affiche l'état final. */
export async function playEffects(effets, finale) {
  verrou = true;
  if (vue) render(vue);

  for (const e of effets || []) {
    try { await jouerEffet(e, finale); }
    catch (err) { console.error('effet', e.type, err); }
  }

  verrou = false;
  render(finale);
}

async function jouerEffet(e, v) {
  const mien = e.side === v.viewerSide;
  switch (e.type) {
    case 'swap':
      sfx.swap();
      annonce(`${getFighter(e.to).name} entre !`, '#a78bfa');
      return sleep(650);

    case 'guard':
      sfx.tap();
      poseFor(mien ? $('me-avatar') : $('foe-avatar'), 'garde', 900);
      return sleep(420);

    case 'hit': {
      const att = mien ? $('me-avatar') : $('foe-avatar');
      const vic = mien ? $('foe-avatar') : $('me-avatar');
      poseFor(att, 'frappe', 420);
      poseFor(vic, 'encaisse', 460);
      att.classList.remove('strike'); void att.offsetWidth; att.classList.add('strike');
      vic.classList.remove('hurt'); void vic.offsetWidth; vic.classList.add('hurt');

      if (e.move === 'speciale' || e.move === 'ultime') {
        spawn(`<div class="fx fx-name">${esc(e.name)}</div>`, 1100);
        await sleep(360);
      }
      const at = mien ? 'at-foe' : 'at-me';
      const cls = e.elem > 1 ? 'crit' : (e.elem < 1 ? 'weak' : '');
      spawn(`<div class="fx fx-num ${cls} ${at}">${e.amount}${e.garde ? '<i>garde</i>' : ''}</div>`, 1100);
      spawn(`<div class="shock ${at}"></div>`, 460);

      if (e.move === 'ultime') { sfx.ultimate(); flash(); shake(); }
      else if (e.move === 'speciale') { sfx.special(); shake(); }
      else if (e.move === 'souffle') sfx.blast();
      else sfx.punch();
      return sleep(640);
    }

    case 'heal':
      spawn(`<div class="fx fx-heal ${mien ? 'at-me' : 'at-foe'}">+${e.amount}</div>`, 1000);
      return sleep(320);

    case 'soin': {
      sfx.win();
      annonce(`${e.glyph} ${e.name}`, '#4ade80');
      const total = e.cibles.reduce((a, c) => a + c.amount, 0);
      spawn(`<div class="fx fx-heal ${mien ? 'at-me' : 'at-foe'}">+${total}</div>`, 1200);
      return sleep(820);
    }

    case 'renfort':
      sfx.special();
      annonce(`${e.glyph} ${e.name}`, '#ffd84d');
      poseFor(mien ? $('me-avatar') : $('foe-avatar'), 'garde', 800);
      return sleep(820);

    case 'renfort-fin':
      return undefined;

    case 'status': {
      const s = STATUS[e.status];
      annonce(`${s.glyph} ${s.label} !`, '#ffd84d');
      sfx.swap();
      return sleep(700);
    }

    case 'status-tick':
      spawn(`<div class="fx fx-num weak ${mien ? 'at-me' : 'at-foe'}">${e.amount}</div>`, 900);
      return sleep(360);

    case 'frozen':
      annonce('Figé !', '#38bdf8');
      return sleep(700);

    case 'ko':
      sfx.ko(); shake();
      annonce(mien ? 'Vous perdez un combattant' : 'Adversaire à terre', mien ? '#ff3d68' : '#ffd84d');
      return sleep(900);

    case 'enter':
      annonce(`${getFighter(e.fighter).name} entre en lice`, '#a78bfa');
      return sleep(700);

    case 'timeout':
      annonce('Limite de tours', '#93a3c4');
      return sleep(800);

    default:
      return undefined;
  }
}

function spawn(html, ms) {
  const host = $('clash');
  const box = document.createElement('div');
  box.innerHTML = html;
  const node = box.firstElementChild;
  node.style.marginLeft = `${(Math.random() * 40 - 20).toFixed(0)}px`;
  host.appendChild(node);
  setTimeout(() => node.remove(), ms);
}

export function annonce(text, color = '#ffd84d') {
  const el = $('announce');
  el.textContent = text;
  el.style.color = color;
  el.style.textShadow = `0 0 26px ${color}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 1000);
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

export function showEnd(v, { onMenu, onAgain, againLabel = 'Revanche' }) {
  const won = v.winner === v.viewerSide;
  const me = v.sides[v.viewerSide];
  const foe = v.sides[1 - v.viewerSide];

  $('end-mark').textContent = won ? '🏆' : (v.winner === null ? '⚖️' : '💀');
  const t = $('end-title');
  t.className = `end-title${won ? '' : ' lost'}`;
  t.textContent = won ? 'VICTOIRE' : (v.winner === null ? 'MATCH NUL' : 'DÉFAITE');
  $('end-sub').textContent = won
    ? `Emporté en ${v.turn} tours.`
    : (v.winner === null ? 'Personne n\'a cédé.' : `${foe.name} reste debout.`);

  const row = (l, a, b) => `<tr><td>${l}</td><td>${a} · ${b}</td></tr>`;
  $('end-stats').innerHTML =
    row('Coups portés', me.stats.coups, foe.stats.coups)
    + row('Dégâts infligés', me.stats.degats, foe.stats.degats)
    + row('Gardes', me.stats.gardes, foe.stats.gardes)
    + row('Spéciales', me.stats.speciales, foe.stats.speciales)
    + row('Ultimes', me.stats.ultimes, foe.stats.ultimes)
    + '<tr><td colspan="2" style="text-align:center;color:var(--faint);font-size:.7rem;padding-top:10px">vous · adversaire</td></tr>';

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

$('cmd-moves').addEventListener('click', (e) => {
  const b = e.target.closest('.cmd-move[data-move]');
  if (!b || b.classList.contains('off')) return;
  sfx.tap();
  onCommand({ type: 'move', move: b.dataset.move });
});

$('b-guard').addEventListener('click', () => {
  if ($('b-guard').classList.contains('off')) return;
  sfx.tap();
  onCommand({ type: 'guard' });
});

$('b-soutien').addEventListener('click', () => {
  if ($('b-soutien').classList.contains('off')) return;
  sfx.tap();
  onCommand({ type: 'soutien' });
});

$('matchup').addEventListener('click', ouvrirRoue);
$('roue-mini').addEventListener('click', ouvrirRoue);

$('b-swap').addEventListener('click', () => {
  if ($('b-swap').classList.contains('off') || !vue) return;
  sfx.tap();
  ouvrirChangement();
});

/** Feuille de choix du remplaçant. */
function ouvrirChangement() {
  const me = vue.sides[vue.viewerSide];
  const foe = vue.sides[1 - vue.viewerSide];
  const df = getFighter(foe.team[foe.active].fighterId);

  $('swap-list').innerHTML = me.team.map((u, slot) => {
    const f = getFighter(u.fighterId);
    const el = ELEMENTS[f.element];
    const dispo = vue.commandes.swaps.find((s) => s.slot === slot) || {};
    const mult = elementMultiplier(f.element, df.element);
    const note = mult > 1 ? '<b class="fort">▲ avantage</b>'
      : (mult < 1 ? '<b class="faible">▼ désavantage</b>' : '<b>= neutre</b>');
    return `<button class="swap-item${dispo.utilisable ? '' : ' off'}" data-slot="${slot}"
        style="--el:${el.color}">
      <span class="swap-av">${spriteSvg(f, u.ko ? 'vaincu' : 'repos')}</span>
      <span class="swap-id">
        <span class="swap-name">${esc(f.name)} ${el.glyph}${roleBadge(f, { tempo: false })}</span>
        <span class="swap-note">${dispo.raison ? esc(dispo.raison) : note}</span>
      </span>
      <span class="swap-hp"><b>${Math.max(0, Math.ceil(u.hp))}</b>
        <i style="--p:${(u.hp / u.maxHp) * 100}%"></i></span>
    </button>`;
  }).join('');
  $('ov-swap').hidden = false;
}

$('swap-list').addEventListener('click', (e) => {
  const b = e.target.closest('.swap-item[data-slot]');
  if (!b || b.classList.contains('off')) return;
  $('ov-swap').hidden = true;
  sfx.swap();
  onCommand({ type: 'swap', slot: Number(b.dataset.slot) });
});
