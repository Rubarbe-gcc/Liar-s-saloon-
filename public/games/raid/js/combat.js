/**
 * RAID — l'écran de combat.
 *
 * Le moteur (`bataille.js`) résout tout d'un coup et rend une liste
 * d'événements ; cet écran les rejoue un par un — un coup, un chiffre qui
 * s'envole, une barre qui baisse — puis rend la main au joueur.
 */

import {
  actif, actionsDe, agir, demarrer, estimer, prochainsTours, vivants, OBJETS,
} from '../../../shared/raid/bataille.js';
import { multiplicateur } from '../../../shared/raid/ecoles.js';
import { spriteSvg } from '../../../shared/raid/sprites.js';
import { choisirAction } from '../../../shared/raid/ia.js';
import { txt, teinte, texteSort, TRAITS_RPG } from './textes.js';

const $ = (id) => document.getElementById(id);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let b = null;            // la bataille
let o = null;            // { surFin, sfx, toast }
let anime = false;       // des événements sont en cours de lecture
let choix = null;        // action choisie, en attente d'une cible
let auto = false;
const vue = new Map();   // ce que l'écran montre : { pv, pm } par unité

const cle = (camp, idx) => `${camp}${idx}`;
const uniteDe = (camp, idx) => (camp === 'h' ? b.heros : b.ennemis)[idx];
const noeud = (camp, idx) => document.querySelector(`.unite[data-u="${cle(camp, idx)}"]`);

/* ------------------------------------------------------------------ */
/* Entrée                                                              */
/* ------------------------------------------------------------------ */

export function lancerCombat(bataille, options) {
  b = bataille;
  o = options;
  choix = null;
  anime = false;
  vue.clear();
  for (const u of [...b.heros, ...b.ennemis]) vue.set(cle(u.camp, u.idx), { pv: u.pv, pm: u.pm ?? 0 });
  $('b-auto').setAttribute('aria-pressed', String(auto));
  $('journal').innerHTML = o.intro || 'Le combat commence.';
  construire();
  jouer(demarrer(b));
}

export function basculerAuto() {
  auto = !auto;
  $('b-auto').setAttribute('aria-pressed', String(auto));
  if (auto && b && !anime && actif(b)) tourAuto();
}

/* ------------------------------------------------------------------ */
/* Construction et mise à jour                                          */
/* ------------------------------------------------------------------ */

function carteUnite(u) {
  const ennemi = u.camp === 'e';
  const traits = ennemi ? u.traits.map((t) => (TRAITS_RPG[t] || {}).glyphe || '').join('') : '';
  return `<div class="unite" data-u="${cle(u.camp, u.idx)}" style="--aff:${teinte(u.ecole)}">
    <span class="ecole-pt"></span>
    <span class="etats"></span>
    ${spriteSvg(u)}
    <div class="nom">${txt(u.nom)}${ennemi ? '' : ` <i>niv. ${u.niveau}</i>`}</div>
    <div class="jauge ${ennemi ? 'ennemi' : 'pv'}"><i></i></div>
    ${ennemi ? '' : '<div class="jauge pm"><i></i></div>'}
    <div class="chiffres"><span class="pv-txt"></span><span>${ennemi ? traits : '<span class="pm-txt"></span>'}</span></div>
    ${ennemi ? '<div class="alerte"></div>' : ''}
  </div>`;
}

function construire() {
  $('ennemis').innerHTML = b.ennemis.map(carteUnite).join('');
  $('heros').innerHTML = b.heros.map(carteUnite).join('');
  for (const el of document.querySelectorAll('#s-combat .unite')) {
    el.addEventListener('click', () => toucherUnite(el.dataset.u[0], +el.dataset.u.slice(1)));
  }
  maj();
}

function majUnite(u) {
  const el = noeud(u.camp, u.idx);
  if (!el) return;
  const v = vue.get(cle(u.camp, u.idx));
  const part = Math.max(0, v.pv) / u.pvMax;
  const pv = el.querySelector('.jauge.pv, .jauge.ennemi');
  pv.style.setProperty('--v', part.toFixed(3));
  pv.classList.toggle('bas', part < 0.3);
  el.querySelector('.pv-txt').textContent = `${Math.max(0, Math.round(v.pv))} / ${u.pvMax} PV`;
  el.classList.toggle('ko', v.pv <= 0);
  const etats = [];
  if (u.camp === 'h') {
    el.querySelector('.jauge.pm').style.setProperty('--v', (v.pm / u.pmMax).toFixed(3));
    el.querySelector('.pm-txt').textContent = `${Math.round(v.pm)} PM`;
    if (u.defense) etats.push('🛡');
    if (u.poison) etats.push('☠');
    if (b.bouclier) etats.push('🔰');
    if (b.elan) etats.push('✨');
  } else {
    if (u.enrage) etats.push('😡');
    if (u.brasier && u.brasier.tours > 0) etats.push('🔥');
    if (u.entrave) etats.push('⛓');
    const al = el.querySelector('.alerte');
    const r = u.charge.reste;
    al.classList.toggle('imminente', r <= 1);
    al.textContent = r <= 2
      ? `⚡ ${u.charge.nom} ${r <= 1 ? '— au prochain tour !' : '— dans 2 tours'}${u.charge.zone ? ' · tout le groupe' : ''}`
      : '';
  }
  el.querySelector('.etats').textContent = etats.join('');
  const a = actif(b);
  el.classList.toggle('actif', !anime && !!a && u.camp === 'h' && a.idx === u.idx);
}

function maj() {
  for (const u of [...b.heros, ...b.ennemis]) majUnite(u);
  $('manche').textContent = `Manche ${Math.max(1, b.manche)}`;
  const a = actif(b);
  const file = [...(a ? [a] : []), ...prochainsTours(b, 9)];
  $('ordre').innerHTML = file.map((u) => spriteSvg(u, 'repos', { classe: `sprite ${u.camp}` })).join('');
}

function flotter(camp, idx, texte, classe) {
  const el = noeud(camp, idx);
  if (!el) return;
  const f = document.createElement('div');
  f.className = `chiffre-vol ${classe}`;
  f.textContent = texte;
  el.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

function secouer(camp, idx, classe) {
  const el = noeud(camp, idx);
  if (!el) return;
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
  setTimeout(() => el.classList.remove(classe), 450);
}

/* ------------------------------------------------------------------ */
/* Lecture des événements                                              */
/* ------------------------------------------------------------------ */

async function jouer(evs) {
  anime = true;
  $('commandes').innerHTML = '';
  maj();
  for (const ev of evs) await jouerUn(ev);
  anime = false;
  for (const u of [...b.heros, ...b.ennemis]) vue.set(cle(u.camp, u.idx), { pv: u.pv, pm: u.pm ?? 0 });
  maj();
  if (b.fini) return fin();
  commandes();
  if (auto) tourAuto();
}

async function jouerUn(ev) {
  const s = o.sfx;
  switch (ev.t) {
    case 'manche':
      $('manche').textContent = `Manche ${ev.n}`;
      if (ev.n > 1) await attendre(160);
      break;
    case 'action': {
      const u = uniteDe(ev.camp, ev.idx);
      const cible = ev.cible ? uniteDe(ev.cible.camp, ev.cible.idx) : null;
      const vers = cible && cible !== u ? ` → ${txt(cible.nom)}` : '';
      $('journal').innerHTML = `<span><b>${txt(u.nom)}</b> : ${txt(ev.nom)}${vers}</span>`;
      if (ev.genre === 'charge') {
        $('journal').innerHTML = `<span>⚡ <b>${txt(u.nom)}</b> déchaîne <b>${txt(ev.nom)}</b> !</span>`;
        s.charge();
        await attendre(420);
      }
      secouer(ev.camp, ev.idx, 'frappe');
      if (ev.genre === 'ultime') s.ultime();
      else if (ev.genre === 'sort') s.special();
      else if (ev.genre === 'defense') s.garde();
      else if (ev.genre === 'objet') s.clic();
      else if (ev.genre === 'attaque') s.frappe();
      await attendre(ev.genre === 'ultime' ? 520 : 330);
      break;
    }
    case 'degats': {
      const v = vue.get(cle(ev.camp, ev.idx));
      v.pv = ev.pv;
      let classe = ev.crit ? 'crit' : 'degats';
      if (ev.elem > 1) classe += ' fort';
      else if (ev.elem < 1) classe += ' faible';
      flotter(ev.camp, ev.idx, `${ev.crit ? 'CRIT ' : ''}−${ev.n}`, classe);
      secouer(ev.camp, ev.idx, 'touche');
      if (ev.camp === 'h') s.subi();
      if (ev.dot) $('journal').innerHTML = `<span>${ev.dot === 'poison' ? '☠ Le poison' : '🔥 La brûlure'} ronge ${txt(uniteDe(ev.camp, ev.idx).nom)}</span>`;
      majUnite(uniteDe(ev.camp, ev.idx));
      await attendre(ev.dot ? 380 : 190);
      break;
    }
    case 'soin': {
      vue.get(cle(ev.camp, ev.idx)).pv = ev.pv;
      if (ev.n > 0) flotter(ev.camp, ev.idx, `+${ev.n}`, 'soin');
      if (ev.camp === 'h') s.soin();
      majUnite(uniteDe(ev.camp, ev.idx));
      await attendre(120);
      break;
    }
    case 'pm': {
      vue.get(cle(ev.camp, ev.idx)).pm = ev.pm;
      if (ev.n > 0) flotter(ev.camp, ev.idx, `+${ev.n} PM`, 'pm');
      majUnite(uniteDe(ev.camp, ev.idx));
      await attendre(100);
      break;
    }
    case 'releve': {
      vue.get(cle(ev.camp, ev.idx)).pv = ev.pv;
      s.soin();
      majUnite(uniteDe(ev.camp, ev.idx));
      await attendre(250);
      break;
    }
    case 'ko': {
      const u = uniteDe(ev.camp, ev.idx);
      vue.get(cle(ev.camp, ev.idx)).pv = 0;
      s.ko();
      $('journal').innerHTML = `<span>💀 <b>${txt(u.nom)}</b> ${ev.camp === 'h' ? 'tombe !' : 'est vaincu.'}</span>`;
      majUnite(u);
      await attendre(360);
      break;
    }
    case 'effet': {
      const u = ev.camp ? uniteDe(ev.camp, ev.idx) : null;
      const dits = {
        rage: () => { s.rage(); return `😡 <b>${txt(u.nom)}</b> entre en rage !`; },
        bouclier: () => '🔰 Un bouclier protège le groupe.',
        elan: () => '✨ Le groupe est galvanisé.',
        brasier: () => `🔥 <b>${txt(u.nom)}</b> brûle.`,
        entrave: () => `⛓ <b>${txt(u.nom)}</b> est affaibli.`,
      };
      if (dits[ev.quoi]) $('journal').innerHTML = `<span>${dits[ev.quoi]()}</span>`;
      maj();
      await attendre(260);
      break;
    }
    default: break;
  }
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

function commandes() {
  const h = actif(b);
  if (!h) return;
  const acts = actionsDe(b);
  const par = Object.fromEntries(acts.map((a) => [a.type, a]));
  const sort = (a) => {
    const s = h.sorts[a.type];
    const aide = a.verrou ? `🔒 ${a.verrou}` : `${a.cout} PM · ${texteSort(s)}`;
    return `<button class="cmd ${a.type === 'ultime' ? 'ultime' : 'sort'}${choix === a.type ? ' choisi' : ''}"
      data-a="${a.type}" ${a.possible ? '' : 'disabled'}><b>${txt(a.nom)}</b><i>${txt(aide)}</i></button>`;
  };
  const objet = (t) => {
    const a = par[t];
    return `<button class="cmd${choix === t ? ' choisi' : ''}" data-a="${t}" ${a.possible ? '' : 'disabled'}
      title="${txt(OBJETS[t].texte)}"><b>${OBJETS[t].glyphe} ×${a.quantite}</b><i>${OBJETS[t].nom.split(' ')[0]}</i></button>`;
  };
  $('commandes').innerHTML = `
    <div class="cmd-titre">Au tour de <b>${txt(h.nom)}</b>${choix ? ' — choisissez une cible' : ''}</div>
    <div class="cmd-grille">
      <button class="cmd${choix === 'attaque' ? ' choisi' : ''}" data-a="attaque"><b>⚔ Attaque</b><i>Dégâts ×1 · +2 PM</i></button>
      <button class="cmd" data-a="defendre"><b>🛡 Défendre</b><i>Moitié des dégâts · +4 PM</i></button>
      ${sort(par.special)}
      ${sort(par.ultime)}
    </div>
    <div class="cmd-objets">${objet('potion')}${objet('elixir')}${objet('phenix')}</div>
    <div class="cmd-aide">${choix ? '<button class="mini-btn" data-a="annuler">Annuler</button>' : ''}</div>`;
  for (const el of $('commandes').querySelectorAll('[data-a]')) {
    el.addEventListener('click', () => choisir(el.dataset.a));
  }
  marquerCibles();
}

function choisir(type) {
  if (anime || !actif(b)) return;
  o.sfx.tap();
  if (type === 'annuler') { choix = null; commandes(); return; }
  const a = actionsDe(b).find((x) => x.type === type);
  if (!a || !a.possible) return;
  if (a.cibles === 'ennemi') {
    const l = vivants(b.ennemis);
    if (l.length === 1) return executer({ type, cible: l[0].idx });
  } else if (a.cibles === 'allie' || a.cibles === 'tombe') {
    const l = b.heros.filter((x) => (a.cibles === 'tombe' ? x.pv <= 0 : x.pv > 0));
    if (l.length === 1) return executer({ type, cible: l[0].idx });
  } else {
    return executer({ type });
  }
  choix = choix === type ? null : type;
  commandes();
}

/** Les cibles possibles brillent ; sur un ennemi, on montre les dégâts attendus. */
function marquerCibles() {
  for (const el of document.querySelectorAll('#s-combat .unite')) {
    el.classList.remove('ciblable');
    const e = el.querySelector('.estime');
    if (e) e.remove();
  }
  if (!choix) return;
  const h = actif(b);
  const a = actionsDe(b).find((x) => x.type === choix);
  if (a.cibles === 'ennemi') {
    for (const e of vivants(b.ennemis)) {
      const el = noeud('e', e.idx);
      el.classList.add('ciblable');
      const s = h.sorts[choix];
      const mult = choix === 'attaque' ? 1 : s.mult * (s.effet && s.effet.type === 'double' ? 1.2 : 1);
      const perce = s && s.effet && s.effet.type === 'perce' && choix !== 'attaque' ? s.effet.valeur : 0;
      const d = estimer(b, h, e, mult, { perce, basique: choix === 'attaque' }).degats;
      const m = multiplicateur(h.ecole, e.ecole);
      el.insertAdjacentHTML('beforeend', `<span class="estime">≈${d}${m > 1 ? ' ▲' : m < 1 ? ' ▼' : ''}</span>`);
    }
  } else {
    for (const x of b.heros) {
      if (a.cibles === 'tombe' ? x.pv <= 0 : x.pv > 0) noeud('h', x.idx).classList.add('ciblable');
    }
  }
}

function toucherUnite(camp, idx) {
  if (anime) return;
  const u = uniteDe(camp, idx);
  if (choix) {
    const a = actionsDe(b).find((x) => x.type === choix);
    const bon = a.cibles === 'ennemi' ? camp === 'e' && u.pv > 0
      : camp === 'h' && (a.cibles === 'tombe' ? u.pv <= 0 : u.pv > 0);
    if (bon) executer({ type: choix, cible: idx });
    return;
  }
  if (camp === 'e') {
    const traits = u.traits.map((t) => TRAITS_RPG[t] && TRAITS_RPG[t].texte).filter(Boolean);
    o.toast(`${u.nom} — ATQ ${u.atk} · DEF ${u.def}${traits.length ? ` · ${traits.join(' ')}` : ''}`);
  }
}

function executer(action) {
  choix = null;
  const r = agir(b, action);
  if (!r.ok) { commandes(); return; }
  jouer(r.evenements);
}

async function tourAuto() {
  await attendre(380);
  if (!auto || anime || !b || b.fini || !actif(b)) return;
  executer(choisirAction(b));
}

/* ------------------------------------------------------------------ */
/* Fin                                                                 */
/* ------------------------------------------------------------------ */

function fin() {
  const v = b.victoire;
  if (v) o.sfx.victoire(); else o.sfx.defaite();
  $('journal').innerHTML = v ? '<span>Le dernier ennemi tombe.</span>' : '<span>Le groupe s’effondre…</span>';
  $('commandes').innerHTML = `<div class="fin-combat ${v ? 'gagne' : 'perdu'}">
    <h3>${v ? 'Victoire !' : 'Défaite…'}</h3>
    <button class="btn btn-go btn-wide" id="b-fin">${v ? 'Récupérer le butin' : 'Continuer'}</button>
  </div>`;
  $('b-fin').addEventListener('click', () => {
    const bataille = b;
    b = null;
    o.surFin(bataille.victoire);
  });
}
