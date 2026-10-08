/**
 * STREET COMBAT — l'écran : les menus, le choix des combattants et de
 * l'arène, les modes (Histoire, Tournoi, Tour des défis), et la boucle du
 * combat (60 images par seconde, le moteur avance à pas fixes, l'écran
 * dessine ce qu'il voit).
 *
 * Les commandes : le clavier (un ou deux joueurs), les manettes, et les
 * commandes tactiles pour le téléphone.
 */

import { PERSOS, PERSO, ROSTER, BOSS, SECRETS, JAUGE, STATUTS, lireEntree, aDebloquer } from '../../../shared/street/persos.js';
import { creerCombat, pas, evenements, pose, assister, ARENE as A } from '../../../shared/street/combat.js';
import { dessinerCombattant, dessinerPortrait, rgba, teinte } from './dessin.js';
import { ARENES, ARENE, fondArene, animerArene } from './arenes.js';
import * as FX from './effets.js';
import { creerHud, dessinerHud } from './hud.js';
import { jouer as son, estMuet, basculerSon } from './son.js';
import { installerMusique } from '../../../shared/musique.js';
import * as succes from '../../../shared/succes.js';
import { jouerCine, avancerCine, passerCine, quitterCine, choisirCine, musiqueCine, tenirInfiltration, infiltrationEnCours, vrai, dimensionner as dimensionnerCine } from './cine.js';
import * as CODEX from './codex.js';
import * as HIST from './histoire.js';
import { dire, crier, taire, voixDe, voixActives, basculerVoix } from './voix.js';
import { CORPS, TETES, PEAUX, ENERGIES, TENUES, CHEVEUX, ACCESSOIRES, MAX_ACCESSOIRES, ECOLES, GENRES, VOIX_HAUTEUR, defautHeros, herosAuHasard, construireHeros } from '../../../shared/street/heros.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function lire(cle, defaut) { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } }
function ecrire(cle, v) { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); } catch { /* plein */ } }

const CLE_DEBLOQUES = 'street.debloques';
const CLE_RECORDS = 'street.records';
const CLE_HISTOIRE = 'street.histoire';
const CLE_SAUVEGARDES = 'street.sauvegardes';
const CLE_CROISES = 'street.croises';
const CLE_TOURNOI = 'street.tournoi';
const CLE_TOUR = 'street.tour';
const CLE_NIVEAU = 'street.niveau';
const NIVEAUX = [['facile', 'Facile'], ['normal', 'Normal'], ['difficile', 'Difficile'], ['impossible', 'Impossible']];

const debloques = () => new Set(lire(CLE_DEBLOQUES, []));
/** Un combattant qu'on peut choisir : de base, ou déjà débloqué. */
const disponible = (p) => !aDebloquer(p) || debloques().has(p.id);
/** Débloque un combattant (et son arène). Rend vrai s'il est nouveau. */
function debloquer(id) {
  const d = debloques();
  if (d.has(id)) return false;
  d.add(id);
  ecrire(CLE_DEBLOQUES, [...d]);
  return true;
}
/** Les combattants rencontrés dans l'histoire, pas encore débloqués. */
const croises = () => new Set(lire(CLE_CROISES, []));
function croiser(id) {
  const c = croises();
  if (!c.has(id)) { c.add(id); ecrire(CLE_CROISES, [...c]); }
}
/** Où gagner un combattant caché. */
function indice(p) {
  if (p.indice) return p.indice;
  if (p.boss) return 'Battez-le dans le mode Histoire';
  return { histoire: 'Terminez le mode Histoire', tournoi: 'Gagnez le Tournoi en difficile', tour: 'Atteignez le sommet de la Tour des défis' }[p.secret] || '';
}
const records = () => ({ victoires: 0, combats: 0, combo: 0, tour: 0, tournois: 0, ...lire(CLE_RECORDS, {}) });

/* ------------------------------------------------------------------ */
/* Petits outils                                                        */
/* ------------------------------------------------------------------ */

function aller(id) {
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  if (id !== 's-combat') arreterBoucle();
  if (id !== 's-cine' && id !== 's-combat') taire();
  animMenu.actif = id === 's-menu';
  animFiche.actif = id === 's-choix';
  animCreateur.actif = id === 's-createur';
  if (animMenu.actif || animFiche.actif || animCreateur.actif) relancerDecor();
}
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

/* ------------------------------------------------------------------ */
/* Le menu                                                              */
/* ------------------------------------------------------------------ */

const animMenu = { actif: true, a: null, b: null, t: 0 };
const animFiche = { actif: false };
const animCreateur = { actif: false, t: 0 };
let decorRaf = 0;

function relancerDecor() {
  if (decorRaf) return;
  const boucle = () => {
    decorRaf = 0;
    if (animMenu.actif) dessinerFondMenu();
    if (animFiche.actif) dessinerFiche();
    if (animCreateur.actif) dessinerCreateur();
    if (animMenu.actif || animFiche.actif || animCreateur.actif) decorRaf = requestAnimationFrame(boucle);
  };
  decorRaf = requestAnimationFrame(boucle);
}

function dessinerFondMenu() {
  const cv = $('fond-menu');
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  const t = (animMenu.t += 1);
  if (!animMenu.a || t % 400 === 1) {
    const dispo = PERSOS.filter(disponible);
    animMenu.a = dispo[Math.floor(Math.random() * dispo.length)];
    do animMenu.b = dispo[Math.floor(Math.random() * dispo.length)]; while (animMenu.b === animMenu.a);
  }
  const fond = g.createLinearGradient(0, 0, 0, h);
  fond.addColorStop(0, '#08040f'); fond.addColorStop(0.6, '#1a0820'); fond.addColorStop(1, '#2a0610');
  g.fillStyle = fond; g.fillRect(0, 0, w, h);
  // La grille en perspective.
  const horizon = h * 0.62;
  g.strokeStyle = 'rgba(255,42,74,0.25)'; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const y = horizon + ((i + (t / 20) % 1) ** 2) * ((h - horizon) / 300); if (y > h) break; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(w / 2 + i * 30, horizon); g.lineTo(w / 2 + i * 220, h); g.stroke(); }
  // Le soleil couchant.
  const sol = g.createRadialGradient(w / 2, horizon, 10, w / 2, horizon, h * 0.5);
  sol.addColorStop(0, 'rgba(255,120,60,0.35)'); sol.addColorStop(1, 'rgba(255,40,80,0)');
  g.fillStyle = sol; g.fillRect(0, 0, w, h);
  // Deux combattants qui se toisent.
  const e = Math.min(w / 500, h / 420);
  const poses = ['repos', 'repos', 'repos', 'garde', 'poing', 'repos', 'lance', 'repos'];
  const pa = poses[Math.floor(t / 45) % poses.length];
  const pb = poses[Math.floor(t / 45 + 3) % poses.length];
  dessinerCombattant(g, animMenu.a, { x: w * 0.16, y: h * 0.96, dir: 1, pose: pa, t, p: ((t % 45) / 20), echelle: e * 1.15, aura: 0.6, alpha: 0.85 });
  dessinerCombattant(g, animMenu.b, { x: w * 0.84, y: h * 0.96, dir: -1, pose: pb, t, p: ((t % 45) / 20), echelle: e * 1.15, aura: 0.6, alpha: 0.85 });
  const voile = g.createLinearGradient(0, 0, w, 0);
  voile.addColorStop(0, 'rgba(8,4,15,0)'); voile.addColorStop(0.3, 'rgba(8,4,15,0.55)'); voile.addColorStop(0.7, 'rgba(8,4,15,0.55)'); voile.addColorStop(1, 'rgba(8,4,15,0)');
  g.fillStyle = voile; g.fillRect(0, 0, w, h);
}

function majMenu() {
  const h = sauvegardes().filter((x) => x && !x.fini).sort((a, b) => b.maj - a.maj)[0];
  $('histoire-info').textContent = h ? `Reprendre : ${HIST.ACTES[sceneDe(h).acte].num} · ${sceneDe(h).sous}` : '';
  const t = lire(CLE_TOURNOI, null);
  $('tournoi-info').textContent = t ? `Reprendre : ${['les quarts', 'les demies', 'la finale'][t.tour]}` : '';
  const r = records();
  const to = lire(CLE_TOUR, null);
  $('tour-info').textContent = to ? `Reprendre : étage ${to.etage + 1}` : r.tour ? `Record : étage ${r.tour}` : '';
  const caches = PERSOS.filter((p) => !disponible(p)).length;
  $('secrets-info').textContent = caches ? `🔒 ${caches} combattant${caches > 1 ? 's' : ''} à découvrir` : '✨ Tous les combattants sont débloqués !';
  $('records').textContent = r.combats ? `🏆 ${r.victoires} victoire${r.victoires > 1 ? 's' : ''} · meilleur combo ${r.combo}` : '';
  $('b-son-menu').textContent = estMuet() ? '🔇' : '🔊';
  aller('s-menu');
}

/* ------------------------------------------------------------------ */
/* Ce qu'on prépare : le mode, les combattants, l'arène                 */
/* ------------------------------------------------------------------ */

const prep = { mode: 'versus', p1: 'ryuken', p2: null, arene: null, niveau: lire(CLE_NIVEAU, 'normal'), etape: 1, choix: 'ryuken' };

function commencerMode(mode) {
  prep.mode = mode;
  prep.etape = 1;
  prep.p2 = null;
  ouvrirChoix();
}

/* ------------------------------------------------------------------ */
/* Le choix du combattant                                               */
/* ------------------------------------------------------------------ */

const portraitsGrille = new Map();

function ouvrirChoix() {
  const titres = {
    versus: ['Votre combattant', 'Votre adversaire'],
    deux: ['Joueur 1 : votre combattant', 'Joueur 2 : votre combattant'],
    entrainement: ['Votre combattant', 'Le mannequin'],
    histoire: ['Le héros de l’histoire'],
    tournoi: ['Votre combattant pour le tournoi'],
    tour: ['Votre combattant pour la tour'],
  };
  const solo = ['histoire', 'tournoi', 'tour'].includes(prep.mode);
  $('choix-titre').textContent = titres[prep.mode][prep.etape - 1];
  $('choix-ok').textContent = solo ? 'En route !' : prep.etape === 1 ? 'Choisir ›' : 'Combattre !';
  const grille = $('grille-persos');
  grille.innerHTML = '';
  for (const p of PERSOS) {
    const b = document.createElement('button');
    b.className = 'carte-perso';
    b.dataset.id = p.id;
    // Un combattant caché : une carte « ? », rien de plus.
    if (!disponible(p)) {
      b.classList.add('cache');
      b.title = `Combattant secret — ${indice(p)}`;
      if (croises().has(p.id)) {
        // Rencontré dans l'histoire : on connaît sa silhouette et son nom.
        b.classList.add('croise');
        const cv = document.createElement('canvas');
        cv.width = cv.height = 160;
        dessinerPortrait(cv.getContext('2d'), p, 160, { t: 8, ombre: true });
        b.append(cv);
        b.insertAdjacentHTML('beforeend', `<span>🔒 ${esc(p.nom)}</span>`);
        b.title = `${p.nom} — ${indice(p)}`;
      } else b.innerHTML = '<span class="mystere">?</span>';
      grille.append(b);
      continue;
    }
    // L'histoire se vit avec un combattant de base.
    if (prep.mode === 'histoire' && aDebloquer(p)) b.classList.add('verrou');
    let cv = portraitsGrille.get(p.id);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = cv.height = 160;
      dessinerPortrait(cv.getContext('2d'), p, 160, { t: 8 });
      portraitsGrille.set(p.id, cv);
    }
    const copie = document.createElement('canvas');
    copie.width = copie.height = 160;
    copie.getContext('2d').drawImage(cv, 0, 0);
    b.append(copie);
    b.insertAdjacentHTML('beforeend', `<span>${esc(p.nom)}</span>${p.boss ? '<i class="boss-etiq">BOSS</i>' : ''}`);
    b.title = b.classList.contains('verrou') ? `${p.nom} — l’histoire se joue avec un combattant de base` : p.nom;
    grille.append(b);
  }
  prep.choix = prep.etape === 1 ? prep.p1 : (prep.p2 || ROSTER[Math.floor(Math.random() * ROSTER.length)].id);
  if (!disponible(PERSO[prep.choix]) || (prep.mode === 'histoire' && aDebloquer(PERSO[prep.choix]))) prep.choix = 'ryuken';
  marquerChoix();
  aller('s-choix');
}

function marquerChoix() {
  document.querySelectorAll('.carte-perso').forEach((b) => {
    b.classList.toggle('choisi', b.dataset.id === prep.choix);
    b.classList.toggle('choisi2', prep.etape === 2 && b.dataset.id === prep.p1);
  });
  remplirFiche(PERSO[prep.choix]);
  animFiche.t0 = 0;
}

/** Ce que fait une compétence, en clair. */
function decrire(d) {
  const effet = { brulure: ' qui brûle', poison: ' qui empoisonne', gel: ' qui gèle', lenteur: ' qui ralentit' }[d.effet] || '';
  switch (d.type) {
    case 'projectile': {
      let s = d.nb > 1 ? `${d.nb} projectiles` : 'Projectile';
      if (d.eventail) s += ' en éventail';
      if (d.tete) s += ' à tête chercheuse';
      if (d.gravite) s += ' lancé en cloche';
      if (d.traverse) s += ' qui traverse';
      if (d.attire) s += ' qui aspire';
      if (d.rase) s += ' qui rase le sol';
      if (d.stun >= 40) s += ' qui piège';
      return s + effet;
    }
    case 'faisceau': {
      let s = d.cone ? 'Souffle' : 'Rayon';
      if (d.attire) s += ' qui attire l’adversaire';
      if (d.drain) s += ' qui vous soigne';
      if (d.recul >= 20) s += ' qui repousse';
      return s + effet;
    }
    case 'ruee': {
      let s = d.vy && d.vy <= -10 ? 'Coup montant' : d.plonge ? 'Bond plongeant' : d.balaye ? 'Balayage' : 'Ruée';
      if (d.coups > 1) s += ` en ${d.coups} coups`;
      if (d.invincible) s += ', invincible';
      if (d.armure) s += ', super-armure';
      if (d.traverse) s += ' qui traverse';
      if (d.lance) s += ' qui envoie en l’air';
      if (d.emporte) s += ' qui emporte';
      if (d.attire) s += ' qui ramène';
      if (d.portee >= 140) s += ', longue portée';
      return s + effet;
    }
    case 'zone': {
      const ciel = ['eclair', 'lune', 'rayon-ciel', 'etoiles'].includes(d.forme);
      let s = ciel ? 'Frappe du ciel' : d.ou === 'soi' ? 'Explosion autour de soi' : d.solSeulement ? 'Onde au sol' : d.forme === 'pic' ? 'Pic qui jaillit' : d.forme === 'champ' ? 'Champ de gravité' : d.forme === 'vague' ? 'Vague' : 'Zone';
      s += d.ou === 'cible' ? ' sur l’adversaire' : d.ou === 'devant' ? ' devant soi' : '';
      if (d.coups > 1) s += ` (${d.coups} coups)`;
      if (d.ecrase) s += ', écrase au sol';
      if (d.souleve || d.lance) s += ', envoie en l’air';
      return s + effet;
    }
    case 'teleport': return `Téléportation${d.derriere ? ' dans le dos' : d.recule ? ' en arrière' : ''}${d.degats ? ' et frappe' : ''}`;
    case 'garde': return d.contre ? 'Parade : contre-attaque si on vous frappe' : d.renvoi ? 'Miroir : renvoie les projectiles' : 'Bouclier : encaisse sans broncher';
    case 'soin': return `Se soigne (+${d.soin})`;
    default: return '';
  }
}

export function listeCoupsHtml(p) {
  const lignes = [
    ['Spécial B', `🅱️ (${JAUGE.specB} %)`, p.specB],
    ['Spécial A', `🅰️ (${JAUGE.specA} %)`, p.specA],
  ];
  return `<p class="coup-titre">Compétences</p><div class="coups">
    ${lignes.map(([quoi, touche, d]) => `<div class="coup"><span><b>${esc(d.nom)}</b><br><small>${esc(decrire(d))}</small></span><span class="entree">${touche}</span></div>`).join('')}
    <div class="coup ulti"><span><b>${esc(p.ulti.nom)}</b><br><small>Ultime : cinématique, portée ${p.ulti.portee}</small></span><span class="entree">ULTI (100 %)</span></div>
    <div class="coup"><span><b>${esc(p.saisie.nom)}</b><br><small>Saisie : ${p.saisie.seq.length} coups, imparable</small></span><span class="entree">✊</span></div>
  </div>
  <p class="coup-titre">Combos</p><div class="coups">
    ${p.combos.map((cb) => `<div class="coup"><span><b>${esc(cb.nom)}</b><br><small>${esc(cb.entree === 'PPK' ? 'Finisseur de l’enchaînement' : decrire(cb.coup))}</small></span><span class="entree">${lireEntree(cb.entree)}</span></div>`).join('')}
  </div>`;
}

function remplirFiche(p) {
  const verrou = !disponible(p);
  $('fiche-texte').innerHTML = `<h3 class="fiche-nom" style="color:${p.c.c1}">${esc(p.nom)}</h3>
    <p class="fiche-style">${esc(p.style)} — <i>${esc(p.desc)}</i></p>

    <div class="stats">
      <span>VIE</span><i><b style="width:${(p.stats.hp / 15) * 100}%"></b></i>
      <span>FORCE</span><i><b style="width:${(p.stats.dmg / 15) * 100}%"></b></i>
      <span>DÉFENSE</span><i><b style="width:${(p.stats.def / 15) * 100}%"></b></i>
      <span>VITESSE</span><i><b style="width:${(p.vitesse / 6) * 100}%"></b></i>
    </div>
    ${listeCoupsHtml(p)}`;
  $('choix-ok').disabled = verrou;
}

function dessinerFiche() {
  const cv = $('fiche-apercu');
  const g = cv.getContext('2d');
  const p = PERSO[prep.choix];
  animFiche.t0 = (animFiche.t0 || 0) + 1;
  const t = animFiche.t0;
  const fond = g.createLinearGradient(0, 0, 0, cv.height);
  fond.addColorStop(0, teinte(p.c.c2, -0.6)); fond.addColorStop(1, '#05020a');
  g.fillStyle = fond; g.fillRect(0, 0, cv.width, cv.height);
  const h = g.createRadialGradient(210, 200, 10, 210, 200, 220);
  h.addColorStop(0, rgba(p.c.c1, 0.4)); h.addColorStop(1, rgba(p.c.c1, 0));
  g.fillStyle = h; g.fillRect(0, 0, cv.width, cv.height);
  // Le combattant fait sa démonstration.
  const demo = ['repos', 'repos', 'poing', 'repos', 'pied', 'repos', 'lance', 'repos', 'ruee', 'repos', 'ulti', 'ulti', 'victoire'];
  const k = Math.floor(t / 40) % demo.length;
  const posee = demo[k];
  dessinerCombattant(g, p, { x: 190, y: 285, dir: 1, pose: posee, t, p: (t % 40) / 18, echelle: 1.55, aura: posee === 'ulti' ? 1 : 0.25 });
  g.font = '900 13px Impact, sans-serif'; g.fillStyle = rgba('#ffffff', 0.6); g.textAlign = 'right';
  g.fillText(p.style.toUpperCase(), cv.width - 10, 20);
}

function validerChoix() {
  const p = PERSO[prep.choix];
  if (!disponible(p)) return;
  son('valide');
  if (prep.mode === 'histoire' && aDebloquer(p)) return;
  if (prep.mode === 'histoire') { nouvelleHistoire(prep.choix); return; }
  if (prep.mode === 'tournoi') { lancerTournoi(prep.choix); return; }
  if (prep.mode === 'tour') { lancerTour(prep.choix); return; }
  if (prep.etape === 1) {
    prep.p1 = prep.choix;
    prep.etape = 2;
    ouvrirChoix();
    return;
  }
  prep.p2 = prep.choix;
  ouvrirArenes();
}

/* ------------------------------------------------------------------ */
/* L'arène                                                              */
/* ------------------------------------------------------------------ */

function ouvrirArenes() {
  $('reglage-ia').hidden = prep.mode !== 'versus';
  $('niveaux-ia').innerHTML = NIVEAUX.map(([id, nom]) => `<button data-niveau="${id}" class="${prep.niveau === id ? 'on' : ''}">${nom}</button>`).join('');
  const dispo = ARENES.filter((a) => !a.boss || debloques().has(a.boss));
  const grille = $('grille-arenes');
  grille.innerHTML = '<button class="carte-arene hasard" data-arene="hasard">🎲<span>AU HASARD</span></button>';
  for (const a of dispo) {
    const b = document.createElement('button');
    b.className = 'carte-arene';
    b.dataset.arene = a.id;
    const cv = document.createElement('canvas');
    cv.width = 250; cv.height = 150;
    const g = cv.getContext('2d');
    g.drawImage(fondArene(a), 0, 0, 250, 150);
    b.append(cv);
    b.insertAdjacentHTML('beforeend', `<span>${esc(a.nom)}</span>`);
    grille.append(b);
  }
  aller('s-arenes');
}

/* ------------------------------------------------------------------ */
/* Les difficultés (Histoire, Tournoi)                                  */
/* ------------------------------------------------------------------ */

const DIFFICULTES = {
  histoire: [
    { id: 'normal', nom: 'NORMAL', couleur: '#36d46a', glyphe: '📖', texte: 'L’histoire, à un rythme raisonnable.' },
    { id: 'difficile', nom: 'DIFFICILE', couleur: '#ff2a4a', glyphe: '🔥', texte: 'Les combattants corrompus ne pardonnent rien.' },
  ],
  tournoi: [
    { id: 'facile', nom: 'FACILE', couleur: '#36d46a', glyphe: '🥉', texte: 'Huit combattants, trois victoires pour la coupe.' },
    { id: 'normal', nom: 'NORMAL', couleur: '#36b4ff', glyphe: '🥈', texte: 'Les favoris ne se laissent pas faire.' },
    { id: 'difficile', nom: 'DIFFICILE', couleur: '#ffc83d', glyphe: '🏆', texte: 'Un champion invaincu vous attend en finale…' },
  ],
};

function ouvrirDifficultes(mode) {
  prep.modeDiff = mode;
  $('difficulte-titre').textContent = mode === 'histoire' ? 'Mode Histoire' : 'Tournoi';
  $('difficulte-sous').textContent = mode === 'histoire'
    ? 'La Fracture : cinq actes, des alliés, des trahisons, des choix qui comptent — et des boss à débloquer.'
    : 'Huit combattants, un tableau, une seule coupe. Perdez un match, et c’est fini.';
  const onyx = debloques().has(SECRETS.tournoi);
  $('difficultes').innerHTML = DIFFICULTES[mode].map((d) => `<button class="diff" data-diff="${d.id}" style="--c:${d.couleur}">
      <span class="boss-ic">${d.glyphe}</span><b>${d.nom}</b><small>${esc(d.texte)}</small>
      ${mode === 'tournoi' && d.id === 'difficile' && onyx ? '<small class="fait">✔ Champion battu</small>' : ''}
    </button>`).join('');
  aller('s-difficulte');
}

/** Une cinématique, en plein écran. */
function cinematique(etapes, hero, musique = 'tension') {
  aller('s-cine');
  dimensionnerCine();
  return jouerCine(etapes, { hero, debloquer, musique, vu: CODEX.voir });
}

/* ------------------------------------------------------------------ */
/* Le mode Histoire                                                     */
/* ------------------------------------------------------------------ */

/* ---- les sauvegardes : trois emplacements ---- */

const EMPLACEMENTS = 3;
/** La partie en cours : { slot, h (ce qui est sauvegardé), depuis (pour le temps de jeu) }. */
let partie = null;

const nouvellePartie = (hero, difficulte) => ({
  hero, difficulte, scene: 0, phase: 'avant', drapeaux: {}, temps: 0, victoires: 0, debut: Date.now(), maj: Date.now(), fini: false,
});

function sauvegardes() {
  const l = lire(CLE_SAUVEGARDES, null) || [];
  // L'ancienne histoire (huit chapitres, un seul emplacement) : le héros repart au début de la nouvelle.
  const vieille = lire(CLE_HISTOIRE, null);
  if (vieille) {
    if (!l.some(Boolean) && PERSO[vieille.hero]) { l[0] = nouvellePartie(vieille.hero, vieille.difficulte || 'normal'); ecrire(CLE_SAUVEGARDES, l); }
    ecrire(CLE_HISTOIRE, null);
  }
  return Array.from({ length: EMPLACEMENTS }, (_, k) => (l[k] && (l[k].createur || PERSO[l[k].hero]) ? l[k] : null));
}

function sauver(discret = false) {
  if (!partie) return;
  const l = sauvegardes();
  const maintenant = Date.now();
  // Le temps de jeu (une longue absence ne compte pas).
  partie.h.temps += Math.min(20 * 60000, maintenant - partie.depuis);
  partie.depuis = maintenant;
  partie.h.maj = maintenant;
  l[partie.slot] = partie.h;
  ecrire(CLE_SAUVEGARDES, l);
  if (!discret) { const i = $('sauve'); i.hidden = false; i.classList.remove('entre'); void i.offsetWidth; i.classList.add('entre'); }
}

const sceneDe = (h) => HIST.SCENES[Math.min(h.scene, HIST.SCENES.length - 1)];
/** La fiche du héros d'une partie (un héros créé n'est pas dans PERSO : on l'y inscrit pour jouer). */
const ficheDe = (h) => (h.createur ? construireHeros(h.createur) : PERSO[h.hero]);
function inscrireHeros(h) {
  if (h.createur) PERSO.heros = construireHeros(h.createur);
  return PERSO[h.hero];
}
const duree = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const quand = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function ouvrirSauvegardes() {
  const l = sauvegardes();
  $('slots').innerHTML = l.map((h, k) => {
    if (!h) return `<button class="slot vide" data-nouvelle="${k}"><small>EMPLACEMENT ${k + 1}</small><b>＋ Nouvelle partie</b><span>Choisissez votre héros et votre difficulté</span></button>`;
    const p = ficheDe(h);
    const sc = sceneDe(h);
    const progres = h.fini ? 100 : Math.round((h.scene / HIST.SCENES.length) * 100);
    return `<div class="slot" style="--c:${p.c.c1}">
      <canvas data-slot="${k}" width="120" height="120"></canvas>
      <div class="slot-texte">
        <small>EMPLACEMENT ${k + 1} · ${h.difficulte === 'difficile' ? '🔥 DIFFICILE' : '📖 NORMAL'}</small>
        <b style="color:${p.c.c1}">${esc(p.nom)}</b>${h.createur ? ` <i class="ecole">${esc(ECOLES[h.createur.ecole]?.nom || '')}</i>` : ''}
        <span>${h.fini ? '✔ Histoire terminée' : `${HIST.ACTES[sc.acte].num} — ${esc(sc.titre)} : ${esc(sc.sous)}`}</span>
        <div class="slot-barre"><i style="width:${progres}%"></i></div>
        <small>${progres} % · ${h.victoires} victoire${h.victoires > 1 ? 's' : ''} · ${duree(h.temps)} de jeu · ${quand(h.maj)}</small>
      </div>
      <div class="slot-boutons">
        ${h.fini ? `<button class="btn or petit" data-legende="${k}">⭐ Légende</button>` : `<button class="btn rouge petit" data-continuer="${k}">▶ Continuer</button>`}
        <button class="btn petit" data-journal="${k}">📜 Journal</button>
        ${h.createur ? `<button class="btn petit" data-modifier="${k}">✏️ Héros</button>` : ''}
        <button class="btn petit" data-efface="${k}" title="Effacer">🗑️</button>
      </div>
    </div>`;
  }).join('');
  $('slots').querySelectorAll('canvas[data-slot]').forEach((cv) => dessinerPortrait(cv.getContext('2d'), ficheDe(l[Number(cv.dataset.slot)]), 120, { t: 8 }));
  aller('s-sauvegardes');
}

/** Le journal : les scènes déjà vécues, à revoir. */
function ouvrirJournal(k) {
  const h = sauvegardes()[k];
  if (!h) return;
  inscrireHeros(h);
  const vues = HIST.SCENES.map((sc, i) => [sc, i]).filter(([sc, i]) => (h.fini || i < h.scene) && condition(sc, h));
  let acte = -1;
  $('etape').innerHTML = `<button class="rond fermer" data-ferme="ov-etape">✕</button><h2>📜 Journal</h2>
    <p class="sous">${esc(ficheDe(h).nom)} · revoir une scène (sans rien changer à la partie)</p>
    <div class="journal">${vues.length ? vues.map(([sc, i]) => {
      const tete = sc.acte !== acte ? `<h4>${HIST.ACTES[sc.acte].num} — ${HIST.ACTES[sc.acte].nom}</h4>` : '';
      acte = sc.acte;
      return `${tete}<button class="ligne-journal" data-revoir="${i}"><b>${esc(sc.titre)}</b> ${esc(sc.sous)}${sc.combat ? ' <i>⚔️</i>' : ''}</button>`;
    }).join('') : '<p class="sous">Rien à revoir pour l’instant.</p>'}</div>`;
  ouvrir('ov-etape');
  $('etape').querySelectorAll('[data-revoir]').forEach((b) => b.addEventListener('click', async () => {
    const sc = HIST.SCENES[Number(b.dataset.revoir)];
    fermer('ov-etape');
    const apres = sc.combat ? [{ decor: sc.arene, fondu: true }, ...etapesApres(sc, true).slice(1)] : [];
    await cineHistoire([...entreeScene(sc), ...etapesAvant(sc), ...apres], h, { ...h.drapeaux }, HIST.musiqueDe(sc, 'avant'));
    ouvrirSauvegardes();
  }));
}

/* ---- le déroulé de l'histoire ---- */

const condition = (sc, h) => !sc.si || vrai(sc.si, h.drapeaux);
/** Le héros ne se croise pas lui-même : sa doublure joue son rôle. */
const rolesDe = (hero) => (hero === 'heros' ? {} : hero === HIST.DOUBLURE ? { [hero]: HIST.DOUBLURE2 } : { [hero]: HIST.DOUBLURE });
/** Qui joue ce rôle ('hero' : le héros de la partie, qu'on peut aussi affronter). */
const role = (h, id) => (id === 'hero' ? h.hero : rolesDe(h.hero)[id] || id);
const nomsDe = (texte, h) => texte.replace(/\{(\w+)\}/g, (m, id) => (id === 'hero' ? PERSO[h.hero].nom : PERSO[role(h, id)]?.nom || m));

function cineHistoire(etapes, h, drapeaux, musique) {
  aller('s-cine');
  dimensionnerCine();
  return jouerCine(etapes, { hero: h.hero, roles: rolesDe(h.hero), drapeaux, debloquer, croiser, quittable: true, musique, vu: CODEX.voir });
}

/** Les combattants corrompus par la Fracture le montrent, dans les cinématiques aussi. */
function corrompre(etapes, id) {
  return etapes.map((e) => {
    const x = { ...e };
    if (x.entre === id) x.corrompu = true;
    if (x.alors) x.alors = corrompre(x.alors, id);
    if (x.sinon) x.sinon = corrompre(x.sinon, id);
    if (x.choix) x.choix = x.choix.map((c) => ({ ...c, suite: corrompre(c.suite || [], id) }));
    return x;
  });
}
const etapesAvant = (sc) => (sc.combat?.corrompu ? corrompre(sc.etapes, sc.combat.adv) : sc.etapes);
/** Après le combat : les deux combattants en place ; vaincu, le corrompu rend son éclat. */
function etapesApres(sc, gagne) {
  const cb = sc.combat;
  return [
    { decor: sc.arene },
    { entre: cb.joueur || 'hero', cote: 'g', comment: 'place', p: gagne ? 'repos' : 'touche' },
    { entre: cb.adv, cote: 'd', comment: 'place', p: gagne ? 'touche' : 'victoire', corrompu: !!cb.corrompu },
    // Le petit film des grands boss.
    ...(gagne && sc.finale ? [...sc.finale, { musique: HIST.musiqueDe(sc, 'apres') }] : []),
    ...(gagne && cb.corrompu ? [{ purifie: cb.adv }] : []),
    ...((gagne ? sc.apres : sc.apresDefaite) || []),
  ];
}

/** Le début d'une scène : le décor, l'acte (au début de chaque acte), le titre. */
function entreeScene(sc) {
  const a = HIST.ACTES[sc.acte];
  const premiere = HIST.SCENES.find((x) => x.acte === sc.acte) === sc;
  return [{ decor: sc.arene }, ...(premiere ? [{ titre: a.num, sous: a.nom, sur: 'LA FRACTURE' }] : []), { titre: sc.titre, sous: sc.sous, sur: `${a.num} — ${a.nom}` }];
}

function nouvelleHistoire(hero, createur = null) {
  const h = nouvellePartie(hero, prep.difficulte || 'normal');
  if (createur) h.createur = createur;
  partie = { slot: prep.slot ?? 0, h, depuis: Date.now() };
  inscrireHeros(h);
  sauver(true);
  jouerScene();
}

function continuerHistoire(k) {
  const h = sauvegardes()[k];
  if (!h) return;
  partie = { slot: k, h, depuis: Date.now() };
  inscrireHeros(h);
  jouerScene();
}

/* ---- le créateur de héros ---- */

const createur = { def: null, mode: 'nouveau', slot: 0 };

function ouvrirCreateur(def = defautHeros(), mode = 'nouveau', slot = 0) {
  createur.def = { ...defautHeros(), ...def, accessoires: [...(def.accessoires || [])] };
  createur.mode = mode;
  createur.slot = slot;
  $('createur-titre').textContent = mode === 'nouveau' ? 'Créez votre héros' : 'Votre héros';
  $('createur-ok').textContent = mode === 'nouveau' ? 'Commencer l’histoire ›' : 'Enregistrer ✔';
  $('createur-nom').value = createur.def.nom;
  majCreateur();
  aller('s-createur');
}

function majCreateur() {
  const d = createur.def;
  const puces = (champ, liste, multi = false) => liste.map(([id, nom]) => {
    const on = multi ? d[champ].includes(id) : d[champ] === id;
    return `<button class="puce${on ? ' on' : ''}" data-champ="${champ}" data-val="${id}">${esc(nom)}</button>`;
  }).join('');
  const teintes = (champ, liste) => liste.map((c) => `<button class="teinte${d[champ] === c ? ' on' : ''}" data-champ="${champ}" data-val="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('');
  $('createur-options').innerHTML = `
    <h4>École de combat</h4>
    <div class="ecoles">${Object.entries(ECOLES).map(([id, e]) => `<button class="ecole-carte${d.ecole === id ? ' on' : ''}" data-champ="ecole" data-val="${id}"><b>${esc(e.nom)}</b><small>${esc(e.texte)}</small></button>`).join('')}</div>
    <h4>Genre</h4><div class="puces">${puces('genre', GENRES)}</div>
    <h4>Voix</h4>
    <div class="reglages-voix">
      <label><span>Grave</span><input type="range" data-voix="voixHauteur" min="${VOIX_HAUTEUR[0]}" max="${VOIX_HAUTEUR[1]}" step="0.05" value="${d.voixHauteur}"><span>Aiguë</span></label>
      <label><span>Masculine</span><input type="range" data-voix="voixTimbre" min="0" max="1" step="0.05" value="${d.voixTimbre ?? (d.genre === 'f' ? 0.8 : 0.2)}"><span>Féminine</span></label>
      <button class="btn petit" data-ecouter>🔊 Écouter</button>
    </div>
    <h4>Carrure</h4><div class="puces">${puces('corps', CORPS)}</div>
    <h4>Coiffure</h4><div class="puces">${puces('tete', TETES)}</div>
    <h4>Peau</h4><div class="teintes">${teintes('peau', PEAUX)}</div>
    <h4>Énergie</h4><div class="teintes">${Object.entries(ENERGIES).map(([id, e]) => `<button class="teinte${d.energie === id ? ' on' : ''}" data-champ="energie" data-val="${id}" style="--c:${e.c1}" aria-label="${id}"></button>`).join('')}</div>
    <h4>Tenue</h4><div class="teintes">${teintes('tenue', TENUES)}</div>
    <h4>Cheveux</h4><div class="teintes">${teintes('cheveux', CHEVEUX)}</div>
    <h4>Accessoires <small>(${d.accessoires.length}/${MAX_ACCESSOIRES})</small></h4><div class="puces">${puces('accessoires', ACCESSOIRES, true)}</div>`;
  const p = construireHeros(d);
  $('createur-coups').innerHTML = `<b style="color:${p.c.c1}">${esc(ECOLES[d.ecole].nom)}</b> · ${esc(p.specB.nom)} · ${esc(p.specA.nom)} · <span>ULTIME : ${esc(p.ulti.nom)}</span>`;
  animCreateur.t = 0;
}

function dessinerCreateur() {
  const cv = $('createur-canvas');
  const g = cv.getContext('2d');
  const p = construireHeros(createur.def);
  const t = (animCreateur.t += 1);
  const fond = g.createLinearGradient(0, 0, 0, cv.height);
  fond.addColorStop(0, teinte(p.c.c2, -0.55)); fond.addColorStop(1, '#05020a');
  g.fillStyle = fond; g.fillRect(0, 0, cv.width, cv.height);
  const h = g.createRadialGradient(cv.width / 2, 220, 10, cv.width / 2, 220, 240);
  h.addColorStop(0, rgba(p.c.c1, 0.4)); h.addColorStop(1, rgba(p.c.c1, 0));
  g.fillStyle = h; g.fillRect(0, 0, cv.width, cv.height);
  const demo = ['repos', 'repos', 'garde', 'poing', 'repos', 'pied', 'repos', 'lance', 'repos', 'victoire', 'victoire'];
  const posee = demo[Math.floor(t / 45) % demo.length];
  dessinerCombattant(g, p, { x: cv.width / 2, y: cv.height - 24, dir: 1, pose: posee, t, p: (t % 45) / 20, echelle: 1.75, aura: posee === 'victoire' ? 0.8 : 0.25 });
}

/** Le héros dit une phrase, pour qu'on entende sa voix. */
function ecouterHeros() {
  createur.def.nom = $('createur-nom').value;
  const h = construireHeros(createur.def);
  // On l'entend même si les voix sont coupées : c'est demandé.
  dire(`Je suis ${h.nom}. La Fracture n'a qu'à bien se tenir !`, h.voix, {}, { force: true });
}

function validerCreateur() {
  createur.def.nom = $('createur-nom').value;
  const def = { ...createur.def, nom: construireHeros(createur.def).nom };
  son('valide');
  if (createur.mode === 'nouveau') { nouvelleHistoire('heros', def); return; }
  const l = sauvegardes();
  if (l[createur.slot]) { l[createur.slot].createur = def; ecrire(CLE_SAUVEGARDES, l); }
  ouvrirSauvegardes();
}

function quitterHistoire() {
  sauver(true);
  partie = null;
  majMenu();
  toast('💾 Partie sauvegardée. À bientôt !');
}

async function jouerScene() {
  const h = partie?.h;
  if (!h) { majMenu(); return; }
  while (h.scene < HIST.SCENES.length && !condition(HIST.SCENES[h.scene], h)) h.scene += 1;
  if (h.scene >= HIST.SCENES.length) { finHistoire(); return; }
  const sc = HIST.SCENES[h.scene];
  CODEX.atteindre(sc.id);
  // Avant l'épilogue : quelle fin a-t-on méritée ?
  if (sc.id === 'epilogue' && h.phase === 'avant') {
    for (const f of ['vraie', 'heroique', 'solitaire']) delete h.drapeaux[`fin_${f}`];
    h.drapeaux[`fin_${HIST.finDe(h.drapeaux)}`] = true;
  }
  if (h.phase === 'avant') {
    // Les choix ne comptent qu'une fois la scène finie (quitter au milieu la fait rejouer).
    const d = { ...h.drapeaux };
    const r = await cineHistoire([...entreeScene(sc), ...etapesAvant(sc)], h, d, HIST.musiqueDe(sc, 'avant'));
    if (r === 'quitte') { quitterHistoire(); return; }
    h.drapeaux = d;
    if (!sc.combat) { h.scene += 1; sauver(); jouerScene(); return; }
    h.phase = 'combat';
    sauver();
  }
  if (h.phase === 'combat') { avantCombat(sc); return; }
  apresCombat(sc, h.phase === 'apres');
}

/** Le combat d'une scène, selon les choix faits (une vague plus longue si on a été repéré…). */
function combatDe(sc, h) {
  let cb = { ...sc.combat };
  for (const v of cb.variantes || []) if (condition({ si: v.si }, h)) cb = { ...cb, ...v };
  return cb;
}
/** Le niveau de l'ordinateur ; en mode Légende, un cran au-dessus. */
const NIVEAUX_ORDI = ['facile', 'normal', 'difficile', 'impossible'];
const niveauDe = (cb, h) => {
  const n = cb.niveau[h.difficulte] || 'normal';
  return h.drapeaux.legende ? NIVEAUX_ORDI[Math.min(3, NIVEAUX_ORDI.indexOf(n) + 1)] : n;
};
/** L'allié qu'on peut appeler à l'aide (une fois) ; au combat final, le plus proche de soi. */
function allieDe(cb, h) {
  if (!cb.allie) return null;
  if (cb.allieSi && !condition({ si: cb.allieSi }, h)) return null;
  if (cb.allie !== 'meilleur') return role(h, cb.allie);
  const amis = HIST.ALLIES.filter((id) => (h.drapeaux[`aff_${id}`] || 0) >= 1).sort((a, b) => (h.drapeaux[`aff_${b}`] || 0) - (h.drapeaux[`aff_${a}`] || 0));
  return amis.length ? role(h, amis[0]) : null;
}
const bonusDe = (cb, h) => (cb.bonus && condition({ si: cb.bonus.si }, h) ? cb.bonus : null);

/** Avant un combat : qui, à quel niveau, et les règles du jour. */
function avantCombat(sc) {
  const h = partie.h;
  const cb = combatDe(sc, h);
  const adv = role(h, cb.adv);
  const bonus = bonusDe(cb, h);
  const allie = allieDe(cb, h);
  const regles = [cb.regle, bonus && nomsDe(bonus.texte, h)].filter(Boolean);
  const moi = PERSO[cb.joueur ? role(h, cb.joueur) : h.hero];
  const lui = PERSO[adv];
  if (cb.joueur) regles.unshift(`🎮 Vous incarnez ${moi.nom}`);
  if (cb.survie) regles.unshift(`⏳ Survivez ${cb.survie} secondes !`);
  if (cb.corrompu) regles.push('💜 Corrompu par la Fracture : battez-le pour lui arracher son éclat');
  if (allie) regles.push(`🤝 ${PERSO[allie].nom} peut vous aider une fois : touche H (ou le bouton ALLIÉ)`);
  if (h.drapeaux.legende) regles.push('⭐ Mode Légende : l’ordinateur frappe plus fort');
  const contre = cb.serie
    ? cb.serie.map((id) => `<b style="color:${PERSO[id].c.c1}">${esc(PERSO[id].nom)}</b>`).join(', ')
    : `<b style="color:${lui.c.c1}">${esc(lui.nom)}</b>${cb.victoires === 1 ? ' · un round' : ''}`;
  $('etape').innerHTML = `<h2>${esc(sc.titre)}</h2><p class="sous">${esc(sc.sous)}</p>
    <canvas id="etape-vs" width="1040" height="480"></canvas>
    <p class="sous"><b style="color:${moi.c.c1}">${esc(moi.nom)}</b> contre ${contre} · ordinateur ${niveauDe(cb, h)}</p>
    ${regles.map((r) => `<p class="regle">${esc(r)}</p>`).join('')}
    <div class="ligne-boutons"><button class="btn" id="b-etape-quitter">💾 Sauvegarder et quitter</button><button class="btn rouge" id="b-etape-go">⚔️ Combattre !</button></div>`;
  dessinerVs($('etape-vs'), moi, lui, !!cb.corrompu);
  ouvrir('ov-etape');
  son('annonce');
  $('b-etape-go').onclick = () => { fermer('ov-etape'); combatHistoire(sc, adv, bonus); };
  $('b-etape-quitter').onclick = () => { fermer('ov-etape'); quitterHistoire(); };
}

/** Après chaque soldat d'une vague, on récupère un peu de vie ; entre les deux phases d'un boss aussi. */
const REPOS_SERIE = 0.2;
const REPOS_PHASE = 0.35;

/** La note d'un combat gagné : S, A, B ou C (la vie gardée, les rounds perdus, un perfect). */
function noteCombat(c) {
  const j = c.joueurs[0];
  const r = j.hp / j.hpMax;
  const perdus = c.joueurs[1].victoires;
  if (stats.perfect || (r >= 0.6 && perdus === 0)) return 'S';
  if (r >= 0.35 && perdus === 0) return 'A';
  if (r >= 0.15 || perdus === 0) return 'B';
  return 'C';
}
const RANG = { S: 4, A: 3, B: 2, C: 1 };

/**
 * Un combat de l'histoire. Une vague (`serie`) : un round contre chacun,
 * à la suite, la vie du héros passant de l'un à l'autre ; perdre en
 * cours de route fait recommencer la vague. Un boss à deux phases
 * (`phase2`) se relève après une cinématique, plus fort.
 */
function combatHistoire(sc, adv, bonus, k = 0, vieRestante = null, phase = 1) {
  const h = partie.h;
  const base = combatDe(sc, h);
  const cb = phase === 2 ? { ...base, ...base.phase2, victoires: 1 } : base;
  const hpMax = (id) => Math.round(150 * PERSO[id].hpMult);
  const serie = cb.serie ? cb.serie.map((id) => role(h, id)) : null;
  const contre = serie ? serie[k] : phase === 2 && cb.adv ? role(h, cb.adv) : adv;
  const moi = cb.joueur ? role(h, cb.joueur) : h.hero;
  const vieHero = vieRestante ?? (cb.vie?.[0] ?? 1) * hpMax(moi);
  const vieAdv = serie || phase === 2 ? 1 : Math.min(cb.vie?.[1] ?? 1, bonus?.vieAdv ?? 1);
  const libre = cb.issue === 'libre';
  const dernier = (!serie || k === serie.length - 1) && !(base.phase2 && phase === 1);
  demarrerCombat({
    p1: moi, p2: contre, arene: sc.arene, ia: { 1: niveauDe(cb, h) }, mode: 'histoire', musique: HIST.musiqueDe(sc, 'combat'),
    victoires: serie ? 1 : cb.victoires || 2,
    vie: [vieHero < hpMax(moi) ? vieHero : null, vieAdv < 1 ? vieAdv * hpMax(contre) : null],
    survie: cb.survie || 0,
    corrompu: [false, !!cb.corrompu],
    echelle: [1, phase === 2 ? cb.echelle || 1 : 1],
    allie: allieDe(cb, h),
    perdable: libre,
    texteFin: (gagne, c) => {
      if (!gagne) {
        return libre ? '<p class="sous">Il était bien trop fort… mais l’histoire continue.</p>'
          : `<p class="sous">L’histoire n’est pas finie. Relevez-vous !${serie || phase === 2 ? ' Le combat reprend au début.' : ''} <small>(partie sauvegardée)</small></p>`;
      }
      if (!dernier) {
        return serie && k < serie.length - 1
          ? `<p class="sous">Adversaire ${k + 1} sur ${serie.length} à terre ! Au suivant : <b>${esc(PERSO[serie[k + 1]].nom)}</b> (+${REPOS_SERIE * 100} % de vie)</p>`
          : '<p class="sous">… Mais ce n’est pas fini.</p>';
      }
      const note = noteCombat(c);
      return `<p class="note-combat note-${note}"><b>${note}</b><span>${{ S: 'Parfait !', A: 'Excellent', B: 'Bien', C: 'De justesse' }[note]}</span></p><p class="sous">${esc(sc.titre)} — ${esc(sc.sous)}</p>`;
    },
    suite: async (gagne, finC) => {
      if (gagne && serie && k < serie.length - 1) { combatHistoire(sc, adv, bonus, k + 1, Math.min(hpMax(moi), finC.hpHero + hpMax(moi) * REPOS_SERIE), phase); return; }
      // Le boss se relève : la deuxième phase.
      if (gagne && base.phase2 && phase === 1) {
        const r = await cineHistoire([{ decor: sc.arene }, { entre: base.joueur || 'hero', cote: 'g', comment: 'place', p: 'garde' }, { entre: base.adv, cote: 'd', comment: 'place', p: 'touche' }, ...base.phase2.cine], h, { ...h.drapeaux }, 'tension');
        if (r === 'quitte') { quitterHistoire(); return; }
        combatHistoire(sc, adv, bonus, 0, Math.min(hpMax(moi), finC.hpHero + hpMax(moi) * REPOS_PHASE), 2);
        return;
      }
      if (gagne) {
        h.victoires += 1;
        const note = noteCombat(finC.c);
        h.notes = h.notes || {};
        if (!h.notes[sc.id] || RANG[note] > RANG[h.notes[sc.id]]) h.notes[sc.id] = note;
      }
      h.phase = gagne ? 'apres' : 'apresDefaite';
      sauver(true);
      apresCombat(sc, gagne);
    },
    reessayer: () => combatHistoire(sc, adv, bonus),
    abandon: () => { sauver(true); partie = null; },
  });
}

async function apresCombat(sc, gagne) {
  const h = partie.h;
  if (gagne && role(h, sc.combat.adv) === 'lechaos') succes.debloquer('street-chaos');
  const etapes = etapesApres(sc, gagne);
  const d = { ...h.drapeaux };
  const r = await cineHistoire(etapes, h, d, HIST.musiqueDe(sc, 'apres'));
  if (r === 'quitte') { quitterHistoire(); return; }
  h.drapeaux = d;
  h.scene += 1;
  h.phase = 'avant';
  sauver();
  jouerScene();
}

function finHistoire() {
  const h = partie.h;
  h.fini = true;
  sauver(true);
  partie = null;
  succes.debloquer('street-campagne');
  majMenu();
  montrerBilan(h);
}

/** Le bilan de l'histoire : la fin obtenue, les notes de chaque combat, ce qui s'est débloqué. */
function montrerBilan(h) {
  const notes = Object.values(h.notes || {});
  const compte = (n) => notes.filter((x) => x === n).length;
  const moyenne = notes.length ? notes.reduce((a, n) => a + RANG[n], 0) / notes.length : 0;
  const lettre = moyenne >= 3.5 ? 'S' : moyenne >= 2.6 ? 'A' : moyenne >= 1.8 ? 'B' : 'C';
  const finObtenue = HIST.finDe(h.drapeaux);
  const nomsFins = { vraie: '🌅 La vraie fin', heroique: '🏆 La fin héroïque', solitaire: '🌑 La fin solitaire' };
  const amis = HIST.ALLIES.filter((id) => (h.drapeaux[`aff_${id}`] || 0) >= 2).map((id) => PERSO[role(h, id)].nom);
  $('etape').innerHTML = `<h2>📊 Bilan de l’histoire</h2>
    <p class="sous">${esc(ficheDe(h).nom)} · ${duree(h.temps)} de jeu · ${h.victoires} victoires${h.drapeaux.legende ? ' · ⭐ mode Légende' : ''}</p>
    <p class="note-combat note-${lettre}"><b>${lettre}</b><span>note moyenne</span></p>
    <p class="sous">${['S', 'A', 'B', 'C'].map((n) => `${n} × ${compte(n)}`).join(' · ')}</p>
    <p class="regle">${nomsFins[finObtenue]}</p>
    <p class="sous">Vos plus proches alliés : ${amis.length ? amis.map(esc).join(', ') : 'personne… (la fin aurait pu être plus belle)'}</p>
    ${finObtenue !== 'vraie' ? '<p class="sous" style="font-size:.85rem">Il existe une autre fin… Pardonner, tendre la main, garder ses amis près de soi.</p>' : ''}
    <p class="sous">⭐ Le <b>mode Légende</b> est débloqué : rejouez l’histoire, plus difficile, avec des dialogues en plus.</p>
    <div class="ligne-boutons"><button class="btn rouge" data-ferme="ov-etape">Continuer</button></div>`;
  ouvrir('ov-etape');
  son('victoire');
}

/** Tout remettre à zéro : combattants débloqués, rencontres, sauvegardes, tournoi et tour en cours. */
function reinitialiser() {
  if (!confirm('Tout réinitialiser ?\n\nLes combattants débloqués, les rencontres, le Codex, les sauvegardes de l’histoire, le tournoi et la tour en cours seront effacés.')) return;
  for (const cle of [CLE_DEBLOQUES, CLE_CROISES, CLE_SAUVEGARDES, CLE_HISTOIRE, CLE_TOURNOI, CLE_TOUR, 'street.codex', 'street.codex.scenes']) ecrire(cle, null);
  portraitsGrille.clear();
  animMenu.a = null;
  majMenu();
  toast('♻️ Tout est remis à zéro. Les combattants secrets sont à nouveau cachés.', 3500);
}

/* ------------------------------------------------------------------ */
/* Le Tournoi : huit combattants, trois tours                           */
/* ------------------------------------------------------------------ */

const NIVEAUX_TOURNOI = { facile: ['facile', 'facile', 'normal'], normal: ['normal', 'normal', 'difficile'], difficile: ['difficile', 'difficile', 'difficile'] };
const melange = (l) => { const t = [...l]; for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };

function lancerTournoi(hero) {
  const diff = prep.difficulte || 'normal';
  const pool = melange(PERSOS.filter((p) => disponible(p) && p.id !== hero && p.id !== SECRETS.tournoi).map((p) => p.id));
  const tableau = [hero, ...pool.slice(0, 7)];
  // En difficile, le champion invaincu est de l'autre côté du tableau.
  if (diff === 'difficile') tableau[7] = SECRETS.tournoi;
  ecrire(CLE_TOURNOI, { hero, diff, tours: [tableau], tour: 0 });
  montrerTableau();
}

/** Le champion reste masqué tant qu'il n'est pas débloqué, et qu'on ne l'affronte pas. */
const masque = (id, t) => id === SECRETS.tournoi && !debloques().has(id) && !(t.tour === 2 && t.tours[2]?.includes(id));

function montrerTableau() {
  const t = lire(CLE_TOURNOI, null);
  if (!t) { majMenu(); return; }
  const noms = ['QUARTS', 'DEMIES', 'FINALE', 'COUPE'];
  // Les tours à venir sont des cases vides.
  const colonnes = [8, 4, 2, 1].map((n, k) => t.tours[k] || Array(n).fill(null));
  const colonne = (liste, k) => `<div class="tab-col${k === 3 ? ' titre-col' : ''}"><h4>${noms[k]}</h4>${liste.map((id, i) => {
    if (!id) return `<div class="tab-perso vide">${k === 3 ? '🏆' : '…'}</div>`;
    const p = PERSO[id];
    const cache = masque(id, t);
    const elimine = t.tours[k + 1] && !t.tours[k + 1].includes(id);
    const moi = id === t.hero;
    return `<div class="tab-perso${moi ? ' moi' : ''}${elimine ? ' elimine' : ''}${i % 2 === 0 && k < 3 ? ' haut' : ''}" style="--c:${cache ? '#555' : p.c.c1}">
      ${cache ? '<span class="mini mystere">?</span>' : `<canvas class="mini" data-portrait="${id}" width="64" height="64"></canvas>`}<b>${cache ? 'CHAMPION ???' : esc(p.nom)}</b></div>`;
  }).join('')}</div>`;
  const adv = t.tours[t.tour][1];
  $('etape').innerHTML = `<h2>🏆 Tournoi — ${t.diff}</h2>
    <div class="tableau">${colonnes.map(colonne).join('')}</div>
    <p class="sous">${t.tour === 2 ? 'La finale !' : t.tour === 1 ? 'Les demi-finales.' : 'Les quarts de finale.'} Contre <b>${masque(adv, t) ? '???' : esc(PERSO[adv].nom)}</b> · ordinateur ${NIVEAUX_TOURNOI[t.diff][t.tour]}</p>
    <div class="ligne-boutons"><button class="btn" id="b-etape-quitter">Abandonner</button><button class="btn rouge" id="b-etape-go">⚔️ Combattre !</button></div>`;
  $('etape').querySelectorAll('[data-portrait]').forEach((cv) => dessinerPortrait(cv.getContext('2d'), PERSO[cv.dataset.portrait], 64, { t: 8 }));
  ouvrir('ov-etape');
  son('annonce');
  $('b-etape-go').onclick = async () => {
    fermer('ov-etape');
    const finaleChampion = t.tour === 2 && adv === SECRETS.tournoi;
    if (finaleChampion) await cinematique(HIST.TOURNOI_FINALE, t.hero);
    combatTournoi(t, adv, finaleChampion);
  };
  $('b-etape-quitter').onclick = () => {
    if (!confirm('Abandonner le tournoi ?')) return;
    ecrire(CLE_TOURNOI, null);
    fermer('ov-etape');
    majMenu();
  };
}

function combatTournoi(t, adv, finaleChampion) {
  demarrerCombat({
    p1: t.hero, p2: adv, arene: finaleChampion || t.tour === 2 ? 'ring' : 'hasard', ia: { 1: NIVEAUX_TOURNOI[t.diff][t.tour] }, mode: 'tournoi', musique: finaleChampion ? 'boss' : 'combat',
    texteFin: (gagne) => (gagne ? '' : '<p class="sous">Éliminé du tournoi…</p>'),
    suite: async () => {
      // Les autres matchs du tour : le champion gagne toujours les siens.
      const liste = t.tours[t.tour];
      const gagnants = [t.hero];
      for (let i = 2; i < liste.length; i += 2) {
        const [a, b] = [liste[i], liste[i + 1]];
        gagnants.push(a === SECRETS.tournoi ? a : b === SECRETS.tournoi ? b : Math.random() < 0.5 ? a : b);
      }
      t.tours.push(gagnants);
      t.tour += 1;
      if (t.tour < 3) { ecrire(CLE_TOURNOI, t); montrerTableau(); return; }
      // La coupe !
      ecrire(CLE_TOURNOI, null);
      const r = records();
      r.tournois += 1;
      ecrire(CLE_RECORDS, r);
      const champion = t.diff === 'difficile';
      if (champion) succes.debloquer('street-tournoi');
      await cinematique(HIST.victoireTournoi(champion), t.hero, 'epique');
      majMenu();
    },
    reessayer: () => { ecrire(CLE_TOURNOI, null); prep.difficulte = t.diff; lancerTournoi(t.hero); },
    abandon: () => ecrire(CLE_TOURNOI, null),
  });
}

/* ------------------------------------------------------------------ */
/* La Tour des défis : dix combats d'affilée, puis Némésis              */
/* ------------------------------------------------------------------ */

const ETAGES = 10;
const NIVEAUX_TOUR = ['facile', 'facile', 'normal', 'normal', 'normal', 'difficile', 'difficile', 'difficile', 'impossible', 'impossible'];
/** Après chaque victoire, on récupère une partie de sa vie. */
const REPOS_TOUR = 0.4;

function lancerTour(hero) {
  // Les combattants de base d'abord ; les boss et les secrets déjà débloqués gardent les deux derniers étages.
  const base = melange(ROSTER.filter((p) => p.id !== hero).map((p) => p.id));
  const forts = melange(PERSOS.filter((p) => aDebloquer(p) && disponible(p) && p.id !== hero && p.id !== SECRETS.tour).map((p) => p.id));
  const file = Array.from({ length: ETAGES }, (_, k) => (k >= ETAGES - 2 && forts.length ? forts[(k - (ETAGES - 2)) % forts.length] : base[k % base.length]));
  const normales = ARENES.filter((a) => !a.boss).map((a) => a.id);
  const arenes = file.map(() => normales[Math.floor(Math.random() * normales.length)]);
  ecrire(CLE_TOUR, { hero, file, arenes, etage: 0, vie: null });
  montrerTour();
}

function montrerTour() {
  const t = lire(CLE_TOUR, null);
  if (!t) { majMenu(); return; }
  const hero = PERSO[t.hero];
  const hpMax = Math.round(150 * hero.hpMult);
  const vie = t.vie ?? hpMax;
  const boss = t.etage >= ETAGES;
  const adv = boss ? null : PERSO[t.file[t.etage]];
  const nemesis = debloques().has(SECRETS.tour);
  const etages = [];
  for (let k = ETAGES; k >= 0; k--) {
    const id = k === ETAGES ? SECRETS.tour : t.file[k];
    const cache = k === ETAGES && !nemesis;
    etages.push(`<div class="etage${k < t.etage ? ' fait' : k === t.etage ? ' ici' : ''}${k === ETAGES ? ' boss' : ''}">
      <span class="num">${k === ETAGES ? '👑' : k + 1}</span><b>${cache ? '???' : esc(PERSO[id].nom)}</b>${k === t.etage ? '<i>◀ vous</i>' : ''}</div>`);
  }
  $('etape').innerHTML = `<h2>🗼 Tour des défis</h2>
    <div class="tour-corps"><div class="tour">${etages.join('')}</div>
      <div class="tour-info"><canvas id="tour-portrait" width="160" height="160"></canvas>
        <b>${esc(hero.nom)}</b>
        <div class="tour-vie"><i style="width:${(vie / hpMax) * 100}%"></i></div><small>${Math.round(vie)} / ${hpMax} PV</small>
        <p class="sous">${boss ? 'Le sommet. Le maître de la tour vous attend.' : `Étage ${t.etage + 1} : <b style="color:${adv.c.c1}">${esc(adv.nom)}</b> · un round · ordinateur ${NIVEAUX_TOUR[t.etage]}`}</p>
        <p class="sous" style="font-size:.8rem">Votre vie passe d’un combat à l’autre (+${REPOS_TOUR * 100} % après chaque victoire).</p>
      </div></div>
    <div class="ligne-boutons"><button class="btn" id="b-etape-quitter">Abandonner</button><button class="btn rouge" id="b-etape-go">⚔️ ${boss ? 'Affronter le maître' : 'Combattre !'}</button></div>`;
  dessinerPortrait($('tour-portrait').getContext('2d'), hero, 160, { t: 8 });
  ouvrir('ov-etape');
  son('annonce');
  $('b-etape-go').onclick = async () => {
    fermer('ov-etape');
    if (boss) await cinematique(HIST.TOUR_BOSS, t.hero);
    combatTour(t, boss);
  };
  $('b-etape-quitter').onclick = () => {
    if (!confirm('Abandonner la tour ?')) return;
    ecrire(CLE_TOUR, null);
    fermer('ov-etape');
    majMenu();
  };
}

function combatTour(t, boss) {
  const hero = PERSO[t.hero];
  const hpMax = Math.round(150 * hero.hpMult);
  demarrerCombat({
    p1: t.hero, p2: boss ? SECRETS.tour : t.file[t.etage], arene: boss ? 'sommet' : t.arenes[t.etage], mode: 'tour', musique: boss ? 'boss' : 'combat',
    ia: { 1: boss ? 'difficile' : NIVEAUX_TOUR[t.etage] },
    // Les étages se jouent en un round, avec la vie qui reste ; le maître, en deux, à pleine vie.
    victoires: boss ? 2 : 1, vie: boss ? [] : [t.vie ?? hpMax, null],
    texteFin: (gagne) => (gagne ? '' : `<p class="sous">Tombé à l’étage ${t.etage + 1}.</p>`),
    suite: async (gagne, fin) => {
      const r = records();
      r.tour = Math.max(r.tour, t.etage + 1);
      ecrire(CLE_RECORDS, r);
      if (boss) {
        ecrire(CLE_TOUR, null);
        succes.debloquer('street-tour');
        await cinematique(HIST.TOUR_VICTOIRE, t.hero, 'epique');
        majMenu();
        return;
      }
      t.vie = Math.min(hpMax, fin.hpHero + hpMax * REPOS_TOUR);
      t.etage += 1;
      ecrire(CLE_TOUR, t);
      montrerTour();
    },
    reessayer: () => { const r = records(); r.tour = Math.max(r.tour, t.etage); ecrire(CLE_RECORDS, r); lancerTour(t.hero); },
    abandon: () => { const r = records(); r.tour = Math.max(r.tour, t.etage); ecrire(CLE_RECORDS, r); ecrire(CLE_TOUR, null); },
  });
}

function dessinerVs(cv, a, b, corrompuB = false) {
  const g = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  g.fillStyle = '#05020a'; g.fillRect(0, 0, w, h);
  for (const [p, x0, sens, corrompu] of [[a, 0, 1, false], [b, w / 2, -1, corrompuB]]) {
    const gr = g.createLinearGradient(x0, 0, x0 + w / 2, 0);
    gr.addColorStop(sens > 0 ? 0 : 1, rgba(p.c.c2, 0.9)); gr.addColorStop(sens > 0 ? 1 : 0, rgba(p.c.c2, 0.1));
    g.fillStyle = gr; g.fillRect(x0, 0, w / 2, h);
    dessinerCombattant(g, p, { x: x0 + w / 4, y: h * 0.98, dir: sens, pose: 'repos', t: 10, echelle: 2.1, aura: corrompu ? 0 : 0.7, corrompu });
  }
  g.save();
  g.translate(w / 2, h / 2);
  FX.texteContour(g, 'VS', 0, 0, 110, '#ff2a4a', '#2a0008', 'center', true);
  g.restore();
}

/* ------------------------------------------------------------------ */
/* Le combat                                                            */
/* ------------------------------------------------------------------ */

let combat = null;
let fx = null;
let hud = null;
let raf = 0;
let derniere = 0;
let reste = 0;
let enPause = false;
let finMontree = false;
let stats = null;
let config = null;
const eclats = [0, 0];
const hpAvant = [0, 0];

function demarrerCombat(o) {
  config = o;
  if (o.musique === undefined) o.musique = [o.p1, o.p2].some((id) => PERSO[id]?.boss || PERSO[id]?.secret) ? 'boss' : 'combat';
  const normales = ARENES.filter((a) => !a.boss);
  const arene = o.arene === 'hasard' || !o.arene ? normales[Math.floor(Math.random() * normales.length)].id : o.arene;
  config.areneId = arene;
  combat = creerCombat({ p1: o.p1, p2: o.p2, ia: o.ia || {}, entrainement: o.mode === 'entrainement', graine: Date.now(), victoires: o.victoires || 2, vie: o.vie || [], survie: o.survie || 0 });
  allieUtilise = false;
  $('allie-pret').hidden = !o.allie;
  if (o.allie) $('allie-pret').innerHTML = `🤝 <b style="color:${PERSO[o.allie].c.c1}">${esc(PERSO[o.allie].nom)}</b> · touche H`;
  $('b-allie').hidden = !o.allie || !tactile;
  fx = FX.creerEffets();
  hud = creerHud();
  stats = { comboMax: [0, 0], ultiKo: false, perfect: false };
  finMontree = false;
  enPause = false;
  hpAvant[0] = combat.joueurs[0].hp; hpAvant[1] = combat.joueurs[1].hp;
  touches.clear();
  $('b-quitter').textContent = o.mode === 'histoire' ? '💾 Sauvegarder et quitter' : 'Quitter le combat';
  $('tactile').hidden = !tactile;
  aller('s-combat');
  dimensionner();
  derniere = performance.now();
  reste = 0;
  boucle();
}

function arreterBoucle() { cancelAnimationFrame(raf); raf = 0; }

function dimensionner() {
  const cv = $('canvas');
  const r = Math.min(2, window.devicePixelRatio || 1);
  const scene = $('scene');
  const w = scene.clientWidth;
  const h = scene.clientHeight;
  // Le canvas garde le rapport 5:3 et occupe le plus de place possible.
  const echelle = Math.min(w / A.L, h / A.H);
  cv.style.width = `${A.L * echelle}px`;
  cv.style.height = `${A.H * echelle}px`;
  cv.width = Math.round(A.L * echelle * r);
  cv.height = Math.round(A.H * echelle * r);
}

function boucle() {
  raf = requestAnimationFrame(boucle);
  const maintenant = performance.now();
  let dt = Math.min(100, maintenant - derniere);
  derniere = maintenant;
  if (enPause || !combat) return;
  reste += dt;
  let n = 0;
  while (reste >= 1000 / 60 && n < 5) {
    reste -= 1000 / 60;
    n += 1;
    pasDeCombat();
  }
  dessiner();
  void dt;
}

function pasDeCombat() {
  const entrees = [entreesJoueur(0), config.mode === 'deux' ? entreesJoueur(1) : {}];
  pas(combat, entrees);
  for (const ev of evenements(combat)) {
    FX.traiter(fx, ev, combat);
    if (ev.type === 'son') son(ev.nom);
    if (ev.type === 'annonce') { son(ev.ko ? 'ko' : 'annonce'); annoncer(ev.texte); }
    if (['ulti', 'special', 'saisie'].includes(ev.type)) cri(ev);
    if (ev.type === 'combo') stats.comboMax[ev.joueur] = Math.max(stats.comboMax[ev.joueur], ev.n);
    if (ev.type === 'ko-coup' && combat.cine?.type === 'ulti') stats.ultiKo = true;
    if (ev.type === 'annonce' && ev.texte === 'PERFECT !') stats.perfect = true;
  }
  FX.avancerEffets(fx);
  majTactile();
  combat.joueurs.forEach((j, k) => {
    if (j.hp < hpAvant[k]) eclats[k] = 1;
    hpAvant[k] = j.hp;
    eclats[k] = Math.max(0, eclats[k] - 0.18);
  });
  if (combat.phase === 'fin' && !finMontree) {
    finMontree = true;
    setTimeout(montrerFin, 1400);
  }
}

/** Appeler l'allié à l'aide : une fois par combat. */
let allieUtilise = false;
function appelerAllie() {
  if (!config?.allie || allieUtilise || !combat) return;
  if (!assister(combat, 0, config.allie, 18)) return;
  allieUtilise = true;
  $('allie-pret').hidden = true;
  $('b-allie').hidden = true;
  son('ulti');
}

/** L'annonceur : « Round 1 », « Combat ! », « K.O. ! »… */
const PAROLES_ANNONCE = { 'FIGHT !': 'Combat !', 'K.O. !': 'Ko !', 'PERFECT !': 'Parfait !', 'TEMPS !': 'Temps !' };
function annoncer(texte) {
  const t = PAROLES_ANNONCE[texte] || String(texte).replace(/^ROUND (\d+)$/, 'Round $1 !');
  dire(t, voixDe({ id: 'annonceur' }));
}
/** Les combattants crient le nom de leurs techniques (pas plus d'une par seconde chacun). */
const derniersCris = [0, 0];
function cri(ev) {
  const maintenant = performance.now();
  if (ev.type !== 'ulti' && maintenant - derniersCris[ev.joueur] < 1000) return;
  derniersCris[ev.joueur] = maintenant;
  const j = combat.joueurs[ev.joueur];
  crier(ev.nom, voixDe(PERSO[j.id]));
}

/* ---- le dessin d'une image ---- */

function dessiner() {
  const cv = $('canvas');
  const g = cv.getContext('2d');
  const e = cv.width / A.L;
  const c = combat;
  const t = fx.t;
  g.setTransform(e, 0, 0, e, 0, 0);
  g.save();
  // La secousse.
  if (fx.secousse) g.translate((Math.random() - 0.5) * fx.secousse * 2, (Math.random() - 0.5) * fx.secousse * 2);
  const arene = ARENE[config.areneId];
  g.drawImage(fondArene(arene), 0, 0, A.L, A.H);
  animerArene(g, arene, t);
  FX.dessinerZones(g, c, t);

  // Les combattants : celui qui frappe passe devant.
  const ordre = [...c.joueurs].sort((a, b) => (a.action ? 1 : 0) - (b.action ? 1 : 0));
  for (const j of ordre) {
    const p = PERSO[j.id];
    const a = j.action;
    const progres = a ? (a.type === 'normal' ? a.t / (a.dem + a.def.act) : a.t / (a.dem + 8)) : 0;
    let alpha = 1;
    if (j.cache) alpha = 0.22;
    else if (j.invincible > 0 && j.etat === 'libre' && Math.floor(t / 3) % 2) alpha = 0.55;
    // La victoire : celle du round, ou, s'il vient de gagner le combat, la grande.
    const finale = j.victoires >= (c.victoiresRequises || 2);
    const nomPose = pose(j) === 'victoire' && !finale ? 'victoire-round' : pose(j);
    dessinerCombattant(g, p, {
      x: j.x, y: j.y, dir: j.dir, pose: nomPose, t: j.anim, p: progres, enLAir: !j.sol, alpha,
      aura: j.etat === 'ulti' ? 1 : j.etat === 'victoire' && finale ? 0.75 + Math.sin(t / 6) * 0.2 : j.sp >= 100 ? 0.45 + Math.sin(t / 6) * 0.2 : 0,
      statuts: Object.keys(j.statuts).length ? j.statuts : null, eclat: eclats[j.n] * 0.8, corrompu: !!config.corrompu?.[j.n], echelle: config.echelle?.[j.n] || 1,
    });
    // Le bouclier, la parade : un halo.
    if (j.garde || j.armure > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(j.garde?.contre ? '#ffffff' : p.c.c1, 0.6 + Math.sin(t / 3) * 0.2); g.lineWidth = 3;
      g.beginPath(); g.ellipse(j.x, j.y - 80, 52, 92, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }
  FX.dessinerFaisceaux(g, fx, c);
  FX.dessinerProjectiles(g, c, t);
  FX.dessinerParticules(g, fx);
  FX.dessinerTextes(g, fx);
  FX.dessinerCineUlti(g, fx, c);
  g.restore();

  dessinerHud(g, c, fx, hud, t);
  FX.dessinerAnnonces(g, fx);
  FX.dessinerPortraitUlti(g, fx);
  if (fx.flash) { g.fillStyle = rgba(fx.flash.c, (fx.flash.vie / fx.flash.max) * fx.flash.a); g.fillRect(0, 0, A.L, A.H); }
  // Le ralenti du K.O. : un voile sur les bords.
  if (c.ralenti > 0) {
    const v = g.createRadialGradient(A.L / 2, A.H / 2, 200, A.L / 2, A.H / 2, 620);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,0,0,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, A.L, A.H);
  }
}

/* ---- la fin du combat ---- */

function montrerFin() {
  const c = combat;
  const gagnant = c.joueurs[c.vainqueur];
  const humainGagne = config.mode === 'deux' || config.mode === 'entrainement' ? true : c.vainqueur === 0;
  const p = PERSO[gagnant.id];
  const r = records();
  r.combats += 1;
  if (config.mode !== 'deux' && c.vainqueur === 0) r.victoires += 1;
  r.combo = Math.max(r.combo, stats.comboMax[0], config.mode === 'deux' ? stats.comboMax[1] : 0);
  // Les succès.
  if (config.mode !== 'deux' && c.vainqueur === 0) {
    succes.debloquer('street-victoire');
    if (stats.perfect) succes.debloquer('street-perfect');
    if (stats.ultiKo) succes.debloquer('street-ulti');
  }
  if (Math.max(...stats.comboMax) >= 8 && (config.mode !== 'versus' || stats.comboMax[0] >= 8)) succes.debloquer('street-combo');

  let titre = config.mode === 'deux' ? `JOUEUR ${c.vainqueur + 1} GAGNE !` : humainGagne ? 'VICTOIRE !' : 'DÉFAITE…';
  let boutons = '<button class="btn" id="b-fin-menu">Menu</button><button class="btn" id="b-fin-choix">Changer de combattant</button><button class="btn rouge" id="b-fin-revanche">Revanche !</button>';
  let extra = '';
  // Histoire, tournoi, tour : le mode décide de la suite.
  if (config.suite) {
    titre = humainGagne ? 'VICTOIRE !' : 'DÉFAITE…';
    extra = config.texteFin ? config.texteFin(humainGagne, c) : '';
    boutons = humainGagne
      ? '<button class="btn rouge" id="b-fin-suite">Continuer ›</button>'
      : config.perdable
        ? '<button class="btn" id="b-fin-retente">Réessayer</button><button class="btn rouge" id="b-fin-suite">Continuer l’histoire ›</button>'
        : `<button class="btn" id="b-fin-menu">Menu</button><button class="btn rouge" id="b-fin-retente">${config.mode === 'histoire' ? 'Réessayer' : config.mode === 'tournoi' ? 'Recommencer le tournoi' : 'Recommencer la tour'}</button>`;
  }
  ecrire(CLE_RECORDS, r);
  $('fin').innerHTML = `<h2 class="fin-titre ${humainGagne ? 'victoire' : 'defaite'}">${titre}</h2>
    <canvas id="fin-portrait" width="1040" height="480"></canvas>
    ${p.cri ? `<p class="cri" style="--c:${p.c.c1}">« ${esc(p.cri)} »</p>` : ''}
    <p class="sous"><b style="color:${p.c.c1}">${esc(p.nom)}</b> l’emporte, ${gagnant.victoires} round${gagnant.victoires > 1 ? 's' : ''} à ${c.joueurs[1 - c.vainqueur].victoires}.</p>
    <div class="fin-stats"><span><b>${stats.comboMax[0]}</b>meilleur combo</span>${config.mode === 'deux' ? `<span><b>${stats.comboMax[1]}</b>combo J2</span>` : ''}<span><b>${c.round}</b>rounds</span></div>
    ${extra}
    <div class="ligne-boutons">${boutons}</div>`;
  ouvrir('ov-fin');
  son(humainGagne ? 'victoire' : 'ko');
  if (p.cri) setTimeout(() => dire(p.cri, voixDe(p)), 700);
  const cv = $('fin-portrait');
  const g = cv.getContext('2d');
  const fond = g.createLinearGradient(0, 0, cv.width, 0);
  fond.addColorStop(0, rgba(p.c.c2, 0.1)); fond.addColorStop(0.5, rgba(p.c.c1, 0.5)); fond.addColorStop(1, rgba(p.c.c2, 0.1));
  g.fillStyle = fond; g.fillRect(0, 0, cv.width, cv.height);
  dessinerCombattant(g, p, { x: cv.width / 2, y: cv.height * 0.97, dir: 1, pose: 'victoire', t: 10, echelle: 2.2, aura: 1 });
  const go = (f) => () => { fermer('ov-fin'); f(); };
  if ($('b-fin-menu')) $('b-fin-menu').onclick = go(majMenu);
  if ($('b-fin-choix')) $('b-fin-choix').onclick = go(() => commencerMode(config.mode));
  if ($('b-fin-revanche')) $('b-fin-revanche').onclick = go(() => demarrerCombat(config));
  const fin = { c, hpHero: c.joueurs[0].hp };
  if ($('b-fin-menu') && config.suite && !humainGagne) $('b-fin-menu').onclick = go(() => { config.abandon?.(); majMenu(); });
  if ($('b-fin-suite')) $('b-fin-suite').onclick = go(() => config.suite(humainGagne, fin));
  if ($('b-fin-retente')) $('b-fin-retente').onclick = go(() => config.reessayer());
}

/* ------------------------------------------------------------------ */
/* Les commandes : clavier, manettes, tactile                           */
/* ------------------------------------------------------------------ */

const touches = new Set();
const CLAVIER = [
  { g: ['q', 'a'], d: ['d'], h: ['z', 'w'], b: ['s'], P: ['f'], K: ['g'], G: ['r'], A: ['v'], B: ['b'], U: ['t'] },
  { g: ['arrowleft'], d: ['arrowright'], h: ['arrowup'], b: ['arrowdown'], P: ['1', 'j'], K: ['2', 'k'], G: ['3', 'l'], A: ['4', 'i'], B: ['5', 'u'], U: ['6', 'o'] },
];
const MANETTE = { P: 0, K: 1, G: 2, B: 3, A: 4, U: 5 };
const tactileEtat = { g: false, d: false, h: false, b: false, P: false, K: false, G: false, A: false, B: false, U: false };
const tactile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function entreesJoueur(n) {
  const e = { g: false, d: false, h: false, b: false, P: false, K: false, G: false, A: false, B: false, U: false };
  // Seul, on joue avec les deux moitiés du clavier ; à deux, chacun la sienne.
  const cartes = config.mode === 'deux' ? [CLAVIER[n]] : CLAVIER;
  for (const carte of cartes) for (const [k, liste] of Object.entries(carte)) if (liste.some((x) => touches.has(x))) e[k] = true;
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const pad = pads[config.mode === 'deux' ? n : 0];
  if (pad && (config.mode === 'deux' || n === 0)) {
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const bt = (i) => pad.buttons[i]?.pressed;
    if (ax < -0.5 || bt(14)) e.g = true;
    if (ax > 0.5 || bt(15)) e.d = true;
    if (ay < -0.5 || bt(12)) e.h = true;
    if (ay > 0.5 || bt(13)) e.b = true;
    for (const [k, i] of Object.entries(MANETTE)) if (bt(i)) e[k] = true;
  }
  if (n === 0) for (const k of Object.keys(e)) if (tactileEtat[k]) e[k] = true;
  return e;
}

function majTactile() {
  if (!tactile) return;
  const j = combat.joueurs[0];
  document.querySelectorAll('#manette-boutons .tb').forEach((b) => {
    const k = b.dataset.b;
    if (k === 'U') b.classList.toggle('pret', j.sp >= JAUGE.ulti);
    if (k === 'A') b.classList.toggle('pret', j.sp >= JAUGE.specA);
    if (k === 'B') b.classList.toggle('pret', j.sp >= JAUGE.specB);
  });
}

function brancherTactile() {
  const zone = $('manette-dir');
  const pommeau = $('manette-bouton');
  let id = null;
  const bouger = (e) => {
    const r = zone.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    const a = Math.atan2(dy, dx);
    pommeau.style.transform = `translate(${Math.cos(a) * d * 40}px, ${Math.sin(a) * d * 40}px)`;
    const mort = Math.hypot(dx, dy) < 16;
    tactileEtat.g = !mort && dx < -Math.abs(dy) * 0.5;
    tactileEtat.d = !mort && dx > Math.abs(dy) * 0.5;
    tactileEtat.h = !mort && dy < -Math.abs(dx) * 0.6;
    tactileEtat.b = !mort && dy > Math.abs(dx) * 0.6;
  };
  const lacher = () => { id = null; pommeau.style.transform = ''; tactileEtat.g = tactileEtat.d = tactileEtat.h = tactileEtat.b = false; };
  zone.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; zone.setPointerCapture(id); bouger(e); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) bouger(e); });
  zone.addEventListener('pointerup', (e) => { if (e.pointerId === id) lacher(); });
  zone.addEventListener('pointercancel', lacher);
  document.querySelectorAll('#manette-boutons .tb').forEach((b) => {
    const k = b.dataset.b;
    const bas = (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); tactileEtat[k] = true; b.classList.add('appui'); };
    const haut = () => { tactileEtat[k] = false; b.classList.remove('appui'); };
    b.addEventListener('pointerdown', bas);
    b.addEventListener('pointerup', haut);
    b.addEventListener('pointercancel', haut);
    b.addEventListener('pointerleave', haut);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

function commandesHtml() {
  const ligne = (quoi, k1, k2) => `<tr><td>${quoi}</td><td>${k1}</td>${k2 !== undefined ? `<td>${k2}</td>` : ''}</tr>`;
  const kb = (...l) => l.map((x) => `<kbd>${x}</kbd>`).join(' ');
  return `<div><h3>Clavier</h3><table>
      <tr><td></td><td><b>Joueur 1</b></td><td><b>Joueur 2</b></td></tr>
      ${ligne('Bouger', kb('Q', 'D'), kb('←', '→'))}${ligne('Sauter / s’accroupir', kb('Z', 'S'), kb('↑', '↓'))}
      ${ligne('👊 Poing', kb('F'), kb('J'))}${ligne('🦶 Pied', kb('G'), kb('K'))}${ligne('✊ Saisie', kb('R'), kb('L'))}
      ${ligne('Spécial B', kb('B'), kb('U'))}${ligne('Spécial A', kb('V'), kb('I'))}${ligne('ULTIME', kb('T'), kb('O'))}
    </table><p class="sous" style="font-size:.8rem;margin-top:6px">Seul, les deux claviers marchent. Le pavé numérique 1 à 6 marche aussi pour le joueur 2.</p></div>
    <div><h3>Manette</h3><table>
      ${ligne('Bouger', 'stick ou croix')}${ligne('👊 / 🦶', 'A / B')}${ligne('✊ Saisie', 'X')}${ligne('Spécial B', 'Y')}${ligne('Spécial A', 'LB')}${ligne('ULTIME', 'RB')}
    </table><h3 style="margin-top:12px">Téléphone</h3><p class="sous" style="font-size:.85rem">Le joystick à gauche, les boutons à droite. Les boutons A, B et ULTI s’allument quand la jauge le permet.</p></div>
    <div class="astuces"><h3>Pour bien se battre</h3>
      <b>Garder</b> : reculer (accroupi contre les balayages, debout contre les coups sautés). <b>Saisir</b> passe la garde, mais pas un adversaire en l’air.<br>
      <b>Enchaîner</b> : un coup qui touche s’annule dans le suivant. 👊 👊 🦶 finit sur la signature de votre combattant. Un coup qui touche s’annule aussi dans un spécial.<br>
      <b>Manipulations</b> (⬇️ ➡️ 👊…) : des techniques gratuites, propres à chaque combattant — voyez sa fiche.<br>
      <b>La jauge</b> se remplit en frappant et en encaissant : un segment pour le spécial B, deux pour le A, pleine pour l’ULTIME (à portée !).<br>
      <b>Jongler</b> : un adversaire en l’air peut encore être frappé… quatre fois au plus.</div>`;
}

/* ------------------------------------------------------------------ */
/* Branchements                                                         */
/* ------------------------------------------------------------------ */

function brancher() {
  $('b-histoire').addEventListener('click', () => { son('choix'); ouvrirSauvegardes(); });
  $('slots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    son('choix');
    if (b.dataset.nouvelle !== undefined) { prep.slot = Number(b.dataset.nouvelle); ouvrirDifficultes('histoire'); }
    if (b.dataset.continuer !== undefined) continuerHistoire(Number(b.dataset.continuer));
    if (b.dataset.journal !== undefined) ouvrirJournal(Number(b.dataset.journal));
    if (b.dataset.legende !== undefined) {
      const k = Number(b.dataset.legende);
      const ancien = sauvegardes()[k];
      if (!confirm('Commencer le mode Légende ? L’histoire recommence, plus difficile, avec le même héros. (Cette sauvegarde terminée sera remplacée.)')) return;
      prep.slot = k;
      prep.difficulte = ancien.difficulte;
      const h = nouvellePartie(ancien.hero, ancien.difficulte);
      if (ancien.createur) h.createur = ancien.createur;
      h.drapeaux.legende = true;
      partie = { slot: k, h, depuis: Date.now() };
      inscrireHeros(h);
      sauver(true);
      jouerScene();
    }
    if (b.dataset.modifier !== undefined) { const k = Number(b.dataset.modifier); ouvrirCreateur(sauvegardes()[k].createur, 'modifier', k); }
    if (b.dataset.efface !== undefined) {
      const k = Number(b.dataset.efface);
      if (!confirm(`Effacer la sauvegarde de l’emplacement ${k + 1} ?`)) return;
      const l = sauvegardes();
      l[k] = null;
      ecrire(CLE_SAUVEGARDES, l);
      ouvrirSauvegardes();
    }
  });
  $('b-reset').addEventListener('click', reinitialiser);
  const majVoix = () => { for (const id of ['b-voix-menu', 'b-voix']) $(id).textContent = voixActives() ? '🗣️ Voix' : '🤐 Voix coupées'; };
  for (const id of ['b-voix-menu', 'b-voix']) $(id).addEventListener('click', () => { basculerVoix(); majVoix(); if (voixActives()) dire('Voix activées !', voixDe({ id: 'annonceur' })); });
  majVoix();
  $('createur-options').addEventListener('click', (e) => {
    const b = e.target.closest('[data-champ]');
    if (!b) return;
    const d = createur.def;
    const { champ, val } = b.dataset;
    if (champ === 'accessoires') {
      if (d.accessoires.includes(val)) d.accessoires = d.accessoires.filter((x) => x !== val);
      else if (d.accessoires.length < MAX_ACCESSOIRES) d.accessoires.push(val);
      else { toast(`${MAX_ACCESSOIRES} accessoires au plus`); return; }
    } else d[champ] = val;
    // Changer de genre accorde la voix (on peut la régler ensuite).
    if (champ === 'genre') d.voixTimbre = val === 'f' ? Math.max(d.voixTimbre ?? 0, 0.8) : Math.min(d.voixTimbre ?? 1, 0.2);
    son('choix');
    majCreateur();
    if (champ === 'genre') ecouterHeros();
  });
  $('createur-nom').addEventListener('input', (e) => { createur.def.nom = e.target.value; });
  // Les réglages de la voix : glisser ne redessine pas tout ; lâcher fait entendre.
  $('createur-options').addEventListener('input', (e) => { const r = e.target.closest('[data-voix]'); if (r) createur.def[r.dataset.voix] = Number(r.value); });
  $('createur-options').addEventListener('change', (e) => { if (e.target.closest('[data-voix]')) ecouterHeros(); });
  $('createur-options').addEventListener('click', (e) => { if (e.target.closest('[data-ecouter]')) ecouterHeros(); });
  $('createur-hasard').addEventListener('click', () => { createur.def = herosAuHasard(); $('createur-nom').value = createur.def.nom; son('choix'); majCreateur(); });
  $('createur-ok').addEventListener('click', validerCreateur);
  $('createur-retour').addEventListener('click', () => (createur.mode === 'nouveau' ? ouvrirDifficultes('histoire') : ouvrirSauvegardes()));
  $('b-tournoi').addEventListener('click', () => {
    son('choix');
    if (lire(CLE_TOURNOI, null)) montrerTableau(); else ouvrirDifficultes('tournoi');
  });
  $('b-tour').addEventListener('click', () => {
    son('choix');
    if (lire(CLE_TOUR, null)) montrerTour(); else commencerMode('tour');
  });
  // La cinématique : un toucher avance, « Passer » saute.
  $('s-cine').addEventListener('click', (e) => { if (!e.target.closest('#cine-passer, #cine-quitter, #cine-choix')) avancerCine(); });
  $('cine-passer').addEventListener('click', () => passerCine());
  $('cine-quitter').addEventListener('click', () => quitterCine());
  $('b-versus').addEventListener('click', () => { son('choix'); commencerMode('versus'); });
  $('b-deux').addEventListener('click', () => { son('choix'); commencerMode('deux'); });
  $('b-entrainement').addEventListener('click', () => { son('choix'); commencerMode('entrainement'); });
  $('b-commandes').addEventListener('click', () => { $('commandes').innerHTML = commandesHtml(); ouvrir('ov-commandes'); });
  const sonBouton = (b) => b.addEventListener('click', () => { const m = basculerSon(); $('b-son-menu').textContent = m ? '🔇' : '🔊'; $('b-son').textContent = m ? '🔇 Son coupé' : '🔊 Son'; });
  sonBouton($('b-son-menu')); sonBouton($('b-son'));
  document.querySelectorAll('[data-va]').forEach((b) => b.addEventListener('click', () => (b.dataset.va === 's-menu' ? majMenu() : aller(b.dataset.va))));
  document.addEventListener('click', (e) => { const f = e.target.closest('[data-ferme]'); if (f) fermer(f.dataset.ferme); });
  // La liste des coups et les commandes se ferment aussi d'un toucher à côté, ou avec Échap.
  for (const id of ['ov-coups', 'ov-commandes']) $(id).addEventListener('click', (e) => { if (e.target.id === id) fermer(id); });

  $('difficultes').addEventListener('click', (e) => {
    const d = e.target.closest('[data-diff]');
    if (!d) return;
    son('valide');
    prep.difficulte = d.dataset.diff;
    if (prep.modeDiff === 'histoire') { ouvrirCreateur(); return; }
    commencerMode(prep.modeDiff);
  });

  $('grille-persos').addEventListener('click', (e) => {
    const b = e.target.closest('.carte-perso');
    if (!b) return;
    if (b.classList.contains('verrou') || b.classList.contains('cache')) { toast(b.title); return; }
    if (prep.choix === b.dataset.id) { validerChoix(); return; }
    prep.choix = b.dataset.id;
    son('choix');
    marquerChoix();
  });
  $('choix-ok').addEventListener('click', validerChoix);
  $('choix-hasard').addEventListener('click', () => {
    const dispo = PERSOS.filter(disponible);
    prep.choix = dispo[Math.floor(Math.random() * dispo.length)].id;
    son('choix');
    marquerChoix();
  });
  $('choix-retour').addEventListener('click', () => {
    if (prep.etape === 2) { prep.etape = 1; ouvrirChoix(); return; }
    if (prep.mode === 'histoire' || prep.mode === 'tournoi') ouvrirDifficultes(prep.mode); else majMenu();
  });

  $('niveaux-ia').addEventListener('click', (e) => {
    const b = e.target.closest('[data-niveau]');
    if (!b) return;
    prep.niveau = b.dataset.niveau;
    ecrire(CLE_NIVEAU, prep.niveau);
    document.querySelectorAll('#niveaux-ia button').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('grille-arenes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-arene]');
    if (!b) return;
    son('valide');
    const ia = prep.mode === 'versus' ? { 1: prep.niveau } : prep.mode === 'entrainement' ? {} : {};
    demarrerCombat({ p1: prep.p1, p2: prep.p2, arene: b.dataset.arene, ia, mode: prep.mode });
  });
  $('arenes-retour').addEventListener('click', () => { prep.etape = 2; ouvrirChoix(); });

  $('b-pause').addEventListener('click', () => { enPause = true; ouvrir('ov-pause'); });
  $('b-reprendre').addEventListener('click', () => { enPause = false; derniere = performance.now(); });
  $('b-coups-pause').addEventListener('click', () => {
    const ids = config.mode === 'deux' ? [config.p1, config.p2] : [config.p1];
    $('coups').innerHTML = ids.map((id) => `<h2 style="color:${PERSO[id].c.c1}">${esc(PERSO[id].nom)}</h2>${listeCoupsHtml(PERSO[id])}`).join('');
    ouvrir('ov-coups');
  });
  $('b-quitter').addEventListener('click', () => {
    fermer('ov-pause'); enPause = false; combat = null;
    if (config?.mode === 'histoire' && partie) { quitterHistoire(); return; }
    majMenu();
  });

  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if ($('s-cine').classList.contains('is-active')) {
      if (k === ' ' && infiltrationEnCours()) { e.preventDefault(); tenirInfiltration(true); return; }
      if (k === 'enter' || k === ' ') { e.preventDefault(); avancerCine(); }
      if (['1', '2', '3'].includes(k)) choisirCine(Number(k) - 1);
      if (k === 'escape') passerCine();
      return;
    }
    if (k === 'escape' && (!$('ov-coups').hidden || !$('ov-commandes').hidden)) { fermer('ov-coups'); fermer('ov-commandes'); return; }
    if ($('s-combat').classList.contains('is-active')) {
      if (k === 'escape' || k === 'p') {
        enPause = !enPause;
        if (enPause) ouvrir('ov-pause'); else { fermer('ov-pause'); derniere = performance.now(); }
        return;
      }
      if (k === 'h') { appelerAllie(); return; }
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    }
    touches.add(k);
  });
  addEventListener('keyup', (e) => { touches.delete(e.key.toLowerCase()); if (e.key === ' ') tenirInfiltration(false); });
  $('s-cine').addEventListener('pointerdown', () => tenirInfiltration(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('s-cine').addEventListener(ev, () => tenirInfiltration(false));
  $('b-allie').addEventListener('pointerdown', (e) => { e.preventDefault(); appelerAllie(); });
  $('b-codex').addEventListener('click', () => { son('choix'); CODEX.ouvrir(); });
  addEventListener('blur', () => touches.clear());
  addEventListener('resize', () => {
    if ($('s-combat').classList.contains('is-active')) dimensionner();
    if ($('s-cine').classList.contains('is-active')) dimensionnerCine();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && combat && $('s-combat').classList.contains('is-active') && !finMontree) { enPause = true; ouvrir('ov-pause'); }
  });
  brancherTactile();
}

/** Le thème joué : selon l'écran, la scène de l'histoire, le combat. */
const theme = (n) => (n === null ? null : !n || n === 'combat' ? 'street' : `street-${n}`);
function musiqueDuMoment() {
  const ecran = document.querySelector('.ecran.is-active')?.id;
  if (ecran === 's-cine') return theme(musiqueCine());
  // L'écran avant un combat de l'histoire garde la musique de la scène.
  if (ecran === 's-combat' && config) return theme(config.musique);
  if (!$('ov-etape').hidden && partie) return theme(musiqueCine());
  return 'street';
}

brancher();
succes.visiter('street');
majMenu();
installerMusique('street', { actif: () => !estMuet(), theme: musiqueDuMoment });

if ('serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// Pour l'aperçu et les tests dans le navigateur.
window.__street = {
  demarrerCombat, etat: () => combat, effets: () => fx,
  /** Fait avancer le combat de n images, touches tenues (pour vérifier l'affichage sans attendre l'écran). */
  figer(v = true) { enPause = v; },
  cine: (etapes, hero) => cinematique(etapes, hero),
  histoire: HIST,
  musique: () => musiqueDuMoment(),
  avancer(n, tenues = []) { for (const k of tenues) touches.add(k); for (let i = 0; i < n; i++) pasDeCombat(); for (const k of tenues) touches.delete(k); dessiner(); },
};
void STATUTS; void BOSS; void SECRETS;
