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
  PHASE, COUT_SERVITEUR, PLATEAU_MAX, OR_MAX,
} from '../../../shared/brasier/partie.js';

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
    d.rale ? '💀' : '', d.debut ? '⚡' : '', d.fin ? '⏳' : '', d.allieMeurt ? '🩸' : '',
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
    <span class="fiche-meta">${'★'.repeat(d.tier)} · ${t.glyph} ${t.label}${u.dore ? ' · doré' : ''}</span>
    ${texte(u.id, u.dore) ? `<span class="fiche-dit">${texte(u.id, u.dore)}</span>` : ''}
    ${mots ? `<span class="fiche-mots">${mots}</span>` : ''}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Recrutement                                                         */
/* ------------------------------------------------------------------ */

let agir = () => {};
let vue = null;
let choix = null;           // { zone: 'boutique'|'plateau', uid }
const connus = { boutique: new Set(), plateau: new Set() };

export function brancher(fn) { agir = fn; }
export const vueCourante = () => vue;

/** Donne à une rangée son nombre d'occupants : la taille des médaillons en dépend. */
export function compter(host) {
  host.style.setProperty('--n', Math.max(4, host.querySelectorAll('.srv:not(.meurt)').length));
}

function rangee(host, zone, liste, o) {
  host.style.setProperty('--n', Math.max(4, liste.length));
  const avant = connus[zone];
  const html = liste.map((u) => medaillon(u, {
    ...o,
    cls: [choix && choix.zone === zone && choix.uid === u.uid ? 'choisi' : '',
      avant.size || zone === 'plateau' ? (avant.has(u.uid) ? '' : 'nouveau') : 'nouveau'].join(' '),
  })).join('');
  if (host.dataset.sig !== html) { host.dataset.sig = html; host.innerHTML = html; }
  connus[zone] = new Set(liste.map((u) => u.uid));
}

export function rendreRecrutement(v) {
  vue = v;
  const m = v.moi;
  if (!m) return;

  $('r-tour').textContent = `Tour ${v.tour}`;
  $('r-etoiles').innerHTML = Array.from({ length: 6 }, (_, k) => (k < m.taverne ? '★' : '<i>★</i>')).join('');
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
    const liste = choix.zone === 'boutique' ? m.boutique : m.plateau;
    if (!liste.some((u) => u.uid === choix.uid)) choix = null;
  }

  rangee($('boutique'), 'boutique', m.boutique, { prix: true });
  if (!m.boutique.length) {
    $('boutique').innerHTML = `<span class="vide-taverne">${m.mort ? 'La taverne vous est fermée.' : 'La taverne est vide. Rafraîchissez-la.'}</span>`;
    $('boutique').dataset.sig = '';
  }
  rangee($('plateau'), 'plateau', m.plateau, {});
  $('boutique').querySelectorAll('.srv').forEach((el) => el.classList.toggle('gele', m.gel));

  // Le héros et son pouvoir.
  const h = getHeros(m.heros);
  const p = h ? h.pouvoir : null;
  const pouvoirOff = !p || p.passif || m.pouvoirUtilise || m.or < p.cout || m.mort;
  $('r-heros').innerHTML = `${portrait(m.heros, m.pv)}
    ${p ? `<button class="pouvoir${p.passif ? ' passif' : ''}" id="b-pouvoir" ${pouvoirOff ? 'disabled' : ''}
      title="${esc(p.texte)}">
      <b>${p.passif ? 'Passif' : 'Pouvoir'} ${p.passif ? '' : `<span class="cout">${p.cout}</span>`}${m.pouvoirUtilise ? ' ✓' : ''}</b>
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
  const u = m && choix
    ? (choix.zone === 'boutique' ? m.boutique : m.plateau).find((x) => x.uid === choix.uid)
    : null;
  $('fiche-vide').hidden = !!u;
  const c = $('fiche-contenu');
  c.hidden = !u;
  if (!u) return;

  let actions = '';
  if (choix.zone === 'boutique') {
    const peut = m.or >= COUT_SERVITEUR && m.plateau.length < PLATEAU_MAX;
    actions = `<button class="bouton bouton-braise" data-f="acheter" ${peut ? '' : 'disabled'}>Acheter · ${COUT_SERVITEUR}🪙</button>
      <span class="statut">${m.plateau.length >= PLATEAU_MAX ? 'Plateau plein' : (m.or < COUT_SERVITEUR ? 'Pas assez d\'or' : '')}</span>`;
  } else {
    const i = m.plateau.findIndex((x) => x.uid === u.uid);
    actions = `<div class="ligne">
        <button class="bouton" data-f="gauche" ${i <= 0 ? 'disabled' : ''} title="Vers la gauche">◀</button>
        <button class="bouton" data-f="droite" ${i >= m.plateau.length - 1 ? 'disabled' : ''} title="Vers la droite">▶</button>
      </div>
      <button class="bouton" data-f="vendre">Vendre · +1🪙</button>`;
  }
  c.innerHTML = `${medaillon(u)}${detail(u)}<div class="fiche-actions">${actions}</div>`;
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
      <span class="cl-nom">${esc(j.name)}${j.isBot ? ' 🤖' : ''}</span>
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
      <span class="pouvoir${p.passif ? ' passif' : ''}"><b>${p.passif ? 'Passif' : `Pouvoir <span class="cout">${p.cout}</span>`}</b><i>${esc(p.texte)}</i></span>
    </button>`;
  }).join('');
  $('heros-attente').hidden = !choisi;
  ov.hidden = false;
  $('heros-choix').onclick = (e) => {
    const b = e.target.closest('[data-heros]');
    if (b && !b.disabled) onChoix(b.dataset.heros);
  };
}

export function rendreFin(v, { elimine = false } = {}) {
  const m = v.moi;
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
  return (zone === 'boutique' ? m.boutique : m.plateau).findIndex((u) => u.uid === uid);
}

$('boutique').addEventListener('click', (e) => {
  const el = e.target.closest('.srv');
  if (el) selectionner('boutique', el.dataset.uid);
});
$('boutique').addEventListener('dblclick', (e) => {
  const el = e.target.closest('.srv');
  if (!el) return;
  const i = indexDe('boutique', el.dataset.uid);
  if (i >= 0) { choix = null; agir({ type: 'acheter', i }); }
});
$('plateau').addEventListener('click', (e) => {
  const el = e.target.closest('.srv');
  if (el) selectionner('plateau', el.dataset.uid);
});

$('fiche-contenu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b || b.disabled || !choix) return;
  const i = indexDe(choix.zone, choix.uid);
  if (i < 0) return;
  switch (b.dataset.f) {
    case 'acheter': choix = null; return agir({ type: 'acheter', i });
    case 'vendre': choix = null; return agir({ type: 'vendre', i });
    case 'gauche': return agir({ type: 'deplacer', de: i, vers: i - 1 });
    case 'droite': return agir({ type: 'deplacer', de: i, vers: i + 1 });
    default: return undefined;
  }
});

$('decouverte').addEventListener('click', (e) => {
  const b = e.target.closest('[data-decouvre]');
  if (b) agir({ type: 'decouvrir', i: Number(b.dataset.decouvre) });
});

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
  connus.boutique = new Set();
  connus.plateau = new Set();
  for (const id of ['boutique', 'plateau', 'decouverte']) { $(id).dataset.sig = ''; $(id).innerHTML = ''; }
}
