/**
 * BRASIER — le rendu du recrutement.
 *
 * Tout se redessine depuis la vue envoyée par le serveur. L'écran ne garde
 * pour lui que ce qui n'a pas d'effet sur la partie : quel serviteur est
 * sélectionné, lesquels viennent d'apparaître (pour les faire surgir).
 */

import {
  getServiteur, texte, TRIBUS, MOTS,
} from '../../../shared/brasier/serviteurs.js';
import { getHeros } from '../../../shared/brasier/heros.js';
import {
  MODES, getQuete, getSort, getAnomalie, recompenseTexte,
} from '../../../shared/brasier/modes.js';
import {
  PHASE, COUT_SERVITEUR, PLATEAU_MAX, MAIN_MAX, OR_MAX,
} from '../../../shared/brasier/partie.js';
import * as succes from '../../../shared/succes.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Écrans, messages                                                    */
/* ------------------------------------------------------------------ */

export function montrer(id) {
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('actif', e.id === `e-${id}`));
}

let toastT = null;
export function toast(msg, ms = 2000) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

/* ------------------------------------------------------------------ */
/* Le médaillon                                                        */
/* ------------------------------------------------------------------ */

const MOTS_VISIBLES = ['provocation', 'bouclier', 'venin', 'furie', 'reincarnation', 'balayage'];

/**
 * @param {{uid:string,id:string,atk:number,pv:number,mots:string[],dore:boolean}} u
 * @param {{cls?:string, prix?:boolean, pvMax?:number}} [o]
 */
export function medaillon(u, o = {}) {
  const d = getServiteur(u.id);
  const k = u.dore ? 2 : 1;
  const marques = [
    d.rale ? '💀' : '', d.debut ? '⚡' : '', d.fin ? '⏳' : '', d.allieMeurt ? '🩸' : '', d.allieJoue ? '📈' : '',
    u.mots.includes('balayage') ? '🪓' : '', u.mots.includes('venin') ? '☠️' : '',
  ].join('');
  const cls = [
    'srv', `t-${d.tribu}`, u.dore ? 'dore' : '',
    ...u.mots.filter((m) => MOTS_VISIBLES.includes(m)), o.cls || '',
  ].filter(Boolean).join(' ');
  const blesse = o.pvMax !== undefined && u.pv < o.pvMax;
  return `<div class="${cls}" data-uid="${esc(u.uid)}" title="${esc(d.nom)}">
    <span class="srv-rang">${'★'.repeat(d.tier)}</span>
    <div class="srv-cadre"><div class="srv-art"><span>${d.glyph}</span></div></div>
    <span class="srv-atk${u.atk > d.atk * k ? ' gonfle' : ''}">${u.atk}</span>
    <span class="srv-pv${blesse ? ' blesse' : (u.pv > d.pv * k ? ' gonfle' : '')}">${u.pv}</span>
    ${marques ? `<span class="srv-marques">${marques}</span>` : ''}
    ${o.prix ? `<span class="srv-prix">${COUT_SERVITEUR}</span>` : ''}
    ${u.recompense ? '<span class="srv-recompense" title="Posez-le : découverte offerte">🎁</span>' : ''}
    ${o.extra || ''}
  </div>`;
}

export function portrait(herosId, pv, o = {}) {
  const h = getHeros(herosId);
  return `<div class="portrait${o.grand ? ' grand' : ''}" style="--hc:${h ? h.couleur : '#c89b52'}"
    title="${esc(h ? h.nom : '')}">${h ? h.glyph : '❔'}${pv !== undefined ? `<span class="portrait-pv">${pv}</span>` : ''}</div>`;
}

/** Texte d'aide d'un serviteur : effets, puis mots-clés expliqués. */
function detail(u) {
  const d = getServiteur(u.id);
  const t = TRIBUS[d.tribu];
  const mots = u.mots.map((m) => MOTS[m]).filter(Boolean)
    .map((m) => `<span>${m.glyph} <b>${m.label}</b> — ${m.texte}</span>`).join('');
  return `<div class="fiche-texte">
    <span class="fiche-nom">${u.dore ? '✨ ' : ''}${esc(d.nom)}</span>
    <span class="fiche-meta">${'★'.repeat(d.tier)} · ${t.glyph} ${t.label}${u.dore ? ' · doré' : ''}${d.exclusif ? ' · 📜 exclusif de quête' : ''}</span>
    ${u.recompense ? '<span class="fiche-dit">🎁 Triple ! Posez-le sur le plateau pour découvrir un serviteur d’un rang au-dessus.</span>' : ''}
    ${texte(u.id, u.dore) ? `<span class="fiche-dit">${texte(u.id, u.dore)}</span>` : ''}
    ${mots ? `<span class="fiche-mots">${mots}</span>` : ''}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Recrutement                                                         */
/* ------------------------------------------------------------------ */

let agir = () => {};
let vue = null;
let choix = null;           // { zone: 'boutique'|'plateau'|'main', uid }
const connus = { boutique: new Set(), plateau: new Set(), main: new Set() };
const listeDe = (m, zone) => (zone === 'boutique' ? m.boutique : zone === 'main' ? m.main : m.plateau);

export function brancher(fn) { agir = fn; }
export const vueCourante = () => vue;

/** Donne à une rangée son nombre d'occupants : la taille des médaillons en dépend. */
export function compter(host) {
  host.style.setProperty('--n', Math.max(4, host.querySelectorAll('.srv:not(.meurt)').length));
}

/**
 * Les boutons d'un serviteur sélectionné, posés sur lui plutôt qu'ailleurs :
 * au doigt, une action doit se trouver là où l'on vient de toucher. Ceux du
 * bord gauche ou droit s'alignent sur leur bord, pour ne pas sortir de l'écran.
 */
function actionsDe(zone, i, n, m) {
  const bord = n >= 3 && i === 0 ? ' g' : (n >= 3 && i === n - 1 ? ' d' : '');
  if (zone === 'boutique') {
    const peut = m.or >= COUT_SERVITEUR && m.main.length < MAIN_MAX;
    const pourquoi = m.main.length >= MAIN_MAX ? 'Main pleine' : 'Pas assez d\'or';
    return `<div class="srv-actions bas${bord}">
      <button data-f="acheter" class="a-acheter" ${peut ? '' : 'disabled'}>${peut ? `Acheter · ${COUT_SERVITEUR}🪙` : pourquoi}</button></div>`;
  }
  return `<div class="srv-actions haut${bord}">
    <button data-f="gauche" ${i <= 0 ? 'disabled' : ''} aria-label="Vers la gauche">◀</button>
    <button data-f="vendre" class="a-vendre">Vendre · +1🪙</button>
    <button data-f="droite" ${i >= n - 1 ? 'disabled' : ''} aria-label="Vers la droite">▶</button></div>`;
}

function rangee(host, zone, liste, o) {
  host.style.setProperty('--n', Math.max(4, liste.length));
  const avant = connus[zone];
  const m = vue.moi;
  const html = liste.map((u, i) => {
    const choisi = choix && choix.zone === zone && choix.uid === u.uid;
    return medaillon(u, {
      ...o,
      cls: [choisi ? 'choisi' : '', avant.has(u.uid) ? '' : 'nouveau'].join(' '),
      extra: choisi && !m.mort && zone !== 'main' ? actionsDe(zone, i, liste.length, m) : '',
    });
  }).join('');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
  connus[zone] = new Set(liste.map((u) => u.uid));
}

export function rendreRecrutement(v) {
  vue = v;
  const m = v.moi;
  if (!m) return;
  if (m.taverne >= 6) succes.debloquer('brasier-rang6');
  if (v.joueurs.find((j) => j.id === m.id)?.triples > 0) succes.debloquer('brasier-triple');

  $('r-tour').textContent = `Tour ${v.tour}`;
  $('r-etoiles').innerHTML = Array.from({ length: 6 }, (_, k) => (k < m.taverne ? '★' : '<i>★</i>')).join('');
  rendreMode(v);
  rendreQuete(m);
  rendreSorts(m);
  $('r-cout-rang').textContent = m.taverne >= 6 ? '—' : m.coutRang;
  $('b-ameliorer').disabled = m.mort || m.taverne >= 6 || m.or < m.coutRang;
  const coutRafr = m.rafraichiGratuit ? 0 : 1;
  $('r-cout-rafr').textContent = coutRafr;
  $('b-rafraichir').disabled = m.mort || m.or < coutRafr;
  $('b-geler').classList.toggle('actif', m.gel);
  $('b-geler').disabled = m.mort;
  $('taverne').classList.toggle('gel', m.gel);

  // Une sélection qui a disparu (achetée, vendue) se referme d'elle-même.
  if (choix) {
    const liste = listeDe(m, choix.zone);
    if (!liste.some((u) => u.uid === choix.uid)) choix = null;
  }

  rangee($('boutique'), 'boutique', m.boutique, { prix: true });
  if (!m.boutique.length) {
    $('boutique').innerHTML = `<span class="vide-taverne">${m.mort ? 'La taverne vous est fermée.' : 'La taverne est vide. Rafraîchissez-la.'}</span>`;
    $('boutique').dataset.sig = '';
  }
  rangee($('plateau'), 'plateau', m.plateau, {});
  rangee($('main'), 'main', m.main || [], {});
  $('r-main-n').textContent = `${(m.main || []).length}/${MAIN_MAX}`;
  $('boutique').querySelectorAll('.srv').forEach((el) => el.classList.toggle('gele', m.gel));

  // Le héros et son pouvoir.
  const h = getHeros(m.heros);
  const p = h ? h.pouvoir : null;
  const cout = m.coutPouvoir ?? (p ? p.cout : 0);
  const pouvoirOff = !p || p.passif || m.pouvoirUtilise || m.or < cout || m.mort;
  $('r-heros').innerHTML = `${portrait(m.heros, m.pv)}
    ${p ? `<button class="pouvoir${p.passif ? ' passif' : ''}" id="b-pouvoir" ${pouvoirOff ? 'disabled' : ''}
      title="${esc(p.texte)}">
      <b>${p.passif ? 'Passif' : 'Pouvoir'} ${p.passif ? '' : `<span class="cout">${cout}</span>`}${m.pouvoirUtilise ? ' ✓' : ''}</b>
      <i>${esc(p.texte)}</i></button>` : ''}`;

  // L'or : une pièce par pièce, et celles d'avance en bleu.
  $('r-or').textContent = m.or;
  const pleines = Math.min(m.or, OR_MAX + 4);
  $('r-pieces').innerHTML = Array.from({ length: Math.max(m.orMax, pleines) }, (_, k) =>
    `<i class="${k < m.or ? (k >= m.orMax ? 'bonus' : '') : 'vide'}"></i>`).join('');

  const pret = $('b-pret');
  pret.classList.toggle('fait', m.pret);
  pret.textContent = m.mort ? 'Éliminé' : (m.pret ? 'Prêt ✓' : 'Prêt ⚔️');
  pret.disabled = m.mort;

  rendreFiche();
  rendreClassement(v);
  rendreDecouverte(m);
}

function rendreFiche() {
  const m = vue && vue.moi;
  const u = m && choix ? listeDe(m, choix.zone).find((x) => x.uid === choix.uid) : null;
  $('fiche-vide').hidden = !!u;
  const c = $('fiche-contenu');
  c.hidden = !u;
  if (!u) return;
  let actions = '';
  if (choix.zone === 'main' && !m.mort) {
    const plein = m.plateau.length >= PLATEAU_MAX;
    actions = `<div class="fiche-actions">
      <button class="bouton bouton-braise" data-f="poser" ${plein ? 'disabled' : ''}>${plein ? 'Plateau plein' : 'Poser ▲'}</button>
      <button class="bouton" data-f="vendreMain">Vendre · +1🪙</button></div>`;
  }
  c.innerHTML = detail(u) + actions;
}

/* ------------------------------------------------------------------ */
/* Parties spéciales : Quête, Anomalie                                 */
/* ------------------------------------------------------------------ */

/** Ce que dit une partie de son genre : le titre, et chaque règle en plus. */
export function modeHtml(v) {
  const mode = MODES[v.mode] || MODES.classique;
  if (v.mode === 'quete') {
    return `<h3 class="mode-titre">${mode.glyph} Partie QUÊTE</h3>
      <p>Au tour 3, chacun choisit une quête parmi trois. Récompense : un serviteur exclusif, des cartes spéciales ou de l’or.</p>`;
  }
  if (v.mode === 'anomalie') {
    return `<h3 class="mode-titre">${mode.glyph} Partie ANOMALIE</h3>${v.anomalies.map((id) => {
      const a = getAnomalie(id);
      const t = id === 'tribu-honneur' && v.tribuHonneur ? TRIBUS[v.tribuHonneur] : null;
      return `<p class="anomalie"><b>${a.glyph} ${esc(a.nom)}</b> — ${esc(a.texte)}${t ? ` Cette partie : <b>${t.glyph} ${t.label}s</b>.` : ''}</p>`;
    }).join('')}`;
  }
  return '';
}

function rendreMode(v) {
  const b = $('r-mode');
  if (!v.mode || v.mode === 'classique') { b.hidden = true; return; }
  b.hidden = false;
  b.className = `mode-puce ${v.mode}`;
  b.textContent = v.mode === 'quete' ? '📜 Quête'
    : `🌀 ${v.anomalies.map((id) => getAnomalie(id).glyph).join(' ')}`;
  b.title = v.mode === 'quete' ? 'Partie Quête' : `Anomalie : ${v.anomalies.map((id) => getAnomalie(id).nom).join(', ')}`;
}

let queteFaite = null;

function rendreQuete(m) {
  const b = $('r-quete');
  const q = m.quete;
  // Une quête qui vient d'aboutir : on le fête.
  if (q && q.faite && queteFaite === false) {
    toast(`📜 Quête accomplie ! ${recompenseTexte(q.recompense)}`, 3500);
    succes.debloquer('brasier-quete');
  }
  queteFaite = q ? q.faite : null;
  if (!q) { b.hidden = true; } else {
    const d = getQuete(q.id);
    b.hidden = false;
    b.classList.toggle('faite', q.faite);
    b.innerHTML = q.faite ? `${d.glyph} Quête accomplie ✓` : `${d.glyph} ${q.progres}/${d.n}`;
    b.title = `${d.nom} — ${d.texte} Récompense : ${recompenseTexte(q.recompense)}`;
  }
  // L'offre de quêtes, au tour 3.
  const ov = $('ov-quete');
  if (!m.offreQuete || m.mort) { ov.hidden = true; return; }
  const html = m.offreQuete.map((o, i) => {
    const d = getQuete(o.id);
    return `<button class="carte-heros carte-quete r-${o.recompense.type}" data-quete="${i}">
      <span class="quete-glyphe">${d.glyph}</span>
      <b>${esc(d.nom)}</b>
      <span class="quete-objectif">${esc(d.texte)}</span>
      <span class="quete-recompense"><i>Récompense</i>${esc(recompenseTexte(o.recompense))}</span>
    </button>`;
  }).join('');
  const host = $('quete-choix');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
  ov.hidden = false;
}

function rendreSorts(m) {
  const host = $('r-sorts');
  const sorts = m.sorts || [];
  host.hidden = !sorts.length;
  const html = sorts.map((c, i) => {
    const d = getSort(c.id);
    const off = m.mort || (d.plateau && !m.plateau.length);
    return `<button class="sort" data-sort="${i}" ${off ? 'disabled' : ''} title="${esc(d.nom)} — ${esc(d.texte)}">
      <span>${d.glyph}</span><b>${esc(d.nom)}</b></button>`;
  }).join('');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
}

export function montrerMode(v) {
  if (!v || !v.mode || v.mode === 'classique') return;
  let html = modeHtml(v);
  const q = v.moi && v.moi.quete;
  if (q) {
    const d = getQuete(q.id);
    html += `<p class="anomalie"><b>Votre quête : ${d.glyph} ${esc(d.nom)}</b> — ${esc(d.texte)}
      (${q.faite ? 'accomplie ✓' : `${q.progres}/${d.n}`})<br>Récompense : ${esc(recompenseTexte(q.recompense))}</p>`;
  }
  $('mode-detail').innerHTML = html;
  $('ov-mode').hidden = false;
}

function rendreClassement(v) {
  const moiId = v.moi ? v.moi.id : null;
  const tri = [...v.joueurs].sort((a, b) => (a.mort - b.mort) || (a.mort ? a.place - b.place : b.pv - a.pv));
  $('classement').innerHTML = tri.map((j) => {
    const h = getHeros(j.heros);
    const t = j.tribu ? TRIBUS[j.tribu] : null;
    return `<div class="cl${j.id === moiId ? ' moi' : ''}${j.mort ? ' mort' : ''}" title="${esc(j.name)}${h ? ` — ${esc(h.nom)}` : ''}">
      ${t ? `<span class="cl-tribu" title="${t.label}">${t.glyph}</span>` : ''}
      <span class="cl-rang" title="Rang de taverne">${j.taverne}</span>
      <span class="cl-tete">${h ? h.glyph : '❔'}</span>
      <span class="cl-nom">${esc(j.name)}${j.isBot ? ' 🤖' : ''}${j.queteFaite ? ' <span title="Quête accomplie">📜</span>' : ''}</span>
      ${j.mort ? `<span class="cl-place">${j.place}ᵉ</span>` : `<span class="cl-pv">❤ ${j.pv}</span>`}
      ${j.resultat && !j.mort ? `<span class="cl-res ${j.resultat}">${{ victoire: 'gagné', defaite: 'perdu', nul: 'nul' }[j.resultat]}</span>` : ''}
      ${v.phase === PHASE.RECRUTEMENT && j.pret && !j.isBot && !j.mort ? '<span class="cl-pret">✅</span>' : ''}
    </div>`;
  }).join('');
}

function rendreDecouverte(m) {
  const ov = $('ov-decouverte');
  if (!m.decouverte || m.mort) { ov.hidden = true; return; }
  const html = m.decouverte.map((u, i) => `<button class="choix" data-decouvre="${i}">
      ${medaillon(u)}<b>${esc(getServiteur(u.id).nom)}</b><p>${texte(u.id) || '&nbsp;'}</p></button>`).join('');
  const host = $('decouverte');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
  ov.hidden = false;
}

/* ------------------------------------------------------------------ */
/* Héros, fin                                                          */
/* ------------------------------------------------------------------ */

export function rendreHeros(v, onChoix) {
  const m = v.moi;
  const ov = $('ov-heros');
  if (!m || v.phase !== PHASE.HEROS) { ov.hidden = true; return; }
  const choisi = v.joueurs.find((j) => j.id === m.id)?.aChoisi;
  $('heros-choix').innerHTML = (m.offre || []).map((id) => {
    const h = getHeros(id);
    const p = h.pouvoir;
    return `<button class="carte-heros${m.heros === id ? ' choisi' : ''}" data-heros="${id}" ${choisi ? 'disabled' : ''}>
      ${portrait(id, undefined, { grand: true })}
      <b>${esc(h.nom)}</b>
      <span class="pouvoir${p.passif ? ' passif' : ''}"><b>${p.passif ? 'Passif' : `Pouvoir <span class="cout">${Math.max(0, p.cout - ((v.anomalies || []).includes('heros-inspires') ? 1 : 0))}</span>`}</b><i>${esc(p.texte)}</i></span>
    </button>`;
  }).join('');
  $('heros-attente').hidden = !choisi;
  const annonce = $('heros-mode');
  annonce.innerHTML = modeHtml(v);
  annonce.className = `mode-annonce ${v.mode || ''}`;
  annonce.hidden = !v.mode || v.mode === 'classique';
  ov.hidden = false;
  $('heros-choix').onclick = (e) => {
    const b = e.target.closest('[data-heros]');
    if (b && !b.disabled) onChoix(b.dataset.heros);
  };
}

export function rendreFin(v, { elimine = false } = {}) {
  const m = v.moi;
  if (m && m.place === 1) succes.debloquer('brasier-premier');
  if (m && m.place && m.place <= 4) succes.debloquer('brasier-top4');
  if (m && m.place && m.place <= 4 && v.mode === 'anomalie') succes.debloquer('brasier-anomalie');
  const tri = [...v.joueurs].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  const place = m ? m.place : null;
  $('fin-marque').innerHTML = place === 1 ? '🏆' : (place && place <= 4 ? '🔥' : '💀');
  $('fin-titre').textContent = place === 1 ? 'Dernier debout !'
    : elimine ? `Éliminé — ${place}ᵉ place` : `${place ?? '?'}ᵉ place`;
  $('fin-dit').textContent = elimine
    ? 'Vous pouvez regarder la suite, ou quitter la table.'
    : (v.vainqueur ? `${v.joueurs.find((j) => j.id === v.vainqueur)?.name} remporte le Brasier.` : '');
  $('podium').innerHTML = tri.map((j) => {
    const h = getHeros(j.heros);
    return `<li class="${m && j.id === m.id ? 'moi' : ''}">
      <span class="p-place">${j.place ? ['🥇', '🥈', '🥉'][j.place - 1] || `${j.place}ᵉ` : '…'}</span>
      <span class="p-tete">${h ? h.glyph : '❔'}</span>
      <span class="p-nom">${esc(j.name)}${j.isBot ? ' 🤖' : ''}<i>${h ? esc(h.nom) : ''}</i></span>
      <span class="p-pv">${j.mort && j.place !== 1 ? '' : `❤ ${j.pv}`}</span>
    </li>`;
  }).join('');
  $('b-fin-table').textContent = elimine ? 'Regarder la suite' : 'Retour à la table';
  $('ov-fin').hidden = false;
}

/* ------------------------------------------------------------------ */
/* Interactions                                                        */
/* ------------------------------------------------------------------ */

function selectionner(zone, uid) {
  choix = choix && choix.zone === zone && choix.uid === uid ? null : { zone, uid };
  if (vue) rendreRecrutement(vue);
}

function indexDe(zone, uid) {
  const m = vue && vue.moi;
  if (!m) return -1;
  return listeDe(m, zone).findIndex((u) => u.uid === uid);
}

/** Une action sur un serviteur, désigné par son uid : les index bougent, lui non. */
function faire(f, zone, uid) {
  const i = indexDe(zone, uid);
  if (i < 0) return undefined;
  switch (f) {
    case 'acheter': choix = null; return agir({ type: 'acheter', i });
    case 'vendre': choix = null; return agir({ type: 'vendre', i });
    case 'poser': choix = null; return agir({ type: 'jouer', i });
    case 'vendreMain': choix = null; return agir({ type: 'vendreMain', i });
    case 'gauche': return agir({ type: 'deplacer', de: i, vers: i - 1 });
    case 'droite': return agir({ type: 'deplacer', de: i, vers: i + 1 });
    default: return undefined;
  }
}

/*
 * Toucher, double toucher.
 *
 * Le double toucher se détecte ici plutôt que par l'événement `dblclick`,
 * que les téléphones n'envoient pas de façon fiable — sur iPhone, un double
 * toucher zoomait la page au lieu d'acheter. Sur le plateau, un double toucher
 * garde la sélection au lieu de l'ouvrir puis de la refermer aussitôt.
 */
let dernierToucher = { uid: null, t: 0 };
let ignorerClicsJusqua = 0;

function toucher(zone, el) {
  const uid = el.dataset.uid;
  const t = performance.now();
  const double = dernierToucher.uid === uid && t - dernierToucher.t < 380;
  dernierToucher = double ? { uid: null, t: 0 } : { uid, t };
  if (double && zone === 'boutique') return faire('acheter', zone, uid);
  if (double && zone === 'main') return faire('poser', zone, uid);
  if (double) { choix = { zone, uid }; return rendreRecrutement(vue); }
  return selectionner(zone, uid);
}

for (const zone of ['boutique', 'plateau', 'main']) {
  $(zone).addEventListener('click', (e) => {
    if (performance.now() < ignorerClicsJusqua) return;
    const el = e.target.closest('.srv');
    if (!el) return;
    const b = e.target.closest('[data-f]');
    if (b) { if (!b.disabled) faire(b.dataset.f, zone, el.dataset.uid); return; }
    toucher(zone, el);
  });
}

/*
 * Glisser-déposer, comme à la taverne : de la taverne au plateau pour
 * acheter, du plateau à la taverne pour vendre, sur le plateau pour changer
 * l'ordre d'attaque. Un geste de moins de douze pixels reste un toucher.
 */
let glisse = null;

function zoneSous(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.closest('#taverne')) return 'taverne';
  if (el.closest('#plateau-cadre')) return 'plateau';
  if (el.closest('#main-cadre')) return 'main';
  return null;
}

function nettoyerGlisse(g) {
  if (g.fantome) g.fantome.remove();
  if (g.el) g.el.classList.remove('souleve');
  document.body.classList.remove('glisse-achat', 'glisse-plateau', 'glisse-main');
  $('taverne').classList.remove('depot');
  $('plateau-cadre').classList.remove('depot');
  $('main-cadre').classList.remove('depot');
}

for (const zone of ['boutique', 'plateau', 'main']) {
  $(zone).addEventListener('pointerdown', (e) => {
    if (e.button > 0 || e.target.closest('[data-f]')) return;
    const el = e.target.closest('.srv');
    if (!el || !vue || !vue.moi || vue.moi.mort) return;
    glisse = { zone, uid: el.dataset.uid, el, x0: e.clientX, y0: e.clientY, id: e.pointerId, actif: false };
  });
}

document.addEventListener('pointermove', (e) => {
  const g = glisse;
  if (!g || e.pointerId !== g.id) return;
  if (!g.actif) {
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 12) return;
    g.actif = true;
    const r = g.el.getBoundingClientRect();
    const f = g.el.cloneNode(true);
    f.classList.remove('choisi', 'nouveau');
    f.classList.add('fantome-glisse');
    f.querySelector('.srv-actions')?.remove();
    f.style.setProperty('--w', `${r.width}px`);
    document.body.appendChild(f);
    g.fantome = f;
    g.l = r.width; g.h = r.height;
    g.el.classList.add('souleve');
    document.body.classList.add({ boutique: 'glisse-achat', main: 'glisse-main' }[g.zone] || 'glisse-plateau');
  }
  g.fantome.style.transform = `translate(${e.clientX - g.l / 2}px,${e.clientY - g.h / 2}px) rotate(-4deg) scale(1.08)`;
  const sous = zoneSous(e.clientX, e.clientY);
  $('taverne').classList.toggle('depot', g.zone !== 'boutique' && sous === 'taverne');
  $('plateau-cadre').classList.toggle('depot', g.zone !== 'plateau' && sous === 'plateau');
  $('main-cadre').classList.toggle('depot', g.zone === 'boutique' && sous === 'main');
  e.preventDefault();
}, { passive: false });

function finGlisse(e, annule = false) {
  const g = glisse;
  if (!g || e.pointerId !== g.id) return;
  glisse = null;
  if (!g.actif) return;              // un simple toucher : le clic s'en charge
  ignorerClicsJusqua = performance.now() + 350;
  nettoyerGlisse(g);
  if (annule) return;
  const sous = zoneSous(e.clientX, e.clientY);
  // De la taverne : on achète (la carte va dans la main, qu'on la lâche sur la main ou sur le plateau).
  if (g.zone === 'boutique' && (sous === 'plateau' || sous === 'main')) return faire('acheter', g.zone, g.uid);
  if (g.zone === 'plateau' && sous === 'taverne') return faire('vendre', g.zone, g.uid);
  if (g.zone === 'main' && sous === 'taverne') return faire('vendreMain', g.zone, g.uid);
  // De la main au plateau : on pose, à l'endroit où l'on a lâché la carte.
  if (g.zone === 'main' && sous === 'plateau') {
    const i = indexDe('main', g.uid);
    const places = [...$('plateau').querySelectorAll('.srv')];
    let vers = places.findIndex((x) => {
      const r = x.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2;
    });
    if (vers < 0) vers = places.length;
    choix = null;
    if (i >= 0) agir({ type: 'jouer', i, vers });
    return undefined;
  }
  if (g.zone === 'plateau' && sous === 'plateau') {
    const de = indexDe('plateau', g.uid);
    const autres = [...$('plateau').querySelectorAll('.srv')].filter((x) => x.dataset.uid !== g.uid);
    let vers = autres.findIndex((x) => {
      const r = x.getBoundingClientRect();
      return e.clientX < r.left + r.width / 2;
    });
    if (vers < 0) vers = autres.length;
    if (de >= 0 && vers !== de) agir({ type: 'deplacer', de, vers });
  }
  return undefined;
}
document.addEventListener('pointerup', (e) => finGlisse(e));
document.addEventListener('pointercancel', (e) => finGlisse(e, true));

// Les boutons de la fiche (carte de la main sélectionnée).
$('fiche').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b || b.disabled || !choix) return;
  faire(b.dataset.f, choix.zone, choix.uid);
});

$('decouverte').addEventListener('click', (e) => {
  const b = e.target.closest('[data-decouvre]');
  if (b) agir({ type: 'decouvrir', i: Number(b.dataset.decouvre) });
});

$('quete-choix').addEventListener('click', (e) => {
  const b = e.target.closest('[data-quete]');
  if (b) agir({ type: 'quete', i: Number(b.dataset.quete) });
});
$('r-sorts').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]');
  if (b && !b.disabled) agir({ type: 'lancer', i: Number(b.dataset.sort) });
});
$('r-mode').addEventListener('click', () => montrerMode(vue));
$('r-quete').addEventListener('click', () => montrerMode(vue));

$('b-ameliorer').addEventListener('click', () => agir({ type: 'ameliorer' }));
$('b-rafraichir').addEventListener('click', () => { choix = null; agir({ type: 'rafraichir' }); });
$('b-geler').addEventListener('click', () => agir({ type: 'geler' }));
$('b-pret').addEventListener('click', () => agir({ type: 'pret' }));
$('r-heros').addEventListener('click', (e) => {
  if (e.target.closest('#b-pouvoir:not(:disabled)')) agir({ type: 'pouvoir' });
});

/** Oublie tout ce qui tenait à la partie précédente. */
export function remettreAZero() {
  choix = null;
  vue = null;
  queteFaite = null;
  connus.boutique = new Set();
  connus.plateau = new Set();
  connus.main = new Set();
  for (const id of ['boutique', 'plateau', 'main', 'decouverte', 'quete-choix', 'r-sorts']) { $(id).dataset.sig = ''; $(id).innerHTML = ''; }
}
