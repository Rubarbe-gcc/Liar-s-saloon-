/**
 * SKULL KING — les écrans et la table de jeu.
 *
 * Le moteur (`moteur.js`) tient les règles ; ici, on montre : la donne, les
 * paris qui se révèlent, les cartes qui volent jusqu'à la table, le pli
 * ramassé par son vainqueur, le bilan de chaque manche.
 */

import * as S from '../../../shared/skullking/moteur.js';
import { carteHtml, portraitSkSvg } from './cartes.js';
import { sfx, sonActif, basculer, deverrouiller } from './sfx.js';
import { installerMusique } from '../../../shared/musique.js';
import { installerScore, afficherScore } from './score.js';
import { reglesHtml } from './regles.js';

const $ = (id) => document.getElementById(id);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CLE_PARTIE = 'skullking.partie';
const CLE_PREFS = 'skullking.prefs';

/** L'équipage de l'ordinateur. */
const EQUIPAGE = [
  { nom: 'Barbe-Grise', av: '🦜' },
  { nom: 'Rosa la Rouge', av: '🌹' },
  { nom: 'Jack Tortue', av: '🐢' },
  { nom: 'Bahia', av: '🗡️' },
  { nom: 'Harald', av: '⚓' },
  { nom: 'La Mouette', av: '🕊️' },
];

const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); } catch { /* ignore */ } };

const prefs = { nom: '', bots: 3, ...lire(CLE_PREFS, {}) };

/* ================================================================== */
/* Navigation                                                         */
/* ================================================================== */

function aller(id) {
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  document.body.dataset.ecran = id;
  if (id === 's-menu') majMenu();
  if (id === 's-score') afficherScore();
}

function ouvrir(id) { $(id).hidden = false; }
function fermer(id) { $(id).hidden = true; }

let minuteurToast = 0;
function toast(m) {
  const t = $('toast');
  t.textContent = m;
  t.hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { t.hidden = true; }, 2200);
}

document.addEventListener('click', (e) => {
  const va = e.target.closest('[data-va]');
  if (va) { sfx.clic(); aller(va.dataset.va); }
  const f = e.target.closest('[data-ferme]');
  if (f) fermer(f.dataset.ferme);
  deverrouiller();
});
// Toucher le voile autour d'une feuille la ferme (sauf celles qui attendent une réponse).
document.querySelectorAll('.voile').forEach((v) => v.addEventListener('click', (e) => {
  if (e.target === v && !['ov-bilan', 'ov-fin', 'ov-tigresse'].includes(v.id)) v.hidden = true;
}));

/* ================================================================== */
/* Menu et réglage                                                    */
/* ================================================================== */

$('logo-crane').innerHTML = portraitSkSvg();

function majMenu() {
  const g = lire(CLE_PARTIE, null);
  const b = $('b-reprendre');
  b.hidden = !(g && g.phase !== 'fin' && g.manche >= 1);
  if (!b.hidden) $('reprendre-info').textContent = `Manche ${g.manche}/10 · ${g.n - 1} pirate${g.n > 2 ? 's' : ''} · ${g.scores[0]} points`;
}

$('b-reprendre').addEventListener('click', () => {
  const g = lire(CLE_PARTIE, null);
  if (!g) return;
  G = g;
  aller('s-table');
  reprendre();
});

function majReglage() {
  $('choix-bots').innerHTML = [1, 2, 3, 4, 5, 6].map((n) =>
    `<button class="puce${n === prefs.bots ? ' is-on' : ''}" data-bots="${n}">${n}</button>`).join('');
  $('apercu-equipage').innerHTML = EQUIPAGE.slice(0, prefs.bots).map((x) => `<span>${x.av} ${txt(x.nom)}</span>`).join('');
}
$('choix-bots').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bots]');
  if (!b) return;
  prefs.bots = +b.dataset.bots;
  sfx.clic();
  majReglage();
});
$('in-nom').value = prefs.nom;
majReglage();

$('b-lancer').addEventListener('click', () => {
  prefs.nom = $('in-nom').value.trim().slice(0, 14);
  ecrire(CLE_PREFS, prefs);
  nouvellePartie();
});

$('b-son').addEventListener('click', () => { majSon(basculer()); });
function majSon(on) { $('b-son').innerHTML = `<span class="bi">${on ? '🔊' : '🔇'}</span> Son`; }
majSon(sonActif());

$('b-regles').addEventListener('click', () => { $('regles').innerHTML = reglesHtml(); ouvrir('ov-regles'); });

/* ================================================================== */
/* La partie                                                          */
/* ================================================================== */

let G = null;
let occupe = false;       // une animation est en cours : on ne relance pas la boucle
let jeton = 0;            // change à chaque partie : les minuteurs d'une ancienne partie se taisent

function nouvellePartie() {
  const equipage = EQUIPAGE.slice(0, prefs.bots);
  G = S.creerPartie({
    noms: [prefs.nom || 'Capitaine', ...equipage.map((x) => x.nom)],
    bots: [false, ...equipage.map(() => true)],
  });
  G.avatars = ['🧭', ...equipage.map((x) => x.av)];
  jeton++;
  aller('s-table');
  debutManche();
}

const sauver = () => ecrire(CLE_PARTIE, G);

async function debutManche() {
  const j = jeton;
  S.nouvelleManche(G, Math.random);
  fermer('ov-bilan');
  if (G.phase === 'fin') { finPartie(); return; }
  // Les pirates de l'ordinateur parient tout de suite, mais en secret.
  G.parisCaches = G.mains.map((m, p) => (G.bots[p] ? S.pariBot(m, G.n) : null));
  sauver();
  rendreTout({ donne: true });
  sfx.donne();
  await attendre(450 + G.manche * 60);
  if (j !== jeton) return;
  montrerPari();
}

function montrerPari() {
  const p = $('pari');
  $('pari-choix').innerHTML = Array.from({ length: G.manche + 1 }, (_, i) => `<button data-pari="${i}">${i}</button>`).join('');
  p.hidden = false;
  placerPari();
  $('consigne').textContent = `Manche ${G.manche} : ${G.manche} carte${G.manche > 1 ? 's' : ''} en main`;
}
function placerPari() {
  const moi = document.querySelector('.moi');
  $('pari').style.bottom = `${moi.offsetHeight + 6}px`;
}
addEventListener('resize', () => { if (!$('pari').hidden) placerPari(); if (G) ajusterMain(); });

$('pari-choix').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-pari]');
  if (!b || G.phase !== 'pari') return;
  $('pari').hidden = true;
  S.parier(G, 0, +b.dataset.pari);
  for (let p = 1; p < G.n; p++) S.parier(G, p, G.parisCaches[p]);
  sauver();
  sfx.pari();
  rendreSieges({ revele: true });
  const total = G.paris.reduce((s, x) => s + x, 0);
  annoncer(`Yo ho ! ${total} pli${total > 1 ? 's' : ''} annoncé${total > 1 ? 's' : ''} pour ${G.manche} en jeu`);
  await attendre(1500);
  boucle();
});

/** Le moteur de la table : qui joue, et quand. */
async function boucle() {
  if (occupe || !G) return;
  const j = jeton;
  if (G.phase === 'jeu') {
    if (G.bots[G.tour]) {
      rendreSieges();
      $('consigne').textContent = '';
      rendreMain();
      occupe = true;
      await attendre(700 + Math.random() * 350);
      occupe = false;
      if (j !== jeton || G.phase !== 'jeu') return;
      const c = S.coupBot(G, G.tour);
      await jouerCarte(G.tour, c.id, c.as);
    } else {
      rendreSieges();
      rendreMain();
      const cd = S.couleurDemandee(G.pli);
      $('consigne').textContent = G.pli.length === 0 ? 'À vous d’ouvrir le pli'
        : cd && G.mains[0].some((c) => c.t === 'n' && c.s === cd) ? `À vous — suivez la couleur ${S.COULEURS[cd].nom}` : 'À vous de jouer';
    }
  } else if (G.phase === 'pli') await conclurePli();
  else if (G.phase === 'bilan') montrerBilan();
  else if (G.phase === 'fin') finPartie();
}

async function jouerCarte(p, id, as) {
  const depuis = p === 0
    ? document.querySelector(`#main [data-id="${id}"]`)
    : document.querySelector(`[data-siege="${p}"] .avatar`);
  const r0 = depuis ? depuis.getBoundingClientRect() : null;
  const res = S.jouer(G, p, id, as);
  if (!res.ok) { toast(res.raison); return; }
  occupe = true;
  sauver();
  sfx.carte();
  rendrePli();
  rendreMain();
  rendreSieges();
  // La carte part de la main (ou du siège) et se pose sur la table.
  const el = $('pli').lastElementChild;
  if (el && r0) {
    const r1 = el.getBoundingClientRect();
    const dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2);
    const dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2);
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${p === 0 ? 1 : 0.4}) rotate(${p === 0 ? 0 : -10}deg)`;
    el.style.opacity = p === 0 ? '1' : '0.2';
    el.getBoundingClientRect();
    el.style.transition = '';
    el.style.transform = '';
    el.style.opacity = '';
  }
  await attendre(480);
  occupe = false;
  boucle();
}

async function conclurePli() {
  const j = jeton;
  occupe = true;
  const r = S.resoudre(G.pli);
  const jeux = [...$('pli').children];
  $('consigne').textContent = '';
  await attendre(350);
  if (r.effet === 'kraken') {
    jeux.forEach((e) => e.classList.add('englouti'));
    sfx.kraken();
    annoncer(`🐙 Le Kraken engloutit le pli ! ${G.noms[r.meneur]} ouvre le suivant`);
  } else if (r.gagnant === null) {
    jeux.forEach((e) => e.classList.add('englouti'));
    sfx.baleine();
    annoncer(`🐋 La Baleine renvoie tout au fond. ${G.noms[r.meneur]} ouvre le suivant`);
  } else {
    jeux[r.carte]?.classList.add('vainqueur');
    if (r.effet === 'baleine') sfx.baleine();
    if (r.gagnant === 0) sfx.pli(); else sfx.pliAutre();
    if (r.bonus) setTimeout(() => sfx.bonus(), 300);
    const qui = r.gagnant === 0 ? 'Vous remportez' : `${G.noms[r.gagnant]} remporte`;
    annoncer(`${r.effet === 'baleine' ? '🐋 ' : ''}${qui} le pli${r.bonus ? ` · +${r.bonus} (${r.details.map((d) => d.txt).join(', ')})` : ''}`);
  }
  await attendre(r.bonus ? 1900 : 1400);
  if (j !== jeton) return;
  // Les cartes filent vers le vainqueur (ou coulent).
  const cible = r.gagnant !== null ? document.querySelector(`[data-siege="${r.gagnant}"]`) : null;
  const rc = cible?.getBoundingClientRect();
  jeux.forEach((e) => {
    const re = e.getBoundingClientRect();
    e.style.transform = rc
      ? `translate(${rc.left + rc.width / 2 - (re.left + re.width / 2)}px, ${rc.top + rc.height / 2 - (re.top + re.height / 2)}px) scale(.25)`
      : 'translateY(60px) scale(.6) rotate(20deg)';
    e.style.opacity = '0';
  });
  await attendre(480);
  S.ramasser(G);
  sauver();
  rendrePli();
  rendreSieges();
  if (r.gagnant !== null) document.querySelector(`[data-siege="${r.gagnant}"]`)?.classList.add('gagne');
  occupe = false;
  if (G.phase === 'bilan') { await attendre(600); if (j === jeton) montrerBilan(); } else boucle();
}

function montrerBilan() {
  const b = G.historique.at(-1);
  if (!b) return;
  $('bilan-titre').textContent = `Fin de la manche ${G.manche}`;
  $('bilan').innerHTML = b.map((x, p) => {
    const ok = x.pari === x.plis;
    const detail = `Pari ${x.pari} · ${x.plis} pli${x.plis > 1 ? 's' : ''}${x.bonus ? ` · bonus ${ok ? '+' : '(perdu) '}${x.bonus}` : ''}`;
    return `<div class="bilan-ligne ${ok ? 'ok' : 'ko'}" style="animation-delay:${p * 0.07}s">
      <div><div class="bilan-nom">${G.avatars?.[p] || ''} ${txt(G.noms[p])}</div><div class="bilan-detail">${ok ? '✓' : '✗'} ${detail}</div></div>
      <div class="bilan-pts ${x.points >= 0 ? 'plus' : 'moins'}">${x.points >= 0 ? '+' : ''}${x.points}</div>
      <div class="bilan-total">${x.total}</div></div>`;
  }).join('');
  $('b-suite').textContent = G.manche >= G.manches ? 'Voir le classement' : `Manche ${G.manche + 1}`;
  ouvrir('ov-bilan');
  if (b[0].pari === b[0].plis) sfx.tenu(); else sfx.rate();
}
$('b-suite').addEventListener('click', () => { sfx.clic(); debutManche(); });

function finPartie() {
  G.phase = 'fin';
  ecrire(CLE_PARTIE, null);
  fermer('ov-bilan');
  const cl = S.classement(G);
  const moi = cl.find((x) => x.p === 0);
  $('fin-couronne').innerHTML = portraitSkSvg();
  $('fin-titre').textContent = moi.rang === 1 ? 'Vous êtes le Skull King !' : `${cl[0].nom} est le Skull King`;
  $('fin-sous').textContent = moi.rang === 1 ? 'L’équipage s’incline devant son capitaine.' : `Vous finissez ${moi.rang}${moi.rang === 1 ? 'er' : 'e'} avec ${moi.score} points.`;
  const medailles = ['🥇', '🥈', '🥉'];
  $('podium').innerHTML = cl.map((x) => `<div><span class="rang">${medailles[x.rang - 1] || x.rang}</span>
    <span class="nom">${G.avatars?.[x.p] || ''} ${txt(x.nom)}</span><span class="pts">${x.score}</span></div>`).join('');
  ouvrir('ov-fin');
  sfx.fin();
}
$('b-fin-menu').addEventListener('click', () => { fermer('ov-fin'); G = null; jeton++; aller('s-menu'); });
$('b-fin-rejouer').addEventListener('click', () => { fermer('ov-fin'); nouvellePartie(); });

/** Reprendre une partie sauvegardée, là où elle s'était arrêtée. */
function reprendre() {
  jeton++;
  occupe = false;
  rendreTout();
  if (G.phase === 'pari') montrerPari();
  else boucle();
}

$('b-quitter').addEventListener('click', () => ouvrir('ov-quitter'));
$('b-quitter-ok').addEventListener('click', () => { fermer('ov-quitter'); jeton++; occupe = false; G = null; aller('s-menu'); });
$('b-tableau').addEventListener('click', () => { $('tableau-partie').innerHTML = tableauPartie(); ouvrir('ov-tableau'); });

/* ------------------------------------------------------------------ */
/* Jouer une carte de sa main                                         */
/* ------------------------------------------------------------------ */

$('main').addEventListener('click', (e) => {
  const c = e.target.closest('[data-id]');
  if (!c || occupe || !G || G.phase !== 'jeu' || G.tour !== 0) return;
  const carte = G.mains[0].find((x) => x.id === c.dataset.id);
  if (!carte) return;
  if (!S.legales(G.mains[0], G.pli).includes(carte)) {
    const cd = S.couleurDemandee(G.pli);
    toast(`Il faut suivre la couleur demandée : ${S.COULEURS[cd].nom}`);
    return;
  }
  if (carte.t === 'tig') { ouvrir('ov-tigresse'); return; }
  jouerCarte(0, carte.id, null);
});
document.querySelectorAll('[data-tig]').forEach((b) => b.addEventListener('click', () => {
  fermer('ov-tigresse');
  jouerCarte(0, 'tig', b.dataset.tig);
}));

/* ================================================================== */
/* Rendu                                                              */
/* ================================================================== */

let minuteurAnnonce = 0;
function annoncer(m) {
  const a = $('annonce');
  a.className = 'annonce visible';
  a.textContent = m;
  clearTimeout(minuteurAnnonce);
  minuteurAnnonce = setTimeout(() => { a.classList.remove('visible'); }, 2600);
}

function rendreTout(o = {}) {
  $('no-manche').textContent = G.manche;
  rendreSieges();
  rendrePli();
  rendreMain(o);
}

function siegeHtml(p, o = {}) {
  const pari = G.paris[p];
  const visible = G.phase !== 'pari' && pari !== null;
  let etat = '';
  if (visible) etat = G.plis[p] > pari ? 'depasse' : G.plis[p] === pari ? 'tenu' : '';
  const bulle = visible
    ? `<span class="pari-bulle ${etat}${o.revele ? ' revele' : ''}" title="Pari">${pari}</span>`
    : `<span class="pari-bulle cache" title="Pari secret">?</span>`;
  const pions = Array.from({ length: G.plis[p] }, () => '<i></i>').join('');
  const actif = G.phase === 'jeu' && G.tour === p;
  return `<div class="siege${actif ? ' actif' : ''}${p === 0 ? ' moi-siege' : ''}" data-siege="${p}">
    <span class="avatar">${G.avatars?.[p] || '🏴‍☠️'}</span>
    <span class="siege-info"><span class="siege-nom">${txt(G.noms[p])}</span>
      <span class="siege-stats"><b>${G.scores[p]}</b> pts <span class="plis-pions" title="Plis remportés">${pions}</span></span></span>
    ${bulle}${p === G.donneur ? '<span class="donneur" title="Donneur">donne</span>' : ''}</div>`;
}

function rendreSieges(o = {}) {
  $('adversaires').innerHTML = Array.from({ length: G.n - 1 }, (_, i) => siegeHtml(i + 1, o)).join('');
  $('moi-siege').outerHTML = siegeHtml(0, o).replace('class="siege', 'id="moi-siege" class="siege');
}

function rendrePli() {
  const pli = $('pli');
  if (!G.pli.length) {
    pli.innerHTML = '';
    if (G.phase === 'jeu') {
      const a = $('annonce');
      if (!a.classList.contains('visible')) {
        a.className = 'annonce vide-table';
        a.textContent = G.tour === 0 ? 'À vous d’ouvrir' : `${G.noms[G.tour]} ouvre le pli`;
      }
    }
    return;
  }
  if ($('annonce').classList.contains('vide-table')) $('annonce').className = 'annonce';
  pli.innerHTML = G.pli.map((j) => `<div class="jeu"><span class="qui">${txt(G.noms[j.p])}</span>${carteHtml(j.c, { as: j.as })}</div>`).join('');
}

const ORDRE = { sk: 100, pir: 101, tig: 102, sir: 103, wha: 104, kra: 105, esc: 106 };
const rangCarte = (c) => (c.t === 'n' ? { B: 0, Y: 20, G: 40, P: 60 }[c.s] + c.n : ORDRE[c.t]);

function rendreMain(o = {}) {
  const main = $('main');
  const mienne = G.mains[0].slice().sort((a, b) => rangCarte(a) - rangCarte(b));
  const monTour = G.phase === 'jeu' && G.tour === 0 && !occupe;
  const ok = monTour ? S.legales(G.mains[0], G.pli) : [];
  main.classList.toggle('mon-tour', monTour);
  main.innerHTML = mienne.map((c, i) => {
    const cls = [monTour ? (ok.includes(c) ? 'jouable' : 'interdite') : '', o.donne ? 'arrive' : ''].join(' ');
    return carteHtml(c, { cls, attrs: `data-id="${c.id}" tabindex="${monTour ? 0 : -1}"${o.donne ? ` style="animation-delay:${i * 0.06}s"` : ''}` });
  }).join('');
  ajusterMain();
}

/** Les cartes se chevauchent juste assez pour tenir dans la largeur. */
function ajusterMain() {
  const main = $('main');
  const cartes = main.children;
  if (!cartes.length) return;
  const cw = cartes[0].offsetWidth;
  const n = cartes.length;
  const dispo = main.clientWidth - 12;
  const chev = n > 1 ? Math.min(6, (dispo - cw) / (n - 1) - cw) : 0;
  main.style.setProperty('--chevauche', `${Math.round(chev)}px`);
}

function tableauPartie() {
  const h = G.historique;
  let html = `<thead><tr><th>#</th>${G.noms.map((n) => `<th>${txt(n)}</th>`).join('')}</tr></thead><tbody>`;
  h.forEach((m, i) => {
    html += `<tr><td>${i + 1}</td>${m.map((x) => `<td><span class="pts ${x.points >= 0 ? 'plus' : 'moins'}">${x.points >= 0 ? '+' : ''}${x.points}</span>
      <span class="cum">${x.pari}/${x.plis} · ${x.total}</span></td>`).join('')}</tr>`;
  });
  if (!h.length) html += `<tr><td colspan="${G.n + 1}">Aucune manche terminée pour l’instant.</td></tr>`;
  html += `<tr class="total"><td>Σ</td>${G.scores.map((s) => `<td>${s}</td>`).join('')}</tr></tbody>`;
  return html;
}

/* ================================================================== */
/* Démarrage                                                          */
/* ================================================================== */

installerScore({ toast, sfx, ouvrir, fermer });
installerMusique('skullking', { actif: sonActif });
majMenu();
