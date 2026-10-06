/**
 * FIESTA — l'écran.
 *
 * La partie vit dans `p` (shared/fiesta/partie.js) ; cet écran l'anime : le
 * mini-jeu de chaque tour (les humains l'un après l'autre, sur le même
 * téléphone), le classement, les dés qu'on arrête, les pions qui sautent de
 * case en case. La partie se range dans le navigateur à chaque étape.
 *
 * En ligne, la partie vient du serveur (enligne.js) : chacun joue le
 * mini-jeu sur son téléphone, et cet écran rejoue chaque état reçu, un par
 * un, pour qu'une animation ne soit jamais coupée par la suivante.
 */

import * as P from '../../../shared/fiesta/partie.js';
import { MINIJEUX, MINIJEU, meilleur, uniteDe } from '../../../shared/fiesta/minijeux.js';
import * as PL from './plateau.js';
import { son, estMuet, basculerSon, attendre } from './jeux/outils.js';
import { installerMusique } from '../../../shared/musique.js';
import * as succes from '../../../shared/succes.js';
import { bandeau } from '../../../shared/reprise.js';
import * as EL from './enligne.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CLE_PARTIE = 'fiesta.partie';
const CLE_RECORDS = 'fiesta.records';
const CLE_PLACES = 'fiesta.places';

function lire(cle, defaut) { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } }
function ecrire(cle, v) { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); } catch { /* plein */ } }

const JEUX = {
  tapotage: () => import('./jeux/tapotage.js'),
  reflexe: () => import('./jeux/reflexe.js'),
  chrono: () => import('./jeux/chrono.js'),
  memo: () => import('./jeux/memo.js'),
  fruits: () => import('./jeux/fruits.js'),
  moutons: () => import('./jeux/moutons.js'),
  taupes: () => import('./jeux/taupes.js'),
  tour: () => import('./jeux/tour.js'),
  calcul: () => import('./jeux/calcul.js'),
  corde: () => import('./jeux/corde.js'),
  relais: () => import('./jeux/relais.js'),
  tirs: () => import('./jeux/tirs.js'),
  fantome: () => import('./jeux/fantome.js'),
};

let p = null;
let occupe = false;
let arreterJeu = null;

/* En ligne : la partie vient du serveur. */
let enLigne = false;
let vue = null;            // le dernier état reçu : qui a joué, qui est prêt…
let moi = -1;              // ma place dans la partie
let joueTour = 0;          // le tour dont on a déjà ouvert le mini-jeu
let couperJeu = null;      // arrête le mini-jeu en cours (temps écoulé)
let annulerDes = null;     // arrête des dés qui roulent encore (le serveur a lancé pour nous)
let finComptee = false;    // la fin de cette partie est déjà dans les records
const file = [];
let vidage = false;

/** Un joueur de cet écran : en ligne, moi seul ; sur un même téléphone, tous les humains. */
const estMoi = (i) => (enLigne ? i === moi : !!p.joueurs[i]?.humain);

/* ------------------------------------------------------------------ */
/* Petits outils                                                        */
/* ------------------------------------------------------------------ */

function aller(id) { document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id)); }
const ouvrir = (id) => { $(id).hidden = false; };
const fermer = (id) => { $(id).hidden = true; };

let toastT = 0;
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.innerHTML = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

function confettis(n = 90) {
  const h = $('confettis');
  const couleurs = ['#ff4d8d', '#ffc83d', '#3ecf6e', '#3fa9ff', '#ff8a3d', '#c77dff'];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = couleurs[k % couleurs.length];
    c.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    c.style.animationDelay = `${Math.random() * 0.8}s`;
    h.appendChild(c);
    setTimeout(() => c.remove(), 5500);
  }
}

/** Un score et son unité, au singulier pour 0 et 1 (« 1 but », « 1 manche cachée »). */
const fmt = (id, v, role = null) => {
  const u = uniteDe(id, role);
  return `${v} ${Math.abs(v) < 2 ? u.replace(/(\p{L}{2,})s\b/gu, '$1') : u}`;
};
/** En 1 contre tous, le camp d'un joueur : le joueur seul, ou les autres. */
const roleDe = (i) => (P.formatDe(p).type === 'seul' ? (P.formatDe(p).equipes[0][0] === i ? 'solo' : 'autres') : null);
const records = () => ({ jeux: {}, joues: [], victoires: 0, parties: 0, ...lire(CLE_RECORDS, {}) });
const sauver = () => { if (p && !enLigne) ecrire(CLE_PARTIE, p.phase === 'fin' ? null : p); };

function noterRecord(id, v) {
  const r = records();
  // Un contre tous : des choix, pas un score. Le mini-jeu compte comme joué.
  if (MINIJEU[id].resoudre) {
    if (!r.joues.includes(id)) r.joues.push(id);
    ecrire(CLE_RECORDS, r);
    if (r.joues.length >= MINIJEUX.length) succes.debloquer('fiesta-tous');
    return false;
  }
  const ancien = r.jeux[id];
  // Un zéro n'est pas un record (là où plus haut, c'est mieux).
  const nul = MINIJEU[id].sens === 'haut' && v <= 0;
  const nouveau = !nul && (ancien === undefined || (meilleur(id, v, ancien) === v && v !== ancien));
  if (nouveau) r.jeux[id] = v;
  if (!r.joues.includes(id)) r.joues.push(id);
  ecrire(CLE_RECORDS, r);
  if (r.joues.length >= MINIJEUX.length) succes.debloquer('fiesta-tous');
  if (id === 'tour' && v >= 15) succes.debloquer('fiesta-tour');
  if (id === 'reflexe' && v < 250) succes.debloquer('fiesta-eclair');
  return nouveau;
}

/* ------------------------------------------------------------------ */
/* Le menu                                                              */
/* ------------------------------------------------------------------ */

function majMenu() {
  const s = lire(CLE_PARTIE, null);
  $('b-continuer').hidden = !s || s.phase === 'fin';
  if (s && s.phase !== 'fin') {
    $('continuer-info').textContent = `Tour ${s.tour} · ${s.joueurs.map((j) => j.avatar).join(' ')}`;
  }
  const r = records();
  $('records').textContent = r.parties ? `🏆 ${r.victoires} victoire${r.victoires > 1 ? 's' : ''} sur ${r.parties} partie${r.parties > 1 ? 's' : ''}` : '';
  $('b-son-menu').textContent = estMuet() ? '🔇' : '🔊';
  aller('s-menu');
}

/* ------------------------------------------------------------------ */
/* Les joueurs                                                          */
/* ------------------------------------------------------------------ */

let places = null;

function placesParDefaut() {
  const pseudo = succes.pseudo?.() || '';
  return [
    { type: 'humain', nom: pseudo || 'Joueur 1', avatar: P.AVATARS[0] },
    { type: 'ordi', nom: P.NOMS_ORDI[0], avatar: '🤖' },
    { type: 'ordi', nom: P.NOMS_ORDI[1], avatar: P.AVATARS[2] },
    { type: 'vide', nom: 'Joueur 4', avatar: P.AVATARS[3] },
  ];
}

function rendrePlaces() {
  $('places').innerHTML = places.map((pl, i) => `<div class="place${pl.type === 'vide' ? ' vide' : ''}" style="--pc:${P.COULEURS[i]}" data-i="${i}">
    <button class="av" data-avatar="${i}" title="Changer d’avatar">${pl.avatar}</button>
    <div class="types">
      <button data-type="humain" class="${pl.type === 'humain' ? 'on' : ''}">👤 Humain</button>
      <button data-type="ordi" class="${pl.type === 'ordi' ? 'on' : ''}">🤖 Ordi</button>
      <button data-type="vide" class="${pl.type === 'vide' ? 'on' : ''}">—</button>
    </div>
    ${pl.type === 'vide' ? '<span class="sous" style="margin:0">Place libre</span>'
      : `<input value="${esc(pl.nom)}" maxlength="12" data-nom="${i}" ${pl.type === 'ordi' ? 'readonly' : ''}>`}
  </div>`).join('');
}

function ouvrirConfig() {
  places = lire(CLE_PLACES, null) || placesParDefaut();
  rendrePlaces();
  aller('s-config');
}

function lancerPartie() {
  const joueurs = places.filter((pl) => pl.type !== 'vide');
  if (joueurs.length < 2) { toast('Il faut au moins 2 joueurs.'); return; }
  if (!joueurs.some((pl) => pl.type === 'humain')) { toast('Il faut au moins un joueur humain.'); return; }
  ecrire(CLE_PLACES, places);
  let n = 0;
  p = P.creerPartie({
    joueurs: joueurs.map((pl) => ({
      nom: pl.type === 'ordi' ? P.NOMS_ORDI[n++ % P.NOMS_ORDI.length] : pl.nom.trim() || 'Joueur',
      avatar: pl.avatar,
      humain: pl.type === 'humain',
    })),
    niveau: $('in-niveau').value,
    longueur: $('in-longueur').value,
    graine: Date.now(),
  });
  // Les couleurs suivent les places choisies, pas l'ordre de la partie.
  let k = 0;
  places.forEach((pl, i) => { if (pl.type !== 'vide') p.joueurs[k++].couleur = P.COULEURS[i]; });
  entrerEnJeu();
}

function entrerEnJeu() {
  aller('s-jeu');
  // Le plateau se dessine tout de suite (lire sa taille force la mise en page) : pas d'attente d'une image.
  PL.dessiner(p);
  rendreClassement();
  suivre();
}

/* ------------------------------------------------------------------ */
/* Le plateau, le classement, la console                                */
/* ------------------------------------------------------------------ */

function rendreClassement(actif = null) {
  $('tour').textContent = `Tour ${p.tour}`;
  const tri = P.podium(p);
  $('classement').innerHTML = tri.map((j) => `<div class="cl${j.i === actif ? ' actif' : ''}" style="--pc:${j.couleur}">
    <span class="av">${j.avatar}</span><span><b>${esc(j.nom)}</b><small>case ${j.pos}/${P.fin(p)}${j.bloque ? ' <span class="bloque">🕳️</span>' : ''}</small></span></div>`).join('');
}

function console_(texte, bouton = null, action = null) {
  $('console-texte').innerHTML = texte;
  const b = $('b-action');
  b.hidden = !bouton;
  if (bouton) { b.textContent = bouton; b.onclick = () => { b.hidden = true; action(); }; }
}

/* ------------------------------------------------------------------ */
/* Le chef d'orchestre                                                  */
/* ------------------------------------------------------------------ */

async function suivre() {
  sauver();
  rendreClassement(P.quiLance(p));
  if (p.phase === 'minijeu') {
    if (enLigne) {
      // Chacun joue chez soi, une fois par tour.
      if (!vue.faits[moi] && joueTour !== p.tour) { joueTour = p.tour; montrerRoue(() => montrerIntro(p.joueurs[moi])); }
      majAttente();
      return;
    }
    const h = P.humainSuivant(p);
    if (!h) return;
    // La roue tourne une fois par tour, avant le premier joueur.
    if (p.roue !== p.tour) montrerRoue(() => { p.roue = p.tour; sauver(); montrerIntro(h); });
    else montrerIntro(h);
    return;
  }
  if (p.phase === 'resultats') { montrerResultats(); return; }
  if (p.phase === 'des') { tourDeDes(); return; }
  if (p.phase === 'fin') montrerFin();
}

/* ------------------------------------------------------------------ */
/* Le mini-jeu du tour                                                  */
/* ------------------------------------------------------------------ */

/** Les avatars d'un camp, chacun dans sa couleur. */
const campHtml = (membres, moi = null) => membres.map((i) => {
  const x = p.joueurs[i];
  return `<span class="pastille${i === moi ? ' moi' : ''}" style="--pc:${x.couleur}" title="${esc(x.nom)}">${x.avatar}</span>`;
}).join('');

/** Le style du mini-jeu du tour (chacun pour soi, 2 contre 2, 1 contre tous), et les camps. */
function formatHtml(moi = null, grand = false) {
  const f = P.formatDe(p);
  const titre = `<div class="format-titre f-${f.type}">${P.FORMATS[f.type].glyphe} ${esc(P.nomFormat(p))}</div>`;
  if (f.type === 'chacun') return `<div class="format${grand ? ' grand' : ''}">${titre}</div>`;
  const [A, B] = f.equipes;
  let aide = 'Les points des deux coéquipiers s’additionnent. Chaque gagnant lance deux dés !';
  if (f.type === 'seul') {
    const solo = p.joueurs[A[0]];
    aide = `S’il gagne, ${solo.avatar} ${esc(solo.nom)} lance deux dés et +${p.joueurs.length - 1}. Sinon, les autres lancent deux dés chacun !`;
  }
  return `<div class="format${grand ? ' grand' : ''}">${titre}
    <div class="versus"><div class="camp">${campHtml(A, moi)}</div><span class="vs">VS</span><div class="camp">${campHtml(B, moi)}</div></div>
    <p class="format-aide">${aide}</p></div>`;
}

/** Le rôle de ce joueur dans un mini-jeu à 1 contre tous (le gardien, un tireur…). */
function roleHtml(m, ctx) {
  if (!m.roles || !ctx || !m.roles[ctx.role]) return '';
  return `<p class="role">${esc(m.roles[ctx.role])}</p>`;
}

/* L'entraînement : le joueur, et l'ordinateur pour lui donner la réplique. */
let essai = null;
function preparerEntrainement(m) {
  const av = succes.profil?.().avatar;
  const joueurs = [
    { avatar: P.AVATARS.includes(av) ? av : '🦊', nom: 'Vous', couleur: P.COULEURS[0] },
    { avatar: '🤖', nom: 'Robotto', couleur: P.COULEURS[1] },
    { avatar: '👾', nom: 'Pixel', couleur: P.COULEURS[2] },
    { avatar: '🐸', nom: 'Turbo', couleur: P.COULEURS[3] },
  ];
  let ctx = { role: 'chacun' };
  if (m.style === 'duo') ctx = { role: 'equipe', equipe: [0, 1] };
  // Un contre tous : un rôle au hasard, contre l'ordinateur.
  if (m.style === 'seul') ctx = Math.random() < 0.5 ? { role: 'solo', solo: 0, autres: [1, 2, 3] } : { role: 'autres', solo: 1, autres: [0, 2, 3] };
  // Ce que l'ordinateur joue en face, prêt d'avance (le gardien affronte ces tirs-là).
  const scores = joueurs.map((_, i) => (i === 0 || !m.cpuJouer ? null
    : m.cpuJouer('normal', Math.random, { ...ctx, role: i === ctx.solo ? 'solo' : 'autres' })));
  essai = { joueurs, ctx, scores };
  return essai;
}

/* ------------------------------------------------------------------ */
/* La roue : le style du mini-jeu, puis le mini-jeu lui-même            */
/* ------------------------------------------------------------------ */

const CARTE_ROUE = 132;     // largeur d'une case de la roue, écart compris
let arreterRoue = null;

/**
 * Comme dans Mario Party : on annonce d'abord le style du mini-jeu (chacun
 * pour soi, 2 contre 2, 1 contre 3…) et les camps, puis la roue fait
 * défiler les mini-jeux de ce style, ralentit, et s'arrête sur celui du tour.
 * Un toucher passe l'animation.
 */
function montrerRoue(suite) {
  arreterRoue?.();
  const f = P.formatDe(p);
  const cible = MINIJEU[p.minijeu];
  const duStyle = MINIJEUX.filter((m) => m.style === cible.style);
  // Une longue bande : les mini-jeux du style, mélangés, plusieurs fois ; la cible tombe vers la fin.
  const bande = [];
  while (bande.length < 26) bande.push(...[...duStyle].sort(() => Math.random() - 0.5));
  const arret = 22;
  bande[arret] = cible;
  if (duStyle.length > 1 && bande[arret - 1] === cible) [bande[arret - 1], bande[arret - 2]] = [bande[arret - 2], bande[arret - 1]];
  $('roue').innerHTML = `<p class="sous">Tour ${p.tour}</p>
    <div class="roue-style f-${f.type}">${P.FORMATS[f.type].glyphe} ${esc(P.nomFormat(p))} !</div>
    ${f.type === 'chacun' ? '<p class="roue-aide">Tout le monde contre tout le monde !</p>'
      : `<div class="versus"><div class="camp">${campHtml(f.equipes[0])}</div><span class="vs">VS</span><div class="camp">${campHtml(f.equipes[1])}</div></div>`}
    <div class="roue-fenetre"><div class="roue-bande">${bande.map((m, k) => `<div class="roue-carte" data-k="${k}"><span>${m.glyphe}</span><b>${esc(m.nom)}</b></div>`).join('')}</div>
      <i class="roue-fleche"></i></div>
    <h2 class="roue-nom">&nbsp;</h2>
    <button class="btn rose btn-large" id="b-roue" hidden>C’est parti ! 🎮</button>`;
  ouvrir('ov-roue');
  son.fanfare();
  const fen = $('roue').querySelector('.roue-fenetre');
  const ruban = $('roue').querySelector('.roue-bande');
  const cartes = [...ruban.children];
  // Le décalage qui met la case k sous la flèche.
  const decalage = (x) => fen.clientWidth / 2 - CARTE_ROUE / 2 - x * CARTE_ROUE;
  ruban.style.transform = `translateX(${decalage(0)}px)`;

  let fini = false;
  let tic = 0;
  let attente = 0;
  const DUREE = 3600;
  const terminer = () => {
    if (fini) return;
    fini = true;
    clearInterval(tic);
    clearTimeout(attente);
    ruban.style.transform = `translateX(${decalage(arret)}px)`;
    cartes.forEach((c) => c.classList.toggle('choisie', Number(c.dataset.k) === arret));
    $('roue').querySelector('.roue-nom').textContent = `${cible.glyphe} ${cible.nom} !`;
    son.top();
    setTimeout(() => son.fanfare(), 150);
    const b = $('b-roue');
    b.hidden = false;
    b.onclick = () => { arreterRoue = null; fermer('ov-roue'); suite(); };
  };
  // Un toucher pendant que la roue tourne : on saute à la fin.
  $('roue').onpointerdown = (e) => { if (!fini && !e.target.closest('button')) terminer(); };
  arreterRoue = () => { fini = true; clearInterval(tic); clearTimeout(attente); arreterRoue = null; fermer('ov-roue'); };

  // L'annonce du style, puis la roue : rapide d'abord, de plus en plus lente.
  attente = setTimeout(() => {
    const t0 = performance.now();
    let derniere = 0;
    tic = setInterval(() => {
      const t = Math.min(1, (performance.now() - t0) / DUREE);
      const x = arret * (1 - (1 - t) ** 3.2);
      ruban.style.transform = `translateX(${decalage(x)}px)`;
      const k = Math.round(x);
      if (k !== derniere) { derniere = k; son.tic(); }
      if (t >= 1) terminer();
    }, 16);
  }, 1300);
}

function montrerIntro(j, entrainement = false) {
  const m = MINIJEU[entrainement ? j.minijeu : p.minijeu];
  const ctx = entrainement ? preparerEntrainement(m).ctx : P.contexte(p, j.i);
  const humains = entrainement ? [] : p.joueurs.filter((x) => x.humain);
  const premier = !entrainement && (enLigne || humains.indexOf(j) === 0);
  $('intro').innerHTML = `${!entrainement && premier ? `<p class="sous">Tour ${p.tour}</p>` : ''}
    ${entrainement ? '' : formatHtml(j.i)}
    <div class="glyphe">${m.glyphe}</div>
    <h2>${esc(m.nom)}</h2>
    <p class="regle">${esc(m.regle)}</p>
    ${roleHtml(m, ctx)}
    ${entrainement ? '' : `<div class="qui" style="--pc:${j.couleur}">${j.avatar} À ${esc(j.nom)} !</div>
      ${humains.length > 1 && !enLigne ? '<p class="passe">Passez-lui le téléphone 📱</p>' : ''}`}
    <button class="btn rose btn-large" id="b-pret">Je suis prêt ! 🎮</button>`;
  ouvrir('ov-intro');
  if (!entrainement && gardienAttend(j.i)) {
    $('b-pret').disabled = true;
    $('b-pret').textContent = '⏳ Les tireurs s’élancent…';
  }
  $('b-pret').onclick = () => {
    fermer('ov-intro');
    jouerMinijeu(m.id, entrainement ? null : j);
  };
}

async function jouerMinijeu(id, j) {
  const m = MINIJEU[id];
  aller('s-arene');
  $('arene').innerHTML = '';
  $('arene-joueur').hidden = !j;
  if (j) { $('arene-joueur').style.setProperty('--pc', j.couleur); $('arene-joueur').textContent = `${j.avatar} ${j.nom}`; }
  $('arene-nom').textContent = `${m.glyphe} ${m.nom}`;
  const mod = await JEUX[id]();
  let fini = false;
  arreterJeu = mod.demarrer($('arene'), {
    ctx: j ? P.contexte(p, j.i) : essai.ctx,
    joueurs: j ? p.joueurs : essai.joueurs,
    scores: j ? p.scores : essai.scores,
    // En ligne, le gardien raconte chaque tir aux autres, en direct.
    direct: enLigne && j ? (e) => EL.envoyer({ t: 'direct', e }) : null,
    moi: j ? j.i : 0,
    fin: (score) => {
      if (fini) return;
      fini = true;
      arreterJeu = null;
      apresMinijeu(id, j, score);
    },
  });
  // En ligne, le temps du mini-jeu peut s'écouler : on s'arrête là.
  couperJeu = () => {
    couperJeu = null;
    if (fini) return;
    fini = true;
    arreterJeu?.();
    arreterJeu = null;
  };
  // Quitter en plein mini-jeu : le pire score.
  $('b-abandon-jeu').onclick = () => {
    if (fini) return;
    fini = true;
    couperJeu = null;
    arreterJeu?.();
    arreterJeu = null;
    apresMinijeu(id, j, m.sens === 'haut' ? 0 : 9999, true);
  };
}

function apresMinijeu(id, j, score, abandon = false) {
  couperJeu = null;
  const record = abandon ? false : noterRecord(id, score);
  // En ligne, le score part tout de suite : les autres n'attendent pas qu'on clique.
  if (enLigne && j) EL.envoyer({ t: 'score', v: score });
  const m = MINIJEU[id];
  let gros = abandon ? 'Abandon' : esc(fmt(id, score));
  let suite = '';
  if (m.resoudre && !abandon) {
    if (j) {
      // Les choix des autres sont encore secrets : le verdict tombera aux résultats.
      gros = 'C’est noté ! ✅';
      suite = '<p class="sous">Le verdict tombe aux résultats…</p>';
    } else {
      // À l'entraînement, l'ordinateur donne la réplique tout de suite.
      const { ctx } = essai;
      const val = (i) => (i === 0 ? score : essai.scores[i]);
      const r = m.resoudre(ctx.solo, ctx.autres, val);
      const monCamp = ctx.role === 'solo' ? 0 : 1;
      gros = esc(fmt(id, r.valeurs[0], ctx.role));
      suite = `<p class="sous">${esc(r.texte)} — ${r.gagnante === -1 ? 'égalité !' : r.gagnante === monCamp ? 'gagné ! 🎉' : 'perdu…'}</p>`;
    }
  }
  $('score-perso').innerHTML = `<div style="font-size:2.6rem">${m.glyphe}</div>
    <p class="sous">${j ? `${j.avatar} ${esc(j.nom)}` : 'Entraînement'}</p>
    <div class="gros">${gros}</div>${suite}
    ${record ? '<p class="record">🏅 Nouveau record personnel !</p>' : ''}
    <button class="btn rose btn-large" id="b-suite">${j ? 'Suite ›' : 'Retour à la salle'}</button>`;
  ouvrir('ov-score');
  if (!abandon) son.fanfare();
  $('b-suite').onclick = () => {
    fermer('ov-score');
    if (!j) { ouvrirSalle(); return; }
    if (!enLigne) P.score(p, j.i, score);
    aller('s-jeu');
    PL.dessiner(p);
    suivre();
  };
}

/** Le verdict d'un tour en équipe. */
function equipesHtml() {
  const f = P.formatDe(p);
  if (!p.equipes) return '';
  const [A, B] = p.equipes;
  let verdict;
  if (A.egalite) verdict = 'Égalité parfaite ! Tout le monde lance deux dés.';
  else if (f.type === 'seul') {
    const solo = p.joueurs[A.membres[0]];
    verdict = A.gagne ? `${solo.avatar} ${esc(solo.nom)} a battu tout le monde ! 🦸` : `Les autres ont eu raison de ${solo.avatar} ${esc(solo.nom)} !`;
  } else verdict = `L’équipe ${campHtml((A.gagne ? A : B).membres)} gagne !`;
  const seul = f.type === 'seul';
  const bloc = (e, k) => `<div class="eq${e.gagne ? ' gagne' : ''}"><div class="camp">${campHtml(e.membres)}</div>
    <b>${esc(fmt(p.minijeu, e.score, seul ? (k ? 'autres' : 'solo') : null))}</b><small>${seul ? '' : 'au total'}</small></div>`;
  return `<div class="format-titre f-${f.type}">${P.FORMATS[f.type].glyphe} ${esc(P.nomFormat(p))}</div>
    <div class="equipes-res">${bloc(A, 0)}<span class="vs">VS</span>${bloc(B, 1)}</div>
    ${p.resolution ? `<p class="resolution">${esc(p.resolution.texte)}</p>` : ''}<p class="verdict">${verdict}</p>`;
}

function montrerResultats() {
  const m = MINIJEU[p.minijeu];
  const medailles = ['🥇', '🥈', '🥉', '4ᵉ'];
  const enEquipe = !!p.equipes;
  $('resultats').innerHTML = `<div style="font-size:2.4rem">${m.glyphe}</div><h2>${esc(m.nom)}</h2>
    ${m.resoudre ? '' : `<p class="sous">${m.sens === 'haut' ? 'Le plus haut score gagne.' : 'Le plus petit score gagne.'}</p>`}
    ${equipesHtml()}
    <div class="tableau-res">${p.classement.map(({ i, rang, score }, k) => {
      const j = p.joueurs[i];
      const d = P.desDe(p, i);
      const marque = enEquipe ? (rang === 0 ? '🏆' : '😵') : (medailles[rang] || `${rang + 1}ᵉ`);
      return `<div class="res${enEquipe && rang ? ' perd' : ''}" style="--pc:${j.couleur};animation-delay:${k * 140}ms">
        <span class="rang">${marque}</span><span class="av">${j.avatar}</span>
        <span><b>${esc(j.nom)}</b><small>${esc(fmt(p.minijeu, score, roleDe(i)))}${j.humain ? '' : ' 🤖'}</small></span>
        <span class="gain">${'🎲'.repeat(d.des)}${d.bonus ? ` +${d.bonus}` : ''}</span></div>`;
    }).join('')}</div>
    <button class="btn jaune btn-large" id="b-aux-des">Aux dés ! 🎲</button>`;
  ouvrir('ov-resultats');
  son.fanfare();
  const f = P.formatDe(p);
  if (f.type === 'seul' && p.equipes[0].gagne && !p.equipes[0].egalite && estMoi(f.equipes[0][0])) succes.debloquer('fiesta-heros');
  if (enLigne) {
    $('b-aux-des').onclick = () => { EL.envoyer({ t: 'pret' }); $('b-aux-des').disabled = true; };
    majAttente();
    return;
  }
  $('b-aux-des').onclick = () => { fermer('ov-resultats'); P.versLesDes(p); suivre(); };
}

/* ------------------------------------------------------------------ */
/* Les dés et les déplacements                                          */
/* ------------------------------------------------------------------ */

function tourDeDes() {
  const i = P.quiLance(p);
  if (i === null) return;
  const j = p.joueurs[i];
  const d = P.desDe(p, i);
  PL.marquerActif(i);
  rendreClassement(i);
  const quoi = `${'🎲'.repeat(d.des)}${d.bonus ? ` + ${d.bonus}` : ''}`;
  if (enLigne) {
    // Le serveur mène : il lance pour l'ordinateur, et attend nos dés quand c'est notre tour.
    if (j.bloque) console_(`${j.avatar} <b>${esc(j.nom)}</b> est coincé dans un trou ! 🕳️`);
    else if (i === moi) {
      console_(`${j.avatar} <b>À vous de lancer</b> : ${quoi}`, 'Lancer ! 🎲', async () => {
        EL.envoyer({ t: 'roule' });
        EL.envoyer({ t: 'lancer', tirage: await arreterDes(d.des) });
      });
    } else console_(`${j.avatar} <b>${esc(j.nom)}</b> va lancer ${quoi}…`);
    return;
  }
  if (j.bloque) {
    console_(`${j.avatar} <b>${esc(j.nom)}</b> est coincé dans un trou ! 🕳️`, j.humain ? 'Zut…' : null, () => lancer());
    if (!j.humain) setTimeout(lancer, 1200);
    return;
  }
  if (j.humain) console_(`${j.avatar} <b>${esc(j.nom)}</b>, à vous de lancer : ${quoi}`, 'Lancer ! 🎲', async () => lancer(await arreterDes(d.des)));
  else { console_(`${j.avatar} <b>${esc(j.nom)}</b> lance ${quoi}…`); setTimeout(lancer, 900); }
}

/**
 * Les dés roulent, et le joueur les arrête : un toucher (ou Espace, Entrée)
 * par dé. Les faces défilent dans le désordre, trop vite pour viser. Rend
 * les faces obtenues ; les dés restent affichés.
 */
function arreterDes(n) {
  return new Promise((fini) => {
    $('des').innerHTML = `<div class="des-ligne">${'<div class="de roule">?</div>'.repeat(n)}</div><div class="des-total"></div>
      <button class="btn jaune btn-large stop" type="button">STOP ✋</button>
      <p class="des-aide">Touchez l’écran pour arrêter ${n > 1 ? 'chaque dé' : 'le dé'} !</p>`;
    const ov = $('ov-des');
    ov.classList.add('a-toi');
    ouvrir('ov-des');
    const faces = [...$('des').querySelectorAll('.de')];
    const valeurs = faces.map(() => 1 + Math.floor(Math.random() * 6));
    const tirage = [];
    const depuis = Date.now();
    const tic = setInterval(() => {
      faces.forEach((f, x) => {
        if (x < tirage.length) return;
        let v;
        do v = 1 + Math.floor(Math.random() * 6); while (v === valeurs[x]);
        valeurs[x] = v;
        f.textContent = v;
      });
      son.de();
    }, 70);
    const stop = (e) => {
      e.preventDefault();
      if (Date.now() - depuis < 300) return;      // un double toucher n'arrête pas le dé tout de suite
      const x = tirage.length;
      tirage.push(valeurs[x]);
      faces[x].classList.remove('roule');
      faces[x].classList.add('pose');
      faces[x].textContent = valeurs[x];
      son.top();
      if (tirage.length < n) return;
      annulerDes();
      $('des').querySelector('.stop')?.remove();
      $('des').querySelector('.des-aide')?.remove();
      if (n === 2 && tirage[0] === 6 && tirage[1] === 6) succes.debloquer('fiesta-double-six');
      fini(tirage);
    };
    const clavier = (e) => { if (e.key === ' ' || e.key === 'Enter') stop(e); };
    ov.addEventListener('pointerdown', stop);
    addEventListener('keydown', clavier);
    annulerDes = () => {
      annulerDes = null;
      clearInterval(tic);
      ov.removeEventListener('pointerdown', stop);
      removeEventListener('keydown', clavier);
      ov.classList.remove('a-toi');
    };
  });
}

/** Sur un même téléphone : `tirage`, les dés qu'un humain vient d'arrêter (ils sont déjà à l'écran). */
async function lancer(tirage = null) {
  if (occupe) return;
  occupe = true;
  const avant = p.joueurs.map((j) => j.pos);
  const res = P.lancer(p, tirage);
  if (!res.ok) { occupe = false; fermer('ov-des'); suivre(); return; }
  // Le moteur a tout calculé ; l'écran rejoue le chemin depuis les anciennes places.
  const apres = p.joueurs.map((j) => j.pos);
  p.joueurs.forEach((j, k) => { j.pos = avant[k]; });
  await animerLancer(res.resultat, !!tirage);
  p.joueurs.forEach((j, k) => { j.pos = apres[k]; });
  for (const x of p.joueurs) PL.placerPion(x.i, x.pos, p);
  rendreClassement();
  await attendre(500);
  occupe = false;
  if (p.phase === 'minijeu' && p.tour > 1) toast(`🎉 Tour ${p.tour} !`, 1500);
  suivre();
}

/**
 * Montre un lancer : les dés (sauf s'ils sont déjà à l'écran), puis le pion
 * qui avance case par case, la case spéciale et ses effets.
 */
async function animerLancer(r, desMontres = false) {
  const j = p.joueurs[r.i];
  if (!r.bloque) {
    if (!desMontres) {
      // Les dés roulent, puis se posent.
      $('des').innerHTML = `<div class="des-ligne">${r.tirage.map(() => '<div class="de roule">?</div>').join('')}</div><div class="des-total"></div>`;
      ouvrir('ov-des');
      const faces = [...$('des').querySelectorAll('.de')];
      for (let k = 0; k < 10; k++) { faces.forEach((f) => { f.textContent = 1 + Math.floor(Math.random() * 6); }); son.de(); await attendre(70); }
      faces.forEach((f, k) => { f.classList.remove('roule'); f.classList.add('pose'); f.textContent = r.tirage[k]; });
    }
    const total = $('des').querySelector('.des-total');
    if (total) total.innerHTML = `${r.total}${r.bonus ? `<small>dont +${r.bonus} de bonus</small>` : ''}`;
    son.top();
    await attendre(900);
    fermer('ov-des');
  } else {
    fermer('ov-des');
    toast(`${j.avatar} ${esc(j.nom)} sort du trou au prochain tour.`);
    await attendre(800);
  }

  // Le pion avance, case par case.
  const pas = async (chemin) => {
    for (const c of chemin) {
      j.pos = c;
      PL.placerPion(r.i, c, p);
      PL.sauterPion(r.i);
      son.pas();
      await attendre(210);
    }
  };
  await pas(r.chemin);
  if (r.effet) {
    const c = P.CASES[r.effet.type];
    PL.viserCase(r.effet.case);
    let texte = `${c.glyphe} <b>${c.nom}</b> ! ${c.texte}`;
    if (r.effet.type === 'de') texte = `🎲 <b>Dé bonus</b> : ${r.effet.de} ! Avancez de ${r.effet.de}.`;
    if (r.effet.type === 'echange') texte = r.effet.rien ? '🔀 <b>Échange</b>… mais vous êtes déjà en tête !' : `🔀 <b>Échange</b> avec ${p.joueurs[r.effet.avec].avatar} ${esc(p.joueurs[r.effet.avec].nom)} !`;
    toast(texte, 2600);
    if (['etoile', 'fusee', 'de'].includes(r.effet.type)) son.bon();
    else if (['tornade', 'trou', 'cadeau'].includes(r.effet.type)) son.mauvais();
    else son.top();
    await attendre(900);
    await pas(r.effet.chemin);
    for (const a of r.autres) { p.joueurs[a.i].pos = a.pos; PL.placerPion(a.i, a.pos, p); PL.sauterPion(a.i); }
  }
}

/* ------------------------------------------------------------------ */
/* En ligne : les états du serveur, rejoués un par un                   */
/* ------------------------------------------------------------------ */

function recevoir(m) {
  file.push(m);
  vider();
}

async function vider() {
  if (vidage) return;
  vidage = true;
  try {
    while (file.length) await traiterEnLigne(file.shift());
  } catch (err) {
    console.error('[fiesta] en ligne', err);
  } finally {
    vidage = false;
  }
}

async function traiterEnLigne(m) {
  if (m.t === 'fi:debut') {
    // Une nouvelle partie (ou une reprise) : le prochain état redessine tout.
    enLigne = true;
    p = null;
    vue = null;
    joueTour = 0;
    finComptee = false;
    arreterRoue?.();
    fermerDirect();
    ['ov-intro', 'ov-score', 'ov-resultats', 'ov-fin', 'ov-des', 'ov-pause'].forEach(fermer);
    return;
  }
  if (m.t === 'fi:etat') { surEtat(m.vue); return; }
  if (!p) return;
  if (m.t === 'fi:lance') {
    PL.marquerActif(m.r.i);
    console_('');
    // Nos dés sont posés à l'écran, sauf si le temps a filé et que le serveur a lancé pour nous.
    const poses = m.r.i === moi && !$('ov-des').hidden && !annulerDes;
    annulerDes?.();
    await animerLancer(m.r, poses);
    for (const x of p.joueurs) PL.placerPion(x.i, x.pos, p);
    await attendre(300);
    return;
  }
  if (m.t === 'fi:direct') { montrerDirect(m); return; }
  if (m.t === 'fi:roule' && p.phase === 'des') {
    const j = p.joueurs[m.i];
    console_(`${j.avatar} <b>${esc(j.nom)}</b> fait rouler ses dés… 🎲`);
    return;
  }
  if (m.t === 'fi:erreur' && p.phase === 'des' && P.quiLance(p) === moi) {
    // Nos dés ont été refusés : on recommence.
    fermer('ov-des');
    tourDeDes();
  }
}

/** Un état reçu du serveur. */
function surEtat(v) {
  const avant = p;
  vue = v;
  moi = v.moi;
  p = v.p;
  if (!avant) {
    aller('s-jeu');
    PL.dessiner(p);
    rendreClassement();
    suivre();
    return;
  }
  for (const x of p.joueurs) PL.placerPion(x.i, x.pos, p);
  const change = avant.phase !== p.phase || avant.tour !== p.tour || P.quiLance(avant) !== P.quiLance(p);
  if (!change) { rendreClassement(P.quiLance(p)); majAttente(); return; }
  if (avant.phase === 'minijeu' && p.phase !== 'minijeu') {
    arreterRoue?.();
    // Le direct reste un instant, le temps de voir le dernier tir.
    setTimeout(fermerDirect, 1500);
    fermer('ov-intro');
    // Le temps du mini-jeu s'est écoulé en pleine partie : l'ordinateur a joué pour nous.
    if (couperJeu) { couperJeu(); toast('⏱️ Temps écoulé !'); aller('s-jeu'); PL.dessiner(p); }
    // Notre score est encore à l'écran : « Suite » montrera les résultats.
    if (!$('ov-score').hidden) return;
  }
  if (avant.phase === 'resultats' && p.phase !== 'resultats') fermer('ov-resultats');
  suivre();
}

/** Qui reste-t-il à attendre (mini-jeu, résultats) ? */
/**
 * Le gardien des tirs au but joue en dernier, contre les tirs des autres : en
 * ligne, il attend qu'ils aient tous frappé.
 */
function gardienAttend(i) {
  if (!enLigne) return P.attendLesAutres(p, i);
  const f = P.formatDe(p);
  return f.type === 'seul' && !!MINIJEU[p.minijeu].soloEnDernier && f.equipes[0][0] === i && f.equipes[1].some((x) => !vue.faits[x]);
}

/* Le direct : les autres suivent le gardien, tir après tir. */
let directEl = null;
function montrerDirect({ i, e }) {
  if (!p || p.phase !== 'minijeu') return;
  const g = p.joueurs[i];
  const t = p.joueurs[e.tireur];
  if (!g || !t) return;
  if (!directEl) {
    directEl = document.createElement('div');
    directEl.className = 'direct';
    directEl.marque = [];
    document.body.appendChild(directEl);
  }
  const moiTireur = e.tireur === moi;
  const texte = e.resultat === 'arret' ? `🧤 ARRÊT de ${g.avatar} sur ${t.avatar} !`
    : e.resultat === 'but' ? `⚽ BUT de ${t.avatar} ${esc(t.nom)} !` : `❌ ${t.avatar} ${esc(t.nom)} rate son tir…`;
  directEl.marque.push(e.resultat === 'arret' ? '🧤' : e.resultat === 'but' ? '✅' : '❌');
  directEl.innerHTML = `<span class="en-direct">● EN DIRECT</span>
    <div class="evt flash">${texte}</div>
    <div class="score-direct">${directEl.marque.join(' ')}</div>
    <small>${g.avatar} ${esc(g.nom)} au but${moiTireur ? ' — c’était votre tir !' : ''}</small>`;
  if (e.resultat === 'but') son.bon(); else if (e.resultat === 'arret') son.mauvais(); else son.tic();
}
function fermerDirect() { directEl?.remove(); directEl = null; }

function majAttente() {
  if (!enLigne || !p || !vue) return;
  // Les tireurs ont tous frappé : au gardien !
  const bp = $('b-pret');
  if (p.phase === 'minijeu' && !$('ov-intro').hidden && bp?.disabled && !gardienAttend(moi)) {
    bp.disabled = false;
    bp.textContent = 'À vous, gardien ! 🧤';
    son.top();
  }
  const autour = (ok) => p.joueurs.filter((j) => !ok(j.i) && !vue.bots[j.i]).map((j) => j.avatar).join(' ');
  if (p.phase === 'minijeu' && vue.faits[moi]) {
    const qui = autour((i) => vue.faits[i]);
    console_(qui ? `⏳ En attente de ${qui}…` : '⏳ Les résultats arrivent…');
  }
  if (p.phase === 'resultats' && !$('ov-resultats').hidden && vue.prets[moi]) {
    const qui = autour((i) => vue.prets[i] || vue.absents[i]);
    $('b-aux-des').disabled = true;
    $('b-aux-des').textContent = qui ? `En attente de ${qui}…` : 'C’est parti !';
  }
}

/** La partie en ligne s'arrête (on a quitté, ou la table a fermé). */
function finirEnLigne() {
  arreterRoue?.();
  fermerDirect();
  couperJeu?.();
  annulerDes?.();
  enLigne = false;
  p = null;
  vue = null;
  file.length = 0;
  ['ov-intro', 'ov-score', 'ov-resultats', 'ov-fin', 'ov-des', 'ov-pause'].forEach(fermer);
}

/* ------------------------------------------------------------------ */
/* La fin                                                               */
/* ------------------------------------------------------------------ */

function montrerFin() {
  const g = p.joueurs[p.vainqueur];
  const tri = P.podium(p);
  const r = records();
  if (enLigne ? !finComptee : !p.compte) {
    if (enLigne) finComptee = true; else p.compte = true;
    r.parties += 1;
    if (estMoi(g.i)) {
      r.victoires += 1;
      succes.debloquer('fiesta-victoire');
      if (p.niveau === 'expert' && p.joueurs.some((x) => !x.humain)) succes.debloquer('fiesta-expert');
    }
    ecrire(CLE_RECORDS, r);
    if (!enLigne) ecrire(CLE_PARTIE, null);
  }
  const ordre = [1, 0, 2, 3].filter((k) => k < tri.length);
  $('fin').innerHTML = `<div class="couronne">👑</div>
    <h2>${g.avatar} ${esc(g.nom)} gagne !</h2>
    <p class="sous">${estMoi(g.i) ? 'Bravo, quelle fête ! 🎉' : g.humain ? 'Quelle partie ! La revanche ?' : 'L’ordinateur l’emporte… la revanche ?'}</p>
    <div class="podium">${ordre.map((k) => `<div class="marche p${k + 1}" style="--pc:${tri[k].couleur}">
      <span class="av">${tri[k].avatar}</span>${k + 1}<small style="font-size:.7rem">${tri[k].victoires} 🏅</small></div>`).join('')}</div>
    <p class="sous">🏅 = mini-jeux gagnés · ${p.tour} tours</p>
    <div class="ligne-boutons"><button class="btn" id="b-fin-menu">Menu</button><button class="btn rose" id="b-revanche">Revanche !</button></div>`;
  ouvrir('ov-fin');
  confettis();
  son.fanfare();
  if (enLigne) {
    $('b-fin-menu').textContent = 'Quitter';
    $('b-fin-menu').onclick = () => { EL.quitter(); majMenu(); };
    $('b-revanche').textContent = 'Retour au salon';
    $('b-revanche').onclick = () => EL.envoyer({ t: 'rejouer' });
    return;
  }
  $('b-fin-menu').onclick = () => { fermer('ov-fin'); p = null; majMenu(); };
  $('b-revanche').onclick = () => { fermer('ov-fin'); p = null; places = lire(CLE_PLACES, null) || placesParDefaut(); lancerPartie(); };
}

/* ------------------------------------------------------------------ */
/* La salle des mini-jeux                                               */
/* ------------------------------------------------------------------ */

function ouvrirSalle() {
  const r = records();
  $('salle').innerHTML = MINIJEUX.map((m) => `<button class="carte-jeu" data-jeu="${m.id}">
    <span class="g">${m.glyphe}</span><b>${esc(m.nom)}</b>
    <small>${m.resoudre ? `${P.FORMATS.seul.glyphe} contre l’ordi` : r.jeux[m.id] !== undefined ? `Record : ${esc(fmt(m.id, r.jeux[m.id]))}` : 'Pas encore joué'}</small></button>`).join('');
  aller('s-salle');
}

/* ------------------------------------------------------------------ */
/* Les règles                                                           */
/* ------------------------------------------------------------------ */

function reglesHtml() {
  return `<p>De 2 à 4 joueurs, humains ou ordinateurs. Le premier à atteindre l’arrivée 🏆 gagne.</p>
  <h3>Un tour</h3>
  <p>1. <b>Un mini-jeu</b> : chaque joueur humain y joue à son tour, sur le même téléphone. Les ordinateurs jouent aussi !<br>
  2. <b>Le classement</b> donne les dés : le 1ᵉʳ lance <b>deux dés</b>, les suivants un seul dé, avec un petit bonus qui baisse avec le rang.<br>
  3. <b>On avance</b>, dans l’ordre du classement : chacun <b>arrête ses dés</b> en touchant l’écran. Gare aux cases spéciales !</p>
  <h3>Trois sortes de mini-jeux</h3>
  <div class="grille">
    <div class="fiche"><span class="g">🎯</span><div><b>Chacun pour soi</b><small>Le 1ᵉʳ lance deux dés, les suivants un dé et un petit bonus.</small></div></div>
    <div class="fiche"><span class="g">🤝</span><div><b>2 contre 2</b><small>À quatre joueurs, en équipes tirées au sort. Les points des coéquipiers s’additionnent : chaque gagnant lance deux dés, chaque perdant un seul.</small></div></div>
    <div class="fiche"><span class="g">⚔️</span><div><b>1 contre tous</b><small>À trois ou quatre. Le joueur seul a son propre rôle (gardien, fantôme…). S’il gagne, il lance deux dés et un bonus ; sinon, les autres lancent deux dés chacun !</small></div></div>
  </div>
  <h3>Les cases</h3>
  <div class="grille">${Object.entries(P.CASES).filter(([k]) => !['normale', 'depart'].includes(k)).map(([, c]) => `<div class="fiche"><span class="g">${c.glyphe}</span>
    <div><b>${c.nom}</b><small>${c.texte}</small></div></div>`).join('')}</div>
  ${['chacun', 'duo', 'seul'].map((st) => `<h3>${P.FORMATS[st].glyphe} Mini-jeux ${st === 'chacun' ? 'chacun pour soi' : st === 'duo' ? '2 contre 2' : '1 contre tous'}</h3>
  <div class="grille">${MINIJEUX.filter((m) => m.style === st).map((m) => `<div class="fiche"><span class="g">${m.glyphe}</span><div><b>${esc(m.nom)}</b><small>${esc(m.regle)}</small></div></div>`).join('')}</div>`).join('')}`;
}

/* ------------------------------------------------------------------ */
/* Branchements                                                         */
/* ------------------------------------------------------------------ */

function brancher() {
  $('b-nouvelle').addEventListener('click', ouvrirConfig);
  $('b-continuer').addEventListener('click', () => { const s = lire(CLE_PARTIE, null); if (!s) { majMenu(); return; } p = s; entrerEnJeu(); });
  $('b-salle').addEventListener('click', ouvrirSalle);
  $('b-lancer').addEventListener('click', lancerPartie);
  document.querySelectorAll('[data-va]').forEach((b) => b.addEventListener('click', () => (b.dataset.va === 's-menu' ? majMenu() : aller(b.dataset.va))));
  const sonBouton = (b) => b.addEventListener('click', () => { const m = basculerSon(); $('b-son').textContent = m ? '🔇' : '🔊'; $('b-son-menu').textContent = m ? '🔇' : '🔊'; });
  sonBouton($('b-son')); sonBouton($('b-son-menu'));
  $('b-son').textContent = estMuet() ? '🔇' : '🔊';
  document.querySelectorAll('[data-ouvre]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.ouvre === 'ov-regles') $('regles').innerHTML = reglesHtml(); ouvrir(b.dataset.ouvre); }));
  document.addEventListener('click', (e) => { const f = e.target.closest('[data-ferme]'); if (f) fermer(f.dataset.ferme); });
  $('b-pause').addEventListener('click', () => ouvrir('ov-pause'));
  $('b-menu').addEventListener('click', () => {
    fermer('ov-pause');
    arreterRoue?.();
    // En ligne, quitter la partie : l'ordinateur prend la place.
    if (enLigne) { EL.quitter(); majMenu(); return; }
    sauver(); p = null; majMenu();
  });
  $('b-enligne').addEventListener('click', () => EL.ouvrir());

  // Les places
  $('places').addEventListener('click', (e) => {
    const t = e.target.closest('[data-type]');
    if (t) {
      const i = Number(t.closest('.place').dataset.i);
      places[i].type = t.dataset.type;
      if (t.dataset.type === 'humain' && (!places[i].nom || P.NOMS_ORDI.includes(places[i].nom))) places[i].nom = `Joueur ${i + 1}`;
      rendrePlaces();
      return;
    }
    const a = e.target.closest('[data-avatar]');
    if (a) {
      const i = Number(a.dataset.avatar);
      if (places[i].type === 'vide') return;
      const pris = new Set(places.filter((_, k) => k !== i).map((x) => x.avatar));
      let k = P.AVATARS.indexOf(places[i].avatar);
      do { k = (k + 1) % P.AVATARS.length; } while (pris.has(P.AVATARS[k]));
      places[i].avatar = P.AVATARS[k];
      rendrePlaces();
    }
  });
  $('places').addEventListener('input', (e) => {
    const n = e.target.closest('[data-nom]');
    if (n) places[Number(n.dataset.nom)].nom = n.value;
  });

  // La salle
  $('salle').addEventListener('click', (e) => {
    const c = e.target.closest('[data-jeu]');
    if (c) montrerIntro({ minijeu: c.dataset.jeu }, true);
  });

  // Le plateau se redessine à la taille de l'écran.
  addEventListener('resize', () => { if (p && $('s-jeu').classList.contains('is-active')) PL.dessiner(p); });
}

brancher();
EL.init({
  aller, toast, recevoir,
  finir: () => { finirEnLigne(); },
  nomPrefere: () => succes.pseudo?.() || lire(CLE_PLACES, null)?.find((x) => x.type === 'humain')?.nom || '',
  avatarPrefere: () => {
    const a = succes.profil?.().avatar;
    return P.AVATARS.includes(a) ? a : lire(CLE_PLACES, null)?.find((x) => x.type === 'humain')?.avatar || null;
  },
  retenirNom: () => {},
});
bandeau('fiesta', { visible: () => $('s-menu').classList.contains('is-active'), rejoindre: () => EL.ouvrir() });
succes.visiter('fiesta');
majMenu();
installerMusique('fiesta', { actif: () => !estMuet(), permis: () => !$('s-arene').classList.contains('is-active') });

if ('serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
