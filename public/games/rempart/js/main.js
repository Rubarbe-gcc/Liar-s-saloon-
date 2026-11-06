/**
 * REMPART — l'application : écrans, partie, interface et boucle de jeu.
 *
 * Le moteur (`shared/rempart/partie.js`) avance par pas fixes ; ici on lit
 * ses événements pour les sons, les bulles d'or et les annonces, et on lui
 * passe les ordres du joueur (bâtir, améliorer, vendre, appeler la vague).
 */

import { TOURS, ENNEMIS, ORDRE_TOURS, ORDRE_ENNEMIS } from '../../../shared/rempart/donnees.js';
import { NIVEAUX, niveau as defNiveau } from '../../../shared/rempart/niveaux.js';
import * as P from '../../../shared/rempart/partie.js';
import { creerIA, jouerIA } from '../../../shared/rempart/ia.js';
import { creerMonde, AMBIANCES } from './monde3d.js';
import * as son from './sons.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const mobile = matchMedia('(pointer: coarse)').matches;

export const ICONES = { rodeur: '🪲', filou: '💨', cuirasse: '🛡️', bourdon: '🐝', grappe: '🫧', grappillon: '🫧', tisseur: '💚', furtif: '👻', fouisseur: '🪱', pavois: '🔰', bondisseur: '🦗', dirigeable: '🎈', mue: '🦀', broyeur: '⚙️', nuee: '👑', hydre: '🐉', tete: '🐍', seigneur: '💀' };
const COULEUR_ENNEMI = { rodeur: '#a0522d', filou: '#c0703a', cuirasse: '#5b5f66', bourdon: '#d9a53a', grappe: '#5f9a6e', grappillon: '#6fb07e', tisseur: '#5b3a5a', furtif: '#2a2440', fouisseur: '#7a5a3a', pavois: '#4a5a7a', bondisseur: '#8a9a3a', dirigeable: '#a87a4a', mue: '#4f8a6a', broyeur: '#5a4a3e', nuee: '#3a2350', hydre: '#3a5a4a', tete: '#3a5a4a', seigneur: '#7a2a1a' };
const NOMS_SPECIAUX = { canons: 'Deux canons', zone: 'Gel en zone', brise: 'Brise-armure' };

/* ------------------------------------------------------------ état */
let monde;
try {
  monde = creerMonde($('#scene'), { mobile });
} catch (err) {
  document.body.innerHTML = '<p class="sans-js">Votre appareil ne permet pas la 3D (WebGL). REMPART ne peut pas démarrer.</p>';
  throw err;
}
let partie = null, ia = null, demo = true, demoNiveau = 0;
let vitesse = 1, pause = false, accu = 0, dernier = performance.now();
let selection = null;         // { emp } ou { tour }
let bossEnVie = null;
let ecran = 'menu';

const progression = (() => {
  try { return { etoiles: {}, ...JSON.parse(localStorage.getItem('rempart.progression') || '{}') }; } catch { return { etoiles: {} }; }
})();
const vus = new Set((() => { try { return JSON.parse(localStorage.getItem('rempart.vus') || '[]'); } catch { return []; } })());
const sauver = () => {
  try {
    localStorage.setItem('rempart.progression', JSON.stringify(progression));
    localStorage.setItem('rempart.vus', JSON.stringify([...vus]));
  } catch { /* rien */ }
};
const toutOuvert = new URLSearchParams(location.search).has('tout');
const debloque = id => toutOuvert || id === 1 || (progression.etoiles[id - 1] || 0) > 0;
const totalEtoiles = () => NIVEAUX.reduce((s, n) => s + (progression.etoiles[n.id] || 0), 0);

/* ------------------------------------------------------------ écrans */
function montrer(id) {
  ecran = id.replace('s-', '');
  for (const s of $$('.ecran')) s.classList.toggle('is-active', s.id === id);
}

function demarrerDemo() {
  demo = true;
  son.rendreMuet(true);
  const ids = NIVEAUX.filter(n => debloque(n.id)).map(n => n.id);
  const id = ids[demoNiveau++ % ids.length];
  partie = P.creerPartie(id, { graine: 1 + demoNiveau });
  ia = creerIA(partie);
  monde.charger(partie);
  monde.camera.tourner(0.06);
  vitesse = 1; pause = false;
}

function allerMenu() {
  fermerModales();
  fermerPanneau();
  if (!demo) demarrerDemo();
  $('#campagne-info').textContent = `⭐ ${totalEtoiles()} / ${NIVEAUX.length * 3} étoiles`;
  montrer('s-menu');
}

function allerCarte() {
  fermerModales();
  fermerPanneau();
  if (!demo) demarrerDemo();
  const liste = $('#liste-niveaux');
  liste.innerHTML = '';
  for (const n of NIVEAUX) {
    const a = AMBIANCES[n.ambiance];
    const b = document.createElement('button');
    b.className = 'niveau' + (debloque(n.id) ? '' : ' verrou');
    b.style.setProperty('--art', `linear-gradient(160deg, ${a.horizon}, ${a.herbe} 45%, ${a.ciel} 100%)`);
    const e = progression.etoiles[n.id] || 0;
    const boss = [...new Set(n.vagues.flat().filter(g => ENNEMIS[g.type].boss).map(g => ENNEMIS[g.type].nom))];
    b.innerHTML = `<span class="num">${n.id}</span>
      <span class="etoiles-mini">${[1, 2, 3].map(i => `<span class="${i <= e ? 'on' : ''}">★</span>`).join('')}</span>
      <span class="nom">${n.nom}</span>
      <span class="details">${n.vagues.length} vagues · ${n.tours.map(t => TOURS[t].icone).join(' ')}${boss.length ? ` · ${boss.join(', ')}` : ''}</span>`;
    b.addEventListener('click', () => { son.jouer('clic'); lancerNiveau(n.id); });
    liste.append(b);
  }
  $('#total-etoiles').textContent = `⭐ ${totalEtoiles()} / ${NIVEAUX.length * 3}`;
  montrer('s-carte');
}

function remplirCodex(onglet = 'tours') {
  for (const o of $$('.onglet')) o.classList.toggle('is-active', o.dataset.onglet === onglet);
  const c = $('#codex');
  if (onglet === 'tours') {
    c.innerHTML = ORDRE_TOURS.map(k => {
      const t = TOURS[k];
      const lieu = NIVEAUX.find(n => n.tours.includes(k));
      const lignes = t.niveaux.map((s, i) => `<tr><td>${i + 1}</td><td>${s.cout} 🪙</td><td>${t.soutien ? `+${Math.round(s.bonus * 100)} %` : s.degats}</td><td>${t.soutien ? '—' : s.cadence}</td><td>${s.portee}</td></tr>`).join('');
      const branches = t.branches.map(b => `<li style="--c:${b.couleur}"><b>${b.nom}</b> · ${b.cout} 🪙 — ${b.desc}</li>`).join('');
      return `<article class="fiche">
        <header><span class="ico" style="--c:${t.couleur}">${t.icone}</span><div><h3>${t.nom}</h3><span class="role">${t.role}</span></div></header>
        <p>${t.desc}</p>
        <div class="etiquettes">${t.soutien ? '<span>Soutien</span>' : `<span>${t.sol ? '✔' : '✘'} au sol</span><span>${t.air ? '✔' : '✘'} volants</span>`}${t.niveaux[2].special ? `<span>Niv. 3 : ${t.niveaux[2].special}</span>` : ''}<span>Dès « ${lieu.nom} »</span></div>
        <table><tr><th>Niv.</th><th>Prix</th><th>${t.soutien ? 'Renfort' : 'Dégâts'}</th><th>Tirs/s</th><th>Portée</th></tr>${lignes}</table>
        <p class="role">Niveau 4, au choix :</p><ul class="branches-codex">${branches}</ul>
      </article>`;
    }).join('');
  } else {
    c.innerHTML = ORDRE_ENNEMIS.map(k => {
      const e = ENNEMIS[k];
      const tags = [`${e.pv} PV`, `vitesse ${e.vitesse}`, e.armure ? `armure ${e.armure}` : null, e.vole ? 'vole' : null, e.furtif ? 'invisible' : null, e.fouit ? 'sous terre' : null, e.bouclier ? 'bouclier' : null, `${e.vies} vie${e.vies > 1 ? 's' : ''}`, `${e.or} 🪙`, e.boss ? 'BOSS' : null].filter(Boolean);
      return `<article class="fiche">
        <header><span class="ico" style="--c:${COULEUR_ENNEMI[k]}">${ICONES[k]}</span><div><h3>${e.nom}</h3><span class="role">${e.boss ? 'Boss' : e.enfant ? 'Fragment' : 'Rouilleux'}</span></div></header>
        <p>${e.desc}</p>
        <div class="etiquettes">${tags.map(t => `<span>${t}</span>`).join('')}</div>
      </article>`;
    }).join('');
  }
}

/* ------------------------------------------------------------ partie */
function lancerNiveau(id) {
  fermerModales();
  fermerPanneau();
  demo = false;
  son.rendreMuet(false);
  partie = P.creerPartie(id, { graine: (Date.now() % 1e9) | 0 });
  ia = null;
  monde.charger(partie);
  monde.camera.tourner(0);
  vitesse = 1; pause = false; accu = 0;
  $('#b-vitesse').textContent = '×1';
  $('#b-vitesse').classList.remove('vite');
  $('#boss').hidden = true;
  bossEnVie = null;
  montrer('s-jeu');
  $('#astuce').hidden = false;
  majHUD(true);
  // La présentation du lieu.
  const def = partie.def, avant = defNiveau(id - 1);
  $('#intro-num').textContent = `Lieu ${id} sur ${NIVEAUX.length}`;
  $('#intro-nom').textContent = def.nom;
  $('#intro-texte').textContent = def.intro;
  const types = [...new Set(def.vagues.flat().map(g => g.type))];
  const avantTypes = new Set(avant ? avant.vagues.flat().map(g => g.type) : []);
  $('#intro-infos').innerHTML = `
    <div class="ligne"><span>Vos tours</span>${def.tours.map(t => `<span class="pastille ${avant && !avant.tours.includes(t) ? 'neuf' : ''}">${TOURS[t].icone} ${TOURS[t].nom}</span>`).join('')}</div>
    <div class="ligne"><span>${def.vagues.length} vagues de Rouilleux</span>${types.map(t => `<span class="pastille ${avant && !avantTypes.has(t) ? 'neuf' : ''}">${ICONES[t]} ${ENNEMIS[t].nom}</span>`).join('')}</div>`;
  $('#m-intro').hidden = false;
}

function finir() {
  const gagne = partie.phase === 'victoire';
  const e = P.etoiles(partie);
  if (gagne) {
    progression.etoiles[partie.niveau] = Math.max(progression.etoiles[partie.niveau] || 0, e);
    sauver();
  }
  fermerPanneau();
  $('#fin-titre').textContent = gagne ? 'Victoire !' : 'Le Cœur s’est éteint…';
  const etoiles = $$('#fin-etoiles i');
  etoiles.forEach(i => i.classList.remove('on'));
  $('#fin-etoiles').hidden = !gagne;
  if (gagne) etoiles.forEach((i, k) => { if (k < e) setTimeout(() => { i.classList.add('on'); son.jouer('etoile'); }, 500 + k * 380); });
  const s = partie.stats;
  $('#fin-texte').innerHTML = gagne
    ? `Le Cœur d’Ambre brille encore : <b>${partie.vies} / ${partie.viesMax}</b> vies.<br>${s.tues} Rouilleux détruits, ${s.orGagne + s.bonus} pièces gagnées.`
    : `Les Rouilleux ont tenu jusqu’à la vague <b>${partie.vague} / ${partie.totalVagues}</b>.<br>Essayez d’autres tours, ou de mieux les placer.`;
  const suivant = defNiveau(partie.niveau + 1);
  $('#b-suivant').hidden = !gagne || !suivant;
  $('#b-rejouer').querySelector('b').textContent = gagne ? '↻ Rejouer' : '↻ Réessayer';
  setTimeout(() => { $('#m-fin').hidden = false; }, gagne ? 900 : 1400);
}

function basculerPause(v = !pause) {
  if (demo || !partie || partie.phase === 'victoire' || partie.phase === 'defaite') return;
  if (!$('#m-intro').hidden) return;
  pause = v;
  $('#m-pause').hidden = !pause;
  $('#b-pause').textContent = pause ? '▶' : '⏸';
}

function fermerModales() {
  for (const m of $$('.modale')) m.hidden = true;
  pause = false;
  $('#b-pause').textContent = '⏸';
}

/* ------------------------------------------------------------ HUD */
let dernierHUD = {};
function majHUD(force = false) {
  if (!partie || demo) return;
  const p = partie;
  const h = { vies: p.vies, or: p.or, vague: `${p.vague}/${p.totalVagues}` };
  if (force || h.vies !== dernierHUD.vies) $('#h-vies').textContent = h.vies;
  if (force || h.or !== dernierHUD.or) {
    $('#h-or').textContent = h.or;
    if (h.or > (dernierHUD.or ?? 0) && !force) rejouerAnim($('#j-or'), 'gain');
    majPanneau();
  }
  if (force || h.vague !== dernierHUD.vague) $('#h-vague').textContent = h.vague;
  dernierHUD = h;
  // Le bouton de vague.
  const btn = $('#b-vague');
  const peut = P.peutLancer(p);
  btn.disabled = !peut;
  btn.hidden = p.vague >= p.totalVagues;
  const bonus = P.bonusAppel(p);
  $('#vague-titre').textContent = p.vague === 0 ? '▶ Lancer la vague 1' : `▶ Vague ${p.vague + 1}`;
  $('#vague-bonus').textContent = p.vague === 0 ? 'Quand vous êtes prêts' : peut ? `+${bonus} 🪙 · arrive dans ${Math.ceil(p.compte)} s` : 'En cours…';
  btn.classList.toggle('pulse', p.vague === 0);
  // Ce qui arrive.
  const ap = P.apercuVague(p);
  const cle = ap ? JSON.stringify(ap) + p.vague : '';
  if (cle !== majHUD.apercu) {
    majHUD.apercu = cle;
    $('#apercu').innerHTML = ap ? Object.entries(ap).map(([t, n]) => `<span class="${ENNEMIS[t].boss ? 'boss' : ''}" title="${ENNEMIS[t].nom}">${ICONES[t]} ${n}</span>`).join('') : '';
  }
  // Le boss.
  const bb = $('#boss');
  if (bossEnVie) {
    bb.hidden = false;
    $('#boss-nom').textContent = bossEnVie.def.nom;
    $('#boss-pv').style.width = `${(bossEnVie.pv / bossEnVie.pvMax) * 100}%`;
  } else bb.hidden = true;
}

function rejouerAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function annoncer(texte, sous = '', danger = false) {
  const a = $('#annonce');
  a.innerHTML = texte + (sous ? `<small>${sous}</small>` : '');
  a.classList.toggle('danger', danger);
  rejouerAnim(a, 'montre');
}

let minuteurNouveau = 0;
function presenter(type) {
  const e = ENNEMIS[type];
  const n = $('#nouveau');
  n.innerHTML = `<b>${ICONES[type]} Nouveau : ${e.nom}</b><p>${e.desc}</p>`;
  n.hidden = false;
  clearTimeout(minuteurNouveau);
  minuteurNouveau = setTimeout(() => { n.hidden = true; }, 6500);
}

const bulles = $('#bulles');
function bulle(x, y, z, texte, cls = '') {
  if (bulles.childElementCount > 40) return;
  const s = monde.projeter(x, y, z);
  if (!s.visible) return;
  const b = document.createElement('span');
  b.className = 'bulle ' + cls;
  b.textContent = texte;
  b.style.left = `${s.x}px`;
  b.style.top = `${s.y}px`;
  bulles.append(b);
  setTimeout(() => b.remove(), 1000);
}

/* ------------------------------------------------------------ panneau */
const panneau = $('#panneau');

function ouvrirConstruction(empId) {
  selection = { emp: empId };
  const emp = partie.carte.emplacements[empId];
  monde.selectionner(empId);
  $('#astuce').hidden = true;
  $('#s-jeu').classList.add('panneau-ouvert');
  panneau.hidden = false;
  panneau.innerHTML = `<header><h3>Bâtir une tour</h3><button class="fermer" aria-label="Fermer">✕</button></header>
    <div class="choix-tours">${ORDRE_TOURS.map((k, i) => {
      const t = TOURS[k], ok = partie.def.tours.includes(k);
      const lieu = NIVEAUX.find(n => n.tours.includes(k));
      return `<button class="carte-tour ${ok ? '' : 'verrou'}" data-type="${k}" title="${ok ? t.desc : `Disponible dès « ${lieu.nom} »`}">
        ${mobile ? '' : `<span class="touche">${i + 1}</span>`}
        <span class="ico" style="--c:${t.couleur}">${ok ? t.icone : '🔒'}</span><span class="n">${t.nom}</span><span class="prix">${t.niveaux[0].cout} 🪙</span></button>`;
    }).join('')}</div>
    <p class="detail" id="detail">Touchez une tour pour la bâtir.</p>`;
  panneau.querySelector('.fermer').onclick = () => { son.jouer('clic'); fermerPanneau(); };
  for (const b of panneau.querySelectorAll('.carte-tour')) {
    const k = b.dataset.type, t = TOURS[k];
    const voir = () => {
      monde.montrerPortee(emp.x, emp.z, t.niveaux[0].portee, t.couleur);
      $('#detail').innerHTML = `<b>${t.nom}</b> — ${t.role}. ${t.desc}`;
    };
    b.addEventListener('pointerenter', voir);
    b.addEventListener('focus', voir);
    b.addEventListener('click', () => batir(k));
  }
  majPanneau();
}

function batir(type) {
  if (!selection || selection.emp == null || selection.tour) return;
  if (!partie.def.tours.includes(type)) return;
  const r = P.construire(partie, selection.emp, type);
  if (!r.ok) {
    son.jouer('refus');
    if (r.raison === 'or') rejouerAnim($('#j-or'), 'choc');
    return;
  }
  ouvrirTour(r.tour);
}

const pct = v => `${Math.round(v * 100)} %`;

/** Les caractéristiques d'une tour, avec en vert ce que donne le niveau suivant. */
function statsHTML(t) {
  const def = TOURS[t.type], s = P.statsDe(t), n = t.niveau < 3 ? P.statsTour(t.type, t.niveau + 1) : null;
  const plus = (k, fmt = v => v) => (n && n[k] != null && n[k] !== s[k] ? `<em>→ ${fmt(n[k])}</em>` : '');
  const lignes = [];
  if (def.soutien) {
    lignes.push(['Renfort', `+${pct(s.bonus)}`, plus('bonus', v => `+${pct(v)}`)]);
    if (s.bonusCadence) lignes.push(['Cadence', `+${pct(s.bonusCadence)}`, '']);
    if (s.orBonus) lignes.push(['Or', `+${s.orBonus} par Rouilleux`, '']);
    lignes.push(['Portée', s.portee, plus('portee')]);
    lignes.push(['Révèle', 'les Furtifs', '']);
  } else {
    lignes.push([s.aura ? 'Dégâts/s' : 'Dégâts', s.degats, plus('degats')]);
    if (!s.aura) lignes.push(['Tirs/s', s.cadence, plus('cadence')]);
    lignes.push(['Portée', s.portee, plus('portee')]);
    if (s.rayon) lignes.push(['Souffle', s.rayon, plus('rayon')]);
    if (s.brulure) lignes.push(['Brûlure', `${s.brulure}/s`, plus('brulure', v => `${v}/s`)]);
    if (s.ralenti) lignes.push(['Ralenti', pct(s.ralenti), plus('ralenti', pct)]);
    if (s.chaine > 1) lignes.push(['Sauts', s.chaine, plus('chaine')]);
    if (s.etourdit) lignes.push(['Sonne', `${s.etourdit} s`, '']);
    const air = s.air ?? def.air;
    lignes.push(['Cibles', `${def.sol ? 'sol' : ''}${def.sol && air ? ' + ' : ''}${air ? 'air' : ''}`, '']);
    if (t.renfort) lignes.push(['Phare', `+${pct(t.renfort)}`, '']);
  }
  return `<div class="stats">${lignes.map(([a, b, c]) => `<div><span>${a}</span><b>${b}${c}</b></div>`).join('')}</div>`;
}

const etoilesTour = t => (t.niveau === 4 ? '★★★<span class="br">✦</span>' : `${'★'.repeat(t.niveau)}${'☆'.repeat(3 - t.niveau)}`);

function ouvrirTour(t) {
  selection = { tour: t.id, emp: t.emp };
  const def = TOURS[t.type], s = P.statsDe(t), br = P.brancheDe(t);
  monde.selectionner(t.emp, s.portee, br?.couleur || def.couleur);
  $('#astuce').hidden = true;
  $('#s-jeu').classList.add('panneau-ouvert');
  panneau.hidden = false;
  const cout = P.coutAmelioration(t);
  const prochain = t.niveau < 3 ? P.statsTour(t.type, t.niveau + 1) : null;
  let haut = '';
  if (br) haut = `<p class="special" style="color:${br.couleur}">✦ ${br.nom} : ${br.desc}</p>`;
  else if (prochain?.special) haut = `<p class="special">Niveau 3 : ${prochain.special}</p>`;
  else if (s.special) haut = `<p class="special">✦ ${s.special}</p>`;
  // Au niveau 3, on choisit sa spécialisation.
  const choix = t.niveau === 3 ? `<p class="choix-titre">Niveau 4 : choisissez une spécialisation</p><div class="branches">${def.branches.map((b, i) => `
      <button class="branche" data-branche="${i}" style="--c:${b.couleur}"><b>${b.nom}</b><small>${b.desc}</small><span class="prix" data-prix="${b.cout}">${b.cout} 🪙</span></button>`).join('')}</div>` : '';
  panneau.innerHTML = `<header><span class="ico" style="--c:${def.couleur};width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--c)">${def.icone}</span>
      <h3>${br ? br.nom : def.nom} <span class="niv">${etoilesTour(t)}</span></h3><button class="fermer" aria-label="Fermer">✕</button></header>
    ${statsHTML(t)}
    ${haut}
    ${choix}
    <div class="actions">
      ${t.niveau < 3 ? `<button class="btn or" id="b-ameliorer"><b>⬆ Améliorer</b><small id="prix-amelio">${cout} 🪙</small></button>` : t.niveau === 4 ? '<button class="btn" disabled><b>Niveau max</b></button>' : ''}
      <button class="btn" id="b-vendre" ${t.niveau === 3 ? 'style="grid-column:1 / -1"' : ''}><b>Vendre</b><small>+${P.valeurRevente(t)} 🪙</small></button>
      ${def.soutien ? '' : `<button class="btn fin cible" id="b-cible">🎯 Cible : ${P.NOMS_MODES[t.mode]}</button>`}
    </div>`;
  panneau.querySelector('.fermer').onclick = () => { son.jouer('clic'); fermerPanneau(); };
  if ($('#b-ameliorer')) $('#b-ameliorer').onclick = () => ameliorerSelection();
  for (const b of panneau.querySelectorAll('.branche')) {
    b.onclick = () => ameliorerSelection(+b.dataset.branche);
    b.addEventListener('pointerenter', () => monde.montrerPortee(t.x, t.z, def.branches[+b.dataset.branche].portee, def.branches[+b.dataset.branche].couleur));
    b.addEventListener('pointerleave', () => monde.montrerPortee(t.x, t.z, s.portee, br?.couleur || def.couleur));
  }
  $('#b-vendre').onclick = vendreSelection;
  if ($('#b-cible')) $('#b-cible').onclick = cibleSelection;
  majPanneau();
}

function tourSelection() { return selection?.tour ? partie.tours.find(t => t.id === selection.tour) : null; }

function ameliorerSelection(branche = null) {
  const t = tourSelection();
  if (!t || (t.niveau === 3 && branche == null)) return;
  const r = P.ameliorer(partie, t.id, branche);
  if (!r.ok) { son.jouer('refus'); if (r.raison === 'or') rejouerAnim($('#j-or'), 'choc'); return; }
  ouvrirTour(t);
}
function vendreSelection() {
  const t = tourSelection();
  if (!t) return;
  P.vendre(partie, t.id);
  fermerPanneau();
}
function cibleSelection() {
  const t = tourSelection();
  if (!t || TOURS[t.type].soutien) return;
  P.changerCible(partie, t.id);
  son.jouer('clic');
  $('#b-cible').textContent = `🎯 Cible : ${P.NOMS_MODES[t.mode]}`;
}

function majPanneau() {
  if (panneau.hidden || !partie) return;
  for (const b of panneau.querySelectorAll('.carte-tour')) b.classList.toggle('cher', partie.or < TOURS[b.dataset.type].niveaux[0].cout);
  const t = tourSelection();
  const prix = $('#prix-amelio');
  if (t && prix) prix.classList.toggle('cher-txt', partie.or < P.coutAmelioration(t));
  for (const p of panneau.querySelectorAll('.branche .prix')) p.classList.toggle('cher-txt', partie.or < +p.dataset.prix);
}

function fermerPanneau() {
  selection = null;
  panneau.hidden = true;
  $('#s-jeu').classList.remove('panneau-ouvert');
  monde.selectionner(null);
}

monde.surTap = (x, y) => {
  if (ecran !== 'jeu' || demo || !partie || pause) return;
  if (partie.phase === 'victoire' || partie.phase === 'defaite') return;
  son.debloquer();
  const emp = monde.choisir(x, y);
  if (emp == null) { if (selection) fermerPanneau(); return; }
  son.jouer('clic');
  const t = partie.tours.find(x2 => x2.emp === emp);
  if (t) ouvrirTour(t); else ouvrirConstruction(emp);
};

/* ------------------------------------------------------------ événements du moteur */
const SON_TIR = { rafale: 'rafale', mortier: 'mortier', givre: 'givre', perce: 'perce' };
function traiter(evts) {
  for (const e of evts) {
    switch (e.k) {
      case 'tir': son.jouer(SON_TIR[e.type]); break;
      case 'eclair': son.jouer('foudre'); break;
      case 'flamme': son.jouer('flamme'); break;
      case 'traverse': son.jouer('impactLourd'); break;
      case 'bouclier': son.jouer('bouclier'); break;
      case 'fouit': son.jouer('fouit'); break;
      case 'saut': son.jouer('saut'); break;
      case 'mine': son.jouer('mine'); break;
      case 'rage': son.jouer('boss'); annoncer(`${ENNEMIS[e.type].nom} enrage !`, 'Plus rapide, plus solide', true); break;
      case 'explosion': son.jouer('explosion'); break;
      case 'gel': son.jouer('gel'); break;
      case 'impact': if (e.p === 'trait' || e.blinde) son.jouer(e.p === 'trait' ? 'impactLourd' : 'ting'); break;
      case 'mort':
        son.jouer(e.boss ? 'bossMort' : 'mort');
        son.jouer('piece');
        bulle(e.x, (e.y || 0) + 0.9, e.z, `+${e.or}`, e.boss ? 'gros' : '');
        if (e.boss) annoncer(`${ENNEMIS[e.type].nom} est tombé !`, `+${e.or} 🪙`);
        break;
      case 'division': son.jouer('division'); break;
      case 'soin': if (e.n) son.jouer('soin'); break;
      case 'fuite':
        son.jouer('fuite');
        rejouerAnim($('#j-vies'), 'choc');
        bulle(e.x, 1.8, e.z, `−${e.vies} ❤️`, 'rouge');
        break;
      case 'vague':
        son.jouer('vague');
        if (e.boss.length) {
          setTimeout(() => son.jouer('boss'), 400);
          annoncer(`${ENNEMIS[e.boss[0]].nom} approche !`, `Vague ${e.n} / ${e.total}`, true);
        } else annoncer(`Vague ${e.n}`, e.n === e.total ? 'La dernière !' : e.bonus ? `+${e.bonus} 🪙 d’avance` : '');
        break;
      case 'apparait':
        if (!vus.has(e.type) && !ENNEMIS[e.type].enfant) { vus.add(e.type); sauver(); presenter(e.type); }
        break;
      case 'construit': son.jouer('construit'); break;
      case 'ameliore': son.jouer('ameliore'); break;
      case 'vendu': son.jouer('vendu'); bulle(e.x, 1, e.z, `+${e.or}`); break;
      case 'victoire': son.jouer('victoire'); annoncer('Victoire !', 'Le Cœur d’Ambre est sauf'); finir(); break;
      case 'defaite': son.jouer('defaite'); annoncer('Défaite…', '', true); finir(); break;
    }
  }
}

function lancerVague() {
  if (!partie || demo || pause) return;
  son.debloquer();
  if (P.lancerVague(partie).ok) { $('#astuce').hidden = true; majHUD(); }
}

/* ------------------------------------------------------------ boucle */
function boucle(maintenant) {
  requestAnimationFrame(boucle);
  const dt = Math.max(0, Math.min(0.1, (maintenant - dernier) / 1000)) || 0;
  dernier = maintenant;
  if (!partie) return;
  const fini = partie.phase === 'victoire' || partie.phase === 'defaite';
  if (!pause && !fini) {
    accu += dt * vitesse;
    let n = 0;
    const max = 10;
    while (accu >= P.DT && n < max) {
      if (demo) jouerIA(partie, ia);
      P.pas(partie);
      accu -= P.DT;
      n++;
    }
    if (n >= max) accu = 0;
  }
  if (demo && fini) { demarrerDemo(); return; }
  const evts = partie.evts.splice(0);
  monde.evenements(evts, partie);
  if (!demo) traiter(evts);
  bossEnVie = monde.rendre(partie, Math.min(1, accu / P.DT), dt, { demo });
  if (!demo) majHUD();
}

/* ------------------------------------------------------------ boutons et touches */
function bouton(sel, f) { $(sel).addEventListener('click', e => { son.debloquer(); son.jouer('clic'); f(e); }); }
bouton('#b-campagne', allerCarte);
bouton('#b-codex', () => { remplirCodex('tours'); montrer('s-codex'); });
bouton('#b-aide', () => montrer('s-aide'));
for (const b of $$('[data-retour]')) b.addEventListener('click', () => { son.jouer('clic'); allerMenu(); });
for (const o of $$('.onglet')) o.addEventListener('click', () => { son.jouer('clic'); remplirCodex(o.dataset.onglet); });
bouton('#b-postes', () => { $('#m-intro').hidden = true; });
bouton('#b-pause', () => basculerPause());
bouton('#b-reprendre', () => basculerPause(false));
bouton('#b-recommencer', () => lancerNiveau(partie.niveau));
bouton('#b-quitter', allerCarte);
bouton('#b-suivant', () => lancerNiveau(partie.niveau + 1));
bouton('#b-rejouer', () => lancerNiveau(partie.niveau));
bouton('#b-carte', allerCarte);
$('#b-vague').addEventListener('click', lancerVague);
function basculerVitesse() {
  vitesse = vitesse === 1 ? 2 : 1;
  $('#b-vitesse').textContent = `×${vitesse}`;
  $('#b-vitesse').classList.toggle('vite', vitesse === 2);
}
bouton('#b-vitesse', basculerVitesse);

function majSon() {
  for (const id of ['#b-son', '#b-son2']) $(id).setAttribute('aria-pressed', son.reglage('son'));
  for (const id of ['#b-musique', '#b-musique2']) $(id).setAttribute('aria-pressed', son.reglage('musique'));
}
for (const id of ['#b-son', '#b-son2']) $(id).addEventListener('click', () => { son.debloquer(); son.basculer('son'); majSon(); });
for (const id of ['#b-musique', '#b-musique2']) $(id).addEventListener('click', () => { son.debloquer(); son.basculer('musique'); majSon(); });
majSon();

addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (ecran !== 'jeu' || demo) { if (k === 'escape' && ecran !== 'menu') allerMenu(); return; }
  if (!$('#m-intro').hidden) { if (k === 'enter' || k === ' ' || k === 'escape') { e.preventDefault(); $('#m-intro').hidden = true; } return; }
  if (!$('#m-fin').hidden) return;
  if (k === ' ' || k === 'p') { e.preventDefault(); basculerPause(); return; }
  if (pause) { if (k === 'escape') basculerPause(false); return; }
  if (k === 'escape') { if (selection) fermerPanneau(); else basculerPause(true); return; }
  if (k === 'f') { basculerVitesse(); return; }
  if (k === 'n' || k === 'enter') { e.preventDefault(); lancerVague(); return; }
  if (/^[1-9]$/.test(k) && selection && !selection.tour) { batir(ORDRE_TOURS[+k - 1]); return; }
  if (k === 'u') ameliorerSelection();
  if (k === 'x' || k === 'delete' || k === 'backspace') vendreSelection();
  if (k === 't') cibleSelection();
});

document.addEventListener('visibilitychange', () => { if (document.hidden && ecran === 'jeu' && !demo) basculerPause(true); });
addEventListener('pointerdown', () => son.debloquer(), { once: true });

son.installer(() => (ecran === 'jeu' && !demo && bossEnVie ? 'rempart-boss' : 'rempart'));

demarrerDemo();
allerMenu();
requestAnimationFrame(t => { dernier = t; boucle(t); });
