/**
 * STREET COMBAT — l'écran : les menus, le choix des combattants et de
 * l'arène, la campagne, et la boucle du combat (60 images par seconde, le
 * moteur avance à pas fixes, l'écran dessine ce qu'il voit).
 *
 * Les commandes : le clavier (un ou deux joueurs), les manettes, et les
 * commandes tactiles pour le téléphone.
 */

import { PERSOS, PERSO, ROSTER, BOSS, JAUGE, STATUTS, lireEntree } from '../../../shared/street/persos.js';
import { creerCombat, pas, evenements, pose, ARENE as A } from '../../../shared/street/combat.js';
import { dessinerCombattant, dessinerPortrait, rgba, teinte } from './dessin.js';
import { ARENES, ARENE, fondArene, animerArene } from './arenes.js';
import * as FX from './effets.js';
import { creerHud, dessinerHud } from './hud.js';
import { jouer as son, estMuet, basculerSon } from './son.js';
import { installerMusique } from '../../../shared/musique.js';
import * as succes from '../../../shared/succes.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function lire(cle, defaut) { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } }
function ecrire(cle, v) { try { if (v == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(v)); } catch { /* plein */ } }

const CLE_DEBLOQUES = 'street.debloques';
const CLE_RECORDS = 'street.records';
const CLE_CAMPAGNE = 'street.campagne';
const CLE_NIVEAU = 'street.niveau';
const NIVEAUX = [['facile', 'Facile'], ['normal', 'Normal'], ['difficile', 'Difficile'], ['impossible', 'Impossible']];

/** La campagne : combien de combats, à quel niveau, et le boss au bout. */
const CAMPAGNES = {
  normal: { nom: 'NORMAL', combats: 6, niveaux: ['facile', 'facile', 'normal', 'normal', 'normal', 'difficile'], boss: 'solarius', niveauBoss: 'difficile', couleur: '#36d46a', glyphe: '☀️' },
  difficile: { nom: 'DIFFICILE', combats: 8, niveaux: ['normal', 'normal', 'normal', 'difficile', 'difficile', 'difficile', 'difficile', 'impossible'], boss: 'malvortex', niveauBoss: 'impossible', couleur: '#ffc83d', glyphe: '😈' },
  impossible: { nom: 'IMPOSSIBLE', combats: 10, niveaux: ['difficile', 'difficile', 'difficile', 'difficile', 'impossible', 'impossible', 'impossible', 'impossible', 'impossible', 'impossible'], boss: 'lechaos', niveauBoss: 'impossible', couleur: '#ff2a4a', glyphe: '🌌' },
};

const debloques = () => new Set(lire(CLE_DEBLOQUES, []));
const disponible = (p) => !p.boss || debloques().has(p.id);
const records = () => ({ victoires: 0, combats: 0, combo: 0, campagnes: {}, ...lire(CLE_RECORDS, {}) });

/* ------------------------------------------------------------------ */
/* Petits outils                                                        */
/* ------------------------------------------------------------------ */

function aller(id) {
  document.querySelectorAll('.ecran').forEach((e) => e.classList.toggle('is-active', e.id === id));
  if (id !== 's-combat') arreterBoucle();
  animMenu.actif = id === 's-menu';
  animFiche.actif = id === 's-choix';
  if (animMenu.actif || animFiche.actif) relancerDecor();
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
let decorRaf = 0;

function relancerDecor() {
  if (decorRaf) return;
  const boucle = () => {
    decorRaf = 0;
    if (animMenu.actif) dessinerFondMenu();
    if (animFiche.actif) dessinerFiche();
    if (animMenu.actif || animFiche.actif) decorRaf = requestAnimationFrame(boucle);
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
  const camp = lire(CLE_CAMPAGNE, null);
  $('campagne-info').textContent = camp ? `Reprendre : combat ${camp.etape + 1}/${camp.file.length} (${CAMPAGNES[camp.difficulte].nom.toLowerCase()})` : '';
  const r = records();
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
    campagne: ['Votre combattant pour la campagne'],
  };
  $('choix-titre').textContent = titres[prep.mode][prep.etape - 1];
  $('choix-ok').textContent = prep.etape === 1 && prep.mode !== 'campagne' ? 'Choisir ›' : 'Combattre !';
  if (prep.mode === 'campagne') $('choix-ok').textContent = 'En route !';
  const grille = $('grille-persos');
  grille.innerHTML = '';
  for (const p of PERSOS) {
    const b = document.createElement('button');
    b.className = 'carte-perso';
    b.dataset.id = p.id;
    if (!disponible(p) || (prep.mode === 'campagne' && p.boss && !disponible(p))) b.classList.add('verrou');
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
    b.title = disponible(p) ? p.nom : `${p.nom} — battez la campagne ${CAMPAGNES[p.boss].nom.toLowerCase()} pour le débloquer`;
    grille.append(b);
  }
  prep.choix = prep.etape === 1 ? prep.p1 : (prep.p2 || ROSTER[Math.floor(Math.random() * ROSTER.length)].id);
  if (!disponible(PERSO[prep.choix])) prep.choix = 'ryuken';
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
    ${verrou ? `<p class="debloque">🔒 Battez la campagne ${CAMPAGNES[p.boss].nom.toLowerCase()} pour le débloquer.</p>` : ''}
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
  if (prep.mode === 'campagne') { lancerCampagne(prep.choix); return; }
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
/* La campagne                                                          */
/* ------------------------------------------------------------------ */

function ouvrirDifficultes() {
  const r = records();
  $('difficultes').innerHTML = Object.entries(CAMPAGNES).map(([id, c]) => {
    const boss = PERSO[c.boss];
    return `<button class="diff" data-diff="${id}" style="--c:${c.couleur}">
      <span class="boss-ic">${c.glyphe}</span><b>${c.nom}</b>
      <small>${c.combats} combats, puis <strong>${esc(boss.nom)}</strong>, ${esc(boss.desc.toLowerCase())}.</small>
      ${r.campagnes[id] ? `<small class="fait">✔ Terminée — ${esc(boss.nom)} débloqué</small>` : ''}
    </button>`;
  }).join('');
  aller('s-difficulte');
}

function lancerCampagne(perso) {
  const d = CAMPAGNES[prep.difficulte];
  const autres = ROSTER.filter((p) => p.id !== perso).map((p) => p.id).sort(() => Math.random() - 0.5);
  const file = [];
  while (file.length < d.combats) file.push(autres[file.length % autres.length]);
  file.push(d.boss);
  const normales = ARENES.filter((a) => !a.boss).map((a) => a.id).sort(() => Math.random() - 0.5);
  const arenes = file.map((_, k) => normales[k % normales.length]);
  arenes[arenes.length - 1] = ARENES.find((a) => a.boss === d.boss).id;
  const niveaux = [...d.niveaux, d.niveauBoss];
  ecrire(CLE_CAMPAGNE, { difficulte: prep.difficulte, perso, file, arenes, niveaux, etape: 0 });
  montrerEtape();
}

function montrerEtape() {
  const camp = lire(CLE_CAMPAGNE, null);
  if (!camp) { majMenu(); return; }
  const adv = PERSO[camp.file[camp.etape]];
  const moi = PERSO[camp.perso];
  const boss = camp.etape === camp.file.length - 1;
  $('etape').innerHTML = `<h2>${boss ? '⚠️ LE BOSS ⚠️' : `Combat ${camp.etape + 1} / ${camp.file.length}`}</h2>
    <div class="etape-route">${camp.file.map((_, k) => `<span class="${k < camp.etape ? 'fait' : k === camp.etape ? 'ici' : ''}${k === camp.file.length - 1 ? ' boss' : ''}">${k === camp.file.length - 1 ? '💀' : k + 1}</span>`).join('')}</div>
    <canvas id="etape-vs" width="1040" height="480"></canvas>
    <p class="sous">${esc(moi.nom)} contre <b style="color:${adv.c.c1}">${esc(adv.nom)}</b> — ${esc(ARENE[camp.arenes[camp.etape]].nom)} · ordinateur ${esc(camp.niveaux[camp.etape])}</p>
    <div class="ligne-boutons"><button class="btn" id="b-etape-quitter">Abandonner</button><button class="btn rouge" id="b-etape-go">⚔️ Combattre !</button></div>`;
  ouvrir('ov-etape');
  dessinerVs($('etape-vs'), moi, adv);
  son('annonce');
  $('b-etape-go').onclick = () => {
    fermer('ov-etape');
    demarrerCombat({ p1: camp.perso, p2: adv.id, arene: camp.arenes[camp.etape], ia: { 1: camp.niveaux[camp.etape] }, mode: 'campagne' });
  };
  $('b-etape-quitter').onclick = () => {
    if (!confirm('Abandonner la campagne ?')) return;
    ecrire(CLE_CAMPAGNE, null);
    fermer('ov-etape');
    majMenu();
  };
}

function dessinerVs(cv, a, b) {
  const g = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;
  g.fillStyle = '#05020a'; g.fillRect(0, 0, w, h);
  for (const [p, x0, sens] of [[a, 0, 1], [b, w / 2, -1]]) {
    const gr = g.createLinearGradient(x0, 0, x0 + w / 2, 0);
    gr.addColorStop(sens > 0 ? 0 : 1, rgba(p.c.c2, 0.9)); gr.addColorStop(sens > 0 ? 1 : 0, rgba(p.c.c2, 0.1));
    g.fillStyle = gr; g.fillRect(x0, 0, w / 2, h);
    dessinerCombattant(g, p, { x: x0 + w / 4, y: h * 0.98, dir: sens, pose: 'repos', t: 10, echelle: 2.1, aura: 0.7 });
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
  const arene = o.arene === 'hasard' || !o.arene ? ARENES.filter((a) => !a.boss)[Math.floor(Math.random() * 11)].id : o.arene;
  config.areneId = arene;
  combat = creerCombat({ p1: o.p1, p2: o.p2, ia: o.ia || {}, entrainement: o.mode === 'entrainement', graine: Date.now() });
  fx = FX.creerEffets();
  hud = creerHud();
  stats = { comboMax: [0, 0], ultiKo: false, perfect: false };
  finMontree = false;
  enPause = false;
  hpAvant[0] = combat.joueurs[0].hp; hpAvant[1] = combat.joueurs[1].hp;
  touches.clear();
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
    if (ev.type === 'annonce') son(ev.ko ? 'ko' : 'annonce');
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
    dessinerCombattant(g, p, {
      x: j.x, y: j.y, dir: j.dir, pose: pose(j), t: j.anim, p: progres, enLAir: !j.sol, alpha,
      aura: j.etat === 'ulti' ? 1 : j.sp >= 100 ? 0.45 + Math.sin(t / 6) * 0.2 : 0,
      statuts: Object.keys(j.statuts).length ? j.statuts : null, eclat: eclats[j.n] * 0.8,
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
  if (config.mode === 'campagne') {
    const camp = lire(CLE_CAMPAGNE, null);
    if (humainGagne) {
      camp.etape += 1;
      if (camp.etape >= camp.file.length) {
        // La campagne est gagnée : le boss rejoint le roster.
        const d = CAMPAGNES[camp.difficulte];
        const deb = debloques();
        const nouveau = !deb.has(d.boss);
        deb.add(d.boss);
        ecrire(CLE_DEBLOQUES, [...deb]);
        r.campagnes[camp.difficulte] = true;
        ecrire(CLE_CAMPAGNE, null);
        succes.debloquer('street-campagne');
        if (d.boss === 'lechaos') succes.debloquer('street-chaos');
        titre = 'CAMPAGNE GAGNÉE !';
        extra = `<p class="debloque">${nouveau ? '🔓 Nouveau combattant débloqué' : '🏆 Boss vaincu'} : <b>${esc(PERSO[d.boss].nom)}</b> ${nouveau ? '— et son arène !' : ''}</p>`;
        boutons = '<button class="btn or" id="b-fin-menu">Menu</button>';
      } else {
        ecrire(CLE_CAMPAGNE, camp);
        boutons = '<button class="btn" id="b-fin-menu">Menu</button><button class="btn rouge" id="b-fin-suite">Combat suivant ›</button>';
      }
    } else {
      boutons = '<button class="btn" id="b-fin-menu">Menu</button><button class="btn rouge" id="b-fin-retente">Réessayer</button>';
    }
  }
  ecrire(CLE_RECORDS, r);
  $('fin').innerHTML = `<h2 class="fin-titre ${humainGagne ? 'victoire' : 'defaite'}">${titre}</h2>
    <canvas id="fin-portrait" width="1040" height="480"></canvas>
    <p class="sous"><b style="color:${p.c.c1}">${esc(p.nom)}</b> l’emporte, ${gagnant.victoires} round${gagnant.victoires > 1 ? 's' : ''} à ${c.joueurs[1 - c.vainqueur].victoires}.</p>
    <div class="fin-stats"><span><b>${stats.comboMax[0]}</b>meilleur combo</span>${config.mode === 'deux' ? `<span><b>${stats.comboMax[1]}</b>combo J2</span>` : ''}<span><b>${c.round}</b>rounds</span></div>
    ${extra}
    <div class="ligne-boutons">${boutons}</div>`;
  ouvrir('ov-fin');
  son(humainGagne ? 'victoire' : 'ko');
  const cv = $('fin-portrait');
  const g = cv.getContext('2d');
  const fond = g.createLinearGradient(0, 0, cv.width, 0);
  fond.addColorStop(0, rgba(p.c.c2, 0.1)); fond.addColorStop(0.5, rgba(p.c.c1, 0.5)); fond.addColorStop(1, rgba(p.c.c2, 0.1));
  g.fillStyle = fond; g.fillRect(0, 0, cv.width, cv.height);
  dessinerCombattant(g, p, { x: cv.width / 2, y: cv.height * 0.97, dir: 1, pose: 'victoire', t: 10, echelle: 2.2, aura: 1 });
  const go = (f) => () => { fermer('ov-fin'); f(); };
  $('b-fin-menu').onclick = go(majMenu);
  if ($('b-fin-choix')) $('b-fin-choix').onclick = go(() => commencerMode(config.mode));
  if ($('b-fin-revanche')) $('b-fin-revanche').onclick = go(() => demarrerCombat(config));
  if ($('b-fin-suite')) $('b-fin-suite').onclick = go(montrerEtape);
  if ($('b-fin-retente')) $('b-fin-retente').onclick = go(montrerEtape);
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
  $('b-campagne').addEventListener('click', () => {
    son('choix');
    if (lire(CLE_CAMPAGNE, null)) montrerEtape(); else ouvrirDifficultes();
  });
  $('b-versus').addEventListener('click', () => { son('choix'); commencerMode('versus'); });
  $('b-deux').addEventListener('click', () => { son('choix'); commencerMode('deux'); });
  $('b-entrainement').addEventListener('click', () => { son('choix'); commencerMode('entrainement'); });
  $('b-commandes').addEventListener('click', () => { $('commandes').innerHTML = commandesHtml(); ouvrir('ov-commandes'); });
  const sonBouton = (b) => b.addEventListener('click', () => { const m = basculerSon(); $('b-son-menu').textContent = m ? '🔇' : '🔊'; $('b-son').textContent = m ? '🔇 Son coupé' : '🔊 Son'; });
  sonBouton($('b-son-menu')); sonBouton($('b-son'));
  document.querySelectorAll('[data-va]').forEach((b) => b.addEventListener('click', () => (b.dataset.va === 's-menu' ? majMenu() : aller(b.dataset.va))));
  document.addEventListener('click', (e) => { const f = e.target.closest('[data-ferme]'); if (f) fermer(f.dataset.ferme); });

  $('difficultes').addEventListener('click', (e) => {
    const d = e.target.closest('[data-diff]');
    if (!d) return;
    son('valide');
    prep.difficulte = d.dataset.diff;
    commencerMode('campagne');
  });

  $('grille-persos').addEventListener('click', (e) => {
    const b = e.target.closest('.carte-perso');
    if (!b) return;
    if (b.classList.contains('verrou')) { toast(b.title); return; }
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
    if (prep.mode === 'campagne') ouvrirDifficultes(); else majMenu();
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
  $('b-quitter').addEventListener('click', () => { fermer('ov-pause'); enPause = false; combat = null; majMenu(); });

  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ($('s-combat').classList.contains('is-active')) {
      if (k === 'escape' || k === 'p') {
        enPause = !enPause;
        if (enPause) ouvrir('ov-pause'); else { fermer('ov-pause'); derniere = performance.now(); }
        return;
      }
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    }
    touches.add(k);
  });
  addEventListener('keyup', (e) => touches.delete(e.key.toLowerCase()));
  addEventListener('blur', () => touches.clear());
  addEventListener('resize', () => { if ($('s-combat').classList.contains('is-active')) dimensionner(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && combat && $('s-combat').classList.contains('is-active') && !finMontree) { enPause = true; ouvrir('ov-pause'); }
  });
  brancherTactile();
}

brancher();
succes.visiter('street');
majMenu();
installerMusique('street', { actif: () => !estMuet() });

if ('serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

// Pour l'aperçu et les tests dans le navigateur.
window.__street = {
  demarrerCombat, etat: () => combat, effets: () => fx,
  /** Fait avancer le combat de n images, touches tenues (pour vérifier l'affichage sans attendre l'écran). */
  figer(v = true) { enPause = v; },
  avancer(n, tenues = []) { for (const k of tenues) touches.add(k); for (let i = 0; i < n; i++) pasDeCombat(); for (const k of tenues) touches.delete(k); dessiner(); },
};
void STATUTS; void BOSS;
