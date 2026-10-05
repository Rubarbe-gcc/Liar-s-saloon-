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
import { aUnPortrait, portraitSvg, criDePhase } from './boss.js';
import { texteEveil } from '../../../shared/raid/eveils.js';
import { RAGE } from '../../../shared/raid/bataille.js';

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
  fermerFiche();
  vue.clear();
  for (const u of [...b.heros, ...b.ennemis]) vue.set(cle(u.camp, u.idx), { pv: u.pv, pm: u.pm ?? 0 });
  $('b-auto').setAttribute('aria-pressed', String(auto));
  $('journal').innerHTML = o.intro || 'Le combat commence.';
  construire();
  $('commandes').innerHTML = '';
  const boss = b.ennemis.find((e) => e.rang === 'boss');
  if (!boss) { jouer(demarrer(b)); return; }
  // Un boss se présente : son nom barre l'écran avant le premier coup.
  const enCours = b;
  anime = true;
  const ban = document.createElement('div');
  ban.className = 'banniere-boss';
  ban.style.setProperty('--aff', teinte(boss.ecole));
  const [nom, ...titre] = boss.nom.split(/, | (?=l[ea] )/);
  ban.innerHTML = `<i>Boss du chapitre</i><b>${txt(nom)}</b>${titre.length ? `<span>${txt(titre.join(' '))}</span>` : ''}`;
  $('s-combat').appendChild(ban);
  o.sfx.rage();
  setTimeout(() => {
    ban.remove();
    if (b === enCours) jouer(demarrer(b));
  }, 1900);
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
  const portrait = ennemi && aUnPortrait(u);
  const classe = `unite${portrait ? (u.rang === 'boss' ? ' boss' : ' elite') : ''}`;
  return `<div class="${classe}" data-u="${cle(u.camp, u.idx)}" style="--aff:${teinte(u.ecole)}">
    <span class="ecole-pt"></span>
    <span class="etats"></span>
    ${portrait ? `<div class="cadre-portrait">${portraitSvg(u)}</div>` : `<div class="pied">${spriteSvg(u)}</div>`}`
    + `${portrait && u.rang === 'boss' ? '<div class="rang-boss">👑 Boss</div>' : ''}` + `
    <div class="nom">${txt(u.nom)}${ennemi ? '' : ` <i>niv. ${u.niveau}</i>`}</div>
    <div class="jauge ${ennemi ? 'ennemi' : 'pv'}"><i></i></div>
    ${ennemi ? '' : '<div class="jauge pm"><i></i></div>'}
    <div class="chiffres"><span class="pv-txt"></span><span>${ennemi ? traits : `<span class="pm-txt"></span>`}</span></div>
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
  if (u.camp === 'h') {
    el.querySelector('.jauge.pm').style.setProperty('--v', (v.pm / u.pmMax).toFixed(3));
    el.querySelector('.pm-txt').textContent = `${Math.round(v.pm)} PM`;
  } else {
    el.classList.toggle('enrage', !!u.enrage);
    const al = el.querySelector('.alerte');
    const r = u.charge.reste;
    al.classList.toggle('imminente', r <= 1);
    al.textContent = r <= 2
      ? `⚡ ${u.charge.nom} ${r <= 1 ? '— au prochain tour !' : '— dans 2 tours'}${u.charge.zone ? ' · tout le groupe' : ''}`
      : '';
  }
  // Les effets en cours : vert pour ce qui aide l'unité, rouge pour ce qui lui nuit.
  el.querySelector('.etats').innerHTML = v.pv <= 0 ? '' : effetsDe(u).filter((e) => !e.permanent)
    .map((e) => `<span class="${e.bon ? 'bon' : 'mauvais'}">${e.glyphe}</span>`).join('');
  const a = actif(b);
  el.classList.toggle('actif', !anime && !!a && u.camp === 'h' && a.idx === u.idx);
}

const manches = (n) => `${n} manche${n > 1 ? 's' : ''}`;

/**
 * Tout ce qui pèse sur une unité en ce moment. `bon` dit si l'effet l'aide
 * (vert) ou lui nuit (rouge) ; `permanent` marque les capacités d'un monstre,
 * qui ne s'usent pas.
 */
function effetsDe(u) {
  const out = [];
  if (u.camp === 'h') {
    if (u.defense) out.push({ glyphe: '🛡', nom: 'En défense', bon: true, texte: 'Moitié des dégâts jusqu’à son prochain tour.' });
    if (b.bouclier) out.push({ glyphe: '🔰', nom: 'Bouclier', bon: true, texte: `−${Math.round(b.bouclier.valeur * 100)} % de dégâts subis, encore ${manches(b.bouclier.tours)}.` });
    if (b.provoc && b.provoc.idx === u.idx) out.push({ glyphe: '🎯', nom: 'Provocation', bon: true, texte: `Tous les ennemis doivent l’attaquer, et il encaisse 30 % de dégâts en moins. Encore ${manches(b.provoc.tours)}.` });
    if (b.serment) out.push({ glyphe: '⚜️', nom: 'Serment d’acier', bon: true, texte: `Ne peut pas tomber sous 1 PV, encore ${manches(b.serment.tours)}.` });
    if (b.elan) out.push({ glyphe: '✨', nom: 'Élan', bon: true, texte: `+${Math.round(b.elan.valeur * 100)} % de dégâts, encore ${manches(b.elan.tours)}.` });
    if (b.regen) out.push({ glyphe: '🌱', nom: 'Régénération', bon: true, texte: `+${Math.round(b.regen.valeur * 100)} % de vie à chaque fin de manche, encore ${manches(b.regen.tours)}.` });
    if (b.represailles) out.push({ glyphe: '🌵', nom: 'Représailles', bon: true, texte: `Renvoie ${Math.round(b.represailles.valeur * 100)} % des dégâts reçus, encore ${manches(b.represailles.tours)}.` });
    if (b.riposte && b.riposte.idx === u.idx) out.push({ glyphe: '⚔️', nom: 'Riposte', bon: true, texte: `Rend coup pour coup, encore ${manches(b.riposte.tours)}.` });
    if (u.poison && u.poison.tours > 0) out.push({ glyphe: '☠', nom: 'Empoisonné', bon: false, texte: `${u.poison.degats} dégâts à chaque fin de manche, encore ${manches(u.poison.tours)}.` });
  } else {
    if (u.enrage) out.push({ glyphe: '😡', nom: 'Enragé', bon: true, texte: `+${Math.round(RAGE * 100)} % d’attaque jusqu’à la fin du combat.` });
    if (u.brasier && u.brasier.tours > 0) out.push({ glyphe: '🔥', nom: 'Brûlure', bon: false, texte: `${u.brasier.degats} dégâts à chaque fin de manche, encore ${manches(u.brasier.tours)}.` });
    if (u.etourdi) out.push({ glyphe: '💫', nom: 'Étourdi', bon: false, texte: 'Passe son prochain tour.' });
    if (u.entrave) out.push({ glyphe: '⛓', nom: 'Affaibli', bon: false, texte: `−${Math.round(u.entrave.valeur * 100)} % d’attaque, encore ${manches(u.entrave.tours)}.` });
    if (u.fragile) out.push({ glyphe: '🎯', nom: 'Fragilisé', bon: false, texte: `Subit ${Math.round(u.fragile.valeur * 100)} % de dégâts en plus, encore ${manches(u.fragile.tours)}.` });
    for (const t of u.traits) {
      const tr = TRAITS_RPG[t];
      if (!tr) continue;
      const [nom, ...reste] = tr.texte.split(' : ');
      const dit = reste.join(' : ');
      out.push({ glyphe: tr.glyphe, nom, bon: true, permanent: true, texte: dit.charAt(0).toUpperCase() + dit.slice(1) });
    }
  }
  return out;
}

/** Les effets qui valent pour tout le groupe, rappelés en clair au-dessus des héros. */
function majEffetsGroupe() {
  const l = [];
  if (b.bouclier) l.push(`<span class="bon">🔰 Bouclier −${Math.round(b.bouclier.valeur * 100)} % · ${manches(b.bouclier.tours)}</span>`);
  if (b.elan) l.push(`<span class="bon">✨ Élan +${Math.round(b.elan.valeur * 100)} % · ${manches(b.elan.tours)}</span>`);
  if (b.regen) l.push(`<span class="bon">🌱 Régénération · ${manches(b.regen.tours)}</span>`);
  if (b.represailles) l.push(`<span class="bon">🌵 Représailles · ${manches(b.represailles.tours)}</span>`);
  if (b.serment) l.push(`<span class="bon">⚜️ Serment d’acier : personne ne tombe · ${manches(b.serment.tours)}</span>`);
  if (b.provoc && b.heros[b.provoc.idx].pv > 0) l.push(`<span class="bon">🎯 ${txt(b.heros[b.provoc.idx].nom)} provoque · ${manches(b.provoc.tours)}</span>`);
  if (b.coeur) l.push('<span class="bon">🔥 Cœur de phénix prêt</span>');
  $('effets-groupe').innerHTML = l.join('');
  $('effets-groupe').hidden = !l.length;
}

/** La fiche d'une unité : ses chiffres, et le détail de chaque effet. */
function ouvrirFiche(u) {
  fermerFiche();
  const effets = effetsDe(u);
  const ligne = (e) => `<li class="${e.bon ? 'bon' : 'mauvais'}"><b>${e.glyphe} ${txt(e.nom)}</b><span>${txt(e.texte)}</span></li>`;
  const temporaires = effets.filter((e) => !e.permanent);
  const capacites = effets.filter((e) => e.permanent);
  const charge = u.camp === 'e'
    ? `<li class="neutre"><b>⚡ ${txt(u.charge.nom)}</b><span>Attaque chargée ${u.charge.zone ? 'sur tout le groupe' : 'sur un héros'}, dans ${u.charge.reste <= 1 ? 'un tour' : `${u.charge.reste} tours`}.</span></li>` : '';
  const f = document.createElement('div');
  f.className = 'fiche-unite';
  f.innerHTML = `<div class="fiche-boite" style="--aff:${teinte(u.ecole)}">
    <h3>${txt(u.nom)}${u.camp === 'h' ? ` <small>niv. ${u.niveau}</small>` : ''}</h3>
    <p class="fiche-stats">PV ${Math.max(0, Math.round(u.pv))}/${u.pvMax}${u.camp === 'h' ? ` · PM ${Math.round(u.pm)}/${u.pmMax}` : ''} · ATQ ${u.atk} · DEF ${u.def} · VIT ${u.vit}</p>
    <h4>Effets en cours</h4>
    <ul>${temporaires.map(ligne).join('') || '<li class="neutre"><span>Aucun effet pour l’instant.</span></li>'}${charge}</ul>
    ${capacites.length ? `<h4>Capacités</h4><ul>${capacites.map(ligne).join('')}</ul>` : ''}
    <button class="btn btn-ghost btn-wide">Fermer</button>
  </div>`;
  f.addEventListener('click', (ev) => { if (ev.target === f || ev.target.closest('button')) fermerFiche(); });
  $('s-combat').appendChild(f);
}

function fermerFiche() {
  const f = document.querySelector('.fiche-unite');
  if (f) f.remove();
}

function maj() {
  majEffetsGroupe();
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
      if (ev.genre === 'etourdi') { $('journal').innerHTML = `<span>💫 <b>${txt(u.nom)}</b> est étourdi et perd son tour.</span>`; await attendre(420); break; }
      if (ev.genre === 'eveil') { $('journal').innerHTML = `<span>✦ <b>${txt(u.nom)}</b> s’éveille : <b>${txt(ev.nom)}</b> !</span>`; s.ultime(); await attendre(620); break; }
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
      else if (ev.n < 0) flotter(ev.camp, ev.idx, `${ev.n} PM`, 'pm perte');
      majUnite(uniteDe(ev.camp, ev.idx));
      await attendre(100);
      break;
    }
    case 'releve': {
      vue.get(cle(ev.camp, ev.idx)).pv = ev.pv;
      s.soin();
      if (ev.relique) $('journal').innerHTML = `<span>🔥 Le <b>Cœur de phénix</b> relève ${txt(uniteDe(ev.camp, ev.idx).nom)} !</span>`;
      majUnite(uniteDe(ev.camp, ev.idx));
      majEffetsGroupe();
      await attendre(ev.relique ? 600 : 250);
      break;
    }
    case 'phase': {
      // Le boss se relève sous une autre forme : nouveau portrait, nouvelle barre.
      const u = uniteDe(ev.camp, ev.idx);
      const el = noeud(ev.camp, ev.idx);
      vue.get(cle(ev.camp, ev.idx)).pv = 0;
      majUnite({ ...u, pvMax: u.pvMax });
      s.ko();
      await attendre(500);
      const ban = document.createElement('div');
      ban.className = 'banniere-boss';
      ban.style.setProperty('--aff', teinte(u.ecole));
      const [nom, ...titre] = ev.nom.split(/, | (?=l[ea] )/);
      ban.innerHTML = `<i>Phase ${ev.n} sur ${ev.sur}</i><b>${txt(nom)}</b>${titre.length ? `<span>${txt(titre.join(' '))}</span>` : ''}`;
      $('s-combat').appendChild(ban);
      s.rage();
      // La carte est refaite derrière la bannière.
      if (el) {
        const neuf = document.createElement('div');
        neuf.innerHTML = carteUnite(u);
        const carte = neuf.firstElementChild;
        carte.addEventListener('click', () => toucherUnite(carte.dataset.u[0], +carte.dataset.u.slice(1)));
        el.replaceWith(carte);
      }
      vue.get(cle(ev.camp, ev.idx)).pv = ev.pv;
      majUnite(u);
      const cri = criDePhase(u);
      $('journal').innerHTML = `<span>⚠ <b>${txt(ev.nom)}</b>${cri ? ` — ${txt(cri)}` : ''}</span>`;
      await attendre(1900);
      ban.remove();
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
        provoc: () => `🎯 <b>${txt(u.nom)}</b> provoque : tous les ennemis doivent le frapper !`,
        purge: () => '🌿 Les poisons se dissipent.',
        serment: () => '⚜️ Serment d’acier : tant qu’il tient, personne ne tombe.',
        etourdi: () => `💫 <b>${txt(u.nom)}</b> est étourdi.`,
        fragile: () => `🎯 <b>${txt(u.nom)}</b> est fragilisé.`,
        regen: () => '🌱 Le groupe se régénère.',
        represailles: () => '🌵 Représailles : chaque coup reçu sera rendu.',
        riposte: () => `⚔️ <b>${txt(u.nom)}</b> se met en garde et ripostera.`,
        retard: () => '⏳ Les attaques chargées des ennemis reculent d’un tour.',
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
    ${par.eveil ? `<button class="cmd eveil${choix === 'eveil' ? ' choisi' : ''}" data-a="eveil" ${par.eveil.possible ? '' : 'disabled'}>
      <b>✦ ${par.eveil.eveil.glyphe} ${txt(par.eveil.nom)}</b><i>${par.eveil.cout} PM · ${txt(texteEveil(par.eveil.eveil))}</i></button>` : ''}
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
      const dg = choix === 'eveil' ? h.eveil.degats : null;
      const s = dg ? null : h.sorts[choix];
      const mult = dg ? dg.mult * (dg.coups || 1) : choix === 'attaque' ? 1 : s.mult * (s.effet && s.effet.type === 'double' ? 1.2 : 1);
      const perce = dg ? (dg.perce || 0) : s && s.effet && s.effet.type === 'perce' && choix !== 'attaque' ? s.effet.valeur : 0;
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
  ouvrirFiche(u);
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
    <button class="btn btn-go btn-wide" id="b-fin">${v ? (o.dernier ? 'Voir la fin' : 'Récupérer le butin') : 'Continuer'}</button>
  </div>`;
  $('b-fin').addEventListener('click', () => {
    const enCours = b;
    b = null;
    o.surFin(enCours.victoire);
  });
}
