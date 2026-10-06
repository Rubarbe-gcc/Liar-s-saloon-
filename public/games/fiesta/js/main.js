/**
 * FIESTA — l'écran.
 *
 * La partie vit dans `p` (shared/fiesta/partie.js) ; cet écran l'anime : le
 * mini-jeu de chaque tour (les humains l'un après l'autre, sur le même
 * téléphone), le classement, les dés qui roulent, les pions qui sautent de
 * case en case. La partie se range dans le navigateur à chaque étape.
 */

import * as P from '../../../shared/fiesta/partie.js';
import { MINIJEUX, MINIJEU, meilleur } from '../../../shared/fiesta/minijeux.js';
import * as PL from './plateau.js';
import { son, estMuet, basculerSon, attendre } from './jeux/outils.js';
import { installerMusique } from '../../../shared/musique.js';
import * as succes from '../../../shared/succes.js';

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
};

let p = null;
let occupe = false;
let arreterJeu = null;

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

const fmt = (id, v) => `${v} ${MINIJEU[id].unite}`;
const records = () => ({ jeux: {}, joues: [], victoires: 0, parties: 0, ...lire(CLE_RECORDS, {}) });
const sauver = () => { if (p) ecrire(CLE_PARTIE, p.phase === 'fin' ? null : p); };

function noterRecord(id, v) {
  const r = records();
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
    const h = P.humainSuivant(p);
    if (h) montrerIntro(h);
    return;
  }
  if (p.phase === 'resultats') { montrerResultats(); return; }
  if (p.phase === 'des') { tourDeDes(); return; }
  if (p.phase === 'fin') montrerFin();
}

/* ------------------------------------------------------------------ */
/* Le mini-jeu du tour                                                  */
/* ------------------------------------------------------------------ */

function montrerIntro(j, entrainement = false) {
  const m = MINIJEU[entrainement ? j.minijeu : p.minijeu];
  const humains = entrainement ? [] : p.joueurs.filter((x) => x.humain);
  const premier = !entrainement && humains.indexOf(j) === 0;
  $('intro').innerHTML = `${!entrainement && premier ? `<p class="sous">Tour ${p.tour} — le mini-jeu est…</p>` : ''}
    <div class="glyphe">${m.glyphe}</div>
    <h2>${esc(m.nom)}</h2>
    <p class="regle">${esc(m.regle)}</p>
    ${entrainement ? '' : `<div class="qui" style="--pc:${j.couleur}">${j.avatar} À ${esc(j.nom)} !</div>
      ${humains.length > 1 ? '<p class="passe">Passez-lui le téléphone 📱</p>' : ''}`}
    <button class="btn rose btn-large" id="b-pret">Je suis prêt ! 🎮</button>`;
  ouvrir('ov-intro');
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
    fin: (score) => {
      if (fini) return;
      fini = true;
      arreterJeu = null;
      apresMinijeu(id, j, score);
    },
  });
  // Quitter en plein mini-jeu : le pire score.
  $('b-abandon-jeu').onclick = () => {
    if (fini) return;
    fini = true;
    arreterJeu?.();
    arreterJeu = null;
    apresMinijeu(id, j, m.sens === 'haut' ? 0 : 9999, true);
  };
}

function apresMinijeu(id, j, score, abandon = false) {
  const record = abandon ? false : noterRecord(id, score);
  const m = MINIJEU[id];
  $('score-perso').innerHTML = `<div style="font-size:2.6rem">${m.glyphe}</div>
    <p class="sous">${j ? `${j.avatar} ${esc(j.nom)}` : 'Entraînement'}</p>
    <div class="gros">${abandon ? 'Abandon' : esc(fmt(id, score))}</div>
    ${record ? '<p class="record">🏅 Nouveau record personnel !</p>' : ''}
    <button class="btn rose btn-large" id="b-suite">${j ? 'Suite ›' : 'Retour à la salle'}</button>`;
  ouvrir('ov-score');
  if (!abandon) son.fanfare();
  $('b-suite').onclick = () => {
    fermer('ov-score');
    if (!j) { ouvrirSalle(); return; }
    P.score(p, j.i, score);
    aller('s-jeu');
    PL.dessiner(p);
    suivre();
  };
}

function montrerResultats() {
  const m = MINIJEU[p.minijeu];
  const medailles = ['🥇', '🥈', '🥉', '4ᵉ'];
  $('resultats').innerHTML = `<div style="font-size:2.4rem">${m.glyphe}</div><h2>${esc(m.nom)}</h2>
    <p class="sous">${m.sens === 'haut' ? 'Le plus haut score gagne.' : 'Le plus petit score gagne.'}</p>
    <div class="tableau-res">${p.classement.map(({ i, rang, score }, k) => {
      const j = p.joueurs[i];
      const d = P.desDe(p, i);
      return `<div class="res" style="--pc:${j.couleur};animation-delay:${k * 140}ms">
        <span class="rang">${medailles[rang] || `${rang + 1}ᵉ`}</span><span class="av">${j.avatar}</span>
        <span><b>${esc(j.nom)}</b><small>${esc(fmt(p.minijeu, score))}${j.humain ? '' : ' 🤖'}</small></span>
        <span class="gain">${'🎲'.repeat(d.des)}${d.bonus ? ` +${d.bonus}` : ''}</span></div>`;
    }).join('')}</div>
    <button class="btn jaune btn-large" id="b-aux-des">Aux dés ! 🎲</button>`;
  ouvrir('ov-resultats');
  son.fanfare();
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
  if (j.bloque) {
    console_(`${j.avatar} <b>${esc(j.nom)}</b> est coincé dans un trou ! 🕳️`, j.humain ? 'Zut…' : null, () => lancer());
    if (!j.humain) setTimeout(lancer, 1200);
    return;
  }
  if (j.humain) console_(`${j.avatar} <b>${esc(j.nom)}</b>, à vous de lancer : ${quoi}`, 'Lancer ! 🎲', () => lancer());
  else { console_(`${j.avatar} <b>${esc(j.nom)}</b> lance ${quoi}…`); setTimeout(lancer, 900); }
}

async function lancer() {
  if (occupe) return;
  occupe = true;
  const avant = p.joueurs.map((j) => j.pos);
  const res = P.lancer(p);
  if (!res.ok) { occupe = false; return; }
  const r = res.resultat;
  const j = p.joueurs[r.i];

  if (!r.bloque) {
    // Les dés roulent, puis se posent.
    $('des').innerHTML = `<div class="des-ligne">${r.tirage.map(() => '<div class="de roule">?</div>').join('')}</div><div class="des-total"></div>`;
    ouvrir('ov-des');
    const faces = [...$('des').querySelectorAll('.de')];
    for (let k = 0; k < 10; k++) { faces.forEach((f) => { f.textContent = 1 + Math.floor(Math.random() * 6); }); son.de(); await attendre(70); }
    faces.forEach((f, k) => { f.classList.remove('roule'); f.classList.add('pose'); f.textContent = r.tirage[k]; });
    $('des').querySelector('.des-total').innerHTML = `${r.total}${r.bonus ? `<small>dont +${r.bonus} de bonus</small>` : ''}`;
    son.top();
    await attendre(900);
    fermer('ov-des');
  } else {
    toast(`${j.avatar} ${esc(j.nom)} sort du trou au prochain tour.`);
    await attendre(800);
  }

  // Le pion avance, case par case.
  let pos = avant[r.i];
  const pas = async (chemin) => {
    for (const c of chemin) {
      pos = c;
      j.pos = c;
      PL.placerPion(r.i, c, p);
      PL.sauterPion(r.i);
      son.pas();
      await attendre(210);
    }
  };
  // Pendant l'animation, la position affichée suit le chemin (le moteur a déjà tout calculé).
  const finale = j.pos;
  j.pos = avant[r.i];
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
    if (r.effet.type === 'echange' && !r.effet.rien) { j.pos = finale; PL.placerPion(r.i, finale, p); PL.sauterPion(r.i); }
    else await pas(r.effet.chemin);
    for (const a of r.autres) { PL.placerPion(a.i, a.pos, p); PL.sauterPion(a.i); }
  }
  j.pos = finale;
  // Tous les pions se recalent (deux pions sur la même case s'écartent).
  for (const x of p.joueurs) PL.placerPion(x.i, x.pos, p);
  rendreClassement();
  await attendre(500);
  occupe = false;
  if (p.phase === 'minijeu' && p.tour > 1) toast(`🎉 Tour ${p.tour} !`, 1500);
  suivre();
}

/* ------------------------------------------------------------------ */
/* La fin                                                               */
/* ------------------------------------------------------------------ */

function montrerFin() {
  const g = p.joueurs[p.vainqueur];
  const tri = P.podium(p);
  const r = records();
  if (!p.compte) {
    p.compte = true;
    r.parties += 1;
    if (g.humain) {
      r.victoires += 1;
      succes.debloquer('fiesta-victoire');
      if (p.niveau === 'expert' && p.joueurs.some((x) => !x.humain)) succes.debloquer('fiesta-expert');
    }
    ecrire(CLE_RECORDS, r);
    ecrire(CLE_PARTIE, null);
  }
  const ordre = [1, 0, 2, 3].filter((k) => k < tri.length);
  $('fin').innerHTML = `<div class="couronne">👑</div>
    <h2>${g.avatar} ${esc(g.nom)} gagne !</h2>
    <p class="sous">${g.humain ? 'Bravo, quelle fête ! 🎉' : 'L’ordinateur l’emporte… la revanche ?'}</p>
    <div class="podium">${ordre.map((k) => `<div class="marche p${k + 1}" style="--pc:${tri[k].couleur}">
      <span class="av">${tri[k].avatar}</span>${k + 1}<small style="font-size:.7rem">${tri[k].victoires} 🏅</small></div>`).join('')}</div>
    <p class="sous">🏅 = mini-jeux gagnés · ${p.tour} tours</p>
    <div class="ligne-boutons"><button class="btn" id="b-fin-menu">Menu</button><button class="btn rose" id="b-revanche">Revanche !</button></div>`;
  ouvrir('ov-fin');
  confettis();
  son.fanfare();
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
    <small>${r.jeux[m.id] !== undefined ? `Record : ${esc(fmt(m.id, r.jeux[m.id]))}` : 'Pas encore joué'}</small></button>`).join('');
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
  3. <b>On avance</b>, dans l’ordre du classement. Gare aux cases spéciales !</p>
  <h3>Les cases</h3>
  <div class="grille">${Object.entries(P.CASES).filter(([k]) => !['normale', 'depart'].includes(k)).map(([, c]) => `<div class="fiche"><span class="g">${c.glyphe}</span>
    <div><b>${c.nom}</b><small>${c.texte}</small></div></div>`).join('')}</div>
  <h3>Les mini-jeux</h3>
  <div class="grille">${MINIJEUX.map((m) => `<div class="fiche"><span class="g">${m.glyphe}</span><div><b>${esc(m.nom)}</b><small>${esc(m.regle)}</small></div></div>`).join('')}</div>`;
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
  $('b-menu').addEventListener('click', () => { fermer('ov-pause'); sauver(); p = null; majMenu(); });

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
succes.visiter('fiesta');
majMenu();
installerMusique('fiesta', { actif: () => !estMuet(), permis: () => !$('s-arene').classList.contains('is-active') });

if ('serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
